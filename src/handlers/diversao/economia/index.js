'use strict';

const { ITENS_LOJA } = require('../../../config/economia');
const { getSaldoGrupo } = require('./_shared');

const {
  handleGold,
  handleLoja,
  handleLojaFood,
  handleLojaPet,
  handleLojaTec,
  handleLojaCasal,
  handleComprar,
  handleVender,
  handleInventario,
} = require('./loja');

const { handleGarimpar } = require('./garimpo');
const { handleSlots, handleCorrida, handleApostar } = require('./cassino');
const { handlePix, handleGive } = require('./transferencia');
const { handleExtrato } = require('./extrato');
const { handleRankGold } = require('./ranking');

// Mesma superfície pública de antes (handlers/diversao/economia.js) —
// nenhum call site precisa mudar.
module.exports = {
  handleGold,
  handleLoja,
  handleLojaFood,
  handleLojaPet,
  handleLojaTec,
  handleLojaCasal,
  handleComprar,
  handleVender,
  handleInventario,
  handlePix,
  handleApostar,
  handleExtrato,
  handleGarimpar,
  handleSlots,
  handleCorrida,
  getSaldoGrupo,
  ITENS_LOJA,
  handleRankGold,
  handleGive,
};