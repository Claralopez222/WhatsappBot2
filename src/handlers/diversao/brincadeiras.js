/**
 * Handler de Brincadeiras — Piroquinhas Bot
 * Funções divertidas: Gay, Sexo, Nazista, Lesbica, Aura, Dado, Moeda, 8Ball, etc.
 */

// ─── !gay
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
  else                { emoji = '🏆🌈'; frase = '100% GAY! Parabéns campeão(ã)! Orgulhe-se! 🎊'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *GAYÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !sexo
async function handleSexo(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém!\nExemplo: *!sexo @fulano*' }, { quoted: msg });
    return;
  }

  const alvoJid = mentionedJid[0];
  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    await sock.sendMessage(jid, { text: '😂 Sozinho(a) não conta! 💀' }, { quoted: msg });
    return;
  }

  const alvo = `@${alvoJid.split('@')[0]}`;
  const pct = Math.floor(Math.random() * 101);
  
  let comentario;
  if (pct < 30) comentario = `*${author}* tentou chegar em *${alvo}* e levou um fora memorável! 😭`;
  else if (pct < 70) comentario = `*${author}* e *${alvo}* tiveram um momento, mas nada de mais! 😏`;
  else comentario = `*${author}* e *${alvo}* fizeram bastante barulho na noite passada... que escândalo! 🔥`;

  await sock.sendMessage(jid, {
    text: `💋 *CIFRA DE ATRAÇÃO: ${pct}%*\n\n${comentario}`,
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ─── !nazista
async function handleNazista(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '🕊️'; frase = 'Pacifista! Nem mata mosquito!'; }
  else if (pct <= 50) { emoji = '⚖️'; frase = 'Equilibrado, mas com ideias fortes.'; }
  else if (pct <= 89) { emoji = '⚔️'; frase = 'Caralho! Muito opiniático(a)!'; }
  else                { emoji = '🦅'; frase = '100%! Ditador(a) confirmado(a)!'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *NAZÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*\n\n_${frase}_`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !lesbica
async function handleLesbica(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 10)      { emoji = '👭'; frase = 'Hetero assumida!'; }
  else if (pct <= 50) { emoji = '🌈'; frase = 'Na metade do caminho!'; }
  else if (pct <= 89) { emoji = '💅'; frase = 'Muito assumida!'; }
  else                { emoji = '🏆'; frase = '100%! Rainha!'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *LESBÔMETRO DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !aura
async function handleAura(sock, msg, content, jid, author, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid = mentionedJid[0] || senderJid;
  const pct = Math.floor(Math.random() * 101);

  let emoji, frase;
  if (pct <= 20)      { emoji = '😈'; frase = 'AURA PODRE! 👹'; }
  else if (pct <= 50) { emoji = '😐'; frase = 'Aura neutra.'; }
  else if (pct <= 89) { emoji = '✨'; frase = 'Aura brilhante!'; }
  else                { emoji = '👼'; frase = 'AURA MÁXIMA! 🙏'; }

  const filled = Math.round(pct / 10);
  const barra = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const nome = mentionedJid[0] ? `@${alvoJid.split('@')[0]}` : author;

  await sock.sendMessage(jid, {
    text: `${emoji} *AURA DE ${nome.toUpperCase()}*\n\n${barra} *${pct}%*`,
    mentions: mentionedJid[0] ? [alvoJid] : [],
  }, { quoted: msg });
}

// ─── !dado
async function handleDado(sock, msg, jid, caption) {
  const resultado = Math.floor(Math.random() * 6) + 1;
  await sock.sendMessage(jid, { text: `🎲 Você rolou: *${resultado}*` }, { quoted: msg });
}

// ─── !moeda
async function handleMoeda(sock, msg, jid) {
  const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
  await sock.sendMessage(jid, { text: `🪙 Resultado: *${resultado}*` }, { quoted: msg });
}

// ─── !8ball
async function handle8ball(sock, msg, jid, caption) {
  const respostas = [
    'Sim, com certeza!', 'Não, definitivamente não.', 'Talvez...', 'Pergunte novamente.',
    'Muito provável!', 'Não é provável.', 'Quem sabe?', 'Sem dúvida!',
  ];
  const resp = respostas[Math.floor(Math.random() * respostas.length)];
  await sock.sendMessage(jid, { text: `🎱 *${resp}*` }, { quoted: msg });
}

// ─── !verdadeoudesafio
async function handleVerdadeOuDesafio(sock, msg, jid) {
  const tipo = Math.random() > 0.5 ? 'VERDADE' : 'DESAFIO';
  
  let pergunta;
  if (tipo === 'VERDADE') {
    const verdades = [
      'Qual é seu maior medo?',
      'Você já mentiu para alguém importante?',
      'Qual é seu segredo mais obscuro?',
      'Você teria coragem de confessar algo ruim que fez?',
    ];
    pergunta = verdades[Math.floor(Math.random() * verdades.length)];
  } else {
    const desafios = [
      'Mande uma mensagem criativa para alguém do grupo',
      'Cante uma música inteira aqui',
      'Faça uma pirueta',
      'Mude sua foto de perfil por 1 hora',
    ];
    pergunta = desafios[Math.floor(Math.random() * desafios.length)];
  }
  
  const texto = `🎮 *VERDADE OU DESAFIO* 🎮\n\n*${tipo}*\n\n❓ ${pergunta}\n\n_Qual é sua resposta?_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !confissao
async function handleConfissao(sock, msg, jid) {
  const confissoes = [
    'Confesse algo ruim que você fez!',
    'Qual é sua confissão mais vergonhosa?',
    'Diga algo que ninguém sabe sobre você',
    'Qual foi sua maior gafe?',
  ];
  
  const texto = `🤐 *CONFISSÃO* 🤐\n\n${confissoes[Math.floor(Math.random() * confissoes.length)]}\n\n_Sem julgamentos aqui!_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !julgamento
async function handleJulgamento(sock, msg, jid) {
  const julgamentos = [
    '😇 Você parece ser uma pessoa muito legal!',
    '🧐 Você tem vibes de alguém misterioso...',
    '🤡 Você é o(a) mais divertido(a) do grupo!',
    '👑 Você nasceu para ser famoso(a)!',
    '🔥 Você é muito atraente!',
  ];
  
  const texto = `⚖️ *JULGAMENTO* ⚖️\n\n${julgamentos[Math.floor(Math.random() * julgamentos.length)]}\n\n_Isto é um julgamento arbitrário e enviesado! 😂_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !podre
async function handlePodre(sock, msg, jid, author) {
  const insultosLeves = [
    'Você é podre demais! 🤢',
    'Que pessoa podre! 💀',
    'Isso foi muito podre da sua parte! 😒',
  ];
  
  const texto = `🤢 *VOCÊ É PODRE!* 🤢\n\n${insultosLeves[Math.floor(Math.random() * insultosLeves.length)]}\n\n_Apenas brincadeira, ${author}! 😂_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !frango
async function handleFrango(sock, msg, jid, author) {
  const pct = Math.floor(Math.random() * 101);
  
  let frase;
  if (pct < 30) frase = 'Totalmente frango! Não tem coragem pra nada! 😂';
  else if (pct < 70) frase = 'Um pouco frango, mas tem coragem em algumas coisas.';
  else frase = 'Você não é frango, tem coragem! 🔥';
  
  const texto = `🐔 *NÍVEL DE FRANGUICE* 🐔\n\n📊 *${pct}%*\n\n${frase}`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !maldizer
async function handleMaldizer(sock, msg, jid, author) {
  const maldições = [
    '🔮 Você será amaldiçoado(a) a pisar em todo LEGO do mundo! 😱',
    '🔮 Condenado(a) a esperar wifi carregando para sempre! 📵',
    '🔮 Maldição: Seus carregadores sempre quebram! 🔌',
    '🔮 Você terá sempre a música de videoclipe trava-cabeça na cabeça! 🎵',
  ];
  
  const texto = `🔮 *MALDIÇÃO* 🔮\n\n${maldições[Math.floor(Math.random() * maldições.length)]}\n\n_Que o universo tenha piedade! 💀_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !fortuna
async function handleFortuna(sock, msg, jid, author) {
  const fortunas = [
    '🥠 Você encontrará ouro em lugar inesperado. 💎',
    '🥠 Uma grande alegria virá em seu caminho. 😊',
    '🥠 O destino conspira a seu favor! ✨',
    '🥠 Algo bom acontecerá muito em breve. 🌟',
    '🥠 A sorte está do seu lado! 🍀',
  ];
  
  const texto = `🥠 *BISCOITO DA FORTUNA* 🥠\n\n${fortunas[Math.floor(Math.random() * fortunas.length)]}\n\n_O universo falou!_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !compatibilidade
async function handleCompatibilidade(sock, msg, content, jid, author, contactNames = {}) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  
  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marca alguém!\nExemplo: *!compatibilidade @fulano*' }, { quoted: msg });
    return;
  }
  
  const alvoJid = mentionedJid[0];
  const alvo = contactNames[alvoJid] || `@${alvoJid.split('@')[0]}`;
  const pct = Math.floor(Math.random() * 101);
  
  let comentario;
  if (pct < 20) comentario = 'Vocês são completamente incompatíveis! 😅';
  else if (pct < 50) comentario = 'Há algumas diferenças, mas podem dar certo.';
  else if (pct < 80) comentario = 'Boa compatibilidade! Vocês se combinam! 💕';
  else comentario = 'Vocês são almas gêmeas! 💑✨';
  
  const texto = `💕 *COMPATIBILIDADE* 💕\n\n*${author}* + *${alvo}*\n\n❤️ *${pct}%*\n\n${comentario}`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Stubs para compatibilidade (comandos em manutenção)
async function handleShip(sock, msg, content, jid, contactNames) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleRolar(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleXingar(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleElogio(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleCrush(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleCantada(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleSafadeza(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleTiro(sock, msg, content, jid, author, contactNames) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleMorte(sock, msg, content, jid, author, contactNames) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleRoletaRussa(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleRoletaRussa2(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleRoletaRussa3(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleFalta(sock, msg, content, jid) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleBaterFalta(sock, msg, content, jid, author) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleEuNunca(sock, msg, content, jid) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handleAnagrama(sock, msg, jid, caption) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
}
async function handlePpt(sock, msg, jid, caption) {
  await sock.sendMessage(jid, { text: 'Comando em manutenção!' }, { quoted: msg });
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
