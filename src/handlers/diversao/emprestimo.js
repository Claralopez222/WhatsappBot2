'use strict';

const path = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const Usuario       = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── Configuração ─────────────────────────────────────────────────────────────

const EMPRESTIMO_CONFIG = {
  minValor:    100,
  maxValor:    15000,
  jurosTaxa:   0.20,
  jurosDiario: 0.05,
  prazosDias:  [3, 5, 7],
  cooldownMs:  24 * 60 * 60 * 1000,
  multaAtraso: 0.10,
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const LIMITE_POR_NIVEL = {
  1:   200,
  2:   300,
  3:   400,
  4:   450,
  5:   500,
  6:   600,
  7:   700,
  8:   800,
  9:   900,
  10:  1000,
  15:  1500,
  20:  2000,
  25:  2500,
  30:  3000,
  35:  3500,
  40:  4000,
  45:  4500,
  50:  5000,
  55:  5500,
  60:  6000,
  65:  6500,
  70:  7000,
  75:  7500,
  80:  8000,
  85:  8500,
  90:  9000,
  95:  9500,
  100: 10000,
  110: 11000,
  120: 12000,
  130: 13000,
  140: 14000,
  150: 15000,
};

// Níveis pré-ordenados (decrescente) para evitar reordenação a cada chamada
const NIVEIS_ORDENADOS = Object.keys(LIMITE_POR_NIVEL).map(Number).sort((a, b) => b - a);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLimitePorNivel(level) {
  for (const n of NIVEIS_ORDENADOS) {
    if (level >= n) return LIMITE_POR_NIVEL[n];
  }
  return EMPRESTIMO_CONFIG.minValor;
}

function calcularDivida(emprestimo) {
  const vencimentoTs = new Date(emprestimo.vencimento).getTime();

  // Protege contra datas inválidas no banco
  if (isNaN(vencimentoTs)) {
    console.error('[emprestimo] calcularDivida: vencimento inválido', emprestimo.vencimento);
    return emprestimo.valor ?? 0;
  }

  const agora     = Date.now();
  const valorBase = emprestimo.valor;
  const jurosBase = Math.floor(valorBase * EMPRESTIMO_CONFIG.jurosTaxa);

  if (agora <= vencimentoTs) {
    return valorBase + jurosBase;
  }

  const diasAtraso  = Math.ceil((agora - vencimentoTs) / MS_POR_DIA);
  const multa       = Math.floor(valorBase * EMPRESTIMO_CONFIG.multaAtraso);
  const jurosDiario = Math.floor(valorBase * EMPRESTIMO_CONFIG.jurosDiario * diasAtraso);

  return valorBase + jurosBase + multa + jurosDiario;
}

function formatarTempo(ms) {
  if (ms <= 0) return '0min';

  const d = Math.floor(ms / MS_POR_DIA);
  const h = Math.floor((ms % MS_POR_DIA) / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / 60_000);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

async function enviarErro(sock, msg, jid, texto) {
  await sock.sendMessage(jid, { text: `❌ *Erro:* ${texto}` }, { quoted: msg });
}

function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

// ─── Verificar inadimplência ──────────────────────────────────────────────────

async function verificarInadimplente(userId, idGrupo) {
  try {
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo }).lean();
    if (!carteira?.emprestimo?.ativo) return false;

    const vencimentoTs = new Date(carteira.emprestimo.vencimento).getTime();
    return !isNaN(vencimentoTs) && Date.now() > vencimentoTs;
  } catch (err) {
    console.error('[emprestimo] verificarInadimplente:', err);
    return false;
  }
}

// ─── Desconto automático ──────────────────────────────────────────────────────

async function verificarDescontoAutomatico(userId, idGrupo) {
  try {
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo });
    if (!carteira?.emprestimo?.ativo) return null;

    const divida     = calcularDivida(carteira.emprestimo);
    const saldoAtual = carteira.gold ?? 0;

    if (saldoAtual < divida) return null;

    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo },
      {
        $inc: { gold: -divida },
        $set: {
          'emprestimo.ativo':             false,
          'emprestimo.quitadoEm':         new Date(),
          'emprestimo.proximoEmprestimo': new Date(Date.now() + EMPRESTIMO_CONFIG.cooldownMs),
        },
        $push: {
          goldHistory: {
            $each:  [{ type: 'gasto', item: 'Quitação automática de empréstimo', amount: divida }],
            $slice: -50,
          },
        },
      }
    );

    return `✅ Seu empréstimo de *${divida} gold* foi quitado automaticamente!`;
  } catch (err) {
    console.error('[emprestimo] verificarDescontoAutomatico:', err);
    return null;
  }
}

// ─── !emprestimo ──────────────────────────────────────────────────────────────

