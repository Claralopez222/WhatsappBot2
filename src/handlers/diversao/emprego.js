/**
 * Handler de Empregos — Bot WhatsApp
 * Sistema de carreira com cooldown, janela de tolerância e demissão por justa causa
 *
 * v1.2 — cooldown ajustado para 6h30, demissão para 8h30, mensagens sincronizadas,
 *         correção do bug de jid em _executarTurno, limpeza geral
 *
 * ⚠️  ATENÇÃO: Ajuste os dois requires abaixo conforme a estrutura do seu projeto.
 *
 * Comandos exportados:
 *   !procuraremprego  → tenta ser contratado
 *   !trabalhar / !work → bate o ponto (com toda a lógica de tempo)
 *   !promocao         → tenta subir de nível
 *   !emprego          → exibe status atual
 *   !demitir          → pede demissão voluntariamente
 */

'use strict';

// ─── IMPORTS ──────────────────────────────────────────────────────────────────
// TODO: ajuste os caminhos abaixo para bater com a estrutura real do projeto.
//       Exemplo: se este arquivo está em src/handlers/diversao/emprego.js e
//       os models ficam em src/models/, o caminho correto é '../../models/CarteiraGrupo'

let CarteiraGrupo;
let getCarteira;
let alterarGold;

try {
  CarteiraGrupo = require('../../models/CarteiraGrupo');
  ({ getCarteira, alterarGold } = require('../../utils/carteira'));
} catch (err) {
  console.error(
    '[Emprego] ERRO CRÍTICO: Não foi possível importar dependências.\n' +
    '  Verifique os caminhos de CarteiraGrupo e carteiraService.\n' +
    '  Detalhe:', err.message
  );
  process.exit(1);
}

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
    exigencia:     0,
    exigenciaNome: null,
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
  COOLDOWN_MS: 6.5 * 60 * 60 * 1000,  // 6h30 — tempo mínimo entre turnos
  JANELA_MS:     2 * 60 * 60 * 1000,  // 2h   — tolerância após o cooldown
  // DEMISSAO_MS é derivado para manter consistência automática:
  // se COOLDOWN_MS ou JANELA_MS mudarem, o limite de demissão acompanha.
};
TEMPO.DEMISSAO_MS = TEMPO.COOLDOWN_MS + TEMPO.JANELA_MS; // 8h30

// Linha do tempo por turno:
//   t=0h00 → trabalhou
//   t=6h30 → próximo turno disponível  (COOLDOWN_MS)
//   t=8h30 → fim da janela de tolerância (COOLDOWN_MS + JANELA_MS)
//   t>8h30 → demissão por justa causa  (≥ DEMISSAO_MS desde o último trabalho)

// Labels legíveis para usar nas mensagens (evita hardcode espalhado pelo código)
const LABEL_COOLDOWN  = '6h30';
const LABEL_JANELA    = '2h';
const LABEL_DEMISSAO  = '8h30';

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/** Extrai o ID do usuário da mensagem. */
function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

/** Retorna o JID do grupo ou null se for conversa privada. */
function getGroupId(msg) {
  const jid = msg?.key?.remoteJid ?? '';
  return jid.endsWith('@g.us') ? jid : null;
}

/** Envia resposta citando a mensagem original. */
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
 * Verifica contexto de grupo e retorna { userId, groupId }.
 * Envia aviso e retorna null se não for grupo ou usuário inválido.
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

/**
 * Retorna o cargo correspondente ao slug, ou null com log de aviso.
 * Evita erros silenciosos quando o banco tem um slug desconhecido.
 */
function resolverCargo(slug) {
  const cargo = CARGO_POR_SLUG[slug];
  if (!cargo) {
    console.warn(`[Emprego] Slug desconhecido na carteira: "${slug}"`);
  }
  return cargo ?? null;
}

// ─── QUERY HELPER ─────────────────────────────────────────────────────────────

/** Filtro padrão para findOneAndUpdate. */
function filtro(userId, groupId) {
  return { idWhatsApp: userId, idGrupo: groupId };
}

// ─── !procuraremprego ────────────────────────────────────────────────────────

