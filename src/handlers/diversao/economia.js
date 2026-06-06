/**
 * Handler de Economia — Piroquinhas Bot
 * Sistema de Gold, Loja, Compra, Venda, Garimpo
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── CONSTANTES E DADOS GLOBAIS ───────────────────────────────────────────
const ITENS_LOJA = {
  // COMIDAS
  pizza: { nome: 'Pizza Margherita', preco: 50, categoria: 'comida' },
  pizzapeperoni: { nome: 'Pizza Pepperoni', preco: 60, categoria: 'comida' },
  pizza4queijos: { nome: 'Pizza 4 Queijos', preco: 70, categoria: 'comida' },
  pizzavegetariana: { nome: 'Pizza Vegetariana', preco: 45, categoria: 'comida' },
  pizzafrango: { nome: 'Pizza Frango com Milho', preco: 65, categoria: 'comida' },
  hamburger: { nome: 'Hamburger Simples', preco: 40, categoria: 'comida' },
  hamburgerduplo: { nome: 'Hamburger Duplo', preco: 70, categoria: 'comida' },
  xtudo: { nome: 'X-Tudo', preco: 85, categoria: 'comida' },
  hotdog: { nome: 'Hot Dog', preco: 35, categoria: 'comida' },
  taco: { nome: 'Taco', preco: 42, categoria: 'comida' },
  sanduiche: { nome: 'Sanduíche', preco: 45, categoria: 'comida' },
  frango: { nome: 'Frango Frito', preco: 35, categoria: 'comida' },
  costela: { nome: 'Costela', preco: 80, categoria: 'comida' },
  picanha: { nome: 'Picanha', preco: 120, categoria: 'comida' },
  linguica: { nome: 'Linguiça', preco: 55, categoria: 'comida' },
  carne: { nome: 'Carne Moída', preco: 60, categoria: 'comida' },
  chocolate: { nome: 'Chocolate', preco: 25, categoria: 'comida' },
  bolobocolate: { nome: 'Bolo de Chocolate', preco: 65, categoria: 'comida' },
  sorvete: { nome: 'Sorvete', preco: 30, categoria: 'comida' },
  pudim: { nome: 'Pudim', preco: 35, categoria: 'comida' },
  biscoito: { nome: 'Biscoito', preco: 15, categoria: 'comida' },
  donut: { nome: 'Donut', preco: 20, categoria: 'comida' },
  bolo: { nome: 'Bolo de Aniversário', preco: 150, categoria: 'comida' },
  refrigerante: { nome: 'Refrigerante', preco: 10, categoria: 'comida' },
  cafe: { nome: 'Café', preco: 8, categoria: 'comida' },
  suco: { nome: 'Suco Natural', preco: 12, categoria: 'comida' },
  vinho: { nome: 'Vinho', preco: 100, categoria: 'comida' },
  cerveja: { nome: 'Cerveja', preco: 80, categoria: 'comida' },
  
  // COMIDA PARA PETS
  racao: { nome: 'Ração Normal', preco: 20, categoria: 'petcomida' },
  racaopremium: { nome: 'Ração Premium', preco: 45, categoria: 'petcomida' },
  racaogourmet: { nome: 'Ração Gourmet', preco: 75, categoria: 'petcomida' },
  carnefresh: { nome: 'Carne Fresca', preco: 55, categoria: 'petcomida' },
  osso: { nome: 'Osso Saboroso', preco: 40, categoria: 'petcomida' },
  arrozfeijao: { nome: 'Arroz com Feijão', preco: 30, categoria: 'petcomida' },
  peixe: { nome: 'Peixe Fresco', preco: 60, categoria: 'petcomida' },
  leite: { nome: 'Leite', preco: 15, categoria: 'petcomida' },
  cenoura: { nome: 'Cenoura', preco: 12, categoria: 'petcomida' },
  maca: { nome: 'Maçã', preco: 18, categoria: 'petcomida' },
  
  // BRINQUEDOS
  bolinha: { nome: 'Bolinha de Tênis', preco: 35, categoria: 'petbrinquedo' },
  pelucia: { nome: 'Pelúcia', preco: 50, categoria: 'petbrinquedo' },
  corda: { nome: 'Corda de Puxar', preco: 40, categoria: 'petbrinquedo' },
  disco: { nome: 'Disco Voador', preco: 60, categoria: 'petbrinquedo' },
  bolacrocante: { nome: 'Bola Crocante', preco: 45, categoria: 'petbrinquedo' },
  pena: { nome: 'Pena Interativa', preco: 30, categoria: 'petbrinquedo' },
  casabrinquedo: { nome: 'Casa de Brinquedo', preco: 150, categoria: 'petbrinquedo' },
  
  // CUIDADOS
  remedio: { nome: 'Remédio Geral', preco: 80, categoria: 'petcuidado' },
  bandagem: { nome: 'Bandagem', preco: 50, categoria: 'petcuidado' },
  vacina: { nome: 'Vacina', preco: 120, categoria: 'petcuidado' },
  shampoo: { nome: 'Shampoo Especial', preco: 70, categoria: 'petcuidado' },
  sabonete: { nome: 'Sabonete Pet', preco: 40, categoria: 'petcuidado' },
  escova: { nome: 'Escova de Dentes', preco: 35, categoria: 'petcuidado' },
  
  // ACESSÓRIOS PET
  coleira: { nome: 'Coleira Colorida', preco: 55, categoria: 'petacessorio' },
  coleiraouro: { nome: 'Coleira de Ouro', preco: 200, categoria: 'petacessorio' },
  peitoral: { nome: 'Peitoral', preco: 65, categoria: 'petacessorio' },
  bandana: { nome: 'Bandana', preco: 45, categoria: 'petacessorio' },
  coroa: { nome: 'Coroa Pet', preco: 100, categoria: 'petacessorio' },
  placaid: { nome: 'Placa de ID', preco: 75, categoria: 'petacessorio' },
  
  // ITEMS ESPECIAIS
  trofeu: { nome: 'Troféu Miniatura', preco: 250, categoria: 'especial' },
  pocaoenergia: { nome: 'Poção de Energia', preco: 180, categoria: 'especial' },
  gema: { nome: 'Gema Brilhante', preco: 300, categoria: 'especial' },
  cristal: { nome: 'Cristal Mágico', preco: 400, categoria: 'especial' },
  
  // ANTIGOS (compatibilidade)
  cachorro: { nome: 'Cachorro', preco: 100, categoria: 'pet' },
  gato: { nome: 'Gato', preco: 100, categoria: 'pet' },
  coelho: { nome: 'Coelho', preco: 80, categoria: 'pet' },
  flores: { nome: 'Flores', preco: 60, categoria: 'casal' },
  carta: { nome: 'Carta de Amor', preco: 80, categoria: 'casal' },
  anel: { nome: 'Anel', preco: 500, categoria: 'casal' },
  camiseta: { nome: 'Camiseta', preco: 50, categoria: 'estilo' },
  calcas: { nome: 'Calças', preco: 60, categoria: 'estilo' },
  sapato: { nome: 'Sapato', preco: 70, categoria: 'estilo' },
  celular: { nome: 'Celular', preco: 200, categoria: 'tec' },
  usb: { nome: 'Memória USB', preco: 150, categoria: 'tec' },
  computador: { nome: 'Computador', preco: 500, categoria: 'tec' },
  
  // LOJA DE TECNOLOGIA
  notebook: { nome: 'Notebook Gamer', preco: 5000, categoria: 'tec' },
  notebooki5: { nome: 'Notebook i5', preco: 3500, categoria: 'tec' },
  desktop: { nome: 'Desktop Gaming', preco: 6000, categoria: 'tec' },
  pccustom: { nome: 'PC Gamer Custom', preco: 8000, categoria: 'tec' },
  laptopfino: { nome: 'Laptop Ultrafino', preco: 4500, categoria: 'tec' },
  workstation: { nome: 'Workstation Pro', preco: 9999, categoria: 'tec' },
  smartphonepremium: { nome: 'Smartphone Premium', preco: 2500, categoria: 'tec' },
  smartphonegamer: { nome: 'Smartphone Gamer', preco: 3500, categoria: 'tec' },
  smartphonebasico: { nome: 'Smartphone Básico', preco: 1500, categoria: 'tec' },
  tablet10: { nome: 'Tablet 10"', preco: 2000, categoria: 'tec' },
  tabletpro: { nome: 'Tablet Pro', preco: 3500, categoria: 'tec' },
  ereader: { nome: 'E-reader', preco: 1800, categoria: 'tec' },
  mousegamer: { nome: 'Mouse Gamer', preco: 350, categoria: 'tec' },
  tecladomecanico: { nome: 'Teclado Mecânico', preco: 450, categoria: 'tec' },
  tecladorgb: { nome: 'Teclado RGB', preco: 600, categoria: 'tec' },
  monitor24: { nome: 'Monitor 24"', preco: 1200, categoria: 'tec' },
  monitor4k: { nome: 'Monitor 4K', preco: 2500, categoria: 'tec' },
  mousepad: { nome: 'Mousepad Grande', preco: 150, categoria: 'tec' },
  webcam: { nome: 'Webcam 1080p', preco: 500, categoria: 'tec' },
  headsetgamer: { nome: 'Headset Gamer', preco: 800, categoria: 'tec' },
  fonesemfio: { nome: 'Fone Sem Fio', preco: 600, categoria: 'tec' },
  fonecancelamento: { nome: 'Fone com Cancelamento', preco: 1200, categoria: 'tec' },
  microusbfone: { nome: 'Microfone USB', preco: 400, categoria: 'tec' },
  microprofissional: { nome: 'Microfone Profissional', preco: 1500, categoria: 'tec' },
  caixabluetooth: { nome: 'Caixa Bluetooth', preco: 350, categoria: 'tec' },
  altofalante: { nome: 'Alto-falante Smart', preco: 800, categoria: 'tec' },
  cabousbc: { nome: 'Cabo USB-C', preco: 50, categoria: 'tec' },
  cabohdmi: { nome: 'Cabo HDMI', preco: 40, categoria: 'tec' },
  carregadorrapido: { nome: 'Carregador Rápido', preco: 200, categoria: 'tec' },
  adaptadorusb: { nome: 'Adaptador USB', preco: 80, categoria: 'tec' },
  hub7portas: { nome: 'Hub USB 7 Portas', preco: 300, categoria: 'tec' },
  ssd1tb: { nome: 'SSD 1TB', preco: 800, categoria: 'tec' },
  ssd2tb: { nome: 'SSD 2TB', preco: 1500, categoria: 'tec' },
  ram16gb: { nome: 'Memória RAM 16GB', preco: 600, categoria: 'tec' },
  powerbank20: { nome: 'PowerBank 20000mAh', preco: 400, categoria: 'tec' },
  powerbanksolar: { nome: 'PowerBank Solar', preco: 550, categoria: 'tec' },
  suportemagnetico: { nome: 'Suporte Magnético', preco: 120, categoria: 'tec' },
  casecelular: { nome: 'Case para Celular', preco: 150, categoria: 'tec' },
  protetortela: { nome: 'Protetor de Tela', preco: 80, categoria: 'tec' },
  mochilatech: { nome: 'Mochila Tech', preco: 450, categoria: 'tec' },
  bolsalaptop: { nome: 'Bolsa Laptop', preco: 350, categoria: 'tec' },
  fonepremium: { nome: 'Fone Premium', preco: 2000, categoria: 'tec' },
  monitorcurvo: { nome: 'Monitor Curvo 4K', preco: 4000, categoria: 'tec' },
  pcgamerlegendario: { nome: 'PC Gamer Lendário', preco: 15000, categoria: 'tec' },
  setupgamer: { nome: 'Setup Completo Gamer', preco: 12000, categoria: 'tec' },
  gpu4090: { nome: 'GPU RTX 4090', preco: 8000, categoria: 'tec' },
};

const lastGarimpTime = {};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────

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
      { upsert: true, new: true }
    );
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

// ─── !gold
async function handleGold(sock, msg, jid, getPrefix) {
  const userId = msg.key.participant;
  
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    const gold = user?.gold || 0;
    const userName = userId.split('@')[0];
    
    let status = '💰 POBRE';
    if (gold >= 1000) status = '💰 RICO';
    else if (gold >= 500) status = '💵 ABASTADO';
    else if (gold >= 100) status = '💴 CONFORTÁVEL';
    
    const texto = `💰 *SALDO DE GOLD* 💰

👤 *${userName}*
💵 Gold: *${gold}*
📊 Status: ${status}

━━━━━━━━━━━━━━━━
*FORMAS DE GANHAR:*
  📋 Missões: !missao
  🔍 Garimpar: !garimpar
  🛍️ Vender: !vender <item>
  💼 Banco: !banco <quantia>
  
*FORMAS DE GASTAR:*
  🛒 Loja: !loja
  🎁 Comprar: !comprar <item>
  💸 Investir: !banco <quantia>`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleGold:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar saldo!' }, { quoted: msg });
  }
}

// ─── !loja
async function handleLoja(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  
  let texto = `🛒 *LOJA PIROQUINHAS* 🛒\n\n`;
  texto += `🍔 *COMIDA*
🍕 Pizza — 50 gold
🍔 Hamburger — 40 gold
🍗 Frango — 35 gold
🍫 Chocolate — 25 gold

🐾 *PETS*
🐶 Cachorro — 100 gold
🐱 Gato — 100 gold
🐰 Coelho — 80 gold

💕 *CASAL*
💐 Flores — 60 gold
💌 Carta de amor — 80 gold
💎 Anel — 500 gold

✨ *ESTILO*
👕 Camiseta — 50 gold
👖 Calça — 60 gold
👟 Sapato — 70 gold

💻 *TECNOLOGIA*
📱 Celular — 200 gold
💾 Memória USB — 150 gold
🖥️ Computador — 500 gold

━━━━━━━━━━━━━━━━
*COMO COMPRAR?*
  ${P}comprar <nome_item>
  
*SEUS ITENS?*
  ${P}inventario
  
*VENDER ITENS?*
  ${P}vender <item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !lojafood
async function handleLojaFood(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `🍔 *LOJA DE COMIDA* 🍔

🍕 *PIZZAS*
  🍕 Pizza Margherita — 50 gold
  🍕 Pizza Pepperoni — 60 gold
  🍕 Pizza 4 Queijos — 70 gold

🍔 *LANCHES*
  🍔 Hamburger Simples — 40 gold
  🌭 Hot Dog — 35 gold
  🥪 Sanduíche — 45 gold

🍗 *CARNES*
  🍗 Frango Frito — 35 gold
  🍗 Costela — 80 gold

🍫 *DOCES*
  🍫 Chocolate — 25 gold
  🍰 Bolo — 65 gold
  🍦 Sorvete — 30 gold

━━━━━━━━━━━━━━━━
*COMO COMPRAR?*
  ${P}comprar <nome_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !lojapet
async function handleLojaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `🐾 *LOJA DE PETS* 🐾

🦴 *COMIDAS*
  🦴 Ração Normal — 20 gold
  🦴 Ração Premium — 45 gold
  🍖 Osso Saboroso — 40 gold

🎾 *BRINQUEDOS*
  🎾 Bolinha de Tênis — 35 gold
  🧸 Pelúcia — 50 gold
  🎪 Disco Voador — 60 gold

💊 *MEDICAMENTOS*
  💊 Remédio Geral — 80 gold
  🩹 Bandagem — 50 gold
  💉 Vacina — 120 gold

⚙️ *ACESSÓRIOS*
  🎀 Coleira Colorida — 55 gold
  👑 Coroa Pet — 100 gold

━━━━━━━━━━━━━━━━
*COMO COMPRAR?*
  ${P}comprar <nome_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !lojatec
async function handleLojaTec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `💻 *LOJA DE TECNOLOGIA* 💻

🖥️ *COMPUTADORES*
  🖥️ Notebook Gamer — 5000 gold
  💾 Notebook i5 — 3500 gold
  🖥️ Desktop Gaming — 6000 gold

📱 *SMARTPHONES*
  📱 Smartphone Premium — 2500 gold
  📱 Smartphone Gamer — 3500 gold
  📱 Tablet Pro — 3500 gold

🎮 *PERIFÉRICOS*
  🖱️ Mouse Gamer — 350 gold
  ⌨️ Teclado Mecânico — 450 gold
  🖥️ Monitor 4K — 2500 gold
  🎧 Headset Gamer — 800 gold

🔌 *ACESSÓRIOS*
  🔌 Cabo USB-C — 50 gold
  💾 SSD 1TB — 800 gold
  💾 SSD 2TB — 1500 gold
  💾 Memória RAM 16GB — 600 gold

━━━━━━━━━━━━━━━━
*COMO COMPRAR?*
  ${P}comprar <nome_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprar
async function handleComprar(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/comprar\s+(.+)/i);
  
  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprar <nome_do_item>*\nExemplo: *!comprar pizza*' }, { quoted: msg });
    return;
  }
  
  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_LOJA[itemNome];
  
  if (!itemInfo) {
    const listaItens = Object.entries(ITENS_LOJA)
      .slice(0, 15)
      .map(([key, val]) => `  • ${val.nome} (${val.preco} gold)`)
      .join('\n');
    
    const texto = `⚠️ *ITEM NÃO ENCONTRADO*\n\nO item *${itemNome}* não existe!\n\n━━━━━━━━━━━━━━━━\n*ITENS DISPONÍVEIS:*\n${listaItens}\n\n*USE:*\n  !comprar <item>\n  Exemplo: !comprar pizza`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const preco = itemInfo.preco;
  const saldoAtual = await getSaldoAtual(userId);
  
  if (saldoAtual < preco) {
    const texto = `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${preco}* gold!\n\n━━━━━━━━━━━━━━━━\n*SEU SALDO:*\n  💰 Disponível: *${saldoAtual}* gold\n  💎 Precisa de: *${preco}* gold`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const saldoFinal = await changeGold(userId, -preco);
  
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { [`inventory.${itemNome}`]: 1 } },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao adicionar ao inventário:', e.message);
  }
  
  const texto = `✅ ═══ COMPRA REALIZADA! ═══ ✅\n\n🛒 *Você comprou com sucesso!*\n\n━━━━━━━━━━━━━━━━\n*DETALHES:*\n  📦 Item: *${itemInfo.nome}*\n  💵 Preço: *${preco}* gold\n\n━━━━━━━━━━━━━━━━\n*SALDO ATUALIZADO:*\n  ✅ Novo saldo: *${saldoFinal}* gold`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !vender
async function handleVender(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/vender\s+(\S+)\s+(\d+)\s+(\d+)/i);
  
  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!vender <item> <preco> <quantidade>*\nExemplo: *!vender pizza 50 3*' }, { quoted: msg });
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
  
  const sellerName = userId.split('@')[0];
  const texto = `✅ *OFERTA CRIADA!* ✅\n\n📦 *Item:* ${itemInfo.nome}\n💵 *Preço:* ${preco} gold cada\n📊 *Quantidade:* ${quantidade}\n👤 *Vendedor:* ${sellerName}\n\n━━━━━━━━━━━━━━━━\n*PRÓXIMOS PASSOS:*\n  Ver ofertas: *!avenda*`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !inventario
async function handleInventario(sock, msg, jid) {
  const userId = msg.key.participant;
  
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    
    if (!user || !user.inventory) {
      const texto = `📦 *SEU INVENTÁRIO* 📦\n\nVocê não possui itens no momento!\n\n*COMO GANHAR ITENS?*\n  🛒 Comprar na loja: !loja\n  📋 Completar missões: !missao\n\nUse *!comprar <item>* para começar!`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    let texto = `📦 *SEU INVENTÁRIO* 📦\n\n`;
    let totalItens = 0;
    
    for (const [itemKey, quantidade] of Object.entries(user.inventory || {})) {
      const itemInfo = ITENS_LOJA[itemKey];
      if (itemInfo && quantidade > 0) {
        texto += `  • ${itemInfo.nome} × ${quantidade}\n`;
        totalItens += quantidade;
      }
    }
    
    if (totalItens === 0) {
      const texto = `📦 *SEU INVENTÁRIO* 📦\n\nVocê não possui itens no momento!`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    texto += `\n━━━━━━━━━━━━━━━━\n*TOTAL:* ${totalItens} item(ns)\n\n💰 *SEU SALDO:*\n  Gold: *${user.gold || 0}* gold`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleInventario:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar inventário!' }, { quoted: msg });
  }
}

// ─── !pix (transferência corrigida com tratamento de menções)
async function handlePix(sock, msg, jid, caption) {
  // Pega o ID de quem enviou com segurança
  const userId = msg.key.participant || msg.key.remoteJid;
  
  // 1. Tenta pegar o JID do alvo direto pelas menções oficiais do WhatsApp (@Felipe)
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  let targetJid = mentionedJid;
  let numeroPura = '';

  // 2. Se não houver menção clicável, tenta extrair pelo texto via Regex
  const match = caption.match(/(?:pix|transferir)\s+@?(\d+)\s+(\d+)/i);
  let quantia = 0;

  if (targetJid) {
    // Se achou por menção, o número puro para exibição é extraído do próprio JID
    numeroPura = targetJid.split('@')[0];
    // Captura a quantia (última palavra/número da mensagem)
    const parts = caption.trim().split(/\s+/);
    quantia = parseInt(parts[parts.length - 1]);
  } else if (match) {
    // Fallback caso tenham digitado o número manualmente sem marcar
    numeroPura = match[1].replace(/\D/g, ''); 
    targetJid = `${numeroPura}@s.whatsapp.net`;
    quantia = parseInt(match[2]);
  }

  // Se não encontrou alvo ou quantia por nenhum dos métodos, cancela
  if (!targetJid || isNaN(quantia) || quantia <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!pix @nome quantia* ou *!pix @numero quantia*\nExemplo: *!pix @Felipe 30*' }, { quoted: msg });
    return;
  }
  
  // Impede o usuário de fazer um PIX para si mesmo
  if (userId === targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Você não pode fazer um PIX para você mesmo!' }, { quoted: msg });
    return;
  }

  const saldoAtual = await getSaldoAtual(userId);
  
  if (saldoAtual < quantia) {
    await sock.sendMessage(jid, { text: `⚠️ Saldo insuficiente!\n\n💰 Você tem: *${saldoAtual}* gold\n💸 Precisa de: *${quantia}* gold` }, { quoted: msg });
    return;
  }
  
  // Executa a transferência no Banco de Dados
  await changeGold(userId, -quantia);
  await changeGold(targetJid, quantia);
  
  const novoSaldo = await getSaldoAtual(userId);
  
  await sock.sendMessage(jid, { 
    text: `✅ *Transferência realizada!*\n\n💵 *${quantia} gold* enviado com sucesso para *@${numeroPura}*\n📊 Seu novo saldo: *${novoSaldo}* gold`,
    mentions: [targetJid, userId] // Crucial para o WhatsApp atualizar as notificações de saldo dos dois
  }, { quoted: msg });
}
// ─── !apostar
async function handleApostar(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/apostar\s+(\d+)/i);
  
  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!apostar <quantia>*\nExemplo: *!apostar 100*' }, { quoted: msg });
    return;
  }
  
  const aposta = parseInt(match[1]);
  
  if (isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ *QUANTIA INVÁLIDA*\n\nA aposta deve ser um número positivo!' }, { quoted: msg });
    return;
  }
  
  const saldoAtual = await getSaldoAtual(userId);
  
  if (saldoAtual < aposta) {
    const texto = `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${aposta}* gold para apostar!`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const resultado = Math.random() > 0.5;
  
  if (resultado) {
    const ganho = Math.floor(aposta * 1.5);
    const saldoFinal = await changeGold(userId, ganho);
    
    const texto = `🎉 ═══ VOCÊ GANHOU! ═══ 🎉\n\n🎲 *Parabéns, sua sorte foi boa!*\n\n━━━━━━━━━━━━━━━━\n*RESULTADO:*\n  🎲 Aposta: *${aposta}* gold\n  💰 Ganho: *+${ganho}* gold\n\n*SALDO:* *${saldoFinal}* gold`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } else {
    const saldoFinal = await changeGold(userId, -aposta);
    
    const texto = `😢 ═══ VOCÊ PERDEU! ═══ 😢\n\n🎲 *Que azar...*\n\n━━━━━━━━━━━━━━━━\n*RESULTADO:*\n  🎲 Aposta: *${aposta}* gold\n\n*SALDO:* *${saldoFinal}* gold`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

// ─── !extrato
async function handleExtrato(sock, msg, jid) {
  const texto = `📊 *EXTRATO DE TRANSAÇÕES* 📊\n\n*ÚLTIMAS TRANSAÇÕES:*\n  💵 +500 gold | Missão\n  💸 -100 gold | Compra\n  💰 +200 gold | Garimpo\n\n━━━━━━━━━━━━━━━━\n*RESUMO:*\n  ✅ Entrada: 700 gold\n  ❌ Saída: 100 gold\n  💰 Saldo atual: 600 gold\n\nUse *!gold* para ver seu saldo!`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !garimpar
async function handleGarimpar(sock, msg, jid, getPrefix) {
  const userId = msg.key.participant;
  const agora = Date.now();
  const UM_HORA = 3600000;
  
  if (lastGarimpTime[userId]) {
    const tempoDecorrido = agora - lastGarimpTime[userId];
    if (tempoDecorrido < UM_HORA) {
      const tempoRestante = Math.ceil((UM_HORA - tempoDecorrido) / 60000);
      const texto = `⏳ *GARIMPO EM COOLDOWN* ⏳\n\n⛏️ Você já garimpou!\n\n📊 Tempo restante: *${tempoRestante} minutos*`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
  }
  
  try {
    const ouro = Math.floor(Math.random() * 100) + 30;
    const novoSaldo = await changeGold(userId, ouro);
    lastGarimpTime[userId] = agora;
    
    const texto = `⛏️ *GARIMPO* ⛏️\n\n⛏️ Você está garimpando...\n\n💎 Você encontrou *${ouro} gold*!\n\n━━━━━━━━━━━━━━━━\n📊 Novo saldo: *${novoSaldo}* gold\n⏰ Próximo garimpo em: *1 hora*`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar!' }, { quoted: msg });
  }
}

module.exports = {
  handleGold,
  handleLoja,
  handleLojaFood,
  handleLojaPet,
  handleLojaTec,
  handleComprar,
  handleVender,
  handleInventario,
  handlePix,
  handleApostar,
  handleExtrato,
  handleGarimpar,
  getSaldoAtual,
  changeGold,
  ITENS_LOJA,
};
