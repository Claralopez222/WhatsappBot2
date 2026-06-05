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

async function handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || contextInfo?.participant || senderJid;
  const nome = contactNames[alvoJid] || alvoJid.split('@')[0];

  let groupName = '';
  if (jid.endsWith('@g.us')) {
    try { const meta = await sock.groupMetadata(jid); groupName = meta.subject || ''; } catch {}
  }

  const number = alvoJid.split('@')[0];
  let isAdmin = false;
  if (jid.endsWith('@g.us')) {
    try { const grupoHandler = require(path.join(__dirname, '..', 'grupo')); isAdmin = await grupoHandler.isAdmin(sock, jid, alvoJid); } catch {}
  }

  const msgsRec = (msgCount.get(alvoJid)?.count) || 0;
  const cmdsRec = cmdCount.get(alvoJid) || 0;
  const sticks = stickerCount.get(alvoJid) || 0;
  const interactions = msgsRec + cmdsRec + sticks;
  let activityLabel = '📉 CALMO';
  if (interactions > 1000) activityLabel = '🔥 HIPERATIVO';
  else if (interactions > 500) activityLabel = '⚡ ATIVO';

  const userData = await Usuario.findOne({ idWhatsApp: alvoJid });
  const levelXP = userData?.xp ?? msgsRec;
  const level = userData?.level || Math.floor(levelXP / 50) + 1;
  const nextLevelXp = level * 50;
  const levelProgress = Math.min(100, Math.floor((levelXP / nextLevelXp) * 100));
  const levelBar = '█'.repeat(Math.floor(levelProgress / 10)) + '░'.repeat(10 - Math.floor(levelProgress / 10));

  let rankText = '';
  try {
    const ranks = [...msgCount.entries()].sort((a,b)=> (b[1]?.count||0) - (a[1]?.count||0));
    const idx = ranks.findIndex(([k])=>k === alvoJid);
    if (idx >= 0) rankText = ` (#${idx+1})`;
  } catch {}

  let relStatus = 'Solteiro(a)';
  if (relacionamentos) {
    for (const [k,v] of relacionamentos) {
      if (k.includes(alvoJid.split('@')[0])) {
        const partner = v.nomeA === nome ? v.nomeB : v.nomeA;
        relStatus = v.tipo === 'casamento' ? `Casado(a) com ${partner}` : `Namorando com ${partner}`;
        break;
      }
    }
  }
  if (relStatus === 'Solteiro(a)' && userData?.casadoCom) {
    const partnerName = contactNames[userData.casadoCom] || userData.casadoCom.split('@')[0];
    relStatus = userData.casadoTipo === 'namoro'
      ? `Namorando com ${partnerName}`
      : `Casado(a) com ${partnerName}`;
  }

  let birthdayText = '';
  try {
    const dataPath = path.resolve(__dirname, '../../../data.json');
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf8');
      const dataFile = JSON.parse(raw || '{}');
      const birthdays = dataFile.birthdays || {};
      if (birthdays[alvoJid]?.date) {
        const [day, month, year] = birthdays[alvoJid].date.split('/');
        const today = new Date();
        const currentYear = today.getFullYear();
        const nextBirthday = new Date(currentYear, Number(month) - 1, Number(day));
        if (nextBirthday < today) nextBirthday.setFullYear(currentYear + 1);
        const age = nextBirthday.getFullYear() - Number(year);
        const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        birthdayText = `🎂 Aniversário: ${day}/${month}/${year} (${age} anos) ${daysUntil === 0 ? '— Hoje!' : `— em ${daysUntil} dia(s)`}`;
      }
    }
  } catch {}

  // PET INFO ATUALIZADO VIA BANCO DE DADOS
  let petText = '';
  if (userData?.pet?.name) {
    const petSystem = { 
      tubarao: { emoji: '🦈', nome: 'Tubarão' },
      dragao: { emoji: '🐉', nome: 'Dragão' },
      falcao: { emoji: '🦅', nome: 'Falcão' },
      leao: { emoji: '🦁', nome: 'Leão' },
      tigre: { emoji: '🐯', nome: 'Tigre' },
      lobo: { emoji: '🐺', nome: 'Lobo' },
      urso: { emoji: '🐻', nome: 'Urso' },
      macaco: { emoji: '🐵', nome: 'Macaco' },
      raposa: { emoji: '🦊', nome: 'Raposa' },
      coelho: { emoji: '🐰', nome: 'Coelho' },
      gato: { emoji: '🐱', nome: 'Gato' },
      cachorro: { emoji: '🐶', nome: 'Cachorro' },
      elefante: { emoji: '🐘', nome: 'Elefante' },
      girafa: { emoji: '🦒', nome: 'Girafa' },
      pinguim: { emoji: '🐧', nome: 'Pinguim' },
      coruja: { emoji: '🦉', nome: 'Coruja' },
      fenix: { emoji: '🔥', nome: 'Fênix' },
      feneco: { emoji: '🦝', nome: 'Feneco' },
      leao_marinho: { emoji: '🦭', nome: 'Leão Marinho' },
    };
    const petType = userData.pet.type || 'cachorro';
    const petDef = petSystem[petType] || { emoji: '🐾', nome: 'Pet' };
    petText = `${petDef.emoji} Pet: ${petDef.nome} *${userData.pet.name}* (Lvl ${userData.pet.level || 1})`;
  }

  let picBuffer = null;
  try {
    const url = await sock.profilePictureUrl(alvoJid, 'image');
    if (url) picBuffer = await fetchBuffer(url);
  } catch {}

  const lines = [];
  lines.push(`╭─[ 📊 ATIVIDADE DO MEMBRO 📊 ]─`);
  lines.push(`👤 Usuário: ${nome}`);
  if (groupName) lines.push(`🏠 Grupo: ${groupName}`);
  lines.push(`📞 Número: +${number}`);
  if (jid.endsWith('@g.us')) lines.push(`👑 Admin: ${isAdmin ? 'Sim' : 'Não'}`);
  lines.push(`────────────────────────`);
  lines.push(`📝 Mensagens: ${msgsRec}${rankText}`);
  lines.push(`🤖 Comandos: ${cmdsRec}`);
  lines.push(`😄 Figurinhas: ${sticks}`);
  lines.push(`────────────────────────`);
  lines.push(`📈 Total de Interações: ${interactions}`);
  lines.push(`🏅 Level: ${level}   XP: ${levelXP}/${nextLevelXp} (${levelProgress}%)`);
  lines.push(`📊 Progresso: [${levelBar}]`);
  lines.push(activityLabel);
  lines.push(`────────────────────────`);
  if (birthdayText) {
    lines.push(`🎂 Aniversário registrado`);
    lines.push(birthdayText);
    lines.push(`────────────────────────`);
  }
  if (petText) {
    lines.push(`[🐾 PET]`);
    lines.push(petText);
    lines.push(`────────────────────────`);
  }
  lines.push(`[💑 RELACIONAMENTO]`);
  lines.push(`💔 Status: ${relStatus}`);
  lines.push(`────────────────────────`);
  lines.push(`[🤖 Piroquinhas]`);

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