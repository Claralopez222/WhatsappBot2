'use strict';

const path   = require('path');
const Filho  = require(path.join(__dirname, '..', '..', 'models', 'Filho'));
const Usuario= require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CHANCE_FILHO     = 0.40;  // 40% de chance
const MAX_FILHOS       = 3;
const DIAS_POR_ANO     = 7;     // 7 dias reais = 1 ano
const COOLDOWN_CUIDAR  = 20 * 60 * 60 * 1000; // 20h
const CUSTO_REMEDIO    = 300;   // gold

const PERSONALIDADES = [
  'curioso 🔍', 'agitado ⚡', 'tímido 🌸', 'corajoso 🦁',
  'preguiçoso 😴', 'esperto 🧠', 'carinhoso 💕', 'teimoso 😤',
];

const NOMES_MENINO = [
  'Miguel', 'Arthur', 'Heitor', 'Davi', 'Gabriel',
  'Pedro', 'Lucas', 'Matheus', 'Rafael', 'Enzo',
];

const NOMES_MENINA = [
  'Alice', 'Sofia', 'Isabella', 'Valentina', 'Júlia',
  'Laura', 'Manuela', 'Luiza', 'Heloísa', 'Lívia',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function calcularIdade(nascidoEm) {
  const diasVividos = (Date.now() - new Date(nascidoEm).getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diasVividos / DIAS_POR_ANO);
}

function statusBar(valor, tamanho = 8) {
  const preenchido = Math.round((valor / 100) * tamanho);
  const vazio = tamanho - preenchido;
  return `[${'█'.repeat(preenchido)}${'░'.repeat(vazio)}] ${valor}%`;
}

function getGuardaAtual(filho) {
  if (!filho.guardaAtual) return filho.jidA;
  const diasDesdeUltimaTroca = (Date.now() - new Date(filho.ultimaTroca).getTime()) / (1000 * 60 * 60 * 24);
  if (diasDesdeUltimaTroca >= 1) return null; // precisa trocar
  return filho.guardaAtual;
}

async function atualizarGuarda(filho) {
  const diasDesdeUltimaTroca = (Date.now() - new Date(filho.ultimaTroca).getTime()) / (1000 * 60 * 60 * 24);
  if (diasDesdeUltimaTroca >= 1) {
    filho.guardaAtual = filho.guardaAtual === filho.jidA ? filho.jidB : filho.jidA;
    filho.ultimaTroca = new Date();
    await filho.save();
  }
  return filho.guardaAtual;
}

// ─── !tentarfilho ─────────────────────────────────────────────────────────────
async function handleTentarFilho(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  // Busca usuário e parceiro
  const usuario = await Usuario.findOne({ idWhatsApp: userId }).lean();
  if (!usuario?.casadoCom) {
    return sock.sendMessage(jid, {
      text: '❌ Você precisa estar em um relacionamento para ter filhos!',
    }, { quoted: msg });
  }

  const parceiro = usuario.casadoCom;

  // Verifica limite de filhos
  const totalFilhos = await Filho.countDocuments({
    idGrupo: jid,
    $or: [
      { jidA: userId, jidB: parceiro },
      { jidA: parceiro, jidB: userId },
    ],
  });

  if (totalFilhos >= MAX_FILHOS) {
    return sock.sendMessage(jid, {
      text: `❌ Vocês já têm *${totalFilhos} filhos*! O limite é ${MAX_FILHOS}.`,
    }, { quoted: msg });
  }

  // Sorteio
  if (Math.random() > CHANCE_FILHO) {
    const tentativas = [
      '😔 Dessa vez não rolou... Tentem novamente mais tarde!',
      '🍀 Quase! A sorte não sorriu dessa vez. Não desistam!',
      '💔 Não foi dessa vez. Continuem tentando!',
    ];
    return sock.sendMessage(jid, {
      text: tentativas[Math.floor(Math.random() * tentativas.length)],
    }, { quoted: msg });
  }

  // Nasce o filho
  const sexo = Math.random() < 0.5 ? 'menino' : 'menina';
  const nomes = sexo === 'menino' ? NOMES_MENINO : NOMES_MENINA;
  const nome  = nomes[Math.floor(Math.random() * nomes.length)];
  const personalidade = PERSONALIDADES[Math.floor(Math.random() * PERSONALIDADES.length)];
  const emoji = sexo === 'menino' ? '👦' : '👧';

  const filho = await Filho.create({
    jidA: userId,
    jidB: parceiro,
    idGrupo: jid,
    nome,
    sexo,
    personalidade,
    guardaAtual: userId,
    ultimaTroca: new Date(),
  });

  return sock.sendMessage(jid, {
    text:
      `🎉 *PARABÉNS! NASCEU UM(A) FILHO(A)!* 🎉\n\n` +
      `${emoji} *${nome}*\n` +
      `🧬 Sexo: *${sexo}*\n` +
      `✨ Personalidade: *${personalidade}*\n` +
      `🎂 Idade: *recém-nascido(a)*\n\n` +
      `😊 Felicidade : ${statusBar(100)}\n` +
      `🍽️ Fome       : ${statusBar(100)}\n` +
      `😴 Sono       : ${statusBar(100)}\n` +
      `🎈 Alegria    : ${statusBar(100)}\n\n` +
      `💡 Use *!cuidarfilho* para cuidar dele(a) diariamente!`,
    mentions: [userId, parceiro],
  }, { quoted: msg });
}

// ─── !filho ───────────────────────────────────────────────────────────────────
async function handleVerFilho(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const usuario = await Usuario.findOne({ idWhatsApp: userId }).lean();
  if (!usuario?.casadoCom) {
    return sock.sendMessage(jid, {
      text: '❌ Você não está em um relacionamento.',
    }, { quoted: msg });
  }

  const parceiro = usuario.casadoCom;

  const filhos = await Filho.find({
    idGrupo: jid,
    $or: [
      { jidA: userId, jidB: parceiro },
      { jidA: parceiro, jidB: userId },
    ],
  });

  if (filhos.length === 0) {
    return sock.sendMessage(jid, {
      text: '👶 Vocês ainda não têm filhos! Use *!tentarfilho* para tentar.',
    }, { quoted: msg });
  }

  let texto = `👨‍👩‍👧‍👦 *SEUS FILHOS* (${filhos.length}/${MAX_FILHOS})\n\n`;

  for (const filho of filhos) {
    const idade   = calcularIdade(filho.nascidoEm);
    const emoji   = filho.sexo === 'menino' ? '👦' : '👧';
    const guarda  = await atualizarGuarda(filho);
    const comQuem = guarda === userId ? 'com você' : 'com seu parceiro(a)';
    const doente  = filho.doente ? '\n⚠️ *DOENTE!* Use *!remediofil* para curar.' : '';

    texto +=
      `${emoji} *${filho.nome}* — ${idade} ano(s)\n` +
      `✨ ${filho.personalidade}\n` +
      `😊 Felicidade : ${statusBar(filho.felicidade)}\n` +
      `🍽️ Fome       : ${statusBar(filho.fome)}\n` +
      `😴 Sono       : ${statusBar(filho.sono)}\n` +
      `🎈 Alegria    : ${statusBar(filho.alegria)}\n` +
      `🏠 Guarda     : *${comQuem}*` +
      doente +
      `\n\n`;
  }

  return sock.sendMessage(jid, { text: texto.trim() }, { quoted: msg });
}

// ─── !cuidarfilho ─────────────────────────────────────────────────────────────
async function handleCuidarFilho(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const usuario = await Usuario.findOne({ idWhatsApp: userId }).lean();
  if (!usuario?.casadoCom) {
    return sock.sendMessage(jid, { text: '❌ Você não está em um relacionamento.' }, { quoted: msg });
  }

  const parceiro = usuario.casadoCom;

  const filhos = await Filho.find({
    idGrupo: jid,
    $or: [
      { jidA: userId, jidB: parceiro },
      { jidA: parceiro, jidB: userId },
    ],
  });

  if (filhos.length === 0) {
    return sock.sendMessage(jid, { text: '👶 Vocês não têm filhos ainda!' }, { quoted: msg });
  }

  const agora = Date.now();
  let texto = `💝 *CUIDANDO DOS FILHOS*\n\n`;
  let algumCuidado = false;

  for (const filho of filhos) {
    const guarda = await atualizarGuarda(filho);

    // Só quem está com a guarda pode cuidar
    if (guarda !== userId) {
      texto += `👶 *${filho.nome}* está com seu parceiro(a) hoje.\n\n`;
      continue;
    }

    // Cooldown
    if (filho.ultimoCuidado && agora - new Date(filho.ultimoCuidado).getTime() < COOLDOWN_CUIDAR) {
      const restante = COOLDOWN_CUIDAR - (agora - new Date(filho.ultimoCuidado).getTime());
      const horas = Math.floor(restante / 3_600_000);
      const min   = Math.floor((restante % 3_600_000) / 60_000);
      texto += `👶 *${filho.nome}* — já foi cuidado(a)! Próximo em *${horas}h ${min}min*.\n\n`;
      continue;
    }

    // Cuida
    filho.felicidade = Math.min(100, filho.felicidade + 20);
    filho.fome       = Math.min(100, filho.fome       + 25);
    filho.sono       = Math.min(100, filho.sono       + 20);
    filho.alegria    = Math.min(100, filho.alegria    + 20);
    filho.ultimoCuidado = new Date();
    await filho.save();

    algumCuidado = true;
    const emoji = filho.sexo === 'menino' ? '👦' : '👧';

    texto +=
      `${emoji} *${filho.nome}* foi cuidado(a)!\n` +
      `😊 Felicidade : ${statusBar(filho.felicidade)}\n` +
      `🍽️ Fome       : ${statusBar(filho.fome)}\n` +
      `😴 Sono       : ${statusBar(filho.sono)}\n` +
      `🎈 Alegria    : ${statusBar(filho.alegria)}\n\n`;
  }

  if (!algumCuidado && texto === `💝 *CUIDANDO DOS FILHOS*\n\n`) {
    texto += 'Nenhum filho disponível para cuidar agora.';
  }

  return sock.sendMessage(jid, { text: texto.trim() }, { quoted: msg });
}

// ─── !remediofil ─────────────────────────────────────────────────────────────
async function handleRemedioFilho(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const usuario = await Usuario.findOne({ idWhatsApp: userId }).lean();
  if (!usuario?.casadoCom) {
    return sock.sendMessage(jid, { text: '❌ Você não está em um relacionamento.' }, { quoted: msg });
  }

  const parceiro = usuario.casadoCom;

  const filhoDoente = await Filho.findOne({
    idGrupo: jid,
    doente: true,
    $or: [
      { jidA: userId, jidB: parceiro },
      { jidA: parceiro, jidB: userId },
    ],
  });

  if (!filhoDoente) {
    return sock.sendMessage(jid, { text: '✅ Nenhum filho doente no momento!' }, { quoted: msg });
  }

  // Verifica saldo
  const carteira = await CarteiraGrupo.findOne({ idWhatsApp: userId, idGrupo: jid });
  if (!carteira || carteira.gold < CUSTO_REMEDIO) {
    return sock.sendMessage(jid, {
      text: `❌ Você precisa de *${CUSTO_REMEDIO} gold* para comprar o remédio! Você tem *${carteira?.gold ?? 0} gold*.`,
    }, { quoted: msg });
  }

  // Debita e cura
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo: jid },
    { $inc: { gold: -CUSTO_REMEDIO } }
  );

  filhoDoente.doente     = false;
  filhoDoente.felicidade = 60;
  filhoDoente.fome       = 60;
  filhoDoente.sono       = 60;
  filhoDoente.alegria    = 60;
  await filhoDoente.save();

  const emoji = filhoDoente.sexo === 'menino' ? '👦' : '👧';

  return sock.sendM