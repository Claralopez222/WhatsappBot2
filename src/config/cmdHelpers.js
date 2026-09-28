'use strict';

const { DEFAULT_PREFIXES } = require('./cmdHelpers');

// ─── Prefixos Válidos e Helpers de Comparação ────────────────────────────────
// Fonte única: utils/prefixos.js (fallback para a lista antiga se vier vazia).
const VALID_PREFIXES = (Array.isArray(DEFAULT_PREFIXES) && DEFAULT_PREFIXES.length)
  ? DEFAULT_PREFIXES
  : ['!', '.', '/', ','];

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

/**
 * Devolve os argumentos depois do comando, com QUALQUER prefixo válido.
 * Substitui os caption.replace(...) com regex fixa espalhados no router,
 * que não reconhecem '#'. Recebe o texto ORIGINAL (não o minúsculo).
 */
function extrairArgs(texto, cmdName) {
  if (typeof texto !== 'string') return '';
  const lower = texto.toLowerCase();
  for (const p of VALID_PREFIXES) {
    const alvo = p + cmdName;
    if (lower.startsWith(alvo)) return texto.slice(alvo.length).trim();
  }
  return texto.trim();
}

module.exports = {
  VALID_PREFIXES,
  isAnyCmd,
  matchCmd,
  matchCmdStart,
  extrairArgs,
};
