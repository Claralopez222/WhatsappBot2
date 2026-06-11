'use strict';

const mongoose = require('mongoose');

// ─── Sub-schema: histórico de gold ───────────────────────────
const goldHistorySchema = new mongoose.Schema({
  type:   { type: String, enum: ['recebido', 'gasto'], required: true },
  item:   { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  date:   { type: Date,   default: Date.now },
}, { _id: false });

// ─── Sub-schema: pet ─────────────────────────────────────────
const petSchema = new mongoose.Schema({
  name:       { type: String,  default: null },
  level:      { type: Number,  default: 1,  min: 1 },
  happiness:  { type: Number,  default: 60, min: 0, max: 100 },
  energy:     { type: Number,  default: 80, min: 0, max: 100 },
  fullness:   { type: Number,  default: 80, min: 0, max: 100 },
  adoptedAt:  { type: Date,    default: null },
  lastFed:    { type: Date,    default: null },
  lastPlayed: { type: Date,    default: null },
}, { _id: false });

// ─── Sub-schema: banco ───────────────────────────────────────
const bankSchema = new mongoose.Schema({
  amount:          { type: Number, default: 0,    min: 0 },
  interest:        { type: Number, default: 0,    min: 0 },
  startDate:       { type: Date,   default: null },
  lastDepositDate: { type: Date,   default: null },
  depositedToday:  { type: Number, default: 0,    min: 0 },
  historico:       { type: Array,  default: [] },
}, { _id: false });

// ─── Sub-schema: progresso de missões (reutilizável) ─────────
const missaoNumSchema = new mongoose.Schema({
  xp100:   { type: Number,  default: 0,     min: 0 },
  msg50:   { type: Number,  default: 0,     min: 0 },
  quiz5:   { type: Number,  default: 0,     min: 0 },
  gold500: { type: Number,  default: 0,     min: 0 },
  pet10:   { type: Number,  default: 0,     min: 0 },
  roubo3:  { type: Number,  default: 0,     min: 0 },
}, { _id: false });

const missaoBoolSchema = new mongoose.Schema({
  xp100:   { type: Boolean, default: false },
  msg50:   { type: Boolean, default: false },
  quiz5:   { type: Boolean, default: false },
  gold500: { type: Boolean, default: false },
  pet10:   { type: Boolean, default: false },
  roubo3:  { type: Boolean, default: false },
}, { _id: false });

const dailyMissionsSchema = new mongoose.Schema({
  date:      { type: Date,             default: null },
  progress:  { type: missaoNumSchema,  default: () => ({}) },
  completed: { type: missaoBoolSchema, default: () => ({}) },
  claimed:   { type: missaoBoolSchema, default: () => ({}) },
}, { _id: false });

// ─── Sub-schema: item da loja do casal ───────────────────────
//
// Armazena cada item desbloqueado via !lojacasal.
// A lógica de uso (guard nos handlers de carinho) consulta
// casalItens para saber se o comando está liberado.
//
// Campos:
//  • itemKey   — chave canônica do comando (ex: 'serenata', 'jantar')
//  • compradoPor — jid de quem comprou (qualquer um do casal pode comprar)
//  • compradoEm  — timestamp da compra (auditoria / exibição em !meupar)
const casalItemSchema = new mongoose.Schema({
  itemKey:      { type: String, required: true, trim: true, lowercase: true },
  compradoPor:  { type: String, required: true },
  compradoEm:   { type: Date,   default: Date.now },
}, { _id: false });

// ─── Schema principal ─────────────────────────────────────────
const usuarioSchema = new mongoose.Schema({
  idWhatsApp: { type: String, required: true, unique: true, index: true },
  nome:       { type: String, default: null },
  xp:         { type: Number, default: 0,   min: 0 },
  level:      { type: Number, default: 1,   min: 1 },
  gold:       { type: Number, default: 100, min: 0 },
  quizPoints: { type: Number, default: 0,   min: 0 },

  // ─── XP de casal (persistência dos handlers de relacionamento) ──
  xpCasal: { type: Number, default: 0, min: 0 },

  goldHistory:  { type: [goldHistorySchema], default: [] },

  inventory:    { type: Map, of: Number, default: {} },

  // ─── Relacionamento ──────────────────────────────────────────
  casadoCom:   { type: String, default: null },
  casadoTipo:  { type: String, enum: ['casamento', 'namoro', null], default: null },
  casadoDesde: { type: Date,   default: null },

  // ─── Itens desbloqueados da loja do casal (!lojacasal) ───────
  //
  // Escopo: POR USUÁRIO.
  // Qualquer membro do casal pode comprar; a verificação nos handlers
  // de carinho consulta o doc do sender (não do parceiro).
  // Se preferir escopo por CASAL, mova esta lógica para uma coleção
  // separada indexada por relKey(jidA, jidB).
  //
  // $addToSet não funciona com sub-documentos complexos; use $push
  // com uma verificação prévia de casalItens.itemKey no handler
  // para evitar duplicatas.
  casalItens: { type: [casalItemSchema], default: [] },

  pet:           { type: petSchema,          default: () => ({}) },
  bank:          { type: bankSchema,         default: () => ({}) },
  dailyMissions: { type: dailyMissionsSchema, default: () => ({}) },

  // ─── Roubo ───────────────────────────────────────────────────
  itensRoubo:  { type: Map,    of: Number, default: {} },
  itensSec:    { type: Map,    of: Number, default: {} },
  equiparoubo: { type: String, default: null },
  equiparsec:  { type: String, default: null },
  ultimoRoubo: { type: Date,   default: null },

  // ─── Advertências (jid do grupo → contagem) ──────────────────
  warnings:    { type: Map,    of: Number, default: {} },

}, {
  timestamps: true,
});

module.exports = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);