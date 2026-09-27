'use strict';

const Usuario       = require('../../../models/Usuario');
const CarteiraGrupo = require('../../../models/CarteiraGrupo');
const { getCarteira, alterarGold, comprarComGold } = require('../../../utils/carteira');
const { getSenderJid, resolveGlobalId, resolveUserFromMsg, extrairNumero } = require('../../../utils/identity');
const { ITENS_LOJA } = require('../../../config/economia');
const { VARAS_PESCA, ISCAS } = require('../pesca');
const { resolverItemKey } = require('./_shared');

// !gold
async function handleGold(sock, msg, jid, getPrefix, contactNames) {
  const userIdRaw = getSenderJid(msg);
  const userId    = resolveGlobalId(userIdRaw);
  const idGrupo   = jid;

  try {
    const carteira  = await getCarteira(userId, idGrupo);
    const gold      = carteira?.gold ?? 0;
    const numero    = extrairNumero(userIdRaw);
    const userName  = contactNames?.[userIdRaw] || contactNames?.[userId] || numero;

    let status = '🪨 Pobre';
    if (gold >= 1000)     status = '💰 Rico';
    else if (gold >= 500) status = '💵 Abastado';
    else if (gold >= 100) status = '💴 Confortável';

    const P = getPrefix(jid);
    const texto =
      `💰 *SALDO DE GOLD* 💰\n\n` +
      `👤 *${userName}*\n` +
      `💵 Saldo neste grupo: *${gold} gold*\n` +
      `📊 Status: ${status}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*FORMAS DE GANHAR:*\n` +
      `  📋 Missões: ${P}missao\n` +
      `  ⛏️ Garimpar: ${P}garimpar\n` +
      `  🎲 Apostar: ${P}apostar <valor>\n\n` +
      `*FORMAS DE GASTAR:*\n` +
      `  🛒 Loja: ${P}loja\n` +
      `  🎁 Comprar: ${P}comprar <item>\n` +
      `  💸 PIX: ${P}pix @pessoa <valor>`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleGold:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar saldo!' }, { quoted: msg });
  }
}

// !loja
async function handleLoja(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `🛒 *LOJA PIROQUINHAS* 🛒\n\n` +
    `📂 *CATEGORIAS DISPONÍVEIS*\n\n` +
    `🍔 *COMIDA* → ${P}lojafood\n` +
    `🐾 *PETS* → ${P}lojapet\n` +
    `💕 *CASAL* → ${P}lojacasal\n` +
    `💻 *TECNOLOGIA* → ${P}lojatec\n` +
    `🎣 *VARAS DE PESCA* → ${P}lojavara\n` +
    `🪱 *ISCAS* → ${P}lojaisca\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*COMO COMPRAR?*\n  ${P}buy <nome_item>\n\n` +
    `*SEUS ITENS?*\n  ${P}inventario\n\n` +
    `*VENDER ITENS?*\n  ${P}vender <item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Lojas específicas ────────────────────────────────────────────────────

// !lojafood
async function handleLojaFood(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🍕 PRINCIPAIS': ['pizza', 'hamburger', 'frango', 'picanha'],
    '🍫 DOCES':      ['chocolate', 'bolo'],
    '🥤 BEBIDAS':    ['refrigerante', 'cerveja'],
  };

  let texto = `🍔 ═══ LOJA DE COMIDA ═══ 🍔\n*ITENS DISPONÍVEIS:*\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `\n${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) {
        texto += `  🍽️ ${item.nome} — *${item.preco}* gold\n`;
        texto += `    └ chave: \`${k}\`\n`;
      }
    }
  }
  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `*COMANDOS:*\n` +
    `  ${P}buy <item>      — Comprar item\n` +
    `  ${P}inventario      — Ver seus itens\n` +
    `  ${P}vender <item>   — Vender item`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojapet
async function handleLojaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🦴 COMIDAS':      ['racao', 'racaopremium', 'carnefresh', 'peixe', 'leite'],
    '🎾 BRINQUEDOS':   ['bolinha', 'pelucia', 'corda', 'disco', 'casabrinquedo'],
    '💊 MEDICAMENTOS': ['remedio', 'vacina', 'shampoo', 'sabonete'],
    '🎀 ACESSÓRIOS':   ['coleira', 'coleiraouro', 'bandana', 'coroa'],
  };

  let texto = `🐾 ═══ LOJA DE PETS ═══ 🐾\n*ITENS DISPONÍVEIS:*\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `\n${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) {
        texto += `  🐾 ${item.nome} — *${item.preco}* gold\n`;
        texto += `    └ chave: \`${k}\`\n`;
      }
    }
  }
  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `*COMANDOS:*\n` +
    `  ${P}buy <item>      — Comprar item\n` +
    `  ${P}inventario      — Ver seus itens\n` +
    `  ${P}vender <item>   — Vender item`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojatec
