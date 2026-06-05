/**
 * Sistema de Missões Diárias — Piroquinhas Bot
 * Comando: !missao
 */

const dailyMissionData = new Map();
const dailyMissionDefinitions = [
  { id: 'xp100', label: 'Ganhe 100 XP', target: 100, reward: 50, desc: 'Suba de level' },
  { id: 'msg50', label: 'Mande 50 mensagens', target: 50, reward: 30, desc: 'Seja ativo!' },
  { id: 'quiz5', label: 'Acerte 5 quiz', target: 5, reward: 75, desc: 'Mostre inteligência' },
  { id: 'gold500', label: 'Ganhe 500 gold', target: 500, reward: 100, desc: 'Fique rico' },
  { id: 'pet10', label: 'Cuide do pet 10x', target: 10, reward: 60, desc: 'Ame seu pet' },
];

function getUserId(msg) {
  return msg.key.remoteJid.split('@')[0] === msg.key.participant.split('@')[0]
    ? msg.key.participant
    : msg.key.remoteJid;
}

function getTodayKey(userId) {
  const today = new Date().toISOString().split('T')[0];
  return `${userId}_${today}`;
}

function prepareDailyMissionState(userId) {
  const todayKey = getTodayKey(userId);
  if (!dailyMissionData.has(todayKey)) {
    dailyMissionData.set(todayKey, {
      date: new Date().toISOString().slice(0, 10),
      progress: {},
      completed: {},
      claimed: {},
    });
  }
  return dailyMissionData.get(todayKey);
}

function findDailyMission(missionKey) {
  return dailyMissionDefinitions.find(m => m.id === missionKey);
}

async function handleMissao(sock, msg, jid, caption, getPrefix) {
  const userId = getUserId(msg);
  const P = getPrefix(jid);
  const args = caption.trim().split(/\s+/).slice(1);
  let missionKey = null;
  
  if (args.length >= 2 && ['resgatar', 'claim', 'pegar', 'receber'].includes(args[0].toLowerCase())) {
    missionKey = args[1].toLowerCase();
  } else if (args.length >= 1 && args[0].toLowerCase() !== 'listar') {
    missionKey = args[0].toLowerCase();
  }

  const state = prepareDailyMissionState(userId);
  
  if (missionKey) {
    const mission = findDailyMission(missionKey);
    if (!mission) {
      await sock.sendMessage(jid, { text: `⚠️ Missão não encontrada. Use *${P}missao* para listar.` }, { quoted: msg });
      return;
    }
    if (!state.completed[mission.id]) {
      await sock.sendMessage(jid, { text: `⏳ Não pronta. Progresso: ${state.progress[mission.id] || 0}/${mission.target}` }, { quoted: msg });
      return;
    }
    if (state.claimed[mission.id]) {
      await sock.sendMessage(jid, { text: `✅ Já resgatada hoje!` }, { quoted: msg });
      return;
    }

    state.claimed[mission.id] = true;
    await sock.sendMessage(jid, { text: `🎉 *+${mission.reward} gold!*` }, { quoted: msg });
    return;
  }

  const lines = [];
  for (const mission of dailyMissionDefinitions) {
    const progress = state.progress[mission.id] || 0;
    const completed = state.completed[mission.id];
    const claimed = state.claimed[mission.id];
    
    let status = '⏳';
    if (claimed) status = '✅';
    else if (completed) status = '🎁';
    
    lines.push(`${status} *${mission.label}* — ${mission.reward}g`);
    lines.push(`   ${progress}/${mission.target} | ${mission.desc}`);
  }

  await sock.sendMessage(jid, {
    text: `🎯 *MISSÕES DIÁRIAS*\n\n${lines.join('\n')}\n\nUse *${P}missao <id>* para resgatar!`,
  }, { quoted: msg });
}

module.exports = {
  handleMissao,
  prepareDailyMissionState,
  findDailyMission,
  dailyMissionData,
  dailyMissionDefinitions,
};
