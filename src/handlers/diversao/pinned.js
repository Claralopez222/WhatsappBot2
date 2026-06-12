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

  const fullText =
    msg.message?.extendedTextMessage?.text ||
    msg.message?.conversation              ||
    '';
  const args     = fullText.trim().split(/\s+/);
  const duration = parseDuration(args[1]);

  // ── CORREÇÃO DA KEY: Identifica se a mensagem marcada é do próprio bot ──
  const isFromMe = quotedPart
    ? jidNormalizedUser(quotedPart) === jidNormalizedUser(sock.user?.id ?? '')
    : false;

  const targetKey = {
    remoteJid: chatJid,
    fromMe:    isFromMe,
    id:        quotedSign,
  };

  // REGRA DE OURO: O participant SÓ vai na key se a mensagem NÃO for nossa e for em grupo
  if (!isFromMe && chatJid.endsWith('@g.us') && quotedPart) {
    targetKey.participant = quotedPart;
  }

  try {
    // Envia o comando de fixação nativo correto para o WhatsApp
    await sock.sendMessage(chatJid, {
      pin: {
        key:      targetKey,
        type:     1, // PIN
        duration,
      },
    });

    // Salva no banco para o comando !pinned funcionar depois
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
      // Também precisamos da validação do fromMe aqui para desfixar certo
      const isFromMe = pm.orig
        ? jidNormalizedUser(pm.orig) === jidNormalizedUser(sock.user?.id ?? '')
        : false;

      const unpinKey = {
        remoteJid: chatJid,
        fromMe:    isFromMe,
        id:        pm.messageId,
      };

      if (!isFromMe && chatJid.endsWith('@g.us') && pm.orig) {
        unpinKey.participant = pm.orig;
      }

      await sock.sendMessage(chatJid, {
        pin: {
          key:  unpinKey,
          type: 2, // UNPIN
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