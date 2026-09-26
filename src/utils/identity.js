'use strict';

const { normalizarJid, extrairNumero } = require('./jid');

// ─── Identidade do usuário ──────────────────────────────────────────────────
//
// Este módulo centraliza a resolução de "quem enviou a mensagem" para um
// JID normalizado e estável, usado como chave em Usuario / CarteiraGrupo.
//
// IMPORTANTE — comportamento preservado de propósito:
// O padrão espalhado hoje pelo código (handlers/diversao/economia.js,
// handlers/grupo.js, etc.) é:
//
//   userIdRaw?.endsWith('@lid')
//     ? userIdRaw
//     : userIdRaw.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net'
//
// Ou seja: se o JID já é @lid, mantém como está; caso contrário, extrai só
// os dígitos e força o domínio @s.whatsapp.net. Isso é DIFERENTE de
// normalizarJid() (jid.js), que preserva o domínio original e não filtra
// caracteres não-numéricos do usuário.
//
// resolveGlobalId() replica esse comportamento de propósito — é uma
// extração 1:1 do padrão atual, não uma reinterpretação dele. Trocar essa
// regra de normalização é uma decisão de migração de dados separada
// (afetaria todo documento já salvo no Mongo) e não faz parte deste refactor.

/**
 * Extrai o JID "cru" de quem enviou a mensagem.
 * Em grupos: msg.key.participant. Em PV: msg.key.remoteJid.
 *
 * @param {object} msg - objeto de mensagem do Baileys
 * @returns {string|null}
 */
function getSenderJid(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

/**
 * Normaliza um JID para o formato usado como identidade nos models
 * (Usuario.idWhatsApp, CarteiraGrupo.idWhatsApp).
 *
 * Regra (preservada do padrão atual, ver nota acima do arquivo):
 * - "@lid"  → mantém como está, só limpa sufixo de dispositivo.
 * - demais  → extrai só os dígitos e força "@s.whatsapp.net".
 *
 * @param {string} jidRaw
 * @returns {string|null}
 */
function resolveGlobalId(jidRaw) {
  if (!jidRaw || typeof jidRaw !== 'string') return null;

  if (jidRaw.endsWith('@lid')) {
    // normalizarJid só remove sufixo de dispositivo e faz lowercase —
    // não troca o domínio, então é seguro aqui.
    return normalizarJid(jidRaw);
  }

  const numero = extrairNumero(jidRaw);
  return numero ? `${numero}@s.whatsapp.net` : null;
}

/**
 * Atalho para o caso mais comum em handlers: pegar o remetente da
 * mensagem já normalizado, pronto para usar em queries do Mongo.
 *
 * Equivale a resolveGlobalId(getSenderJid(msg)), mas com um nome
 * expressivo no call site.
 *
 * @param {object} msg
 * @returns {string|null}
 */
function resolveUserFromMsg(msg) {
  return resolveGlobalId(getSenderJid(msg));
}

// ─── Reexporta helpers de jid.js ────────────────────────────────────────────
// Para handlers que hoje fazem dois requires (jid.js + a lógica de userId),
// bastar importar só de identity.js.

module.exports = {
  getSenderJid,
  resolveGlobalId,
  resolveUserFromMsg,
  normalizarJid,
  extrairNumero,
};