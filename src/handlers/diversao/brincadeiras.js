// ─── Helpers
function getAlvo(contextInfo, senderJid, contactNames) {
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const alvoJid = mentionedJid || senderJid;
  const numero = alvoJid.split('@')[0];
  const nome = contactNames?.[alvoJid] || `@${numero}`;
  return { alvoJid, mentionedJid, nome };
}

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
    await sock.sendMessage(jid, { text: '😂 Sozinho(a) não conta! 💀' }, { quoted: msg });
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
  if (pct <= 10)      { emoji = '💀'; frase = 'Aura MORTA! Nem Deus salva! 👹';          barEmoji = '🟥'; }
  else if (pct <= 30) { emoji = '😈'; frase = 'Aura podre! Cheira mal daqui! 🤢';        barEmoji = '🟧'; }
  else if (pct <= 50) { emoji = '😐'; frase = 'Aura neutra. Nem frio nem quente.';       barEmoji = '🟨'; }
  else if (pct <= 70) { emoji = '🌿'; frase = 'Aura ok! Mas pode melhorar! 💪';          barEmoji = '🟩'; }
  else if (pct <= 89) { emoji = '✨'; frase = 'Aura brilhante! Que energia boa! ☀️';     barEmoji = '🟩'; }
  else if (pct <= 99) { emoji = '🌟'; frase = 'Aura ÉPICA! Ilumina qualquer sala! 🙌';   barEmoji = '🟦'; }
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
    await sock.sendMessage(jid, {
      text: '⚠️ Número de lados inválido! Use entre 2 e 100.\nExemplo: *!dado 20*',
    }, { quoted: msg });
    return;
  }
  const resultado = Math.floor(Math.random() * lados) + 1;
  const label = lados !== 6 ? ` (D${lados})` : '';
  await sock.sendMessage(jid, {
    text: `🎲 Você rolou${label}: *${resultado}*`,
  }, { quoted: msg });
}

// ─── !moeda
async function handleMoeda(sock, msg, jid) {
  const resultado = Math.random() < 0.5 ? '🟡 Cara' : '⚪ Coroa';
  await sock.sendMessage(jid, { text: `🪙 Resultado: *${resultado}*` }, { quoted: msg });
}

