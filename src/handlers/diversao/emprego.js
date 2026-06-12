/**
 * Handler de Empregos — Bot WhatsApp
 * Sistema de carreira com cooldown, janela de tolerância e demissão por justa causa
 *
 * v1.4 — Cooldown de 2h entre turnos; trabalho só permitido das 12:30 às 22:30 (Brasília).
 *
 * Comandos exportados:
 *   !procuraremprego  → tenta ser contratado
 *   !trabalhar / !work → bate o ponto
 *   !promocao         → tenta subir de nível
 *   !emprego          → exibe status atual
 *   !demitir          → pede demissão voluntariamente
 *   !menuwork         → exibe o menu de empregos
 */

'use strict';

// ─── IMPORTS ──────────────────────────────────────────────────────────────────
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

const CARGOS = [
  { slug: 'entregador',  nome: '🛵 Entregador de Pizza',    nivel: 1, salarioMin: 50,   salarioMax: 100,  exigencia: 0,   exigenciaNome: null },
  { slug: 'atendente',   nome: '🏪 Atendente de Loja',      nivel: 2, salarioMin: 150,  salarioMax: 250,  exigencia: 10,  exigenciaNome: 'Entregador de Pizza' },
  { slug: 'mecanico',    nome: '🔧 Mecânico',                nivel: 3, salarioMin: 280,  salarioMax: 420,  exigencia: 18,  exigenciaNome: 'Atendente de Loja' },
  { slug: 'chef',        nome: '👨‍🍳 Chef de Cozinha',       nivel: 4, salarioMin: 400,  salarioMax: 580,  exigencia: 28,  exigenciaNome: 'Mecânico' },
  { slug: 'programador', nome: '💻 Programador Júnior',      nivel: 5, salarioMin: 600,  salarioMax: 850,  exigencia: 40,  exigenciaNome: 'Chef de Cozinha' },
  { slug: 'medico',      nome: '🩺 Médico',                  nivel: 6, salarioMin: 900,  salarioMax: 1200, exigencia: 55,  exigenciaNome: 'Programador Júnior' },
  { slug: 'diretor',     nome: '🏢 Diretor de Empresa',      nivel: 7, salarioMin: 1300, salarioMax: 1800, exigencia: 75,  exigenciaNome: 'Médico' },
  { slug: 'empresario',  nome: '💎 Empresário Bilionário',   nivel: 8, salarioMin: 2500, salarioMax: 4000, exigencia: 100, exigenciaNome: 'Diretor de Empresa' },
];

const CARGO_POR_SLUG  = Object.fromEntries(CARGOS.map(c => [c.slug, c]));
const CARGO_POR_NIVEL = Object.fromEntries(CARGOS.map(c => [c.nivel, c]));

// ─── CONFIGURAÇÃO DE TEMPO ────────────────────────────────────────────────────

// Horário de funcionamento em minutos desde meia-noite (fuso Brasília)
const HORARIO = {
  INICIO_MIN: 12 * 60 + 30, // 12:30 → 750 min
  FIM_MIN:    22 * 60 + 30, // 22:30 → 1350 min
  FUSO:       'America/Sao_Paulo',
};

const TEMPO = {
  COOLDOWN_MS: 2 * 60 * 60 * 1000,        // 2h entre turnos
  JANELA_MS:   30 * 60 * 1000,            // 30 min de tolerância após cooldown
};
TEMPO.DEMISSAO_MS = TEMPO.COOLDOWN_MS + TEMPO.JANELA_MS; // 2h30

const LABEL_COOLDOWN = '2h';
const LABEL_JANELA   = '30min';
const LABEL_DEMISSAO = '2h30';
const LABEL_HORARIO  = '12:30 às 22:30 (Brasília)';

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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatMs(ms) {
  const totalMin = Math.ceil(ms / 60_000);
  const h        = Math.floor(totalMin / 60);
  const m        = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0)          return `${h}h`;
  return `${m}min`;
}

/**
 * Retorna os minutos desde meia-noite no fuso de Brasília.
 */
