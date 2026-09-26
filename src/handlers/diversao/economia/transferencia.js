'use strict';

const { getCarteira, transferirGold } = require('../../../utils/carteira');
const { resolveUserFromMsg, resolveGlobalId, extrairNumero } = require('../../../utils/identity');
const Usuario = require('../../../models/Usuario');
const { LOOKUP_ITENS_LOJA, normalizarChaveItem } = require('./_shared');
const { ITENS_LOJA } = require('../../../config/economia');

// ─── !pix ───────────────────────────────────────────────────────────────
/**
 * Extrai { targetJid, numeroPura, quantia } do contexto da mensagem.
 * Retorna null se não for possível resolver os parâmetros.
 * Tratado para suportar JIDs normais (@s.whatsapp.net) e novos identificadores (@lid).
 */
function parsearPix(msg, caption) {
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  // ── Caso 1: menção via @tag (O Baileys já entrega o JID nativo correto)
  if (mentionedJid) {
    const parts   = caption.trim().split(/\s+/);
    const quantia = parseInt(parts[parts.length - 1], 10);
    if (isNaN(quantia) || quantia <= 0) return null;

    const targetJid = resolveGlobalId(mentionedJid);

    return {
      targetJid,
      numeroPura: extrairNumero(mentionedJid),
      quantia,
    };
  }

  // ── Caso 2: número digitado manualmente (!pix 5511999 50)
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
  const userId = resolveUserFromMsg(msg);
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
    // Transfere o saldo local no grupo usando operações atômicas
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
    throw e; // Erros inesperados do banco de dados continuam subindo para o log
  }

  // Define um saldo visual caso o retorno atômico falte por algum motivo
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

// ─── !give ──────────────────────────────────────────────────────────────

async function handleGive(sock, msg, jid, caption) {
  const userId       = resolveUserFromMsg(msg);
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca quem vai receber!\nExemplo: *!give @fulano pizza*',
    }, { quoted: msg });
    return;
  }

  if (mentionedJid.split('@')[0] === userId.split('@')[0]) {
    await sock.sendMessage(jid, {
      text: '😂 Você não pode dar item pra si mesmo!',
    }, { quoted: msg });
    return;
  }

  // Captura o RESTO da string (não só uma palavra), pois o nome de exibição
  // pode ter espaços (ex: "PC Gamer Lendário", "Garrafa Vinho Tinto").
  const match = caption.match(/give\s+@\S+\s+(.+)/i) || caption.match(/give\s+(.+)/i);
  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!give @fulano <item>*\nExemplo: *!give @João pizza*',
    }, { quoted: msg });
    return;
  }

  const itemDigitado = match[1].trim();

  // Aceita tanto a chave técnica (ex: "linguica") quanto o nome de exibição
  // (ex: "Linguiça", "PC Gamer Lendário"), ignorando acentos e espaços.
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

  // ── Checar se o remetente tem o item ──
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

  // ── Remover do remetente — guarda atômica contra estoque negativo em
  // caso de dois !give quase simultâneos do mesmo item ──
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

  // ── Adicionar ao destinatário ──
  const mentionedNorm = resolveGlobalId(mentionedJid);

  await Usuario.findOneAndUpdate(
    { idWhatsApp: mentionedNorm },
    { $inc: { [`inventory.${itemKey}`]: 1 } },
    { upsert: true }
  );

  const numeroAlvo = extrairNumero(mentionedJid);

  await sock.sendMessage(jid, {
    text:
      `🎁 *PRESENTE ENVIADO!* 🎁\n\n` +
      `📦 Item: *${itemInfo.nome}*\n` +
      `➡️ Para: *@${numeroAlvo}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `_Use !inventario pra conferir seus itens._`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

module.exports = { handlePix, handleGive };