'use strict';

const mongoose = require('mongoose');
const { getWalletBalance } = require('../utils/carteira/wallet');

const WALLET_FIELDS = new Set(['gold', 'banco.amount']);

function updateTouchesWallet(update) {
  if (!update || typeof update !== 'object') return false;
  if (Array.isArray(update)) return update.some(updateTouchesWallet);
  for (const [key, value] of Object.entries(update)) {
    if (WALLET_FIELDS.has(key) || key.endsWith('.gold') || key.endsWith('.banco.amount')) return true;
    if (key.startsWith('$') && updateTouchesWallet(value)) return true;
  }
  return false;
}

function collectJids(value, result = []) {
  if (!value) return result;
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectJids(item, result));
  else if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'idWhatsApp') collectJids(nested, result);
      else if (key.startsWith('$')) collectJids(nested, result);
    }
  }
  return result;
}

async function rejectLinkedWalletWrite(query, filter, update, options = {}) {
  if (options.comment === 'wallet-migration' || !updateTouchesWallet(update)) return;
  let jids = [...new Set(collectJids(filter))];
  if (!jids.length) {
    const model = query.model || query;
    jids = await model.distinct('idWhatsApp', filter).limit(10_000);
  }
  for (const jid of jids) {
    const wallet = await getWalletBalance(jid);
    if (wallet.linked) {
      throw new Error('LINKED_WALLET_REQUIRES_SERVICE');
    }
  }
}

async function overlayLinkedBalance(wallet) {
  if (!wallet || !wallet.idWhatsApp || wallet.gold === undefined) return wallet;
  const result = await getWalletBalance(wallet.idWhatsApp);
  if (!result.linked) return wallet;
  wallet.gold = result.balanceCents;
  if (typeof wallet.set === 'function') wallet.set('gold', result.balanceCents);
  if (wallet.banco) {
    if (typeof wallet.set === 'function') wallet.set('banco.amount', 0);
    else wallet.banco.amount = 0;
  }
  wallet.balanceCents = result.balanceCents;
  wallet.wallet = result;
  wallet.walletLinked = true;
  wallet.walletCurrencyCode = result.currencyCode;
  wallet.walletCountryCode = result.countryCode;
  wallet.walletRate = result.rate;
  wallet.walletRateDate = result.rateDate;
  return wallet;
}

