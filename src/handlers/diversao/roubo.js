'use strict';

/**
 * Sistema de Roubo — Piroquinhas Bot
 * Comandos: !menuroubar, !roubar, !menusec, !equiparroubo, !equiparsec
 *           !meusitensroubo, !meussec, !meiosec, !comprarroubo, !comprarsec
 *
 * Toda a lógica é isolada por grupo via CarteiraGrupo.
 * Gold gerenciado exclusivamente pelo carteiraService.
 */

const path = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const {
  getCarteira,
  alterarGold,
  alterarGoldSeguro,
} = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));
const { incrementMission } = require('./missoes');

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

const COOLDOWN_ROUBO_MS  = 15 * 60 * 1000; // 15 minutos entre tentativas
const COOLDOWN_PRESO_MS  = 2 * 60 * 60 * 1000; // 2 horas preso se falhar
const COOLDOWN_POLICIA_MS = 30 * 60 * 1000; // 30 min pra chamar polícia de novo
const IMUNIDADE_ROUBO_MS  = 2 * 60 * 60 * 1000; // 2h de imunidade após ser roubado
const TAXA_SUCESSO_BASE  = 50;
const TAXA_MIN           = 5;
const TAXA_MAX           = 95;
const ROUBO_MIN_PCT      = 30;
const ROUBO_MAX_PCT      = 100;
const CHANCE_POLICIA     = 40; // % de chance de prender
const DEVOLUCAO_POLICIA  = 50; // % do gold roubado que a vítima recupera

// ─── CATÁLOGO — ITENS DE ATAQUE ───────────────────────────────────────────────

const ITENS_ROUBO = {
  mascara:    { nome: '🎭 Máscara',             preco: 100, bonus: 10 },
  chave:      { nome: '🔧 Chave Inglesa',        preco: 150, bonus: 20 },
  lockpick:   { nome: '🔓 Kit de Arrombamento',  preco: 200, bonus: 30 },
  corda:      { nome: '🪢 Corda Ninja',          preco: 250, bonus: 35 },
  dinamite:   { nome: '💣 Dinamite',             preco: 300, bonus: 40 },
  disfarce:   { nome: '🕵️ Disfarce Premium',     preco: 350, bonus: 45 },
  explorador: { nome: '📡 Detector de Alarmes',  preco: 400, bonus: 50 },
  cavador:    { nome: '⛏️ Picareta de Diamante', preco: 500, bonus: 60 },
};

// ─── CATÁLOGO — ITENS DE DEFESA ───────────────────────────────────────────────

const ITENS_SEGURANCA = {
  cofre:     { nome: '🔐 Cofre Forte',          preco: 150, defesa: 15 },
  alarme:    { nome: '🚨 Sistema de Alarme',     preco: 200, defesa: 25 },
  camera:    { nome: '📹 Câmera de Vigilância',  preco: 250, defesa: 30 },
  cachorro:  { nome: '🐕 Cão de Guarda',         preco: 300, defesa: 35 },
  seguranca: { nome: '👮 Guarda de Segurança',   preco: 400, defesa: 45 },
  bunker:    { nome: '🛡️ Bunker Subterrâneo',   preco: 500, defesa: 55 },
  laser:     { nome: '🔴 Raios Laser',           preco: 600, defesa: 65 },
  militares: { nome: '🪖 Segurança Militar',     preco: 800, defesa: 80 },
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/** JID do remetente da mensagem (funciona em grupo e privado) */
function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

/** JID do grupo (ou privado) onde a mensagem foi enviada */
function getGroupId(msg, jid) {
  // jid já vem do handler principal — é o remoteJid correto
  return jid;
}

/** Lê quantidade de item de um Map do Mongoose ou objeto plain */
function getItemQtd(mapaOuObj, chave) {
  if (!mapaOuObj) return 0;
  if (typeof mapaOuObj.get === 'function') return mapaOuObj.get(chave) ?? 0;
  return mapaOuObj[chave] ?? 0;
}

/** Converte ms em string legível: "4min 32s" */
function formatarTempo(ms) {
  const totalSeg = Math.ceil(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  if (min > 0 && seg > 0) return `${min}min ${seg}s`;
  if (min > 0) return `${min}min`;
  return `${seg}s`;
}

/**
 * Incrementa a quantidade de um item no Map (itensRoubo ou itensSec)
 * usando $inc sobre o campo correto no CarteiraGrupo.
 */
async function incrementarItem(idWhatsApp, idGrupo, campo, itemSlug, delta = 1) {
  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp, idGrupo },
    { $inc: { [`${campo}.${itemSlug}`]: delta } },
    { upsert: true, new: true }
  );
}

