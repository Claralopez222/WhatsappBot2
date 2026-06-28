const fs = require('fs');
const path = require('path');
const { fetchBuffer, fetchJson } = require(path.join(__dirname, '..', '..', 'fetchurl'));
const {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
  handleMenuFilho,
  handleMenuWork,
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleSistemaMedieval,
} = require(path.join(__dirname, 'menu'));
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { handleLevelOn, handleLevel, handleRankLevel } = require(path.join(__dirname, 'level'));
const { handleSave, handleSaveRec, handleTiktok, handleAudioDownload, handleSom, handlePlayMp4, handlePlayDoc, getYtDlpPath, getYtDlpArgs, getFfmpegPath, getFfprobePath } = require(path.join(__dirname, '..', 'downloads'));

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

// !clima
async function handleClima(sock, msg, jid, caption) {
  const cidade = caption.replace(/^[!.,\/]clima\s*/i, '').trim();

  if (!cidade) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Digite o nome da cidade.\nExemplo: *!clima São Paulo*' },
      { quoted: msg }
    );
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const url = `https://wttr.in/${encodeURIComponent(cidade)}?format=j1&lang=pt`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const cur = data.current_condition?.[0];

    if (!cur) throw new Error('Sem dados de clima');

    const desc  = cur.lang_pt?.[0]?.value || cur.weatherDesc?.[0]?.value || '—';
    const temp  = cur.temp_C          ?? '—';
    const sens  = cur.FeelsLikeC      ?? '—';
    const umid  = cur.humidity        ?? '—';
    const vento = cur.windspeedKmph   ?? '—';
    const uv    = cur.uvIndex         ?? '—';
    const vis   = cur.visibility      ?? '—';
    const press = cur.pressure        ?? '—';

    const area  = data.nearest_area?.[0];
    const local = area
      ? `${area.areaName?.[0]?.value || ''}, ${area.country?.[0]?.value || ''}`.replace(/^,\s*|,\s*$/g, '')
      : cidade;

    const t = Number(temp);
    const emoji =
      t >= 35 ? '🔥' :
      t >= 28 ? '🥵' :
      t >= 20 ? '☀️' :
      t >= 10 ? '🌤️' :
      t >= 0  ? '🧊' : '🥶';

    const texto = [
      `${emoji} *Clima em ${local}*`,
      '',
      `🌡️ *Temperatura:* ${temp}°C`,
      `🤔 *Sensação térmica:* ${sens}°C`,
      `📋 *Condição:* ${desc}`,
      `💧 *Umidade:* ${umid}%`,
      `💨 *Vento:* ${vento} km/h`,
      `☀️ *Índice UV:* ${uv}`,
      `👁️ *Visibilidade:* ${vis} km`,
      `🔵 *Pressão:* ${press} hPa`,
    ].join('\n');

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error('[handleClima] Erro:', err?.message || err);
    await sock.sendMessage(
      jid,
      { text: `❌ Não consegui obter o clima de *${cidade}*.\nVerifique o nome da cidade e tente novamente.` },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
  }
}

