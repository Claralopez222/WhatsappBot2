'use strict';

const mongoose = require('mongoose');

const FilhoSchema = new mongoose.Schema({
  // Casal
  jidA:    { type: String, required: true, index: true }, // pai/mãe A
  jidB:    { type: String, required: true, index: true }, // pai/mãe B
  idGrupo: { type: String, required: true, index: true },

  // Identidade
  nome:          { type: String, required: true },
  sexo:          { type: String, enum: ['menino', 'menina'], required: true },
  personalidade: { type: String, required: true },

  // Idade
  nascidoEm: { type: Date, default: Date.now }, // a cada 7 dias = +1 ano

  // Atributos (0–100)
  felicidade: { type: Number, default: 100, min: 0, max: 100 },
  fome:       { type: Number, default: 100, min: 0, max: 100 },
  sono:       { type: Number, default: 100, min: 0, max: 100 },
  alegria:    { type: Number, default: 100, min: 0, max: 100 },

  // Estado
  doente: { type: Boolean, default: false },

  // Guarda compartilhada
  guardaAtual: { type: String, default: null }, // jid de quem está com o filho agora
  ultimaTroca: { type: Date,   default: Date.now },

  // Cuidado diário
  ultimoCuidado: { type: Date, default: null },
}, { timestamps: true });

// Índice composto para buscas comuns por grupo + casal
FilhoSchema.index({ idGrupo: 1, jidA: 1, jidB: 1 });

module.exports = mongoose.model('Filho', FilhoSchema);
