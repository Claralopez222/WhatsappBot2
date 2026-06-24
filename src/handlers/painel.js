'use strict';

const Usuario = require('../models/Usuario');
const { normalizarJid } = require('../utils/jid');

const PAINEL_URL = 'https://piroquinhasbot.github.io/painel-piroquinhas/perfil.html';

async function handleMeuPainel(sock, msg, jid) {
  try {
    const remetente = msg.key.participant || msg.key.remoteJid;
    const senderJid = normalizarJid(remetente);
    if (!senderJid) return;

    const usuario = await Usuario.findOne({ idWhatsApp: senderJid }).lean();

    if (!usuario) {
      await sock.sendMessage(jid, {
        text: `❌ @${senderJid.split('@')[0]}, você ainda não tem perfil registrado. Mande uma mensagem no grupo primeiro!`,
        mentions: [senderJid],
      });
      return;
    }

    // Verifica se já tem conta criada no painel
    const temConta = !!(usuario.username && usuario.passwordHash);

    if (temConta) {
      await sock.sendMessage(jid, {
        text:
          `🔐 @${senderJid.split('@')[0]}, acesse o painel com seu usuário e senha:\n\n` +
          `🌐 ${PAINEL_URL}\n\n` +
          `👤 Usuário: *${usuario.username}*\n` +
          `🔑 Senha: a que você cadastrou\n\n` +
          `_Esqueceu a senha? Use !resetsenha no grupo._`,
        mentions: [senderJid],
      });
    } else {
      await sock.sendMessage(jid, {
        text:
          `🔐 @${senderJid.split('@')[0]}, acesse o painel e crie sua conta:\n\n` +
          `🌐 ${PAINEL_URL}\n\n` +
          `_Na primeira vez, clique em "Criar conta" e registre seu usuário e senha._\n` +
          `_Seu WhatsApp será vinculado automaticamente._`,
        mentions: [senderJid],
      });
    }

  } catch (err) {
    console.error('[painel] Erro ao processar !meupainel:', err);
    await sock.sendMessage(jid, {
      text: '❌ Erro ao acessar o painel. Tenta de novo em instantes.',
    }).catch(() => {});
  }
}

module.exports = { handleMeuPainel };