'use strict';

const mongoose = require('mongoose');

const whatsappWalletMigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    jid: { type: String, required: true },
    linkedAtMs: { type: Number, required: true },
    goldCents: { type: Number, required: true, min: 0 },
    bankCents: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

module.exports = mongoose.models.WhatsappWalletMigration
  || mongoose.model('WhatsappWalletMigration', whatsappWalletMigrationSchema);
