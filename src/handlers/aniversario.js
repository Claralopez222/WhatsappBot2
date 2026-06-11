/**
 * Handler de Aniversários
 * Comandos: !reganiversario, !excluiraniversario, !meuaniversario,
 *           !listaniversarios, !sistemaniversario, !menuaniversario
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '../../data.json');

function loadBirthdays() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return data.birthdays || {};
    }
  } catch (e) { console.log('⚠️ Erro ao carregar aniversários:', e.message); }
  return {};
}

function saveBirthdays(birthdays) {
  try {
    const data = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    data.birthdays = birthdays;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.log('⚠️ Erro ao salvar aniversários:', e.message); }
}

// ─── !reganiversario ──────────────────────────────────────────────────────────
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// !reganiversario
async function handleRegAniversario(sock, msg, jid, caption, author, senderJid) {
  // ── Normaliza o ID de quem enviou o comando ──
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid = jidNormalizedUser(jid);

  const dateStr = caption.replace(/^[!.]reganiversario\s*/i, '').trim();
  
  if (!dateStr) {
    await sock.sendMessage(chatJid, { text: '⚠️ Use: *!reganiversario DD/MM/AAAA*\nExemplo: *!reganiversario 20/01/1997*' }, { quoted: msg });
    return;
  }

  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!dateRegex.test(dateStr)) {
    await sock.sendMessage(chatJid, { text: '⚠️ Formato inválido! Use: *DD/MM/AAAA*\nExemplo: *20/01/1997*' }, { quoted: msg });
    return;
  }

  const [, day, month, year] = dateStr.match(dateRegex);
  const dayNum = parseInt(day);
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  // Validar data real no calendário
  const testDate = new Date(yearNum, monthNum - 1, dayNum);
  if (testDate.getDate() !== dayNum || testDate.getMonth() !== monthNum - 1) {
    await sock.sendMessage(chatJid, { text: '⚠️ Data inválida! Verifique dia/mês/ano.' }, { quoted: msg });
    return;
  }

  // Validação dinâmica do ano com base no ano atual (2026)
  if (yearNum < 1900 || yearNum > 2026) {
    await sock.sendMessage(chatJid, { text: '⚠️ Ano deve estar entre 1900 e 2026.' }, { quoted: msg });
    return;
  }

  // Salva no JSON usando a chave normalizada pura
  const birthdays = loadBirthdays();
  birthdays[senderJidNormalizado] = { date: dateStr, name: author, jid: senderJidNormalizado };
  saveBirthdays(birthdays);

  // Calcula a idade com base no ano vigente (2026)
  const age = 2026 - yearNum;
  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;

  await sock.sendMessage(chatJid, { 
    text: `✅ Aniversário registrado!\n🎂 ${tagAuthor} faz aniversário em *${day}/${month}*\n📅 Idade: *${age} anos* em 2026`,
    mentions: [senderJidNormalizado]
  }, { quoted: msg });
}

// !excluiraniversario
async function handleExcluirAniversario(sock, msg, jid, author, senderJid) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid = jidNormalizedUser(jid);
  
  const birthdays = loadBirthdays();
  
  if (!birthdays[senderJidNormalizado]) {
    await sock.sendMessage(chatJid, { text: '⚠️ Você não tem nenhum aniversário registrado.' }, { quoted: msg });
    return;
  }

  delete birthdays[senderJidNormalizado];
  saveBirthdays(birthdays);
  
  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;

  await sock.sendMessage(chatJid, { 
    text: `✅ O aniversário de ${tagAuthor} foi removido com sucesso!`,
    mentions: [senderJidNormalizado]
  }, { quoted: msg });
}

// ─── !meuaniversario ──────────────────────────────────────────────────────────
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// !meuaniversario
async function handleMeuAniversario(sock, msg, jid, author, senderJid) {
  const senderJidNormalizado = jidNormalizedUser(senderJid);
  const chatJid = jidNormalizedUser(jid);
  const birthdays = loadBirthdays();
  
  if (!birthdays[senderJidNormalizado]) {
    await sock.sendMessage(chatJid, { text: '⚠️ Você não tem aniversário registrado. Use: *!reganiversario DD/MM/AAAA*' }, { quoted: msg });
    return;
  }

  const { date } = birthdays[senderJidNormalizado];
  const [day, month, year] = date.split('/');
  const age = 2026 - parseInt(year);
  const tagAuthor = `@${senderJidNormalizado.split('@')[0]}`;
  
  await sock.sendMessage(chatJid, { 
    text: `🎂 ${tagAuthor}\n📅 Data: *${day}/${month}/${year}*\n📊 Idade: *${age} anos* em 2026`,
    mentions: [senderJidNormalizado]
  }, { quoted: msg });
}

