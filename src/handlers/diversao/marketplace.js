/**
 * Handler de Marketplace — Bot
 * Sistema de compra/venda entre usuários
 *
 * v3.0 — Melhorias:
 *  - Transação atômica real com session do MongoDB (evita race condition)
 *  - Taxa de mercado configurável (ex: 5% vai para o "banco")
 *  - Limite de ofertas por usuário configurável
 *  - Preço mínimo e máximo configuráveis
 *  - Pagination no !avenda (evita mensagens gigantes)
 *  - !buscaroferta <item> para filtrar marketplace
 *  - Histórico de transações (coleção MarketLog)
 *  - Sanitização de inputs mais robusta
 *  - Mensagens de erro mais amigáveis
 *  - Notificação direta ao vendedor via DM (não polui o grupo)
 *  - Timeout de oferta (expira em X dias)
 */

'use strict';

const path     = require('path');
const mongoose = require('mongoose');
const Usuario  = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── CATÁLOGO ─────────────────────────────────────────────────────────────────

const { ITENS_LOJA }                   = require('./economia');
const { ITENS_ROUBO, ITENS_SEGURANCA } = require('./roubo');
const { VARAS_PESCA, ISCAS }           = require('./handlePescar'); // itens de pesca também!

const CATALOGO_COMPLETO = {
  ...(ITENS_LOJA       || {}),
  ...(ITENS_ROUBO      || {}),
  ...(ITENS_SEGURANCA  || {}),
  ...(VARAS_PESCA      || {}),
  ...(ISCAS            || {}),
};

function getNomeItem(itemKey) {
  return CATALOGO_COMPLETO[itemKey]?.nome ?? itemKey;
}

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG = {
  TAXA_MERCADO_PCT:    5,      // % deduzido do vendedor em cada venda
  MAX_OFERTAS_USER:    10,     // máximo de ofertas ativas por usuário
  PRECO_MINIMO:        1,      // gold mínimo por unidade
  PRECO_MAXIMO:        999999, // gold máximo por unidade
  QTD_MINIMA:          1,
  QTD_MAXIMA:          999,
  OFERTA_EXPIRA_DIAS:  7,      // ofertas expiram em 7 dias (0 = sem expiração)
  ITENS_POR_PAGINA:    10,     // !avenda com paginação
};

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const ofertaSchema = new mongoose.Schema({
  sellerId:   { type: String, required: true, index: true },
  sellerName: { type: String, required: true },
  itemKey:    { type: String, required: true },
  itemNome:   { type: String, required: true },
  preco:      { type: Number, required: true, min: CONFIG.PRECO_MINIMO },
  quantidade: { type: Number, required: true, min: 1 },
  expiresAt:  {
    type:    Date,
    default: CONFIG.OFERTA_EXPIRA_DIAS > 0
      ? () => new Date(Date.now() + CONFIG.OFERTA_EXPIRA_DIAS * 86400000)
      : null,
    index:   CONFIG.OFERTA_EXPIRA_DIAS > 0,
  },
  createdAt: { type: Date, default: Date.now },
});

ofertaSchema.index({ sellerId: 1, itemKey: 1 }, { unique: true });

// TTL automático: o MongoDB remove sozinho após expiresAt (se habilitado)
if (CONFIG.OFERTA_EXPIRA_DIAS > 0) {
  ofertaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

const logSchema = new mongoose.Schema({
  compradorId:  { type: String, required: true, index: true },
  vendedorId:   { type: String, required: true, index: true },
  itemKey:      { type: String, required: true },
  itemNome:     { type: String, required: true },
  quantidade:   { type: Number, required: true },
  precoUnit:    { type: Number, required: true },
  totalBruto:   { type: Number, required: true },
  taxa:         { type: Number, required: true },
  totalLiquido: { type: Number, required: true },
  createdAt:    { type: Date, default: Date.now, index: true },
});

const Oferta    = mongoose.models.Oferta    || mongoose.model('Oferta',    ofertaSchema);
const MarketLog = mongoose.models.MarketLog || mongoose.model('MarketLog', logSchema);

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

function formatarNumero(jid = '') {
  return jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
}

function toJid(numero) {
  const limpo = String(numero).replace(/\D/g, '');
  return limpo.includes('@') ? limpo : `${limpo}@s.whatsapp.net`;
}

/**
 * Resposta padrão — sempre com quoted para facilitar leitura em grupos.
 */
async function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function getSaldo(userId) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    return user?.gold ?? 0;
  } catch (e) {
    console.error('[Market] getSaldo:', e.message);
    return 0;
  }
}

