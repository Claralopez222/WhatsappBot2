'use strict';

const CarteiraGrupo = require('../models/CarteiraGrupo');

// ─── Constantes ───────────────────────────────────────────────────────────────

const GOLD_HISTORY_LIMITE = 50;
const GOLD_MIN            = 0; // saldo nunca fica negativo

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Valida e normaliza um JID. Lança erro se estiver ausente.
 * @param {string} jid
 * @param {string} nome - nome do parâmetro para mensagem de erro
 */
function assertJid(jid, nome) {
  if (!jid || typeof jid !== 'string' || !jid.trim()) {
    throw new TypeError(`carteiraService: "${nome}" é obrigatório e deve ser uma string não vazia.`);
  }
}

// ─── getCarteira ──────────────────────────────────────────────────────────────

/**
 * Retorna (ou cria) a carteira de um usuário em um grupo específico.
 *
 * Usa upsert para garantir atomicidade: não há race condition entre
 * "verificar se existe" e "criar". Seguro para chamadas concorrentes.
 *
 * @param {string} idWhatsApp - JID do usuário  (ex: "5511999@s.whatsapp.net")
 * @param {string} idGrupo    - JID do grupo    (ex: "120363@g.us")
 * @returns {Promise<import('../models/CarteiraGrupo').default>}
 */
async function getCarteira(idWhatsApp, idGrupo) {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');

  // Normaliza: remove sufixo de dispositivo (:83) e garante @s.whatsapp.net
  const idNorm = idWhatsApp.endsWith('@lid')
    ? idWhatsApp
    : idWhatsApp.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';

  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: idNorm, idGrupo },
    { $setOnInsert: { idWhatsApp: idNorm, idGrupo } },  // ← idNorm
    { upsert: true, new: true }
  );
}

// ─── alterarGold ──────────────────────────────────────────────────────────────

/**
 * Adiciona (ou subtrai) gold na carteira do usuário no grupo.
 *
 * - Impede saldo negativo: se `valor` for negativo e o saldo atual for
 *   insuficiente, lança um erro em vez de deixar gold < 0.
 * - Registra a movimentação no goldHistory (máximo de 50 entradas).
 * - Retorna o documento atualizado.
 *
 * @param {string} idWhatsApp
 * @param {string} idGrupo
 * @param {number} valor       - positivo = ganho | negativo = gasto
 * @param {string} descricao   - label para o histórico (ex: "Quiz vitória")
 * @returns {Promise<import('../models/CarteiraGrupo').default>}
 * @throws {RangeError} se o saldo for insuficiente para um débito
 */
async function alterarGold(idWhatsApp, idGrupo, valor, descricao = 'sistema') {
  assertJid(idWhatsApp, 'idWhatsApp');
  assertJid(idGrupo,    'idGrupo');

  const idNorm = idWhatsApp.endsWith('@lid')
    ? idWhatsApp
    : idWhatsApp.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';
  idWhatsApp = idNorm;

  if (typeof valor !== 'number' || isNaN(valor)) {
    throw new TypeError('carteiraService.alterarGold: "valor" deve ser um número.');
  }

  const tipo      = valor >= 0 ? 'recebido' : 'gasto';
  const absValor  = Math.abs(valor);

  // Garante que o saldo nunca fique negativo: usa $max para travar no mínimo
  // Para débitos: verifica antes se há saldo suficiente
  if (valor < 0) {
    const carteira = await getCarteira(idWhatsApp, idGrupo);
    if ((carteira.gold ?? 0) + valor < GOLD_MIN) {
      throw new RangeError(
        `carteiraService.alterarGold: saldo insuficiente. ` +
        `Atual: ${carteira.gold} | Tentativa de débito: ${absValor}`
      );
    }
  }

  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp, idGrupo },
    {
      $inc: { gold: valor },
      $push: {
        goldHistory: {
          $each:  [{ type: tipo, item: descricao.trim(), amount: absValor }],
          $slice: -GOLD_HISTORY_LIMITE,
        },
      },
    },
    { upsert: true, new: true }
  );
}

