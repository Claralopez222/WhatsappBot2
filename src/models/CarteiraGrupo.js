const mongoose = require('mongoose');

const carteiraGrupoSchema = new mongoose.Schema(
  {
    idWhatsApp: { type: String, required: true },
    idGrupo:    { type: String, required: true },

    // ── Economia local do grupo ──────────────────────────────────
    gold:       { type: Number, default: 0 },
    quizPoints: { type: Number, default: 0 },
    mensagens:  { type: Number, default: 0 },  // ranking local
    xp:         { type: Number, default: 0 },
    level:      { type: Number, default: 1 },

    // Histórico de movimentações neste grupo
    goldHistory: [
      {
        type:   { type: String, enum: ['recebido', 'gasto'], required: true },
        item:   { type: String, required: true },
        amount: { type: Number, required: true },
        date:   { type: Date,   default: Date.now },
      },
    ],
  },
  {
    timestamps: true,

    // ── Índice único composto: mesmo usuário não pode ter dois
    //    documentos no mesmo grupo ────────────────────────────────
  }
);

// Índice único composto — garante unicidade por (usuário + grupo)
carteiraGrupoSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });

// Índice para ranking local (busca os top-N de um grupo por gold)
carteiraGrupoSchema.index({ idGrupo: 1, gold: -1 });

module.exports =
  mongoose.models.CarteiraGrupo ||
  mongoose.model('CarteiraGrupo', carteiraGrupoSchema);