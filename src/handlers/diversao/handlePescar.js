/**
 * Handler de Pesca — Bot
 * Sistema de pesca com itens, cooldown, raridade e inventário
 *
 * v2.0:
 *  - Economia e inventário isolados por grupo (CarteiraGrupo)
 *  - Gold, cooldown e itensPesca vivem na carteira do grupo
 *  - Usuário global (Usuario) não é mais tocado por este módulo
 *  - Varas e iscas melhoram chance e raridade
 *  - Cooldown configurável por usuário/grupo
 *  - Chance de não pegar nada (falha)
 *  - Raridades: comum, incomum, raro, épico, lendário
 */

'use strict';

const path          = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { getCarteira, alterarGold } = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));
// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG_PESCA = {
  COOLDOWN_MS:       15 * 60 * 1000, // 15 minutos entre pescas
  CHANCE_FALHA_BASE: 30,             // 30% de chance de não pegar nada (sem vara)
  CHANCE_FALHA_MIN:  5,              // nunca abaixo de 5% de falha
};

// ─── VARAS DE PESCA ───────────────────────────────────────────────────────────

const VARAS_PESCA = {
  vara_bambu:    { nome: '🎋 Vara de Bambu',   preco: 80,   bonus_raridade: 0,  reduce_falha: 5  },
  vara_madeira:  { nome: '🪵 Vara de Madeira',  preco: 150,  bonus_raridade: 5,  reduce_falha: 8  },
  vara_fibra:    { nome: '🎣 Vara de Fibra',     preco: 300,  bonus_raridade: 10, reduce_falha: 12 },
  vara_carbono:  { nome: '⚫ Vara de Carbono',   preco: 600,  bonus_raridade: 18, reduce_falha: 18 },
  vara_titanio:  { nome: '🔩 Vara de Titânio',   preco: 1200, bonus_raridade: 28, reduce_falha: 22 },
  vara_lendaria: { nome: '✨ Vara Lendária',     preco: 3000, bonus_raridade: 45, reduce_falha: 25 },
};

// ─── ISCAS ────────────────────────────────────────────────────────────────────

const ISCAS = {
  isca_minhoca:  { nome: '🪱 Minhoca',           preco: 20,  bonus_raridade: 0,  reduce_falha: 2  },
  isca_camarao:  { nome: '🦐 Camarão',           preco: 50,  bonus_raridade: 5,  reduce_falha: 5  },
  isca_mosca:    { nome: '🪰 Mosca Artificial',   preco: 80,  bonus_raridade: 8,  reduce_falha: 7  },
  isca_peixinho: { nome: '🐟 Peixinho Vivo',      preco: 120, bonus_raridade: 12, reduce_falha: 10 },
  isca_lula:     { nome: '🦑 Lula',               preco: 200, bonus_raridade: 18, reduce_falha: 14 },
  isca_magica:   { nome: '🌟 Isca Mágica',        preco: 500, bonus_raridade: 30, reduce_falha: 20 },
};

// ─── CATÁLOGO DE ITENS PESCÁVEIS ──────────────────────────────────────────────