function getMinutosBrasilia(ts = Date.now()) {
  const str = new Date(ts).toLocaleString('pt-BR', {
    timeZone: HORARIO.FUSO,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  });
  // formato "HH:MM"
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Verifica se agora está dentro do horário de funcionamento.
 */
function dentroDoHorario(ts = Date.now()) {
  const min = getMinutosBrasilia(ts);
  return min >= HORARIO.INICIO_MIN && min < HORARIO.FIM_MIN;
}

/**
 * Retorna quantos ms faltam para o próximo horário de abertura (12:30 Brasília).
 */
function msParaAbertura(ts = Date.now()) {
  const min      = getMinutosBrasilia(ts);
  const faltaMin = min < HORARIO.INICIO_MIN
    ? HORARIO.INICIO_MIN - min
    : (24 * 60 - min) + HORARIO.INICIO_MIN;
  return faltaMin * 60_000;
}

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

function resolverCargo(slug) {
  const cargo = CARGO_POR_SLUG[slug];
  if (!cargo) console.warn(`[Emprego] Slug desconhecido na carteira: "${slug}"`);
  return cargo ?? null;
}

function filtro(userId, groupId) {
  return { idWhatsApp: userId, idGrupo: groupId };
}

// ─── !procuraremprego ────────────────────────────────────────────────────────

async function handleProcurarEmprego(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  if (!dentroDoHorario()) {
    const falta = msParaAbertura();
    return reply(sock, jid, msg,
      `🌙 *FORA DO HORÁRIO COMERCIAL*\n\n` +
      `Os empregos funcionam apenas das *${LABEL_HORARIO}*.\n\n` +
      `⏰ A agência de empregos abre em *${formatMs(falta)}*.`
    );
  }

  try {
    const carteira = await getCarteira(userId, groupId);

    if (carteira.empregoAtual && carteira.empregoAtual !== 'desempregado') {
      const cargo = resolverCargo(carteira.empregoAtual);
      return reply(sock, jid, msg,
        `💼 *VOCÊ JÁ TEM EMPREGO!*\n\n` +
        `Cargo atual: *${cargo?.nome ?? carteira.empregoAtual}*\n\n` +
        `Use *!trabalhar* para bater o ponto ou *!promocao* para subir de nível.\n` +
        `Para sair, use *!demitir*.`
      );
    }

    // ── Verificar cooldown de demissão voluntária ──
    if (carteira.demissaoVoluntariaAte) {
      const bloqueio = new Date(carteira.demissaoVoluntariaAte).getTime();
      if (Date.now() < bloqueio) {
        const falta = bloqueio - Date.now();
        return reply(sock, jid, msg,
          `⏳ *AGUARDE PARA SE REEMPREGAR*\n\n` +
          `Você pediu demissão recentemente.\n` +
          `O mercado estará disponível novamente em: *${formatMs(falta)}*\n\n` +
          `_Pense bem antes de pedir demissão da próxima vez!_`
        );
      }
    }

    // ── Histórico sujo ──
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

    const cargoInicial = CARGOS[0];
    await CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      {
        $set: {
          empregoAtual:             cargoInicial.slug,
          totalTrabalhosComSucesso: 0,
          ultimoTrabalho:           null,
          historicoSujo:            false,
          demissaoVoluntariaAte:    null, // limpa o bloqueio ao ser contratado
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
      `⚠️ Não perca o ponto — você tem *${LABEL_JANELA} de tolerância* após o cooldown!\n` +
      `🕐 Horário de funcionamento: *${LABEL_HORARIO}*`
    );

  } catch (e) {
    console.error('[Emprego] handleProcurarEmprego:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao procurar emprego! Tente novamente.');
  }
}

// ─── CALCULAR TEMPO FORA DO HORÁRIO ──────────────────────────────────────────

function calcularTempoForaHorario(desde, ate) {
  // Itera de minuto em minuto contando quantos ms ficaram fora do horário comercial
  let fora   = 0;
  let cursor = desde;
  const PASSO = 60_000; // 1 minuto em ms

  while (cursor < ate) {
    const min = getMinutosBrasilia(cursor);
    if (min < HORARIO.INICIO_MIN || min >= HORARIO.FIM_MIN) {
      fora += Math.min(PASSO, ate - cursor);
    }
    cursor += PASSO;
  }
  return fora;
}

// ─── EXECUTAR TURNO ───────────────────────────────────────────────────────────

async function _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora) {
  const salario  = randInt(cargo.salarioMin, cargo.salarioMax);
  const sucessos = (carteira.totalTrabalhosComSucesso ?? 0) + 1;

  await CarteiraGrupo.findOneAndUpdate(
    filtro(userId, groupId),
    {
      $set: { ultimoTrabalho: new Date(agora) },
      $inc: { totalTrabalhosComSucesso: 1 },
    }
  );

  await alterarGold(userId, groupId, salario);

  const proximoCargo = CARGO_POR_NIVEL[cargo.nivel + 1] ?? null;
  let progressoTexto = '';

  if (proximoCargo) {
    const faltam  = Math.max(0, proximoCargo.exigencia - sucessos);
    const barsOn  = Math.min(10, Math.floor((sucessos / proximoCargo.exigencia) * 10));
    const barra   = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);
    progressoTexto = faltam === 0
      ? `\n\n✅ *Promoção disponível!* Use *!promocao* agora!`
      : `\n\n📈 Progresso: [${barra}] *${sucessos}/${proximoCargo.exigencia}* turnos para *${proximoCargo.nome}*`;
  } else {
    progressoTexto = `\n\n🏆 _Você está no cargo máximo!_`;
  }

  return reply(sock, jid, msg,
    `✅ *TURNO CONCLUÍDO!*\n\n` +
    `💼 Cargo: *${cargo.nome}*\n` +
    `💰 Salário recebido: *+${salario} gold*\n` +
    `📊 Turnos no cargo: *${sucessos}*\n` +
    `⏰ Próximo turno disponível em: *${LABEL_COOLDOWN}* _(horário comercial)_\n` +
    `⚠️ _Bata o ponto em até ${LABEL_JANELA} após o desbloqueio ou será demitido!_` +
    progressoTexto
  );
}

