'use strict';
const mongoose = require('mongoose');

const medievalPersonagemSchema = new mongoose.Schema(
  {
    idWhatsApp: { type: String, required: true, trim: true, lowercase: true },
    idGrupo:    { type: String, required: true, trim: true, lowercase: true },

    // ── Identidade ───────────────────────────────────────────────
    nome:    { type: String, default: null },
    classe:  { type: String, default: null },
    elemento:{ type: String, default: null },

    // ── Status base ──────────────────────────────────────────────
    hp:      { type: Number, default: 100, min: 0 },
    hpMax:   { type: Number, default: 100 },
    mana:    { type: Number, default: 80,  min: 0 },
    manaMax: { type: Number, default: 80 },
    ataque:  { type: Number, default: 10 },
    defesa:  { type: Number, default: 5  },

    // ── Progressão ───────────────────────────────────────────────
    nivel:      { type: Number, default: 1, min: 1 },
    xpMedieval: { type: Number, default: 0, min: 0 },
    vitorias:   { type: Number, default: 0, min: 0 },
    derrotas:   { type: Number, default: 0, min: 0 },

    // ── Equipamentos ─────────────────────────────────────────────
    armaEquipada:    { type: String, default: null },
    armaduraEquipada:{ type: String, default: null },

    // ── Inventário de itens medievais ────────────────────────────
    inventarioMedieval: {
      type: Map,
      of:   Number,
      default: {},
    },

    // ── Habilidades desbloqueadas ────────────────────────────────
    habilidades: { type: [String], default: [] },

    // ── Cooldowns ────────────────────────────────────────────────
    ultimoAtaque:  { type: Date, default: null },
    ultimaMagia:   { type: Date, default: null },
    ultimaMissao:  { type: Date, default: null },
    ultimaRecarga: { type: Date, default: null },
  },
  { timestamps: true }
);

medievalPersonagemSchema.index({ idWhatsApp: 1, idGrupo: 1 }, { unique: true });
medievalPersonagemSchema.index({ idGrupo: 1, vitorias: -1 });
medievalPersonagemSchema.index({ idGrupo: 1, nivel: -1 });

module.exports =
  mongoose.models.MedievalPersonagem ||
  mongoose.model('MedievalPersonagem', medievalPersonagemSchema);