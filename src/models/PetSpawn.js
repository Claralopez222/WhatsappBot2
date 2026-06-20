'use strict';

const mongoose = require('mongoose');

const petSpawnSchema = new mongoose.Schema({
  idGrupo: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
    trim:     true,
  },
  ultimoSpawn: {
    type:    Date,
    default: null,
  },
  totalSpawns: {
    type:    Number,
    default: 0,
    min:     0,
  },
  // Controla se o spawn automático está ativo neste grupo.
  // Alterado via !pet on / !pet off (somente admins).
  spawnAtivo: {
    type:    Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.PetSpawn || mongoose.model('PetSpawn', petSpawnSchema);