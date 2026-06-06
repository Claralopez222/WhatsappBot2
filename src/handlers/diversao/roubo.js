/**
 * Sistema de Roubo — Piroquinhas Bot
 * Comandos: !menuroubar, !roubar, !menusec, !equiparroubo, !equiparsec
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { prepareDailyMissionState } = require('./missoes');

// ─── ITENS DE ROUBO (ATAQUE) ───────────────────────────────────────────────

const ITENS_ROUBO = {
  mascara: { nome: '🎭 Máscara', preco: 100, bonus: 10 },
  chave: { nome: '🔧 Chave Inglesa', preco: 150, bonus: 20 },
  dinamite: { nome: '💣 Dinamite', preco: 300, bonus: 40 },
  lockpick: { nome: '🔓 Kit de Arrombamento', preco: 200, bonus: 30 },
  corda: { nome: '🪢 Corda Ninja', preco: 250, bonus: 35 },
  disfarce: { nome: '🕵️ Disfarce Premium', preco: 350, bonus: 45 },
  explorador: { nome: '📡 Detector de Alarmes', preco: 400, bonus: 50 },
  cavador: { nome: '⛏️ Picareta de Diamante', preco: 500, bonus: 60 }
};

// ─── ITENS DE SEGURANÇA (DEFESA) ───────────────────────────────────────────

const ITENS_SEGURANCA = {
  cofre: { nome: '🔐 Cofre Forte', preco: 150, defesa: 15 },
  alarme: { nome: '🚨 Sistema de Alarme', preco: 200, defesa: 25 },
  câmera: { nome: '📹 Câmera de Vigilância', preco: 250, defesa: 30 },
  cachorro: { nome: '🐕 Cão de Guarda', preco: 300, defesa: 35 },
  segurança: { nome: '👮 Guarda de Segurança', preco: 400, defesa: 45 },
  bunker: { nome: '🛡️ Bunker Subterrâneo', preco: 500, defesa: 55 },
  laser: { nome: '🔴 Raios Laser', preco: 600, defesa: 65 },
  militares: { nome: '🪖 Segurança Militar', preco: 800, defesa: 80 }
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
    // Garantir que missão está inicializada antes de atualizar
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
    let user = await Usuario.findOne({ idWhatsApp: userId });
    
    if (!user) {
      user = new Usuario({ 
        idWhatsApp: userId, 
        gold: saldoAtual,
        itensRoubo: { [itemNome]: 1 }
      });
    } else {
      if (!user.itensRoubo) {
        user.itensRoubo = {};
      }
      user.itensRoubo[itemNome] = (user.itensRoubo[itemNome] || 0) + 1;
    }
    
    await user.save();
    console.log(`✅ Item de roubo adicionado: ${userId} → ${itemNome}`);
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item!' }, { quoted: msg });
    return;
  }

  const saldoFinal = await changeGold(userId, -itemInfo.preco);

  const texto = `✅ *COMPRA REALIZADA!* ✅\n\n🎭 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${itemInfo.preco} gold\n💎 *Novo saldo:* ${saldoFinal} gold`;
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
    let user = await Usuario.findOne({ idWhatsApp: userId });
    
    if (!user) {
      user = new Usuario({ 
        idWhatsApp: userId, 
        gold: saldoAtual,
        itensSec: { [itemNome]: 1 }
      });
    } else {
      if (!user.itensSec) {
        user.itensSec = {};
      }
      user.itensSec[itemNome] = (user.itensSec[itemNome] || 0) + 1;
    }
    
    await user.save();
    console.log(`✅ Item de segurança adicionado: ${userId} → ${itemNome}`);
  } catch (e) {
    console.error('⚠️ Erro ao adicionar item:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao comprar item!' }, { quoted: msg });
    return;
  }

  const saldoFinal = await changeGold(userId, -itemInfo.preco);

  const texto = `✅ *COMPRA REALIZADA!* ✅\n\n🔐 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${itemInfo.preco} gold\n💎 *Novo saldo:* ${saldoFinal} gold`;
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
    
    if (!user || !user.itensRoubo || !user.itensRoubo[itemNome] || user.itensRoubo[itemNome] <= 0) {
      await sock.sendMessage(jid, { text: `❌ Você não possui *${ITENS_ROUBO[itemNome].nome}*!` }, { quoted: msg });
      return;
    }

    user.equiparoubo = itemNome;
    await user.save();

    const texto = `✅ *ITEM EQUIPADO!* ✅\n\n🎭 *Item:* ${ITENS_ROUBO[itemNome].nome}\n📈 *Bonus de sucesso:* +${ITENS_ROUBO[itemNome].bonus}%`;
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
    
    if (!user || !user.itensSec || !user.itensSec[itemNome] || user.itensSec[itemNome] <= 0) {
      await sock.sendMessage(jid, { text: `❌ Você não possui *${ITENS_SEGURANCA[itemNome].nome}*!` }, { quoted: msg });
      return;
    }

    user.equiparsec = itemNome;
    await user.save();

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
    await sock.sendMessage(jid, { text: '❌ Você não pode se roubar a si mesmo!' }, { quoted: msg });
    return;
  }

  try {
    const userAtacante = await Usuario.findOne({ idWhatsApp: atacante });
    const userVitima = await Usuario.findOne({ idWhatsApp: vitima });

    if (!userAtacante) {
      await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
      return;
    }

    if (!userVitima) {
      await sock.sendMessage(jid, { text: '❌ Vítima não encontrada!' }, { quoted: msg });
      return;
    }

    const saldoVitima = userVitima.gold || 0;

    if (saldoVitima <= 0) {
      await sock.sendMessage(jid, { text: '❌ A vítima não tem gold para roubar!' }, { quoted: msg });
      return;
    }

    // Calcular taxa de sucesso
    let taxaSucesso = 50; // Base 50%
    
    // Bonus do atacante
    if (userAtacante.equiparoubo) {
      const itemAtaque = ITENS_ROUBO[userAtacante.equiparoubo];
      if (itemAtaque) {
        taxaSucesso += itemAtaque.bonus;
      }
    }

    // Defesa da vítima
    if (userVitima.equiparsec) {
      const itemDefesa = ITENS_SEGURANCA[userVitima.equiparsec];
      if (itemDefesa) {
        taxaSucesso -= itemDefesa.defesa;
      }
    }

    // Limitar entre 5% e 95%
    taxaSucesso = Math.max(5, Math.min(95, taxaSucesso));

    const rolagem = Math.random() * 100;
    const sucesso = rolagem < taxaSucesso;

    let textoResposta = `🎭 *TENTATIVA DE ROUBO!* 🎭\n\n`;
    textoResposta += `🎲 *Rolagem:* ${rolagem.toFixed(1)}% vs ${taxaSucesso}% de sucesso\n`;
    textoResposta += `━━━━━━━━━━━━━━━━\n`;

    if (sucesso) {
      // Decidir quanto roubou (entre 30-100% do saldo)
      const percentualRoubo = Math.floor(Math.random() * 70) + 30; // 30-100%
      const ouroRoubado = Math.floor(saldoVitima * percentualRoubo / 100);

      // Transferir ouro
      await changeGold(atacante, ouroRoubado);
      await changeGold(vitima, -ouroRoubado);

      textoResposta += `✅ *ROUBO BEM-SUCEDIDO!*\n\n`;
      textoResposta += `💰 *Ouro roubado:* ${ouroRoubado} gold (${percentualRoubo}%)\n`;
      textoResposta += `👤 *Saldo novo do atacante:* ${(userAtacante.gold || 0) + ouroRoubado} gold\n`;
      textoResposta += `😢 *Saldo novo da vítima:* ${saldoVitima - ouroRoubado} gold`;
    } else {
      textoResposta += `❌ *ROUBO FRACASSOU!*\n\n`;
      textoResposta += `🚔 A polícia chegou! Você não conseguiu roubar nada!\n`;
      textoResposta += `😌 *Saldo da vítima:* ${saldoVitima} gold (intacto)`;
    }

    await sock.sendMessage(jid, { text: textoResposta }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao processar roubo:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar roubo!' }, { quoted: msg });
  }
}

// ─── Exportar ────────────────────────────────────────────────────────────────

module.exports = {
  handleMenuRoubo,
  handleMenuSec,
  handleComprarRoubo,
  handleComprarSec,
  handleEquiparRoubo,
  handleEquiparSec,
  handleRoubar,
};
