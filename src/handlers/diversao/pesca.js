'use strict';

/**
 * Handler de Pesca — Bot WhatsApp
 * Sistema de pesca com itens, cooldown, raridade e inventário por grupo
 *
 * v3.0:
 *  - Economia e inventário isolados por grupo (CarteiraGrupo)
 *  - Melhor vara/isca selecionada automaticamente (maior bônus)
 *  - !venderpesca [item] [qtd] — vende itens por 70% do valor
 *  - !rankingpesca              — top 10 pescadores do grupo
 *  - !statspesca                — equipamento atual + chances em tempo real
 *  - Logs de erro completos
 */

const path          = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { getCarteira, alterarGold } = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG_PESCA = {
  COOLDOWN_MS:       15 * 60 * 1000, // 15 minutos entre pescas
  CHANCE_FALHA_BASE: 30,             // 30% de falha sem vara
  CHANCE_FALHA_MIN:  5,              // mínimo de 5% de falha
  PERCENTUAL_VENDA:  0.70,           // 70% do valor base na venda
};

// ─── VARAS DE PESCA ───────────────────────────────────────────────────────────

const VARAS_PESCA = {
  vara_bambu:    { nome: '🎋 Vara de Bambu',   preco: 80,   bonus_raridade: 0,  reduce_falha: 5  },
  vara_madeira:  { nome: '🪵 Vara de Madeira',  preco: 150,  bonus_raridade: 5,  reduce_falha: 8  },
  vara_fibra:    { nome: '🎣 Vara de Fibra',    preco: 300,  bonus_raridade: 10, reduce_falha: 12 },
  vara_carbono:  { nome: '⚫ Vara de Carbono',  preco: 600,  bonus_raridade: 18, reduce_falha: 18 },
  vara_titanio:  { nome: '🔩 Vara de Titânio',  preco: 1200, bonus_raridade: 28, reduce_falha: 22 },
  vara_lendaria: { nome: '✨ Vara Lendária',    preco: 3000, bonus_raridade: 45, reduce_falha: 25 },
};

// ─── ISCAS ────────────────────────────────────────────────────────────────────

const ISCAS = {
  isca_minhoca:  { nome: '🪱 Minhoca',          preco: 20,  bonus_raridade: 0,  reduce_falha: 2  },
  isca_camarao:  { nome: '🦐 Camarão',          preco: 50,  bonus_raridade: 5,  reduce_falha: 5  },
  isca_mosca:    { nome: '🪰 Mosca Artificial',  preco: 80,  bonus_raridade: 8,  reduce_falha: 7  },
  isca_peixinho: { nome: '🐟 Peixinho Vivo',     preco: 120, bonus_raridade: 12, reduce_falha: 10 },
  isca_lula:     { nome: '🦑 Lula',              preco: 200, bonus_raridade: 18, reduce_falha: 14 },
  isca_magica:   { nome: '🌟 Isca Mágica',       preco: 500, bonus_raridade: 30, reduce_falha: 20 },
};

// ─── CATÁLOGO DE ITENS PESCÁVEIS ──────────────────────────────────────────────

const PEIXES_E_ITENS = {
  // Peixes
  peixe_pequeno:    { nome: '🐟 Peixe Pequeno',  raridade: 'comum',    peso: 60, gold: 15  },
  peixe_medio:      { nome: '🐠 Peixe Médio',     raridade: 'incomum',  peso: 25, gold: 35  },
  peixe_grande:     { nome: '🐡 Peixe Grande',    raridade: 'raro',     peso: 10, gold: 80  },
  peixe_espada:     { nome: '⚔️ Peixe-Espada',    raridade: 'epico',    peso: 4,  gold: 200 },
  peixe_lendario:   { nome: '🌈 Peixe Arco-Íris', raridade: 'lendario', peso: 1,  gold: 500 },
  // Lixo (gold = 0 → não vendável)
  bota_velha:       { nome: '👢 Bota Velha',       raridade: 'comum',    peso: 40, gold: 0   },
  lata_enferrujada: { nome: '🥫 Lata Enferrujada', raridade: 'comum',    peso: 35, gold: 0   },
  alga:             { nome: '🌿 Monte de Algas',    raridade: 'comum',    peso: 30, gold: 2   },
  // Tesouros
  moeda_antiga:     { nome: '🪙 Moeda Antiga',      raridade: 'incomum',  peso: 20, gold: 50  },
  anel_perdido:     { nome: '💍 Anel Perdido',      raridade: 'raro',     peso: 8,  gold: 150 },
  perola:           { nome: '🦪 Pérola Rara',       raridade: 'epico',    peso: 3,  gold: 400 },
  tesouro:          { nome: '💎 Cristal do Fundo',  raridade: 'lendario', peso: 1,  gold: 800 },
};

