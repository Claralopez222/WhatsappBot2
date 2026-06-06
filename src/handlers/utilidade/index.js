const fs = require('fs');
const path = require('path');
const { fetchBuffer, fetchJson } = require(path.join(__dirname, '..', '..', 'fetchurl'));
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { handleMenu, handleMenuUtil, handleMenuJogos, handleMenuBaixar, handleMenuRelacionamento, handleAlteradores } = require(path.join(__dirname, 'menu'));
const { handleLevelOn, handleLevel, handleRankLevel } = require(path.join(__dirname, 'level'));
const { handleSave, handleSaveRec, handleTiktok, handleAudioDownload, handleSom, handlePlayMp4, handlePlayDoc, getYtDlpPath, getYtDlpArgs, getFfmpegPath, getFfprobePath } = require(path.join(__dirname, 'downloads'));

let logger = { level: 'silent' };
let REMOVEBG_KEY = process.env.REMOVEBG_KEY || '';

const MORSE_TABLE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', ':': '---...', ';': '-.-.-.', "'": '.----.', '"': '.-..-.', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '@': '.--.-.',
};
const MORSE_REVERSE = Object.entries(MORSE_TABLE).reduce((acc, [key, value]) => { acc[value] = key; return acc; }, {});

function encodeMorse(text) {
  return text.toUpperCase().split('').map((char) => {
    if (char === ' ') return '/';
    return MORSE_TABLE[char] || '?';
  }).join(' ');
}

function decodeMorse(code) {
  return code.trim().split(/\s+/).map((token) => {
    if (token === '/') return ' ';
    return MORSE_REVERSE[token] || '?';
  }).join('').replace(/ {2,}/g, ' ');
}

function setLogger(newLogger) {
  logger = newLogger;
}

function setRemoveBgKey(key) {
  REMOVEBG_KEY = key;
}

function chunkLongText(text, limit = 4000) {
  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > limit) {
      chunks.push(current.trim());
      current = `${line}\n`;
    } else {
      current += `${line}\n`;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function handleQrcode(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]qrcode\s*/i, '').trim();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o texto ou link.\nExemplo: *!qrcode https://google.com*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const QRCodeLib = require('qrcode');
  const qrBuffer = await QRCodeLib.toBuffer(texto, { type: 'png', width: 512, margin: 2 });
  await sock.sendMessage(jid, { image: qrBuffer, caption: `🔳 QR Code gerado!\n\n_${texto.slice(0, 60)}_` }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleEncurtar(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]encurtar\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: '⚠️ Envie um link válido.' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const respBuf = await fetchBuffer(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`);
    const encurtado = respBuf.toString('utf8').trim();
    if (!encurtado.startsWith('http')) throw new Error('Resposta inválida');
    await sock.sendMessage(jid, { text: `🔗 *Link encurtado:*\n\n${encurtado}` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui encurtar o link.' }, { quoted: msg });
  }
}

async function handleCep(sock, msg, jid, caption) {
  const cep = caption.replace(/^[!.,\/]cep\s*/i, '').trim().replace(/\D/g, '');
  if (!cep || cep.length !== 8) {
    await sock.sendMessage(jid, { text: '⚠️ Digite um CEP válido (8 dígitos).' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const respBuf = await fetchBuffer(`https://viacep.com.br/ws/${cep}/json/`);
    const data = JSON.parse(respBuf.toString('utf8'));
    if (data.erro) {
      await sock.sendMessage(jid, { text: `❌ CEP *${cep}* não encontrado.` }, { quoted: msg });
      return;
    }
    const texto = `📮 *CEP ${data.cep}*\n\n🏠 *Logradouro:* ${data.logradouro || '—'}\n🏘️ *Bairro:* ${data.bairro || '—'}\n🏙️ *Cidade:* ${data.localidade} — ${data.uf}\n📡 *DDD:* ${data.ddd || '—'}`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui consultar o CEP.' }, { quoted: msg });
  }
}

