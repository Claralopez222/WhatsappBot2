/**
 * Handler de Relacionamentos — Piroquinhas Bot
 * Comandos: !casar, !namorar, !euaceito, !eurecuso, !cancelarpedido,
 *           !cancelarcasamento, !terminar, !flores, !doces, !carta,
 *           !mimo, !beijo, !rankcasais, !fixar, !pinned, !desfixar,
 *           [NOVOS] !abraco, !presente, !jantar, !cinema, !viajar,
 *           !declarar, !ciumento, !statu, !aniversario_casal,
 *           !meupar, !xpdobro, !serenata, !duelodecasais
 */

const path = require('path');
const fs   = require('fs');
const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));

// ═══════════════════════════════════════════════════════════════
// ─── ESTADO GLOBAL ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function relKey(a, b) { return [a, b].sort().join('|'); }

const xpCasais      = new Map(); // relKey → number
const bloqueados    = new Map(); // jid → timestamp_expiry
const diariosUsados = new Map(); // `${relKey}:${cmd}:YYYY-MM-DD` → true
const ciumentosMap  = new Map(); // jid → timestamp (cooldown de 1h)
const xpBonus       = new Map(); // relKey → { ativo: bool, expiry: number }

// ═══════════════════════════════════════════════════════════════
// ─── HELPERS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isBloqueado(jid) {
  if (!bloqueados.has(jid)) return false;
  if (Date.now() > bloqueados.get(jid)) { bloqueados.delete(jid); return false; }
  return true;
}

function minutosRestantes(jid) {
  if (!bloqueados.has(jid)) return 0;
  return Math.ceil((bloqueados.get(jid) - Date.now()) / (1000 * 60));
}

function getRelacionamento(a, b, relacionamentos) {
  return relacionamentos.get(relKey(a, b)) || null;
}

async function syncCasamentoToDb(jidA, jidB, tipo = 'casamento', desde = Date.now()) {
  try {
    await Promise.all([
      Usuario.findOneAndUpdate(
        { idWhatsApp: jidA },
        { $set: { casadoCom: jidB, casadoTipo: tipo, casadoDesde: desde, idWhatsApp: jidA } },
        { upsert: true, new: true }
      ),
      Usuario.findOneAndUpdate(
        { idWhatsApp: jidB },
        { $set: { casadoCom: jidA, casadoTipo: tipo, casadoDesde: desde, idWhatsApp: jidB } },
        { upsert: true, new: true }
      ),
    ]);
  } catch (e) {
    console.error('⚠️ Erro ao sincronizar casamento no MongoDB:', e.message);
  }
}

async function clearCasamentoDb(jidA, jidB) {
  try {
    await Promise.all([
      Usuario.updateOne({ idWhatsApp: jidA }, { $set: { casadoCom: null, casadoTipo: null } }),
      Usuario.updateOne({ idWhatsApp: jidB }, { $set: { casadoCom: null, casadoTipo: null } }),
    ]);
  } catch (e) {
    console.error('⚠️ Erro ao limpar casamento no MongoDB:', e.message);
  }
}

function findRelByJid(jid, relacionamentos) {
  const num = jid.split('@')[0];
  for (const [key, rel] of relacionamentos) {
    if (key.includes(num)) return { key, rel };
  }
  return null;
}

function temXpBonus(key) {
  if (!xpBonus.has(key)) return false;
  const b = xpBonus.get(key);
  if (!b.ativo || Date.now() > b.expiry) { xpBonus.delete(key); return false; }
  return true;
}

function formatarTempo(ms) {
  const dias   = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas  = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins   = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (dias > 0)  return `${dias} dia(s) e ${horas}h`;
  if (horas > 0) return `${horas}h e ${mins}min`;
  return `${mins} minuto(s)`;
}

const { getNivelInfo } = require(path.join(__dirname, '..', 'utils', 'levelUtils'));

// ─── Helper carinho diário ─────────────────────────────────────