// ─── !trabalhar / !work ──────────────────────────────────────────────────────

async function handleTrabalhar(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg,
        `😴 *VOCÊ ESTÁ DESEMPREGADO!*\n\nUse *!procuraremprego* para conseguir um cargo.`
      );
    }

    const cargo = resolverCargo(carteira.empregoAtual);
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

    const agora          = Date.now();
    const ultimoTrabalho = carteira.ultimoTrabalho
      ? new Date(carteira.ultimoTrabalho).getTime()
      : null;

    // ── Primeiro turno — apenas verifica horário ──
    if (!ultimoTrabalho) {
      if (!dentroDoHorario()) {
        const falta = msParaAbertura();
        return reply(sock, jid, msg,
          `🌙 *FORA DO HORÁRIO COMERCIAL*\n\n` +
          `Você só pode trabalhar das *${LABEL_HORARIO}*.\n\n` +
          `⏰ O expediente começa em *${formatMs(falta)}*.\n` +
          `💡 _Seu ponto não conta fora desse horário!_`
        );
      }
      return _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);
    }

    // ── Cálculo de tempo efetivo (exclui período fora do horário) ──
    const tempoForaHorario = calcularTempoForaHorario(ultimoTrabalho, agora);
    const decorridoEfetivo = (agora - ultimoTrabalho) - tempoForaHorario;

    // 1. Cooldown ainda ativo
    if (decorridoEfetivo < TEMPO.COOLDOWN_MS) {
      const falta = TEMPO.COOLDOWN_MS - decorridoEfetivo;
      return reply(sock, jid, msg,
        `⏳ *TURNO EM ANDAMENTO!*\n\n` +
        `💼 Cargo: *${cargo.nome}*\n` +
        `🕐 Próximo turno disponível em: *${formatMs(falta)}* _(tempo comercial)_\n\n` +
        `💡 _Não se atrase! Você tem ${LABEL_JANELA} após o desbloqueio para bater o ponto._`
      );
    }

    // 2. Cooldown expirou mas estamos fora do horário agora
    if (!dentroDoHorario()) {
      const falta = msParaAbertura();
      return reply(sock, jid, msg,
        `🌙 *FORA DO HORÁRIO COMERCIAL*\n\n` +
        `Você só pode trabalhar das *${LABEL_HORARIO}*.\n\n` +
        `⏰ O expediente começa em *${formatMs(falta)}*.\n` +
        `💡 _Seu ponto não conta fora desse horário!_`
      );
    }

    // 3. Tolerância estourada → demissão por justa causa
    if (decorridoEfetivo >= TEMPO.DEMISSAO_MS) {
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

      const totalMins  = Math.floor(decorridoEfetivo / 60_000);
      const horas      = Math.floor(totalMins / 60);
      const mins       = totalMins % 60;
      const tempoFmt   = mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;

      return reply(sock, jid, msg,
        `🔴 *DEMITIDO POR JUSTA CAUSA!*\n\n` +
        `⏱️ Tempo útil comercial sem bater ponto: *${tempoFmt}*\n` +
        `📌 Janela de tolerância: *${LABEL_JANELA}* após o cooldown de *${LABEL_COOLDOWN}*\n` +
        `🌙 _(Períodos fora do horário comercial foram completamente congelados)_\n\n` +
        `📋 *Consequências:*\n` +
        `  ❌ Cargo perdido: *${cargo.nome}*\n` +
        `  ❌ Progresso zerado\n` +
        `  ⚠️ Histórico sujo ativado *(30% de chance de recontratação)*\n\n` +
        `Use *!procuraremprego* para tentar um novo emprego.`
      );
    }

    // 4. Tudo certo — executa o turno
    return _executarTurno(sock, msg, jid, userId, groupId, carteira, cargo, agora);

  } catch (e) {
    console.error('[Emprego] handleTrabalhar:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao processar turno! Tente novamente.');
  }
}

