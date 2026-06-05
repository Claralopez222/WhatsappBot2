/**
 * Handler de Texto
 * Comandos: !maiusculo, !invertido, !caixa, !traduzir
 */

const path = require('path');
const { fetchBuffer } = require(path.join(__dirname, '..', 'fetchurl'));

// ─── !traduzir ────────────────────────────────────────────────────────────────
async function handleTraduzir(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.]traduzir\s*/i, '').trim();
  if (!texto) { await sock.sendMessage(jid, { text: '⚠️ Digite o texto!\nExemplo: *!traduzir Hello world*' }, { quoted: msg }); return; }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(texto)}`;
    const raw = await fetchBuffer(url);
    const json = JSON.parse(raw.toString('utf8'));
    const traduzido = json[0].map(x => x[0]).join('');
    const origem = json[2] || 'desconhecido';
    await sock.sendMessage(jid, { text: `🌐 *Tradução* (${origem} → pt)\n\n${traduzido}` }, { quoted: msg });
  } catch { await sock.sendMessage(jid, { text: '❌ Não consegui traduzir agora.' }, { quoted: msg }); }
}

// ─── !maiusculo, !invertido, !caixa ───────────────────────────────────────────
async function handleTextoFun(sock, msg, jid, caption, getPrefix, tipo) {
  const P = getPrefix(jid);
  const texto = caption.replace(/^[!.][a-záéíóúãõâêîôûç]+\s*/i, '').trim();
  if (!texto) { await sock.sendMessage(jid, { text: `⚠️ Digite o texto!` }, { quoted: msg }); return; }
  let resultado;
  if (tipo === 'maiusculo') {
    resultado = texto.toUpperCase();
  } else if (tipo === 'invertido') {
    const mapa = {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z'};
    resultado = texto.split('').reverse().map(c => mapa[c.toLowerCase()] || c).join('');
  } else if (tipo === 'caixa') {
    const letras = {a:'🅐',b:'🅑',c:'🅒',d:'🅓',e:'🅔',f:'🅕',g:'🅖',h:'🅗',i:'🅘',j:'🅙',k:'🅚',l:'🅛',m:'🅜',n:'🅝',o:'🅞',p:'🅟',q:'🅠',r:'🅡',s:'🅢',t:'🅣',u:'🅤',v:'🅥',w:'🅦',x:'🅧',y:'🅨',z:'🅩'};
    resultado = texto.toLowerCase().split('').map(c => letras[c] || c).join('');
  }
  await sock.sendMessage(jid, { text: resultado }, { quoted: msg });
}

module.exports = {
  handleTraduzir,
  handleTextoFun,
};