// !moeda
async function handleMoeda(sock, msg, jid, caption) {
  const input = caption.replace(/^[!.,\/]moeda\s*/i, '').trim();
  const parts = input.split(/\s+/);

  if (parts.length < 3) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Uso: *!moeda [valor] [de] [para]*\nExemplo: *!moeda 100 USD BRL*' },
      { quoted: msg }
    );
    return;
  }

  const valor = parseFloat(parts[0].replace(',', '.'));
  const de    = parts[1].toUpperCase();
  const para  = parts[2].toUpperCase();

  if (isNaN(valor) || valor <= 0) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Valor inválido. Use um número positivo.\nExemplo: *!moeda 100 USD BRL*' },
      { quoted: msg }
    );
    return;
  }

  if (de.length !== 3 || para.length !== 3) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Código de moeda inválido. Use 3 letras (ex: USD, BRL, EUR).' },
      { quoted: msg }
    );
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${de}`;
    const res  = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const taxa = data.rates?.[para];

    if (!taxa) throw new Error(`Par ${de}/${para} não encontrado`);

    const resultado   = (valor * taxa).toFixed(2);
    const taxaInversa = (1 / taxa).toFixed(4);
    const atualizado  = data.date ?? '—';

    // Formatação numérica legível
    const fmtValor     = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtResultado = parseFloat(resultado).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const texto = [
      `💱 *Conversão de Moeda*`,
      '',
      `💵 *${fmtValor} ${de}* = *${fmtResultado} ${para}*`,
      '',
      `📊 *Taxa:* 1 ${de} = ${taxa.toFixed(4)} ${para}`,
      `🔁 *Inversa:* 1 ${para} = ${taxaInversa} ${de}`,
      `📅 *Atualizado em:* ${atualizado}`,
      '',
      `_Fonte: exchangerate-api.com_`,
    ].join('\n');

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error('[handleMoeda] Erro:', err?.message || err);
    await sock.sendMessage(
      jid,
      { text: `❌ Não consegui converter *${de}* para *${para}*.\nVerifique os códigos de moeda (ex: USD, BRL, EUR).` },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
  }
}

// !calcular
async function handleCalcular(sock, msg, jid, caption) {
  const expr = caption.replace(/^[!.,\/]calcular\s*/i, '').trim();

  if (!expr) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Digite uma expressão.\nExemplo: *!calcular 15 * 3 + 2*' },
      { quoted: msg }
    );
    return;
  }

  // Valida: apenas dígitos, espaços e operadores permitidos
  if (!/^[\d\s+\-*/().%^,]+$/.test(expr)) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Expressão inválida. Use apenas números e operadores ( + - * / % ^ ).' },
      { quoted: msg }
    );
    return;
  }

  try {
    const safeExpr = expr
      .replace(/,/g, '.')   // aceita vírgula decimal: 3,14 → 3.14
      .replace(/\^/g, '**') // potência: 2^8 → 2**8

    const resultado = Function(`'use strict'; return (${safeExpr})`)();

    // Rejeita resultados não numéricos (Infinity, NaN, objetos, etc.)
    if (typeof resultado !== 'number' || !isFinite(resultado)) {
      throw new Error('Resultado não numérico');
    }

    // Formata: remove trailing zeros de decimais longos (ex: 0.1+0.2 = 0.3)
    const fmtResultado = parseFloat(resultado.toPrecision(12)).toString();

    const texto = [
      `🧮 *Calculadora*`,
      '',
      `📝 *Expressão:* \`${expr}\``,
      `✅ *Resultado:* *${fmtResultado}*`,
    ].join('\n');

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });

  } catch (err) {
    console.error('[handleCalcular] Erro:', err?.message || err);
    await sock.sendMessage(
      jid,
      { text: '❌ Expressão inválida ou erro de cálculo.\nExemplo válido: *!calcular (10 + 5) * 2 / 3*' },
      { quoted: msg }
    );
  }
}

// !dado
async function handleDado(sock, msg, jid, caption) {
  const arg    = caption.replace(/^[!.,\/]dado\s*/i, '').trim();
  const lados  = arg === '' ? 6 : parseInt(arg, 10);

  if (isNaN(lados) || lados < 2 || lados > 1000) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Número de lados deve ser entre 2 e 1000.\nExemplo: *!dado 20*\n_(padrão: 6 lados)_' },
      { quoted: msg }
    );
    return;
  }

  const resultado = Math.floor(Math.random() * lados) + 1;

  const emoji =
    resultado === lados ? '🏆' : // máximo
    resultado === 1     ? '💀' : // mínimo
    '🎲';

  const texto = [
    `${emoji} *Dado de ${lados} lados*`,
    '',
    `🎯 *Resultado:* ${resultado}`,
    `📊 *Faixa:* 1 até ${lados}`,
  ].join('\n');

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !piada
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
    'O que o oceano disse para a praia?\nNada, apenas deu uma onda! 🌊',
    'Por que o parafuso foi ao psicólogo?\nPorque estava muito enroscado! 🔩',
    'O que o açúcar disse para o café?\nSem mim sua vida seria amarga! ☕',
    'Por que a pedra foi à academia?\nQueria ficar mais pedrada! 💪',
    'O que o relógio disse para a parede?\nFico de olho em você! ⏰',
    'Por que o tomate ficou vermelho?\nPorque viu a salada se vestindo! 🍅',
  ];

  const piada = piadas[Math.floor(Math.random() * piadas.length)];

  await sock.sendMessage(
    jid,
    { text: `😂 *Piada do Dia*\n\n${piada}` },
    { quoted: msg }
  );
}

