const path = require('path');

const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));
const { getNivelInfo }      = require(path.join(__dirname, '..', 'utils', 'levelUtils'));
let _jidNormalizedUser = null;
function jidNormalizedUser(jid) {
  if (!_jidNormalizedUser) {
    _jidNormalizedUser = require('@whiskeysockets/baileys').jidNormalizedUser;
  }
  return _jidNormalizedUser(jid);
}

// ─── Lazy require para quebrar dependência circular ────────────
let _rel = null;
function rel() {
  if (!_rel) _rel = require(path.join(__dirname, 'relacionamento'));
  return _rel;
}

function findRelByJid(jid, relacionamentos) { return rel().findRelByJid(jid, relacionamentos); }
function temXpBonus(key)                    { return rel().temXpBonus(key); }
function formatarTempo(ms)                  { return rel().formatarTempo(ms); }
async function handleCarinh(...args)        { return rel().handleCarinh(...args); }

function getXpCasais()     { return rel().xpCasais; }
function getXpBonus()      { return rel().xpBonus; }
function getCiumentosMap() { return rel().ciumentosMap; }
function getBloqueados()   { return rel().bloqueados; }

// ─── Mapa: comando → item obrigatório no inventário ────────────
const ITEM_NECESSARIO = {
  flores:   { key: 'flores',   nome: 'Flores 🌹'                },
  doces:    { key: 'morango',  nome: 'Morango com Chocolate 🍓'  },
  carta:    { key: 'carta',    nome: 'Carta de Amor 💌'          },
  mimo:     { key: 'caixa',    nome: 'Caixa Presente Luxo 🎁'    },
  beijo:    { key: 'perfume',  nome: 'Perfume Premium 🌸'        },
  // abraco removido — não requer item
  jantar:   { key: 'taça',     nome: 'Taça para Vinho 🍷'        },
  cinema:   { key: 'almofada', nome: 'Almofada Casal 🛋️'         },
  viajar:   { key: 'garrafa',  nome: 'Garrafa Vinho Tinto 🍾'    },
  serenata: { key: 'vela',     nome: 'Vela Aromática 🕯️'         },
};

// ─── Helper: verifica E consome 1 unidade do item (atômico) ───
async function _checkConsumeItem(sock, msg, jid, senderJid, comando) {
  const itemInfo = ITEM_NECESSARIO[comando];
  if (!itemInfo) return true;

  const { key, nome } = itemInfo;

  try {
    const result = await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid, [`inventory.${key}`]: { $gte: 1 } },
      { $inc: { [`inventory.${key}`]: -1 } },
      { new: true }
    );

    if (!result) {
      await sock.sendMessage(jid, {
        text:
          `🚫 *Você precisa de ${nome} para usar este comando!*\n\n` +
          `Compre na loja do casal: *!lojacasal*`,
      }, { quoted: msg });
      return false;
    }

    return true;

  } catch (e) {
    console.error(`[CasalItem] Erro ao verificar inventário (${senderJid} / ${key}):`, e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao verificar seu inventário. Tente novamente.',
    }, { quoted: msg });
    return false;
  }
}

// ─── Tabela de carinho: comando → [emoji, descrição] ──────────
const CARINH_CONFIG = {
  flores:  ['🌹', 'enviou um buquê de rosas'],
  doces:   ['🍬', 'mandou uma caixa de doces'],
  carta:   ['💌', 'escreveu uma carta de amor'],
  mimo:    ['🎁', 'fez um mimo especial'],
  beijo:   ['💋', 'deu um beijão'],
  abraco:  ['🤗', 'deu um abraço apertado'],
};

// ─── Factory: gera handler de carinho ─────────────────────────
// A verificação e consumo do item do inventário é feita
// dentro do próprio handleCarinh — não duplicar aqui.
function _makeCarinhHandler(comando) {
  const [emoji, descricao] = CARINH_CONFIG[comando];
  return async function (sock, msg, jid, author, senderJid, relacionamentos) {
    await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, comando, emoji, descricao);
  };
}

// ─── Handlers de carinho gerados automaticamente ──────────────
const handleJantar   = _makeCarinhHandler('jantar');
const handleCinema   = _makeCarinhHandler('cinema');
const handleViajar   = _makeCarinhHandler('viajar');
const handleSerenata = _makeCarinhHandler('serenata');

