'use strict';

const mongoose = require('mongoose');

const FilhoSchema = new mongoose.Schema({
  // Casal
  jidA:    { type: String, required: true, index: true }, // pai/mãe A
  jidB:    { type: String, required: true, index: true }, // pai/mãe B
  idGrupo: { type: String, required: true, index: true },

  // Identidade
  nome:          { type: String, required: true, trim: true },
  sexo:          { type: String, enum: ['menino', 'menina'], required: true },
  personalidade: { type: String, required: true, trim: true },

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

// ── Idade calculada em "anos" (1 ano = 7 dias reais) ──
FilhoSchema.virtual('idade').get(function () {
  const diasVividos = (Date.now() - this.nascidoEm.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diasVividos / 7);
});

FilhoSchema.set('toJSON',   { virtuals: true });
FilhoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Filho', FilhoSchema);