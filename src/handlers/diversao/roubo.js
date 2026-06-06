/**
 * Sistema de Roubo — Piroquinhas Bot
 * Comandos: !menuroubar, !roubar, !menusec, !equiparroubo, !equiparsec
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { prepareDailyMissionState, incrementMission } = require('./missoes');

// ─── COOLDOWN DE ROUBO ──────────────────────────────────────────────────────

const COOLDOWN_ROUBO_MS = 30 * 60 * 1000; // 30 minutos em ms

// ─── ITENS DE ROUBO (ATAQUE) ───────────────────────────────────────────────

const ITENS_ROUBO = {
  mascara:    { nome: '🎭 Máscara',               preco: 100, bonus: 10 },
  chave:      { nome: '🔧 Chave Inglesa',          preco: 150, bonus: 20 },
  dinamite:   { nome: '💣 Dinamite',               preco: 300, bonus: 40 },
  lockpick:   { nome: '🔓 Kit de Arrombamento',    preco: 200, bonus: 30 },
  corda:      { nome: '🪢 Corda Ninja',             preco: 250, bonus: 35 },
  disfarce:   { nome: '🕵️ Disfarce Premium',       preco: 350, bonus: 45 },
  explorador: { nome: '📡 Detector de Alarmes',    preco: 400, bonus: 50 },
  cavador:    { nome: '⛏️ Picareta de Diamante',   preco: 500, bonus: 60 }
};

// ─── ITENS DE SEGURANÇA (DEFESA) ───────────────────────────────────────────

const ITENS_SEGURANCA = {
  cofre:      { nome: '🔐 Cofre Forte',            preco: 150, defesa: 15 },
  alarme:     { nome: '🚨 Sistema de Alarme',       preco: 200, defesa: 25 },
  câmera:     { nome: '📹 Câmera de Vigilância',   preco: 250, defesa: 30 },
  cachorro:   { nome: '🐕 Cão de Guarda',           preco: 300, defesa: 35 },
  segurança:  { nome: '👮 Guarda de Segurança',     preco: 400, defesa: 45 },
  bunker:     { nome: '🛡️ Bunker Subterrâneo',     preco: 500, defesa: 55 },
  laser:      { nome: '🔴 Raios Laser',             preco: 600, defesa: 65 },
  militares:  { nome: '🪖 Segurança Militar',       preco: 800, defesa: 80 }
};

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

async function getSaldoAtual(userId) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao buscar saldo:', e.message);
    return 0;
  }
}

async function changeGold(userId, quantidade) {
  try {
    if (quantidade > 0) {
      await prepareDailyMissionState(userId);
    }

    const update = { $inc: { gold: quantidade } };
    if (quantidade > 0) {
      update['$inc']['dailyMissions.progress.gold500'] = quantidade;
    }
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      update,
      { new: true }
    );
    console.log(`✅ Gold alterado: ${userId} → ${quantidade} (novo saldo: ${user?.gold})`);
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

/**
 * Formata milissegundos restantes em "Xmin Ys"
 */
function formatarTempo(ms) {
  const totalSeg = Math.ceil(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  if (min > 0 && seg > 0) return `${min}min ${seg}s`;
  if (min > 0) return `${min}min`;
  return `${seg}s`;
}

// ─── !menuroubar ────────────────────────────────────────────────────────────

async function handleMenuRoubo(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🎭 *LOJA DE ROUBO* 🎭\n\n`;
  texto += `*EQUIPAMENTOS PARA ROUBAR:*\n`;

  for (const [key, item] of Object.entries(ITENS_ROUBO)) {
    texto += `  ${item.nome} — ${item.preco} gold (+${item.bonus}% sucesso)\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMO USAR:*\n`;
  texto += `  ${P}comprarroubo <item> — Comprar item\n`;
  texto += `  ${P}equiparroubo <item> — Equipar item de roubo\n`;
  texto += `  ${P}roubar @pessoa — Roubar de alguém\n`;
  texto += `  ${P}meusitensroubo — Ver seus itens de roubo\n`;
  texto += `\n⚠️ *Você precisa ter um item equipado para roubar!*\n`;
  texto += `⏱️ *Cooldown:* 30 minutos entre tentativas`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !menusec ───────────────────────────────────────────────────────────────

async function handleMenuSec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  let texto = `🔐 *LOJA DE SEGURANÇA* 🔐\n\n`;
  texto += `*EQUIPAMENTOS DE DEFESA:*\n`;

  for (const [key, item] of Object.entries(ITENS_SEGURANCA)) {
    texto += `  ${item.nome} — ${item.preco} gold (+${item.defesa}% proteção)\n`;
  }

  texto += `\n━━━━━━━━━━━━━━━━\n`;
  texto += `*COMO USAR:*\n`;
  texto += `  ${P}comprarsec <item> — Comprar item\n`;
  texto += `  ${P}equiparsec <item> — Equipar item de defesa\n`;
  texto += `  ${P}meussec — Ver seus itens de segurança\n`;
  texto += `  ${P}meiosec — Ver suas defesas ativas\n`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprarroubo ──────────────────────────────────────────────────────────

async function handleComprarRoubo(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match = caption.match(/comprarroubo\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprarroubo <item>*\nExemplo: *!comprarroubo dinamite*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_ROUBO[itemNome];

  if (!itemInfo) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemNome}* não existe na loja de roubo!` }, { quoted: msg });
    return;
  }

  const saldoAtual = await getSaldoAtual(userId);

  if (saldoAtual < itemInfo.preco) {
    await sock.sendMessage(jid, { text: `❌ Você não tem *${itemInfo.preco}* gold! Seu saldo: *${saldoAtual}* gold` }, { quoted: msg });
    return;
  }

  try {
    // ── FIX: usar $set com notação de ponto para garantir persistência no MongoDB
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`itensRoubo.${itemNome}`]: 1 } },
      { new: true, upsert: true }
    );
    console.log(`✅ Item de roubo adicionado: ${userId} → ${itemNome}`);
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item!' }, { quoted: msg });
    return;
  }

  const saldoFinal = await changeGold(userId, -itemInfo.preco);

  const texto = `✅ *COMPRA REALIZADA!* ✅\n\n🎭 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${itemInfo.preco} gold\n💎 *Novo saldo:* ${saldoFinal} gold\n\n💡 Use *!equiparroubo ${itemNome}* para equipar!`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprarsec ────────────────────────────────────────────────────────────