// ─── !presente ────────────────────────────────────────────────
async function handlePresente(sock, msg, jid, author, senderJid, relacionamentos, caption = '') {
  const temCaption = caption.toLowerCase().trim();
  // Remove o próprio comando "!presente" da frente, ficando só com os argumentos
  const parts = temCaption.replace(/^!?presente\s*/i, '').split(/\s+/).filter(Boolean);

  // ── Sem argumentos: presente surpresa aleatório (sem consumir item) ──
  if (parts.length === 0) {
    const found = findRelByJid(senderJid, relacionamentos);
    if (!found) {
      await sock.sendMessage(jid, {
        text: '💔 Você não está em um relacionamento! Não pode presentear ninguém agora! 😒',
      }, { quoted: msg });
      return;
    }

    const presentes = [
      'um anel de ouro 💍',
      'um perfume importado 🌸',
      'um ursinho de pelúcia 🧸',
      'chocolates Ferrero 🍫',
      'um colar lindo 📿',
    ];
    const p = presentes[Math.floor(Math.random() * presentes.length)];
    await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'presente', '🎀', `presenteou com ${p}`);
    return;
  }

  // ── Com argumentos: presente específico com item do inventário ──

  // ── Verifica relacionamento ──
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Você não está em um relacionamento! Não pode presentear ninguém agora! 😒',
    }, { quoted: msg });
    return;
  }

  const { key, rel: relData } = found;
  const itemNome = parts[0]; // primeiro argumento após o comando é o item

  if (!itemNome) {
    await sock.sendMessage(jid, {
      text:
        '⚠️ Informe o item que deseja presentear!\n' +
        'Use: *!presente <item> @pessoa*\n' +
        'Exemplo: *!presente flores @esposa*',
    }, { quoted: msg });
    return;
  }

  // ── Verifica menção ──
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length === 0) {
    await sock.sendMessage(jid, {
      text:
        '⚠️ Você precisa mencionar a pessoa!\n' +
        'Use: *!presente <item> @pessoa*\n' +
        'Exemplo: *!presente flores @esposa*',
    }, { quoted: msg });
    return;
  }

  const pessoaJid   = mentions[0];
  const parceiroJid = relData.jidA === senderJid ? relData.jidB : relData.jidA;
  const parceiro    = relData.nomeA === author    ? relData.nomeB : relData.nomeA;

  // ── Só pode presentear o próprio parceiro ──
  if (pessoaJid !== parceiroJid) {
    await sock.sendMessage(jid, {
      text: '😂 Ué! Você tá tentando presentear outra pessoa? Que história é essa?!',
    }, { quoted: msg });
    return;
  }

  // ── Verifica e consome o item do inventário + persiste XP (atômico via MongoDB) ──
  try {
    const result = await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid, [`inventory.${itemNome}`]: { $gte: 1 } },
      { $inc: { [`inventory.${itemNome}`]: -1 } },
      { new: true }
    );

    if (!result) {
      await sock.sendMessage(jid, {
        text:
          `❌ Você não tem *${itemNome}* no inventário!\n\n` +
          `Compre na loja do casal: *!lojacasal*\n` +
          `Ou use *!inventario* para ver seus itens.`,
      }, { quoted: msg });
      return;
    }

    // ── Nome amigável do item ──
    const nomeAmigavel = ITENS_LOJA[itemNome]?.nome || itemNome;

    // ── Atualiza XP do casal em memória e persiste no banco ──
    const xpAtual = (getXpCasais().get(key) || 0) + 5;
    getXpCasais().set(key, xpAtual);

    await Usuario.updateMany(
      { idWhatsApp: { $in: [relData.jidA, relData.jidB].filter(Boolean) } },
      { $inc: { xpCasal: 5 } }
    );

    // ── Mensagem final ──
    await sock.sendMessage(jid, {
      text:
        `🎁 *${author}* presenteou *${parceiro}* com *${nomeAmigavel}*! 💕\n\n` +
        `_"É pra você, meu amor!"_ 🥰\n\n` +
        `💰 *+5 XP de amor!* Total: *${xpAtual} XP* 💑`,
      mentions: [pessoaJid],
    }, { quoted: msg });

  } catch (e) {
    console.error('[handlePresente] Erro ao presentear:', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar o presente. Tente novamente.',
    }, { quoted: msg });
  }
}

// ─── Handlers de programa (com verificação de item e divisão por grupo) ───────────

// handleJantar
async function handleJantar(sock, msg, jid, author, senderJid, relacionamentos) {
  const restaurantes = [
    'num restaurante chique 🍷',
    'num jantar a luz de vela 🕯️',
    'num rodízio japonês 🍣',
    'numa churrascaria premium 🥩',
    'numa pizzaria italiana 🍕',
  ];
  const r = restaurantes[Math.floor(Math.random() * restaurantes.length)];
  
  // Repassa todos os parâmetros necessários para o handleCarinh processar o grupo e as marcações
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'jantar', '🍽️', `levou para jantar ${r}`, 5);
}

// handleCinema
async function handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos) {
  const filmes = [
    'um romance 💕',
    'um filme de terror e ficou com medo 😱',
    'uma comédia e não parou de rir 😂',
    'um filme de ação e roubou a pipoca 🍿',
    'um drama e os dois choraram 😭',
  ];
  const f = filmes[Math.floor(Math.random() * filmes.length)];
  
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'cinema', '🎬', `levou ao cinema para assistir ${f}`, 5);
}

// handleViajar
async function handleViajar(sock, msg, jid, author, senderJid, relacionamentos) {
  const destinos = ['Paris 🗼', 'Maldivas 🏝️', 'Roma 🏛️', 'Tokyo 🗾', 'Cancún 🌊', 'Gramado ❄️'];
  const d = destinos[Math.floor(Math.random() * destinos.length)];
  
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'viajar', '✈️', `planejou uma viagem para ${d}`, 10);
}

// handleSerenata
async function handleSerenata(sock, msg, jid, author, senderJid, relacionamentos) {
  const musicas = [
    'a música favorita deles 🎵',
    '"Evidências" do Chitãozinho 🎸',
    'uma balada romântica 🎶',
    '"Pra Você" toda desafinada 😂',
    '"Can\'t Help Falling in Love" ❤️',
  ];
  const m = musicas[Math.floor(Math.random() * musicas.length)];
  
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'serenata', '🎤', `fez uma serenata cantando ${m}`, 8);
}