function isTargetedWalletRead(filter = {}) {
  return Object.hasOwn(filter, 'idWhatsApp')
    || Object.hasOwn(filter, 'idGrupo')
    || Object.hasOwn(filter, '_id')
    || Boolean(filter.$or || filter.$and);
}

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
    requestId:         { type: String,  default: null },
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
    idWhatsApp: { type: String, required: true, trim: true, lowercase: true },
    idGrupo:    { type: String, required: true, trim: true, lowercase: true },
    nome:       { type: String, default: null,  trim: true },
    nomeGrupo:  { type: String, default: null,  trim: true },

    // ── Nome customizado do grupo (definido pelo admin no painel) ─
    // Necessário para PATCH /api/admin/grupo/:jid/nome funcionar.
    // Sem este campo o Mongoose ignora o $set silenciosamente (strict mode).
    nomeCustom: { type: String, default: null, trim: true },

    // ── Economia local do grupo ──────────────────────────────────
    gold:       { type: Number, default: 0, min: 0 },
    quizPoints: { type: Number, default: 0, min: 0 },
    mensagens:  { type: Number, default: 0, min: 0 },
    xp:         { type: Number, default: 0, min: 0 },

    // ✅ "level" é DERIVADO de "xp" — via hook pre-save (.save()) OU via
    // CarteiraGrupo.incrementXp() (atualizações atômicas com $inc).
    // Nunca escrever "level" manualmente fora desses dois caminhos.
    level:      { type: Number, default: 1, min: 1 },

    // ── Bônus diário de mensagem ──────────────────────────────────
    ultimoBonusDiario: { type: Date, default: null },

    // ── Histórico diário de XP (chave: "YYYY-MM-DD", valor: XP ganho no dia) ──
    xpHistory: { type: Map, of: Number, default: {} },

    // ── Banco (isolado por grupo) ────────────────────────────────
    banco: {
      type: bancoSchema,
      default: () => ({}),
      validate: {
        validator: function(b) { return !b?.historico || b.historico.length <= 200; },
        message: 'Histórico do banco não pode exceder 200 registros.',
      },
    },

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
    itensRouboBanco:  { type: Map, of: { type: Number, min: 0 }, default: {} },
    equiparouboBanco: { type: String, default: null },
    ultimoRoubo: { type: Date,   default: null },

    // ── Segurança — defesa (isolada por grupo) ───────────────────
    itensSec:   { type: Map, of: { type: Number, min: 0 }, default: {} },
    equiparsec: { type: String, default: null },

    // ── Pets (isolado por grupo) ─────────────────────────────
    itensPets: { type: Map, of: { type: Number, min: 0 }, default: {} },

    // ── Pet ativo (isolado por grupo) ────────────────────────
    pet: {
      type: new mongoose.Schema({
        type:            { type: String,  default: null },
        name:            { type: String,  default: null, trim: true },
        rarity:          { type: String,  default: null },
        level:           { type: Number,  default: 1,    min: 1 },
        xp:              { type: Number,  default: 0,    min: 0 },
        happiness:       { type: Number,  default: 60,   min: 0, max: 100 },
        energy:          { type: Number,  default: 80,   min: 0, max: 100 },
        fullness:        { type: Number,  default: 80,   min: 0, max: 100 },
        capturedAt:      { type: Date,    default: null },
        lastInteraction: { type: Date,    default: null },
      }, { _id: false }),
      default: null,
    },

    // ── Empréstimo ───────────────────────────────────────────────
    emprestimo: { type: emprestimoSchema, default: () => ({}) },

    // ── Histórico de gold ────────────────────────────────────────
    goldHistory: { type: [goldHistorySchema], default: [] },
    walletMigration: {
      type: new mongoose.Schema({
        id: { type: String, default: null },
        goldCents: { type: Number, default: 0 },
        bankCents: { type: Number, default: 0 },
      }, { _id: false }),
      default: undefined,
      select: false,
    },
  // ── Inventário (usado pelo painel admin e pelos handlers) ─────
    inventario: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Config do grupo (gerenciada pelo painel admin) ────────────
    config: {
      type: new mongoose.Schema({
        botAtivo:   { type: Boolean, default: true  },
        xpAtivo:    { type: Boolean, default: true  },
        antiLink:   { type: Boolean, default: false },
        boasVindas: { type: Boolean, default: false },
        prefixo:    { type: String,  default: '!', enum: ['!', '.', '/', ','] },
      }, { _id: false }),
      default: () => ({}),
    },

  },
  {
    timestamps: true,
  }
);

for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne']) {
  carteiraGrupoSchema.pre(operation, async function () {
    await rejectLinkedWalletWrite(this, this.getFilter(), this.getUpdate(), this.getOptions());
  });
}

carteiraGrupoSchema.pre('bulkWrite', async function (operations, options = {}) {
  for (const operation of operations || []) {
    const write = operation.updateOne || operation.updateMany || operation.replaceOne;
    if (write) {
      await rejectLinkedWalletWrite(this, write.filter, write.update || write.replacement, options);
      continue;
    }
    const document = operation.insertOne?.document;
    if (document && (Number(document.gold || 0) !== 0 || Number(document.banco?.amount || 0) !== 0)) {
      const wallet = await getWalletBalance(document.idWhatsApp);
      if (wallet.linked) throw new Error('LINKED_WALLET_REQUIRES_SERVICE');
    }
  }
});

carteiraGrupoSchema.post('find', async function (docs) {
  if (this.getOptions().comment === 'legacy-wallet-read' || !isTargetedWalletRead(this.getFilter())) return;
  await Promise.all((docs || []).map(overlayLinkedBalance));
});
carteiraGrupoSchema.post('findOne', async function (doc) {
  if (this.getOptions().comment === 'legacy-wallet-read' || !isTargetedWalletRead(this.getFilter())) return;
  await overlayLinkedBalance(doc);
});
carteiraGrupoSchema.post('findOneAndUpdate', async function (doc) {
  if (this.getOptions().comment === 'legacy-wallet-read' || !isTargetedWalletRead(this.getFilter())) return;
  await overlayLinkedBalance(doc);
});
carteiraGrupoSchema.post('aggregate', async function (docs) {
  if (this.options.comment === 'legacy-wallet-read') return;
  await Promise.all((docs || []).map(overlayLinkedBalance));
});

