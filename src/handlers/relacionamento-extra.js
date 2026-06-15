const path = require('path');

const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));
const { getNivelInfo }      = require(path.join(__dirname, '..', 'utils', 'levelUtils'));
const { ITENS_LOJA } = require(path.join(__dirname, 'diversao', 'economia'));
let _jidNormalizedUser = null;
function jidNormalizedUser(jid) {
  if (!_jidNormalizedUser) {
    _jidNormalizedUser = require('@whiskeysockets/baileys').jidNormalizedUser;
  }
  return _jidNormalizedUser(jid);
}

// â”€â”€â”€ Lazy require para quebrar dependÃªncia circular â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _rel = null;
function rel() {
  if (!_rel) _rel = require(path.join(__dirname, 'relacionamento'));
  return _rel;
}

function findRelByJid(jid, userJid, relacionamentos) { return rel().findRelByJid(jid, userJid, relacionamentos); }
function temXpBonus(key)                    { return rel().temXpBonus(key); }
function formatarTempo(ms)                  { return rel().formatarTempo(ms); }
async function handleCarinh(...args)        { return rel().handleCarinh(...args); }

function getXpCasais()     { return rel().xpCasais; }
function getXpBonus()      { return rel().xpBonus; }
function getCiumentosMap() { return rel().ciumentosMap; }
function getBloqueados()   { return rel().bloqueados; }

// â”€â”€â”€ Mapa: comando â†’ item obrigatÃ³rio no inventÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ITEM_NECESSARIO = {
  flores:   { key: 'flores',   nome: 'Flores ðŸŒ¹'                },
  doces:    { key: 'morango',  nome: 'Morango com Chocolate ðŸ“'  },
  carta:    { key: 'carta',    nome: 'Carta de Amor ðŸ’Œ'          },
  mimo:     { key: 'caixa',    nome: 'Caixa Presente Luxo ðŸŽ'    },
  beijo:    { key: 'perfume',  nome: 'Perfume Premium ðŸŒ¸'        },
  // abraco removido â€” nÃ£o requer item
  jantar:   { key: 'taÃ§a',     nome: 'TaÃ§a para Vinho ðŸ·'        },
  cinema:   { key: 'almofada', nome: 'Almofada Casal ðŸ›‹ï¸'         },
  viajar:   { key: 'garrafa',  nome: 'Garrafa Vinho Tinto ðŸ¾'    },
  serenata: { key: 'vela',     nome: 'Vela AromÃ¡tica ðŸ•¯ï¸'         },
};

// â”€â”€â”€ Helper: verifica E consome 1 unidade do item (atÃ´mico) â”€â”€â”€
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
          `ðŸš« *VocÃª precisa de ${nome} para usar este comando!*\n\n` +
          `Compre na loja do casal: *!lojacasal*`,
      }, { quoted: msg });
      return false;
    }

    return true;

  } catch (e) {
    console.error(`[CasalItem] Erro ao verificar inventÃ¡rio (${senderJid} / ${key}):`, e.message);
    await sock.sendMessage(jid, {
      text: 'âš ï¸ Erro ao verificar seu inventÃ¡rio. Tente novamente.',
    }, { quoted: msg });
    return false;
  }
}

// â”€â”€â”€ Tabela de carinho: comando â†’ [emoji, descriÃ§Ã£o] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CARINH_CONFIG = {
  flores:  ['ðŸŒ¹', 'enviou um buquÃª de rosas'],
  doces:   ['ðŸ¬', 'mandou uma caixa de doces'],
  carta:   ['ðŸ’Œ', 'escreveu uma carta de amor'],
  mimo:    ['ðŸŽ', 'fez um mimo especial'],
  beijo:   ['ðŸ’‹', 'deu um beijÃ£o'],
  abraco:  ['ðŸ¤—', 'deu um abraÃ§o apertado'],
};

// â”€â”€â”€ Factory: gera handler de carinho â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A verificaÃ§Ã£o e consumo do item do inventÃ¡rio Ã© feita
// dentro do prÃ³prio handleCarinh â€” nÃ£o duplicar aqui.
function _makeCarinhHandler(comando) {
  const [emoji, descricao] = CARINH_CONFIG[comando];
  return async function (sock, msg, jid, author, senderJid, relacionamentos) {
    await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, comando, emoji, descricao);
  };
}

