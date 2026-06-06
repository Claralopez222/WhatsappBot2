/**
 * Handler de Marketplace — Piroquinhas Bot
 * Sistema de compra/venda entre usuários
 *
 * CORREÇÕES:
 *  - Ofertas persistidas no MongoDB (coleção MarketOffer) em vez de memória
 *  - Inventário usa $inc atômico (fix do Map do Mongoose)
 *  - getUserId com fallback para DM
 *  - Verificação de inventário antes de ofertar
 *  - !cancelaroferta implementado
 *  - Catálogo unificado (economia + roubo + segurança)
 *  - Notificação ao vendedor quando alguém compra
 */

const path    = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── CATÁLOGO UNIFICADO ──────────────────────────────────────────────────────
// Agrega itens de todos os sistemas para permitir revenda no marketplace

const { ITENS_LOJA }      = require('./economia');
const { ITENS_ROUBO, ITENS_SEGURANCA } = require('./roubo');   // exportar constantes de lá

const CATALOGO_COMPLETO = {
  ...(ITENS_LOJA      || {}),
  ...(ITENS_ROUBO     || {}),
  ...(ITENS_SEGURANCA || {}),
};

function getNomeItem(itemKey) {
  return CATALOGO_COMPLETO[itemKey]?.nome ?? itemKey;
}

// ─── MODELO DE OFERTA ────────────────────────────────────────────────────────
// Para persistência, usamos uma coleção separada via Mongoose.
// Se você ainda não tem esse model, ele será criado automaticamente.

const mongoose = require('mongoose');

const ofertaSchema = new mongoose.Schema({
  sellerId:    { type: String, required: true, index: true },
  sellerName:  { type: String, required: true },
  itemKey:     { type: String, required: true },
  itemNome:    { type: String, required: true },
  preco:       { type: Number, required: true },
  quantidade:  { type: Number, required: true },
  createdAt:   { type: Date,   default: Date.now },
});

// Índice composto para busca rápida por vendedor + item
ofertaSchema.index({ sellerId: 1, itemKey: 1 }, { unique: true });

const Oferta = mongoose.models.Oferta || mongoose.model('Oferta', ofertaSchema);

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

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
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { gold: quantidade } },
      { new: true }
    );
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

/**
 * Retorna a quantidade de um item no inventário do usuário.
 * Suporta tanto campo `inventory` (Map) quanto `itensRoubo`/`itensSec`.
 */
async function getQuantidadeNoInventario(userId, itemKey) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    if (!user) return 0;

    const fromInventory = user.inventory?.get(itemKey) || 0;
    const fromRoubo     = user.itensRoubo?.get(itemKey) || 0;
    const fromSec       = user.itensSec?.get(itemKey)   || 0;

    return fromInventory + fromRoubo + fromSec;
  } catch (e) {
    console.error('⚠️ Erro ao checar inventário:', e.message);
    return 0;
  }
}

/**
 * Remove quantidade do inventário do usuário.
 * Tenta remover de `inventory` primeiro, depois `itensRoubo`, depois `itensSec`.
 * Retorna true se conseguiu remover tudo.
 */
async function removerDoInventario(userId, itemKey, quantidade) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    if (!user) return false;

    let restante = quantidade;

    // Tenta descontar do inventory geral
    const qtdInv = user.inventory?.get(itemKey) || 0;
    if (qtdInv > 0) {
      const descontar = Math.min(qtdInv, restante);
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { [`inventory.${itemKey}`]: -descontar } }
      );
      restante -= descontar;
    }

    // Tenta descontar de itensRoubo
    if (restante > 0) {
      const qtdRoubo = user.itensRoubo?.get(itemKey) || 0;
      if (qtdRoubo > 0) {
        const descontar = Math.min(qtdRoubo, restante);
        await Usuario.findOneAndUpdate(
          { idWhatsApp: userId },
          { $inc: { [`itensRoubo.${itemKey}`]: -descontar } }
        );
        restante -= descontar;
      }
    }

    // Tenta descontar de itensSec
    if (restante > 0) {
      const qtdSec = user.itensSec?.get(itemKey) || 0;
      if (qtdSec > 0) {
        const descontar = Math.min(qtdSec, restante);
        await Usuario.findOneAndUpdate(
          { idWhatsApp: userId },
          { $inc: { [`itensSec.${itemKey}`]: -descontar } }
        );
        restante -= descontar;
      }
    }

    return restante === 0;
  } catch (e) {
    console.error('⚠️ Erro ao remover do inventário:', e.message);
    return false;
  }
}

