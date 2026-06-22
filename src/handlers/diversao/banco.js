'use strict';

const path = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const Usuario       = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const carteiraService = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));

// ─── Configuração central ─────────────────────────────────────────────────────

const BANCO_CONFIG = {
  PRAZO_MS:         3 * 60 * 60 * 1000,
  JUROS_MIN:        5,
  JUROS_MAX:        15,
  DAILY_LIMIT: 100000,
  HISTORICO_LIMITE: 10,
};

// ─── Helpers puros ────────────────────────────────────────────────────────────

function sortearJuros() {
  return BANCO_CONFIG.JUROS_MIN +
    Math.floor(Math.random() * (BANCO_CONFIG.JUROS_MAX - BANCO_CONFIG.JUROS_MIN + 1));
}

function calcularResgate(amount, interest) {
  return Math.round(amount * (1 + interest / 100));
}

function getMsLeft(startDate) {
  if (!startDate) return 0;
  const inicio = new Date(startDate).getTime();
  if (isNaN(inicio)) return 0;
  const restante = inicio + BANCO_CONFIG.PRAZO_MS - Date.now();
  return restante > 0 ? restante : 0;
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

// ─── Helpers de acesso ao BD ──────────────────────────────────────────────────

async function resolverUserId(sock, msg) {
  let userId = msg.key.participant || msg.key.remoteJid;
  if (userId?.endsWith('@lid')) {
    try {
      const number  = userId.split('@')[0].split(':')[0];
      const results = await sock.onWhatsApp(number);
      if (results?.length > 0 && results[0].jid) userId = results[0].jid;
    } catch {}
  }
  return userId;
}

async function getCarteiraGrupo(userId, idGrupo) {
  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo },
    { $setOnInsert: { idWhatsApp: userId, idGrupo } },
    { upsert: true, new: true }
  );
}

// ─── handleBanco ─────────────────────────────────────────────────────────────

