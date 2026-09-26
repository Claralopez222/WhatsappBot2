'use strict';

const { getCarteira, alterarGold } = require('../../../utils/carteira');
const { resolveGlobalId } = require('../../../utils/identity');

// ─── !slots ─────────────────────────────────────────────────────────────

const SLOTS_SIMBOLOS = [
  { emoji: '💎', nome: 'Diamante', peso: 2  },
  { emoji: '7️⃣',  nome: 'Sete',    peso: 5  },
  { emoji: '🔔', nome: 'Sino',    peso: 10 },
  { emoji: '🍇', nome: 'Uva',     peso: 15 },
  { emoji: '🍉', nome: 'Melancia', peso: 18 },
  { emoji: '🍋', nome: 'Limão',   peso: 22 },
  { emoji: '🍒', nome: 'Cereja',  peso: 28 },
];

// Pré-computa pool ponderada uma única vez
const SLOTS_POOL = SLOTS_SIMBOLOS.flatMap(s => Array(s.peso).fill(s.emoji));

const SLOTS_MULTIPLICADORES = {
  '💎': { tres: 50, dois: 5  },
  '7️⃣':  { tres: 25, dois: 3  },
  '🔔': { tres: 15, dois: 2  },
  '🍇': { tres: 10, dois: 1.5 },
  '🍉': { tres: 8,  dois: 1.5 },
  '🍋': { tres: 6,  dois: 1.2 },
  '🍒': { tres: 4,  dois: 1.2 },
};

const SLOTS_FRAMES_ANIM = [
  ['🎲', '🎲', '🎲'],
  ['🍒', '🎲', '🎲'],
  ['🍋', '🍇', '🎲'],
  ['🍉', '🔔', '🍒'],
  ['🔔', '🍋', '🍒'],
  ['🍇', '🍉', '🍋'],
];
const SLOTS_FRAME_DELAY = 320;

function sortearSlots() {
  const pick = () => SLOTS_POOL[Math.floor(Math.random() * SLOTS_POOL.length)];
  return [pick(), pick(), pick()];
}

function calcularResultado(r1, r2, r3, aposta) {
  if (r1 === r2 && r2 === r3) {
    const mult  = SLOTS_MULTIPLICADORES[r1]?.tres ?? 4;
    const label =
      mult >= 25
        ? `🌟 *JACKPOT LENDÁRIO!* Três ${r1} — *${mult}x*!`
        : mult >= 10
        ? `🎉 *JACKPOT!* Três ${r1} — *${mult}x*!`
        : `✨ *TRÊS IGUAIS!* ${r1}${r1}${r1} — *${mult}x*!`;
    return { mult, label, tipo: 'tres' };
  }

  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const simbolo = r1 === r2 ? r1 : r3 === r2 ? r2 : r1;
    const mult    = SLOTS_MULTIPLICADORES[simbolo]?.dois ?? 1.2;
    return {
      mult,
      label: `💫 *DOIS IGUAIS!* ${simbolo}${simbolo} — *${mult}x*`,
      tipo: 'dois',
    };
  }

  return { mult: 0, label: `❌ *Perdeu!* O cassino agradece 🏦`, tipo: 'derrota' };
}

function buildFrame(s1, s2, s3, girando = true) {
  const status = girando ? `_Girando..._` : `_Resultado_`;
  return (
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `┌─────────────────┐\n` +
    `│   ${s1}  │  ${s2}  │  ${s3}   │\n` +
    `└─────────────────┘\n\n` +
    status
  );
}

function buildResultado(r1, r2, r3, aposta, mult, label, lucroLiq, saldoFinal) {
  const premio  = Math.floor(aposta * mult);
  const icone   = lucroLiq > 0 ? '📈' : lucroLiq === 0 ? '➖' : '📉';
  const sinal   = lucroLiq >= 0 ? '+' : '';

  return (
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `┌─────────────────┐\n` +
    `│   ${r1}  │  ${r2}  │  ${r3}   │\n` +
    `└─────────────────┘\n\n` +
    `${label}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📋 *DETALHES DA RODADA*\n` +
    `  💵 Aposta:      *${aposta} gold*\n` +
    (mult > 0
      ? `  ✖️  Multiplicador: *${mult}x*\n` +
        `  🏆 Prêmio:      *${premio} gold*\n`
      : '') +
    `  ${icone} Resultado:   *${sinal}${lucroLiq} gold*\n` +
    `  💰 Saldo final: *${saldoFinal} gold*`
  );
}

