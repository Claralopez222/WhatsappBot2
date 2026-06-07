/**
 * Handler de Brincadeiras — Piroquinhas Bot
 * Funções divertidas: Gay, Sexo, Nazista, Lesbica, Aura, Dado, Moeda, 8Ball, etc.
 */

// ─── Helper: resolve alvo e nome display
function getAlvo(contextInfo, senderJid, contactNames) {
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const alvoJid = mentionedJid || senderJid;
  const numero = alvoJid.split('@')[0];
  const nome = contactNames?.[alvoJid] || `@${numero}`;
  return { alvoJid, mentionedJid, nome };
}

// ─── Helper: barra de progresso
function buildBar(pct, emoji = '🟩') {
  const filled = Math.round(pct / 10);
  return emoji.repeat(filled) + '⬜'.repeat(10 - filled);
}

// ─── !gay
async function handleGay(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '🧢';      frase = 'Praticamente hétero, mas nunca se sabe... 👀'; }
  else if (pct <= 30) { emoji = '🌈';      frase = 'Um pouco curioso(a) né? Tô de olho em você 😏'; }
  else if (pct <= 50) { emoji = '🏳️‍🌈'; frase = 'Na metade! Admite logo, porra! 😂'; }
  else if (pct <= 70) { emoji = '💅';      frase = 'Saindo do armário aos poucos! A porta tá aberta, vai lá! 🚪'; }
  else if (pct <= 89) { emoji = '👨‍❤️‍👨'; frase = 'Quase assumido(a)! Falta pouco, caralho! 🏳️‍🌈'; }
  else if (pct <= 99) { emoji = '🌈✨';    frase = 'Praticamente confirmado(a)! Larga essa farsa! 🎉'; }
  else                { emoji = '🏆🌈';    frase = '100% GAY! Parabéns campeão(ã)! Orgulhe-se! 🎊'; }

  const barra = buildBar(pct);
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *GAYÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !sexo
async function handleSexo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca alguém!\nExemplo: *!sexo @fulano*',
    }, { quoted: msg });
    return;
  }

  if (mentionedJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, {
      text: '😂 Sozinho(a) não conta! 💀',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const pct = Math.floor(Math.random() * 101);

  let comentario;
  if (pct < 30)      comentario = `*${author}* tentou chegar em *${nomeAlvo}* e levou um fora memorável! 😭`;
  else if (pct < 70) comentario = `*${author}* e *${nomeAlvo}* tiveram um momento, mas nada de mais! 😏`;
  else               comentario = `*${author}* e *${nomeAlvo}* fizeram bastante barulho essa noite... que escândalo! 🔥`;

  await sock.sendMessage(jid, {
    text: `💋 *CIFRA DE ATRAÇÃO: ${pct}%*\n\n${comentario}`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !nazista
async function handleNazista(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '🕊️'; frase = 'Pacifista! Nem mata mosquito!'; }
  else if (pct <= 30) { emoji = '📰'; frase = 'Só fica reclamando das coisas nas redes sociais.'; }
  else if (pct <= 50) { emoji = '⚖️'; frase = 'Equilibrado(a), mas com ideias bem fortes.'; }
  else if (pct <= 70) { emoji = '😤'; frase = 'Autoritário(a) pra caramba! Cuidado com esse(a)!'; }
  else if (pct <= 89) { emoji = '⚔️'; frase = 'Caralho! Muito radical! Quase um ditador(a)!'; }
  else if (pct <= 99) { emoji = '🦅'; frase = 'Praticamente um(a) ditador(a)! Faltou pouco!'; }
  else                { emoji = '💀'; frase = '100%! Ditador(a) confirmado(a)! Se cuida!'; }

  const barra = buildBar(pct, '🟥');
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *NAZÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}
// ─── !lesbica
async function handleLesbica(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '👩';      frase = 'Hétero assumida! Nem cogita! 💁‍♀️'; }
  else if (pct <= 30) { emoji = '🌸';      frase = 'Um olhar aqui, outro ali... curiosidade né? 👀'; }
  else if (pct <= 50) { emoji = '🌈';      frase = 'Na metade do caminho! Admite logo! 😏'; }
  else if (pct <= 70) { emoji = '💅';      frase = 'Bastante assumida! A vibe não mente! 💋'; }
  else if (pct <= 89) { emoji = '👭';      frase = 'Quase 100%! Falta só confirmar oficialmente! 🏳️‍🌈'; }
  else if (pct <= 99) { emoji = '🌈✨';    frase = 'Praticamente confirmada! Para de enrolar! 🎉'; }
  else                { emoji = '🏆👭';    frase = '100%! Rainha absoluta! Orgulhe-se! 🎊'; }

  const barra = buildBar(pct);
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *LESBÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !aura
async function handleAura(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase, barEmoji;
  if (pct <= 10)      { emoji = '💀'; frase = 'Aura MORTA! Nem Deus salva! 👹';     barEmoji = '🟥'; }
  else if (pct <= 30) { emoji = '😈'; frase = 'Aura podre! Cheira mal daqui! 🤢';   barEmoji = '🟧'; }
  else if (pct <= 50) { emoji = '😐'; frase = 'Aura neutra. Nem frio nem quente.';  barEmoji = '🟨'; }
  else if (pct <= 70) { emoji = '🌿'; frase = 'Aura ok! Mas pode melhorar! 💪';     barEmoji = '🟩'; }
  else if (pct <= 89) { emoji = '✨'; frase = 'Aura brilhante! Que energia boa! ☀️'; barEmoji = '🟩'; }
  else if (pct <= 99) { emoji = '🌟'; frase = 'Aura ÉPICA! Ilumina qualquer sala! 🙌'; barEmoji = '🟦'; }
  else                { emoji = '👼'; frase = 'AURA MÁXIMA! Santo(a) confirmado(a)! 🙏'; barEmoji = '🟦'; }

  const barra = buildBar(pct, barEmoji);
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *AURA DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !dado
async function handleDado(sock, msg, jid, caption) {
  const lados = parseInt(caption?.trim()) || 6;
  if (lados < 2 || lados > 100) {
    await sock.sendMessage(jid, { text: '⚠️ Número de lados inválido! Use entre 2 e 100.\nExemplo: *!dado 20*' }, { quoted: msg });
    return;
  }
  const resultado = Math.floor(Math.random() * lados) + 1;
  const label = lados !== 6 ? ` (D${lados})` : '';
  await sock.sendMessage(jid, { text: `🎲 Você rolou${label}: *${resultado}*` }, { quoted: msg });
}

// ─── !moeda
async function handleMoeda(sock, msg, jid) {
  const resultado = Math.random() < 0.5 ? '🟡 Cara' : '⚪ Coroa';
  await sock.sendMessage(jid, { text: `🪙 Resultado: *${resultado}*` }, { quoted: msg });
}

// ─── !8ball
async function handle8ball(sock, msg, jid, caption) {
  if (!caption?.trim()) {
    await sock.sendMessage(jid, { text: '⚠️ Faz uma pergunta!\nExemplo: *!8ball Vou passar na prova?*' }, { quoted: msg });
    return;
  }

  const respostas = [
    // Positivas
    '✅ Sim, com certeza!',
    '✅ Sem dúvida!',
    '✅ Muito provável!',
    '✅ Pode apostar que sim!',
    // Neutras
    '🤔 Talvez... vai saber.',
    '🤔 Pergunte novamente mais tarde.',
    '🤔 Quem sabe? O futuro é incerto.',
    '🤔 As forças do universo estão confusas.',
    // Negativas
    '❌ Não, definitivamente não.',
    '❌ Não é provável.',
    '❌ Esqueça essa ideia.',
    '❌ As estrelas dizem que não.',
  ];

  const resp = respostas[Math.floor(Math.random() * respostas.length)];
  await sock.sendMessage(jid, { text: `🎱 *${resp}*` }, { quoted: msg });
}

// ─── !vod (!verdadeoudesafio)
async function handleVerdadeOuDesafio(sock, msg, jid) {
  const tipo = Math.random() > 0.5 ? 'VERDADE' : 'DESAFIO';

  const verdades = [
    'Qual é seu maior medo?',
    'Você já mentiu para alguém importante na sua vida?',
    'Qual é seu segredo mais obscuro?',
    'Você teria coragem de confessar algo ruim que fez aqui agora?',
    'Qual foi a maior besteira que você já fez por alguém?',
    'Você já fingiu gostar de alguém por interesse?',
    'Qual é a coisa mais estranha que você já fez sozinho(a)?',
    'Você já passou vergonha por causa de alguém desse grupo?',
  ];

  const desafios = [
    'Mande uma mensagem criativa para alguém do grupo agora!',
    'Cante uma música inteira aqui no grupo! 🎤',
    'Mude sua foto de perfil por 1 hora.',
    'Escreva um elogio sincero para cada pessoa do grupo.',
    'Mande um áudio gritando o nome de quem te pediu esse desafio.',
    'Fique 10 minutos sem usar o celular.',
    'Mande uma selfie feia aqui agora.',
    'Escreva uma declaração dramática de amor para o grupo.',
  ];

  const lista = tipo === 'VERDADE' ? verdades : desafios;
  const pergunta = lista[Math.floor(Math.random() * lista.length)];
  const icone = tipo === 'VERDADE' ? '🤭' : '😈';

  await sock.sendMessage(jid, {
    text: `🎮 *VERDADE OU DESAFIO* 🎮\n\n${icone} *${tipo}*\n\n❓ ${pergunta}\n\n_Qual é sua resposta?_`,
  }, { quoted: msg });
}
// ─── !confissao
async function handleConfissao(sock, msg, jid) {
  const confissoes = [
    'Confesse algo ruim que você fez recentemente!',
    'Qual é sua confissão mais vergonhosa?',
    'Diga algo que ninguém aqui sabe sobre você.',
    'Qual foi sua maior gafe na vida?',
    'Confesse algo que você nunca teve coragem de falar.',
    'Qual foi a mentira mais absurda que você já contou?',
    'Confesse algo que você faz escondido e teria vergonha de admitir.',
    'O que você fez de errado e nunca pediu desculpa?',
  ];

  const confissao = confissoes[Math.floor(Math.random() * confissoes.length)];

  await sock.sendMessage(jid, {
    text: `🤐 *CONFISSÃO* 🤐\n\n_${confissao}_\n\n💬 Responda aqui, sem julgamentos!`,
  }, { quoted: msg });
}

// ─── !julgamento
async function handleJulgamento(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const julgamentos = [
    { emoji: '😇', texto: 'Uma pessoa incrível que todo mundo deveria conhecer!' },
    { emoji: '🧐', texto: 'Tem vibes de alguém misterioso que guarda segredos pesados.' },
    { emoji: '🤡', texto: 'O(A) mais engraçado(a) do grupo, mesmo sem querer!' },
    { emoji: '👑', texto: 'Nasceu pra ser famoso(a). O mundo ainda vai saber disso.' },
    { emoji: '🔥', texto: 'Atraente e sabe disso. Perigoso(a).' },
    { emoji: '🦥', texto: 'Preguiçoso(a) demais, mas com um charme inexplicável.' },
    { emoji: '🐉', texto: 'Tem uma energia de chefe final de videogame.' },
    { emoji: '🎭', texto: 'Ator/Atriz nato(a). Ninguém sabe quando é real.' },
    { emoji: '🧠', texto: 'Inteligente demais pro próprio bem. Sabe de tudo.' },
    { emoji: '🌪️', texto: 'Um caos ambulante, mas de um jeito adorável.' },
  ];

  const { emoji, texto } = julgamentos[Math.floor(Math.random() * julgamentos.length)];

  await sock.sendMessage(jid, {
    text: `⚖️ *JULGAMENTO DE ${display.toUpperCase()}* ⚖️\n\n${emoji} ${texto}\n\n_Julgamento arbitrário e definitivo. Sem recurso! 😂_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !podre
async function handlePodre(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const insultos = [
    'Podre demais! Até o lixo te rejeitaria! 🗑️',
    'Que nível de podridão! Impressionante! 🤢',
    'Podre com orgulho! Uma lenda da podridão! 💀',
    'Tão podre que até o esgoto ficou com nojo! 🚽',
    'Completamente podre! Hall da fama da podridão! 😒',
    'Podridão no nível máximo! Parabéns! 🏆',
  ];

  const insulto = insultos[Math.floor(Math.random() * insultos.length)];

  await sock.sendMessage(jid, {
    text: `🤢 *VOCÊ É PODRE, ${display.toUpperCase()}!* 🤢\n\n${insulto}\n\n_Só brincadeira... ou não! 😂_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !frango
async function handleFrango(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 20)      { emoji = '🦁'; frase = 'Sem franguice! Corajoso(a) pra caramba! 🔥'; }
  else if (pct <= 40) { emoji = '🐓'; frase = 'Quase nada de franguice. Tem moral! 💪'; }
  else if (pct <= 60) { emoji = '🐔'; frase = 'Meio a meio. Tem coragem quando quer! 😅'; }
  else if (pct <= 80) { emoji = '🐣'; frase = 'Bastante frango(a)! Foge de qualquer desafio! 😂'; }
  else if (pct <= 99) { emoji = '🐥'; frase = 'MUITO frango(a)! Tem medo da própria sombra! 💀'; }
  else                { emoji = '🍗'; frase = '100% FRANGO! Virou nugget de tanto medo! 😭'; }

  const barra = buildBar(pct, '🟨');
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *FRANGUÍMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !maldizer
async function handleMaldizer(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const maldicoes = [
    'Você pisará em LEGO todo dia pelo resto da vida! 😱',
    'Condenado(a) a ter wifi lento pra sempre! 📵',
    'Seus carregadores sempre vão quebrar na hora errada! 🔌',
    'Uma música chata vai ficar presa na sua cabeça eternamente! 🎵',
    'Você sempre vai errar a cama ao se jogar nela! 🛏️',
    'Sua bateria vai chegar a 1% sempre sem carregador por perto! 🔋',
    'Todo sorvete seu vai cair antes de dar a primeira lambida! 🍦',
    'Você sempre vai chegar um minuto atrasado(a) pra tudo! ⏰',
    'Seus fones sempre vão enrolar do nada! 🎧',
    'Você vai morder a língua uma vez por dia! 😬',
  ];

  const maldicao = maldicoes[Math.floor(Math.random() * maldicoes.length)];

  await sock.sendMessage(jid, {
    text: `🔮 *MALDIÇÃO DE ${display.toUpperCase()}* 🔮\n\n☠️ _${maldicao}_\n\n_Que o universo tenha piedade! 💀_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !fortuna
async function handleFortuna(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const fortunas = [
    { emoji: '💎', texto: 'Você encontrará riqueza em um lugar inesperado.' },
    { emoji: '😊', texto: 'Uma grande alegria chegará sem avisar.' },
    { emoji: '✨', texto: 'O destino conspira completamente a seu favor.' },
    { emoji: '🌟', texto: 'Algo bom está prestes a acontecer. Fique atento(a)!' },
    { emoji: '🍀', texto: 'A sorte está do seu lado hoje. Aproveite!' },
    { emoji: '❤️', texto: 'Alguém especial vai aparecer em breve.' },
    { emoji: '📈', texto: 'Uma oportunidade única está chegando. Não deixe passar!' },
    { emoji: '🎁', texto: 'Uma surpresa agradável está a caminho.' },
    { emoji: '🌙', texto: 'A noite te reserva algo especial.' },
    { emoji: '🤝', texto: 'Uma velha amizade vai se renovar.' },
  ];

  const { emoji, texto } = fortunas[Math.floor(Math.random() * fortunas.length)];

  await sock.sendMessage(jid, {
    text: `🥠 *BISCOITO DA FORTUNA DE ${display.toUpperCase()}* 🥠\n\n${emoji} _${texto}_\n\n_O universo falou! Acredite!_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !compatibilidade
async function handleCompatibilidade(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca alguém!\nExemplo: *!compatibilidade @fulano*',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const pct = Math.floor(Math.random() * 101);
  const barra = buildBar(pct, '❤️');

  let emoji, comentario;
  if (pct <= 10)      { emoji = '💔'; comentario = 'Incompatíveis demais! Nem como amigos funciona! 😬'; }
  else if (pct <= 30) { emoji = '😅'; comentario = 'Bem diferentes, mas quem sabe com muito esforço...'; }
  else if (pct <= 50) { emoji = '🤝'; comentario = 'Dá pra ser amigos! Romance é arriscado. 😅'; }
  else if (pct <= 70) { emoji = '💕'; comentario = 'Boa compatibilidade! Vocês se combinam! 😊'; }
  else if (pct <= 89) { emoji = '💖'; comentario = 'Excelente match! Isso tem futuro! 🔥'; }
  else if (pct <= 99) { emoji = '💗'; comentario = 'Quase almas gêmeas! Não deixa escapar! 😍'; }
  else                { emoji = '💑'; comentario = '100%! Almas gêmeas confirmadas! Casem logo! ✨'; }

  await sock.sendMessage(jid, {
    text: `💕 *COMPATIBILIDADE* 💕\n\n*${author}* ${emoji} *${nomeAlvo}*\n\n${barra} *${pct}%*\n\n_${comentario}_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !ship
async function handleShip(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mencionados = contextInfo?.mentionedJid || [];

  if (mencionados.length < 2) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca duas pessoas!\nExemplo: *!ship @fulano @ciclano*',
    }, { quoted: msg });
    return;
  }

  const [jid1, jid2] = mencionados;
  const nome1 = contactNames?.[jid1] || `@${jid1.split('@')[0]}`;
  const nome2 = contactNames?.[jid2] || `@${jid2.split('@')[0]}`;
  const pct = Math.floor(Math.random() * 101);
  const barra = buildBar(pct, '💘');

  let comentario;
  if (pct <= 20)      comentario = 'Nem em universo paralelo... 💀';
  else if (pct <= 50) comentario = 'Uma amizade improvável, mas possível! 🤝';
  else if (pct <= 80) comentario = 'Esse ship tem potencial! 👀🔥';
  else                comentario = 'SHIP CONFIRMADO! Alguém avisa logo! 💍✨';

  await sock.sendMessage(jid, {
    text: `💘 *SHIP* 💘\n\n*${nome1}* 💞 *${nome2}*\n\n${barra} *${pct}%*\n\n_${comentario}_`,
    mentions: [jid1, jid2],
  }, { quoted: msg });
}

// ─── !xingar
async function handleXingar(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const xingamentos = [
    'Seu pé de pano! 🧦',
    'Mala sem alça! 🧳',
    'Lesma com chapéu! 🐌',
    'Pé frio ambulante! 🧊',
    'Pastel de vento! 🥟',
    'Banana mole! 🍌',
    'Queijo derretido! 🧀',
    'Bolacha murcha! 🍪',
    'Esponja ressecada! 🧽',
    'Abacaxi sem graça! 🍍',
  ];

  const xingamento = xingamentos[Math.floor(Math.random() * xingamentos.length)];

  await sock.sendMessage(jid, {
    text: `🤬 *${display.toUpperCase()}*, você é um(a) *${xingamento}*\n\n_Só na brincadeira! 😂_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !elogio
async function handleElogio(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const elogios = [
    { emoji: '🌟', texto: 'Uma das pessoas mais incríveis que já conheci!' },
    { emoji: '💡', texto: 'Tem uma inteligência que impressiona todo mundo.' },
    { emoji: '😄', texto: 'Seu sorriso ilumina qualquer ambiente!' },
    { emoji: '💪', texto: 'Tem uma força interior que poucos possuem.' },
    { emoji: '🎨', texto: 'Criativo(a) de um jeito que ninguém consegue copiar.' },
    { emoji: '❤️', texto: 'Uma das pessoas mais generosas que existem.' },
    { emoji: '🚀', texto: 'Vai longe! O sucesso é inevitável pra você.' },
    { emoji: '🌈', texto: 'Alegra o dia de todos ao redor simplesmente existindo.' },
  ];

  const { emoji, texto } = elogios[Math.floor(Math.random() * elogios.length)];

  await sock.sendMessage(jid, {
    text: `💐 *ELOGIO PARA ${display.toUpperCase()}* 💐\n\n${emoji} _${texto}_\n\n_Elogio 100% verdadeiro e merecido! ✨_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !crush
async function handleCrush(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '💘 Marca seu crush!\nExemplo: *!crush @fulano*',
    }, { quoted: msg });
    return;
  }

  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (mentionedJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, {
      text: '😂 Narcisista! Você não pode ser seu próprio crush! 💀',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const chance = Math.floor(Math.random() * 101);

  let emoji, resposta;
  if (chance <= 20)      { emoji = '💔'; resposta = 'Não vai rolar... Parte pra próxima! 😬'; }
  else if (chance <= 50) { emoji = '🤷'; resposta = 'Talvez! Ninguém sabe. Tenta a sorte! 😅'; }
  else if (chance <= 80) { emoji = '💕'; resposta = 'Tem uma boa chance! Vai lá falar com ele(a)! 👀'; }
  else                   { emoji = '💍'; resposta = 'Casamento confirmado pelo universo! 😍✨'; }

  await sock.sendMessage(jid, {
    text: `💘 *CRUSH REPORT* 💘\n\n*${author}* tem crush em *${nomeAlvo}*\n\n${emoji} Chance de dar certo: *${chance}%*\n\n_${resposta}_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !cantada
async function handleCantada(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const nomeAlvo = mentionedJid
    ? (contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`)
    : null;

  const cantadas = [
    'Você é tão bonito(a) que até o WiFi fica mais rápido perto de você. 📶',
    'Sabe que você me lembra minha conta bancária? Sempre no meu pensamento. 💭',
    'Posso te seguir no Instagram? Minha mãe sempre me disse pra seguir meus sonhos. 😏',
    'Você tem GPS? Porque me perdi nos seus olhos. 👀',
    'Você é chef? Porque tá destruindo meu coração igual a um prato gourmet. 👨‍🍳',
    'Se beleza fosse crime, você estaria preso(a) há anos. 🔒',
    'Você é Google? Porque tem tudo que eu tava procurando. 🔍',
    'Seu pai é ladrão? Porque você roubou meu coração. 💔',
  ];

  const cantada = cantadas[Math.floor(Math.random() * cantadas.length)];
  const destino = nomeAlvo ? ` para *${nomeAlvo}*` : '';

  await sock.sendMessage(jid, {
    text: `💋 *CANTADA${destino ? ` DE ${author.toUpperCase()}` : ''}*${destino}\n\n_"${cantada}"_\n\n😏 Achou que funcionaria?`,
    mentions: mentionedJid ? [mentionedJid] : [],
  }, { quoted: msg });
}

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
  handleAnagrama,
  handlePpt,
  handleVerdadeOuDesafio,
  handleConfissao,
  handleJulgamento,
  handlePodre,
  handleFrango,
  handleMaldizer,
  handleFortuna,
  handleCompatibilidade,
};