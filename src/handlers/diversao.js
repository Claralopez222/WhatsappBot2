/**
 * Handler de Diversão — Piroquinhas Bot
 * Comandos: !gay, !sexo, !nazista, !lesbica, !aura, !dado, !moeda, !8ball,
 *           !ship, !rolar, !xingar, !elogio, !crush, !cantada, !safadeza,
 *           !tiro, !morte, !roletarussa, !roletarussa2, !roletarussa3,
 *           !falta, !baterfalta, !eununca, !quiz, !pontos, !rankjogos,
 *           !anagrama, !ppt, !brincadeiras,
 *           [NOVOS] !verdadeoudesafio, !confissao, !julgamento, !podre,
 *                   !frango, !maldizer, !fortuna, !compatibilidade
 */

// ─── Estado dos jogos ─────────────────────────────────────────────────────────
const roletaState   = new Map(); // jid → { bala, tiros }
const roletaState2  = new Map();
const roletaState3  = new Map();
const faltaState    = new Map(); // jid → { cobrador, time }
const quizState     = new Map(); // senderJid → { r, timeout }
const anagramaState = new Map(); // senderJid → { palavra, timeout }
const pptState      = new Map();
const pontosMap     = new Map(); // senderJid → number
const vodState      = new Map(); // senderJid → esperando desafio/verdade

