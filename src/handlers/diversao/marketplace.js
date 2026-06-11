/**
 * Handler de Marketplace — Bot
 * Sistema de compra/venda entre usuários
 *
 * v4.0 — Arquivo único, sem duplicatas, sem 'use strict' soltos:
 *  - Um único 'use strict' no topo
 *  - BUY_COOLDOWNS, checkCooldown, parseBuyArgs, buildMensagem* declarados UMA vez
 *  - CONFIG centralizado com todas as chaves usadas no código
 *  - logSchema com índices compostos reais (não só comentário)
 *  - logSchema com compradorNome/vendedorNome para exibição no histórico
 *  - executarCompra salva nomes no log
 *  - executarCompra: !saldoDoc verificado antes de acessar .gold
 *  - handleOfertar: getQuantidadeInventario recebe session na mensagem de erro
 *  - handleOfertar: contagem de ofertas relida após commit (não +1 hardcoded)
 *  - handleAvenda/$or cobre documentos legados sem expiresAt
 *  - handleBuscarOferta/$or idem
 */

'use strict';

const path     = require('path');
const mongoose = require('mongoose');
const Usuario  = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────

function tryRequire(modPath, label) {
  try {
    return require(modPath);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.warn(`[Market] Módulo opcional não encontrado: ${label} (${modPath}). Ignorando.`);
      return {};
    }
    throw e;
  }
}

const { ITENS_LOJA }                   = tryRequire('./economia', 'economia');
const { ITENS_ROUBO, ITENS_SEGURANCA } = tryRequire('./roubo',    'roubo');
const { VARAS_PESCA, ISCAS }           = tryRequire('./pesca',    'pesca');

let CATALOGO_COMPLETO = {
  ...(ITENS_LOJA      || {}),
  ...(ITENS_ROUBO     || {}),
  ...(ITENS_SEGURANCA || {}),
  ...(VARAS_PESCA     || {}),
  ...(ISCAS           || {}),
};

function registerCatalog(itens = {}) {
  CATALOGO_COMPLETO = { ...CATALOGO_COMPLETO, ...itens };
}

function getNomeItem(itemKey) {
  return CATALOGO_COMPLETO[itemKey]?.nome ?? itemKey;
}

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG = {
  TAXA_MERCADO_PCT:                5,
  MAX_OFERTAS_USER:                10,
  PRECO_MINIMO:                    1,
  PRECO_MAXIMO:                    999_999,
  QTD_MINIMA:                      1,
  QTD_MAXIMA:                      999,
  MAX_QTD_COMPRA:                  99,
  OFERTA_EXPIRA_DIAS:              7,
  ITENS_POR_PAGINA:                10,
  COOLDOWN_BUY_MS:                 3_000,
  COOLDOWN_BUY_CLEANUP_INTERVAL_MS: 10 * 60 * 1_000,
  TRANSACTION_TIMEOUT_MS:          10_000,
};

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const ofertaSchema = new mongoose.Schema(
  {
    sellerId:   { type: String, required: true },
    sellerName: { type: String, required: true, trim: true },
    itemKey:    { type: String, required: true, trim: true, lowercase: true },
    itemNome:   { type: String, required: true, trim: true },
    preco: {
      type:     Number,
      required: true,
      min:      [CONFIG.PRECO_MINIMO, `Preço mínimo é ${CONFIG.PRECO_MINIMO}`],
      max:      [CONFIG.PRECO_MAXIMO, `Preço máximo é ${CONFIG.PRECO_MAXIMO}`],
      validate: {
        validator: Number.isInteger,
        message:   'Preço deve ser um inteiro',
      },
    },
    quantidade: {
      type:     Number,
      required: true,
      min:      [1,                `Quantidade mínima é 1`],
      max:      [CONFIG.QTD_MAXIMA, `Quantidade máxima é ${CONFIG.QTD_MAXIMA}`],
      validate: {
        validator: Number.isInteger,
        message:   'Quantidade deve ser um inteiro',
      },
    },
    expiresAt: {
      type:    Date,
      default: CONFIG.OFERTA_EXPIRA_DIAS > 0
        ? () => new Date(Date.now() + CONFIG.OFERTA_EXPIRA_DIAS * 86_400_000)
        : null,
    },
  },
  {
    timestamps: true,   // gerencia createdAt e updatedAt; evita dessincronismo em upserts
    strict:     true,
    versionKey: false,  // remove __v — não usado, gera writes extras
  }
);

// ── Índices de ofertaSchema ──────────────────────────────────────────────────

ofertaSchema.index({ sellerId: 1, itemKey: 1 }, { unique: true }); // chave de negócio
ofertaSchema.index({ createdAt: -1 });                              // handleAvenda (listagem pública)
ofertaSchema.index({ itemKey: 1, preco: 1 });                       // handleBuscarOferta (mais barato primeiro)
ofertaSchema.index({ sellerId: 1, createdAt: -1 });                 // handleMinhasOfertas / handleOfertar

if (CONFIG.OFERTA_EXPIRA_DIAS > 0) {
  ofertaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL automático
}

// ─────────────────────────────────────────────────────────────────────────────

const logSchema = new mongoose.Schema(
  {
    compradorId:   { type: String, required: true },
    compradorNome: { type: String, default: null, trim: true },
    vendedorId:    { type: String, required: true },
    vendedorNome:  { type: String, default: null, trim: true },
    itemKey:       { type: String, required: true, trim: true, lowercase: true },
    itemNome:      { type: String, required: true, trim: true },
    quantidade: {
      type:     Number,
      required: true,
      min:      [1, 'Quantidade mínima é 1'],
      validate: { validator: Number.isInteger, message: 'Quantidade deve ser um inteiro' },
    },
    precoUnit: {
      type:     Number,
      required: true,
      min:      [CONFIG.PRECO_MINIMO, `Preço mínimo é ${CONFIG.PRECO_MINIMO}`],
      validate: { validator: Number.isInteger, message: 'Preço deve ser um inteiro' },
    },
    totalBruto:   { type: Number, required: true, min: [0, 'totalBruto não pode ser negativo']   },
    taxa:         { type: Number, required: true, min: [0, 'taxa não pode ser negativa']          },
    totalLiquido: { type: Number, required: true, min: [0, 'totalLiquido não pode ser negativo']  },
  },
  {
    timestamps: true,
    strict:     true,
    versionKey: false,
  }
);

// ── Índices de logSchema ─────────────────────────────────────────────────────

// handleHistoricoMarket — query $or cobre os dois lados em uma só consulta.
// MongoDB executa $or sobre campos indexados separadamente via index union,
// mas um índice por campo ainda é necessário para cada ramo do $or.
logSchema.index({ compradorId: 1, createdAt: -1 }); // ramo compradorId do $or
logSchema.index({ vendedorId:  1, createdAt: -1 }); // ramo vendedorId  do $or

// Índice de suporte ao countDocuments({ $or: [...] }) — cobre o count total
// sem collection scan. Sem ele, o count lê todos os documentos da coleção.
logSchema.index({ compradorId: 1, vendedorId: 1 });

// ─────────────────────────────────────────────────────────────────────────────