/**
 * Adiciona item ao inventário geral do comprador.
 */
async function adicionarAoInventario(userId, itemKey, quantidade) {
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`inventory.${itemKey}`]: quantidade } },
      { upsert: true }
    );
    return true;
  } catch (e) {
    console.error('⚠️ Erro ao adicionar ao inventário:', e.message);
    return false;
  }
}

function formatarNumero(vendedorId) {
  return vendedorId.replace('@s.whatsapp.net', '');
}

// ─── !avenda ─────────────────────────────────────────────────────────────────

async function handleAvenda(sock, msg, jid) {
  try {
    const ofertas = await Oferta.find({ quantidade: { $gt: 0 } }).sort({ createdAt: -1 });

    if (ofertas.length === 0) {
      await sock.sendMessage(jid, {
        text: `📦 *MARKETPLACE VAZIO*\n\nNenhum item à venda no momento.\n\n💡 Quer vender algo?\n  *!ofertar <item> <preco> <qtd>*`
      }, { quoted: msg });
      return;
    }

    // Agrupar por vendedor
    const porVendedor = {};
    for (const o of ofertas) {
      if (!porVendedor[o.sellerId]) porVendedor[o.sellerId] = [];
      porVendedor[o.sellerId].push(o);
    }

    let texto = `🛒 *MARKETPLACE* 🛒\n`;
    texto += `📊 _${ofertas.length} oferta(s) ativa(s)_\n`;
    texto += `━━━━━━━━━━━━━━━━\n`;

    for (const [sellerId, lista] of Object.entries(porVendedor)) {
      const num = formatarNumero(sellerId);
      texto += `\n👤 *${lista[0].sellerName}*\n`;
      for (const o of lista) {
        const totalVal = o.preco * o.quantidade;
        texto += `  📦 ${o.itemNome}\n`;
        texto += `     💵 ${o.preco}g × ${o.quantidade} un. (total: ${totalVal}g)\n`;
        texto += `     🛒 \`!buy ${num} ${o.itemKey} <qtd>\`\n`;
      }
    }

    texto += `\n━━━━━━━━━━━━━━━━\n`;
    texto += `💡 *Cancelar oferta:* \`!cancelaroferta <item>\``;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao listar marketplace:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar o marketplace!' }, { quoted: msg });
  }
}

// ─── !ofertar ─────────────────────────────────────────────────────────────────

async function handleOfertar(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/ofertar\s+(\S+)\s+(\d+)\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!ofertar <item> <preco> <quantidade>*\nExemplo: *!ofertar dinamite 200 3*'
    }, { quoted: msg });
    return;
  }

  const itemKey   = match[1].toLowerCase().trim();
  const preco     = parseInt(match[2]);
  const quantidade = parseInt(match[3]);

  // Validar item no catálogo
  if (!CATALOGO_COMPLETO[itemKey]) {
    const exemplos = Object.keys(CATALOGO_COMPLETO).slice(0, 5).join(', ');
    await sock.sendMessage(jid, {
      text: `⚠️ Item *${itemKey}* não existe no catálogo!\n\n📋 Exemplos: ${exemplos}...`
    }, { quoted: msg });
    return;
  }

  if (preco <= 0 || quantidade <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Preço e quantidade devem ser maiores que 0!' }, { quoted: msg });
    return;
  }

  // ── [FIX] Verificar se o usuário tem o item no inventário ──────────────
  const qtdDisponivel = await getQuantidadeNoInventario(userId, itemKey);
  if (qtdDisponivel < quantidade) {
    await sock.sendMessage(jid, {
      text: `❌ *Inventário insuficiente!*\n\n📦 Você tem: *${qtdDisponivel}x ${getNomeItem(itemKey)}*\n📊 Tentou ofertar: *${quantidade}*\n\n💡 Compre mais na loja!`
    }, { quoted: msg });
    return;
  }

  // ── Remover do inventário do vendedor ao criar oferta ──────────────────
  const removido = await removerDoInventario(userId, itemKey, quantidade);
  if (!removido) {
    await sock.sendMessage(jid, { text: '⚠️ Erro ao reservar itens do inventário!' }, { quoted: msg });
    return;
  }

  try {
    const sellerName = formatarNumero(userId);
    const itemNome   = getNomeItem(itemKey);

    // Upsert: se já tem oferta desse item, soma quantidade
    await Oferta.findOneAndUpdate(
      { sellerId: userId, itemKey },
      {
        $set:  { sellerName, itemNome, preco },
        $inc:  { quantidade },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true }
    );

    const texto =
      `✅ *OFERTA CRIADA!* ✅\n\n` +
      `📦 *Item:* ${itemNome}\n` +
      `💵 *Preço:* ${preco} gold cada\n` +
      `📊 *Quantidade:* ${quantidade}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🛒 Ver marketplace: *!avenda*\n` +
      `❌ Cancelar: *!cancelaroferta ${itemKey}*`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    // Rollback: devolver item ao inventário se falhou ao salvar oferta
    await adicionarAoInventario(userId, itemKey, quantidade);
    console.error('⚠️ Erro ao criar oferta:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao criar oferta! Seus itens foram devolvidos.' }, { quoted: msg });
  }
}