// !declarar
async function handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos) {
  // ── Normaliza o ID de quem enviou o comando ──
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Só quem tem um relacionamento pode se declarar, seu(ua) romantudo(a) solteiro(a)! 😤',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante os JIDs limpos e normalizados de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Descobre de forma precisa quem é o parceiro usando os IDs normalizados
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // ── Tags de marcação por @ baseadas nos JIDs purificados ──
  const tagAuthor   = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const declaracoes = [
  `🔥 ${tagAuthor} se DECLARA APAIXONADO(A) para ${tagParceiro}:\n\n_"De qualquer jeito, é você que eu quero! Te amo demais!" 💘🔥_`,

  `💋 ${tagAuthor} ABRAÇA ${tagParceiro} na frente de TODOS e diz:\n\n_"Essa pessoa aqui é meu fechamento! E eu sou feliz demais com nosso amor! 💪💕"_`,

  `🌟 ${tagAuthor} faz uma DECLARAÇÃO ÉPICA para ${tagParceiro}:\n\n_"Você alegra o meu dia todo dia! É incrível estar contigo... Te amo!" 🥰_`,

  `⚡ ${tagAuthor} para ${tagParceiro}:\n\n_"Se eu pudesse escolher novamente, eu AINDA escolheria você! Sem pestanejar! Sem volta! TE AMO!" 💯💕_`,

  `🎸 ${tagAuthor} canta pro mundo:\n\n_"EU AMO ESSA PESSOA! É MEU AMOR E PRONTO!" 🎵🔥_`,

  `🌹 ${tagAuthor} sussurra para ${tagParceiro}:\n\n_"Em meio a tantas estrelas, eu escolheria sempre a sua luz. Você é o meu lugar favorito no mundo." 🌌💞_`,

  `🌊 ${tagAuthor} declara para ${tagParceiro}:\n\n_"Meu coração encontrou porto seguro em você. Cada dia ao seu lado é uma página nova da nossa história." 📖💙_`,

  `🕊️ ${tagAuthor} olha nos olhos de ${tagParceiro} e diz:\n\n_"Não preciso de mais nada quando tenho você por perto. Você é calma, é lar, é tudo." 🤍✨_`,

  `🌙 ${tagAuthor} para ${tagParceiro}, sob o céu estrelado:\n\n_"Se o amor fosse um lugar, eu moraria em você para sempre." 🌌💫_`,

  `🍯 ${tagAuthor} sorri e diz para ${tagParceiro}:\n\n_"Você adoça meus dias como mel adoça o pão. Te amo mais que ontem, menos que amanhã." 🍞💛_`,

  `🎻 ${tagAuthor} dedica uma melodia para ${tagParceiro}:\n\n_"Cada nota dessa canção fala de você. Meu amor é a trilha sonora da nossa vida." 🎶❤️_`,

  `🌸 ${tagAuthor} entrega uma flor para ${tagParceiro} e fala:\n\n_"Assim como essa flor, nosso amor floresce um pouco mais a cada dia." 🌷💕_`,

  `🔥 ${tagAuthor} grita para o mundo, abraçando ${tagParceiro}:\n\n_"ESSA AQUI É MINHA PESSOA! E EU NÃO TROCO POR NADA!" 🥳💖_`,

  `🌈 ${tagAuthor} segura a mão de ${tagParceiro} e promete:\n\n_"Depois da tempestade, sempre vai ter você e eu, juntos, recomeçando." 🌦️💞_`,

  `📜 ${tagAuthor} escreve uma carta para ${tagParceiro}:\n\n_"Se eu pudesse resumir minha felicidade em uma palavra, essa palavra seria seu nome." ✍️💗_`,
];


  // ── Busca e atualiza o XP direto do banco de dados ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    const xpAntigo = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
    xpAtual = xpAntigo + 5;
  } catch (err) {
    console.error('⚠️ [handleDeclarar] Erro ao calcular XP do banco:', err.message);
    // Fallback para o Map em caso de falha de conexão do banco
    xpAtual = (getXpCasais().get(key) || 0) + 5;
  }

  // Sincroniza a memória temporária
  getXpCasais().set(key, xpAtual);

  // Salva de forma persistente o bônus individual no banco
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: 5 } }
    );
  } catch (e) {
    console.error('⚠️ [handleDeclarar] Erro ao persistir XP no banco:', e.message);
  }

  // Monta a lista de pings (Mentions) que serão acionados em azul no chat do grupo
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: declaracoes[Math.floor(Math.random() * declaracoes.length)] + `\n\n💰 *+5 XP DE AMOR!* Total: *${xpAtual} XP* 🚀`,
    mentions: listaMentions,
  }, { quoted: msg });
}


// !ciumento
async function handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos) {
  // ── Normaliza o ID de quem enviou o comando ──
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Só quem tá em relacionamento pode ficar com ciúme, seu(ua) solteiro(a)! 😒',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante os JIDs limpos de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Descobre cirurgicamente quem é o parceiro
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // ── COOLDOWN DIVIDIDO POR GRUPO + USUÁRIO ──
  const agora = Date.now();
  const cooldownKey = `${jid}:${senderJidNormalizado}`; // Junta ID do Grupo com ID do Usuário
  const cooldown = getCiumentosMap().get(cooldownKey);
  
  if (cooldown && cooldown > agora) {
    await sock.sendMessage(jid, {
      text: `⏰ CALMA LÁ! Você acabou de usar ciúme neste grupo! Próxima vez em *${formatarTempo(cooldown - agora)}*! Vai aprender quando é a hora certa! 😤`,
    }, { quoted: msg });
    return;
  }

  // ── Extrai menção de forma segura ──
  const rawMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  const mentionedJid = rawMentioned ? jidNormalizedUser(rawMentioned) : null;

  // ── Impede ciúme do próprio parceiro ──
  if (mentionedJid && mentionedJid === parcJid) {
    await sock.sendMessage(jid, {
      text: '😂 Ciúme do seu próprio par? Isso é amor demais! Mas não conta como ciúme não! 💕',
    }, { quoted: msg });
    return;
  }

  // ── Só registra cooldown local deste grupo após todas as validações ──
  getCiumentosMap().set(cooldownKey, agora + 30 * 60 * 1000);

  // ── Tags de marcação por @ baseadas nos JIDs normatizados ──
  const tagAuthor   = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);
  const tagSuspeito = mentionedJid ? `@${mentionedJid.split('@')[0]}` : 'alguém do grupo';

  const cenas = [
    `😤 ${tagAuthor} EXPLODIU DE CIÚME VENDO ${tagParceiro} rindo com ${tagSuspeito}!\n\n_${tagParceiro}: "Você tá me controlando?" 💀_`,
    `🔥 ${tagAuthor} ficou VERDE DE INVEJA com ${tagParceiro} conversando com ${tagSuspeito}!\n\n_${tagParceiro}: "Sério? SÉRIO MESMO?" 😒_`,
    `😡 ${tagAuthor} FOÇOU O CELULAR DE ${tagParceiro} procurando coisas suspeitas com ${tagSuspeito}!\n\n_Resultado: Nada encontrado. ENVERGONHADO(A)! 💀_`,
    `🥲 ${tagAuthor} FEZ BIRRA porque ${tagParceiro} deu mais atenção a ${tagSuspeito}!\n\n_${tagParceiro}: "Que drama! Você é meu amor, RELAXA!" 😤_`,
    `💢 ${tagAuthor} IGNOROU ${tagParceiro} O DIA TODO por causa de ${tagSuspeito}!\n\n_Depois voltaram a namorar com um abraço apertado. 😔💕_`,
  ];

  // ── Busca e deduz o XP direto do banco de dados ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    const xpAntigo = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
    xpAtual = Math.max(0, xpAntigo - 2); // Garante que o XP não fique negativo
  } catch (err) {
    console.error('[handleCiumento] Erro ao calcular XP do banco:', err.message);
    xpAtual = Math.max(0, (getXpCasais().get(key) || 0) - 2);
  }

  // Sincroniza o mapa temporário local
  getXpCasais().set(key, xpAtual);

  // Persiste a perda de XP diminuindo o valor individualmente de cada um no banco
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: -2 } }
    );
  } catch (e) {
    console.error('[handleCiumento] Erro ao deduzir XP no banco:', e.message);
  }

  // ── Monta a lista de pings (Mentions) que serão acionados em azul no chat ──
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);
  if (mentionedJid) listaMentions.push(mentionedJid);

  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + `\n\n⚠️ *-2 XP* por CIÚME CEGO! Total: *${xpAtual} XP* 😤`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !status / !statu
