/**
 * Sistema de Roubo — Piroquinhas Bot
 * Comandos: !menuroubar, !roubar, !menusec, !equiparroubo, !equiparsec
 *           !meusitensroubo, !meussec, !meiosec, !comprarroubo, !comprarsec
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { prepareDailyMissionState, incrementMission } = require('./missoes');

// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────

const COOLDOWN_ROUBO_MS  = 30 * 60 * 1000; // 30 minutos
const TAXA_SUCESSO_BASE  = 50;              // 50% sem nenhum item
const TAXA_MIN           = 5;              // nunca abaixo de 5%
const TAXA_MAX           = 95;             // nunca acima de 95%
const ROUBO_MIN_PCT      = 30;             // rouba no mínimo 30% do gold
const ROUBO_MAX_PCT      = 100;            // rouba no máximo 100% do gold

// ─── ITENS DE ROUBO (ATAQUE) ───────────────────────────────────────────────

const ITENS_ROUBO = {
  mascara:    { nome: '🎭 Máscara',               preco: 100, bonus: 10 },
  chave:      { nome: '🔧 Chave Inglesa',          preco: 150, bonus: 20 },
  lockpick:   { nome: '🔓 Kit de Arrombamento',    preco: 200, bonus: 30 },
  corda:      { nome: '🪢 Corda Ninja',            preco: 250, bonus: 35 },
  dinamite:   { nome: '💣 Dinamite',               preco: 300, bonus: 40 },
  disfarce:   { nome: '🕵️ Disfarce Premium',       preco: 350, bonus: 45 },
  explorador: { nome: '📡 Detector de Alarmes',    preco: 400, bonus: 50 },
  cavador:    { nome: '⛏️ Picareta de Diamante',   preco: 500, bonus: 60 },
};

// ─── ITENS DE SEGURANÇA (DEFESA) ───────────────────────────────────────────

const ITENS_SEGURANCA = {
  cofre:     { nome: '🔐 Cofre Forte',           preco: 150, defesa: 15 },
  alarme:    { nome: '🚨 Sistema de Alarme',      preco: 200, defesa: 25 },
  camera:    { nome: '📹 Câmera de Vigilância',   preco: 250, defesa: 30 },
  cachorro:  { nome: '🐕 Cão de Guarda',          preco: 300, defesa: 35 },
  seguranca: { nome: '👮 Guarda de Segurança',    preco: 400, defesa: 45 },
  bunker:    { nome: '🛡️ Bunker Subterrâneo',    preco: 500, defesa: 55 },
  laser:     { nome: '🔴 Raios Laser',            preco: 600, defesa: 65 },
  militares: { nome: '🪖 Segurança Militar',      preco: 800, defesa: 80 },
};

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────

/** Retorna o userId de forma consistente */
function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

/** Lê quantidade de item suportando Map (Mongoose) e objeto plain */
function getItemQtd(mapaOuObj, chave) {
  if (!mapaOuObj) return 0;
  if (typeof mapaOuObj.get === 'function') return mapaOuObj.get(chave) || 0;
  return mapaOuObj[chave] || 0;
}

/** Formata ms restantes em "Xmin Ys" */
function formatarTempo(ms) {
  const totalSeg = Math.ceil(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  if (min > 0 && seg > 0) return `${min}min ${seg}s`;
  if (min > 0) return `${min}min`;
  return `${seg}s`;
}

/** Busca saldo atual sem lançar exceção */
async function getSaldoAtual(userId) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    return user?.gold ?? 0;
  } catch (e) {
    console.error('⚠️ Erro ao buscar saldo:', e.message);
    return 0;
  }
}

/**
 * Incrementa ou decrementa gold do usuário.
 * Atualiza missão de gold se a quantidade for positiva.
 * Garante que o gold nunca fique negativo ao debitar.
 */