async function handleProcurarEmprego(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    // Já empregado?
    if (carteira.empregoAtual && carteira.empregoAtual !== 'desempregado') {
      const cargo = resolverCargo(carteira.empregoAtual);
      return reply(sock, jid, msg,
        `💼 *VOCÊ JÁ TEM EMPREGO!*\n\n` +
        `Cargo atual: *${cargo?.nome ?? carteira.empregoAtual}*\n\n` +
        `Use *!trabalhar* para bater o ponto ou\n` +
        `*!promocao* para tentar subir de nível.\n` +
        `Para sair, use *!demitir*.`
      );
    }

    // Histórico sujo → 30 % de chance de contratação
    if (carteira.historicoSujo) {
      const aprovado = Math.random() < 0.30;
      if (!aprovado) {
        return reply(sock, jid, msg,
          `📋 *HISTÓRICO SUJO DETECTADO*\n\n` +
          `Você foi demitido por justa causa anteriormente.\n` +
          `As empresas estão relutantes em te contratar...\n\n` +
          `😔 *Sua candidatura foi recusada desta vez.*\n` +
          `💡 Continue tentando — você tem *30%* de chance a cada tentativa.`
        );
      }
    }

    // Contratado! Sempre começa no nível 1
    const cargoInicial = CARGOS[0];
    await CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      {
        $set: {
          empregoAtual:             cargoInicial.slug,
          totalTrabalhosComSucesso: 0,
          ultimoTrabalho:           null,
          historicoSujo:            false,
        },
      },
      { upsert: true }
    );

    return reply(sock, jid, msg,
      `🎉 *PARABÉNS! VOCÊ FOI CONTRATADO!*\n\n` +
      `💼 Cargo: *${cargoInicial.nome}*\n` +
      `💰 Salário por turno: *${cargoInicial.salarioMin}–${cargoInicial.salarioMax} gold*\n\n` +
      `📋 Use *!trabalhar* para começar a ganhar!\n` +
      `⏰ Cooldown entre turnos: *${LABEL_COOLDOWN}*\n` +
      `⚠️ Não perca o ponto — você tem *${LABEL_JANELA} de tolerância* após o cooldown!`
    );

  } catch (e) {
    console.error('[Emprego] handleProcurarEmprego:', e);
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

    // Sem emprego
    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO!*\n\n` +
        `Use *!procuraremprego* para conseguir um cargo\n` +
        `e começar a ganhar gold neste grupo.`
      );
    }

    const cargo = resolverCargo(carteira.empregoAtual);
    if (!cargo) {
      // Slug inválido no banco — reseta para evitar estado corrompido
      await CarteiraGrupo.findOneAndUpdate(
        filtro(userId, groupId),
        { $set: { empregoAtual: null } }
      );
      return reply(sock, jid, msg,
        `⚠️ Cargo inválido detectado. Seu emprego foi resetado.\n` +
        `Use *!procuraremprego* para se reempregar.`
      );
    }

    const agora          = Date.now();
    const ultimoTrabalho = carteira.ultimoTrabalho
      ? new Date(carteira.ultimoTrabalho).getTime()
      : null;

    // Primeiro turno — nunca houve registro anterior
    if (!ultimoTrabalho) {
      return _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);
    }

    const decorrido = agora - ultimoTrabalho;

    // Cooldown ainda ativo (< 6h30)
    if (decorrido < TEMPO.COOLDOWN_MS) {
      const falta = TEMPO.COOLDOWN_MS - decorrido;
      return reply(sock, jid, msg,
        `⏳ *TURNO EM ANDAMENTO!*\n\n` +
        `💼 Cargo: *${cargo.nome}*\n` +
        `🕐 Próximo turno disponível em: *${formatMs(falta)}*\n\n` +
        `💡 _Não se atrase! Você tem ${LABEL_JANELA} após o desbloqueio para bater o ponto._`
      );
    }

    // Passou de 8h30 — demissão por justa causa
    if (decorrido >= TEMPO.DEMISSAO_MS) {
      await CarteiraGrupo.findOneAndUpdate(
        filtro(userId, groupId),
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
        `A janela de tolerância era de apenas *${LABEL_JANELA}* após o desbloqueio.\n\n` +
        `📋 Consequências:\n` +
        `  ❌ Cargo perdido: *${cargo.nome}*\n` +
        `  ❌ Progresso zerado\n` +
        `  ⚠️ Histórico sujo ativado *(30% de chance de recontratação)*\n\n` +
        `Use *!procuraremprego* para tentar um novo emprego.`
      );
    }

    // Dentro da janela (entre 6h30 e 8h30) → executar turno
    return _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);

  } catch (e) {
    console.error('[Emprego] handleTrabalhar:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao processar turno! Tente novamente.');
  }
}

/**
 * Executa um turno bem-sucedido: paga salário, incrementa contador, salva data.
 *
 * CORREÇÃO v1.2: usa o parâmetro `jid` recebido em vez de `msg.key.remoteJid`,
 * garantindo consistência com o resto das funções do handler.
 */
async function _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora) {
  const salario   = randInt(cargo.salarioMin, cargo.salarioMax);
  const novosSucc = (carteira.totalTrabalhosComSucesso ?? 0) + 1;

  await Promise.all([
    CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      {
        $set: { ultimoTrabalho: new Date(agora) },
        $inc: { totalTrabalhosComSucesso: 1 },
      }
    ),
    alterarGold(userId, groupId, salario, `Salário: ${cargo.nome}`),
  ]);

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
      `\n📈 Próxima promoção (*${proximoCargo.nome}*): faltam *${faltam} turno(s)*`;
  } else {
    resposta += `\n🏆 _Você está no cargo máximo! Parabéns, lenda._`;
  }

  resposta +=
    `\n\n⏰ Próximo turno disponível em *${LABEL_COOLDOWN}*\n` +
    `⚠️ _Não passe de ${LABEL_DEMISSAO} ou você será demitido!_`;

  return reply(sock, jid, msg, resposta);
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

    const cargoAtual = resolverCargo(carteira.empregoAtual);
    if (!cargoAtual) {
      return reply(sock, jid, msg,
        '⚠️ Cargo inválido. Use *!procuraremprego* para se reempregar.'
      );
    }

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

    // Exigência não atingida
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
      filtro(userId, groupId),
      {
        $set: {
          empregoAtual:             proximoCargo.slug,
          totalTrabalhosComSucesso: 0,
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
    console.error('[Emprego] handlePromocao:', e);
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

    // Desempregado
    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      const sujo = carteira.historicoSujo
        ? '\n⚠️ Histórico sujo: *30% de chance de contratação*'
        : '';
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO*\n\n` +
        `Use *!procuraremprego* para conseguir um cargo!${sujo}`
      );
    }

    const cargo = resolverCargo(carteira.empregoAtual);

    // Cargo inválido no banco — reseta silenciosamente
    if (!cargo) {
      await CarteiraGrupo.findOneAndUpdate(
        filtro(userId, groupId),
        { $set: { empregoAtual: null } }
      );
      return reply(sock, jid, msg,
        `⚠️ Cargo inválido detectado. Seu emprego foi resetado.\n` +
        `Use *!procuraremprego* para se reempregar.`
      );
    }

    const proximoCargo = CARGO_POR_NIVEL[cargo.nivel + 1] ?? null;
    const sucessos     = carteira.totalTrabalhosComSucesso ?? 0;
    const agora        = Date.now();
    const ultimoTs     = carteira.ultimoTrabalho
      ? new Date(carteira.ultimoTrabalho).getTime()
      : null;

    // ── Status do turno ──────────────────────────────────────────────────────
    let statusTurno = '🟢 Disponível para trabalhar agora!';
    if (ultimoTs) {
      const decorrido = agora - ultimoTs;
      if (decorrido < TEMPO.COOLDOWN_MS) {
        const falta = TEMPO.COOLDOWN_MS - decorrido;
        statusTurno = `🟡 Próximo turno em *${formatMs(falta)}*`;
      } else if (decorrido < TEMPO.DEMISSAO_MS) {
        const janelaRestante = TEMPO.DEMISSAO_MS - decorrido;
        statusTurno = `🔴 *ATENÇÃO!* Janela expira em *${formatMs(janelaRestante)}* — trabalhe logo!`;
      } else {
        statusTurno = `💀 *Prazo esgotado! Você será demitido ao usar !trabalhar*`;
      }
    }

    // ── Progresso de promoção ────────────────────────────────────────────────
    let progressoTexto = '';
    if (proximoCargo) {
      const faltam = Math.max(0, proximoCargo.exigencia - sucessos);
      const barsOn = Math.min(10, Math.floor((sucessos / proximoCargo.exigencia) * 10));
      const barra  = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);
      progressoTexto =
        `\n📈 *Próxima promoção:* ${proximoCargo.nome}\n` +
        `   [${barra}] ${sucessos}/${proximoCargo.exigencia} turnos\n` +
        (faltam === 0
          ? `   ✅ *Pronto! Use !promocao agora!*`
          : `   ⏳ Faltam *${faltam} turno(s)*`);
    } else {
      progressoTexto = `\n🏆 _Você está no cargo máximo!_`;
    }

    // ── Montar resposta ──────────────────────────────────────────────────────
    let texto =
      `💼 *SEU EMPREGO NESTE GRUPO*\n\n` +
      `🏢 Cargo: *${cargo.nome}*\n` +
      `💰 Salário: *${cargo.salarioMin}–${cargo.salarioMax} gold* por turno\n` +
      `📊 Turnos no cargo: *${sucessos}*\n` +
      `📅 Status: ${statusTurno}` +
      progressoTexto;

    if (carteira.historicoSujo) {
      texto += `\n\n⚠️ _Histórico sujo registrado._`;
    }

    return reply(sock, jid, msg, texto);

  } catch (e) {
    console.error('[Emprego] handleEmprego:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar emprego! Tente novamente.');
  }
}
// ─── !demitir ─────────────────────────────────────────────────────────────────

async function handleDemitir(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg,
        `😴 *VOCÊ JÁ ESTÁ DESEMPREGADO!*\n\nUse *!procuraremprego* para conseguir um cargo.`
      );
    }

    const cargo = resolverCargo(carteira.empregoAtual);

    await CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      {
        $set: {
          empregoAtual:             null,
          totalTrabalhosComSucesso: 0,
          ultimoTrabalho:           null,
          // Demissão voluntária não suja o histórico
        },
      }
    );

    return reply(sock, jid, msg,
      `👋 *VOCÊ PEDIU DEMISSÃO!*\n\n` +
      `Cargo encerrado: *${cargo?.nome ?? carteira.empregoAtual}*\n\n` +
      `✅ Seu histórico foi preservado (saída voluntária).\n` +
      `Use *!procuraremprego* quando quiser voltar ao mercado.`
    );

  } catch (e) {
    console.error('[Emprego] handleDemitir:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao processar demissão! Tente novamente.');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────
module.exports = {
  handleProcurarEmprego,
  handleTrabalhar,
  handlePromocao,
  handleEmprego,
  handleDemitir,
  handleMenuWork,
  CARGOS,
  CARGO_POR_SLUG,
};