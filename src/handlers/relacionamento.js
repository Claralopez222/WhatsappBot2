/**
 * Handler de Relacionamentos — Piroquinhas Bot
 * Comandos: !casar, !namorar, !euaceito, !eurecuso, !cancelarpedido,
 *           !cancelarcasamento, !terminar, !flores, !doces, !carta,
 *           !mimo, !beijo, !rankcasais, !fixar, !pinned, !desfixar,
 *           [NOVOS] !abraco, !presente, !jantar, !cinema, !viajar,
 *                   !declarar, !ciumento, !statu, !aniversario_casal,
 *                   !meupar, !xpdobro, !serenata, !duelodecasais
 */

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

function diasRestantes(jid) {
  if (!bloqueados.has(jid)) return 0;
  return Math.ceil((bloqueados.get(jid) - Date.now()) / (1000 * 60 * 60 * 24));
}

function getRelacionamento(a, b, relacionamentos) {
  return relacionamentos.get(relKey(a, b)) || null;
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

function getNivelInfo(xp) {
  const niveis = [
    { xp: 0, nome: '🌱 Recém-saído do forno', titulo: 'Iniciante', emoji: '🌱' },
    { xp: 50, nome: '💕 Apaixonado de verdade', titulo: 'Romântico', emoji: '💕' },
    { xp: 150, nome: '💪 Sólido feito rocha', titulo: 'Sólido', emoji: '💪' },
    { xp: 300, nome: '⭐ Veterano com calo', titulo: 'Veterano', emoji: '⭐' },
    { xp: 500, nome: '🏆 Lenda viva', titulo: 'Lendário', emoji: '🏆' },
    { xp: 800, nome: '👑 IMORTAL DO AMOR', titulo: 'Imortal', emoji: '👑' },
    { xp: 1200, nome: '💎 DEUS DO RELACIONAMENTO', titulo: 'Divino', emoji: '💎' },
  ];
  let nivel = niveis[0];
  for (const n of niveis) if (xp >= n.xp) nivel = n;
  return nivel;
}

// ─── Helper carinho diário ─────────────────────────────────────
async function handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, cmd, emoji, verbo, xpValor = 5) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, {
      text: `💔 Você precisa estar em um relacionamento para usar *!${cmd}*!\n_Use *!casar @alguem* ou *!namorar @alguem* primeiro._`,
    }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  const diarioKey = `${key}:${cmd}:${hoje()}`;
  if (diariosUsados.has(diarioKey)) {
    await sock.sendMessage(jid, {
      text: `⏰ Você já usou *!${cmd}* hoje! Volte amanhã, ansioso(a)! 😊`,
    }, { quoted: msg });
    return;
  }
  diariosUsados.set(diarioKey, true);

  const bonus  = temXpBonus(key) ? xpValor : 0;
  const ganho  = xpValor + bonus;
  const xpAtual = (xpCasais.get(key) || 0) + ganho;
  xpCasais.set(key, xpAtual);

  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const parcJid  = rel.nomeA === author ? rel.jidB  : rel.jidA;

  const bonusStr = bonus > 0 ? ` _(XP Duplo ativo! +${bonus} bônus)_` : '';
  await sock.sendMessage(jid, {
    text: `${emoji} *${author}* ${verbo} para *${parceiro}*! 💕\n\n💰 *+${ganho} XP*${bonusStr} | Total do casal: *${xpAtual} XP*`,
    mentions: parcJid ? [parcJid] : [],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── PEDIDO DE CASAMENTO / NAMORO ─────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRelacionamento(sock, msg, content, jid, author, tipo, relacionamentos, pedidosPendentes, contactNames) {
  const senderJid   = msg.key.participant || msg.key.remoteJid;
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];

  if (mentionedJid.length === 0) {
    const exemplos = tipo === 'casamento' ? 
      ['Marca aí, seu(ua) indeciso(a)! 😤', 'MARCA UM JUIZ AGORA! 💍'] :
      ['Bora! Não tem tímido aqui! 😏', 'Marca agora ou tá com medo? 👀'];
    await sock.sendMessage(jid, {
      text: `${exemplos[Math.floor(Math.random() * exemplos.length)]}\nExemplo: *!${tipo === 'casamento' ? 'casar' : 'namorar'} @fulano*`,
    }, { quoted: msg });
    return;
  }

  const alvoJid  = mentionedJid[0];
  const nomeAlvo = contactNames[alvoJid] || alvoJid.split('@')[0];

  if (alvoJid.split('@')[0] === senderJid.split('@')[0]) {
    const frases = ['😅 Narcisista demais! Procura alguém de verdade!', '🤡 Casamento consigo mesmo? Tá ouvindo voz?', '💀 Auto-sabotagem extrema detected!'];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  if (isBloqueado(senderJid)) {
    const frases = [
      `🚫 TÁ CANCELADO(A)! Sua ex bloqueou por *${diasRestantes(senderJid)} dia(s)*! Vai processar! 💔`,
      `😤 Respira! Você precisa de *${diasRestantes(senderJid)} dia(s)* de terapia antes de casar de novo!`,
      `💀 Seu histórico de divórcio tá te perseguindo! Volta em *${diasRestantes(senderJid)} dia(s)*!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }
  if (isBloqueado(alvoJid)) {
    const frases = [
      `🚫 *${nomeAlvo}* tá em RECLUSÃO! Divórcio ainda tá fresco! Volta em *${diasRestantes(alvoJid)} dia(s)* seu(ua) insensível! 😤`,
      `💔 Ué, qual é? *${nomeAlvo}* tá com o coração em pedaços! Espera *${diasRestantes(alvoJid)} dia(s)* pra propor!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
      mentions: [alvoJid],
    }, { quoted: msg });
    return;
  }

  // Verifica se já estão juntos
  if (getRelacionamento(senderJid, alvoJid, relacionamentos)) {
    const frases = [
      `💑 Vocês JÁ são um casal! Quer renovar os votos? 💍 Use *!renovar*!`,
      `😒 Tá querendo propor NOVAMENTE? Já era pra ter pedido em outro lugar!`,
      `😂 Vocês já tão tão casadinhos que nem precisa más esta!`,
    ];
    await sock.sendMessage(jid, {
      text: frases[Math.floor(Math.random() * frases.length)],
    }, { quoted: msg });
    return;
  }

  // Verifica se algum já está comprometido
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
      text: `⏳ *${nomeAlvo}* já tem um pedido pendente aguardando resposta.`,
      mentions: [alvoJid],
    }, { quoted: msg });
    return;
  }

  pedidosPendentes.set(alvoJid, { tipo, jidPedinte: senderJid, nomePedinte: author, jid });

  const tipoEmoji = tipo === 'casamento' ? '💍' : '💝';
  const tipoVerbo = tipo === 'casamento' ? 'casar' : 'namorar';
  const mensagem =
    `${tipoEmoji} *${author}* está pedindo *${nomeAlvo}* em ${tipo}!\n\n` +
    `@${alvoJid.split('@')[0]}, você aceita ${tipoVerbo} com *${author}*? 🥺\n\n` +
    `Use *!euaceito* ou *!eurecuso*\n_⏰ Expira em 5 minutos_`;

  await sock.sendMessage(jid, { text: mensagem, mentions: [alvoJid] }, { quoted: msg });

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
// ─── ACEITAR / RECUSAR / CANCELAR ─────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEuAceito(sock, msg, jid, senderJid, relacionamentos, pedidosPendentes, contactNames) {
  const pedido = pedidosPendentes.get(senderJid);
  if (!pedido) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem nenhum pedido pendente.' }, { quoted: msg });
    return;
  }
  pedidosPendentes.delete(senderJid);

  const nomeAlvo    = msg.pushName || contactNames[senderJid] || senderJid.split('@')[0];
  const { jidPedinte, nomePedinte, jid: jidOrigem, tipo } = pedido;
  const key = relKey(senderJid, jidPedinte);

  relacionamentos.set(key, {
    tipo: tipo || 'casamento',
    nomeA: nomePedinte,
    nomeB: nomeAlvo,
    jidA:  jidPedinte,
    jidB:  senderJid,
    desde: Date.now(),
  });
  xpCasais.set(key, 0);

  const frases = [
    `💍� CARALHOOOOO! *${nomePedinte}* e *${nomeAlvo}* são CASADOS AGORA! Corre gritando que ninguém acreditava! 😂💍`,
    `💕🏆 É NAMORO! *${nomePedinte}* e *${nomeAlvo}* tão beijando por aí! Que cena constrangedora... bora ver mais! 😏`,
    `🥳 *${nomePedinte}* conseguiu prender *${nomeAlvo}*! Tomara que a corrente segure! 🔐💍`,
    `🌟 UAUUU! Contra todos os prognósticos, *${nomePedinte}* ganhou o coração de *${nomeAlvo}*! Que surpresa! 😱`,
  ];
  const idx = tipo === 'namoro' ? [1, 3][Math.floor(Math.random() * 2)] : [0, 2][Math.floor(Math.random() * 2)];

  await sock.sendMessage(jidOrigem || jid, {
    text: frases[idx] + '\n\n💪 *Ganhem XP juntos com os comandos! Um casal fraco não vira lenda!*',
    mentions: [senderJid, jidPedinte],
  });
}

