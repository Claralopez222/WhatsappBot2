'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const { ARMAS, ARMADURAS, getClasse, getElemento } = require('../utils/medievalUtils');
const { getModoAtivo, getOuCriarPersonagem, somenteGrupo } = require('./medieval');

// ═══════════════════════════════════════════════════════════════
// ─── !lojamedieval ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleLojaMedieval(sock, msg, jid, senderJid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }

  const carteira = await CarteiraGrupo.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean();
  const gold     = carteira?.gold || 0;

  const armasTexto = ARMAS.map(a =>
    `${a.emoji} *${a.nome}* — 🪙 ${a.preco} gold\n   ⚔️ +${a.bonusAtaque} ataque${a.bonusMana ? ` | 💧 +${a.bonusMana} mana` : ''} _(${a.raridade})_`
  ).join('\n');

  const armadurasTexto = ARMADURAS.map(a =>
    `${a.emoji} *${a.nome}* — 🪙 ${a.preco} gold\n   🛡️ +${a.bonusDefesa} defesa${a.bonusMana ? ` | 💧 +${a.bonusMana} mana` : ''} _(${a.raridade})_`
  ).join('\n');

  await sock.sendMessage(jid, {
    text:
      `🏪 *LOJA MEDIEVAL* 🏪\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🪙 Seu saldo: *${gold} gold*\n\n` +
      `⚔️ *ARMAS:*\n${armasTexto}\n\n` +
      `🛡️ *ARMADURAS:*\n${armadurasTexto}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📦 Use *!comprar [nome do item]* para comprar\n` +
      `🎽 Use *!equipar [nome do item]* para equipar`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !comprar ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleComprarMedieval(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const nomeItem = args.trim();
  if (!nomeItem) {
    return sock.sendMessage(jid, { text: '🏪 Diga o nome do item!\nExemplo: *!comprar Espada*' }, { quoted: msg });
  }

  const arma     = ARMAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const armadura = ARMADURAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const item     = arma || armadura;

  if (!item) {
    return sock.sendMessage(jid, {
      text: `❌ Item *"${nomeItem}"* não encontrado na loja!\nUse *!lojamedieval* para ver os itens disponíveis.`,
    }, { quoted: msg });
  }

  const carteira = await CarteiraGrupo.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean();
  const gold     = carteira?.gold || 0;

  if (gold < item.preco) {
    return sock.sendMessage(jid, {
      text: `❌ Gold insuficiente!\n🪙 Você tem: *${gold}* | Necessário: *${item.preco}*`,
    }, { quoted: msg });
  }

  await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
  const chave = `inventarioMedieval.${item.nome.replace(/ /g, '_')}`;

  await CarteiraGrupo.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $inc: { gold: -item.preco } }
  );
  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $inc: { [chave]: 1 } }
  );

  await sock.sendMessage(jid, {
    text:
      `✅ *COMPRA REALIZADA!*\n\n` +
      `${item.emoji} *${item.nome}* adquirido!\n` +
      `🪙 Gasto: *${item.preco} gold*\n` +
      `🪙 Saldo restante: *${gold - item.preco} gold*\n\n` +
      `_Use *!equipar ${item.nome}* para equipar!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !equipar ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEquipar(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const nomeItem = args.trim();
  if (!nomeItem) {
    return sock.sendMessage(jid, { text: '🎽 Diga o nome do item!\nExemplo: *!equipar Espada*' }, { quoted: msg });
  }

  const arma     = ARMAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const armadura = ARMADURAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const item     = arma || armadura;

  if (!item) {
    return sock.sendMessage(jid, { text: `❌ Item *"${nomeItem}"* não encontrado!` }, { quoted: msg });
  }

  const p        = await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
  const chaveInv = item.nome.replace(/ /g, '_');
  const qtdInv   = p.inventarioMedieval?.get(chaveInv) || 0;

  if (qtdInv <= 0) {
    return sock.sendMessage(jid, {
      text: `❌ Você não possui *${item.nome}* no inventário!\nUse *!comprar ${item.nome}* para comprar.`,
    }, { quoted: msg });
  }

  const updateFields = arma
    ? { armaEquipada: item.nome }
    : { armaduraEquipada: item.nome };

  if (arma && item.bonusMana) {
    updateFields.manaMax = p.manaMax + item.bonusMana;
    updateFields.mana    = Math.min(p.mana + item.bonusMana, p.manaMax + item.bonusMana);
  }

  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $set: updateFields }
  );

  await sock.sendMessage(jid, {
    text:
      `✅ *${item.emoji} ${item.nome}* equipado!\n\n` +
      (arma ? `⚔️ Bônus de ataque: +${item.bonusAtaque}` : `🛡️ Bônus de defesa: +${item.bonusDefesa}`) +
      (item.bonusMana ? `\n💧 Bônus de mana: +${item.bonusMana}` : '') +
      `\n\n_Use *!ficha* para ver seus status!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !rankmedieval ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRankMedieval(sock, msg, jid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }

  const personagens = await MedievalPersonagem.find({ idGrupo: jid })
    .sort({ vitorias: -1, nivel: -1 })
    .limit(10)
    .lean();

  if (!personagens.length) {
    return sock.sendMessage(jid, {
      text: '⚔️ Nenhum guerreiro registrado ainda!\nUse *!ficha* para criar seu personagem.',
    }, { quoted: msg });
  }

  const MEDALHAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const linhas   = personagens.map((p, i) => {
    const classe   = getClasse(p.classe);
    const elemento = getElemento(p.elemento);
    return `${MEDALHAS[i]} *${p.nome}*\n   ${classe?.emoji || '⚔️'} ${p.classe} | ${elemento?.emoji || '✨'} ${p.elemento}\n   🏆 ${p.vitorias} vitórias | ⭐ Nível ${p.nivel}`;
  }).join('\n\n');

  await sock.sendMessage(jid, {
    text:
      `⚔️ *RANKING DE GUERREIROS MEDIEVAIS* ⚔️\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${linhas}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Conquiste vitórias para subir no ranking!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !menumediev ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMenuMedieval(sock, msg, jid) {
  await sock.sendMessage(jid, {
    text:
      `⚔️🏰 *MENU MEDIEVAL* 🏰⚔️\n\n` +
      `👤 *PERSONAGEM*\n` +
      `▸ *!ficha* — Ver sua ficha de herói\n` +
      `▸ *!recargamana* — Recuperar HP e mana (10min)\n\n` +
      `⚔️ *COMBATE*\n` +
      `▸ *!atacar @alguém* — Atacar com arma (2min)\n` +
      `▸ *!magia @alguém* — Habilidade elemental (5min)\n\n` +
      `🗺️ *AVENTURA*\n` +
      `▸ *!missao* — Embarcar em missão (30min)\n\n` +
      `🏪 *LOJA E ITENS*\n` +
      `▸ *!lojamedieval* — Ver loja de armas e armaduras\n` +
      `▸ *!comprar [item]* — Comprar um item\n` +
      `▸ *!equipar [item]* — Equipar um item\n\n` +
      `📊 *RANKING*\n` +
      `▸ *!rankmedieval* — Ranking de guerreiros\n\n` +
      `⚙️ *ADMIN*\n` +
      `▸ *!medieval on/off* — Ativar/desativar modo\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 *Elementos:* Fogo 💧 Água 🌍 Terra 🌪️ Ar ⚡ Trovão 🌑 Sombra ✨ Luz 🖤 Magia Negra\n` +
      `_Cada elemento tem vantagens e fraquezas!_`,
  }, { quoted: msg });
}

module.exports = {
  handleLojaMedieval,
  handleComprarMedieval,
  handleEquipar,
  handleRankMedieval,
  handleMenuMedieval,
};