/**
 * Altera o gold de um usuário.
 * @returns {number} novo saldo
 */
async function changeGold(userId, delta, session = null) {
  try {
    const opts = session ? { session, new: true } : { new: true };
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { gold: delta } },
      opts
    );
    return user?.gold ?? 0;
  } catch (e) {
    console.error('[Market] changeGold:', e.message);
    throw e; // propaga para o caller poder fazer rollback
  }
}

async function getQuantidadeInventario(userId, itemKey) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    if (!user) return 0;
    return (
      (user.inventory?.[itemKey]    ?? 0) +
      (user.itensRoubo?.[itemKey]   ?? 0) +
      (user.itensSec?.[itemKey]     ?? 0) +
      (user.itensPesca?.[itemKey]   ?? 0)   // suporte ao novo sistema de pesca
    );
  } catch (e) {
    console.error('[Market] getQuantidadeInventario:', e.message);
    return 0;
  }
}

/**
 * Remove itens do inventário (tenta todos os campos em ordem de prioridade).
 * Retorna true se conseguiu remover a quantidade total.
 */
async function removerInventario(userId, itemKey, quantidade, session = null) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    if (!user) return false;

    const campos = ['inventory', 'itensRoubo', 'itensSec', 'itensPesca'];
    let restante = quantidade;

    for (const campo of campos) {
      if (restante <= 0) break;
      const disponivel = user[campo]?.get?.(itemKey) ?? user[campo]?.[itemKey] ?? 0;
      if (disponivel <= 0) continue;

      const descontar = Math.min(disponivel, restante);
      const opts = session ? { session } : {};
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { [`${campo}.${itemKey}`]: -descontar } },
        opts
      );
      restante -= descontar;
    }

    return restante === 0;
  } catch (e) {
    console.error('[Market] removerInventario:', e.message);
    return false;
  }
}

async function adicionarInventario(userId, itemKey, quantidade, session = null) {
  try {
    const opts = session ? { session, upsert: true } : { upsert: true };
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`inventory.${itemKey}`]: quantidade } },
      opts
    );
    return true;
  } catch (e) {
    console.error('[Market] adicionarInventario:', e.message);
    return false;
  }
}

// ─── !avenda ──────────────────────────────────────────────────────────────────