const ITENS_BONUS_PESCA = {
  mascara:   { nome: '🎭 Máscara',     raridade: 'incomum', peso: 15, gold: 0 },
  corda:     { nome: '🪢 Corda Ninja', raridade: 'raro',    peso: 6,  gold: 0 },
  chocolate: { nome: '🍫 Chocolate',   raridade: 'comum',   peso: 25, gold: 0 },
  flores:    { nome: '🌹 Flores',      raridade: 'incomum', peso: 15, gold: 0 },
};

const CATALOGO_PESCA = { ...PEIXES_E_ITENS, ...ITENS_BONUS_PESCA };

// Itens que vão para o inventário mas não têm gold (não vendáveis diretamente)
const LIXO_KEYS     = new Set(['bota_velha', 'lata_enferrujada', 'alga']);
// Itens que ficam apenas na mensagem, não vão para o inventário
const DESCARTAVEL_KEYS = new Set(['bota_velha', 'lata_enferrujada']);

const RARIDADE_LABEL = {
  comum:    '⚪ Comum',
  incomum:  '🟢 Incomum',
  raro:     '🔵 Raro',
  epico:    '🟣 Épico',
  lendario: '🟡 Lendário',
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

/**
 * Resolve userId e groupId a partir da mensagem.
 * Retorna null em groupId se for conversa privada.
 */
function resolverContexto(msg) {
  const userId  = msg?.key?.participant || msg?.key?.remoteJid || null;
  const remoteJid = msg?.key?.remoteJid ?? '';
  const groupId = remoteJid.endsWith('@g.us') ? remoteJid : null;
  return { userId, groupId };
}

/**
 * Lê quantidade de um item no mapa itensPesca (suporta Map Mongoose ou objeto plano).
 */
function getQtdItem(carteira, key) {
  const mapa = carteira?.itensPesca;
  if (!mapa) return 0;
  const val = mapa instanceof Map ? mapa.get(key) : mapa[key];
  return val ?? 0;
}

/**
 * Seleciona a melhor vara disponível no inventário (maior bonus_raridade).
 */
function selecionarMelhorVara(carteira) {
  return Object.entries(VARAS_PESCA)
    .filter(([k]) => getQtdItem(carteira, k) > 0)
    .sort((a, b) => b[1].bonus_raridade - a[1].bonus_raridade)[0]?.[0] ?? null;
}

/**
 * Seleciona a melhor isca disponível no inventário (maior bonus_raridade).
 */
function selecionarMelhorIsca(carteira) {
  return Object.entries(ISCAS)
    .filter(([k]) => getQtdItem(carteira, k) > 0)
    .sort((a, b) => b[1].bonus_raridade - a[1].bonus_raridade)[0]?.[0] ?? null;
}

function calcularChanceFalha(varaKey, iscaKey) {
  const r = (VARAS_PESCA[varaKey]?.reduce_falha ?? 0) + (ISCAS[iscaKey]?.reduce_falha ?? 0);
  return Math.max(CONFIG_PESCA.CHANCE_FALHA_MIN, CONFIG_PESCA.CHANCE_FALHA_BASE - r);
}

function calcularBonusRaridade(varaKey, iscaKey) {
  return (VARAS_PESCA[varaKey]?.bonus_raridade ?? 0) + (ISCAS[iscaKey]?.bonus_raridade ?? 0);
}

function sortearItem(bonusRaridade = 0) {
  const mult = {
    comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
    incomum:  1 + bonusRaridade * 0.01,
    raro:     1 + bonusRaridade * 0.03,
    epico:    1 + bonusRaridade * 0.05,
    lendario: 1 + bonusRaridade * 0.08,
  };

  const pool = Object.entries(CATALOGO_PESCA).map(([key, item]) => ({
    key,
    ...item,
    pesoAjustado: Math.max(0.5, item.peso * (mult[item.raridade] ?? 1)),
  }));

  const total = pool.reduce((acc, i) => acc + i.pesoAjustado, 0);
  let sorteio = Math.random() * total;

  for (const item of pool) {
    sorteio -= item.pesoAjustado;
    if (sorteio <= 0) return item;
  }
  return pool[0];
}

function formatarTempo(ms) {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

// ─── !pescar ──────────────────────────────────────────────────────────────────

async function handlePescar(sock, msg, jid) {
  const { userId, groupId } = resolverContexto(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg,
      '🎣 *A pesca só funciona em grupos!*\n\n' +
      'Entre em um grupo e use *!pescar* por lá.'
    );
  }

  try {
    const carteira = await getCarteira(userId, groupId);

    // ── Cooldown ──────────────────────────────────────────────────────────
    const agora       = Date.now();
    const ultimaPesca = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const msPassado   = agora - ultimaPesca;

    if (msPassado < CONFIG_PESCA.COOLDOWN_MS) {
      const restante = CONFIG_PESCA.COOLDOWN_MS - msPassado;
      return reply(sock, jid, msg,
        `⏳ *AGUARDE PARA PESCAR!*\n\n` +
        `🎣 Você pescou recentemente neste grupo.\n` +
        `⏰ Próxima pesca em: *${formatarTempo(restante)}*`
      );
    }

    // ── Melhor vara e isca disponíveis ────────────────────────────────────
    const varaKey = selecionarMelhorVara(carteira);
    const iscaKey = selecionarMelhorIsca(carteira);

    if (!varaKey) {
      return reply(sock, jid, msg,
        `🎣 *VOCÊ PRECISA DE UMA VARA!*\n\n` +
        `Sem vara de pesca não dá pra pescar neste grupo!\n\n` +
        `🛒 Compre uma na loja: *!comprar vara_bambu*\n` +
        `📋 Ver varas disponíveis: *!varas*`
      );
    }

    // ── Registrar cooldown imediatamente (evita duplo clique) ─────────────
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: groupId },
      { $set: { ultimaPesca: new Date() } }
    );

    // ── Consumir 1 isca ───────────────────────────────────────────────────
    if (iscaKey) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: { [`itensPesca.${iscaKey}`]: -1 } }
      );
    }

    const varaNome = VARAS_PESCA[varaKey].nome;
    const iscaNome = iscaKey ? ISCAS[iscaKey].nome : null;

    const cabecalho =
      `🎣 *PESCARIA!*\n\n` +
      `🪝 Vara: *${varaNome}*\n` +
      (iscaNome ? `🪱 Isca: *${iscaNome}* _(consumida)_\n` : `🪱 Isca: _nenhuma_\n`) +
      `━━━━━━━━━━━━━━━━\n`;

    // ── Falha ─────────────────────────────────────────────────────────────
    const chanceFalha   = calcularChanceFalha(varaKey, iscaKey);
    const bonusRaridade = calcularBonusRaridade(varaKey, iscaKey);
    const falhou        = Math.random() * 100 < chanceFalha;

    if (falhou) {
      const mensagensFalha = [
        '🌊 O peixe deu uma mordida e escapou!',
        '💨 Nada por aqui... a água está quieta demais.',
        '😔 Você ficou esperando, mas nada apareceu.',
        '🐟 O peixe olhou para a isca e foi embora.',
        '🌿 Você pescou um monte de algas. Nada útil.',
        '🤣 Um peixinho roubou sua isca e fugiu!',
        '🌧️ A chuva espantou os peixes por um tempo.',
        '🦈 Uma sombra enorme passou e os peixes sumiram...',
      ];
      const msgFalha = mensagensFalha[Math.floor(Math.random() * mensagensFalha.length)];

      return reply(sock, jid, msg,
        cabecalho +
        `\n${msgFalha}\n\n` +
        `💡 Tente novamente em *${formatarTempo(CONFIG_PESCA.COOLDOWN_MS)}*\n` +
        `📈 Use iscas melhores para reduzir falhas! _(atual: ${chanceFalha}% de falha)_`
      );
    }

    // ── Sucesso: sortear item ─────────────────────────────────────────────
    const item     = sortearItem(bonusRaridade);
    const rarLabel = RARIDADE_LABEL[item.raridade] ?? item.raridade;
    const ehLixo   = LIXO_KEYS.has(item.key);
    const ehDesc   = DESCARTAVEL_KEYS.has(item.key);

    // ── Persistir: gold + item no inventário ─────────────────────────────
    if (item.gold > 0) {
      await alterarGold(userId, groupId, item.gold, `Pesca: ${item.nome}`);
    }

    if (!ehDesc) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: { [`itensPesca.${item.key}`]: 1 } }
      );
    }

    // ── Montar resposta ───────────────────────────────────────────────────
    const reacoes = {
      comum:    '',
      incomum:  '✨ Não é ruim!',
      raro:     '🔥 Que sorte! Item raro!',
      epico:    '🤩 ÉPICO! Pescada incrível!!',
      lendario: '🏆 LENDÁRIO!! VOCÊ É UM MESTRE DA PESCA!!!',
    };

    const precoVenda = item.gold > 0
      ? Math.floor(item.gold * CONFIG_PESCA.PERCENTUAL_VENDA)
      : null;

    let resultado =
      cabecalho +
      `\n🎉 *VOCÊ PESCOU!*\n\n` +
      `📦 *${item.nome}*\n` +
      `🏷️ Raridade: *${rarLabel}*\n`;

    if (item.gold > 0)  resultado += `💰 *+${item.gold} gold* (neste grupo)\n`;
    if (ehDesc)         resultado += `\n🗑️ _Só lixo desta vez..._\n`;
    else if (ehLixo)    resultado += `\n📥 _Item adicionado ao inventário do grupo._\n`;
    else                resultado += `\n📥 _Item adicionado ao inventário do grupo._\n`;

    if (precoVenda && !ehLixo) {
      resultado += `💵 _Venda por: *${precoVenda} gold* → !venderpesca ${item.key}_\n`;
    }

    const reacao = reacoes[item.raridade] ?? '';
    if (reacao) resultado += `\n${reacao}\n`;

    resultado +=
      `\n━━━━━━━━━━━━━━━━\n` +
      `⏰ Próxima pesca em *${formatarTempo(CONFIG_PESCA.COOLDOWN_MS)}*\n` +
      `📦 Ver inventário: *!inventariopesca*`;

    return reply(sock, jid, msg, resultado);

  } catch (err) {
    console.error('[Pesca] handlePescar:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao pescar! Tente novamente.');
  }
}