// ─── !menuroubar ──────────────────────────────────────────────────────────────

async function handleMenuRoubo(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🎭 ═══ LOJA DE ROUBO ═══ 🎭\n\n`;
  texto += `*EQUIPAMENTOS DISPONÍVEIS:*\n`;

  for (const [key, item] of Object.entries(ITENS_ROUBO)) {
    texto += `  ${item.nome} — *${item.preco}* gold\n`;
    texto += `    └ Bônus de sucesso: *+${item.bonus}%* | chave: \`${key}\`\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMANDOS:*\n`;
  texto += `  ${P}buyroubo <item>     — Comprar item\n`;
  texto += `  ${P}equiparroubo <item> — Equipar item\n`;
  texto += `  ${P}invroubo            — Ver inventário de ataque\n`;
  texto += `  ${P}roubar @pessoa      — Roubar alguém\n\n`;
  texto += `⚠️ *Item equipado é obrigatório para roubar!*\n`;
  texto += `⏱️ *Cooldown:* ${formatarTempo(COOLDOWN_ROUBO_MS)} entre tentativas\n`;
  texto += `🎲 *Taxa base de sucesso:* ${TAXA_SUCESSO_BASE}%`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !menusec ─────────────────────────────────────────────────────────────────

async function handleMenuSec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🔐 ═══ LOJA DE SEGURANÇA ═══ 🔐\n\n`;
  texto += `*EQUIPAMENTOS DE DEFESA:*\n`;

  for (const [key, item] of Object.entries(ITENS_SEGURANCA)) {
    texto += `  ${item.nome} — *${item.preco}* gold\n`;
    texto += `    └ Proteção: *+${item.defesa}%* | chave: \`${key}\`\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMANDOS:*\n`;
  texto += `  ${P}buysec <item>      — Comprar item\n`;
  texto += `  ${P}equiparsec <item>  — Equipar defesa\n`;
  texto += `  ${P}invsec             — Ver inventário de segurança\n\n`;
  texto += `🛡️ *Sem defesa, há ${TAXA_SUCESSO_BASE}% de chance de ser roubado com sucesso!*`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !buyroubo ────────────────────────────────────────────────────────────────

async function handleComprarRoubo(sock, msg, jid, caption) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);

  const match = caption.match(/buyroubo\s+(\S+)/i);
  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!buyroubo <item>*\nExemplo: *!buyroubo dinamite*',
    }, { quoted: msg });
    return;
  }

  const itemSlug = match[1].toLowerCase().trim();
  const itemInfo = ITENS_ROUBO[itemSlug];
  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemSlug}* não encontrado na loja de roubo!\nUse *!menuroubar* para ver os disponíveis.`,
    }, { quoted: msg });
    return;
  }

  // Checagem prévia apenas para dar feedback rápido — o débito real e
  // atômico acontece em alterarGoldSeguro logo abaixo.
  const carteira = await getCarteira(userId, idGrupo);
  const saldo    = carteira.gold ?? 0;
  if (saldo < itemInfo.preco) {
    const faltam = itemInfo.preco - saldo;
    await sock.sendMessage(jid, {
      text:
        `❌ *SALDO INSUFICIENTE!*\n\n` +
        `💵 Preço:      *${itemInfo.preco}* gold\n` +
        `💰 Seu saldo:  *${saldo}* gold\n` +
        `⚠️ Faltam:     *${faltam}* gold`,
    }, { quoted: msg });
    return;
  }

  // Débito atômico: evita saldo negativo em caso de compras simultâneas.
  let debitado;
  try {
    ({ debitado } = await alterarGoldSeguro(userId, idGrupo, -itemInfo.preco, `Compra: ${itemInfo.nome}`));
  } catch (e) {
    console.error('Erro ao debitar gold (buyroubo):', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar a compra. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  if (debitado < itemInfo.preco) {
    // Saldo mudou entre a checagem e o débito (ex.: compra concorrente).
    // Reembolsa o que foi debitado, se algo foi.
    if (debitado > 0) {
      await alterarGold(userId, idGrupo, debitado, `Reembolso: ${itemInfo.nome}`).catch((e) =>
        console.error('Falha ao reembolsar débito parcial (buyroubo):', e.message)
      );
    }
    await sock.sendMessage(jid, {
      text: '❌ *SALDO INSUFICIENTE!*\n\nSeu saldo mudou antes da compra ser concluída. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  try {
    await incrementarItem(userId, idGrupo, 'itensRoubo', itemSlug);
  } catch (e) {
    console.error('Erro ao registrar item de roubo, reembolsando:', e.message);
    try {
      await alterarGold(userId, idGrupo, itemInfo.preco, `Reembolso: ${itemInfo.nome}`);
      await sock.sendMessage(jid, {
        text: '⚠️ Erro ao registrar o item. Seu gold foi reembolsado.',
      }, { quoted: msg });
    } catch (refundErr) {
      console.error('FALHA CRÍTICA: reembolso também falhou (buyroubo):', refundErr.message);
      await sock.sendMessage(jid, {
        text: '⚠️ Erro ao registrar o item e ao reembolsar o gold. Contate um administrador.',
      }, { quoted: msg });
    }
    return;
  }

  const carteiraFinal = await getCarteira(userId, idGrupo);

  await sock.sendMessage(jid, {
    text:
      `✅ *COMPRA REALIZADA!*\n\n` +
      `🎭 *Item:* ${itemInfo.nome}\n` +
      `💵 *Preço:* ${itemInfo.preco} gold\n` +
      `📈 *Bônus:* +${itemInfo.bonus}% de sucesso\n` +
      `💎 *Saldo restante:* ${carteiraFinal.gold} gold\n\n` +
      `💡 Use *!equiparroubo ${itemSlug}* para equipar!`,
  }, { quoted: msg });
}

// ─── !buysec ──────────────────────────────────────────────────────────────────

async function handleComprarSec(sock, msg, jid, caption) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);

  const match = caption.match(/buysec\s+(\S+)/i);
  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!buysec <item>*\nExemplo: *!buysec cofre*',
    }, { quoted: msg });
    return;
  }

  const itemSlug = match[1].toLowerCase().trim();
  const itemInfo = ITENS_SEGURANCA[itemSlug];
  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemSlug}* não encontrado na loja de segurança!\nUse *!menusec* para ver os disponíveis.`,
    }, { quoted: msg });
    return;
  }

  // Checagem prévia apenas para dar feedback rápido — o débito real e
  // atômico acontece em alterarGoldSeguro logo abaixo.
  const carteira = await getCarteira(userId, idGrupo);
  const saldo    = carteira.gold ?? 0;
  if (saldo < itemInfo.preco) {
    const faltam = itemInfo.preco - saldo;
    await sock.sendMessage(jid, {
      text:
        `❌ *SALDO INSUFICIENTE!*\n\n` +
        `💵 Preço:      *${itemInfo.preco}* gold\n` +
        `💰 Seu saldo:  *${saldo}* gold\n` +
        `⚠️ Faltam:     *${faltam}* gold`,
    }, { quoted: msg });
    return;
  }

  // Débito atômico: evita saldo negativo em caso de compras simultâneas.
  let debitado;
  try {
    ({ debitado } = await alterarGoldSeguro(userId, idGrupo, -itemInfo.preco, `Compra: ${itemInfo.nome}`));
  } catch (e) {
    console.error('Erro ao debitar gold (buysec):', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar a compra. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  if (debitado < itemInfo.preco) {
    // Saldo mudou entre a checagem e o débito (ex.: compra concorrente).
    if (debitado > 0) {
      await alterarGold(userId, idGrupo, debitado, `Reembolso: ${itemInfo.nome}`).catch((e) =>
        console.error('Falha ao reembolsar débito parcial (buysec):', e.message)
      );
    }
    await sock.sendMessage(jid, {
      text: '❌ *SALDO INSUFICIENTE!*\n\nSeu saldo mudou antes da compra ser concluída. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  try {
    await incrementarItem(userId, idGrupo, 'itensSec', itemSlug);
  } catch (e) {
    console.error('Erro ao registrar item de segurança, reembolsando:', e.message);
    try {
      await alterarGold(userId, idGrupo, itemInfo.preco, `Reembolso: ${itemInfo.nome}`);
      await sock.sendMessage(jid, {
        text: '⚠️ Erro ao registrar o item. Seu gold foi reembolsado.',
      }, { quoted: msg });
    } catch (refundErr) {
      console.error('FALHA CRÍTICA: reembolso também falhou (buysec):', refundErr.message);
      await sock.sendMessage(jid, {
        text: '⚠️ Erro ao registrar o item e ao reembolsar o gold. Contate um administrador.',
      }, { quoted: msg });
    }
    return;
  }

  const carteiraFinal = await getCarteira(userId, idGrupo);

  await sock.sendMessage(jid, {
    text:
      `✅ *COMPRA REALIZADA!*\n\n` +
      `🔐 *Item:* ${itemInfo.nome}\n` +
      `💵 *Preço:* ${itemInfo.preco} gold\n` +
      `🛡️ *Proteção:* +${itemInfo.defesa}%\n` +
      `💎 *Saldo restante:* ${carteiraFinal.gold} gold\n\n` +
      `💡 Use *!equiparsec ${itemSlug}* para ativar!`,
  }, { quoted: msg });
}

// ─── !equiparroubo ─────────────────────────────────────────────────────────────
async function handleEquiparRoubo(sock, msg, jid, caption) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);
  const match   = caption.match(/equiparroubo\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!equiparroubo <item>*\nExemplo: *!equiparroubo dinamite*',
    }, { quoted: msg });
    return;
  }

  const itemSlug = match[1].toLowerCase().trim();
  const itemInfo = ITENS_ROUBO[itemSlug];

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemSlug}* não existe!\nUse *!menuroubar* para ver os disponíveis.`,
    }, { quoted: msg });
    return;
  }

  const carteira = await getCarteira(userId, idGrupo);
  const qtd      = getItemQtd(carteira.itensRoubo, itemSlug);

  if (qtd <= 0) {
    await sock.sendMessage(jid, {
      text:
        `❌ Você não possui *${itemInfo.nome}* neste grupo!\n\n` +
        `🛒 Compre com *!buyroubo ${itemSlug}*`,
    }, { quoted: msg });
    return;
  }

  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo },
    { $set: { equiparoubo: itemSlug } }
  );

  const taxaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + itemInfo.bonus);

  await sock.sendMessage(jid, {
    text:
      `✅ *ITEM EQUIPADO!* ✅\n\n` +
      `🎭 *Item:* ${itemInfo.nome}\n` +
      `📈 *Bônus de sucesso:* +${itemInfo.bonus}%\n` +
      `🎲 *Taxa com este item:* até *${taxaFinal}%*\n` +
      `🎒 *No inventário:* ${qtd}x\n\n` +
      `🔫 Agora use *!roubar @pessoa* para atacar!`,
  }, { quoted: msg });
}

// ─── !equiparsec ──────────────────────────────────────────────────────────────

async function handleEquiparSec(sock, msg, jid, caption) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);
  const match   = caption.match(/equiparsec\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!equiparsec <item>*\nExemplo: *!equiparsec cofre*',
    }, { quoted: msg });
    return;
  }

  const itemSlug = match[1].toLowerCase().trim();
  const itemInfo = ITENS_SEGURANCA[itemSlug];

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemSlug}* não existe!\nUse *!menusec* para ver os disponíveis.`,
    }, { quoted: msg });
    return;
  }

  const carteira = await getCarteira(userId, idGrupo);
  const qtd      = getItemQtd(carteira.itensSec, itemSlug);

  if (qtd <= 0) {
    await sock.sendMessage(jid, {
      text:
        `❌ Você não possui *${itemInfo.nome}* neste grupo!\n\n` +
        `🛒 Compre com *!buysec ${itemSlug}*`,
    }, { quoted: msg });
    return;
  }

  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo },
    { $set: { equiparsec: itemSlug } }
  );

  const defesaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + itemInfo.defesa);

  await sock.sendMessage(jid, {
    text:
      `✅ *DEFESA ATIVADA!* ✅\n\n` +
      `🔐 *Item:* ${itemInfo.nome}\n` +
      `🛡️ *Proteção:* +${itemInfo.defesa}%\n` +
      `🔒 *Chance de resistir:* até *${defesaFinal}%*\n` +
      `🎒 *No inventário:* ${qtd}x`,
  }, { quoted: msg });
}