const PEIXES_E_ITENS = {
  // ── Peixes ──────────────────────────────────────────────────────────────
  peixe_pequeno:    { nome: '🐟 Peixe Pequeno',   raridade: 'comum',    peso: 60, gold: 15  },
  peixe_medio:      { nome: '🐠 Peixe Médio',      raridade: 'incomum',  peso: 25, gold: 35  },
  peixe_grande:     { nome: '🐡 Peixe Grande',     raridade: 'raro',     peso: 10, gold: 80  },
  peixe_espada:     { nome: '⚔️ Peixe-Espada',     raridade: 'epico',    peso: 4,  gold: 200 },
  peixe_lendario:   { nome: '🌈 Peixe Arco-Íris',  raridade: 'lendario', peso: 1,  gold: 500 },

  // ── Lixo ────────────────────────────────────────────────────────────────
  bota_velha:       { nome: '👢 Bota Velha',        raridade: 'comum',    peso: 40, gold: 0   },
  lata_enferrujada: { nome: '🥫 Lata Enferrujada',  raridade: 'comum',    peso: 35, gold: 0   },
  alga:             { nome: '🌿 Monte de Algas',     raridade: 'comum',    peso: 30, gold: 2   },

  // ── Tesouros ────────────────────────────────────────────────────────────
  moeda_antiga:     { nome: '🪙 Moeda Antiga',       raridade: 'incomum',  peso: 20, gold: 50  },
  anel_perdido:     { nome: '💍 Anel Perdido',       raridade: 'raro',     peso: 8,  gold: 150 },
  perola:           { nome: '🦪 Pérola Rara',        raridade: 'epico',    peso: 3,  gold: 400 },
  tesouro:          { nome: '💎 Cristal do Fundo',   raridade: 'lendario', peso: 1,  gold: 800 },
};

const ITENS_BONUS_PESCA = {
  mascara:   { nome: '🎭 Máscara',       raridade: 'incomum', peso: 15, gold: 0 },
  corda:     { nome: '🪢 Corda Ninja',   raridade: 'raro',    peso: 6,  gold: 0 },
  chocolate: { nome: '🍫 Chocolate',     raridade: 'comum',   peso: 25, gold: 0 },
  flores:    { nome: '🌹 Flores',        raridade: 'incomum', peso: 15, gold: 0 },
};

const CATALOGO_PESCA = {
  ...PEIXES_E_ITENS,
  ...ITENS_BONUS_PESCA,
};

// ─── RARIDADE ─────────────────────────────────────────────────────────────────

const RARIDADE_LABEL = {
  comum:    '⚪ Comum',
  incomum:  '🟢 Incomum',
  raro:     '🔵 Raro',
  epico:    '🟣 Épico',
  lendario: '🟡 Lendário',
};

const LIXO_KEYS = new Set(['bota_velha', 'lata_enferrujada', 'alga']);

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/**
 * Extrai o JID do usuário (participante em grupo ou remetente direto).
 */
function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

/**
 * Extrai o JID do grupo. Retorna null se for conversa privada.
 */
function getGroupId(msg) {
  const jid = msg?.key?.remoteJid ?? '';
  return jid.endsWith('@g.us') ? jid : null;
}

async function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

/**
 * Lê um item do mapa itensPesca da carteira (compatível com Map ou objeto plano).
 */
function getItemInventario(carteira, itemKey) {
  const mapa = carteira?.itensPesca;
  if (!mapa) return 0;
  return mapa instanceof Map
    ? (mapa.get(itemKey) ?? 0)
    : (mapa[itemKey] ?? 0);
}

/**
 * Sorteia um item do catálogo respeitando bonusRaridade.
 */
function sortearItem(bonusRaridade = 0) {
  const multiplicadores = {
    comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
    incomum:  1 + bonusRaridade * 0.01,
    raro:     1 + bonusRaridade * 0.03,
    epico:    1 + bonusRaridade * 0.05,
    lendario: 1 + bonusRaridade * 0.08,
  };

  const pool = Object.entries(CATALOGO_PESCA).map(([key, item]) => ({
    key,
    ...item,
    pesoAjustado: Math.max(0.5, item.peso * (multiplicadores[item.raridade] ?? 1)),
  }));

  const totalPeso = pool.reduce((acc, i) => acc + i.pesoAjustado, 0);
  let sorteio     = Math.random() * totalPeso;

  for (const item of pool) {
    sorteio -= item.pesoAjustado;
    if (sorteio <= 0) return item;
  }

  return pool[0];
}

function calcularChanceFalha(vara, isca) {
  const r = (VARAS_PESCA[vara]?.reduce_falha ?? 0) + (ISCAS[isca]?.reduce_falha ?? 0);
  return Math.max(CONFIG_PESCA.CHANCE_FALHA_MIN, CONFIG_PESCA.CHANCE_FALHA_BASE - r);
}

