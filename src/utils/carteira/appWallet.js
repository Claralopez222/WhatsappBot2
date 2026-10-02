'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { resolvePhoneAndJid } = require('../identity');

const WALLET_PATH = '/whatsapp/wallet';

function normalizePhoneJid(jid) {
  const number = String(jid || '').trim().toLowerCase().split('@')[0].split(':')[0];
  return /^\d+$/.test(number) ? `${number}@s.whatsapp.net` : '';
}

async function requestAppWallet(action, jid, options = {}) {
  const phoneJid = normalizePhoneJid(jid);
  if (!phoneJid) return null;

  const baseUrl = (process.env.ZECA_API_URL || 'https://zeca-jvic.onrender.com').trim().replace(/\/+$/, '');
  const secret = process.env.WHATSAPP_LINK_SECRET;
  let apiUrl;
  try {
    apiUrl = new URL(baseUrl);
  } catch {
    throw new Error('ZECA_API_URL inválida para consultar a carteira compartilhada.');
  }
  if (apiUrl.protocol !== 'https:' || !secret || secret.length < 32) {
    throw new Error('Configure ZECA_API_URL HTTPS e WHATSAPP_LINK_SECRET para usar a carteira compartilhada.');
  }

  const recipientJid = options.recipientJid || '';
  const requestId = options.requestId || '';
  const deltaCents = options.deltaCents ?? '';
  const description = options.description || '';
  const timestamp = String(Date.now());
  const canonical = [
    timestamp,
    'POST',
    WALLET_PATH,
    phoneJid,
    action,
    recipientJid,
    requestId,
    deltaCents,
    description,
  ].join('\n');
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

  let response;
  try {
    response = await axios.post(
      `${apiUrl.origin}${WALLET_PATH}`,
      {
        action,
        jid: phoneJid,
        recipientJid,
        requestId,
        deltaCents,
        description,
      },
      {
        timeout: 15_000,
        headers: {
          'x-wallet-timestamp': timestamp,
          'x-wallet-signature': signature,
        },
      },
    );
  } catch (error) {
    const message = error.response?.data?.error?.message;
    if (message === 'Saldo insuficiente.') throw new RangeError(message);
    if (typeof message === 'string' && message) throw new Error(message);
    throw error;
  }

  const result = response.data?.result;
  if (!result || typeof result !== 'object') {
    throw new Error('O servidor do app retornou uma carteira compartilhada inválida.');
  }
  return result;
}

async function consultarSaldoVinculado(jid) {
  const result = await requestAppWallet('balance', jid);
  if (!result?.linked) return null;
  if (!Number.isSafeInteger(result.balanceCents) || result.balanceCents < 0
      || !Number.isFinite(result.rate) || result.rate <= 0
      || typeof result.currencyCode !== 'string'
      || typeof result.countryCode !== 'string') {
    throw new Error('O servidor do app retornou dados inválidos para a carteira compartilhada.');
  }
  return result;
}

async function consultarSaldoPorIdentidade(idWhatsApp) {
  const identity = await resolvePhoneAndJid(String(idWhatsApp || ''));
  return identity.pnJid ? consultarSaldoVinculado(identity.pnJid) : null;
}

async function ajustarSaldoPorIdentidade(idWhatsApp, deltaCents, description, requestId) {
  const identity = await resolvePhoneAndJid(String(idWhatsApp || ''));
  return identity.pnJid
    ? ajustarSaldoVinculado(identity.pnJid, deltaCents, description, requestId)
    : null;
}

async function ajustarSaldoVinculado(jid, deltaCents, description, requestId = crypto.randomUUID()) {
  const result = await requestAppWallet('adjust', jid, {
    requestId,
    deltaCents,
    description,
  });
  if (!result?.linked) return null;
  if (!Number.isSafeInteger(result.balanceCents) || result.balanceCents < 0) {
    throw new Error('O servidor do app retornou um saldo inválido após a movimentação.');
  }
  return result;
}

async function transferirSaldoVinculado(jid, recipientJid, amountCents, description, requestId = crypto.randomUUID()) {
  const result = await requestAppWallet('transfer', jid, {
    recipientJid: normalizePhoneJid(recipientJid),
    requestId,
    deltaCents: amountCents,
    description,
  });
  if (!result?.linked) return null;
  if (result.recipientLinked !== true
      || !Number.isSafeInteger(result.balanceCents) || result.balanceCents < 0) {
    throw new Error('Não foi possível transferir: a conta de destino não está vinculada ao app.');
  }
  return result;
}

function formatarMoeda(centavos, currencyInfo = {}) {
  const currencyCode = String(currencyInfo.currencyCode || 'BRL').toUpperCase();
  const countryCode = String(currencyInfo.countryCode || 'BR').toUpperCase();
  const rate = Number.isFinite(currencyInfo.rate) && currencyInfo.rate > 0 ? currencyInfo.rate : 1;
  const locale = `pt-${countryCode}`;
  const valor = (Number(centavos) / 100) * rate;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(valor);
  } catch {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(centavos) / 100);
  }
}

module.exports = {
  ajustarSaldoVinculado,
  ajustarSaldoPorIdentidade,
  consultarSaldoVinculado,
  consultarSaldoPorIdentidade,
  formatarMoeda,
  normalizePhoneJid,
  transferirSaldoVinculado,
};
