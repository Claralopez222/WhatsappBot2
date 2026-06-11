const path = require('path');

const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));
const { getNivelInfo } = require(path.join(__dirname, '..', 'utils', 'levelUtils'));

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
//
// Cada entrada define qual itemKey (da !lojacasal) o usuário precisa
// ter no inventário para usar aquele comando. O item é CONSUMIDO (−1)
// ao ser usado com sucesso.
//
const ITEM_NECESSARIO = {
  flores:   { key: 'flores',   nome: 'Flores 🌹'                },
  doces:    { key: 'morango',  nome: 'Morango com Chocolate 🍓'  },
  carta:    { key: 'carta',    nome: 'Carta de Amor 💌'          },
  mimo:     { key: 'caixa',    nome: 'Caixa Presente Luxo 🎁'    },
  beijo:    { key: 'perfume',  nome: 'Perfume Premium 🌸'        },
  abraco:   { key: 'urso',     nome: 'Ursinho de Pelúcia 🧸'     },
  jantar:   { key: 'taça',     nome: 'Taça para Vinho 🍷'        },
  cinema:   { key: 'almofada', nome: 'Almofada Casal 🛋️'         },
  viajar:   { key: 'garrafa',  nome: 'Garrafa Vinho Tinto 🍾'    },
  serenata: { key: 'vela',     nome: 'Vela Aromática 🕯️'         },
};

// ─── Helper: verifica E consome 1 unidade do item (atômico) ───
//
// Retorna true  → item consumido, pode prosseguir.
// Retorna false → mensagem de erro já enviada, abortar handler.
//
async function _checkConsumeItem(sock, msg, jid, senderJid, comando) {
  const itemInfo = ITEM_NECESSARIO[comando];
  if (!itemInfo) return true; // comando não exige item

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
const handleFlores = _makeCarinhHandler('flores');
const handleDoces  = _makeCarinhHandler('doces');
const handleCarta  = _makeCarinhHandler('carta');
const handleMimo   = _makeCarinhHandler('mimo');
const handleBeijo  = _makeCarinhHandler('beijo');
const handleAbraco = _makeCarinhHandler('abraco');

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

// ─── Handlers de programa (com verificação de item) ───────────

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
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'jantar', '🍽️', `levou num jantar ${r}`);
}

// handleCinema
async function handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos) {
  const filmes = [
    'um romance 💕',
    'terror e ficou com medo 😱',
    'comédia e não parou de rir 😂',
    'ação e roubou a pipoca 🍿',
    'um drama e os dois choraram 😭',
  ];
  const f = filmes[Math.floor(Math.random() * filmes.length)];
  await handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'cinema', '🎬', `levou ao cinema assistir ${f}`);
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

// ─── Handlers sem item obrigatório ────────────────────────────

