'use strict';

const CarteiraGrupo = require('../../models/CarteiraGrupo');

function assertJid(jid, nome) {
  if (!jid || typeof jid !== 'string' || !jid.trim()) {
    throw new TypeError(`carteira/ranking: "${nome}" é obrigatório e deve ser uma string não vazia.`);
  }
}

async function rankingGold(idGrupo, limite = 10) {
  assertJid(idGrupo, 'idGrupo');
  return CarteiraGrupo.find({ idGrupo, gold: { $gt: 0 } })
    .sort({ gold: -1 }).limit(Math.min(limite, 50))
    .select('idWhatsApp gold level xp').lean();
}

async function rankingXp(idGrupo, limite = 10) {
  assertJid(idGrupo, 'idGrupo');
  return CarteiraGrupo.find({ idGrupo, xp: { $gt: 0 } })
    .sort({ xp: -1 }).limit(Math.min(limite, 50))
    .select('idWhatsApp xp level gold').lean();
}

module.exports = { rankingGold, rankingXp };