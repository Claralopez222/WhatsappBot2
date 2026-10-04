'use strict';

const crypto = require('crypto');
const axios = require('axios');
const LidMapping = require('../../models/LidMapping');

const WALLET_PATH = '/whatsapp/wallet';
const balanceRequests = new Map();
const balanceGeneration = new Map();

function getWalletConfig() {
  const base = (process.env.ZECA_API_URL || 'https://zeca-jvic.onrender.com')
    .trim()
    .replace(/\/+$/, '');
  const secret = process.env.WHATSAPP_LINK_SECRET || '';
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error('ZECA_API_URL inválida.');
  }
  if (url.protocol !== 'https:' || secret.length < 32) {
    throw new Error('Configure ZECA_API_URL HTTPS e WHATSAPP_LINK_SECRET.');
  }
  return { base, secret };
}

function getExchangeRate(wallet) {
  const rate = Number(wallet?.rate ?? wallet?.walletRate ?? 1);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Taxa de câmbio inválida retornada pelo serviço de carteira.');
  }
  return rate;
}

function localMinorUnitsToBrlCents(localMinorUnits, wallet) {
  const amount = Number(localMinorUnits);
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError('O valor local da carteira deve ser um inteiro seguro.');
  }
  const deltaCents = Math.round(amount / getExchangeRate(wallet));
  if (!Number.isSafeInteger(deltaCents)) {
    throw new RangeError('O valor convertido excede o limite permitido.');
  }
  return deltaCents;
}

function normalizeJid(jid) {
  const [user, server] = String(jid || '').trim().toLowerCase().split('@');
  return user && server ? `${user.split(':')[0]}@${server}` : '';
}

function phoneVariants(jid) {
  const digits = String(jid || '').split('@')[0].replace(/\D/g, '');
  const variants = new Set([digits]);
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 8) variants.add(`55${ddd}9${rest}`);
    else if (rest.length === 9 && rest.startsWith('9')) variants.add(`55${ddd}${rest.slice(1)}`);
  }
  return [...variants].filter(Boolean).map(number => `${number}@s.whatsapp.net`);
}

async function resolvePhoneJid(jid) {
  const normalized = normalizeJid(jid);
  if (normalized.endsWith('@lid')) {
    const mapping = await LidMapping.findOne({ lid: normalized }).select('pn').lean();
    return normalizeJid(mapping?.pn);
  }
  const variants = phoneVariants(normalized);
  if (!variants.length) return normalized;
  const mapping = await LidMapping.findOne({ pn: { $in: variants } }).select('pn').lean();
  return normalizeJid(mapping?.pn || normalized);
}

async function requestWallet(action, jid, deltaCents = '', description = '', recipientJid = '', requestIdOverride = '') {
  const canonicalJid = await resolvePhoneJid(jid);
  if (!/^\d+@s\.whatsapp\.net$/.test(canonicalJid)) {
    return { linked: false };
  }
  const canonicalRecipientJid = recipientJid
    ? await resolvePhoneJid(recipientJid)
    : '';
  if (recipientJid && !/^\d+@s\.whatsapp\.net$/.test(canonicalRecipientJid)) {
    return { linked: true, recipientLinked: false };
  }

  const { base, secret } = getWalletConfig();
  if (requestIdOverride && !/^[a-f\d-]{16,64}$/i.test(requestIdOverride)) {
    throw new TypeError('requestId inválido.');
  }
  const requestId = action === 'balance' ? '' : (requestIdOverride || crypto.randomUUID());
  const delta = action === 'balance' ? '' : String(deltaCents);
  const detail = action === 'balance' ? '' : String(description || 'bot');
  const timestamp = String(Date.now());
  const payload = `${timestamp}\nPOST\n${WALLET_PATH}\n${canonicalJid}\n${action}\n${canonicalRecipientJid}\n${requestId}\n${delta}\n${detail}`;
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  let response;
  try {
    response = await axios.post(`${base}${WALLET_PATH}`, {
      action,
      jid: canonicalJid,
      recipientJid: canonicalRecipientJid,
      requestId,
      deltaCents: delta,
      description: detail,
    }, {
      timeout: 12_000,
      headers: {
        'x-wallet-timestamp': timestamp,
        'x-wallet-signature': signature,
      },
    });
  } catch (error) {
    if (error.response?.status === 404 || error.response?.data?.linked === false) {
      return { linked: false };
    }
    const serverMessage = error.response?.data?.error?.message
      || error.response?.data?.error
      || `Serviço de carteira indisponível: ${error.message}`;
    if (/saldo insuficiente/i.test(String(serverMessage))) {
      throw new RangeError(serverMessage, { cause: error });
    }
    throw new Error(serverMessage, { cause: error });
  }

  const result = response.data?.result;
  if (!result || result.linked === false) return { linked: false };
  if (action === 'transfer' && result.linked === true && result.recipientLinked === false) {
    return { linked: true, recipientLinked: false };
  }
  if (result.linked !== true || !Number.isSafeInteger(result.balanceCents)) {
    throw new Error('Resposta inválida do serviço de carteira.');
  }
  return {
    linked: true,
    balanceCents: Number(result.balanceCents),
    countryCode: result.countryCode || 'BR',
    currencyCode: result.currencyCode || 'BRL',
    rate: Number.isFinite(Number(result.rate)) ? Number(result.rate) : 1,
    rateDate: result.rateDate || null,
  };
}