// !fato
async function handleFato(sock, msg, jid) {
  const fatos = [
    'Os polvos têm três corações e sangue azul.',
    'Uma colher de sopa de estrela de nêutrons pesaria cerca de um bilhão de toneladas.',
    'Mel não estraga nunca. Arqueólogos encontraram mel com 3.000 anos ainda comestível.',
    'O cérebro humano produz energia suficiente para acender uma pequena lâmpada.',
    'As abelhas conseguem reconhecer rostos humanos assim como nós reconhecemos.',
    'A maioria dos astronautas fica alguns centímetros mais alta no espaço.',
    'O coração de uma baleia azul bate apenas 2 vezes por minuto.',
    'As digitais dos koalas são quase idênticas às dos humanos.',
    'O WiFi e o Bluetooth foram inventados pelo mesmo australiano.',
    'Existe um lago na Austrália naturalmente cor-de-rosa chamado Hillier.',
    'A língua portuguesa tem mais de 250 milhões de falantes nativos no mundo.',
    'O Brasil é o 5º maior país do mundo em território.',
    'O ser humano é o único animal que cora de vergonha.',
    'A lua se afasta da Terra cerca de 3,8 cm por ano.',
    'Uma nuvem comum pesa cerca de 500 toneladas.',
    'O símbolo @ existia antes da internet — era usado em documentos comerciais medievais.',
    'Os flamingos nascem brancos e ficam rosados pela alimentação.',
    'A Grande Barreira de Coral é visível do espaço e é o maior ser vivo do planeta.',
  ];

  const fato = fatos[Math.floor(Math.random() * fatos.length)];
  const num  = Math.floor(Math.random() * fatos.length) + 1; // número decorativo do fato

  await sock.sendMessage(
    jid,
    { text: `📚 *Fato Incrível #${num}*\n\n🤓 ${fato}` },
    { quoted: msg }
  );
}