// â”€â”€â”€ !presente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function handlePresente(sock, msg, jid, author, senderJid, relacionamentos, caption = '') {
  const temCaption = caption.toLowerCase().trim();
  // Remove o prÃ³prio comando "!presente" da frente, ficando sÃ³ com os argumentos
  const parts = temCaption.replace(/^!?presente\s*/i, '').split(/\s+/).filter(Boolean);

  // â”€â”€ Sem argumentos: presente surpresa aleatÃ³rio (sem consumir item) â”€â”€
  if (parts.length === 0) {
    const found = findRelByJid(jid, senderJid, relacionamentos);
    if (!found) {
      await sock.sendMessage(jid, {
        text: 'ðŸ’” VocÃª nÃ£o estÃ¡ em um relacionamento! NÃ£o pode presentear ninguÃ©m agora! ðŸ˜’',
      }, { quoted: msg });
      return;
    }

    const presentes = [
      'um anel de ouro ðŸ’',
      'um perfume importado ðŸŒ¸',
      'um ursinho de pelÃºcia ðŸ§¸',
      'chocolates Ferrero ðŸ«',
      'um colar lindo ðŸ“¿',
    ];
    const p = presentes[Math.floor(Math.random() * presentes.length)];
    await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'presente', 'ðŸŽ€', `presenteou com ${p}`);
    return;
  }

  // â”€â”€ Com argumentos: presente especÃ­fico com item do inventÃ¡rio â”€â”€

  // â”€â”€ Verifica relacionamento â”€â”€
  const found = findRelByJid(jid, senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: 'ðŸ’” VocÃª nÃ£o estÃ¡ em um relacionamento! NÃ£o pode presentear ninguÃ©m agora! ðŸ˜’',
    }, { quoted: msg });
    return;
  }

  const { key, rel: relData } = found;
  const itemNome = parts[0]; // primeiro argumento apÃ³s o comando Ã© o item

  if (!itemNome) {
    await sock.sendMessage(jid, {
      text:
        'âš ï¸ Informe o item que deseja presentear!\n' +
        'Use: *!presente <item> @pessoa*\n' +
        'Exemplo: *!presente flores @esposa*',
    }, { quoted: msg });
    return;
  }

  // â”€â”€ Verifica menÃ§Ã£o â”€â”€
  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentions.length === 0) {
    await sock.sendMessage(jid, {
      text:
        'âš ï¸ VocÃª precisa mencionar a pessoa!\n' +
        'Use: *!presente <item> @pessoa*\n' +
        'Exemplo: *!presente flores @esposa*',
    }, { quoted: msg });
    return;
  }

  const pessoaJid   = mentions[0];
  const parceiroJid = relData.jidA === senderJid ? relData.jidB : relData.jidA;
  const parceiro    = relData.nomeA === author    ? relData.nomeB : relData.nomeA;

  // â”€â”€ SÃ³ pode presentear o prÃ³prio parceiro â”€â”€
  if (pessoaJid !== parceiroJid) {
    await sock.sendMessage(jid, {
      text: 'ðŸ˜‚ UÃ©! VocÃª tÃ¡ tentando presentear outra pessoa? Que histÃ³ria Ã© essa?!',
    }, { quoted: msg });
    return;
  }

  // â”€â”€ Verifica e consome o item do inventÃ¡rio + persiste XP (atÃ´mico via MongoDB) â”€â”€
  try {
    const result = await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid, [`inventory.${itemNome}`]: { $gte: 1 } },
      { $inc: { [`inventory.${itemNome}`]: -1 } },
      { new: true }
    );

    if (!result) {
      await sock.sendMessage(jid, {
        text:
          `âŒ VocÃª nÃ£o tem *${itemNome}* no inventÃ¡rio!\n\n` +
          `Compre na loja do casal: *!lojacasal*\n` +
          `Ou use *!inventario* para ver seus itens.`,
      }, { quoted: msg });
      return;
    }

    // â”€â”€ Nome amigÃ¡vel do item â”€â”€
    const nomeAmigavel = ITENS_LOJA[itemNome]?.nome || itemNome;

    // â”€â”€ Atualiza XP do casal em memÃ³ria e persiste no banco â”€â”€
    const xpAtual = (getXpCasais().get(key) || 0) + 5;
    getXpCasais().set(key, xpAtual);

    await Usuario.updateMany(
      { idWhatsApp: { $in: [relData.jidA, relData.jidB].filter(Boolean) } },
      { $inc: { xpCasal: 5 } }
    );

    // â”€â”€ Mensagem final â”€â”€
    await sock.sendMessage(jid, {
      text:
        `ðŸŽ *${author}* presenteou *${parceiro}* com *${nomeAmigavel}*! ðŸ’•\n\n` +
        `_"Ã‰ pra vocÃª, meu amor!"_ ðŸ¥°\n\n` +
        `ðŸ’° *+5 XP de amor!* Total: *${xpAtual} XP* ðŸ’‘`,
      mentions: [pessoaJid],
    }, { quoted: msg });

  } catch (e) {
    console.error('[handlePresente] Erro ao presentear:', e.message);
    await sock.sendMessage(jid, {
      text: 'âš ï¸ Erro ao processar o presente. Tente novamente.',
    }, { quoted: msg });
  }
}

// â”€â”€â”€ Handlers de programa (com verificaÃ§Ã£o de item e divisÃ£o por grupo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// handleJantar
async function handleJantar(sock, msg, jid, author, senderJid, relacionamentos) {
  const restaurantes = [
    'num restaurante chique ðŸ·',
    'num jantar a luz de vela ðŸ•¯ï¸',
    'num rodÃ­zio japonÃªs ðŸ£',
    'numa churrascaria premium ðŸ¥©',
    'numa pizzaria italiana ðŸ•',
  ];
  const r = restaurantes[Math.floor(Math.random() * restaurantes.length)];

  // Repassa todos os parÃ¢metros necessÃ¡rios para o handleCarinh processar o grupo e as marcaÃ§Ãµes
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'jantar', 'ðŸ½ï¸', `levou para jantar ${r}`, 5);
}

// handleCinema
async function handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos) {
  const filmes = [
    'um romance ðŸ’•',
    'um filme de terror e ficou com medo ðŸ˜±',
    'uma comÃ©dia e nÃ£o parou de rir ðŸ˜‚',
    'um filme de aÃ§Ã£o e roubou a pipoca ðŸ¿',
    'um drama e os dois choraram ðŸ˜­',
  ];
  const f = filmes[Math.floor(Math.random() * filmes.length)];

  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'cinema', 'ðŸŽ¬', `levou ao cinema para assistir ${f}`, 5);
}

// handleViajar
async function handleViajar(sock, msg, jid, author, senderJid, relacionamentos) {
  const destinos = ['Paris ðŸ—¼', 'Maldivas ðŸï¸', 'Roma ðŸ›ï¸', 'Tokyo ðŸ—¾', 'CancÃºn ðŸŒŠ', 'Gramado â„ï¸'];
  const d = destinos[Math.floor(Math.random() * destinos.length)];

  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'viajar', 'âœˆï¸', `planejou uma viagem para ${d}`, 10);
}

// handleSerenata
async function handleSerenata(sock, msg, jid, author, senderJid, relacionamentos) {
  const musicas = [
    'a mÃºsica favorita deles ðŸŽµ',
    '"EvidÃªncias" do ChitÃ£ozinho ðŸŽ¸',
    'uma balada romÃ¢ntica ðŸŽ¶',
    '"Pra VocÃª" toda desafinada ðŸ˜‚',
    '"Can\'t Help Falling in Love" â¤ï¸',
  ];
  const m = musicas[Math.floor(Math.random() * musicas.length)];

  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'serenata', 'ðŸŽ¤', `fez uma serenata cantando ${m}`, 8);
}

