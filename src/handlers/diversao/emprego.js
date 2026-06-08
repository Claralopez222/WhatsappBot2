/**
 * Handler de Empregos — Bot WhatsApp
 * Sistema de carreira com cooldown, janela de tolerância e demissão por justa causa
 *
 * v1.0 — economia isolada por grupo via CarteiraGrupo
 *
 * Comandos exportados:
 *   !procuraremprego  → tenta ser contratado
 *   !trabalhar / !work → bate o ponto (com toda a lógica de tempo)
 *   !promocao         → tenta subir de nível
 *   !emprego          → exibe status atual
 */

'use strict';

const path          = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { getCarteira, alterarGold } = require(path.join(__dirname, '..', '..', 'services', 'carteiraService'));

// ─── TABELA DE CARGOS ─────────────────────────────────────────────────────────
//
// A ordem do array define a progressão. Não altere a posição dos itens.
// Para adicionar novos cargos, basta inserir mais objetos — o resto se adapta.

const CARGOS = [
  {
    slug:          'entregador',
    nome:          '🛵 Entregador de Pizza',
    nivel:         1,
    salarioMin:    50,
    salarioMax:    100,
    exigencia:     0,       // trabalhos necessários no cargo ANTERIOR para ser promovido
    exigenciaNome: null,    // nome do cargo anterior (para mensagem de erro)
  },
  {
    slug:          'atendente',
    nome:          '🏪 Atendente de Loja',
    nivel:         2,
    salarioMin:    150,
    salarioMax:    250,
    exigencia:     10,
    exigenciaNome: 'Entregador de Pizza',
  },
  {
    slug:          'programador',
    nome:          '💻 Programador Júnior',
    nivel:         3,
    salarioMin:    400,
    salarioMax:    600,
    exigencia:     25,
    exigenciaNome: 'Atendente de Loja',
  },
  {
    slug:          'diretor',
    nome:          '🏢 Diretor de Empresa',
    nivel:         4,
    salarioMin:    1000,
    salarioMax:    1500,
    exigencia:     50,
    exigenciaNome: 'Programador Júnior',
  },
];

// Mapas de acesso rápido
const CARGO_POR_SLUG  = Object.fromEntries(CARGOS.map(c => [c.slug, c]));
const CARGO_POR_NIVEL = Object.fromEntries(CARGOS.map(c => [c.nivel, c]));

// ─── CONFIGURAÇÃO DE TEMPO ────────────────────────────────────────────────────

const TEMPO = {
  COOLDOWN_MS:   4 * 60 * 60 * 1000,  // 4 h — tempo mínimo entre turnos
  JANELA_MS:     2 * 60 * 60 * 1000,  // 2 h — tolerância após o cooldown
  DEMISSAO_MS:   6 * 60 * 60 * 1000,  // 6 h — demitido se ultrapassar este limite
};
// Resumo da linha do tempo por turno:
//   t=0h  → trabalhou
//   t=4h  → próximo turno disponível  (COOLDOWN_MS)
//   t=6h  → fim da janela de tolerância (COOLDOWN_MS + JANELA_MS)
//   t=6h+ → demissão por justa causa  (≡ DEMISSAO_MS desde o último trabalho)

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

function getGroupId(msg) {
  const jid = msg?.key?.remoteJid ?? '';
  return jid.endsWith('@g.us') ? jid : null;
}

async function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

/** Número inteiro aleatório entre min e max (inclusive). */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Formata milissegundos em "Xh Ym". */
function formatMs(ms) {
  const totalMin = Math.ceil(ms / 60_000);
  const h        = Math.floor(totalMin / 60);
  const m        = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0)          return `${h}h`;
  return `${m}min`;
}

/**
 * Verifica se o usuário está em um grupo e retorna userId + groupId.
 * Retorna null se for conversa privada (já envia aviso).
 */
async function resolverContexto(sock, msg, jid) {
  const userId  = getUserId(msg);
  const groupId = getGroupId(msg);
  if (!userId) {
    await reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
    return null;
  }
  if (!groupId) {
    await reply(sock, jid, msg,
      '💼 *Os empregos são por grupo!*\n\nUse este comando em um grupo.'
    );
    return null;
  }
  return { userId, groupId };
}