// ?? em vez de || para evitar falsy acidental em modelo já registrado
const Oferta    = mongoose.models.Oferta    ?? mongoose.model('Oferta',    ofertaSchema);
const MarketLog = mongoose.models.MarketLog ?? mongoose.model('MarketLog', logSchema);
// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function getUserId(msg) {
  if (!msg?.key) return null;
  return msg.key.participant ?? msg.key.remoteJid ?? null;
}

function formatarNumero(jid = '') {
  if (!jid) return '';
  return String(jid).replace(/@\S+/, '').replace(/\D/g, '');
}

function toJid(numero) {
  const str = String(numero ?? '').trim();
  if (str.includes('@')) return str;
  const limpo = str.replace(/\D/g, '');
  if (limpo.length < 8) {
    console.warn(`[Market] toJid: número inválido ou curto demais: "${str}"`);
    return null;
  }
  return `${limpo}@s.whatsapp.net`;
}

async function reply(sock, jid, msg, texto) {
  try {
    return await sock.sendMessage(jid, { text: String(texto) }, { quoted: msg });
  } catch (e) {
    console.error(`[Market] reply falhou (jid=${jid}):`, e.message);
  }
}

// ─── INVENTÁRIO ───────────────────────────────────────────────────────────────

// Ordem de prioridade de remoção de itens
const CAMPOS_INVENTARIO = ['inventory', 'itensRoubo', 'itensSec', 'itensPesca'];

function somarCampos(user, itemKey) {
  return CAMPOS_INVENTARIO.reduce((total, campo) => {
    const val = user[campo]?.[itemKey];
    return total + (typeof val === 'number' && val > 0 ? val : 0);
  }, 0);
}

async function getQuantidadeInventario(userId, itemKey, session = null) {
  try {
    const projection = CAMPOS_INVENTARIO.reduce((proj, campo) => {
      proj[`${campo}.${itemKey}`] = 1;
      return proj;
    }, {});
    const user = await Usuario.findOne(
      { idWhatsApp: userId },
      projection,
      session ? { session } : {}
    ).lean();
    if (!user) return 0;
    return somarCampos(user, itemKey);
  } catch (e) {
    console.error('[Market] getQuantidadeInventario:', e.message);
    return 0;
  }
}

//removerInventario
// ─── CONSTANTES LOCAIS ────────────────────────────────────────────────────────

// Regex compilada uma vez — reutilizada em toda chamada
const ITEM_KEY_RE = /^[a-z0-9_-]+$/;

// ─── REMOVER INVENTÁRIO ───────────────────────────────────────────────────────

async function removerInventario(userId, itemKey, quantidade, session = null) {

  // ── 1. Validações de programação (síncronas, sem I/O) ─────────────────────
  // Lançam sempre, independente de session: dados inválidos indicam bug no caller

  if (!userId || typeof userId !== 'string') {
    throw new TypeError(`[Market] removerInventario: userId inválido (${userId})`);
  }
  if (!itemKey || !ITEM_KEY_RE.test(itemKey)) {
    throw new TypeError(`[Market] removerInventario: itemKey inválido ("${itemKey}")`);
  }
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new TypeError(`[Market] removerInventario: quantidade inválida (${quantidade})`);
  }

  // ── 2. Leitura do inventário atual ────────────────────────────────────────

  const projection = CAMPOS_INVENTARIO.reduce((proj, c) => {
    proj[c] = 1;
    return proj;
  }, {});

  const user = await Usuario.findOne(
    { idWhatsApp: userId },
    projection,
    session ? { session } : {}
  ).lean();

  if (!user) {
    const msg = `[Market] removerInventario: usuário não encontrado — userId=${userId}`;
    console.warn(msg);
    // ✅ Dentro de transação lança para forçar o abort; fora retorna false
    // para manter compatibilidade com callers que tratam o booleano
    if (session) throw new Error(msg);
    return false;
  }

  // ── 3. Verificação de saldo ───────────────────────────────────────────────

  const totalDisponivel = somarCampos(user, itemKey);

  if (totalDisponivel < quantidade) {
    console.warn(
      `[Market] removerInventario: estoque insuficiente — ` +
      `userId=${userId} item=${itemKey} disponivel=${totalDisponivel} pedido=${quantidade}`
    );
    if (session) throw new Error(`INVENTARIO_INSUFICIENTE:${userId}:${itemKey}`);
    return false;
  }

  // ── 4. Cálculo do $inc distribuído pelos campos ───────────────────────────
  // Consome da primeira fonte com saldo antes de passar para a próxima,
  // seguindo a ordem de prioridade definida em CAMPOS_INVENTARIO

  let restante  = quantidade;
  const incrMap = {};

  for (const campo of CAMPOS_INVENTARIO) {
    if (restante <= 0) break;

    const disponivel = user[campo]?.[itemKey];
    if (typeof disponivel !== 'number' || disponivel <= 0) continue;

    const descontar                    = Math.min(disponivel, restante);
    incrMap[`${campo}.${itemKey}`]     = -descontar;
    restante                          -= descontar;
  }

  // ✅ Nunca deve ocorrer: somarCampos garantiu totalDisponivel >= quantidade.
  // Se chegou aqui com restante > 0, os dados do documento estão corrompidos.
  if (restante > 0) {
    throw new Error(
      `[Market] removerInventario: inconsistência — restante=${restante} após distribuição ` +
      `(userId=${userId} item=${itemKey} totalDisponivel=${totalDisponivel})`
    );
  }

  // ── 5. Aplicação atômica com condição de guarda ───────────────────────────
  // A condição $gte garante que nenhum campo fique negativo se outro processo
  // decrementar o inventário entre o findOne e o findOneAndUpdate (race condition).
  // Em caso de race, retorna null → o caller recebe false / lança conforme context.

  const guardas = Object.entries(incrMap).reduce((acc, [campoKey, decremento]) => {
    // campoKey = "inventory.dinamite" → verifica que o campo ainda tem saldo suficiente
    acc[campoKey] = { $gte: -decremento }; // -decremento = valor positivo esperado
    return acc;
  }, { idWhatsApp: userId });

  const result = await Usuario.findOneAndUpdate(
    guardas,
    { $inc: incrMap },
    {
      ...(session ? { session } : {}),
      // ✅ new: true permite validar os valores pós-decremento se necessário no futuro;
      // mantido como false apenas por compatibilidade com o restante do código atual
      new: false,
    }
  );

  if (!result) {
    // Documento não encontrou a condição de guarda — race condition detectada
    const msg =
      `[Market] removerInventario: guarda falhou (race condition detectada) — ` +
      `userId=${userId} item=${itemKey}`;
    console.warn(msg);
    if (session) throw new Error(msg);
    return false;
  }

  return true;
}

