'use strict';

const CarteiraGrupo   = require('../../../models/CarteiraGrupo');
const { getCarteira } = require('../../../utils/carteira');
const { resolveGlobalId } = require('../../../utils/identity');
const { ITENS_LOJA } = require('../../../config/economia');
const { VARAS_PESCA, ISCAS } = require('../pesca');

// ─── Normalização para aceitar tanto a chave quanto o nome de exibição ──────
// Remove acentos, espaços e pontuação, deixando só letras/números minúsculos.
// Usado por !give, !buy e !vender para aceitar tanto a chave técnica
// (ex: "linguica") quanto o nome de exibição (ex: "Linguiça", "PC Gamer Lendário").
function normalizarChaveItem(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '');                         // remove espaços/pontuação
}

function buildLookup(catalogo = {}) {
  const map = {};
  for (const [key, info] of Object.entries(catalogo)) {
    map[normalizarChaveItem(key)]       = key;
    map[normalizarChaveItem(info.nome)] = key;
  }
  return map;
}

const LOOKUP_ITENS_LOJA  = buildLookup(ITENS_LOJA);
const LOOKUP_VARAS_PESCA = buildLookup(VARAS_PESCA || {});
const LOOKUP_ISCAS       = buildLookup(ISCAS || {});

/**
 * Resolve um texto digitado pelo usuário (chave técnica ou nome de exibição,
 * com ou sem acento/espaço) para a chave real do catálogo correspondente.
 * Procura primeiro em ITENS_LOJA, depois VARAS_PESCA, depois ISCAS.
 * Retorna null se não encontrar em nenhum catálogo.
 */
function resolverItemKey(itemDigitado) {
  const chaveNorm = normalizarChaveItem(itemDigitado);
  return LOOKUP_ITENS_LOJA[chaveNorm]
    || LOOKUP_VARAS_PESCA[chaveNorm]
    || LOOKUP_ISCAS[chaveNorm]
    || null;
}

/**
 * Retorna o gold local do usuário neste grupo.
 */
async function getSaldoGrupo(userId, idGrupo) {
  const carteira = await getCarteira(userId, idGrupo);
  return carteira?.gold ?? 0;
}

/**
 * Debita gold localmente de forma atômica.
 * Retorna o documento atualizado, ou null se saldo insuficiente.
 *
 * `userId` deve vir de resolveGlobalId()/resolveUserFromMsg() já; o
 * resolveGlobalId aqui dentro é só uma segunda camada de segurança
 * (idempotente) caso algum call site esqueça de normalizar antes.
 */
async function debitarGold(userId, idGrupo, valor, descricao) {
  const idNorm = resolveGlobalId(userId);
  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: idNorm, idGrupo, gold: { $gte: valor } },
    {
      $inc: { gold: -valor },
      $push: {
        goldHistory: {
          $each: [{ type: 'gasto', item: descricao, amount: valor }],
          $slice: -50,
        },
      },
    },
    { new: true }
  );
}

module.exports = {
  normalizarChaveItem,
  buildLookup,
  LOOKUP_ITENS_LOJA,
  LOOKUP_VARAS_PESCA,
  LOOKUP_ISCAS,
  resolverItemKey,
  getSaldoGrupo,
  debitarGold,
};