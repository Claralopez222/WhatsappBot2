'use strict';

const path   = require('path');
const Filho  = require(path.join(__dirname, '..', '..', 'models', 'Filho'));
const Usuario= require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CHANCE_FILHO       = 0.40;  // 40% de chance
const MAX_FILHOS         = 3;
const DIAS_POR_ANO       = 7;     // 7 dias reais = 1 ano
const COOLDOWN_CUIDAR    = 20 * 60 * 60 * 1000; // 20h
const COOLDOWN_TENTAR    = 25 * 60 * 1000;      // 25 minutos
const CUSTO_REMEDIO      = 300;   // gold

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
  const v = Math.max(0, Math.min(100, valor));
  const preenchido = Math.round((v / 100) * tamanho);
  const vazio = tamanho - preenchido;
  return `[${'█'.repeat(preenchido)}${'░'.repeat(vazio)}] ${v}%`;
}

function formatarTempo(ms) {
  const horas = Math.floor(ms / 3_600_000);
  const min   = Math.floor((ms % 3_600_000) / 60_000);
  const seg   = Math.floor((ms % 60_000) / 1000);
  if (horas > 0) return `${horas}h ${min}min`;
  if (min > 0)   return `${min}min ${seg}s`;
  return `${seg}s`;
}

async function buscarUsuarioComParceiro(userId) {
  const usuario = await Usuario.findOne({ idWhatsApp: userId }).lean();
  if (!usuario?.casadoCom) return null;
  return { usuario, parceiro: usuario.casadoCom };
}

