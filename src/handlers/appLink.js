'use strict';

const crypto = require('crypto');
const axios = require('axios');
const LidMapping = require('../models/LidMapping');

function normalizarJid(jid) {
  const [user, server] = String(jid || '').trim().toLowerCase().split('@');
  return user && server ? `${user.split(':')[0]}@${server}` : '';
}

async function handleAppLink(sock, msg, chatJid, senderJid, args) {
  const isPrivate = chatJid && !chatJid.endsWith('@g.us') && !chatJid.endsWith('@broadcast');
  if (!isPrivate) {
    await sock.sendMessage(chatJid, {
      text: 'Por segurança, envie o comando de vínculo em uma conversa privada com o bot.',
    }, { quoted: msg });
    return;
  }

  const code = String(args || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
  if (!/^[A-F\d]{12}$/.test(code)) {
    await sock.sendMessage(chatJid, {
      text: 'Código inválido. Gere um novo código na Central da conta do app e envie `!vincular CÓDIGO`.',
    }, { quoted: msg });
    return;
  }

  const apiBaseUrl = (process.env.ZECA_API_URL || 'https://zeca-jvic.onrender.com').trim().replace(/\/+$/, '');
  const secret = process.env.WHATSAPP_LINK_SECRET;
  let apiUrl;
  try {
    apiUrl = new URL(apiBaseUrl);
  } catch {
    console.error('[Vínculo WhatsApp] ZECA_API_URL inválida.');
    await sock.sendMessage(chatJid, {
      text: 'O vínculo está temporariamente indisponível. Tente novamente mais tarde.',
    }, { quoted: msg });
    return;
  }
  if (apiUrl.protocol !== 'https:' || !secret || secret.length < 32) {
    console.error('[Vínculo WhatsApp] Configure ZECA_API_URL HTTPS e WHATSAPP_LINK_SECRET.');
    await sock.sendMessage(chatJid, {
      text: 'O vínculo está temporariamente indisponível. Tente novamente mais tarde.',
    }, { quoted: msg });
    return;
  }

  let jid = normalizarJid(senderJid || chatJid);
  if (jid.endsWith('@lid')) {
    const alternativePn = normalizarJid(
      msg.key?.participantPn || msg.key?.remoteJidPn || msg.key?.participantAlt || msg.key?.remoteJidAlt || '',
    );
    if (alternativePn.endsWith('@s.whatsapp.net')) {
      jid = alternativePn;
    } else {
      try {
        const mapping = await LidMapping.findOne({ lid: jid }).select('pn').lean();
        if (mapping?.pn) jid = normalizarJid(mapping.pn);
      } catch (error) {
        console.error('[Vínculo WhatsApp] Falha ao resolver a identidade do remetente:', error.message);
        await sock.sendMessage(chatJid, {
          text: 'Não consegui confirmar sua conta do WhatsApp agora. Tente novamente em instantes.',
        }, { quoted: msg });
        return;
      }
    }
  }
  const timestamp = String(Date.now());
  const payload = `${timestamp}\n${jid}\n${code}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    await axios.post(
      `${apiBaseUrl}/whatsapp/link/complete`,
      { code, jid },
      {
        timeout: 12_000,
        headers: {
          'x-link-timestamp': timestamp,
          'x-link-signature': signature,
        },
      },
    );
    await sock.sendMessage(chatJid, {
      text: '✅ Conta vinculada com sucesso! Você já pode voltar ao app e atualizar a Central da conta.',
    }, { quoted: msg });
  } catch (error) {
    const message = error.response?.data?.error?.message;
    if (!message) console.error('[Vínculo WhatsApp] Falha ao concluir solicitação:', error.message);
    await sock.sendMessage(chatJid, {
      text: message || 'Não consegui concluir o vínculo agora. Confira sua conexão e tente novamente.',
    }, { quoted: msg });
  }
}

module.exports = { handleAppLink };
