'use strict';
const mongoose = require('mongoose');

const aniversarioSchema = new mongoose.Schema({
  idWhatsApp: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
    trim:     true,
  },
  nome: {
    type:    String,
    default: null,
    trim:    true,
  },
  date: {
    type:     String,
    required: true,
    trim:     true,
    validate: {
      validator: (v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v),
      message:   'Data inválida. Use o formato DD/MM/AAAA.',
    },
  },
}, {
  timestamps:  true,
  collection: 'aniversarios', // nome explícito no Mongo
});

module.exports = mongoose.models.Aniversario
  || mongoose.model('Aniversario', aniversarioSchema);