// ─── !buy ─────────────────────────────────────────────────────────────────────

async function handleBuy(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/buy\s+(\S+)\s+(\S+)\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!buy <vendedor> <item> <quantidade>*\nExemplo: *!buy 5511999999999 dinamite 2*\n\nVer vendedores: *!avenda*'
    }, { quoted: msg });
    return;
  }

  const vendedorNumero = match[1].replace(/\D/g, ''); // só dígitos
  const itemKey        = match[2].toLowerCase().trim();
  const quantidade     = parseInt(match[3]);
  const vendedorId     = vendedorNumero + '@s.whatsapp.net';

  if (userId === vendedorId) {
    await sock.sendMessage(jid, { text: '❌ Você não pode comprar sua própria oferta!' }, { quoted: msg });
    return;
  }

  try {
    const oferta = await Oferta.findOne({ sellerId: vendedorId, itemKey });

    if (!oferta || oferta.quantidade <= 0) {
      await sock.sendMessage(jid, {
        text: `❌ Oferta não encontrada!\n\nVer ofertas disponíveis: *!avenda*`
      }, { quoted: msg });
      return;
    }

    if (quantidade > oferta.quantidade) {
      await sock.sendMessage(jid, {
        text: `⚠️ *Quantidade indisponível!*\n\n📦 Disponível: *${oferta.quantidade}x ${oferta.itemNome}*\n📊 Você pediu: *${quantidade}*`
      }, { quoted: msg });
      return;
    }

    const custoTotal = oferta.preco * quantidade;
    const saldoAtual = await getSaldoAtual(userId);

    if (saldoAtual < custoTotal) {
      await sock.sendMessage(jid, {
        text: `❌ *SALDO INSUFICIENTE*\n\n💰 Você tem: *${saldoAtual}g*\n💸 Precisa: *${custoTotal}g*\n📊 Faltam: *${custoTotal - saldoAtual}g*`
      }, { quoted: msg });
      return;
    }

    // ── Transação atômica ──────────────────────────────────────────────────
    // 1. Deduzir quantidade da oferta (ou deletar se zerou)
    if (oferta.quantidade - quantidade === 0) {
      await Oferta.deleteOne({ _id: oferta._id });
    } else {
      await Oferta.findByIdAndUpdate(oferta._id, { $inc: { quantidade: -quantidade } });
    }

    // 2. Transferir gold
    const novoSaldoComprador = await changeGold(userId, -custoTotal);
    await changeGold(vendedorId, custoTotal);

    // 3. Adicionar ao inventário do comprador
    await adicionarAoInventario(userId, itemKey, quantidade);

    // ── Resposta ao comprador ──────────────────────────────────────────────
    const texto =
      `✅ *COMPRA REALIZADA!* ✅\n\n` +
      `📦 *Item:* ${oferta.itemNome}\n` +
      `📊 *Quantidade:* ${quantidade}\n` +
      `💵 *Preço unit.:* ${oferta.preco}g\n` +
      `💸 *Total pago:* ${custoTotal}g\n` +
      `👤 *Vendedor:* ${oferta.sellerName}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 *Seu novo saldo:* ${novoSaldoComprador}g`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });

    // ── Notificar o vendedor ───────────────────────────────────────────────
    try {
      const compradorNum = formatarNumero(userId);
      const notif =
        `🛒 *VENDA REALIZADA!*\n\n` +
        `📦 ${oferta.itemNome} × ${quantidade}\n` +
        `💰 Você recebeu: *+${custoTotal}g*\n` +
        `👤 Comprador: @${compradorNum}`;

      await sock.sendMessage(jid, {
        text: notif,
        mentions: [userId],
      });
    } catch (_) {
      // Notificação é best-effort; não travar por isso
    }

  } catch (e) {
    console.error('⚠️ Erro ao processar compra:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar a compra! Tente novamente.' }, { quoted: msg });
  }
}

