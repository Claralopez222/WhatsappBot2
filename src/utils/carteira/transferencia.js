'use strict';

const { alterarGold } = require('./gold');

function getJidBase(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0];
}

async function transferirGold(deIdWhatsApp, paraIdWhatsApp, idGrupo, valor, descricao = 'transferência') {
  const val = Math.floor(Number(valor));
  if (isNaN(val) || val <= 0 || !Number.isFinite(val)) {
    throw new RangeError('transferirGold: valor deve ser um número inteiro positivo.');
  }

  const baseDe   = getJidBase(deIdWhatsApp);
  const basePara = getJidBase(paraIdWhatsApp);

  if (baseDe === basePara) {
    throw new Error('transferirGold: remetente e destinatário são o mesmo usuário.');
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