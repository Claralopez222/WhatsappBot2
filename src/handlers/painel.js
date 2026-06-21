'use strict';

const crypto    = require('crypto');
const AuthToken = require('../models/AuthToken');
const Usuario   = require('../models/Usuario');

const PAINEL_URL = 'https://piroquinhasbot.github.io/painel-piroquinhas';

async function handleMeuPainel(sock, msg, jidUsuario) {
  try {
    const usuario = await Usuario.findOne({ idWhatsApp: jidUsuario });

    if (!usuario) {
      await sock.sendMessage(jidUsuario, {
        text: '❌ Você ainda não tem perfil registrado. Mande uma mensagem no grupo primeiro!',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');

    await AuthToken.create({
      telefone:   usuario.telefone || jidUsuario.split('@')[0],
      idWhatsApp: jidUsuario,
      token,
      expiresAt:  new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const link = `${PAINEL_URL}?token=${token}`;

    const jidPrivado = jidUsuario.includes('@g.us')
      ? msg.key.participant
      : jidUsuario;

    await sock.sendMessage(jidPrivado, {
      text:
        `🔐 *Seu link de acesso ao Painel Piroquinhas*\n\n` +
        `${link}\n\n` +
        `⏱ Válido por *24 horas* e de uso único.\n` +
        `⚠️ Não compartilhe este link com ninguém!`,
    });

    if (msg.key.remoteJid !== jidPrivado) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `✅ @${jidPrivado.split('@')[0]}, te enviei o link no privado! 🔐`,
        mentions: [jidPrivado],
      });
    }

  } catch (err) {
    console.error('[painel] Erro ao gerar token:', err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Erro ao gerar o link do painel. Tenta de novo em instantes.',
    });
  }
}

module.exports = { handleMeuPainel };
