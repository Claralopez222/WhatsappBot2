/**
 * Handler de Aniversários
 * Comandos: !reganiversario, !excluiraniversario, !meuaniversario,
 *           !listaniversarios, !sistemaniversario, !menuaniversario
 */

const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const Aniversario = require('../models/Aniversario');
const GrupoConfig = require('../models/GrupoConfig');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnoAtual() {
  return new Date().getFullYear();
}

function calcularIdade(yearNum) {
  return getAnoAtual() - yearNum;
}

function validarData(dateStr) {
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(dateRegex);
  if (!match) return null;

  const [, day, month, year] = match;
  const dayNum   = parseInt(day);
  const monthNum = parseInt(month);
  const yearNum  = parseInt(year);

  const testDate = new Date(yearNum, monthNum - 1, dayNum);
  if (testDate.getDate() !== dayNum || testDate.getMonth() !== monthNum - 1) return null;
  if (yearNum < 1900 || yearNum > getAnoAtual()) return null;

  return { day, month, year, dayNum, monthNum, yearNum };
}

function reply(sock, chatJid, msg, text, extra = {}) {
  return sock.sendMessage(chatJid, { text, ...extra }, { quoted: msg });
}

// ─── !reganiversario ──────────────────────────────────────────────────────────

async function handleRegAniversario(sock, msg, jid, caption, author, senderJid) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid              = jidNormalizedUser(jid);

  const dateStr = caption.replace(/^[!.,/]reganiversario\s*/i, '').trim();

  if (!dateStr) {
    return reply(sock, chatJid, msg,
      '⚠️ Use: *!reganiversario DD/MM/AAAA*\nExemplo: *!reganiversario 20/01/1997*'
    );
  }

  const parsed = validarData(dateStr);
  if (!parsed) {
    return reply(sock, chatJid, msg,
      `⚠️ Data inválida! Use o formato *DD/MM/AAAA* com um ano entre 1900 e ${getAnoAtual()}.`
    );
  }

  const { day, month, yearNum } = parsed;

  try {
    await Aniversario.findOneAndUpdate(
      { idWhatsApp: senderJidNormalizado },
      { idWhatsApp: senderJidNormalizado, nome: author, date: dateStr },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao salvar aniversário:', e.message);
    return reply(sock, chatJid, msg, '❌ Erro ao salvar aniversário. Tente novamente!');
  }

  const age       = calcularIdade(yearNum);
  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;

  return reply(sock, chatJid, msg,
    `✅ *Aniversário registrado!*\n\n` +
    `🎂 ${tagAuthor} faz aniversário em *${day}/${month}*\n` +
    `📅 Idade: *${age} anos* em ${getAnoAtual()}`,
    { mentions: [senderJidNormalizado] }
  );
}

// ─── !excluiraniversario ──────────────────────────────────────────────────────

async function handleExcluirAniversario(sock, msg, jid, author, senderJid) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid              = jidNormalizedUser(jid);

  let deletado;
  try {
    deletado = await Aniversario.findOneAndDelete({ idWhatsApp: senderJidNormalizado });
  } catch (e) {
    console.error('⚠️ Erro ao excluir aniversário:', e.message);
    return reply(sock, chatJid, msg, '❌ Erro ao excluir aniversário. Tente novamente!');
  }

  if (!deletado) {
    return reply(sock, chatJid, msg, '⚠️ Você não tem nenhum aniversário registrado.');
  }

  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;
  return reply(sock, chatJid, msg,
    `✅ O aniversário de ${tagAuthor} foi removido com sucesso!`,
    { mentions: [senderJidNormalizado] }
  );
}

// ─── !meuaniversario ──────────────────────────────────────────────────────────

async function handleMeuAniversario(sock, msg, jid, author, senderJid) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid              = jidNormalizedUser(jid);

  let entry;
  try {
    entry = await Aniversario.findOne({ idWhatsApp: senderJidNormalizado }).lean();
  } catch (e) {
    console.error('⚠️ Erro ao buscar aniversário:', e.message);
    return reply(sock, chatJid, msg, '❌ Erro ao buscar seu aniversário. Tente novamente!');
  }

  if (!entry) {
    return reply(sock, chatJid, msg,
      '⚠️ Você não tem aniversário registrado.\nUse: *!reganiversario DD/MM/AAAA*'
    );
  }

  const [day, month, year] = entry.date.split('/');
  const age       = calcularIdade(parseInt(year));
  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;

  return reply(sock, chatJid, msg,
    `🎂 ${tagAuthor}\n📅 Data: *${day}/${month}/${year}*\n📊 Idade: *${age} anos* em ${getAnoAtual()}`,
    { mentions: [senderJidNormalizado] }
  );
}

