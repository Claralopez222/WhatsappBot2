'use strict';
const mongoose = require('mongoose');

const grupoConfigSchema = new mongoose.Schema(
  {
    idGrupo: { type: String, required: true, unique: true, trim: true, index: true },

    // ── Prefixo ──────────────────────────────────────────────────
    prefixo: {
      type:      String,
      default:   '!',
      enum:      ['!', '.', '/', ','],
      trim:      true,
    },

    // ── Moderação ────────────────────────────────────────────────
    antiLink:    { type: Boolean, default: false },
    autoSticker: { type: Boolean, default: false },
    slowMode:    { type: Boolean, default: false },
    slowModeMs:  { type: Number,  default: 5000, min: 1000 }, // intervalo em ms
    antiFlood:   { type: Boolean, default: false },

    // ── Sistemas ─────────────────────────────────────────────────
    sistemaAniversario: { type: Boolean, default: false },
    sistemaPet:         { type: Boolean, default: false },
    sistemaGold:        { type: Boolean, default: false },
    medievalAtivo:      { type: Boolean, default: false },

    // ── Bem-vindo ────────────────────────────────────────────────
    bemVindoAtivo:    { type: Boolean, default: false },
    bemVindoMensagem: { type: String,  default: null,  trim: true },
  },
  {
    timestamps: true,
    collection: 'grupoconfigs',
  }
);

module.exports =
  mongoose.models.GrupoConfig ||
  mongoose.model('GrupoConfig', grupoConfigSchema);