async function handleEuRecuso(sock, msg, jid, senderJid, pedidosPendentes, contactNames) {
  const pedido = pedidosPendentes.get(senderJid);
  if (!pedido) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem nenhum pedido pendente.' }, { quoted: msg });
    return;
  }
  pedidosPendentes.delete(senderJid);

  const nomeAlvo = msg.pushName || contactNames[senderJid] || senderJid.split('@')[0];
  const { jidPedinte, nomePedinte, jid: jidOrigem } = pedido;

  const frases = [
    `💔 *${nomeAlvo}* COM TODA FORÇA recusou *${nomePedinte}*! DESTRUÍDA! 😭😭😭`,
    `🚫 *${nomeAlvo}* não quer nem saber! *${nomePedinte}* saiu de ré levando o balde d'agua! 🪣`,
    `😒 Que MANCADA! *${nomePedinte}* tomou um fora espetacular de *${nomeAlvo}*! AHAHAHA! 😂`,
    `🤡 CANCELAMENTO! *${nomePedinte}* é PERSONA NON GRATA na vida de *${nomeAlvo}*! 🚷`,
  ];

  await sock.sendMessage(jidOrigem || jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: [senderJid, jidPedinte],
  });
}

async function handleCancelarPedido(sock, msg, jid, senderJid, pedidosPendentes, contactNames) {
  let foundAlvoJid = null;
  for (const [alvoJid, pedido] of pedidosPendentes) {
    if (pedido.jidPedinte === senderJid) { foundAlvoJid = alvoJid; break; }
  }
  if (!foundAlvoJid) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem nenhum pedido ativo para cancelar.' }, { quoted: msg });
    return;
  }
  const pedido = pedidosPendentes.get(foundAlvoJid);
  pedidosPendentes.delete(foundAlvoJid);
  const nomeAlvo = contactNames[foundAlvoJid] || foundAlvoJid.split('@')[0];
  await sock.sendMessage(jid, {
    text: `🚫 *${pedido.nomePedinte}* cancelou o pedido para *${nomeAlvo}*. Ficou com medo? 😂`,
    mentions: [foundAlvoJid],
  }, { quoted: msg });
}