// ─── !gay ─────────────────────────────────────────────────────────────────────
async function handleGay(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '🧢'; frase = 'Praticamente hétero, mas nunca se sabe... 👀'; }
  else if (pct <= 30) { emoji = '🌈'; frase = 'Um pouco curioso(a) né? Tô de olho em você 😏'; }
  else if (pct <= 50) { emoji = '🏳️‍🌈'; frase = 'Na metade! Admite logo, porra! 😂'; }
  else if (pct <= 70) { emoji = '💅'; frase = 'Saindo do armário aos poucos! A porta tá aberta, vai lá! 🚪'; }
  else if (pct <= 89) { emoji = '👨‍❤️‍👨'; frase = 'Quase assumido(a)! Falta pouco, caralho! 🏳️‍🌈'; }
  else if (pct <= 99) { emoji = '🌈✨'; frase = 'Praticamente confirmado(a)! Larga essa farsa porra! 🎉'; }
  else                { emoji = '🏆🌈'; frase = '100% GAY! Parabéns campeão(ã) da diversidade! Orgulhe-se! 🎊'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *GAYÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n💡 _Seja você mesmo(a), porra!_ 🌈`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !sexo ────────────────────────────────────────────────────────────────────
async function handleSexo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém, otário(a)!\nExemplo: *!sexo @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentionedJid[0];
  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, { text: '😂 Isso não funciona sozinho(a)! Vai se foder! 💀' }, { quoted: msg });
    return;
  }

  const alvo = `@${alvoJid.split('@')[0]}`;
  const cenas = [
    `💀 *${author}* chegou pra cima de *${alvo}* cheio de confiança e tomou um "vai tomar no cu" na lata KKKK 😭`,
    `🤡 *${author}* mandou "oi gata" pra *${alvo}* e foi deixado no visto por 3 dias seguidos. Que vexame! 💀`,
    `😂 *${alvo}* viu *${author}* chegando e já foi logo: "sai fora, arrombado(a)" sem nem deixar falar HAHAHA 🚫`,
    `💔 *${author}* tentou dar uma de galã pra *${alvo}* e foi mandado(a) ver um filme sozinho(a) KKKK 🎬`,
    `🫠 *${author}* ficou esperando resposta de *${alvo}* até hoje... spoiler: não veio porra nenhuma 📵`,
    `😭 *${alvo}* disse pra *${author}*: "você é muito legal... como amigo(a)" — o maior golpe baixo da história 🗡️`,
    `🤣 *${author}* foi tirar satisfação com *${alvo}* e saiu de lá consolando a si mesmo(a) e chorando KKKKKK`,
    `💅 *${alvo}* bloqueou *${author}* em todas as redes sociais. TODAS. nem o LinkedIn escapou, que humilhação! 😂`,
    `🚨 *${author}* tentou ser romântico(a) pra *${alvo}* e a resposta foi "haha" com H minúsculo. Vai chorar! 💀`,
    `🏃 *${alvo}* fingiu que o celular morreu quando *${author}* foi falar. Bateria 1% mas tava online KKKKK filha da puta`,
    `🛏️ *${author}* tentou pegar *${alvo}* e rolou tudo errado: cama rangeu, vizinho bateu, cachorro latiu. Fim! 💀`,
    `🌶️ *${author}* jurou que ia arrasar com *${alvo}* e durou 30 segundos. Nem deu tempo de esquentar! KKKK ⏱️`,
    `😳 *${alvo}* disse que tava cansado(a) depois de 2 minutos. *${author}* ficou com a cara no chão! 💀😂`,
    `📞 Bem na hora H entre *${author}* e *${alvo}*, a mãe ligou. Atmosfera DESTRUÍDA. Que merda! ☠️`,
    `🤢 *${author}* tentou dar uma de sedutor(a) pra *${alvo}* e a resposta foi "não, obrigado, que nojo" 😭💀`,
  ];

  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + '\n\n💡 _O amor é cruel, mano!_ ❤️‍🔥',
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !nazista ─────────────────────────────────────────────────────────────────
async function handleNazista(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '🕊️'; frase = 'Pacifista nato! Nem mata mosquito!'; }
  else if (pct <= 30) { emoji = '🤝'; frase = 'Prefere diálogo, mas já xingou bastante hoje.'; }
  else if (pct <= 50) { emoji = '⚖️'; frase = 'Equilibrado, mas influenciável pra caralho.'; }
  else if (pct <= 70) { emoji = '🛡️'; frase = 'Defende as ideias com unhas e dentes!'; }
  else if (pct <= 89) { emoji = '⚔️'; frase = 'Caralho! Muito raivoso(a) por aí, visse!'; }
  else if (pct <= 99) { emoji = '🚩'; frase = 'Quase lá! Ideologia pesada demais, faz tratamento!'; }
  else                { emoji = '🦅'; frase = '100%! Ditador(a) confirmado(a)! Deus nos ajude!'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *NAZÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n💡 _Paz e diálogo sempre vencem, seu merda!_ 🕊️`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !lesbica ─────────────────────────────────────────────────────────────────
async function handleLesbica(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '👭'; frase = 'Hetero assumida! Mas o olhão trai...'; }
  else if (pct <= 30) { emoji = '💃'; frase = 'Curiosa... não tem nada de errado, viu?'; }
  else if (pct <= 50) { emoji = '🌈'; frase = 'Na metade do caminho, admite logo filha!'; }
  else if (pct <= 70) { emoji = '👩‍❤️‍👩'; frase = 'Bastante atraída! Quem é você tentando enganar?'; }
  else if (pct <= 89) { emoji = '💅'; frase = 'Quase assumida! O armário tá aberto, entra!'; }
  else if (pct <= 99) { emoji = '🌟'; frase = 'Muito próxima da confirmação! Vai lá, caralho!'; }
  else                { emoji = '🏆'; frase = '100%! Rainha absoluta da diversidade! Gostosa demais!'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *LESBÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n💡 _O amor não tem gênero, seu preconceituoso!_ 🌈`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !aura ────────────────────────────────────────────────────────────────────
async function handleAura(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 20)      { emoji = '😈'; frase = 'AURA PODRE! Six seven! Capeta disfarçado de humano! 👹 Toma banho de sal grosso!'; }
  else if (pct <= 40) { emoji = '😐'; frase = 'Aura neutra... nada demais, mas um banho de ervas não faz mal! 🤔'; }
  else if (pct <= 60) { emoji = '😊'; frase = 'Aura positiva! Boa pessoa, mas não confia demais que vai apanhar! 😇'; }
  else if (pct <= 80) { emoji = '✨'; frase = 'Aura brilhante! Iluminado(a), mas com um lado obscuro escondido! 🌟'; }
  else if (pct <= 99) { emoji = '🌟'; frase = 'Aura divina! Anjo na terra... com um pé no inferno às 3h da manhã! 😇🔥'; }
  else                { emoji = '👼'; frase = 'AURA MÁXIMA! Santo(a) de verdade! Chama o papa, caralho! 🙏'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *AURA DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n💡 _A aura reflete suas safadezas!_ ✨`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !dado ────────────────────────────────────────────────────────────────────
async function handleDado(sock, msg, jid, caption) {
  const match = caption.match(/dado\s*(\d+)?/i);
  const lados = Math.min(parseInt(match?.[1] || '6') || 6, 100);
  const res = Math.floor(Math.random() * lados) + 1;
  const emojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const emoji = lados === 6 ? emojis[res - 1] : '🎲';
  await sock.sendMessage(jid, { text: `${emoji} Dado de *${lados}* lados: *${res}*\n\n_Tirou uma ${res === 1 ? 'merda' : res === lados ? 'nota máxima' : 'aí'}!_` }, { quoted: msg });
}

// ─── !moeda ───────────────────────────────────────────────────────────────────
async function handleMoeda(sock, msg, jid) {
  const res = Math.random() < 0.5 ? '🪙 *CARA*' : '🟡 *COROA*';
  const comentarios = [
    'Destino falou!', 'Aceitou, porra?', 'Era isso!', 'Sem choro!', 'A moeda decidiu, acabou!',
  ];
  const coment = comentarios[Math.floor(Math.random() * comentarios.length)];
  await sock.sendMessage(jid, { text: `Jogando moeda...\n\n${res}!\n\n_${coment}_` }, { quoted: msg });
}

// ─── !8ball ───────────────────────────────────────────────────────────────────
async function handle8ball(sock, msg, jid, caption) {
  const pergunta = caption.replace(/^[!.,\/]8ball\s*/i, '').trim();
  if (!pergunta) {
    await sock.sendMessage(jid, { text: '⚠️ Faz uma pergunta, idiota!\nExemplo: *!8ball Vou passar no vestibular?*' }, { quoted: msg });
    return;
  }
  const respostas = [
    '🟢 Com certeza, porra!', '🟢 Definitivamente sim, vai nessa!', '🟢 Pode apostar sua cueca!',
    '🟢 Sim, sem dúvidas! Vai lá!', '🟢 Os astros dizem sim, mano!',
    '🟡 Talvez... depende de você, seu preguiçoso!', '🟡 Não tenho certeza, cria!', '🟡 Pergunta de novo mais tarde, chato!',
    '🟡 É difícil dizer... nem eu sei!', '🟡 Concentra a mente e tenta de novo!',
    '🔴 Nem fodendo!', '🔴 Minha resposta é NÃO, vai chorar!', '🔴 As perspectivas são uma bosta.',
    '🔴 Muito duvidoso, meu brother!', '🔴 Definitivamente não, esqueça essa ideia!',
    '🔴 Só se for no inferno!', '🔴 A bola diz: vai se ferrar! 💀',
  ];
  const r = respostas[Math.floor(Math.random() * respostas.length)];
  await sock.sendMessage(jid, { text: `🎱 *BOLA MÁGICA*\n\n❓ _${pergunta}_\n\n${r}` }, { quoted: msg });
}

// ─── !ship ────────────────────────────────────────────────────────────────────
async function handleShip(sock, msg, content, jid, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  let jidA, jidB, nomeA, nomeB;
  if (mentions.length >= 2) {
    jidA = mentions[0]; jidB = mentions[1];
    nomeA = contactNames[jidA] || jidA.split('@')[0];
    nomeB = contactNames[jidB] || jidB.split('@')[0];
  } else if (mentions.length === 1) {
    jidA = senderJid; jidB = mentions[0];
    nomeA = msg.pushName || contactNames[senderJid] || senderJid.split('@')[0];
    nomeB = contactNames[jidB] || jidB.split('@')[0];
  } else {
    await sock.sendMessage(jid, { text: '⚠️ Marca 1 ou 2 pessoas!\nExemplo: *!ship @fulano @ciclano*' }, { quoted: msg });
    return;
  }

  const seed = (jidA + jidB).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const pct = seed % 101;

  let emoji, frase;
  if (pct <= 20)      { emoji = '💔'; frase = `Péssima combinação! Nem no inferno daria certo! 😬`; }
  else if (pct <= 40) { emoji = '💛'; frase = `Podem ser bons amigos(as), mas nada além disso! 🤝`; }
  else if (pct <= 60) { emoji = '💚'; frase = `Combinação razoável! Pode rolar uma coisa ou outra... 😏`; }
  else if (pct <= 80) { emoji = '💙'; frase = `Boa combinação! Esses dois pegam fogo! 😍🔥`; }
  else if (pct <= 95) { emoji = '❤️'; frase = `EXCELENTE! Esses dois são pau pra toda obra juntos! 😍🔥`; }
  else                { emoji = '💘'; frase = `CASAL PERFEITO! Já podem se casar, filhos da puta! 🎊💍`; }

  const barra = '🟥'.repeat(Math.round(pct / 10)) + '⬜'.repeat(10 - Math.round(pct / 10));
  await sock.sendMessage(jid, {
    text: `${emoji} *SHIP: ${nomeA.toUpperCase()} + ${nomeB.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: [jidA, jidB],
  }, { quoted: msg });
}

// ─── !rolar ───────────────────────────────────────────────────────────────────
async function handleRolar(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const alvo = `@${alvoJid.split('@')[0]}`;

  const acoes = [
    `🤗 *${author}* tentou abraçar *${alvo}* e levou um soco no nariz! 💢💀`,
    `🎯 *${author}* arremessou um frango cru em *${alvo}* e acertou em cheio! 🐔💦`,
    `💃 *${author}* puxou *${alvo}* pra dançar, pisou no pé e ainda caiu em cima! 🦶😂`,
    `🎁 *${author}* deu um presente pra *${alvo}*... era uma cueca usada! 🧅💀`,
    `🥊 *${author}* desafiou *${alvo}* pra briga de olhar fixo e chorou em 3 segundos. Que fraco(a)! 👀`,
    `🍕 *${author}* tentou roubar a pizza de *${alvo}* e levou uma bordoada! 🤌🤕`,
    `🎤 *${author}* cantou uma serenata horrível pra *${alvo}* e os vizinhos chamaram a polícia! 🚔😂`,
    `🐟 *${author}* deu uma tapa com peixe podre em *${alvo}*! Que cheiro! 🐠💨`,
    `💩 *${author}* jogou cocô de pombo em *${alvo}* sem querer. Foi sem querer mesmo... 🐦`,
    `🍺 *${author}* jogou cerveja em *${alvo}* achando que era água. Fez até bem! 🤣`,
    `🧻 *${author}* enrolou *${alvo}* em papel higiênico no meio da rua! 😂`,
    `🤡 *${author}* tentou dar um susto em *${alvo}* e foi quem se mijou de medo! 💀`,
    `💋 *${author}* tentou beijar *${alvo}* e levou um tapa de estalo! PÁÁÁ! 👋😭`,
    `🪣 *${author}* jogou um balde d'água fria em *${alvo}* às 6h da manhã. Merece! 🥶`,
  ];

  await sock.sendMessage(jid, {
    text: acoes[Math.floor(Math.random() * acoes.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !xingar ──────────────────────────────────────────────────────────────────
async function handleXingar(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const a = `@${alvoJid.split('@')[0]}`;

  const xingamentos = [
    `🤡 *${a}* é um babaca do caralho que nem o Google consegue achar de relevante! 💀`,
    `😂 *${a}* é tão inútil que a própria mãe pergunta se foi adotado(a)! KKKK`,
    `💀 *${a}* é mais chato(a) que soluço, some e volta na hora mais errada! 😤`,
    `🖕 *${a}* vai tomar no cu com muito carinho, beijos com afeto! 🥰`,
    `🗑️ *${a}* é lixo e ainda espera pra ser reciclado, faz favor! KKKK`,
    `🤮 *${a}* é mais insuportável que propaganda de 30 segundos no meio do vídeo! 💀`,
    `🐍 *${a}* é tão falso(a) que até a sombra dele(a) é mentira! 😂`,
    `💩 *${a}* tem mais cara de pau que toda a Amazônia! Que descarado(a)!`,
    `🪲 *${a}* é tão feio(a) que quando nasceu o médico deu tapa na mãe! 💀😂`,
    `🤡 *${a}* é burro(a) demais pra ser personagem de desenho, seria rejeitado(a)!`,
    `🦷 *${a}* cheira tão mal que o desodorante pediu demissão! 💀`,
    `🐷 *${a}* come mais do que pensa, e já pensa bastante pouco! 😂`,
    `🪑 *${a}* tem o QI de uma cadeira quebrada! Pelo menos a cadeira tem utilidade!`,
    `👻 *${a}* é tão chato(a) que até os fantasmas fogem quando aparece! 💀`,
    `🧻 *${a}* é mais descartável que papel higiênico! 😂`,
  ];

  await sock.sendMessage(jid, {
    text: xingamentos[Math.floor(Math.random() * xingamentos.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !elogio ──────────────────────────────────────────────────────────────────
async function handleElogio(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;

  const elogios = [
    `✨ *@${alvoJid.split('@')[0]}* brilha mais que diamante, que ser humano incrível! 💎`,
    `🌟 *@${alvoJid.split('@')[0]}* é tão incrível que nem o Google consegue descrever! 🔍`,
    `🦋 *@${alvoJid.split('@')[0]}* tem um sorriso que ilumina o ambiente inteiro! ☀️`,
    `🏆 *@${alvoJid.split('@')[0]}* é campeão(ã) de existir com estilo! Que gato(a)! 😎`,
    `💪 *@${alvoJid.split('@')[0]}* é forte, inteligente e incrível! Não deixa ninguém te rebaixar! 🔥`,
    `🌹 *@${alvoJid.split('@')[0]}* é a pessoa mais especial desse grupo, sem sombra de dúvida! 💯`,
    `🍑 *@${alvoJid.split('@')[0]}* é gostoso(a) demais! Que crime ser assim! 😏🔥`,
    `🧠 *@${alvoJid.split('@')[0]}* é inteligente pra caramba! Nerd gostoso(a)! 🤓✨`,
    `😍 *@${alvoJid.split('@')[0]}* cada dia que passa fica mais perfeito(a)! Para de crescer assim!`,
    `🎭 *@${alvoJid.split('@')[0]}* tem a personalidade mais única desse grupo, amo demais! 💕`,
  ];

  await sock.sendMessage(jid, {
    text: elogios[Math.floor(Math.random() * elogios.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !crush ───────────────────────────────────────────────────────────────────
async function handleCrush(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém, seu tímido(a)!\nExemplo: *!crush @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentionedJid[0];
  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, { text: '😂 Você é seu próprio crush? Que patético(a)! 💀' }, { quoted: msg });
    return;
  }

  const pct = Math.floor(Math.random() * 101);
  const filled = Math.round(pct / 10);
  const barra = '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);

  let emoji, frase;
  if (pct <= 25)      { emoji = '👀'; frase = `*${author}* stalkeia *@${alvoJid.split('@')[0]}* toda noite antes de dormir e ainda nega! KKKK`; }
  else if (pct <= 50) { emoji = '🥴'; frase = `*${author}* já salvou todas as fotos de *@${alvoJid.split('@')[0]}* no HD escondido!`; }
  else if (pct <= 75) { emoji = '💘'; frase = `*${author}* já escreveu o nome de *@${alvoJid.split('@')[0]}* no caderno com coração e flecha!`; }
  else                { emoji = '💍'; frase = `*${author}* já escolheu o buffet, o DJ e o vestido do casamento com *@${alvoJid.split('@')[0]}*! HAUHAUHAU`; }

  await sock.sendMessage(jid, {
    text: `${emoji} *CRUSHÔMETRO*\n\n${barra} *${pct}%*\n\n💭 _${frase}_\n\n_Assume logo essa merda!_ 😂`,
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !cantada ─────────────────────────────────────────────────────────────────
async function handleCantada(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém!\nExemplo: *!cantada @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentionedJid[0];
  const alvo = `@${alvoJid.split('@')[0]}`;
  const cantadas = [
    `🥴 *${author}* pra *${alvo}*: "Você tem WiFi? Porque eu tô sentindo uma conexão aqui..." *${alvo}* desligou o roteador na hora! 😂`,
    `😬 *${author}* pra *${alvo}*: "Você é tão lindo(a) que meu GPS se perdeu te olhando" — foi bloqueado(a) no mapa! 🗺️💀`,
    `💀 *${author}* pra *${alvo}*: "Você é médico(a)? Porque fez meu coração acelerar!" — *${alvo}* chamou o SAMU! 🚑`,
    `😂 *${author}* pra *${alvo}*: "Se beleza fosse crime você taria presa(o)!" *${alvo}*: "E se chatura fosse, você tava condenado(a)!" 💀`,
    `🫠 *${author}* pra *${alvo}*: "Você caiu do céu?" *${alvo}*: "Não, mas você vai cair se continuar incomodando!" 😭`,
    `🤡 *${author}* pra *${alvo}*: "Posso te seguir? Minha mãe disse pra seguir meus sonhos!" Levou um fora na mesma hora! 💔`,
    `💋 *${author}* pra *${alvo}*: "Você tem mapa? Porque me perdi nos seus olhos!" *${alvo}*: "Usa o Google Maps, idiota!" 🗺️😂`,
    `😏 *${author}* pra *${alvo}*: "Tô cansado(a) de só te ver no sonho, vem pra realidade!" *${alvo}* deu unfollow em todos! 💀`,
    `🧲 *${author}* pra *${alvo}*: "Você é íman? Porque tô muito atraído(a)!" *${alvo}*: "Não, sou repelente!" KKKKKK`,
    `🍷 *${author}* pra *${alvo}*: "Você gosta de vinho? Porque você melhora com o tempo!" *${alvo}* derramou o vinho na cabeça de *${author}*! 😂`,
  ];
  await sock.sendMessage(jid, {
    text: cantadas[Math.floor(Math.random() * cantadas.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !safadeza ────────────────────────────────────────────────────────────────
async function handleSafadeza(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém!\nExemplo: *!safadeza @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentionedJid[0];
  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, { text: '😂 Sozinho(a) não conta! Arruma alguém primeiro! 💀' }, { quoted: msg });
    return;
  }

  const alvo = `@${alvoJid.split('@')[0]}`;
  const cenas = [
    `🌶️ *${author}* e *${alvo}* esquentaram geral mas o vizinho bateu na parede três vezes. Fim da festa, vacilão! 🧱`,
    `😏 *${author}* preparou o clima todo pra *${alvo}*... aí a bateria do celular morreu e o WhatsApp sumiu. Que merda! 📵`,
    `🔥 *${author}* fez jantar, vela, música pra *${alvo}*... *${alvo}* dormiu no sofá às 21h. Tomou no cu! 😴`,
    `💦 *${author}* e *${alvo}* estavam no melhor quando a mãe de *${alvo}* ligou. Silêncio de cemitério! 📞😨`,
    `🫦 *${author}* mandou mensagem às 2h da manhã pra *${alvo}*... respondeu com emoji de sol às 9h. Amigo da onça! 🌞💀`,
    `🛏️ *${author}* tentou fazer a cama ranger pra *${alvo}*, mas a cama desmoronou. Que humilhação! 💀`,
    `🩲 *${author}* preparou tudo bonitinho pra *${alvo}* mas na hora H... nada funcionou. O clima foi pro saco! 😬`,
    `🔞 *${author}* e *${alvo}* finalmente iam se resolver, quando o cachorro entrou e subiu na cama. Deu não! 🐶💀`,
    `🌙 *${author}* ficou esperando *${alvo}* ficar pronto(a) por 2 horas. Na hora H *${alvo}* tava com dor de cabeça! 😭`,
    `🚿 *${author}* chamou *${alvo}* pro banho e acabou a água quente em 30 segundos. Virou banho de piscina! 🥶`,
  ];
  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + '\n\n_Vida de solteiro(a) é melhor!_ 😂',
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !tiro ────────────────────────────────────────────────────────────────────
async function handleTiro(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const alvo = `@${alvoJid.split('@')[0]}`;

  const chance = Math.random();
  let texto;
  if (chance < 0.35) {
    texto = `🎯 *${author}* mirou, atirou e ACERTOU *${alvo}* bem no meio da testa! 💥🔫\n_${alvo} foi pro cemitério. Descanse em paz, merda!_ ⚰️`;
  } else if (chance < 0.55) {
    texto = `😅 *${author}* atirou em *${alvo}* e errou por MILÍMETROS! 🔫💨\n_${alvo} sobreviveu por pura sorte! Que frangão(a)!_`;
  } else if (chance < 0.75) {
    texto = `🤡 *${author}* tentou atirar em *${alvo}* mas a arma travou! 🔫❌\n_Que vexame total! Aprende a atirar!_`;
  } else if (chance < 0.90) {
    texto = `🪃 *${author}* atirou em *${alvo}* mas a bala ricocheteou e voltou! 💥\n_*${author}* se acertou! Que idiota!_ 💀`;
  } else {
    texto = `😂 *${author}* atirou em *${alvo}* e acertou o próprio pé! 🦶💥\n_Tá de parabéns! Atirador do ano!_`;
  }

  await sock.sendMessage(jid, { text: texto, mentions: [alvoJid] }, { quoted: msg });
}

// ─── !morte ───────────────────────────────────────────────────────────────────
async function handleMorte(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const alvo = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const mortes = [
    `💀 *${alvo}* escorregou na casca de banana e foi direto pro outro lado. Que clássico! 🍌`,
    `☠️ *${alvo}* tentou fazer receita do TikTok e foi intoxicado(a). Que fim lamentável! 📱`,
    `👻 *${alvo}* brigou com o carregador a 1% de bateria. O celular não sobreviveu, nem ele(a)! 🔋`,
    `⚰️ *${alvo}* abriu o guarda-roupa e foi engolido(a) pelas roupas. Nunca voltou! 👔`,
    `💀 *${alvo}* respondeu "tô bem" numa conversa chata e morreu de vergonha! 😴`,
    `🪦 *${alvo}* pisou em Lego descalço(a) às 3h da manhã. Não havia sobreviventes! 🧱`,
    `👻 *${alvo}* viu a fatura do cartão de crédito e o coração explodiu! 💳💥`,
    `☠️ *${alvo}* tentou dieta e morreu de fome em 2 horas. RIP, fraco(a)! 🥗`,
    `💀 *${alvo}* foi falar "tô mandando áudio" e o celular caiu no vaso. Tchau! 🚽`,
    `🪦 *${alvo}* ficou esperando o namorado(a) ficar pronto(a) por 3 horas e teve um infarto! ⏰`,
    `💀 *${alvo}* abriu o Nubank e o saldo em vermelho matou na hora! 😂`,
    `☠️ *${alvo}* tentou fazer 1 flexão e foi pro pronto-socorro! Que covarde! 💪`,
    `👻 *${alvo}* leu as mensagens do ex às 3h da manhã e não resistiu à cringe! 📱`,
    `🪦 *${alvo}* disse "só mais 5 minutinhos" no travesseiro e acordou às 14h do dia seguinte. RIP! 😴`,
  ];

  await sock.sendMessage(jid, {
    text: mortes[Math.floor(Math.random() * mortes.length)],
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !roletarussa ─────────────────────────────────────────────────────────────
async function handleRoletaRussa(sock, msg, jid, author, senderJid) {
  if (!roletaState.has(jid)) {
    const bala = Math.floor(Math.random() * 6) + 1;
    roletaState.set(jid, { bala, tiros: 0 });
    await sock.sendMessage(jid, {
      text: `🔫 *ROLETA RUSSA INICIADA!*\n\n_Revólver carregado com 1 bala em 6 câmaras._\n_Use *!roletarussa* pra atirar. Boa sorte, seu idiota!_`,
    }, { quoted: msg });
    return;
  }

  const state = roletaState.get(jid);
  state.tiros++;

  if (state.tiros === state.bala) {
    roletaState.delete(jid);
    await sock.sendMessage(jid, {
      text: `🔫💥 *BANG!*\n\n*${author}* puxou o gatilho e... *LEVOU O TIRO NA CABEÇA!* 💀☠️\n\n_Revólver recarregado. Descanse em paz, otário(a)!_`,
    }, { quoted: msg });
  } else if (state.tiros >= 6) {
    roletaState.delete(jid);
    await sock.sendMessage(jid, {
      text: `🔫 *Click...*\n\n*${author}* sobreviveu a todas as câmaras! 😅🏆\n_Impossível! Novo jogo iniciado..._`,
    }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, {
      text: `🔫 *Click...*\n\n*${author}* sobreviveu... dessa vez! 😰\n_Câmara ${state.tiros}/6 — você tem sorte, seu filha da puta!_`,
    }, { quoted: msg });
  }
}

// ─── !roletarussa2 ────────────────────────────────────────────────────────────
async function handleRoletaRussa2(sock, msg, jid, author) {
  if (!roletaState2.has(jid)) {
    const balas = new Set();
    while (balas.size < 3) balas.add(Math.floor(Math.random() * 6) + 1);
    roletaState2.set(jid, { balas, tiros: 0 });
    await sock.sendMessage(jid, {
      text: `🔫💥 *MODO DIFÍCIL!*\n\n_3 balas em 6 câmaras! 50% de chance de morrer!_\n_Use *!roletarussa2* pra atirar. Idiota corajoso(a)!_`,
    }, { quoted: msg });
    return;
  }

  const state = roletaState2.get(jid);
  state.tiros++;

  if (state.balas.has(state.tiros)) {
    roletaState2.delete(jid);
    await sock.sendMessage(jid, {
      text: `🔫💥💥 *BANG BANG!*\n\n*${author}* levou o tiro no modo difícil! 💀💀\n_3 balas no tambor e você escolheu a errada! Que azar do caralho!_`,
    }, { quoted: msg });
  } else if (state.tiros >= 6) {
    roletaState2.delete(jid);
    await sock.sendMessage(jid, {
      text: `🔫 *${author}* sobreviveu ao modo difícil! 🏆🎊\n_IMPOSSÍVEL! Você é agraciado pelos deuses, seu sortudo(a)!_`,
    }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, {
      text: `🔫 *Click...*\n\n*${author}* sobreviveu! 😰\n_Câmara ${state.tiros}/6 — 3 balas no tambor! Continua tentando a sorte, seu doido!_`,
    }, { quoted: msg });
  }
}

// ─── !roletarussa3 ────────────────────────────────────────────────────────────
const perguntasRoleta = [
  { p: 'Quantos estados tem o Brasil?', r: '27' },
  { p: 'Qual a capital do Brasil?', r: 'brasilia' },
  { p: 'Quanto é 15 x 15?', r: '225' },
  { p: 'Em que ano o Brasil foi descoberto?', r: '1500' },
  { p: 'Quantos jogadores num time de futebol?', r: '11' },
  { p: 'Qual o maior planeta do sistema solar?', r: 'jupiter' },
  { p: 'Quantos lados tem um hexágono?', r: '6' },
  { p: 'Qual o menor país do mundo?', r: 'vaticano' },
  { p: 'Em que continente fica o Egito?', r: 'africa' },
  { p: 'Quanto é a raiz quadrada de 144?', r: '12' },
  { p: 'Qual a fórmula da água?', r: 'h2o' },
  { p: 'Quantas horas tem um dia?', r: '24' },
  { p: 'Quanto é 7 x 8?', r: '56' },
  { p: 'Qual é o osso mais longo do corpo humano?', r: 'femur' },
];

async function handleRoletaRussa3(sock, msg, jid, author, senderJid) {
  if (roletaState3.has(senderJid)) {
    const state = roletaState3.get(senderJid);
    const resposta = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();
    clearTimeout(state.timeout);
    roletaState3.delete(senderJid);

    if (resposta === state.r) {
      await sock.sendMessage(jid, { text: `✅ *${author}* acertou! Sobreviveu à roleta de perguntas! 🏆\n_Sorte sua, seu esperto(a)!_` }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: `❌ *${author}* errou! A resposta era *${state.r}*. BOOM! 💀🔫\n_Burro(a)! Estudia mais!_` }, { quoted: msg });
    }
    return;
  }

  const q = perguntasRoleta[Math.floor(Math.random() * perguntasRoleta.length)];
  const timeout = setTimeout(() => {
    roletaState3.delete(senderJid);
    sock.sendMessage(jid, { text: `⏰ *${author}* demorou demais! BOOM! 💀🔫\n_Resposta era: ${q.r}. Que incompetente!_` });
  }, 30000);

  roletaState3.set(senderJid, { r: q.r, timeout });
  await sock.sendMessage(jid, {
    text: `🎯 *ROLETA DE PERGUNTAS*\n\n*${author}*, responda em 30 segundos ou morre, seu incompetente! 😰\n\n❓ *${q.p}*`,
  }, { quoted: msg });
}

// ─── !falta ───────────────────────────────────────────────────────────────────
async function handleFalta(sock, msg, content, jid, author, contactNames) {
  if (faltaState.has(jid)) {
    await sock.sendMessage(jid, { text: `⚠️ Já tem falta marcada! Cobra logo com *!baterfalta*, seu ansioso(a)!` }, { quoted: msg });
    return;
  }

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const cobradorJid = mentions[0] || senderJid;
  const cobrador = contactNames[cobradorJid] || cobradorJid.split('@')[0];

  const times = [
    '🔴⚫ Flamengo', '⚫⚪ Corinthians', '🔵⚪ Cruzeiro',
    '🔴⚫ Atlético-MG', '🟢 Palmeiras', '🔵⚪ Grêmio',
    '🔵⚫ Botafogo', '🔴⚫ Fluminense', '🔴⚫ São Paulo', '🔵⚫ Vasco',
  ];
  const time = times[Math.floor(Math.random() * times.length)];
  faltaState.set(jid, { cobrador, cobradorJid, time });

  await sock.sendMessage(jid, {
    text: `⚽ *FALTA MARCADA!*\n\n👤 Cobrador: *${cobrador}*\n🏟️ Time: *${time}*\n\n_Use *!baterfalta* pra cobrar. Não faz feio!_`,
    mentions: [cobradorJid],
  }, { quoted: msg });
}

// ─── !baterfalta ──────────────────────────────────────────────────────────────
async function handleBaterFalta(sock, msg, jid, author, senderJid) {
  if (!faltaState.has(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Nenhuma falta marcada! Usa *!falta* primeiro, seu ansioso(a)!' }, { quoted: msg });
    return;
  }

  const state = faltaState.get(jid);
  faltaState.delete(jid);

  const resultados = [
    `🥅 GOOOOL! *${state.cobrador}* mandou no ângulo! QUE PORRADA! 🎯🔥 *${state.time}* marca!`,
    `😱 DEFESA! O goleiro pegou a cobrança de *${state.cobrador}*! Que pena, seu frango! 🧤`,
    `😬 *${state.cobrador}* chutou e a bola foi pras arquibancadas! Que desperdício, LIXO! 💨`,
    `🏃 A barreira bloqueou *${state.cobrador}*! Vai treinar mais, seu vagabundo! 🛡️`,
    `💥 A bola bateu na trave! *${state.cobrador}* ficou com a mão na cabeça! Que azar! 😭`,
    `🎯 GOLAÇO DE PLACA! *${state.cobrador}* encobriu o goleiro! Obra prima do caralho! ⭐`,
    `🤡 *${state.cobrador}* chutou e escorregou antes de bater! Todo mundo gargalhou! 😂`,
    `😤 A bola passou a 2 metros do gol. Que cobrança horrível! Vai fazer aula! 💀`,
    `🔥 QUE GOLAÇO PORRADA! *${state.cobrador}* mandou no canto de forma DESUMANA! MUUUIIITO BOM! ⚡`,
    `😈 PUTA QUE PARIU! A bola saiu com efeito impossível! *${state.cobrador}* é um DEUS! 🙏`,
    `💀 *${state.cobrador}* virou as costas pro goleiro e meteu uma rabona SEM OLHAR! Que filho da puta bom! 🔥`,
    `😂 A bola bateu na cabeça do árbitro! *${state.cobrador}* é um merda, mas acertou! VAI UM GOOOOL! 🎯`,
    `🍆 *${state.cobrador}* chutou com tanta força que a bola saiu FOGO! *${state.time}* vence! Que tarado! ⚡`,
    `🥵 O goleiro tava de calça baixa e apanhou na BOLA! *${state.cobrador}* goleada! Que porrada criativa! 💥`,
  ];

  await sock.sendMessage(jid, {
    text: resultados[Math.floor(Math.random() * resultados.length)],
  }, { quoted: msg });
}

// ─── !eununca ─────────────────────────────────────────────────────────────────
async function handleEuNunca(sock, msg, jid) {
  const perguntas = [
    '🙈 Eu nunca fiz xixi na piscina... quem já fez, bebe!',
    '😂 Eu nunca mandei mensagem pra pessoa errada... quem já fez, bebe!',
    '🥴 Eu nunca fingi estar dormindo pra não atender... quem já fez, bebe!',
    '😳 Eu nunca stalkeei o perfil de alguém por horas... quem já fez, bebe!',
    '💀 Eu nunca dei risada numa hora inapropriada... quem já fez, bebe!',
    '😬 Eu nunca menti pra entrar em algum lugar... quem já fez, bebe!',
    '🤫 Eu nunca contei segredo de ninguém... quem já fez, bebe!',
    '🏃 Eu nunca fugi fingindo receber ligação... quem já fez, bebe!',
    '😴 Eu nunca dormi na aula ou no trabalho... quem já fez, bebe!',
    '🤥 Eu nunca fingi gostar de um presente que odiei... quem já fez, bebe!',
    '📱 Eu nunca passei 5h seguidas no celular... quem já fez, bebe!',
    '🍺 Eu nunca bebi escondido dos meus pais... quem já fez, bebe!',
    '💋 Eu nunca beijei alguém que não devia... quem já fez, bebe!',
    '🚗 Eu nunca corri vermelho de madrugada... quem já fez, bebe!',
    '😏 Eu nunca mandei print pra pessoa errada... quem já fez, bebe!',
    '🔞 Eu nunca apaguei o histórico do celular antes de emprestar... quem já fez, BEBE DOBRADO!',
    '🤡 Eu nunca fingi estar sem sinal pra não responder alguém... quem já fez, bebe!',
    '🍕 Eu nunca comi a comida de outra pessoa da geladeira... quem já fez, bebe!',
    '💦 Eu nunca transei no carro, banheiro público ou lugar aleatório... quem já fez, BEBE TRIPLO!',
    '🔥 Eu nunca enviei nudes pra alguém... quem já fez, bebe DOBRADO!',
    '😈 Eu nunca fiz sexo sem camisinha com alguém (conhecida)... quem já fez, bebe DOBRADO!',
    '🍆 Eu nunca transei em festa, balada ou dentro de um carro em movimento... quem já fez, BEBE TRIPLO!',
    '🍑 Eu nunca traí alguém... quem já fez, bebe DOBRADO!',
    '👅 Eu nunca fiz sexo oral... quem já fez, bebe!',
    '💢 Eu nunca bati uma raiva de alguém tão forte que mandei um "vai se fuder"... quem já fez, bebe!',
    '🥵 Eu nunca peguei alguém em uma situação bem comprometedora... quem já fez, bebe DOBRADO!',
    '😤 Eu nunca xinguei meus pais/chefe mentalmente durante uma conversa... quem já fez, bebe!',
    '🤐 Eu nunca fiz algo tão ruim que temi contar pra mãe... quem já fez, bebe DOBRADO!',
    '🔞 Eu nunca masturbei em lugar público (banheiro, quarto de hóspede)... quem já fez, bebe!',
    '💔 Eu nunca beijei alguém enquanto estava em um relacionamento... quem já fez, bebe TRIPLO!',
    '🍻 Eu nunca fui tão bêbado que não lembrava de nada no dia seguinte... quem já fez, bebe!',
    '😏 Eu nunca tive um "caso" com alguém do trabalho ou família amiga... quem já fez, bebe DOBRADO!',
  ];

  await sock.sendMessage(jid, {
    text: `🎮 *EU NUNCA...*\n\n${perguntas[Math.floor(Math.random() * perguntas.length)]}\n\n_🍺 Beba com responsabilidade... ou não!_`,
  }, { quoted: msg });
}

// ─── !quiz ────────────────────────────────────────────────────────────────────
const perguntasQuiz = [
  { p: '🌍 Qual é a capital da França?', r: 'paris', d: 'Geografia' },
  { p: '🔢 Quanto é 12 x 12?', r: '144', d: 'Matemática' },
  { p: '🎬 Quem dirigiu o "Titanic" (1997)?', r: 'james cameron', d: 'Cinema' },
  { p: '⚽ Quantas copas o Brasil tem?', r: '5', d: 'Esporte' },
  { p: '🧪 Qual o símbolo químico do ouro?', r: 'au', d: 'Química' },
  { p: '📚 Quem escreveu "Dom Quixote"?', r: 'cervantes', d: 'Literatura' },
  { p: '🌊 Qual o maior oceano do mundo?', r: 'pacifico', d: 'Geografia' },
  { p: '🦁 Qual o animal terrestre mais rápido?', r: 'guepardo', d: 'Natureza' },
  { p: '🎵 Quem é o "Rei do Pop"?', r: 'michael jackson', d: 'Música' },
  { p: '🚀 Em que ano o homem foi à Lua?', r: '1969', d: 'História' },
  { p: '🏛️ Onde fica o Coliseu?', r: 'italia', d: 'Geografia' },
  { p: '🔬 Quantos cromossomos tem um humano?', r: '46', d: 'Biologia' },
  { p: '🌡️ A que temperatura a água ferve?', r: '100', d: 'Física' },
  { p: '🎮 Quem criou o Mario?', r: 'nintendo', d: 'Games' },
  { p: '🔭 Como se chama o Planeta Vermelho?', r: 'marte', d: 'Astronomia' },
  { p: '🧩 Quantos lados tem um hexágono?', r: '6', d: 'Matemática' },
  { p: '🥇 Em que ano começaram as Olimpíadas modernas?', r: '1896', d: 'História' },
  { p: '📱 Quem lançou o iPhone?', r: 'apple', d: 'Tecnologia' },
  { p: '🎼 Quem compôs a Quinta Sinfonia?', r: 'beethoven', d: 'Música' },
  { p: '⚛️ Qual o número atômico do oxigênio?', r: '8', d: 'Química' },
  { p: '💡 Quem inventou a lâmpada elétrica?', r: 'thomas edison', d: 'História' },
  { p: '🐛 Como se chama a transformação da lagarta em borboleta?', r: 'metamorfose', d: 'Biologia' },
  { p: '🎨 Quem pintou a Mona Lisa?', r: 'da vinci', d: 'Arte' },
  { p: '🍫 Que país é famoso pelo chocolate suíço?', r: 'suica', d: 'Geografia' },
  { p: '⚡ Qual a unidade de corrente elétrica?', r: 'ampere', d: 'Física' },
  { p: '🐘 Qual o mamífero terrestre mais pesado?', r: 'elefante', d: 'Natureza' },
  { p: '⏰ Quantos minutos há numa hora?', r: '60', d: 'Matemática' },
  { p: '🍎 Quem disse "Penso, logo existo"?', r: 'descartes', d: 'Filosofia' },
  { p: '🌋 Qual a capital da Austrália?', r: 'canberra', d: 'Geografia' },
  { p: '🏈 Quantos jogadores tem um time de basquete?', r: '5', d: 'Esporte' },
  { p: '🐍 Qual a maior cobra do mundo?', r: 'anaconda', d: 'Natureza' },
  { p: '🌐 Qual o país mais populoso do mundo?', r: 'india', d: 'Geografia' },
  { p: '🎭 Quem escreveu "Romeu e Julieta"?', r: 'shakespeare', d: 'Literatura' },
  { p: '🔑 Qual a moeda do Japão?', r: 'iene', d: 'Economia' },
  { p: '🏔️ Qual a montanha mais alta do mundo?', r: 'everest', d: 'Geografia' },
];

async function handleQuiz(sock, msg, jid, author, senderJid) {
  if (quizState.has(senderJid)) {
    const state = quizState.get(senderJid);
    const resposta = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const correta = state.r.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    clearTimeout(state.timeout);
    quizState.delete(senderJid);

    if (resposta.includes(correta) || correta.includes(resposta)) {
      const pts = (pontosMap.get(senderJid) || 0) + 10;
      pontosMap.set(senderJid, pts);
      await sock.sendMessage(jid, {
        text: `✅ *CORRETO!* Parabéns, *${author}*! Não é tão burro(a) quanto parece! 🎉\n\n💰 *+10 pontos!* Total: *${pts} pts*`,
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text: `❌ *ERROU FEIO!* *${author}*!\n\nA resposta era: *${state.r}* 😬\n_Vai estudar, seu ignorante!_`,
      }, { quoted: msg });
    }
    return;
  }

  const q = perguntasQuiz[Math.floor(Math.random() * perguntasQuiz.length)];
  const timeout = setTimeout(() => {
    quizState.delete(senderJid);
    sock.sendMessage(jid, {
      text: `⏰ Tempo esgotado, *${author}*! Que lento(a)!\n\nResposta: *${q.r}* 😬\n_Burro(a)!_`,
    });
  }, 30000);

  quizState.set(senderJid, { r: q.r, timeout });
  await sock.sendMessage(jid, {
    text: `🧠 *QUIZ — ${q.d}*\n\n❓ *${q.p}*\n\n_Você tem 30 segundos! Não faz feio!_`,
  }, { quoted: msg });
}

// ─── !pontos ──────────────────────────────────────────────────────────────────
async function handlePontos(sock, msg, jid, author, senderJid) {
  const pts = pontosMap.get(senderJid) || 0;
  const comentario = pts === 0 ? 'Que inútil, nem um ponto ainda!' :
    pts < 20 ? 'Tá fraco(a)! Joga mais!' :
    pts < 50 ? 'Razoável, mas pode melhorar!' :
    pts < 100 ? 'Bom desempenho! Continua!' : 'MONSTRO! Que pontuação!';
  await sock.sendMessage(jid, {
    text: `🏅 *${author}*, você tem *${pts} pontos* no quiz!\n\n_${comentario}_`,
  }, { quoted: msg });
}

// ─── !rankjogos ───────────────────────────────────────────────────────────────
async function handleRankJogos(sock, msg, jid, contactNames) {
  if (pontosMap.size === 0) {
    await sock.sendMessage(jid, { text: '📭 Nenhum ponto registrado ainda! Jogam *!quiz* primeiro, seus preguiçosos!' }, { quoted: msg });
    return;
  }

  const sorted = [...pontosMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let texto = `🏆 *RANKING DE JOGOS* 🏆\n\n`;
  sorted.forEach(([jidU, pts], i) => {
    const nome = contactNames[jidU] || jidU.split('@')[0];
    texto += `${medals[i]} *${nome}* — ${pts} pts\n`;
  });
  texto += `\n_Joga *!quiz* pra subir no ranking, seus frangos!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !anagrama ────────────────────────────────────────────────────────────────
const palavrasAnagrama = [
  'brasil', 'futebol', 'musica', 'cinema', 'cachorro', 'gato', 'computador',
  'telefone', 'chocolate', 'pizza', 'hamburger', 'sorvete', 'viagem',
  'escola', 'trabalho', 'familia', 'amizade', 'coragem', 'felicidade',
  'borboleta', 'biblioteca', 'aventura', 'natureza', 'universo', 'planeta',
];

function embaralhar(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const res = arr.join('');
  return res === str ? embaralhar(str) : res;
}

async function handleAnagrama(sock, msg, jid, author, senderJid) {
  if (anagramaState.has(senderJid)) {
    const state = anagramaState.get(senderJid);
    const resposta = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();

    if (resposta === state.palavra) {
      clearTimeout(state.timeout);
      anagramaState.delete(senderJid);
      const pts = (pontosMap.get(senderJid) || 0) + 5;
      pontosMap.set(senderJid, pts);
      await sock.sendMessage(jid, {
        text: `✅ *ACERTOU!* Parabéns, *${author}*! A palavra era *${state.palavra}*! 🎉\n\n💰 *+5 pontos!* Total: *${pts} pts*\n\n_Afinal não é tão burro(a)!_ 😂`,
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: `❌ Errou! Continua tentando ou espera o tempo acabar, seu lerdo(a)!` }, { quoted: msg });
    }
    return;
  }

  const palavra = palavrasAnagrama[Math.floor(Math.random() * palavrasAnagrama.length)];
  const embaralhada = embaralhar(palavra);

  const timeout = setTimeout(() => {
    anagramaState.delete(senderJid);
    sock.sendMessage(jid, { text: `⏰ Tempo esgotado, *${author}*! Que lerdo(a)!\n\nPalavra era: *${palavra}* 😬\n_Vai treinar!_` });
  }, 45000);

  anagramaState.set(senderJid, { palavra, timeout });
  await sock.sendMessage(jid, {
    text: `🔤 *ANAGRAMA*\n\n*${author}*, descubra a palavra embaralhada!\n\n🔀 *${embaralhada.toUpperCase()}*\n\n_45 segundos! Não faz feio, seu lerdo(a)!_`,
  }, { quoted: msg });
}

// ─── !ppt ─────────────────────────────────────────────────────────────────────
async function handlePpt(sock, msg, jid, caption, author, senderJid) {
  const escolha = caption.replace(/^[!.,\/]ppt\s*/i, '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const validas = ['pedra', 'papel', 'tesoura'];
  if (!validas.includes(escolha)) {
    await sock.sendMessage(jid, {
      text: `⚠️ Escolha inválida, otário!\nUse: *!ppt pedra*, *!ppt papel* ou *!ppt tesoura*`,
    }, { quoted: msg });
    return;
  }

  const opcoes = ['pedra', 'papel', 'tesoura'];
  const bot = opcoes[Math.floor(Math.random() * 3)];
  const emojis = { pedra: '🪨', papel: '📄', tesoura: '✂️' };

  let resultado;
  if (escolha === bot) {
    resultado = '🤝 *EMPATE!* Que jogo lixo!';
  } else if (
    (escolha === 'pedra' && bot === 'tesoura') ||
    (escolha === 'papel' && bot === 'pedra') ||
    (escolha === 'tesoura' && bot === 'papel')
  ) {
    const pts = (pontosMap.get(senderJid) || 0) + 3;
    pontosMap.set(senderJid, pts);
    resultado = `🏆 *${author} GANHOU!* Conseguiu vencer um bot... que orgulho! (+3 pts)`;
  } else {
    resultado = `🤖 *BOT GANHOU!* Perdeu pro bot, que patético(a)! 😂`;
  }

  await sock.sendMessage(jid, {
    text: `✊ *PEDRA, PAPEL OU TESOURA!*\n\n👤 *${author}:* ${emojis[escolha]} ${escolha}\n🤖 *Bot:* ${emojis[bot]} ${bot}\n\n${resultado}`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── NOVAS BRINCADEIRAS ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ─── !verdadeoudesafio ────────────────────────────────────────
async function handleVerdadeOuDesafio(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const verdades = [
    `🔴 Verdade: *${nome}*, qual é a coisa mais vergonhosa que você já fez em público? 😳`,
    `🔴 Verdade: *${nome}*, você já stalkeou o ex(a) nas redes sociais? Por quanto tempo? 👀`,
    `🔴 Verdade: *${nome}*, qual é a mentira mais gorda que você já contou? 🤥`,
    `🔴 Verdade: *${nome}*, você já mandou nudes pra alguém? 📸😳`,
    `🔴 Verdade: *${nome}*, quem aqui você nunca suportou mas finge que gosta? 😅`,
    `🔴 Verdade: *${nome}*, qual é a coisa mais podre que você já fez por dinheiro? 💰`,
    `🔴 Verdade: *${nome}*, você já fingiu orgasmo? 😳`,
    `🔴 Verdade: *${nome}*, qual foi a última vez que você mentiu pra um amigo próximo? 🤫`,
    `🔴 Verdade: *${nome}*, você já traiu? Pode falar! 👀`,
    `🔴 Verdade: *${nome}*, qual é a fantasia mais estranha que você já teve? 😏`,
    `🔴 Verdade: *${nome}*, você já se masturbou pensando em alguém aqui do grupo? 🔥`,
    `🔴 Verdade: *${nome}*, qual o pior nome que já chamaram você na cama? 😈`,
    `🔴 Verdade: *${nome}*, qual foi a posição mais maluca que você já fez? 🔞`,
    `🔴 Verdade: *${nome}*, você já transou com alguém aqui do grupo ou quer? 👀`,
    `🔴 Verdade: *${nome}*, qual é sua maior fetiche sexual? 🔥😏`,
    `🔴 Verdade: *${nome}*, você faz coisa MUITO errada quando bebe ou fuma? 💨🍺`,
    `🔴 Verdade: *${nome}*, qual foi o maior chifre que você deu ou levou? 💔`,
    `🔴 Verdade: *${nome}*, você já pagou por sexo ou conhece alguém que pagou? 💸`,
    `🔴 Verdade: *${nome}*, qual é a coisa mais nojenta que você já fez na intimidade? 🤢`,
    `🔴 Verdade: *${nome}*, você abusaria de alguém aqui se soubesse que ninguém ficaria sabendo? 😈👀`,
    `🔴 Verdade: *${nome}*, qual a pessoa aqui que você mais teria interesse sexual? 🔞`,
    `🔴 Verdade: *${nome}*, você já foi apanhado(a) se masturbando ou fazendo sexo? 😳💀`,
  ];

  const desafios = [
    `🟢 Desafio: *${nome}*, manda um áudio cantando a música que tá tocando agora! 🎵`,
    `🟢 Desafio: *${nome}*, manda foto da sua cara de acordar agora! 🤳`,
    `🟢 Desafio: *${nome}*, escreve uma mensagem comprometedora pro contato 3 da sua agenda! 📱`,
    `🟢 Desafio: *${nome}*, manda mensagem pro seu crush agora! Pode ser qualquer mensagem! 💕`,
    `🟢 Desafio: *${nome}*, manda uma foto da geladeira de casa agora! 🍕`,
    `🟢 Desafio: *${nome}*, faz um post constrangedor na maior rede social que tu usa! 📲`,
    `🟢 Desafio: *${nome}*, manda áudio gritando "EU TE AMO" pro primeiro contato da agenda! 📞`,
    `🟢 Desafio: *${nome}*, manda mensagem pro contato mais antigo da conversa! 💬`,
    `🟢 Desafio: *${nome}*, faz uma dança constrangedora e manda o vídeo aqui! 💃`,
    `🟢 Desafio: *${nome}*, chama o contato aleatório da agenda e fala que tá com saudade! 😂`,
    `🟢 Desafio: *${nome}*, tira uma foto sua com roupa mínima (só sunga/calcinha) e manda! 🔞`,
    `🟢 Desafio: *${nome}*, manda um áudio sexy/sensual pra alguém da agenda AGORA! 🔥`,
    `🟢 Desafio: *${nome}*, confessa seu maior segredo sexual pro grupo! 😈`,
    `🟢 Desafio: *${nome}*, manda foto ou vídeo beijando o espelho ou a câmera! 💋`,
    `🟢 Desafio: *${nome}*, posta uma selfie sensual na sua história do WhatsApp! 🔥`,
    `🟢 Desafio: *${nome}*, faz 20 flexões ou agachamentos SEM ROUPA e prova com vídeo! 💪🔞`,
    `🟢 Desafio: *${nome}*, chama a pessoa que mais curte daqui e fala que quer conhecer melhor (com intenção)! 👀`,
    `🟢 Desafio: *${nome}*, manda mensagem pro seu maior crush admitindo interesse AGORA! 💘`,
    `🟢 Desafio: *${nome}*, fala um palavrão bem gritado num áudio! 💀`,
    `🟢 Desafio: *${nome}*, se beija no espelho e manda vídeo! 😏💋`,
  ];

  const all = [...verdades, ...desafios];
  const escolhido = all[Math.floor(Math.random() * all.length)];

  await sock.sendMessage(jid, {
    text: `🎲 *VERDADE OU DESAFIO*\n\n${escolhido}\n\n_Recusou? Toma um drinque!_ 🍺`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !confissao ───────────────────────────────────────────────
async function handleConfissao(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const confissoes = [
    `😳 *${nome}* confessa: já dormiu no banheiro pra fugir de visita chata! 💀`,
    `🤫 *${nome}* confessa: já comeu a comida da geladeira alheia e fingiu que não foi! 🍕`,
    `😂 *${nome}* confessa: já fingiu não ver mensagem por 3 dias e disse que estava sem internet! 📱`,
    `💀 *${nome}* confessa: já dançou sozinho(a) no quarto achando que era profissional! 💃`,
    `😬 *${nome}* confessa: já mandou screenshot pra própria pessoa que tava sendo criticada! 💥`,
    `🤣 *${nome}* confessa: já saiu com roupa ao contrário na rua e só percebeu horas depois! 👕`,
    `😏 *${nome}* confessa: já comprou item caro e escondeu dos pais/parceiro! 💸`,
    `🥴 *${nome}* confessa: já ligou pro ex(a) bêbado(a) e não lembrou de nada no dia seguinte! 📞`,
    `😭 *${nome}* confessa: já chorou assistindo comercial de ração pra cachorro! 🐕`,
    `🤡 *${nome}* confessa: já curtiu foto antiga do ex(a) acidentalmente e entrou em pânico! ❤️💀`,
    `😳 *${nome}* confessa: já respondeu "você também" quando o garçom disse "bom apetite"! 😂`,
    `💀 *${nome}* confessa: já inventou que estava doente pra faltar no trabalho/escola e foi pego(a)! 🤒`,
    `🔥 *${nome}* confessa: já se masturbou na casa de um(a) amigo(a)! 🙈`,
    `😈 *${nome}* confessa: já transou com alguém aqui enquanto estava em outro relacionamento! 💔`,
    `🍆 *${nome}* confessa: já conversou sexy com alguém da família amiga! 🔞`,
    `🥵 *${nome}* confessa: já foi apanhado(a) fazendo sexo e quase foi descoberto(a)! 💀`,
    `🤐 *${nome}* confessa: já viu a privada de alguém e fez coisa indevida lá! 🚽😂`,
    `😳 *${nome}* confessa: já traiu alguém com o melhor amigo(a) do casal! 👀💔`,
    `🍺 *${nome}* confessa: já foi tão bêbado(a) que fez coisas MUITO erradas e mal lembra! 🥴`,
    `💢 *${nome}* confessa: já falou coisa MUITO pesada no tédio/raiva de alguém aqui! 💀`,
    `🔞 *${nome}* confessa: já viu conteúdo pornô bem pesado (MUITO pesado mesmo)! 📱🙈`,
    `😈 *${nome}* confessa: já pediu foto intima de alguém e guardou escondido! 📸`,
    `👀 *${nome}* confessa: já fantasiou sexualmente com alguém aqui e isso deixa constrangido(a)! 😳`,
  ];

  await sock.sendMessage(jid, {
    text: `🗣️ *CONFISSÃO ALEATÓRIA*\n\n${confissoes[Math.floor(Math.random() * confissoes.length)]}\n\n_Mentira? Talvez... ou não!_ 😏`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !julgamento ──────────────────────────────────────────────
async function handleJulgamento(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const julgamentos = [
    `⚖️ *${nome}* foi julgado(a) e condenado(a) por: ser chato(a) demais no grupo! Pena: 7 dias sem resposta! 💀`,
    `⚖️ *${nome}* foi julgado(a) e absolvido(a) por: ser o(a) mais gostoso(a) do grupo! Resultado: todos apaixonados! 😍`,
    `⚖️ *${nome}* foi julgado(a) por: aparecer só quando tem comida. Condenado(a) a pagar o próximo churrasco! 🍖`,
    `⚖️ *${nome}* foi julgado(a) por: visualizar e não responder por 3 dias! Pena: banimento temporário! 📵`,
    `⚖️ *${nome}* foi julgado(a) por: ser a fofoca ambulante do grupo! Absolvido(a) por ser muito engraçado(a)! 😂`,
    `⚖️ *${nome}* foi julgado(a) por: manda áudio de 5 minutos que cabia em 10 segundos! Condenado(a)! 🎙️💀`,
    `⚖️ *${nome}* foi julgado(a) por: sumir do grupo e aparecer só pra pedir favor! Culpado(a)! 🖕`,
    `⚖️ *${nome}* foi julgado(a) por: sempre discordar de tudo sem ter argumento! Pena: ficar quieto(a)! 🤐`,
    `⚖️ *${nome}* foi julgado(a) por: nunca pagar a conta! Condenado(a) a pagar as próximas 5! 💸`,
    `⚖️ *${nome}* foi julgado(a) por: ser a melhor pessoa do grupo! Absolvido(a) com louvor! 🏆`,
    `⚖️ *${nome}* foi julgado(a) por: ser o/a mais safado(a) do grupo! Absolvido(a) porque todos invejam! 🔥`,
    `⚖️ *${nome}* foi julgado(a) por: contar histórias safadas e deixar todos com tesão! Condenado(a) a contar mais! 😈`,
    `⚖️ *${nome}* foi julgado(a) por: beijar na boca todo mundo do grupo! Absolvido(a) por criatividade! 💋`,
    `⚖️ *${nome}* foi julgado(a) por: tentar pegar múltiplos parceiros ao mesmo tempo! Mereceu promoção! 🤡`,
    `⚖️ *${nome}* foi julgado(a) por: mandar mensagens picantes sem avisar! Condenado(a) a pagar drinks! 🍺`,
  ];

  await sock.sendMessage(jid, {
    text: `⚖️ *TRIBUNAL DO GRUPO*\n\n${julgamentos[Math.floor(Math.random() * julgamentos.length)]}`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !podre ───────────────────────────────────────────────────
async function handlePodre(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '😇'; frase = 'Praticamente um anjinho! Mas o lado sombrio tá chegando... 👀'; }
  else if (pct <= 20) { emoji = '😏'; frase = 'Só um pouquinho podre! Mas o pessoal já desconfia! Bravos!'; }
  else if (pct <= 35) { emoji = '🍑'; frase = 'Na metade! Uma boa mentirinha aqui, uma safadeza ali... Tá começando!'; }
  else if (pct <= 50) { emoji = '🔥'; frase = 'Bastante podre! Esse(a) faz coisa errada MUITO na cama! 😈'; }
  else if (pct <= 65) { emoji = '💩'; frase = 'PODRE DEMAIS! Histórico de traições, sexo casual e mentiras! Bravo(a)! 😂'; }
  else if (pct <= 79) { emoji = '🔞'; frase = 'MUITO podre! O histórico desse celular não pode ser visto! Tem coisa MUITO pesada ali! 📱💀'; }
  else if (pct <= 92) { emoji = '☠️'; frase = 'Podridão total! Já ficou com gente daqui, tá mentindo pra parceiro(a)! O pastor chora! 😂'; }
  else if (pct <= 99) { emoji = '😈'; frase = '99% PODRE! Transou com múltiplos(as), fez COISA PESADA, tá devendo a todo mundo! 🔥💀'; }
  else                { emoji = '👿'; frase = '100%! SATANÁS EM PESSOA! Tá aqui no grupo fingindo pureza mas faz TUDO! Entregou a alma pro capeta MESMO! 🔥😈'; }

  const filled = Math.round(pct / 10);
  const barra = '🟫'.repeat(filled) + '⬜'.repeat(10 - filled);

  await sock.sendMessage(jid, {
    text: `${emoji} *PODRÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n_Ninguém é inocente nesse grupo!_ 😂`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !frango ──────────────────────────────────────────────────
async function handleFrango(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 20)      { emoji = '🦁'; frase = 'LEÃO! Corajoso(a), não teme nada nem ninguém!'; }
  else if (pct <= 40) { emoji = '😤'; frase = 'Só um pouco cagão(ã). Fica de boa!'; }
  else if (pct <= 60) { emoji = '😰'; frase = 'Já se acovardom bastante na vida!'; }
  else if (pct <= 80) { emoji = '🐔'; frase = 'FRANGO! Corre de sombra! Cuidado com o vento!'; }
  else if (pct <= 99) { emoji = '🍗'; frase = 'SUPER FRANGO! Assado, temperado e covarde! 💀'; }
  else                { emoji = '🐣'; frase = '100% PINTINHO! Saiu do ovo ontem e já tá se mijando! KKKK'; }

  const filled = Math.round(pct / 10);
  const barra = '🟡'.repeat(filled) + '⬜'.repeat(10 - filled);

  await sock.sendMessage(jid, {
    text: `${emoji} *FRANGÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_\n\n_Cacarejou!_ 🐔`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !maldizer ────────────────────────────────────────────────
async function handleMaldizer(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const maldições = [
    `🧿 Que *${nome}* tropece no dedinho toda noite por 30 dias! 🦶💀`,
    `💀 Que *${nome}* esqueça o carregador em casa todo dia da próxima semana!`,
    `🪲 Que o shampoo de *${nome}* acabe sempre quando o cabelo tiver cheio de espuma!`,
    `😭 Que *${nome}* pise em Lego descalço(a) às 3h da manhã por 7 dias seguidos! 🧱`,
    `🤮 Que a bateria do celular de *${nome}* always morra na hora mais importante!`,
    `💸 Que *${nome}* só encontre furos no bolso quando mais precisar de dinheiro!`,
    `🐜 Que toda vez que *${nome}* for tomar banho já não tenha água quente! 🥶`,
    `😤 Que *${nome}* sempre pegue a fila mais lenta do mercado e do banco!`,
    `🦶 Que *${nome}* sempre enrosque o dedo do pé na perna da cadeira! 😖`,
    `🌧️ Que *${nome}* sempre esqueça o guarda-chuva nos dias de chuva!`,
    `🤡 Que todo link que *${nome}* clicar abra propaganda!`,
    `💩 Que o WiFi de *${nome}* caia sempre na melhor parte do filme!`,
    `🔥 Que *${nome}* perda a voz SEMPRE na hora de se declarar pro crush! Imagina a constrangimento!`,
    `🔞 Que *${nome}* tenha que fazer xixi com a porta aberta SEMPRE que tiver gente em casa! 😂`,
    `💀 Que o preservativo de *${nome}* SEMPRE fure na hora mais importante! Boa sorte! 😈`,
    `😳 Que *${nome}* sempre envie mensagem no grupo errado! Especialmente as PICANTES! 📱🔥`,
    `🍆 Que *${nome}* fique de tesão SEMPRE em hora inapropriada (trabalho, escola, família)! 🥵`,
    `👀 Que todo mundo descubra o maior tabu sexual de *${nome}*! Que constrangimento! 😂`,
    `💔 Que *${nome}* sempre lembre de ex(a) na hora mais inapropriada (com novo(a) parceiro(a))! Boa sorte! 💀`,
    `😈 Que *${nome}* tenha que fazer xixi com urgência SEMPRE no meio de uma situação constrangedora! 🚽`,
    `📸 Que alguém envie foto de *${nome}* dormindo e posta em algum lugar! Que humilhação! 😂`,
    `🔥 Que *${nome}* sempre seja visto(a) com roupa chamativa por alguém que quer! Constrangedor! 😳`,
  ];

  await sock.sendMessage(jid, {
    text: `🧿 *MALDIÇÃO ENVIADA!*\n\n${maldições[Math.floor(Math.random() * maldições.length)]}\n\n_Kkkk foi mal! 😈_`,
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !fortuna ─────────────────────────────────────────────────
async function handleFortuna(sock, msg, content, jid, author) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentions[0] || senderJid;
  const nome = mentions[0] ? `@${alvoJid.split('@')[0]}` : author;

  const fortunas = [
    `🥠 *${nome}*, seu biscoito diz: "Você vai ganhar dinheiro... emprestado e nunca vai receber de volta!" 💸😂`,
    `🥠 *${nome}*, seu biscoito diz: "O amor da sua vida tá próximo... no celular dele(a) com o(a) ex!" 💔💀`,
    `🥠 *${nome}*, seu biscoito diz: "Dias melhores virão... mas primeiro piora bastante!" 😅`,
    `🥠 *${nome}*, seu biscoito diz: "Você tem um dom especial: irritar as pessoas sem querer!" 🤡`,
    `🥠 *${nome}*, seu biscoito diz: "Sua sorte vai mudar... de boa pra péssima!" 😂`,
    `🥠 *${nome}*, seu biscoito diz: "Alguém te ama em segredo... tá com vergonha por um bom motivo!" 😏`,
    `🥠 *${nome}*, seu biscoito diz: "Viagem inesperada a caminho... pro pronto-socorro!" 🚑`,
    `🥠 *${nome}*, seu biscoito diz: "Uma nova oportunidade aparecerá... você vai perder de bobeira!" 🤦`,
    `🥠 *${nome}*, seu biscoito diz: "Sucesso é seu destino... mas o GPS tá travado!" 🗺️`,
    `🥠 *${nome}*, seu biscoito diz: "Cuidado com falsas amizades... algumas estão nesse grupo agora!" 👀`,
    `🥠 *${nome}*, seu biscoito diz: "Grande conquista vem aí... mas vai custar caro demais!" 💸`,
    `🔥 *${nome}*, seu biscoito diz: "Seu sexo hoje será... INEXISTENTE! Boa sorte!" 🤐`,
    `💀 *${nome}*, seu biscoito diz: "Você vai ser apanhado(a) fazendo coisa MUITO errada em breve!" 😈`,
    `😳 *${nome}*, seu biscoito diz: "Seu maior segredo será descoberto... e é bem constrangedor!" 🤫`,
    `🍆 *${nome}*, seu biscoito diz: "O sexo que você vai ter... será MUITO ESTRANHO!" 🔞`,
    `🤐 *${nome}*, seu biscoito diz: "Uma pessoa aqui quer você... e é alguém que você NUNCA esperaria!" 👀`,
    `💔 *${nome}*, seu biscoito diz: "Você vai ser traído(a)... e o(a) traidor(a) é alguém perto!" 😈`,
  ];

  await sock.sendMessage(jid, {
    text: fortunas[Math.floor(Math.random() * fortunas.length)],
    mentions: mentions[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !compatibilidade ─────────────────────────────────────────
async function handleCompatibilidade(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentions = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (mentions.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém pra testar a compatibilidade!\nExemplo: *!compatibilidade @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentions[0];
  const nomeParceiro = contactNames[alvoJid] || alvoJid.split('@')[0];
  const seed = (senderJid + alvoJid).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const amor     = seed % 101;
  const amizade  = (seed * 3 + 7) % 101;
  const trabalho = (seed * 7 + 13) % 101;
  const briga    = (seed * 11 + 5) % 101;
  const sexo     = (seed * 13 + 11) % 101;
  const traicao  = (seed * 17 + 19) % 101;

  const getBar = (pct) => '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  let conclusao;
  if (amor > 70 && briga < 40 && sexo > 60) {
    conclusao = `🏆 Casal MUITO PICANTE! Já marca a festa com roupa de menos, filhos da puta!`;
  } else if (amor > 70 && briga < 40) {
    conclusao = `🏆 Casal perfeito! Já marca a festa, filhos da puta!`;
  } else if (amor > 50 && sexo > 50) {
    conclusao = `💛 Pode dar certo! E o sexo vai ser MUITO BOM!`;
  } else if (amor > 50) {
    conclusao = `💛 Pode dar certo com paciência. Muito paciência!`;
  } else if (briga > 70) {
    conclusao = `💢 Esses dois se matam em 1 semana! Literalmente! ⚔️`;
  } else if (traicao > 75) {
    conclusao = `💔 Um vai trair o outro MUITO rapidinho! Já começa errado!`;
  } else {
    conclusao = `😐 Meh. Nem como amigos funciona direito!`;
  }

  await sock.sendMessage(jid, {
    text: `💑 *COMPATIBILIDADE: ${author} + @${alvoJid.split('@')[0]}*\n\n` +
      `❤️ Amor:     ${getBar(amor)} ${amor}%\n` +
      `🤝 Amizade:  ${getBar(amizade)} ${amizade}%\n` +
      `💼 Trabalho: ${getBar(trabalho)} ${trabalho}%\n` +
      `🥊 Briga:    ${getBar(briga)} ${briga}%\n` +
      `🍆 Sexo:     ${getBar(sexo)} ${sexo}%\n` +
      `💔 Traição:  ${getBar(traicao)} ${traicao}%\n\n` +
      `_${conclusao}_`,
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !brincadeiras ────────────────────────────────────────────
async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `🎭 *BRINCADEIRAS DISPONÍVEIS*\n\n` +
    `🌈 *${P}gay [@]* — Gayômetro\n` +
    `💋 *${P}sexo @* — Cena aleatória\n` +
    `🦅 *${P}nazista [@]* — Nazômetro\n` +
    `👩‍❤️‍👩 *${P}lesbica [@]* — Lesbômetro\n` +
    `✨ *${P}aura [@]* — Aura\n` +
    `💩 *${P}podre [@]* — Podrômetro\n` +
    `🐔 *${P}frango [@]* — Frangômetro\n` +
    `🎲 *${P}dado* — Rola um dado\n` +
    `🪙 *${P}moeda* — Cara ou coroa\n` +
    `🎱 *${P}8ball <pergunta>* — Bola mágica\n` +
    `❤️ *${P}ship @a @b* — Ship\n` +
    `💑 *${P}compatibilidade @* — Compatibilidade detalhada\n` +
    `💘 *${P}crush @* — Crushômetro\n` +
    `🎯 *${P}tiro @* — Atirar em alguém\n` +
    `💀 *${P}morte [@]* — Morte aleatória\n` +
    `🗡️ *${P}maldizer [@]* — Mandar maldição\n` +
    `🥠 *${P}fortuna [@]* — Biscoito da fortuna\n` +
    `⚖️ *${P}julgamento [@]* — Tribunal do grupo\n` +
    `🗣️ *${P}confissao [@]* — Confissão aleatória\n` +
    `🎲 *${P}verdadeoudesafio [@]* — Verdade ou desafio\n` +
    `🔫 *${P}roletarussa* — Roleta russa clássica\n` +
    `💥 *${P}roletarussa2* — Modo difícil (3 balas)\n` +
    `❓ *${P}roletarussa3* — Roleta de perguntas\n` +
    `🍺 *${P}eununca* — Eu Nunca\n` +
    `🧠 *${P}quiz* — Quiz com pontuação\n` +
    `🔤 *${P}anagrama* — Descubra a palavra\n` +
    `✊ *${P}ppt pedra/papel/tesoura* — Clássico\n` +
    `⚽ *${P}falta [@]* — Marca falta\n` +
    `🥅 *${P}baterfalta* — Cobra a falta\n` +
    `🏅 *${P}pontos* — Seus pontos\n` +
    `🏆 *${P}rankjogos* — Ranking`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── EXPORTS ──────────────────────────────────────────────────
module.exports = {
  handleGay,
  handleSexo,
  handleNazista,
  handleLesbica,
  handleAura,
  handleDado,
  handleMoeda,
  handle8ball,
  handleShip,
  handleRolar,
  handleXingar,
  handleElogio,
  handleCrush,
  handleCantada,
  handleSafadeza,
  handleTiro,
  handleMorte,
  handleRoletaRussa,
  handleRoletaRussa2,
  handleRoletaRussa3,
  handleFalta,
  handleBaterFalta,
  handleEuNunca,
  handleQuiz,
  handlePontos,
  handleRankJogos,
  handleAnagrama,
  handlePpt,
  handleBrincadeiras,
  // Novas funções
  handleVerdadeOuDesafio,
  handleConfissao,
  handleJulgamento,
  handlePodre,
  handleFrango,
  handleMaldizer,
  handleFortuna,
  handleCompatibilidade,
  // State exportado pro router
  quizState,
};