// ─── !varas ───────────────────────────────────────────────────────────────────

async function handleVaras(sock, msg, jid) {
  let texto = `🎣 *VARAS DE PESCA*\n\n_A melhor vara disponível no inventário é usada automaticamente._\n\n`;

  for (const [key, vara] of Object.entries(VARAS_PESCA)) {
    texto +=
      `${vara.nome}\n` +
      `   💵 Preço: *${vara.preco} gold*\n` +
      `   📈 Bonus raridade: *+${vara.bonus_raridade}*\n` +
      `   🎯 Reduz falha: *-${vara.reduce_falha}%*\n` +
      `   🛒 \`!comprar ${key}\`\n\n`;
  }

  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `🪱 Ver iscas: *!iscas*\n` +
    `🎣 Pescar agora: *!pescar*`;

  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !iscas ───────────────────────────────────────────────────────────────────

async function handleIscas(sock, msg, jid) {
  let texto = `🪱 *ISCAS DE PESCA*\n\n_A melhor isca disponível no inventário é usada automaticamente (1 por pesca)._\n\n`;

  for (const [key, isca] of Object.entries(ISCAS)) {
    texto +=
      `${isca.nome}\n` +
      `   💵 Preço: *${isca.preco} gold*\n` +
      `   📈 Bonus raridade: *+${isca.bonus_raridade}*\n` +
      `   🎯 Reduz falha: *-${isca.reduce_falha}%*\n` +
      `   🛒 \`!comprar ${key}\`\n\n`;
  }

  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `💡 _A isca é consumida a cada pesca!_\n` +
    `🎣 Ver varas: *!varas*`;

  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !inventariopesca ─────────────────────────────────────────────────────────

async function handleInventarioPesca(sock, msg, jid) {
  const { userId, groupId } = resolverContexto(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg,
      '🎣 O inventário de pesca é por grupo!\nUse este comando em um grupo.'
    );
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    if (!carteira) {
      return reply(sock, jid, msg,
        `🎣 *INVENTÁRIO VAZIO NESTE GRUPO*\n\n` +
        `Compre uma vara: *!varas*\n` +
        `Compre uma isca: *!iscas*\n` +
        `Então: *!pescar*`
      );
    }

    const inv    = carteira.itensPesca ?? {};
    const chaves = Object.keys(inv).filter(k => (inv[k] ?? 0) > 0);

    if (chaves.length === 0) {
      return reply(sock, jid, msg,
        `🎣 *SEU INVENTÁRIO DE PESCA ESTÁ VAZIO*\n\n` +
        `Compre uma vara: *!varas*\n` +
        `Compre uma isca: *!iscas*\n` +
        `Então: *!pescar*`
      );
    }

    let texto = `🎣 *INVENTÁRIO DE PESCA* _(neste grupo)_\n\n`;

    const varas    = chaves.filter(k => VARAS_PESCA[k]);
    const iscas    = chaves.filter(k => ISCAS[k]);
    const pescados = chaves.filter(k => !VARAS_PESCA[k] && !ISCAS[k]);

    if (varas.length > 0) {
      texto += `🪝 *VARAS*\n`;
      for (const k of varas) texto += `   ${VARAS_PESCA[k].nome} × ${inv[k]}\n`;
      texto += '\n';
    }

    if (iscas.length > 0) {
      texto += `🪱 *ISCAS*\n`;
      for (const k of iscas) texto += `   ${ISCAS[k].nome} × ${inv[k]}\n`;
      texto += '\n';
    }

    if (pescados.length > 0) {
      texto += `📦 *ITENS PESCADOS*\n`;
      for (const k of pescados) {
        const info        = CATALOGO_PESCA[k];
        const nome        = info?.nome ?? k;
        const precoVenda  = info?.gold > 0 ? Math.floor(info.gold * CONFIG_PESCA.PERCENTUAL_VENDA) : null;
        const vendaLabel  = precoVenda ? ` _(venda: ${precoVenda}g → !venderpesca ${k})_` : '';
        texto += `   ${nome} × ${inv[k]}${vendaLabel}\n`;
      }
    }

    texto +=
      `\n💰 Gold neste grupo: *${carteira.gold ?? 0}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎣 *!pescar* para pescar novamente!\n` +
      `💵 *!venderpesca <item> [qtd]* para vender`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleInventarioPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar inventário de pesca!');
  }
}

// ─── !venderpesca ─────────────────────────────────────────────────────────────

/**
 * !venderpesca <item> [quantidade]
 * Vende itens pescados por CONFIG_PESCA.PERCENTUAL_VENDA do valor base.
 * Varas e iscas não podem ser vendidas por este comando.
 */
async function handleVenderPesca(sock, msg, jid, caption) {
  const { userId, groupId } = resolverContexto(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Venda de pesca só funciona em grupos!');
  }

  // Parsear argumentos: !venderpesca <item> [qtd]
  const partes = caption.trim().split(/\s+/);
  const itemKey = partes[1]?.toLowerCase();
  const qtd     = Math.max(1, parseInt(partes[2] ?? '1', 10) || 1);

  if (!itemKey) {
    return reply(sock, jid, msg,
      `💵 *VENDER ITEM DE PESCA*\n\n` +
      `Uso: *!venderpesca <item> [quantidade]*\n` +
      `Exemplo: *!venderpesca peixe_pequeno 5*\n\n` +
      `📦 Ver seus itens: *!inventariopesca*`
    );
  }

  // Varas e iscas não são vendáveis aqui
  if (VARAS_PESCA[itemKey] || ISCAS[itemKey]) {
    return reply(sock, jid, msg,
      `⚠️ *${itemKey}* é um equipamento de pesca e não pode ser vendido por aqui.\n\n` +
      `_Use a loja do grupo para negociar equipamentos._`
    );
  }

  const info = CATALOGO_PESCA[itemKey];
  if (!info) {
    return reply(sock, jid, msg,
      `⚠️ Item *${itemKey}* não encontrado no catálogo de pesca.\n\n` +
      `📦 Veja seus itens: *!inventariopesca*`
    );
  }

  if ((info.gold ?? 0) === 0) {
    return reply(sock, jid, msg,
      `🗑️ *${info.nome}* não tem valor de venda (é lixo).\n\n` +
      `_Jogue fora ou guarde de recordação._`
    );
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    const disponivel = carteira?.itensPesca?.[itemKey] ?? 0;

    if (disponivel <= 0) {
      return reply(sock, jid, msg,
        `⚠️ Você não tem *${info.nome}* no inventário deste grupo.\n\n` +
        `📦 *!inventariopesca* para ver o que você tem.`
      );
    }

    const qtdVender     = Math.min(qtd, disponivel);
    const precoUnitario = Math.floor(info.gold * CONFIG_PESCA.PERCENTUAL_VENDA);
    const totalGold     = precoUnitario * qtdVender;

    // Debitar itens e creditar gold atomicamente
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: groupId },
      { $inc: { [`itensPesca.${itemKey}`]: -qtdVender } }
    );
    await alterarGold(userId, groupId, totalGold, `Venda pesca: ${info.nome} ×${qtdVender}`);

    return reply(sock, jid, msg,
      `💵 *VENDA REALIZADA!*\n\n` +
      `📦 Item: *${info.nome}*\n` +
      `🔢 Quantidade vendida: *${qtdVender}*\n` +
      `💰 Valor unitário: *${precoUnitario} gold* (${Math.round(CONFIG_PESCA.PERCENTUAL_VENDA * 100)}% do base)\n` +
      `🏆 Total recebido: *+${totalGold} gold*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📦 Restante no inventário: *${disponivel - qtdVender}×*\n` +
      `💰 Saldo atual (grupo): *${(carteira.gold ?? 0) + totalGold} gold*`
    );

  } catch (err) {
    console.error('[Pesca] handleVenderPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao vender item! Tente novamente.');
  }
}