// ─── !procuraremprego ────────────────────────────────────────────────────────

async function handleProcurarEmprego(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    // Já tem emprego?
    if (carteira.empregoAtual && carteira.empregoAtual !== 'desempregado') {
      const cargo = CARGO_POR_SLUG[carteira.empregoAtual];
      return reply(sock, jid, msg,
        `💼 *VOCÊ JÁ TEM EMPREGO!*\n\n` +
        `Cargo atual: *${cargo?.nome ?? carteira.empregoAtual}*\n\n` +
        `Use *!trabalhar* para bater o ponto ou\n` +
        `*!promocao* para tentar subir de nível.`
      );
    }

    // Histórico sujo → 30% de chance de contratação
    if (carteira.historicoSujo) {
      const aprovado = Math.random() < 0.30;
      if (!aprovado) {
        return reply(sock, jid, msg,
          `📋 *HISTÓRICO SUJO DETECTADO*\n\n` +
          `Você foi demitido por justa causa anteriormente.\n` +
          `As empresas estão relutantes em te contratar...\n\n` +
          `😔 *Sua candidatura foi recusada desta vez.*\n` +
          `💡 Continue tentando — você tem 30% de chance a cada tentativa.`
        );
      }
    }

    // Contratado! Sempre começa no nível 1
    const cargoInicial = CARGOS[0];
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: groupId },
      {
        $set: {
          empregoAtual:             cargoInicial.slug,
          totalTrabalhosComSucesso: 0,
          ultimoTrabalho:           null,
          historicoSujo:            false,   // limpa o histórico ao ser contratado
        },
      }
    );

    return reply(sock, jid, msg,
      `🎉 *PARABÉNS! VOCÊ FOI CONTRATADO!*\n\n` +
      `💼 Cargo: *${cargoInicial.nome}*\n` +
      `💰 Salário por turno: *${cargoInicial.salarioMin}–${cargoInicial.salarioMax} gold*\n\n` +
      `📋 Use *!trabalhar* para começar a ganhar!\n` +
      `⏰ Cooldown entre turnos: *4 horas*\n` +
      `⚠️ Não perca o ponto — você tem *2h de tolerância* após o cooldown!`
    );

  } catch (e) {
    console.error('[Emprego] handleProcurarEmprego:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao procurar emprego! Tente novamente.');
  }
}

// ─── !trabalhar / !work ──────────────────────────────────────────────────────

