'use strict';

const path = require('path');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const Usuario       = require(path.join(__dirname, '..', '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', '..', 'models', 'CarteiraGrupo'));
const { alterarGold } = require(path.join(__dirname, '..', '..', '..', 'utils', 'carteira'));
const { getSenderJid } = require(path.join(__dirname, '..', '..', '..', 'utils', 'identity'));
const { formatWalletAmount, getWalletBalance } = require(path.join(__dirname, '..', '..', '..', 'utils', 'carteira', 'wallet'));

// Fallback seguro caso missoes não exporte prepareDailyMissionState/incrementMission
let prepareDailyMissionState = async () => {};
let incrementMission = async () => {};
try {
  const missoesMod = require(path.join(__dirname, '..', 'missoes'));
  if (missoesMod.prepareDailyMissionState) prepareDailyMissionState = missoesMod.prepareDailyMissionState;
  if (missoesMod.incrementMission) incrementMission = missoesMod.incrementMission;
} catch {}

const { MINERIOS, EVENTOS_GARIMPO, NARRATIVAS } = require(path.join(__dirname, '..', '..', '..', 'config', 'economia'));

const GARIMPO_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos

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

const garimpoCache = new Map();

async function handleGarimpar(sock, msg, jid) {
  const userIdRaw = getSenderJid(msg);
  const userId    = jidNormalizedUser(userIdRaw);
  const agora     = Date.now();

  const walletGarimpo = await getWalletBalance(userId);
  if (walletGarimpo.linked) {
    await sock.sendMessage(jid, {
      text: 'O garimpo está temporariamente indisponível para contas vinculadas ao app.',
    }, { quoted: msg });
    return;
  }

  if (!global._garimpoInFlight) global._garimpoInFlight = new Set();
  if (global._garimpoInFlight.has(userId)) {
    await sock.sendMessage(jid, { text: '⏳ Já estou processando seu garimpo, aguarde um instante...' }, { quoted: msg });
    return;
  }
  global._garimpoInFlight.add(userId);

  let docAtual;

  try {
    const tsCache = garimpoCache.get(userId) ?? 0;
    if (tsCache > 0) {
      const passado = agora - tsCache;
      if (passado < GARIMPO_COOLDOWN_MS) {
        await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passado) }, { quoted: msg });
        return;
      }
    }

    docAtual = await Usuario.findOne(
      { idWhatsApp: userId },
      { ultimoGarimpo: 1 }
    ).lean();

    if (docAtual?.ultimoGarimpo) {
      const tsUltimo  = new Date(docAtual.ultimoGarimpo).getTime();
      const passadoDB = agora - tsUltimo;
      if (passadoDB < GARIMPO_COOLDOWN_MS) {
        garimpoCache.set(userId, tsUltimo);
        await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passadoDB) }, { quoted: msg });
        return;
      }
    }

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
        linhas.push(`💰 Encontrado: *+${formatWalletAmount(goldFinal, carteira)}*`);
      } else {
        linhas.push(`💰 Encontrado: *nada — evento destruiu tudo!*`);
      }

      linhas.push(`⚡ XP ganho: *+${xpFinal} XP*`);
      linhas.push(`💳 Novo saldo: *${formatWalletAmount(carteira?.gold ?? 0, carteira)}*`);
      linhas.push(``);
      linhas.push(`⏰ Próximo garimpo em: *15 minutos*`);

      await sock.sendMessage(jid, { text: linhas.join('\n') }, { quoted: msg });

    } catch (e) {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $set: { ultimoGarimpo: docAtual?.ultimoGarimpo ?? null } }
      ).catch(() => {});

      garimpoCache.delete(userId);

      console.error('⚠️ Erro handleGarimpar:', e.message);
      await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
    }
  } finally {
    global._garimpoInFlight.delete(userId);
  }
}

module.exports = { handleGarimpar };