// ─── !invroubo ────────────────────────────────────────────────────────────────

async function handleInvRoubo(sock, msg, jid) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);

  const carteira = await getCarteira(userId, idGrupo);

  let texto   = `🎒 ═══ SEUS ITENS DE ROUBO ═══ 🎒\n\n`;
  let temItem = false;

  for (const [key, item] of Object.entries(ITENS_ROUBO)) {
    const qtd = getItemQtd(carteira.itensRoubo, key);
    if (qtd > 0) {
      temItem = true;
      const equipado = carteira.equiparoubo === key;
      const tag = equipado ? ' ⚡ *EQUIPADO*' : '';
      texto += `  ${item.nome}${tag}\n`;
      texto += `    └ Qtd: *${qtd}x* | Bônus: *+${item.bonus}%*\n`;
    }
  }

  if (!temItem) {
    texto += `😔 Você não possui nenhum item de roubo neste grupo.\n\n`;
    texto += `🛒 Compre itens com *!menuroubar*!`;
  } else {
    texto += `\n━━━━━━━━━━━━━━━━\n`;

    const eqKey = carteira.equiparoubo;
    const eq    = eqKey && ITENS_ROUBO[eqKey];

    if (eq) {
      const taxaAtual = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + eq.bonus);
      texto += `⚡ *Equipado:* ${eq.nome}\n`;
      texto += `📈 *Bônus ativo:* +${eq.bonus}% de sucesso\n`;
      texto += `🎲 *Taxa atual:* até ${taxaAtual}%`;
    } else {
      texto += `⚠️ *Nenhum item equipado!*\n`;
      texto += `Use *!equiparroubo <item>* para equipar.`;
    }
  }

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !invsec ──────────────────────────────────────────────────────────────────