async function handleSlots(sock, msg, jid, senderJid, caption) {
  const args       = caption.trim().split(/\s+/);
  const aposta     = parseInt(args[1]);
  const senderNorm = resolveGlobalId(senderJid);

  // ── Validação da aposta
  if (!aposta || isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
        `⚠️ Uso correto: *!slots [valor]*\n` +
        `Exemplo: *!slots 100*\n\n` +
        `💎 Símbolos e multiplicadores (3x iguais):\n` +
        SLOTS_SIMBOLOS.map(s =>
          `  ${s.emoji} ${s.nome}: *${SLOTS_MULTIPLICADORES[s.emoji].tres}x* (par: ${SLOTS_MULTIPLICADORES[s.emoji].dois}x)`
        ).join('\n'),
    }, { quoted: msg });
    return;
  }

  // ── Verifica e debita saldo
  const carteira = await getCarteira(senderNorm, jid);
  const saldo    = carteira?.gold ?? 0;

  if (saldo < aposta) {
    await sock.sendMessage(jid, {
      text:
        `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
        `❌ *Saldo insuficiente!*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💰 Seu saldo:  *${saldo} gold*\n` +
        `🎲 Aposta:     *${aposta} gold*\n` +
        `📉 Faltam:     *${aposta - saldo} gold*`,
    }, { quoted: msg });
    return;
  }

  await alterarGold(senderNorm, jid, -aposta, 'Slots (aposta)');

  // ── Animação de giro
  const msgInicial = await sock.sendMessage(
    jid,
    { text: buildFrame('🎲', '🎲', '🎲', true) },
    { quoted: msg }
  );

  for (const [s1, s2, s3] of SLOTS_FRAMES_ANIM) {
    await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));
    try { await sock.chatModify({ text: buildFrame(s1, s2, s3, true) }, msgInicial.key); } catch {}
  }

  await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));

  // ── Resultado
  const [r1, r2, r3]    = sortearSlots();
  const { mult, label } = calcularResultado(r1, r2, r3, aposta);
  const premio          = Math.floor(aposta * mult);
  const lucroLiq        = premio - aposta;

  // ── Credita prêmio e calcula saldo final
  let saldoFinal = saldo - aposta;
  if (premio > 0) {
    const carteiraAtualizada = await alterarGold(senderNorm, jid, premio, `Slots (${mult}x)`);
    saldoFinal = carteiraAtualizada.gold;
  }

  const textoFinal = buildResultado(r1, r2, r3, aposta, mult, label, lucroLiq, saldoFinal);

  try { await sock.chatModify({ text: textoFinal }, msgInicial.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── !corrida ───────────────────────────────────────────────────────────

const CORRIDA_BICHOS = [
  { nome: '🐎 Cavalo',    emoji: '🐎', odds: 2.0, velocidade: 9 },
  { nome: '🐅 Tigre',     emoji: '🐅', odds: 2.5, velocidade: 8 },
  { nome: '🦊 Raposa',    emoji: '🦊', odds: 3.0, velocidade: 7 },
  { nome: '🐕 Cachorro',  emoji: '🐕', odds: 3.5, velocidade: 6 },
  { nome: '🐗 Javali',    emoji: '🐗', odds: 4.0, velocidade: 5 },
  { nome: '🐢 Tartaruga', emoji: '🐢', odds: 8.0, velocidade: 2 },
];

const CORRIDA_PISTA_LEN   = 12;
const CORRIDA_FRAMES      = 5;
const CORRIDA_FRAME_DELAY = 800;

function sortearVencedor() {
  const pool = CORRIDA_BICHOS.flatMap((b, i) => Array(b.velocidade).fill(i));
  return pool[Math.floor(Math.random() * pool.length)];
}

function gerarPosicoes(frame, totalFrames, vencedorIdx = null) {
  return CORRIDA_BICHOS.map((b, i) => {
    if (vencedorIdx !== null && i === vencedorIdx) return CORRIDA_PISTA_LEN;
    const base  = Math.floor((b.velocidade / 10) * (CORRIDA_PISTA_LEN * (frame / totalFrames)));
    const ruido = Math.floor(Math.random() * 3);
    return Math.min(base + ruido, CORRIDA_PISTA_LEN - 1);
  });
}

function buildFrameCorrida(posicoes, titulo = '_Correndo..._') {
  let texto = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;

  for (let i = 0; i < CORRIDA_BICHOS.length; i++) {
    const pos    = posicoes[i];
    const trilha = '─'.repeat(pos) + CORRIDA_BICHOS[i].emoji + '─'.repeat(Math.max(0, CORRIDA_PISTA_LEN - pos));
    texto += `${trilha} 🏁\n`;
  }

  texto += `\n${titulo}`;
  return texto;
}

function buildResultadoCorrida(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal) {
  const vencedor = CORRIDA_BICHOS[vencedorIdx];
  const escolha  = CORRIDA_BICHOS[escolhaIdx];
  const ganhou   = vencedorIdx === escolhaIdx;
  const premio   = ganhou ? Math.floor(aposta * escolha.odds) : 0;
  const icone    = ganhou ? '🎉' : '❌';
  const sinal    = lucroLiq >= 0 ? '+' : '';

  let texto = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;

  for (let i = 0; i < CORRIDA_BICHOS.length; i++) {
    if (i === vencedorIdx) {
      texto += `${'─'.repeat(CORRIDA_PISTA_LEN)}${CORRIDA_BICHOS[i].emoji} 🏆\n`;
    } else {
      const pos = Math.floor(Math.random() * (CORRIDA_PISTA_LEN - 2)) + 2;
      texto += `${'─'.repeat(pos)}${CORRIDA_BICHOS[i].emoji}${'─'.repeat(CORRIDA_PISTA_LEN - pos)} 🏁\n`;
    }
  }

  texto +=
    `\n━━━━━━━━━━━━━━━━\n` +
    `🎯 Sua aposta: *${escolha.nome}* (odds ${escolha.odds}x)\n` +
    `🏆 Vencedor:   *${vencedor.nome}*\n\n` +
    `${icone} ${ganhou
      ? `*VITÓRIA!* Você ganhou *+${premio} gold*!`
      : `*DERROTA!* Você perdeu *${aposta} gold.*`
    }\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `  💵 Aposta:      *${aposta} gold*\n` +
    (ganhou
      ? `  ✖️  Odds:         *${escolha.odds}x*\n` +
        `  🏆 Prêmio:      *${premio} gold*\n`
      : '') +
    `  📊 Resultado:   *${sinal}${lucroLiq} gold*\n` +
    `  💰 Saldo final: *${saldoFinal} gold*`;

  return texto;
}

async function handleCorrida(sock, msg, jid, senderJid, caption) {
  const args       = caption.trim().split(/\s+/);
  const escolha    = parseInt(args[1]);
  const aposta     = parseInt(args[2]);
  const senderNorm = resolveGlobalId(senderJid);

  const escolhaValida = escolha >= 1 && escolha <= CORRIDA_BICHOS.length;

  if (!escolha || !aposta || isNaN(escolha) || isNaN(aposta) || !escolhaValida || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `🏁 *CORRIDA DE BICHOS* 🏁\n\n` +
        `⚠️ Uso: *!corrida [bicho] [valor]*\n\n` +
        `*Escolha seu corredor:*\n` +
        CORRIDA_BICHOS.map((b, i) =>
          `  ${i + 1}️⃣ ${b.nome} — odds *${b.odds}x*`
        ).join('\n') +
        `\n\n💡 Exemplo: *!corrida 1 100* (100 gold no Cavalo)\n` +
        `⚠️ Bichos mais lentos pagam mais, mas ganham menos!`,
    }, { quoted: msg });
    return;
  }

  const escolhaIdx = escolha - 1;

  // ── Verifica e debita saldo
  const carteira = await getCarteira(senderNorm, jid);
  const saldo    = carteira?.gold ?? 0;

  if (saldo < aposta) {
    await sock.sendMessage(jid, {
      text:
        `🏁 *CORRIDA DE BICHOS* 🏁\n\n` +
        `❌ *Saldo insuficiente!*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💰 Seu saldo:  *${saldo} gold*\n` +
        `🎲 Aposta:     *${aposta} gold*\n` +
        `📉 Faltam:     *${aposta - saldo} gold*`,
    }, { quoted: msg });
    return;
  }

  await alterarGold(senderNorm, jid, -aposta, `Corrida (${CORRIDA_BICHOS[escolhaIdx].nome})`);

  // ── Sortear vencedor antes da animação (resultado já definido)
  const vencedorIdx = sortearVencedor();

  // ── Animação
  const posIniciais = CORRIDA_BICHOS.map(() => 0);
  const msgCorrida  = await sock.sendMessage(
    jid,
    { text: buildFrameCorrida(posIniciais, '_Largando..._') },
    { quoted: msg }
  );

  for (let f = 1; f <= CORRIDA_FRAMES; f++) {
    await new Promise(r => setTimeout(r, CORRIDA_FRAME_DELAY));
    const posicoes = gerarPosicoes(f, CORRIDA_FRAMES);
    try {
      await sock.chatModify(
        { text: buildFrameCorrida(posicoes, `_Volta ${f} de ${CORRIDA_FRAMES}..._`) },
        msgCorrida.key
      );
    } catch {}
  }

  // ── Frame final — vencedor chegou
  await new Promise(r => setTimeout(r, CORRIDA_FRAME_DELAY));
  const posFinal = gerarPosicoes(CORRIDA_FRAMES, CORRIDA_FRAMES, vencedorIdx);
  try { await sock.chatModify({ text: buildFrameCorrida(posFinal, `_Finalizando..._`) }, msgCorrida.key); } catch {}
  await new Promise(r => setTimeout(r, 600));

  // ── Creditar prêmio e calcular saldo final
  const ganhou   = escolhaIdx === vencedorIdx;
  const premio   = ganhou ? Math.floor(aposta * CORRIDA_BICHOS[escolhaIdx].odds) : 0;
  const lucroLiq = premio - aposta;

  let saldoFinal = saldo - aposta;
  if (premio > 0) {
    const carteiraAtualizada = await alterarGold(senderNorm, jid, premio, `Corrida (${CORRIDA_BICHOS[escolhaIdx].nome})`);
    saldoFinal = carteiraAtualizada.gold;
  }

  const textoFinal = buildResultadoCorrida(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal);

  try { await sock.chatModify({ text: textoFinal }, msgCorrida.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── !apostar ─────────────────────────────────────────────────────────────

const { resolveUserFromMsg } = require('../../../utils/identity');
const { debitarGold, getSaldoGrupo } = require('./_shared');

async function handleApostar(sock, msg, jid, caption) {
  const userId  = resolveUserFromMsg(msg);
  const idGrupo = jid;
  const match   = caption.match(/apostar\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!apostar <quantia>*\nExemplo: *!apostar 100*' }, { quoted: msg });
    return;
  }

  const aposta = parseInt(match[1], 10);
  if (isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ *QUANTIA INVÁLIDA*\n\nA aposta deve ser um número positivo!' }, { quoted: msg });
    return;
  }

  const userDebited = await debitarGold(userId, idGrupo, aposta, 'Aposta');
  if (!userDebited) {
    const saldo = await getSaldoGrupo(userId, idGrupo);
    await sock.sendMessage(jid, {
      text: `⚠️ *SALDO INSUFICIENTE*\n\n💰 Você tem: *${saldo}* gold\n💸 Precisa de: *${aposta}* gold`,
    }, { quoted: msg });
    return;
  }

  const ganhou = Math.random() < 0.5;

  if (ganhou) {
    const premio     = aposta * 2;
    const lucroLiq   = aposta;
    const carteira   = await alterarGold(userId, idGrupo, premio, 'Aposta (vitória)');
    const saldoFinal = carteira?.gold ?? (userDebited.gold + premio);

    await sock.sendMessage(jid, {
      text:
        `🎉 ═══ VOCÊ GANHOU! ═══ 🎉\n\n🎲 *Parabéns, sua sorte foi boa!*\n\n` +
        `━━━━━━━━━━━━━━━━\n*RESULTADO:*\n` +
        `  💵 Aposta: *${aposta}* gold\n` +
        `  💰 Ganho líquido: *+${lucroLiq}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`,
    }, { quoted: msg });
  } else {
    const saldoFinal = userDebited.gold;
    await sock.sendMessage(jid, {
      text:
        `😢 ═══ VOCÊ PERDEU! ═══ 😢\n\n🎲 *Que azar...*\n\n` +
        `━━━━━━━━━━━━━━━━\n*RESULTADO:*\n` +
        `  💵 Aposta perdida: *${aposta}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`,
    }, { quoted: msg });
  }
}

module.exports = { handleSlots, handleCorrida, handleApostar };