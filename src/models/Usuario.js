const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  idWhatsApp: { type: String, required: true, unique: true, index: true },
  nome: { type: String, default: null },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  gold: { type: Number, default: 100 },
  quizPoints: { type: Number, default: 0 },
  goldHistory: [{
    type: { type: String, enum: ['recebido', 'gasto'], required: true },
    item: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  }],
  inventory: {
    type: Map,
    of: Number,
    default: {},
  },
  casadoCom: { type: String, default: null },
  casadoTipo: { type: String, enum: ['casamento', 'namoro'], default: null },
  pet: {
    name: { type: String, default: null },
    level: { type: Number, default: 1 },
    happiness: { type: Number, default: 60 },
    energy: { type: Number, default: 80 },
    fullness: { type: Number, default: 80 },
    adoptedAt: { type: Date, default: null },
    lastFed: { type: Date, default: null },
    lastPlayed: { type: Date, default: null },
  },
  // ─── NOVO CAMPO: SISTEMA DE INVESTIMENTO BANCO ───
  bank: {
    amount: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    daysRemaining: { type: Number, default: 0 },
    startDate: { type: String, default: null },
    lastDepositDate: { type: String, default: null },
    depositedToday: { type: Number, default: 0 }
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);