async function handleClima(sock, msg, jid, caption) {
  const cidade = caption.replace(/^[!.,\/]clima\s*/i, '').trim();
  if (!cidade) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o nome da cidade.\nExemplo: *!clima São Paulo*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const url = `https://wttr.in/${encodeURIComponent(cidade)}?format=j1`;
    const data = await fetchJson(url);
    const cur = data.current_condition?.[0];
    if (!cur) throw new Error('Sem dados');
    const desc = cur.weatherDesc?.[0]?.value || '—';
    const temp = cur.temp_C;
    const sens = cur.FeelsLikeC;
    const umid = cur.humidity;
    const vento = cur.windspeedKmph;
    const area = data.nearest_area?.[0];
    const local = area ? `${area.areaName?.[0]?.value || ''}, ${area.country?.[0]?.value || ''}` : cidade;
    const emoji = Number(temp) >= 30 ? '🥵' : Number(temp) >= 20 ? '☀️' : Number(temp) >= 10 ? '🌤️' : '🥶';
    const texto = `${emoji} *Clima em ${local}*\n\n🌡️ *Temperatura:* ${temp}°C\n🤔 *Sensação:* ${sens}°C\n💧 *Umidade:* ${umid}%\n💨 *Vento:* ${vento} km/h\n📋 *Condição:* ${desc}`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: `❌ Não consegui obter o clima de *${cidade}*.\nVerifique o nome da cidade.` }, { quoted: msg });
  }
}

async function handleMoeda(sock, msg, jid, caption) {
  const parts = caption.replace(/^[!.,\/]moeda\s*/i, '').trim().split(/\s+/);
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: '⚠️ Uso: *!moeda [valor] [de] [para]*\nExemplo: *!moeda 100 USD BRL*' }, { quoted: msg });
    return;
  }
  const valor = parseFloat(parts[0]);
  const de = parts[1].toUpperCase();
  const para = parts[2].toUpperCase();
  if (isNaN(valor)) {
    await sock.sendMessage(jid, { text: '⚠️ Valor inválido. Exemplo: *!moeda 100 USD BRL*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${de}`;
    const data = await fetchJson(url);
    const taxa = data.rates?.[para];
    if (!taxa) throw new Error('Par de moeda inválido');
    const resultado = (valor * taxa).toFixed(2);
    const texto = `💱 *Conversão de Moeda*\n\n💵 ${valor} ${de} = *${resultado} ${para}*\n\n📊 Taxa: 1 ${de} = ${taxa.toFixed(4)} ${para}\n\n_Fonte: exchangerate-api.com_`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: `❌ Não consegui converter *${de}* para *${para}*.\nVerifique os códigos de moeda (ex: USD, BRL, EUR).` }, { quoted: msg });
  }
}