async function handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Só quem tem um relacionamento pode se declarar, seu(ua) romantudo(a) solteiro(a)! 😤',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

  const declaracoes = [
    `🔥 *${author}* se DECLARA APAIXONADO(A) para *${parceiro}*:\n\n_"VOCÊ É MINHA! De pé ou deitado(a), de qualquer jeito, é você que eu quero! Te amo demais!" 💘🔥_`,
    `💋 *${author}* BEIJA *${parceiro}* na frente de TODOS e grita:\n\n_"ESSA PESSOA AQUI É MINHA! E EU SOU FELIZ COM ELE(ELA)! 💪💕"_`,
    `🌟 *${author}* faz uma DECLARAÇÃO ÉPICA para *${parceiro}*:\n\n_"Você me faz perder a razão todo dia! É praticamente um vício... UM VÍCIO GOSTOSO! Te amo, seu(ua) criatura!" 🥰_`,
    `⚡ *${author}* para *${parceiro}*:\n\n_"Se eu pudesse escolher novamente, eu AINDA escolheria você! Sem pestanejar! Sem volta! TE AMO!" 💯💕_`,
    `🎸 *${author}* canta pro mundo:\n\n_"EU AMO ESSE(A) CARA(A)! QUEM NÃO GOSTOU, PROBLEMA SUA! É MEU(MINHA) AMOR E PRONTO!" 🎵🔥_`,
  ];

  const xpAtual = (getXpCasais().get(key) || 0) + 5;
  getXpCasais().set(key, xpAtual);

  await sock.sendMessage(jid, {
    text: declaracoes[Math.floor(Math.random() * declaracoes.length)] + `\n\n💰 *+5 XP DE AMOR!* Total: *${xpAtual} XP* 🚀`,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

// !ciumento
async function handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Só quem tá em relacionamento pode ficar com ciúme, seu(ua) solteiro(a)! 😒',
    }, { quoted: msg });
    return;
  }

  const agora    = Date.now();
  const cooldown = getCiumentosMap().get(senderJid);
  if (cooldown && cooldown > agora) {
    await sock.sendMessage(jid, {
      text: `⏰ CALMA LÁ! Você acabou de usar ciúme! Próxima vez em *${formatarTempo(cooldown - agora)}*! Vai aprender quando é a hora certa! 😤`,
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro     = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid      = rel.nomeA === author ? rel.jidB  : rel.jidA;

  // ── Extrai menção de forma segura (msg tem prioridade sobre content) ──
  const mentionedJid =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
    content?.extendedTextMessage?.contextInfo?.mentionedJid     ||
    [];

  // ── Impede ciúme do próprio parceiro ──
  if (mentionedJid[0] && mentionedJid[0] === parcJid) {
    await sock.sendMessage(jid, {
      text: '😂 Ciúme do seu próprio par? Isso é amor demais! Mas não conta como ciúme não! 💕',
    }, { quoted: msg });
    return;
  }

  // ── Só registra cooldown após todas as validações ──
  getCiumentosMap().set(senderJid, agora + 30 * 60 * 1000);

  const suspeito = mentionedJid[0]
    ? `@${mentionedJid[0].split('@')[0]}`
    : 'alguém do grupo';

  const cenas = [
    `😤 *${author}* EXPLODIU DE CIÚME VENDO *${parceiro}* rindo com *${suspeito}*!\n\n_${parceiro}: "Você tá me controlando?" 💀_`,
    `🔥 *${author}* ficou VERDE DE INVEJA com *${parceiro}* conversando com *${suspeito}*!\n\n_${parceiro}: "Sério? SÉRIO MESMO?" 😒_`,
    `😡 *${author}* FOÇOU O CELULAR DE *${parceiro}* procurando coisas suspeitas com *${suspeito}*!\n\n_Resultado: Nada encontrado. ENVERGONHADO(A)! 💀_`,
    `🥲 *${author}* FEZ BIRRA porque *${parceiro}* deu mais atenção a *${suspeito}*!\n\n_${parceiro}: "Que drama! Você é meu amor, RELAXA!" 😤_`,
    `💢 *${author}* IGNOROU *${parceiro}* O DIA TODO por causa de *${suspeito}*!\n\n_Depois voltaram a namorar com um abraço apertado. 😔💕_`,
  ];

  // ── Deduz XP e persiste no banco ──
  const xpAtual = Math.max(0, (getXpCasais().get(key) || 0) - 2);
  getXpCasais().set(key, xpAtual);

  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [rel.jidA, rel.jidB].filter(Boolean) } },
      { $inc: { xpCasal: -2 } }
    );
  } catch (e) {
    console.error('[handleCiumento] Erro ao persistir XP:', e.message);
  }

  const mentions = mentionedJid[0]
    ? [mentionedJid[0], parcJid].filter(Boolean)
    : [parcJid].filter(Boolean);

  await sock.sendMessage(jid, {
    text: cenas[Math.floor(Math.random() * cenas.length)] + `\n\n⚠️ *-2 XP* por CIÚME CEGO! Total: *${xpAtual} XP* 😤`,
    mentions,
  }, { quoted: msg });
}