async function handleStatu(sock, msg, jid, author, senderJid, relacionamentos) {
  // Normaliza o ID de quem enviou o comando
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Você não está num relacionamento!\n_Use *!casar @alguem* para encontrar o amor!_',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante JIDs normalizados para evitar problemas de compatibilidade
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Determina quem é o parceiro
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  let xp = 0;
  try {
    // ── BUSCA O XP REAL E ATUALIZADO DO BANCO DE DADOS ──
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    // Soma o XP individual salvo em cada usuário
    const xpA = userA?.xpCasal || 0;
    const xpB = userB?.xpCasal || 0;
    xp = xpA + xpB;
  } catch (err) {
    console.error('⚠️ [handleStatu] Erro ao buscar XP do banco:', err.message);
    // Fallback seguro caso o banco falhe
    xp = typeof getXpCasais === 'function' ? (getXpCasais().get(key) || 0) : (rel.xp || 0);
  }

  const desde   = rel.desde ? Date.now() - rel.desde : 0;
  const dias    = Math.floor(desde / (1000 * 60 * 60 * 24));
  const horas   = Math.floor((desde % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Cálculo de Níveis e Barra de Progresso
  const niveis = [
    { limite: 50,       nome: 'Recém-casados',   emoji: '🌱' },
    { limite: 150,      nome: 'Casal apaixonado', emoji: '💕' },
    { limite: 300,      nome: 'Casal sólido',     emoji: '💪' },
    { limite: 500,      nome: 'Casal veterano',   emoji: '⭐' },
    { limite: 800,      nome: 'Casal lendário',   emoji: '🏆' },
    { limite: Infinity, nome: 'CASAL IMORTAL',    emoji: '👑' },
  ];

  const nivelAtual = niveis.find(n => xp < n.limite);
  const proximo    = nivelAtual.limite;
  const xpProximo  = proximo === Infinity ? '---' : proximo - xp;

  // Renderização da Barra de Progresso Visual
  let barraXp = '█'.repeat(10);
  if (proximo !== Infinity) {
    const porcentagem = Math.min(Math.max(xp / proximo, 0), 1); // Evita bugs de divisão ou limites
    const blocosCheios = Math.floor(porcentagem * 10);
    barraXp = '█'.repeat(blocosCheios) + '░'.repeat(10 - blocosCheios);
  }

  // Conquistas Baseadas no Progresso Real
  const conquistas = [];
  if (dias >= 1)  conquistas.push('🌅 *1 dia* de romance');
  if (dias >= 7)  conquistas.push('🌟 *1 SEMANA* de puro amor!');
  if (dias >= 30) conquistas.push('🥇 *1 MÊS INTEIRO* juntos (VCS AGUENTAM!)');
  if (xp >= 100)  conquistas.push('💰 *100 XP* acumulados (ELITE!)');
  if (xp >= 500)  conquistas.push('👑 *500 XP* (LENDÁRIOS MESMO!)');

  const bonusAtivo = typeof temXpBonus === 'function' && temXpBonus(key) 
    ? '\n🎉 *XP DUPLO ATIVADO! APROVEITEM!* 🎉' 
    : '';

  // Montagem das Tags de Exibição sem carregar lixo de conexões (:1, :2...)
  const tagSender = senderJidNormalizado ? `@${senderJidNormalizado.split('@')[0]}` : author;
  const tagParc   = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  let texto =
    `💑 *STATUS ÉPICO DO CASAL*\n\n` +
    `👥 ${tagSender} ${rel.tipo === 'namoro' ? '💕' : '💍'} ${tagParc}\n` +
    `💎 Tipo: *${rel.tipo === 'namoro' ? 'NAMORANDO 🌟' : 'CASADOS 👰'}*\n` +
    `⏰ Tempo junto: *${dias}d ${horas}h* (Não se largam!)\n\n` +
    `${nivelAtual.emoji} NÍVEL: *${nivelAtual.nome}*\n` +
    `⚡ XP: *${xp}/${proximo === Infinity ? '∞' : proximo}* [${barraXp}]\n` +
    `🚀 Faltam *${xpProximo}* XP pro PRÓXIMO NÍVEL!` +
    bonusAtivo;

  if (conquistas.length > 0) {
    texto += `\n\n🏆 *CONQUISTAS:*\n` + conquistas.map(c => `   ✅ ${c}`).join('\n');
  }

  await sock.sendMessage(jid, {
    text: texto,
    mentions: [senderJidNormalizado, parcJid].filter(Boolean),
  }, { quoted: msg });
}

// !meupar
async function handleMeuPar(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Você está solteiro(a)!\n_Use *!casar @alguem* para encontrar o amor!_',
    }, { quoted: msg });
    return;
  }

  const { rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const frases = [
    `💕 O par de ${tagRemetente} é ${tagParceiro}! Que casal lindo! 😍`,
    `❤️ Você está ${rel.tipo === 'namoro' ? 'namorando' : 'casado(a) com'} ${tagParceiro}! Cuida bem, hein!`,
    `😍 O seu amor é ${tagParceiro}! Trata com carinho! ✨`,
    `💑 ${tagParceiro} é seu(ua) ${rel.tipo === 'namoro' ? 'namorado(a)' : 'cônjuge'}! Não esquece não!`,
  ];

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: listaMentions,
  }, { quoted: msg });
}