async function handleInvSec(sock, msg, jid) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);

  const carteira = await getCarteira(userId, idGrupo);

  let texto   = `🔐 ═══ SEUS ITENS DE SEGURANÇA ═══ 🔐\n\n`;
  let temItem = false;

  for (const [key, item] of Object.entries(ITENS_SEGURANCA)) {
    const qtd = getItemQtd(carteira.itensSec, key);
    if (qtd > 0) {
      temItem = true;
      const ativo = carteira.equiparsec === key;
      const tag = ativo ? ' ⚡ *ATIVO*' : '';
      texto += `  ${item.nome}${tag}\n`;
      texto += `    └ Qtd: *${qtd}x* | Defesa: *+${item.defesa}%*\n`;
    }
  }

  if (!temItem) {
    texto += `😔 Você não possui nenhum item de segurança neste grupo.\n\n`;
    texto += `🛒 Compre itens com *!menusec*!`;
  } else {
    texto += `\n━━━━━━━━━━━━━━━━\n`;

    const eqKey = carteira.equiparsec;
    const eq    = eqKey && ITENS_SEGURANCA[eqKey];

    if (eq) {
      const chanceResistir = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + eq.defesa);
      texto += `⚡ *Ativo:* ${eq.nome}\n`;
      texto += `🛡️ *Defesa ativa:* +${eq.defesa}% de proteção\n`;
      texto += `🔒 *Chance de resistir:* até ${chanceResistir}%`;
    } else {
      texto += `⚠️ *Nenhuma defesa ativa!*\n`;
      texto += `Use *!equiparsec <item>* para ativar.`;
    }
  }

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !meiosec ─────────────────────────────────────────────────────────────────