async function handleEmprestimo(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const args   = caption.trim().split(/\s+/);

  if (args.length < 2 || !args[1]) {
    await sock.sendMessage(jid, {
      text:
        `💸 *EMPRÉSTIMO* 💸\n\n` +
        `*USO:* !emprestimo <valor> [prazo]\n\n` +
        `*PRAZOS DISPONÍVEIS:* 3 · 5 · 7 dias\n` +
        `*JUROS:* 20% fixo + 5%/dia após vencimento\n` +
        `*MULTA:* 10% extra ao vencer\n\n` +
        `Exemplo: *!emprestimo 500 7*`,
    }, { quoted: msg });
    return;
  }

  const valor    = parseInt(args[1], 10);
  const prazoArg = args[2] ? parseInt(args[2], 10) : 7;

  if (isNaN(valor) || valor <= 0) {
    await enviarErro(sock, msg, jid, 'Informe um valor numérico válido.');
    return;
  }

  if (!EMPRESTIMO_CONFIG.prazosDias.includes(prazoArg)) {
    await sock.sendMessage(jid, {
      text: `⚠️ Prazo inválido! Escolha: *3*, *5* ou *7* dias.`,
    }, { quoted: msg });
    return;
  }

  if (valor < EMPRESTIMO_CONFIG.minValor) {
    await sock.sendMessage(jid, {
      text: `⚠️ Valor mínimo: *${EMPRESTIMO_CONFIG.minValor} gold*`,
    }, { quoted: msg });
    return;
  }

  if (valor > EMPRESTIMO_CONFIG.maxValor) {
    await sock.sendMessage(jid, {
      text: `⚠️ Valor máximo: *${EMPRESTIMO_CONFIG.maxValor} gold*`,
    }, { quoted: msg });
    return;
  }

  try {
    // ── Verificar inadimplência ANTES de tudo
    const inadimplente = await verificarInadimplente(userId, jid);
    if (inadimplente) {
      await sock.sendMessage(jid, {
        text:
          `🚫 *ACESSO BLOQUEADO*\n\n` +
          `Você possui um empréstimo *vencido e não pago!*\n\n` +
          `Use *!pay emprestimo* para quitar sua dívida primeiro.`,
      }, { quoted: msg });
      return;
    }

    // ── Buscar nível e carteira em paralelo
    const [usuario, carteira] = await Promise.all([
      Usuario.findOne({ idWhatsApp: userId }).select('level').lean(),
      CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo: jid }).lean(),
    ]);

    const level  = usuario?.level ?? 1;
    const limite = getLimitePorNivel(level);

    // ── Cooldown pós-quitação
    if (carteira?.emprestimo?.proximoEmprestimo) {
      const liberacao = new Date(carteira.emprestimo.proximoEmprestimo).getTime();
      if (!isNaN(liberacao) && Date.now() < liberacao) {
        await sock.sendMessage(jid, {
          text:
            `⏳ *COOLDOWN ATIVO*\n\n` +
            `Você quitou um empréstimo recentemente.\n` +
            `Próximo disponível em: *${formatarTempo(liberacao - Date.now())}*`,
        }, { quoted: msg });
        return;
      }
    }

    // ── Empréstimo já ativo
    if (carteira?.emprestimo?.ativo) {
      const divida = calcularDivida(carteira.emprestimo);
      await sock.sendMessage(jid, {
        text:
          `⚠️ *EMPRÉSTIMO ATIVO*\n\n` +
          `Você já possui um empréstimo em aberto!\n\n` +
          `💰 Dívida atual: *${divida} gold*\n\n` +
          `Use *!pay emprestimo* para quitar.`,
      }, { quoted: msg });
      return;
    }

    // ── Limite por nível
    if (valor > limite) {
      await sock.sendMessage(jid, {
        text:
          `⚠️ *LIMITE EXCEDIDO*\n\n` +
          `Seu nível (${level}) permite até *${limite} gold*.\n\n` +
          `Suba de nível para aumentar seu limite!`,
      }, { quoted: msg });
      return;
    }

    // ── Criar empréstimo
    const vencimento = new Date(Date.now() + prazoArg * MS_POR_DIA);
    const juros      = Math.floor(valor * EMPRESTIMO_CONFIG.jurosTaxa);
    const totalDever = valor + juros;

    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: jid },
      {
        $inc: { gold: valor },
        $set: {
          emprestimo: {
            ativo:        true,
            valor,
            vencimento,
            solicitadoEm: new Date(),
            prazo:        prazoArg,
          },
        },
        $push: {
          goldHistory: {
            $each:  [{ type: 'recebido', item: `Empréstimo (${prazoArg} dias)`, amount: valor }],
            $slice: -50,
          },
        },
      },
      { upsert: true }
    );

    await sock.sendMessage(jid, {
      text:
        `✅ *EMPRÉSTIMO APROVADO!* ✅\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💸 Valor recebido:  *${valor} gold*\n` +
        `📈 Juros (20%):     *${juros} gold*\n` +
        `💰 Total a pagar:   *${totalDever} gold*\n` +
        `⏰ Prazo:           *${prazoArg} dias*\n` +
        `📅 Vencimento:      *${vencimento.toLocaleDateString('pt-BR')}*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Após vencer: +10% multa e +5%/dia!_\n\n` +
        `Use *!pay emprestimo* para quitar.`,
    }, { quoted: msg });

  } catch (err) {
    console.error('[emprestimo] handleEmprestimo:', err);
    await enviarErro(sock, msg, jid, 'Ocorreu um erro ao processar o empréstimo. Tente novamente.');
  }
}

