'use strict';

const path = require('path');

const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { getNivelInfo } = require(path.join(__dirname, '..', '..', 'utils', 'levelUtils'));
const { ITENS_LOJA }  = require(path.join(__dirname, '..', 'diversao', 'economia'));

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
  if (!_rel) _rel = require(path.join(__dirname, 'index'));
  return _rel;
}

function findRelByJid(jid, userJid, relacionamentos) { return rel().findRelByJid(jid, userJid, relacionamentos); }
function temXpBonus(key)                    { return rel().temXpBonus(key); }
function formatarTempo(ms)                  { return rel().formatarTempo(ms); }
function isBloqueado(jid)                   { return rel().isBloqueado(jid); }
function minutosRestantes(jid)              { return rel().minutosRestantes(jid); }
function handleCarinh(...args)              { return rel().handleCarinh(...args); }
function handleRelacionamento(...args)      { return rel().handleRelacionamento(...args); }
function handleCancelarCasamento(...args)   { return rel().handleCancelarCasamento(...args); }

// ═══════════════════════════════════════════════════════════════
// ─── WRAPPERS DE COMANDOS DE RELACIONAMENTO ──────────────────
// ═══════════════════════════════════════════════════════════════

async function handleCasar(sock, msg, content, jid, author, relacionamentos, pedidosPendentes, contactNames) {
  return handleRelacionamento(sock, msg, content, jid, author, 'casamento', relacionamentos, pedidosPendentes, contactNames);
}

async function handleNamorar(sock, msg, content, jid, author, relacionamentos, pedidosPendentes, contactNames) {
  return handleRelacionamento(sock, msg, content, jid, author, 'namoro', relacionamentos, pedidosPendentes, contactNames);
}

async function handleCancelarPedido(sock, msg, jid, senderJid, pedidosPendentes) {
  const senderNorm = jidNormalizedUser(senderJid);
  let cancelado = false;
  for (const [alvoJid, p] of pedidosPendentes.entries()) {
    if (jidNormalizedUser(p.jidPedinte) === senderNorm || jidNormalizedUser(alvoJid) === senderNorm) {
      pedidosPendentes.delete(alvoJid);
      cancelado = true;
    }
  }
  if (cancelado) {
    await sock.sendMessage(jid, { text: '✅ Pedido pendente cancelado com sucesso!' }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: '⚠️ Você não possui pedidos pendentes para cancelar.' }, { quoted: msg });
  }
}

async function handleTerminar(sock, msg, jid, senderJid, relacionamentos) {
  return handleCancelarCasamento(sock, msg, jid, senderJid, relacionamentos);
}

// ─── CARINHOS ─────────────────────────────────────────────────

async function handleFlores(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'flores', '🌹', 'deu flores para', 10);
}

async function handleDoces(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'doces', '🍓', 'deu morango com chocolate para', 10);
}

async function handleCarta(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'carta', '💌', 'escreveu uma carta de amor para', 10);
}

async function handleMimo(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'mimo', '🎁', 'deu um mimo especial para', 15);
}

async function handleBeijo(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'beijo', '💋', 'deu um beijo apaixonado em', 8);
}

async function handleAbraco(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'abraco', '🤗', 'deu um abraço aconchegante em', 5);
}

async function handlePresente(sock, msg, jid, author, senderJid, relacionamentos) {
  // O handleCarinh já se encarrega de verificar o inventário (chave 'caixa'), abater 1 item e aplicar o XP
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'mimo', '🎁', 'deu um lindo presente para', 15);
}

async function handleJantar(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'jantar', '🍷', 'preparou um jantar romântico para', 20);
}

async function handleCinema(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'cinema', '🛋️', 'levou para um cinema juntinhos', 15);
}

async function handleViajar(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'viajar', '🍾', 'levará seu par para uma viagem inesquecível', 25);
}

async function handleSerenata(sock, msg, jid, author, senderJid, relacionamentos) {
  return handleCarinh(sock, msg, jid, author, senderJid, relacionamentos, 'serenata', '🕯️', 'fez uma linda serenata à luz de velas para', 20);
}

