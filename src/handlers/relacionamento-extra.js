const path = require('path');

const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));

const {
  xpCasais,
  xpBonus,
  ciumentosMap,
  bloqueados,
  findRelByJid,
  temXpBonus,
  formatarTempo,
  handleCarinh,
} = require(path.join(__dirname, 'relacionamento'));

const { getNivelInfo } = require(path.join(__dirname, '..', 'utils', 'levelUtils'));

async function handleFlores(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'flores', '🌹', 'enviou um buquê de rosas');
}
async function handleDoces(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'doces', '🍬', 'mandou uma caixa de doces');
}
async function handleCarta(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'carta', '💌', 'escreveu uma carta de amor');
}
async function handleMimo(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'mimo', '🎁', 'fez um mimo especial');
}
async function handleBeijo(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'beijo', '💋', 'deu um beijão');
}

async function handleAbraco(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'abraco', '🤗', 'deu um abraço apertado');
}
async function handlePresente(sock, msg, jid, author, senderJid, relacionamentos, caption = '') {
  // Se não houver caption com item específico, usar comportamento aleatório antigo
  const temCaption = caption.toLowerCase().trim();
  if (!temCaption.includes('presente') || temCaption.split(/\s+/).length < 2) {
    const presentes = ['um anel de ouro 💍', 'um perfume importado 🌸', 'um ursinho de pelúcia 🧸', 'chocolates Ferrero 🍫', 'um colar lindo 📿'];
    const p = presentes[Math.floor(Math.random() * presentes.length)];
    await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'presente', '🎀', `presenteou com ${p}`);
    return;
  }

  // Verificar se está em relacionamento
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não está em um relacionamento! Não pode presentear ninguém agora! 😒' }, { quoted: msg });
    return;
  }

  // Parse: !presente <item> @pessoa
  const parts = temCaption.split(/\s+/).filter(p => p.trim());
  const itemNome = parts[1]?.toLowerCase() || '';
  
  // Verificar @mention
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Você precisa mencionar a pessoa! Use: *!presente <item> @pessoa*\nExemplo: *!presente flores @esposa*' }, { quoted: msg });
    return;
  }

  const pessoaJid = mentions[0];
  const { rel } = found;
  const parceiroJid = rel.jidA === senderJid ? rel.jidB : rel.jidA;
  
  // Validar se a pessoa mencionada é o parceiro
  if (pessoaJid !== parceiroJid) {
    await sock.sendMessage(jid, { text: '😂 Ué! Você tá tentando presentear outra pessoa? Que história é essa?!' }, { quoted: msg });
    return;
  }

  // Buscar usuário e verificar inventário
  try {
    const user = await Usuario.findOne({ idWhatsApp: senderJid });
    if (!user) {
      await sock.sendMessage(jid, { text: '⚠️ Perfil não encontrado!' }, { quoted: msg });
      return;
    }

    const inventorio = user.inventory || new Map();
    const quantidadeItem = inventorio.get(itemNome) || 0;

    if (quantidadeItem === 0) {
      await sock.sendMessage(jid, { 
        text: `❌ Você não tem *${itemNome}* no inventário!\n\nUse *!inventario* para ver seus itens.` 
      }, { quoted: msg });
      return;
    }

    // Remover item do inventário
    const novaQuantidade = quantidadeItem - 1;
    if (novaQuantidade === 0) {
      inventorio.delete(itemNome);
    } else {
      inventorio.set(itemNome, novaQuantidade);
    }

    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid },
      { inventory: inventorio }
    );

    // Pegar nome do item na loja para mensagem bonitinha
    const { ITENS_LOJA } = require('./diversao/economia');
    const nomeAmigavel = ITENS_LOJA[itemNome]?.nome || itemNome;

    const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
    const mensagem = `🎁 *${author}* presenteou *${parceiro}* com *${nomeAmigavel}*! 💕\n\n_"É pra você, meu amor!"_ 🥰`;

    await sock.sendMessage(jid, {
      text: mensagem,
      mentions: pessoaJid ? [pessoaJid] : [],
    }, { quoted: msg });

    // Adicionar XP ao casal
    const key = rel.jidA < rel.jidB ? `${rel.jidA}_${rel.jidB}` : `${rel.jidB}_${rel.jidA}`;
    const xpAtual = (xpCasais.get(key) || 0) + 5;
    xpCasais.set(key, xpAtual);

  } catch (e) {
    console.error('⚠️ Erro ao presentear:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar o presente!' }, { quoted: msg });
  }
}
async function handleJantar(sock, msg, jid, author, senderJid, relacionamentos) {
  const restaurantes = ['num restaurante chique 🍷', 'num jantar a luz de vela 🕯️', 'num rodízio japonês 🍣', 'numa churrascaria premium 🥩', 'numa pizzaria italiana 🍕'];
  const r = restaurantes[Math.floor(Math.random() * restaurantes.length)];
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'jantar', '🍽️', `levou num jantar ${r}`);
}
async function handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos) {
  const filmes = ['um romance 💕', 'terror e ficou com medo 😱', 'comédia e não parou de rir 😂', 'ação e roubou a pipoca 🍿', 'um drama e os dois choraram 😭'];
  const f = filmes[Math.floor(Math.random() * filmes.length)];
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'cinema', '🎬', `levou ao cinema assistir ${f}`);
}
async function handleViajar(sock, msg, jid, author, senderJid, relacionamentos) {
  const destinos = ['Paris 🗼', 'Maldivas 🏝️', 'Roma 🏛️', 'Tokyo 🗾', 'Cancún 🌊', 'Gramado ❄️'];
  const d = destinos[Math.floor(Math.random() * destinos.length)];
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'viajar', '✈️', `planejou uma viagem para ${d}`, 10);
}
async function handleSerenata(sock, msg, jid, author, senderJid, relacionamentos) {
  const musicas = ['a música favorita deles 🎵', '"Evidências" do Chitãozinho 🎸', 'uma balada romântica 🎶', '"Pra Você" toda desafinada 😂', '"Can\'t Help Falling in Love" ❤️'];
  const m = musicas[Math.floor(Math.random() * musicas.length)];
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'serenata', '🎤', `fez uma serenata cantando ${m}`, 8);
}

