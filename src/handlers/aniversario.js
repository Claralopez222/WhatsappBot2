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
async function handleRegAniversario(sock, msg, jid, caption, author, senderJid) {
  const dateStr = caption.replace(/^[!.]reganiversario\s*/i, '').trim();
  
  if (!dateStr) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!reganiversario DD/MM/AAAA*\nExemplo: *!reganiversario 20/01/1997*' }, { quoted: msg });
    return;
  }

  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!dateRegex.test(dateStr)) {
    await sock.sendMessage(jid, { text: '⚠️ Formato inválido! Use: *DD/MM/AAAA*\nExemplo: *20/01/1997*' }, { quoted: msg });
    return;
  }

  const [, day, month, year] = dateStr.match(dateRegex);
  const dayNum = parseInt(day);
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  // Validar data
  const testDate = new Date(yearNum, monthNum - 1, dayNum);
  if (testDate.getDate() !== dayNum || testDate.getMonth() !== monthNum - 1) {
    await sock.sendMessage(jid, { text: '⚠️ Data inválida! Verifique dia/mês/ano.' }, { quoted: msg });
    return;
  }

  if (yearNum < 1900 || yearNum > 2026) {
    await sock.sendMessage(jid, { text: '⚠️ Ano deve estar entre 1900 e 2026.' }, { quoted: msg });
    return;
  }

  const birthdays = loadBirthdays();
  birthdays[senderJid] = { date: dateStr, name: author, jid: senderJid };
  saveBirthdays(birthdays);

  const age = 2026 - yearNum;
  await sock.sendMessage(jid, { text: `✅ Aniversário registrado!\n🎂 *${author}* faz aniversário em *${day}/${month}*\n📅 Idade: *${age} anos* em 2026` }, { quoted: msg });
}

// ─── !excluiraniversario ──────────────────────────────────────────────────────
async function handleExcluirAniversario(sock, msg, jid, author, senderJid) {
  const birthdays = loadBirthdays();
  
  if (!birthdays[senderJid]) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem aniversário registrado.' }, { quoted: msg });
    return;
  }

  delete birthdays[senderJid];
  saveBirthdays(birthdays);
  
  await sock.sendMessage(jid, { text: `✅ Aniversário de *${author}* foi removido!` }, { quoted: msg });
}

// ─── !meuaniversario ──────────────────────────────────────────────────────────
async function handleMeuAniversario(sock, msg, jid, author, senderJid) {
  const birthdays = loadBirthdays();
  
  if (!birthdays[senderJid]) {
    await sock.sendMessage(jid, { text: '⚠️ Você não tem aniversário registrado. Use: *!reganiversario DD/MM/AAAA*' }, { quoted: msg });
    return;
  }

  const { date, name } = birthdays[senderJid];
  const [day, month, year] = date.split('/');
  const age = 2026 - parseInt(year);
  
  await sock.sendMessage(jid, { text: `🎂 *${name}*\n📅 Data: *${day}/${month}/${year}*\n📊 Idade: *${age} anos* em 2026` }, { quoted: msg });
}

// ─── !listaniversarios ────────────────────────────────────────────────────────
async function handleListAniversarios(sock, msg, jid) {
  const birthdays = loadBirthdays();
  const list = Object.values(birthdays);

  if (list.length === 0) {
    await sock.sendMessage(jid, { text: '📋 Nenhum aniversário registrado ainda.' }, { quoted: msg });
    return;
  }

  // Ordenar do mais velho pro mais novo (por data de nascimento)
  list.sort((a, b) => {
    const yearA = parseInt(a.date.split('/')[2]);
    const yearB = parseInt(b.date.split('/')[2]);
    return yearA - yearB;
  });

  let texto = `📅 *LISTA DE ANIVERSÁRIOS* 📅\n\n`;
  for (const entry of list) {
    const [day, month, year] = entry.date.split('/');
    const age = 2026 - parseInt(year);
    texto += `🎂 *${entry.name}* • ${day}/${month}/${year} (${age} anos)\n`;
  }

  texto += `\n📊 Total: *${list.length}* aniversários registrados`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !sistemaniversario ───────────────────────────────────────────────────────
async function handleSistemaAniversario(sock, msg, jid, isGroupAdmin) {
  if (!isGroupAdmin) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas admins podem usar esse comando.' }, { quoted: msg });
    return;
  }

  try {
    const data = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};
    data.groupConfig = data.groupConfig || {};
    data.groupConfig.birthdaySystem = data.groupConfig.birthdaySystem || {};
    
    const isActive = data.groupConfig.birthdaySystem[jid];
    data.groupConfig.birthdaySystem[jid] = !isActive;
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    
    const status = !isActive ? '✅ ativado' : '❌ desativado';
    await sock.sendMessage(jid, { text: `🔧 Sistema de aniversários ${status} para esse grupo!` }, { quoted: msg });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao alterar configuração.' }, { quoted: msg });
  }
}

// ─── !menuaniversario ─────────────────────────────────────────────────────────
async function handleMenuAniversario(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
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

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('🎂 Menu aniversários enviado');
}

module.exports = {
  handleRegAniversario,
  handleExcluirAniversario,
  handleMeuAniversario,
  handleListAniversarios,
  handleSistemaAniversario,
  handleMenuAniversario,
};