// ═══════════════════════════════════════════════════════════════
// ─── OUTROS COMANDOS DE CASAL ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRankCasais(sock, msg, jid, relacionamentos) {
  const xpCasais = rel().xpCasais;
  if (!relacionamentos || relacionamentos.size === 0) {
    await sock.sendMessage(jid, { text: '💔 Nenhum casal registrado neste grupo ainda!' }, { quoted: msg });
    return;
  }

  const lista = [];
  for (const [key, r] of relacionamentos.entries()) {
    if (key.startsWith(jid + '|')) {
      const xp = xpCasais.get(key) || 0;
      lista.push({ ...r, key, xp });
    }
  }

  if (lista.length === 0) {
    await sock.sendMessage(jid, { text: '💔 Nenhum casal registrado neste grupo ainda!' }, { quoted: msg });
    return;
  }

  lista.sort((a, b) => b.xp - a.xp);

  const picos = ['👑', '🥈', '🥉'];
  let text = `🏆 *RANKING DE CASAIS DO GRUPO* 🏆\n\n`;

  lista.slice(0, 10).forEach((c, idx) => {
    const medalha = idx < 3 ? picos[idx] : `*${idx + 1}º*`;
    const tipo = c.tipo === 'namoro' ? '💕' : '💍';
    text += `${medalha} ${tipo} *${c.nomeA}* & *${c.nomeB}* — *${c.xp} XP*\n`;
  });

  await sock.sendMessage(jid, { text }, { quoted: msg });
}

async function handleDeclarar(sock, msg, content, jid, author, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar em um relacionamento para se declarar!' }, { quoted: msg });
    return;
  }

  const rawText = content.extendedTextMessage?.text || content.conversation || '';
  const declaracao = rawText.replace(/^[!.,\/]declarar\s*/i, '').trim();

  if (!declaracao) {
    await sock.sendMessage(jid, { text: '✍️ Escreva sua declaração! Ex: *!declarar Você é o amor da minha vida!*' }, { quoted: msg });
    return;
  }

  const { rel } = found;
  const parcJid = jidNormalizedUser(rel.jidA === senderNorm ? rel.jidB : rel.jidA);
  const tagSelf = `@${senderNorm.split('@')[0]}`;
  const tagParc = `@${parcJid.split('@')[0]}`;

  await sock.sendMessage(jid, {
    text: `📜 *DECLARAÇÃO DE AMOR* 📜\n\nDe ${tagSelf} para ${tagParc}:\n\n"${declaracao}"\n\n💖✨`,
    mentions: [senderNorm, parcJid],
  }, { quoted: msg });
}

async function handleCiumento(sock, msg, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const ciumentosMap = rel().ciumentosMap;
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar em um relacionamento para usar !ciumento!' }, { quoted: msg });
    return;
  }

  const now = Date.now();
  if (ciumentosMap.has(senderNorm) && now < ciumentosMap.get(senderNorm)) {
    const mins = Math.ceil((ciumentosMap.get(senderNorm) - now) / 60000);
    await sock.sendMessage(jid, { text: `⏰ Controle essa ciúme! Aguarde ${mins} minuto(s) para cobrar seu par de novo.` }, { quoted: msg });
    return;
  }

  ciumentosMap.set(senderNorm, now + 60 * 60 * 1000);

  const { rel } = found;
  const parcJid = jidNormalizedUser(rel.jidA === senderNorm ? rel.jidB : rel.jidA);
  const tagSelf = `@${senderNorm.split('@')[0]}`;
  const tagParc = `@${parcJid.split('@')[0]}`;

  const frases = [
    `👀 ${tagSelf} está de olho em você, ${tagParc}! Quem é essa pessoa que curtiu sua foto? 🤨`,
    `📱 ${tagSelf} exige ver seu WhatsApp AGORA, ${tagParc}! Não tenta disfarçar! 😤`,
    `🔪 ${tagSelf} ativou o modo detetive! Com quem você estava conversando, ${tagParc}? 🧐`,
  ];

  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: [senderNorm, parcJid],
  }, { quoted: msg });
}

async function handleStatu(sock, msg, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você está solteiro(a)! Use *!casar @alguem* para mudar isso.' }, { quoted: msg });
    return;
  }

  const { key, rel: r } = found;
  const xpCasais = rel().xpCasais;
  const xp = xpCasais.get(key) || 0;
  const tempoMs = Date.now() - r.desde;
  const tempoStr = formatarTempo(tempoMs);

  const parcJid = jidNormalizedUser(r.jidA === senderNorm ? r.jidB : r.jidA);
  const tagParc = `@${parcJid.split('@')[0]}`;
  const tipoEmoji = r.tipo === 'namoro' ? '💕' : '💍';

  const nivelInfo = getNivelInfo ? getNivelInfo(xp) : { nivel: 1, titulo: 'Casal Iniciante' };

  const texto =
    `${tipoEmoji} *STATUS DO RELACIONAMENTO* ${tipoEmoji}\n\n` +
    `👤 *Parceiro(a):* ${tagParc}\n` +
    `📅 *Juntos há:* ${tempoStr}\n` +
    `✨ *XP do Casal:* ${xp} XP\n` +
    `🏅 *Nível do Casal:* Nível ${nivelInfo.nivel} (${nivelInfo.titulo})\n\n` +
    `💪 _Continuem trocando carinhos diariamente para subir de nível!_`;

  await sock.sendMessage(jid, {
    text: texto,
    mentions: [senderNorm, parcJid],
  }, { quoted: msg });
}

