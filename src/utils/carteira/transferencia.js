'use strict';

const { alterarGold } = require('./gold');

async function transferirGold(deIdWhatsApp, paraIdWhatsApp, idGrupo, valor, descricao = 'transferência') {
  if (valor <= 0) throw new RangeError('transferirGold: valor deve ser positivo.');
  if (deIdWhatsApp === paraIdWhatsApp) throw new Error('transferirGold: remetente e destinatário são o mesmo usuário.');

  const label   = descricao.trim();
  const numDe   = deIdWhatsApp.split('@')[0].split(':')[0];
  const numPara = paraIdWhatsApp.split('@')[0].split(':')[0];

  const carteiraDE = await alterarGold(deIdWhatsApp, idGrupo, -valor, `${label} para @${numPara}`);

  try {
    const carteiraPARA = await alterarGold(paraIdWhatsApp, idGrupo, valor, `${label} de @${numDe}`);
    return { de: carteiraDE, para: carteiraPARA };
  } catch (e) {
    try {
      await alterarGold(deIdWhatsApp, idGrupo, valor, `estorno: falha ao transferir para @${numPara}`);
    } catch (estornoErr) {
      console.error(`❌ FALHA CRÍTICA: débito de ${valor} gold de ${deIdWhatsApp} não pôde ser estornado. Motivo original: ${e.message} | Motivo do estorno: ${estornoErr.message}`);
    }
    throw e;
  }
}

module.exports = { transferirGold };