async function handleCalcular(sock, msg, jid, caption) {
  const expr = caption.replace(/^[!.,\/]calcular\s*/i, '').trim();
  if (!expr) {
    await sock.sendMessage(jid, { text: '⚠️ Digite uma expressão.\nExemplo: *!calcular 15 * 3 + 2*' }, { quoted: msg });
    return;
  }
  try {
    if (!/^[\d\s\+\-\*\/\.\(\)\%\^]+$/.test(expr)) {
      await sock.sendMessage(jid, { text: '⚠️ Expressão inválida. Use apenas números e operadores (+, -, *, /, %, ^).' }, { quoted: msg });
      return;
    }
    const safeExpr = expr.replace(/\^/g, '**');
    const resultado = Function(`'use strict'; return (${safeExpr})`)();
    await sock.sendMessage(jid, { text: `🧮 *Calculadora*\n\n📝 Expressão: \`${expr}\`\n✅ Resultado: *${resultado}*` }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Expressão inválida ou erro de cálculo.' }, { quoted: msg });
  }
}

async function handleDado(sock, msg, jid, caption) {
  const arg = caption.replace(/^[!.,\/]dado\s*/i, '').trim();
  const lados = parseInt(arg) || 6;
  if (lados < 2 || lados > 1000) {
    await sock.sendMessage(jid, { text: '⚠️ Número de lados deve ser entre 2 e 1000.' }, { quoted: msg });
    return;
  }
  const resultado = Math.floor(Math.random() * lados) + 1;
  await sock.sendMessage(jid, { text: `🎲 *Dado de ${lados} lados*\n\nResultado: *${resultado}*` }, { quoted: msg });
}

async function handlePiada(sock, msg, jid) {
  const piadas = [
    'Por que o livro de matemática foi ao psicólogo?\nPorque tinha muitos problemas! 😂',
    'O que o zero disse para o oito?\nQue cinto bonito! 😆',
    'Por que o computador foi ao médico?\nPorque estava com vírus! 🤣',
    'O que o pato disse para a pata?\nPato-cê é linda! 🦆',
    'Por que o fantasma não mente?\nPorque ele é trans-pa-rente! 👻',
    'O que é um elefante na árvore?\nUm galho de elefante! 🐘',
    'Por que o espantalho ganhou um prêmio?\nPorque era o melhor do campo! 🌾',
    'Qual o animal mais antigo?\nA zebra. Porque ainda está em preto e branco! 🦓',
    'Por que o vampiro virou vegetariano?\nPorque o Drácula ficou enjoado! 🧛',
    'O que o oceanos disse para a praia?\nNada, apenas deu uma onda! 🌊',
  ];
  const piada = piadas[Math.floor(Math.random() * piadas.length)];
  await sock.sendMessage(jid, { text: `😂 *Piada do Dia*\n\n${piada}` }, { quoted: msg });
}

async function handleFato(sock, msg, jid) {
  const fatos = [
    '🤓 Os polvos têm três corações e sangue azul.',
    '🤓 Uma colher de sopa de estrela de nêutrons pesaria cerca de um bilhão de toneladas.',
    '🤓 Mel não estraga nunca. Arqueólogos encontraram mel com 3.000 anos e ainda comestível.',
    '🤓 O cérebro humano produz energia suficiente para acender uma pequena lâmpada.',
    '🤓 As abelhas podem reconhecer rostos humanos como os humanos reconhecem.',
    '🤓 A maioria dos astronautas fica alguns centímetros mais alta no espaço.',
    '🤓 O coração de uma baleia azul bate apenas 2 vezes por minuto.',
    '🤓 As digitais dos koalas são quase idênticas às dos humanos.',
    '🤓 O WiFi e o Bluetooth foram inventados pelo mesmo australiano.',
    '🤓 Existe um lago na Austrália naturalmente cor-de-rosa chamado Hillier.',
    '🤓 A língua portuguesa tem mais de 250 milhões de falantes nativos no mundo.',
    '🤓 O Brasil é o 5º maior país do mundo em território.',
  ];
  const fato = fatos[Math.floor(Math.random() * fatos.length)];
  await sock.sendMessage(jid, { text: `📚 *Fato Incrível*\n\n${fato}` }, { quoted: msg });
}

async function handleTraduzir(sock, msg, jid, caption) {
  const raw = caption.replace(/^[!.,\/]traduzir\s*/i, '').trim();
  const parts = raw.split(/\s+/);
  let idioma = 'en';
  let texto = raw;
  if (parts.length >= 2 && /^[a-z]{2,3}$/i.test(parts[0])) {
    idioma = parts[0].toLowerCase();
    texto = parts.slice(1).join(' ');
  }
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!traduzir [idioma] [texto]*\nExemplo: *!traduzir en Olá mundo*\nIdiomas: en (inglês), es (espanhol), fr (francês), de (alemão), pt (português)...' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=pt|${idioma}`;
    const data = await fetchJson(url);
    const traduzido = data?.responseData?.translatedText;
    if (!traduzido || traduzido === texto) throw new Error('Sem tradução');
    const nomesIdioma = { en: 'Inglês', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano', ja: 'Japonês', zh: 'Chinês', ru: 'Russo', ar: 'Árabe', pt: 'Português' };
    const nomeIdioma = nomesIdioma[idioma] || idioma.toUpperCase();
    await sock.sendMessage(jid, { text: `🌐 *Tradução para ${nomeIdioma}*\n\n📝 Original: _${texto}_\n\n✅ Traduzido: *${traduzido}*` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui traduzir o texto. Tente novamente.' }, { quoted: msg });
  }
}

async function handleCodigoMorse(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]?(codigomorse|morse)\s*/i, '').trim();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!morse texto* ou *!codigomorse texto*' }, { quoted: msg });
    return;
  }
  const morse = encodeMorse(texto);
  await sock.sendMessage(jid, { text: `📡 *Morse*\n\n${morse}` }, { quoted: msg });
}