async function handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Só quem tem um relacionamento pode se declarar, seu(ua) romantudo(a) solteiro(a)! 😤' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;

  const declaracoes = [
    `🔥 *${author}* se DECLARA APAIXONADO(A) para *${parceiro}*:\n\n_"VOCÊ É MINHA! De pé ou deitado(a), de qualquer jeito, é você que eu quero! Te amo demais!" 💘🔥_`,
    `💋 *${author}* BEIJA *${parceiro}* na frente de TODOS e grita:\n\n_"ESSA PESSOA AQUI É MINHA! E EU SOU FELIZ COM ELE(ELA)! 💪💕"_`,
    `🌟 *${author}* faz uma DECLARAÇÃO ÉPICA para *${parceiro}*:\n\n_"Você me faz perder a razão todo dia! É praticamente um vício... UM VÍCIO GOSTOSO! Te amo, seu(ua) criatura!" 🥰_`,
    `⚡ *${author}* para *${parceiro}*:\n\n_"Se eu pudesse escolher novamente, eu AINDA escolheria você! Sem pestanejar! Sem volta! TE AMO!" 💯💕_`,
    `🎸 *${author}* canta pro mundo:\n\n_"EU AMO ESSE(A) CARA(A)! QUEM NÃO GOSTOU, PROBLEMA SUA! É MEU(MINHA) AMOR E PRONTO!" 🎵🔥_`,
  ];

  const xpAtual = (xpCasais.get(key) || 0) + 5;
  xpCasais.set(key, xpAtual);

  await sock.sendMessage(jid, {
    text: declaracoes[Math.floor(Math.random() * declaracoes.length)] + `\n\n💰 *+5 XP DE AMOR!* Total: *${xpAtual} XP* 🚀`,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

async function handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Só quem tá em relacionamento pode ficar com ciúme, seu(ua) solteiro(a)! 😒' }, { quoted: msg });
    return;
  }

  if (ciumentosMap.has(senderJid)) {
    const restante = ciumentosMap.get(senderJid) - Date.now();
    if (restante > 0) {
      await sock.sendMessage(jid, {
        text: `⏰ CALMA LÁ! Você acabou de usar ciúme! Próxima vez em *${formatarTempo(restante)}*! Vai aprender quando é a hora certa! 😤`,
      }, { quoted: msg });
      return;
    }
  }
  ciumentosMap.set(senderJid, Date.now() + 30 * 60 * 1000);

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;

  let suspeito = 'alguém do grupo';
  if (mentionedJid[0]) {
    suspeito = `@${mentionedJid[0].split('@')[0]}`;
  }

  const cenas = [
    `😤 *${author}* EXPLODIU DE CIÚME VENDO *${parceiro}* rindo com *${suspeito}*!\n\n_${parceiro}: "Você tá me controlando?" 💀_`,
    `🔥 *${author}* ficou VERDE DE INVEJA com *${parceiro}* conversando com *${suspeito}*!\n\n_${parceiro}: "Sério? SÉRIO MESMO?" 😒_`,
    `😡 *${author}* FOÇOU O CELULAR DE *${parceiro}* procurando coisas suspeitas com *${suspeito}*!\n\n_Resultado: Nada encontrado. ENVERGONHADO(A)! 💀_`,
    `🥲 *${author}* FEZ BIRRA porque *${parceiro}* deu mais atenção a *${suspeito}*!\n\n_${parceiro}: "Que drama! Você é meu amor, RELAXA!" 😤_`,
    `💢 *${author}* IGNOROU *${parceiro}* O DIA TODO por causa de *${suspeito}*!\n\n_Depois voltaram a namorar com um abraço apertado. 😔💕_`,
  ];

  const xpAtual = Math.max(0, (xpCasais.get(key) || 0) - 2);
  xpCasais.set(key, xpAtual);

  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + `\n\n⚠️ *-2 XP* por CIÚME CEGO! Total: *${xpAtual} XP* 😤`,
    mentions: mentionedJid[0] ? [mentionedJid[0], parcJid].filter(Boolean) : [parcJid].filter(Boolean),
  }, { quoted: msg });
}

