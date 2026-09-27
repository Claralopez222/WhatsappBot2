'use strict';

const fs   = require('fs');
const path = require('path');

function getAlvo(contextInfo, senderJid, contactNames) {
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const alvoJid = mentionedJid || senderJid;
  const numero = alvoJid.split('@')[0];
  const nome = contactNames?.[alvoJid] || `@${numero}`;
  return { alvoJid, mentionedJid, nome };
}

function buildBar(pct, emoji = '🟩') {
  const filled = Math.round(pct / 10);
  return emoji.repeat(filled) + '⬜'.repeat(10 - filled);
}

module.exports = {
  getAlvo,
  buildBar,
};