// !declarar
async function handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos) {
  // â”€â”€ Normaliza o ID de quem enviou o comando â”€â”€
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: 'ðŸ’” SÃ³ quem tem um relacionamento pode se declarar, seu(ua) romantudo(a) solteiro(a)! ðŸ˜¤',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante os JIDs limpos e normalizados de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Descobre de forma precisa quem Ã© o parceiro usando os IDs normalizados
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // â”€â”€ Tags de marcaÃ§Ã£o por @ baseadas nos JIDs purificados â”€â”€
  const tagAuthor   = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const declaracoes = [
  `ðŸ”¥ ${tagAuthor} se DECLARA APAIXONADO(A) para ${tagParceiro}:\n\n_"De qualquer jeito, Ã© vocÃª que eu quero! Te amo demais!" ðŸ’˜ðŸ”¥_`,

  `ðŸ’‹ ${tagAuthor} ABRAÃ‡A ${tagParceiro} na frente de TODOS e diz:\n\n_"Essa pessoa aqui Ã© meu fechamento! E eu sou feliz demais com nosso amor! ðŸ’ªðŸ’•"_`,

  `ðŸŒŸ ${tagAuthor} faz uma DECLARAÃ‡ÃƒO Ã‰PICA para ${tagParceiro}:\n\n_"VocÃª alegra o meu dia todo dia! Ã‰ incrÃ­vel estar contigo... Te amo!" ðŸ¥°_`,

  `âš¡ ${tagAuthor} para ${tagParceiro}:\n\n_"Se eu pudesse escolher novamente, eu AINDA escolheria vocÃª! Sem pestanejar! Sem volta! TE AMO!" ðŸ’¯ðŸ’•_`,

  `ðŸŽ¸ ${tagAuthor} canta pro mundo:\n\n_"EU AMO ESSA PESSOA! Ã‰ MEU AMOR E PRONTO!" ðŸŽµðŸ”¥_`,

  `ðŸŒ¹ ${tagAuthor} sussurra para ${tagParceiro}:\n\n_"Em meio a tantas estrelas, eu escolheria sempre a sua luz. VocÃª Ã© o meu lugar favorito no mundo." ðŸŒŒðŸ’ž_`,

  `ðŸŒŠ ${tagAuthor} declara para ${tagParceiro}:\n\n_"Meu coraÃ§Ã£o encontrou porto seguro em vocÃª. Cada dia ao seu lado Ã© uma pÃ¡gina nova da nossa histÃ³ria." ðŸ“–ðŸ’™_`,

  `ðŸ•Šï¸ ${tagAuthor} olha nos olhos de ${tagParceiro} e diz:\n\n_"NÃ£o preciso de mais nada quando tenho vocÃª por perto. VocÃª Ã© calma, Ã© lar, Ã© tudo." ðŸ¤âœ¨_`,

  `ðŸŒ™ ${tagAuthor} para ${tagParceiro}, sob o cÃ©u estrelado:\n\n_"Se o amor fosse um lugar, eu moraria em vocÃª para sempre." ðŸŒŒðŸ’«_`,

  `ðŸ¯ ${tagAuthor} sorri e diz para ${tagParceiro}:\n\n_"VocÃª adoÃ§a meus dias como mel adoÃ§a o pÃ£o. Te amo mais que ontem, menos que amanhÃ£." ðŸžðŸ’›_`,

  `ðŸŽ» ${tagAuthor} dedica uma melodia para ${tagParceiro}:\n\n_"Cada nota dessa canÃ§Ã£o fala de vocÃª. Meu amor Ã© a trilha sonora da nossa vida." ðŸŽ¶â¤ï¸_`,

  `ðŸŒ¸ ${tagAuthor} entrega uma flor para ${tagParceiro} e fala:\n\n_"Assim como essa flor, nosso amor floresce um pouco mais a cada dia." ðŸŒ·ðŸ’•_`,

  `ðŸ”¥ ${tagAuthor} grita para o mundo, abraÃ§ando ${tagParceiro}:\n\n_"ESSA AQUI Ã‰ MINHA PESSOA! E EU NÃƒO TROCO POR NADA!" ðŸ¥³ðŸ’–_`,

  `ðŸŒˆ ${tagAuthor} segura a mÃ£o de ${tagParceiro} e promete:\n\n_"Depois da tempestade, sempre vai ter vocÃª e eu, juntos, recomeÃ§ando." ðŸŒ¦ï¸ðŸ’ž_`,

  `ðŸ“œ ${tagAuthor} escreve uma carta para ${tagParceiro}:\n\n_"Se eu pudesse resumir minha felicidade em uma palavra, essa palavra seria seu nome." âœï¸ðŸ’—_`,
];


  // â”€â”€ Busca e atualiza o XP direto do banco de dados â”€â”€
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    const xpAntigo = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
    xpAtual = xpAntigo + 5;
  } catch (err) {
    console.error('âš ï¸ [handleDeclarar] Erro ao calcular XP do banco:', err.message);
    // Fallback para o Map em caso de falha de conexÃ£o do banco
    xpAtual = (getXpCasais().get(key) || 0) + 5;
  }

  // Sincroniza a memÃ³ria temporÃ¡ria
  getXpCasais().set(key, xpAtual);

  // Salva de forma persistente o bÃ´nus individual no banco
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: 5 } }
    );
  } catch (e) {
    console.error('âš ï¸ [handleDeclarar] Erro ao persistir XP no banco:', e.message);
  }

  // Monta a lista de pings (Mentions) que serÃ£o acionados em azul no chat do grupo
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: declaracoes[Math.floor(Math.random() * declaracoes.length)] + `\n\nðŸ’° *+5 XP DE AMOR!* Total: *${xpAtual} XP* ðŸš€`,
    mentions: listaMentions,
  }, { quoted: msg });
}