async function handleComprarSec(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match = caption.match(/comprarsec\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprarsec <item>*\nExemplo: *!comprarsec cofre*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_SEGURANCA[itemNome];

  if (!itemInfo) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemNome}* não existe na loja de segurança!` }, { quoted: msg });
    return;
  }

  const saldoAtual = await getSaldoAtual(userId);

  if (saldoAtual < itemInfo.preco) {
    await sock.sendMessage(jid, { text: `❌ Você não tem *${itemInfo.preco}* gold! Seu saldo: *${saldoAtual}* gold` }, { quoted: msg });
    return;
  }

  try {
    // ── FIX: usar $inc com notação de ponto para garantir persistência no MongoDB
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`itensSec.${itemNome}`]: 1 } },
      { new: true, upsert: true }
    );
    console.log(`✅ Item de segurança adicionado: ${userId} → ${itemNome}`);
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item!' }, { quoted: msg });
    return;
  }

  const saldoFinal = await changeGold(userId, -itemInfo.preco);

  const texto = `✅ *COMPRA REALIZADA!* ✅\n\n🔐 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${itemInfo.preco} gold\n💎 *Novo saldo:* ${saldoFinal} gold\n\n💡 Use *!equiparsec ${itemNome}* para equipar!`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !equiparroubo ──────────────────────────────────────────────────────────

async function handleEquiparRoubo(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match = caption.match(/equiparroubo\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!equiparroubo <item>*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();

  if (!ITENS_ROUBO[itemNome]) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemNome}* não existe!` }, { quoted: msg });
    return;
  }

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user || !user.itensRoubo?.get(itemNome) || user.itensRoubo.get(itemNome) <= 0) {
      await sock.sendMessage(jid, { text: `❌ Você não possui *${ITENS_ROUBO[itemNome].nome}*!\nCompre com *!comprarroubo ${itemNome}*` }, { quoted: msg });
      return;
    }

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { equiparoubo: itemNome } }
    );

    const texto = `✅ *ITEM EQUIPADO!* ✅\n\n🎭 *Item:* ${ITENS_ROUBO[itemNome].nome}\n📈 *Bônus de sucesso:* +${ITENS_ROUBO[itemNome].bonus}%\n\n🔫 Agora você pode usar *!roubar @pessoa*!`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao equipar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao equipar item!' }, { quoted: msg });
  }
}

// ─── !equiparsec ────────────────────────────────────────────────────────────

