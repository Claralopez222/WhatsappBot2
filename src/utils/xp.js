'use strict';

const Usuario    = require('../models/Usuario');
const LidMapping = require('../models/LidMapping');
const { normalizarJid } = require('./jid');
const { prepareDailyMissionState, incrementMission } = require('../handlers/diversao/missoes');

/**
 * Única fonte de verdade para xp/mensagens/level/missões do Usuario global.
 * Extraído de bot.js/router.js (estava duplicado idêntico nos dois arquivos)
 * para que uma correção futura só precise ser feita em um lugar.
 */
async function addUserXp(userId, xp = 1, pushName = null) {
  if (!userId) return null;

  const userIdNorm = normalizarJid(userId);
  if (!userIdNorm) return null;

  try {
    let idAlvo = userIdNorm;
    if (!userIdNorm.endsWith('@lid')) {
      const lidMap = await LidMapping.findOne({ pn: userIdNorm }).lean();
      if (lidMap?.lid && await Usuario.exists({ idWhatsApp: lidMap.lid })) {
        idAlvo = lidMap.lid;
      }
    }

    await prepareDailyMissionState(idAlvo);

    const hojeISO = new Date().toISOString().slice(0, 10);

    const update = {
      $inc: {
        xp,
        mensagens: 1,
        [`xpHistory.${hojeISO}`]: xp,
      },
      $setOnInsert: { level: 1, idWhatsApp: idAlvo, createdAt: new Date() },
    };
    if (pushName) update.$set = { nome: pushName };

    const updated = await Usuario.findOneAndUpdate(
      { idWhatsApp: idAlvo },
      update,
      { new: true, upsert: true }
    );

    await incrementMission(idAlvo, 'xp100', xp);
    await incrementMission(idAlvo, 'msg50', 1);

    const xpAtual   = updated?.xp ?? 0;
    const levelNovo = Math.floor(Math.pow(xpAtual / 100, 1 / 1.5)) + 1;

    if ((updated?.level ?? 1) !== levelNovo) {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: idAlvo },
        { $set: { level: levelNovo } }
      );
      updated.level = levelNovo;
    }

    return updated;
  } catch (e) {
    console.error('⚠️ Erro ao atualizar XP do usuário:', e.message);
    return null;
  }
}

module.exports = { addUserXp };