// !ciumento
async function handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos) {
  // â”€â”€ Normaliza o ID de quem enviou o comando â”€â”€
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: 'ðŸ’” SÃ³ quem tÃ¡ em relacionamento pode ficar com ciÃºme, seu(ua) solteiro(a)! ðŸ˜’',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante os JIDs limpos de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Descobre cirurgicamente quem Ã© o parceiro
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // â”€â”€ COOLDOWN DIVIDIDO POR GRUPO + USUÃRIO â”€â”€
  const agora = Date.now();
  const cooldownKey = `${jid}:${senderJidNormalizado}`; // Junta ID do Grupo com ID do UsuÃ¡rio
  const cooldown = getCiumentosMap().get(cooldownKey);
  
  if (cooldown && cooldown > agora) {
    await sock.sendMessage(jid, {
      text: `â° CALMA LÃ! VocÃª acabou de usar ciÃºme neste grupo! PrÃ³xima vez em *${formatarTempo(cooldown - agora)}*! Vai aprender quando Ã© a hora certa! ðŸ˜¤`,
    }, { quoted: msg });
    return;
  }

  // â”€â”€ Extrai menÃ§Ã£o de forma segura â”€â”€
  const rawMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  const mentionedJid = rawMentioned ? jidNormalizedUser(rawMentioned) : null;

  // â”€â”€ Impede ciÃºme do prÃ³prio parceiro â”€â”€
  if (mentionedJid && mentionedJid === parcJid) {
    await sock.sendMessage(jid, {
      text: 'ðŸ˜‚ CiÃºme do seu prÃ³prio par? Isso Ã© amor demais! Mas nÃ£o conta como ciÃºme nÃ£o! ðŸ’•',
    }, { quoted: msg });
    return;
  }

  // â”€â”€ SÃ³ registra cooldown local deste grupo apÃ³s todas as validaÃ§Ãµes â”€â”€
  getCiumentosMap().set(cooldownKey, agora + 30 * 60 * 1000);

  // â”€â”€ Tags de marcaÃ§Ã£o por @ baseadas nos JIDs normatizados â”€â”€
  const tagAuthor   = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);
  const tagSuspeito = mentionedJid ? `@${mentionedJid.split('@')[0]}` : 'alguÃ©m do grupo';

  const cenas = [
    `ðŸ˜¤ ${tagAuthor} EXPLODIU DE CIÃšME VENDO ${tagParceiro} rindo com ${tagSuspeito}!\n\n_${tagParceiro}: "VocÃª tÃ¡ me controlando?" ðŸ’€_`,
    `ðŸ”¥ ${tagAuthor} ficou VERDE DE INVEJA com ${tagParceiro} conversando com ${tagSuspeito}!\n\n_${tagParceiro}: "SÃ©rio? SÃ‰RIO MESMO?" ðŸ˜’_`,
    `ðŸ˜¡ ${tagAuthor} FOÃ‡OU O CELULAR DE ${tagParceiro} procurando coisas suspeitas com ${tagSuspeito}!\n\n_Resultado: Nada encontrado. ENVERGONHADO(A)! ðŸ’€_`,
    `ðŸ¥² ${tagAuthor} FEZ BIRRA porque ${tagParceiro} deu mais atenÃ§Ã£o a ${tagSuspeito}!\n\n_${tagParceiro}: "Que drama! VocÃª Ã© meu amor, RELAXA!" ðŸ˜¤_`,
    `ðŸ’¢ ${tagAuthor} IGNOROU ${tagParceiro} O DIA TODO por causa de ${tagSuspeito}!\n\n_Depois voltaram a namorar com um abraÃ§o apertado. ðŸ˜”ðŸ’•_`,
  ];

  // â”€â”€ Busca e deduz o XP direto do banco de dados â”€â”€
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    const xpAntigo = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
    xpAtual = Math.max(0, xpAntigo - 2); // Garante que o XP nÃ£o fique negativo
  } catch (err) {
    console.error('[handleCiumento] Erro ao calcular XP do banco:', err.message);
    xpAtual = Math.max(0, (getXpCasais().get(key) || 0) - 2);
  }

  // Sincroniza o mapa temporÃ¡rio local
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

  // â”€â”€ Monta a lista de pings (Mentions) que serÃ£o acionados em azul no chat â”€â”€
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);
  if (mentionedJid) listaMentions.push(mentionedJid);

  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + `\n\nâš ï¸ *-2 XP* por CIÃšME CEGO! Total: *${xpAtual} XP* ðŸ˜¤`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !status / !statu
async function handleStatu(sock, msg, jid, author, senderJid, relacionamentos) {
  // Normaliza o ID de quem enviou o comando
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: 'ðŸ’” VocÃª nÃ£o estÃ¡ num relacionamento!\n_Use *!casar @alguem* para encontrar o amor!_',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // Garante JIDs normalizados para evitar problemas de compatibilidade
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

  // Determina quem Ã© o parceiro
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  let xp = 0;
  try {
    // â”€â”€ BUSCA O XP REAL E ATUALIZADO DO BANCO DE DADOS â”€â”€
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);

    // Soma o XP individual salvo em cada usuÃ¡rio
    const xpA = userA?.xpCasal || 0;
    const xpB = userB?.xpCasal || 0;
    xp = xpA + xpB;
  } catch (err) {
    console.error('âš ï¸ [handleStatu] Erro ao buscar XP do banco:', err.message);
    // Fallback seguro caso o banco falhe
    xp = typeof getXpCasais === 'function' ? (getXpCasais().get(key) || 0) : (rel.xp || 0);
  }

  const desde   = rel.desde ? Date.now() - rel.desde : 0;
  const dias    = Math.floor(desde / (1000 * 60 * 60 * 24));
  const horas   = Math.floor((desde % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // CÃ¡lculo de NÃ­veis e Barra de Progresso
  const niveis = [
    { limite: 50,       nome: 'RecÃ©m-casados',   emoji: 'ðŸŒ±' },
    { limite: 150,      nome: 'Casal apaixonado', emoji: 'ðŸ’•' },
    { limite: 300,      nome: 'Casal sÃ³lido',     emoji: 'ðŸ’ª' },
    { limite: 500,      nome: 'Casal veterano',   emoji: 'â­' },
    { limite: 800,      nome: 'Casal lendÃ¡rio',   emoji: 'ðŸ†' },
    { limite: Infinity, nome: 'CASAL IMORTAL',    emoji: 'ðŸ‘‘' },
  ];

  const nivelAtual = niveis.find(n => xp < n.limite);
  const proximo    = nivelAtual.limite;
  const xpProximo  = proximo === Infinity ? '---' : proximo - xp;

  // RenderizaÃ§Ã£o da Barra de Progresso Visual
  let barraXp = 'â–ˆ'.repeat(10);
  if (proximo !== Infinity) {
    const porcentagem = Math.min(Math.max(xp / proximo, 0), 1); // Evita bugs de divisÃ£o ou limites
    const blocosCheios = Math.floor(porcentagem * 10);
    barraXp = 'â–ˆ'.repeat(blocosCheios) + 'â–‘'.repeat(10 - blocosCheios);
  }

  // Conquistas Baseadas no Progresso Real
  const conquistas = [];
  if (dias >= 1)  conquistas.push('ðŸŒ… *1 dia* de romance');
  if (dias >= 7)  conquistas.push('ðŸŒŸ *1 SEMANA* de puro amor!');
  if (dias >= 30) conquistas.push('ðŸ¥‡ *1 MÃŠS INTEIRO* juntos (VCS AGUENTAM!)');
  if (xp >= 100)  conquistas.push('ðŸ’° *100 XP* acumulados (ELITE!)');
  if (xp >= 500)  conquistas.push('ðŸ‘‘ *500 XP* (LENDÃRIOS MESMO!)');

  const bonusAtivo = typeof temXpBonus === 'function' && temXpBonus(key) 
    ? '\nðŸŽ‰ *XP DUPLO ATIVADO! APROVEITEM!* ðŸŽ‰' 
    : '';

  // Montagem das Tags de ExibiÃ§Ã£o sem carregar lixo de conexÃµes (:1, :2...)
  const tagSender = senderJidNormalizado ? `@${senderJidNormalizado.split('@')[0]}` : author;
  const tagParc   = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  let texto =
    `ðŸ’‘ *STATUS Ã‰PICO DO CASAL*\n\n` +
    `ðŸ‘¥ ${tagSender} ${rel.tipo === 'namoro' ? 'ðŸ’•' : 'ðŸ’'} ${tagParc}\n` +
    `ðŸ’Ž Tipo: *${rel.tipo === 'namoro' ? 'NAMORANDO ðŸŒŸ' : 'CASADOS ðŸ‘°'}*\n` +
    `â° Tempo junto: *${dias}d ${horas}h* (NÃ£o se largam!)\n\n` +
    `${nivelAtual.emoji} NÃVEL: *${nivelAtual.nome}*\n` +
    `âš¡ XP: *${xp}/${proximo === Infinity ? 'âˆž' : proximo}* [${barraXp}]\n` +
    `ðŸš€ Faltam *${xpProximo}* XP pro PRÃ“XIMO NÃVEL!` +
    bonusAtivo;

  if (conquistas.length > 0) {
    texto += `\n\nðŸ† *CONQUISTAS:*\n` + conquistas.map(c => `   âœ… ${c}`).join('\n');
  }

  await sock.sendMessage(jid, {
    text: texto,
    mentions: [senderJidNormalizado, parcJid].filter(Boolean),
  }, { quoted: msg });
}

// !meupar
async function handleMeuPar(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, {
      text: 'ðŸ’” VocÃª estÃ¡ solteiro(a)!\n_Use *!casar @alguem* para encontrar o amor!_',
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
    `ðŸ’• O par de ${tagRemetente} Ã© ${tagParceiro}! Que casal lindo! ðŸ˜`,
    `â¤ï¸ VocÃª estÃ¡ ${rel.tipo === 'namoro' ? 'namorando' : 'casado(a) com'} ${tagParceiro}! Cuida bem, hein!`,
    `ðŸ˜ O seu amor Ã© ${tagParceiro}! Trata com carinho! âœ¨`,
    `ðŸ’‘ ${tagParceiro} Ã© seu(ua) ${rel.tipo === 'namoro' ? 'namorado(a)' : 'cÃ´njuge'}! NÃ£o esquece nÃ£o!`,
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
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: 'ðŸ’” VocÃª precisa estar num relacionamento!' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  if (temXpBonus(key)) {
    const restante = getXpBonus().get(key).expiry - Date.now();
    await sock.sendMessage(jid, {
      text: `â° O XP Duplo jÃ¡ estÃ¡ ativo! Expira em *${formatarTempo(restante)}*.`,
    }, { quoted: msg });
    return;
  }

  // â”€â”€ Busca o XP real somado do banco de dados â”€â”€
  let xpTotalCasal = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpTotalCasal = (userA?.xpCasal || 0) + (userB?.xpCasal || 0);
  } catch (err) {
    console.error('âš ï¸ Error ao ler XP para bÃ´nus:', err.message);
    xpTotalCasal = getXpCasais().get(key) || 0;
  }

  if (xpTotalCasal < 30) {
    await sock.sendMessage(jid, {
      text: `âŒ VocÃª precisa de pelo menos *30 XP* para ativar o XP Duplo!\n_VocÃªs tÃªm: *${xpTotalCasal} XP*_`,
    }, { quoted: msg });
    return;
  }

  // Desconta os 30 XP dividindo a cobranÃ§a entre os dois no banco de dados (-15 para cada)
  const novoXp = xpTotalCasal - 30;
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: -15 } }
    );
  } catch (e) {
    console.error('âš ï¸ Erro ao cobrar XP do bÃ´nus:', e.message);
  }

  getXpCasais().set(key, novoXp);
  getXpBonus().set(key, { ativo: true, expiry: Date.now() + 2 * 60 * 60 * 1000 });

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text:
      `ðŸŽ¯ *XP DUPLO ATIVADO!*\n\n` +
      `${tagRemetente} ativou o XP duplo para o casal com ${tagParceiro}!\n\n` +
      `ðŸ’¸ *-30 XP* (custo) | Restante: *${novoXp} XP*\n` +
      `â° Dura *2 horas*! Use todos os comandos diÃ¡rios agora!`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !aniversariocasal