async function handleTrabalhar(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    // ── Sem emprego ────────────────────────────────────────────────────────
    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO!*\n\n` +
        `Use *!procuraremprego* para conseguir um cargo\n` +
        `e começar a ganhar gold neste grupo.`
      );
    }

    const cargo = CARGO_POR_SLUG[carteira.empregoAtual];
    const agora = Date.now();
    const ultimoTrabalho = carteira.ultimoTrabalho
      ? new Date(carteira.ultimoTrabalho).getTime()
      : null;

    // ── Primeiro turno (nunca trabalhou antes) ────────────────────────────
    if (!ultimoTrabalho) {
      return await _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);
    }

    const decorrido = agora - ultimoTrabalho;

    // ── Cooldown ainda ativo (< 4h) ────────────────────────────────────────
    if (decorrido < TEMPO.COOLDOWN_MS) {
      const falta = TEMPO.COOLDOWN_MS - decorrido;
      return reply(sock, jid, msg,
        `⏳ *TURNO EM ANDAMENTO!*\n\n` +
        `💼 Cargo: *${cargo.nome}*\n` +
        `🕐 Próximo turno disponível em: *${formatMs(falta)}*\n\n` +
        `💡 _Não se atrase! Você tem 2h após o desbloqueio para bater o ponto._`
      );
    }

    // ── Passou de 6h (demissão por justa causa) ────────────────────────────
    if (decorrido >= TEMPO.DEMISSAO_MS) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        {
          $set: {
            empregoAtual:             null,
            totalTrabalhosComSucesso: 0,
            historicoSujo:            true,
            ultimoTrabalho:           null,
          },
        }
      );

      const horasPassadas = (decorrido / 3_600_000).toFixed(1);
      return reply(sock, jid, msg,
        `🔴 *DEMITIDO POR JUSTA CAUSA!*\n\n` +
        `Você demorou *${horasPassadas}h* para bater o ponto.\n` +
        `A janela de tolerância era de apenas *2 horas* após o desbloqueio.\n\n` +
        `📋 Consequências:\n` +
        `  ❌ Cargo perdido: *${cargo.nome}*\n` +
        `  ❌ Progresso zerado\n` +
        `  ⚠️ Histórico sujo ativado (30% de chance de recontratação)\n\n` +
        `Use *!procuraremprego* para tentar um novo emprego.`
      );
    }

    // ── Dentro da janela (entre 4h e 6h) → executar turno ─────────────────
    return await _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);

  } catch (e) {
    console.error('[Emprego] handleTrabalhar:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao processar turno! Tente novamente.');
  }
}

/**
 * Executa um turno bem-sucedido: paga salário, incrementa contador, salva data.
 * Separado para ser chamado tanto no primeiro turno quanto nos seguintes.
 */
async function _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora) {
  const salario    = randInt(cargo.salarioMin, cargo.salarioMax);
  const novosSucc  = (carteira.totalTrabalhosComSucesso ?? 0) + 1;

  // Persiste turno e soma gold (via alterarGold para registrar no histórico)
  await Promise.all([
    CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: groupId },
      {
        $set: { ultimoTrabalho: new Date(agora) },
        $inc: { totalTrabalhosComSucesso: 1 },
      }
    ),
    alterarGold(userId, groupId, salario, `Salário: ${cargo.nome}`),
  ]);

  // Verifica se está pronto para promoção
  const proximoCargo = CARGO_POR_NIVEL[cargo.nivel + 1] ?? null;
  const podePromover = proximoCargo && novosSucc >= proximoCargo.exigencia;

  let resposta =
    `✅ *TURNO CONCLUÍDO!*\n\n` +
    `💼 Cargo: *${cargo.nome}*\n` +
    `💰 Salário recebido: *+${salario} gold*\n` +
    `📊 Turnos neste cargo: *${novosSucc}*\n`;

  if (podePromover) {
    resposta +=
      `\n🎯 *VOCÊ ESTÁ PRONTO PARA SER PROMOVIDO!*\n` +
      `Use *!promocao* para subir para *${proximoCargo.nome}*!`;
  } else if (proximoCargo) {
    const faltam = proximoCargo.exigencia - novosSucc;
    resposta +=
      `\n📈 Próxima promoção (*${proximoCargo.nome}*): faltam *${faltam} turnos*`;
  } else {
    resposta += `\n🏆 _Você está no cargo máximo! Parabéns, lenda._`;
  }

  resposta +=
    `\n\n⏰ Próximo turno disponível em *4 horas*\n` +
    `⚠️ _Não passe de 6h ou você será demitido!_`;

  return reply(sock, msg.key.remoteJid, msg, resposta);
}

// ─── !promocao ────────────────────────────────────────────────────────────────

async function handlePromocao(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO!*\n\nUse *!procuraremprego* primeiro.`
      );
    }

    const cargoAtual   = CARGO_POR_SLUG[carteira.empregoAtual];
    const proximoCargo = CARGO_POR_NIVEL[cargoAtual.nivel + 1] ?? null;

    // Cargo máximo
    if (!proximoCargo) {
      return reply(sock, jid, msg,
        `🏆 *VOCÊ JÁ ESTÁ NO CARGO MÁXIMO!*\n\n` +
        `Cargo: *${cargoAtual.nome}*\n\n` +
        `Não há para onde subir. Você é a lenda deste grupo! 👑`
      );
    }

    const sucessos = carteira.totalTrabalhosComSucesso ?? 0;

    // Não atingiu a exigência
    if (sucessos < proximoCargo.exigencia) {
      const faltam = proximoCargo.exigencia - sucessos;
      return reply(sock, jid, msg,
        `📋 *PROMOÇÃO INDISPONÍVEL*\n\n` +
        `Cargo atual: *${cargoAtual.nome}*\n` +
        `Próximo cargo: *${proximoCargo.nome}*\n\n` +
        `✅ Turnos concluídos: *${sucessos}*\n` +
        `🎯 Exigência: *${proximoCargo.exigencia} turnos*\n` +
        `⏳ Faltam: *${faltam} turno(s)*\n\n` +
        `Continue usando *!trabalhar* para acumular turnos!`
      );
    }

    // Promovido!
    await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp: userId, idGrupo: groupId },
      {
        $set: {
          empregoAtual:             proximoCargo.slug,
          totalTrabalhosComSucesso: 0,   // zera para o novo cargo
        },
      }
    );

    return reply(sock, jid, msg,
      `🎊 *PARABÉNS! VOCÊ FOI PROMOVIDO!*\n\n` +
      `📤 Cargo anterior: *${cargoAtual.nome}*\n` +
      `📥 Novo cargo:     *${proximoCargo.nome}*\n\n` +
      `💰 Novo salário por turno: *${proximoCargo.salarioMin}–${proximoCargo.salarioMax} gold*\n\n` +
      `🔄 Seu contador de turnos foi zerado para o novo cargo.\n` +
      `Use *!trabalhar* para começar a acumular!`
    );

  } catch (e) {
    console.error('[Emprego] handlePromocao:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao processar promoção! Tente novamente.');
  }
}