async function changeGold(userId, quantidade) {
  try {
    if (quantidade > 0) {
      await prepareDailyMissionState(userId);
    }

    const query  = { idWhatsApp: userId };
    const update = { $inc: { gold: quantidade } };

    // Segurança: ao debitar, nunca deixar gold negativo
    if (quantidade < 0) {
      query.gold = { $gte: Math.abs(quantidade) };
    }

    if (quantidade > 0) {
      update.$inc['dailyMissions.progress.gold500'] = quantidade;
    }

    const user = await Usuario.findOneAndUpdate(query, update, { new: true });
    if (!user && quantidade < 0) {
      console.warn(`⚠️ changeGold: saldo insuficiente para debitar ${quantidade} de ${userId}`);
      return null; // indica falha no débito
    }

    console.log(`✅ Gold alterado: ${userId} → ${quantidade >= 0 ? '+' : ''}${quantidade} (saldo: ${user?.gold})`);
    return user?.gold ?? 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return null;
  }
}

/** Busca ou cria usuário garantindo que existe */
async function getOrCreateUser(userId) {
  let user = await Usuario.findOne({ idWhatsApp: userId });
  if (!user) {
    user = await Usuario.create({ idWhatsApp: userId, gold: 0 });
  }
  return user;
}

// ─── !menuroubar ────────────────────────────────────────────────────────────

async function handleMenuRoubo(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🎭 ═══ LOJA DE ROUBO ═══ 🎭\n\n`;
  texto += `*EQUIPAMENTOS DISPONÍVEIS:*\n`;

  for (const [key, item] of Object.entries(ITENS_ROUBO)) {
    texto += `  ${item.nome} — *${item.preco}* gold\n`;
    texto += `    └ Bônus de sucesso: *+${item.bonus}%* | chave: \`${key}\`\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMANDOS:*\n`;
  texto += `  ${P}comprarroubo <item> — Comprar item\n`;
  texto += `  ${P}equiparroubo <item> — Equipar item\n`;
  texto += `  ${P}meusitensroubo — Ver inventário de roubo\n`;
  texto += `  ${P}roubar @pessoa — Roubar alguém\n\n`;
  texto += `⚠️ *Item equipado é obrigatório para roubar!*\n`;
  texto += `⏱️ *Cooldown:* 30 minutos entre tentativas\n`;
  texto += `🎲 *Taxa base de sucesso:* ${TAXA_SUCESSO_BASE}%`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !menusec ───────────────────────────────────────────────────────────────

async function handleMenuSec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🔐 ═══ LOJA DE SEGURANÇA ═══ 🔐\n\n`;
  texto += `*EQUIPAMENTOS DE DEFESA:*\n`;

  for (const [key, item] of Object.entries(ITENS_SEGURANCA)) {
    texto += `  ${item.nome} — *${item.preco}* gold\n`;
    texto += `    └ Proteção: *+${item.defesa}%* | chave: \`${key}\`\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMANDOS:*\n`;
  texto += `  ${P}comprarsec <item> — Comprar item\n`;
  texto += `  ${P}equiparsec <item> — Equipar defesa\n`;
  texto += `  ${P}meussec — Ver inventário de segurança\n`;
  texto += `  ${P}meiosec — Ver defesa ativa\n\n`;
  texto += `🛡️ *Sem defesa equipada você tem apenas ${TAXA_SUCESSO_BASE}% de chance de resistir!*`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprarroubo ──────────────────────────────────────────────────────────

async function handleComprarRoubo(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/comprarroubo\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprarroubo <item>*\nExemplo: *!comprarroubo dinamite*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_ROUBO[itemNome];

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemNome}* não existe na loja de roubo!\nUse *!menuroubar* para ver os itens disponíveis.`
    }, { quoted: msg });
    return;
  }

  const saldoAtual = await getSaldoAtual(userId);

  if (saldoAtual < itemInfo.preco) {
    await sock.sendMessage(jid, {
      text: `❌ *SALDO INSUFICIENTE!*\n\n💵 Preço: *${itemInfo.preco}* gold\n💰 Seu saldo: *${saldoAtual}* gold\n\n_Faltam ${itemInfo.preco - saldoAtual} gold!_`
    }, { quoted: msg });
    return;
  }

  // Debitar gold ANTES de adicionar o item (evita inconsistência)
  const saldoFinal = await changeGold(userId, -itemInfo.preco);
  if (saldoFinal === null) {
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar compra! Tente novamente.' }, { quoted: msg });
    return;
  }

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`itensRoubo.${itemNome}`]: 1 } },
      { new: true, upsert: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item de roubo:', e.message);
    // Reembolsar se falhar
    await changeGold(userId, itemInfo.preco);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item! Gold reembolsado.' }, { quoted: msg });
    return;
  }

  const texto =
    `✅ *COMPRA REALIZADA!* ✅\n\n` +
    `🎭 *Item:* ${itemInfo.nome}\n` +
    `💵 *Preço:* ${itemInfo.preco} gold\n` +
    `📈 *Bônus:* +${itemInfo.bonus}% de sucesso\n` +
    `💎 *Saldo restante:* ${saldoFinal} gold\n\n` +
    `💡 Use *!equiparroubo ${itemNome}* para equipar!`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprarsec ────────────────────────────────────────────────────────────

async function handleComprarSec(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/comprarsec\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprarsec <item>*\nExemplo: *!comprarsec cofre*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_SEGURANCA[itemNome];

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemNome}* não existe na loja de segurança!\nUse *!menusec* para ver os itens disponíveis.`
    }, { quoted: msg });
    return;
  }

  const saldoAtual = await getSaldoAtual(userId);

  if (saldoAtual < itemInfo.preco) {
    await sock.sendMessage(jid, {
      text: `❌ *SALDO INSUFICIENTE!*\n\n💵 Preço: *${itemInfo.preco}* gold\n💰 Seu saldo: *${saldoAtual}* gold\n\n_Faltam ${itemInfo.preco - saldoAtual} gold!_`
    }, { quoted: msg });
    return;
  }

  // Debitar gold ANTES de adicionar o item
  const saldoFinal = await changeGold(userId, -itemInfo.preco);
  if (saldoFinal === null) {
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar compra! Tente novamente.' }, { quoted: msg });
    return;
  }

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`itensSec.${itemNome}`]: 1 } },
      { new: true, upsert: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item de segurança:', e.message);
    await changeGold(userId, itemInfo.preco);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item! Gold reembolsado.' }, { quoted: msg });
    return;
  }

  const texto =
    `✅ *COMPRA REALIZADA!* ✅\n\n` +
    `🔐 *Item:* ${itemInfo.nome}\n` +
    `💵 *Preço:* ${itemInfo.preco} gold\n` +
    `🛡️ *Proteção:* +${itemInfo.defesa}%\n` +
    `💎 *Saldo restante:* ${saldoFinal} gold\n\n` +
    `💡 Use *!equiparsec ${itemNome}* para ativar!`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !equiparroubo ──────────────────────────────────────────────────────────

