'use strict';

const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  idWhatsApp: { type: String, required: true, unique: true, index: true },
  nome:       { type: String, default: null },
  xp:         { type: Number, default: 0 },
  level:      { type: Number, default: 1 },
  gold:       { type: Number, default: 100 },
  quizPoints: { type: Number, default: 0 },

  goldHistory: [{
    type:   { type: String, enum: ['recebido', 'gasto'], required: true },
    item:   { type: String, required: true },
    amount: { type: Number, required: true },
    date:   { type: Date, default: Date.now },
  }],

  inventory: {
    type:    Map,
    of:      Number,
    default: {},
  },

  casadoCom:   { type: String, default: null },
casadoTipo:  { type: String, enum: ['casamento', 'namoro'], default: null },
casadoDesde: { type: Date,   default: null },

  pet: {
    name:      { type: String, default: null },
    level:     { type: Number, default: 1 },
    happiness: { type: Number, default: 60 },
    energy:    { type: Number, default: 80 },
    fullness:  { type: Number, default: 80 },
    adoptedAt: { type: Date,   default: null },
    lastFed:   { type: Date,   default: null },
    lastPlayed:{ type: Date,   default: null },
  },

  // ─── SISTEMA DE INVESTIMENTO BANCO ───────────────────────────
  bank: {
    amount:          { type: Number, default: 0 },
    interest:        { type: Number, default: 0 },
    startDate:       { type: String, default: null },
    lastDepositDate: { type: String, default: null },
    depositedToday:  { type: Number, default: 0 },
    historico:       { type: Array,  default: [] },
  },

  // ─── SISTEMA DE MISSÕES DIÁRIAS ──────────────────────────────
  dailyMissions: {
    date: { type: String, default: null },
    progress: {
      xp100:   { type: Number, default: 0 },
      msg50:   { type: Number, default: 0 },
      quiz5:   { type: Number, default: 0 },
      gold500: { type: Number, default: 0 },
      pet10:   { type: Number, default: 0 },
      roubo3:  { type: Number, default: 0 },
    },
    completed: {
      xp100:   { type: Boolean, default: false },
      msg50:   { type: Boolean, default: false },
      quiz5:   { type: Boolean, default: false },
      gold500: { type: Boolean, default: false },
      pet10:   { type: Boolean, default: false },
      roubo3:  { type: Boolean, default: false },
    },
    claimed: {
      xp100:   { type: Boolean, default: false },
      msg50:   { type: Boolean, default: false },
      quiz5:   { type: Boolean, default: false },
      gold500: { type: Boolean, default: false },
      pet10:   { type: Boolean, default: false },
      roubo3:  { type: Boolean, default: false },
    },
  },

  // ─── SISTEMA DE ROUBO ────────────────────────────────────────
  itensRoubo:  { type: Map, of: Number, default: {} },
  itensSec:    { type: Map, of: Number, default: {} },
  equiparoubo: { type: String, default: null },
  equiparsec:  { type: String, default: null },
  ultimoRoubo: { type: Date,   default: null },

  // ─── SISTEMA DE ADVERTÊNCIAS ─────────────────────────────────
  // Chave: jid do grupo → valor: número de advertências
  warnings: {
    type:    Map,
    of:      Number,
    default: {},
  },

}, {
  timestamps: true,
});

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);