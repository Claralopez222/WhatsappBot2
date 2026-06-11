'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const goldHistorySchema = new mongoose.Schema(
  {
    type:   { type: String, enum: ['recebido', 'gasto'], required: true },
    item:   { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ─── Schema principal ─────────────────────────────────────────────────────────

const carteiraGrupoSchema = new mongoose.Schema(
  {
    // ── Identificação ────────────────────────────────────────────
    idWhatsApp: { type: String, required: true, trim: true },
    idGrupo:    { type: String, required: true, trim: true },

    // ── Economia local do grupo ──────────────────────────────────
    gold:       { type: Number, default: 0, min: 0 },
    quizPoints: { type: Number, default: 0, min: 0 },
    mensagens:  { type: Number, default: 0, min: 0 },
    xp:         { type: Number, default: 0, min: 0 },
    level:      { type: Number, default: 1, min: 1 },

    // ── Pesca (isolada por grupo) ────────────────────────────────
    ultimaPesca: { type: Date, default: null },
    itensPesca: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },

    // ── Emprego (isolado por grupo) ──────────────────────────────
    // O enum rígido foi removido para aceitar qualquer cargo gerenciado pelo resolverCargo()
    empregoAtual: {
      type:    String,
      default: null,
    },
    totalTrabalhosComSucesso: { type: Number, default: 0, min: 0 },
    ultimoTrabalho:           { type: Date,   default: null },
    historicoSujo:            { type: Boolean, default: false },

    // ── Roubo — ataque (isolado por grupo) ───────────────────────
    itensRoubo: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },
    equiparoubo: { type: String, default: null },
    ultimoRoubo: { type: Date,   default: null },

    // ── Pets (isolado por grupo) ────────────────────────────────
    itensPets: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },

    // ── Segurança — defesa (isolada por grupo) ───────────────────
    itensSec: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },
    equiparsec: { type: String, default: null },

    // ── Empréstimo ───────────────────────────────────────────────
    emprestimo: {
      ativo:             { type: Boolean, default: false },
      valor:             { type: Number,  default: 0 },
      vencimento:        { type: Date,    default: null },
      solicitadoEm:      { type: Date,    default: null },
      prazo:             { type: Number,  default: 7 },
      quitadoEm:         { type: Date,    default: null },
      proximoEmprestimo: { type: Date,    default: null },
    },

    // ── Histórico de gold ────────────────────────────────────────
    goldHistory: {
      type:    [goldHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ─── Índices ──────────────────────────────────────────────────────────────────

carteiraGrupoSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });
carteiraGrupoSchema.index({ idGrupo: 1, gold: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, xp: -1 });

// ─── Métodos de instância ─────────────────────────────────────────────────────

carteiraGrupoSchema.methods.registrarGold = function (tipo, item, amount, limite = 50) {
  this.goldHistory.push({ type: tipo, item, amount });
  if (this.goldHistory.length > limite) {
    this.goldHistory = this.goldHistory.slice(-limite);
  }
};

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports =
  mongoose.models.CarteiraGrupo ||
  mongoose.model('CarteiraGrupo', carteiraGrupoSchema);