async function handleMeioSec(sock, msg, jid) {
  const userId  = getUserId(msg);
  const idGrupo = getGroupId(msg, jid);

  const carteira = await getCarteira(userId, idGrupo);

  let texto = `🛡️ ═══ SUAS DEFESAS ATIVAS ═══ 🛡️\n\n`;

  const eq = carteira.equiparsec && ITENS_SEGURANCA[carteira.equiparsec];
  if (eq) {
    const defesaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + eq.defesa);
    texto += `✅ *Defesa equipada:* ${eq.nome}\n`;
    texto += `🔒 *Proteção:* +${eq.defesa}%\n\n`;
    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `📊 *Como funciona:*\n`;
    texto += `  Base de defesa: *${TAXA_SUCESSO_BASE}%*\n`;
    texto += `  Bônus do item: *+${eq.defesa}%*\n`;
    texto += `  🛡️ Total: *${defesaFinal}%* de chance de resistir\n\n`;
    texto += `🔄 Troque com *!equiparsec <item>*`;
  } else {
    texto += `❌ *Nenhuma defesa ativa!*\n\n`;
    texto += `⚠️ Sem defesa você tem apenas *${TAXA_SUCESSO_BASE}%* de chance de resistir!\n`;
    texto += `🛒 Compre com *!menusec* e equipe com *!equiparsec <item>*`;
  }

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !roubar @pessoa ──────────────────────────────────────────────────────────

