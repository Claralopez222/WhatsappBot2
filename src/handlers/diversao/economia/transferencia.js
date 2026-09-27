'use strict';

const path = require('path');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { getCarteira, transferirGold } = require(path.join(__dirname, '..', '..', '..', 'utils', 'carteira'));
const { resolveUserFromMsg, resolveGlobalId, extrairNumero } = require(path.join(__dirname, '..', '..', '..', 'utils', 'identity'));
const Usuario = require(path.join(__dirname, '..', '..', '..', 'models', 'Usuario'));
const { LOOKUP_ITENS_LOJA, normalizarChaveItem } = require('./_shared');
const { ITENS_LOJA } = require(path.join(__dirname, '..', '..', '..', 'config', 'economia'));

/**
 * Extrai { targetJid, numeroPura, quantia } do contexto da mensagem.
 * Tratado para suportar JIDs normais (@s.whatsapp.net) e identificadores LID (@lid).
 */
function parsearPix(msg, caption) {
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (mentionedJid) {
    const parts   = caption.trim().split(/\s+/);
    const quantia = parseInt(parts[parts.length - 1], 10);
    if (isNaN(quantia) || quantia <= 0) return null;

    const targetJid = jidNormalizedUser(mentionedJid);

    return {
      targetJid,
      numeroPura: targetJid.split('@')[0],
      quantia,
    };
  }

  const numMatch = caption.match(/(?:pix|transferir)\s+@?(\d+)\s+(\d+)/i);
  if (!numMatch) return null;

  const numeroPura = numMatch[1].replace(/\D/g, '');
  const quantia    = parseInt(numMatch[2], 10);
  if (!numeroPura || isNaN(quantia) || quantia <= 0) return null;

  return {
    targetJid:  `${numeroPura}@s.whatsapp.net`,
    numeroPura,
    quantia,
  };
}

// !pix
async function handlePix(sock, msg, jid, caption) {
  const userId = jidNormalizedUser(resolveUserFromMsg(msg));
  const parsed = parsearPix(msg, caption);

  if (!parsed) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!pix @pessoa quantia*\nExemplo: *!pix @Felipe 30*',
    }, { quoted: msg });
    return;
  }

  const { targetJid, numeroPura, quantia } = parsed;

  if (userId === targetJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Você não pode fazer PIX para si mesmo!',
    }, { quoted: msg });
    return;
  }

  let resultado;
  try {
    resultado = await transferirGold(
      userId,
      targetJid,
      jid,
      quantia,
      'PIX'
    );
  } catch (e) {
    if (e instanceof RangeError) {
      const carteiraRemetente = await getCarteira(userId, jid);
      const saldo = carteiraRemetente?.gold ?? 0;
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE!*\n\n` +
          `💰 Você tem: *${saldo}* gold\n` +
          `💸 Precisa de: *${quantia}* gold`,
      }, { quoted: msg });
      return;
    }
    throw e;
  }

  const saldoFinalRemetente = resultado?.de?.gold ?? 0;

  await sock.sendMessage(jid, {
    text:
      `✅ *TRANSFERÊNCIA REALIZADA!* ✅\n\n` +
      `💸 *${quantia} gold* enviado para *@${numeroPura}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 Seu novo saldo: *${saldoFinalRemetente}* gold`,
    mentions: [targetJid, userId],
  }, { quoted: msg });
}

// !give
async function handleGive(sock, msg, jid, caption) {
  const userId       = jidNormalizedUser(resolveUserFromMsg(msg));
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca quem vai receber!\nExemplo: *!give @fulano pizza*',
    }, { quoted: msg });
    return;
  }

  const targetNorm = jidNormalizedUser(mentionedJid);

  if (targetNorm === userId) {
    await sock.sendMessage(jid, {
      text: '😂 Você não pode dar item pra si mesmo!',
    }, { quoted: msg });
    return;
  }

  const match = caption.match(/give\s+@\S+\s+(.+)/i) || caption.match(/give\s+(.+)/i);
  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!give @fulano <item>*\nExemplo: *!give @João pizza*',
    }, { quoted: msg });
    return;
  }

  const itemDigitado = match[1].trim();
  const itemKey  = LOOKUP_ITENS_LOJA[normalizarChaveItem(itemDigitado)] || null;
  const itemInfo = itemKey ? ITENS_LOJA[itemKey] : null;

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Item *${itemDigitado}* não existe!\n\n` +
        `Use *!loja* pra ver os itens disponíveis.`,
    }, { quoted: msg });
    return;
  }

  const remetente = await Usuario.findOne({ idWhatsApp: userId }).select('inventory').lean();
  const qtd       = remetente?.inventory?.[itemKey] ?? 0;

  if (qtd <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Você não possui *${itemInfo.nome}* no inventário!\n\n` +
        `Use *!inventario* pra ver seus itens ou *!buy ${itemKey}* pra comprar.`,
    }, { quoted: msg });
    return;
  }

  const remetenteAtualizado = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, [`inventory.${itemKey}`]: { $gte: 1 } },
    { $inc: { [`inventory.${itemKey}`]: -1 } }
  );

  if (!remetenteAtualizado) {
    await sock.sendMessage(jid, {
      text: `⚠️ *${itemInfo.nome}* não estava mais disponível no seu inventário. Tente novamente.`,
    }, { quoted: msg });
    return;
  }

  await Usuario.findOneAndUpdate(
    { idWhatsApp: targetNorm },
    { $inc: { [`inventory.${itemKey}`]: 1 } },
    { upsert: true }
  );

  const numeroAlvo = targetNorm.split('@')[0];

  await sock.sendMessage(jid, {
    text:
      `🎁 *PRESENTE ENVIADO!* 🎁\n\n` +
      `📦 Item: *${itemInfo.nome}*\n` +
      `➡️ Para: *@${numeroAlvo}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `_Use !inventario pra conferir seus itens._`,
    mentions: [targetNorm],
  }, { quoted: msg });
}

module.exports = { handlePix, handleGive };
