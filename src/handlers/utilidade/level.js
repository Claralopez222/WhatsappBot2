'use strict';

// ── IMPORTAÇÕES ───────────────────────────────────────────────
// Certifique-se de que o caminho até a pasta models está correto
const Usuario = require('../../models/Usuario'); 

/**
 * !level — Mostra o nível e XP atual do próprio usuário que chamou o comando
 */
async function handleLevel(sock, msg, jid, author, msgCount) {
  const chatJid = jid;
  
  // Captura quem enviou a mensagem de forma segura
  const rawSender = author || msg.key.participant || msg.key.remoteJid;
  if (!rawSender) return;

  // Limpa o JID para evitar problemas com múltiplos dispositivos (:1@s.whatsapp.net)
  const numero = rawSender.split('@')[0].split(':')[0];
  const fullJid = `${numero}@s.whatsapp.net`;

  try {
    // Busca os dados do usuário no banco de dados
    const user = await Usuario.findOne({ idWhatsApp: fullJid }).lean();

    if (!user) {
      return sock.sendMessage(chatJid, {
        text: `📊 *NÍVEL DE PROGRESSO*\n\nOlá @${numero}! Você ainda não possui registros de XP no nosso sistema. Continue interagindo para começar a pontuar!`,
        mentions: [fullJid]
      }, { quoted: msg });
    }

    const xp = user.xp ?? 0;
    const level = user.level ?? 1;

    const texto = 
      `📊 *SEU STATUS DE NÍVEL* 📊\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Usuário:* @${numero}\n` +
      `⭐ *Nível Atual:* Nível *${level}*\n` +
      `✨ *Total de XP:* *${xp.toLocaleString('pt-BR')}* XP\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `_💬 Continue ativo nos chats para subir de nível!_`;

    return sock.sendMessage(chatJid, { text: texto, mentions: [fullJid] }, { quoted: msg });

  } catch (err) {
    console.error('[handleLevel] Erro ao carregar nível:', err);
    return sock.sendMessage(chatJid, {
      text: '⚠️ Não foi possível carregar seu nível no momento. Tente novamente mais tarde.'
    }, { quoted: msg });
  }
}

/**
 * !ranklevel — Top 10 usuários com mais XP ativos no grupo atual
 */
async function handleRankLevel(sock, msg, jid, contactNames, msgCount) {
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(
      jid,
      { text: '⚠️ Este comando só pode ser usado em grupos.' },
      { quoted: msg }
    );
  }

  try {
    // ── Membros atuais do grupo ───────────────────────────────
    const metadata = await sock.groupMetadata(jid);
    
    // Normaliza os IDs dos participantes para garantir o cruzamento correto com o Banco
    const membrosAtuais = new Set(
      metadata.participants.map(p => p.id.split('@')[0].split(':')[0] + '@s.whatsapp.net')
    );

    if (membrosAtuais.size === 0) {
      return sock.sendMessage(
        jid,
        { text: '❌ Não foi possível obter os membros deste grupo.' },
        { quoted: msg }
      );
    }

    // ── Busca no Banco filtrando apenas membros do grupo ──────
    const candidatos = await Usuario
      .find({ idWhatsApp: { $in: [...membrosAtuais] } })
      .sort({ xp: -1, level: -1 })
      .limit(10)
      .lean();

    if (candidatos.length === 0) {
      return sock.sendMessage(
        jid,
        { text: '❌ Nenhum membro deste grupo possui registro de XP armazenado.' },
        { quoted: msg }
      );
    }

    // ── Montagem do Ranking Visual ────────────────────────────
    const MEDALS = ['🥇', '🥈', '🥉'];
    const mentions = [];
    
    const linhas = candidatos.map((user, i) => {
      const numero = user.idWhatsApp.split('@')[0].split(':')[0];
      const fullJid = `${numero}@s.whatsapp.net`;
      mentions.push(fullJid);

      const prefix = MEDALS[i] ?? `🔹 *${i + 1}.*`;
      const xp = (user.xp ?? 0).toLocaleString('pt-BR');
      const level = user.level ?? 1;

      return `${prefix} @${numero}\n┗━━━ XP: *${xp}* • Nível *${level}*`;
    });

    const texto =
      `🏆 *RANKING DE XP — TOP ${candidatos.length} ATIVOS* 🏆\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *!level* para ver seu progresso pessoal!_`;

    return sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankLevel] Erro ao gerar ranking:', err);
    return sock.sendMessage(
      jid,
      { text: '⚠️ Erro interno ao processar o ranking. Tente novamente.' },
      { quoted: msg }
    );
  }
}

// ── EXPORTAÇÃO DAS FUNÇÕES ────────────────────────────────────
module.exports = { 
  handleLevel, 
  handleRankLevel 
};