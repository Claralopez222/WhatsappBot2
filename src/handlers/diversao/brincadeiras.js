// ─── Helpers
const fs   = require('fs');
const path = require('path');

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
  if (pct <= 10)      { emoji = '🕊️'; frase = 'Pacifista total! Abraça árvore e chora com filme de cachorro.'; }
  else if (pct <= 30) { emoji = '📰'; frase = 'Só reclama nas redes sociais mas não faz nada. O terrorismo doméstico é postar story.'; }
  else if (pct <= 50) { emoji = '⚖️'; frase = 'Equilibrado(a) na teoria, mas fica com raiva quando cortam na fila. Perigoso(a) em dia ruim.'; }
  else if (pct <= 70) { emoji = '😤'; frase = 'Autoritário(a) pra caralho! Manda no grupo da família com mão de ferro. Ninguém discute.'; }
  else if (pct <= 89) { emoji = '⚔️'; frase = 'RADICAL DEMAIS! Quer ser ditador(a) do condomínio. O vizinho já tem medo de fazer barulho.'; }
  else if (pct <= 99) { emoji = '🦅'; frase = 'Quase um ditador(a) declarado(a)! Só falta o bigodinho e o discurso de 3 horas.'; }
  else                { emoji = '💀'; frase = '100% NAZISTA CONFIRMADO(A)! Tá fichado(a) na história. Que vergonha da humanidade! ☠️'; }

  const barra   = buildBar(pct, '🟥');
  const display = mentionedJid ? nome : author;
  const caption = `${emoji} *NAZÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`;

  const imagemPath = path.join(__dirname, '..', '..', 'Audio-Image', 'imagenaz2.jpg');


  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption,
      mentions: mentionedJid ? [alvoJid] : [],
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, {
      text: caption,
      mentions: mentionedJid ? [alvoJid] : [],
    }, { quoted: msg });
  }
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

async function handleAura(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase, barEmoji, imagemNome;
  if (pct <= 10)      { emoji = '💀'; frase = 'Aura MORTA! Nem Deus salva! 👹';          barEmoji = '🟥'; imagemNome = 'imageaura5.jpg'; }
  else if (pct <= 30) { emoji = '😈'; frase = 'Aura podre! Cheira mal daqui! 🤢';        barEmoji = '🟧'; imagemNome = 'imageaura8.jpg'; }
  else if (pct <= 50) { emoji = '😐'; frase = 'Aura neutra. Nem frio nem quente.';       barEmoji = '🟨'; imagemNome = 'imageaura3.jpg'; }
  else if (pct <= 70) { emoji = '🌿'; frase = 'Aura ok! Mas pode melhorar! 💪';          barEmoji = '🟩'; imagemNome = 'imageaura2.jpg'; }
  else if (pct <= 89) { emoji = '✨'; frase = 'Aura brilhante! Que energia boa! ☀️';     barEmoji = '🟩'; imagemNome = 'imageaura6.jpg'; }
  else if (pct <= 99) { emoji = '🌟'; frase = 'Aura ÉPICA! Ilumina qualquer sala! 🙌';   barEmoji = '🟦'; imagemNome = 'imageaura7.jpg'; }
  else                { emoji = '👼'; frase = 'AURA MÁXIMA! Santo(a) confirmado(a)! 🙏'; barEmoji = '🟦'; imagemNome = 'imageaura.jpg';  }

  const barra   = buildBar(pct, barEmoji);
  const display = mentionedJid ? nome : author;
  const caption = `${emoji} *AURA DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`;

  const imagemPath = path.join(__dirname, '..', '..', 'Audio-Image', imagemNome);


  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption,
      mentions: mentionedJid ? [alvoJid] : [],
    }, { quoted: msg });
  } catch {
    // fallback sem imagem
    await sock.sendMessage(jid, {
      text: caption,
      mentions: mentionedJid ? [alvoJid] : [],
    }, { quoted: msg });
  }
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