async function handleEquiparRoubo(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/equiparroubo\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!equiparroubo <item>*\nExemplo: *!equiparroubo dinamite*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();

  if (!ITENS_ROUBO[itemNome]) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemNome}* não existe!\nUse *!menuroubar* para ver os itens disponíveis.`
    }, { quoted: msg });
    return;
  }

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    const qtd = getItemQtd(user.itensRoubo, itemNome);

    if (qtd <= 0) {
      await sock.sendMessage(jid, {
        text: `❌ Você não possui *${ITENS_ROUBO[itemNome].nome}*!\n\n🛒 Compre com *!comprarroubo ${itemNome}*`
      }, { quoted: msg });
      return;
    }

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { equiparoubo: itemNome } }
    );

    const item = ITENS_ROUBO[itemNome];
    const taxaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + item.bonus);

    const texto =
      `✅ *ITEM EQUIPADO!* ✅\n\n` +
      `🎭 *Item:* ${item.nome}\n` +
      `📈 *Bônus de sucesso:* +${item.bonus}%\n` +
      `🎲 *Taxa com este item:* até *${taxaFinal}%*\n` +
      `🎒 *No inventário:* ${qtd}x\n\n` +
      `🔫 Agora use *!roubar @pessoa* para atacar!`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao equipar item de roubo:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao equipar item!' }, { quoted: msg });
  }
}

// ─── !equiparsec ────────────────────────────────────────────────────────────

async function handleEquiparSec(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/equiparsec\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!equiparsec <item>*\nExemplo: *!equiparsec cofre*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();

  if (!ITENS_SEGURANCA[itemNome]) {
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemNome}* não existe!\nUse *!menusec* para ver os itens disponíveis.`
    }, { quoted: msg });
    return;
  }

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    const qtd = getItemQtd(user.itensSec, itemNome);

    if (qtd <= 0) {
      await sock.sendMessage(jid, {
        text: `❌ Você não possui *${ITENS_SEGURANCA[itemNome].nome}*!\n\n🛒 Compre com *!comprarsec ${itemNome}*`
      }, { quoted: msg });
      return;
    }

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { equiparsec: itemNome } }
    );

    const item = ITENS_SEGURANCA[itemNome];
    const defesaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + item.defesa);

    const texto =
      `✅ *DEFESA ATIVADA!* ✅\n\n` +
      `🔐 *Item:* ${item.nome}\n` +
      `🛡️ *Proteção:* +${item.defesa}%\n` +
      `🔒 *Chance de resistir:* até *${defesaFinal}%*\n` +
      `🎒 *No inventário:* ${qtd}x`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao equipar item de segurança:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao equipar item!' }, { quoted: msg });
  }
}

