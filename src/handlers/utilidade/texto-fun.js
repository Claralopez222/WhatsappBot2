'use strict';

const path = require('path');
const { fetchBuffer } = require(path.join(__dirname, '..', '..', 'fetchurl'));

async function handleQrcode(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]qrcode\s*/i, '').trim();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o texto ou link.\nExemplo: *!qrcode https://google.com*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const QRCodeLib = require('qrcode');
    const qrBuffer  = await QRCodeLib.toBuffer(texto, { type: 'png', width: 512, margin: 2 });
    await sock.sendMessage(jid, { image: qrBuffer, caption: `🔳 QR Code gerado!\n\n_${texto.slice(0, 60)}_` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui gerar o QR Code.' }, { quoted: msg });
  }
}

async function handleEncurtar(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]encurtar\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: '⚠️ Envie um link válido.' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  try {
    const respBuf   = await fetchBuffer(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`);
    const encurtado = respBuf.toString('utf8').trim();
    if (!encurtado.startsWith('http')) throw new Error('Inválido');
    await sock.sendMessage(jid, { text: `🔗 *Link encurtado:*\n\n${encurtado}` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui encurtar o link.' }, { quoted: msg });
  }
}

async function handlePiada(sock, msg, jid) {
  const piadas = [
    'Por que o livro de matemática foi ao psicólogo?\nPorque tinha muitos problemas! 😂',
    'O que o zero disse para o oito?\nQue cinto bonito! 😆',
    'Por que o computador foi ao médico?\nPorque estava com vírus! 🤣',
    'O que o pato disse para a pata?\nPato-cê é linda! 🦆',
    'Por que o fantasma não mente?\nPorque ele é trans-pa-rente! 👻',
    'Por que o espantalho ganhou um prêmio?\nPorque era o melhor do campo! 🌾',
  ];
  const piada = piadas[Math.floor(Math.random() * piadas.length)];
  await sock.sendMessage(jid, { text: `😂 *Piada do Dia*\n\n${piada}` }, { quoted: msg });
}

async function handleFato(sock, msg, jid) {
  const fatos = [
    'Os polvos têm três corações e sangue azul.',
    'Mel não estraga nunca. Arqueólogos encontraram mel com 3.000 anos ainda comestível.',
    'O cérebro humano produz energia suficiente para acender uma pequena lâmpada.',
    'As abelhas conseguem reconhecer rostos humanos.',
  ];
  const fato = fatos[Math.floor(Math.random() * fatos.length)];
  await sock.sendMessage(jid, { text: `📚 *Fato Incrível*\n\n🤓 ${fato}` }, { quoted: msg });
}

async function handleCodigoMorse(sock, msg, jid, caption) {
  const MORSE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', ' ': '/',
  };
  const texto = caption.replace(/^[!.,\/]morse\s*/i, '').trim().toUpperCase();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o texto para converter para Morse.' }, { quoted: msg });
    return;
  }
  const codificado = texto.split('').map(c => MORSE[c] || c).join(' ');
  await sock.sendMessage(jid, { text: `📡 *Código Morse:*\n\n\`${codificado}\`` }, { quoted: msg });
}

async function handleDecodificarMorse(sock, msg, jid, caption) {
  const REVERSE_MORSE = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z', '.----': '1', '..---': '2', '...--': '3',
    '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
    '----.': '9', '-----': '0', '/': ' ',
  };
  const codigo = caption.replace(/^[!.,\/]demorse\s*/i, '').trim();
  if (!codigo) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o código Morse para decodificar.' }, { quoted: msg });
    return;
  }
  const decodificado = codigo.split(/\s+/).map(c => REVERSE_MORSE[c] || c).join('');
  await sock.sendMessage(jid, { text: `📻 *Texto Decodificado:*\n\n${decodificado}` }, { quoted: msg });
}

module.exports = {
  handleQrcode,
  handleEncurtar,
  handlePiada,
  handleFato,
  handleCodigoMorse,
  handleDecodificarMorse,
};