async function handleAvenda(sock, msg, jid, caption = '') {
  try {
    // Paginação: !avenda 2
    const pageArg = parseInt(caption.match(/avenda\s+(\d+)/i)?.[1] ?? '1');
    const page    = Math.max(1, pageArg);
    const skip    = (page - 1) * CONFIG.ITENS_POR_PAGINA;

    const total   = await Oferta.countDocuments({ quantidade: { $gt: 0 } });
    const ofertas = await Oferta
      .find({ quantidade: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(CONFIG.ITENS_POR_PAGINA)
      .lean();

    if (total === 0) {
      return reply(sock, jid, msg,
        `📦 *MARKETPLACE VAZIO*\n\nNenhum item à venda no momento.\n\n` +
        `💡 Quer vender algo? *!ofertar <item> <preco> <qtd>*`
      );
    }

    const totalPags = Math.ceil(total / CONFIG.ITENS_POR_PAGINA);
    let texto = `🛒 *MARKETPLACE* — Página ${page}/${totalPags}\n`;
    texto += `📊 _${total} oferta(s) ativa(s)_\n`;
    texto += `━━━━━━━━━━━━━━━━\n`;

    // Agrupar por vendedor para exibição mais limpa
    const porVendedor = {};
    for (const o of ofertas) {
      if (!porVendedor[o.sellerId]) porVendedor[o.sellerId] = [];
      porVendedor[o.sellerId].push(o);
    }

    for (const [sellerId, lista] of Object.entries(porVendedor)) {
      const num = formatarNumero(sellerId);
      texto += `\n👤 *${lista[0].sellerName}* (${num})\n`;
      for (const o of lista) {
        const totalVal = o.preco * o.quantidade;
        const expira   = o.expiresAt
          ? `⏳ expira ${o.expiresAt.toLocaleDateString('pt-BR')}`
          : '';
        texto += `  📦 ${o.itemNome}\n`;
        texto += `     💵 ${o.preco}g × ${o.quantidade} un. _(total: ${totalVal}g)_\n`;
        if (expira) texto += `     ${expira}\n`;
        texto += `     🛒 \`!buy ${num} ${o.itemKey} <qtd>\`\n`;
      }
    }

    texto += `\n━━━━━━━━━━━━━━━━\n`;
    if (totalPags > 1) texto += `📄 Próxima página: *!avenda ${page + 1}*\n`;
    texto += `🔍 Buscar item: *!buscaroferta <item>*\n`;
    texto += `❌ Cancelar oferta: *!cancelaroferta <item>*`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleAvenda:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o marketplace!');
  }
}

// ─── !buscaroferta ────────────────────────────────────────────────────────────

async function handleBuscarOferta(sock, msg, jid, caption) {
  const match = caption.match(/buscaroferta\s+(\S+)/i);
  if (!match) {
    return reply(sock, jid, msg, '⚠️ Use: *!buscaroferta <item>*\nExemplo: *!buscaroferta dinamite*');
  }

  const itemKey = match[1].toLowerCase().trim();

  try {
    const ofertas = await Oferta
      .find({ itemKey, quantidade: { $gt: 0 } })
      .sort({ preco: 1 }) // ordena pelo mais barato primeiro
      .lean();

    if (ofertas.length === 0) {
      return reply(sock, jid, msg,
        `🔍 Nenhuma oferta encontrada para *${getNomeItem(itemKey)}*.\n\n` +
        `Seja o primeiro a vender: *!ofertar ${itemKey} <preco> <qtd>*`
      );
    }

    const itemNome = getNomeItem(itemKey);
    let texto = `🔍 *OFERTAS: ${itemNome}*\n`;
    texto += `📊 _${ofertas.length} oferta(s) encontrada(s)_\n`;
    texto += `━━━━━━━━━━━━━━━━\n\n`;

    for (const o of ofertas) {
      const num = formatarNumero(o.sellerId);
      texto += `👤 *${o.sellerName}*\n`;
      texto += `   💵 ${o.preco}g × ${o.quantidade} un.\n`;
      texto += `   🛒 \`!buy ${num} ${itemKey} <qtd>\`\n\n`;
    }

    const maisBarato = ofertas[0];
    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `🏆 Mais barato: *${maisBarato.preco}g* de ${maisBarato.sellerName}`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleBuscarOferta:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao buscar oferta!');
  }
}

// ─── !ofertar ─────────────────────────────────────────────────────────────────

async function handleOfertar(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  const match = caption.match(/ofertar\s+(\S+)\s+(\d+)\s+(\d+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ Use: *!ofertar <item> <preco> <quantidade>*\n' +
      'Exemplo: *!ofertar dinamite 200 3*'
    );
  }

  const itemKey    = match[1].toLowerCase().trim();
  const preco      = parseInt(match[2]);
  const quantidade = parseInt(match[3]);

  // ── Validações ────────────────────────────────────────────────────────────

  if (!CATALOGO_COMPLETO[itemKey]) {
    const exemplos = Object.keys(CATALOGO_COMPLETO).slice(0, 6).join(', ');
    return reply(sock, jid, msg,
      `⚠️ Item *${itemKey}* não encontrado no catálogo!\n\n📋 Exemplos: ${exemplos}...`
    );
  }

  if (preco < CONFIG.PRECO_MINIMO || preco > CONFIG.PRECO_MAXIMO) {
    return reply(sock, jid, msg,
      `⚠️ Preço inválido! Deve ser entre *${CONFIG.PRECO_MINIMO}g* e *${CONFIG.PRECO_MAXIMO}g*`
    );
  }

  if (quantidade < CONFIG.QTD_MINIMA || quantidade > CONFIG.QTD_MAXIMA) {
    return reply(sock, jid, msg,
      `⚠️ Quantidade inválida! Deve ser entre *${CONFIG.QTD_MINIMA}* e *${CONFIG.QTD_MAXIMA}*`
    );
  }

  // ── Limite de ofertas ativas ───────────────────────────────────────────────

  const qtdOfertas = await Oferta.countDocuments({ sellerId: userId });
  if (qtdOfertas >= CONFIG.MAX_OFERTAS_USER) {
    return reply(sock, jid, msg,
      `❌ Você atingiu o limite de *${CONFIG.MAX_OFERTAS_USER} ofertas ativas*!\n\n` +
      `Cancele uma com *!cancelaroferta <item>* antes de criar outra.`
    );
  }

  // ── Verificar inventário ───────────────────────────────────────────────────

  const disponivel = await getQuantidadeInventario(userId, itemKey);
  if (disponivel < quantidade) {
    return reply(sock, jid, msg,
      `❌ *Inventário insuficiente!*\n\n` +
      `📦 Você tem: *${disponivel}x ${getNomeItem(itemKey)}*\n` +
      `📊 Tentou ofertar: *${quantidade}*\n\n` +
      `💡 Compre mais na loja com *!loja*`
    );
  }

  // ── Remover do inventário ──────────────────────────────────────────────────

  const removido = await removerInventario(userId, itemKey, quantidade);
  if (!removido) {
    return reply(sock, jid, msg, '⚠️ Erro ao reservar seus itens. Tente novamente.');
  }

  try {
    const sellerName = formatarNumero(userId);
    const itemNome   = getNomeItem(itemKey);

    const oferta = await Oferta.findOneAndUpdate(
      { sellerId: userId, itemKey },
      {
        $set:        { sellerName, itemNome, preco },
        $inc:        { quantidade },
        $setOnInsert:{ createdAt: new Date() },
      },
      { upsert: true, new: true }
    );

    const expiraTexto = oferta.expiresAt
      ? `\n⏳ *Expira em:* ${oferta.expiresAt.toLocaleDateString('pt-BR')}`
      : '';

    return reply(sock, jid, msg,
      `✅ *OFERTA CRIADA!*\n\n` +
      `📦 *Item:* ${itemNome}\n` +
      `💵 *Preço:* ${preco}g cada\n` +
      `📊 *Quantidade:* ${quantidade}` +
      expiraTexto + `\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 Ver marketplace: *!avenda*\n` +
      `❌ Cancelar: *!cancelaroferta ${itemKey}*`
    );
  } catch (e) {
    // Rollback: devolve o item ao inventário
    await adicionarInventario(userId, itemKey, quantidade);
    console.error('[Market] handleOfertar:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao criar oferta. Seus itens foram devolvidos.');
  }
}

// ─── !buy ─────────────────────────────────────────────────────────────────────

async function handleBuy(sock, msg, jid, caption) {
  const compradorId = getUserId(msg);
  if (!compradorId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  const match = caption.match(/buy\s+(\S+)\s+(\S+)\s+(\d+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ Use: *!buy <vendedor> <item> <quantidade>*\n' +
      'Exemplo: *!buy 5511999999999 dinamite 2*\n\n' +
      'Ver vendedores: *!avenda*'
    );
  }

  const vendedorId = toJid(match[1]);
  const itemKey    = match[2].toLowerCase().trim();
  const quantidade = parseInt(match[3]);

  if (compradorId === vendedorId) {
    return reply(sock, jid, msg, '❌ Você não pode comprar sua própria oferta!');
  }

  if (quantidade < 1) {
    return reply(sock, jid, msg, '⚠️ Quantidade deve ser pelo menos 1.');
  }

  // ── Transação com session (atomicidade real) ───────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const oferta = await Oferta.findOne({ sellerId: vendedorId, itemKey }).session(session);

    if (!oferta || oferta.quantidade <= 0) {
      await session.abortTransaction();
      return reply(sock, jid, msg,
        `❌ Oferta não encontrada!\n\nVer ofertas disponíveis: *!avenda*`
      );
    }

    if (quantidade > oferta.quantidade) {
      await session.abortTransaction();
      return reply(sock, jid, msg,
        `⚠️ *Quantidade indisponível!*\n\n` +
        `📦 Disponível: *${oferta.quantidade}x ${oferta.itemNome}*\n` +
        `📊 Você pediu: *${quantidade}*`
      );
    }

    const totalBruto   = oferta.preco * quantidade;
    const taxa         = Math.floor(totalBruto * CONFIG.TAXA_MERCADO_PCT / 100);
    const totalLiquido = totalBruto - taxa; // vendedor recebe isso
    const saldo        = await getSaldo(compradorId);

    if (saldo < totalBruto) {
      await session.abortTransaction();
      return reply(sock, jid, msg,
        `❌ *SALDO INSUFICIENTE*\n\n` +
        `💰 Você tem: *${saldo}g*\n` +
        `💸 Precisa: *${totalBruto}g*\n` +
        `📊 Faltam: *${totalBruto - saldo}g*`
      );
    }

    // 1. Atualizar/remover oferta
    if (oferta.quantidade - quantidade === 0) {
      await Oferta.deleteOne({ _id: oferta._id }, { session });
    } else {
      await Oferta.findByIdAndUpdate(oferta._id, { $inc: { quantidade: -quantidade } }, { session });
    }

    // 2. Transferir gold
    const novoSaldoComprador = await changeGold(compradorId, -totalBruto, session);
    await changeGold(vendedorId, totalLiquido, session);

    // 3. Entregar item ao comprador
    await adicionarInventario(compradorId, itemKey, quantidade, session);

    // 4. Registrar no log
    await MarketLog.create([{
      compradorId,
      vendedorId,
      itemKey,
      itemNome:     oferta.itemNome,
      quantidade,
      precoUnit:    oferta.preco,
      totalBruto,
      taxa,
      totalLiquido,
    }], { session });

    await session.commitTransaction();

    // ── Resposta ao comprador ────────────────────────────────────────────────
    await reply(sock, jid, msg,
      `✅ *COMPRA REALIZADA!*\n\n` +
      `📦 *Item:* ${oferta.itemNome}\n` +
      `📊 *Quantidade:* ${quantidade}\n` +
      `💵 *Preço unit.:* ${oferta.preco}g\n` +
      `💸 *Total pago:* ${totalBruto}g\n` +
      `🏦 *Taxa do mercado (${CONFIG.TAXA_MERCADO_PCT}%):* ${taxa}g\n` +
      `👤 *Vendedor:* ${formatarNumero(vendedorId)}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *Seu novo saldo:* ${novoSaldoComprador}g`
    );

    // ── Notificar o vendedor no privado (não polui o grupo) ────────────────
    try {
      const vendedorJid = vendedorId;
      await sock.sendMessage(vendedorJid, {
        text:
          `🛒 *VENDA REALIZADA!*\n\n` +
          `📦 ${oferta.itemNome} × ${quantidade}\n` +
          `💰 Você recebeu: *+${totalLiquido}g*\n` +
          `🏦 Taxa de mercado: *-${taxa}g*\n` +
          `👤 Comprador: @${formatarNumero(compradorId)}`,
        mentions: [compradorId],
      });
    } catch (_) {
      // Notificação é best-effort; falha silenciosa
    }

  } catch (e) {
    await session.abortTransaction();
    console.error('[Market] handleBuy:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao processar a compra! Tente novamente.');
  } finally {
    session.endSession();
  }
}

// ─── !cancelaroferta ──────────────────────────────────────────────────────────

async function handleCancelarOferta(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  const match = caption.match(/cancelaroferta\s+(\S+)/i);
  if (!match) {
    return reply(sock, jid, msg,
      '⚠️ Use: *!cancelaroferta <item>*\nExemplo: *!cancelaroferta dinamite*'
    );
  }

  const itemKey = match[1].toLowerCase().trim();

  try {
    const oferta = await Oferta.findOneAndDelete({ sellerId: userId, itemKey });

    if (!oferta) {
      return reply(sock, jid, msg,
        `❌ Você não tem oferta ativa de *${getNomeItem(itemKey)}*.\n\n` +
        `Ver suas ofertas: *!minhasofertas*`
      );
    }

    await adicionarInventario(userId, itemKey, oferta.quantidade);

    return reply(sock, jid, msg,
      `✅ *OFERTA CANCELADA!*\n\n` +
      `📦 *${oferta.itemNome}* × ${oferta.quantidade} devolvido(s) ao seu inventário.`
    );
  } catch (e) {
    console.error('[Market] handleCancelarOferta:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao cancelar oferta!');
  }
}

// ─── !minhasofertas ───────────────────────────────────────────────────────────

async function handleMinhasOfertas(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  try {
    const ofertas = await Oferta.find({ sellerId: userId, quantidade: { $gt: 0 } }).lean();

    if (ofertas.length === 0) {
      return reply(sock, jid, msg,
        `📦 *VOCÊ NÃO TEM OFERTAS ATIVAS*\n\n` +
        `Crie uma com: *!ofertar <item> <preco> <qtd>*\n` +
        `Ver marketplace: *!avenda*`
      );
    }

    let texto = `📊 *SUAS OFERTAS ATIVAS* (${ofertas.length}/${CONFIG.MAX_OFERTAS_USER})\n\n`;
    let totalPotencial = 0;

    for (const o of ofertas) {
      const totalItem = o.preco * o.quantidade;
      const liquido   = totalItem - Math.floor(totalItem * CONFIG.TAXA_MERCADO_PCT / 100);
      totalPotencial += liquido;

      const expira = o.expiresAt
        ? `\n   ⏳ Expira: ${o.expiresAt.toLocaleDateString('pt-BR')}`
        : '';

      texto += `📦 *${o.itemNome}*\n`;
      texto += `   💵 ${o.preco}g × ${o.quantidade} un.\n`;
      texto += `   💰 Você recebe: *${liquido}g* (após taxa de ${CONFIG.TAXA_MERCADO_PCT}%)` + expira + `\n`;
      texto += `   ❌ \`!cancelaroferta ${o.itemKey}\`\n\n`;
    }

    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `💰 *Potencial líquido:* ${totalPotencial}g`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleMinhasOfertas:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar suas ofertas!');
  }
}

// ─── !historicomarket ─────────────────────────────────────────────────────────

async function handleHistoricoMarket(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  try {
    const logs = await MarketLog
      .find({ $or: [{ compradorId: userId }, { vendedorId: userId }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (logs.length === 0) {
      return reply(sock, jid, msg, '📋 Você ainda não tem transações no marketplace.');
    }

    let texto = `📋 *HISTÓRICO DE TRANSAÇÕES* (últimas 10)\n\n`;

    for (const log of logs) {
      const ehComprador = log.compradorId === userId;
      const data        = new Date(log.createdAt).toLocaleDateString('pt-BR');
      const hora        = new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const contraparte = ehComprador ? formatarNumero(log.vendedorId) : formatarNumero(log.compradorId);

      texto += ehComprador
        ? `🛒 *COMPRA* — ${data} ${hora}\n`
        : `💰 *VENDA* — ${data} ${hora}\n`;

      texto += `   📦 ${log.itemNome} × ${log.quantidade}\n`;

      if (ehComprador) {
        texto += `   💸 Pago: *${log.totalBruto}g* | Vendedor: ${contraparte}\n\n`;
      } else {
        texto += `   💰 Recebido: *${log.totalLiquido}g* (taxa: ${log.taxa}g) | Comprador: ${contraparte}\n\n`;
      }
    }

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Market] handleHistoricoMarket:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar histórico!');
  }
}

// ─── Aliases / compatibilidade ────────────────────────────────────────────────

async function handleOfertasRecebidas(sock, msg, jid) {
  return handleMinhasOfertas(sock, msg, jid);
}

async function handleAceitarOfferta(sock, msg, jid) {
  return reply(sock, jid, msg,
    '💼 Use *!buy* para comprar ofertas!\n\n' +
    'Exemplo: *!buy 5511999999999 dinamite 2*\n' +
    'Ver ofertas: *!avenda*'
  );
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleAvenda,
  handleBuscarOferta,
  handleOfertar,
  handleBuy,
  handleCancelarOferta,
  handleMinhasOfertas,
  handleHistoricoMarket,
  handleOfertasRecebidas, // compatibilidade
  handleAceitarOfferta,   // compatibilidade
  Oferta,
  MarketLog,
  CONFIG,
};