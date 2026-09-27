'use strict';

const { getCarteira, alterarGold, alterarGoldSeguro } = require('./gold');
const { rankingGold, rankingXp }                       = require('./ranking');
const { transferirGold }                               = require('./transferencia');
const { comprarComGold, venderComGold }                = require('./compras');
const { resolveJidComLid }                             = require('../identity');

module.exports = {
  getCarteira,
  alterarGold,
  alterarGoldSeguro,
  rankingGold,
  rankingXp,
  transferirGold,
  comprarComGold,
  venderComGold,

  // Compat: quem ainda importar resolverJidCarteira daqui continua
  // funcionando. Migre pra require('../identity').resolveJidComLid
  // direto e remova este alias depois.
  resolverJidCarteira: resolveJidComLid,
};