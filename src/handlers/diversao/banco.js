// ─── !banco ───────────────────────────────────────────────────────────────────

const DAILY_DEPOSIT_LIMIT   = 10000;
const INVESTMENT_DURATION_MS = 3 * 60 * 60 * 1000; // 3 horas em ms

// ─── Helpers de tempo ────────────────────────────────────────────────────────
'use strict';

const Usuario = require(require('path').join(__dirname, '..', '..', 'models', 'Usuario'));
const carteiraService = require(require('path').join(__dirname, '..', '..', 'services', 'carteiraService'));

// ─── Configuração central ──────────────────────────────────────────────────

const BANCO_CONFIG = {
  PRAZO_MS:         3 * 60 * 60 * 1000,
  JUROS_MIN:        5,
  JUROS_MAX:        15,
  DAILY_LIMIT:      5000,
  HISTORICO_LIMITE: 10,
};

// ─── Helpers puros ─────────────────────────────────────────────────────────

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

// ... resto do arquivo
// ─── Helpers puros ────────────────────────────────────────────────────────────

/** Sorteia taxa de juros entre JUROS_MIN e JUROS_MAX (inteiro). */
function sortearJuros() {
  return BANCO_CONFIG.JUROS_MIN + Math.floor(Math.random() * (BANCO_CONFIG.JUROS_MAX - BANCO_CONFIG.JUROS_MIN + 1));
}

/** Calcula valor do resgate arredondado. */
function calcularResgate(amount, interest) {
  return Math.round(amount * (1 + interest / 100));
}

/**
 * Retorna quantos ms faltam para o investimento vencer.
 * Retorna 0 se já venceu ou se startDate for inválido.
 */
function getMsLeft(startDate) {
  if (!startDate) return 0;
  const inicio = new Date(startDate).getTime();
  if (isNaN(inicio)) return 0;
  const restante = inicio + BANCO_CONFIG.PRAZO_MS - Date.now();
  return restante > 0 ? restante : 0;
}

