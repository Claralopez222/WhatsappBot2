'use strict';

const CarteiraGrupo = require('../../models/CarteiraGrupo');
const LidMapping    = require('../../models/LidMapping');
const { normalizarJid } = require('../identity');
const {
  getWalletBalance,
  adjustWallet,
  adjustWalletLocal,
} = require('./wallet');

const GOLD_HISTORY_LIMITE = 50;

function assertJid(jid, nome) {
  if (!jid || typeof jid !== 'string' || !jid.trim()) {
    throw new TypeError(`carteira/gold: "${nome}" é obrigatório e deve ser uma string não vazia.`);
  }
}

function gerarVariantesNumero(termo) {
  const digitos = String(termo || '').replace(/\D/g, '');
  const variantes = new Set([digitos]);
  if (digitos.startsWith('55') && digitos.length >= 12) {
    const ddd = digitos.slice(2, 4);
    const resto = digitos.slice(4);
    if (resto.length === 8) variantes.add(`55${ddd}9${resto}`);
    else if (resto.length === 9 && resto.startsWith('9')) variantes.add(`55${ddd}${resto.slice(1)}`);
  }
  return [...variantes];
}

function mesclarQuantidades(carteiras, campo) {
  const mesclado = {};
  for (const carteira of carteiras) {
    const inventario = carteira[campo];
    const entradas = inventario instanceof Map
      ? inventario.entries()
      : Object.entries(inventario || {});
    for (const [item, valor] of entradas) {
      const quantidade = Number(valor);
      if (Number.isFinite(quantidade) && quantidade > 0) {
        mesclado[item] = (mesclado[item] || 0) + quantidade;
      }
    }
  }
  return mesclado;
}

function equipamentoValido(carteiras, campo, inventario) {
  return carteiras.find(carteira =>
    carteira[campo] && inventario[carteira[campo]] > 0
  )?.[campo] ?? null;
}

async function resolverJidsEquivalentes(idWhatsApp) {
  const jidNorm = normalizarJid(idWhatsApp);
  const variantesPn = gerarVariantesNumero(idWhatsApp.split('@')[0]).map(d => `${d}@s.whatsapp.net`);
  const lidMap = await LidMapping.findOne({ $or: [{ pn: { $in: variantesPn } }, { lid: jidNorm }] }).lean();
  return [...new Set([jidNorm, ...(lidMap ? [lidMap.lid, lidMap.pn] : []), ...variantesPn].filter(Boolean))];
}

async function getCarteira(idWhatsApp, idGrupo) {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');

  const wallet = await getWalletBalance(idWhatsApp);
  if (wallet.linked) {
    const jidsBusca = await resolverJidsEquivalentes(idWhatsApp);
    const carteira = await CarteiraGrupo.findOne({
      idWhatsApp: { $in: jidsBusca },
      idGrupo,
    }).comment('legacy-wallet-read').sort({ xp: -1 }).lean();
    return {
      ...(carteira || { idWhatsApp: normalizarJid(idWhatsApp), idGrupo }),
      gold: wallet.balanceCents,
      balanceCents: wallet.balanceCents,
      walletLinked: true,
      walletCurrencyCode: wallet.currencyCode,
      walletCountryCode: wallet.countryCode,
      walletRate: wallet.rate,
      walletRateDate: wallet.rateDate,
    };
  }

  const jidsBusca = await resolverJidsEquivalentes(idWhatsApp);
  const carteiras = await CarteiraGrupo.find({ idWhatsApp: { $in: jidsBusca }, idGrupo }).sort({ gold: -1, xp: -1 }).lean();

  if (carteiras.length > 0) {
    if (carteiras.length > 1) {
      const principal   = carteiras[0];
      const secundarias = carteiras.slice(1);
      const secIds      = secundarias.map(c => c._id);

      const maxGold  = Math.max(...carteiras.map(c => c.gold || 0));
      const maxXp    = Math.max(...carteiras.map(c => c.xp || 0));
      const maxMsgs  = Math.max(...carteiras.map(c => c.mensagens || 0));
      const maxQuiz  = Math.max(...carteiras.map(c => c.quizPoints || 0));
      const itensRoubo = mesclarQuantidades(carteiras, 'itensRoubo');
      const itensSec = mesclarQuantidades(carteiras, 'itensSec');
      const itensRouboBanco = mesclarQuantidades(carteiras, 'itensRouboBanco');

      const empAtivo   = carteiras.find(c => c.emprestimo?.ativo)?.emprestimo;
      const petAtivo   = carteiras.find(c => c.pet?.name)?.pet;
      const bancoAtivo = carteiras.find(c => (c.banco?.amount || 0) > 0)?.banco;
      const empregoEmpregado = carteiras.find(c => c.empregoAtual && c.empregoAtual !== 'desempregado');

      const updateSet = {
        gold: maxGold,
        xp: maxXp,
        mensagens: maxMsgs,
        quizPoints: maxQuiz,
        itensRoubo,
        equiparoubo: equipamentoValido(carteiras, 'equiparoubo', itensRoubo),
        itensSec,
        equiparsec: equipamentoValido(carteiras, 'equiparsec', itensSec),
        itensRouboBanco,
        equiparouboBanco: equipamentoValido(carteiras, 'equiparouboBanco', itensRouboBanco),
      };
      if (empAtivo)   updateSet.emprestimo = empAtivo;
      if (petAtivo)   updateSet.pet = petAtivo;
      if (bancoAtivo) updateSet.banco = bancoAtivo;
      if (empregoEmpregado) {
        updateSet.empregoAtual             = empregoEmpregado.empregoAtual;
        updateSet.totalTrabalhosComSucesso = empregoEmpregado.totalTrabalhosComSucesso || 0;
        updateSet.ultimoTrabalho           = empregoEmpregado.ultimoTrabalho || null;
        updateSet.historicoSujo            = empregoEmpregado.historicoSujo || false;
        updateSet.demissaoVoluntariaAte    = empregoEmpregado.demissaoVoluntariaAte || null;
      }

      await CarteiraGrupo.deleteMany({ _id: { $in: secIds } });
      const unificada = await CarteiraGrupo.findByIdAndUpdate(
        principal._id,
        { $set: updateSet },
        { new: true }
      );
      return unificada;
    }
    return carteiras[0];
  }

  const primaryJid = jidsBusca[0];
  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: primaryJid, idGrupo },
    { $setOnInsert: { idWhatsApp: primaryJid, idGrupo } },
    { upsert: true, new: true }
  );
}

