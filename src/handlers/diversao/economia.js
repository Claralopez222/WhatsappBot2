/**
 * Handler de Economia — Piroquinhas Bot
 * Sistema de Gold, Loja, Compra, Venda, Garimpo
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { prepareDailyMissionState } = require('./missoes');

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
  
  // CASAL - PRESENTES E ITENS ROMÂNTICOS
  flores: { nome: 'Flores', preco: 60, categoria: 'casal' },
  carta: { nome: 'Carta de Amor', preco: 80, categoria: 'casal' },
  anel: { nome: 'Anel', preco: 500, categoria: 'casal' },
  chocolate: { nome: 'Caixa de Chocolate', preco: 75, categoria: 'casal' },
  morango: { nome: 'Morango com Chocolate', preco: 55, categoria: 'casal' },
  vela: { nome: 'Vela Aromática', preco: 90, categoria: 'casal' },
  perfume: { nome: 'Perfume Premium', preco: 150, categoria: 'casal' },
  colar: { nome: 'Colar Casal', preco: 200, categoria: 'casal' },
  pulseira: { nome: 'Pulseira Casal', preco: 120, categoria: 'casal' },
  camisetacasal: { nome: 'Camiseta Casal', preco: 110, categoria: 'casal' },
  gorro: { nome: 'Gorro Casal', preco: 85, categoria: 'casal' },
  chinelo: { nome: 'Chinelo de Casal', preco: 95, categoria: 'casal' },
  urso: { nome: 'Ursinho de Pelúcia', preco: 130, categoria: 'casal' },
  caixa: { nome: 'Caixa Presente Luxo', preco: 50, categoria: 'casal' },
  coração: { nome: 'Coração Decorativo', preco: 140, categoria: 'casal' },
  foto: { nome: 'Moldura Foto Casal', preco: 110, categoria: 'casal' },
  chá: { nome: 'Chá Especial Casal', preco: 70, categoria: 'casal' },
  taça: { nome: 'Taça para Vinho', preco: 160, categoria: 'casal' },
  garrafa: { nome: 'Garrafa Vinho Tinto', preco: 250, categoria: 'casal' },
  espelho: { nome: 'Espelho com LED', preco: 180, categoria: 'casal' },
  almofada: { nome: 'Almofada Casal', preco: 100, categoria: 'casal' },
  cortina: { nome: 'Cortina Elegante', preco: 220, categoria: 'casal' },
  luminaria: { nome: 'Luminária Romântica', preco: 140, categoria: 'casal' },
  
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
    // Garantir que missão está inicializada antes de atualizar
    if (quantidade > 0) {
      await prepareDailyMissionState(userId);
    }
    
    const update = { $inc: { gold: quantidade } };
    // Incrementa progresso da missão de ganhar 500 gold apenas se for ganho positivo
    if (quantidade > 0) {
      update['$inc']['dailyMissions.progress.gold500'] = quantidade;
    }
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      update,
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

// ─── !lojacasal
async function handleLojaCasal(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `💕 *LOJA DE CASAL* 💕

🎁 *PRESENTES ROMÂNTICOS*
  🌹 Flores — 60 gold
  💌 Carta de Amor — 80 gold
  🍫 Caixa de Chocolate — 75 gold
  🍓 Morango com Chocolate — 55 gold
  🧸 Ursinho de Pelúcia — 130 gold

💎 *JOIAS E ACESSÓRIOS*
  💍 Anel — 500 gold
  📿 Colar Casal — 200 gold
  💪 Pulseira Casal — 120 gold

🎽 *VESTUÁRIO*
  👕 Camiseta Casal — 110 gold
  🧢 Gorro Casal — 85 gold
  🩴 Chinelo de Casal — 95 gold

🏠 *DECORAÇÃO*
  💡 Luminária Romântica — 140 gold
  🕯️ Vela Aromática — 90 gold
  🪞 Espelho com LED — 180 gold
  ❤️ Coração Decorativo — 140 gold
  🖼️ Moldura Foto Casal — 110 gold
  🛏️ Almofada Casal — 100 gold
  🪟 Cortina Elegante — 220 gold

🍷 *BEBIDAS E GOURMET*
  ☕ Chá Especial Casal — 70 gold
  🍷 Taça para Vinho — 160 gold
  🍾 Garrafa Vinho Tinto — 250 gold
  💐 Caixa Presente Luxo — 50 gold

🌹 *FRAGRÂNCIA*
  🌸 Perfume Premium — 150 gold

━━━━━━━━━━━━━━━━
*COMO COMPRAR?*
  ${P}comprar <nome_item>

💑 _Mostre seu amor com presentes incríveis!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprar
async function handleComprar(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid; // Fallback para evitar undefined
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

  // PRIMEIRO: Adicionar ao inventário
  try {
    // Garantir que o usuário existe e tem a estrutura de inventário
    let user = await Usuario.findOne({ idWhatsApp: userId });
    
    if (!user) {
      user = new Usuario({ 
        idWhatsApp: userId, 
        gold: saldoAtual,
        inventory: { [itemNome]: 1 }
      });
    } else {
      if (!user.inventory) {
        user.inventory = {};
      }
      user.inventory[itemNome] = (user.inventory[itemNome] || 0) + 1;
    }
    
    await user.save();
    console.log(`✅ Item adicionado ao inventário: ${userId} → ${itemNome} × 1`);
  } catch (e) {
    console.error('⚠️ Erro ao adicionar ao inventário:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar a compra! Tente novamente.' }, { quoted: msg });
    return;
  }

  // DEPOIS: Tirar o ouro (se inventário foi bem-sucedido)
  const saldoFinal = await changeGold(userId, -preco);

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
  const userId = msg.key.participant || msg.key.remoteJid;

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user || !user.inventory || Object.keys(user.inventory).length === 0) {
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

// ─── !pix ────────────────────────────────────────────────────────────────────

async function handlePix(sock, msg, jid, caption) {
  const userId      = msg.key.participant || msg.key.remoteJid;
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  let targetJid  = mentionedJid;
  let numeroPura = '';
  let quantia    = 0;

  if (targetJid) {
    numeroPura = targetJid.split('@')[0].split(':')[0];
    const parts = caption.trim().split(/\s+/);
    quantia = parseInt(parts[parts.length - 1]);
  } else {
    const match = caption.match(/(?:pix|transferir)\s+\S+\s+(\d+)/i);
    const numMatch = caption.match(/(?:pix|transferir)\s+@?(\d+)\s+(\d+)/i);
    if (numMatch) {
      numeroPura = numMatch[1].replace(/\D/g, '');
      targetJid  = `${numeroPura}@s.whatsapp.net`;
      quantia    = parseInt(numMatch[2]);
    } else if (match) {
      quantia = parseInt(match[1]);
    }
  }

  if (!targetJid || isNaN(quantia) || quantia <= 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!pix @pessoa quantia*\nExemplo: *!pix @Felipe 30*'
    }, { quoted: msg });
    return;
  }

  if (userId === targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Você não pode fazer PIX para si mesmo!' }, { quoted: msg });
    return;
  }

  // Verificar se destinatário existe
  const destUser = await Usuario.findOne({ idWhatsApp: targetJid });
  if (!destUser) {
    await sock.sendMessage(jid, { text: '❌ Destinatário não encontrado no sistema!' }, { quoted: msg });
    return;
  }

  // Debitar remetente atomicamente
  const remetente = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, gold: { $gte: quantia } },
    {
      $inc: { gold: -quantia },
      $push: {
        goldHistory: {
          $each: [{ type: 'gasto', item: `PIX para @${numeroPura}`, amount: quantia }],
          $slice: -50,
        },
      },
    },
    { new: true }
  );

  if (!remetente) {
    const saldo = await getSaldoAtual(userId);
    await sock.sendMessage(jid, {
      text: `⚠️ *SALDO INSUFICIENTE!*\n\n💰 Você tem: *${saldo}* gold\n💸 Precisa de: *${quantia}* gold`
    }, { quoted: msg });
    return;
  }

  // Creditar destinatário
  await Usuario.findOneAndUpdate(
    { idWhatsApp: targetJid },
    {
      $inc: { gold: quantia },
      $push: {
        goldHistory: {
          $each: [{ type: 'recebido', item: `PIX de @${userId.split('@')[0].split(':')[0]}`, amount: quantia }],
          $slice: -50,
        },
      },
    }
  );

  await sock.sendMessage(jid, {
    text:
      `✅ *TRANSFERÊNCIA REALIZADA!* ✅\n\n` +
      `💸 *${quantia} gold* enviado para *@${numeroPura}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 Seu novo saldo: *${remetente.gold}* gold`,
    mentions: [targetJid, userId],
  }, { quoted: msg });
}

// ─── !apostar ────────────────────────────────────────────────────────────────

async function handleApostar(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match  = caption.match(/apostar\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!apostar <quantia>*\nExemplo: *!apostar 100*' }, { quoted: msg });
    return;
  }

  const aposta = parseInt(match[1]);

  if (isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ *QUANTIA INVÁLIDA*\n\nA aposta deve ser um número positivo!' }, { quoted: msg });
    return;
  }

  // Debitar atomicamente antes de revelar resultado
  const userDebited = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, gold: { $gte: aposta } },
    { $inc: { gold: -aposta } },
    { new: true }
  );

  if (!userDebited) {
    const saldo = await getSaldoAtual(userId);
    await sock.sendMessage(jid, {
      text: `⚠️ *SALDO INSUFICIENTE*\n\n💰 Você tem: *${saldo}* gold\n💸 Precisa de: *${aposta}* gold`
    }, { quoted: msg });
    return;
  }

  const ganhou = Math.random() > 0.5;

  if (ganhou) {
    const premio     = Math.floor(aposta * 1.5); // recebe 1.5x de volta
    const lucroLiq   = premio - aposta;           // lucro líquido = 0.5x

    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $inc: { gold: premio },
        $push: {
          goldHistory: {
            $each: [{ type: 'recebido', item: 'Aposta (vitória)', amount: lucroLiq }],
            $slice: -50,
          },
        },
      }
    );

    const saldoFinal = userDebited.gold + premio;

    await sock.sendMessage(jid, {
      text:
        `🎉 ═══ VOCÊ GANHOU! ═══ 🎉\n\n` +
        `🎲 *Parabéns, sua sorte foi boa!*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RESULTADO:*\n` +
        `  💵 Aposta: *${aposta}* gold\n` +
        `  💰 Ganho líquido: *+${lucroLiq}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`
    }, { quoted: msg });
  } else {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $push: {
          goldHistory: {
            $each: [{ type: 'gasto', item: 'Aposta (derrota)', amount: aposta }],
            $slice: -50,
          },
        },
      }
    );

    const saldoFinal = userDebited.gold;

    await sock.sendMessage(jid, {
      text:
        `😢 ═══ VOCÊ PERDEU! ═══ 😢\n\n` +
        `🎲 *Que azar...*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*RESULTADO:*\n` +
        `  💵 Aposta perdida: *${aposta}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`
    }, { quoted: msg });
  }
}

// ─── !extrato ────────────────────────────────────────────────────────────────

async function handleExtrato(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const user = await Usuario.findOne({ idWhatsApp: userId });

  if (!user) {
    await sock.sendMessage(jid, { text: '❌ Você não tem cadastro!' }, { quoted: msg });
    return;
  }

  const historico = user.goldHistory || [];

  if (historico.length === 0) {
    await sock.sendMessage(jid, {
      text:
        `📊 *EXTRATO DE TRANSAÇÕES* 📊\n\n` +
        `😔 Nenhuma transação registrada ainda.\n\n` +
        `💰 *Saldo atual:* ${user.gold} gold`
    }, { quoted: msg });
    return;
  }

  // Pegar as últimas 10 transações em ordem cronológica reversa
  const ultimas = [...historico].reverse().slice(0, 10);

  let totalEntrada = 0;
  let totalSaida   = 0;
  const linhas     = [];

  for (const t of ultimas) {
    const data   = t.date ? new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '??/??';
    const hora   = t.date ? new Date(t.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '??:??';

    if (t.type === 'recebido') {
      totalEntrada += t.amount;
      linhas.push(`  ✅ *+${t.amount}g* | ${t.item} | ${data} ${hora}`);
    } else {
      totalSaida += t.amount;
      linhas.push(`  ❌ *-${t.amount}g* | ${t.item} | ${data} ${hora}`);
    }
  }

  const texto =
    `📊 ═══ EXTRATO DE TRANSAÇÕES ═══ 📊\n\n` +
    `*ÚLTIMAS ${ultimas.length} TRANSAÇÕES:*\n` +
    linhas.join('\n') +
    `\n\n━━━━━━━━━━━━━━━━\n` +
    `*RESUMO DO PERÍODO:*\n` +
    `  📈 Entradas: *+${totalEntrada}* gold\n` +
    `  📉 Saídas: *-${totalSaida}* gold\n` +
    `  💰 Saldo atual: *${user.gold}* gold`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !garimpar ───────────────────────────────────────────────────────────────

const GARIMPO_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

function formatarTempoGarimpo(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

async function handleGarimpar(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const agora  = Date.now();

  // Cooldown persistente no banco
  const user = await Usuario.findOne({ idWhatsApp: userId });
  const ultimoGarimpo = user?.ultimoGarimpo ? new Date(user.ultimoGarimpo).getTime() : 0;
  const tempoPassado  = agora - ultimoGarimpo;

  if (tempoPassado < GARIMPO_COOLDOWN_MS) {
    const restante = GARIMPO_COOLDOWN_MS - tempoPassado;
    await sock.sendMessage(jid, {
      text:
        `⏳ *GARIMPO EM COOLDOWN* ⏳\n\n` +
        `⛏️ Você já garimpou recentemente!\n\n` +
        `⏰ Próximo garimpo em: *${formatarTempoGarimpo(restante)}*`
    }, { quoted: msg });
    return;
  }

  try {
    const ouro = Math.floor(Math.random() * 100) + 30; // 30–129 gold

    await prepareDailyMissionState(userId);

    const updatedUser = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $inc: {
          gold: ouro,
          'dailyMissions.progress.gold500': ouro,
        },
        $set: { ultimoGarimpo: new Date() },
        $push: {
          goldHistory: {
            $each: [{ type: 'recebido', item: 'Garimpo', amount: ouro }],
            $slice: -50,
          },
        },
      },
      { new: true, upsert: true }
    );

    await sock.sendMessage(jid, {
      text:
        `⛏️ ═══ GARIMPO ═══ ⛏️\n\n` +
        `🪨 Você cavou fundo e encontrou ouro!\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💎 Encontrado: *+${ouro} gold*\n` +
        `💰 Novo saldo: *${updatedUser.gold}* gold\n\n` +
        `⏰ Próximo garimpo em: *1 hora*`
    }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
  }
}

// ─── !slots ──────────────────────────────────────────────────────────────────

async function handleSlots(sock, msg, jid, senderJid, caption) {
  const args   = caption.trim().split(/\s+/);
  const aposta = parseInt(args[1]);

  if (!aposta || isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Uso correto: *!slots [valor]*\nExemplo: *!slots 50*' }, { quoted: msg });
    return;
  }

  // Debitar atomicamente antes de qualquer animação
  const userDebited = await Usuario.findOneAndUpdate(
    { idWhatsApp: senderJid, gold: { $gte: aposta } },
    { $inc: { gold: -aposta } },
    { new: true }
  );

  if (!userDebited) {
    const saldo = await getSaldoAtual(senderJid);
    await sock.sendMessage(jid, {
      text: `❌ Saldo insuficiente!\n\n💰 Seu saldo: *${saldo}* gold\n💸 Aposta: *${aposta}* gold`
    }, { quoted: msg });
    return;
  }

  const frutas = ['🍒', '🍋', '🍇', '🍉', '🔔'];
  const r1 = frutas[Math.floor(Math.random() * frutas.length)];
  const r2 = frutas[Math.floor(Math.random() * frutas.length)];
  const r3 = frutas[Math.floor(Math.random() * frutas.length)];

  // Animação
  const msgInicial = await sock.sendMessage(jid, {
    text: `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🎲 | 🎲 | 🎲 ]\n\n_Girando..._`
  }, { quoted: msg });

  const frames = [
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🎲 | 🍒 | 🎲 ]\n\n_Girando..._`,
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🍋 | 🎲 | 🍇 ]\n\n_Girando..._`,
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🍉 | 🍒 | 🔔 ]\n\n_Girando..._`,
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🔔 | 🍋 | 🍒 ]\n\n_Girando..._`,
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🍇 | 🍉 | 🍋 ]\n\n_Girando..._`,
  ];

  for (const frame of frames) {
    await new Promise(r => setTimeout(r, 300));
    try { await sock.chatModify({ text: frame }, msgInicial.key); } catch {}
  }
  await new Promise(r => setTimeout(r, 300));

  // Calcular resultado
  let multiplicador = 0;
  let resultadoMsg  = '❌ *Você perdeu!* O banco agradece.';

  if (r1 === r2 && r2 === r3) {
    multiplicador = 10;
    resultadoMsg  = '🎉 *JACKPOT MÁXIMO!* Três iguais! Multiplicado por 10!';
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    multiplicador = 2.5;
    resultadoMsg  = '✨ *QUASE JACKPOT!* Duas iguais! Multiplicado por 2.5!';
  }

  const premio   = Math.floor(aposta * multiplicador);
  const lucroLiq = premio - aposta; // pode ser negativo (perdeu)

  // Creditar prêmio e registrar histórico
  await prepareDailyMissionState(senderJid);

  const updateSlots = {
    $inc: { gold: premio },
    $push: {
      goldHistory: {
        $each: [{
          type: lucroLiq >= 0 ? 'recebido' : 'gasto',
          item: `Slots (${multiplicador > 0 ? `${multiplicador}x` : 'derrota'})`,
          amount: Math.abs(lucroLiq),
        }],
        $slice: -50,
      },
    },
  };
  if (lucroLiq > 0) {
    updateSlots.$inc['dailyMissions.progress.gold500'] = lucroLiq;
  }

  await Usuario.findOneAndUpdate({ idWhatsApp: senderJid }, updateSlots);

  const saldoFinal = userDebited.gold + lucroLiq;

  const textoFinal =
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `     [ ${r1} | ${r2} | ${r3} ]\n\n` +
    `${resultadoMsg}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*DETALHES:*\n` +
    `  💵 Aposta: *${aposta}* gold\n` +
    (multiplicador > 0 ? `  ✖️ Multiplicador: *${multiplicador}x*\n  💰 Prêmio: *${premio}* gold\n` : '') +
    `  ${lucroLiq >= 0 ? '✅' : '❌'} Resultado: *${lucroLiq >= 0 ? '+' : ''}${lucroLiq}* gold\n` +
    `  💎 Saldo: *${saldoFinal}* gold`;

  try {
    await sock.chatModify({ text: textoFinal }, msgInicial.key);
  } catch {
    await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg });
  }
}

// ─── !corrida ────────────────────────────────────────────────────────────────

async function handleCorrida(sock, msg, jid, senderJid, caption) {
  const args   = caption.trim().split(/\s+/);
  const escolha = parseInt(args[1]);
  const aposta  = parseInt(args[2]);

  if (!escolha || !aposta || isNaN(escolha) || isNaN(aposta) || escolha < 1 || escolha > 4 || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Uso correto: *!corrida [bicho] [valor]*\n\n` +
        `*Escolha seu corredor:*\n` +
        `1️⃣ 🐎 Cavalo\n` +
        `2️⃣ 🐅 Tigre\n` +
        `3️⃣ 🐢 Tartaruga\n` +
        `4️⃣ 🐕 Cachorro\n\n` +
        `Exemplo: *!corrida 1 50* (Aposta 50 no Cavalo)`
    }, { quoted: msg });
    return;
  }

  // Debitar atomicamente antes de revelar resultado
  const userDebited = await Usuario.findOneAndUpdate(
    { idWhatsApp: senderJid, gold: { $gte: aposta } },
    { $inc: { gold: -aposta } },
    { new: true }
  );

  if (!userDebited) {
    const saldo = await getSaldoAtual(senderJid);
    await sock.sendMessage(jid, {
      text: `❌ Saldo insuficiente!\n\n💰 Seu saldo: *${saldo}* gold\n💸 Aposta: *${aposta}* gold`
    }, { quoted: msg });
    return;
  }

  const bichos = ['🐎 Cavalo', '🐅 Tigre', '🐢 Tartaruga', '🐕 Cachorro'];
  const emojis = ['🐎', '🐅', '🐢', '🐕'];

  const vencedorIdx = Math.floor(Math.random() * 4);
  const ganhou      = (escolha - 1) === vencedorIdx;
  const premio      = ganhou ? aposta * 3 : 0;
  const lucroLiq    = premio - aposta;

  // Creditar prêmio e registrar histórico
  await prepareDailyMissionState(senderJid);

  const updateCorrida = {
    $inc: { gold: premio },
    $push: {
      goldHistory: {
        $each: [{
          type: ganhou ? 'recebido' : 'gasto',
          item: `Corrida (${bichos[escolha - 1]})`,
          amount: Math.abs(lucroLiq),
        }],
        $slice: -50,
      },
    },
  };
  if (lucroLiq > 0) {
    updateCorrida.$inc['dailyMissions.progress.gold500'] = lucroLiq;
  }

  await Usuario.findOneAndUpdate({ idWhatsApp: senderJid }, updateCorrida);

  const saldoFinal = userDebited.gold + lucroLiq;

  // Montar pista visual
  let pista = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;
  for (let i = 0; i < 4; i++) {
    if (i === vencedorIdx) {
      pista += `${emojis[i]} ══════════════ 💨 🏆\n`;
    } else {
      const espaco = '═'.repeat(Math.floor(Math.random() * 8) + 2);
      pista += `${emojis[i]} ${espaco}\n`;
    }
  }

  pista += `\n━━━━━━━━━━━━━━━━\n`;
  pista += `🎯 Você apostou no *${bichos[escolha - 1]}*\n`;
  pista += `🏆 Vencedor: *${bichos[vencedorIdx]}*\n\n`;

  if (ganhou) {
    pista += `🎉 *VITÓRIA!* Você ganhou *+${aposta * 3}* gold!\n`;
  } else {
    pista += `❌ *DERROTA!* Você perdeu *${aposta}* gold.\n`;
  }

  pista += `💰 Saldo: *${saldoFinal}* gold`;

  await sock.sendMessage(jid, { text: pista }, { quoted: msg });
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
  handlePix,
  handleApostar,
  handleExtrato,
  handleGarimpar,
  handleSlots,
  handleCorrida,
  getSaldoAtual,
  changeGold,
  ITENS_LOJA,
};