async function handleMenu(sock, msg, jid, caption, getPrefix, author) {
  const P = getPrefix(jid);
  const now = new Date();
  const hour = now.getHours();
  const minute = String(now.getMinutes()).padStart(2, '0');
  let greeting = 'Olá';
  if (hour < 12) greeting = 'Bom dia';
  else if (hour < 18) greeting = 'Boa tarde';
  else greeting = 'Boa noite';
  const timeStr = `${hour}:${minute}`;
  const userMention = author ? `@${author}` : '';

  const menu = `╭━━━━ ◦ ❖ ◦ ━━━━━╮
       PIROQUINHAS
╰━━━━ ◦ ❖ ◦ ━━━━━╯

- 🌇 ${greeting} ${userMention}, são ${timeStr}

🎨 FIGURINHAS & LOGOS
▸ ${P}menufig
▸ ${P}menuefeitos

🛡️ ADMINISTRAÇÃO & SEGURANÇA
▸ ${P}menuadm
▸ ${P}reportar (marque a msg)

🎮 DIVERSÃO & ENTRETENIMENTO
▸ ${P}menujogos
▸ ${P}menucasal
▸ ${P}menuaniversario
▸ ${P}alteradores

🔧 UTILIDADES
▸ ${P}menuutil
╰━━━━━━━⊰ ✧ ⊱━━━━━━━╯`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('📋 Menu enviado');
}

async function handleMenuUtil(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu = `╭━━━━━━━━━━━━━━━━━━╮
│  🔧 *MENU UTILIDADES* 🔧
│
│ 📍 ${P}cep _(número)_
│ 🔗 ${P}encurtar _(link)_
│ 🔳 ${P}qrcode _(texto)_
│ 🧮 ${P}calcular _(expressão)_
│ 🎲 ${P}dado _(lados)_
│ 😂 ${P}piada
│ 🤓 ${P}fato
│ 🌐 ${P}traduzir _(idioma) (texto)_
│ 📡 ${P}codigomorse _(texto)_
│ 📡 ${P}morse _(texto)_
│ 📡 ${P}decodificarmorse _(código)_
│ 📡 ${P}demorse _(código)_
│
╰━━━━━━━⊰ ✧ ⊱━━━━━━━╯`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleMenuJogos(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu = `╭━━━━━━━━━━━━━━━━━━╮
│  🎮 *MENU JOGOS & DIVERSÃO* 🎮
│
│ ▸ ${P}brincadeiras
│ ▸ ${P}menugold
│ ▸ ${P}menupet
│ ▸ ${P}pets — Ver os 20 tipos
│ ▸ ${P}missao
│ ▸ ${P}garimpar
│ ▸ ${P}eununca
│ ▸ ${P}ranklevel
│ ▸ ${P}level
│ ▸ ${P}morte
│ ▸ ${P}roletarussa
│ ▸ ${P}roletarussa2
│ ▸ ${P}roletarussa3
│ ▸ ${P}tiro
│ ▸ ${P}falta
│ ▸ ${P}baterfalta
│ ▸ ${P}quiz
│ ▸ ${P}pontos
│ ▸ ${P}rankjogos
│
╰━━━━━━━⊰ ✧ ⊱━━━━━━━╯`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('🎮 Menu jogos enviado');
}

async function handleAlteradores(sock, msg, jid) {
  const menu = `🎛️ ALTERADORES 🎛️

🎬 Vídeos:
 ▸ .videolento
 ▸ .videorapido
 ▸ .videocontrario
 ▸ .reversevideo

🎵 Áudios:
 ▸ .audiolento
 ▸ .audiorapido
 ▸ .grave
 ▸ .esquilo
 ▸ .bass
 ▸ .vozmenino
 ▸ .vozgrossa
 ▸ .vozmulher
 ▸ .audioreverse

🎭 Voz:
 ▸ .vozrobo
 ▸ .vozalien
 ▸ .vozvelho
 ▸ .vozcrianca
 ▸ .vozdemonio

🔊 Ambiente:
 ▸ .eco
 ▸ .caverna
 ▸ .telefone
 ▸ .radio
 ▸ .megafone
 ▸ .underwater`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('🎛️ Menu alteradores enviado');
}

async function handleMenuRelacionamento(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu = `❤️ *MENU DO CASAL* ❤️

_Use ${P}menucasal ou ${P}menurelacionamento para abrir este menu._

💑 *COMANDOS DE CASAMENTO:*
💍 ${P}casar @pessoa — Pedir em casamento
✅ ${P}euaceito — Aceitar pedido
❌ ${P}eurecuso — Recusar pedido
🚫 ${P}cancelarpedido — Cancelar seu pedido
💔 ${P}cancelarcasamento — Divórcio _(bloqueia por 7 dias)_

💐 *COMANDOS DIÁRIOS (1x/dia cada):*
🌹 ${P}flores — Enviar flores _(+5 XP)_
🍬 ${P}doces — Enviar doces _(+5 XP)_
💌 ${P}carta — Enviar carta _(+5 XP)_
🎁 ${P}mimo — Fazer mimo _(+5 XP)_
💋 ${P}beijo — Dar beijo _(+5 XP)_

💝 *OUTROS COMANDOS ROMÂNTICOS:*
🤗 ${P}abraco — Enviar abraço gostoso
🎀 ${P}presente — Dar presente especial
🍽️ ${P}jantar — Levar para jantar
🎬 ${P}cinematel — Assistir filme juntos
✈️ ${P}viajar — Planejar viagem romântica
🎤 ${P}serenata — Cantar serenata pro par

🎯 *COMANDOS ESPECIAIS:*
🔥 ${P}xpdobro — Ativar XP duplo pro casal
🏆 ${P}rankcasais — Ver ranking dos casais

_Amor é ação diária. Use os comandos para fortalecer seu casal!_ 💕`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('❤️ Menu relacionamento enviado');
}

async function handleMenuBaixar(sock, msg, jid, getPrefix) {
  const P = getPrefix ? getPrefix(jid) : '!';
  const menu = `╭━━━━━━━━━━━━━━━━━━╮
│  📥 *MENU DOWNLOADS* 📥
│
│ ▸ ${P}som _(nome da música)_
│ ▸ ${P}audio _(link)_
│ ▸ ${P}tiktok _(link)_
│ ▸ ${P}save _(link)_
│ ▸ ${P}saverec _(link)_ _(recorta 10s p/ sticker)_
│ ▸ ${P}pinterest _(nome ou link)_
│
╰━━━━━━━━⊰ ✧ ⊱━━━━━━━╯`;
  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('📥 Menu downloads enviado');
}

module.exports = {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
};
