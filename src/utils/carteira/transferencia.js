'use strict';

const crypto = require('crypto');
const { alterarGold } = require('./gold');
const {
  getWalletBalance,
  transferWallet,
  adjustWalletLocal,
} = require('./wallet');

function getJidBase(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

function erroComCodigo(mensagem, code, Tipo = Error) {
  const erro = new Tipo(mensagem);
  erro.code = code;
  return erro;
}

async function transferirGold(deIdWhatsApp, paraIdWhatsApp, idGrupo, valor, descricao = 'transferência') {
  const val = Math.floor(Number(valor));
  if (!Number.isSafeInteger(val) || val <= 0) {
    throw new RangeError('transferirGold: valor deve ser um número inteiro positivo.');
  }

  const baseDe   = getJidBase(deIdWhatsApp);
  const basePara = getJidBase(paraIdWhatsApp);

  if (baseDe === basePara) {
    throw new Error('transferirGold: remetente e destinatário são o mesmo usuário.');
  }

  const [walletDe, walletPara] = await Promise.all([
    getWalletBalance(deIdWhatsApp),
    getWalletBalance(paraIdWhatsApp),
  ]);
  // Vinculado -> não vinculado: debita o saldo do app e credita o gold legado do destinatário.
  // Os requestIds são gerados uma vez por chamada; não há nova tentativa automática.
  if (walletDe.linked && !walletPara.linked) {
    const idDebito  = crypto.randomUUID();
    const idEstorno = crypto.randomUUID();
    const rotulo    = (descricao || 'transferência').trim();

    let debito;
    try {
      debito = await adjustWalletLocal(
        deIdWhatsApp,
        -val,
        `${rotulo} para @${basePara}`,
        { requestId: idDebito },
      );
    } catch (e) {
      if (/saldo insuficiente/i.test(e.message)) {
        throw erroComCodigo('transferirGold: saldo insuficiente.', 'SALDO_INSUFICIENTE', RangeError);
      }
      if (e instanceof RangeError) {
        throw erroComCodigo(e.message, 'VALOR_MINIMO_CONVERSAO');
      }
      throw e;
    }

    // Se a conversão deu 0 centavos, nada foi debitado: não pode creditar o destinatário.
    if (!Number.isSafeInteger(debito?.balanceCents)
        || (Number.isSafeInteger(walletDe.balanceCents) && debito.balanceCents >= walletDe.balanceCents)) {
      throw erroComCodigo('Valor convertido não gerou débito.', 'VALOR_MINIMO_CONVERSAO');
    }

    let carteiraPARA;
    try {
      carteiraPARA = await alterarGold(paraIdWhatsApp, idGrupo, val, `${rotulo} de @${baseDe}`);
    } catch (e) {
      try {
        await adjustWalletLocal(
          deIdWhatsApp,
          val,
          `estorno: falha ao transferir para @${basePara}`,
          { requestId: idEstorno },
        );
      } catch (estornoErr) {
        console.error(`❌ FALHA CRÍTICA: débito de ${val} de ${deIdWhatsApp} no app não pôde ser estornado. Motivo original: ${e.message} | Motivo do estorno: ${estornoErr.message}`);
      }
      throw e;
    }

    const carteiraDe = {
      idWhatsApp: deIdWhatsApp,
      idGrupo,
      gold: debito.balanceCents,
      balanceCents: debito.balanceCents,
      walletLinked: true,
      walletCurrencyCode: debito.currencyCode,
      walletCountryCode: debito.countryCode,
      walletRate: debito.rate,
      walletRateDate: debito.rateDate,
    };
    return { de: carteiraDe, para: carteiraPARA };
  }

  if (walletDe.linked || walletPara.linked) {
    if (!walletDe.linked || !walletPara.linked) {
      throw erroComCodigo('LINKED_UNLINKED_TRANSFER_NOT_ALLOWED', 'LINKED_UNLINKED_TRANSFER_NOT_ALLOWED');
    }
    let transferencia;
    try {
      transferencia = await transferWallet(deIdWhatsApp, paraIdWhatsApp, val, descricao);
    } catch (e) {
      if (/saldo insuficiente/i.test(e.message)) {
        throw erroComCodigo('transferirGold: saldo insuficiente.', 'SALDO_INSUFICIENTE', RangeError);
      }
      // "Valor convertido ≤ 0" não é falta de saldo: sai como Error comum para o handler
      // não responder "saldo insuficiente" por engano.
      if (e instanceof RangeError) {
        throw erroComCodigo(e.message, 'VALOR_MINIMO_CONVERSAO');
      }
      throw e;
    }
    if (!transferencia.linked || transferencia.recipientLinked === false) {
      throw erroComCodigo('LINKED_TRANSFER_RECIPIENT_NOT_LINKED', 'LINKED_TRANSFER_RECIPIENT_NOT_LINKED');
    }
    const carteiraDe = {
      idWhatsApp: deIdWhatsApp,
      idGrupo,
      gold: transferencia.balanceCents,
      balanceCents: transferencia.balanceCents,
      walletLinked: true,
      walletCurrencyCode: transferencia.currencyCode,
      walletCountryCode: transferencia.countryCode,
      walletRate: transferencia.rate,
      walletRateDate: transferencia.rateDate,
    };
    return { de: carteiraDe, para: { idWhatsApp: paraIdWhatsApp, idGrupo, walletLinked: true } };
  }

  const label   = (descricao || 'transferência').trim();
  const numDe   = baseDe;
  const numPara = basePara;

  const carteiraDE = await alterarGold(deIdWhatsApp, idGrupo, -val, `${label} para @${numPara}`);

  try {
    const carteiraPARA = await alterarGold(paraIdWhatsApp, idGrupo, val, `${label} de @${numDe}`);
    return { de: carteiraDE, para: carteiraPARA };
  } catch (e) {
    try {
      await alterarGold(deIdWhatsApp, idGrupo, val, `estorno: falha ao transferir para @${numPara}`);
    } catch (estornoErr) {
      console.error(`❌ FALHA CRÍTICA: débito de ${val} gold de ${deIdWhatsApp} não pôde ser estornado. Motivo original: ${e.message} | Motivo do estorno: ${estornoErr.message}`);
    }
    throw e;
  }
}

module.exports = { transferirGold };