// ─── !statu ───────────────────────────────────────────────────
async function handleStatu(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: '💔 Você não está num relacionamento!\n_Use *!casar @alguem* para encontrar o amor!_',
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;
  const xp      = getXpCasais().get(key) || 0;
  const desde   = rel.desde ? Date.now() - rel.desde : 0;
  const dias    = Math.floor(desde / (1000 * 60 * 60 * 24));
  const horas   = Math.floor((desde % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

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
  const barraXp    = proximo === Infinity
    ? '█'.repeat(10)
    : '█'.repeat(Math.floor((xp / proximo) * 10)) + '░'.repeat(10 - Math.floor((xp / proximo) * 10));

  const conquistas = [];
  if (dias >= 1)  conquistas.push('🌅 *1 dia* de romance');
  if (dias >= 7)  conquistas.push('🌟 *1 SEMANA* de puro amor!');
  if (dias >= 30) conquistas.push('🥇 *1 MÊS INTEIRO* juntos (VCS AGUENTAM!)');
  if (xp >= 100)  conquistas.push('💰 *100 XP* acumulados (ELITE!)');
  if (xp >= 500)  conquistas.push('👑 *500 XP* (LENDÁRIOS MESMO!)');

  const bonusAtivo = temXpBonus(key) ? '\n🎉 *XP DUPLO ATIVADO! APROVEITEM!* 🎉' : '';

  let texto =
    `💑 *STATUS ÉPICO DO CASAL*\n\n` +
    `👥 *@${senderJid.split('@')[0]}* ${rel.tipo === 'namoro' ? '💕' : '💍'} *@${parcJid.split('@')[0]}*\n` +
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
    mentions: [senderJid, parcJid].filter(Boolean),
  }, { quoted: msg });
}

