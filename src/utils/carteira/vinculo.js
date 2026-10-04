'use strict';

const { getWalletBalance } = require('./wallet');

// true = vinculada, false = não vinculada, null = não deu para saber (falha fechada)
async function contaVinculada(jid) {
  try {
    return (await getWalletBalance(jid)).linked === true;
  } catch {
    return null;
  }
}

// Retorna true (e já responde) se alguma conta é vinculada ou não deu para verificar.
async function bloqueadoPorVinculo(sock, msg, jid, ...jids) {
  const estados = await Promise.all(jids.map(contaVinculada));
  if (estados.includes(null)) {
    await sock.sendMessage(jid, {
      text: '⚠️ Carteira temporariamente indisponível. Tente novamente em instantes.',
    }, { quoted: msg });
    return true;
  }
  if (estados.includes(true)) {
    await sock.sendMessage(jid, {
      text: '🔒 Este recurso ainda não está disponível para contas vinculadas ao app.',
    }, { quoted: msg });
    return true;
  }
  return false;
}

module.exports = { contaVinculada, bloqueadoPorVinculo };