/** Formata ms em "Xh Ym Zs". */
function formatTimeLeft(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

// ─── Helpers de acesso ao BD ──────────────────────────────────────────────────

/**
 * Garante que o documento do usuário existe e retorna-o.
 * Usa upsert para ser seguro contra corridas.
 */
async function garantirUsuario(idWhatsApp) {
  return Usuario.findOneAndUpdate(
    { idWhatsApp },
    { $setOnInsert: { idWhatsApp } },
    { upsert: true, new: true }
  );
}

/**
 * Retorna o saldo de gold do usuário no grupo (CarteiraGrupo).
 * Se idGrupo for nulo/undefined cai de volta para o gold global (Usuario).
 */
async function getSaldoGrupo(idWhatsApp, idGrupo) {
  if (!idGrupo) return null;
  return carteiraService.getCarteira(idWhatsApp, idGrupo);
}

// ─── handleBanco ─────────────────────────────────────────────────────────────

/**
 * Comando !banco [quantia]
 *
 * - Sem argumento: exibe situação atual do investimento.
 * - Com argumento:  realiza (ou adiciona a) um depósito.
 *
 * O gold debitado/creditado usa SEMPRE o saldo de grupo (CarteiraGrupo)
 * quando o comando é enviado dentro de um grupo. Em DM, usa o gold global.
 *
 * @param {object} sock    - cliente Baileys
 * @param {object} msg     - mensagem WhatsApp
 * @param {string} jid     - JID do chat (grupo ou DM)
 * @param {string} caption - texto do comando
 */
async function handleBanco(sock, msg, jid, caption) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  // idGrupo só existe se for mensagem de grupo
  const idGrupo = msg.key.remoteJid?.endsWith('@g.us') ? msg.key.remoteJid : null;

  const match = caption.match(/banco\s+(\d+)/i);

  // ── Carregar/criar usuário e carteira ────────────────────────────────────
  const user    = await garantirUsuario(userId);
  const carteira = idGrupo ? await getSaldoGrupo(userId, idGrupo) : null;

  // Saldo visível ao usuário: grupo se disponível, senão global
  const saldoDisponivel = carteira ? (carteira.gold ?? 0) : (user.gold ?? 0);

  const today = new Date().toISOString().split('T')[0];

  // Resetar limite diário atomicamente se mudou o dia
  if (user.bank?.lastDepositDate !== today) {
    await Usuario.updateOne(
      { idWhatsApp: userId },
      { $set: { 'bank.depositedToday': 0, 'bank.lastDepositDate': today } }
    );
    user.bank         = user.bank ?? {};
    user.bank.depositedToday  = 0;
    user.bank.lastDepositDate = today;
  }

  const depositedToday = user.bank?.depositedToday ?? 0;
  const remainingLimit = BANCO_CONFIG.DAILY_LIMIT - depositedToday;

  // ── Exibir status (sem argumento de quantia) ─────────────────────────────
  if (!match) {
    const hasInvestment = (user.bank?.amount ?? 0) > 0;

    if (!hasInvestment) {
      const texto =
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
        `  💎 Use: *!resgatar*\n` +
        `  _Após as 3 horas expirarem!_\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*LIMITE DIÁRIO:*\n` +
        `  📊 Depositado hoje: *${depositedToday}* gold\n` +
        `  🔓 Disponível: *${remainingLimit}* gold\n\n` +
        `*SEU SALDO${idGrupo ? ' (grupo)' : ''}:* 💰 *${saldoDisponivel}* gold\n\n` +
        `_Deixe seu dinheiro trabalhar para você!_ 🚀`;

      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }

    const msLeft       = getMsLeft(user.bank.startDate);
    const futureAmount = calcularResgate(user.bank.amount, user.bank.interest);
    const ganho        = futureAmount - user.bank.amount;
    const status       = msLeft > 0
      ? `⏳ Tempo restante: *${formatTimeLeft(msLeft)}*`
      : `✅ *PRONTO PARA RESGATAR!*`;
    const emoji = msLeft > 0 ? '⌛' : '🎯';

    const texto =
      `💼 ═══ SEU INVESTIMENTO ═══ 💼\n\n` +
      `${emoji} ${status}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*DETALHES:*\n` +
      `  💵 Investido: *${user.bank.amount}* gold\n` +
      `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
      `  💎 Retorno esperado: *${futureAmount}* gold\n` +
      `  💹 Lucro previsto: *+${ganho}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*LIMITE DIÁRIO:*\n` +
      `  📊 Depositado hoje: *${depositedToday}* gold\n` +
      `  🔓 Disponível: *${remainingLimit}* gold\n\n` +
      `*SEU SALDO${idGrupo ? ' (grupo)' : ''}:* 💰 *${saldoDisponivel}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*AÇÕES:*\n` +
      (msLeft > 0
        ? `  ⏳ Aguarde *${formatTimeLeft(msLeft)}* para resgatar!\n  💵 Ou deposite mais: *!banco <quantia>*`
        : `  ✅ Use *!resgatar* para sacar seu dinheiro!\n  💵 Ou deposite mais: *!banco <quantia>*`) +
      `\n\n_Seu investimento está crescendo..._ 📊`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  // ── Processar depósito ───────────────────────────────────────────────────
  const amount = parseInt(match[1], 10);

  if (!amount || amount <= 0) {
    await sock.sendMessage(
      jid,
      { text: `⚠️ *QUANTIDADE INVÁLIDA*\n\nA quantia deve ser um número positivo!\n\n*EXEMPLO:*\n  *!banco 500*` },
      { quoted: msg }
    );
    return;
  }

  if (remainingLimit <= 0) {
    await sock.sendMessage(
      jid,
      {
        text:
          `⚠️ *LIMITE DIÁRIO ATINGIDO*\n\nVocê já depositou *${depositedToday}* gold hoje!\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `  📊 Limite diário: *${BANCO_CONFIG.DAILY_LIMIT}* gold\n` +
          `  🔒 Limite restante: *0* gold\n\n` +
          `_Volte amanhã para depositar mais!_ ⏰`,
      },
      { quoted: msg }
    );
    return;
  }

  if (amount > remainingLimit) {
    await sock.sendMessage(
      jid,
      {
        text:
          `⚠️ *LIMITE DIÁRIO EXCEDIDO*\n\n` +
          `  📊 Limite diário: *${BANCO_CONFIG.DAILY_LIMIT}* gold\n` +
          `  ✅ Depositado hoje: *${depositedToday}* gold\n` +
          `  🔓 Disponível: *${remainingLimit}* gold\n\n` +
          `*Você tentou depositar:* ${amount} gold\n\n` +
          `_Tente depositar no máximo *${remainingLimit}* gold agora!_ ⏰`,
      },
      { quoted: msg }
    );
    return;
  }

  // ── Debitar gold do saldo correto (grupo ou global) ──────────────────────
  let saldoAposDebito;

  if (idGrupo) {
    // Débito no saldo de grupo — lança RangeError se insuficiente
    try {
      const carteiraAtualizada = await carteiraService.alterarGold(
        userId, idGrupo, -amount, 'Depósito banco'
      );
      saldoAposDebito = carteiraAtualizada.gold;
    } catch (err) {
      if (err instanceof RangeError) {
        await sock.sendMessage(
          jid,
          {
            text:
              `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${amount}* gold no grupo!\n\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `*SEU SALDO (grupo):*\n  💰 Disponível: *${saldoDisponivel}* gold`,
          },
          { quoted: msg }
        );
        return;
      }
      throw err;
    }
  } else {
    // Débito no gold global — atômico com $gte
    const updatedUser = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId, gold: { $gte: amount } },
      { $inc: { gold: -amount } },
      { new: true }
    );

    if (!updatedUser) {
      await sock.sendMessage(
        jid,
        {
          text:
            `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${amount}* gold!\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `*SEU SALDO:*\n  💰 Disponível: *${saldoDisponivel}* gold`,
        },
        { quoted: msg }
      );
      return;
    }
    saldoAposDebito = updatedUser.gold;
  }

  // ── Atualizar dados do banco no Usuario ──────────────────────────────────
  const hasActiveInvestment = (user.bank?.amount ?? 0) > 0;
  const newDepositedToday   = depositedToday + amount;

  if (hasActiveInvestment) {
    // Adicionar ao investimento existente
    const newTotal = (user.bank.amount ?? 0) + amount;

    await Usuario.updateOne(
      { idWhatsApp: userId },
      {
        $set: {
          'bank.amount':          newTotal,
          'bank.depositedToday':  newDepositedToday,
          'bank.lastDepositDate': today,
        },
      }
    );

    const futureAmount = calcularResgate(newTotal, user.bank.interest);
    const ganho        = futureAmount - newTotal;
    const msLeft       = getMsLeft(user.bank.startDate);

    const texto =
      `✅ ═══ DEPÓSITO ADICIONADO! ═══ ✅\n\n` +
      `💼 *Investimento atualizado com sucesso!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*RESUMO:*\n` +
      `  💵 Adicionado agora: *+${amount}* gold\n` +
      `  🏦 Total investido: *${newTotal}* gold\n` +
      `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
      `  ⏰ Tempo restante: *${formatTimeLeft(msLeft)}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*RETORNO ESPERADO:*\n` +
      `  💎 Resgate em: *${futureAmount}* gold\n` +
      `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*SALDO${idGrupo ? ' (grupo)' : ''}:*\n` +
      `  💰 Disponível: *${saldoAposDebito}* gold\n` +
      `  🏦 Investido: *${newTotal}* gold\n` +
      `  🔓 Limite restante hoje: *${BANCO_CONFIG.DAILY_LIMIT - newDepositedToday}* gold`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });

  } else {
    // Criar novo investimento
    const interest = sortearJuros();

    await Usuario.updateOne(
      { idWhatsApp: userId },
      {
        $set: {
          'bank.amount':          amount,
          'bank.interest':        interest,
          'bank.startDate':       new Date().toISOString(),
          'bank.lastDepositDate': today,
          'bank.depositedToday':  newDepositedToday,
        },
      }
    );

    const futureAmount = calcularResgate(amount, interest);
    const ganho        = futureAmount - amount;

    const texto =
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
      `*SALDO${idGrupo ? ' (grupo)' : ''}:*\n` +
      `  💰 Disponível: *${saldoAposDebito}* gold\n` +
      `  🏦 Investido: *${amount}* gold\n` +
      `  🔓 Limite restante hoje: *${BANCO_CONFIG.DAILY_LIMIT - newDepositedToday}* gold`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

// ─── handleResgatar ───────────────────────────────────────────────────────────

/**
 * Comando !resgatar
 *
 * Credita o resgate no saldo de grupo (se vier de grupo) ou no gold global.
 * Salva o histórico de resgate em bank.historico (últimos 10).
 */
async function handleResgatar(sock, msg, jid) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = msg.key.remoteJid?.endsWith('@g.us') ? msg.key.remoteJid : null;

  const user = await garantirUsuario(userId);

  if (!user.bank?.amount || user.bank.amount <= 0) {
    await sock.sendMessage(
      jid,
      { text: `⚠️ *SEM INVESTIMENTOS ATIVOS*\n\nVocê não possui nenhum investimento ativo no banco!\n\n_Use *!banco <quantia>* para investir!_` },
      { quoted: msg }
    );
    return;
  }

  const msLeft = getMsLeft(user.bank.startDate);

  if (msLeft > 0) {
    const futureAmount = calcularResgate(user.bank.amount, user.bank.interest);
    const ganho        = futureAmount - user.bank.amount;

    await sock.sendMessage(
      jid,
      {
        text:
          `⏳ ═══ INVESTIMENTO EM ANDAMENTO ═══ ⏳\n\n` +
          `⌛ *Seu investimento vence em ${formatTimeLeft(msLeft)}!*\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `*DETALHES:*\n` +
          `  💵 Investido: *${user.bank.amount}* gold\n` +
          `  📈 Taxa: *${user.bank.interest}%*\n` +
          `  💎 Retorno esperado: *${futureAmount}* gold\n` +
          `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
          `_Aguarde o prazo para resgatar!_`,
      },
      { quoted: msg }
    );
    return;
  }

  const futureAmount = calcularResgate(user.bank.amount, user.bank.interest);
  const ganho        = futureAmount - user.bank.amount;

  // ── Entrada no histórico ─────────────────────────────────────────────────
  const entradaHistorico = {
    data:      new Date().toISOString(),
    investido: user.bank.amount,
    resgate:   futureAmount,
    juros:     user.bank.interest,
    lucro:     ganho,
    origem:    idGrupo ? 'grupo' : 'global',
    idGrupo:   idGrupo ?? null,
  };

  // ── Creditar gold no saldo correto e zerar banco ─────────────────────────
  if (idGrupo) {
    // Crédito no saldo de grupo
    await carteiraService.alterarGold(userId, idGrupo, futureAmount, 'Resgate banco');

    // Atualizar missões e zerar banco num único update em Usuario
    const updateResgate = {
      $set: {
        'bank.amount':    0,
        'bank.interest':  0,
        'bank.startDate': null,
      },
      $push: {
        'bank.historico': {
          $each:  [entradaHistorico],
          $slice: -BANCO_CONFIG.HISTORICO_LIMITE,
        },
      },
    };

    if (ganho > 0) {
      updateResgate.$inc = { 'dailyMissions.progress.gold500': ganho };
    }

    await Usuario.findOneAndUpdate({ idWhatsApp: userId }, updateResgate, { new: true });

    // Saldo pós-resgate para exibir
    const carteiraFinal = await carteiraService.getCarteira(userId, idGrupo);

    const texto =
      `🎉 ═══ RESGATE BEM-SUCEDIDO! ═══ 🎉\n\n` +
      `💎 *Parabéns! Seu investimento rendeu!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*RESUMO:*\n` +
      `  💵 Investimento inicial: *${user.bank.amount}* gold\n` +
      `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
      `  💰 Resgate total: *${futureAmount}* gold\n` +
      `  💹 Lucro obtido: *+${ganho}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*SALDO FINAL (grupo):*\n` +
      `  ✅ Total na conta: *${carteiraFinal.gold}* gold`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });

  } else {
    // Crédito no gold global — tudo em um único update atômico
    const updateResgate = {
      $inc: { gold: futureAmount },
      $set: {
        'bank.amount':    0,
        'bank.interest':  0,
        'bank.startDate': null,
      },
      $push: {
        'bank.historico': {
          $each:  [entradaHistorico],
          $slice: -BANCO_CONFIG.HISTORICO_LIMITE,
        },
      },
    };

    if (ganho > 0) {
      updateResgate.$inc['dailyMissions.progress.gold500'] = ganho;
    }

    const finalUser = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      updateResgate,
      { new: true }
    );

    const texto =
      `🎉 ═══ RESGATE BEM-SUCEDIDO! ═══ 🎉\n\n` +
      `💎 *Parabéns! Seu investimento rendeu!*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*RESUMO:*\n` +
      `  💵 Investimento inicial: *${user.bank.amount}* gold\n` +
      `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
      `  💰 Resgate total: *${futureAmount}* gold\n` +
      `  💹 Lucro obtido: *+${ganho}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*SALDO FINAL:*\n` +
      `  ✅ Total na conta: *${finalUser.gold}* gold`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

// ─── handleHistoricoBanco ─────────────────────────────────────────────────────

/**
 * Comando !historicobanco
 *
 * Exibe os últimos resgates do usuário (máx 10).
 */
async function handleHistoricoBanco(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const user   = await garantirUsuario(userId);

  const historico = user.bank?.historico ?? [];

  if (historico.length === 0) {
    await sock.sendMessage(
      jid,
      { text: `📋 *HISTÓRICO DO BANCO*\n\nVocê ainda não realizou nenhum resgate!\n\n_Use *!banco <quantia>* para começar a investir._` },
      { quoted: msg }
    );
    return;
  }

  const linhas = historico
    .slice()
    .reverse() // mais recente primeiro
    .map((h, i) => {
      const data   = new Date(h.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const origem = h.origem === 'grupo' ? '👥 grupo' : '🌐 global';
      return (
        `*${i + 1}.* ${data}\n` +
        `   💵 ${h.investido} → 💎 ${h.resgate} gold (+${h.lucro}) | ${h.juros}% | ${origem}`
      );
    })
    .join('\n\n');

  const texto =
    `📋 ═══ HISTÓRICO DO BANCO ═══ 📋\n\n` +
    `_Últimos ${historico.length} resgates:_\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    linhas +
    `\n\n━━━━━━━━━━━━━━━━\n` +
    `_Use *!banco* para verificar seu investimento atual._`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleBanco,
  handleResgatar,
  handleHistoricoBanco,
};