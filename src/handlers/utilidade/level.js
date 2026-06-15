'use strict';

const Usuario = require('../../models/Usuario');

/**
 * !level — Mostra o nível e XP atual do próprio usuário
 */
async function handleLevel(sock, msg, jid, author) {
  const rawSender = msg.key.participant || msg.key.remoteJid;
  if (!rawSender) return;

  const numero = rawSender.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!numero) return; // JID inválido/inesperado — evita @s.whatsapp.net sem número

  const fullJid = `${numero}@s.whatsapp.net`;

  try {
    const user = await Usuario.findOne({ idWhatsApp: fullJid }).lean();

    if (!user) {
      return sock.sendMessage(jid, {
        text: `📊 *NÍVEL DE PROGRESSO*\n\n@${numero}, você ainda não tem XP registrado.\nContinue interagindo para começar a pontuar!`,
        mentions: [fullJid]
      }, { quoted: msg });
    }

    const xp    = Math.max(0, user.xp ?? 0);
    const level = Math.max(1, user.level ?? 1);

    const xpProximo    = Math.floor(100 * Math.pow(level, 1.5));
    const xpAtualLevel = Math.floor(100 * Math.pow(level - 1, 1.5));
    const xpNoLevel    = Math.max(0, xp - xpAtualLevel);
    const xpNecessario = Math.max(1, xpProximo - xpAtualLevel);
    const progresso    = Math.min(100, Math.floor((xpNoLevel / xpNecessario) * 100));
    const barras       = Math.min(10, Math.max(0, Math.floor(progresso / 10)));
    const barraVisual  = '█'.repeat(barras) + '░'.repeat(10 - barras);

    const texto =
      `📊 *SEU STATUS DE NÍVEL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Usuário:* @${numero}\n` +
      `⭐ *Nível:* ${level}\n` +
      `✨ *XP Total:* ${xp.toLocaleString('pt-BR')} XP\n\n` +
      `📈 *Progresso para o nível ${level + 1}:*\n` +
      `[${barraVisual}] ${progresso}%\n` +
      `${xpNoLevel.toLocaleString('pt-BR')} / ${xpNecessario.toLocaleString('pt-BR')} XP\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_💬 Continue ativo para subir de nível!_`;

    return sock.sendMessage(jid, { text: texto, mentions: [fullJid] }, { quoted: msg });

  } catch (err) {
    console.error('[handleLevel] Erro:', err);
    return sock.sendMessage(jid, {
      text: '⚠️ Não foi possível carregar seu nível. Tente novamente mais tarde.'
    }, { quoted: msg });
  }
}

/**
 * !ranklevel — Top 10 usuários com mais XP ativos no grupo
 */
async function handleRankLevel(sock, msg, jid) {
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.'
    }, { quoted: msg });
  }

  try {
    const metadata = await sock.groupMetadata(jid);

    // Normaliza todos os JIDs dos membros para numero@s.whatsapp.net
    const membrosNormalizados = metadata.participants
      .map(p => {
        const num = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
        return num ? `${num}@s.whatsapp.net` : null;
      })
      .filter(Boolean);

    const membrosSet = new Set(membrosNormalizados);

    if (membrosSet.size === 0) {
      return sock.sendMessage(jid, {
        text: '❌ Não foi possível obter os membros deste grupo.'
      }, { quoted: msg });
    }

    // Busca todos os usuários e filtra pelos membros do grupo
    const todosCandidatos = await Usuario
      .find({ xp: { $gt: 0 } })
      .sort({ xp: -1, level: -1 })
      .lean();

    const candidatos = todosCandidatos.filter(u => {
      const num = u.idWhatsApp?.split('@')[0].split(':')[0].replace(/\D/g, '');
      if (!num) return false;
      return membrosSet.has(`${num}@s.whatsapp.net`);
    }).slice(0, 10);

    if (candidatos.length === 0) {
      return sock.sendMessage(jid, {
        text: '❌ Nenhum membro deste grupo possui XP registrado ainda.\n_Interaja no grupo para ganhar XP!_'
      }, { quoted: msg });
    }

    const MEDALS  = ['🥇', '🥈', '🥉'];
    const mentions = [];

    const linhas = candidatos.map((user, i) => {
      const numero  = user.idWhatsApp.split('@')[0].split(':')[0].replace(/\D/g, '');
      const fullJid = `${numero}@s.whatsapp.net`;
      mentions.push(fullJid);

      const prefix = MEDALS[i] ?? `🔹 *${i + 1}.*`;
      const xpRaw  = Math.max(0, user.xp ?? 0);
      const xp     = xpRaw.toLocaleString('pt-BR');
      const level  = Math.max(1, user.level ?? 1);

      const xpProximo    = Math.floor(100 * Math.pow(level, 1.5));
      const xpAnterior   = Math.floor(100 * Math.pow(level - 1, 1.5));
      const xpNoLevel    = Math.max(0, xpRaw - xpAnterior);
      const xpNecessario = Math.max(1, xpProximo - xpAnterior);
      const progresso    = Math.min(100, Math.floor((xpNoLevel / xpNecessario) * 100));
      const barras       = Math.min(5, Math.max(0, Math.floor(progresso / 20)));
      const barraVisual  = '█'.repeat(barras) + '░'.repeat(5 - barras);

      return (
        `${prefix} @${numero}\n` +
        `┣ 🏅 Nível *${level}*  •  ✨ *${xp} XP*\n` +
        `┗ [${barraVisual}] ${progresso}% → nível ${level + 1}`
      );
    });

    const texto =
      `🏆 *RANKING DE XP — TOP ${candidatos.length}* 🏆\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *!level* para ver seu progresso pessoal!_`;

    return sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankLevel] Erro:', err);
    return sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar o ranking. Tente novamente.'
    }, { quoted: msg });
  }
}

module.exports = { handleLevel, handleRankLevel };