// ─── !promocao ────────────────────────────────────────────────────────────────

async function handlePromocao(sock, msg, jid) {
  const ctx = await resolverContexto(sock, msg, jid);
  if (!ctx) return;
  const { userId, groupId } = ctx;

  try {
    const carteira = await getCarteira(userId, groupId);

    if (!carteira.empregoAtual || carteira.empregoAtual === 'desempregado') {
      return reply(sock, jid, msg, `😴 *VOCÊ ESTÁ DESEMPREGADO!*\n\nUse *!procuraremprego* primeiro.`);
    }

    const cargoAtual = resolverCargo(carteira.empregoAtual);
    if (!cargoAtual) {
      return reply(sock, jid, msg, '⚠️ Cargo inválido. Use *!procuraremprego* para se reempregar.');
    }

    const proximoCargo = CARGO_POR_NIVEL[cargoAtual.nivel + 1] ?? null;

    if (!proximoCargo) {
      return reply(sock, jid, msg,
        `🏆 *VOCÊ JÁ ESTÁ NO CARGO MÁXIMO!*\n\n` +
        `Cargo: *${cargoAtual.nome}*\n\n` +
        `Não há para onde subir. Você é a lenda deste grupo! 👑`
      );
    }

    const sucessos = carteira.totalTrabalhosComSucesso ?? 0;

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

    await CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      { $set: { empregoAtual: proximoCargo.slug, totalTrabalhosComSucesso: 0 } }
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
    if (!cargo) {
      await CarteiraGrupo.findOneAndUpdate(filtro(userId, groupId), { $set: { empregoAtual: null } });
      return reply(sock, jid, msg,
        `⚠️ Cargo inválido detectado. Seu emprego foi resetado.\nUse *!procuraremprego* para se reempregar.`
      );
    }

    const proximoCargo = CARGO_POR_NIVEL[cargo.nivel + 1] ?? null;
    const sucessos     = carteira.totalTrabalhosComSucesso ?? 0;
    const agora        = Date.now();
    const ultimoTs     = carteira.ultimoTrabalho
      ? new Date(carteira.ultimoTrabalho).getTime()
      : null;

    // Status do turno
    let statusTurno = dentroDoHorario()
      ? '🟢 Disponível para trabalhar agora!'
      : `🌙 Fora do horário *(${LABEL_HORARIO})*`;

    if (ultimoTs) {
      const decorrido = agora - ultimoTs;
      if (decorrido < TEMPO.COOLDOWN_MS) {
        const falta = TEMPO.COOLDOWN_MS - decorrido;
        statusTurno = `🟡 Próximo turno em *${formatMs(falta)}*`;
      } else if (decorrido < TEMPO.DEMISSAO_MS) {
        const janelaRestante = TEMPO.DEMISSAO_MS - decorrido;
        statusTurno = `🔴 *ATENÇÃO!* Janela expira em *${formatMs(janelaRestante)}* — trabalhe logo!`;
      } else if (decorrido >= TEMPO.DEMISSAO_MS) {
        statusTurno = `💀 *Prazo esgotado! Você será demitido ao usar !trabalhar*`;
      }
    }

    // Barra de progresso
    let progressoTexto = '';
    if (proximoCargo) {
      const faltam  = Math.max(0, proximoCargo.exigencia - sucessos);
      const barsOn  = Math.min(10, Math.floor((sucessos / proximoCargo.exigencia) * 10));
      const barra   = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);
      progressoTexto =
        `\n📈 *Próxima promoção:* ${proximoCargo.nome}\n` +
        `   [${barra}] ${sucessos}/${proximoCargo.exigencia} turnos\n` +
        (faltam === 0
          ? `   ✅ *Pronto! Use !promocao agora!*`
          : `   ⏳ Faltam *${faltam} turno(s)*`);
    } else {
      progressoTexto = `\n🏆 _Você está no cargo máximo!_`;
    }

    let texto =
      `💼 *SEU EMPREGO NESTE GRUPO*\n\n` +
      `🏢 Cargo: *${cargo.nome}*\n` +
      `💰 Salário: *${cargo.salarioMin}–${cargo.salarioMax} gold* por turno\n` +
      `📊 Turnos no cargo: *${sucessos}*\n` +
      `📅 Status: ${statusTurno}` +
      progressoTexto +
      `\n\n🕐 Horário: *${LABEL_HORARIO}*`;

    if (carteira.historicoSujo) texto += `\n⚠️ _Histórico sujo registrado._`;

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

    // Cooldown de 30min para recontratação após demissão voluntária
    const bloqueioAte = new Date(Date.now() + 30 * 60 * 1000);

    await CarteiraGrupo.findOneAndUpdate(
      filtro(userId, groupId),
      {
        $set: {
          empregoAtual:             null,
          totalTrabalhosComSucesso: 0,
          ultimoTrabalho:           null,
          demissaoVoluntariaAte:    bloqueioAte, // ← novo campo
        },
      }
    );

    return reply(sock, jid, msg,
      `👋 *VOCÊ PEDIU DEMISSÃO!*\n\n` +
      `Cargo encerrado: *${cargo?.nome ?? carteira.empregoAtual}*\n\n` +
      `✅ Histórico preservado (saída voluntária).\n` +
      `⏳ Você poderá se reempregar em *30 minutos*.\n\n` +
      `_O mercado precisa de um tempo para novas vagas aparecerem..._`
    );

  } catch (e) {
    console.error('[Emprego] handleDemitir:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao processar demissão! Tente novamente.');
  }
}