async function handleStatu(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não está num relacionamento!\n_Use *!casar @alguem* para encontrar o amor!_' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const xp = xpCasais.get(key) || 0;
  const desde = rel.desde ? Date.now() - rel.desde : 0;
  const dias = Math.floor(desde / (1000 * 60 * 60 * 24));
  const horas = Math.floor((desde % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  let nivel, nivelEmoji;
  if (xp < 50) { nivel = 'Recém-casados'; nivelEmoji = '🌱'; }
  else if (xp < 150) { nivel = 'Casal apaixonado'; nivelEmoji = '💕'; }
  else if (xp < 300) { nivel = 'Casal sólido'; nivelEmoji = '💪'; }
  else if (xp < 500) { nivel = 'Casal veterano'; nivelEmoji = '⭐'; }
  else if (xp < 800) { nivel = 'Casal lendário'; nivelEmoji = '🏆'; }
  else { nivel = 'CASAL IMORTAL'; nivelEmoji = '👑'; }

  const conquistas = [];
  if (dias >= 1) conquistas.push('🌅 *1 dia* de romance');
  if (dias >= 7) conquistas.push('🌟 *1 SEMANA* de puro amor!');
  if (dias >= 30) conquistas.push('🥇 *1 MÊS INTEIRO* juntos (VCS AGUENTAM!)');
  if (xp >= 100) conquistas.push('💰 *100 XP* acumulados (ELITE!)');
  if (xp >= 500) conquistas.push('👑 *500 XP* (LENDÁRIOS MESMO!)');

  const limites = [50, 150, 300, 500, 800, Infinity];
  const nivelAtual = limites.findIndex(l => xp < l);
  const proximo = limites[nivelAtual];
  const xpProximo = proximo === Infinity ? '---' : proximo - xp;
  const barraXp = proximo === Infinity ? '█'.repeat(10) :
    '█'.repeat(Math.floor((xp / proximo) * 10)) + '░'.repeat(10 - Math.floor((xp / proximo) * 10));

  const bonusAtivo = temXpBonus(key) ? '\n🎉 *XP DUPLO ATIVADO! APROVEITEM!* 🎉' : '';

  let texto =
    `💑 *STATUS ÉPICO DO CASAL*\n\n` +
    `👥 *${author}* ${rel.tipo === 'namoro' ? '💕' : '💍'} *${parceiro}*\n` +
    `💎 Tipo: *${rel.tipo === 'namoro' ? 'NAMORANDO 🌟' : 'CASADOS 👰'}*\n` +
    `⏰ Tempo junto: *${dias}d ${horas}h* (Não se largam!)\n\n` +
    `${nivelEmoji} NÍVEL: *${nivel}*\n` +
    `⚡ XP: *${xp}/${proximo === Infinity ? '∞' : proximo}* [${barraXp}]\n` +
    `🚀 Faltam *${xpProximo}* XP pro PRÓXIMO NÍVEL!` +
    bonusAtivo;

  if (conquistas.length > 0) {
    texto += `\n\n🏆 *CONQUISTAS:*\n` + conquistas.map(c => `   ✅ ${c}`).join('\n');
  }

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleMeuPar(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Você está solteiro(a)!\n_Use *!casar @alguem* para encontrar o amor!_',
    }, { quoted: msg });
    return;
  }
  const { rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;

  const frases = [
    `💕 Seu(ua) par é *${parceiro}*! Que casal lindo! 😍`,
    `❤️ Você está ${rel.tipo === 'namoro' ? 'namorando' : 'casado(a) com'} *${parceiro}*! Cuida bem, hein!`,
    `😍 O seu amor é *${parceiro}*! Trata com carinho, otário(a)!`,
    `💑 *${parceiro}* é seu(ua) ${rel.tipo === 'namoro' ? 'namorado(a)' : 'cônjuge'}! Não esquece não!`,
  ];

  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

async function handleXpDobro(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar num relacionamento!' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  if (temXpBonus(key)) {
    const b = xpBonus.get(key);
    const restante = b.expiry - Date.now();
    await sock.sendMessage(jid, {
      text: `⏰ O XP Duplo já está ativo! Expira em *${formatarTempo(restante)}*.`,
    }, { quoted: msg });
    return;
  }

  const xpAtual = xpCasais.get(key) || 0;
  if (xpAtual < 30) {
    await sock.sendMessage(jid, {
      text: `❌ Você precisa de pelo menos *30 XP* para ativar o XP Duplo!\n_Vocês têm: *${xpAtual} XP*_`,
    }, { quoted: msg });
    return;
  }

  const novoXp = xpAtual - 30;
  xpCasais.set(key, novoXp);
  xpBonus.set(key, { ativo: true, expiry: Date.now() + 2 * 60 * 60 * 1000 });

  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;

  await sock.sendMessage(jid, {
    text: `🎯 *XP DUPLO ATIVADO!*\n\n*${author}* ativou o XP duplo para o casal com *${parceiro}*!\n\n💸 *-30 XP* (custo) | Restante: *${novoXp} XP*\n⏰ Dura *2 horas*! Usa todos os comandos diários agora!`,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

async function handleAniversarioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não está num relacionamento!' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;
  const desde = rel.desde || Date.now();
  const dias = Math.floor((Date.now() - desde) / (1000 * 60 * 60 * 24));
  const semanas = Math.floor(dias / 7);
  const meses = Math.floor(dias / 30);
  const anos = Math.floor(dias / 365);

  const marcos = [];
  if (anos >= 1) marcos.push(`🎂 *${anos} ano(s) juntos!* Isso é incrível!`);
  if (meses >= 1) marcos.push(`📅 *${meses} mês(es) juntos!*`);
  if (semanas >= 1) marcos.push(`🗓️ *${semanas} semana(s) juntos!*`);

  const xpAtual = (xpCasais.get(key) || 0) + 20;
  xpCasais.set(key, xpAtual);

  let texto = `🎉 *ANIVERSÁRIO DO CASAL* 🎉\n\n`;
  texto += `💑 *${author}* e *${parceiro}*\n\n`;
  texto += `📅 *${dias} dia(s)* juntos!\n`;
  if (marcos.length > 0) texto += marcos.join('\n') + '\n';
  texto += `\n💰 *+20 XP* de celebração! Total: *${xpAtual} XP*\n\n`;
  texto += `_Parabéns pelo tempo juntos! 🥂_`;

  await sock.sendMessage(jid, {
    text: texto,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

async function handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames) {
  const foundA = findRelByJid(senderJid, relacionamentos);
  if (!foundA) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar num relacionamento para duelar!' }, { quoted: msg });
    return;
  }

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém do outro casal para duelar!\nExemplo: *!duelodecasais @fulano*',
    }, { quoted: msg });
    return;
  }

  const oponenteJid = mentionedJid[0];
  const foundB = findRelByJid(oponenteJid, relacionamentos);
  if (!foundB) {
    await sock.sendMessage(jid, {
      text: `❌ *@${oponenteJid.split('@')[0]}* não está num relacionamento! Só pode duelar casal contra casal!`,
      mentions: [oponenteJid],
    }, { quoted: msg });
    return;
  }

  if (foundA.key === foundB.key) {
    await sock.sendMessage(jid, { text: '😂 Você não pode duelar com o próprio par!' }, { quoted: msg });
    return;
  }

  const xpA = xpCasais.get(foundA.key) || 0;
  const xpB = xpCasais.get(foundB.key) || 0;

  const nomesCasal1 = `${foundA.rel.nomeA} & ${foundA.rel.nomeB}`;
  const nomesCasal2 = `${foundB.rel.nomeA} & ${foundB.rel.nomeB}`;

  const scoreA = xpA + Math.floor(Math.random() * 50);
  const scoreB = xpB + Math.floor(Math.random() * 50);

  let resultado;
  if (scoreA > scoreB) {
    const ganho = Math.min(20, Math.floor(xpB * 0.1));
    const perda = ganho;
    xpCasais.set(foundA.key, xpA + ganho);
    xpCasais.set(foundB.key, Math.max(0, xpB - perda));
    resultado =
      `🏆 *${nomesCasal1}* VENCEU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${perda} XP* para *${nomesCasal2}*!\n\n` +
      `_Que casal mais forte! 💪_`;
  } else if (scoreB > scoreA) {
    const ganho = Math.min(20, Math.floor(xpA * 0.1));
    const perda = ganho;
    xpCasais.set(foundB.key, xpB + ganho);
    xpCasais.set(foundA.key, Math.max(0, xpA - perda));
    resultado =
      `🏆 *${nomesCasal2}* VENCEU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${perda} XP* para *${nomesCasal1}*!\n\n` +
      `_Que reviravolta! 😱_`;
  } else {
    resultado = `🤝 *EMPATE!* Ambos os casais são igualmente incríveis! +3 XP para todos!\n\n💰 *+3 XP* para ambos!`;
    xpCasais.set(foundA.key, xpA + 3);
    xpCasais.set(foundB.key, xpB + 3);
  }

  await sock.sendMessage(jid, {
    text:
      `⚔️ *DUELO DE CASAIS* ⚔️\n\n` +
      `💑 *${nomesCasal1}* (${xpA} XP)\n` +
      `VS\n` +
      `💑 *${nomesCasal2}* (${xpB} XP)\n\n` +
      `─────────────\n${resultado}`,
    mentions: mentionedJid,
  }, { quoted: msg });
}

async function handleRankCasais(sock, msg, jid, relacionamentos) {
  if (relacionamentos.size === 0) {
    await sock.sendMessage(jid, {
      text: '📭 Nenhum casal cadastrado ainda!\n_Use *!casar @alguem* pra começar!_',
    }, { quoted: msg });
    return;
  }

  const lista = [...relacionamentos.entries()].map(([key, rel]) => {
    const xp = xpCasais.get(key) || 0;
    const diasJuntos = rel.desde ? Math.floor((Date.now() - rel.desde) / (1000 * 60 * 60 * 24)) : 0;
    const score = xp + diasJuntos * 2;
    return { nomeA: rel.nomeA, nomeB: rel.nomeB, xp, diasJuntos, score, tipo: rel.tipo };
  }).sort((a, b) => b.score - a.score).slice(0, 10);

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let texto = `🏆 *RANKING DOS CASAIS* 🏆\n\n`;
  lista.forEach((c, i) => {
    const tipoStr = c.tipo === 'namoro' ? '💝' : '💍';
    texto += `${medals[i]} ${tipoStr} *${c.nomeA}* 💕 *${c.nomeB}*\n`;
    texto += `   ⭐ ${c.xp} XP | 📅 ${c.diasJuntos} dia(s)\n\n`;
  });
  texto += `_Score = XP + (dias juntos × 2)_\n_Use *!statu* para ver o status completo!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleDesafioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const rel = findRelByJid(relacionamentos, jid, author);
  if (!rel) {
    return await sock.sendMessage(jid, { text: '❌ Vocês n\u00e3o s\u00e3o um casal ainda, seu(ua) solteiro(a)! \ud83d\ude2d' }, { quoted: msg });
  }
  if (bloqueados.has(jid + author)) {
    return await sock.sendMessage(jid, { text: '⛔ Vocês est\u00e3o de castigo! Sem comando de desafio!\ud83d\udeab' }, { quoted: msg });
  }

  const desafios = [
    '💑 *DESAFIO: Complimento de 5 palavras* - Cada um tem que dar um elogio de ATE 5 palavras pro outro! +15 XP 🎁',
    '🤐 *DESAFIO: Silêncio Apaixonado* - Vocês t\u00e3o 30 min SEM falar sobre NADA chato. Só assuntos legais! +20 XP 📱',
    '🎵 *DESAFIO: Música do Casal* - Escolham uma música que define o relacionamento de vocês! +25 XP 🎧',
    '📸 *DESAFIO: Selfie no Espelho* - Tirem uma selfie no espelho juntos (ou descrevam) + +15 XP 🤳',
    '💬 *DESAFIO: Piada de Casal* - Um conta uma piada pro outro. Se o outro rir, +18 XP 😂',
    '🎭 *DESAFIO: Imitar o(a) Parceiro(a)* - Vocês IMITAM um ao outro exagerando! +12 XP 🤣',
    '🏃 *DESAFIO: Corrida de Abraços* - Que abraça mais forte em 30 segundos ganha +17 XP 🤗',
  ];

  const desafio = desafios[Math.floor(Math.random() * desafios.length)];
  
  if (temXpBonus(jid, 'desafio')) {
    const xpGanho = parseInt(desafio.match(/\\+(\u0434+)\\sXP/)?.[1] || '10');
    xpCasais.set(jid, (xpCasais.get(jid) || 0) + xpGanho);
    xpBonus.delete(jid + 'desafio');
    
    return await sock.sendMessage(jid, {
      text: desafio + '\n\n🚀 *BÔNUS APLICADO!* Vocês ganharam XP DOBRADO nesse desafio! 🎉',
    }, { quoted: msg });
  }

  await sock.sendMessage(jid, { text: desafio }, { quoted: msg });
}

async function handleCompetçaoCasais(sock, msg, jid, author, senderJid, relacionamentos) {
  const rel = findRelByJid(relacionamentos, jid, author);
  if (!rel) {
    return await sock.sendMessage(jid, { text: '❌ Vocês n\u00e3o s\u00e3o um casal! \ud83d\ude2d' }, { quoted: msg });
  }

  const ranking = [];
  relacionamentos.forEach((r) => {
    ranking.push({
      nomeA: r.nomeA,
      nomeB: r.nomeB,
      xp: xpCasais.get(r.jidA + r.jidB) || 0,
    });
  });
  ranking.sort((a, b) => b.xp - a.xp);

  const posicao = ranking.findIndex((r) => (r.nomeA === rel.nomeA && r.nomeB === rel.nomeB) || (r.nomeA === rel.nomeB && r.nomeB === rel.nomeA)) + 1;

  const xpAtual = xpCasais.get(jid) || 0;
  const nivel = getNivelInfo(xpAtual);

  let msg_texto = '\u{1F491} *COMPETIÇÃO ENTRE CASAIS*\n\n';
  msg_texto += `🏆 *RANKING DE XP:*\n`;

  ranking.slice(0, 5).forEach((r, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    msg_texto += `${emoji} #${i + 1}: *${r.nomeA}* 💑 *${r.nomeB}* - ${r.xp} XP\n`;
  });

  msg_texto += `\n👤 *VOCÊ ESTÁ EM #${posicao}* (${xpAtual} XP - ${nivel.nome})\n`;
  msg_texto += `\n🎯 *Próximo ranking atualiza a cada 6h!*`;

  await sock.sendMessage(jid, { text: msg_texto }, { quoted: msg });
}