// ─── !meusitensroubo ────────────────────────────────────────────────────────

async function handleMeusItensRoubo(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    let texto  = `🎒 ═══ SEUS ITENS DE ROUBO ═══ 🎒\n\n`;
    let temItem = false;

    for (const [key, item] of Object.entries(ITENS_ROUBO)) {
      const qtd = getItemQtd(user.itensRoubo, key);
      if (qtd > 0) {
        temItem = true;
        const equipado = user.equiparoubo === key ? ' ⚡ *EQUIPADO*' : '';
        texto += `  ${item.nome}${equipado}\n`;
        texto += `    └ Qtd: *${qtd}x* | Bônus: *+${item.bonus}%*\n`;
      }
    }

    if (!temItem) {
      texto += `😔 Você não possui nenhum item de roubo.\n\n🛒 Compre com *!menuroubar*!`;
    } else {
      texto += `\n━━━━━━━━━━━━━━━━\n`;
      if (user.equiparoubo && ITENS_ROUBO[user.equiparoubo]) {
        const eq = ITENS_ROUBO[user.equiparoubo];
        texto += `⚡ *Equipado:* ${eq.nome}\n`;
        texto += `📈 *Bônus ativo:* +${eq.bonus}% de sucesso\n`;
        texto += `🎲 *Taxa atual:* até ${Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + eq.bonus)}%`;
      } else {
        texto += `⚠️ *Nenhum item equipado!*\nUse *!equiparroubo <item>* para equipar.`;
      }
    }

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao buscar itens de roubo:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar seus itens!' }, { quoted: msg });
  }
}

// ─── !meussec ───────────────────────────────────────────────────────────────

async function handleMeusSec(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    let texto  = `🔐 ═══ SEUS ITENS DE SEGURANÇA ═══ 🔐\n\n`;
    let temItem = false;

    for (const [key, item] of Object.entries(ITENS_SEGURANCA)) {
      const qtd = getItemQtd(user.itensSec, key);
      if (qtd > 0) {
        temItem = true;
        const equipado = user.equiparsec === key ? ' ⚡ *ATIVO*' : '';
        texto += `  ${item.nome}${equipado}\n`;
        texto += `    └ Qtd: *${qtd}x* | Defesa: *+${item.defesa}%*\n`;
      }
    }

    if (!temItem) {
      texto += `😔 Você não possui nenhum item de segurança.\n\n🛒 Compre com *!menusec*!`;
    } else {
      texto += `\n━━━━━━━━━━━━━━━━\n`;
      if (user.equiparsec && ITENS_SEGURANCA[user.equiparsec]) {
        const eq = ITENS_SEGURANCA[user.equiparsec];
        texto += `⚡ *Ativo:* ${eq.nome}\n`;
        texto += `🛡️ *Defesa ativa:* +${eq.defesa}% de proteção\n`;
        texto += `🔒 *Chance de resistir:* até ${Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + eq.defesa)}%`;
      } else {
        texto += `⚠️ *Nenhuma defesa ativa!*\nUse *!equiparsec <item>* para ativar.`;
      }
    }

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao buscar itens de segurança:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar seus itens!' }, { quoted: msg });
  }
}

