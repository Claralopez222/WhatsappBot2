/**
 * Mostra o Top 10 usuários com mais XP ativos no chat atual
 */

// !ranklevel
async function handleRankLevel(sock, msg, jid, contactNames, msgCount) {
  try {
    // 1. Se for em chat privado, não faz sentido filtrar por grupo
    if (!jid?.endsWith('@g.us')) {
      return await sock.sendMessage(jid, { text: '⚠️ Este comando só pode ser usado em grupos.' }, { quoted: msg });
    }

    // 2. Busca os membros atuais do grupo diretamente do WhatsApp
    const metadata = await sock.groupMetadata(jid);
    const membrosAtuais = new Set(metadata.participants.map(p => p.id));

    // 3. Busca uma amostragem maior no banco para garantir o preenchimento do Top 10
    const candidatos = await Usuario.find().sort({ xp: -1 }).limit(100).lean();
    
    // 4. Filtra mantendo apenas quem ainda está presente no grupo
    const topUsers = candidatos
      .filter(user => membrosAtuais.has(user.idWhatsApp))
      .slice(0, 10); // Seleciona apenas os 10 primeiros válidos

    if (topUsers.length === 0) {
      return await sock.sendMessage(jid, { text: '❌ Nenhum membro ativo do grupo possui registro de XP ainda.' }, { quoted: msg });
    }

    const mentionsList = [];
    const lines = topUsers.map((user, index) => {
      const cleanJid = user.idWhatsApp.split(':')[0].split('@')[0];
      
      // Garante o formato correto de JID para a lista de menções do Baileys
      const fullJid = user.idWhatsApp.includes('@') ? user.idWhatsApp : `${cleanJid}@s.whatsapp.net`;
      mentionsList.push(fullJid);

      // Ícones de pódio e formatação de alinhamento visual
      const medals = ['🥇', '🥈', '🥉'];
      const prefix = medals[index] || `🔹 *${index + 1}.*`;

      return `${prefix} @${cleanJid} — XP: *${user.xp || 0}* (Lvl ${user.level || 1})`;
    });

    const response = `🏆 *RANKING DE XP — TOP 10 ATIVOS* 🏆\n\n` + lines.join('\n');

    await sock.sendMessage(jid, { 
      text: response, 
      mentions: mentionsList 
    }, { quoted: msg });

  } catch (err) {
    console.error('[RankLevel] Erro ao carregar ranking:', err);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar o ranking de níveis. Tente novamente.' }, { quoted: msg });
  }
}