// adicionarInventario
async function adicionarInventario(userId, itemKey, quantidade, session = null) {
  // ✅ Validações fora do try — erros de programação não devem ser
  // silenciados pelo catch, e não dependem de I/O
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    const msg = `[Market] adicionarInventario: quantidade inválida (${quantidade})`;
    console.error(msg);
    if (session) throw new Error(msg);
    return false;
  }
  if (!/^[a-z0-9_-]+$/.test(itemKey)) {
    const msg = `[Market] adicionarInventario: itemKey inválido (${itemKey})`;
    console.error(msg);
    if (session) throw new Error(msg);
    return false;
  }

  try {
    const result = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`inventory.${itemKey}`]: quantidade } },
      { new: true, ...(session ? { session } : {}) }
    );

    if (!result) {
      const msg = `[Market] adicionarInventario: usuário ${userId} não encontrado`;
      console.error(msg);
      if (session) throw new Error(msg);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Market] adicionarInventario:', e.message);
    if (session) throw e;
    return false;
  }
}

// ─── TRANSAÇÃO ────────────────────────────────────────────────────────────────

const RETRY_CODES = new Set([
  'TransientTransactionError',
  'UnknownTransactionCommitResult',
]);

const MAX_TRANSACTION_RETRIES = 3;

// Espera exponencial entre retries para reduzir contenção no servidor
function _retryDelay(tentativa) {
  const base  = 50;                             // ms
  const cap   = 1_000;                          // ms — teto para não atrasar demais
  const jitter = Math.random() * base;          // evita thundering herd
  return Math.min(base * 2 ** tentativa + jitter, cap);
}

async function withTransaction(callback) {
  let tentativa = 0;

  while (true) {
    // ✅ Session criada dentro do loop: cada retry usa uma session limpa,
    // evitando reutilizar uma session em estado indeterminado após abort
    const session = await mongoose.startSession();

    try {
      session.startTransaction({
        readConcern:    { level: 'snapshot' },
        writeConcern:   { w: 'majority' },
        readPreference: 'primary',
        maxTimeMS:      CONFIG.TRANSACTION_TIMEOUT_MS,
      });

      const result = await callback(session);

      // ✅ commitTransaction pode lançar com label 'UnknownTransactionCommitResult',
      // o que significa que o commit pode ou não ter sido aplicado.
      // O retry re-executa o callback completo com uma nova session — o código
      // do callback deve ser idempotente para este caso ser seguro.
      await session.commitTransaction();

      return result;

    } catch (e) {
      // ✅ Só aborta se a transação ainda estiver ativa; commitTransaction pode
      // ter lançado após o commit parcial, deixando a transação já encerrada
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          // Abort falhou (ex: sessão já expirou). Apenas loga — o servidor
          // vai limpar a transação por timeout de qualquer forma
          console.warn('[Market] withTransaction: abortTransaction falhou:', abortErr.message);
        }
      }

      // ✅ Erros de negócio (e.userMsg) nunca são retentados — falha imediata
      const isTransient = !e.userMsg && e.errorLabels?.some(l => RETRY_CODES.has(l));

      if (isTransient && tentativa < MAX_TRANSACTION_RETRIES) {
        tentativa++;
        const delay = _retryDelay(tentativa);
        console.warn(
          `[Market] withTransaction: retry ${tentativa}/${MAX_TRANSACTION_RETRIES}` +
          ` — aguardando ${Math.round(delay)}ms — ${e.message}`
        );
        await new Promise(res => setTimeout(res, delay));
        continue;
      }

      // ✅ Esgotou retries ou erro não-transiente: relança preservando stack original
      throw e;

    } finally {
      // ✅ endSession sempre chamado, independente de commit/abort/throw
      // Chamar em session já encerrada é no-op seguro no driver oficial
      session.endSession();
    }
  }
}

// ─── COOLDOWN ─────────────────────────────────────────────────────────────────

const BUY_COOLDOWNS = new Map();

// ✅ Intervalo de cleanup alinhado com o próprio cooldown,
// evitando acúmulo de entradas obsoletas por até 10 minutos
const _cooldownCleanup = setInterval(() => {
  const agora  = Date.now();
  const limite = CONFIG.COOLDOWN_BUY_MS;
  for (const [id, ts] of BUY_COOLDOWNS) {
    if (agora - ts > limite) BUY_COOLDOWNS.delete(id);
  }
}, CONFIG.COOLDOWN_BUY_MS);

if (_cooldownCleanup.unref) _cooldownCleanup.unref();

function checkCooldown(compradorId) {
  const agora    = Date.now();
  const ultimo   = BUY_COOLDOWNS.get(compradorId) ?? 0;
  const restante = CONFIG.COOLDOWN_BUY_MS - (agora - ultimo);
  return restante > 0 ? Math.ceil(restante / 1000) : 0;
}

// ─── FILTRO DE OFERTAS ATIVAS (reutilizado em handleAvenda e handleBuscarOferta) ──

function filtroOfertasAtivas(extra = {}) {
  const agora = new Date();
  return {
    quantidade: { $gt: 0 },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: agora } },
    ],
    ...extra,
  };
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────

function parseBuyArgs(caption) {
  const match = caption.match(/buy\s+([\d@.\w]+)\s+([A-Za-z0-9_-]+)\s+(\d{1,6})/i);
  if (!match) return null;
  const quantidade = parseInt(match[3], 10);
  if (!Number.isFinite(quantidade) || quantidade < 1) return null;
  return { vendedorRaw: match[1], itemKey: match[2].toLowerCase(), quantidade };
}