// ─── !8ball
async function handle8ball(sock, msg, jid, caption) {
  if (!caption?.trim()) {
    await sock.sendMessage(jid, {
      text: '⚠️ Faz uma pergunta!\nExemplo: *!8ball Vou passar na prova?*',
    }, { quoted: msg });
    return;
  }

  const respostas = [
    '✅ Sim, com certeza!',
    '✅ Sem dúvida!',
    '✅ Muito provável!',
    '✅ Pode apostar que sim!',
    '🤔 Talvez... vai saber.',
    '🤔 Pergunte novamente mais tarde.',
    '🤔 Quem sabe? O futuro é incerto.',
    '🤔 As forças do universo estão confusas.',
    '❌ Não, definitivamente não.',
    '❌ Não é provável.',
    '❌ Esqueça essa ideia.',
    '❌ As estrelas dizem que não.',
  ];

  const resp = respostas[Math.floor(Math.random() * respostas.length)];
  await sock.sendMessage(jid, { text: `🎱 *${resp}*` }, { quoted: msg });
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

// ─── !rolar
async function handleRolar(sock, msg, content, jid, author) {
  const caption =
    content?.extendedTextMessage?.text ||
    content?.conversation ||
    '';

  const args = caption.trim().split(/\s+/).slice(1);

  let min = 1, max = 100;
  if (args.length === 1 && !isNaN(args[0]))                              max = parseInt(args[0]);
  else if (args.length === 2 && !isNaN(args[0]) && !isNaN(args[1])) { min = parseInt(args[0]); max = parseInt(args[1]); }

  if (min >= max || max - min > 1_000_000) {
    await sock.sendMessage(jid, {
      text: '⚠️ Intervalo inválido!\nExemplos: *!rolar 50* | *!rolar 1 100*',
    }, { quoted: msg });
    return;
  }

  const resultado = Math.floor(Math.random() * (max - min + 1)) + min;
  await sock.sendMessage(jid, {
    text: `🎲 *${author}* rolou entre *${min}* e *${max}*:\n\n➡️ *${resultado}*`,
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

// ─── !safadeza
async function handleSafadeza(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '😇'; frase = 'Santinho(a)! Nem sabe o que é safadeza!'; }
  else if (pct <= 30) { emoji = '😊'; frase = 'Inocentinho(a), mas com um olhar suspeito! 👀'; }
  else if (pct <= 50) { emoji = '😏'; frase = 'Na média! Safado(a) na medida certa! 😂'; }
  else if (pct <= 70) { emoji = '🔥'; frase = 'Bastante safado(a)! Todo mundo já desconfia!'; }
  else if (pct <= 89) { emoji = '😈'; frase = 'Muito safado(a)! Uma lenda viva do grupo!'; }
  else if (pct <= 99) { emoji = '👹'; frase = 'Quase 100%! Deveria ter vergonha... mas não tem!'; }
  else                { emoji = '🏆'; frase = '100% SAFADO(A)! Campeão(ã) absoluto(a)! 🎊'; }

  const barra = buildBar(pct, '🟥');
  const display = mentionedJid ? nome : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *SAFADÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !tiro
async function handleTiro(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;
  const acertou = Math.random() < 0.5;

  await sock.sendMessage(jid, {
    text: acertou
      ? `🔫 *PANG!*\n\n*${author}* atirou em *${display}* e... *ACERTOU!* 💀\n\n_Que pontaria! 🎯_`
      : `🔫 *PANG!*\n\n*${author}* atirou em *${display}* e... *ERROU!* 😂\n\n_Péssima pontaria! Vai treinar mais! 😅_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !morte
async function handleMorte(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;
  const idade = Math.floor(Math.random() * 81) + 20;

  const causas = [
    'escorregou numa casca de banana 🍌',
    'foi vencido(a) num duelo de olhar fixo com um pombo 🐦',
    'morreu de vergonha alheia assistindo cringe 😬',
    'engasgou com a própria riqueza 💸',
    'foi derrubado(a) por um Roomba descontrolado 🤖',
    'teve overdose de memes ruins 💀',
    'morreu esperando o WiFi conectar 📶',
    'foi derrotado(a) por um Lego no escuro 🧱',
    'sucumbiu à preguiça extrema 🦥',
    'pereceu assistindo série até o amanhecer 📺',
  ];

  const causa = causas[Math.floor(Math.random() * causas.length)];

  await sock.sendMessage(jid, {
    text: `💀 *PREVISÃO DE MORTE* 💀\n\n*${display}* vai morrer aos *${idade} anos*...\n\n⚰️ _Causa: ${causa}_\n\n_Que Deus tenha misericórdia! 🙏_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !roletarussa
async function handleRoletaRussa(sock, msg, content, jid, author) {
  const morreu = Math.random() < 1 / 6;

  await sock.sendMessage(jid, {
    text: morreu
      ? `🔫 *ROLETA RUSSA* 🔫\n\n*${author}* girou o tambor... *BANG! 💥*\n\n☠️ _A bala estava lá. Descanse em paz!_`
      : `🔫 *ROLETA RUSSA* 🔫\n\n*${author}* girou o tambor... *CLIQUE! 😅*\n\n✅ _Sem bala! Você sobreviveu por enquanto..._`,
  }, { quoted: msg });
}

// ─── !roletarussa2 (com menção)
async function handleRoletaRussa2(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca alguém pra jogar!\nExemplo: *!roletarussa2 @fulano*',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const morreu = Math.random() < 1 / 6;

  await sock.sendMessage(jid, {
    text: morreu
      ? `🔫 *ROLETA RUSSA* 🔫\n\n*${author}* apontou pra *${nomeAlvo}*... *BANG! 💥*\n\n☠️ _${nomeAlvo} foi pro outro lado!_`
      : `🔫 *ROLETA RUSSA* 🔫\n\n*${author}* apontou pra *${nomeAlvo}*... *CLIQUE! 😅*\n\n✅ _${nomeAlvo} sobreviveu por pouco!_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !roletarussa3 (grupo inteiro — substitua membros pela lógica real do seu bot)
async function handleRoletaRussa3(sock, msg, content, jid, author) {
  const membros = ['@fulano', '@ciclano', '@beltrano'];
  const vitima = membros[Math.floor(Math.random() * membros.length)];

  await sock.sendMessage(jid, {
    text: `🔫 *ROLETA RUSSA NO GRUPO* 🔫\n\nO tambor girou entre todos...\n\n💥 *BANG!* A bala pegou *${vitima}*!\n\n☠️ _Que descanse em paz!_`,
  }, { quoted: msg });
}

// ─── !falta
async function handleFalta(sock, msg, content, jid) {
  const faltas = [
    'Falta de educação!',
    'Falta de noção!',
    'Falta de vergonha na cara!',
    'Falta de amor próprio!',
    'Falta de QI!',
    'Falta de compromisso!',
    'Falta de caráter!',
    'Falta de bom senso!',
  ];

  const falta = faltas[Math.floor(Math.random() * faltas.length)];

  await sock.sendMessage(jid, {
    text: `🟨 *CARTÃO AMARELO* 🟨\n\n⚽ _${falta}_\n\n_O árbitro não perdoa!_ 😤`,
  }, { quoted: msg });
}

// ─── !baterfalta
async function handleBaterFalta(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca quem bateu falta!\nExemplo: *!baterfalta @fulano*',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const resultado = Math.random();
  let texto;

  if (resultado < 0.33)      texto = `⚽ *GOL!* *${author}* bateu a falta e mandou direto pra rede! 🥅🔥\n\n_${nomeAlvo} não tinha chance!_`;
  else if (resultado < 0.66) texto = `😬 *NA TRAVE!* *${author}* bateu a falta e acertou a trave! Quase!\n\n_${nomeAlvo} suspirou de alívio!_`;
  else                       texto = `🙈 *PRA FORA!* *${author}* bateu a falta e mandou nas arquibancadas! 😂\n\n_${nomeAlvo} saiu rindo!_`;

  await sock.sendMessage(jid, {
    text: `⚽ *BATER FALTA* ⚽\n\n${texto}`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !eununca
async function handleEuNunca(sock, msg, content, jid) {
  const frases = [
    'Eu nunca fiz xixi na piscina... 🏊',
    'Eu nunca menti pro dentista dizendo que escovo 3x ao dia. 🦷',
    'Eu nunca fingi que não vi a mensagem. 📵',
    'Eu nunca ri de algo inapropriado no pior momento. 😬',
    'Eu nunca comi comida caída no chão. 🍕',
    'Eu nunca ignorei ligação e depois perguntei "oi, me ligou?". 📞',
    'Eu nunca falei mal de alguém e essa pessoa apareceu do nada. 😱',
    'Eu nunca fui dormir sem escovar os dentes. 😴',
    'Eu nunca comprei algo por impulso e me arrependi. 🛍️',
    'Eu nunca tirei a roupa da máquina depois de 3 dias. 👕',
  ];

  const frase = frases[Math.floor(Math.random() * frases.length)];

  await sock.sendMessage(jid, {
    text: `🙈 *EU NUNCA...* 🙈\n\n_"${frase}"_\n\n👆 Quem já fez, bebe! 🍺`,
  }, { quoted: msg });
}

// ─── !anagrama
async function handleAnagrama(sock, msg, jid, caption) {
  if (!caption?.trim()) {
    await sock.sendMessage(jid, {
      text: '⚠️ Manda uma palavra!\nExemplo: *!anagrama banana*',
    }, { quoted: msg });
    return;
  }

  const palavra = caption.trim().toLowerCase().replace(/\s+/g, '');
  const embaralhada = palavra.split('').sort(() => Math.random() - 0.5).join('').toUpperCase();

  await sock.sendMessage(jid, {
    text: `🔤 *ANAGRAMA*\n\nPalavra original: *${palavra.toUpperCase()}*\nEmbaralhada: *${embaralhada}*\n\n_Consegue descobrir de volta?_ 🤔`,
  }, { quoted: msg });
}

// ─── !ppt (pedra, papel, tesoura)
async function handlePpt(sock, msg, jid, caption) {
  const opcoes = ['pedra', 'papel', 'tesoura'];
  const bot = opcoes[Math.floor(Math.random() * 3)];
  const jogador = caption?.trim().toLowerCase();

  if (!opcoes.includes(jogador)) {
    await sock.sendMessage(jid, {
      text: '⚠️ Escolha uma opção válida!\nExemplo: *!ppt pedra* | *!ppt papel* | *!ppt tesoura*',
    }, { quoted: msg });
    return;
  }

  const emojis = { pedra: '🪨', papel: '📄', tesoura: '✂️' };
  let resultado;

  if (jogador === bot) {
    resultado = '🤝 *EMPATE!* Pensamos igual!';
  } else if (
    (jogador === 'pedra'   && bot === 'tesoura') ||
    (jogador === 'papel'   && bot === 'pedra')   ||
    (jogador === 'tesoura' && bot === 'papel')
  ) {
    resultado = '🏆 *VOCÊ GANHOU!* Parabéns!';
  } else {
    resultado = '💀 *VOCÊ PERDEU!* Tenta de novo!';
  }

  await sock.sendMessage(jid, {
    text: `✂️ *PEDRA, PAPEL E TESOURA* 🪨\n\nVocê: ${emojis[jogador]} *${jogador.toUpperCase()}*\nBot: ${emojis[bot]} *${bot.toUpperCase()}*\n\n${resultado}`,
  }, { quoted: msg });
}

// ─── !verdadeoudesafio
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