async function handleAniversarioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: 'ðŸ’” VocÃª nÃ£o estÃ¡ num relacionamento!' }, { quoted: msg });
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
  if (anos >= 1)    marcos.push(`ðŸŽ‚ *${anos} ano(s) juntos!* Isso Ã© incrÃ­vel!`);
  if (meses >= 1)   marcos.push(`ðŸ“… *${meses} mÃªs(es) juntos!*`);
  if (semanas >= 1) marcos.push(`ðŸ—“ï¸ *${semanas} semana(s) juntos!*`);

  // â”€â”€ Adiciona o prÃªmio de comemoraÃ§Ã£o (+20 XP) direto no banco de dados â”€â”€
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
    console.error('âš ï¸ Erro ao persistir XP de aniversÃ¡rio:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + 20;
  }
  
  getXpCasais().set(key, xpAtual);

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  let texto =
    `ðŸŽ‰ *ANIVERSÃRIO DO CASAL* ðŸŽ‰\n\n` +
    `ðŸ’‘ ${tagRemetente} e ${tagParceiro}\n\n` +
    `ðŸ“… *${dias} dia(s)* juntos!\n`;
  if (marcos.length > 0) texto += marcos.join('\n') + '\n';
  texto +=
    `\nðŸ’° *+20 XP* de celebraÃ§Ã£o! Total: *${xpAtual} XP*\n\n` +
    `_ParabÃ©ns pelo tempo juntos! ðŸ¥‚_`;

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: texto,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !duelodecasais
async function handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos) {
  // â”€â”€ Normaliza o ID de quem enviou o comando â”€â”€
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const foundA = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  if (!foundA) {
    await sock.sendMessage(jid, { text: 'ðŸ’” VocÃª precisa estar num relacionamento para duelar!' }, { quoted: msg });
    return;
  }

  // â”€â”€ Extrai a menÃ§Ã£o do oponente de forma segura â”€â”€
  const rawMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!rawMentioned) {
    await sock.sendMessage(jid, {
      text: 'âš ï¸ Marque alguÃ©m do outro casal para duelar!\nExemplo: *!duelodecasais @fulano*',
    }, { quoted: msg });
    return;
  }

  const oponenteJidNormalizado = jidNormalizedUser(rawMentioned);
  const foundB = findRelByJid(jid, oponenteJidNormalizado, relacionamentos);
  
  if (!foundB) {
    await sock.sendMessage(jid, {
      text: `âŒ *@${oponenteJidNormalizado.split('@')[0]}* nÃ£o estÃ¡ num relacionamento! SÃ³ pode duelar casal contra casal!`,
      mentions: [oponenteJidNormalizado],
    }, { quoted: msg });
    return;
  }

  if (foundA.key === foundB.key) {
    await sock.sendMessage(jid, { text: 'ðŸ˜‚ VocÃª nÃ£o pode duelar com o prÃ³prio par!' }, { quoted: msg });
    return;
  }

  // Purifica e normaliza os JIDs de todos os 4 integrantes
  const jidA1 = foundA.rel.jidA ? jidNormalizedUser(foundA.rel.jidA) : null;
  const jidA2 = foundA.rel.jidB ? jidNormalizedUser(foundA.rel.jidB) : null;
  const jidB1 = foundB.rel.jidA ? jidNormalizedUser(foundB.rel.jidA) : null;
  const jidB2 = foundB.rel.jidB ? jidNormalizedUser(foundB.rel.jidB) : null;

  // â”€â”€ Busca o XP real acumulado de cada casal direto do Banco de Dados â”€â”€
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
    console.error('âš ï¸ [Duelo] Erro ao buscar XP do banco:', err.message);
    xpA = getXpCasais().get(foundA.key) || 0;
    xpB = getXpCasais().get(foundB.key) || 0;
  }

  // CriaÃ§Ã£o das tags com @ para os textos
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
    const ganho = Math.min(20, Math.floor(xpB * 0.1)) || 5; // MÃ­nimo de 5 caso dÃª zero
    
    // Configura a alteraÃ§Ã£o persistente (+ganho dividido pro Casal A, -ganho dividido pro Casal B)
    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2].filter(Boolean) } }, { $inc: { xpCasal: Math.ceil(ganho / 2) } }),
      Usuario.updateMany({ idWhatsApp: { $in: [jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: -Math.ceil(ganho / 2) } })
    );

    getXpCasais().set(foundA.key, xpA + ganho);
    getXpCasais().set(foundB.key, Math.max(0, xpB - ganho));

    resultado =
      `ðŸ† *${casal1Mencoes}* VENCERU o duelo!\n\n` +
      `ðŸ’° *+${ganho} XP* para os campeÃµes!\n` +
      `ðŸ’” *-${ganho} XP* para *${casal2Mencoes}*!\n\n` +
      `_Que casal mais forte! ðŸ’ª_`;
  } else if (scoreB > scoreA) {
    const ganho = Math.min(20, Math.floor(xpA * 0.1)) || 5;

    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: Math.ceil(ganho / 2) } }),
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2].filter(Boolean) } }, { $inc: { xpCasal: -Math.ceil(ganho / 2) } })
    );

    getXpCasais().set(foundB.key, xpB + ganho);
    getXpCasais().set(foundA.key, Math.max(0, xpA - ganho));

    resultado =
      `ðŸ† *${casal2Mencoes}* VENCERU o duelo!\n\n` +
      `ðŸ’° *+${ganho} XP* para os campeÃµes!\n` +
      `ðŸ’” *-${ganho} XP* para *${casal1Mencoes}*!\n\n` +
      `_Que reviravolta! ðŸ˜±_`;
  } else {
    // Empate dÃ¡ +3 XP individual para cada participante
    mudancasBanco.push(
      Usuario.updateMany({ idWhatsApp: { $in: [jidA1, jidA2, jidB1, jidB2].filter(Boolean) } }, { $inc: { xpCasal: 3 } })
    );

    getXpCasais().set(foundA.key, xpA + 3);
    getXpCasais().set(foundB.key, xpB + 3);
    resultado = `ðŸ¤ *EMPATE!* Ambos os casais sÃ£o igualmente incrÃ­veis!\n\nðŸ’° *+3 XP* para ambos!`;
  }

  // Executa todas as atualizaÃ§Ãµes no banco simultaneamente
  if (mudancasBanco.length > 0) {
    await Promise.all(mudancasBanco).catch(e => console.error('âš ï¸ [Duelo] Erro ao salvar XP no banco:', e.message));
  }

  // â”€â”€ Monta a lista completa de Mentions (Os 4 JIDs) â”€â”€
  const listaMentions = [jidA1, jidA2, jidB1, jidB2].filter(Boolean);

  await sock.sendMessage(jid, {
    text:
      `âš”ï¸ *DUELO DE CASAIS* âš”ï¸\n\n` +
      `ðŸ’‘ *${casal1Mencoes}* (${xpA} XP)\n` +
      `VS\n` +
      `ðŸ’‘ *${casal2Mencoes}* (${xpB} XP)\n\n` +
      `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n${resultado}`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !rankcasais
async function handleRankCasais(sock, msg, jid, relacionamentos) {
  if (!relacionamentos || relacionamentos.size === 0) {
    await sock.sendMessage(jid, {
      text: 'ðŸ“­ Nenhum casal cadastrado ainda!\n_Use *!casar @alguem* pra comeÃ§ar!_',
    }, { quoted: msg });
    return;
  }

  // â”€â”€ Busca membros atuais do grupo para filtrar casais que saÃ­ram â”€â”€
  let membrosDoGrupo = null;
  try {
    const meta = await sock.groupMetadata(jid);
    membrosDoGrupo = new Set(meta.participants.map(p => jidNormalizedUser(p.id)));
  } catch {
    // Se falhar (ex: falta de permissÃ£o ou delay), exibe todos sem filtro
  }

  // â”€â”€ Filtra e processa a lista buscando os dados persistidos no banco de dados â”€â”€
  const casaisFiltrados = [...relacionamentos.entries()].filter(([, rel]) => {
    if (!membrosDoGrupo) return true;
    const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
    const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
    
    return membrosDoGrupo.has(jidANormalizado) && membrosDoGrupo.has(jidBNormalizado);
  });

  // Mapeia os casais buscando o XP individual de cada usuÃ¡rio de forma assÃ­ncrona
  const lista = await Promise.all(
    casaisFiltrados.map(async ([, rel]) => {
      const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
      const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;

      let xpTotalCasal = 0;

      try {
        // Busca o documento dos dois usuÃ¡rios na coleÃ§Ã£o 'Usuario'
        const [userA, userB] = await Promise.all([
          jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
          jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
        ]);

        // Soma o xpCasal de ambos os parceiros armazenados no banco de dados
        const xpA = userA?.xpCasal || 0;
        const xpB = userB?.xpCasal || 0;
        xpTotalCasal = xpA + xpB;
      } catch (err) {
        console.error('âš ï¸ [handleRankCasais] Erro ao buscar XP do banco:', err.message);
        // Fallback para a memÃ³ria caso ocorra alguma falha crÃ­tica de conexÃ£o com o banco
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
      text: 'ðŸ“­ Nenhum casal ativo neste grupo no momento!',
    }, { quoted: msg });
    return;
  }

  const medals   = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰', '4ï¸âƒ£', '5ï¸âƒ£', '6ï¸âƒ£', '7ï¸âƒ£', '8ï¸âƒ£', '9ï¸âƒ£', 'ðŸ”Ÿ'];
  const mentions = [];
  let texto = `ðŸ† *RANKING DOS CASAIS* ðŸ†\n\n`;

  top10.forEach((c, i) => {
    const tipoEmoji = c.tipo === 'namoro' ? 'ðŸ’' : 'ðŸ’';
    
    const jidANormalizado = c.jidA ? jidNormalizedUser(c.jidA) : null;
    const jidBNormalizado = c.jidB ? jidNormalizedUser(c.jidB) : null;

    const tagA = jidANormalizado ? `@${jidANormalizado.split('@')[0]}` : c.nomeA;
    const tagB = jidBNormalizado ? `@${jidBNormalizado.split('@')[0]}` : c.nomeB;
    
    const barraXp   = 'â­'.repeat(Math.min(Math.floor(c.xp / 10), 5)) || 'â–«ï¸';
    const diasLabel = c.diasJuntos === 1 ? 'dia' : 'dias';

    if (jidANormalizado) mentions.push(jidANormalizado);
    if (jidBNormalizado) mentions.push(jidBNormalizado);

    texto +=
      `${medals[i]} ${tipoEmoji} ${tagA} ðŸ’• ${tagB}\n` +
      `${barraXp} *${c.xp} XP* Â· ðŸ“… *${c.diasJuntos} ${diasLabel}* Â· ðŸ… *${c.score} pts*\n\n`;
  });

  texto += `_Score = XP + (dias juntos Ã— 2)_\n_Use *!status* pra ver o status completo!_`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// !desafiocasal
async function handleDesafioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: 'âŒ VocÃªs nÃ£o sÃ£o um casal ainda, seu(ua) solteiro(a)! ðŸ˜­' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: 'â›” VocÃª estÃ¡ de castigo! Sem comando de desafio! ðŸš«' }, { quoted: msg });
    return;
  }

  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const desafios = [
    `ðŸ’‘ *DESAFIO: Cumprimento de 5 palavras* â€” ${tagRemetente} e ${tagParceiro} tÃªm que dar um elogio de ATÃ‰ 5 palavras pro outro! +15 XP ðŸŽ`,
    `ðŸ¤ *DESAFIO: SilÃªncio Apaixonado* â€” ${tagRemetente} e ${tagParceiro}, vocÃªs tÃªm 30 min SEM falar sobre NADA chato! +20 XP ðŸ“±`,
    `ðŸŽµ *DESAFIO: MÃºsica do Casal* â€” Escolham uma mÃºsica que define o relacionamento de vocÃªs! +25 XP ðŸŽ§`,
    `ðŸ“¸ *DESAFIO: Selfie no Espelho* â€” Tirem uma selfie juntos (ou descrevam)! +15 XP ðŸ¤³`,
    `ðŸ’¬ *DESAFIO: Piada de Casal* â€” Um conta uma piada pro outro. Se o outro rir, +18 XP ðŸ˜‚`,
    `ðŸŽ­ *DESAFIO: Imitar o(a) Parceiro(a)* â€” VocÃªs IMITAM um ao outro exagerando! +12 XP ðŸ¤£`,
    `ðŸƒ *DESAFIO: Corrida de AbraÃ§os* â€” Quem abraÃ§ar mais forte em 30 segundos ganha! +17 XP ðŸ¤—`,
  ];

  const desafio = desafios[Math.floor(Math.random() * desafios.length)];
  const xpGanho = parseInt(desafio.match(/\+(\d+)\s*XP/)?.[1] || '10');
  const temBonus = temXpBonus(key);
  const xpFinal  = temBonus ? xpGanho * 2 : xpGanho;

  // â”€â”€ Busca o XP base real acumulado direto do Banco de Dados â”€â”€
  let xpAtual = 0;
  try {
    const [userA, userB] = await Promise.all([
      jidANormalizado ? Usuario.findOne({ idWhatsApp: jidANormalizado }).select('xpCasal').lean() : null,
      jidBNormalizado ? Usuario.findOne({ idWhatsApp: jidBNormalizado }).select('xpCasal').lean() : null
    ]);
    xpAtual = (userA?.xpCasal || 0) + (userB?.xpCasal || 0) + xpFinal;

    // Persiste o acrÃ©scimo distribuÃ­do no banco
    await Usuario.updateMany(
      { idWhatsApp: { $in: [jidANormalizado, jidBNormalizado].filter(Boolean) } },
      { $inc: { xpCasal: xpFinal } }
    );
  } catch (err) {
    console.error('âš ï¸ [DesafioCasal] Erro ao sincronizar XP com o Banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpFinal;
  }

  // Atualiza memÃ³ria temporÃ¡ria local
  getXpCasais().set(key, xpAtual);
  if (temBonus) getXpBonus().delete(key);

  const extras = temBonus ? '\n\nðŸš€ *BÃ”NUS APLICADO!* VocÃªs ganharam XP DOBRADO nesse desafio! ðŸŽ‰' : '';
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: `${desafio}${extras}\n\nðŸ’° *+${xpFinal} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// !rankingcasais / !competicaocasais
async function handleCompetiacaoCasais(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: 'âŒ VocÃªs nÃ£o sÃ£o um casal! ðŸ˜­' }, { quoted: msg });
    return;
  }

  const { key } = found;

  if (relacionamentos.size === 0) {
    await sock.sendMessage(jid, { text: 'ðŸ“­ Nenhum casal cadastrado ainda!' }, { quoted: msg });
    return;
  }

  // â”€â”€ Carrega os cadastros mapeando e normalizando os JIDs â”€â”€
  const casaisLista = [...relacionamentos.entries()].map(([k, r]) => ({
    key: k,
    nomeA: r.nomeA || 'Desconhecido',
    nomeB: r.nomeB || 'Desconhecido',
    jidA: r.jidA ? jidNormalizedUser(r.jidA) : null,
    jidB: r.jidB ? jidNormalizedUser(r.jidB) : null,
  }));

  // â”€â”€ Resgata dinamicamente o XP em tempo real direto do banco para o Ranking â”€â”€
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

  const medals = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰', '4ï¸âƒ£', '5ï¸âƒ£'];
  const mentions = [];

  let texto = 'ðŸ’‘ *COMPETIÃ‡ÃƒO ENTRE CASAIS*\n\nðŸ† *RANKING DE XP:*\n';

  ranking.slice(0, 5).forEach((r, i) => {
    const tagA = r.jidA ? `@${r.jidA.split('@')[0]}` : r.nomeA;
    const tagB = r.jidB ? `@${r.jidB.split('@')[0]}` : r.nomeB;
    const destaque = r.key === key ? ' ðŸ‘ˆ' : '';

    if (r.jidA) mentions.push(r.jidA);
    if (r.jidB) mentions.push(r.jidB);

    texto += `${medals[i]} ${tagA} ðŸ’‘ ${tagB} â€” *${r.xp} XP*${destaque}\n`;
  });

  texto += `\nðŸ‘¤ *VOCÃŠ ESTÃ EM #${posicao}* (${xpMeuCasal} XP â€” ${nivel.nome})\n`;
  texto += `\nðŸŽ¯ *O ranking acompanha suas pontuaÃ§Ãµes em tempo real!*`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// !surpresa
async function handleSurpresa(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  
  if (!found) {
    await sock.sendMessage(jid, { text: 'âŒ VocÃª nÃ£o tem parceiro pra surpreender! ðŸ˜­' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: 'â›” VocÃªs estÃ£o de castigo! ðŸš«' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const surpresas = [
    `ðŸŽˆ *SURPRESA MEGA*: ${tagParceiro} recebeu uma SURPRESA MEGA de ${tagRemetente}! SÃ³ pode ser coisa boa! ðŸ˜ +25 XP!`,
    `ðŸŽ¥ *SURPRESA CINEMATOGRÃFICA*: Uma super cena de romance foi preparada por ${tagRemetente} para ${tagParceiro}! Velas, pÃ©talas e mÃºsica! +30 XP! ðŸ’•`,
    `ðŸŒŸ *SURPRESA NOTURNA*: ${tagRemetente} planejou um piquenique na madrugada com ${tagParceiro}! Que romÃ¢ntico! +35 XP! ðŸŒ™`,
    `ðŸŽ€ *SURPRESA FESTA*: Tem festa secreta organizada por ${tagRemetente} para celebrar ${tagParceiro}! Romantismo puro! +28 XP! ðŸŽ‰`,
    `ðŸ» *SURPRESA CARINHO TOTAL*: ${tagRemetente} preparou massagem e banho de espuma relaxante para ${tagParceiro}! Carinho total! +32 XP! ðŸ’¦`,
  ];

  const surp = surpresas[Math.floor(Math.random() * surpresas.length)];
  const xpGanho = parseInt(surp.match(/\+(\d+)\s*XP/)?.[1] || '20');

  // â”€â”€ Incrementa a pontuaÃ§Ã£o em tempo real no MongoDB â”€â”€
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
    console.error('âš ï¸ [Surpresa] Erro ao salvar XP no banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  }

  getXpCasais().set(key, xpAtual);

  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: surp + `\n\nðŸ’° *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}


// !domingo
async function handleDomingo(sock, msg, jid, author, senderJid, relacionamentos) {
  // â”€â”€ Normaliza o ID de quem enviou o comando â”€â”€
  const senderJidNormalizado = jidNormalizedUser(senderJid);

  const found = findRelByJid(jid, senderJidNormalizado, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: 'âŒ VocÃª estÃ¡ sozinho(a)! ðŸ˜­' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJidNormalizado)) {
    await sock.sendMessage(jid, { text: 'â›” Castigo! Sem fun! ðŸš«' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  
  // Garante os JIDs limpos de ambos os parceiros
  const jidANormalizado = rel.jidA ? jidNormalizedUser(rel.jidA) : null;
  const jidBNormalizado = rel.jidB ? jidNormalizedUser(rel.jidB) : null;
  const parcJid = jidANormalizado === senderJidNormalizado ? jidBNormalizado : jidANormalizado;

  // CriaÃ§Ã£o das tags de marcaÃ§Ã£o com @
  const tagRemetente = `@${senderJidNormalizado.split('@')[0]}`;
  const tagParceiro  = parcJid ? `@${parcJid.split('@')[0]}` : (rel.nomeA === author ? rel.nomeB : rel.nomeA);

  const domingos = [
    `â˜• *DOMINGO DE CAFÃ‰ E SÃ‰RIE*: ${tagRemetente} e ${tagParceiro} vÃ£o passar o domingo inteiro comendo e assistindo sÃ©rie juntos! +22 XP! ðŸ“º`,
    `ðŸ  *DOMINGO DE LIMPEZA*: ${tagRemetente} e ${tagParceiro} limpam a casa juntos (com mÃºsica alta claro!) e depois descansam! +18 XP! ðŸ§¹`,
    `ðŸ‘¨â€ðŸ³ *DOMINGO DE COZINHA*: ${tagRemetente} preparou um almoÃ§o gourmet especial para ${tagParceiro}! Que romÃ¢ntico! +26 XP! ðŸ`,
    `ðŸ›ï¸ *DOMINGO DE PREGUIÃ‡A*: ${tagRemetente} e ${tagParceiro} ficam a manhÃ£ toda jogados sem fazer nada! +20 XP! ðŸ˜´`,
    `ðŸŽ® *DOMINGO GAMER*: ${tagRemetente} e ${tagParceiro} jogam um jogo cooperativo juntos! Maratona gamer! +24 XP! ðŸŽ®`,
  ];

  const domingo = domingos[Math.floor(Math.random() * domingos.length)];
  const xpGanho = parseInt(domingo.match(/\+(\d+)\s*XP/)?.[1] || '20');

  // â”€â”€ Busca e incrementa a pontuaÃ§Ã£o em tempo real no MongoDB â”€â”€
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
    console.error('âš ï¸ [Domingo] Erro ao salvar XP no banco:', err.message);
    xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  }

  // Sincroniza a memÃ³ria temporÃ¡ria local
  getXpCasais().set(key, xpAtual);

  // Monta a lista de pings (Mentions)
  const listaMentions = [senderJidNormalizado];
  if (parcJid) listaMentions.push(parcJid);

  await sock.sendMessage(jid, {
    text: domingo + `\n\nðŸ’° *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: listaMentions,
  }, { quoted: msg });
}

// handleAbraco
async function handleAbraco(sock, msg, jid, author, senderJid, relacionamentos) {
  const abracos = [
    'um abraÃ§o apertado ðŸ¤—',
    'um abraÃ§o de urso ðŸ»',
    'um abraÃ§o cheio de carinho ðŸ’ž',
    'um abraÃ§o que durou minutos â³',
    'um abraÃ§o surpresa por trÃ¡s ðŸ˜„',
  ];
  const a = abracos[Math.floor(Math.random() * abracos.length)];

  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'abraco', 'ðŸ¤—', `deu ${a}`, 3);
}

// handleFlores
async function handleFlores(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'flores', 'ðŸŒ¹', 'enviou um buquÃª de rosas');
}

// handleDoces
async function handleDoces(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'doces', 'ðŸ¬', 'mandou uma caixa de doces');
}

// handleCarta
async function handleCarta(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'carta', 'ðŸ’Œ', 'escreveu uma carta de amor');
}

// handleMimo
async function handleMimo(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'mimo', 'ðŸŽ', 'fez um mimo especial');
}

// handleBeijo
async function handleBeijo(sock, msg, jid, author, senderJid, relacionamentos) {
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'beijo', 'ðŸ’‹', 'deu um beijÃ£o');
}

module.exports = {
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
  handleAbraco,
  handleFlores,
handleDoces,
handleCarta,
handleMimo,
handleBeijo,
};