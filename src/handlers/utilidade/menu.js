async function handleMenu(sock, msg, jid, caption, getPrefix, author) {
  const P = getPrefix(jid);
  const now     = new Date();
  const hour    = now.getHours();
  const minute  = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hour}:${minute}`;

  let greeting = 'Olá';
  if (hour < 12)      greeting = '🌅 Bom dia';
  else if (hour < 18) greeting = '☀️ Boa tarde';
  else                greeting = '🌙 Boa noite';

  const userMention = author ? `*${author}*` : '';

  const menu =
`╔══════════════════════╗
       🔥 PIROQUINHAS 🔥
╚══════════════════════╝

${greeting}, ${userMention}! São ${timeStr} ⏰

━━━━━━━━━━━━━━━━━━━━━━━━
🎨 *FIGURINHAS & EFEITOS*
  ▸ ${P}menufig
  ▸ ${P}menuefeitos

🛡️ *ADMINISTRAÇÃO*
  ▸ ${P}menuadm
  ▸ ${P}reportar _(marque a mensagem)_

🎮 *DIVERSÃO & JOGOS*
  ▸ ${P}menujogos
  ▸ ${P}brincadeiras
  ▸ ${P}alteradores

💑 *RELACIONAMENTOS*
  ▸ ${P}menucasal
  ▸ ${P}menuaniversario

🔧 *UTILIDADES*
  ▸ ${P}menuutil
━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleMenuUtil(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
     🔧 MENU UTILIDADES
╚══════════════════════╝

📍 *CONSULTAS*
  ▸ ${P}cep _(número)_
  ▸ ${P}clima _(cidade)_
  ▸ ${P}calcular _(expressão)_

🌐 *TEXTO & IDIOMAS*
  ▸ ${P}traduzir _(idioma) (texto)_
  ▸ ${P}maiusculo _(texto)_
  ▸ ${P}invertido _(texto)_
  ▸ ${P}caixa _(texto)_

📡 *CÓDIGO MORSE*
  ▸ ${P}morse _(texto)_
  ▸ ${P}demorse _(código)_

🔗 *OUTROS*
  ▸ ${P}encurtar _(link)_
  ▸ ${P}qrcode _(texto)_
  ▸ ${P}dado _(lados)_
  ▸ ${P}moeda _(câmbio ou cara/coroa)_
  ▸ ${P}piada
  ▸ ${P}fato

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleMenuJogos(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
   🎮 MENU JOGOS & DIVERSÃO
╚══════════════════════╝

💰 *ECONOMIA*
  ▸ ${P}menugold
  ▸ ${P}menupet
  ▸ ${P}missao
  ▸ ${P}garimpar
  ▸ ${P}extrato

🧩 *MINI-JOGOS*
  ▸ ${P}quiz _(tema)_
  ▸ ${P}anagrama
  ▸ ${P}ppt _(pedra/papel/tesoura)_
  ▸ ${P}eununca
  ▸ ${P}brincadeiras

🎰 *APOSTAS & SORTE*
  ▸ ${P}apostar _(quantia)_
  ▸ ${P}slots
  ▸ ${P}corrida
  ▸ ${P}roletarussa
  ▸ ${P}roletarussa2
  ▸ ${P}roletarussa3

🎯 *OUTROS*
  ▸ ${P}tiro
  ▸ ${P}morte
  ▸ ${P}falta
  ▸ ${P}baterfalta
  ▸ ${P}pontos
  ▸ ${P}rankjogos
  ▸ ${P}ranklevel
  ▸ ${P}level

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleAlteradores(sock, msg, jid) {
  const menu =
`╔══════════════════════╗
     🎛️ MENU ALTERADORES
╚══════════════════════╝

_Responda uma mídia com o comando desejado_

🎬 *VÍDEO*
  ▸ .videolento
  ▸ .videorapido
  ▸ .videocontrario
  ▸ .reversevideo

🎵 *ÁUDIO*
  ▸ .audiolento
  ▸ .audiorapido
  ▸ .audioreverse
  ▸ .grave
  ▸ .esquilo
  ▸ .bass

🎭 *VOZ*
  ▸ .vozmenino
  ▸ .vozgrossa
  ▸ .vozmulher
  ▸ .vozrobo
  ▸ .vozalien
  ▸ .vozvelho
  ▸ .vozcrianca
  ▸ .vozdemonio

🔊 *AMBIENTE*
  ▸ .eco
  ▸ .caverna
  ▸ .telefone
  ▸ .radio
  ▸ .megafone
  ▸ .underwater

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleMenuRelacionamento(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
      ❤️ MENU DO CASAL
╚══════════════════════╝

💍 *CASAMENTO*
  ▸ ${P}casar @pessoa
  ▸ ${P}euaceito
  ▸ ${P}eurecuso
  ▸ ${P}cancelarpedido
  ▸ ${P}cancelarcasamento _(bloqueia 7 dias)_

💐 *DIÁRIOS (+5 XP cada, 1x/dia)*
  ▸ ${P}flores
  ▸ ${P}doces
  ▸ ${P}carta
  ▸ ${P}mimo
  ▸ ${P}beijo

💝 *ROMÂNTICOS*
  ▸ ${P}abraco
  ▸ ${P}presente
  ▸ ${P}jantar
  ▸ ${P}cinematel
  ▸ ${P}viajar
  ▸ ${P}serenata
  ▸ ${P}declarar
  ▸ ${P}ciumento

🏆 *ESPECIAIS*
  ▸ ${P}statu — Ver status do casal
  ▸ ${P}meupar — Infos do par
  ▸ ${P}xpdobro — XP duplo por 1h
  ▸ ${P}duelodecasais
  ▸ ${P}rankcasais

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

async function handleMenuBaixar(sock, msg, jid, getPrefix) {
  const P = getPrefix ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      📥 MENU DOWNLOADS
╚══════════════════════╝

🎵 *MÚSICA & ÁUDIO*
  ▸ ${P}som _(nome da música)_
  ▸ ${P}audio _(link)_

📱 *VÍDEO & REDES SOCIAIS*
  ▸ ${P}tiktok _(link)_
  ▸ ${P}save _(link)_
  ▸ ${P}saverec _(link)_ _(recorta 10s)_
  ▸ ${P}pinterest _(nome ou link)_

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

module.exports = {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
};