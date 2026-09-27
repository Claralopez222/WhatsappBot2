'use strict';

const mongoose = require('mongoose');
const CarteiraGrupo = require('../../models/CarteiraGrupo');

/**
 * Compra genérica: debita gold da CarteiraGrupo e credita `quantidade` de um
 * item num campo Map de inventário — tudo dentro de uma transação Mongo.
 * Substitui o padrão "debita → credita → estorna se falhar" (que existia em
 * handleComprar/loja.js): se o processo cair no meio, o Mongo desfaz tudo
 * sozinho, sem risco de ficar com o gold debitado e o item não creditado.
 *
 * @param {object} params
 * @param {string} params.idWhatsApp
 * @param {string} params.idGrupo
 * @param {number} params.preco
 * @param {string} params.descricaoGold      - label pro goldHistory (ex: "Compra: Pizza")
 * @param {import('mongoose').Model} params.modeloInventario - model onde o item é creditado (Usuario, CarteiraGrupo, etc.)
 * @param {object} params.filtroInventario   - filtro pra achar o doc (ex: { idWhatsApp })
 * @param {string} params.campoInventario    - caminho do campo Map (ex: 'inventory.pizza', 'itensPesca.vara_bambu')
 * @param {number} [params.quantidade=1]
 * @returns {Promise<{ ok: true, carteira: object } | { ok: false, motivo: 'GOLD_INSUFICIENTE' | 'ERRO' }>}
 */
async function comprarComGold({
  idWhatsApp,
  idGrupo,
  preco,
  descricaoGold,
  modeloInventario,
  filtroInventario,
  campoInventario,
  quantidade = 1,
}) {
  const session = await mongoose.startSession();
  let carteiraAtualizada;

  try {
    await session.withTransaction(async () => {
      carteiraAtualizada = await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp, idGrupo, gold: { $gte: preco } },
        {
          $inc: { gold: -preco },
          $push: {
            goldHistory: {
              $each: [{ type: 'gasto', item: descricaoGold, amount: preco }],
              $slice: -50,
            },
          },
        },
        { new: true, session }
      );

      if (!carteiraAtualizada) {
        throw new Error('GOLD_INSUFICIENTE');
      }

      await modeloInventario.findOneAndUpdate(
        filtroInventario,
        { $inc: { [campoInventario]: quantidade } },
        { upsert: true, session }
      );
    });
  } catch (err) {
    await session.endSession();
    if (err.message === 'GOLD_INSUFICIENTE') {
      return { ok: false, motivo: 'GOLD_INSUFICIENTE' };
    }
    console.error('⚠️ Erro em comprarComGold:', err.message);
    return { ok: false, motivo: 'ERRO' };
  }

  await session.endSession();
  return { ok: true, carteira: carteiraAtualizada };
}

module.exports = { comprarComGold };