function buildMensagemComprador({ oferta, quantidade, totalBruto, taxa, novoSaldoComprador }) {
  const vendedorExibicao = oferta.sellerName
    ? `${oferta.sellerName} (${formatarNumero(oferta.sellerId)})`
    : formatarNumero(oferta.sellerId);

  return (
    `✅ *COMPRA REALIZADA!*\n\n` +
    `📦 *Item:* ${oferta.itemNome}\n` +
    `📊 *Quantidade:* ${quantidade}\n` +
    `💵 *Preço unit.:* ${oferta.preco}g\n` +
    `💳 *Total pago:* ${totalBruto}g _(${oferta.preco} × ${quantidade})_\n` +
    `🏦 *Taxa do mercado:* ${taxa}g _(paga pelo vendedor)_\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `👤 *Vendedor:* ${vendedorExibicao}\n` +
    `💰 *Seu saldo:* ${novoSaldoComprador}g`
  );
}

function buildMensagemVendedor({ oferta, quantidade, totalBruto, totalLiquido, taxa, compradorId, compradorNome }) {
  const compradorExibicao = compradorNome
    ? `${compradorNome} (@${formatarNumero(compradorId)})`
    : `@${formatarNumero(compradorId)}`;

  return {
    text:
      `🛒 *VENDA REALIZADA!*\n\n` +
      `📦 *Item:* ${oferta.itemNome} × ${quantidade}\n` +
      `💵 *Preço unit.:* ${oferta.preco}g\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💸 *Valor bruto:* ${totalBruto}g\n` +
      `🏦 *Taxa (${CONFIG.TAXA_MERCADO_PCT}%):* -${taxa}g\n` +
      `💰 *Você recebeu:* +${totalLiquido}g\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 *Comprador:* ${compradorExibicao}`,
    mentions: [compradorId],
  };
}

// ─── LÓGICA DE COMPRA ─────────────────────────────────────────────────────────

async function executarCompra({ compradorId, vendedorId, itemKey, quantidade, compradorNome, vendedorNome }, session) {

  // 1. Leitura paralela — sem writes ainda
  // BUG 2 FIX: filtroOfertasAtivas garante que ofertas expiradas (ainda não
  // limpas pelo TTL) não sejam compráveis. Sem este filtro, o vendedor poderia
  // receber gold de uma oferta que ele considerava encerrada há dias.
  const [ofertaExistente, saldoDoc] = await Promise.all([
    Oferta.findOne(
      filtroOfertasAtivas({ sellerId: vendedorId, itemKey }),
      { preco: 1, quantidade: 1, itemNome: 1, sellerId: 1, sellerName: 1 },
      { session }
    ).lean(),
    Usuario.findOne({ idWhatsApp: compradorId }, { gold: 1 }, { session }).lean(),
  ]);

  // 2. Validações antes de qualquer write
  if (!ofertaExistente) {
    const err = new Error('OFERTA_NAO_ENCONTRADA');
    err.userMsg = `❌ Oferta não encontrada!\n\nVer ofertas disponíveis: *!avenda*`;
    throw err;
  }

  if (!saldoDoc) {
    const err = new Error('COMPRADOR_NAO_ENCONTRADO');
    err.userMsg = '⚠️ Seu usuário não foi encontrado. Tente novamente.';
    throw err;
  }

  if (ofertaExistente.quantidade < quantidade) {
    const err = new Error('QUANTIDADE_INSUFICIENTE');
    err.userMsg =
      `⚠️ *Quantidade indisponível!*\n\n` +
      `📦 Estoque atual: *${ofertaExistente.quantidade}*\n` +
      `📊 Você pediu: *${quantidade}*\n` +
      `🔍 Verifique: *!buscaroferta ${itemKey}*`;
    throw err;
  }

  const totalBruto   = ofertaExistente.preco * quantidade;
  const taxa         = Math.floor(totalBruto * CONFIG.TAXA_MERCADO_PCT / 100);
  const totalLiquido = totalBruto - taxa;
  const saldoAtual   = saldoDoc.gold ?? 0;

  if (saldoAtual < totalBruto) {
    const err = new Error('SALDO_INSUFICIENTE');
    err.userMsg =
      `❌ *SALDO INSUFICIENTE*\n\n` +
      `💰 Você tem: *${saldoAtual}g*\n` +
      `💸 Precisa: *${totalBruto}g*\n` +
      `📊 Faltam: *${totalBruto - saldoAtual}g*`;
    throw err;
  }

  // 3. Decrementa/remove oferta atomicamente
  // BUG 2 FIX (continuação): filtroOfertasAtivas também nas etapas de write,
  // cobrindo o intervalo entre a leitura acima e este update. Sem isso, uma
  // oferta poderia expirar entre as duas operações e ainda ser consumida.
  let oferta;

  if (ofertaExistente.quantidade === quantidade) {
    // BUG 1 FIX: quantidade exata em vez de $gte.
    // Com $gte, se outro processo comprou parte das unidades entre o findOne
    // da etapa 1 e este delete, a oferta ainda passaria no filtro e seria
    // deletada — creditando ao comprador unidades que já não existiam na oferta.
    // A condição exata garante que só deletamos se o estoque ainda for o mesmo
    // que lemos; caso contrário, retorna null → CONFLITO_ESTOQUE abaixo.
    oferta = await Oferta.findOneAndDelete(
      filtroOfertasAtivas({ sellerId: vendedorId, itemKey, quantidade: quantidade }),
      { session }
    ).lean();
  } else {
    // O $gte aqui é correto: para compra parcial, qualquer quantidade >= pedida
    // é válida. A diferença é que o resultado pode ter mais unidades do que
    // ofertaExistente indicava — o comprador recebe exatamente o que pediu.
    oferta = await Oferta.findOneAndUpdate(
      filtroOfertasAtivas({ sellerId: vendedorId, itemKey, quantidade: { $gte: quantidade } }),
      { $inc: { quantidade: -quantidade } },
      { session, new: false }
    ).lean();
  }

  if (!oferta) {
    const err = new Error('CONFLITO_ESTOQUE');
    err.userMsg =
      `⚠️ Outra compra acabou de esgotar o estoque.\n\n` +
      `🔍 Verifique disponibilidade: *!buscaroferta ${itemKey}*`;
    throw err;
  }

  // 4. Transferência financeira + entrega do item
  const [compradorAtualizado, vendedorAtualizado] = await Promise.all([
    Usuario.findOneAndUpdate(
      { idWhatsApp: compradorId, gold: { $gte: totalBruto } },
      { $inc: { gold: -totalBruto, [`inventory.${itemKey}`]: quantidade } },
      { session, new: true }
    ).lean(),
    Usuario.findOneAndUpdate(
      { idWhatsApp: vendedorId },
      { $inc: { gold: totalLiquido } },
      { session, new: true }
    ).lean(),
  ]);

  if (!compradorAtualizado) {
    const existe = await Usuario.exists({ idWhatsApp: compradorId }, { session });
    const err = new Error(existe ? 'SALDO_INSUFICIENTE_RACE' : 'COMPRADOR_NAO_ENCONTRADO');
    err.userMsg = existe
      ? `❌ Seu saldo foi alterado durante a compra. Tente novamente.`
      : `⚠️ Seu usuário não foi encontrado. Tente novamente.`;
    throw err;
  }

  if (!vendedorAtualizado) {
    const err = new Error('VENDEDOR_NAO_ENCONTRADO');
    err.userMsg = `⚠️ O vendedor não foi encontrado. Contate um administrador.`;
    throw err;
  }

  // 5. Registrar log (com nomes para exibição no histórico)
  await MarketLog.create([{
    compradorId,
    compradorNome: compradorNome ?? null,
    vendedorId,
    vendedorNome:  vendedorNome  ?? oferta.sellerName ?? null,
    itemKey,
    itemNome:      oferta.itemNome,
    quantidade,
    precoUnit:     oferta.preco,
    totalBruto,
    taxa,
    totalLiquido,
    createdAt:     new Date(),
  }], { session });

  return {
    oferta,
    totalBruto,
    taxa,
    totalLiquido,
    novoSaldoComprador: compradorAtualizado.gold,
    novoSaldoVendedor:  vendedorAtualizado.gold,
  };
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

async function handleAvenda(sock, msg, jid, caption = '') {
  try {
    const pageArg = parseInt(caption.match(/avenda\s+(\d+)/i)?.[1] ?? '1', 10);
    const page    = Number.isFinite(pageArg) && pageArg > 0 ? pageArg : 1;
    const skip    = (page - 1) * CONFIG.ITENS_POR_PAGINA;

    const filtro = filtroOfertasAtivas();

    const [total, ofertas] = await Promise.all([
      Oferta.countDocuments(filtro),
      Oferta.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(CONFIG.ITENS_POR_PAGINA).lean(),
    ]);

    if (total === 0) {
      return reply(sock, jid, msg,
        `📦 *MARKETPLACE VAZIO*\n\nNenhum item à venda no momento.\n\n` +
        `💡 Quer vender algo? *!ofertar <item> <preco> <qtd>*`
      );
    }

    const totalPags   = Math.ceil(total / CONFIG.ITENS_POR_PAGINA);
    const agora       = new Date();
    const porVendedor = {};
    for (const o of ofertas) {
      (porVendedor[o.sellerId] ??= []).push(o);
    }

    let texto  = `🛒 *MARKETPLACE* — Página ${page}/${totalPags}\n`;
    texto     += `📊 _${total} oferta(s) ativa(s)_\n`;
    texto     += `━━━━━━━━━━━━━━━━\n`;

    for (const [sellerId, lista] of Object.entries(porVendedor)) {
      const num         = formatarNumero(sellerId);
      const nomeExibido = lista[0].sellerName || num;
      texto += `\n👤 *${nomeExibido}* (${num})\n`;

      for (const o of lista) {
        const totalVal = o.preco * o.quantidade;
        let expiraTexto = '';
        if (o.expiresAt) {
          const horas = Math.floor((o.expiresAt - agora) / 3_600_000);
          expiraTexto = horas < 24
            ? `     ⚠️ Expira em *${horas}h*!\n`
            : `     ⏳ Expira ${o.expiresAt.toLocaleDateString('pt-BR')}\n`;
        }
        texto += `  📦 *${o.itemNome}*\n`;
        texto += `     💵 ${o.preco}g × ${o.quantidade} un. _(total: ${totalVal}g)_\n`;
        texto += expiraTexto;
        texto += `     🛒 \`!buy ${num} ${o.itemKey} <qtd>\`\n`;
      }
    }

    texto += `\n━━━━━━━━━━━━━━━━\n`;
    if (page > 1)         texto += `📄 Anterior: *!avenda ${page - 1}*\n`;
    if (page < totalPags) texto += `📄 Próxima: *!avenda ${page + 1}*\n`;
    texto += `🔍 Buscar: *!buscaroferta <item>*\n`;
    texto += `❌ Cancelar oferta: *!cancelaroferta <item>*`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleAvenda:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o marketplace!');
  }
}

