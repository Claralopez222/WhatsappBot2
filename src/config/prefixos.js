'use strict';

// ─── Prefixos Válidos e Helpers de Comparação ────────────────────────────────

const VALID_PREFIXES = ['!', '.', '/', ','];

function isAnyCmd(text) {
  if (typeof text !== 'string') return false;
  return VALID_PREFIXES.some(p => text.startsWith(p));
}

function matchCmd(raw, cmdName) {
  if (typeof raw !== 'string') return false;
  for (const p of VALID_PREFIXES) {
    if (raw === p + cmdName) return true;
  }
  return false;
}

function matchCmdStart(raw, cmdName) {
  if (typeof raw !== 'string') return false;
  for (const p of VALID_PREFIXES) {
    if (raw.startsWith(p + cmdName)) return true;
  }
  return false;
}

module.exports = {
  VALID_PREFIXES,
  isAnyCmd,
  matchCmd,
  matchCmdStart,
};
