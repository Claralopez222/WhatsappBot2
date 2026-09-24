'use strict';

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// Itens de casal que podem ser EQUIPADOS (cada um é seu próprio "slot")
const ACESSORIOS_CASAL = {
  anel:          { nome: 'Anel',           emoji: '💍' },
  colar:         { nome: 'Colar Casal',    emoji: '📿' },
  pulseira:      { nome: 'Pulseira Casal', emoji: '💫' },
  camisetacasal: { nome: 'Camiseta Casal', emoji: '👕' },
  gorro:         { nome: 'Gorro Casal',    emoji: '🧢' },
  chinelo:       { nome: 'Chinelo de Casal', emoji: '🩴' },
};

/**
 * Equipa ou desequipa um acessório de casal.
 * Retorna `true` se o comando foi tratado (item válido), ou `false`
 * se o itemKey não corresponde a nenhum acessório (deixa o roteador
 * seguir para outros handlers).
 */
async function handleEquiparAcessorio(sock, msg, jid, senderJid, itemKey) {
  const item = ACESSORIOS_CASAL[itemKey];
  if (!item) return false; // não é um acessório de casal, ignora

  // Mesma normalização usada em relacionamento.js — evita que o mesmo
  // usuário acabe com dois documentos Usuario diferentes.
  const senderJidNorm = jidNormalizedUser(senderJid);

  try {
    const userData = await Usuario.findOne({ idWhatsApp: senderJidNorm }).lean();

    // ── Verifica se o usuário possui o item no inventário ──
    const possui = (userData?.inventory?.[itemKey] || 0) > 0;
    if (!possui) {
      await sock.sendMessage(jid, {
        text:
          `❌ Você não possui *${item.nome}* ${item.emoji} no seu inventário!\n\n` +
          `Compre na *!lojacasal* para poder equipar.`,
      }, { quoted: msg });
      return true;
    }

    // ── Alterna o estado de equipado ──
    const equipadoAtual = userData?.acessoriosCasal?.[itemKey] || false;
    const novoEstado = !equipadoAtual;

    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJidNorm },
      { $set: { [`acessoriosCasal.${itemKey}`]: novoEstado } },
      { upsert: true }
    );

    const acaoTexto = novoEstado ? 'equipou' : 'desequipou';
    await sock.sendMessage(jid, {
      text:
        `${item.emoji} Você ${acaoTexto} *${item.nome}*!\n\n` +
        `Use *!perfil* para ver seus acessórios equipados.`,
    }, { quoted: msg });
    return true;

  } catch (e) {
    console.error('[handleEquiparAcessorio] Erro:', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao equipar/desequipar acessório. Tente novamente.',
    }, { quoted: msg });
    return true;
  }
}

module.exports = { ACESSORIOS_CASAL, handleEquiparAcessorio };