async function handleAniversarioCasal(sock, msg, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não está em nenhum relacionamento!' }, { quoted: msg });
    return;
  }

  const { rel: r } = found;
  const dataInicio = new Date(r.desde).toLocaleDateString('pt-BR');
  const tempoMs = Date.now() - r.desde;
  const tempoStr = formatarTempo(tempoMs);

  const parcJid = jidNormalizedUser(r.jidA === senderNorm ? r.jidB : r.jidA);
  const tagParc = `@${parcJid.split('@')[0]}`;

  await sock.sendMessage(jid, {
    text: `🎉 *ANIVERSÁRIO DO CASAL* 🎉\n\n` +
          `👩‍❤️‍👨 Você e ${tagParc} começaram a namorar/casar em *${dataInicio}*!\n` +
          `⏳ Vocês já estão juntos há *${tempoStr}*! Parabéns ao casal! 🥳🥂`,
    mentions: [senderNorm, parcJid],
  }, { quoted: msg });
}

async function handleMeuPar(sock, msg, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você não tem um par no momento!' }, { quoted: msg });
    return;
  }

  const { rel: r } = found;
  const parcJid = jidNormalizedUser(r.jidA === senderNorm ? r.jidB : r.jidA);
  const tagParc = `@${parcJid.split('@')[0]}`;
  const tipo = r.tipo === 'namoro' ? 'namorado(a)' : 'esposo(a)';

  await sock.sendMessage(jid, {
    text: `💖 Seu(ua) ${tipo} é ${tagParc}!`,
    mentions: [parcJid],
  }, { quoted: msg });
}

async function handleXpDobro(sock, msg, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar em um relacionamento para ativar o XP Dobro!' }, { quoted: msg });
    return;
  }

  const { key } = found;
  const xpBonus = rel().xpBonus;

  if (temXpBonus(key)) {
    const bonus = xpBonus.get(key);
    const restMins = Math.ceil((bonus.expiry - Date.now()) / 60000);
    await sock.sendMessage(jid, { text: `⚡ O bônus de XP Dobro já está ATIVO por mais ${restMins} minuto(s)!` }, { quoted: msg });
    return;
  }

  // Custo para ativar bônus: 200 de gold (campo real do schema Usuario é "gold", não "moedas")
  const userDoc = await Usuario.findOne({ idWhatsApp: senderNorm }, { gold: 1 }).lean();
  if ((userDoc?.gold || 0) < 200) {
    await sock.sendMessage(jid, { text: '🪙 Você precisa de 200 de gold para ativar o XP Dobro por 1 hora!' }, { quoted: msg });
    return;
  }

  await Usuario.updateOne({ idWhatsApp: senderNorm }, { $inc: { gold: -200 } });

  xpBonus.set(key, { ativo: true, expiry: Date.now() + 60 * 60 * 1000 });

  await sock.sendMessage(jid, {
    text: '⚡ *XP DOBRO ATIVADO!* ⚡\n\nTodos os carinhos de vocês renderão o dobro de XP pela próxima *1 hora*! 🎉',
  }, { quoted: msg });
}

