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
  { _id: false } // entradas de histórico não precisam de _id próprio
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
    mensagens:  { type: Number, default: 0, min: 0 }, // contador para ranking local
    xp:         { type: Number, default: 0, min: 0 },
    level:      { type: Number, default: 1, min: 1 },

    // ── Pesca (isolada por grupo) ────────────────────────────────
    ultimaPesca: { type: Date, default: null },

    // Map de itens: { vara_bambu: 2, isca_minhoca: 5, peixe_medio: 1, ... }
    itensPesca: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },

    // ── Emprego (isolado por grupo) ──────────────────────────────

    // Slug do cargo atual: null | 'entregador' | 'atendente' | 'programador' | 'diretor'
    empregoAtual: {
      type:    String,
      default: null,
      enum:    [null, 'entregador', 'atendente', 'programador', 'diretor'],
    },

    // Turnos bem-sucedidos no cargo atual (zera na promoção/demissão)
    totalTrabalhosComSucesso: { type: Number, default: 0, min: 0 },

    // Data do último !trabalhar concluído com sucesso
    ultimoTrabalho: { type: Date, default: null },

    // true = foi demitido por justa causa; chance de 30% no !procuraremprego
    historicoSujo: { type: Boolean, default: false },

    // ── Histórico de gold ────────────────────────────────────────
    goldHistory: {
      type:    [goldHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt automáticos
  }
);

// ─── Índices ──────────────────────────────────────────────────────────────────

// Unicidade: um documento por par (usuário + grupo)
carteiraGrupoSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });

// Ranking de gold por grupo (top-N mais ricos)
carteiraGrupoSchema.index({ idGrupo: 1, gold: -1 });

// Ranking de XP por grupo
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