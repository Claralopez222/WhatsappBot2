'use strict';

const CarteiraGrupo = require('../../models/CarteiraGrupo');
const { resolveJidComLid } = require('../identity');

const GOLD_HISTORY_LIMITE = 50;

function assertJid(jid, nome) {
  if (!jid || typeof jid !== 'string' || !jid.trim()) {
    throw new TypeError(`carteira/gold: "${nome}" é obrigatório e deve ser uma string não vazia.`);
  }
}

async function getCarteira(idWhatsApp, idGrupo) {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');
  const idNorm = await resolveJidComLid(idWhatsApp, idGrupo);

  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: idNorm, idGrupo },
    { $setOnInsert: { idWhatsApp: idNorm, idGrupo } },
    { upsert: true, new: true }
  );
}

async function alterarGold(idWhatsApp, idGrupo, valor, descricao = 'sistema') {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');
  idWhatsApp = await resolveJidComLid(idWhatsApp, idGrupo);

  if (typeof valor !== 'number' || isNaN(valor)) {
    throw new TypeError('carteira/gold.alterarGold: "valor" deve ser um número.');
  }

  const tipo     = valor >= 0 ? 'recebido' : 'gasto';
  const absValor = Math.abs(valor);
  const pushGoldHistory = {
    $push: {
      goldHistory: {
        $each:  [{ type: tipo, item: descricao.trim(), amount: absValor }],
        $slice: -GOLD_HISTORY_LIMITE,
      },
    },
  };

  if (valor >= 0) {
    return CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp, idGrupo },
      { $inc: { gold: valor }, ...pushGoldHistory },
      { upsert: true, new: true }
    );
  }

  const atualizado = await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp, idGrupo, gold: { $gte: absValor } },
    { $inc: { gold: valor }, ...pushGoldHistory },
    { new: true }
  );

  if (!atualizado) {
    const carteira = await getCarteira(idWhatsApp, idGrupo);
    throw new RangeError(
      `carteira/gold.alterarGold: saldo insuficiente. Atual: ${carteira.gold} | Tentativa de débito: ${absValor}`
    );
  }

  return atualizado;
}

async function alterarGoldSeguro(idWhatsApp, idGrupo, valor, descricao = 'sistema') {
  if (valor >= 0) return { carteira: await alterarGold(idWhatsApp, idGrupo, valor, descricao), debitado: valor };

  const carteira   = await getCarteira(idWhatsApp, idGrupo);
  const saldoAtual = carteira.gold ?? 0;
  const debitado   = Math.min(saldoAtual, Math.abs(valor));
  if (debitado === 0) return { carteira, debitado: 0 };

  const carteiraAtualizada = await alterarGold(idWhatsApp, idGrupo, -debitado, descricao);
  return { carteira: carteiraAtualizada, debitado };
}

module.exports = { getCarteira, alterarGold, alterarGoldSeguro };