// !xpduplo
async function handleXpDobro(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar num relacionamento!' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  if (temXpBonus(key)) {
    const restante = getXpBonus().get(key).expiry - Date.now();
    await sock.sendMessage(jid, {
      text: `⏰ O XP Duplo já está ativo! Expira em *${formatarTempo(restante)}*.`,
    }, { quoted: msg });
    return;
  }

  // ── Busca o XP real somado do banco de dados ──
  let xpTotalCasal = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpTotalCasal = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
  } catch (err) {
    console.error('⚠️ Error ao ler XP para bônus:', err.message);
    xpTotalCasal = getXpCasais().get(key) || 0;
  }

  if (xpTotalCasal < 30) {
    await sock.sendMessage(jid, {
      text: `❌ Você precisa de pelo menos *30 XP* para ativar o XP Duplo!\n_Vocês têm: *${xpTotalCasal} XP*_`,
    }, { quoted: msg });
    return;
  }

  // Desconta os 30 XP dividindo a cobrança entre os dois no banco de dados (-15 para cada)
  const novoXp = xpTotalCasal - 30;
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: -15 } }
    );
  } catch (e) {
    console.error('⚠️ Erro ao cobrar XP do bônus:', e.message);
  }

  getXpCasais().set(key, novoXp);
  getXpBonus().set(key, { ativo: true, expiry: Date.now() + 2 * 60 * 60 * 1000 });

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text:
      `🎯 *XP DUPLO ATIVADO!*\n\n` +
      `${tagRemetente} ativou o XP duplo para o casal com ${tagParceiro}!\n\n` +
      `💸 *-30 XP* (custo) | Restante: *${novoXp} XP*\n` +
      `⏰ Dura *2 horas*! Use todos os comandos diários agora!`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !aniversariocasal