// handleCarinh
async function handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, cmd, emoji, verbo, xpValor = 5) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: `💔 Você precisa estar em um relacionamento para usar *!${cmd}*!\n_Use *!casar @alguem* ou *!namorar @alguem* primeiro._`,
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;

  // ── Verifica se o item existe no inventário do sender ──
  // Consulta apenas o campo necessário para não trazer o doc inteiro
  const userDoc = await Usuario.findOne(
    { idWhatsApp: senderJid },
    { [`inventory.${cmd}`]: 1 }
  ).lean();

  const qtdItem = userDoc?.inventory?.[cmd] ?? 0;

  if (qtdItem < 1) {
    await sock.sendMessage(jid, {
      text: `🛒 Você não tem *${cmd}* para dar!\nCompre na *!lojacasal* e surpreenda seu par! 💝`,
    }, { quoted: msg });
    return;
  }

  // ── Consome 1 unidade do item antes de qualquer outra operação ──
  // A condição { $gte: 1 } é a guarda atômica contra race condition:
  // se outro processo consumiu o último item entre o findOne acima
  // e este update, o resultado será null e abortamos sem prejudicar o usuário.
  const consumo = await Usuario.findOneAndUpdate(
    { idWhatsApp: senderJid, [`inventory.${cmd}`]: { $gte: 1 } },
    { $inc: { [`inventory.${cmd}`]: -1 } },
    { new: true }
  );

  if (!consumo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Não foi possível usar o item agora. Tente novamente.`,
    }, { quoted: msg });
    return;
  }

  // ── Cooldown diário por casal+comando (não só por sender) ──
  const diarioKey = `${key}:${cmd}:${hoje()}`;
  if (diariosUsados.has(diarioKey)) {
    // Devolve o item consumido acima para não prejudicar o usuário
    await Usuario.updateOne(
      { idWhatsApp: senderJid },
      { $inc: { [`inventory.${cmd}`]: 1 } }
    ).catch(e => console.error(`[handleCarinh:${cmd}] Erro ao devolver item no cooldown:`, e.message));

    await sock.sendMessage(jid, {
      text: `⏰ Você já usou *!${cmd}* hoje! Volte amanhã, ansioso(a)! 😊`,
    }, { quoted: msg });
    return;
  }
  diariosUsados.set(diarioKey, true);

  // ── Cálculo de XP (bônus só dobra se realmente ativo) ──
  const temBonus = temXpBonus(key);
  const ganho    = temBonus ? xpValor * 2 : xpValor;
  const xpAtual  = (xpCasais.get(key) || 0) + ganho;
  xpCasais.set(key, xpAtual);

  // ── Persiste XP no banco ──
  try {
    await Usuario.updateMany(
      { idWhatsApp: { $in: [rel.jidA, rel.jidB].filter(Boolean) } },
      { $inc: { xpCasal: ganho } }
    );
  } catch (e) {
    console.error(`[handleCarinh:${cmd}] Erro ao persistir XP:`, e.message);
    // Reverte Map, cooldown e item consumido
    xpCasais.set(key, xpAtual - ganho);
    diariosUsados.delete(diarioKey);
    await Usuario.updateOne(
      { idWhatsApp: senderJid },
      { $inc: { [`inventory.${cmd}`]: 1 } }
    ).catch(err => console.error(`[handleCarinh:${cmd}] Erro ao devolver item no rollback de XP:`, err.message));

    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao registrar o carinho. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

  const qtdRestante = (consumo.inventory?.[cmd] ?? 0);
  const bonusStr    = temBonus ? ` _(XP Duplo ativo! +${xpValor} bônus)_` : '';

  await sock.sendMessage(jid, {
    text:
      `${emoji} *${author}* ${verbo} para *${parceiro}*! 💕\n\n` +
      `💰 *+${ganho} XP*${bonusStr} | Total do casal: *${xpAtual} XP*\n` +
      `🎒 *${cmd}* restantes no seu inventário: *${qtdRestante}*`,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── PEDIDO DE CASAMENTO / NAMORO ─────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRelacionamento(sock, msg, content, jid, author, tipo, relacionamentos, pedidosPendentes, contactNames) {
  const senderJid    = msg.key.participant || msg.key.remoteJid;
  const contextInfo  = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];

  if (mentionedJid.length === 0) {
    const exemplos = tipo === 'casamento'
      ? ['Marca aí, seu(ua) indeciso(a)! 😤', 'MARCA UM JUIZ AGORA! 💍']
      : ['Bora! Não tem tímido aqui! 😏', 'Marca agora ou tá com medo? 👀'];
    await sock.sendMessage(jid, {
      text: `${exemplos[Math.floor(Math.random() * exemplos.length)]}\nExemplo: *!${tipo === 'casamento' ? 'casar' : 'namorar'} @fulano*`,
    }, { quoted: msg });
    return;
  }

  const alvoJid  = mentionedJid[0];
  const nomeAlvo = contactNames[alvoJid] || alvoJid.split('@')[0];

  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    const frases = [
      '😅 Narcisista demais! Procura alguém de verdade!',
      '🤡 Casamento consigo mesmo? Tá ouvindo voz?',
      '💀 Auto-sabotagem extrema detected!',
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  if (isBloqueado(senderJid)) {
    const frases = [
      `🚫 TÁ CANCELADO(A)! Sua ex te largou! Aguarde *${minutosRestantes(senderJid)} minuto(s)* para a poeira baixar! 💔`,
      `😤 Respira! Você precisa de *${minutosRestantes(senderJid)} minuto(s)* de terapia antes de tentar de novo!`,
      `💀 Seu histórico de divórcio rápido tá te perseguindo! Volta em *${minutosRestantes(senderJid)} minuto(s)*!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  if (isBloqueado(alvoJid)) {
    const frases = [
      `🚫 *${nomeAlvo}* tá em RECLUSÃO! O término ainda tá fresco! Volta em *${minutosRestantes(alvoJid)} minuto(s)* seu(ua) insensível! 😤`,
      `💔 Ué, qual é? *${nomeAlvo}* tá recuperando o coração! Espera *${minutosRestantes(alvoJid)} minuto(s)* pra propor!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
      mentions: [alvoJid],
    }, { quoted: msg });
    return;
  }

  if (getRelacionamento(senderJid, alvoJid, relacionamentos)) {
    const frases = [
      `😂 Vocês já tão juntos, mas quer fazer um evento de renovação de votos? Que romântico... ou dramático!`,
      `😒 Tá querendo propor NOVAMENTE? Já era pra ter pedido em outro lugar!`,
      `😂 Vocês já tão tão casadinhos que nem precisa mais disso!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  const jaSender = findRelByJid(senderJid, relacionamentos);
  if (jaSender) {
    const frases = [
      `💔 TRAIDOR(A)! Você já tem alguém! Quer derramar todo o drama com *!cancelarcasamento*? 😤`,
      `🤡 Boa tentativa de bigamia! Termina seu relacionamento primeiro, seu(ua) miserável!`,
      `😒 Seu(ua) parceiro(a) tá aqui vendo isso... prepare-se para a guerra! 💀`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  const jaAlvo = findRelByJid(alvoJid, relacionamentos);
  if (jaAlvo) {
    const frases = [
      `😂 *${nomeAlvo}* JÁ tá comprometido(a)! Vai afastar esse lobisomem aí!`,
      `💔 Deprimente! *${nomeAlvo}* tá numa relação! Esse é o seu sinal pra desistir!`,
      `🚫 *${nomeAlvo}*: "Não, muito obrigado(a)! Já tenho meu/minha babe!"`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
      mentions: [alvoJid],
    }, { quoted: msg });
    return;
  }

  if (pedidosPendentes.has(alvoJid)) {
    await sock.sendMessage(jid, {
      text: `⏳ @${alvoJid.split('@')[0]} já tem um pedido pendente aguardando resposta.`,
      mentions: [alvoJid],
    }, { quoted: msg });
    return;
  }

  pedidosPendentes.set(alvoJid, { tipo, jidPedinte: senderJid, nomePedinte: author, jid });

  const tipoEmoji = tipo === 'casamento' ? '💍' : '💝';
  const tipoVerbo = tipo === 'casamento' ? 'casar' : 'namorar';
  const caption =
    `${tipoEmoji} *${author}* está pedindo @${alvoJid.split('@')[0]} em ${tipo}!\n\n` +
    `@${alvoJid.split('@')[0]}, você aceita ${tipoVerbo} com *${author}*? 🥺\n\n` +
    `Use *!euaceito* ou *!eurecuso*\n_⏰ Expira em 5 minutos_`;

  const imagemNome = Date.now() % 2 === 0 ? 'imagecasal.jpg' : 'imagecasal2.jpg';
  const imagemPath = path.join(__dirname, '..', '..', 'Audio-Image', imagemNome);

  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption,
      mentions: [alvoJid],
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, {
      text: caption,
      mentions: [alvoJid],
    }, { quoted: msg });
  }

  setTimeout(() => {
    if (pedidosPendentes.has(alvoJid)) {
      pedidosPendentes.delete(alvoJid);
      sock.sendMessage(jid, {
        text: `⌛ O pedido de *${author}* para @${alvoJid.split('@')[0]} expirou sem resposta. Que falta de respeito!`,
        mentions: [alvoJid],
      }).catch(() => {});
    }
  }, 5 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════
// ─── ACEITAR OU RECUSAR PEDIDO ────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEuAceito(sock, msg, jid, senderJid, relacionamentos, pedidosPendentes, contactNames) {
  const pedido = pedidosPendentes.get(senderJid);
  if (!pedido) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem nenhum pedido pendente.' }, { quoted: msg });
    return;
  }
  pedidosPendentes.delete(senderJid);

  const nomeAlvo = msg.pushName || contactNames[senderJid] || senderJid.split('@')[0];
  const { jidPedinte, nomePedinte, jid: jidOrigem, tipo } = pedido;
  const key  = relKey(senderJid, jidPedinte);
  const agora = Date.now(); // ← captura uma vez só

  relacionamentos.set(key, {
    tipo:  tipo || 'casamento',
    nomeA: nomePedinte,
    nomeB: nomeAlvo,
    jidA:  jidPedinte,
    jidB:  senderJid,
    desde: agora, // ← mesmo valor que vai pro banco
  });
  xpCasais.set(key, 0);
  await syncCasamentoToDb(jidPedinte, senderJid, tipo, agora); // ← passa o desde

  const frases = [
    `💍 CARALHOOOOO! *${nomePedinte}* e *${nomeAlvo}* são CASADOS AGORA! Corre gritando que ninguém acreditava! 😂💍`,
    `💕🏆 É NAMORO! *${nomePedinte}* e *${nomeAlvo}* tão beijando por aí! Que cena constrangedora... bora ver mais! 😏`,
    `🥳 *${nomePedinte}* conseguiu prender *${nomeAlvo}*! Tomara que a corrente segure! 🔐💍`,
    `🌟 UAUUU! Contra todos os prognósticos, *${nomePedinte}* ganhou o coração de *${nomeAlvo}*! Que surpresa! 😱`,
  ];
  const idx     = tipo === 'namoro' ? [1, 3][Math.floor(Math.random() * 2)] : [0, 2][Math.floor(Math.random() * 2)];
  const caption = frases[idx] + '\n\n💪 *Ganhem XP juntos com os comandos! Um casal fraco não vira lenda!*';

  const imagemNome = Date.now() % 2 === 0 ? 'imagecasal.jpg' : 'imagecasal2.jpg';
  const imagemPath = path.join(__dirname, '..', '..', 'Audio-Image', imagemNome);

  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    await sock.sendMessage(jidOrigem || jid, {
      image: imageBuffer,
      caption,
      mentions: [senderJid, jidPedinte],
    });
  } catch {
    await sock.sendMessage(jidOrigem || jid, {
      text: caption,
      mentions: [senderJid, jidPedinte],
    });
  }
}

