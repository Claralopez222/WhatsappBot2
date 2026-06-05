/**
 * Handler de Marketplace — Piroquinhas Bot
 * Sistema de compra/venda entre usuários
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { getSaldoAtual, changeGold, ITENS_LOJA } = require('./economia');

// ─── Formato: { sellerId: { itemName: { preco, quantidade, sellerName }, ... }, ... }
const sellerOffers = {};

// ─── !avenda (Ver ofertas)
async function handleAvenda(sock, msg, jid) {
  if (Object.keys(sellerOffers).length === 0) {
    await sock.sendMessage(jid, { text: '📦 *NENHUM ITEM À VENDA*\n\nQuerendo vender algo?\n  *!vender <item> <preco> <qtd>*' }, { quoted: msg });
    return;
  }
  
  let texto = `🛍️ *ITENS À VENDA* 🛍️\n\n`;
  let contador = 0;
  
  for (const [sellerId, offers] of Object.entries(sellerOffers)) {
    const sellerName = sellerId.split('@')[0];
    texto += `\n👤 *${sellerName}* (@${sellerName})\n`;
    
    for (const [itemKey, oferta] of Object.entries(offers)) {
      if (oferta.quantidade > 0) {
        texto += `  📦 ${oferta.nome} — ${oferta.preco} gold × ${oferta.quantidade}\n`;
        contador++;
      }
    }
  }
  
  texto += `\n━━━━━━━━━━━━━━━━\n*TOTAL:* ${contador} oferta(s) ativa(s)\n\n*COMO COMPRAR:*\n  !buy <vendedor> <item> <qtd>\n  Exemplo: !buy 559999999 pizza 2`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !buy (Comprar oferta)
async function handleBuy(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/buy\s+(\S+)\s+(\S+)\s+(\d+)/i);
  
  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!buy <vendedor> <item> <quantidade>*\nExemplo: *!buy 559999999 pizza 2*\n\nVer vendedores: *!avenda*' }, { quoted: msg });
    return;
  }
  
  const vendedorNumero = match[1];
  const itemKey = match[2].toLowerCase().trim();
  const quantidade = parseInt(match[3]);
  const vendedorId = vendedorNumero + '@s.whatsapp.net';
  
  // Verificar se o vendedor existe e tem a oferta
  if (!sellerOffers[vendedorId] || !sellerOffers[vendedorId][itemKey]) {
    await sock.sendMessage(jid, { text: `⚠️ Vendedor ou item não encontrado!\n\nVer ofertas: *!avenda*` }, { quoted: msg });
    return;
  }
  
  const oferta = sellerOffers[vendedorId][itemKey];
  
  if (quantidade > oferta.quantidade) {
    await sock.sendMessage(jid, { text: `⚠️ Quantidade indisponível!\n\nDisponível: ${oferta.quantidade}` }, { quoted: msg });
    return;
  }
  
  const custoTotal = oferta.preco * quantidade;
  const saldoAtual = await getSaldoAtual(userId);
  
  if (saldoAtual < custoTotal) {
    await sock.sendMessage(jid, { text: `⚠️ *SALDO INSUFICIENTE*\n\n💰 Você tem: *${saldoAtual}* gold\n💸 Precisa de: *${custoTotal}* gold\n\n📊 Faltam: *${custoTotal - saldoAtual}* gold` }, { quoted: msg });
    return;
  }
  
  // Realizar transação
  await changeGold(userId, -custoTotal);
  await changeGold(vendedorId, custoTotal);
  
  // Adicionar ao inventário do comprador
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`inventory.${itemKey}`]: quantidade } },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao adicionar ao inventário:', e.message);
  }
  
  // Atualizar oferta
  sellerOffers[vendedorId][itemKey].quantidade -= quantidade;
  if (sellerOffers[vendedorId][itemKey].quantidade === 0) {
    delete sellerOffers[vendedorId][itemKey];
    if (Object.keys(sellerOffers[vendedorId]).length === 0) {
      delete sellerOffers[vendedorId];
    }
  }
  
  const novoSaldo = await getSaldoAtual(userId);
  const vendedorName = vendedorId.split('@')[0];
  
  const texto = `✅ *COMPRA REALIZADA!* ✅\n\n📦 *Item:* ${oferta.nome}\n📊 *Quantidade:* ${quantidade}\n💵 *Preço unitário:* ${oferta.preco} gold\n💸 *Total:* ${custoTotal} gold\n👤 *Vendedor:* ${oferta.sellerName}\n\n━━━━━━━━━━━━━━━━\n*SALDO ATUALIZADO:*\n  ✅ Novo saldo: *${novoSaldo}* gold`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !ofertar (Criar oferta de venda)
async function handleOfertar(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/ofertar\s+(\S+)\s+(\d+)\s+(\d+)/i);
  
  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!ofertar <item> <preco> <quantidade>*\nExemplo: *!ofertar pizza 50 3*' }, { quoted: msg });
    return;
  }
  
  const itemKey = match[1].toLowerCase().trim();
  const preco = parseInt(match[2]);
  const quantidade = parseInt(match[3]);
  const itemInfo = ITENS_LOJA[itemKey];
  
  if (!itemInfo) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemKey}* não existe!` }, { quoted: msg });
    return;
  }
  
  if (preco <= 0 || quantidade <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Preço e quantidade devem ser maiores que 0!' }, { quoted: msg });
    return;
  }
  
  // Inicializar ofertas do vendedor
  if (!sellerOffers[userId]) {
    sellerOffers[userId] = {};
  }
  
  const sellerName = userId.split('@')[0];
  sellerOffers[userId][itemKey] = {
    nome: itemInfo.nome,
    preco: preco,
    quantidade: quantidade,
    sellerName: sellerName,
    sellerId: userId
  };
  
  const texto = `✅ *OFERTA CRIADA!* ✅\n\n📦 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${preco} gold cada\n📊 *Quantidade:* ${quantidade}\n👤 *Vendedor:* ${sellerName}\n\n━━━━━━━━━━━━━━━━\n*PRÓXIMOS PASSOS:*\n  Ver ofertas: *!avenda*\n  Comprar: *!buy <vendedor> <item> <qtd>*`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !ofertas (Ver minhas ofertas criadas)
async function handleOfertasRecebidas(sock, msg, jid) {
  const userId = msg.key.participant;
  
  if (!sellerOffers[userId] || Object.keys(sellerOffers[userId]).length === 0) {
    await sock.sendMessage(jid, { text: '📦 *VOCÊ NÃO TEM OFERTAS CRIADAS*\n\nCrie uma oferta com: *!ofertar <item> <preco> <qtd>*' }, { quoted: msg });
    return;
  }
  
  let texto = `📊 *SUAS OFERTAS* 📊\n\n`;
  
  for (const [itemKey, oferta] of Object.entries(sellerOffers[userId])) {
    if (oferta.quantidade > 0) {
      texto += `  📦 ${oferta.nome}\n`;
      texto += `     💵 ${oferta.preco} gold × ${oferta.quantidade} unidades\n`;
      texto += `     📊 Total: ${oferta.preco * oferta.quantidade} gold\n\n`;
    }
  }
  
  texto += `━━━━━━━━━━━━━━━━\n*EDITAR OFERTA?*\n  !ofertar <item> <novo_preco> <nova_qtd>`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !aceitarofferta (Aceitar oferta recebida - compatibilidade)
async function handleAceitarOfferta(sock, msg, jid, caption) {
  await sock.sendMessage(jid, { text: '💼 Use *!buy* para comprar ofertas de outros usuários!\n\nExemplo: *!buy 559999999 pizza 2*' }, { quoted: msg });
}

module.exports = {
  handleAvenda,
  handleBuy,
  handleOfertar,
  handleOfertasRecebidas,
  handleAceitarOfferta,
  sellerOffers,
  playerOffers: sellerOffers, // Compatibilidade com nome antigo
};