carteiraGrupoSchema.pre('save', async function () {
  const changesMoney = this.isModified('gold') || this.isModified('banco.amount');
  if (changesMoney && (this.isNew
    ? (Number(this.gold || 0) !== 0 || Number(this.banco?.amount || 0) !== 0)
    : true)) {
    const wallet = await getWalletBalance(this.idWhatsApp);
    if (wallet.linked) throw new Error('LINKED_WALLET_REQUIRES_SERVICE');
  }
});

// ─── Índices ──────────────────────────────────────────────────────────────────

carteiraGrupoSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });
carteiraGrupoSchema.index({ idGrupo: 1, gold: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, xp: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, mensagens: -1 });
carteiraGrupoSchema.index({ idGrupo: 1, quizPoints: -1 });

// ─── Fórmulas de XP / Nível (fonte única de verdade) ──────────────────────────
// XP total necessário para ALCANÇAR um determinado nível.
// Ex: xpParaLevel(1) = 0, xpParaLevel(2) = 80, xpParaLevel(3) = 211...
function xpParaLevel(level) {
  const lvl = Math.max(1, Math.floor(level));
  return Math.floor(80 * Math.pow(lvl - 1, 1.4));
}

// Nível correspondente a uma quantidade de XP (sempre >= 1)
function levelFromXp(xp) {
  const xpSeguro = Math.max(0, xp || 0);
  return Math.max(1, Math.floor(Math.pow(xpSeguro / 80, 1 / 1.4)) + 1);
}

// Expor as fórmulas como statics — qualquer comando (!level, !ranklevel etc.)
// deve usar ESTAS funções, nunca reimplementar a conta localmente.
carteiraGrupoSchema.statics.xpParaLevel = xpParaLevel;
carteiraGrupoSchema.statics.levelFromXp = levelFromXp;

// ─── incrementXp: forma RECOMENDADA de conceder XP ────────────────────────────
carteiraGrupoSchema.statics.incrementXp = async function (idWhatsApp, idGrupo, amount) {
  if (!idWhatsApp || !idGrupo) return null;
  if (!Number.isFinite(amount) || amount === 0) return null;

  const atualizado = await this.findOneAndUpdate(
    { idWhatsApp, idGrupo },
    { $inc: { xp: amount } },
    { upsert: true, new: true }
  );

  const xpSeguro = Math.max(0, atualizado.xp ?? 0);
  if (xpSeguro !== atualizado.xp) {
    atualizado.xp = xpSeguro;
    await this.updateOne({ _id: atualizado._id }, { $set: { xp: xpSeguro } });
  }

  const levelAntigo = atualizado.level ?? 1;
  const levelNovo   = levelFromXp(xpSeguro);

  if (levelNovo !== levelAntigo) {
    await this.updateOne({ _id: atualizado._id }, { $set: { level: levelNovo } });
    atualizado.level = levelNovo;
  }

  return {
    ...atualizado.toObject(),
    levelUp: levelNovo > levelAntigo,
    levelAnterior: levelAntigo,
  };
};

// ─── Hook: mantém "level" sincronizado com "xp" ao usar .save() ───────────────
carteiraGrupoSchema.pre('save', function (next) {
  if (this.isModified('xp')) {
    this.level = levelFromXp(this.xp);
  }
  next();
});

// ─── Métodos de instância ─────────────────────────────────────────────────────

carteiraGrupoSchema.methods.registrarGold = function (tipo, item, amount, limite = 50) {
  this.goldHistory.push({ type: tipo, item, amount });
  if (this.goldHistory.length > limite) {
    this.goldHistory = this.goldHistory.slice(-limite);
  }
};

carteiraGrupoSchema.methods.getProgressoXp = function () {
  const xpRaw      = Math.max(0, this.xp ?? 0);
  const level      = levelFromXp(xpRaw);
  const xpAnterior = xpParaLevel(level);
  const xpProximo  = xpParaLevel(level + 1);
  const xpNoLevel  = Math.max(0, xpRaw - xpAnterior);
  const necessario = Math.max(1, xpProximo - xpAnterior);
  const progresso  = Math.min(100, Math.floor((xpNoLevel / necessario) * 100));

  return { xp: xpRaw, level, xpNoLevel, xpNecessario: necessario, progresso };
};

carteiraGrupoSchema.methods.toSafeObject = function () {
  return {
    idWhatsApp:   this.idWhatsApp,
    idGrupo:      this.idGrupo,
    nome:         this.nome,
    nomeCustom:   this.nomeCustom,
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