async function handleDecodificarMorse(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]?(decodificarmorse|demorse)\s*/i, '').trim();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!demorse código* ou *!decodificarmorse código*' }, { quoted: msg });
    return;
  }
  const decoded = decodeMorse(texto);
  await sock.sendMessage(jid, { text: `📡 *Texto*\n\n${decoded}` }, { quoted: msg });
}

async function tryFetchLyricsFromRandomApi(tema) {
  const queries = [
    tema,
    tema.replace(/[’‘]/g, "'"),
    tema.replace(/[’‘']/g, ''),
    tema.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);

  const tried = new Set();
  for (const q of queries) {
    const normalized = q.trim();
    if (!normalized || tried.has(normalized)) continue;
    tried.add(normalized);

    try {
      const result = await fetchJson(`https://some-random-api.ml/lyrics?title=${encodeURIComponent(normalized)}`);
      const lyrics = result?.lyrics?.trim();
      if (lyrics) return { source: 'random', result, query: normalized };
    } catch {
      continue;
    }
  }

  return null;
}

async function tryFetchLyricsFromOvh(tema) {
  const separator = tema.includes(' - ') ? ' - ' : tema.includes(' – ') ? ' – ' : null;
  if (!separator) return null;
  const [artist, title] = tema.split(separator).map(s => s.trim());
  if (!artist || !title) return null;

  try {
    const result = await fetchJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    const lyrics = result?.lyrics?.trim();
    if (lyrics) return { source: 'ovh', result: { lyrics, title, author: artist }, query: tema };
  } catch {
    return null;
  }

  return null;
}

async function handleLetra(sock, msg, jid, caption) {
  const tema = caption.replace(/^[!.,\/]letra\s*/i, '').trim();
  if (!tema) {
    await sock.sendMessage(jid, { text: '⚠️ Especifique o nome da música. Exemplo: *!letra bohemian rhapsody*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const lyricsSource = await tryFetchLyricsFromOvh(tema) || await tryFetchLyricsFromRandomApi(tema);
    if (!lyricsSource) throw new Error('Não encontrei a letra.');

    const result = lyricsSource.result;
    const title = result.title || tema;
    const author = result.author || result.artist || '';
    const genius = result.links?.genius || '';
    const lyrics = result.lyrics?.trim();

    const infoLines = [`🎵 *${title}*`];
    if (author) infoLines.push(`👤 *Artista:* ${author}`);
    if (genius) infoLines.push(`🔗 *Link:* ${genius}`);

    const fullText = `${infoLines.join('\n')}\n\n${lyrics}`;
    const chunks = chunkLongText(fullText);

    for (let i = 0; i < chunks.length; i++) {
      await sock.sendMessage(jid, { text: chunks[i] }, i === 0 ? { quoted: msg } : {});
    }
  } catch (err) {
    console.log(`⚠️ Letra não encontrada para "${tema}":`, err.message);
    await sock.sendMessage(jid, {
      text: '❌ Não foi possível obter a letra. Tente usar o formato: *!letra artista - música*',
    }, { quoted: msg });
  }
}
/**
 * Handler de Perfil — Piroquinhas Bot
 * Comando: !perfil / !perfil @pessoa
 *
 * CORREÇÕES:
 *  - Número real extraído do JID corretamente (remove sufixo de dispositivo)
 *  - Itens de roubo/segurança exibidos no perfil
 *  - Missões diárias integradas
 *  - Layout mais limpo e completo
 */

async function handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions    = contextInfo?.mentionedJid || [];
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const alvoJid     = mentions[0] || contextInfo?.participant || senderJid;
  const nome        = contactNames[alvoJid] || alvoJid.split('@')[0];

  // ── [FIX] Número real ─────────────────────────────────────────────────────
  // O JID do WhatsApp tem formato: 5511999999999@s.whatsapp.net
  // Em grupos pode vir com sufixo de dispositivo: 5511999999999:12@s.whatsapp.net
  // É necessário remover o sufixo ":XX" antes do "@"
  const rawNumber  = alvoJid.split('@')[0].split(':')[0];
  const number     = rawNumber; // já é o número limpo, ex: 5511999999999

  // ── Grupo e admin ─────────────────────────────────────────────────────────
  let groupName = '';
  let isAdmin   = false;
  if (jid.endsWith('@g.us')) {
    try {
      const meta = await sock.groupMetadata(jid);
      groupName  = meta.subject || '';
    } catch {}
    try {
      const grupoHandler = require(path.join(__dirname, '..', 'grupo'));
      isAdmin = await grupoHandler.isAdmin(sock, jid, alvoJid);
    } catch {}
  }

  // ── Atividade ─────────────────────────────────────────────────────────────
  const msgsRec    = msgCount.get(alvoJid)?.count || 0;
  const cmdsRec    = cmdCount.get(alvoJid)        || 0;
  const sticks     = stickerCount.get(alvoJid)    || 0;
  const interactions = msgsRec + cmdsRec + sticks;

  let activityLabel = '📉 Calmo';
  if (interactions > 1000)     activityLabel = '🔥 Hiperativo';
  else if (interactions > 500) activityLabel = '⚡ Ativo';
  else if (interactions > 100) activityLabel = '😊 Participativo';

  // Rank no grupo
  let rankText = '';
  try {
    const ranks = [...msgCount.entries()].sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0));
    const idx   = ranks.findIndex(([k]) => k === alvoJid);
    if (idx >= 0) rankText = ` · #${idx + 1} no grupo`;
  } catch {}

  // ── Dados do banco ────────────────────────────────────────────────────────
  const userData = await Usuario.findOne({ idWhatsApp: alvoJid });

  // Gold
  const userGold = userData?.gold ?? 100;

  // Level e XP
  const levelXP      = userData?.xp ?? msgsRec;
  const level        = userData?.level || Math.floor(levelXP / 50) + 1;
  const nextLevelXp  = level * 50;
  const levelProgress = Math.min(100, Math.floor((levelXP / nextLevelXp) * 100));
  const barsF = Math.floor(levelProgress / 10);
  const levelBar = '█'.repeat(barsF) + '░'.repeat(10 - barsF);

  // Banco / investimento
  let bankText = '🏦 Sem investimentos ativos';
  if (userData?.bank?.amount > 0) {
    const elapsed  = Math.floor((Date.now() - new Date(userData.bank.startDate)) / 86400000);
    const daysLeft = Math.max(0, userData.bank.daysRemaining - elapsed);
    const statusBanco = daysLeft > 0 ? `⏳ Faltam ${daysLeft} dia(s)` : '✅ Pronto para resgatar!';
    bankText = `💳 ${userData.bank.amount}g investido (${userData.bank.interest}% juros) · ${statusBanco}`;
  }

  // Missões diárias
  let missaoText = '';
  try {
    const { dailyMissionDefinitions } = require('./missoes');
    const dm = userData?.dailyMissions;
    if (dm && dm.date === new Date().toISOString().split('T')[0]) {
      const total     = dailyMissionDefinitions.length;
      const concluidas = dailyMissionDefinitions.filter(m =>
        (dm.progress?.[m.id] || 0) >= m.target || dm.completed?.[m.id]
      ).length;
      const resgatadas = dailyMissionDefinitions.filter(m => dm.claimed?.[m.id]).length;
      missaoText = `🎯 Missões: ${concluidas}/${total} concluídas · ${resgatadas} resgatadas`;
    }
  } catch {}

  // Itens equipados
  let equipText = '';
  try {
    const itemRoubo = userData?.equiparoubo;
    const itemSec   = userData?.equiparsec;
    const partes    = [];
    if (itemRoubo) partes.push(`🎭 Roubo: ${itemRoubo}`);
    if (itemSec)   partes.push(`🔐 Defesa: ${itemSec}`);
    if (partes.length) equipText = partes.join(' · ');
  } catch {}

  // Pet
  let petText = '';
  if (userData?.pet?.name) {
    const petSystem = {
      tubarao:    { emoji: '🦈' }, dragao:    { emoji: '🐉' }, falcao:  { emoji: '🦅' },
      leao:       { emoji: '🦁' }, tigre:     { emoji: '🐯' }, lobo:    { emoji: '🐺' },
      urso:       { emoji: '🐻' }, macaco:    { emoji: '🐵' }, raposa:  { emoji: '🦊' },
      coelho:     { emoji: '🐰' }, gato:      { emoji: '🐱' }, cachorro:{ emoji: '🐶' },
      elefante:   { emoji: '🐘' }, girafa:    { emoji: '🦒' }, pinguim: { emoji: '🐧' },
      coruja:     { emoji: '🦉' }, fenix:     { emoji: '🔥' }, feneco:  { emoji: '🦝' },
      leao_marinho: { emoji: '🦭' },
    };
    const petType = userData.pet.type || 'cachorro';
    const petEmoji = petSystem[petType]?.emoji ?? '🐾';
    const hap = userData.pet.happiness ?? 60;
    const hapBar = hap >= 80 ? '😄' : hap >= 50 ? '😊' : '😔';
    petText = `${petEmoji} *${userData.pet.name}* · Lvl ${userData.pet.level || 1} · Humor ${hapBar} ${hap}%`;
  }

  // Aniversário
  let birthdayText = '';
  try {
    const dataPath = path.resolve(__dirname, '../../../data.json');
    if (fs.existsSync(dataPath)) {
      const dataFile  = JSON.parse(fs.readFileSync(dataPath, 'utf8') || '{}');
      const birthdays = dataFile.birthdays || {};
      if (birthdays[alvoJid]?.date) {
        const [day, month, year] = birthdays[alvoJid].date.split('/');
        const today        = new Date();
        const currentYear  = today.getFullYear();
        const nextBirthday = new Date(currentYear, Number(month) - 1, Number(day));
        if (nextBirthday < today) nextBirthday.setFullYear(currentYear + 1);
        const age      = nextBirthday.getFullYear() - Number(year);
        const daysUntil = Math.ceil((nextBirthday - today) / 86400000);
        birthdayText = `🎂 ${day}/${month}/${year} · ${age} anos · ${daysUntil === 0 ? '🥳 Hoje!' : `em ${daysUntil} dia(s)`}`;
      }
    }
  } catch {}

  // Relacionamento
  let relStatus = '💔 Solteiro(a)';
  if (relacionamentos) {
    for (const [k, v] of relacionamentos) {
      if (k.includes(alvoJid.split('@')[0])) {
        const partner = v.nomeA === nome ? v.nomeB : v.nomeA;
        relStatus = v.tipo === 'casamento'
          ? `💍 Casado(a) com ${partner}`
          : `❤️ Namorando com ${partner}`;
        break;
      }
    }
  }
  if (relStatus === '💔 Solteiro(a)' && userData?.casadoCom) {
    const partnerName = contactNames[userData.casadoCom] || userData.casadoCom.split('@')[0].split(':')[0];
    relStatus = userData.casadoTipo === 'namoro'
      ? `❤️ Namorando com ${partnerName}`
      : `💍 Casado(a) com ${partnerName}`;
  }

  // Foto de perfil
  let picBuffer = null;
  try {
    const url = await sock.profilePictureUrl(alvoJid, 'image');
    if (url) picBuffer = await fetchBuffer(url);
  } catch {}

  // ── Montar texto do perfil ────────────────────────────────────────────────
  const sep = `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`;

  const lines = [];
  lines.push(`╭━━[ 👤 PERFIL ]━━╮`);
  lines.push(`│`);
  lines.push(`│  *${nome}*`);
  lines.push(`│  📞 +${number}`);
  if (groupName) lines.push(`│  🏠 ${groupName}`);
  if (jid.endsWith('@g.us')) lines.push(`│  👑 Admin: ${isAdmin ? '✅ Sim' : '❌ Não'}`);
  lines.push(`│`);
  lines.push(`├─[ 📊 ATIVIDADE ]`);
  lines.push(`│  💬 Mensagens: *${msgsRec}*${rankText}`);
  lines.push(`│  🤖 Comandos:  *${cmdsRec}*`);
  lines.push(`│  😄 Figurinhas: *${sticks}*`);
  lines.push(`│  🔁 Total: *${interactions}* · ${activityLabel}`);
  lines.push(`│`);
  lines.push(`├─[ ⭐ PROGRESSO ]`);
  lines.push(`│  🏅 Level *${level}* · XP ${levelXP}/${nextLevelXp} (${levelProgress}%)`);
  lines.push(`│  [${levelBar}]`);
  if (missaoText) lines.push(`│  ${missaoText}`);
  lines.push(`│`);
  lines.push(`├─[ 💰 ECONOMIA ]`);
  lines.push(`│  👛 Carteira: *${userGold}g*`);
  lines.push(`│  ${bankText}`);
  if (equipText) {
    lines.push(`│`);
    lines.push(`├─[ ⚔️ EQUIPAMENTO ]`);
    lines.push(`│  ${equipText}`);
  }
  if (petText) {
    lines.push(`│`);
    lines.push(`├─[ 🐾 PET ]`);
    lines.push(`│  ${petText}`);
  }
  if (birthdayText) {
    lines.push(`│`);
    lines.push(`├─[ 🎂 ANIVERSÁRIO ]`);
    lines.push(`│  ${birthdayText}`);
  }
  lines.push(`│`);
  lines.push(`├─[ 💑 RELACIONAMENTO ]`);
  lines.push(`│  ${relStatus}`);
  lines.push(`│`);
  lines.push(`╰━━[ 🤖 Piroquinhas Bot ]━━╯`);

  const texto = lines.join('\n');

  if (picBuffer) {
    await sock.sendMessage(jid, { image: picBuffer, caption: texto }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

module.exports = {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
  handleLevelOn,
  handleLevel,
  handleRankLevel,
  handleQrcode,
  handleEncurtar,
  handleCep,
  handleClima,
  handleMoeda,
  handleCalcular,
  handleDado,
  handlePiada,
  handleFato,
  handleTraduzir,
  handleCodigoMorse,
  handleDecodificarMorse,
  handleLetra,
  handlePerfil,
  handleSave,
  handleSaveRec,
  handleTiktok,
  handleAudioDownload,
  handleSom,
  handlePlayMp4,
  handlePlayDoc,
  setLogger,
  setRemoveBgKey,
  getYtDlpPath,
  getYtDlpArgs,
  getFfmpegPath,
  getFfprobePath,
};