async function handleBuscarOferta(sock, msg, jid, caption) {
  const match = caption.match(/buscaroferta\s+([A-Za-z0-9_-]+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ Use: *!buscaroferta <item>*\nExemplo: *!buscaroferta dinamite*'
    );
  }

  const itemKey = match[1].toLowerCase();

  try {
    const ofertas = await Oferta.find(filtroOfertasAtivas({ itemKey }))
      .sort({ preco: 1 })
      .lean();

    if (ofertas.length === 0) {
      return reply(sock, jid, msg,
        `🔍 Nenhuma oferta encontrada para *${getNomeItem(itemKey)}*.\n\n` +
        `Seja o primeiro a vender: *!ofertar ${itemKey} <preco> <qtd>*`
      );
    }

    const itemNome        = getNomeItem(itemKey);
    const totalDisponivel = ofertas.reduce((s, o) => s + o.quantidade, 0);

    let texto  = `🔍 *OFERTAS: ${itemNome}*\n`;
    texto     += `📊 _${ofertas.length} vendedor(es) · ${totalDisponivel} un. disponíveis_\n`;
    texto     += `━━━━━━━━━━━━━━━━\n\n`;

    for (const o of ofertas) {
      const num         = formatarNumero(o.sellerId);
      const nomeExibido = o.sellerName || num;
      texto += `👤 *${nomeExibido}*\n`;
      texto += `   💵 ${o.preco}g × ${o.quantidade} un.\n`;
      texto += `   🛒 \`!buy ${num} ${itemKey} <qtd>\`\n\n`;
    }

    const maisBarato = ofertas[0];
    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `🏆 Mais barato: *${maisBarato.preco}g* de ${maisBarato.sellerName || formatarNumero(maisBarato.sellerId)}`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleBuscarOferta:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao buscar oferta!');
  }
}

// ─── HANDLER: OFERTAR ─────────────────────────────────────────────────────────