// !traduzir
async function handleTraduzir(sock, msg, jid, caption) {
  const NOMES_IDIOMA = {
    en: 'Inglês',    es: 'Espanhol',  fr: 'Francês',
    de: 'Alemão',    it: 'Italiano',  ja: 'Japonês',
    zh: 'Chinês',    ru: 'Russo',     ar: 'Árabe',
    pt: 'Português', ko: 'Coreano',   nl: 'Holandês',
    pl: 'Polonês',   sv: 'Sueco',     tr: 'Turco',
  };

  const raw   = caption.replace(/^[!.,\/]traduzir\s*/i, '').trim();
  const parts = raw.split(/\s+/);

  let idioma = 'en';
  let texto  = raw;
  if (parts.length >= 2 && /^[a-z]{2,3}$/i.test(parts[0])) {
    idioma = parts[0].toLowerCase();
    texto  = parts.slice(1).join(' ').trim();
  }

  if (!texto) {
    const lista = Object.entries(NOMES_IDIOMA)
      .map(([k, v]) => `${k} → ${v}`)
      .join(', ');
    await sock.sendMessage(
      jid,
      { text: `⚠️ Use: *!traduzir [idioma] [texto]*\nExemplo: *!traduzir en Olá mundo*\n\n📋 *Idiomas disponíveis:*\n${lista}` },
      { quoted: msg }
    );
    return;
  }

  if (texto.length > 500) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Texto muito longo. Máximo de 500 caracteres.' },
      { quoted: msg }
    );
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=pt|${idioma}`;
    const res  = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data      = await res.json();
    const traduzido = data?.responseData?.translatedText?.trim();
    const status    = data?.responseStatus;

    if (!traduzido || status !== 200) throw new Error(`API status ${status}`);

    if (traduzido.toLowerCase() === texto.toLowerCase())
      throw new Error('Tradução igual ao original');

    const nomeIdioma = NOMES_IDIOMA[idioma] ?? idioma.toUpperCase();

    const textoMsg = [
      `🌐 *Tradução para ${nomeIdioma}*`,
      '',
      `📝 *Original:* _${texto}_`,
      `✅ *Traduzido:* *${traduzido}*`,
      '',
      `_Fonte: MyMemory_`,
    ].join('\n');

    await sock.sendMessage(jid, { text: textoMsg }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error('[handleTraduzir] Erro:', err?.message || err);
    await sock.sendMessage(
      jid,
      { text: `❌ Não consegui traduzir para *${idioma.toUpperCase()}*.\nVerifique o código do idioma e tente novamente.` },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
  }
}

// ─────────────────────────────────────────
// Tabelas Morse
// ─────────────────────────────────────────

const MORSE_ENCODE = {
  A:'.-',   B:'-...', C:'-.-.', D:'-..', E:'.',    F:'..-.',
  G:'--.',  H:'....', I:'..',   J:'.---',K:'-.-',  L:'.-..',
  M:'--',   N:'-.',   O:'---',  P:'.--.',Q:'--.-', R:'.-.',
  S:'...',  T:'-',    U:'..-',  V:'...-',W:'.--',  X:'-..-',
  Y:'-.--', Z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-',
  '5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-', ',':'--..--', '?':'..--..', '!':'-.-.--',
  '-':'-....-', '/':'-..-.', '(':'-.--.', ')':'-.--.-',
  '&':'.-...', ':':'---...', ';':'-.-.-.', '=':'-...-',
  '+':'.-.-.', '_':'..--.-', '"':'.-..-.', '@':'.--.-.',
  "'":'.----.',  ' ':'/',
};

const MORSE_DECODE = Object.fromEntries(
  Object.entries(MORSE_ENCODE).map(([k, v]) => [v, k])
);

function encodeMorse(texto) {
  return texto
    .toUpperCase()
    .split('')
    .map(c => MORSE_ENCODE[c] ?? '?')
    .join(' ')
    .replace(/ \/ /g, '  /  ');
}

function decodeMorse(codigo) {
  return codigo
    .trim()
    .split(/\s{2,}|\s*\/\s*/)
    .map(palavra =>
      palavra.trim().split(' ')
        .map(token => MORSE_DECODE[token] ?? '?')
        .join('')
    )
    .join(' ');
}

// ─────────────────────────────────────────
// !morse
// ─────────────────────────────────────────
async function handleCodigoMorse(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]?(codigomorse|morse)\s*/i, '').trim();

  if (!texto) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Use: *!morse [texto]*\nExemplo: *!morse Olá mundo*' },
      { quoted: msg }
    );
    return;
  }

  if (texto.length > 200) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Texto muito longo. Máximo de 200 caracteres.' },
      { quoted: msg }
    );
    return;
  }

  const morse = encodeMorse(texto);

  await sock.sendMessage(
    jid,
    {
      text: [
        `📡 *Texto → Morse*`,
        '',
        `📝 *Original:* ${texto}`,
        `✅ *Morse:*\n\`${morse}\``,
      ].join('\n'),
    },
    { quoted: msg }
  );
}

// ─────────────────────────────────────────
// !demorse
// ─────────────────────────────────────────
async function handleDecodificarMorse(sock, msg, jid, caption) {
  const codigo = caption.replace(/^[!.,\/]?(decodificarmorse|demorse)\s*/i, '').trim();

  if (!codigo) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Use: *!demorse [código morse]*\nExemplo: *!demorse .... --- .-.. .-*' },
      { quoted: msg }
    );
    return;
  }

  if (!/^[.\- /]+$/.test(codigo)) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Código inválido. Use apenas pontos (.), traços (-), barras (/) e espaços.' },
      { quoted: msg }
    );
    return;
  }

  const decoded = decodeMorse(codigo);

  await sock.sendMessage(
    jid,
    {
      text: [
        `📡 *Morse → Texto*`,
        '',
        `📝 *Morse:* \`${codigo}\``,
        `✅ *Texto:* ${decoded}`,
      ].join('\n'),
    },
    { quoted: msg }
  );
}

