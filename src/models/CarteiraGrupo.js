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
    empregoAtual: {
      type:    String,
      default: null,
      enum:    [null, 'entregador', 'atendente', 'programador', 'diretor'],
    },
    totalTrabalhosComSucesso: { type: Number, default: 0, min: 0 },
    ultimoTrabalho:           { type: Date,   default: null },
    historicoSujo:            { type: Boolean, default: false },

    // ── Roubo — ataque (isolado por grupo) ───────────────────────

    // Map de itens de ataque comprados: { dinamite: 2, mascara: 1, ... }
    itensRoubo: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },

    // Slug do item de ataque atualmente equipado (null = nenhum)
    equiparoubo: { type: String, default: null },

    // Timestamp da última tentativa de roubo (cooldown)
    ultimoRoubo: { type: Date, default: null },

    // ── Segurança — defesa (isolada por grupo) ───────────────────

    // Map de itens de defesa comprados: { cofre: 1, alarme: 2, ... }
    itensSec: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },

    // Slug do item de defesa atualmente ativo (null = nenhum)
    equiparsec: { type: String, default: null },

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

/**
 * Adiciona uma entrada ao histórico de gold mantendo no máximo `limite` entradas.
 * Não salva o documento — chame .save() depois se necessário.
 */
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