// !meupar
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
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

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
    const restante = getXpBonus().get(key).expiry - Date.now();
    await sock.sendMessage(jid, {
      text: `⏰ O XP Duplo já está ativo! Expira em *${formatarTempo(restante)}*.`,
    }, { quoted: msg });
    return;
  }

  const xpAtual = getXpCasais().get(key) || 0;
  if (xpAtual < 30) {
    await sock.sendMessage(jid, {
      text: `❌ Você precisa de pelo menos *30 XP* para ativar o XP Duplo!\n_Vocês têm: *${xpAtual} XP*_`,
    }, { quoted: msg });
    return;
  }

  const novoXp   = xpAtual - 30;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

  getXpCasais().set(key, novoXp);
  getXpBonus().set(key, { ativo: true, expiry: Date.now() + 2 * 60 * 60 * 1000 });

  await sock.sendMessage(jid, {
    text:
      `🎯 *XP DUPLO ATIVADO!*\n\n` +
      `*${author}* ativou o XP duplo para o casal com *${parceiro}*!\n\n` +
      `💸 *-30 XP* (custo) | Restante: *${novoXp} XP*\n` +
      `⏰ Dura *2 horas*! Usa todos os comandos diários agora!`,
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
  const parceiro  = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid   = rel.nomeA === author ? rel.jidB  : rel.jidA;
  const desde     = rel.desde || Date.now();
  const dias      = Math.floor((Date.now() - desde) / (1000 * 60 * 60 * 24));
  const semanas   = Math.floor(dias / 7);
  const meses     = Math.floor(dias / 30);
  const anos      = Math.floor(dias / 365);

  const marcos = [];
  if (anos >= 1)    marcos.push(`🎂 *${anos} ano(s) juntos!* Isso é incrível!`);
  if (meses >= 1)   marcos.push(`📅 *${meses} mês(es) juntos!*`);
  if (semanas >= 1) marcos.push(`🗓️ *${semanas} semana(s) juntos!*`);

  const xpAtual = (getXpCasais().get(key) || 0) + 20;
  getXpCasais().set(key, xpAtual);

  let texto =
    `🎉 *ANIVERSÁRIO DO CASAL* 🎉\n\n` +
    `💑 *${author}* e *${parceiro}*\n\n` +
    `📅 *${dias} dia(s)* juntos!\n`;
  if (marcos.length > 0) texto += marcos.join('\n') + '\n';
  texto +=
    `\n💰 *+20 XP* de celebração! Total: *${xpAtual} XP*\n\n` +
    `_Parabéns pelo tempo juntos! 🥂_`;

  await sock.sendMessage(jid, {
    text: texto,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

async function handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos) {
  const foundA = findRelByJid(senderJid, relacionamentos);
  if (!foundA) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar num relacionamento para duelar!' }, { quoted: msg });
    return;
  }

  const mentionedJid = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém do outro casal para duelar!\nExemplo: *!duelodecasais @fulano*',
    }, { quoted: msg });
    return;
  }

  const oponenteJid = mentionedJid[0];
  const foundB      = findRelByJid(oponenteJid, relacionamentos);
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

  const xpA        = getXpCasais().get(foundA.key) || 0;
  const xpB        = getXpCasais().get(foundB.key) || 0;
  const nomesCasal1 = `${foundA.rel.nomeA} & ${foundA.rel.nomeB}`;
  const nomesCasal2 = `${foundB.rel.nomeA} & ${foundB.rel.nomeB}`;
  const scoreA      = xpA + Math.floor(Math.random() * 50);
  const scoreB      = xpB + Math.floor(Math.random() * 50);

  let resultado;
  if (scoreA > scoreB) {
    const ganho = Math.min(20, Math.floor(xpB * 0.1));
    getXpCasais().set(foundA.key, xpA + ganho);
    getXpCasais().set(foundB.key, Math.max(0, xpB - ganho));
    resultado =
      `🏆 *${nomesCasal1}* VENCEU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${ganho} XP* para *${nomesCasal2}*!\n\n` +
      `_Que casal mais forte! 💪_`;
  } else if (scoreB > scoreA) {
    const ganho = Math.min(20, Math.floor(xpA * 0.1));
    getXpCasais().set(foundB.key, xpB + ganho);
    getXpCasais().set(foundA.key, Math.max(0, xpA - ganho));
    resultado =
      `🏆 *${nomesCasal2}* VENCEU o duelo!\n\n` +
      `💰 *+${ganho} XP* para os campeões!\n` +
      `💔 *-${ganho} XP* para *${nomesCasal1}*!\n\n` +
      `_Que reviravolta! 😱_`;
  } else {
    getXpCasais().set(foundA.key, xpA + 3);
    getXpCasais().set(foundB.key, xpB + 3);
    resultado = `🤝 *EMPATE!* Ambos os casais são igualmente incríveis!\n\n💰 *+3 XP* para ambos!`;
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

// !rankcasais
async function handleRankCasais(sock, msg, jid, relacionamentos) {
  if (relacionamentos.size === 0) {
    await sock.sendMessage(jid, {
      text: '📭 Nenhum casal cadastrado ainda!\n_Use *!casar @alguem* pra começar!_',
    }, { quoted: msg });
    return;
  }

  // ── Busca membros atuais do grupo para filtrar casais que saíram ──
  let membrosDoGrupo = null;
  try {
    const meta = await sock.groupMetadata(jid);
    membrosDoGrupo = new Set(meta.participants.map(p => p.id));
  } catch {
    // se falhar, exibe todos sem filtro
  }

  const lista = [...relacionamentos.entries()]
    .filter(([, rel]) => {
      if (!membrosDoGrupo) return true;
      return membrosDoGrupo.has(rel.jidA) && membrosDoGrupo.has(rel.jidB);
    })
    .map(([key, rel]) => {
      const xp         = getXpCasais().get(key) || 0;
      const diasJuntos = rel.desde
        ? Math.floor((Date.now() - rel.desde) / (1000 * 60 * 60 * 24))
        : 0;
      return { ...rel, xp, diasJuntos, score: xp + diasJuntos * 2 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (lista.length === 0) {
    await sock.sendMessage(jid, {
      text: '📭 Nenhum casal ativo neste grupo no momento!',
    }, { quoted: msg });
    return;
  }

  const medals   = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const mentions = [];
  let texto = `🏆 *RANKING DOS CASAIS* 🏆\n\n`;

  lista.forEach((c, i) => {
    const tipoEmoji = c.tipo === 'namoro' ? '💝' : '💍';
    const tagA      = c.jidA ? `@${c.jidA.split('@')[0]}` : c.nomeA;
    const tagB      = c.jidB ? `@${c.jidB.split('@')[0]}` : c.nomeB;
    const barraXp   = '⭐'.repeat(Math.min(Math.floor(c.xp / 10), 5)) || '▫️';
    const diasLabel = c.diasJuntos === 1 ? 'dia' : 'dias';

    if (c.jidA) mentions.push(c.jidA);
    if (c.jidB) mentions.push(c.jidB);

    texto +=
      `${medals[i]} ${tipoEmoji} ${tagA} 💕 ${tagB}\n` +
      `${barraXp} *${c.xp} XP* · 📅 *${c.diasJuntos} ${diasLabel}* · 🏅 *${c.score} pts*\n\n`;
  });

  texto += `_Score = XP + (dias juntos × 2)_\n_Use *!statu* pra ver o status completo!_`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// handleDesafioCasal
async function handleDesafioCasal(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Vocês não são um casal ainda, seu(ua) solteiro(a)! 😭' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  if (getBloqueados().has(senderJid)) {
    await sock.sendMessage(jid, { text: '⛔ Você está de castigo! Sem comando de desafio! 🚫' }, { quoted: msg });
    return;
  }

  const desafios = [
    '💑 *DESAFIO: Complimento de 5 palavras* — Cada um tem que dar um elogio de ATÉ 5 palavras pro outro! +15 XP 🎁',
    '🤐 *DESAFIO: Silêncio Apaixonado* — Vocês têm 30 min SEM falar sobre NADA chato. Só assuntos legais! +20 XP 📱',
    '🎵 *DESAFIO: Música do Casal* — Escolham uma música que define o relacionamento de vocês! +25 XP 🎧',
    '📸 *DESAFIO: Selfie no Espelho* — Tirem uma selfie no espelho juntos (ou descrevam)! +15 XP 🤳',
    '💬 *DESAFIO: Piada de Casal* — Um conta uma piada pro outro. Se o outro rir, +18 XP 😂',
    '🎭 *DESAFIO: Imitar o(a) Parceiro(a)* — Vocês IMITAM um ao outro exagerando! +12 XP 🤣',
    '🏃 *DESAFIO: Corrida de Abraços* — Que abraça mais forte em 30 segundos ganha! +17 XP 🤗',
  ];

  const desafio = desafios[Math.floor(Math.random() * desafios.length)];
  const xpGanho = parseInt(desafio.match(/\+(\d+)\s*XP/)?.[1] || '10');
  const temBonus = temXpBonus(key);
  const xpFinal  = temBonus ? xpGanho * 2 : xpGanho;
  const xpAtual  = (getXpCasais().get(key) || 0) + xpFinal;

  // ── Persiste XP no banco ──
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [rel.jidA, rel.jidB].filter(Boolean) } },
      { $inc: { xpCasal: xpFinal } }
    );
  } catch (e) {
    console.error('[handleDesafioCasal] Erro ao persistir XP:', e.message);
  }

  // ── Atualiza memória ──
  getXpCasais().set(key, xpAtual);
  if (temBonus) getXpBonus().delete(key);

  // ── Monta e envia mensagem ──
  const extras = temBonus
    ? '\n\n🚀 *BÔNUS APLICADO!* Vocês ganharam XP DOBRADO nesse desafio! 🎉'
    : '';

  await sock.sendMessage(jid, {
    text: `${desafio}${extras}\n\n💰 *+${xpFinal} XP*! Total do casal: *${xpAtual} XP*`,
  }, { quoted: msg });
}