// ─── alterarGoldSeguro ────────────────────────────────────────────────────────

/**
 * Versão sem lançamento de erro para débitos: subtrai apenas o que há de saldo.
 * Útil para penalidades (ex: roubos) onde você quer debitar "o máximo possível".
 *
 * Retorna { carteira, debitado } onde `debitado` é o valor efetivamente subtraído.
 *
 * @param {string} idWhatsApp
 * @param {string} idGrupo
 * @param {number} valor       - deve ser negativo
 * @param {string} descricao
 * @returns {Promise<{ carteira: object, debitado: number }>}
 */
async function alterarGoldSeguro(idWhatsApp, idGrupo, valor, descricao = 'sistema') {
  if (valor >= 0) return { carteira: await alterarGold(idWhatsApp, idGrupo, valor, descricao), debitado: valor };

  const carteira   = await getCarteira(idWhatsApp, idGrupo);
  const saldoAtual = carteira.gold ?? 0;
  const debitado   = Math.min(saldoAtual, Math.abs(valor));

  if (debitado === 0) return { carteira, debitado: 0 };

  const carteiraAtualizada = await alterarGold(idWhatsApp, idGrupo, -debitado, descricao);
  return { carteira: carteiraAtualizada, debitado };
}

// ─── rankingGold ──────────────────────────────────────────────────────────────

/**
 * Retorna os top-N usuários de um grupo ordenados por gold (decrescente).
 *
 * @param {string} idGrupo
 * @param {number} [limite=10]
 * @returns {Promise<Array>}
 */
async function rankingGold(idGrupo, limite = 10) {
  assertJid(idGrupo, 'idGrupo');

  return CarteiraGrupo.find({ idGrupo, gold: { $gt: 0 } })
    .sort({ gold: -1 })
    .limit(Math.min(limite, 50)) // teto de segurança
    .select('idWhatsApp gold level xp')
    .lean();
}

// ─── rankingXp ────────────────────────────────────────────────────────────────

/**
 * Retorna os top-N usuários de um grupo ordenados por XP (decrescente).
 *
 * @param {string} idGrupo
 * @param {number} [limite=10]
 * @returns {Promise<Array>}
 */
async function rankingXp(idGrupo, limite = 10) {
  assertJid(idGrupo, 'idGrupo');

  return CarteiraGrupo.find({ idGrupo, xp: { $gt: 0 } })
    .sort({ xp: -1 })
    .limit(Math.min(limite, 50))
    .select('idWhatsApp xp level gold')
    .lean();
}

// ─── transferirGold ───────────────────────────────────────────────────────────

/**
 * Transfere gold de um usuário para outro dentro do mesmo grupo.
 * Operação atômica: debita antes de creditar. Se o débito falhar
 * (saldo insuficiente), o crédito não acontece.
 *
 * @param {string} deIdWhatsApp  - quem paga
 * @param {string} paraIdWhatsApp - quem recebe
 * @param {string} idGrupo
 * @param {number} valor          - deve ser positivo
 * @param {string} [descricao]
 * @returns {Promise<{ de: object, para: object }>}
 */
async function transferirGold(deIdWhatsApp, paraIdWhatsApp, idGrupo, valor, descricao = 'transferência') {
  if (valor <= 0) throw new RangeError('transferirGold: valor deve ser positivo.');
  if (deIdWhatsApp === paraIdWhatsApp) throw new Error('transferirGold: remetente e destinatário são o mesmo usuário.');

  const label = descricao.trim();
  const numDe   = deIdWhatsApp.split('@')[0].split(':')[0];
  const numPara = paraIdWhatsApp.split('@')[0].split(':')[0];

  const carteiraDE   = await alterarGold(deIdWhatsApp,  idGrupo, -valor, `${label} para @${numPara}`);
  const carteiraPARA = await alterarGold(paraIdWhatsApp, idGrupo,  valor, `${label} de @${numDe}`);

  return { de: carteiraDE, para: carteiraPARA };
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  getCarteira,
  alterarGold,
  alterarGoldSeguro,
  rankingGold,
  rankingXp,
  transferirGold,
};