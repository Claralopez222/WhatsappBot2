'use strict';

const { getPrefix, setPrefix } = require('./persistence');
const GrupoConfig = require('../models/GrupoConfig');

const DEFAULT_PREFIXES = ['!', '.', '/', ',', '#'];

/**
 * Retorna o prefixo ativo para o grupo/chat.
 * @param {string} jid
 * @returns {string}
 */
function getGroupPrefix(jid) {
  return (typeof getPrefix === 'function' ? getPrefix(jid) : '!') || '!';
}

/**
 * Define um novo prefixo para o grupo/chat e persiste no banco/memória.
 * @param {string} jid
 * @param {string} novoPrefixo
 */
async function setGroupPrefix(jid, novoPrefixo) {
  if (!DEFAULT_PREFIXES.includes(novoPrefixo)) {
    throw new Error(`Prefixo inválido. Escolha um dos permitidos: ${DEFAULT_PREFIXES.join(' ')}`);
  }
  if (typeof setPrefix === 'function') {
    setPrefix(jid, novoPrefixo);
  }
  await GrupoConfig.findOneAndUpdate(
    { idGrupo: jid },
    { $set: { prefixo: novoPrefixo } },
    { upsert: true }
  );
}

/**
 * Verifica se o texto começa com qualquer prefixo válido ou o prefixo customizado do grupo.
 * @param {string} text
 * @param {string} [jid]
 * @returns {boolean}
 */
function isAnyCmd(text, jid) {
  if (!text || typeof text !== 'string') return false;
  const pGroup = jid ? getGroupPrefix(jid) : null;
  const allPrefixes = pGroup ? Array.from(new Set([...DEFAULT_PREFIXES, pGroup])) : DEFAULT_PREFIXES;
  return allPrefixes.some(p => text.startsWith(p));
}

/**
 * Verifica se o texto corresponde ao comando específico com qualquer prefixo válido.
 * Ex: matchCmd('!bot off', 'bot', jid) -> true
 * Ex: matchCmd('.bot off', 'bot', jid) -> true
 * @param {string} rawText
 * @param {string} cmdName
 * @param {string} [jid]
 * @returns {boolean}
 */
function matchCmd(rawText, cmdName, jid) {
  if (!rawText || typeof rawText !== 'string') return false;
  const cleanCmd = cmdName.toLowerCase().trim();
  const lowerText = rawText.toLowerCase().trim();
  const firstWord = lowerText.split(/\s+/)[0];

  const pGroup = jid ? getGroupPrefix(jid) : null;
  const allPrefixes = pGroup ? Array.from(new Set([...DEFAULT_PREFIXES, pGroup])) : DEFAULT_PREFIXES;

  return allPrefixes.some(p => firstWord === p + cleanCmd || lowerText.startsWith(p + cleanCmd + ' '));
}

/**
 * Extrai os argumentos limpos de um comando.
 * Ex: extractArgs('!bot off', 'bot', jid) -> 'off'
 * Ex: extractArgs('.bot on', 'bot', jid) -> 'on'
 * @param {string} rawText
 * @param {string} cmdName
 * @param {string} [jid]
 * @returns {string}
 */
function extractArgs(rawText, cmdName, jid) {
  if (!rawText || typeof rawText !== 'string') return '';
  const cleanCmd = cmdName.toLowerCase().trim();
  const pGroup = jid ? getGroupPrefix(jid) : null;
  const allPrefixes = pGroup ? Array.from(new Set([...DEFAULT_PREFIXES, pGroup])) : DEFAULT_PREFIXES;

  for (const p of allPrefixes) {
    const target = p + cleanCmd;
    if (rawText.toLowerCase().startsWith(target)) {
      return rawText.slice(target.length).trim();
    }
  }
  return rawText.trim();
}

module.exports = {
  DEFAULT_PREFIXES,
  getGroupPrefix,
  setGroupPrefix,
  isAnyCmd,
  matchCmd,
  extractArgs,
};