async function handleEuRecuso(sock, msg, jid, senderJid, pedidosPendentes, contactNames) {
  const pedido = pedidosPendentes.get(senderJid);
  if (!pedido) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem nenhum pedido pendente.' }, { quoted: msg });
    return;
  }
  pedidosPendentes.delete(senderJid);

  const { jidPedinte, jid: jidOrigem } = pedido;

  const frases = [
    `💔 @${senderJid.split('@')[0]} COM TODA FORÇA recusou @${jidPedinte.split('@')[0]}! DESTRUÍDO(A)! 😭😭😭`,
    `🚫 @${senderJid.split('@')[0]} não quer nem saber! @${jidPedinte.split('@')[0]} saiu de ré levando o balde d'agua! 🪣`,
    `😒 Que MANCADA! @${jidPedinte.split('@')[0]} tomou um fora espetacular de @${senderJid.split('@')[0]}! AHAHAHA! 😂`,
    `🤡 CANCELAMENTO! @${jidPedinte.split('@')[0]} é PERSONA NON GRATA na vida de @${senderJid.split('@')[0]}! 🚷`,
  ];

  const caption = frases[Math.floor(Math.random() * frases.length)];
  const imagemPath = path.join(__dirname, '..', '..', 'Audio-Image', 'imagecasal4.jpg');

  try {
    const imageBuffer = fs.readFileSync(imagemPath);
    await sock.sendMessage(jidOrigem || jid, {
      image: imageBuffer,
      caption,
      mentions: [senderJid, jidPedinte],
    });
  } catch {
    await sock.sendMessage(jidOrigem || jid, {
      text: caption,
      mentions: [senderJid, jidPedinte],
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── EXPORTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// Os requires dos sub-módulos VÊM ANTES do module.exports
// para que handleCancelarPedido, handleCancelarCasamento,
// handleTerminar e handleResposta (se existirem nos sub-módulos)
// já estejam disponíveis quando o Object.assign rodar.
const relacionamentoExtra = require(path.join(__dirname, 'relacionamento-extra'));
const relacionamentoFixar = require(path.join(__dirname, 'relacionamento-fixar'));

module.exports = Object.assign(
  {
    // ── estado compartilhado ──
    relKey,
    xpCasais,
    bloqueados,
    diariosUsados,
    ciumentosMap,
    xpBonus,

    // ── helpers ──
    hoje,
    isBloqueado,
    minutosRestantes,
    diasRestantes: minutosRestantes, // alias de compatibilidade
    getRelacionamento,
    syncCasamentoToDb,
    clearCasamentoDb,
    findRelByJid,
    temXpBonus,
    formatarTempo,

    // ── handlers deste arquivo ──
    handleCarinh,
    handleRelacionamento,
    handleEuAceito,
    handleEuRecuso,
  },
  relacionamentoExtra,
  relacionamentoFixar,
);