async function handleCancelarCasamento(sock, msg, jid, author, senderJid, relacionamentos) {
  const found = findRelByJid(senderJid, relacionamentos);
  if (!found) {
    await sock.sendMessage(jid, { text: '🤷 Você não está em nenhum relacionamento.' }, { quoted: msg });
    return;
  }

  const { key, rel } = found;
  relacionamentos.delete(key);
  xpCasais.delete(key);
  xpBonus.delete(key);

  const sete = Date.now() + 7 * 24 * 60 * 60 * 1000;
  bloqueados.set(rel.jidA, sete);
  bloqueados.set(rel.jidB, sete);

  const parceiro = rel.nomeA === author ? rel.nomeB : rel.nomeA;
  const frases   = [
    `💔💔 *${author}* TACOU TUDO PRA CIMA E DIVORCIOU DE *${parceiro}*! GUERRA CIVIL! 🔨\n⚠️ *AMBOS TÁ CANCELADO(A) POR 7 DIAS*! 🚫`,
    `🤡 O RELACIONAMENTO EXPLODIU! *${author}* e *${parceiro}* não se suportam mais!\n💳 PROCESSO EM ANDAMENTO! Ambos suspensos por *7 dias*! 🚫`,
    `😭 TRAGÉDIA! *${author}* largou *${parceiro}* feito banana podre!\n💀 *7 DIAS DE RECUSO* para ambos pensarem no que fizeram! 🚫`,
    `💳🔨 DIVORCIO CONSUMADO! *${author}* e *${parceiro}* se odeiam agora!\n🚫 TÃO BLOQUEADO(A) POR *7 DIAS* pra esfriar essa raiva! 😤`,
  ];
  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
  }, { quoted: msg });
}

async function handleTerminar(sock, msg, content, jid, author, relacionamentos) {
  await handleCancelarCasamento(sock, msg, jid, author, msg.key.participant || msg.key.remoteJid, relacionamentos);
}

async function handleResposta(sock, msg, jid, senderJid, resposta, relacionamentos, pedidosPendentes, contactNames) {
  const pedido = pedidosPendentes.get(senderJid);
  if (!pedido) return;
  if (resposta === 'sim') {
    await handleEuAceito(sock, msg, jid, senderJid, relacionamentos, pedidosPendentes, contactNames);
  } else {
    await handleEuRecuso(sock, msg, jid, senderJid, pedidosPendentes, contactNames);
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── COMANDOS DIÁRIOS ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
module.exports = {
  relKey,
  xpCasais,
  bloqueados,
  diariosUsados,
  ciumentosMap,
  xpBonus,
  hoje,
  isBloqueado,
  diasRestantes,
  getRelacionamento,
  findRelByJid,
  temXpBonus,
  formatarTempo,
  handleCarinh,
  handleRelacionamento,
  handleResposta,
  handleEuAceito,
  handleEuRecuso,
  handleCancelarPedido,
  handleCancelarCasamento,
  handleTerminar,
};
const relacionamentoExtra = require('./relacionamento-extra');
const relacionamentoFixar = require('./relacionamento-fixar');
Object.assign(module.exports, relacionamentoExtra, relacionamentoFixar);