async function alterarGold(idWhatsApp, idGrupo, valor, descricao = 'sistema', opts = {}) {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');

  const jidsBusca = await resolverJidsEquivalentes(idWhatsApp);

  if (typeof valor !== 'number' || isNaN(valor)) {
    throw new TypeError('carteira/gold.alterarGold: "valor" deve ser um número.');
  }

  let wallet;
  if (opts.allowLinked === true) {
    wallet = await adjustWallet(idWhatsApp, valor, descricao, { requestId: opts.requestId });
  } else {
    wallet = await getWalletBalance(idWhatsApp);
    if (wallet.linked) {
      const erro = new Error('carteira/gold.alterarGold: este fluxo ainda não suporta conta vinculada.');
      erro.code = 'LINKED_NOT_SUPPORTED';
      throw erro;
    }
  }
  if (wallet.linked) {
    return {
      idWhatsApp: normalizarJid(idWhatsApp),
      idGrupo,
      gold: wallet.balanceCents,
      balanceCents: wallet.balanceCents,
      walletLinked: true,
      walletCurrencyCode: wallet.currencyCode,
      walletCountryCode: wallet.countryCode,
      walletRate: wallet.rate,
      walletRateDate: wallet.rateDate,
    };
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
    const res = await CarteiraGrupo.updateMany(
      { idWhatsApp: { $in: jidsBusca }, idGrupo },
      { $inc: { gold: valor }, ...pushGoldHistory }
    );
    if (res.matchedCount === 0) {
      const primaryJid = jidsBusca[0];
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: primaryJid, idGrupo },
        { $inc: { gold: valor }, ...pushGoldHistory },
        { upsert: true, new: true }
      );
    }
    return getCarteira(idWhatsApp, idGrupo);
  }

  const atualizado = await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: { $in: jidsBusca }, idGrupo, gold: { $gte: absValor } },
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

async function alterarGoldLocal(idWhatsApp, idGrupo, valor, descricao = 'sistema') {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo, 'idGrupo');
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor)) {
    throw new TypeError('carteira/gold.alterarGoldLocal: "valor" deve ser um inteiro seguro.');
  }
  const wallet = await adjustWalletLocal(idWhatsApp, valor, descricao);
  if (wallet.linked) {
    return {
      idWhatsApp: normalizarJid(idWhatsApp),
      idGrupo,
      gold: wallet.balanceCents,
      balanceCents: wallet.balanceCents,
      walletLinked: true,
      walletCurrencyCode: wallet.currencyCode,
      walletCountryCode: wallet.countryCode,
      walletRate: wallet.rate,
      walletRateDate: wallet.rateDate,
    };
  }
  return alterarGold(idWhatsApp, idGrupo, valor, descricao);
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

module.exports = { getCarteira, alterarGold, alterarGoldLocal, alterarGoldSeguro };