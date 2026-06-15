'use strict';

/**
 * Normaliza um JID de remetente para uso como identidade (idWhatsApp).
 *
 * Regras:
 * - Sempre lowercase.
 * - Remove sufixo de dispositivo (ex: "5511999:12@s.whatsapp.net" → "5511999@s.whatsapp.net").
 * - NUNCA troca o domínio (@s.whatsapp.net / @lid) por outro.
 *   Um "@lid" continua "@lid" — não existe conversão segura de @lid
 *   para número de telefone sem o mapeamento oficial do WhatsApp.
 *
 * @param {string} rawJid
 * @returns {string|null}
 */
function normalizarJid(rawJid) {
  if (!rawJid) return null;
  const jid = rawJid.toLowerCase();

  const [userPart, domain] = jid.split('@');
  if (!domain || !userPart) return null;

  const numero = userPart.split(':')[0]; // remove sufixo de dispositivo (:12)
  if (!numero) return null;

  return `${numero}@${domain}`;
}

/**
 * Extrai apenas os dígitos do JID — usado para exibir "@numero" em
 * mentions. Funciona tanto para @s.whatsapp.net quanto @lid.
 */
function extrairNumero(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

module.exports = { normalizarJid, extrairNumero };