// !listaniversarios
async function handleListAniversarios(sock, msg, jid) {
  const chatJid = jidNormalizedUser(jid);
  const birthdays = loadBirthdays();
  const list = Object.values(birthdays);

  if (list.length === 0) {
    await sock.sendMessage(chatJid, { text: '📋 Nenhum aniversário registrado ainda.' }, { quoted: msg });
    return;
  }

  // Ordenar do mais velho pro mais novo (por data de nascimento)
  list.sort((a, b) => {
    const yearA = parseInt(a.date.split('/')[2]);
    const yearB = parseInt(b.date.split('/')[2]);
    return yearA - yearB;
  });

  let texto = `📅 *LISTA DE ANIVERSÁRIOS* 📅\n\n`;
  const mentions = [];

  for (const entry of list) {
    const [day, month, year] = entry.date.split('/');
    const age = 2026 - parseInt(year);
    
    if (entry.jid) {
      const jidLimpo = jidNormalizedUser(entry.jid);
      mentions.push(jidLimpo);
      texto += `🎂 @${jidLimpo.split('@')[0]} • ${day}/${month}/${year} (${age} anos)\n`;
    } else {
      texto += `🎂 *${entry.name}* • ${day}/${month}/${year} (${age} anos)\n`;
    }
  }

  texto += `\n📊 Total: *${list.length}* aniversários registrados`;
  
  await sock.sendMessage(chatJid, { text: texto, mentions }, { quoted: msg });
}

// !sistemaniversario
async function handleSistemaAniversario(sock, msg, jid, isGroupAdmin) {
  const chatJid = jidNormalizedUser(jid);

  if (!isGroupAdmin) {
    await sock.sendMessage(chatJid, { text: '⚠️ Apenas admins podem usar esse comando.' }, { quoted: msg });
    return;
  }

  try {
    const data = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    data.groupConfig = data.groupConfig || {};
    data.groupConfig.birthdaySystem = data.groupConfig.birthdaySystem || {};
    
    const isActive = data.groupConfig.birthdaySystem[chatJid];
    data.groupConfig.birthdaySystem[chatJid] = !isActive;
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    
    const status = !isActive ? '✅ ativado' : '❌ desativado';
    await sock.sendMessage(chatJid, { text: `🔧 Sistema de aniversários ${status} para esse grupo!` }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao alterar configuração do sistema de aniversário:', e.message);
    await sock.sendMessage(chatJid, { text: '❌ Erro ao alterar configuração local no arquivo.' }, { quoted: msg });
  }
}

// ─── !menuaniversario ─────────────────────────────────────────────────────────
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// !menuaniversario
async function handleMenuAniversario(sock, msg, jid, getPrefix) {
  // ── Normaliza o ID do chat de forma segura ──
  const chatJid = jidNormalizedUser(jid);
  const P = getPrefix(chatJid);
  
  const menu = `╭━━━━━━━━━━━━━━━━━╮
│  🎂 *MENU DE ANIVERSÁRIOS* 🎂
│
│ 📝 **REGISTRO:**
│ ▸ ${P}reganiversario [DD/MM/AAAA]
│    Exemplo: ${P}reganiversario 20/01/1997
│ ▸ ${P}excluiraniversario — Remover
│
│ 📊 **CONSULTAS:**
│ ▸ ${P}meuaniversario — Ver sua data
│ ▸ ${P}listaniversarios — Listar todos
│
│ ⚙️ **SISTEMA:**
│ ▸ ${P}sistemaniversario — Ativar/desativar
│    (apenas admin)
│
│ 🎉 **FUNCIONAMENTO:**
│ • Bot parabeniza automaticamente
│ • Mostra idade e mensagem especial
│ • Qualquer membro pode registrar
│ • Data entre 1900 e 2026
│
╰━━━━━⊰ ✧ ⊱━━━━━╯`;

  await sock.sendMessage(chatJid, { text: menu }, { quoted: msg });
  console.log('🎂 Menu aniversários enviado com sucesso');
}

module.exports = {
  handleRegAniversario,
  handleExcluirAniversario,
  handleMeuAniversario,
  handleListAniversarios,
  handleSistemaAniversario,
  handleMenuAniversario,
};