// !banco
async function handleBanco(sock, msg, jid, caption) {
  const userId  = await resolverUserId(sock, msg);
  const idGrupo = msg.key.remoteJid?.endsWith('@g.us') ? msg.key.remoteJid : null;
  const match   = caption.match(/banco\s+(\d+)/i);
  console.log('[banco] userId:', userId, '| idGrupo:', idGrupo);
  // ── Banco obrigatoriamente por grupo ────────────────────────────────────────
  if (!idGrupo) {
    await sock.sendMessage(jid, {
      text: '⚠️ O banco só funciona dentro de grupos!',
    }, { quoted: msg });
    return;
  }

  const carteira = await getCarteiraGrupo(userId, idGrupo);
  const banco    = carteira.banco ?? {};
  const today    = new Date().toISOString().split('T')[0];

  // ── Resetar limite diário se necessário ─────────────────────────────────────
  if (banco.lastDepositDate !== today) {
    await CarteiraGrupo.updateOne(
      { idWhatsApp: userId, idGrupo },
      { $set: { 'banco.depositedToday': 0, 'banco.lastDepositDate': today } }
    );
    banco.depositedToday  = 0;
    banco.lastDepositDate = today;
  }

  const saldoDisponivel = carteira.gold ?? 0;
  const depositedToday  = banco.depositedToday ?? 0;

  // ✅ Math.max evita exibir/limite negativo caso depositedToday > DAILY_LIMIT
  // (ex: limite reduzido manualmente após o usuário já ter depositado mais)
  const remainingLimit  = Math.max(0, BANCO_CONFIG.DAILY_LIMIT - depositedToday);

  // ✅ Bloco de limite diário reutilizado em 2 lugares — evita duplicação
  const linhaLimite =
    `*LIMITE DIÁRIO:*\n` +
    `  📊 Depositado hoje: *${depositedToday}* gold\n` +
    `  🔓 Disponível: *${remainingLimit}* gold`;

  // ── Exibir status (sem argumento) ────────────────────────────────────────────
  if (!match) {
    const hasInvestment = (banco.amount ?? 0) > 0;

    if (!hasInvestment) {
      await sock.sendMessage(jid, {
        text:
          `💼 ═══ BANCO PIROQUINHAS ═══ 💼\n\n` +
          `💰 *Nenhum investimento ativo no momento!*\n\n` +
          `O seu dinheiro está seguro, mas ocioso...\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `*COMO INVESTIR?*\n` +
          `  📊 Use: *!banco <quantia>*\n` +
          `  💵 Exemplo: *!banco 500*\n\n` +
          `*RENDIMENTOS:*\n` +
          `  📈 Juros: ${BANCO_CONFIG.JUROS_MIN}–${BANCO_CONFIG.JUROS_MAX}%\n` +
          `  ⏰ Prazo: *3 horas*\n\n` +
          `*RESGATE:*\n` +
          `  💎 Use: *!resgatar* (neste grupo)\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `${linhaLimite}\n\n` +
          `*SEU SALDO (grupo):* 💰 *${saldoDisponivel}* gold\n\n` +
          `_Deixe seu dinheiro trabalhar para você!_ 🚀`,
      }, { quoted: msg });
      return;
    }

    const msLeft       = getMsLeft(banco.startDate);
    const futureAmount = calcularResgate(banco.amount, banco.interest);
    const ganho        = futureAmount - banco.amount;
    const status       = msLeft > 0
      ? `⏳ Tempo restante: *${formatTimeLeft(msLeft)}*`
      : `✅ *PRONTO PARA RESGATAR!*`;

    await sock.sendMessage(jid, {
      text:
        `💼 ═══ SEU INVESTIMENTO ═══ 💼\n\n` +
        `${msLeft > 0 ? '⌛' : '🎯'} ${status}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*DETALHES:*\n` +
        `  💵 Investido: *${banco.amount}* gold\n` +
        `  📈 Taxa de juros: *${banco.interest}%*\n` +
        `  💎 Retorno esperado: *${futureAmount}* gold\n` +
        `  💹 Lucro previsto: *+${ganho}* gold\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${linhaLimite}\n\n` +
        `*SEU SALDO (grupo):* 💰 *${saldoDisponivel}* gold\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        (msLeft > 0
          ? `⏳ Aguarde *${formatTimeLeft(msLeft)}* para resgatar!\n  💵 Ou deposite mais: *!banco <quantia>*`
          : `✅ Use *!resgatar* para sacar seu dinheiro!\n  💵 Ou deposite mais: *!banco <quantia>*`) +
        `\n\n_Seu investimento está crescendo..._ 📊`,
    }, { quoted: msg });
    return;
  }

  // ── Processar depósito ───────────────────────────────────────────────────────
  const amount = parseInt(match[1], 10);

  // ✅ Number.isSafeInteger evita números absurdamente grandes (overflow/precisão)
  if (!amount || amount <= 0 || !Number.isSafeInteger(amount)) {
    await sock.sendMessage(jid, {
      text: `⚠️ *QUANTIDADE INVÁLIDA*\n\nA quantia deve ser um número positivo válido!\n\n*EXEMPLO:*\n  *!banco 500*`,
    }, { quoted: msg });
    return;
  }

  if (remainingLimit <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ *LIMITE DIÁRIO ATINGIDO*\n\nVocê já depositou *${depositedToday}* gold hoje!\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `  📊 Limite diário: *${BANCO_CONFIG.DAILY_LIMIT}* gold\n` +
        `  🔒 Limite restante: *0* gold\n\n` +
        `_Volte amanhã para depositar mais!_ ⏰`,
    }, { quoted: msg });
    return;
  }

  if (amount > remainingLimit) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ *LIMITE DIÁRIO EXCEDIDO*\n\n` +
        `  📊 Limite diário: *${BANCO_CONFIG.DAILY_LIMIT}* gold\n` +
        `  ✅ Depositado hoje: *${depositedToday}* gold\n` +
        `  🔓 Disponível: *${remainingLimit}* gold\n\n` +
        `*Você tentou depositar:* ${amount} gold\n\n` +
        `_Tente depositar no máximo *${remainingLimit}* gold agora!_ ⏰`,
    }, { quoted: msg });
    return;
  }

  // ── Debitar gold do grupo ────────────────────────────────────────────────────
  let saldoAposDebito;
  try {
    const carteiraAtualizada = await carteiraService.alterarGold(
      userId, idGrupo, -amount, 'Depósito banco'
    );
    saldoAposDebito = carteiraAtualizada.gold;
  } catch (err) {
    if (err instanceof RangeError) {
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${amount}* gold neste grupo!\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `*SEU SALDO (grupo):*\n  💰 Disponível: *${saldoDisponivel}* gold`,
      }, { quoted: msg });
      return;
    }
    throw err;
  }

  // ── Atualizar dados do banco no CarteiraGrupo ────────────────────────────────
  const newDepositedToday  = depositedToday + amount;
  const limiteRestanteHoje = Math.max(0, BANCO_CONFIG.DAILY_LIMIT - newDepositedToday);
  const hasActiveInvestment = (banco.amount ?? 0) > 0;

  if (hasActiveInvestment) {
    // ✅ $inc evita condição de corrida — soma direto sobre o valor já
    // persistido no banco, sem depender do snapshot lido no início da função
    await CarteiraGrupo.updateOne(
      { idWhatsApp: userId, idGrupo },
      {
        $inc: { 'banco.amount': amount, 'banco.depositedToday': amount },
        $set: { 'banco.lastDepositDate': today },
      }
    );

    const newTotal     = (banco.amount ?? 0) + amount;
    const futureAmount = calcularResgate(newTotal, banco.interest);
    const ganho        = futureAmount - newTotal;
    const msLeft       = getMsLeft(banco.startDate);

    await sock.sendMessage(jid, {
      text:
        `✅ ═══ DEPÓSITO ADICIONADO! ═══ ✅\n\n` +
        `💼 *Investimento atualizado com sucesso!*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RESUMO:*\n` +
        `  💵 Adicionado agora: *+${amount}* gold\n` +
        `  🏦 Total investido: *${newTotal}* gold\n` +
        `  📈 Taxa de juros: *${banco.interest}%*\n` +
        `  ⏰ Tempo restante: *${formatTimeLeft(msLeft)}*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RETORNO ESPERADO:*\n` +
        `  💎 Resgate em: *${futureAmount}* gold\n` +
        `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*SALDO (grupo):*\n` +
        `  💰 Disponível: *${saldoAposDebito}* gold\n` +
        `  🏦 Investido: *${newTotal}* gold\n` +
        `  🔓 Limite restante hoje: *${limiteRestanteHoje}* gold`,
    }, { quoted: msg });

  } else {
    const interest = sortearJuros();
    await CarteiraGrupo.updateOne(
      { idWhatsApp: userId, idGrupo },
      { $set: {
        'banco.amount':          amount,
        'banco.interest':        interest,
        'banco.startDate':       new Date(),
        'banco.lastDepositDate': today,
        'banco.depositedToday':  newDepositedToday,
      }}
    );

    const futureAmount = calcularResgate(amount, interest);
    const ganho        = futureAmount - amount;

    await sock.sendMessage(jid, {
      text:
        `✅ ═══ INVESTIMENTO REALIZADO! ═══ ✅\n\n` +
        `💼 *Seu dinheiro está trabalhando!*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RESUMO DO INVESTIMENTO:*\n` +
        `  💵 Valor investido: *${amount}* gold\n` +
        `  📈 Taxa de juros: *${interest}%*\n` +
        `  ⏰ Prazo: *3 horas*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RETORNO ESPERADO:*\n` +
        `  💎 Resgate em: *${futureAmount}* gold\n` +
        `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*SALDO (grupo):*\n` +
        `  💰 Disponível: *${saldoAposDebito}* gold\n` +
        `  🏦 Investido: *${amount}* gold\n` +
        `  🔓 Limite restante hoje: *${limiteRestanteHoje}* gold`,
    }, { quoted: msg });
  }
}