function calcularBonusRaridade(vara, isca) {
  return (VARAS_PESCA[vara]?.bonus_raridade ?? 0) + (ISCAS[isca]?.bonus_raridade ?? 0);
}

// ─── HANDLER PRINCIPAL: !pescar ───────────────────────────────────────────────

async function handlePescar(sock, msg, jid) {
  const userId  = getUserId(msg);
  const groupId = getGroupId(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg,
      '🎣 *A pesca só funciona em grupos!*\n\n' +
      'Entre em um grupo e use *!pescar* por lá.'
    );
  }

  try {
    // Carrega (ou cria) a carteira do usuário neste grupo
    const carteira = await getCarteira(userId, groupId);

    // ── Cooldown ──────────────────────────────────────────────────────────
    const agora        = Date.now();
    const ultimaPesca  = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const tempoPassado = agora - ultimaPesca;

    if (tempoPassado < CONFIG_PESCA.COOLDOWN_MS) {
      const min = Math.ceil((CONFIG_PESCA.COOLDOWN_MS - tempoPassado) / 60_000);
      return reply(sock, jid, msg,
        `⏳ *AGUARDE PARA PESCAR!*\n\n` +
        `🎣 Você pescou recentemente neste grupo.\n` +
        `⏰ Próxima pesca em: *${min} minuto(s)*`
      );
    }

    // ── Vara e isca (buscadas no inventário local do grupo) ───────────────
    const varaEquipada = Object.keys(VARAS_PESCA)
      .reverse()
      .find(v => getItemInventario(carteira, v) > 0)
      ?? null;

    const iscaEquipada = Object.keys(ISCAS)
      .reverse()
      .find(i => getItemInventario(carteira, i) > 0)
      ?? null;

    if (!varaEquipada) {
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
    if (iscaEquipada) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: { [`itensPesca.${iscaEquipada}`]: -1 } }
      );
    }

    // ── Sortear resultado ─────────────────────────────────────────────────
    const chanceFalha   = calcularChanceFalha(varaEquipada, iscaEquipada);
    const bonusRaridade = calcularBonusRaridade(varaEquipada, iscaEquipada);
    const falhou        = Math.random() * 100 < chanceFalha;

    const varaNome = VARAS_PESCA[varaEquipada]?.nome ?? varaEquipada;
    const iscaNome = iscaEquipada ? (ISCAS[iscaEquipada]?.nome ?? iscaEquipada) : null;

    const cabecalho =
      `🎣 *PESCARIA!*\n\n` +
      `🪝 Vara: *${varaNome}*\n` +
      (iscaNome ? `🪱 Isca: *${iscaNome}*\n` : `🪱 Isca: _nenhuma_\n`) +
      `━━━━━━━━━━━━━━━━\n`;

    // ── Falha ─────────────────────────────────────────────────────────────
    if (falhou) {
      const mensagensFalha = [
        '🌊 O peixe deu uma mordida e escapou!',
        '💨 Nada por aqui... a água está quieta demais.',
        '😔 Você ficou esperando, mas nada apareceu.',
        '🐟 O peixe olhou para a isca e foi embora.',
        '🌿 Você pescou um monte de algas. Nada útil.',
        '🤣 Um peixinho roubou sua isca e fugiu!',
      ];
      const msgFalha = mensagensFalha[Math.floor(Math.random() * mensagensFalha.length)];

      return reply(sock, jid, msg,
        cabecalho +
        `\n${msgFalha}\n\n` +
        `💡 Tente novamente em *${Math.ceil(CONFIG_PESCA.COOLDOWN_MS / 60_000)} minutos*\n` +
        `📈 Use iscas melhores para reduzir falhas!`
      );
    }

    // ── Sucesso: sortear item ─────────────────────────────────────────────
    const itemPescado = sortearItem(bonusRaridade);
    const rarLabel    = RARIDADE_LABEL[itemPescado.raridade] ?? itemPescado.raridade;
    const ehLixo      = LIXO_KEYS.has(itemPescado.key);

    // ── Persistir: gold via alterarGold (registra no histórico) ──────────
    //    e item no inventário local via $inc direto
    const incPayload = {};

    if (itemPescado.gold > 0) {
      // alterarGold cuida do $inc em gold E adiciona ao goldHistory
      await alterarGold(userId, groupId, itemPescado.gold, `Pesca: ${itemPescado.nome}`);
    }

    if (!ehLixo) {
      incPayload[`itensPesca.${itemPescado.key}`] = 1;
    }

    if (Object.keys(incPayload).length > 0) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: incPayload }
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

    let resultado =
      cabecalho +
      `\n🎉 *VOCÊ PESCOU!*\n\n` +
      `📦 *${itemPescado.nome}*\n` +
      `🏷️ Raridade: *${rarLabel}*\n`;

    if (itemPescado.gold > 0) resultado += `💰 *+${itemPescado.gold} gold* (neste grupo)\n`;
    if (ehLixo)               resultado += `\n🗑️ _Só lixo desta vez..._\n`;
    else                      resultado += `\n📥 _Item adicionado ao inventário do grupo!_\n`;

    const reacao = reacoes[itemPescado.raridade] ?? '';
    if (reacao) resultado += `\n${reacao}\n`;

    resultado +=
      `\n━━━━━━━━━━━━━━━━\n` +
      `⏰ Próxima pesca em *${Math.ceil(CONFIG_PESCA.COOLDOWN_MS / 60_000)} minutos*\n` +
      `📦 Ver inventário: *!inventariopesca*`;

    return reply(sock, jid, msg, resultado);

  } catch (e) {
    console.error('[Pesca] handlePescar:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao pescar! Tente novamente.');
  }
}