async function handleEquiparSec(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match = caption.match(/equiparsec\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!equiparsec <item>*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();

  if (!ITENS_SEGURANCA[itemNome]) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemNome}* não existe!` }, { quoted: msg });
    return;
  }

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user || !user.itensSec?.get(itemNome) || user.itensSec.get(itemNome) <= 0) {
      await sock.sendMessage(jid, { text: `❌ Você não possui *${ITENS_SEGURANCA[itemNome].nome}*!\nCompre com *!comprarsec ${itemNome}*` }, { quoted: msg });
      return;
    }

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { equiparsec: itemNome } }
    );

    const texto = `✅ *DEFESA ATIVADA!* ✅\n\n🔐 *Item:* ${ITENS_SEGURANCA[itemNome].nome}\n📈 *Proteção:* +${ITENS_SEGURANCA[itemNome].defesa}%`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao equipar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao equipar item!' }, { quoted: msg });
  }
}

// ─── !roubar @pessoa ────────────────────────────────────────────────────────

async function handleRoubar(sock, msg, jid, caption) {
  const atacante = msg.key.participant || msg.key.remoteJid;

  // Extrair menção
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!mentioned) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!roubar @pessoa*\nMencione quem você quer roubar!' }, { quoted: msg });
    return;
  }

  const vitima = mentioned;

  if (atacante === vitima) {
    await sock.sendMessage(jid, { text: '❌ Você não pode se roubar!' }, { quoted: msg });
    return;
  }

  try {
    const userAtacante = await Usuario.findOne({ idWhatsApp: atacante });
    const userVitima   = await Usuario.findOne({ idWhatsApp: vitima });

    // ── Validação: cadastro
    if (!userAtacante) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }
    if (!userVitima) {
      await sock.sendMessage(jid, { text: '❌ Vítima não encontrada!' }, { quoted: msg });
      return;
    }

    // ── [NOVO] Validação: precisa ter item equipado para roubar
    if (!userAtacante.equiparoubo) {
      await sock.sendMessage(jid, {
        text: `❌ *Você precisa equipar um item de roubo antes!*\n\n🛒 Compre um item com *!menuroubar* e equipe com *!equiparroubo <item>*`
      }, { quoted: msg });
      return;
    }

    // ── [NOVO] Validação: cooldown de 30 minutos
    const agora = Date.now();
    const ultimoRoubo = userAtacante.ultimoRoubo ? new Date(userAtacante.ultimoRoubo).getTime() : 0;
    const tempoPassado = agora - ultimoRoubo;

    if (tempoPassado < COOLDOWN_ROUBO_MS) {
      const tempoRestante = COOLDOWN_ROUBO_MS - tempoPassado;
      await sock.sendMessage(jid, {
        text: `⏱️ *Você está em cooldown!*\n\nAguarde mais *${formatarTempo(tempoRestante)}* para tentar roubar novamente.`
      }, { quoted: msg });
      return;
    }

    // ── Validação: vítima tem gold
    const saldoVitima = userVitima.gold || 0;
    if (saldoVitima <= 0) {
      await sock.sendMessage(jid, { text: '❌ A vítima não tem gold para roubar!' }, { quoted: msg });
      return;
    }

    // ── [NOVO] Registrar timestamp ANTES da tentativa (mesmo que falhe, gasta cooldown)
    await Usuario.findOneAndUpdate(
      { idWhatsApp: atacante },
      { $set: { ultimoRoubo: new Date() } }
    );

    // ── Calcular taxa de sucesso
    let taxaSucesso = 50; // Base 50%

    const itemAtaque = ITENS_ROUBO[userAtacante.equiparoubo];
    if (itemAtaque) {
      taxaSucesso += itemAtaque.bonus;
    }

    if (userVitima.equiparsec) {
      const itemDefesa = ITENS_SEGURANCA[userVitima.equiparsec];
      if (itemDefesa) {
        taxaSucesso -= itemDefesa.defesa;
      }
    }

    // Limitar entre 5% e 95%
    taxaSucesso = Math.max(5, Math.min(95, taxaSucesso));

    const rolagem = Math.random() * 100;
    const sucesso  = rolagem < taxaSucesso;

    let textoResposta = `🎭 *TENTATIVA DE ROUBO!* 🎭\n\n`;
    textoResposta += `🔫 *Arma:* ${itemAtaque.nome}\n`;
    textoResposta += `🎲 *Rolagem:* ${rolagem.toFixed(1)}% vs ${taxaSucesso}% de sucesso\n`;
    textoResposta += `━━━━━━━━━━━━━━━━\n`;

    if (sucesso) {
      const percentualRoubo = Math.floor(Math.random() * 70) + 30; // 30–100%
      const ouroRoubado     = Math.floor(saldoVitima * percentualRoubo / 100);

      await changeGold(atacante, ouroRoubado);
      await changeGold(vitima, -ouroRoubado);

      // ── Missão: contar roubo bem-sucedido
      await incrementMission(atacante, 'roubo3');

      const novoSaldoAtacante = (userAtacante.gold || 0) + ouroRoubado;
      const novoSaldoVitima   = saldoVitima - ouroRoubado;

      textoResposta += `✅ *ROUBO BEM-SUCEDIDO!*\n\n`;
      textoResposta += `💰 *Ouro roubado:* ${ouroRoubado} gold (${percentualRoubo}%)\n`;
      textoResposta += `👤 *Seu novo saldo:* ${novoSaldoAtacante} gold\n`;
      textoResposta += `😢 *Saldo da vítima:* ${novoSaldoVitima} gold`;
    } else {
      textoResposta += `❌ *ROUBO FRACASSOU!*\n\n`;
      textoResposta += `🚔 A polícia chegou! Você não conseguiu nada!\n`;
      textoResposta += `😌 *Saldo da vítima:* ${saldoVitima} gold (intacto)\n`;
      textoResposta += `⏱️ *Próxima tentativa em:* 30 minutos`;
    }

    await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao processar roubo:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar roubo!' }, { quoted: msg });
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
  handleRoubar,
};