// ─── !emprego ─────────────────────────────────────────────────────────────────

async function handleEmprego(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      const sujo = carteira.historicoSujo ? '\n⚠️ Histórico sujo: *30% de chance de contratação*' : '';
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO*\n\n` +
        `Use *!procuraremprego* para conseguir um cargo!${sujo}`
      );
    }

    const cargo         = CARGO_POR_SLUG[carteira.empregoAtual];
    const proximoCargo  = CARGO_POR_NIVEL[(cargo?.nivel ?? 0) + 1] ?? null;
    const sucessos      = carteira.totalTrabalhosComSucesso ?? 0;
    const agora         = Date.now();
    const ultimoTs      = carteira.ultimoTrabalho ? new Date(carteira.ultimoTrabalho).getTime() : null;

    // Status do turno
    let statusTurno = '🟢 Disponível para trabalhar agora!';
    if (ultimoTs) {
      const decorrido = agora - ultimoTs;
      if (decorrido < TEMPO.COOLDOWN_MS) {
        const falta = TEMPO.COOLDOWN_MS - decorrido;
        statusTurno = `🟡 Próximo turno em *${formatMs(falta)}*`;
      } else if (decorrido < TEMPO.DEMISSAO_MS) {
        const janelRestante = TEMPO.DEMISSAO_MS - decorrido;
        statusTurno = `🔴 *ATENÇÃO!* Janela de tolerância: *${formatMs(janelRestante)}* restantes!`;
      } else {
        statusTurno = '💀 *Você será demitido ao usar !trabalhar!*';
      }
    }

    let texto =
      `💼 *SEU EMPREGO NESTE GRUPO*\n\n` +
      `🏢 Cargo: *${cargo?.nome ?? carteira.empregoAtual}*\n` +
      `💰 Salário: *${cargo?.salarioMin}–${cargo?.salarioMax} gold*\n` +
      `📊 Turnos no cargo atual: *${sucessos}*\n` +
      `📅 Status: ${statusTurno}\n`;

    if (proximoCargo) {
      const faltam = Math.max(0, proximoCargo.exigencia - sucessos);
      texto +=
        `\n📈 *Próxima promoção:* ${proximoCargo.nome}\n` +
        (faltam === 0
          ? `   ✅ *Pronto! Use !promocao agora!*`
          : `   ⏳ Faltam *${faltam} turno(s)*`);
    } else {
      texto += `\n🏆 _Cargo máximo atingido!_`;
    }

    if (carteira.historicoSujo) {
      texto += `\n\n⚠️ _Histórico sujo registrado._`;
    }

    return reply(sock, jid, msg, texto);

  } catch (e) {
    console.error('[Emprego] handleEmprego:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar emprego! Tente novamente.');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleProcurarEmprego,
  handleTrabalhar,
  handlePromocao,
  handleEmprego,

  // Exporta tabela para uso externo (ex.: loja, ranking)
  CARGOS,
  CARGO_POR_SLUG,
};