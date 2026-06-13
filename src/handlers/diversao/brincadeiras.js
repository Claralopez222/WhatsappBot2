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

  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '🧢',
      frases: [
        `Praticamente hétero, mas aquele olhar pro amigo foi longo demais, *${display}*. 👀`,
        `*${display}* jura que é 100% hétero... mas salvou umas fotos "por acidente". 🧢`,
        `Quase zero, *${display}*. Quase. Aquele crush no colega de sala não conta, né? 😏`,
        `*${display}* disse "não sou gay de jeito nenhum" e ajustou o cabelo no espelho por 10 minutos. 💅`,
      ],
    },
    {
      max: 31,
      emoji: '🌈',
      frases: [
        `*${display}* é curioso(a), né? Não precisa esconder, aqui é um lugar seguro. 😏`,
        `Um pouco curioso(a)... *${display}* pesquisou umas coisas no modo anônimo semana passada. 🌈`,
        `*${display}* disse "eu só estava testando" mas ninguém acreditou. 😂`,
        `Baixo, mas não zero. *${display}* sabe muito bem do que estamos falando. 👀`,
      ],
    },
    {
      max: 51,
      emoji: '🏳️‍🌈',
      frases: [
        `Na metade! *${display}* tá em cima do muro e o muro tá adorando. 😂`,
        `*${display}* é 50/50. Um dia hétero, outro dia "depende da vibe". 🏳️‍🌈`,
        `Meio a meio! *${display}* não escolhe time, joga pelos dois lados. ⚽`,
        `*${display}* na exata metade. Admite logo, porra, o grupo já sabe. 😅`,
      ],
    },
    {
      max: 71,
      emoji: '💅',
      frases: [
        `*${display}* tá saindo do armário aos poucos. A porta tá aberta, vai lá! 🚪`,
        `Acima da média! *${display}* ainda finge, mas cada vez menos. 💅`,
        `*${display}* chegou na festa e foi direto pra fila errada. Sem reclamar. 🎉`,
        `O armário de *${display}* tá com a dobradiça solta faz tempo. Empurra mais um pouco. 😂`,
      ],
    },
    {
      max: 90,
      emoji: '👨‍❤️‍👨',
      frases: [
        `Quase assumido(a)! *${display}* falta pouco, caralho! 🏳️‍🌈`,
        `*${display}* já tem a bandeirinha escondida na gaveta. É só uma questão de tempo. 🌈`,
        `Alto demais pra fingir, *${display}*. O grupo inteiro já sabe, menos você. 😏`,
        `*${display}* gritou "EU NÃO SOU GAY" e o autocorreto mudou pra "SOU GAY". 📱💀`,
      ],
    },
    {
      max: 100,
      emoji: '🌈✨',
      frases: [
        `Praticamente confirmado(a)! *${display}*, larga essa farsa! 🎉`,
        `*${display}* tá com 99% e ainda vai dizer "é fase". Vai, né. 😂`,
        `Quase 100%! *${display}* só não assumiu porque o Wi-Fi caiu na hora. 🏳️‍🌈✨`,
        `*${display}* comprou ingresso pra Parada do Orgulho "só pra ver como é". Com fantasia. 💅🎊`,
      ],
    },
    {
      max: 101,
      emoji: '🏆🌈',
      frases: [
        `100% GAY! Parabéns *${display}*, campeão(ã) absoluto(a)! Orgulhe-se! 🎊`,
        `MÁXIMO HISTÓRICO! *${display}* zerou o hetero e não olhou pra trás! 🏆🌈`,
        `*${display}* chegou nos 100% e o grupo inteiro aplaudiu de pé. 👏🌈`,
        `100%! *${display}* não é do armário, é da vitrine iluminada com confete! 🎉🏆`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct);

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *GAYÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
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

  const imagemPath = path.join(__dirname, '..', '..', '..', 'Audio-Image', 'imagenaz2.webp');


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
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 10, emoji: '👩',
      frases: [
        'Hétero assumida! Nem cogita! 💁‍♀️',
        'Straight raiz! Nem em sonho! 😂',
        'Mais hétero impossível. Tá tudo bem. 🙂',
        'Zero por cento. Completamente no time oposto. 🚫',
      ],
    },
    {
      max: 30, emoji: '🌸',
      frases: [
        'Um olhar aqui, outro ali... curiosidade né? 👀',
        'Acha algumas mulheres "bonitas demais"... só isso, né? 😏',
        'Ainda tá na fase de "admiro muito ela". Claro. 🌸',
        'Segue muita conta feminina no Insta "por estética". Tá bom. 📱',
      ],
    },
    {
      max: 50, emoji: '🌈',
      frases: [
        'Na metade do caminho! Admite logo! 😏',
        'Fifty-fifty! O armário tá entreaberto! 🚪',
        'Nem hétero nem assumida. Vibes no meio do caminho! 🤔',
        'Tá na dúvida existencial. O coração sabe a resposta. 💭',
      ],
    },
    {
      max: 70, emoji: '💅',
      frases: [
        'Bastante assumida! A vibe não mente! 💋',
        'O jeito que olha pra algumas mulheres já entregou tudo. 👀',
        'O grupo já sabe. Só falta você admitir. 😂',
        'A playlist do Spotify já denunciou faz tempo. 🎵',
      ],
    },
    {
      max: 89, emoji: '👭',
      frases: [
        'Quase 100%! Falta só confirmar oficialmente! 🏳️‍🌈',
        'Praticamente saindo do armário ao vivo! A porta tá aberta! 🚪✨',
        'O grupo todo já sabe. É só uma questão de tempo. ⏳',
        'Ninguém acredita mais que é "só amizade". 😂',
      ],
    },
    {
      max: 99, emoji: '🌈✨',
      frases: [
        'Praticamente confirmada! Para de enrolar! 🎉',
        'Quase lá! O universo tá gritando. Ouve! 🌈',
        'Para de fingir que não é. O grupo tá esperando o anúncio oficial. 📢',
        'Só falta o post no Instagram com arco-íris. 🏳️‍🌈✨',
      ],
    },
    {
      max: 101, emoji: '🏆👭',
      frases: [
        '100%! Rainha absoluta! Orgulhe-se! 🎊',
        'CONFIRMADA! Ícone lésbico do grupo! 👑🌈',
        '100% e sem arrependimento! Hall da fama! 🏆',
        'Lenda viva! O grupo inteiro te respeita! 👏🌈',
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct);

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *LESBÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !aura
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

  const imagemPath = path.join(__dirname, '..', '..', '..', 'Audio-Image', imagemNome);
  console.log('📁 PATH AURA:', imagemPath);


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

// ─── !bucetudo
async function handleBucetudo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct = Math.floor(Math.random() * 101);

  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '🍑',
      frases: [
        `*${display}* mal tem nada, mas o que tem já chama atenção. 👀`,
        `Quase zero, *${display}*. Mas aquela calça justa no último domingo... 😏`,
        `*${display}* ainda tá no começo da jornada. Tem futuro. 🍑`,
        `Discreto(a) demais, *${display}*. A natureza foi econômica, mas com carinho. 😌`,
      ],
    },
    {
      max: 31,
      emoji: '🍑💦',
      frases: [
        `*${display}* tem alguma coisa ali, não é? O short ajuda bastante. 😂`,
        `Modesto(a), mas presente. *${display}* não precisa de muito pra chamar atenção. 😏`,
        `*${display}* tem o suficiente pra fazer alguém olhar duas vezes. 👀`,
        `Não é muito, mas *${display}* sabe usar bem o que tem. 💅`,
      ],
    },
    {
      max: 51,
      emoji: '🍑🔥',
      frases: [
        `Na média! *${display}* tá no padrão. Nem demais, nem de menos. 🍑`,
        `*${display}* é mediano(a), mas tudo depende da roupa certa. 😂`,
        `Meio a meio! *${display}* às vezes impressiona, às vezes não. Depende do dia. 😅`,
        `*${display}* tá bem no centro. 50% é honesto, o grupo concorda. 🔥`,
      ],
    },
    {
      max: 71,
      emoji: '🍑💎',
      frases: [
        `Acima da média! *${display}* tem motivo pra andar de cabeça erguida. 💎`,
        `*${display}* não é o centro das atenções à toa. A geometria favorece. 🍑`,
        `Considerável! *${display}* entra numa sala e a física muda. 😂`,
        `O grupo votou e *${display}* ficou acima da média por unanimidade. 🏆`,
      ],
    },
    {
      max: 90,
      emoji: '🍑👑',
      frases: [
        `IMPRESSIONANTE! *${display}* tá no top tier sem nem tentar. 👑`,
        `*${display}* caminha e o chão agradece. Que presença! 🍑🔥`,
        `Alto demais pra ignorar, *${display}*. Isso é um dom, não tem outro nome. 😏`,
        `*${display}* é a razão pela qual as calças jeans têm elástico. 💀👑`,
      ],
    },
    {
      max: 100,
      emoji: '🍑🏆',
      frases: [
        `LENDÁRIO(A)! *${display}* transcende o comum. Isso é patrimônio. 🏆`,
        `*${display}* chegou nos 99% e a gravidade fez hora extra hoje. 🍑✨`,
        `Quase 100%! *${display}* foi criado(a) por engenheiros ou foi sorte mesmo? 😂`,
        `*${display}* devia ter seguro. Um ativo desse tamanho precisa de proteção. 💅🏆`,
      ],
    },
    {
      max: 101,
      emoji: '🍑🎊👑',
      frases: [
        `100% BUCETUDO(A)! *${display}* é a referência absoluta do grupo. 🎊`,
        `MÁXIMO HISTÓRICO! *${display}* zerou o medidor e o algoritmo entrou em colapso. 🏆🍑`,
        `*${display}* chegou nos 100% e a física quântica pediu licença. 👑✨`,
        `100%! *${display}* não é uma pessoa, é um fenômeno da natureza. 🎉🍑👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct);

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *BUCETÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
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
    // ✅ Sim
    '✅ Sim, com certeza!',
    '✅ Sem dúvida nenhuma!',
    '✅ Muito provável!',
    '✅ Pode apostar que sim!',
    '✅ O universo confirma: sim!',
    '✅ Tá escrito nas estrelas. Vai acontecer!',
    '✅ Com toda certeza do mundo!',
    '✅ Sim! Não perde tempo e vai lá!',
    '✅ A bola 8 diz: ACONTECE!',
    '✅ Favorável. Vai em frente sem medo!',

    // 🤔 Talvez
    '🤔 Talvez... vai saber.',
    '🤔 Pergunte novamente mais tarde.',
    '🤔 Quem sabe? O futuro é incerto.',
    '🤔 As forças do universo estão confusas.',
    '🤔 Depende de você. A bola não garante nada.',
    '🤔 Nem sim, nem não. O destino é preguiçoso hoje.',
    '🤔 As energias cósmicas estão indecisas. Tenta de novo.',
    '🤔 Possível, mas não garantido. Segura a ansiedade.',
    '🤔 A resposta existe, mas a bola não tá com vontade de dar.',
    '🤔 Cinquenta por cento pra cada lado. Cara ou coroa?',

    // ❌ Não
    '❌ Não, definitivamente não.',
    '❌ Não é provável.',
    '❌ Esqueça essa ideia.',
    '❌ As estrelas dizem que não.',
    '❌ Jamais. Nem tenta.',
    '❌ A bola 8 ri da sua pergunta. Não vai rolar.',
    '❌ Não acontece nem em universo paralelo.',
    '❌ Pode tirar o cavalinho da chuva.',
    '❌ O destino disse não e bateu a porta na sua cara.',
    '❌ Nem com muita fé isso vai funcionar.',
  ];

  const resp = respostas[Math.floor(Math.random() * respostas.length)];
  await sock.sendMessage(jid, { text: `🎱 *${resp}*` }, { quoted: msg });
}

// ─── !ship
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

  const metade1  = nome1.slice(0, Math.ceil(nome1.length / 2));
  const metade2  = nome2.slice(Math.floor(nome2.length / 2));
  const nomeShip = (metade1 + metade2).toLowerCase();

  const pct   = Math.floor(Math.random() * 101);
  const barra = buildBar(pct, '💘');

  const faixas = [
    {
      max: 10, emoji: '💀',
      frases: [
        'Nem em universo paralelo... é um desastre total!',
        'A bola 8 chorou de pena. Não vai rolar jamais.',
        'Incompatíveis no nível molecular. Esquece.',
        'O próprio Cupido jogou o arco fora ao ver esse ship.',
      ],
    },
    {
      max: 25, emoji: '😬',
      frases: [
        'Muito difícil... melhor nem tentar!',
        'Tem mais chance de cair um raio. Desiste.',
        'Seria necessário um milagre. E milagres são raros.',
        'O grupo torce, mas a matemática diz não.',
      ],
    },
    {
      max: 40, emoji: '🤷',
      frases: [
        'Tem mais chance de virar amizade do que namoro.',
        'Dá pra ser colega de trabalho no máximo.',
        'Nada de mais. Talvez uns dois dias de conversa.',
        'Ship fraquinho. Existe esperança, mas pouca.',
      ],
    },
    {
      max: 55, emoji: '🤝',
      frases: [
        'Uma amizade improvável, mas possível!',
        'Pode rolar algo, mas alguém vai ter que se esforçar muito.',
        'Na média. Com dedicação pode evoluir!',
        'Nem ótimo, nem ruim. Depende da vibe do dia.',
      ],
    },
    {
      max: 70, emoji: '👀',
      frases: [
        'Esse ship tem potencial! Alguém incentiva!',
        'Tem algo aí. Só falta o empurrãozinho certo.',
        'A faísca existe. Alguém precisa soprar.',
        'O grupo já tá vendo o que eles não viram ainda.',
      ],
    },
    {
      max: 85, emoji: '🔥',
      frases: [
        'Tá pegando fogo esse ship! Vai em frente!',
        'Quente demais! Só falta oficializar!',
        'Combinação explosiva. O grupo aprova com entusiasmo.',
        'Deu match nos astros. Não desperdiça isso!',
      ],
    },
    {
      max: 95, emoji: '💍',
      frases: [
        'SHIP CONFIRMADO! Alguém avisa logo!',
        'Isso é praticamente um noivado. Falta só o anel.',
        'Nível casamento civil. O cartório tá esperando.',
        'O universo inteiro torce por esse casal. Não decepciona!',
      ],
    },
    {
      max: 101, emoji: '👑',
      frases: [
        'AMOR PERFEITO! Feitos um pro outro! 🌹',
        'ALMAS GÊMEAS CONFIRMADAS! Isso é raro demais!',
        'Nível épico! Esse ship vai entrar pra história do grupo!',
        '100%! O destino já escolheu. É inevitável. 💫',
      ],
    },
  ];

  const faixa    = faixas.find(f => pct < f.max);
  const comentario = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];

  await sock.sendMessage(jid, {
    text:
      `💘 *SHIP* 💘\n\n` +
      `*${nome1}* 💞 *${nome2}*\n` +
      `🏷️ *Nome do casal:* _${nomeShip}_\n\n` +
      `${barra} *${pct}%* ${faixa.emoji}\n\n` +
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

// ─── !crush ──────────────────────────────────────────────────────────────────
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

  const faixas = [
    {
      max: 10, emoji: '💀',
      frases: [
        'Nem em sonho vai rolar... Desiste logo!',
        'O universo gargalhou quando você pensou nisso. 😭',
        `${nomeAlvo} nem sabe que você existe nesse nível. 💀`,
        'Zero chance. Nem com muito esforço. Parte pra próxima.',
      ],
    },
    {
      max: 25, emoji: '💔',
      frases: [
        'Não vai rolar. Parte pra próxima! 😬',
        `${nomeAlvo} te vê como... nada. Infelizmente. 😅`,
        'A chance é tão pequena que nem aparece no gráfico.',
        'Amor não correspondido clássico. Chora e segue em frente.',
      ],
    },
    {
      max: 45, emoji: '🤷',
      frases: [
        'Talvez! Ninguém sabe. Tenta a sorte! 😅',
        'Cinquenta por cento de esperança, cinquenta de decepção.',
        `${nomeAlvo} pode até ter notado você. Ou não. Vai saber.`,
        'Incerto. O destino tá de mau humor hoje.',
      ],
    },
    {
      max: 65, emoji: '💕',
      frases: [
        `Tem uma boa chance! Vai lá falar com ${nomeAlvo}! 👀`,
        'A energia tá favorável! Só falta você tomar coragem.',
        `${nomeAlvo} provavelmente já te notou. Aproveita! 😏`,
        'Dá pra rolar sim! Para de procrastinar e age logo!',
      ],
    },
    {
      max: 85, emoji: '🔥',
      frases: [
        'Tá pegando fogo! Só falta dar o primeiro passo!',
        `${nomeAlvo} tá esperando sem saber que tá esperando. Corre!`,
        'A faísca já existe. Só falta você soprar. 🔥',
        'Quente demais! O grupo todo já viu que tem clima!',
      ],
    },
    {
      max: 99, emoji: '💍',
      frases: [
        'Casamento confirmado pelo universo! 😍✨',
        `${nomeAlvo} e você foram feitos um pro outro. Fica claro.`,
        'Nível noivado. Só falta o anel e a festa. 💍',
        'O destino já decidiu. Você só precisa aparecer.',
      ],
    },
    {
      max: 101, emoji: '👑',
      frases: [
        'ALMA GÊMEA! Escritos nas estrelas! 🌟',
        `${nomeAlvo} é sua pessoa. Sem discussão. O cosmos confirmou.`,
        '100%! Isso é raro demais. Não desperdiça essa chance! 👑',
        'Amor épico nível filme. O grupo inteiro vai vibrar com isso. 🎊',
      ],
    },
  ];

  const faixa  = faixas.find(f => chance < f.max);
  const resposta = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra  = buildBar(chance, '💘');

  await sock.sendMessage(jid, {
    text:
      `💘 *CRUSH REPORT* 💘\n\n` +
      `*${author}* tem crush em *${nomeAlvo}*\n\n` +
      `${barra} *${chance}%* ${faixa.emoji}\n\n` +
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

// ─── !safadeza ───────────────────────────────────────────────────────────────
async function handleSafadeza(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 10, emoji: '😇',
      frases: [
        'Santinho(a)! Nem sabe o que é safadeza!',
        'Puro(a) como água de nascente. Impressionante.',
        'Inocente demais. O grupo te protege. 🕊️',
        'Zero safadeza. Nem por acidente.',
      ],
    },
    {
      max: 25, emoji: '🥺',
      frases: [
        'Inocentinho(a) demais! Precisa se soltar!',
        'Tem um potencial aí escondido, mas ainda não acordou.',
        'Certinho(a) na teoria. Na prática... talvez. 👀',
        'Ainda na fase de corar com piada de duplo sentido.',
      ],
    },
    {
      max: 40, emoji: '😊',
      frases: [
        'Certinho(a) por fora, mas tem um olhar suspeito! 👀',
        'Na rua é educado(a), mas no zap já mandou umas coisas... 😏',
        'Parece inocente mas o histórico de conversa diz outra coisa.',
        'Safadinho(a) envergonhado(a). O pior tipo. 😂',
      ],
    },
    {
      max: 55, emoji: '😏',
      frases: [
        'Na média! Safado(a) na medida certa!',
        'Nem santo(a) nem demônio. Um equilíbrio suspeito.',
        'Safadeza controlada. Sabe a hora certa de liberar.',
        'O grupo já desconfia mas não tem prova ainda.',
      ],
    },
    {
      max: 70, emoji: '🔥',
      frases: [
        'Bastante safado(a)! Todo mundo já desconfia!',
        'Safadeza em nível avançado. O grupo já sabe de tudo.',
        'Tá no top 3 mais safados(as) do grupo facilmente.',
        'Ninguém se surpreende mais com as histórias dessa pessoa. 😂',
      ],
    },
    {
      max: 84, emoji: '😈',
      frases: [
        'Muito safado(a)! Uma lenda viva do grupo!',
        'Nível lendário. As histórias já viraram folclore.',
        'Devia ter um aviso de conteúdo adulto antes de falar.',
        'O grupo usa como referência de safadeza. Orgulho duvidoso. 🏅',
      ],
    },
    {
      max: 92, emoji: '👹',
      frases: [
        'Nível absurdo! Deveria ter vergonha... mas não tem!',
        'Safadeza que assusta até os mais experientes do grupo.',
        'Ultrapassou limites que nem sabíamos que existiam.',
        'A psicologia ainda não tem nome pra esse nível. 💀',
      ],
    },
    {
      max: 99, emoji: '☠️',
      frases: [
        'PERIGO EXTREMO! Fuja enquanto é tempo!',
        'Safadeza biónica. Um fenômeno da natureza.',
        'Nem o diabo acredita no que essa pessoa já fez.',
        'O grupo considera colocar uma placa de aviso antes de responder. ☠️',
      ],
    },
    {
      max: 101, emoji: '🏆',
      frases: [
        '100% SAFADO(A)! Campeão(ã) absoluto(a) do grupo! 🎊',
        'Hall da fama da safadeza. Intocável. Lendário(a).',
        'Número um. Inigualável. O grupo nunca viu igual.',
        'RECORDE MUNDIAL! Precisam criar uma categoria nova só pra essa pessoa. 👑',
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟥');

  await sock.sendMessage(jid, {
    text:
      `${faixa.emoji} *SAFADÔMETRO DE ${display.toUpperCase()}* ${faixa.emoji}\n\n` +
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
      text: '⚠️ Marca quem tá na barreira!\nExemplo: *!baterfalta @fulano*',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;

  const resultados = [
    // ⚽ Gol
    {
      chance: 0.33,
      frases: [
        `⚽ *GOL!* *${author}* bateu colocado no ângulo e o goleiro nem viu! 🥅🔥\n\n_${nomeAlvo} ficou plantado olhando a bola entrar._`,
        `⚽ *GOLAÇO!* *${author}* cobrou no cantinho e não teve defesa! 🏆\n\n_${nomeAlvo} jogou o boné no chão de raiva._`,
        `⚽ *GOL DE PLACA!* *${author}* mandou uma bomba no ângulo! 🔥\n\n_${nomeAlvo} nem se mexeu. Humilhação total._`,
        `⚽ *GOL!* *${author}* enganou a barreira e mandou rasteiro! 🥅\n\n_${nomeAlvo} mergulhou pro lado errado. Clássico._`,
      ],
    },
    // 😬 Trave
    {
      chance: 0.66,
      frases: [
        `😬 *NA TRAVE!* *${author}* bateu e a bola beijou o poste! Que azar! 😩\n\n_${nomeAlvo} suspirou de alívio e agradeceu aos céus._`,
        `😬 *TRAVESSÃO!* *${author}* levantou a bola e acertou em cheio na madeira! 😤\n\n_${nomeAlvo} saiu correndo antes do rebote._`,
        `😬 *NA TRAVE E SAIU!* Que crueldade com *${author}*! 😭\n\n_${nomeAlvo} riu na cara dura._`,
        `😬 *QUASE!* *${author}* bateu colocado mas a trave salvou *${nomeAlvo}*! 😱\n\n_Milímetros de diferença. A vida é cruel._`,
      ],
    },
    // 🙈 Fora
    {
      chance: 1.01,
      frases: [
        `🙈 *PRA FORA!* *${author}* bateu e a bola foi parar no estacionamento! 😂\n\n_${nomeAlvo} saiu rindo e nem olhou pra trás._`,
        `🙈 *NAS ARQUIBANCADAS!* *${author}* chutou com tanta força que a bola sumiu! 🚀\n\n_${nomeAlvo} perguntou se precisava de ajuda._`,
        `🙈 *QUE HORROR!* *${author}* escorregou na hora de bater e mandou no corner! 😭\n\n_${nomeAlvo} bateu palma com pena._`,
        `🙈 *MANDOU PRO UNIVERSO!* *${author}* arrancou o chute e errou o alvo por 3 metros! 🌌\n\n_${nomeAlvo} tirou foto pra mandar no grupo._`,
      ],
    },
  ];

  const sorteio = Math.random();
  const resultado = resultados.find(r => sorteio < r.chance);
  const texto = resultado.frases[Math.floor(Math.random() * resultado.frases.length)];

  await sock.sendMessage(jid, {
    text: `⚽ *BATER FALTA* ⚽\n\n${texto}`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !eununca
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
    'Eu nunca fiz uma lista de tarefas só pra riscar tudo sem fazer. ✅',
    'Eu nunca coloquei o alarme 10 vezes e ignorei todos. ⏰',
    'Eu nunca fingi que não estava em casa quando bateram na porta. 🚪',
    'Eu nunca abri a geladeira sem fome só pra olhar. 🧊',
    'Eu nunca perdi chave de casa e culpei outra pessoa. 🔑',
    'Eu nunca prometei acordar cedo e dormiu até o meio-dia. 🌞',
    'Eu nunca deixei louça pra lavar "depois" por mais de dois dias. 🍽️',
    'Eu nunca inventei que o celular estava sem bateria. 🔋',
    'Eu nunca fingiu ter lido um livro pra parecer culto. 📚',
    'Eu nunca saí sem guarda-chuva achando que não ia chover. ☔',

    // 😏 Relacionamentos
    'Eu nunca fiquei com mais de uma pessoa no mesmo dia. 💘',
    'Eu nunca inventei desculpa pra terminar com alguém. 💔',
    'Eu nunca bisbilhotei o celular de alguém. 📱',
    'Eu nunca fingi gostar de algo só pra impressionar alguém. 😏',
    'Eu nunca mandei mensagem no zap pra alguém que estava do lado. 🤫',
    'Eu nunca fiquei com o ex(a) depois de terminar. 🔁',
    'Eu nunca dei like sem querer em foto antiga de alguém que eu stalkeava. 😱',
    'Eu nunca inventei que tava doente pra não ver alguém. 🤒',
    'Eu nunca mandei áudio apaixonado e me arrependi na hora que enviou. 💌',
    'Eu nunca escrevi uma mensagem longa e apaguei tudo antes de mandar. 🗑️',
    'Eu nunca fingi não me importar quando me importava demais. 💔',
    'Eu nunca pesquisei o(a) ex nas redes sociais às 2 da manhã. 🌙',
    'Eu nunca dei unfollow e follow de novo na mesma semana. 🔄',
    'Eu nunca fiquei com alguém do grupo e não contou pra ninguém. 🤐',

    // 🍻 Balada / Festa
    'Eu nunca bebi e fiz algo que me arrependi no dia seguinte. 🍺',
    'Eu nunca dancei em cima de mesa. 🕺',
    'Eu nunca acordei sem lembrar como cheguei em casa. 😵',
    'Eu nunca perdi um sapato na festa. 👟',
    'Eu nunca chorei bêbado(a) sem motivo aparente. 😭',
    'Eu nunca mandei mensagem comprometedora de madrugada. 🌙',
    'Eu nunca jurei que não ia beber e bebeu assim mesmo. 🍻',
    'Eu nunca saí pra "só tomar uma" e voltou de manhã. ☀️',
    'Eu nunca dormi na casa de alguém sem planejar. 🛋️',
    'Eu nunca liguei pra alguém bêbado(a) e fingiu que não lembrava no dia seguinte. 📞',
    'Eu nunca vomitei no banheiro de uma festa e voltei a dançar logo depois. 🕺🤢',
    'Eu nunca perdi o celular na balada e entrou em pânico. 😱',

    // 💻 Tech / Redes sociais
    'Eu nunca postei foto editada demais e disse que era natural. 📸',
    'Eu nunca fingi não ter internet pra não responder alguém. 📶',
    'Eu nunca passei mais de 3 horas no TikTok sem perceber. 📱',
    'Eu nunca criei conta fake só pra ver o perfil de alguém. 🕵️',
    'Eu nunca comprei seguidores. 📊',
    'Eu nunca deletei foto por ter pouco like. 🗑️',
    'Eu nunca postei story só pra uma pessoa específica ver. 👁️',
    'Eu nunca pesquisei meu próprio nome no Google. 🔍',
    'Eu nunca fiz print de conversa pra mostrar pros amigos. 📲',
    'Eu nunca apaguei comentário meu depois de 2 minutos com vergonha. 😳',

    // 🏫 Escola / Trabalho
    'Eu nunca copiei tarefa de alguém na última hora. 📝',
    'Eu nunca dormi na aula e acordei com a turma olhando. 😴',
    'Eu nunca mandei mensagem pro chefe dizendo que tava doente estando saudável. 🤧',
    'Eu nunca colei na prova. ✏️',
    'Eu nunca fiz trabalho em grupo sozinho enquanto os outros sumiam. 😤',
    'Eu nunca entrei em reunião com câmera desligada e fui fazer outra coisa. 💻',
    'Eu nunca mandei e-mail errado pro chefe. 📧',
    'Eu nunca adiou um prazo e inventou uma desculpa criativa. 📅',
    'Eu nunca pesquisou resposta de prova no banheiro. 🚽📱',
    'Eu nunca fingiu estar trabalhando quando o chefe passou perto. 🖥️',
  ];

  const frase = frases[Math.floor(Math.random() * frases.length)];

  const reacoes = [
    '👆 Quem já fez, bebe! 🍺',
    '🍹 Quem já fez isso toma um gole!',
    '😂 Quem se identificou, bebe dobrado!',
    '🫵 Tô te olhando... bebe!',
    '🍻 Quem já fez levanta a mão... e bebe!',
    '🫣 Olha nos olhos e diz que nunca fez. Vai. Eu espero.',
    '😈 Mentiroso(a) bebe dois!',
    '🤡 Tá me enganando? Bebe logo!',
    '💀 Quem fez e não admite, bebe três!',
    '👀 O grupo inteiro sabe quem fez. Bebe.',
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

  const resultados = {
    empate: [
      '🤝 *EMPATE!* Pensamos igual! Somos a mesma pessoa?',
      '🤝 *EMPATE!* Sincronizados demais. Assustador.',
      '🤝 *EMPATE!* Nenhum de nós dois tem criatividade hoje.',
      '🤝 *EMPATE!* O universo não quis decidir agora.',
    ],
    vitoria: [
      '🏆 *VOCÊ GANHOU!* Tá me humilhando? Parabéns. 😤',
      '🏆 *VOCÊ GANHOU!* Sorte de iniciante. Tô de olho em você. 👀',
      '🏆 *VOCÊ GANHOU!* Dessa vez foi. Da próxima não escapa. 😤',
      '🏆 *VOCÊ GANHOU!* Aceito a derrota com desonra total. 💀',
    ],
    derrota: [
      '💀 *VOCÊ PERDEU!* Isso foi constrangedor. Tenta de novo! 😂',
      '💀 *VOCÊ PERDEU!* Previsível demais! Li sua mente. 🧠',
      '💀 *VOCÊ PERDEU!* Até eu fiquei com dó. Vai de novo! 😬',
      '💀 *VOCÊ PERDEU!* Não era difícil... mas conseguiu errar. 😂',
    ],
  };

  let tipo;
  if (jogador === bot) {
    tipo = 'empate';
  } else if (
    (jogador === 'pedra'   && bot === 'tesoura') ||
    (jogador === 'papel'   && bot === 'pedra')   ||
    (jogador === 'tesoura' && bot === 'papel')
  ) {
    tipo = 'vitoria';
  } else {
    tipo = 'derrota';
  }

  const resultado = resultados[tipo][Math.floor(Math.random() * resultados[tipo].length)];

  await sock.sendMessage(jid, {
    text: `✂️ *PEDRA, PAPEL E TESOURA* 🪨\n\nVocê: ${emojis[jogador]} *${jogador.toUpperCase()}*\nBot: ${emojis[bot]} *${bot.toUpperCase()}*\n\n${resultado}`,
  }, { quoted: msg });
}

// ─── !verdadeoudesafio
async function handleVerdadeOuDesafio(sock, msg, jid) {
  const tipo = Math.random() > 0.5 ? 'VERDADE' : 'DESAFIO';

  const verdades = [
    'Qual é seu maior medo e por quê você nunca fala sobre ele?',
    'Você já mentiu pra alguém importante e nunca contou? O que foi?',
    'Qual é o segredo mais pesado que você carrega?',
    'Você teria coragem de confessar algo ruim que fez aqui agora?',
    'Qual foi a maior besteira que você já fez por alguém?',
    'Você já fingiu gostar de alguém só por interesse?',
    'Qual é a coisa mais estranha que você já fez estando completamente sozinho(a)?',
    'Você já passou vergonha por causa de alguém desse grupo? Conta!',
    'Qual foi a última vez que você chorou e por quê?',
    'Você já teve inveja de alguém do grupo? De quem e por quê?',
    'Qual é a mentira que você mais repete pra se safar de situações?',
    'Se pudesse apagar uma memória, qual seria?',
    'Tem alguém nesse grupo que você não suporta? Não precisa falar o nome... mas pode. 😏',
    'Qual foi a decisão mais arrependida da sua vida?',
    'Você já foi o(a) vilão(ã) de uma história? Conta o que aconteceu.',
    'Qual é o pior pensamento que você já teve sobre alguém desse grupo?',
    'Se todos soubessem de uma coisa sua, você sairia do grupo?',
    'Qual foi a vez que você ficou mais com ciúme na vida?',
    'Você já fingiu ser alguém que não é pra impressionar alguém? Funcionou?',
    'O que você faz quando está sozinho(a) que jamais admitiria em público?',
  ];

  const desafios = [
    'Mande uma mensagem aleatória e estranha pro último contato do seu WhatsApp agora! 📲',
    'Cante pelo menos 30 segundos de uma música aqui no grupo! 🎤',
    'Mude sua foto de perfil por 1 hora pra uma foto feia sua. Sem filtro.',
    'Escreva um elogio sincero e exagerado pra cada pessoa que responder essa mensagem.',
    'Mande um áudio gritando o nome de quem te pediu esse desafio pelo menos 3 vezes.',
    'Fique 15 minutos sem usar o celular. O grupo vai fiscalizar. ⏱️',
    'Mande uma selfie com a pior expressão de cara que você conseguir fazer. Agora.',
    'Escreva uma declaração dramática de amor pra esse grupo. Capriche. 💌',
    'Mande um áudio imitando alguém do grupo sem falar o nome. O grupo adivinha quem é.',
    'Poste nos seus stories uma foto enviada por alguém do grupo. Sem ver antes.',
    'Mande uma mensagem pra alguém de fora do grupo dizendo "precisamos conversar" e some por 5 minutos.',
    'Imite um animal por áudio até alguém do grupo adivinhar qual é.',
    'Fale um elogio pra pessoa que você menos fala nesse grupo.',
    'Mande uma foto do lugar mais bagunçado da sua casa agora. Sem arrumar.',
    'Escreva uma resenha dramática do último filme ou série que assistiu usando só emojis.',
    'Diga três verdades sobre você que ninguém do grupo sabe.',
    'Mande um áudio em inglês inventando uma história aleatória por pelo menos 20 segundos.',
    'Peça pra alguém do grupo escolher sua foto de perfil por 30 minutos.',
    'Mande o print da sua tela inicial do celular sem apagar nada.',
    'Chame alguém do grupo de apelido ridículo até a próxima mensagem.',
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
    'Confesse algo ruim que você fez recentemente e não contou pra ninguém.',
    'Qual é sua confissão mais vergonhosa? Chegou a hora.',
    'Diga algo que ninguém aqui sabe sobre você. Pode ser qualquer coisa.',
    'Qual foi sua maior gafe? Conta com detalhes.',
    'Confesse algo que você nunca teve coragem de falar em voz alta.',
    'Qual foi a mentira mais absurda que você já contou e quase funcionou?',
    'Confesse algo que você faz escondido e teria vergonha de admitir publicamente.',
    'O que você fez de errado e nunca pediu desculpas? Chegou a hora.',
    'Qual foi a última vez que você fez algo e torceu pra ninguém descobrir?',
    'Confesse: você já julgou alguém do grupo injustamente? O que pensou?',
    'Qual é o hábito mais vergonhoso que você tem e não consegue largar?',
    'Confesse algo que você faz em casa que jamais faria na frente de outras pessoas.',
    'Qual foi a situação mais constrangedora da sua vida? Detalhes.',
    'Você já roubou algo? Não precisa ser grande coisa. Pode ser uma caneta. Confessa.',
    'Qual é o pensamento mais estranho que você já teve no meio da madrugada?',
  ];

  const confissao = confissoes[Math.floor(Math.random() * confissoes.length)];

  const encerramentos = [
    '💬 Responda aqui, sem julgamentos!',
    '👀 O grupo inteiro tá esperando...',
    '🫣 Pode falar. O que acontece no grupo, fica no grupo.',
    '😈 Coragem. É agora ou nunca.',
    '🤐 Solte essa verdade. Tá pesando, né?',
  ];

  const encerramento = encerramentos[Math.floor(Math.random() * encerramentos.length)];

  await sock.sendMessage(jid, {
    text: `🤐 *CONFISSÃO* 🤐\n\n_${confissao}_\n\n${encerramento}`,
  }, { quoted: msg });
}

// ─── !julgamento
async function handleJulgamento(sock, msg, jid, author, content, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const julgamentos = [
    { emoji: '😇', texto: `*${display}* é uma pessoa incrível que todo mundo deveria conhecer. Suspeito, mas ok.` },
    { emoji: '🧐', texto: `*${display}* guarda segredos pesados. Aquele olhar diz muito. Demais, inclusive.` },
    { emoji: '🤡', texto: `*${display}* é o(a) mais engraçado(a) do grupo, mesmo sem querer. Especialmente sem querer.` },
    { emoji: '👑', texto: `*${display}* nasceu pra ser famoso(a). O mundo ainda não descobriu, mas tá chegando lá.` },
    { emoji: '🔥', texto: `*${display}* é atraente e sabe muito bem disso. Perigoso(a) demais pra esse grupo.` },
    { emoji: '🦥', texto: `*${display}* é preguiçoso(a) no limite, mas com um charme inexplicável que salva tudo.` },
    { emoji: '🐉', texto: `*${display}* tem energia de chefe final de videogame. Ninguém derrota fácil.` },
    { emoji: '🎭', texto: `*${display}* é ator/atriz nato(a). Ninguém do grupo sabe quando é real ou performance.` },
    { emoji: '🧠', texto: `*${display}* sabe de tudo e usa isso pra bem ou pra mal, dependendo do humor do dia.` },
    { emoji: '🌪️', texto: `*${display}* é um caos ambulante, mas de um jeito que o grupo não consegue viver sem.` },
    { emoji: '🐺', texto: `*${display}* parece quieto(a), mas tá sempre observando tudo. Cuidado.` },
    { emoji: '🎯', texto: `*${display}* fala pouco, mas quando fala acerta em cheio. Cruel e eficiente.` },
    { emoji: '🧲', texto: `*${display}* atrai confusão sem perceber. Os problemas chegam sozinhos.` },
    { emoji: '🫠', texto: `*${display}* parece que tá bem, mas por dentro é uma novela das nove completa.` },
    { emoji: '🦊', texto: `*${display}* é mais esperto(a) do que aparenta. Muito mais. Cuidado com esse(a).` },
  ];

  const { emoji, texto } = julgamentos[Math.floor(Math.random() * julgamentos.length)];

  const veredictos = [
    '_Julgamento arbitrário e definitivo. Sem recurso! 😂_',
    '_O tribunal decidiu. Não cabe apelação. 🔨_',
    '_Isso é a verdade e ponto final. 💀_',
    '_Assine embaixo. É isso mesmo. 📋_',
  ];

  const veredicto = veredictos[Math.floor(Math.random() * veredictos.length)];

  await sock.sendMessage(jid, {
    text: `⚖️ *JULGAMENTO DE ${display.toUpperCase()}* ⚖️\n\n${emoji} ${texto}\n\n${veredicto}`,
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
    `Podre demais! Até o lixo revirou o nariz pra *${display}*! 🗑️`,
    `*${display}* tão podre que o esgoto entrou em greve. 🚽`,
    `Que nível de podridão, *${display}*! Isso é quase uma conquista! 🤢`,
    `*${display}* podre com orgulho! Uma lenda da podridão que o grupo vai lembrar por anos! 💀`,
    `Completamente podre! *${display}* entrou pro hall da fama da imundície! 😒`,
    `Podridão no nível máximo! *${display}* superou todas as expectativas! 🏆`,
    `*${display}* tão podre que até o detergente desistiu. 🧴`,
    `A podridão de *${display}* foi catalogada pela ciência. Material raro. 🔬`,
    `*${display}* podre desde sempre, mas hoje bateu recorde pessoal. Parabéns. 🎊`,
    `Nem a maldição consegue chegar perto de *${display}*. Muito podre. 😈`,
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
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 21,
      emoji: '🦁',
      frases: [
        `*${display}* não tem nada de frango! Parte pra cima de qualquer coisa! 🔥`,
        `Zero franguice! *${display}* encararia o diabo de olho no olho. 😈`,
        `*${display}* ri na cara do perigo. Assustador. 🦁`,
        `Corajoso(a) demais! *${display}* faz desafio por esporte. Respeito total. 💪`,
      ],
    },
    {
      max: 41,
      emoji: '🐓',
      frases: [
        `*${display}* tem moral! Pouco frango, muito charme. 💪`,
        `Quase nada de franguice! *${display}* hesita às vezes, mas vai assim mesmo. 🐓`,
        `*${display}* pensa dois segundos antes de encarar, mas encarar enfrenta. Respeito. 😤`,
        `Baixo índice de frango! *${display}* sabe quando lutar e quando fugir. 😅`,
      ],
    },
    {
      max: 61,
      emoji: '🐔',
      frases: [
        `*${display}* é meio a meio! Corajoso(a) quando quer, frango quando convém. 😅`,
        `50/50! *${display}* enfrenta os desafios... pequenos. Os grandes, depende do dia. 🐔`,
        `*${display}* tem coragem seletiva. Funciona quando não tem público. 😂`,
        `Na metade! *${display}* toparia o desafio, mas precisava de um tempinho pra pensar. 🤔`,
      ],
    },
    {
      max: 81,
      emoji: '🐣',
      frases: [
        `*${display}* foge de desafio mais rápido que entrega de Uber na chuva! 😂`,
        `Bastante frango(a)! *${display}* viu o desafio e já tava planejando a desculpa. 🐣`,
        `*${display}* fica branco(a) de medo com qualquer coisa fora do roteiro. 💀`,
        `Alto nível de franguice! *${display}* pesquisou "como sair de uma situação" antes de responder. 😬`,
      ],
    },
    {
      max: 100,
      emoji: '🐥',
      frases: [
        `MUITO frango(a)! *${display}* tem medo da própria sombra em dia nublado! 💀`,
        `*${display}* levou susto com notificação de desconhecido. Frango clínico. 😭`,
        `Nível crítico! *${display}* foge antes do perigo aparecer. Reflexo de frango puro. 🐥`,
        `*${display}* assistiu o trailer do desafio e já desistiu. Impressionante. 😂`,
      ],
    },
    {
      max: 101,
      emoji: '🍗',
      frases: [
        `100% FRANGO! *${display}* virou nugget de tanto medo! Passado, empanado e frito! 😭`,
        `RECORDE HISTÓRICO! *${display}* é o maior frango que esse grupo já viu! 🏆🍗`,
        `*${display}* chegou nos 100%! Até o frango de granja ficou com vergonha. 💀`,
        `Máximo absoluto! *${display}* não é frango, é galinheiro inteiro! 🐔🐔🐔`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟨');

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *FRANGUÍMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
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
    `*${display}* vai pisar em LEGO descalço(a) todo dia pelo resto da vida! 😱`,
    `*${display}* está condenado(a) a ter Wi-Fi lento exatamente na hora de mandar mensagem importante! 📵`,
    `Os carregadores de *${display}* vão quebrar sempre na hora mais crítica! 🔌`,
    `Uma música irritante vai ficar presa na cabeça de *${display}* por toda a eternidade! 🎵`,
    `*${display}* vai errar a cama toda vez que se jogar nela de noite! 🛏️`,
    `A bateria de *${display}* vai sempre chegar a 1% longe de qualquer tomada! 🔋`,
    `Todo sorvete de *${display}* vai cair antes da primeira lambida! 🍦`,
    `*${display}* vai chegar um minuto atrasado(a) pra tudo pelo resto da vida! ⏰`,
    `Os fones de *${display}* vão enrolar do nada pra sempre! 🎧`,
    `*${display}* vai morder a língua pelo menos uma vez por dia! 😬`,
    `*${display}* sempre vai mandar mensagem pra pessoa errada no pior momento! 📱`,
    `O dedo mindinho de *${display}* vai encontrar cada quina de móvel existente! 🦶`,
    `*${display}* vai abrir embalagem de salgadinho e ela vai rasgar pelo lado errado pra sempre! 🍿`,
    `*${display}* sempre vai esquecer o que ia falar exatamente quando abrir a boca! 🗣️`,
    `Toda vez que *${display}* deitar pra dormir, vai lembrar de uma vergonha de 10 anos atrás! 😳`,
    `*${display}* vai sempre colocar a roupa ao contrário na pressa! 👕`,
    `O último biscoito do pacote de *${display}* vai sempre quebrar dentro da embalagem! 🍪`,
  ];

  const maldicao = maldicoes[Math.floor(Math.random() * maldicoes.length)];

  const encerramentos = [
    '_Que o universo tenha piedade! 💀_',
    '_Está lançada. Sem volta. ☠️_',
    '_O destino anotou. Boa sorte. 🔮_',
    '_Rezem por *' + display + '*. Vai precisar. 😈_',
    '_Nem simpatia resolve isso. 💀_',
  ];

  const encerramento = encerramentos[Math.floor(Math.random() * encerramentos.length)];

  await sock.sendMessage(jid, {
    text: `🔮 *MALDIÇÃO DE ${display.toUpperCase()}* 🔮\n\n☠️ _${maldicao}_\n\n${encerramento}`,
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
    { emoji: '💎', texto: `*${display}* encontrará riqueza em um lugar completamente inesperado. Fique atento(a).` },
    { emoji: '😊', texto: `Uma alegria enorme está chegando pra *${display}* sem avisar. Prepare o coração.` },
    { emoji: '✨', texto: `O destino conspira completamente a favor de *${display}* agora. Não desperdice.` },
    { emoji: '🌟', texto: `Algo muito bom está prestes a acontecer com *${display}*. O universo já decidiu.` },
    { emoji: '🍀', texto: `A sorte está do lado de *${display}* hoje. Tudo que tentar vai fluir. Aproveite.` },
    { emoji: '❤️', texto: `Alguém especial vai aparecer na vida de *${display}* em breve. Os sinais já estão aí.` },
    { emoji: '📈', texto: `Uma oportunidade única está chegando pra *${display}*. Quem hesitar vai perder.` },
    { emoji: '🎁', texto: `Uma surpresa agradável está a caminho de *${display}*. Pode ser hoje mesmo.` },
    { emoji: '🌙', texto: `A noite reserva algo especial pra *${display}*. Não duerma cedo.` },
    { emoji: '🤝', texto: `Uma velha amizade vai se renovar na vida de *${display}*. Talvez mais do que amizade.` },
    { emoji: '🚀', texto: `*${display}* está prestes a dar um salto que vai surpreender todo mundo, inclusive você.` },
    { emoji: '🌊', texto: `Uma onda de mudança está chegando pra *${display}*. Surfe ou afunda. A escolha é sua.` },
    { emoji: '🎯', texto: `*${display}* vai acertar em cheio em algo que tentou antes e não deu certo. Tente de novo.` },
    { emoji: '🦋', texto: `Uma transformação silenciosa está acontecendo com *${display}*. Em breve todos vão notar.` },
    { emoji: '🔑', texto: `*${display}* vai encontrar a resposta que procura onde menos espera. Preste atenção.` },
  ];

  const { emoji, texto } = fortunas[Math.floor(Math.random() * fortunas.length)];

  const encerramentos = [
    '_O universo falou. Acredite._',
    '_O biscoito nunca mente. Confie._',
    '_Está escrito. É pra acontecer._',
    '_Guarda essa mensagem. Você vai lembrar dela._',
  ];

  const encerramento = encerramentos[Math.floor(Math.random() * encerramentos.length)];

  await sock.sendMessage(jid, {
    text: `🥠 *BISCOITO DA FORTUNA DE ${display.toUpperCase()}* 🥠\n\n${emoji} _${texto}_\n\n${encerramento}`,
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

  const faixas = [
    {
      max: 11,
      emoji: '💔',
      frases: [
        `Incompatíveis demais! *${author}* e *${nomeAlvo}* nem como vizinhos funcionariam. 😬`,
        `O universo disse não. *${author}* e *${nomeAlvo}* são forças opostas que não se atraem. 💔`,
        `*${author}* e *${nomeAlvo}* juntos? Os astros riram e voltaram a dormir. 😂`,
        `Menos de 10%! *${author}* e *${nomeAlvo}* dariam errado em qualquer dimensão paralela. 💀`,
      ],
    },
    {
      max: 31,
      emoji: '😅',
      frases: [
        `*${author}* e *${nomeAlvo}* são bem diferentes... mas impossível nunca é, né? Com muito esforço. 😅`,
        `Baixa compatibilidade. *${author}* e *${nomeAlvo}* precisariam de milagre e terapia. 🙏`,
        `*${author}* e *${nomeAlvo}* têm potencial zero, mas o coração é teimoso. Boa sorte. 😬`,
        `Difícil, mas não impossível. *${author}* e *${nomeAlvo}* só precisam de paciência infinita. ☕`,
      ],
    },
    {
      max: 51,
      emoji: '🤝',
      frases: [
        `*${author}* e *${nomeAlvo}* dão uma boa amizade! Romance é arriscado demais pra esse nível. 😅`,
        `50/50! *${author}* e *${nomeAlvo}* se dão bem, mas um relacionamento seria uma aposta. 🎲`,
        `*${author}* e *${nomeAlvo}* têm química de colega de trabalho. Funciona no horário comercial. 🤝`,
        `Na metade! *${author}* e *${nomeAlvo}* provavelmente já tiveram uma discussão estranha. Convivem bem assim mesmo. 😂`,
      ],
    },
    {
      max: 71,
      emoji: '💕',
      frases: [
        `Boa compatibilidade! *${author}* e *${nomeAlvo}* se combinam mais do que admitem. 😊`,
        `*${author}* e *${nomeAlvo}* têm futuro! Alguém precisa dar o primeiro passo. 💕`,
        `Acima da média! *${author}* e *${nomeAlvo}* provavelmente já pensaram nisso antes. 👀`,
        `*${author}* e *${nomeAlvo}* se completam de um jeito que o grupo já percebeu faz tempo. 😏`,
      ],
    },
    {
      max: 90,
      emoji: '💖',
      frases: [
        `Excelente match! *${author}* e *${nomeAlvo}* têm tudo pra dar muito certo! 🔥`,
        `*${author}* e *${nomeAlvo}* são compatíveis demais. Alguém tá fingindo não perceber. 💖`,
        `Alto nível! *${author}* e *${nomeAlvo}* foram feitos um pro outro e tão enrolando. 😤`,
        `*${author}* e *${nomeAlvo}* combinam tanto que dá inveja. O grupo aprova. 👏`,
      ],
    },
    {
      max: 100,
      emoji: '💗',
      frases: [
        `Quase almas gêmeas! *${author}* e *${nomeAlvo}* não pode deixar escapar isso! 😍`,
        `99%! *${author}* e *${nomeAlvo}* foram separados no nascimento e o destino quer reunir. 💗`,
        `*${author}* e *${nomeAlvo}* têm compatibilidade absurda! O 1% restante é só frescura. 😂`,
        `Praticamente perfeitos! *${author}* e *${nomeAlvo}* tão perdendo tempo separados. 💀`,
      ],
    },
    {
      max: 101,
      emoji: '💑',
      frases: [
        `100%! Almas gêmeas confirmadas! *${author}* e *${nomeAlvo}* casem logo! ✨`,
        `MÁXIMO ABSOLUTO! *${author}* e *${nomeAlvo}* foram escritos nas estrelas. Literalmente. 🌟`,
        `*${author}* e *${nomeAlvo}* são 100% compatíveis. O grupo vai ao casamento? 💒`,
        `Perfeitos um pro outro! *${author}* e *${nomeAlvo}* precisam parar de enrolar agora. 💑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const comentario = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];

  await sock.sendMessage(jid, {
    text: `💕 *COMPATIBILIDADE* 💕\n\n*${author}* ${faixa.emoji} *${nomeAlvo}*\n\n${barra} *${pct}%*\n\n_${comentario}_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── !trans
async function handleTrans(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '🚹',
      frases: [
        `*${display}* cisgênero raiz! Nem cogita, nem questiona! 💁`,
        `*${display}* é tão cis que acha que gênero é só duas opções. 😐`,
        `Zero trans! *${display}* nunca parou pra pensar nisso um segundo. 🚹`,
        `*${display}* ouviu falar de identidade de gênero e mudou de assunto. 💁`,
      ],
    },
    {
      max: 31,
      emoji: '🌸',
      frases: [
        `*${display}* tem uma curiosidade escondida que nunca admitiu pra ninguém. 👀`,
        `Baixo, mas não zero! *${display}* já ficou na frente do espelho por tempo demais. 🌸`,
        `*${display}* disse "não é comigo isso" mas pesquisou no modo anônimo depois. 😏`,
        `Uma pontinha de curiosidade ali! *${display}* sabe do que estamos falando. 👀`,
      ],
    },
    {
      max: 51,
      emoji: '🌈',
      frases: [
        `*${display}* na metade! O armário tá entreaberto e a luz entrou. 😏`,
        `50/50! *${display}* já teve uns pensamentos que guardou bem guardados. 🌈`,
        `*${display}* tá no meio do caminho. A transformação tá acontecendo devagar. ✨`,
        `Metade do caminho! *${display}* sabe mais sobre si mesmo(a) do que conta. 😌`,
      ],
    },
    {
      max: 71,
      emoji: '💅',
      frases: [
        `*${display}* já entregou a vibe há muito tempo, o grupo só não falou ainda. ✨`,
        `Bastante trans! *${display}* tem uma energia que não passa despercebida. 💅`,
        `*${display}* já ensaiou esse papo mentalmente várias vezes. Chegou a hora. 🌟`,
        `A vibe de *${display}* já contou tudo antes mesmo de abrir a boca. 😏`,
      ],
    },
    {
      max: 90,
      emoji: '🦋',
      frases: [
        `*${display}* quase 100%! A transformação é inevitável, é só questão de tempo. 🌟`,
        `*${display}* tá com 80 e poucos% e ainda tenta fingir que não. O grupo vê tudo. 🦋`,
        `Quase lá! *${display}* só precisa de um empurrãozinho pra ser quem é de verdade. ✨`,
        `*${display}* tá na beira do penhasco da autenticidade. Pula logo! 🦋`,
      ],
    },
    {
      max: 100,
      emoji: '🏳️‍⚧️',
      frases: [
        `Praticamente confirmado(a)! *${display}*, para de enrolar e se assume! 🎉`,
        `99%! *${display}* só não assumiu porque ainda tá escolhendo o nome. 😂`,
        `*${display}* com 99%! O único 1% que falta é a coragem de falar em voz alta. 🏳️‍⚧️`,
        `*${display}* quase no topo! O grupo inteiro já sabe, só você ainda não disse. 🎊`,
      ],
    },
    {
      max: 101,
      emoji: '👑',
      frases: [
        `100% TRANS! *${display}* é rainha/rei absoluto(a)! Orgulhe-se! 🎊`,
        `MÁXIMO! *${display}* chegou no 100% e o armário virou pó! 👑`,
        `*${display}* zerou o transômetro! Lenda confirmada! O grupo aplaude! 👏🌈`,
        `100%! *${display}* não é do armário, é da passarela! 🎉👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct);

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *TRANSÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !corno
async function handleCorno(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '😇',
      frases: [
        `*${display}* fidelíssimo(a)! Nem em pensamento trai! 🕊️`,
        `Zero corno! *${display}* é leal até demais. Assustador. 😇`,
        `*${display}* nem sabe o que é isso. Inocência absoluta. 🕊️`,
        `*${display}* tão fiel que o parceiro(a) nem merece. 😇`,
      ],
    },
    {
      max: 31,
      emoji: '🤔',
      frases: [
        `*${display}* tem uns olhares suspeitos mas nada confirmado ainda... 👀`,
        `Baixo, mas não zero! *${display}* já flertou por cima sem contar pra ninguém. 🤔`,
        `*${display}* disse "somos só amigos" com muita convicção. Demais, até. 😏`,
        `O chifre de *${display}* ainda é invisível, mas tem quem jure que viu um brotinho. 🌱`,
      ],
    },
    {
      max: 51,
      emoji: '👀',
      frases: [
        `*${display}* na média! O chifre tá nascendo devagarzinho! 🌱`,
        `50/50! *${display}* tem umas situações inexplicáveis no histórico. 👀`,
        `*${display}* jura que foi só um momento fraco. Todo mundo diz isso. 😬`,
        `Na metade! *${display}* tá no caminho clássico do corno moderno. 😂`,
      ],
    },
    {
      max: 71,
      emoji: '🦌',
      frases: [
        `Chifre já aparecendo! O grupo sabe de tudo menos *${display}*! 😂`,
        `*${display}* já tem o chifre visível e ainda acha que ninguém notou. 🦌`,
        `O grupo todo já viu o chifre de *${display}*. Falta avisar o(a) próprio(a). 😅`,
        `*${display}* tá com chifre e carrega o celular do parceiro(a) sem questionar. 💀`,
      ],
    },
    {
      max: 90,
      emoji: '🐂',
      frases: [
        `CORNO(A) ASSUMIDO(A)! Os chifres de *${display}* já tão enormes! 🍵`,
        `*${display}* entrou no nível avançado! Já precisou abaixar a cabeça pra passar na porta. 😂`,
        `Alto nível! *${display}* tem chifre de fazer inveja em boi de fazenda. 🐂`,
        `*${display}* já virou referência no assunto dentro do grupo. Tragicamente. 💀`,
      ],
    },
    {
      max: 100,
      emoji: '☠️',
      frases: [
        `*${display}* precisa de capacete especial por causa do tamanho dos chifres! 💀`,
        `99%! *${display}* é lenda viva! O chifre já aparece no Google Maps. ☠️`,
        `*${display}* quase no topo! Os chifres já têm nome e sobrenome. 😂`,
        `*${display}* tá com 99% e ainda manda "boa noite amor" todo dia. Respeito torto. 💀`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100% CORNO(A)! *${display}* é campeão(ã) absoluto(a) do chifre! Hall da fama! 🎊`,
        `RECORDE HISTÓRICO! *${display}* zerou o cornômetro! O grupo chora de respeito. 🏆`,
        `*${display}* chegou nos 100%! Os chifres já têm página própria na internet. 💀🎊`,
        `Máximo absoluto! *${display}* não carrega chifre, carrega um galho de árvore na cabeça. 🌳😂`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟫');

  await sock.sendMessage(jid, {
    text: `🦌 *CORNÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !gado
async function handleGado(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '😎',
      frases: [
        `*${display}* tem total controle! Não faz nada que não queira. Respeito. 😎`,
        `Zero gado! *${display}* é independente demais. A mulher que corra atrás. 💅`,
        `*${display}* nem lembra o nome da ex. Blindado(a) completamente. 🧊`,
        `Nenhum sinal de gadice em *${display}*. Esse(a) manda no próprio nariz. 😤`,
      ],
    },
    {
      max: 31,
      emoji: '🤨',
      frases: [
        `*${display}* já cancelou plano com os amigos "só uma vez" por causa dela. Só uma. 👀`,
        `Baixo, mas já tem umas atitudes suspeitas! *${display}* tá no caminho... 🤨`,
        `*${display}* disse "não sou gado" enquanto respondia mensagem em 3 segundos. 📱`,
        `Ainda controlado(a), mas *${display}* já deixou de sair pra ficar de chamada. Sinal amarelo. 🟡`,
      ],
    },
    {
      max: 51,
      emoji: '🐄',
      frases: [
        `*${display}* na média! Já muda de humor dependendo do status dela no WhatsApp. 📱`,
        `50/50! *${display}* nega que é gado mas o histórico conta outra história. 😂`,
        `*${display}* já ficou acordado(a) até as 3h esperando resposta. Clássico. 🌙`,
        `Na metade! *${display}* ainda resiste, mas a gadice tá aflorando devagarzinho. 🐄`,
      ],
    },
    {
      max: 71,
      emoji: '🐮',
      frases: [
        `Gado em evolução! *${display}* já pagou conta de restaurante sem nem ser convidado(a). 💸`,
        `*${display}* já mandou "bom dia amor" sem receber resposta por 3 dias seguidos. 🌅`,
        `O grupo todo sabe que *${display}* é gado. Só *${display}* acha que tá se segurando. 😅`,
        `*${display}* já disse "ela é diferente" pra justificar tudo. Todo gado diz isso. 🐮`,
      ],
    },
    {
      max: 90,
      emoji: '🐂',
      frases: [
        `GADO RAÇUDO! *${display}* já fez coisa que nem a própria mãe acreditaria. 💀`,
        `*${display}* cancelou viagem com os amigos porque ela ficou de mau humor. Trágico. 🐂`,
        `Alto nível! *${display}* já pediu desculpa sem saber nem o que fez de errado. 😂`,
        `*${display}* já passou horas escrevendo mensagem, apagou tudo e mandou "oi". Gadão(ona). 💀`,
      ],
    },
    {
      max: 100,
      emoji: '☠️',
      frases: [
        `*${display}* quase no topo! Já transferiu dinheiro pra ela com coração na descrição. 💸☠️`,
        `99%! *${display}* é referência de gadice no grupo. Lenda trágica. 😂`,
        `*${display}* já abriu mão de emprego, amigos e dignidade. Tudo por amor. ☠️`,
        `*${display}* tá com 99% e ainda manda "você é tudo pra mim" sem resposta. Icônico. 💀`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100% GADO(A)! *${display}* é o(a) maior(a) de todos! Hall da fama da gadice! 🎊🐄`,
        `RECORDE HISTÓRICO! *${display}* zerou o gadômetro! O grupo chora de respeito. 🏆`,
        `*${display}* chegou nos 100%! Já tem estátua de gado no quintal em homenagem. 💀🎊`,
        `Máximo absoluto! *${display}* não é gado, é rebanho inteiro numa pessoa só. 🐄🐄🐄😂`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟤');

  await sock.sendMessage(jid, {
    text: `🐄 *GADÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !peitudo
async function handlePeitudo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '🫓',
      frases: [
        `*${display}* plano(a) como prancha de surf! A tábua de passar roupa chora de inveja! 😂`,
        `*${display}* tão plano(a) que o nível de pedreiro usa como referência. 😭`,
        `Zero! *${display}* não tem nada ali, mas carrega com dignidade. Respeito. 🫓`,
        `*${display}* é aerodimânimco(a) pelo menos! Sem resistência nenhuma ali. 😂`,
      ],
    },
    {
      max: 31,
      emoji: '🍑',
      frases: [
        `*${display}* quase nada, mas tem um potencial enorme aí! 👀`,
        `Pouco, mas presente! *${display}* tá no início da jornada. 🍑`,
        `*${display}* tem o suficiente pra despertar a imaginação de alguém. 😏`,
        `Tem ali, sim! *${display}* não precisa reclamar, precisa de sutiã com certo. 👀`,
      ],
    },
    {
      max: 51,
      emoji: '🍈',
      frases: [
        `*${display}* na média! Nem muito nem pouco, tá equilibrado(a). 🍈`,
        `Mediano! *${display}* não impressiona, mas não decepciona. Respeitável. 😌`,
        `*${display}* na curva da normalidade! Sem reclamações do público. 😄`,
        `50/50! *${display}* tem exatamente o que precisa ter. Eficiente. 🍈`,
      ],
    },
    {
      max: 71,
      emoji: '🍉',
      frases: [
        `*${display}* considerável! O grupo já notou e fingiu que não! 😏`,
        `Acima da média! *${display}* tem mais que o básico e todo mundo sabe. 🍉`,
        `*${display}* tá bem servido(a)! Nem precisa forçar a barra pra aparecer. 😄`,
        `O peitômetro aprova *${display}*! Bem acima da concorrência. 👏`,
      ],
    },
    {
      max: 90,
      emoji: '🎯',
      frases: [
        `*${display}* muito abençoado(a)! A natureza foi generosa demais! 🙌`,
        `*${display}* tá no nível que causa distração visual involuntária. 😅`,
        `Alto nível! *${display}* precisa de engenharia estrutural séria. 🏗️`,
        `*${display}* tão abençoado(a) que até os inimigos param pra olhar. 😂`,
      ],
    },
    {
      max: 100,
      emoji: '🏋️',
      frases: [
        `ABSURDO! *${display}* precisa de suporte estrutural que a engenharia ainda não inventou! 💀`,
        `*${display}* tá em 99%! As costas pedem socorro toda manhã! 😭`,
        `*${display}* quase no máximo! Causa impacto ambiental de tão abençoado(a). 💀`,
        `99%! *${display}* precisou reforçar o rodapé da casa por segurança. 😂`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100% PEITUDO(A)! *${display}* é lenda confirmada do grupo! 🎊`,
        `MÁXIMO HISTÓRICO! *${display}* zerou o peitômetro! A natureza se superou! 🏆`,
        `*${display}* chegou nos 100%! Patrimônio imaterial da humanidade. 🎊`,
        `100%! *${display}* deveria ter placa de "cuidado, curva perigosa". 😂🏆`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟪');

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *PEITÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !pauzudo
async function handlePauzudo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const cm      = Math.floor(Math.random() * 31) + 5;
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 9,
      emoji: '🔍',
      frases: [
        `*${display}* precisa de lupa pra achar! Nem a ciência confirma a existência! 😭`,
        `*${display}* com ${cm}cm! O microscópio tá disponível se precisar. 🔬`,
        `Pequeno mas honesto! *${display}* carrega com dignidade o que a natureza deu. 😅`,
        `*${display}* com ${cm}cm! Dizem que o que importa é a technique. Dizem. 😬`,
      ],
    },
    {
      max: 13,
      emoji: '🌭',
      frases: [
        `*${display}* com ${cm}cm! Modesto, mas presente e funcionando! 😅`,
        `*${display}* na faixa do razoável! Sem vergonha, sem ostentação. 🌭`,
        `${cm}cm pra *${display}*! Cumpre o papel com dedicação. 😄`,
        `*${display}* não impressiona no papel, mas dizem que ao vivo é melhor. 🌭`,
      ],
    },
    {
      max: 17,
      emoji: '🍌',
      frases: [
        `*${display}* com ${cm}cm! Na média nacional, sem reclamações registradas! 🍌`,
        `${cm}cm! *${display}* tá exatamente onde a estatística esperava. Confiável. 😌`,
        `*${display}* na curva normal! Nem surpreende nem decepciona. Sólido. 🍌`,
        `${cm}cm pra *${display}*! A média existe por causa de pessoas assim. 😄`,
      ],
    },
    {
      max: 22,
      emoji: '🥖',
      frases: [
        `*${display}* com ${cm}cm! Acima da média e o pessoal do grupo já comentou! 😏`,
        `${cm}cm! *${display}* tá bem servido(a) e sabe disso. 🥖`,
        `*${display}* acima da concorrência com ${cm}cm! Sem precisar anunciar. 😏`,
        `${cm}cm pra *${display}*! A natureza foi um pouco mais generosa aqui. 👌`,
      ],
    },
    {
      max: 28,
      emoji: '🏗️',
      frases: [
        `ABSURDO! *${display}* com ${cm}cm! A natureza foi muito generosa demais! 🙌`,
        `*${display}* chegou nos ${cm}cm! Isso é quase problema logístico. 😂`,
        `${cm}cm! *${display}* precisa de aviso prévio antes de entrar em qualquer lugar. 😅`,
        `*${display}* com ${cm}cm! A física newtoniana precisa ser revisada. 🏗️`,
      ],
    },
    {
      max: 34,
      emoji: '☠️',
      frases: [
        `*${display}* com ${cm}cm! Nível lendário! Precisa de licença especial pra circular! 💀`,
        `${cm}cm! *${display}* virou mito urbano! O grupo vai contar isso pra netos! 😱`,
        `*${display}* com ${cm}cm! Isso é patrimônio, não é órgão. ☠️`,
        `${cm}cm! *${display}* deveria pagar IPTU por isso. Ocupa área demais. 💀`,
      ],
    },
    {
      max: 999,
      emoji: '🏆',
      frases: [
        `*${display}* com ${cm}cm! Entrou pro hall da fama da humanidade! 🎊`,
        `${cm}cm! *${display}* é fenômeno da natureza! A ciência quer estudar! 🏆`,
        `*${display}* com ${cm}cm! Isso não é biologia, isso é arquitetura! 🎊`,
        `${cm}cm pra *${display}*! Lenda confirmada. O grupo nunca mais vai ser o mesmo. 👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => cm < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(Math.round((cm / 35) * 100), '🟦');

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *PAUZÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${cm} cm*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !bundudo
async function handleBundudo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '🫓',
      frases: [
        `*${display}* plano(a) como tábua de passar roupa! A cadeira sente falta de contato. 😂`,
        `*${display}* não tem nada ali atrás! Desce escada sentado(a) e nem sente. 😭`,
        `Zero bunda! *${display}* de costas some de vista. Tragédia silenciosa. 💀`,
        `*${display}* tão plano(a) atrás que parece renderizado(a) em baixa resolução. 😂`,
      ],
    },
    {
      max: 31,
      emoji: '🍑',
      frases: [
        `*${display}* tem uma promessa ali atrás! Precisa trabalhar mais, mas tem base. 💪`,
        `Pouco, mas surgindo! *${display}* precisa de agachamento e fé. 🍑`,
        `*${display}* tem o embrião de uma bunda. Potencial enorme! 😏`,
        `Tem alguma coisa nascendo ali! *${display}* não desiste e vai chegar lá. 💪`,
      ],
    },
    {
      max: 51,
      emoji: '🫐',
      frases: [
        `*${display}* na média! Passável no agachamento e no rolê. 🫐`,
        `50/50! *${display}* não chama atenção mas tampona a cadeira direitinho. 😄`,
        `*${display}* mediano(a)! A bunda existe, cumpre o papel, sem drama. 😌`,
        `Na média! *${display}* não vai virar meme mas também não decepciona. 🫐`,
      ],
    },
    {
      max: 71,
      emoji: '🎯',
      frases: [
        `*${display}* bundão(ona) considerável! O grupo já aprovou sem falar nada! 👏`,
        `Acima da média! *${display}* quando vira de costas o ambiente muda. 😏`,
        `*${display}* bem servido(a) atrás! Preenche qualquer cadeira com autoridade. 🎯`,
        `O bundômetro aprova *${display}*! Tá acima da concorrência e sabe. 😏`,
      ],
    },
    {
      max: 90,
      emoji: '🏋️',
      frases: [
        `*${display}* muito abençoado(a)! Preenche qualquer cadeira e ainda sobra! 🙌`,
        `*${display}* tá no nível que causa distração quando anda à frente. 😅`,
        `Alto nível! *${display}* precisa de calça personalizada, nenhuma serve direito. 😂`,
        `*${display}* tão bem servido(a) que a calça jeans chora na hora de vestir. 💀`,
      ],
    },
    {
      max: 100,
      emoji: '🚨',
      frases: [
        `PERIGOSO(A)! *${display}* causa acidente de trânsito só de atravessar a rua! 💀`,
        `*${display}* com 99%! A calça nunca fechou direito na vida toda. 😭`,
        `*${display}* quase no máximo! O sismógrafo registra quando senta. 😂`,
        `99%! *${display}* precisaria de alvará pra circular em área pública. 🚨`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100% BUNDUDO(A)! *${display}* é patrimônio nacional declarado! 🎊`,
        `MÁXIMO! *${display}* zerou o bundômetro! A humanidade agradece. 🏆`,
        `*${display}* chegou nos 100%! Isso não é bunda, é obra de arte. 🎊`,
        `100%! *${display}* quando entra num cômodo, a bunda entra primeiro e apresenta o dono(a). 😂👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟤');

  await sock.sendMessage(jid, {
    text: `🍑 *BUNDÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !gordo
async function handleGordo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const display = mentionedJid ? nome : author;

  const kg = Math.floor(Math.random() * 271) + 30; // 30kg até 300kg

  const faixas = [
    {
      max: 50,
      emoji: '🥢',
      frases: [
        `*${display}* com apenas *${kg}kg*! Some de vista se ficar de lado! 😭`,
        `*${display}* tão magro(a) que o vento leva! ${kg}kg é quase invisível! 😱`,
        `${kg}kg! *${display}* é basicamente esqueleto com pele fina. Come alguma coisa! 😭`,
        `*${display}* tão fino(a) que escorrega pelo ralo com ${kg}kg. Alguém chama o SAMU. 💀`,
      ],
    },
    {
      max: 70,
      emoji: '🥗',
      frases: [
        `*${display}* com ${kg}kg! Fitness total! Provavelmente conta caloria e dorme cedo. 🏃`,
        `${kg}kg! *${display}* na linha! Aquele tipo que lê rótulo de tudo antes de comer. 🥗`,
        `*${display}* com ${kg}kg! Magro(a) e saudável, chato(a) na mesa mas bonito(a) no espelho. 😂`,
        `${kg}kg! *${display}* treina, come clean e julga o resto do grupo em silêncio. 🥗`,
      ],
    },
    {
      max: 90,
      emoji: '🍔',
      frases: [
        `*${display}* com ${kg}kg! Na média! Come bem, sem exagero, sem culpa. Equilíbrio raro. 🍔`,
        `${kg}kg! *${display}* faz dieta segunda-feira e esquece na terça. Humano. 😄`,
        `*${display}* com ${kg}kg! Tem um relacionamento complicado com a balança. 😅`,
        `${kg}kg! Semana que conta caloria, fim de semana que esquece tudo. Clássico *${display}*. 😂`,
      ],
    },
    {
      max: 110,
      emoji: '🍕',
      frases: [
        `*${display}* com ${kg}kg! O rodízio já chama pelo nome! 😏`,
        `${kg}kg! A calça tá apertando mas ainda fecha. *${display}* na luta. 🍕`,
        `*${display}* tá engordando com classe! ${kg}kg com charme. 😄`,
        `${kg}kg! O garçom do rodízio já reconhece *${display}* de longe. Frequência suspeita. 😂`,
      ],
    },
    {
      max: 140,
      emoji: '🌮',
      frases: [
        `*${display}* com ${kg}kg! Gorducho(a) gostoso(a)! Cheinho(a) de vida e sem remorso! 🤭`,
        `${kg}kg! O buffet já reserva um espaço especial pra *${display}*. 😂`,
        `*${display}* com ${kg}kg! Aquela gordura boa, de quem curte a vida. 🌮`,
        `${kg}kg! *${display}* tem mais pra amar! O grupo concorda por unanimidade. 🤭`,
      ],
    },
    {
      max: 200,
      emoji: '🐘',
      frases: [
        `*${display}* com ${kg}kg! Bota o buffet no prejuízo toda vez que aparece! 💀`,
        `${kg}kg! A cadeira faz uma oração antes de receber *${display}*. 😭`,
        `*${display}* com ${kg}kg! O elevador já pediu reforço estrutural. 💀`,
        `${kg}kg! A silhueta de *${display}* já tem CEP próprio. Imponente. 😂`,
      ],
    },
    {
      max: 999,
      emoji: '🏆',
      frases: [
        `*${display}* com ABSURDOS ${kg}kg! Lenda dos rodízios! Patrimônio da culinária! 🎊`,
        `${kg}kg! A balança de *${display}* pediu demissão e foi embora. 🏆`,
        `*${display}* com ${kg}kg! Tem mesa cativa em todo restaurante da cidade. 🎊`,
        `${kg}kg! *${display}* não entra no quarto, o quarto é que se abre pra receber. 😂👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => kg < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *GORDÔMETRO DE ${display.toUpperCase()}*\n\n⚖️ *${kg} kg*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !cuzudo
async function handleCuzudo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const { alvoJid, mentionedJid, nome } = getAlvo(contextInfo, senderJid, contactNames);
  const pct     = Math.floor(Math.random() * 101);
  const display = mentionedJid ? nome : author;

  const faixas = [
    {
      max: 11,
      emoji: '😇',
      frases: [
        `*${display}* santinho(a)! Nem sabe o que é isso e vai continuar assim. 😇`,
        `Zero! *${display}* corou só de ler a pergunta. Inocência pura. 🕊️`,
        `*${display}* tão recatado(a) que fechou os olhos na cena do filme. 😇`,
        `*${display}* não tem histórico nessa área. O currículo tá em branco. 😂`,
      ],
    },
    {
      max: 31,
      emoji: '🤫',
      frases: [
        `*${display}* discreto(a), mas tem uma história aí que nunca contou pro grupo. 👀`,
        `*${display}* baixo perfil, mas o olhar entregou que não é tão inocente assim. 🤫`,
        `*${display}* tem um capítulo escondido no histórico. O grupo desconfia. 😏`,
        `Pouco, mas não zero! *${display}* sabe mais do que deixa aparecer. 😬`,
      ],
    },
    {
      max: 51,
      emoji: '😏',
      frases: [
        `*${display}* na média! O grupo desconfia mas não tem prova concreta ainda. 😏`,
        `50/50! *${display}* tem umas histórias que conta pela metade e para no clímax. 😂`,
        `*${display}* mediano(a)! Fez, não arrependeu, mas também não ostenta. 😌`,
        `Na metade! *${display}* é do tipo que sabe o que fez e não conta pra ninguém. 🤫`,
      ],
    },
    {
      max: 71,
      emoji: '🔥',
      frases: [
        `*${display}* já tem fama no pedaço! Todo mundo do grupo já ouviu algo. 😂`,
        `*${display}* acima da média e sem vergonha nenhuma disso! 🔥`,
        `*${display}* tem histórias que fariam o grupo tomar água. Conta logo. 😏`,
        `O cuzômetro não mente! *${display}* tem currículo e experiência confirmada. 😂`,
      ],
    },
    {
      max: 90,
      emoji: '😈',
      frases: [
        `*${display}* nível avançado! Uma lenda viva dentro desse grupo! 😈`,
        `*${display}* tá no alto nível! As histórias que correm por aí são impressionantes. 🔥`,
        `*${display}* tem currículo extenso e referências excelentes. Impressionante. 😂`,
        `*${display}* deveria dar palestra. O nível de experiência é incomparável. 😈`,
      ],
    },
    {
      max: 100,
      emoji: '☠️',
      frases: [
        `ABSURDO! *${display}* deveria estar fichado(a) em algum lugar oficial! 💀`,
        `*${display}* com 99%! Tem um arquivo secreto que ninguém do grupo viu completo. ☠️`,
        `*${display}* quase no topo! A Interpol já ouviu falar, com certeza. 😂`,
        `99%! *${display}* tem mais histórias que a Netflix consegue produzir. 💀`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100% CUZUDO(A)! *${display}* campeão(ã) absoluto(a)! Hall da fama eterno! 🎊`,
        `MÁXIMO! *${display}* zerou o cuzômetro! A humanidade se curva! 🏆`,
        `*${display}* chegou nos 100%! Isso vai pro livro de recordes do grupo. 🎊`,
        `100%! *${display}* não tem currículo, tem enciclopédia. Vários volumes. 😂👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];
  const barra = buildBar(pct, '🟥');

  await sock.sendMessage(jid, {
    text: `${faixa.emoji} *CUZÔMETRO DE ${display.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !sexo
async function handleSexo(sock, msg, content, jid, author, contactNames) {
  const contextInfo  = content?.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid?.[0] || null;

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '🔥 Marca alguém!\nExemplo: *!sexo @fulano*',
    }, { quoted: msg });
    return;
  }

  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (mentionedJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, {
      text: '😂 Narcisista! Você não pode fazer isso consigo mesmo(a)! 💀',
    }, { quoted: msg });
    return;
  }

  const nomeAlvo = contactNames?.[mentionedJid] || `@${mentionedJid.split('@')[0]}`;
  const pct      = Math.floor(Math.random() * 101);
  const barra    = buildBar(pct, '🟥');

  const faixas = [
    {
      max: 11,
      emoji: '😇',
      frases: [
        `*${author}* e *${nomeAlvo}* são tão inocentes que dormem de mãos dadas e acham que foi longe demais. 🕊️`,
        `*${author}* e *${nomeAlvo}* se tocaram por acidente e pediram desculpa três vezes. 😇`,
        `*${author}* mandou um "oi" pra *${nomeAlvo}* e já achou que era demais. Puro demais pra esse mundo. 💀`,
        `*${author}* e *${nomeAlvo}* acham que beijo na boca é coisa séria. É quase que literalmente nada rolou. 😂`,
      ],
    },
    {
      max: 26,
      emoji: '🥺',
      frases: [
        `*${author}* e *${nomeAlvo}* ficaram a sós uma vez e o máximo que rolou foi uma mão no joelho. 😅`,
        `*${author}* colocou a mão no ombro de *${nomeAlvo}* e os dois ficaram vermelhos. Quase nada. 🥺`,
        `*${author}* e *${nomeAlvo}* chegaram perto... mas alguém disse "tá tarde" e foi embora. Clássico. 😂`,
        `*${author}* e *${nomeAlvo}* trocaram um beijo rápido e ficaram uma semana sem se falar de vergonha. 😬`,
      ],
    },
    {
      max: 46,
      emoji: '😏',
      frases: [
        `*${author}* e *${nomeAlvo}* ficaram num canto escuro da festa. O que rolou lá, ficou lá... ou não. 😏`,
        `*${author}* e *${nomeAlvo}* "só conversaram" por duas horas com a porta fechada. Tá bom. 👀`,
        `Rolou um esquenta entre *${author}* e *${nomeAlvo}*, mas alguém deu frio na barriga na hora H. 😂`,
        `*${author}* e *${nomeAlvo}* foram "só tomar uma água" e voltaram meia hora depois com o cabelo desarrumado. 🔥`,
      ],
    },
    {
      max: 66,
      emoji: '🔥',
      frases: [
        `*${author}* e *${nomeAlvo}* têm uma história que o grupo inteiro quer ouvir mas nenhum dos dois conta completo. 🔥`,
        `*${author}* e *${nomeAlvo}* quando ficam no mesmo cômodo o termômetro sobe sozinho. 😅`,
        `*${author}* e *${nomeAlvo}* já passaram de conversa faz muito tempo. O grupo sabe, só finge que não. 😏`,
        `*${author}* sumiu com *${nomeAlvo}* numa festa e ninguém perguntou onde foram porque já sabiam. 😂🔥`,
      ],
    },
    {
      max: 81,
      emoji: '😈',
      frases: [
        `*${author}* e *${nomeAlvo}* têm mais capítulos que a bíblia e nenhum é PG-13. 😈`,
        `*${author}* e *${nomeAlvo}* quando somem juntos, o grupo já manda mensagem perguntando "vai demorar?". 😂`,
        `*${author}* e *${nomeAlvo}* têm um histórico tão longo que precisaria de índice remissivo pra organizar. 🔥`,
        `*${author}* e *${nomeAlvo}* já esgotaram o assunto em todos os cômodos possíveis. Várias vezes. 😈`,
      ],
    },
    {
      max: 96,
      emoji: '☠️',
      frases: [
        `*${author}* e *${nomeAlvo}* são lendas! As histórias chegaram no grupo antes deles. ☠️`,
        `*${author}* e *${nomeAlvo}* deveriam pagar royalties pro grupo pelo entretenimento que proporcionam. 💀`,
        `O que *${author}* e *${nomeAlvo}* já fizeram juntos daria pra envergonhar até quem acha que viu de tudo. 😂☠️`,
        `*${author}* e *${nomeAlvo}* quebraram recordes que o grupo nem sabia que existiam. A ciência registrou. 💀🔥`,
      ],
    },
    {
      max: 101,
      emoji: '🏆',
      frases: [
        `100%! *${author}* e *${nomeAlvo}* são campeões absolutos! O grupo aplaude de pé e com respeito! 🎊🏆`,
        `RECORDE HISTÓRICO! *${author}* e *${nomeAlvo}* zeraram o medidor! Isso vai pro folclore do grupo pra sempre. 💀`,
        `*${author}* e *${nomeAlvo}* chegaram nos 100%! Nesse ponto já não tem mais nada a esconder do grupo. 🎊`,
        `Máximo absoluto! *${author}* e *${nomeAlvo}* não precisam de apresentação. O currículo fala por si só. 😂👑`,
      ],
    },
  ];

  const faixa = faixas.find(f => pct < f.max);
  const frase = faixa.frases[Math.floor(Math.random() * faixa.frases.length)];

  await sock.sendMessage(jid, {
    text:
      `${faixa.emoji} *SEXÔMETRO* ${faixa.emoji}\n\n` +
      `*${author}* 🔥 *${nomeAlvo}*\n\n` +
      `${barra} *${pct}%*\n\n` +
      `_${frase}_`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

module.exports = {
  handleGay,
  handleGado,
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
  handleTrans,
  handleCorno,
  handlePeitudo,
  handlePauzudo,
  handleBundudo,
  handleGordo,
  handleCuzudo,
  handleSexo,
  handleBucetudo,
};