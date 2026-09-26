'use strict';

const Usuario       = require('../../../models/Usuario');
const CarteiraGrupo = require('../../../models/CarteiraGrupo');
const { alterarGold } = require('../../../utils/carteira');
const { getSenderJid } = require('../../../utils/identity');
const { prepareDailyMissionState, incrementMission } = require('../missoes');
const { MINERIOS, EVENTOS_GARIMPO, NARRATIVAS } = require('../../../config/economia');

const GARIMPO_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos

// ─── Helpers ────────────────────────────────────────────────────────────

function sortearMinerio() {
  const roll = Math.random() * 100;
  let acumulado = 0;
  for (const m of MINERIOS) {
    acumulado += m.chance;
    if (roll < acumulado) return m;
  }
  return MINERIOS[MINERIOS.length - 1];
}

function sortearEvento() {
  const roll = Math.random() * 100;
  let acumulado = 0;
  for (const e of EVENTOS_GARIMPO) {
    acumulado += e.chance;
    if (roll < acumulado) return e;
  }
  return null;
}

function getRaridadeKey(chance) {
  if (chance <= 1)  return 'lendario';
  if (chance <= 5)  return 'raro';
  if (chance <= 15) return 'incomum';
  return 'comum';
}

function getRaridadeLabel(chance) {
  if (chance <= 1)  return '🌟 *LENDÁRIO!*';
  if (chance <= 5)  return '✨ *Raro!*';
  if (chance <= 15) return '🔹 Incomum';
  return '▫️ Comum';
}

function narrativaAleatoria(key) {
  const lista = NARRATIVAS[key] ?? NARRATIVAS.comum;
  return lista[Math.floor(Math.random() * lista.length)];
}

function formatarTempo(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function msgCooldown(restante) {
  return (
    `⏳ *GARIMPO EM COOLDOWN* ⏳\n\n` +
    `⛏️ Você já garimpou recentemente!\n\n` +
    `⏰ Próximo garimpo em: *${formatarTempo(restante)}*\n\n` +
    `_Use !garimpar quando o tempo acabar._`
  );
}

// ─── Cache local: userId normalizado → timestamp do último garimpo ────────
const garimpoCache = new Map();

// ─── Handler principal ────────────────────────────────────────────────────
async function handleGarimpar(sock, msg, jid) {
  const userIdRaw = getSenderJid(msg);
  const agora     = Date.now();

  // ── Mantém o JID original (@lid ou @s.whatsapp.net) — NÃO usar
  // resolveGlobalId() aqui. Após a mesclagem, carteiras estão salvas
  // como @lid; forçar @s.whatsapp.net quebraria a busca no banco.
  const userId = userIdRaw?.includes('@')
    ? userIdRaw
    : userIdRaw + '@s.whatsapp.net';

  // ── Trava contra corrida: dois !garimpar quase simultâneos do mesmo
  // usuário passavam os dois pela checagem de cooldown antes que qualquer
  // um gravasse o timestamp (há awaits no meio) — rendia garimpo em dobro.
  if (!global._garimpoInFlight) global._garimpoInFlight = new Set();
  if (global._garimpoInFlight.has(userId)) {
    await sock.sendMessage(jid, { text: '⏳ Já estou processando seu garimpo, aguarde um instante...' }, { quoted: msg });
    return;
  }
  global._garimpoInFlight.add(userId);

  let docAtual;

  try {

  // ── 1. Checar cache local (chave = userId normalizado) ─────────────────
  const tsCache = garimpoCache.get(userId) ?? 0;
  if (tsCache > 0) {
    const passado = agora - tsCache;
    if (passado < GARIMPO_COOLDOWN_MS) {
      await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passado) }, { quoted: msg });
      return;
    }
  }

  // ── 2. Busca o doc atual para checar cooldown real no banco ────────────
  // Separar leitura de escrita evita a ambiguidade do upsert com $or,
  // que era a causa do cooldown sempre mostrar 15 minutos.
  docAtual = await Usuario.findOne(
    { idWhatsApp: userId },
    { ultimoGarimpo: 1 }
  ).lean();

  if (docAtual?.ultimoGarimpo) {
    const tsUltimo  = new Date(docAtual.ultimoGarimpo).getTime();
    const passadoDB = agora - tsUltimo;
    if (passadoDB < GARIMPO_COOLDOWN_MS) {
      // Sincroniza cache com o valor real do banco
      garimpoCache.set(userId, tsUltimo);
      await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passadoDB) }, { quoted: msg });
      return;
    }
  }

  // ── 3. Cooldown livre — grava timestamp e sorteia ───────────────────────
  garimpoCache.set(userId, agora);

  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $set: { ultimoGarimpo: new Date(agora) } },
    { upsert: true }
  );

  try {
    const minerio     = sortearMinerio();
    const evento      = sortearEvento();
    const raridadeKey = getRaridadeKey(minerio.chance);
    const raridadeTxt = getRaridadeLabel(minerio.chance);
    const narrativa   = narrativaAleatoria(raridadeKey);

    let goldFinal = minerio.gold;
    let xpFinal   = minerio.xp ?? 5;
    let eventoTxt = '';

    if (evento) {
      goldFinal = Math.floor(minerio.gold * evento.multiplicador);
      xpFinal   = Math.floor(xpFinal * Math.max(evento.multiplicador, 0.5));
      eventoTxt = evento.msg;
    }

    await prepareDailyMissionState(userId);

    const [carteira] = await Promise.all([
      alterarGold(userId, jid, goldFinal, `Garimpo - ${minerio.nome}`),
      // gold500 saiu deste $inc direto — sem cap, "!missao" podia mostrar
      // progresso passando de 500 (ex: "12300/500") pra quem garimpava
      // itens caros repetidamente. incrementMission() trava no alvo com
      // $min e marca completed uma única vez.
      Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { xp: xpFinal } },
        { upsert: true }
      ),
      incrementMission(userId, 'gold500', goldFinal),
      CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: jid },
        { $inc: { xp: xpFinal } },
        { upsert: true }
      ),
    ]);

    // ── Monta mensagem ──────────────────────────────────────────────────
    const linhas = [
      `⛏️ *═══ GARIMPO ═══* ⛏️`,
      ``,
      `_${narrativa}_`,
      ``,
      `━━━━━━━━━━━━━━━━`,
      `${minerio.emoji} Minério: *${minerio.nome}*`,
      `⭐ Raridade: ${raridadeTxt}`,
    ];

    if (evento) linhas.push(``, `⚡ *EVENTO:* ${eventoTxt}`);

    linhas.push(``);
    if (goldFinal > 0) {
      linhas.push(`💰 Encontrado: *+${goldFinal} gold*`);
    } else {
      linhas.push(`💰 Encontrado: *nada — evento destruiu tudo!*`);
    }

    linhas.push(`⚡ XP ganho: *+${xpFinal} XP*`);
    linhas.push(`💳 Novo saldo: *${carteira?.gold ?? '?'} gold*`);
    linhas.push(``);
    linhas.push(`⏰ Próximo garimpo em: *15 minutos*`);

    await sock.sendMessage(jid, { text: linhas.join('\n') }, { quoted: msg });

  } catch (e) {
    // Rollback: restaura ultimoGarimpo anterior para não queimar o cooldown
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { ultimoGarimpo: docAtual?.ultimoGarimpo ?? null } }
    ).catch(() => {});

    garimpoCache.delete(userId);

    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
  }
  } finally {
    // Libera a trava independente do caminho (sucesso, cooldown ou erro)
    global._garimpoInFlight.delete(userId);
  }
}

module.exports = { handleGarimpar };