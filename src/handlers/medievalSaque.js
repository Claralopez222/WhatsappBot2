'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const { ARMADURAS, getArma } = require('../utils/medievalUtils');
const {
  somenteGrupo, getModoAtivo, verificarRecuperacaoDerrota, JANELA_SAQUE_MS,
} = require('./medieval');

// Tempo que o vencedor tem pra responder com os números depois de abrir a lista.
const RESPOSTA_TIMEOUT_MS = 60 * 1000;

// Map<vencedorJid, { idGrupo, perdedorJid, opcoes, criadoEm }>
const saqueState = new Map();

function limparEstado(vencedorJid) {
  saqueState.delete(vencedorJid);
}

// ═══════════════════════════════════════════════════════════════
// ─── !saquear @perdedor ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleSaquear(sock, msg, jid, senderJid, targetJid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }
  if (!targetJid) {
    return sock.sendMessage(jid, { text: '💰 Marque o jogador que você derrotou!\nExemplo: *!saquear @fulano*' }, { quoted: msg });
  }
  if (targetJid === senderJid) {
    return sock.sendMessage(jid, { text: '😂 Você não pode saquear a si mesmo!' }, { quoted: msg });
  }

  const perdedor = await MedievalPersonagem.findOne({ idWhatsApp: targetJid, idGrupo: jid });
  if (!perdedor) {
    return sock.sendMessage(jid, { text: '❌ Esse jogador não tem personagem medieval.' }, { quoted: msg });
  }

  await verificarRecuperacaoDerrota(perdedor);

  if (!perdedor.derrotadoEm || perdedor.derrotadoPor !== senderJid) {
    return sock.sendMessage(jid, {
      text: `❌ Você não derrotou *@${targetJid.split('@')[0]}* recentemente (ou a janela já passou).`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  const passouMs = Date.now() - new Date(perdedor.derrotadoEm).getTime();
  if (passouMs >= JANELA_SAQUE_MS) {
    return sock.sendMessage(jid, {
      text: `⏳ A janela de *3 minutos* pra saquear *@${targetJid.split('@')[0]}* já expirou!`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  // ── Monta a lista numerada do que pode ser levado ─────────────────────────
  const carteiraPerdedor = await CarteiraGrupo.findOne({ idWhatsApp: targetJid, idGrupo: jid }).lean();
  const gold = carteiraPerdedor?.gold || 0;

  const invMap = perdedor.inventarioMedieval instanceof Map
    ? perdedor.inventarioMedieval
    : new Map(Object.entries(perdedor.inventarioMedieval || {}));

  const opcoes = [];
  if (gold > 0) {
    opcoes.push({ tipo: 'gold', valor: gold, label: `💰 ${gold} gold` });
  }
  for (const [chave, qtd] of invMap.entries()) {
    if (qtd <= 0) continue;
    opcoes.push({ tipo: 'item', chave, nome: chave.replace(/_/g, ' '), qtd, label: `📦 ${chave.replace(/_/g, ' ')} x${qtd}` });
  }
  if (perdedor.armaEquipada) {
    opcoes.push({ tipo: 'arma', nome: perdedor.armaEquipada, label: `⚔️ ${perdedor.armaEquipada} (equipada)` });
  }
  if (perdedor.armaduraEquipada) {
    opcoes.push({ tipo: 'armadura', nome: perdedor.armaduraEquipada, label: `🛡️ ${perdedor.armaduraEquipada} (equipada)` });
  }

  if (!opcoes.length) {
    return sock.sendMessage(jid, {
      text: `💨 *@${targetJid.split('@')[0]}* não tem nada pra saquear agora!`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  saqueState.set(senderJid, { idGrupo: jid, perdedorJid: targetJid, opcoes, criadoEm: Date.now() });

  const listaTexto = opcoes.map((o, i) => `*${i}* — ${o.label}`).join('\n');

  await sock.sendMessage(jid, {
    text:
      `💰 *SAQUE — @${targetJid.split('@')[0]}* 💰\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${listaTexto}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `_Responda com os números do que quer levar, separados por espaço._\n` +
      `_Exemplo: *0 2 3*_\n\n` +
      `⏳ Você tem *60 segundos* para responder.`,
    mentions: [targetJid],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── Resposta ao !saquear (números) ────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRespostaSaque(sock, msg, jid, senderJid, textoResposta) {
  const estado = saqueState.get(senderJid);
  if (!estado) return false; // nada pendente — outros handlers tratam a mensagem

  if (estado.idGrupo !== jid) return false;

  if (Date.now() - estado.criadoEm > RESPOSTA_TIMEOUT_MS) {
    limparEstado(senderJid);
    await sock.sendMessage(jid, { text: '⏳ Tempo pra escolher o saque esgotado. Use *!saquear @alvo* novamente.' }, { quoted: msg });
    return true;
  }

  const limpo = textoResposta.trim();
  if (!/^[\d\s,]+$/.test(limpo)) return false; // não parece resposta de saque — libera pra outros handlers

  const indices = [...new Set(limpo.split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n)))];
  const validos = indices.filter(i => i >= 0 && i < estado.opcoes.length);

  if (!validos.length) {
    await sock.sendMessage(jid, { text: '⚠️ Nenhum número válido. Tente de novo (ex: *0 2 3*).' }, { quoted: msg });
    return true;
  }

  // ── Revalida a janela de 3min no momento exato da execução ────────────────
  const perdedorAtual = await MedievalPersonagem.findOne({ idWhatsApp: estado.perdedorJid, idGrupo: jid });
  const aindaValido = perdedorAtual?.derrotadoEm
    && perdedorAtual.derrotadoPor === senderJid
    && (Date.now() - new Date(perdedorAtual.derrotadoEm).getTime()) < JANELA_SAQUE_MS;

  if (!aindaValido) {
    limparEstado(senderJid);
    await sock.sendMessage(jid, { text: '⏳ A janela de saque expirou antes da sua confirmação. Nada foi levado.' }, { quoted: msg });
    return true;
  }

  const selecionados = validos.map(i => estado.opcoes[i]);
  const resumo = [];
  let manaMaxDelta    = 0;
  let removeuArma     = false;
  let removeuArmadura = false;

  for (const op of selecionados) {
    if (op.tipo === 'gold') {
      const debitado = await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: estado.perdedorJid, idGrupo: jid, gold: { $gte: op.valor } },
        { $inc: { gold: -op.valor } }
      );
      if (!debitado) { resumo.push(`⚠️ Gold — não estava mais disponível`); continue; }
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $inc: { gold: op.valor } },
        { upsert: true }
      );
      resumo.push(`💰 ${op.valor} gold`);
    }

    if (op.tipo === 'item') {
      const chaveMap = `inventarioMedieval.${op.chave}`;
      const debitado = await MedievalPersonagem.findOneAndUpdate(
        { idWhatsApp: estado.perdedorJid, idGrupo: jid, [chaveMap]: { $gte: op.qtd } },
        { $inc: { [chaveMap]: -op.qtd } }
      );
      if (!debitado) { resumo.push(`⚠️ ${op.nome} — não estava mais disponível`); continue; }
      await MedievalPersonagem.updateOne(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $inc: { [chaveMap]: op.qtd } }
      );
      resumo.push(`📦 ${op.nome} x${op.qtd}`);
    }

    if (op.tipo === 'arma' && perdedorAtual.armaEquipada === op.nome) {
      const armaData = getArma(op.nome);
      if (armaData?.bonusMana) manaMaxDelta -= armaData.bonusMana;
      removeuArma = true;
      await MedievalPersonagem.updateOne(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $inc: { [`inventarioMedieval.${op.nome.replace(/ /g, '_')}`]: 1 } }
      );
      resumo.push(`⚔️ ${op.nome} (equipada)`);
    }

    if (op.tipo === 'armadura' && perdedorAtual.armaduraEquipada === op.nome) {
      const armaduraData = ARMADURAS.find(a => a.nome === op.nome);
      if (armaduraData?.bonusMana) manaMaxDelta -= armaduraData.bonusMana;
      removeuArmadura = true;
      await MedievalPersonagem.updateOne(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $inc: { [`inventarioMedieval.${op.nome.replace(/ /g, '_')}`]: 1 } }
      );
      resumo.push(`🛡️ ${op.nome} (equipada)`);
    }
  }

  // ── Desequipa do perdedor + ajusta mana máxima (mesmo padrão do !desequipar)
  if (removeuArma || removeuArmadura || manaMaxDelta !== 0) {
    const setFields = {};
    if (removeuArma)     setFields.armaEquipada     = null;
    if (removeuArmadura) setFields.armaduraEquipada = null;
    if (manaMaxDelta !== 0) {
      const novoManaMax   = Math.max(1, perdedorAtual.manaMax + manaMaxDelta);
      setFields.manaMax   = novoManaMax;
      setFields.mana      = Math.min(perdedorAtual.mana, novoManaMax);
    }
    await MedievalPersonagem.updateOne(
      { idWhatsApp: estado.perdedorJid, idGrupo: jid },
      { $set: setFields }
    );
  }

  // ── Já foi saqueado — limpa o estado de derrota ───────────────────────────
  await MedievalPersonagem.updateOne(
    { idWhatsApp: estado.perdedorJid, idGrupo: jid },
    { $unset: { derrotadoEm: '', derrotadoPor: '' } }
  );

  limparEstado(senderJid);

  await sock.sendMessage(jid, {
    text:
      `✅ *SAQUE REALIZADO!* ✅\n\n` +
      `Você levou de *@${estado.perdedorJid.split('@')[0]}*:\n` +
      resumo.map(r => `  ${r}`).join('\n'),
    mentions: [senderJid, estado.perdedorJid],
  }, { quoted: msg });

  return true;
}

module.exports = { handleSaquear, handleRespostaSaque, saqueState };