function filtroFilhos(jid, userId, parceiro) {
  return {
    idGrupo: jid,
    $or: [
      { jidA: userId, jidB: parceiro },
      { jidA: parceiro, jidB: userId },
    ],
  };
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

  const info = await buscarUsuarioComParceiro(userId);
  if (!info) {
    return sock.sendMessage(jid, {
      text: '❌ Você precisa estar em um relacionamento para ter filhos!',
    }, { quoted: msg });
  }

  const { usuario, parceiro } = info;

  // Cooldown de tentativa
  if (usuario.ultimaTentativaFilho) {
    const restante = COOLDOWN_TENTAR - (Date.now() - new Date(usuario.ultimaTentativaFilho).getTime());
    if (restante > 0) {
      return sock.sendMessage(jid, {
        text: `⏳ Aguarde *${formatarTempo(restante)}* para tentar ter um filho novamente.`,
      }, { quoted: msg });
    }
  }

  // Verifica limite de filhos
  const totalFilhos = await Filho.countDocuments(filtroFilhos(jid, userId, parceiro));

  if (totalFilhos >= MAX_FILHOS) {
    return sock.sendMessage(jid, {
      text: `❌ Vocês já têm *${totalFilhos} filhos*! O limite é ${MAX_FILHOS}.`,
    }, { quoted: msg });
  }

  // Registra a tentativa (independente do resultado)
  await Usuario.updateOne(
    { idWhatsApp: userId },
    { $set: { ultimaTentativaFilho: new Date() } }
  );

  // Sorteio
  if (Math.random() > CHANCE_FILHO) {
    const tentativas = [
      '😔 Dessa vez não rolou... Tentem novamente em 25 minutos!',
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

  await Filho.create({
    jidA: userId,
    jidB: parceiro,
    idGrupo: jid,
    nome,
    sexo,
    personalidade,
    felicidade: 100,
    fome: 100,
    sono: 100,
    alegria: 100,
    doente: false,
    guardaAtual: userId,
    ultimaTroca: new Date(),
    nascidoEm: new Date(),
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

  const info = await buscarUsuarioComParceiro(userId);
  if (!info) {
    return sock.sendMessage(jid, {
      text: '❌ Você não está em um relacionamento.',
    }, { quoted: msg });
  }

  const { parceiro } = info;

  const filhos = await Filho.find(filtroFilhos(jid, userId, parceiro));

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

  const info = await buscarUsuarioComParceiro(userId);
  if (!info) {
    return sock.sendMessage(jid, { text: '❌ Você não está em um relacionamento.' }, { quoted: msg });
  }

  const { parceiro } = info;

  const filhos = await Filho.find(filtroFilhos(jid, userId, parceiro));

  if (filhos.length === 0) {
    return sock.sendMessage(jid, { text: '👶 Vocês não têm filhos ainda!' }, { quoted: msg });
  }

  const agora = Date.now();
  let texto = `💝 *CUIDANDO DOS FILHOS*\n\n`;
  let algumCuidado = false;
  let algumIndisponivel = false;

  for (const filho of filhos) {
    const guarda = await atualizarGuarda(filho);

    // Só quem está com a guarda pode cuidar
    if (guarda !== userId) {
      texto += `👶 *${filho.nome}* está com seu parceiro(a) hoje.\n\n`;
      algumIndisponivel = true;
      continue;
    }

    // Cooldown
    if (filho.ultimoCuidado && agora - new Date(filho.ultimoCuidado).getTime() < COOLDOWN_CUIDAR) {
      const restante = COOLDOWN_CUIDAR - (agora - new Date(filho.ultimoCuidado).getTime());
      texto += `👶 *${filho.nome}* — já foi cuidado(a)! Próximo em *${formatarTempo(restante)}*.\n\n`;
      algumIndisponivel = true;
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

  if (!algumCuidado && !algumIndisponivel) {
    texto += 'Nenhum filho disponível para cuidar agora.';
  }

  return sock.sendMessage(jid, { text: texto.trim() }, { quoted: msg });
}

// ─── !remediofil ─────────────────────────────────────────────────────────────
async function handleRemedioFilho(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const info = await buscarUsuarioComParceiro(userId);
  if (!info) {
    return sock.sendMessage(jid, { text: '❌ Você não está em um relacionamento.' }, { quoted: msg });
  }

  const { parceiro } = info;

  const filhoDoente = await Filho.findOne({
    ...filtroFilhos(jid, userId, parceiro),
    doente: true,
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

  return sock.sendMessage(jid, {
    text:
      `💊 *${filhoDoente.nome}* foi curado(a)!\n\n` +
      `${emoji} Já está se sentindo melhor.\n` +
      `💰 Gasto: *${CUSTO_REMEDIO} gold*\n\n` +
      `😊 Felicidade : ${statusBar(60)}\n` +
      `🍽️ Fome       : ${statusBar(60)}\n` +
      `😴 Sono       : ${statusBar(60)}\n` +
      `🎈 Alegria    : ${statusBar(60)}`,
  }, { quoted: msg });
}

// ─── DECAY DIÁRIO (rodar via scheduler) ──────────────────────────────────────
async function decayFilhos() {
  try {
    const filhos = await Filho.find({});
    for (const filho of filhos) {
      filho.felicidade = Math.max(0, filho.felicidade - 10);
      filho.fome       = Math.max(0, filho.fome       - 15);
      filho.sono       = Math.max(0, filho.sono       - 10);
      filho.alegria    = Math.max(0, filho.alegria    - 10);

      if (filho.felicidade === 0 && !filho.doente) {
        filho.doente = true;
      }

      await filho.save();
    }
    console.log(`[Filhos] Decay aplicado em ${filhos.length} filho(s).`);
  } catch (e) {
    console.error('[Filhos] Erro no decay:', e.message);
  }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────
function initFilhosScheduler() {
  // Decay a cada 6 horas
  setInterval(decayFilhos, 6 * 60 * 60 * 1000);
  console.log('[FilhosScheduler] Iniciado.');
}

module.exports = {
  handleTentarFilho,
  handleVerFilho,
  handleCuidarFilho,
  handleRemedioFilho,
  initFilhosScheduler,
};