// ─────────────────────────────────────────
// Helpers — letra
// ─────────────────────────────────────────

/**
 * Divide texto longo em chunks de até maxLen caracteres,
 * quebrando em '\n' sempre que possível.
 */
function chunkLongText(text, maxLen = 3500) {
  const chunks = [];
  while (text.length > maxLen) {
    let cut = text.lastIndexOf('\n', maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(text.slice(0, cut).trimEnd());
    text = text.slice(cut).trimStart();
  }
  if (text) chunks.push(text);
  return chunks;
}

/**
 * Tenta buscar letra pela API lyrics.ovh (formato "artista - música").
 */
async function tryFetchLyricsFromOvh(tema) {
  const sep = tema.includes(' - ') ? ' - ' : tema.includes(' – ') ? ' – ' : null;
  if (!sep) return null;

  const [artist, title] = tema.split(sep).map(s => s.trim());
  if (!artist || !title) return null;

  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    if (!res.ok) return null;

    const data   = await res.json();
    const lyrics = data?.lyrics?.trim();
    if (!lyrics) return null;

    return { lyrics, title, author: artist };
  } catch {
    return null;
  }
}

/**
 * Tenta buscar letra pela some-random-api com múltiplas variações do título.
 */
async function tryFetchLyricsFromRandomApi(tema) {
  const queries = [
    tema,
    tema.replace(/['']/g, "'"),
    tema.replace(/[''']/g, ''),
    tema.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(),
  ].filter(Boolean);

  const tried = new Set();
  for (const q of queries) {
    const normalized = q.trim();
    if (!normalized || tried.has(normalized)) continue;
    tried.add(normalized);

    try {
      const res = await fetch(
        `https://some-random-api.com/lyrics?title=${encodeURIComponent(normalized)}`
      );
      if (!res.ok) continue;

      const data   = await res.json();
      const lyrics = data?.lyrics?.trim();
      if (!lyrics) continue;

      return {
        lyrics,
        title:  data.title  ?? normalized,
        author: data.author ?? data.artist ?? '',
        genius: data.links?.genius ?? '',
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ─────────────────────────────────────────
// !letra
// ─────────────────────────────────────────
async function handleLetra(sock, msg, jid, caption) {
  const tema = caption.replace(/^[!.,\/]letra\s*/i, '').trim();

  if (!tema) {
    await sock.sendMessage(
      jid,
      { text: '⚠️ Especifique o nome da música.\nExemplo: *!letra Queen - Bohemian Rhapsody*' },
      { quoted: msg }
    );
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    // Tenta OVH primeiro (mais confiável), depois some-random-api
    const found = await tryFetchLyricsFromOvh(tema)
               ?? await tryFetchLyricsFromRandomApi(tema);

    if (!found) throw new Error('Letra não encontrada');

    const { lyrics, title, author, genius } = found;

    const infoLines = [`🎵 *${title ?? tema}*`];
    if (author) infoLines.push(`👤 *Artista:* ${author}`);
    if (genius) infoLines.push(`🔗 *Link:* ${genius}`);

    const fullText = `${infoLines.join('\n')}\n\n${lyrics}`;
    const chunks   = chunkLongText(fullText);

    for (let i = 0; i < chunks.length; i++) {
      await sock.sendMessage(
        jid,
        { text: chunks[i] },
        i === 0 ? { quoted: msg } : {}
      );
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    console.error(`[handleLetra] Erro para "${tema}":`, err?.message || err);
    await sock.sendMessage(
      jid,
      { text: '❌ Não foi possível obter a letra.\nTente o formato: *!letra artista - música*' },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
  }
}

// ─── !perfil ─────────────────────────────────────────────────────────────────

const { ACESSORIOS_CASAL } = require('../diversao/acessoriosCasal');

const PET_EMOJIS = {
  tubarao: '🦈', dragao: '🐉', falcao: '🦅', leao: '🦁', tigre: '🐯',
  lobo: '🐺', urso: '🐻', macaco: '🐵', raposa: '🦊', coelho: '🐰',
  gato: '🐱', cachorro: '🐶', elefante: '🐘', girafa: '🦒', pinguim: '🐧',
  coruja: '🦉', fenix: '🔥', feneco: '🦝', leao_marinho: '🦭',
};

function extractNumber(jidStr) {
  if (!jidStr) return '';
  return jidStr.split('@')[0].split(':')[0];
}

function isLidJid(jidStr) {
  return jidStr?.endsWith('@lid');
}

// handlePerfil────────────────────────────────────────────────────────────────────────────
async function handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos) {
  const contextInfo = content?.extendedTextMessage?.contextInfo
                    || msg?.message?.extendedTextMessage?.contextInfo;
  const mentions  = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid   = mentions[0] || contextInfo?.participant || senderJid;

  let resolvedJid = alvoJid;
  let number      = extractNumber(alvoJid);

  if (isLidJid(alvoJid)) {
    try {
      const results = await sock.onWhatsApp(number);
      if (results?.length > 0 && results[0].jid) {
        resolvedJid = results[0].jid;
        number      = extractNumber(resolvedJid);
      }
    } catch {}
    if (isLidJid(resolvedJid)) number = 'N/D';
  }

  const nome         = contactNames?.[alvoJid] || contactNames?.[resolvedJid] || number;
  const mentionsList = [];

  // ── Dados do usuário ──────────────────────────────────────────
  let userData = null;
  try {
    userData = await Usuario.findOne({ idWhatsApp: resolvedJid });
    if (!userData && resolvedJid !== alvoJid) {
      userData = await Usuario.findOne({ idWhatsApp: alvoJid });
    }
  } catch {}

  // ── Carteira do grupo (gold + banco) ─────────────────────────
  let userGold = 0;
  let bankText = '❌ Sem investimento ativo';
  try {
    const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: resolvedJid, idGrupo: jid });
    userGold = carteira?.gold ?? 0;
    const banco = carteira?.banco;
    if (banco?.amount > 0) {
      const msLeft = Math.max(0, new Date(banco.startDate).getTime() + 3 * 60 * 60 * 1000 - Date.now());
      const status = msLeft > 0
        ? `⏳ Faltam ${Math.ceil(msLeft / 60000)}min`
        : '✅ Pronto para resgatar!';
      bankText = `💳 ${banco.amount}g investido (${banco.interest}% juros)  ${status}`;
    }
  } catch {}

 // ── Atividade e nível ─────────────────────────────────────────
const msgsRec = userData?.mensagens ?? (msgCount?.get?.(alvoJid)?.count ?? 0);
const cmdsRec = cmdCount?.get?.(alvoJid) ?? 0;
const sticks  = stickerCount?.get?.(alvoJid) ?? 0;
const total   = msgsRec + cmdsRec + sticks;
const activity =
  total > 1000 ? '🔥 Hiperativo' :
  total > 500  ? '⚡ Ativo'      :
  total > 100  ? '😊 Participativo' : '📉 Calmo';

let rankText = '';
try {
  const ranks = [...(msgCount?.entries?.() ?? [])].sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0));
  const idx   = ranks.findIndex(([k]) => k === alvoJid);
  if (idx >= 0) rankText = `  ·  #${idx + 1} no grupo`;
} catch {}

// XP e level — fonte única: CarteiraGrupo (por grupo), igual ao !level
let xp       = 0;
let level    = 1;
let xpNext   = 100;
let xpPct    = 0;
let xpBar    = '░'.repeat(10);

try {
  const CarteiraGrupoPerfil = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

  // Tenta pelo JID resolvido primeiro, depois pelo JID original
  const carteiraXp =
    await CarteiraGrupoPerfil.findOne({ idWhatsApp: resolvedJid, idGrupo: jid }) ||
    await CarteiraGrupoPerfil.findOne({ idWhatsApp: alvoJid,     idGrupo: jid });

  if (carteiraXp) {
    const prog = carteiraXp.getProgressoXp();
    xp      = prog.xp;
    level   = prog.level;
    xpNext  = prog.xpNecessario;
    xpPct   = prog.progresso;
    const barsOn = Math.floor(xpPct / 10);
    xpBar   = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);
  }
} catch {}

  // ── Admin e nome do grupo ─────────────────────────────────────
  let isAdmin   = false;
  let groupName = '';
  if (jid.endsWith('@g.us')) {
    try { groupName = (await sock.groupMetadata(jid)).subject || ''; } catch {}
    try {
      const grupoHandler = require(path.join(__dirname, '..', 'grupo'));
      isAdmin = await grupoHandler.isAdmin(sock, jid, alvoJid);
    } catch {}
  }

  // ── Missões diárias ───────────────────────────────────────────
  let missaoText = '';
  try {
    const { dailyMissionDefinitions } = require('./missoes');
    const dm    = userData?.dailyMissions;
    const today = new Date().toISOString().split('T')[0];
    if (dm && dm.date === today) {
      const concluidas = dailyMissionDefinitions.filter(m =>
        (dm.progress?.[m.id] || 0) >= m.target || dm.completed?.[m.id]
      ).length;
      const resgatadas = dailyMissionDefinitions.filter(m => dm.claimed?.[m.id]).length;
      missaoText = `${concluidas}/${dailyMissionDefinitions.length} concluídas  ·  ${resgatadas} resgatadas`;
    }
  } catch {}

  // ── Pet ───────────────────────────────────────────────────────
  let petText = '❌ Sem pet';
  try {
    if (userData?.pet?.name) {
      const emoji = PET_EMOJIS[userData.pet.type] ?? '🐾';
      const hap   = userData.pet.happiness ?? 60;
      const mood  = hap >= 80 ? '😄' : hap >= 50 ? '😊' : '😔';
      petText = `${emoji} *${userData.pet.name}*  Lvl ${userData.pet.level || 1}  ${mood} ${hap}%`;
    }
  } catch {}

  // ── Aniversário ───────────────────────────────────────────────
  let birthdayText = '';
  try {
    const dataPath = path.resolve(__dirname, '../../../data.json');
    if (fs.existsSync(dataPath)) {
      const dataFile = JSON.parse(fs.readFileSync(dataPath, 'utf8') || '{}');
      const bday     = dataFile?.birthdays?.[alvoJid]?.date;
      if (bday) {
        const [day, month, year] = bday.split('/');
        const today       = new Date();
        const next        = new Date(today.getFullYear(), Number(month) - 1, Number(day));
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const age       = next.getFullYear() - Number(year);
        const daysUntil = Math.ceil((next - today) / 86400000);
        birthdayText = `🎂 ${day}/${month}/${year}  ·  ${age} anos  ·  ${daysUntil === 0 ? '🥳 Hoje!' : `em ${daysUntil} dia(s)`}`;
      }
    }
  } catch {}

  // ── Relacionamento ────────────────────────────────────────────
  let relStatus   = '💔 Solteiro(a)';
  let parceiroJid = null;
  try {
    if (relacionamentos) {
      for (const [k, v] of relacionamentos) {
        if (!k.startsWith(jid + '|')) continue; // só relacionamentos deste grupo

        const ehA = v.jidA === resolvedJid || v.jidA === alvoJid;
        const ehB = v.jidB === resolvedJid || v.jidB === alvoJid;
        if (!ehA && !ehB) continue;

        parceiroJid = ehA ? v.jidB : v.jidA;
        relStatus = v.tipo === 'casamento'
          ? `💍 Casado(a) com @${extractNumber(parceiroJid)}`
          : `❤️ Namorando com @${extractNumber(parceiroJid)}`;
        break;
      }
    }

    if (relStatus === '💔 Solteiro(a)' && userData?.casadoCom) {
      parceiroJid = userData.casadoCom;
      if (!parceiroJid.includes('@')) parceiroJid = `${parceiroJid.split(':')[0]}@s.whatsapp.net`;
      relStatus = userData.casadoTipo === 'namoro'
        ? `❤️ Namorando com @${extractNumber(parceiroJid)}`
        : `💍 Casado(a) com @${extractNumber(parceiroJid)}`;
    }

    if (parceiroJid) mentionsList.push(parceiroJid);
  } catch {}

  // ── Acessórios de casal equipados ──────────────────────────────
  let acessoriosText = '';
  try {
    const equipados = userData?.acessoriosCasal;
    if (equipados) {
      const ativos = [];
      for (const [key, info] of Object.entries(ACESSORIOS_CASAL)) {
        const isAtivo = typeof equipados.get === 'function' ? equipados.get(key) : equipados[key];
        if (isAtivo) ativos.push(`${info.emoji} ${info.nome}`);
      }
      if (ativos.length > 0) acessoriosText = ativos.join('  ');
    }
  } catch {}

  // ── Bio ───────────────────────────────────────────────────────
  const bio = userData?.bio?.trim() || '';

  // ── Foto de perfil ────────────────────────────────────────────
  let picBuffer = null;
  try {
    const url = await sock.profilePictureUrl(alvoJid, 'image');
    if (url) picBuffer = await fetchBuffer(url);
  } catch {}

  // ── Montar perfil ─────────────────────────────────────────────
  const L = [
    `🔎 *PERFIL DO USUÁRIO* 🔎`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `👤 *Nome:* ${nome}`,
    `📞 *Número:* @${number}`,
  ];

  if (groupName)             L.push(`🏠 *Grupo:* ${groupName}`);
  if (jid.endsWith('@g.us')) L.push(`👑 *Admin:* ${isAdmin ? '✅ Sim' : '❌ Não'}`);
  if (bio)                   L.push(`📝 *Bio:* ${bio}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `📊 *ATIVIDADE*`,
    `💬 Mensagens: *${msgsRec}*${rankText}`,
    `🤖 Comandos:  *${cmdsRec}*`,
    `😄 Figurinhas: *${sticks}*`,
    `🔁 Total: *${total}*  ${activity}`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `⭐ *PROGRESSO*`,
    `🏅 Level *${level}*  ·  XP ${xp}/${xpNext} (${xpPct}%)`,
    `[${xpBar}]`,
  );

  if (missaoText) L.push(`🎯 Missões: ${missaoText}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `💰 *ECONOMIA*`,
    `👛 Carteira: *${userGold}g*`,
    `🏦 Banco: ${bankText}`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `🐾 *PET ATIVO*`,
    petText,
  );

  if (birthdayText) {
    L.push(`┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`, `🎂 *ANIVERSÁRIO*`, birthdayText);
  }

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `💑 *RELACIONAMENTO*`,
    relStatus,
  );

  if (acessoriosText) L.push(`💎 *Acessórios:* ${acessoriosText}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `🤖 _Piroquinhas Bot_`,
  );

  const texto = L.join('\n');

  try {
    if (picBuffer) {
      await sock.sendMessage(jid, { image: picBuffer, caption: texto, mentions: mentionsList }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: texto, mentions: mentionsList }, { quoted: msg });
    }
  } catch (e) {
    console.error('⚠️ Erro ao enviar perfil:', e.message);
    try { await sock.sendMessage(jid, { text: texto, mentions: mentionsList }, { quoted: msg }); } catch {}
  }
}

// ─── !bio ─────────────────────────────────────────────────────────────────
async function handleBio(sock, msg, jid, caption) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const bio       = caption.replace(/^[!.,\/]bio\s*/i, '').trim();

  if (!bio) {
    await sock.sendMessage(jid, {
      text: '⚠️ Digite sua bio!\nExemplo: *!bio Amo jogar e ouvir música*\n\n_Máximo: 150 caracteres_',
    }, { quoted: msg });
    return;
  }

  if (bio.length > 150) {
    await sock.sendMessage(jid, {
      text: `⚠️ Bio muito longa! Máximo de *150 caracteres*.\nSua bio tem *${bio.length}* caracteres.`,
    }, { quoted: msg });
    return;
  }

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid },
      { $set: { bio } },
      { upsert: true }
    );

    await sock.sendMessage(jid, {
      text: `✅ *Bio atualizada!*\n\n📝 _${bio}_`,
    }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao salvar bio:', e.message);
    await sock.sendMessage(jid, {
      text: '❌ Erro ao salvar sua bio. Tente novamente.',
    }, { quoted: msg });
  }
}

module.exports = {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
  handleMenuFilho,
  handleMenuWork,
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
  handleBio,
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleSistemaMedieval,
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