// handleCompetiçãoCasais
async function handleCompetiacaoCasais(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Vocês não são um casal! 😭' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const xpAtual = getXpCasais().get(key) || 0;
  const nivel   = getNivelInfo(xpAtual);

  if (relacionamentos.size === 0) {
    await sock.sendMessage(jid, { text: '📭 Nenhum casal cadastrado ainda!' }, { quoted: msg });
    return;
  }

  const ranking = [...relacionamentos.entries()]
    .map(([k, r]) => ({
      key:   k,
      nomeA: r.nomeA || 'Desconhecido',
      nomeB: r.nomeB || 'Desconhecido',
      jidA:  r.jidA,
      jidB:  r.jidB,
      xp:    getXpCasais().get(k) || 0,
    }))
    .sort((a, b) => b.xp - a.xp);

  const posicao  = ranking.findIndex(r => r.key === key) + 1;
  const medals   = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
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

  texto += `\n👤 *VOCÊ ESTÁ EM #${posicao}* (${xpAtual} XP — ${nivel.nome})\n`;
  texto += `\n🎯 *Próximo ranking atualiza a cada 6h!*`;

  await sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });
}

// handleSurpresa
async function handleSurpresa(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Você não tem parceiro pra surpreender! 😭' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJid)) {
    await sock.sendMessage(jid, { text: '⛔ Vocês estão de castigo! 🚫' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

  const surpresas = [
    `🎈 *SURPRESA MEGA*: *${parceiro}* recebeu uma SURPRESA MEGA de *${author}*! Só pode ser bom! 😏 +25 XP!`,
    `🎥 *SURPRESA CINEMATOGRÁFICA*: Uma cena de romance foi preparada! Velas, música e tudo! +30 XP! 💕`,
    `🌟 *SURPRESA NOTURNA*: Piquenique na madrugada com seu amor! Que ousadia! +35 XP! 🌙`,
    `🎀 *SURPRESA FESTA*: Tem festa secreta pro casal! Bebidas, música e romantismo! +28 XP! 🎉`,
    `🐻 *SURPRESA CARINHO TOTAL*: Massagem, banho de espuma, velas e MUITO carinho! +32 XP! 💦`,
  ];

  const surp    = surpresas[Math.floor(Math.random() * surpresas.length)];
  const xpGanho = parseInt(surp.match(/\+(\d+)\s*XP/)?.[1] || '20');
  const xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  getXpCasais().set(key, xpAtual);

  await sock.sendMessage(jid, {
    text: surp + `\n\n💰 *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: [parcJid, senderJid].filter(Boolean),
  }, { quoted: msg });
}

// handleDomingo
async function handleDomingo(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '❌ Você está sozinho(a)! 😭' }, { quoted: msg });
    return;
  }

  if (getBloqueados().has(senderJid)) {
    await sock.sendMessage(jid, { text: '⛔ Castigo! Sem fun! 🚫' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const parcJid = rel.nomeA === author ? rel.jidB : rel.jidA;

  const domingos = [
    `☕ *DOMINGO DE CAFÉ E SÉRIE*: Vocês vão passar o domingo inteiro comendo e assistindo série! +22 XP! 📺`,
    `🏠 *DOMINGO DE LIMPEZA*: Vocês limpam a casa JUNTOS (com música alta claro!) e depois... bora pro sofá! +18 XP! 🧹`,
    `👨‍🍳 *DOMINGO DE COZINHA*: Vocês preparam um almoço gourmet juntos! Que romântico! +26 XP! 🍝`,
    `🛏️ *DOMINGO DE PREGUIÇA*: Vocês ficam a MANHÃ toda na cama sem fazer NADA! +20 XP! 😴`,
    `🎮 *DOMINGO GAMER*: Vocês jogam um jogo multiplayer juntos! Battle royale de casais! +24 XP! 🎮`,
  ];

  const domingo = domingos[Math.floor(Math.random() * domingos.length)];
  const xpGanho = parseInt(domingo.match(/\+(\d+)\s*XP/)?.[1] || '20');
  const xpAtual = (getXpCasais().get(key) || 0) + xpGanho;
  getXpCasais().set(key, xpAtual);

  await sock.sendMessage(jid, {
    text: domingo + `\n\n💰 *+${xpGanho} XP*! Total do casal: *${xpAtual} XP*`,
    mentions: [parcJid].filter(Boolean),
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
  handleCompetçaoCasais,
  handleSurpresa,
  handleDomingo,
};  