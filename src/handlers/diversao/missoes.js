/**
 * Sistema de Missões Diárias — Piroquinhas Bot
 * Comando: !missao
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── DEFINIÇÃO DAS MISSÕES ──────────────────────────────────────────────────

const dailyMissionDefinitions = [
  { id: 'xp100',   label: 'Ganhe 100 XP',       target: 100, reward: 50,  emoji: '⭐', desc: 'Suba de level' },
  { id: 'msg50',   label: 'Mande 50 mensagens',  target: 50,  reward: 30,  emoji: '💬', desc: 'Seja ativo!' },
  { id: 'quiz5',   label: 'Acerte 5 quiz',       target: 5,   reward: 75,  emoji: '🧠', desc: 'Mostre inteligência' },
  { id: 'gold500', label: 'Ganhe 500 gold',      target: 500, reward: 100, emoji: '💰', desc: 'Fique rico' },
  { id: 'pet10',   label: 'Cuide do pet 10x',    target: 10,  reward: 60,  emoji: '🐾', desc: 'Ame seu pet' },
  { id: 'roubo3',  label: 'Faça 3 roubos',       target: 3,   reward: 80,  emoji: '🎭', desc: 'Seja um ladrão!' },
];

// IDs válidos para validação rápida
const MISSION_IDS = new Set(dailyMissionDefinitions.map(m => m.id));

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function buildDefaultMissions() {
  return {
    date:      getTodayStr(),
    progress:  { xp100: 0, msg50: 0, quiz5: 0, gold500: 0, pet10: 0, roubo3: 0 },
    completed: { xp100: false, msg50: false, quiz5: false, gold500: false, pet10: false, roubo3: false },
    claimed:   { xp100: false, msg50: false, quiz5: false, gold500: false, pet10: false, roubo3: false },
  };
}

function buildProgressBar(current, target, length = 10) {
  const filled = Math.min(Math.floor((current / target) * length), length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ─── prepareDailyMissionState ────────────────────────────────────────────────

async function prepareDailyMissionState(userId) {
  const todayStr = getTodayStr();

  try {
    let user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      user = await Usuario.create({
        idWhatsApp: userId,
        gold: 0,
        xp: 0,
        level: 1,
        dailyMissions: buildDefaultMissions(),
      });
      return user.dailyMissions;
    }

    if (user.dailyMissions?.date === todayStr) {
      return user.dailyMissions;
    }

    const fresh = buildDefaultMissions();
    const updated = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { dailyMissions: fresh } },
      { new: true }
    );

    return updated?.dailyMissions ?? fresh;
  } catch (e) {
    console.error('⚠️ Erro ao preparar missões:', e.message);
    return buildDefaultMissions();
  }
}

// ─── incrementMission ────────────────────────────────────────────────────────

async function incrementMission(userId, missionId, amount = 1) {
  if (!MISSION_IDS.has(missionId)) return;

  try {
    await prepareDailyMissionState(userId);

    const todayStr = getTodayStr();
    const mission  = dailyMissionDefinitions.find(m => m.id === missionId);
    if (!mission) return;

    const user = await Usuario.findOne({ idWhatsApp: userId });
    if (!user?.dailyMissions || user.dailyMissions.date !== todayStr) return;

    const currentProgress = user.dailyMissions.progress?.[missionId] || 0;
    if (currentProgress >= mission.target) return;

    const newProgress  = Math.min(currentProgress + amount, mission.target);
    const nowCompleted = newProgress >= mission.target;

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $set: {
          [`dailyMissions.progress.${missionId}`]:  newProgress,
          [`dailyMissions.completed.${missionId}`]: nowCompleted,
        },
      }
    );
  } catch (e) {
    console.error(`⚠️ Erro ao incrementar missão ${missionId}:`, e.message);
  }
}

function findDailyMission(missionKey) {
  return dailyMissionDefinitions.find(m => m.id === missionKey.toLowerCase());
}

// ─── handleMissao ────────────────────────────────────────────────────────────

async function handleMissao(sock, msg, jid, caption, getPrefix) {
  const userId = getUserId(msg);
  const P      = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const args   = caption.trim().split(/\s+/).slice(1);

  let missionKey = null;
  if (args.length >= 2 && ['resgatar', 'claim', 'pegar', 'receber'].includes(args[0].toLowerCase())) {
    missionKey = args[1];
  } else if (args.length >= 1 && args[0].toLowerCase() !== 'listar') {
    missionKey = args[0];
  }

  const state = await prepareDailyMissionState(userId);

  if (!state?.progress || !state?.completed || !state?.claimed) {
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar suas missões! Tente novamente.' }, { quoted: msg });
    return;
  }

  // ── Resgate de recompensa ───────────────────────────────────────────────
  if (missionKey) {
    const mission = findDailyMission(missionKey);

    if (!mission) {
      const ids = dailyMissionDefinitions.map(m => `\`${m.id}\``).join(', ');
      await sock.sendMessage(jid, {
        text: `⚠️ Missão *${missionKey}* não encontrada!\n\n📋 IDs válidos: ${ids}`
      }, { quoted: msg });
      return;
    }

    const progress    = state.progress?.[mission.id] || 0;
    const isCompleted = progress >= mission.target || state.completed?.[mission.id];
    const isClaimed   = state.claimed?.[mission.id];

    if (isClaimed) {
      await sock.sendMessage(jid, {
        text: `✅ Você já resgatou *${mission.label}* hoje!\n\n🔄 Missões renovam à meia-noite.`
      }, { quoted: msg });
      return;
    }

    if (!isCompleted) {
      const bar = buildProgressBar(progress, mission.target);
      const pct = Math.floor((progress / mission.target) * 100);
      await sock.sendMessage(jid, {
        text:
          `⏳ *Missão em andamento!*\n\n` +
          `${mission.emoji} *${mission.label}*\n` +
          `    └ ID: \`${mission.id}\`\n` +
          `[${bar}] ${pct}%\n` +
          `📊 Progresso: *${progress}/${mission.target}*\n\n` +
          `_${mission.desc}_`
      }, { quoted: msg });
      return;
    }

    // Concede recompensa atomicamente
    try {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        {
          $set: {
            [`dailyMissions.completed.${mission.id}`]: true,
            [`dailyMissions.claimed.${mission.id}`]:   true,
          },
          $inc: { gold: mission.reward },
        }
      );

      await sock.sendMessage(jid, {
        text:
          `🎉 *MISSÃO CONCLUÍDA!* 🎉\n\n` +
          `${mission.emoji} *${mission.label}*\n` +
          `💰 Recompensa: *+${mission.reward} gold* adicionado!\n\n` +
          `_${mission.desc}_`
      }, { quoted: msg });
    } catch (e) {
      console.error('❌ Erro ao dar recompensa da missão:', e.message);
      await sock.sendMessage(jid, { text: '⚠️ Erro interno ao computar sua recompensa.' }, { quoted: msg });
    }
    return;
  }

  // ── Listagem de todas as missões ────────────────────────────────────────
  let totalGoldDisponivel = 0;
  const lines = [];

  for (const mission of dailyMissionDefinitions) {
    const progress    = state.progress?.[mission.id] || 0;
    const isCompleted = progress >= mission.target || state.completed?.[mission.id];
    const isClaimed   = state.claimed?.[mission.id];

    let statusEmoji = '⏳';
    if (isClaimed)        statusEmoji = '✅';
    else if (isCompleted) { statusEmoji = '🎁'; totalGoldDisponivel += mission.reward; }

    const bar = buildProgressBar(progress, mission.target, 8);
    const pct = Math.min(Math.floor((progress / mission.target) * 100), 100);

    lines.push(
      `${statusEmoji} ${mission.emoji} *${mission.label}* — _+${mission.reward}g_\n` +
      `    └ ID: \`${mission.id}\`\n` +
      `    [${bar}] ${pct}% | ${progress}/${mission.target} | _${mission.desc}_`
    );
  }

  const allClaimed = dailyMissionDefinitions.every(m => state.claimed?.[m.id]);
  const rodape     = allClaimed
    ? `🏆 *Parabéns! Você completou todas as missões de hoje!*`
    : totalGoldDisponivel > 0
      ? `🎁 *Você tem ${totalGoldDisponivel}g para resgatar!*`
      : `💪 Continue jogando para completar suas missões!`;

  const texto =
    `🎯 *MISSÕES DIÁRIAS* 🎯\n` +
    `📅 _${getTodayStr()}_\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    lines.join('\n\n') +
    `\n\n━━━━━━━━━━━━━━━━\n` +
    `${rodape}\n\n` +
    `💡 Para resgatar: *${P}missao <id>*\n` +
    `Exemplo: *${P}missao xp100*`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Exportar ────────────────────────────────────────────────────────────────

module.exports = {
  handleMissao,
  prepareDailyMissionState,
  incrementMission,
  findDailyMission,
  dailyMissionDefinitions,
};