// ─── !pay emprestimo ──────────────────────────────────────────────────────────

async function handlePayEmprestimo(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo: jid }).lean();

    if (!carteira?.emprestimo?.ativo) {
      await sock.sendMessage(jid, {
        text: `✅ Você não possui empréstimos ativos!`,
      }, { quoted: msg });
      return;
    }

    const divida     = calcularDivida(carteira.emprestimo);
    const saldoAtual = carteira.gold ?? 0;

    if (saldoAtual < divida) {
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE*\n\n` +
          `💰 Seu saldo:    *${saldoAtual} gold*\n` +
          `💸 Dívida total: *${divida} gold*\n\n` +
          `Faltam: *${divida - saldoAtual} gold*`,
      }, { quoted: msg });
      return;
    }

    const carteiraAtualizada = await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: jid },
      {
        $inc: { gold: -divida },
        $set: {
          'emprestimo.ativo':             false,
          'emprestimo.quitadoEm':         new Date(),
          'emprestimo.proximoEmprestimo': new Date(Date.now() + EMPRESTIMO_CONFIG.cooldownMs),
        },
        $push: {
          goldHistory: {
            $each:  [{ type: 'gasto', item: 'Quitação de empréstimo', amount: divida }],
            $slice: -50,
          },
        },
      },
      { new: true }
    );

    await sock.sendMessage(jid, {
      text:
        `✅ *EMPRÉSTIMO QUITADO!* ✅\n\n` +
        `💸 Valor pago:       *${divida} gold*\n` +
        `💰 Saldo restante:   *${carteiraAtualizada.gold} gold*\n\n` +
        `⏳ Próximo empréstimo em: *24 horas*\n\n` +
        `_Obrigado por pagar em dia!_ 🏆`,
    }, { quoted: msg });

  } catch (err) {
    console.error('[emprestimo] handlePayEmprestimo:', err);
    await enviarErro(sock, msg, jid, 'Ocorreu um erro ao quitar o empréstimo. Tente novamente.');
  }
}

// ─── !divida ──────────────────────────────────────────────────────────────────

async function handleDivida(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo: jid }).lean();

    if (!carteira?.emprestimo?.ativo) {
      await sock.sendMessage(jid, {
        text: `✅ *Você não possui dívidas ativas!*\n\nUse *!emprestimo <valor> [prazo]* para solicitar.`,
      }, { quoted: msg });
      return;
    }

    const emp           = carteira.emprestimo;
    const agora         = Date.now();
    const vencimentoTs  = new Date(emp.vencimento).getTime();
    const divida        = calcularDivida(emp);
    const atrasado      = agora > vencimentoTs;
    const diasAtraso    = atrasado ? Math.ceil((agora - vencimentoTs) / MS_POR_DIA) : 0;
    const tempoRestante = atrasado ? null : formatarTempo(vencimentoTs - agora);

    await sock.sendMessage(jid, {
      text:
        `📋 *SITUAÇÃO DO EMPRÉSTIMO* 📋\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💸 Valor original:  *${emp.valor} gold*\n` +
        `💰 Total a pagar:   *${divida} gold*\n` +
        `📅 Vencimento:      *${new Date(emp.vencimento).toLocaleDateString('pt-BR')}*\n` +
        (atrasado
          ? `⚠️ Status: *ATRASADO (${diasAtraso} dia${diasAtraso > 1 ? 's' : ''})*\n`
          : `✅ Status: *Em dia*\n⏰ Vence em: *${tempoRestante}*\n`) +
        `━━━━━━━━━━━━━━━━\n` +
        `💎 Seu saldo: *${carteira.gold ?? 0} gold*\n\n` +
        `Use *!pay emprestimo* para quitar.`,
    }, { quoted: msg });

  } catch (err) {
    console.error('[emprestimo] handleDivida:', err);
    await enviarErro(sock, msg, jid, 'Não foi possível consultar sua dívida. Tente novamente.');
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  handleEmprestimo,
  handlePayEmprestimo,
  handleDivida,
  verificarInadimplente,
  verificarDescontoAutomatico,
};