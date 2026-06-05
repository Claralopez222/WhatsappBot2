/**
 * Sistema de Missões Diárias — Piroquinhas Bot
 * Comando: !missao
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));

const dailyMissionDefinitions = [
  { id: 'xp100', label: 'Ganhe 100 XP', target: 100, reward: 50, desc: 'Suba de level' },
  { id: 'msg50', label: 'Mande 50 mensagens', target: 50, reward: 30, desc: 'Seja ativo!' },
  { id: 'quiz5', label: 'Acerte 5 quiz', target: 5, reward: 75, desc: 'Mostre inteligência' },
  { id: 'gold500', label: 'Ganhe 500 gold', target: 500, reward: 100, desc: 'Fique rico' },
  { id: 'pet10', label: 'Cuide do pet 10x', target: 10, reward: 60, desc: 'Ame seu pet' },
];

// Pega o ID de quem mandou de forma 100% segura (Grupo ou Privado)
function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

// Busca as missões direto do banco de dados (MongoDB) para não resetar no Render
async function prepareDailyMissionState(userId) {
  const todayStr = new Date().toISOString().split('T')[0]; // Ex: 2026-06-05
  
  try {
    let user = await Usuario.findOne({ idWhatsApp: userId });
    
    // Se o usuário não existir no banco, cria ele
    if (!user) {
      user = await Usuario.create({ idWhatsApp: userId, gold: 0, xp: 0, level: 1 });
    }

    // Se mudou o dia, reseta as missões diárias dele automaticamente
    if (!user.dailyMissions || user.dailyMissions.date !== todayStr) {
      user.dailyMissions = {
        date: todayStr,
        progress: {},
        completed: {},
        claimed: {}
      };
      await Usuario.findOneAndUpdate({ idWhatsApp: userId }, { $set: { dailyMissions: user.dailyMissions } });
    }

    return user.dailyMissions;
  } catch (e) {
    console.error('⚠️ Erro ao carregar missões do banco:', e.message);
    return { date: todayStr, progress: {}, completed: {}, claimed: {} };
  }
}

function findDailyMission(missionKey) {
  return dailyMissionDefinitions.find(m => m.id === missionKey.toLowerCase());
}

async function handleMissao(sock, msg, jid, caption, getPrefix) {
  const userId = getUserId(msg);
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const args = caption.trim().split(/\s+/).slice(1);
  let missionKey = null;
  
  if (args.length >= 2 && ['resgatar', 'claim', 'pegar', 'receber'].includes(args[0].toLowerCase())) {
    missionKey = args[1];
  } else if (args.length >= 1 && args[0].toLowerCase() !== 'listar') {
    missionKey = args[0];
  }

  // Carrega o estado vindo do Banco de Dados
  const state = await prepareDailyMissionState(userId);
  
  if (missionKey) {
    const mission = findDailyMission(missionKey);
    if (!mission) {
      await sock.sendMessage(jid, { text: `⚠️ Missão não encontrada. Use *${P}missao* para listar as disponíveis.` }, { quoted: msg });
      return;
    }
    
    const progress = state.progress[mission.id] || 0;
    
    // Verifica se completou (Garante o check caso a outra IA esqueça de setar o .completed como true)
    if (progress < mission.target && !state.completed[mission.id]) {
      await sock.sendMessage(jid, { text: `⏳ Missão não concluída ainda!\n\n🎯 *Progresso:* ${progress}/${mission.target} | ${mission.desc}` }, { quoted: msg });
      return;
    }
    
    if (state.claimed[mission.id]) {
      await sock.sendMessage(jid, { text: `✅ Você já resgatou a recompensa dessa missão hoje!` }, { quoted: msg });
      return;
    }

    // Salva o resgate no banco de dados e adiciona a recompensa em Gold
    try {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { 
          $set: { [`dailyMissions.claimed.${mission.id}`]: true },
          $inc: { gold: mission.reward } 
        }
      );
      
      await sock.sendMessage(jid, { text: `🎉 *Missão Concluída!* Você resgatou *+${mission.reward} gold!* 💰` }, { quoted: msg });
    } catch (e) {
      console.error('❌ Erro ao dar recompensa da missão:', e.message);
      await sock.sendMessage(jid, { text: '⚠️ Erro interno ao computar sua recompensa.' }, { quoted: msg });
    }
    return;
  }

  // Bloco de Listagem das missões
  const lines = [];
  for (const mission of dailyMissionDefinitions) {
    const progress = state.progress[mission.id] || 0;
    const isCompleted = progress >= mission.target || state.completed[mission.id];
    const isClaimed = state.claimed[mission.id];
    
    let status = '⏳';
    if (isClaimed) status = '✅';
    else if (isCompleted) status = '🎁';
    
    lines.push(`${status} *[ID: ${mission.id}]* ${mission.label} — _${mission.reward}g_`);
    lines.push(`   └─ Progresso: *${progress}/${mission.target}* | _${mission.desc}_ \n`);
  }

  await sock.sendMessage(jid, {
    text: `🎯 *MISSÕES DIÁRIAS PIROQUINHAS* 🎯\n\n${lines.join('\n')}━━━━━━━━━━━━━━━━━━━━\n💡 _Para resgatar sua recompensa use:_\n👉 *${P}missao <id_da_missao>*\nExemplo: *${P}missao xp100*`,
  }, { quoted: msg });
}

module.exports = {
  handleMissao,
  prepareDailyMissionState,
  findDailyMission,
  dailyMissionDefinitions,
};