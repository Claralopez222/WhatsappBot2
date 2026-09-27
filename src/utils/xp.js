'use strict';

const Usuario    = require('../models/Usuario');
const LidMapping = require('../models/LidMapping');
const { normalizarJid } = require('./jid');
const { prepareDailyMissionState, incrementMission } = require('../handlers/diversao/missoes');

/**
 * Retorna a hora atual no fuso horário oficial de Brasília (America/Sao_Paulo / UTC-3).
 *
 * @param {Date} [date]
 * @returns {number} hora de 0 a 23
 */
function getHorarioBrasilia(date = new Date()) {
  try {
    const horaStr = date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
    const hora = parseInt(horaStr, 10);
    return Number.isNaN(hora) ? date.getHours() : hora;
  } catch {
    return date.getHours();
  }
}

/**
 * Retorna as informações do bônus de XP do período do dia (Manhã, Tarde, Noite, Madrugada).
 *
 * Horários e Recompensas:
 * - ☀️ Manhã     (06h - 11h59): +15 XP por mensagem
 * - 🌤️ Tarde     (12h - 17h59): +20 XP por mensagem
 * - 🌙 Noite     (18h - 23h59): +25 XP por mensagem
 * - 🦉 Madrugada (00h - 05h59): +30 XP por mensagem (Bônus Corujão)
 *
 * @param {Date} [date]
 * @returns {{ periodo: string, emoji: string, bonusName: string, xp: number }}
 */
function getBonusHorario(date = new Date()) {
  const hora = getHorarioBrasilia(date);

  if (hora >= 6 && hora < 12) {
    return { periodo: 'Manhã', emoji: '☀️', bonusName: 'Bônus do Dia', xp: 5 };
  }
  if (hora >= 12 && hora < 18) {
    return { periodo: 'Tarde', emoji: '🌤️', bonusName: 'Bônus da Tarde', xp: 6 };
  }
  if (hora >= 18 && hora < 24) {
    return { periodo: 'Noite', emoji: '🌙', bonusName: 'Bônus da Noite', xp: 8 };
  }
  return { periodo: 'Madrugada', emoji: '🦉', bonusName: 'Bônus Corujão', xp: 10 };
}

/**
 * Fórmula rápida e balanceada de Nível a partir de XP.
 * (Nível 2 = 80 XP, Nível 3 = 211 XP, Nível 5 = 554 XP, Nível 10 = 1.757 XP)
 *
 * @param {number} xp
 * @returns {number}
 */
function levelFromXpGlobal(xp) {
  const xpSeguro = Math.max(0, xp || 0);
  return Math.max(1, Math.floor(Math.pow(xpSeguro / 80, 1 / 1.4)) + 1);
}

/**
 * Adiciona XP global ao Usuário, aplicando o bônus do horário do dia.
 *
 * @param {string} userId
 * @param {number|null} [xpOverride]
 * @param {string|null} [pushName]
 * @returns {Promise<object|null>}
 */
async function addUserXp(userId, xpOverride = null, pushName = null) {
  if (!userId) return null;

  const userIdNorm = normalizarJid(userId);
  if (!userIdNorm) return null;

  const bonus = getBonusHorario();
  const xpGanho = (typeof xpOverride === 'number' && xpOverride > 0) ? xpOverride : bonus.xp;

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
        xp: xpGanho,
        mensagens: 1,
        [`xpHistory.${hojeISO}`]: xpGanho,
      },
      $setOnInsert: { level: 1, idWhatsApp: idAlvo, createdAt: new Date() },
    };
    if (pushName) update.$set = { nome: pushName };

    const updated = await Usuario.findOneAndUpdate(
      { idWhatsApp: idAlvo },
      update,
      { new: true, upsert: true }
    );

    await incrementMission(idAlvo, 'xp100', xpGanho);
    await incrementMission(idAlvo, 'msg50', 1);

    const xpAtual   = updated?.xp ?? 0;
    const levelNovo = levelFromXpGlobal(xpAtual);

    if ((updated?.level ?? 1) !== levelNovo) {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: idAlvo },
        { $set: { level: levelNovo } }
      );
      updated.level = levelNovo;
    }

    return {
      ...updated.toObject(),
      xpGanho,
      bonusHorario: bonus,
    };
  } catch (e) {
    console.error('⚠️ Erro ao atualizar XP do usuário:', e.message);
    return null;
  }
}

module.exports = {
  addUserXp,
  getBonusHorario,
  getHorarioBrasilia,
  levelFromXpGlobal,
};