// ─── !menuwork ────────────────────────────────────────────────────────────────

async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';

  const listaCargos = CARGOS
    .map(c =>
      `  ${c.nivel}. ${c.nome}` +
      (c.nivel === 1 ? '  _(inicial)_' : c.nivel === CARGOS.length ? '  _(máximo)_' : '')
    )
    .join('\n');

  const menu =
`╔══════════════════════╗
      💼 MENU EMPREGOS
╚══════════════════════╝

🔎 *COMEÇAR*
  ▸ ${P}procuraremprego — Procura um emprego
  ▸ ${P}emprego — Ver seu cargo e status atual
  ▸ ${P}demitir — Pedir demissão voluntária

⏱️ *TRABALHAR*
  ▸ ${P}trabalhar — Bater o ponto e receber salário
  ▸ ${P}work — Atalho para !trabalhar

📈 *PROGRESSÃO*
  ▸ ${P}promocao — Subir de cargo (se tiver turnos suficientes)

━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *CARGOS DISPONÍVEIS*
${listaCargos}

━━━━━━━━━━━━━━━━━━━━━━━━
⏰ *REGRAS DO PONTO*
  • Horário de funcionamento: *${LABEL_HORARIO}*
  • Cooldown entre turnos: *${LABEL_COOLDOWN}*
  • Janela de tolerância: *${LABEL_JANELA}* após o cooldown
  • Após *${LABEL_DEMISSAO}* sem bater ponto → demissão por justa causa
  ⚠️ _Histórico sujo reduz chance de recontratação para 30%_
  🌙 _Turnos fora do horário não são aceitos!_

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────

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