async function handleSurpresa(sock, msg, jid, author, senderJid, relacionamentos) {
  const rel = findRelByJid(relacionamentos, jid, author);
  if (!rel) {
    return await sock.sendMessage(jid, { text: '❌ Você n\u00e3o tem parceiro pra surpreender! \ud83d\ude2d' }, { quoted: msg });
  }
  if (bloqueados.has(jid + author)) {
    return await sock.sendMessage(jid, { text: '⛔ Vocês est\u00e3o de castigo!\ud83d\udeab' }, { quoted: msg });
  }

  const surpresas = [
    `\ud83c\udf88 *SURPRESA MEGA*: *${rel.nomeA === author ? rel.nomeB : rel.nomeA}* recebeu uma SURPRESA MEGA de *${author}*! Só pode ser bom! \ud83d\ude0f +25 XP!`,
    `\ud83c\udfa5 *SURPRESA CINEMATOGRÁFICA*: Uma cena de romance foi preparada! Velas, música e tudo! +30 XP! \ud83d\udc95`,
    `\ud83c\udf1f *SURPRESA NOTURNA*: Piquenique na madrugada com seu amor! Que ousadia! +35 XP! 🌙`,
    `\ud83c\udf80 *SURPRESA FESTA*: Tem festa secreta pro casal! Bebidas, música e romantismo! +28 XP! 🎉`,
    `\ud83d\udc3b *SURPRESA CARINHO TOTAL*: Massagem, banho de espuma, candles e MUITO carinho! +32 XP! \ud83d\udca6`,
  ];

  const surp = surpresas[Math.floor(Math.random() * surpresas.length)];
  const xpGanho = parseInt(surp.match(/\\+(\u0434+)\\sXP/)?.[1] || '20');
  
  xpCasais.set(jid, (xpCasais.get(jid) || 0) + xpGanho);

  await sock.sendMessage(jid, {
    text: surp,
    mentions: [jidPedinte, senderJid],
  }, { quoted: msg });
}