async function handleOfertar(sock, msg, jid, caption) {

  // ── 1. Identificação do usuário ───────────────────────────────────────────

  const userId = getUserId(msg);
  if (!userId) {
    return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  }

  // ── 2. Parse e validação dos argumentos ──────────────────────────────────

  const match = caption.match(/ofertar\s+([A-Za-z0-9_-]+)\s+(\d+)\s+(\d+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ *Uso correto:* `!ofertar <item> <preco> <quantidade>`\n' +
      '📌 *Exemplo:* `!ofertar dinamite 200 3`'
    );
  }

  const itemKey    = match[1].toLowerCase();
  const preco      = parseInt(match[2], 10);
  const quantidade = parseInt(match[3], 10);

  // ── 3. Validações de negócio (síncronas) ─────────────────────────────────

  if (!CATALOGO_COMPLETO[itemKey]) {
    const exemplos = Object.keys(CATALOGO_COMPLETO).slice(0, 5).join(', ');
    return reply(sock, jid, msg,
      `❌ Item *${itemKey}* não encontrado no catálogo.\n\n` +
      `📋 *Exemplos válidos:* ${exemplos}…\n` +
      `🔍 Ver catálogo completo: *!loja*`
    );
  }

  if (!Number.isFinite(preco) || preco < CONFIG.PRECO_MINIMO || preco > CONFIG.PRECO_MAXIMO) {
    return reply(sock, jid, msg,
      `❌ *Preço inválido!*\n` +
      `💵 Deve ser entre *${CONFIG.PRECO_MINIMO}g* e *${CONFIG.PRECO_MAXIMO.toLocaleString('pt-BR')}g*`
    );
  }

  if (!Number.isFinite(quantidade) || quantidade < CONFIG.QTD_MINIMA || quantidade > CONFIG.QTD_MAXIMA) {
    return reply(sock, jid, msg,
      `❌ *Quantidade inválida!*\n` +
      `📊 Deve ser entre *${CONFIG.QTD_MINIMA}* e *${CONFIG.QTD_MAXIMA}*`
    );
  }

  // ── 4. Busca de metadados antes da transação ──────────────────────────────
  // Nome do usuário e contagem de ofertas não precisam de consistência
  // transacional — buscados em paralelo fora da transação para não aumentar
  // seu escopo desnecessariamente.
  //
  // BUG 4 FIX: filtroOfertasAtivas nos dois countDocuments — aqui e dentro
  // da transação. Sem o filtro, ofertas expiradas ainda não limpas pelo TTL
  // inflam a contagem e bloqueiam o usuário mesmo ele tendo vagas reais.

  const filtroContagem = filtroOfertasAtivas({ sellerId: userId });

  const [usuarioDoc, qtdOfertasAtual] = await Promise.all([
    Usuario.findOne({ idWhatsApp: userId }, { nome: 1 }).lean(),
    Oferta.countDocuments(filtroContagem),
  ]);

  const sellerName = usuarioDoc?.nome?.trim() || formatarNumero(userId);
  const itemNome   = getNomeItem(itemKey);

  // Verificação prévia fora da transação para feedback imediato ao usuário.
  // A verificação definitiva ainda ocorre dentro da transação (cobre race
  // conditions), mas esta evita abrir uma session no caso mais comum.
  const ofertaExistentePrevia = await Oferta.exists({ sellerId: userId, itemKey });

  if (!ofertaExistentePrevia && qtdOfertasAtual >= CONFIG.MAX_OFERTAS_USER) {
    return reply(sock, jid, msg,
      `❌ Você atingiu o limite de *${CONFIG.MAX_OFERTAS_USER} ofertas ativas*!\n\n` +
      `📋 Ver suas ofertas: *!minhasofertas*\n` +
      `❌ Cancelar uma: *!cancelaroferta <item>*`
    );
  }

  // ── 5. Transação ──────────────────────────────────────────────────────────

  let ofertaCriada;

  try {
    await withTransaction(async (session) => {

      // Re-verifica o limite DENTRO da transação para cobrir race conditions
      // entre a verificação prévia acima e o upsert abaixo.
      // BUG 4 FIX (continuação): mesmo filtroOfertasAtivas aplicado aqui,
      // garantindo consistência entre a contagem prévia e a transacional.
      const [qtdTransacional, ofertaJaExiste] = await Promise.all([
        Oferta.countDocuments(filtroOfertasAtivas({ sellerId: userId }), { session }),
        Oferta.exists({ sellerId: userId, itemKey }, { session }),
      ]);

      if (!ofertaJaExiste && qtdTransacional >= CONFIG.MAX_OFERTAS_USER) {
        const err   = new Error('LIMITE_OFERTAS');
        err.userMsg =
          `❌ Você atingiu o limite de *${CONFIG.MAX_OFERTAS_USER} ofertas ativas*!\n\n` +
          `📋 Ver suas ofertas: *!minhasofertas*\n` +
          `❌ Cancelar uma: *!cancelaroferta <item>*`;
        throw err;
      }

      // removerInventario lança com mensagem estruturada quando session está
      // presente — a transação aborta automaticamente via withTransaction
      await removerInventario(userId, itemKey, quantidade, session);

      // Upsert atômico: cria a oferta se não existir, ou acumula quantidade
      // e atualiza preço/nome se já existir — mantém o índice único
      // (sellerId + itemKey) sem risco de inserção duplicada.
      ofertaCriada = await Oferta.findOneAndUpdate(
        { sellerId: userId, itemKey },
        {
          $set: { sellerName, itemNome, preco },
          $inc: { quantidade },
          // $setOnInsert não define createdAt: timestamps:true já cuida disso
        },
        { upsert: true, new: true, session }
      );
    });

  } catch (e) {
    if (e.userMsg) return reply(sock, jid, msg, e.userMsg);

    console.error('[Market] handleOfertar: erro inesperado', {
      userId, itemKey, preco, quantidade, erro: e.message, stack: e.stack,
    });
    return reply(sock, jid, msg,
      '⚠️ Erro interno ao criar oferta. Seus itens *não foram afetados*.\n' +
      'Aguarde alguns instantes e tente novamente.'
    );
  }

  // ── 6. Resposta de sucesso ────────────────────────────────────────────────
  // Contagem relida após commit para refletir o estado real do banco.
  // BUG 4 FIX (continuação): mesmo filtro aplicado para consistência com
  // o número exibido ao usuário — evita mostrar "3/10" quando são 2 ativas.

  const restantes = await Oferta.countDocuments(filtroOfertasAtivas({ sellerId: userId }));

  const expiraTexto = ofertaCriada.expiresAt
    ? `\n⏳ *Expira em:* ${ofertaCriada.expiresAt.toLocaleDateString('pt-BR')}`
    : '';

  const totalOferta     = preco * ofertaCriada.quantidade;
  const taxaEstimada    = Math.floor(totalOferta * CONFIG.TAXA_MERCADO_PCT / 100);
  const liquidoEstimado = totalOferta - taxaEstimada;

  return reply(sock, jid, msg,
    `✅ *OFERTA CRIADA COM SUCESSO!*\n\n` +
    `📦 *Item:* ${itemNome}\n` +
    `💵 *Preço unitário:* ${preco.toLocaleString('pt-BR')}g\n` +
    `📊 *Quantidade ofertada:* ${quantidade}\n` +
    `💰 *Estoque total na oferta:* ${ofertaCriada.quantidade}\n` +
    expiraTexto + `\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `💸 *Se vender tudo:* ~${liquidoEstimado.toLocaleString('pt-BR')}g líquido\n` +
    `   _(bruto ${totalOferta.toLocaleString('pt-BR')}g − taxa ${taxaEstimada.toLocaleString('pt-BR')}g)_\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📋 *Suas ofertas ativas:* ${restantes}/${CONFIG.MAX_OFERTAS_USER}\n` +
    `🛒 Ver marketplace: *!avenda*\n` +
    `❌ Cancelar oferta: *!cancelaroferta ${itemKey}*`
  );
}

// ─── HANDLER: BUY ─────────────────────────────────────────────────────────────

async function handleBuy(sock, msg, jid, caption) {

  // ── 1. Identificação do comprador ─────────────────────────────────────────

  const compradorId = getUserId(msg);
  if (!compradorId) {
    return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  }

  // ── 2. Cooldown ───────────────────────────────────────────────────────────
  // ✅ Verificado antes do parse para rejeitar spam imediatamente,
  // sem custo de regex ou I/O

  const espera = checkCooldown(compradorId);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${espera}s* antes de comprar novamente.`);
  }

  // ── 3. Parse dos argumentos ───────────────────────────────────────────────

  const args = parseBuyArgs(caption);
  if (!args) {
    return reply(sock, jid, msg,
      '⚠️ *Uso correto:* `!buy <vendedor> <item> <quantidade>`\n' +
      '📌 *Exemplo:* `!buy 5511999999999 dinamite 2`\n\n' +
      '🛒 Ver vendedores disponíveis: *!avenda*'
    );
  }

  const { vendedorRaw, itemKey, quantidade } = args;

  // ── 4. Validações síncronas de negócio ────────────────────────────────────

  const vendedorId = toJid(vendedorRaw);
  if (!vendedorId) {
    return reply(sock, jid, msg,
      `❌ Número de vendedor inválido: *${vendedorRaw}*\n\n` +
      `📱 Use o número com DDD: *5511999999999*\n` +
      `🛒 Ver vendedores: *!avenda*`
    );
  }

  if (compradorId === vendedorId) {
    return reply(sock, jid, msg, '❌ Você não pode comprar sua própria oferta!');
  }

  // ✅ parseBuyArgs já valida quantidade >= 1; a checagem de MAX_QTD_COMPRA
  // é feita aqui pois é regra de negócio do handler, não do parser
  if (quantidade > CONFIG.MAX_QTD_COMPRA) {
    return reply(sock, jid, msg,
      `❌ Quantidade máxima por compra: *${CONFIG.MAX_QTD_COMPRA}*\n` +
      `📊 Você pediu: *${quantidade}*`
    );
  }

  // ── 5. Registro do cooldown ───────────────────────────────────────────────
  // ✅ Setado somente após TODAS as validações síncronas passarem,
  // evitando penalizar o usuário por erros de digitação

  BUY_COOLDOWNS.set(compradorId, Date.now());

  // ── 6. Busca de nomes (fora da transação) ────────────────────────────────
  // ✅ Paralelo e sem session: nomes são metadados de exibição,
  // não precisam de consistência transacional

  let compradorNome = null;
  let vendedorNome  = null;

  try {
    const [compradorDoc, vendedorDoc] = await Promise.all([
      Usuario.findOne({ idWhatsApp: compradorId }, { nome: 1 }).lean(),
      Usuario.findOne({ idWhatsApp: vendedorId  }, { nome: 1 }).lean(),
    ]);
    compradorNome = compradorDoc?.nome?.trim() ?? null;
    vendedorNome  = vendedorDoc?.nome?.trim()  ?? null;
  } catch (e) {
    // ✅ Falha ao buscar nomes não cancela a compra — apenas exibe número no lugar
    console.warn('[Market] handleBuy: falha ao buscar nomes (não crítico):', e.message);
  }

  // ── 7. Execução da transação ──────────────────────────────────────────────

  let resultado;

  try {
    resultado = await withTransaction((session) =>
      executarCompra(
        { compradorId, vendedorId, itemKey, quantidade, compradorNome, vendedorNome },
        session
      )
    );
  } catch (e) {
    // ✅ Cooldown removido em qualquer falha transacional:
    // erros de negócio (saldo, estoque) não devem penalizar o usuário
    BUY_COOLDOWNS.delete(compradorId);

    if (e.userMsg) {
      return reply(sock, jid, msg, e.userMsg);
    }

    console.error('[Market] handleBuy: erro inesperado na transação', {
      compradorId,
      vendedorId,
      itemKey,
      quantidade,
      erro:  e.message,
      stack: e.stack,
    });

    return reply(sock, jid, msg,
      '⚠️ Erro interno ao processar a compra.\n' +
      'Seus dados *não foram alterados*. Tente novamente em alguns instantes.'
    );
  }

  // BUG 3 FIX: cooldown removido explicitamente após compra bem-sucedida.
  // Sem isso, o usuário fica bloqueado até o setInterval de cleanup rodar,
  // mesmo tendo concluído a compra com sucesso. O comentário da etapa 5
  // ("evitar penalizar o usuário") se aplica igualmente ao caminho feliz.
  BUY_COOLDOWNS.delete(compradorId);

  // ── 8. Notificações pós-transação ─────────────────────────────────────────
  // ✅ Comprador notificado com await para garantir entrega antes de retornar;
  // vendedor notificado em fire-and-forget — falha não deve afetar o comprador

  await reply(
    sock, jid, msg,
    buildMensagemComprador({ ...resultado, quantidade })
  );

  sock
    .sendMessage(
      vendedorId,
      buildMensagemVendedor({ ...resultado, quantidade, compradorId, compradorNome })
    )
    .catch((err) =>
      console.warn('[Market] handleBuy: notificação ao vendedor falhou:', {
        vendedorId,
        erro: err.message,
      })
    );
}