// ─── !ship ────────────────────────────────────────────────────────────────────
async function handleShip(sock, msg, content, jid, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const mencionados = contextInfo?.mentionedJid || [];

  if (mencionados.length < 2) {
    await sock.sendMessage(jid, {
      text:
        `💘 *SHIP* 💘\n\n` +
        `⚠️ Você precisa marcar *duas pessoas*!\n\n` +
        `*Exemplo:* !ship @fulano @ciclano`,
    }, { quoted: msg });
    return;
  }

  const [jid1, jid2] = mencionados;
  const nome1 = contactNames?.[jid1] || `@${jid1.split('@')[0]}`;
  const nome2 = contactNames?.[jid2] || `@${jid2.split('@')[0]}`;

  // Nome do casal combinado
  const metade1 = nome1.slice(0, Math.ceil(nome1.length / 2));
  const metade2 = nome2.slice(Math.floor(nome2.length / 2));
  const nomeShip = (metade1 + metade2).toLowerCase();

  const pct    = Math.floor(Math.random() * 101);
  const barra  = buildBar(pct, '💘');

  const { emoji, comentario } =
    pct <= 10  ? { emoji: '💀', comentario: 'Nem em universo paralelo... é um desastre!' } :
    pct <= 25  ? { emoji: '😬', comentario: 'Muito difícil... melhor nem tentar!' } :
    pct <= 40  ? { emoji: '🤷', comentario: 'Tem mais chance de virar amizade do que namoro.' } :
    pct <= 55  ? { emoji: '🤝', comentario: 'Uma amizade improvável, mas possível!' } :
    pct <= 70  ? { emoji: '👀', comentario: 'Esse ship tem potencial, alguém incentiva!' } :
    pct <= 85  ? { emoji: '🔥', comentario: 'Tá pegando fogo esse ship! Vai em frente!' } :
    pct <= 95  ? { emoji: '💍', comentario: 'SHIP CONFIRMADO! Alguém avisa logo!' } :
                 { emoji: '👑', comentario: 'AMOR PERFEITO! Feitos um pro outro! 🌹' };

  await sock.sendMessage(jid, {
    text:
      `💘 *SHIP* 💘\n\n` +
      `*${nome1}* 💞 *${nome2}*\n` +
      `🏷️ *Nome do casal:* _${nomeShip}_\n\n` +
      `${barra} *${pct}%* ${emoji}\n\n` +
      `💬 _${comentario}_`,
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

// ─── !xingar ──────────────────────────────────────────────────────────────────
async function handleXingar(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

    const xingamentos = [
  // 🍑 Picantes mas engraçados
  'Viado sem graça! 🏳️‍🌈',
  'Corno feliz! 🦌',
  'Arrombado(a) de primeira viagem! 🚪',
  'Filho(a) de uma égua! 🐴',
  'Bosta embrulhada em celofane! 🎁',
  'Otário(a) com diploma! 🎓',
  'Porra nenhuma em forma humana! 💀',
  'Cu de frango assado! 🍗',
  'Merda com perna! 💩',
  'Inútil até pra encher linguiça! 🌭',
  'Babaca de carteirinha! 💳',
  'Idiota com WiFi! 📶',
  'Bundão com autoestima! 🍑',
  'Trouxa graduado(a)! 🎓',
  'Palhaço(a) sem circo! 🤡',
  'Lixo com pretensão! 🗑️',
  'Cretino(a) de luxo! 💎',
  'Imbecil com charme! ✨',
  'Retardado(a) funcional! 🧠',
  'Bocó com celular novo! 📱',
  'Pateta profissional! 🤪',
  'Panaca com aspirações! 🚀',
  'Zé mané evoluído! 🦧',
  'Energúmeno(a) simpático(a)! 😊',
  'Jumento(a) alfabetizado(a)! 🫏',
  'Animal irracional com conta no Insta! 🐒',
  'Desgraçado(a) querido(a)! 🥰',
  'Vagabundo(a) com horário! ⏰',
  'Lazarento(a) cheiroso(a)! 🌸',
  'Safado(a) sem coragem! 😏',
];


  const xingamento = xingamentos[Math.floor(Math.random() * xingamentos.length)];

  await sock.sendMessage(jid, {
    text:
      `🤬 *${display.toUpperCase()}*, você é um(a):\n\n` +
      `*${xingamento}*\n\n` +
      `_Só na brincadeira, não leva a sério! 😂_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !elogio ──────────────────────────────────────────────────────────────────
async function handleElogio(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
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
    { emoji: '🧠', texto: 'Resolve qualquer problema com uma facilidade absurda.' },
    { emoji: '🎯', texto: 'Quando foca em algo, não tem quem pare!' },
    { emoji: '🌺', texto: 'Tem uma energia que contagia todo mundo positivamente.' },
    { emoji: '💎', texto: 'Uma pessoa rara — dessas que aparecem uma vez na vida.' },
    { emoji: '🦁', texto: 'Tem coragem pra encarar qualquer desafio de frente.' },
    { emoji: '🎵', texto: 'Deixa tudo ao redor mais bonito só com sua presença.' },
    { emoji: '🌙', texto: 'Brilha mesmo nas situações mais difíceis.' },
    { emoji: '🤝', texto: 'É o tipo de pessoa que nunca abandona quem precisa.' },
    { emoji: '⭐', texto: 'Uma estrela que ninguém consegue apagar.' },
    { emoji: '🍀', texto: 'Quem te tem por perto tem muita sorte!' },
  ];

  const { emoji, texto } = elogios[Math.floor(Math.random() * elogios.length)];

  await sock.sendMessage(jid, {
    text:
      `💐 *ELOGIO PARA ${display.toUpperCase()}* 💐\n\n` +
      `${emoji} _${texto}_\n\n` +
      `_Elogio 100% verdadeiro e merecido! ✨_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !crush ───────────────────────────────────────────────────────────────────
async function handleCrush(sock, msg, content, jid, author, contactNames) {
  const contextInfo  = content?.extendedTextMessage?.contextInfo;
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
  const chance   = Math.floor(Math.random() * 101);

  const { emoji, resposta } =
    chance <= 10  ? { emoji: '💀', resposta: 'Nem em sonho vai rolar... Desiste logo!' } :
    chance <= 25  ? { emoji: '💔', resposta: 'Não vai rolar. Parte pra próxima! 😬' } :
    chance <= 45  ? { emoji: '🤷', resposta: 'Talvez! Ninguém sabe. Tenta a sorte! 😅' } :
    chance <= 65  ? { emoji: '💕', resposta: 'Tem uma boa chance! Vai lá falar com ele(a)! 👀' } :
    chance <= 85  ? { emoji: '🔥', resposta: 'Tá pegando fogo! Só falta dar o primeiro passo!' } :
    chance <= 99  ? { emoji: '💍', resposta: 'Casamento confirmado pelo universo! 😍✨' } :
                    { emoji: '👑', resposta: 'ALMA GÊMEA! Escritos nas estrelas! 🌟' };

  const barra = buildBar(chance, '💘');

  await sock.sendMessage(jid, {
    text:
      `💘 *CRUSH REPORT* 💘\n\n` +
      `*${author}* tem crush em *${nomeAlvo}*\n\n` +
      `${barra} *${chance}%* ${emoji}\n\n` +
      `💬 _${resposta}_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !cantada ─────────────────────────────────────────────────────────────────
async function handleCantada(sock, msg, content, jid, author, contactNames) {
  const contextInfo  = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;
  const nomeAlvo     = mentionedJid
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
    'Você é anestesista? Porque me deixou completamente apaixonado(a). 💉',
    'Sabe programar? Porque você travou meu coração com um bug de amor. 💻',
    'Você é um alarme? Porque você é a primeira coisa que quero ver de manhã. ⏰',
    'É de outro planeta? Porque uma pessoa assim não existe na Terra. 🪐',
    'Você é espelho? Porque me vejo com você. 🪞',
    'Sabe fazer macarrão? Porque você é macarrão. 🍝',
    'Você é elevador? Porque me eleva só de te ver. 🛗',
    'É músico(a)? Porque você tem o ritmo do meu coração. 🎵',
    'Você gosta de redes sociais? Porque você tem todos os meus likes. ❤️',
    'É médico(a)? Porque meu coração acelera quando você aparece. 💓',
    'Você é wi-fi? Porque sinto sua conexão de longe. 📡',
    'É padeiro(a)? Porque você é um pão. 🍞',
  ];

  const cantada = cantadas[Math.floor(Math.random() * cantadas.length)];
  const destino = nomeAlvo ? ` para *${nomeAlvo}*` : '';

  const reacoes = [
    '😏 Funcionou ou deu cringe?',
    '🤡 Pode apostar que não vai funcionar.',
    '😂 Quem escreveu isso merece um prêmio.',
    '👀 Aguardando a resposta...',
    '🫣 Coragem! Pelo menos tentou!',
  ];

  const reacao = reacoes[Math.floor(Math.random() * reacoes.length)];

  await sock.sendMessage(jid, {
    text:
      `💋 *CANTADA${destino ? ` DE ${author.toUpperCase()}` : ''}*${destino}\n\n` +
      `_"${cantada}"_\n\n` +
      `${reacao}`,
    mentions: mentionedJid ? [mentionedJid] : [],
  }, { quoted: msg });
}

// ─── !safadeza ────────────────────────────────────────────────────────────────
async function handleSafadeza(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const { emoji, frase } =
    pct <= 10  ? { emoji: '😇', frase: 'Santinho(a)! Nem sabe o que é safadeza!' } :
    pct <= 25  ? { emoji: '🥺', frase: 'Inocentinho(a) demais! Precisa se soltar!' } :
    pct <= 40  ? { emoji: '😊', frase: 'Certinho(a) por fora, mas tem um olhar suspeito! 👀' } :
    pct <= 55  ? { emoji: '😏', frase: 'Na média! Safado(a) na medida certa!' } :
    pct <= 70  ? { emoji: '🔥', frase: 'Bastante safado(a)! Todo mundo já desconfia!' } :
    pct <= 84  ? { emoji: '😈', frase: 'Muito safado(a)! Uma lenda viva do grupo!' } :
    pct <= 92  ? { emoji: '👹', frase: 'Nível absurdo! Deveria ter vergonha... mas não tem!' } :
    pct <= 99  ? { emoji: '☠️', frase: 'PERIGO EXTREMO! Fuja enquanto é tempo!' } :
                 { emoji: '🏆', frase: '100% SAFADO(A)! Campeão(ã) absoluto(a) do grupo! 🎊' };

  const barra = buildBar(pct, '🟥');

  await sock.sendMessage(jid, {
    text:
      `${emoji} *SAFADÔMETRO DE ${display.toUpperCase()}* ${emoji}\n\n` +
      `${barra} *${pct}%*\n\n` +
      `💬 _${frase}_`,
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
    'escorregou numa casca de banana e foi de base 🍌',
    'morreu de vergonha alheia assistindo o próprio histórico do YouTube 📱',
    'foi vencido(a) num duelo de olhar com um pombo e perdeu 🐦',
    'engasgou tentando explicar que não é burro(a) 🧠',
    'foi derrubado(a) por um Roomba com raiva 🤖',
    'overdose de meme ruim no grupo da família 💀',
    'morreu esperando o Pix cair 🏦',
    'pisou no Lego às 3 da manhã e o coração não aguentou 🧱',
    'morreu de preguiça mesmo, literalmente 🦥',
    'assistiu série até o sol nascer e o corpo desistiu 📺',
    'morreu tentando entender a conta de luz 📄',
    'foi atropelado(a) por carrinho de mercado descontrolado 🛒',
    'morreu de tédio numa reunião que poderia ser e-mail 💼',
    'tomou um susto com notificação de ex e parou o coração 📲',
    'foi fulminado(a) por raio enquanto procurava sinal de internet 📶',
    'morreu lendo briga política no Twitter 🐦',
    'sufocou tentando abrir embalagem lacrada 📦',
    'morreu de fome esperando a pizza chegar 🍕',
    'foi eliminado(a) pelo próprio antivírus 🦠',
    'morreu de susto quando o carregador chegou em 1% 🔋',
  ];

  const causa = causas[Math.floor(Math.random() * causas.length)];

  await sock.sendMessage(jid, {
    text:
      `💀 *PREVISÃO DE MORTE* 💀\n\n` +
      `*${display}* vai bater as botas aos *${idade} anos*\n\n` +
      `⚰️ _Causa mortis: ${causa}_\n\n` +
      `_Que Deus tenha misericórdia dessa alma perdida 🙏_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !roletarussa
async function handleRoletaRussa(sock, msg, content, jid, author) {
  const morreu = Math.random() < 1 / 6;

  const frasesMorte = [
    `*${author}* colocou na cabeça, fechou o olho e... *BANG! 💥*\n\n☠️ _foi pro saco. Descanse em paz, otário(a)._`,
    `*${author}* girou o tambor cheio de confiança e... *BANG! 💥*\n\n💀 _confiou demais. Tchau!_`,
    `*${author}* rezou, soprou, girou e... *BANG! 💥*\n\n⚰️ _nem a reza ajudou. Vai com Deus._`,
  ];

  const frasesSobreviveu = [
    `*${author}* girou o tambor tremendo e... *CLIQUE! 😅*\n\n✅ _sem bala! Dessa vez escapou, sortudo(a)._`,
    `*${author}* fechou o olho, esperou o fim e... *CLIQUE! 😅*\n\n😂 _tá vivo(a), acredita? Aproveita enquanto dura._`,
    `*${author}* quase mijou de medo e... *CLIQUE! 😅*\n\n🎉 _sobreviveu! Mas o susto ficou._`,
  ];

  const frase = morreu
    ? frasesMorte[Math.floor(Math.random() * frasesMorte.length)]
    : frasesSobreviveu[Math.floor(Math.random() * frasesSobreviveu.length)];

  await sock.sendMessage(jid, {
    text: `🔫 *ROLETA RUSSA* 🔫\n\n${frase}`,
  }, { quoted: msg });
}

// ─── !roletarussa2 (com menção)
async function handleRoletaRussa2(sock, msg, content, jid, author, contactNames) {
  const contextInfo  = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca alguém pra jogar!\nExemplo: *!roletarussa2 @fulano*',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const morreu   = Math.random() < 1 / 6;

  const frasesMorte = [
    `*${author}* apontou pra @${mentionedJid.split('@')[0]} sem dó e... *BANG! 💥*\n\n☠️ _foi pro outro lado. Brutal._`,
    `*${author}* olhou nos olhos de @${mentionedJid.split('@')[0]}, sorriu e... *BANG! 💥*\n\n💀 _não vai lembrar de nada._`,
    `*${author}* disse "confia em mim" pra @${mentionedJid.split('@')[0]} e... *BANG! 💥*\n\n⚰️ _confiou. Erro fatal._`,
  ];

  const frasesSobreviveu = [
    `*${author}* apontou pra @${mentionedJid.split('@')[0]} e... *CLIQUE! 😅*\n\n✅ _sobreviveu! Dessa vez._`,
    `*${author}* tentou se livrar de @${mentionedJid.split('@')[0]} e... *CLIQUE! 😅*\n\n😂 _não foi dessa vez. Ainda tá aqui pra encher o saco._`,
    `*${author}* apontou cheio de confiança e... *CLIQUE! 😅*\n\n🎉 @${mentionedJid.split('@')[0]} _escapou! O universo protegeu._`,
  ];

  const frase = morreu
    ? frasesMorte[Math.floor(Math.random() * frasesMorte.length)]
    : frasesSobreviveu[Math.floor(Math.random() * frasesSobreviveu.length)];

  await sock.sendMessage(jid, {
    text: `🔫 *ROLETA RUSSA* 🔫\n\n${frase}`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !roletarussa3 (grupo inteiro)
async function handleRoletaRussa3(sock, msg, jid, author, senderJid) {
  try {
    const meta    = await sock.groupMetadata(jid);
    const membros = meta.participants
      .map(p => p.id)
      .filter(id => id !== senderJid);

    if (!membros.length) {
      await sock.sendMessage(jid, {
        text: '⚠️ Não tem ninguém aqui pra morrer além de você!',
      }, { quoted: msg });
      return;
    }

    const vitimaJid = membros[Math.floor(Math.random() * membros.length)];
    const mention   = `@${vitimaJid.split('@')[0]}`;

    const frases = [
      `O tambor girou entre todo mundo...\n\n💥 *BANG!* A bala pegou ${mention}!\n\n☠️ _Vai com Deus, otário(a)._`,
      `Todo mundo rezando e o destino escolheu...\n\n💥 *BANG!* Direto em ${mention}!\n\n💀 _O grupo agradece pelo sacrifício._`,
      `Silêncio total, tambor girando e...\n\n💥 *BANG!* ${mention} levou!\n\n⚰️ _Nem viu vir. Descanse em paz._`,
    ];

    const frase = frases[Math.floor(Math.random() * frases.length)];

    await sock.sendMessage(jid, {
      text: `🔫 *ROLETA RUSSA NO GRUPO* 🔫\n\n${frase}`,
      mentions: [vitimaJid],
    }, { quoted: msg });

  } catch {
    await sock.sendMessage(jid, {
      text: '⚠️ Só funciona em grupos!',
    }, { quoted: msg });
  }
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

// ─── !eununca ─────────────────────────────────────────────────────────────────
async function handleEuNunca(sock, msg, content, jid) {
  const frases = [
    // 😅 Cotidiano
    'Eu nunca fiz xixi na piscina. 🏊',
    'Eu nunca menti pro dentista dizendo que escovo 3x ao dia. 🦷',
    'Eu nunca fingi que não vi a mensagem. 📵',
    'Eu nunca ri de algo inapropriado no pior momento. 😬',
    'Eu nunca comi comida caída no chão. 🍕',
    'Eu nunca ignorei ligação e depois perguntei "oi, me ligou?". 📞',
    'Eu nunca falei mal de alguém e essa pessoa apareceu do nada. 😱',
    'Eu nunca fui dormir sem escovar os dentes. 😴',
    'Eu nunca comprei algo por impulso e me arrependi. 🛍️',
    'Eu nunca tirei a roupa da máquina depois de 3 dias. 👕',
    'Eu nunca fingi estar ocupado pra não ir a algum lugar. 🙄',
    'Eu nunca respondi "a caminho" estando ainda em casa. 🏠',
    'Eu nunca fui ao banheiro só pra fugir de uma situação chata. 🚽',
    'Eu nunca mandei áudio de mais de 5 minutos. 🎤',
    'Eu nunca stalkeei o perfil de alguém por mais de 30 minutos. 👀',
    'Eu nunca guardei comida no quarto escondido. 🍫',
    'Eu nunca chorei assistindo a um filme animado. 🥺',
    'Eu nunca fiz as unhas e estraguei logo em seguida. 💅',
    'Eu nunca cantei errado uma música por anos sem perceber. 🎵',
    'Eu nunca mandei mensagem pra pessoa errada. 😰',

    // 😏 Relacionamentos
    'Eu nunca fiquei com mais de uma pessoa no mesmo dia. 💘',
    'Eu nunca inventei desculpa pra terminar com alguém. 💔',
    'Eu nunca bisbilhotei o celular de alguém. 📱',
    'Eu nunca fingi gostar de algo só pra impressionar alguém. 😏',
    'Eu nunca mandei mensagem no zap pra alguém que estava do lado. 🤫',
    'Eu nunca fiquei com o ex(a) depois de terminar. 🔁',
    'Eu nunca dei like sem querer em foto antiga de alguém que eu stalkeava. 😱',
    'Eu nunca inventei que tava doente pra não ver alguém. 🤒',

    // 🍻 Balada / Festa
    'Eu nunca bebi e fiz algo que me arrependi no dia seguinte. 🍺',
    'Eu nunca dancei em cima de mesa. 🕺',
    'Eu nunca acordei sem lembrar como cheguei em casa. 😵',
    'Eu nunca perdi um sapato na festa. 👟',
    'Eu nunca chorei bêbado(a) sem motivo aparente. 😭',
    'Eu nunca mandei mensagem comprometedora de madrugada. 🌙',
    'Eu nunca jurei que não ia beber e bebeu assim mesmo. 🍻',

    // 💻 Tech / Redes sociais
    'Eu nunca postei foto editada demais e disse que era natural. 📸',
    'Eu nunca fingi não ter internet pra não responder alguém. 📶',
    'Eu nunca passei mais de 3 horas no TikTok sem perceber. 📱',
    'Eu nunca criei conta fake só pra ver o perfil de alguém. 🕵️',
    'Eu nunca comprei seguidores. 📊',
    'Eu nunca deletei foto por ter pouco like. 🗑️',

    // 🏫 Escola / Trabalho
    'Eu nunca copiei tarefa de alguém na última hora. 📝',
    'Eu nunca dormi na aula e acordei com a turma olhando. 😴',
    'Eu nunca mandei mensagem pro chefe dizendo que tava doente estando saudável. 🤧',
    'Eu nunca colei na prova. ✏️',
    'Eu nunca fiz trabalho em grupo sozinho enquanto os outros sumiam. 😤',
  ];

  const frase = frases[Math.floor(Math.random() * frases.length)];

  const reacoes = [
    '👆 Quem já fez, bebe! 🍺',
    '🍹 Quem já fez isso toma um gole!',
    '😂 Quem se identificou, bebe dobrado!',
    '🫵 Tô te olhando... bebe!',
    '🍻 Quem já fez levanta a mão... e bebe!',
  ];

  const reacao = reacoes[Math.floor(Math.random() * reacoes.length)];

  await sock.sendMessage(jid, {
    text: `🙈 *EU NUNCA...* 🙈\n\n_"${frase}"_\n\n${reacao}`,
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