async function handleDueloCasais(sock, msg, content, jid, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const foundA = findRelByJid(jid, senderNorm, relacionamentos);

  if (!foundA) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar em um relacionamento para desafiar outro casal!' }, { quoted: msg });
    return;
  }

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];

  if (mentionedJid.length === 0) {
    await sock.sendMessage(jid, { text: '⚔️ Marque alguém do casal adversário!\nEx: *!duelodecasais @adversario*' }, { quoted: msg });
    return;
  }

  const oponenteJid = jidNormalizedUser(mentionedJid[0]);
  const foundB = findRelByJid(jid, oponenteJid, relacionamentos);

  if (!foundB) {
    await sock.sendMessage(jid, { text: '💔 O adversário marcado não está em um relacionamento!' }, { quoted: msg });
    return;
  }

  if (foundA.key === foundB.key) {
    await sock.sendMessage(jid, { text: '🤔 Você não pode duelar contra o seu próprio par!' }, { quoted: msg });
    return;
  }

  const xpCasais = rel().xpCasais;
  const xpA = xpCasais.get(foundA.key) || 0;
  const xpB = xpCasais.get(foundB.key) || 0;

  let vencedor, perdedor;
  if (xpA >= xpB) {
    vencedor = foundA.rel;
    perdedor = foundB.rel;
  } else {
    vencedor = foundB.rel;
    perdedor = foundA.rel;
  }

  await sock.sendMessage(jid, {
    text: `⚔️ *DUELO DE CASAIS* ⚔️\n\n` +
          `🥊 *${foundA.rel.nomeA} & ${foundA.rel.nomeB}* (${xpA} XP)\n` +
          `            VS\n` +
          `🥊 *${foundB.rel.nomeA} & ${foundB.rel.nomeB}* (${xpB} XP)\n\n` +
          `🏆 *VENCEDOR:* ${vencedor.nomeA} & ${vencedor.nomeB}! 🎉`,
  }, { quoted: msg });
}

async function handleSurpresa(sock, msg, jid, author, senderJid, relacionamentos) {
  const senderNorm = jidNormalizedUser(senderJid);
  const found = findRelByJid(jid, senderNorm, relacionamentos);

  if (!found) {
    await sock.sendMessage(jid, { text: '💔 Você precisa estar em um relacionamento para dar uma surpresa!' }, { quoted: msg });
    return;
  }

  // Custo da surpresa: 50 de gold (campo real do schema Usuario é "gold", não "moedas")
  const userDoc = await Usuario.findOne({ idWhatsApp: senderNorm }, { gold: 1 }).lean();
  if ((userDoc?.gold || 0) < 50) {
    await sock.sendMessage(jid, { text: '🪙 Você precisa de 50 de gold para fazer uma surpresa!' }, { quoted: msg });
    return;
  }

  await Usuario.updateOne({ idWhatsApp: senderNorm }, { $inc: { gold: -50 } });

  const surpresas = [
    { text: '🎁 Preparou um picnic surpresa no parque!', xp: 15 },
    { text: '🍫 Comprou uma caixa gigante de bombons finos!', xp: 20 },
    { text: '🎟️ Comprou ingressos VIP para o show favorito de vocês!', xp: 25 },
    { text: '🧸 Deu um urso de pelúcia gigante!', xp: 15 },
  ];

  const s = surpresas[Math.floor(Math.random() * surpresas.length)];
  const { key, rel: r } = found;
  const parcJid = jidNormalizedUser(r.jidA === senderNorm ? r.jidB : r.jidA);
  const tagSelf = `@${senderNorm.split('@')[0]}`;
  const tagParc = `@${parcJid.split('@')[0]}`;

  const xpCasais = rel().xpCasais;
  const xpAtual = (xpCasais.get(key) || 0) + s.xp;
  xpCasais.set(key, xpAtual);

  const jidANorm = jidNormalizedUser(r.jidA);
  const jidBNorm = jidNormalizedUser(r.jidB);

  Usuario.updateMany(
    { idWhatsApp: { $in: [jidANorm, jidBNorm] } },
    { $inc: { xpCasal: s.xp } }
  ).catch(e => console.error('[handleSurpresa] Erro ao salvar XP no DB:', e.message));

  await sock.sendMessage(jid, {
    text: `🎉 *SURPRESA ROMÂNTICA!* 🎉\n\n${tagSelf} fez uma surpresa para ${tagParc}!\n${s.text}\n\n💖 *+${s.xp} XP para o casal!* (Total: ${xpAtual} XP)`,
    mentions: [senderNorm, parcJid],
  }, { quoted: msg });
}

module.exports = {
  handleCasar,
  handleNamorar,
  handleCancelarPedido,
  handleTerminar,
  handleFlores,
  handleDoces,
  handleCarta,
  handleMimo,
  handleBeijo,
  handleRankCasais,
  handleAbraco,
  handlePresente,
  handleJantar,
  handleCinema,
  handleViajar,
  handleSerenata,
  handleDeclarar,
  handleCiumento,
  handleStatu,
  handleAniversarioCasal,
  handleMeuPar,
  handleXpDobro,
  handleDueloCasais,
  handleSurpresa,
};