async function handleAniversarioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não está num relacionamento!' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const desde     = rel.desde || Date.now();
  const dias      = Math.floor((Date.now() - desde) / (1000 * 60 * 60 * 24));
  const semanas   = Math.floor(dias / 7);
  const meses     = Math.floor(dias / 30);
  const anos      = Math.floor(dias / 365);

  const marcos = [];
  if (anos >= 1)    marcos.push(`🎂 *${anos} ano(s) juntos!* Isso é incrível!`);
  if (meses >= 1)   marcos.push(`📅 *${meses} mês(es) juntos!*`);
  if (semanas >= 1) marcos.push(`🗓️ *${semanas} semana(s) juntos!*`);

  // ── Adiciona o prêmio de comemoração (+20 XP) direto no banco de dados ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpAtual = (userA?.xpCasal || 0) + (userB?.xpCasal || 0) + 20;

    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: 20 } }
    );
  } catch (err) {
    console.error('⚠️ Erro ao persistir XP de aniversário:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + 20;
  }
  
  getXpCasais().set(key, xpAtual);

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  let texto =
    `🎉 *ANIVERSÁRIO DO CASAL* 🎉\n\n` +
    `💑 ${tagRemetente} e ${tagParceiro}\n\n` +
    `📅 *${dias} dia(s)* juntos!\n`;
  if (marcos.length > 0) texto += marcos.join('\n') + '\n';
  texto +=
    `\n💰 *+20 XP* de celebração! Total: *${xpAtual} XP*\n\n` +
    `_Parabéns pelo tempo juntos! 🥂_`;

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: texto,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !duelodecasais
async function handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos) {
  // ── Normaliza o ID de quem enviou o comando ──
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const foundA = findRelByJid(senderJidNormalizado, relacionamentos);
  if (!foundA) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar num relacionamento para duelar!' }, { quoted: msg });
    return;
  }

  // ── Extrai a menção do oponente de forma segura ──
  const rawMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!rawMentioned) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém do outro casal para duelar!\nExemplo: *!duelodecasais @fulano*',
    }, { quoted: msg });
    return;
  }

  const oponenteJidNormalizado = jidNormalizedUser(rawMentioned);
  const foundB = findRelByJid(oponenteJidNormalizado, relacionamentos);
  
  if (!foundB) {
    await sock.sendMessage(jid, {
      text: `❌ *@${oponenteJidNormalizado.split('@')[0]}* não está num relacionamento! Só pode duelar casal contra casal!`,
      mentions: [oponenteJidNormalizado],
    }, { quoted: msg });
    return;
  }

  if (foundA.key === foundB.key) {
    await sock.sendMessage(jid, { text: '😂 Você não pode duelar com o próprio par!' }, { quoted: msg });
    return;
  }

  // Purifica e normaliza os JIDs de todos os 4 integrantes
  const jidA1 = foundA.rel.jidA ? jidNormalizedUser(foundA.rel.jidA) : null;
  const jidA2 = foundA.rel.jidB ? jidNormalizedUser(foundA.rel.jidB) : null;
  const jidB1 = foundB.rel.jidA ? jidNormalizedUser(foundB.rel.jidA) : null;
  const jidB2 = foundB.rel.jidB ? jidNormalizedUser(foundB.rel.jidB) : null;

  // ── Busca o XP real acumulado de cada casal direto do Banco de Dados ──
  let xpA = 0;
  let xpB = 0;

  try {
    const [userA1, userA2, userB1, userB2] = await Promise.all([
      jidA1 ? Usuario.findOne({ idWhatsApp: jidA1 }).select('xpCasal').lean() : null,
      jidA2 ? Usuario.findOne({ idWhatsApp: jidA2 }).select('xpCasal').lean() : null,
      jidB1 ? Usuario.findOne({ idWhatsApp: jidB1 }).select('xpCasal').lean() : null,
      jidB2 ? Usuario.findOne({ idWhatsApp: jidB2 }).select('xpCasal').lean() : null,
    ]);

    xpA = (userA1?.xpCasal || 0) + (userA2?.xpCasal || 0);
    xpB = (userB1?.xpCasal || 0) + (userB2?.xpCasal || 0);
  } catch (err) {
    console.error('⚠️ [Duelo] Erro ao buscar XP do banco:', err.message);
    xpA = getXpCasais().get(foundA.key) || 0;
    xpB = getXpCasais().get(foundB.key) || 0;
  }

  // Criação das tags com @ para os textos
  const tagA1 = jidA1 ? `@${jidA1.split('@')[0]}` : foundA.rel.nomeA;
  const tagA2 = jidA2 ? `@${jidA2.split('@')[0]}` : foundA.rel.nomeB;
  const tagB1 = jidB1 ? `@${jidB1.split('@')[0]}` : foundB.rel.nomeA;
  const tagB2 = jidB2 ? `@${jidB2.split('@')[0]}` : foundB.rel.nomeB;

  const casal1Mencoes = `${tagA1} & ${tagA2}`;
  const casal2Mencoes = `${tagB1} & ${tagB2}`;

  const scoreA = xpA + Math.floor(Math.random() * 50);
  const scoreB = xpB + Math.floor(Math.random() * 50);

  let resultado = '';
  let mudancasBanco = [];

  if (scoreA > scoreB) {
    const ganho = Math.min(20, Math.floor(xpB * 0.1)) || 5; // Mínimo de 5 caso dê zero
    
    // Configura a alteração persistente (+ganho dividido pro Casal A, -ganho dividido pro Casal B)
    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2].filter(Boolean) } }, { $inc: { xpCasal: Math.ceil(ganho / 2) } }),
      Usuario.updateMany({ idWhatsApp: { $in: [jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: -Math.ceil(ganho / 2) } })
    );

    getXpCasais().set(foundA.key, xpA + ganho);
    getXpCasais().set(foundB.key, Math.max(0, xpB - ganho));

    resultado =
      `🏆 *${casal1Mencoes}* VENCERU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${ganho} XP* para *${casal2Mencoes}*!\n\n` +
      `_Que casal mais forte! 💪_`;
  } else if (scoreB > scoreA) {
    const ganho = Math.min(20, Math.floor(xpA * 0.1)) || 5;

    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: Math.ceil(ganho / 2) } }),
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2].filter(Boolean) } }, { $inc: { xpCasal: -Math.ceil(ganho / 2) } })
    );

    getXpCasais().set(foundB.key, xpB + ganho);
    getXpCasais().set(foundA.key, Math.max(0, xpA - ganho));

    resultado =
      `🏆 *${casal2Mencoes}* VENCERU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${ganho} XP* para *${casal1Mencoes}*!\n\n` +
      `_Que reviravolta! 😱_`;
  } else {
    // Empate dá +3 XP individual para cada participante
    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2, jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: 3 } })
    );

    getXpCasais().set(foundA.key, xpA + 3);
    getXpCasais().set(foundB.key, xpB + 3);
    resultado = `🤝 *EMPATE!* Ambos os casais são igualmente incríveis!\n\n💰 *+3 XP* para ambos!`;
  }

  // Executa todas as atualizações no banco simultaneamente
  if (mudancasBanco.length > 0) {
    await Promise.all(mudancasBanco).catch(e => console.error('⚠️ [Duelo] Erro ao salvar XP no banco:', e.message));
  }

  // ── Monta a lista completa de Mentions (Os 4 JIDs) ──
  const listaMentions = [jidA1, jidA2, jidB1, jidB2].filter(Boolean);

  await sock.sendMessage(jid, {
    text:
      `⚔️ *DUELO DE CASAIS* ⚔️\n\n` +
      `💑 *${casal1Mencoes}* (${xpA} XP)\n` +
      `VS\n` +
      `💑 *${casal2Mencoes}* (${xpB} XP)\n\n` +
      `─────────────\n${resultado}`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !rankcasais
async function handleRankCasais(sock, msg, jid, relacionamentos) {
  if (!relacionamentos || relacionamentos.size === 0) {
    await sock.sendMessage(jid, {
      text: '📭 Nenhum casal cadastrado ainda!\n_Use *!casar @alguem* pra começar!_',
    }, { quoted: msg });
    return;
  }

  // ── Busca membros atuais do grupo para filtrar casais que saíram ──
  let membrosDoGrupo = null;
  try {
    const meta = await sock.groupMetadata(jid);
    membrosDoGrupo = new Set(meta.participants.map(p => jidNormalizedUser(p.id)));
  } catch {
    // Se falhar (ex: falta de permissão ou delay), exibe todos sem filtro
  }

  // ── Filtra e processa a lista buscando os dados persistidos no banco de dados ──
  const casaisFiltrados = [...relacionamentos.entries()].filter(([, rel]) => {
    if (!membrosDoGrupo) return true;
    const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
    const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
    
    return membrosDoGrupo.has(jidANormalizado) && membrosDoGrupo.has(jidBNormalizado);
  });

  // Mapeia os casais buscando o XP individual de cada usuário de forma assíncrona
  const lista = await Promise.all(
    casaisFiltrados.map(async ([, rel]) => {
      const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
      const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

      let xpTotalCasal = 0;

      try {
        // Busca o documento dos dois usuários na coleção 'Usuario'
        const [userA, userB] = await Promise.all([
          jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
          jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
        ]);

        // Soma o xpCasal de ambos os parceiros armazenados no banco de dados
        const xpA = userA?.xpCasal || 0;
        const xpB = userB?.xpCasal || 0;
        xpTotalCasal = xpA + xpB;
      } catch (err) {
        console.error('⚠️ [handleRankCasais] Erro ao buscar XP do banco:', err.message);
        // Fallback para a memória caso ocorra alguma falha crítica de conexão com o banco
        xpTotalCasal = typeof getXpCasais === 'function' ? (getXpCasais().get(rel.key || '') || 0) : (rel.xp || 0);
      }

      const diasJuntos = rel.desde
        ? Math.floor((Date.now() - rel.desde) / (1000 * 60 * 60 * 24))
        : 0;

      return { 
        ...rel, 
        xp: xpTotalCasal, 
        diasJuntos, 
        score: xpTotalCasal + diasJuntos * 2 
      };
    })
  );

  // Ordena os casais pelo score de forma decrescente e limita aos 10 primeiros
  lista.sort((a, b) => b.score - a.score);
  const top10 = lista.slice(0, 10);

  if (top10.length === 0) {
    await sock.sendMessage(jid, {
      text: '📭 Nenhum casal ativo neste grupo no momento!',
    }, { quoted: msg });
    return;
  }

  const medals   = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const mentions = [];
  let texto = `🏆 *RANKING DOS CASAIS* 🏆\n\n`;

  top10.forEach((c, i) => {
    const tipoEmoji = c.tipo === 'namoro' ? '💝' : '💍';
    
    const jidANormalizado = c.jidA ? jidNormalizedUser(c.jidA) : null;
    const jidBNormalizado = c.jidB ? jidNormalizedUser(c.jidB) : null;

    const tagA = jidANormalizado ? `@${jidANormalizado.split('@')[0]}` : c.nomeA;
    const tagB = jidBNormalizado ? `@${jidBNormalizado.split('@')[0]}` : c.nomeB;
    
    const barraXp   = '⭐'.repeat(Math.min(Math.floor(c.xp / 10), 5)) || '▫️';
    const diasLabel = c.diasJuntos === 1 ? 'dia' : 'dias';

    if (jidANormalizado) mentions.push(jidANormalizado);
    if (jidBNormalizado) mentions.push(jidBNormalizado);

    texto +=
      `${medals[i]} ${tipoEmoji} ${tagA} 💕 ${tagB}\n` +
      `${barraXp} *${c.xp} XP* · 📅 *${c.diasJuntos} ${diasLabel}* · 🏅 *${c.score} pts*\n\n`;
  });

  texto += `_Score = XP + (dias juntos × 2)_\n_Use *!status* pra ver o status completo!_`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// !desafiocasal
async function handleDesafioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Vocês não são um casal ainda, seu(ua) solteiro(a)! 😭' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: '⛔ Você está de castigo! Sem comando de desafio! 🚫' }, { quoted: msg });
    return;
  }

  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const desafios = [
    `💑 *DESAFIO: Cumprimento de 5 palavras* — ${tagRemetente} e ${tagParceiro} têm que dar um elogio de ATÉ 5 palavras pro outro! +15 XP 🎁`,
    `🤐 *DESAFIO: Silêncio Apaixonado* — ${tagRemetente} e ${tagParceiro}, vocês têm 30 min SEM falar sobre NADA chato! +20 XP 📱`,
    `🎵 *DESAFIO: Música do Casal* — Escolham uma música que define o relacionamento de vocês! +25 XP 🎧`,
    `📸 *DESAFIO: Selfie no Espelho* — Tirem uma selfie juntos (ou descrevam)! +15 XP 🤳`,
    `💬 *DESAFIO: Piada de Casal* — Um conta uma piada pro outro. Se o outro rir, +18 XP 😂`,
    `🎭 *DESAFIO: Imitar o(a) Parceiro(a)* — Vocês IMITAM um ao outro exagerando! +12 XP 🤣`,
    `🏃 *DESAFIO: Corrida de Abraços* — Quem abraçar mais forte em 30 segundos ganha! +17 XP 🤗`,
  ];

  const desafio = desafios[Math.floor(Math.random() * desafios.length)];
  const xpGanho = parseInt(desafio.match(/\+(\d+)\s*XP/)?.[1] || '10');
  const temBonus = temXpBonus(key);
  const xpFinal  = temBonus ? xpGanho * 2 : xpGanho;

  // ── Busca o XP base real acumulado direto do Banco de Dados ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpAtual = (userA?.xpCasal || 0) + (userB?.xpCasal || 0) + xpFinal;

    // Persiste o acréscimo distribuído no banco
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: xpFinal } }
    );
  } catch (err) {
    console.error('⚠️ [DesafioCasal] Erro ao sincronizar XP com o Banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpFinal;
  }

  // Atualiza memória temporária local
  getXpCasais().set(key, xpAtual);
  if (temBonus) getXpBonus().delete(key);

  const extras = temBonus ? '\n\n🚀 *BÔNUS APLICADO!* Vocês ganharam XP DOBRADO nesse desafio! 🎉' : '';
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: `${desafio}${extras}\n\n💰 *+${xpFinal} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !rankingcasais / !competicaocasais
async function handleCompetiacaoCasais(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Vocês não são um casal! 😭' }, { quoted: msg });
    return;
  }

  const { key } = found;

  if (relacionamentos.size === 0) {
    await sock.sendMessage(jid, { text: '📭 Nenhum casal cadastrado ainda!' }, { quoted: msg });
    return;
  }

  // ── Carrega os cadastros mapeando e normalizando os JIDs ──
  const casaisLista = [...relacionamentos.entries()].map(([k, r]) => ({
    key: k,
    nomeA: r.nomeA || 'Desconhecido',
    nomeB: r.nomeB || 'Desconhecido',
    jidA: r.jidA ? jidNormalizedUser(r.jidA) : null,
    jidB: r.jidB ? jidNormalizedUser(r.jidB) : null,
  }));

  // ── Resgata dinamicamente o XP em tempo real direto do banco para o Ranking ──
  const ranking = await Promise.all(
    casaisLista.map(async (casal) => {
      try {
        const [uA, uB] = await Promise.all([
          casal.jidA ? Usuario.findOne({ idWhatsApp: casal.jidA }).select('xpCasal').lean() : null,
          casal.jidB ? Usuario.findOne({ idWhatsApp: casal.jidB }).select('xpCasal').lean() : null
        ]);
        const xpTotal = (uA?.xpCasal || 0) + (uB?.xpCasal || 0);
        return { ...casal, xp: xpTotal };
      } catch (e) {
        return { ...casal, xp: getXpCasais().get(casal.key) || 0 };
      }
    })
  );

  // Ordena do maior XP para o menor
  ranking.sort((a, b) => b.xp - a.xp);

  const dadosMeuCasal = ranking.find(r => r.key === key);
  const xpMeuCasal = dadosMeuCasal ? dadosMeuCasal.xp : 0;
  const nivel = getNivelInfo(xpMeuCasal);
  const posicao = ranking.findIndex(r => r.key === key) + 1;

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const mentions = [];

  let texto = '💑 *COMPETIÇÃO ENTRE CASAIS*\n\n🏆 *RANKING DE XP:*\n';

  ranking.slice(0, 5).forEach((r, i) => {
    const tagA = r.jidA ? `@${r.jidA.split('@')[0]}` : r.nomeA;
    const tagB = r.jidB ? `@${r.jidB.split('@')[0]}` : r.nomeB;
    const destaque = r.key === key ? ' 👈' : '';

    if (r.jidA) mentions.push(r.jidA);
    if (r.jidB) mentions.push(r.jidB);

    texto += `${medals[i]} ${tagA} 💑 ${tagB} — *${r.xp} XP*${destaque}\n`;
  });

  texto += `\n👤 *VOCÊ ESTÁ EM #${posicao}* (${xpMeuCasal} XP — ${nivel.nome})\n`;
  texto += `\n🎯 *O ranking acompanha suas pontuações em tempo real!*`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// !surpresa
async function handleSurpresa(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Você não tem parceiro pra surpreender! 😭' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: '⛔ Vocês estão de castigo! 🚫' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const surpresas = [
    `🎈 *SURPRESA MEGA*: ${tagParceiro} recebeu uma SURPRESA MEGA de ${tagRemetente}! Só pode ser coisa boa! 😏 +25 XP!`,
    `🎥 *SURPRESA CINEMATOGRÁFICA*: Uma super cena de romance foi preparada por ${tagRemetente} para ${tagParceiro}! Velas, pétalas e música! +30 XP! 💕`,
    `🌟 *SURPRESA NOTURNA*: ${tagRemetente} planejou um piquenique na madrugada com ${tagParceiro}! Que romântico! +35 XP! 🌙`,
    `🎀 *SURPRESA FESTA*: Tem festa secreta organizada por ${tagRemetente} para celebrar ${tagParceiro}! Romantismo puro! +28 XP! 🎉`,
    `🐻 *SURPRESA CARINHO TOTAL*: ${tagRemetente} preparou massagem e banho de espuma relaxante para ${tagParceiro}! Carinho total! +32 XP! 💦`,
  ];

  const surp = surpresas[Math.floor(Math.random() * surpresas.length)];
  const xpGanho = parseInt(surp.match(/\+(\d+)\s*XP/)?.[1] || '20');

  // ── Incrementa a pontuação em tempo real no MongoDB ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpAtual = (userA?.xpCasal || 0) + (userB?.xpCasal || 0) + xpGanho;

    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: xpGanho } }
    );
  } catch (err) {
    console.error('⚠️ [Surpresa] Erro ao salvar XP no banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  }

  getXpCasais().set(key, xpAtual);

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: surp + `\n\n💰 *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}


// !domingo
async function handleDomingo(sock, msg, jid, author, senderJid, relacionamentos) {
  // ── Normaliza o ID de quem enviou o comando ──
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Você está sozinho(a)! 😭' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: '⛔ Castigo! Sem fun! 🚫' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  
  // Garante os JIDs limpos de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // Criação das tags de marcação com @
  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const domingos = [
    `☕ *DOMINGO DE CAFÉ E SÉRIE*: ${tagRemetente} e ${tagParceiro} vão passar o domingo inteiro comendo e assistindo série juntos! +22 XP! 📺`,
    `🏠 *DOMINGO DE LIMPEZA*: ${tagRemetente} e ${tagParceiro} limpam a casa juntos (com música alta claro!) e depois descansam! +18 XP! 🧹`,
    `👨‍🍳 *DOMINGO DE COZINHA*: ${tagRemetente} preparou um almoço gourmet especial para ${tagParceiro}! Que romântico! +26 XP! 🍝`,
    `🛏️ *DOMINGO DE PREGUIÇA*: ${tagRemetente} e ${tagParceiro} ficam a manhã toda jogados sem fazer nada! +20 XP! 😴`,
    `🎮 *DOMINGO GAMER*: ${tagRemetente} e ${tagParceiro} jogam um jogo cooperativo juntos! Maratona gamer! +24 XP! 🎮`,
  ];

  const domingo = domingos[Math.floor(Math.random() * domingos.length)];
  const xpGanho = parseInt(domingo.match(/\+(\d+)\s*XP/)?.[1] || '20');

  // ── Busca e incrementa a pontuação em tempo real no MongoDB ──
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpAtual = (userA?.xpCasal || 0) + (userB?.xpCasal || 0) + xpGanho;

    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: xpGanho } }
    );
  } catch (err) {
    console.error('⚠️ [Domingo] Erro ao salvar XP no banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  }

  // Sincroniza a memória temporária local
  getXpCasais().set(key, xpAtual);

  // Monta a lista de pings (Mentions)
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: domingo + `\n\n💰 *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// ─── Exports ──────────────────────────────────────────────────
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
  handleSurpresa,
  handleDomingo,
};  