// ─── handleResgatar ───────────────────────────────────────────────────────────

// !resgatar
async function handleResgatar(sock, msg, jid) {
  const userId  = await resolverUserId(sock, msg);
  const idGrupo = msg.key.remoteJid?.endsWith('@g.us') ? msg.key.remoteJid : null;
  console.log('[resgatar] userId:', userId, '| idGrupo:', idGrupo);
  
  if (!idGrupo) {
    await sock.sendMessage(jid, {
      text: '⚠️ O banco só funciona dentro de grupos!',
    }, { quoted: msg });
    return;
  }

  const carteira = await getCarteiraGrupo(userId, idGrupo);
  const banco    = carteira.banco ?? {};

  if (!banco.amount || banco.amount <= 0) {
    await sock.sendMessage(jid, {
      text: `⚠️ *SEM INVESTIMENTOS ATIVOS*\n\nVocê não possui nenhum investimento ativo neste grupo!\n\n_Use *!banco <quantia>* para investir!_`,
    }, { quoted: msg });
    return;
  }

  const msLeft = getMsLeft(banco.startDate);

  if (msLeft > 0) {
    const futureAmount = calcularResgate(banco.amount, banco.interest);
    const ganho        = futureAmount - banco.amount;
    await sock.sendMessage(jid, {
      text:
        `⏳ ═══ INVESTIMENTO EM ANDAMENTO ═══ ⏳\n\n` +
        `⌛ *Seu investimento vence em ${formatTimeLeft(msLeft)}!*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*DETALHES:*\n` +
        `  💵 Investido: *${banco.amount}* gold\n` +
        `  📈 Taxa: *${banco.interest}%*\n` +
        `  💎 Retorno esperado: *${futureAmount}* gold\n` +
        `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
        `_Aguarde o prazo para resgatar!_`,
    }, { quoted: msg });
    return;
  }

  const futureAmount = calcularResgate(banco.amount, banco.interest);
  const ganho        = futureAmount - banco.amount;

  const entradaHistorico = {
    data:      new Date(),
    investido: banco.amount,
    resgate:   futureAmount,
    juros:     banco.interest,
    lucro:     ganho,
  };

  // ── Zerar banco, creditar gold e registrar histórico atomicamente ────────────
  const carteiraFinal = await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo },
    {
      $inc: { gold: futureAmount },
      $set: {
        'banco.amount':    0,
        'banco.interest':  0,
        'banco.startDate': null,
      },
      $push: {
        'banco.historico': {
          $each:  [entradaHistorico],
          $slice: -BANCO_CONFIG.HISTORICO_LIMITE,
        },
        goldHistory: {
          $each:  [{ type: 'recebido', item: 'Resgate banco', amount: futureAmount }],
          $slice: -50,
        },
      },
    },
    { new: true }
  );

  // ── Progresso de missão no Usuario ──────────────────────────────────────────
  if (ganho > 0) {
    await Usuario.updateOne(
      { idWhatsApp: userId },
      { $inc: { 'dailyMissions.progress.gold500': ganho } }
    ).catch(() => {});
  }

  await sock.sendMessage(jid, {
    text:
      `🎉 ═══ RESGATE BEM-SUCEDIDO! ═══ 🎉\n\n` +
      `💎 *Parabéns! Seu investimento rendeu!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*RESUMO:*\n` +
      `  💵 Investimento inicial: *${banco.amount}* gold\n` +
      `  📈 Taxa de juros: *${banco.interest}%*\n` +
      `  💰 Resgate total: *${futureAmount}* gold\n` +
      `  💹 Lucro obtido: *+${ganho}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*SALDO FINAL (grupo):*\n` +
      `  ✅ Total na conta: *${carteiraFinal.gold}* gold`,
  }, { quoted: msg });
}

// ─── handleHistoricoBanco ─────────────────────────────────────────────────────

async function handleHistoricoBanco(sock, msg, jid) {
  const userId  = await resolverUserId(sock, msg);
  const idGrupo = msg.key.remoteJid?.endsWith('@g.us') ? msg.key.remoteJid : null;

  if (!idGrupo) {
    await sock.sendMessage(jid, {
      text: '⚠️ O banco só funciona dentro de grupos!',
    }, { quoted: msg });
    return;
  }

  const carteira  = await getCarteiraGrupo(userId, idGrupo);
  const historico = carteira.banco?.historico ?? [];

  if (historico.length === 0) {
    await sock.sendMessage(jid, {
      text: `📋 *HISTÓRICO DO BANCO*\n\nVocê ainda não realizou nenhum resgate neste grupo!\n\n_Use *!banco <quantia>* para começar a investir._`,
    }, { quoted: msg });
    return;
  }

  const linhas = historico
    .slice()
    .reverse()
    .map((h, i) => {
      const data = new Date(h.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return (
        `*${i + 1}.* ${data}\n` +
        `   💵 ${h.investido} → 💎 ${h.resgate} gold (+${h.lucro}) | ${h.juros}%`
      );
    })
    .join('\n\n');

  await sock.sendMessage(jid, {
    text:
      `📋 ═══ HISTÓRICO DO BANCO ═══ 📋\n\n` +
      `_Últimos ${historico.length} resgates neste grupo:_\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      linhas +
      `\n\n━━━━━━━━━━━━━━━━\n` +
      `_Use *!banco* para verificar seu investimento atual._`,
  }, { quoted: msg });
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleBanco,
  handleResgatar,
  handleHistoricoBanco,
};