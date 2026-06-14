async function handleMenu(sock, msg, jid, caption, getPrefix, author) {
  const P = getPrefix(jid);

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [data, hora] = agora.split(', ');
  const [hour] = hora.split(':').map(Number);
  const timeStr = hora.slice(0, 5);

  let greeting = 'Olá';
  if (hour >= 5  && hour < 12) greeting = '🌅 Bom dia';
  else if (hour >= 12 && hour < 18) greeting = '☀️ Boa tarde';
  else                               greeting = '🌙 Boa noite';

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
  ▸ ${P}menuroubar
  ▸ ${P}menusec

💑 *RELACIONAMENTOS*
  ▸ ${P}menucasal
  ▸ ${P}menuaniversario
  ▸ ${P}menufilho

💼 *EMPREGOS*
  ▸ ${P}menuwork

🔧 *UTILIDADES*
  ▸ ${P}menuutil
━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// !menuutil
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

// !menujogos
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

⚽ *COPA DO MUNDO*
  ▸ ${P}worldcup — Tabela da Copa 2026 🏆

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// !alteradores
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

// !menucasal
async function handleMenuRelacionamento(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      ❤️ MENU DO CASAL
╚══════════════════════╝

💍 *RELACIONAMENTO*
  ▸ ${P}casar @pessoa — Pedir em casamento
  ▸ ${P}euaceito — Aceitar pedido
  ▸ ${P}eurecuso — Recusar pedido
  ▸ ${P}cancelarpedido — Cancelar pedido enviado
  ▸ ${P}terminar — Terminar relacionamento _(bloqueia 10 min)_

💐 *DIÁRIOS (+5 XP cada, 1x/dia)*
  ▸ ${P}flores 🌹
  ▸ ${P}doces 🍬
  ▸ ${P}carta 💌
  ▸ ${P}mimo 🎁
  ▸ ${P}beijo 💋

💝 *ROMÂNTICOS*
  ▸ ${P}abraco — Dar um abraço
  ▸ ${P}presente — Dar um presente
  ▸ ${P}jantar — Jantar a dois
  ▸ ${P}cinematel — Sessão de cinema
  ▸ ${P}viajar — Viajar juntos
  ▸ ${P}serenata — Fazer uma serenata
  ▸ ${P}declarar — Declaração de amor
  ▸ ${P}ciumento — Demonstrar ciúme

🏆 *ESPECIAIS*
  ▸ ${P}statu — Status do casal
  ▸ ${P}meupar — Infos do seu par
  ▸ ${P}xpdobro — XP duplo por 1h
  ▸ ${P}aniversario_casal — Ver aniversário
  ▸ ${P}duelodecasais — Duelo entre casais
  ▸ ${P}rankcasais — Ranking de casais

🛒 *LOJA*
  ▸ ${P}lojacasal — Ver itens disponíveis

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// !menufilho
async function handleMenuFilho(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      👶 MENU FILHOS
╚══════════════════════╝

👨‍👩‍👧 *FAMÍLIA*
  ▸ ${P}tentarfilho — Tentar ter um filho _(40% chance)_
  ▸ ${P}filho — Ver seus filhos e status
  ▸ ${P}cuidarfilho — Cuidar dos filhos _(cooldown 20h)_

💊 *SAÚDE*
  ▸ ${P}remediofil — Curar filho doente _(300 gold)_

━━━━━━━━━━━━━━━━━━━━━━━━
📋 *REGRAS*
  • Limite de *3 filhos* por casal
  • A cada *7 dias* o filho completa *1 ano*
  • Atributos caem com o tempo — cuide diariamente!
  • Felicidade zerada → filho fica *doente*
  • Em caso de separação → *guarda compartilhada*
    _(o filho troca de responsável a cada dia)_

━━━━━━━━━━━━━━━━━━━━━━━━
📊 *ATRIBUTOS*
  😊 Felicidade • 🍽️ Fome
  😴 Sono • 🎈 Alegria

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// !menubaixar
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

// !menuwork
async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
      💼 MENU EMPREGOS
╚══════════════════════╝

🔎 *COMEÇAR*
  ▸ ${P}procuraremprego — Procura um emprego
  ▸ ${P}emprego — Ver seu cargo e status atual
  ▸ ${P}demitir — Pedir demissão voluntária

⏱️ *TRABALHAR*
  ▸ ${P}trabalhar — Bater o ponto e receber salário
  ▸ ${P}work — Atalho para !trabalhar

📈 *PROGRESSÃO*
  ▸ ${P}promocao — Subir de cargo (se tiver turnos suficientes)

━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *CARGOS DISPONÍVEIS*
  1. 🛵 Entregador de Pizza  _(inicial)_
  2. 🏪 Atendente de Loja
  3. 💻 Programador Júnior
  4. 🏢 Diretor de Empresa   _(máximo)_

━━━━━━━━━━━━━━━━━━━━━━━━
⏰ *REGRAS DO PONTO*
  • Cooldown entre turnos: *6h30*
  • Janela de tolerância: *2h* após o cooldown
  • Após *8h30* sem bater ponto → demissão por justa causa
  ⚠️ _Histórico sujo reduz chance de recontratação para 30%_

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
  handleMenuWork,
  handleMenuFilho,
};