async function handleDomingo(sock, msg, jid, author, senderJid, relacionamentos) {
  const rel = findRelByJid(relacionamentos, jid, author);
  if (!rel) {
    return await sock.sendMessage(jid, { text: '❌ Você está sozinho(a)! \ud83d\ude2d' }, { quoted: msg });
  }
  if (bloqueados.has(jid + author)) {
    return await sock.sendMessage(jid, { text: '⛔ Castigo! Sem fun! \ud83d\udeab' }, { quoted: msg });
  }

  const domingos = [
    `☕ *DOMINGO DE CAFÉ E SÉRIE*: Vocês vão passar o domingo inteiro comendo e assistindo série! +22 XP! \ud83d\udcfa`,
    `🏠 *DOMINGO DE LIMPEZA*: Vocês limpam a casa JUNTOS (com música alta claro!) e depois... bora pro sofá! +18 XP! 🧹`,
    `👨‍🍳 *DOMINGO DE COZINHA*: Vocês preparam um almoço gourmet juntos! Que romántico! +26 XP! 🍝`,
    `🛏️ *DOMINGO DE PREGUIÇA*: Vocês ficam a MANHÃ toda na cama sem fazer NADA! +20 XP! 😴`,
    `🎮 *DOMINGO GAMER*: Vocês jogam um jogo multiplayer juntos! Battle royale de casais! +24 XP! 🎮`,
  ];

  const domingo = domingos[Math.floor(Math.random() * domingos.length)];
  const xpGanho = parseInt(domingo.match(/\\+(\u0434+)\\sXP/)?.[1] || '20');
  
  xpCasais.set(jid, (xpCasais.get(jid) || 0) + xpGanho);

  await sock.sendMessage(jid, { text: domingo }, { quoted: msg });
}

module.exports = {
  handleFlores,
  handleDoces,
  handleCarta,
  handleMimo,
  handleBeijo,
  handleAbraco,
  handlePresente,
  handleJantar,
  handleCinemaRel,
  handleViajar,
  handleSerenata,
  handleDeclarar,
  handleCiumento,
  handleStatu,
  handleMeuPar,
  handleXpDobro,
  handleAniversarioCasal,
  handleDueloDeCasais,
  handleRankCasais,
  handleDesafioCasal,
  handleCompetçaoCasais,
  handleSurpresa,
  handleDomingo,
};