// ─── !meiosec ───────────────────────────────────────────────────────────────

async function handleMeioSec(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    let texto = `🛡️ ═══ SUAS DEFESAS ATIVAS ═══ 🛡️\n\n`;

    if (user.equiparsec && ITENS_SEGURANCA[user.equiparsec]) {
      const item        = ITENS_SEGURANCA[user.equiparsec];
      const defesaFinal = Math.min(TAXA_MAX, TAXA_SUCESSO_BASE + item.defesa);

      texto += `✅ *Defesa equipada:* ${item.nome}\n`;
      texto += `🔒 *Proteção:* +${item.defesa}%\n\n`;
      texto += `━━━━━━━━━━━━━━━━\n`;
      texto += `📊 *Como funciona:*\n`;
      texto += `  Base de defesa: *${TAXA_SUCESSO_BASE}%*\n`;
      texto += `  Bônus do item: *+${item.defesa}%*\n`;
      texto += `  🛡️ Total: *${defesaFinal}%* de chance de resistir\n\n`;
      texto += `🔄 Troque com *!equiparsec <item>*`;
    } else {
      texto += `❌ *Nenhuma defesa ativa!*\n\n`;
      texto += `⚠️ Sem defesa você tem apenas *${TAXA_SUCESSO_BASE}%* de chance de resistir!\n`;
      texto += `🛒 Compre com *!menusec* e equipe com *!equiparsec <item>*`;
    }

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao buscar defesas:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar suas defesas!' }, { quoted: msg });
  }
}

// ─── !roubar @pessoa ────────────────────────────────────────────────────────