// handleCancelarOferta
async function handleCancelarOferta(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  const match = caption.match(/cancelaroferta\s+([A-Za-z0-9_-]+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ Use: *!cancelaroferta <item>*\nExemplo: *!cancelaroferta dinamite*'
    );
  }

  const itemKey = match[1].toLowerCase();

  try {
    const ofertaCancelada = await withTransaction(async (session) => {
      // ✅ Oferta.exists removido — findOneAndDelete já retorna null se não existir,
      // eliminando o TOCTOU entre o exists externo e o delete interno.
      // Não filtramos por expiresAt intencionalmente: o usuário deve poder
      // cancelar (e recuperar os itens de) uma oferta expirada ainda não
      // removida pelo TTL.
      const oferta = await Oferta.findOneAndDelete(
        { sellerId: userId, itemKey },
        { session }
      ).lean();

      if (!oferta) {
        const err   = new Error('OFERTA_NAO_ENCONTRADA');
        err.userMsg =
          `❌ Você não tem oferta ativa de *${getNomeItem(itemKey)}*.\n\n` +
          `Ver suas ofertas: *!minhasofertas*`;
        throw err;
      }

      // ✅ adicionarInventario lança exceção em caso de falha quando session
      // está presente — a transação aborta automaticamente via withTransaction
      await adicionarInventario(userId, itemKey, oferta.quantidade, session);
      return oferta;
    });

    // ✅ filtroOfertasAtivas garante consistência com handleOfertar e handleMinhasOfertas:
    // ofertas expiradas ainda não limpas pelo TTL não inflam a contagem exibida.
    const restantes = await Oferta.countDocuments(filtroOfertasAtivas({ sellerId: userId }));

    return reply(sock, jid, msg,
      `✅ *OFERTA CANCELADA!*\n\n` +
      `📦 *${ofertaCancelada.itemNome}* × ${ofertaCancelada.quantidade} devolvido(s) ao inventário.\n` +
      `📊 Ofertas ativas restantes: *${restantes}/${CONFIG.MAX_OFERTAS_USER}*`
    );
  } catch (e) {
    if (e.userMsg) return reply(sock, jid, msg, e.userMsg);
    console.error('[Market] handleCancelarOferta:', { userId, itemKey, erro: e.message });
    return reply(sock, jid, msg, '⚠️ Erro ao cancelar oferta! Seus itens não foram afetados.');
  }
}

// handleMinhasOfertas
async function handleMinhasOfertas(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  try {
    // ✅ filtroOfertasAtivas em vez de filtro inline — evita dessincronização
    // caso a função central seja alterada no futuro
    const ofertas = await Oferta
      .find(filtroOfertasAtivas({ sellerId: userId }))
      .sort({ createdAt: -1 })
      .lean();

    if (ofertas.length === 0) {
      return reply(sock, jid, msg,
        `📦 *VOCÊ NÃO TEM OFERTAS ATIVAS*\n\n` +
        `Crie uma com: *!ofertar <item> <preco> <qtd>*\n` +
        `Ver marketplace: *!avenda*`
      );
    }

    const agora        = new Date();
    let texto          = `📊 *SUAS OFERTAS ATIVAS* (${ofertas.length}/${CONFIG.MAX_OFERTAS_USER})\n\n`;
    let totalPotencial = 0;

    for (const o of ofertas) {
      const totalItem = o.preco * o.quantidade;
      const taxa      = Math.floor(totalItem * CONFIG.TAXA_MERCADO_PCT / 100);
      const liquido   = totalItem - taxa;
      totalPotencial += liquido;

      let expiraTexto = '';
      if (o.expiresAt) {
        const horas = Math.floor((o.expiresAt - agora) / 3_600_000);
        // ✅ horas <= 0 cobre deriva de clock e race entre find e loop
        expiraTexto = horas <= 0
          ? `\n   ⚠️ Expirando agora!`
          : horas < 24
            ? `\n   ⚠️ Expira em *${horas}h*!`
            : `\n   ⏳ Expira: ${o.expiresAt.toLocaleDateString('pt-BR')}`;
      }

      texto += `📦 *${o.itemNome}*\n`;
      texto += `   💵 ${o.preco}g × ${o.quantidade} un.\n`;
      texto += `   💰 Você recebe: *${liquido}g* _(bruto ${totalItem}g − taxa ${taxa}g)_`;
      texto += expiraTexto + '\n';
      texto += `   ❌ \`!cancelaroferta ${o.itemKey}\`\n\n`;
    }

    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `💰 *Potencial líquido total:* ${totalPotencial}g`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleMinhasOfertas:', { userId, erro: e.message });
    return reply(sock, jid, msg, '⚠️ Erro ao carregar suas ofertas!');
  }
}

