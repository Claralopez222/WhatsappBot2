'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const goldHistorySchema = new mongoose.Schema(
  {
    type:   { type: String, enum: ['recebido', 'gasto'], required: true },
    item:   { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

const emprestimoSchema = new mongoose.Schema(
  {
    ativo:             { type: Boolean, default: false },
    valor:             { type: Number,  default: 0,   min: 0 },
    vencimento:        { type: Date,    default: null },
    solicitadoEm:      { type: Date,    default: null },
    prazo:             { type: Number,  default: 7,   min: 1 },
    quitadoEm:         { type: Date,    default: null },
    proximoEmprestimo: { type: Date,    default: null },
  },
  { _id: false }
);

const pescaStatsSchema = new mongoose.Schema(
  {
    totalPescados:  { type: Number, default: 0, min: 0 },
    totalVendidos:  { type: Number, default: 0, min: 0 },
    goldGanho:      { type: Number, default: 0, min: 0 },
    maiorPeixe:     { type: String, default: null },
  },
  { _id: false }
);

const bancoHistoricoSchema = new mongoose.Schema(
  {
    data:      { type: Date,   default: Date.now },
    investido: { type: Number, required: true },
    resgate:   { type: Number, required: true },
    juros:     { type: Number, required: true },
    lucro:     { type: Number, required: true },
  },
  { _id: false }
);

const bancoSchema = new mongoose.Schema(
  {
    amount:           { type: Number, default: 0,    min: 0 },
    interest:         { type: Number, default: 0,    min: 0 },
    startDate:        { type: Date,   default: null },
    depositedToday:   { type: Number, default: 0,    min: 0 },
    lastDepositDate:  { type: String, default: null },
    historico:        { type: [bancoHistoricoSchema], default: [] },
  },
  { _id: false }
);

// ─── Schema principal ─────────────────────────────────────────────────────────

const carteiraGrupoSchema = new mongoose.Schema(
  {
    // ── Identificação ────────────────────────────────────────────
    idWhatsApp: { type: String, required: true, trim: true },
    idGrupo:    { type: String, required: true, trim: true },
    nome:       { type: String, default: null,  trim: true },

    // ── Economia local do grupo ──────────────────────────────────
    gold:       { type: Number, default: 0, min: 0 },
    quizPoints: { type: Number, default: 0, min: 0 },
    mensagens:  { type: Number, default: 0, min: 0 },
    xp:         { type: Number, default: 0, min: 0 },
    level:      { type: Number, default: 1, min: 1 },

    // ── Bônus diário de mensagem ──────────────────────────────────
    ultimoBonusDiario: { type: Date, default: null },

    // ── Banco (isolado por grupo) ────────────────────────────────
    banco: { type: bancoSchema, default: () => ({}) },

    // ── Pesca (isolada por grupo) ────────────────────────────────
    ultimaPesca:  { type: Date,   default: null },
    varaEquipada: { type: String, default: null },
    iscaEquipada: { type: String, default: null },
    itensPesca: {
      type:    Map,
      of:      { type: Number, min: 0 },
      default: {},
    },
    statsPesca: { type: pescaStatsSchema, default: () => ({}) },

    // ── Emprego (isolado por grupo) ──────────────────────────────
    empregoAtual:             { type: String,  default: null },
    totalTrabalhosComSucesso: { type: Number,  default: 0,   min: 0 },
    ultimoTrabalho:           { type: Date,    default: null },
    historicoSujo:            { type: Boolean, default: false },

    // ── Roubo — ataque (isolado por grupo) ───────────────────────
    itensRoubo:  { type: Map, of: { type: Number, min: 0 }, default: {} },
    equiparoubo: { type: String, default: null },
    ultimoRoubo: { type: Date,   default: null },

    // ── Segurança — defesa (isolada por grupo) ───────────────────
    itensSec:   { type: Map, of: { type: Number, min: 0 }, default: {} },
    equiparsec: { type: String, default: null },

    // ── Pets (isolado por grupo) ─────────────────────────────────
    itensPets: { type: Map, of: { type: Number, min: 0 }, default: {} },

    // ── Empréstimo ───────────────────────────────────────────────
    emprestimo: { type: emprestimoSchema, default: () => ({}) },

    // ── Histórico de gold ────────────────────────────────────────
    goldHistory: { type: [goldHistorySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// ─── Índices ──────────────────────────────────────────────────────────────────

carteiraGrupoSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });
carteiraGrupoSchema.index({ idGrupo: 1, gold: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, xp: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, mensagens: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, quizPoints: -1 });

// ─── Métodos de instância ─────────────────────────────────────────────────────

carteiraGrupoSchema.methods.registrarGold = function (tipo, item, amount, limite = 50) {
  this.goldHistory.push({ type: tipo, item, amount });
  if (this.goldHistory.length > limite) {
    this.goldHistory = this.goldHistory.slice(-limite);
  }
};

carteiraGrupoSchema.methods.toSafeObject = function () {
  return {
    idWhatsApp:   this.idWhatsApp,
    idGrupo:      this.idGrupo,
    nome:         this.nome,
    gold:         this.gold,
    xp:           this.xp,
    level:        this.level,
    mensagens:    this.mensagens,
    empregoAtual: this.empregoAtual,
  };
};

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports =
  mongoose.models.CarteiraGrupo ||
  mongoose.model('CarteiraGrupo', carteiraGrupoSchema);