async function getWalletBalance(jid) {
  const canonicalJid = await resolvePhoneJid(jid);
  const pending = balanceRequests.get(canonicalJid);
  if (pending) return pending;
  const generation = balanceGeneration.get(canonicalJid) || 0;
  const request = requestWallet('balance', canonicalJid);
  balanceRequests.set(canonicalJid, request);
  try {
    return await request;
  } finally {
    if (balanceRequests.get(canonicalJid) === request
        && (balanceGeneration.get(canonicalJid) || 0) === generation) {
      balanceRequests.delete(canonicalJid);
    }
  }
}

async function adjustWallet(jid, deltaCents, description, options = {}) {
  const delta = Number(deltaCents);
  if (!Number.isSafeInteger(delta)) throw new TypeError('deltaCents deve ser um inteiro seguro.');
  if (!delta) return getWalletBalance(jid);
  const canonicalJid = await resolvePhoneJid(jid);
  balanceGeneration.set(canonicalJid, (balanceGeneration.get(canonicalJid) || 0) + 1);
  balanceRequests.delete(canonicalJid);
  return requestWallet('adjust', canonicalJid, delta, description, '', options.requestId || '');
}

async function adjustWalletLocal(jid, localMinorUnits, description, options = {}) {
  const localDelta = Number(localMinorUnits);
  if (!Number.isSafeInteger(localDelta)) {
    throw new TypeError('O valor local deve ser um inteiro seguro.');
  }
  if (!localDelta) return getWalletBalance(jid);
  const canonicalJid = await resolvePhoneJid(jid);
  const wallet = await getWalletBalance(canonicalJid);
  if (!wallet.linked) return { linked: false };
  const deltaCents = localMinorUnitsToBrlCents(localDelta, wallet);
  if (!deltaCents) return wallet;
  balanceGeneration.set(canonicalJid, (balanceGeneration.get(canonicalJid) || 0) + 1);
  balanceRequests.delete(canonicalJid);
  return requestWallet('adjust', canonicalJid, deltaCents, description, '', options.requestId || '');
}

async function transferWallet(senderJid, recipientJid, deltaCents, description) {
  const delta = Number(deltaCents);
  if (!Number.isSafeInteger(delta) || delta <= 0) {
    throw new TypeError('deltaCents de transferência deve ser um inteiro positivo.');
  }
  const canonicalSender = await resolvePhoneJid(senderJid);
  const canonicalRecipient = await resolvePhoneJid(recipientJid);
  if (!/^\d+@s\.whatsapp\.net$/.test(canonicalSender)
      || !/^\d+@s\.whatsapp\.net$/.test(canonicalRecipient)) {
    return { linked: false, recipientLinked: false };
  }
  const senderBalance = await getWalletBalance(canonicalSender);
  if (!senderBalance.linked) return { linked: false, recipientLinked: false };
  const deltaBrlCents = localMinorUnitsToBrlCents(delta, senderBalance);
  if (deltaBrlCents <= 0) {
    throw new RangeError('O valor convertido da transferência deve ser maior que zero.');
  }
  const result = await requestWallet(
    'transfer',
    canonicalSender,
    deltaBrlCents,
    description,
    canonicalRecipient,
  );
  if (result.linked && result.recipientLinked === false) return result;
  if (result.linked) {
    return { ...result, recipientLinked: true };
  }
  return { linked: false, recipientLinked: false };
}

function formatWalletAmount(amountCents, wallet = {}) {
  if (!wallet?.walletLinked && !wallet?.linked) {
    return `${Number(amountCents)} gold`;
  }
  const amount = (Number(amountCents) / 100) * getExchangeRate(wallet);
  const currencyCode = wallet.currencyCode || wallet.walletCurrencyCode || 'BRL';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'symbol',
  }).format(amount);
}

module.exports = {
  getWalletBalance,
  adjustWallet,
  adjustWalletLocal,
  transferWallet,
  formatWalletAmount,
  localMinorUnitsToBrlCents,
  normalizeJid,
  resolvePhoneJid,
};