// ─── !listaniversarios ────────────────────────────────────────────────────────

async function handleListAniversarios(sock, msg, jid) {
  const chatJid = jidNormalizedUser(jid);

  let list;
  try {
    list = await Aniversario.find().lean();
  } catch (e) {
    console.error('⚠️ Erro ao listar aniversários:', e.message);
    return reply(sock, chatJid, msg, '❌ Erro ao carregar lista. Tente novamente!');
  }

  if (!list.length) {
    return reply(sock, chatJid, msg, '📋 Nenhum aniversário registrado ainda.');
  }

  // Ordena por ano de nascimento (mais velho → mais novo)
  list.sort((a, b) => parseInt(a.date.split('/')[2]) - parseInt(b.date.split('/')[2]));

  const mentions = [];
  let texto = `📅 *LISTA DE ANIVERSÁRIOS* 📅\n━━━━━━━━━━━━━━━━\n\n`;

  for (const entry of list) {
    const [day, month, year] = entry.date.split('/');
    const age      = calcularIdade(parseInt(year));
    const jidLimpo = jidNormalizedUser(entry.idWhatsApp);
    mentions.push(jidLimpo);
    texto += `🎂 @${jidLimpo.split('@')[0]} • *${day}/${month}/${year}* (${age} anos)\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n📊 Total: *${list.length}* aniversário(s) registrado(s)`;

  return reply(sock, chatJid, msg, texto, { mentions });
}

// ─── !sistemaniversario ───────────────────────────────────────────────────────

async function handleSistemaAniversario(sock, msg, jid, isGroupAdmin) {
  const chatJid = jidNormalizedUser(jid);

  if (!isGroupAdmin) {
    return reply(sock, chatJid, msg, '⚠️ Apenas admins podem usar esse comando.');
  }

  try {
    const config = await GrupoConfig.findOneAndUpdate(
      { idGrupo: chatJid },
      [{ $set: { sistemaAniversario: { $not: '$sistemaAniversario' } } }],
      { new: true, upsert: true }
    );

    const status = config.sistemaAniversario ? '✅ ativado' : '❌ desativado';
    return reply(sock, chatJid, msg, `🔧 Sistema de aniversários ${status} para esse grupo!`);
  } catch (e) {
    console.error('⚠️ Erro ao alterar sistema de aniversário:', e.message);
    return reply(sock, chatJid, msg, '❌ Erro ao alterar configuração. Tente novamente!');
  }
}

// ─── !menuaniversario ─────────────────────────────────────────────────────────

async function handleMenuAniversario(sock, msg, jid, getPrefix) {
  const chatJid = jidNormalizedUser(jid);
  const P       = typeof getPrefix === 'function' ? getPrefix(chatJid) : '!';

  const menu =
    `╭━━━━━━━━━━━━━━━━━╮\n` +
    `│  🎂 *MENU DE ANIVERSÁRIOS* 🎂\n` +
    `│\n` +
    `│ 📝 *REGISTRO:*\n` +
    `│ ▸ ${P}reganiversario [DD/MM/AAAA]\n` +
    `│    Exemplo: ${P}reganiversario 20/01/1997\n` +
    `│ ▸ ${P}excluiraniversario — Remover\n` +
    `│\n` +
    `│ 📊 *CONSULTAS:*\n` +
    `│ ▸ ${P}meuaniversario — Ver sua data\n` +
    `│ ▸ ${P}listaniversarios — Listar todos\n` +
    `│\n` +
    `│ ⚙️ *SISTEMA:*\n` +
    `│ ▸ ${P}sistemaniversario — Ativar/desativar\n` +
    `│    (apenas admin)\n` +
    `│\n` +
    `│ 🎉 *FUNCIONAMENTO:*\n` +
    `│ • Bot parabeniza automaticamente\n` +
    `│ • Mostra idade e mensagem especial\n` +
    `│ • Qualquer membro pode registrar\n` +
    `│ • Data entre 1900 e ${getAnoAtual()}\n` +
    `│\n` +
    `╰━━━━━⊰ ✧ ⊱━━━━━╯`;

  return reply(sock, chatJid, msg, menu);
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleRegAniversario,
  handleExcluirAniversario,
  handleMeuAniversario,
  handleListAniversarios,
  handleSistemaAniversario,
  handleMenuAniversario,
};