// ─── !cancelaroferta ─────────────────────────────────────────────────────────

async function handleCancelarOferta(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const match  = caption.match(/cancelaroferta\s+(\S+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!cancelaroferta <item>*\nExemplo: *!cancelaroferta dinamite*'
    }, { quoted: msg });
    return;
  }

  const itemKey = match[1].toLowerCase().trim();

  try {
    const oferta = await Oferta.findOneAndDelete({ sellerId: userId, itemKey });

    if (!oferta) {
      await sock.sendMessage(jid, {
        text: `❌ Você não tem oferta ativa de *${itemKey}*.\n\nVer suas ofertas: *!minhasofertas*`
      }, { quoted: msg });
      return;
    }

    // Devolver itens ao inventário
    await adicionarAoInventario(userId, itemKey, oferta.quantidade);

    await sock.sendMessage(jid, {
      text: `✅ *OFERTA CANCELADA!*\n\n📦 *${oferta.itemNome}* × ${oferta.quantidade} devolvido(s) ao seu inventário.`
    }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao cancelar oferta:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao cancelar oferta!' }, { quoted: msg });
  }
}

// ─── !minhasofertas ───────────────────────────────────────────────────────────

async function handleMinhasOfertas(sock, msg, jid) {
  const userId = getUserId(msg);

  try {
    const ofertas = await Oferta.find({ sellerId: userId, quantidade: { $gt: 0 } });

    if (ofertas.length === 0) {
      await sock.sendMessage(jid, {
        text: `📦 *VOCÊ NÃO TEM OFERTAS ATIVAS*\n\nCrie uma com: *!ofertar <item> <preco> <qtd>*\nVer catálogo: *!avenda*`
      }, { quoted: msg });
      return;
    }

    let texto = `📊 *SUAS OFERTAS ATIVAS* 📊\n\n`;
    let totalPotencial = 0;

    for (const o of ofertas) {
      const totalItem = o.preco * o.quantidade;
      totalPotencial += totalItem;
      texto += `📦 *${o.itemNome}*\n`;
      texto += `   💵 ${o.preco}g × ${o.quantidade} un. = *${totalItem}g*\n`;
      texto += `   ❌ \`!cancelaroferta ${o.itemKey}\`\n\n`;
    }

    texto += `━━━━━━━━━━━━━━━━\n`;
    texto += `💰 *Potencial total:* ${totalPotencial}g`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro ao listar suas ofertas:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar suas ofertas!' }, { quoted: msg });
  }
}

// ─── Compatibilidade com código antigo ───────────────────────────────────────

async function handleOfertasRecebidas(sock, msg, jid) {
  return handleMinhasOfertas(sock, msg, jid);
}

async function handleAceitarOfferta(sock, msg, jid) {
  await sock.sendMessage(jid, {
    text: '💼 Use *!buy* para comprar ofertas!\n\nExemplo: *!buy 5511999999999 dinamite 2*\nVer ofertas: *!avenda*'
  }, { quoted: msg });
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handleAvenda,
  handleOfertar,
  handleBuy,
  handleCancelarOferta,
  handleMinhasOfertas,
  handleOfertasRecebidas,   // compatibilidade
  handleAceitarOfferta,     // compatibilidade
  Oferta,                   // model, caso precise em outros módulos
};