// handleHistoricoMarket
async function handleHistoricoMarket(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  const pageStr = caption.match(/historicomarket\s+(\d+)/i)?.[1] ?? '1';
  const page    = parseInt(pageStr, 10);

  if (!Number.isFinite(page) || page < 1) {
    return reply(sock, jid, msg,
      '⚠️ Página inválida.\nUse: *!historicomarket <número>*\nExemplo: *!historicomarket 2*'
    );
  }

  const LIMITE = 10;
  const skip   = (page - 1) * LIMITE;

  // Campos necessários para exibição — evita trazer o documento inteiro
  const PROJECTION = {
    compradorId:   1,
    compradorNome: 1,
    vendedorId:    1,
    vendedorNome:  1,
    itemNome:      1,
    quantidade:    1,
    precoUnit:     1,
    totalBruto:    1,
    taxa:          1,
    totalLiquido:  1,
    createdAt:     1,
  };

  try {
    // Conta cada lado separadamente para usar os índices compostos
    // (compradorId + createdAt) e (vendedorId + createdAt) sem collection scan
    const [totalComprador, totalVendedor] = await Promise.all([
      MarketLog.countDocuments({ compradorId: userId }),
      MarketLog.countDocuments({ vendedorId:  userId }),
    ]);

    // Upper bound antes da deduplicação. Auto-compras (compradorId === vendedorId,
    // caso raro) fazem totalEstimado contar o mesmo doc duas vezes — aceitável:
    // gera no máximo uma página extra vazia, nunca perde registros.
    const totalEstimado = totalComprador + totalVendedor;

    if (totalEstimado === 0) {
      return reply(sock, jid, msg,
        `📋 Você ainda não tem transações no marketplace.\n\nVer ofertas: *!avenda*`
      );
    }

    // BUG 5 FIX: totalReal era calculado sobre `todos`, que é uma slice
    // limitada por buscarAte — não o universo completo. Para páginas avançadas
    // o valor ficava menor que o real, gerando totalPags incorreto e escondendo
    // páginas existentes. totalEstimado é o upper bound correto: errar para
    // cima (mostrar uma página a mais) é inofensivo; errar para baixo
    // (esconder páginas) perde dados do usuário.
    const totalPags = Math.ceil(totalEstimado / LIMITE);

    if (page > totalPags) {
      return reply(sock, jid, msg,
        `⚠️ Página *${page}* não existe. O histórico tem *${totalPags}* página(s).\n\n` +
        `Última página: *!historicomarket ${totalPags}*`
      );
    }

    // Busca apenas os documentos necessários para a página atual + margem para
    // absorver duplicatas do merge antes de atingir LIMITE registros úteis
    const buscarAte = skip + LIMITE * 2;

    const [resultadosComprador, resultadosVendedor] = await Promise.all([
      MarketLog.find({ compradorId: userId }, PROJECTION)
        .sort({ createdAt: -1 })
        .limit(buscarAte)
        .lean(),
      MarketLog.find({ vendedorId: userId }, PROJECTION)
        .sort({ createdAt: -1 })
        .limit(buscarAte)
        .lean(),
    ]);

    // Merge + deduplicação + ordenação cronológica inversa
    const vistos = new Set();
    const todos  = [...resultadosComprador, ...resultadosVendedor]
      .filter(doc => {
        const id = doc._id.toString();
        if (vistos.has(id)) return false;
        vistos.add(id);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const logs = todos.slice(skip, skip + LIMITE);

    // Fallback para o caso extremo onde buscarAte não trouxe docs suficientes
    // para cobrir skip + LIMITE após deduplicação (histórico muito denso em
    // auto-compras). Avisa em vez de mostrar página vazia sem explicação.
    if (logs.length === 0) {
      return reply(sock, jid, msg,
        `⚠️ Página *${page}* não tem registros suficientes.\n\n` +
        `Tente: *!historicomarket ${Math.max(1, page - 1)}*`
      );
    }

    let texto = `📋 *HISTÓRICO* — Página ${page}/${totalPags} _(${totalEstimado} transação/ões)_\n\n`;

    for (const log of logs) {
      const ehComprador     = log.compradorId === userId;
      const dt              = new Date(log.createdAt);
      const data            = dt.toLocaleDateString('pt-BR');
      const hora            = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const contraparteId   = ehComprador ? log.vendedorId   : log.compradorId;
      const contraparteNome = ehComprador ? log.vendedorNome : log.compradorNome;
      const contraparteExib = contraparteNome
        ? `${contraparteNome} (${formatarNumero(contraparteId)})`
        : formatarNumero(contraparteId);

      texto += ehComprador
        ? `🛒 *COMPRA* — ${data} ${hora}\n`
        : `📥 *VENDA* — ${data} ${hora}\n`;

      texto += `   📦 ${log.itemNome} × ${log.quantidade} _(${log.precoUnit}g/un.)_\n`;

      if (ehComprador) {
        texto +=
          `   💸 Pago: *${log.totalBruto}g* ` +
          `_(taxa ${log.taxa}g paga pelo vendedor)_ | ${contraparteExib}\n\n`;
      } else {
        texto +=
          `   💰 Bruto: ${log.totalBruto}g − taxa ${log.taxa}g = ` +
          `*+${log.totalLiquido}g* | ${contraparteExib}\n\n`;
      }
    }

    texto += `━━━━━━━━━━━━━━━━\n`;
    if (page > 1)         texto += `📄 Anterior: *!historicomarket ${page - 1}*\n`;
    if (page < totalPags) texto += `📄 Próxima:  *!historicomarket ${page + 1}*\n`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleHistoricoMarket:', { userId, page, erro: e.message, stack: e.stack });
    return reply(sock, jid, msg, '⚠️ Erro ao carregar histórico!');
  }
}

// ─── ALIASES ──────────────────────────────────────────────────────────────────

async function handleOfertasRecebidas(sock, msg, jid) {
  return handleMinhasOfertas(sock, msg, jid);
}

async function handleAceitarOfferta(sock, msg, jid) {
  return reply(sock, jid, msg,
    '💼 Este comando foi substituído por *!buy*!\n\n' +
    'Exemplo: *!buy 5511999999999 dinamite 2*\n' +
    'Ver ofertas disponíveis: *!avenda*'
  );
}

// ─── EXPORTAÇÕES ──────────────────────────────────────────────────────────────

module.exports = {
  // Comandos principais
  handleAvenda,
  handleBuscarOferta,
  handleOfertar,
  handleBuy,
  handleCancelarOferta,
  handleMinhasOfertas,
  handleHistoricoMarket,

  // Compatibilidade retroativa
  handleOfertasRecebidas,
  handleAceitarOfferta,

  // Modelos Mongoose
  Oferta,
  MarketLog,

  // Configuração e catálogo
  CONFIG,
  registerCatalog,
};