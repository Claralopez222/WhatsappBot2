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
}, {
  timestamps: true,
});

module.exports = mongoose.models.PetSpawn || mongoose.model('PetSpawn', petSpawnSchema);