async function handleRoubar(sock, msg, jid) {
  const atacante = getUserId(msg);
  const vitima   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!vitima) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!roubar @pessoa*\nMencione quem você quer roubar!' }, { quoted: msg });
    return;
  }

  if (atacante === vitima) {
    await sock.sendMessage(jid, { text: '❌ Você não pode se roubar!' }, { quoted: msg });
    return;
  }

  try {
    const [userAtacante, userVitima] = await Promise.all([
      Usuario.findOne({ idWhatsApp: atacante }),
      Usuario.findOne({ idWhatsApp: vitima }),
    ]);

    if (!userAtacante) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }
    if (!userVitima) {
      await sock.sendMessage(jid, { text: '❌ Vítima não encontrada no sistema!' }, { quoted: msg });
      return;
    }

    // ── Validar item equipado ─────────────────────────────────────────────
    if (!userAtacante.equiparoubo || !ITENS_ROUBO[userAtacante.equiparoubo]) {
      await sock.sendMessage(jid, {
        text: `❌ *Você precisa equipar um item de roubo antes!*\n\n🛒 Compre com *!menuroubar*\n⚡ Equipe com *!equiparroubo <item>*`
      }, { quoted: msg });
      return;
    }

    // ── Verificar cooldown ────────────────────────────────────────────────
    const agora        = Date.now();
    const ultimoRoubo  = userAtacante.ultimoRoubo ? new Date(userAtacante.ultimoRoubo).getTime() : 0;
    const tempoPassado = agora - ultimoRoubo;

    if (tempoPassado < COOLDOWN_ROUBO_MS) {
      const restante = COOLDOWN_ROUBO_MS - tempoPassado;
      await sock.sendMessage(jid, {
        text: `⏱️ *COOLDOWN ATIVO!*\n\nAguarde *${formatarTempo(restante)}* para tentar novamente.`
      }, { quoted: msg });
      return;
    }

    // ── Verificar saldo da vítima ─────────────────────────────────────────
    const saldoVitima = userVitima.gold || 0;
    if (saldoVitima <= 0) {
      await sock.sendMessage(jid, { text: '❌ A vítima não tem gold para roubar!' }, { quoted: msg });
      return;
    }

    // ── Registrar cooldown ANTES da tentativa ─────────────────────────────
    // (mesmo que falhe, o atacante gastou o cooldown)
    await Usuario.findOneAndUpdate(
      { idWhatsApp: atacante },
      { $set: { ultimoRoubo: new Date() } }
    );

    // ── Calcular taxa de sucesso ──────────────────────────────────────────
    let taxaSucesso = TAXA_SUCESSO_BASE;

    const itemAtaque = ITENS_ROUBO[userAtacante.equiparoubo];
    taxaSucesso += itemAtaque.bonus;

    if (userVitima.equiparsec && ITENS_SEGURANCA[userVitima.equiparsec]) {
      taxaSucesso -= ITENS_SEGURANCA[userVitima.equiparsec].defesa;
    }

    taxaSucesso = Math.max(TAXA_MIN, Math.min(TAXA_MAX, taxaSucesso));

    const rolagem = Math.random() * 100;
    const sucesso  = rolagem < taxaSucesso;

    let textoResposta =
      `🎭 ═══ TENTATIVA DE ROUBO! ═══ 🎭\n\n` +
      `🔫 *Arma:* ${itemAtaque.nome}\n` +
      `🎲 *Rolagem:* ${rolagem.toFixed(1)} vs ${taxaSucesso}% necessário\n` +
      `━━━━━━━━━━━━━━━━\n`;

    if (sucesso) {
      // ── Roubo bem-sucedido ────────────────────────────────────────────
      const percentualRoubo = Math.floor(Math.random() * (ROUBO_MAX_PCT - ROUBO_MIN_PCT + 1)) + ROUBO_MIN_PCT;
      const ouroRoubado     = Math.max(1, Math.floor(saldoVitima * percentualRoubo / 100));

      // Debitar da vítima e só então creditar o atacante
      const novoSaldoVitima = await changeGold(vitima, -ouroRoubado);

      if (novoSaldoVitima === null) {
        // Vítima foi roubada por outra pessoa ao mesmo tempo — refazer com saldo atual
        const saldoAtualVitima = await getSaldoAtual(vitima);
        if (saldoAtualVitima <= 0) {
          textoResposta +=
            `😅 *AZAR!*\n\nA vítima foi roubada por outra pessoa ao mesmo tempo!\n` +
            `⏱️ *Próxima tentativa em:* 30 minutos`;
          await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
          return;
        }
      }

      const novoSaldoAtacante = await changeGold(atacante, ouroRoubado);

      // Missão: roubo bem-sucedido
      await incrementMission(atacante, 'roubo3');

      textoResposta +=
        `✅ *ROUBO BEM-SUCEDIDO!*\n\n` +
        `💰 *Ouro roubado:* ${ouroRoubado} gold (${percentualRoubo}% do saldo)\n` +
        `👤 *Seu novo saldo:* ${novoSaldoAtacante} gold\n` +
        `😢 *Saldo da vítima:* ${saldoVitima - ouroRoubado} gold`;
    } else {
      // ── Roubo fracassou ───────────────────────────────────────────────
      textoResposta +=
        `❌ *ROUBO FRACASSOU!*\n\n` +
        `🚔 A polícia chegou! Você não conseguiu nada.\n` +
        `😌 *Saldo da vítima:* ${saldoVitima} gold (intacto)\n` +
        `⏱️ *Próxima tentativa em:* 30 minutos`;
    }

    await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao processar roubo:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar roubo! Tente novamente.' }, { quoted: msg });
  }
}

// ─── Exportar ────────────────────────────────────────────────────────────────

module.exports = {
  ITENS_ROUBO,
  ITENS_SEGURANCA,
  handleMenuRoubo,
  handleMenuSec,
  handleComprarRoubo,
  handleComprarSec,
  handleEquiparRoubo,
  handleEquiparSec,
  handleMeusItensRoubo,
  handleMeusSec,
  handleMeioSec,
  handleRoubar,
};