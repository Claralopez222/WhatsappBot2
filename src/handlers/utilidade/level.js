'use strict';

/**
 * !ranklevel — Top 10 usuários com mais XP ativos no grupo atual
 */
async function handleRankLevel(sock, msg, jid) {
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(
      jid,
      { text: '⚠️ Este comando só pode ser usado em grupos.' },
      { quoted: msg }
    );
  }

  try {
    // ── Membros atuais do grupo ───────────────────────────────
    const metadata     = await sock.groupMetadata(jid);
    const membrosAtuais = new Set(metadata.participants.map(p => p.id));

    if (membrosAtuais.size === 0) {
      return sock.sendMessage(
        jid,
        { text: '❌ Não foi possível obter os membros do grupo.' },
        { quoted: msg }
      );
    }

    // ── Busca em lote e filtra quem está no grupo ─────────────
    // Busca até 200 para ter margem suficiente mesmo em grupos grandes
    const candidatos = await Usuario
      .find({ idWhatsApp: { $in: [...membrosAtuais] } })
      .sort({ xp: -1, level: -1 })
      .limit(10)
      .lean();

    if (candidatos.length === 0) {
      return sock.sendMessage(
        jid,
        { text: '❌ Nenhum membro do grupo possui registro de XP ainda.' },
        { quoted: msg }
      );
    }

    // ── Montar ranking ────────────────────────────────────────
    const MEDALS  = ['🥇', '🥈', '🥉'];
    const mentions = [];
    const linhas   = candidatos.map((user, i) => {
      const numero  = user.idWhatsApp.split('@')[0].split(':')[0];
      const fullJid = `${numero}@s.whatsapp.net`;
      mentions.push(fullJid);

      const prefix = MEDALS[i] ?? `🔹 *${i + 1}.*`;
      const xp     = (user.xp    ?? 0).toLocaleString('pt-BR');
      const level  = user.level  ?? 1;

      return `${prefix} @${numero} — XP: *${xp}* | Nível *${level}*`;
    });

    const texto =
      `🏆 *RANKING DE XP — TOP ${candidatos.length} ATIVOS* 🏆\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n') +
      `\n\n━━━━━━━━━━━━━━━━\n` +
      `_Use *!perfil* para ver seu progresso completo!_`;

    return sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankLevel] Erro:', err);
    return sock.sendMessage(
      jid,
      { text: '⚠️ Erro ao carregar o ranking. Tente novamente.' },
      { quoted: msg }
    );
  }
}

module.exports = { handleRankLevel };