async function handleRoubar(sock, msg, jid) {
  const atacanteId = getUserId(msg);
  const vitimaId   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const idGrupo    = getGroupId(msg, jid);

  // ── Validações básicas ───────────────────────────────────────────────────────
  if (!vitimaId) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!roubar @pessoa*\nMencione quem você quer roubar!',
    }, { quoted: msg });
    return;
  }

  if (atacanteId === vitimaId) {
    await sock.sendMessage(jid, { text: '❌ Você não pode se roubar!' }, { quoted: msg });
    return;
  }

  // ── Buscar carteiras em paralelo ─────────────────────────────────────────────
  const [carteiraAtacante, carteiraVitima] = await Promise.all([
    getCarteira(atacanteId, idGrupo),
    getCarteira(vitimaId,   idGrupo),
  ]);

  // ── Item equipado obrigatório ────────────────────────────────────────────────
  const itemSlugAtaque = carteiraAtacante.equiparoubo;
  const itemAtaque     = itemSlugAtaque && ITENS_ROUBO[itemSlugAtaque];

  if (!itemAtaque) {
    await sock.sendMessage(jid, {
      text:
        `❌ *Você precisa equipar um item de roubo antes!*\n\n` +
        `🛒 Compre com *!menuroubar*\n` +
        `⚡ Equipe com *!equiparroubo <item>*`,
    }, { quoted: msg });
    return;
  }

  // ── Cooldown / Preso ──────────────────────────────────────────────────────────
  const agora = Date.now();

  // Verifica se está preso
  const prestoAte = carteiraAtacante.prestoAte
    ? new Date(carteiraAtacante.prestoAte).getTime()
    : 0;
  if (agora < prestoAte) {
    const restante = prestoAte - agora;
    await sock.sendMessage(jid, {
      text: `🚔 *VOCÊ ESTÁ PRESO!*\n\nAguarde *${formatarTempo(restante)}* para sair da prisão.`,
    }, { quoted: msg });
    return;
  }

  // Verifica cooldown normal entre tentativas
  const ultimoRoubo  = carteiraAtacante.ultimoRoubo
    ? new Date(carteiraAtacante.ultimoRoubo).getTime()
    : 0;
  const tempoPassado = agora - ultimoRoubo;

  if (tempoPassado < COOLDOWN_ROUBO_MS) {
    const restante = COOLDOWN_ROUBO_MS - tempoPassado;
    await sock.sendMessage(jid, {
      text: `⏱️ *COOLDOWN ATIVO!*\n\nAguarde *${formatarTempo(restante)}* para tentar novamente.`,
    }, { quoted: msg });
    return;
  }

  // ── Verificar saldo da vítima ────────────────────────────────────────────────
  const saldoVitima = carteiraVitima.gold ?? 0;
  if (saldoVitima <= 0) {
    await sock.sendMessage(jid, {
      text: '❌ A vítima não tem gold para roubar neste grupo!',
    }, { quoted: msg });
    return;
  }

  // ── Registrar cooldown ANTES da tentativa ────────────────────────────────────
  // (o cooldown consome mesmo se o roubo falhar — custo da tentativa)
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: atacanteId, idGrupo },
    { $set: { ultimoRoubo: new Date() } }
  );

  // ── Calcular taxa de sucesso ─────────────────────────────────────────────────
  let taxaSucesso = TAXA_SUCESSO_BASE + itemAtaque.bonus;

  const itemDefesaSlug = carteiraVitima.equiparsec;
  const itemDefesa     = itemDefesaSlug && ITENS_SEGURANCA[itemDefesaSlug];
  if (itemDefesa) {
    taxaSucesso -= itemDefesa.defesa;
  }

  taxaSucesso = Math.max(TAXA_MIN, Math.min(TAXA_MAX, taxaSucesso));

  const rolagem = Math.random() * 100;
  const sucesso = rolagem < taxaSucesso;

  // ── Montar resposta ──────────────────────────────────────────────────────────
  let textoResposta =
    `🎭 ═══ TENTATIVA DE ROUBO! ═══ 🎭\n\n` +
    `🔫 *Arma:* ${itemAtaque.nome}\n`;

  if (itemDefesa) {
    textoResposta += `🛡️ *Defesa da vítima:* ${itemDefesa.nome}\n`;
  }

  textoResposta +=
    `🎲 *Rolagem:* ${rolagem.toFixed(1)} / ${taxaSucesso}% necessário\n` +
    `━━━━━━━━━━━━━━━━\n`;

  if (sucesso) {
    // ── Roubo bem-sucedido ──────────────────────────────────────────────────
    const pct          = Math.floor(Math.random() * (ROUBO_MAX_PCT - ROUBO_MIN_PCT + 1)) + ROUBO_MIN_PCT;
    const ouroRoubado  = Math.max(1, Math.floor(saldoVitima * pct / 100));

    // alterarGoldSeguro: debita o que houver — sem lançar erro se a vítima
    // foi parcialmente roubada por outra tentativa simultânea
    const { debitado } = await alterarGoldSeguro(
      vitimaId, idGrupo, -ouroRoubado, `Roubado por ${atacanteId}`
    );

    if (debitado === 0) {
      // Vítima ficou sem gold entre a verificação e o débito
      textoResposta +=
        `😅 *AZAR!*\n\n` +
        `A vítima ficou sem gold no último segundo!\n` +
        `⏱️ *Próxima tentativa em:* ${formatarTempo(COOLDOWN_ROUBO_MS)}`;
      await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
      return;
    }

    // Creditar atacante apenas pelo valor efetivamente debitado
    const carteiraAtualizada = await alterarGold(
      atacanteId, idGrupo, debitado, `Roubou de ${vitimaId}`
    );

    // Progresso de missão
    await incrementMission(atacanteId, 'roubo3', 1).catch(() => {});

    // Imunidade e registro do ladrão na carteira da vítima
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: vitimaId, idGrupo },
      {
        $set: {
          imunidadeRouboAte: new Date(agora + IMUNIDADE_ROUBO_MS),
          lastRobbedBy:      atacanteId,
          lastRobbedAmount:  debitado,
          lastRobbedAt:      new Date(),
        },
      }
    );

    textoResposta +=
      `✅ *ROUBO BEM-SUCEDIDO!*\n\n` +
      `💰 *Ouro roubado:* ${debitado} gold (${pct}% do saldo)\n` +
      `👤 *Seu novo saldo:* ${carteiraAtualizada.gold} gold\n` +
      `😢 *Saldo da vítima:* ${saldoVitima - debitado} gold\n` +
      `💡 A vítima pode usar *!policia @você* nas próximas 2h!`;
  } else {
    // ── Roubo fracassado — vai preso ────────────────────────────────────────
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: atacanteId, idGrupo },
      { $set: { prestoAte: new Date(agora + COOLDOWN_PRESO_MS) } }
    );

    textoResposta +=
      `❌ *ROUBO FRACASSADO!*\n\n` +
      `🚔 A polícia chegou e te prendeu!\n` +
      `😌 *Saldo da vítima:* ${saldoVitima} gold (intacto)\n` +
      `🔒 *Você ficará preso por:* ${formatarTempo(COOLDOWN_PRESO_MS)}`;
  }

  await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
}