async function handleLojaTec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🖥️ COMPUTADORES': ['notebook', 'pcgamerlegendario'],
    '📱 SMARTPHONES':  ['celular', 'smartphonebasico'],
    '🎮 PERIFÉRICOS':  ['mousegamer', 'monitor24'],
    '🎧 ÁUDIO':        ['fonesemfio'],
    '💾 ARMAZENAMENTO':['ssd1tb'],
  };

  let texto = `💻 ═══ LOJA DE TECNOLOGIA ═══ 💻\n*ITENS DISPONÍVEIS:*\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `\n${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) {
        texto += `  💻 ${item.nome} — *${item.preco}* gold\n`;
        texto += `    └ chave: \`${k}\`\n`;
      }
    }
  }
  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `*COMANDOS:*\n` +
    `  ${P}buy <item>      — Comprar item\n` +
    `  ${P}inventario      — Ver seus itens\n` +
    `  ${P}vender <item>   — Vender item`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojacasal
async function handleLojaCasal(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🎁 PRESENTES ROMÂNTICOS': ['flores', 'carta', 'morango', 'urso', 'caixa'],
    '💎 JOIAS':                ['anel'],
    '🍷 BEBIDAS E GOURMET':    ['garrafa', 'perfume'],
  };

  let texto = `💕 ═══ LOJA DE CASAL ═══ 💕\n*ITENS DISPONÍVEIS:*\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `\n${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) {
        texto += `  💕 ${item.nome} — *${item.preco}* gold\n`;
        texto += `    └ chave: \`${k}\`\n`;
      }
    }
  }
  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `*COMANDOS:*\n` +
    `  ${P}buy <item>      — Comprar item\n` +
    `  ${P}inventario      — Ver seus itens\n` +
    `  ${P}vender <item>   — Vender item\n\n` +
    `💑 _Mostre seu amor com presentes incríveis!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !buy ───────────────────────────────────────────────────────────────
// Gold debitado da CarteiraGrupo; inventário salvo no Usuario global.

async function handleComprar(sock, msg, jid, caption) {
  const userId  = resolveUserFromMsg(msg);
  const idGrupo = jid;
  const match   = caption.match(/buy\s+(.+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!buy <nome_do_item>*\nExemplo: *!buy pizza*' }, { quoted: msg });
    return;
  }

  const itemDigitado = match[1].trim();

  // Aceita tanto a chave técnica quanto o nome de exibição (com ou sem
  // acento/espaço), tanto para itens da loja quanto de pesca.
  const itemNome = resolverItemKey(itemDigitado);

  const itemInfo = itemNome
    ? (ITENS_LOJA[itemNome] || VARAS_PESCA?.[itemNome] || ISCAS?.[itemNome])
    : null;

  if (!itemInfo) {
    const lista = Object.entries(ITENS_LOJA)
      .slice(0, 15)
      .map(([, v]) => `  • ${v.nome} (${v.preco} gold)`)
      .join('\n');
    await sock.sendMessage(jid, {
      text:
        `⚠️ *ITEM NÃO ENCONTRADO*\n\nO item *${itemDigitado}* não existe!\n\n` +
        `━━━━━━━━━━━━━━━━\n*ITENS DISPONÍVEIS:*\n${lista}\n\n` +
        `*USE:*\n  !buy <item>\n  Exemplo: !buy pizza`,
    }, { quoted: msg });
    return;
  }

  const preco   = itemInfo.preco;
  const ehPesca = !!(VARAS_PESCA?.[itemNome] || ISCAS?.[itemNome]);

  const resultado = await comprarComGold({
    idWhatsApp: userId,
    idGrupo,
    preco,
    descricaoGold: `Compra: ${itemInfo.nome}`,
    modeloInventario: ehPesca ? CarteiraGrupo : Usuario,
    filtroInventario: ehPesca
      ? { idWhatsApp: userId, idGrupo }
      : { idWhatsApp: userId },
    campoInventario: ehPesca
      ? `itensPesca.${itemNome}`
      : `inventory.${itemNome}`,
  });

  if (!resultado.ok) {
    if (resultado.motivo === 'GOLD_INSUFICIENTE') {
      const carteiraAtual = await getCarteira(userId, idGrupo);
      const saldoAtual    = carteiraAtual?.gold ?? 0;
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${preco}* gold neste grupo!\n\n` +
          `━━━━━━━━━━━━━━━━\n*SEU SALDO:*\n` +
          `  💰 Disponível: *${saldoAtual}* gold\n` +
          `  💎 Precisa de: *${preco}* gold`,
      }, { quoted: msg });
      return;
    }
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar a compra. Nada foi debitado. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  const saldoFinal = resultado.carteira?.gold ?? 0;

  await sock.sendMessage(jid, {
    text:
      `✅ ═══ COMPRA REALIZADA! ═══ ✅\n\n` +
      `🛒 *Você comprou com sucesso!*\n\n` +
      `━━━━━━━━━━━━━━━━\n*DETALHES:*\n` +
      `  📦 Item: *${itemInfo.nome}*\n` +
      `  💵 Preço: *${preco}* gold\n\n` +
      `━━━━━━━━━━━━━━━━\n*SALDO ATUALIZADO:*\n` +
      `  ✅ Novo saldo: *${saldoFinal}* gold`,
  }, { quoted: msg });
}

// ─── !vender (sem mudança de lógica) ─────────────────────────────────────

