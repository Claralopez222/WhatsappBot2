'use strict';
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const PinnedMessage = require('../../models/PinnedMessage');

// ── helpers ──────────────────────────────────────────────────
function parseDuration(arg) {
  if (arg === '24h' || arg === '1') return 86400;
  if (arg === '30')                 return 2592000;
  return 604800; // 7 dias padrão
}

function duracaoLabel(s) {
  if (s === 86400)   return '24 Horas';
  if (s === 2592000) return '30 Dias';
  return '7 Dias';
}

// ── !fixar ───────────────────────────────────────────────────
async function handleFixar(sock, msg, jid) {
  const chatJid   = jidNormalizedUser(jid);
  const senderJid = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);

  const ctx        = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsg  = ctx?.quotedMessage;
  const quotedSign = ctx?.stanzaId;
  const quotedPart = ctx?.participant;

  if (!quotedMsg || !quotedSign) {
    return sock.sendMessage(chatJid, {
      text: '⚠️ Responda a mensagem que deseja fixar e use *!fixar* (ou *!fixar 24h* / *!fixar 30*).',
    }, { quoted: msg });
  }

  const msgText =
    quotedMsg.conversation              ||
    quotedMsg.extendedTextMessage?.text ||
    quotedMsg.imageMessage?.caption     ||
    quotedMsg.videoMessage?.caption     ||
    '[_Mensagem de Mídia_]';

  // FIX 2: cobre tanto extendedTextMessage quanto conversation
  const fullText =
    msg.message?.extendedTextMessage?.text ||
    msg.message?.conversation              ||
    '';
  const args     = fullText.trim().split(/\s+/);
  const duration = parseDuration(args[1]);

  try {
    await sock.sendMessage(chatJid, {
      pin: {
        key: {
          remoteJid:   chatJid,
          // FIX 3: fallback seguro para sock.user?.id no boot
          fromMe: quotedPart
            ? jidNormalizedUser(quotedPart) === jidNormalizedUser(sock.user?.id ?? '')
            : false,
          id:          quotedSign,
          participant: quotedPart,
        },
        // FIX 1: valores numéricos diretos — evita falha silenciosa em versões
        // do Baileys onde proto.Message.PinExtension.Type pode ser undefined
        type:     1, // PIN
        duration,
      },
    });

    await PinnedMessage.findOneAndUpdate(
      { chatJid },
      {
        text:      msgText,
        messageId: quotedSign,
        orig:      quotedPart ? jidNormalizedUser(quotedPart) : null,
        fixadoPor: senderJid,
        fixadoEm:  new Date(),
      },
      { upsert: true, new: true }
    );

    return sock.sendMessage(chatJid, {
      text: `📌 Mensagem fixada no WhatsApp!\n⏱️ Duração: *${duracaoLabel(duration)}*.`,
    }, { quoted: msg });

  } catch (err) {
    console.error('[handleFixar] Erro:', err);
    return sock.sendMessage(chatJid, {
      text: '❌ Não foi possível fixar. Verifique se o bot é *administrador* do grupo.',
    }, { quoted: msg });
  }
}

// ── !pinned ──────────────────────────────────────────────────
async function handlePinned(sock, msg, jid) {
  const chatJid = jidNormalizedUser(jid);

  // FIX 4: try/catch para não derrubar o handler se o MongoDB cair
  try {
    const pm = await PinnedMessage.findOne({ chatJid }).lean();

    if (!pm) {
      return sock.sendMessage(chatJid, {
        text: 'ℹ️ Nenhuma mensagem fixada registrada neste chat.\n\n_Use *!fixar* respondendo a uma mensagem._',
      }, { quoted: msg });
    }

    const quando   = new Date(pm.fixadoEm).toLocaleString('pt-BR');
    const tagOrig  = pm.orig      ? `@${pm.orig.split('@')[0]}`      : 'desconhecido';
    const tagFixou = pm.fixadoPor ? `@${pm.fixadoPor.split('@')[0]}` : 'desconhecido';
    const mentions = [pm.orig, pm.fixadoPor].filter(Boolean);

    return sock.sendMessage(chatJid, {
      text:
        `📌 *Mensagem fixada*\n\n`  +
        `👤 *De:* ${tagOrig}\n`     +
        `📌 *Fixada por:* ${tagFixou}\n` +
        `📅 *Em:* ${quando}\n\n`    +
        `📝 *Conteúdo:*\n${pm.text}`,
      mentions,
    }, { quoted: msg });

  } catch (err) {
    console.error('[handlePinned] Erro:', err);
    return sock.sendMessage(chatJid, {
      text: '⚠️ Erro ao buscar mensagem fixada. Tente novamente.',
    }, { quoted: msg });
  }
}

// ── !desfixar ────────────────────────────────────────────────
async function handleDesfixar(sock, msg, jid) {
  const chatJid = jidNormalizedUser(jid);

  let pm;
  try {
    pm = await PinnedMessage.findOne({ chatJid }).lean();
  } catch (err) {
    console.error('[handleDesfixar] Erro ao buscar no banco:', err);
    return sock.sendMessage(chatJid, {
      text: '⚠️ Erro ao acessar o banco de dados. Tente novamente.',
    }, { quoted: msg });
  }

  try {
    if (pm?.messageId) {
      await sock.sendMessage(chatJid, {
        pin: {
          key: {
            remoteJid:   chatJid,
            id:          pm.messageId,
            participant: pm.orig,
          },
          type: 2, // FIX 1: UNPIN — valor numérico direto
        },
      });
    }
  } catch (err) {
    console.error('[handleDesfixar] Erro ao desfixar no WA:', err);
  }

  await PinnedMessage.deleteOne({ chatJid });

  return sock.sendMessage(chatJid, {
    text: pm
      ? '✅ Mensagem desfixada com sucesso!'
      : 'ℹ️ Não havia mensagem fixada registrada.',
  }, { quoted: msg });
}

module.exports = { handleFixar, handlePinned, handleDesfixar };