// ─── !rankingpesca ────────────────────────────────────────────────────────────

/**
 * Exibe top 10 pescadores do grupo, ordenados pela quantidade total de itens pescados.
 * contactNames: Map<jid, nome> passado pelo dispatcher.
 */
async function handleRankingPesca(sock, msg, jid, contactNames) {
  const { groupId } = resolverContexto(msg);

  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Ranking de pesca só funciona em grupos!');
  }

  try {
    const carteiras = await CarteiraGrupo
      .find({ idGrupo: groupId })
      .lean();

    // Calcular total de itens pescados (excluindo varas e iscas)
    const scores = carteiras
      .map(c => {
        const inv   = c.itensPesca ?? {};
        const total = Object.entries(inv)
          .filter(([k]) => !VARAS_PESCA[k] && !ISCAS[k])
          .reduce((acc, [, v]) => acc + (v ?? 0), 0);
        return { idWhatsApp: c.idWhatsApp, total, gold: c.gold ?? 0 };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (scores.length === 0) {
      return reply(sock, jid, msg,
        `🎣 *RANKING DE PESCA*\n\n` +
        `Ninguém pescou nada neste grupo ainda!\n\n` +
        `Seja o primeiro: *!pescar*`
      );
    }

    const medalhas = ['🥇', '🥈', '🥉'];
    let texto = `🎣 *RANKING DE PESCA* _(itens coletados)_\n\n`;

    scores.forEach((s, i) => {
      const jidUsuario = s.idWhatsApp;
      const nome       = contactNames?.get?.(jidUsuario) ?? jidUsuario.split('@')[0];
      const medalha    = medalhas[i] ?? `${i + 1}.`;
      texto += `${medalha} *${nome}*\n   📦 ${s.total} itens | 💰 ${s.gold} gold\n\n`;
    });

    texto +=
      `━━━━━━━━━━━━━━━━\n` +
      `🎣 Use *!pescar* para subir no ranking!`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleRankingPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar ranking!');
  }
}

// ─── !statspesca ─────────────────────────────────────────────────────────────

/**
 * Mostra equipamento atual, cooldown restante, chance de falha e bônus de raridade.
 */
async function handleStatsPesca(sock, msg, jid) {
  const { userId, groupId } = resolverContexto(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Stats de pesca só funcionam em grupos!');
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    if (!carteira) {
      return reply(sock, jid, msg,
        `🎣 *STATS DE PESCA*\n\nVocê ainda não tem uma carteira neste grupo.\n\n` +
        `Compre uma vara: *!varas*`
      );
    }

    const varaKey = selecionarMelhorVara(carteira);
    const iscaKey = selecionarMelhorIsca(carteira);

    const varaNome  = varaKey ? VARAS_PESCA[varaKey].nome : '_Nenhuma_';
    const iscaNome  = iscaKey ? ISCAS[iscaKey].nome       : '_Nenhuma_';

    const chanceFalha   = calcularChanceFalha(varaKey, iscaKey);
    const bonusRaridade = calcularBonusRaridade(varaKey, iscaKey);
    const chanceAcerto  = 100 - chanceFalha;

    // Cooldown restante
    const agora       = Date.now();
    const ultimaPesca = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const msRestante  = Math.max(0, CONFIG_PESCA.COOLDOWN_MS - (agora - ultimaPesca));
    const cooldownStr = msRestante > 0 ? `⏳ *${formatarTempo(msRestante)}* restantes` : `✅ *Pronto para pescar!*`;

    // Distribuição aproximada de raridades com o bônus atual
    const mult = {
      comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
      incomum:  1 + bonusRaridade * 0.01,
      raro:     1 + bonusRaridade * 0.03,
      epico:    1 + bonusRaridade * 0.05,
      lendario: 1 + bonusRaridade * 0.08,
    };

    // Pesos base por raridade (aproximados do catálogo)
    const pesoBase = { comum: 47, incomum: 20, raro: 9, epico: 3.5, lendario: 1 };
    const pesoAdj  = Object.fromEntries(
      Object.entries(pesoBase).map(([r, p]) => [r, p * (mult[r] ?? 1)])
    );
    const totalPeso = Object.values(pesoAdj).reduce((a, b) => a + b, 0);
    const chances   = Object.fromEntries(
      Object.entries(pesoAdj).map(([r, p]) => [r, ((p / totalPeso) * 100).toFixed(1)])
    );

    const texto =
      `🎣 *STATS DE PESCA* _(neste grupo)_\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*EQUIPAMENTO ATIVO:*\n` +
      `  🪝 Vara: *${varaNome}*\n` +
      `  🪱 Isca: *${iscaNome}*\n\n` +
      `*COOLDOWN:*\n` +
      `  ${cooldownStr}\n\n` +
      `*CHANCES (se pescar agora):*\n` +
      `  ✅ Acerto: *${chanceAcerto}%* | ❌ Falha: *${chanceFalha}%*\n\n` +
      `*DISTRIBUIÇÃO DE RARIDADE:*\n` +
      `  ⚪ Comum:    *${chances.comum}%*\n` +
      `  🟢 Incomum:  *${chances.incomum}%*\n` +
      `  🔵 Raro:     *${chances.raro}%*\n` +
      `  🟣 Épico:    *${chances.epico}%*\n` +
      `  🟡 Lendário: *${chances.lendario}%*\n\n` +
      `  📈 Bônus raridade total: *+${bonusRaridade}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📦 *!inventariopesca* · 🎣 *!pescar*`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleStatsPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar stats!');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handlePescar,
  handleVaras,
  handleIscas,
  handleInventarioPesca,
  handleVenderPesca,
  handleRankingPesca,
  handleStatsPesca,

  // Catálogos (usados pelo marketplace.js)
  VARAS_PESCA,
  ISCAS,
  CATALOGO_PESCA,
  PEIXES_E_ITENS,
};