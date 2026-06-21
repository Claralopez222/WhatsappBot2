'use strict';

const crypto    = require('crypto');
const AuthToken = require('../models/AuthToken');
const Usuario   = require('../models/Usuario');
const { normalizarJid } = require('../utils/jid');

const PAINEL_URL = 'https://piroquinhasbot.github.io/painel-piroquinhas/perfil.html';

async function handleMeuPainel(sock, msg, jid) {
  try {
    const remetente = msg.key.participant || msg.key.remoteJid;
    const senderJid  = normalizarJid(remetente);
    if (!senderJid) return;

    const usuario = await Usuario.findOne({ idWhatsApp: senderJid });

    if (!usuario) {
      await sock.sendMessage(senderJid, {
        text: '❌ Você ainda não tem perfil registrado. Mande uma mensagem no grupo primeiro!',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');

    await AuthToken.create({
      telefone:   usuario.telefone || senderJid.split('@')[0],
      idWhatsApp: senderJid,
      token,
      expiresAt:  new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const link = `${PAINEL_URL}?token=${token}`;

    await sock.sendMessage(senderJid, {
      text:
        `🔐 *Seu link de acesso ao Painel Piroquinhas*\n\n` +
        `${link}\n\n` +
        `⏱ Válido por *24 horas* e de uso único.\n` +
        `⚠️ Não compartilhe este link com ninguém!`,
    });

    if (jid !== senderJid) {
      await sock.sendMessage(jid, {
        text: `✅ @${senderJid.split('@')[0]}, te enviei o link no privado! 🔐`,
        mentions: [senderJid],
      });
    }

  } catch (err) {
    console.error('[painel] Erro ao gerar token:', err);
    await sock.sendMessage(jid, {
      text: '❌ Erro ao gerar o link do painel. Tenta de novo em instantes.',
    }).catch(() => {});
  }
}

module.exports = { handleMeuPainel };