async function handleVender(sock, msg, jid, caption) {
  const userId = resolveUserFromMsg(msg);
  const match  = caption.match(/vender\s+(\S+)\s+(\d+)\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!vender <item> <preco> <quantidade>*\nExemplo: *!vender pizza 50 3*',
    }, { quoted: msg });
    return;
  }

  const itemKey    = match[1].toLowerCase().trim();
  const preco      = parseInt(match[2]);
  const quantidade = parseInt(match[3]);
  const itemInfo   = ITENS_LOJA[itemKey];

  if (!itemInfo) {
    await sock.sendMessage(jid, { text: `⚠️ Item *${itemKey}* não existe! Use *!loja* para ver os itens.` }, { quoted: msg });
    return;
  }
  if (preco <= 0 || quantidade <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Preço e quantidade devem ser maiores que 0!' }, { quoted: msg });
    return;
  }

  // Verifica se o usuário tem o item no inventário
  const user = await Usuario.findOne({ idWhatsApp: userId }).select('inventory').lean();
  const qtdDisponivel = user?.inventory?.[itemKey] ?? 0;

  if (qtdDisponivel < quantidade) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ *ESTOQUE INSUFICIENTE*\n\n` +
        `📦 Você tem: *${qtdDisponivel}x ${itemInfo.nome}*\n` +
        `📊 Precisa de: *${quantidade}x*`,
    }, { quoted: msg });
    return;
  }

  // Remove do inventário — atômico, só se ainda houver estoque suficiente
  const removido = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, [`inventory.${itemKey}`]: { $gte: quantidade } },
    { $inc: { [`inventory.${itemKey}`]: -quantidade } }
  );
  if (!removido) {
    await sock.sendMessage(jid, {
      text: `⚠️ Estoque de *${itemInfo.nome}* mudou antes da venda ser concluída. Tente novamente.`,
    }, { quoted: msg });
    return;
  }

  // Credita o gold
  const totalRecebido = preco * quantidade;
  const carteira = await alterarGold(userId, jid, totalRecebido, `Venda: ${itemInfo.nome} x${quantidade}`);

  await sock.sendMessage(jid, {
    text:
      `✅ *VENDA REALIZADA!* ✅\n\n` +
      `📦 Item: *${itemInfo.nome}*\n` +
      `💵 Preço unitário: *${preco} gold*\n` +
      `📊 Quantidade: *${quantidade}*\n` +
      `💰 Total recebido: *${totalRecebido} gold*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💎 Novo saldo: *${carteira?.gold ?? '?'} gold*`,
  }, { quoted: msg });
}

// ─── !inventario ──────────────────────────────────────────────────────────

const MSG_INVENTARIO_VAZIO =
  `📦 *SEU INVENTÁRIO* 📦\n\n` +
  `Você não possui itens no momento!\n\n` +
  `*COMO GANHAR ITENS?*\n` +
  `  🛒 Comprar na loja: *!loja*\n` +
  `  📋 Completar missões: *!missao*\n\n` +
  `Use *!buy <item>* para começar!`;

async function handleInventario(sock, msg, jid) {
  const userId = resolveUserFromMsg(msg);

  const [user, carteira] = await Promise.all([
    Usuario.findOne({ idWhatsApp: userId }).select('inventory').lean(),
    getCarteira(userId, jid),
  ]);

  const itensValidos = Object.entries(user?.inventory ?? {})
    .filter(([key, qtd]) => qtd > 0 && ITENS_LOJA[key])
    .map(([key, qtd]) => ({ info: ITENS_LOJA[key], qtd }));

  if (itensValidos.length === 0) {
    await sock.sendMessage(jid, { text: MSG_INVENTARIO_VAZIO }, { quoted: msg });
    return;
  }

  const totalItens = itensValidos.reduce((acc, { qtd }) => acc + qtd, 0);

  // Agrupa por categoria
  const porCategoria = {};
  for (const { info, qtd } of itensValidos) {
    const cat = info.categoria || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(`  • ${info.nome} × ${qtd}`);
  }

  const EMOJI_CAT = {
    comida: '🍔', petcomida: '🦴', petbrinquedo: '🎾', petcuidado: '💊',
    petacessorio: '🎀', especial: '⭐', casal: '💕', tec: '💻',
    estilo: '👗', pet: '🐾', outros: '📦',
  };

  const linhas = Object.entries(porCategoria)
    .map(([cat, items]) => `${EMOJI_CAT[cat] ?? '📦'} *${cat.toUpperCase()}*\n${items.join('\n')}`)
    .join('\n\n');

  await sock.sendMessage(jid, {
    text:
      `📦 *SEU INVENTÁRIO* 📦\n\n` +
      `${linhas}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*TOTAL:* ${totalItens} item(ns)\n\n` +
      `💰 *SALDO NESTE GRUPO:* *${carteira?.gold ?? 0} gold*`,
  }, { quoted: msg });
}

module.exports = {
  handleGold,
  handleLoja,
  handleLojaFood,
  handleLojaPet,
  handleLojaTec,
  handleLojaCasal,
  handleComprar,
  handleVender,
  handleInventario,
};