// ─── !policia @ladrão ─────────────────────────────────────────────────────────

async function handlePolicia(sock, msg, jid) {
  const vitimaId   = getUserId(msg);
  const ladrao     = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  const idGrupo    = getGroupId(msg, jid);
  const agora      = Date.now();

  if (!ladrao) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!policia @ladrão*\nMencione quem te roubou!',
    }, { quoted: msg });
    return;
  }

  if (vitimaId === ladrao) {
    await sock.sendMessage(jid, { text: '❌ Você não pode chamar a polícia em si mesmo!' }, { quoted: msg });
    return;
  }

  const [carteiraVitima, carteiraLadrao] = await Promise.all([
    getCarteira(vitimaId, idGrupo),
    getCarteira(ladrao,   idGrupo),
  ]);

  // Verifica se foi roubada nas últimas 2h por este ladrão
  const lastRobbedBy  = carteiraVitima.lastRobbedBy;
  const lastRobbedAt  = carteiraVitima.lastRobbedAt
    ? new Date(carteiraVitima.lastRobbedAt).getTime()
    : 0;
  const imunidadeAte  = carteiraVitima.imunidadeRouboAte
    ? new Date(carteiraVitima.imunidadeRouboAte).getTime()
    : 0;

  if (lastRobbedBy !== ladrao || agora > imunidadeAte) {
    await sock.sendMessage(jid, {
      text:
        `❌ *NÃO É POSSÍVEL CHAMAR A POLÍCIA!*\n\n` +
        `Você só pode acionar a polícia contra quem te roubou nas últimas 2 horas.`,
    }, { quoted: msg });
    return;
  }

  // Cooldown de 30min pra não spammar polícia
  const ultimaPolicia = carteiraVitima.ultimaPolicia
    ? new Date(carteiraVitima.ultimaPolicia).getTime()
    : 0;
  if (agora - ultimaPolicia < COOLDOWN_POLICIA_MS) {
    const restante = COOLDOWN_POLICIA_MS - (agora - ultimaPolicia);
    await sock.sendMessage(jid, {
      text: `⏱️ Aguarde *${formatarTempo(restante)}* para acionar a polícia novamente.`,
    }, { quoted: msg });
    return;
  }

  // Registrar chamada da polícia
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: vitimaId, idGrupo },
    { $set: { ultimaPolicia: new Date() } }
  );

  const rolagem = Math.random() * 100;
  const prendeu = rolagem < CHANCE_POLICIA;

  const numeroLadrao = ladrao.split('@')[0].replace(/\D/g, '');

  let texto =
    `👮 ═══ ACIONANDO A POLÍCIA! ═══ 👮\n\n` +
    `🎲 *Rolagem:* ${rolagem.toFixed(1)} / ${CHANCE_POLICIA}% necessário\n` +
    `━━━━━━━━━━━━━━━━\n`;

  if (prendeu) {
    // Prender o ladrão por 2h adicionais
    const novoPrestoAte = Math.max(
      agora,
      carteiraLadrao.prestoAte ? new Date(carteiraLadrao.prestoAte).getTime() : 0
    ) + COOLDOWN_PRESO_MS;

    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: ladrao, idGrupo },
      { $set: { prestoAte: new Date(novoPrestoAte) } }
    );

    // Devolver parte do gold roubado
    const valorRoubado  = carteiraVitima.lastRobbedAmount ?? 0;
    const valorDevolver = Math.floor(valorRoubado * DEVOLUCAO_POLICIA / 100);

    if (valorDevolver > 0) {
      const saldoLadrao = carteiraLadrao.gold ?? 0;
      const debitavel   = Math.min(valorDevolver, saldoLadrao);

      if (debitavel > 0) {
        await Promise.all([
          alterarGold(ladrao,   idGrupo, -debitavel, `Apreensão policial para ${vitimaId}`),
          alterarGold(vitimaId, idGrupo,  debitavel, `Recuperado pela polícia de ${ladrao}`),
        ]);

        texto +=
          `✅ *LADRÃO PRESO!*\n\n` +
          `🚔 @${numeroLadrao} foi capturado!\n` +
          `🔒 *Ficará preso por mais:* ${formatarTempo(COOLDOWN_PRESO_MS)}\n` +
          `💰 *Gold recuperado:* ${debitavel} gold (${DEVOLUCAO_POLICIA}% do roubado)`;
      } else {
        texto +=
          `✅ *LADRÃO PRESO!*\n\n` +
          `🚔 @${numeroLadrao} foi capturado!\n` +
          `🔒 *Ficará preso por mais:* ${formatarTempo(COOLDOWN_PRESO_MS)}\n` +
          `😔 O ladrão não tem gold para devolver.`;
      }
    } else {
      texto +=
        `✅ *LADRÃO PRESO!*\n\n` +
        `🚔 @${numeroLadrao} foi capturado!\n` +
        `🔒 *Ficará preso por mais:* ${formatarTempo(COOLDOWN_PRESO_MS)}`;
    }
  } else {
    texto +=
      `❌ *LADRÃO ESCAPOU!*\n\n` +
      `🏃 @${numeroLadrao} conseguiu fugir da polícia!\n` +
      `😔 Nenhum gold foi recuperado.`;
  }

  await sock.sendMessage(jid, { text: texto, mentions: [ladrao] }, { quoted: msg });
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  ITENS_ROUBO,
  ITENS_SEGURANCA,
  handleMenuRoubo,
  handleMenuSec,
  handleComprarRoubo,
  handleComprarSec,
  handleEquiparRoubo,
  handleEquiparSec,
  handleInvRoubo,
  handleInvSec,
  handleMeioSec,
  handleRoubar,
};