// ─── !varas ───────────────────────────────────────────────────────────────────

async function handleVaras(sock, msg, jid) {
  let texto = `🎣 *VARAS DE PESCA*\n\n`;

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
  let texto = `🪱 *ISCAS DE PESCA*\n\n`;

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
  const userId  = getUserId(msg);
  const groupId = getGroupId(msg);

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg,
      '🎣 O inventário de pesca é por grupo!\nUse este comando em um grupo.'
    );
  }

  try {
    // lean() retorna objeto plano; itensPesca vira um objeto simples
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

    const itensPesca = carteira.itensPesca ?? {};
    const chaves     = Object.keys(itensPesca).filter(k => (itensPesca[k] ?? 0) > 0);

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
      for (const k of varas) texto += `   ${VARAS_PESCA[k].nome} × ${itensPesca[k]}\n`;
      texto += '\n';
    }

    if (iscas.length > 0) {
      texto += `🪱 *ISCAS*\n`;
      for (const k of iscas) texto += `   ${ISCAS[k].nome} × ${itensPesca[k]}\n`;
      texto += '\n';
    }

    if (pescados.length > 0) {
      texto += `📦 *ITENS PESCADOS*\n`;
      for (const k of pescados) {
        const nome = CATALOGO_PESCA[k]?.nome ?? k;
        texto += `   ${nome} × ${itensPesca[k]}\n`;
      }
    }

    texto +=
      `\n💰 Gold neste grupo: *${carteira.gold ?? 0}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎣 *!pescar* para pescar novamente!`;

    return reply(sock, jid, msg, texto);

  } catch (e) {
    console.error('[Pesca] handleInventarioPesca:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar inventário de pesca!');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handlePescar,
  handleVaras,
  handleIscas,
  handleInventarioPesca,

  // Catálogos (usados pelo marketplace.js)
  VARAS_PESCA,
  ISCAS,
  CATALOGO_PESCA,
  PEIXES_E_ITENS,
};