const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

const levelEnabledChats = new Set();

async function handleLevelOn(sock, msg, jid, author) {
  const enabled = levelEnabledChats.has(jid);
  const text = enabled
    ? '✅ O sistema de level já está ativado neste chat. Use *!level* para ver seu nível e *!ranklevel* para acompanhar a galera.'
    : '✅ Sistema de level ativado para este chat! Use *!level* para ver seu nível e *!ranklevel* para acompanhar a galera.';
  if (!enabled) levelEnabledChats.add(jid);
  await sock.sendMessage(jid, { text }, { quoted: msg });
}

async function handleLevel(sock, msg, jid, author, msgCount) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const user = await Usuario.findOne({ idWhatsApp: senderJid });
  const xp = user?.xp || 0;
  const level = user?.level || Math.floor(xp / 50) + 1;
  const next = level * 50;
  const progressPercent = next === 0 ? 100 : Math.min(100, Math.floor((xp / next) * 100));
  const bar = '█'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));
  await sock.sendMessage(jid, {
    text: `🏅 *LEVEL DE ${author}*\n\n*Level:* ${level}\n*XP:* ${xp}/${next}\n*Progresso:* [${bar}] ${progressPercent}%\n\n_Envie mais mensagens para subir mais rápido!_`,
  }, { quoted: msg });
}

async function handleRankLevel(sock, msg, jid, contactNames, msgCount) {
  const topUsers = await Usuario.find().sort({ xp: -1 }).limit(10).lean();
  const lines = topUsers.map((user, index) => {
    const nome = user.nome || contactNames[user.idWhatsApp] || user.idWhatsApp.split('@')[0];
    return `${index + 1}. ${nome} — XP: ${user.xp || 0}`;
  });
  const response = '🏆 *Ranking de XP*\n\n' + lines.join('\n');
  await sock.sendMessage(jid, { text: response }, { quoted: msg });
}

module.exports = {
  handleLevelOn,
  handleLevel,
  handleRankLevel,
};
