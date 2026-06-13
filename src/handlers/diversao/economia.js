/**
 * Handler de Economia — Piroquinhas Bot
 * Gold LOCAL ao grupo via CarteiraGrupo
 *
 * Regras:
 *  - Gold, garimpo, apostas, slots, corrida → CarteiraGrupo (por grupo)
 *  - Inventário, PIX, extrato              → Usuario global (mantido)
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const { getCarteira, alterarGold, transferirGold } = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));
const { prepareDailyMissionState } = require('./missoes');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { VARAS_PESCA, ISCAS } = require('./pesca');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// ─── RE-EXPORTA ITENS_LOJA (sem mudança) ─────────────────────────────────
const ITENS_LOJA = {
  // COMIDAS
  pizza:            { nome: 'Pizza Margherita',      preco: 50,    categoria: 'comida' },
  pizzapeperoni:    { nome: 'Pizza Pepperoni',        preco: 60,    categoria: 'comida' },
  pizza4queijos:    { nome: 'Pizza 4 Queijos',        preco: 70,    categoria: 'comida' },
  pizzavegetariana: { nome: 'Pizza Vegetariana',      preco: 45,    categoria: 'comida' },
  pizzafrango:      { nome: 'Pizza Frango com Milho', preco: 65,    categoria: 'comida' },
  hamburger:        { nome: 'Hamburger Simples',      preco: 40,    categoria: 'comida' },
  hamburgerduplo:   { nome: 'Hamburger Duplo',        preco: 70,    categoria: 'comida' },
  xtudo:            { nome: 'X-Tudo',                 preco: 85,    categoria: 'comida' },
  hotdog:           { nome: 'Hot Dog',                preco: 35,    categoria: 'comida' },
  taco:             { nome: 'Taco',                   preco: 42,    categoria: 'comida' },
  sanduiche:        { nome: 'Sanduíche',              preco: 45,    categoria: 'comida' },
  frango:           { nome: 'Frango Frito',           preco: 35,    categoria: 'comida' },
  costela:          { nome: 'Costela',                preco: 80,    categoria: 'comida' },
  picanha:          { nome: 'Picanha',                preco: 120,   categoria: 'comida' },
  linguica:         { nome: 'Linguiça',               preco: 55,    categoria: 'comida' },
  carne:            { nome: 'Carne Moída',            preco: 60,    categoria: 'comida' },
  chocolate:        { nome: 'Chocolate',              preco: 25,    categoria: 'comida' },
  bolobocolate:     { nome: 'Bolo de Chocolate',      preco: 65,    categoria: 'comida' },
  sorvete:          { nome: 'Sorvete',                preco: 30,    categoria: 'comida' },
  pudim:            { nome: 'Pudim',                  preco: 35,    categoria: 'comida' },
  biscoito:         { nome: 'Biscoito',               preco: 15,    categoria: 'comida' },
  donut:            { nome: 'Donut',                  preco: 20,    categoria: 'comida' },
  bolo:             { nome: 'Bolo de Aniversário',    preco: 150,   categoria: 'comida' },
  refrigerante:     { nome: 'Refrigerante',           preco: 10,    categoria: 'comida' },
  cafe:             { nome: 'Café',                   preco: 8,     categoria: 'comida' },
  suco:             { nome: 'Suco Natural',           preco: 12,    categoria: 'comida' },
  vinho:            { nome: 'Vinho',                  preco: 100,   categoria: 'comida' },
  cerveja:          { nome: 'Cerveja',                preco: 80,    categoria: 'comida' },

  // COMIDA PARA PETS
  racao:        { nome: 'Ração Normal',    preco: 20, categoria: 'petcomida' },
  racaopremium: { nome: 'Ração Premium',   preco: 45, categoria: 'petcomida' },
  racaogourmet: { nome: 'Ração Gourmet',   preco: 75, categoria: 'petcomida' },
  carnefresh:   { nome: 'Carne Fresca',    preco: 55, categoria: 'petcomida' },
  osso:         { nome: 'Osso Saboroso',   preco: 40, categoria: 'petcomida' },
  arrozfeijao:  { nome: 'Arroz com Feijão',preco: 30, categoria: 'petcomida' },
  peixe:        { nome: 'Peixe Fresco',    preco: 60, categoria: 'petcomida' },
  leite:        { nome: 'Leite',           preco: 15, categoria: 'petcomida' },
  cenoura:      { nome: 'Cenoura',         preco: 12, categoria: 'petcomida' },
  maca:         { nome: 'Maçã',            preco: 18, categoria: 'petcomida' },

  // BRINQUEDOS
  bolinha:      { nome: 'Bolinha de Tênis', preco: 35,  categoria: 'petbrinquedo' },
  pelucia:      { nome: 'Pelúcia',          preco: 50,  categoria: 'petbrinquedo' },
  corda:        { nome: 'Corda de Puxar',   preco: 40,  categoria: 'petbrinquedo' },
  disco:        { nome: 'Disco Voador',     preco: 60,  categoria: 'petbrinquedo' },
  bolacrocante: { nome: 'Bola Crocante',    preco: 45,  categoria: 'petbrinquedo' },
  pena:         { nome: 'Pena Interativa',  preco: 30,  categoria: 'petbrinquedo' },
  casabrinquedo:{ nome: 'Casa de Brinquedo',preco: 150, categoria: 'petbrinquedo' },

  // CUIDADOS PET
  remedio:  { nome: 'Remédio Geral',    preco: 80,  categoria: 'petcuidado' },
  bandagem: { nome: 'Bandagem',         preco: 50,  categoria: 'petcuidado' },
  vacina:   { nome: 'Vacina',           preco: 120, categoria: 'petcuidado' },
  shampoo:  { nome: 'Shampoo Especial', preco: 70,  categoria: 'petcuidado' },
  sabonete: { nome: 'Sabonete Pet',     preco: 40,  categoria: 'petcuidado' },
  escova:   { nome: 'Escova de Dentes', preco: 35,  categoria: 'petcuidado' },

  // ACESSÓRIOS PET
  coleira:    { nome: 'Coleira Colorida', preco: 55,  categoria: 'petacessorio' },
  coleiraouro:{ nome: 'Coleira de Ouro',  preco: 200, categoria: 'petacessorio' },
  peitoral:   { nome: 'Peitoral',         preco: 65,  categoria: 'petacessorio' },
  bandana:    { nome: 'Bandana',          preco: 45,  categoria: 'petacessorio' },
  coroa:      { nome: 'Coroa Pet',        preco: 100, categoria: 'petacessorio' },
  placaid:    { nome: 'Placa de ID',      preco: 75,  categoria: 'petacessorio' },

  // ESPECIAIS
  trofeu:       { nome: 'Troféu Miniatura', preco: 250, categoria: 'especial' },
  pocaoenergia: { nome: 'Poção de Energia', preco: 180, categoria: 'especial' },
  gema:         { nome: 'Gema Brilhante',   preco: 300, categoria: 'especial' },
  cristal:      { nome: 'Cristal Mágico',   preco: 400, categoria: 'especial' },

  // PETS (compatibilidade)
  cachorro: { nome: 'Cachorro', preco: 100, categoria: 'pet' },
  gato:     { nome: 'Gato',     preco: 100, categoria: 'pet' },
  coelho:   { nome: 'Coelho',   preco: 80,  categoria: 'pet' },

  // CASAL
  flores:       { nome: 'Flores',               preco: 60,  categoria: 'casal' },
  carta:        { nome: 'Carta de Amor',         preco: 80,  categoria: 'casal' },
  anel:         { nome: 'Anel',                  preco: 500, categoria: 'casal' },
  morango:      { nome: 'Morango com Chocolate', preco: 55,  categoria: 'casal' },
  vela:         { nome: 'Vela Aromática',        preco: 90,  categoria: 'casal' },
  perfume:      { nome: 'Perfume Premium',       preco: 150, categoria: 'casal' },
  colar:        { nome: 'Colar Casal',           preco: 200, categoria: 'casal' },
  pulseira:     { nome: 'Pulseira Casal',        preco: 120, categoria: 'casal' },
  camisetacasal:{ nome: 'Camiseta Casal',        preco: 110, categoria: 'casal' },
  gorro:        { nome: 'Gorro Casal',           preco: 85,  categoria: 'casal' },
  chinelo:      { nome: 'Chinelo de Casal',      preco: 95,  categoria: 'casal' },
  urso:         { nome: 'Ursinho de Pelúcia',    preco: 130, categoria: 'casal' },
  caixa:        { nome: 'Caixa Presente Luxo',   preco: 50,  categoria: 'casal' },
  foto:         { nome: 'Moldura Foto Casal',    preco: 110, categoria: 'casal' },
  espelho:      { nome: 'Espelho com LED',       preco: 180, categoria: 'casal' },
  almofada:     { nome: 'Almofada Casal',        preco: 100, categoria: 'casal' },
  cortina:      { nome: 'Cortina Elegante',      preco: 220, categoria: 'casal' },
  luminaria:    { nome: 'Luminária Romântica',   preco: 140, categoria: 'casal' },
  taça:         { nome: 'Taça para Vinho',       preco: 160, categoria: 'casal' },
  garrafa:      { nome: 'Garrafa Vinho Tinto',   preco: 250, categoria: 'casal' },

  // ESTILO
  camiseta: { nome: 'Camiseta', preco: 50, categoria: 'estilo' },
  calcas:   { nome: 'Calças',   preco: 60, categoria: 'estilo' },
  sapato:   { nome: 'Sapato',   preco: 70, categoria: 'estilo' },

  // TECNOLOGIA
  celular:          { nome: 'Celular',              preco: 200,   categoria: 'tec' },
  usb:              { nome: 'Memória USB',           preco: 150,   categoria: 'tec' },
  computador:       { nome: 'Computador',            preco: 500,   categoria: 'tec' },
  notebook:         { nome: 'Notebook Gamer',        preco: 5000,  categoria: 'tec' },
  notebooki5:       { nome: 'Notebook i5',           preco: 3500,  categoria: 'tec' },
  desktop:          { nome: 'Desktop Gaming',        preco: 6000,  categoria: 'tec' },
  pccustom:         { nome: 'PC Gamer Custom',       preco: 8000,  categoria: 'tec' },
  laptopfino:       { nome: 'Laptop Ultrafino',      preco: 4500,  categoria: 'tec' },
  workstation:      { nome: 'Workstation Pro',       preco: 9999,  categoria: 'tec' },
  smartphonepremium:{ nome: 'Smartphone Premium',    preco: 2500,  categoria: 'tec' },
  smartphonegamer:  { nome: 'Smartphone Gamer',      preco: 3500,  categoria: 'tec' },
  smartphonebasico: { nome: 'Smartphone Básico',     preco: 1500,  categoria: 'tec' },
  tablet10:         { nome: 'Tablet 10"',            preco: 2000,  categoria: 'tec' },
  tabletpro:        { nome: 'Tablet Pro',            preco: 3500,  categoria: 'tec' },
  ereader:          { nome: 'E-reader',              preco: 1800,  categoria: 'tec' },
  mousegamer:       { nome: 'Mouse Gamer',           preco: 350,   categoria: 'tec' },
  tecladomecanico:  { nome: 'Teclado Mecânico',      preco: 450,   categoria: 'tec' },
  tecladorgb:       { nome: 'Teclado RGB',           preco: 600,   categoria: 'tec' },
  monitor24:        { nome: 'Monitor 24"',           preco: 1200,  categoria: 'tec' },
  monitor4k:        { nome: 'Monitor 4K',            preco: 2500,  categoria: 'tec' },
  mousepad:         { nome: 'Mousepad Grande',       preco: 150,   categoria: 'tec' },
  webcam:           { nome: 'Webcam 1080p',          preco: 500,   categoria: 'tec' },
  headsetgamer:     { nome: 'Headset Gamer',         preco: 800,   categoria: 'tec' },
  fonesemfio:       { nome: 'Fone Sem Fio',          preco: 600,   categoria: 'tec' },
  fonecancelamento: { nome: 'Fone com Cancelamento', preco: 1200,  categoria: 'tec' },
  microusbfone:     { nome: 'Microfone USB',         preco: 400,   categoria: 'tec' },
  microprofissional:{ nome: 'Microfone Profissional',preco: 1500,  categoria: 'tec' },
  caixabluetooth:   { nome: 'Caixa Bluetooth',       preco: 350,   categoria: 'tec' },
  altofalante:      { nome: 'Alto-falante Smart',    preco: 800,   categoria: 'tec' },
  cabousbc:         { nome: 'Cabo USB-C',            preco: 50,    categoria: 'tec' },
  cabohdmi:         { nome: 'Cabo HDMI',             preco: 40,    categoria: 'tec' },
  carregadorrapido: { nome: 'Carregador Rápido',     preco: 200,   categoria: 'tec' },
  adaptadorusb:     { nome: 'Adaptador USB',         preco: 80,    categoria: 'tec' },
  hub7portas:       { nome: 'Hub USB 7 Portas',      preco: 300,   categoria: 'tec' },
  ssd1tb:           { nome: 'SSD 1TB',               preco: 800,   categoria: 'tec' },
  ssd2tb:           { nome: 'SSD 2TB',               preco: 1500,  categoria: 'tec' },
  ram16gb:          { nome: 'Memória RAM 16GB',      preco: 600,   categoria: 'tec' },
  powerbank20:      { nome: 'PowerBank 20000mAh',    preco: 400,   categoria: 'tec' },
  powerbanksolar:   { nome: 'PowerBank Solar',       preco: 550,   categoria: 'tec' },
  suportemagnetico: { nome: 'Suporte Magnético',     preco: 120,   categoria: 'tec' },
  casecelular:      { nome: 'Case para Celular',     preco: 150,   categoria: 'tec' },
  protetortela:     { nome: 'Protetor de Tela',      preco: 80,    categoria: 'tec' },
  mochilatech:      { nome: 'Mochila Tech',          preco: 450,   categoria: 'tec' },
  bolsalaptop:      { nome: 'Bolsa Laptop',          preco: 350,   categoria: 'tec' },
  fonepremium:      { nome: 'Fone Premium',          preco: 2000,  categoria: 'tec' },
  monitorcurvo:     { nome: 'Monitor Curvo 4K',      preco: 4000,  categoria: 'tec' },
  pcgamerlegendario:{ nome: 'PC Gamer Lendário',     preco: 15000, categoria: 'tec' },
  setupgamer:       { nome: 'Setup Completo Gamer',  preco: 12000, categoria: 'tec' },
  gpu4090:          { nome: 'GPU RTX 4090',          preco: 8000,  categoria: 'tec' },
};

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

/**
 * Retorna o gold local do usuário neste grupo.
 */
async function getSaldoGrupo(userId, idGrupo) {
  const carteira = await getCarteira(userId, idGrupo);
  return carteira?.gold ?? 0;
}

/**
 * Debita gold localmente de forma atômica.
 * Retorna o documento atualizado, ou null se saldo insuficiente.
 */
async function debitarGold(userId, idGrupo, valor, descricao) {
  const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
  return CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: userId, idGrupo, gold: { $gte: valor } },
    {
      $inc: { gold: -valor },
      $push: {
        goldHistory: {
          $each: [{ type: 'gasto', item: descricao, amount: valor }],
          $slice: -50,
        },
      },
    },
    { new: true }
  );
}

// !gold
async function handleGold(sock, msg, jid, getPrefix, contactNames) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;

  try {
    const carteira  = await getCarteira(userId, idGrupo);
    const gold      = carteira?.gold ?? 0;
    const numero    = userId.split('@')[0].split(':')[0];
    const userName  = contactNames?.[userId] || numero;

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

// ─── Lojas específicas ────────────────────────────────────────────────────────

// !lojafood
async function handleLojaFood(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🍕 PIZZAS':    ['pizza', 'pizzapeperoni', 'pizza4queijos', 'pizzavegetariana', 'pizzafrango'],
    '🍔 LANCHES':   ['hamburger', 'hamburgerduplo', 'xtudo', 'hotdog', 'taco', 'sanduiche'],
    '🍗 CARNES':    ['frango', 'costela', 'picanha', 'linguica', 'carne'],
    '🍫 DOCES':     ['chocolate', 'bolobocolate', 'sorvete', 'pudim', 'biscoito', 'donut', 'bolo'],
    '🥤 BEBIDAS':   ['refrigerante', 'cafe', 'suco', 'vinho', 'cerveja'],
  };

  let texto = `🍔 *LOJA DE COMIDA* 🍔\n\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) texto += `  • ${item.nome} — ${item.preco} gold | chave: \`${k}\`\n`;
    }
    texto += '\n';
  }
  texto += `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <chave_do_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojapet
async function handleLojaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🦴 COMIDAS':      ['racao', 'racaopremium', 'racaogourmet', 'carnefresh', 'osso', 'arrozfeijao', 'peixe', 'leite', 'cenoura', 'maca'],
    '🎾 BRINQUEDOS':   ['bolinha', 'pelucia', 'corda', 'disco', 'bolacrocante', 'pena', 'casabrinquedo'],
    '💊 MEDICAMENTOS': ['remedio', 'bandagem', 'vacina', 'shampoo', 'sabonete', 'escova'],
    '🎀 ACESSÓRIOS':   ['coleira', 'coleiraouro', 'peitoral', 'bandana', 'coroa', 'placaid'],
  };

  let texto = `🐾 *LOJA DE PETS* 🐾\n\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) texto += `  • ${item.nome} — ${item.preco} gold | chave: \`${k}\`\n`;
    }
    texto += '\n';
  }
  texto += `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <chave_do_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojatec
async function handleLojaTec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🖥️ COMPUTADORES':  ['notebook', 'notebooki5', 'desktop', 'pccustom', 'laptopfino', 'workstation', 'pcgamerlegendario', 'setupgamer'],
    '📱 SMARTPHONES':   ['smartphonepremium', 'smartphonegamer', 'smartphonebasico', 'tablet10', 'tabletpro', 'ereader', 'celular'],
    '🎮 PERIFÉRICOS':   ['mousegamer', 'tecladomecanico', 'tecladorgb', 'monitor24', 'monitor4k', 'monitorcurvo', 'mousepad', 'webcam', 'headsetgamer'],
    '🎧 ÁUDIO':         ['fonesemfio', 'fonecancelamento', 'fonepremium', 'microusbfone', 'microprofissional', 'caixabluetooth', 'altofalante'],
    '🔌 ACESSÓRIOS':    ['cabousbc', 'cabohdmi', 'carregadorrapido', 'adaptadorusb', 'hub7portas', 'powerbank20', 'powerbanksolar', 'suportemagnetico', 'casecelular', 'protetortela', 'mochilatech', 'bolsalaptop'],
    '💾 ARMAZENAMENTO': ['ssd1tb', 'ssd2tb', 'ram16gb', 'usb', 'gpu4090'],
  };

  let texto = `💻 *LOJA DE TECNOLOGIA* 💻\n\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) texto += `  • ${item.nome} — ${item.preco} gold | chave: \`${k}\`\n`;
    }
    texto += '\n';
  }
  texto += `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <chave_do_item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// !lojacasal
async function handleLojaCasal(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const categorias = {
    '🎁 PRESENTES ROMÂNTICOS': ['flores', 'carta', 'morango', 'urso', 'caixa'],
    '💎 JOIAS E ACESSÓRIOS':   ['anel', 'colar', 'pulseira'],
    '🎽 VESTUÁRIO':            ['camisetacasal', 'gorro', 'chinelo'],
    '🏠 DECORAÇÃO':            ['luminaria', 'vela', 'espelho', 'almofada', 'cortina', 'foto'],
    '🍷 BEBIDAS E GOURMET':    ['taça', 'garrafa', 'perfume'],
  };

  let texto = `💕 *LOJA DE CASAL* 💕\n\n`;
  for (const [cat, keys] of Object.entries(categorias)) {
    texto += `${cat}\n`;
    for (const k of keys) {
      const item = ITENS_LOJA[k];
      if (item) texto += `  • ${item.nome} — ${item.preco} gold | chave: \`${k}\`\n`;
    }
    texto += '\n';
  }
  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `*COMO COMPRAR?*\n  ${P}buy <chave_do_item>\n\n` +
    `💑 _Mostre seu amor com presentes incríveis!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !buy ─────────────────────────────────────────────────────────────────
// Gold debitado da CarteiraGrupo; inventário salvo no Usuario global.

async function handleComprar(sock, msg, jid, caption) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;
  const match   = caption.match(/buy\s+(.+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!buy <nome_do_item>*\nExemplo: *!buy pizza*' }, { quoted: msg });
    return;
  }

  const itemNome = match[1].toLowerCase().trim();
  const itemInfo = ITENS_LOJA[itemNome] || VARAS_PESCA?.[itemNome] || ISCAS?.[itemNome];

  if (!itemInfo) {
    const lista = Object.entries(ITENS_LOJA)
      .slice(0, 15)
      .map(([, v]) => `  • ${v.nome} (${v.preco} gold)`)
      .join('\n');
    await sock.sendMessage(jid, {
      text:
        `⚠️ *ITEM NÃO ENCONTRADO*\n\nO item *${itemNome}* não existe!\n\n` +
        `━━━━━━━━━━━━━━━━\n*ITENS DISPONÍVEIS:*\n${lista}\n\n` +
        `*USE:*\n  !buy <item>\n  Exemplo: !buy pizza`,
    }, { quoted: msg });
    return;
  }

  const preco      = itemInfo.preco;
  const saldoAtual = await getSaldoGrupo(userId, idGrupo);

  if (saldoAtual < preco) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${preco}* gold neste grupo!\n\n` +
        `━━━━━━━━━━━━━━━━\n*SEU SALDO:*\n` +
        `  💰 Disponível: *${saldoAtual}* gold\n` +
        `  💎 Precisa de: *${preco}* gold`,
    }, { quoted: msg });
    return;
  }

  // 1) Debitar gold PRIMEIRO (atômico) para evitar item sem pagamento
  const carteiraAtualizada = await debitarGold(userId, idGrupo, preco, `Compra: ${itemInfo.nome}`);
  if (!carteiraAtualizada) {
    await sock.sendMessage(jid, {
      text: '⚠️ *SALDO INSUFICIENTE*\n\nNão foi possível debitar o gold. Tente novamente.',
    }, { quoted: msg });
    return;
  }

  // 2) Adicionar ao inventário correto
  try {
    const ehPesca = !!(VARAS_PESCA?.[itemNome] || ISCAS?.[itemNome]);

    if (ehPesca) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo },
        { $inc: { [`itensPesca.${itemNome}`]: 1 } },
        { upsert: true }
      );
    } else {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { [`inventory.${itemNome}`]: 1 } },
        { upsert: true }
      );
    }
  } catch (e) {
    console.error('⚠️ Erro ao adicionar inventário:', e.message);
    // Tenta devolver o gold em caso de falha no inventário
    await alterarGold(userId, idGrupo, preco, `Estorno: ${itemInfo.nome}`).catch(() => {});
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar a compra! Gold devolvido. Tente novamente.' }, { quoted: msg });
    return;
  }

  const saldoFinal = carteiraAtualizada?.gold ?? (saldoAtual - preco);

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

// ─── !vender (sem mudança de lógica) ─────────────────────────────────────────

async function handleVender(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
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

  // Remove os itens do inventário
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $inc: { [`inventory.${itemKey}`]: -quantidade } }
  );

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

// ─── !inventario ──────────────────────────────────────────────────────────────

const MSG_INVENTARIO_VAZIO =
  `📦 *SEU INVENTÁRIO* 📦\n\n` +
  `Você não possui itens no momento!\n\n` +
  `*COMO GANHAR ITENS?*\n` +
  `  🛒 Comprar na loja: *!loja*\n` +
  `  📋 Completar missões: *!missao*\n\n` +
  `Use *!buy <item>* para começar!`;

async function handleInventario(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

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

// ─── !pix ─────────────────────────────────────────────────────────────────────
/**
 * Extrai { targetJid, numeroPura, quantia } do contexto da mensagem.
 * Retorna null se não for possível resolver os parâmetros.
 * Tratado para suportar JIDs normais (@s.whatsapp.net) e novos identificadores (@lid).
 */
function parsearPix(msg, caption) {
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  // ── Caso 1: menção via @tag (O Baileys já entrega o JID nativo correto)
  if (mentionedJid) {
    const parts   = caption.trim().split(/\s+/);
    const quantia = parseInt(parts[parts.length - 1], 10);
    if (isNaN(quantia) || quantia <= 0) return null;
    
    return {
      targetJid:  jidNormalizedUser(mentionedJid),
      numeroPura: mentionedJid.split('@')[0].split(':')[0],
      quantia,
    };
  }

  // ── Caso 2: número digitado manualmente (!pix 5511999 50)
  const numMatch = caption.match(/(?:pix|transferir)\s+@?(\d+)\s+(\d+)/i);
  if (!numMatch) return null;

  const numeroPura = numMatch[1].replace(/\D/g, '');
  const quantia    = parseInt(numMatch[2], 10);
  if (!numeroPura || isNaN(quantia) || quantia <= 0) return null;

  // Para buscas manuais por número puro, o fallback padrão da rede ainda é @s.whatsapp.net
  return {
    targetJid:  jidNormalizedUser(`${numeroPura}@s.whatsapp.net`),
    numeroPura,
    quantia,
  };
}

// !pix
async function handlePix(sock, msg, jid, caption) {
  // Limpa e normaliza o ID do remetente (resolve problemas com @lid e sessões multi-dispositivo)
  const rawUserId = msg.key.participant || msg.key.remoteJid;
  const userId = jidNormalizedUser(rawUserId);
  
  const parsed = parsearPix(msg, caption);

  if (!parsed) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!pix @pessoa quantia*\nExemplo: *!pix @Felipe 30*',
    }, { quoted: msg });
    return;
  }

  const { targetJid, numeroPura, quantia } = parsed;

  if (userId === targetJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Você não pode fazer PIX para si mesmo!',
    }, { quoted: msg });
    return;
  }

  let resultado;
  try {
    // Transfere o saldo local no grupo usando operações atômicas
    resultado = await transferirGold(
      userId,
      targetJid,
      jid,
      quantia,
      'PIX'
    );
  } catch (e) {
    if (e instanceof RangeError) {
      const carteiraRemetente = await getCarteira(userId, jid);
      const saldo = carteiraRemetente?.gold ?? 0;
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE!*\n\n` +
          `💰 Você tem: *${saldo}* gold\n` +
          `💸 Precisa de: *${quantia}* gold`,
      }, { quoted: msg });
      return;
    }
    throw e; // Erros inesperados do banco de dados continuam subindo para o log
  }

  // Define um saldo visual caso o retorno atômico falte por algum motivo
  const saldoFinalRemetente = resultado?.de?.gold ?? 0;

  await sock.sendMessage(jid, {
    text:
      `✅ *TRANSFERÊNCIA REALIZADA!* ✅\n\n` +
      `💸 *${quantia} gold* enviado para *@${numeroPura}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 Seu novo saldo: *${saldoFinalRemetente}* gold`,
    mentions: [targetJid, userId],
  }, { quoted: msg });
}

// ─── !apostar ─────────────────────────────────────────────────────────────────

async function handleApostar(sock, msg, jid, caption) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;
  const match   = caption.match(/apostar\s+(\d+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!apostar <quantia>*\nExemplo: *!apostar 100*' }, { quoted: msg });
    return;
  }

  const aposta = parseInt(match[1], 10);
  if (isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ *QUANTIA INVÁLIDA*\n\nA aposta deve ser um número positivo!' }, { quoted: msg });
    return;
  }

  const userDebited = await debitarGold(userId, idGrupo, aposta, 'Aposta');
  if (!userDebited) {
    const saldo = await getSaldoGrupo(userId, idGrupo);
    await sock.sendMessage(jid, {
      text: `⚠️ *SALDO INSUFICIENTE*\n\n💰 Você tem: *${saldo}* gold\n💸 Precisa de: *${aposta}* gold`,
    }, { quoted: msg });
    return;
  }

  const ganhou = Math.random() < 0.5;

  if (ganhou) {
    const premio     = aposta * 2;
    const lucroLiq   = aposta;
    const carteira   = await alterarGold(userId, idGrupo, premio, 'Aposta (vitória)');
    const saldoFinal = carteira?.gold ?? (userDebited.gold + premio);

    await sock.sendMessage(jid, {
      text:
        `🎉 ═══ VOCÊ GANHOU! ═══ 🎉\n\n🎲 *Parabéns, sua sorte foi boa!*\n\n` +
        `━━━━━━━━━━━━━━━━\n*RESULTADO:*\n` +
        `  💵 Aposta: *${aposta}* gold\n` +
        `  💰 Ganho líquido: *+${lucroLiq}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`,
    }, { quoted: msg });
  } else {
    const saldoFinal = userDebited.gold;
    await sock.sendMessage(jid, {
      text:
        `😢 ═══ VOCÊ PERDEU! ═══ 😢\n\n🎲 *Que azar...*\n\n` +
        `━━━━━━━━━━━━━━━━\n*RESULTADO:*\n` +
        `  💵 Aposta perdida: *${aposta}* gold\n\n` +
        `💎 *Saldo:* ${saldoFinal} gold`,
    }, { quoted: msg });
  }
}

'use strict';

// ─── !extrato ─────────────────────────────────────────────────────────────────

const EXTRATO_LIMITE   = 15;
const EXTRATO_DATE_FMT = { day: '2-digit', month: '2-digit' };
const EXTRATO_HORA_FMT = { hour: '2-digit', minute: '2-digit' };

const EXTRATO_ICONES = {
  recebido: '📈',
  enviado:  '📤',
  default:  '📉',
};

function formatarDataHora(date) {
  if (!date) return { data: '??/??', hora: '??:??' };
  const d = new Date(date);
  return {
    data: d.toLocaleDateString('pt-BR', EXTRATO_DATE_FMT),
    hora: d.toLocaleTimeString('pt-BR', EXTRATO_HORA_FMT),
  };
}

function buildLinhaTransacao(t, index) {
  const { data, hora } = formatarDataHora(t.date);
  const recebido = t.type === 'recebido';
  const icone    = EXTRATO_ICONES[t.type] ?? EXTRATO_ICONES.default;
  const sinal    = recebido ? '+' : '-';
  const num      = String(index + 1).padStart(2, '0');
  return `  ${num}. ${icone} *${sinal}${t.amount}g* — ${t.item}\n      🕐 ${data} às ${hora}`;
}

async function handleExtrato(sock, msg, jid) {
  const userId   = msg.key.participant || msg.key.remoteJid;
  const carteira = await getCarteira(userId, jid);
  const historico = carteira?.goldHistory ?? [];

  if (historico.length === 0) {
    await sock.sendMessage(jid, {
      text:
        `📊 *EXTRATO DE TRANSAÇÕES* 📊\n\n` +
        `😔 Nenhuma transação registrada ainda.\n\n` +
        `💰 Saldo atual: *${carteira?.gold ?? 0} gold*`,
    }, { quoted: msg });
    return;
  }

  const ultimas     = historico.slice(-EXTRATO_LIMITE).reverse();
  let totalEntrada  = 0;
  let totalSaida    = 0;

  const linhas = ultimas.map((t, i) => {
    if (t.type === 'recebido') totalEntrada += t.amount;
    else                       totalSaida   += t.amount;
    return buildLinhaTransacao(t, i);
  });

  const saldo      = carteira.gold ?? 0;
  const balanco    = totalEntrada - totalSaida;
  const iconeBalanco = balanco >= 0 ? '📈' : '📉';
  const sinalBalanco = balanco >= 0 ? '+' : '';

  await sock.sendMessage(jid, {
    text:
      `📊 ═══ EXTRATO DE TRANSAÇÕES ═══ 📊\n\n` +
      `*ÚLTIMAS ${ultimas.length} MOVIMENTAÇÕES:*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      linhas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━\n` +
      `📋 *RESUMO DO PERÍODO*\n` +
      `  📈 Entradas:  *+${totalEntrada} gold*\n` +
      `  📉 Saídas:    *-${totalSaida} gold*\n` +
      `  ${iconeBalanco} Balanço:   *${sinalBalanco}${balanco} gold*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `  💰 Saldo atual: *${saldo} gold*`,
  }, { quoted: msg });
}

// ─── !garimpar ────────────────────────────────────────────────────────────────

const GARIMPO_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos

// ─── Tabela de minérios (do mais raro ao mais comum) ─────────────────────────
const MINERIOS = [
  { nome: '💎 Diamante',    emoji: '💎', gold: 1000, chance: 0.5  },
  { nome: '🔮 Ametista',    emoji: '🔮', gold: 750,  chance: 1.5  },
  { nome: '💠 Safira',      emoji: '💠', gold: 600,  chance: 3.0  },
  { nome: '❤️ Rubi',        emoji: '❤️', gold: 450,  chance: 5.0  },
  { nome: '🟡 Topázio',     emoji: '🟡', gold: 300,  chance: 10.0 },
  { nome: '🟢 Esmeralda',   emoji: '🟢', gold: 200,  chance: 15.0 },
  { nome: '⚪ Quartzo',     emoji: '⚪', gold: 120,  chance: 25.0 },
  { nome: '🪨 Pedra Comum', emoji: '🪨', gold: 50,   chance: 40.0 },
];
// Soma das chances = 100%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortearMinerio() {
  const roll = Math.random() * 100;
  let acumulado = 0;
  for (const m of MINERIOS) {
    acumulado += m.chance;
    if (roll < acumulado) return m;
  }
  return MINERIOS[MINERIOS.length - 1]; // fallback
}

function formatarTempo(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function msgCooldown(restante) {
  return (
    `⏳ *GARIMPO EM COOLDOWN* ⏳\n\n` +
    `⛏️ Você já garimpou recentemente!\n\n` +
    `⏰ Próximo garimpo em: *${formatarTempo(restante)}*`
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

// Cache local: userId → timestamp do último garimpo bem-sucedido
const garimpoCache = new Map();

async function handleGarimpar(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const agora  = Date.now();

  // ── 1. Checar cache local
  const tsCache = garimpoCache.get(userId) ?? 0;
  if (tsCache > 0) {
    const passado = agora - tsCache;
    if (passado < GARIMPO_COOLDOWN_MS) {
      await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passado) }, { quoted: msg });
      return;
    }
  }

  // ── 2. Update atômico no banco (evita race condition entre instâncias)
  const agora_date = new Date(agora);
  const limiteData = new Date(agora - GARIMPO_COOLDOWN_MS);

  const userAtualizado = await Usuario.findOneAndUpdate(
    {
      idWhatsApp: userId,
      $or: [
        { ultimoGarimpo: { $exists: false } },
        { ultimoGarimpo: null              },
        { ultimoGarimpo: { $lte: limiteData } },
      ],
    },
    { $set: { ultimoGarimpo: agora_date } },
    { new: false, upsert: false }
  );

  if (!userAtualizado) {
    const userAtual = await Usuario.findOne({ idWhatsApp: userId })
      .select('ultimoGarimpo')
      .lean();

    const tsUltimo = userAtual?.ultimoGarimpo
      ? new Date(userAtual.ultimoGarimpo).getTime()
      : agora;

    const restante = GARIMPO_COOLDOWN_MS - (agora - tsUltimo);
    garimpoCache.set(userId, tsUltimo);

    await sock.sendMessage(jid, { text: msgCooldown(Math.max(restante, 0)) }, { quoted: msg });
    return;
  }

  // ── 3. Cooldown livre — registrar cache imediatamente
  garimpoCache.set(userId, agora);

  try {
    const minerio = sortearMinerio();

    await prepareDailyMissionState(userId);

    const [carteira] = await Promise.all([
      alterarGold(userId, jid, minerio.gold, `Garimpo - ${minerio.nome}`),
      Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { 'dailyMissions.progress.gold500': minerio.gold } },
        { upsert: true }
      ),
    ]);

    // Raridade em texto para exibir na mensagem
    const raridade = minerio.chance <= 1
      ? '🌟 *LENDÁRIO!*'
      : minerio.chance <= 5
      ? '✨ *Raro!*'
      : minerio.chance <= 15
      ? '🔹 Incomum'
      : '▫️ Comum';

    await sock.sendMessage(
      jid,
      {
        text:
          `⛏️ ═══ GARIMPO ═══ ⛏️\n\n` +
          `🪨 Você cavou e encontrou um minério!\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `${minerio.emoji} Minério: *${minerio.nome}*\n` +
          `⭐ Raridade: ${raridade}\n` +
          `💎 Encontrado: *+${minerio.gold} gold*\n` +
          `💰 Novo saldo: *${carteira.gold} gold*\n\n` +
          `⏰ Próximo garimpo em: *15 minutos*`,
      },
      { quoted: msg }
    );
  } catch (e) {
    // Rollback do cooldown no banco
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { ultimoGarimpo: userAtualizado.ultimoGarimpo ?? null } }
    ).catch(() => {});

    garimpoCache.delete(userId);

    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
  }
}

// ─── !slots ───────────────────────────────────────────────────────────────────

const SLOTS_SIMBOLOS = [
  { emoji: '💎', nome: 'Diamante', peso: 2  },
  { emoji: '7️⃣',  nome: 'Sete',    peso: 5  },
  { emoji: '🔔', nome: 'Sino',    peso: 10 },
  { emoji: '🍇', nome: 'Uva',     peso: 15 },
  { emoji: '🍉', nome: 'Melancia', peso: 18 },
  { emoji: '🍋', nome: 'Limão',   peso: 22 },
  { emoji: '🍒', nome: 'Cereja',  peso: 28 },
];

// Pré-computa pool ponderada uma única vez
const SLOTS_POOL = SLOTS_SIMBOLOS.flatMap(s => Array(s.peso).fill(s.emoji));

const SLOTS_MULTIPLICADORES = {
  '💎': { tres: 50, dois: 5  },
  '7️⃣':  { tres: 25, dois: 3  },
  '🔔': { tres: 15, dois: 2  },
  '🍇': { tres: 10, dois: 1.5 },
  '🍉': { tres: 8,  dois: 1.5 },
  '🍋': { tres: 6,  dois: 1.2 },
  '🍒': { tres: 4,  dois: 1.2 },
};

const SLOTS_FRAMES_ANIM = [
  ['🎲', '🎲', '🎲'],
  ['🍒', '🎲', '🎲'],
  ['🍋', '🍇', '🎲'],
  ['🍉', '🔔', '🍒'],
  ['🔔', '🍋', '🍒'],
  ['🍇', '🍉', '🍋'],
];
const SLOTS_FRAME_DELAY = 320;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortearSlots() {
  const pick = () => SLOTS_POOL[Math.floor(Math.random() * SLOTS_POOL.length)];
  return [pick(), pick(), pick()];
}

function calcularResultado(r1, r2, r3, aposta) {
  if (r1 === r2 && r2 === r3) {
    const mult  = SLOTS_MULTIPLICADORES[r1]?.tres ?? 4;
    const label =
      mult >= 25
        ? `🌟 *JACKPOT LENDÁRIO!* Três ${r1} — *${mult}x*!`
        : mult >= 10
        ? `🎉 *JACKPOT!* Três ${r1} — *${mult}x*!`
        : `✨ *TRÊS IGUAIS!* ${r1}${r1}${r1} — *${mult}x*!`;
    return { mult, label, tipo: 'tres' };
  }

  if (r1 === r2 || r2 === r3 || r1 === r3) {
    const simbolo = r1 === r2 ? r1 : r3 === r2 ? r2 : r1;
    const mult    = SLOTS_MULTIPLICADORES[simbolo]?.dois ?? 1.2;
    return {
      mult,
      label: `💫 *DOIS IGUAIS!* ${simbolo}${simbolo} — *${mult}x*`,
      tipo: 'dois',
    };
  }

  return { mult: 0, label: `❌ *Perdeu!* O cassino agradece 🏦`, tipo: 'derrota' };
}

function buildFrame(s1, s2, s3, girando = true) {
  const status = girando ? `_Girando..._` : `_Resultado_`;
  return (
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `┌─────────────────┐\n` +
    `│   ${s1}  │  ${s2}  │  ${s3}   │\n` +
    `└─────────────────┘\n\n` +
    status
  );
}

function buildResultado(r1, r2, r3, aposta, mult, label, lucroLiq, saldoFinal) {
  const premio  = Math.floor(aposta * mult);
  const icone   = lucroLiq > 0 ? '📈' : lucroLiq === 0 ? '➖' : '📉';
  const sinal   = lucroLiq >= 0 ? '+' : '';

  return (
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `┌─────────────────┐\n` +
    `│   ${r1}  │  ${r2}  │  ${r3}   │\n` +
    `└─────────────────┘\n\n` +
    `${label}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `📋 *DETALHES DA RODADA*\n` +
    `  💵 Aposta:      *${aposta} gold*\n` +
    (mult > 0
      ? `  ✖️  Multiplicador: *${mult}x*\n` +
        `  🏆 Prêmio:      *${premio} gold*\n`
      : '') +
    `  ${icone} Resultado:   *${sinal}${lucroLiq} gold*\n` +
    `  💰 Saldo final: *${saldoFinal} gold*`
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

async function handleSlots(sock, msg, jid, senderJid, caption) {
  const args   = caption.trim().split(/\s+/);
  const aposta = parseInt(args[1]);

  // ── Validação da aposta
  if (!aposta || isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
        `⚠️ Uso correto: *!slots [valor]*\n` +
        `Exemplo: *!slots 100*\n\n` +
        `💎 Símbolos e multiplicadores (3x iguais):\n` +
        SLOTS_SIMBOLOS.map(s =>
          `  ${s.emoji} ${s.nome}: *${SLOTS_MULTIPLICADORES[s.emoji].tres}x* (par: ${SLOTS_MULTIPLICADORES[s.emoji].dois}x)`
        ).join('\n'),
    }, { quoted: msg });
    return;
  }

  // ── Verifica e debita saldo
  const carteira = await getCarteira(senderJid, jid);
  const saldo    = carteira?.gold ?? 0;

  if (saldo < aposta) {
    await sock.sendMessage(jid, {
      text:
        `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
        `❌ *Saldo insuficiente!*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💰 Seu saldo:  *${saldo} gold*\n` +
        `🎲 Aposta:     *${aposta} gold*\n` +
        `📉 Faltam:     *${aposta - saldo} gold*`,
    }, { quoted: msg });
    return;
  }

  await alterarGold(senderJid, jid, -aposta, 'Slots (aposta)');

  // ── Animação de giro
  const msgInicial = await sock.sendMessage(
    jid,
    { text: buildFrame('🎲', '🎲', '🎲', true) },
    { quoted: msg }
  );

  for (const [s1, s2, s3] of SLOTS_FRAMES_ANIM) {
    await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));
    try { await sock.chatModify({ text: buildFrame(s1, s2, s3, true) }, msgInicial.key); } catch {}
  }

  await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));

  // ── Resultado
  const [r1, r2, r3]    = sortearSlots();
  const { mult, label } = calcularResultado(r1, r2, r3, aposta);
  const premio          = Math.floor(aposta * mult);
  const lucroLiq        = premio - aposta;

  // ── Credita prêmio e calcula saldo final
  let saldoFinal = saldo - aposta;
  if (premio > 0) {
    const carteiraAtualizada = await alterarGold(senderJid, jid, premio, `Slots (${mult}x)`);
    saldoFinal = carteiraAtualizada.gold;
  }

  const textoFinal = buildResultado(r1, r2, r3, aposta, mult, label, lucroLiq, saldoFinal);

  try { await sock.chatModify({ text: textoFinal }, msgInicial.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── !corrida ─────────────────────────────────────────────────────────────────

const CORRIDA_BICHOS = [
  { nome: '🐎 Cavalo',    emoji: '🐎', odds: 2.0, velocidade: 9 },
  { nome: '🐅 Tigre',     emoji: '🐅', odds: 2.5, velocidade: 8 },
  { nome: '🦊 Raposa',    emoji: '🦊', odds: 3.0, velocidade: 7 },
  { nome: '🐕 Cachorro',  emoji: '🐕', odds: 3.5, velocidade: 6 },
  { nome: '🐗 Javali',    emoji: '🐗', odds: 4.0, velocidade: 5 },
  { nome: '🐢 Tartaruga', emoji: '🐢', odds: 8.0, velocidade: 2 },
];

const CORRIDA_PISTA_LEN   = 12;
const CORRIDA_FRAMES      = 5;
const CORRIDA_FRAME_DELAY = 800;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sorteio ponderado pela velocidade — bicho mais rápido tem maior chance de ganhar,
 * mas nunca é garantido (upset pode acontecer).
 */
function sortearVencedor() {
  const pool = CORRIDA_BICHOS.flatMap((b, i) => Array(b.velocidade).fill(i));
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Gera posições aleatórias para cada bicho em um frame de animação.
 */
function gerarPosicoes(frame, totalFrames, vencedorIdx = null) {
  return CORRIDA_BICHOS.map((b, i) => {
    if (vencedorIdx !== null && i === vencedorIdx) return CORRIDA_PISTA_LEN;
    const base  = Math.floor((b.velocidade / 10) * (CORRIDA_PISTA_LEN * (frame / totalFrames)));
    const ruido = Math.floor(Math.random() * 3);
    return Math.min(base + ruido, CORRIDA_PISTA_LEN - 1);
  });
}

function buildFrameCorrida(posicoes, titulo = '_Correndo..._') {
  let texto = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;

  for (let i = 0; i < CORRIDA_BICHOS.length; i++) {
    const pos    = posicoes[i];
    const trilha = '─'.repeat(pos) + CORRIDA_BICHOS[i].emoji + '─'.repeat(Math.max(0, CORRIDA_PISTA_LEN - pos));
    texto += `${trilha} 🏁\n`;
  }

  texto += `\n${titulo}`;
  return texto;
}

function buildResultadoCorrida(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal) {
  const vencedor = CORRIDA_BICHOS[vencedorIdx];
  const escolha  = CORRIDA_BICHOS[escolhaIdx];
  const ganhou   = vencedorIdx === escolhaIdx;
  const premio   = ganhou ? Math.floor(aposta * escolha.odds) : 0;
  const icone    = ganhou ? '🎉' : '❌';
  const sinal    = lucroLiq >= 0 ? '+' : '';

  let texto = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;

  for (let i = 0; i < CORRIDA_BICHOS.length; i++) {
    if (i === vencedorIdx) {
      texto += `${'─'.repeat(CORRIDA_PISTA_LEN)}${CORRIDA_BICHOS[i].emoji} 🏆\n`;
    } else {
      const pos = Math.floor(Math.random() * (CORRIDA_PISTA_LEN - 2)) + 2;
      texto += `${'─'.repeat(pos)}${CORRIDA_BICHOS[i].emoji}${'─'.repeat(CORRIDA_PISTA_LEN - pos)} 🏁\n`;
    }
  }

  texto +=
    `\n━━━━━━━━━━━━━━━━\n` +
    `🎯 Sua aposta: *${escolha.nome}* (odds ${escolha.odds}x)\n` +
    `🏆 Vencedor:   *${vencedor.nome}*\n\n` +
    `${icone} ${ganhou
      ? `*VITÓRIA!* Você ganhou *+${premio} gold*!`
      : `*DERROTA!* Você perdeu *${aposta} gold.*`
    }\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `  💵 Aposta:      *${aposta} gold*\n` +
    (ganhou
      ? `  ✖️  Odds:         *${escolha.odds}x*\n` +
        `  🏆 Prêmio:      *${premio} gold*\n`
      : '') +
    `  📊 Resultado:   *${sinal}${lucroLiq} gold*\n` +
    `  💰 Saldo final: *${saldoFinal} gold*`;

  return texto;
}

// ─── Handler principal ────────────────────────────────────────────────────────

async function handleCorrida(sock, msg, jid, senderJid, caption) {
  const args   = caption.trim().split(/\s+/);
  const escolha = parseInt(args[1]);
  const aposta  = parseInt(args[2]);

  const escolhaValida = escolha >= 1 && escolha <= CORRIDA_BICHOS.length;

  if (!escolha || !aposta || isNaN(escolha) || isNaN(aposta) || !escolhaValida || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `🏁 *CORRIDA DE BICHOS* 🏁\n\n` +
        `⚠️ Uso: *!corrida [bicho] [valor]*\n\n` +
        `*Escolha seu corredor:*\n` +
        CORRIDA_BICHOS.map((b, i) =>
          `  ${i + 1}️⃣ ${b.nome} — odds *${b.odds}x*`
        ).join('\n') +
        `\n\n💡 Exemplo: *!corrida 1 100* (100 gold no Cavalo)\n` +
        `⚠️ Bichos mais lentos pagam mais, mas ganham menos!`,
    }, { quoted: msg });
    return;
  }

  const escolhaIdx = escolha - 1;

  // ── Verifica e debita saldo
  const carteira = await getCarteira(senderJid, jid);
  const saldo    = carteira?.gold ?? 0;

  if (saldo < aposta) {
    await sock.sendMessage(jid, {
      text:
        `🏁 *CORRIDA DE BICHOS* 🏁\n\n` +
        `❌ *Saldo insuficiente!*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💰 Seu saldo:  *${saldo} gold*\n` +
        `🎲 Aposta:     *${aposta} gold*\n` +
        `📉 Faltam:     *${aposta - saldo} gold*`,
    }, { quoted: msg });
    return;
  }

  await alterarGold(senderJid, jid, -aposta, `Corrida (${CORRIDA_BICHOS[escolhaIdx].nome})`);

  // ── Sortear vencedor antes da animação (resultado já definido)
  const vencedorIdx = sortearVencedor();

  // ── Animação
  const posIniciais = CORRIDA_BICHOS.map(() => 0);
  const msgCorrida  = await sock.sendMessage(
    jid,
    { text: buildFrameCorrida(posIniciais, '_Largando..._') },
    { quoted: msg }
  );

  for (let f = 1; f <= CORRIDA_FRAMES; f++) {
    await new Promise(r => setTimeout(r, CORRIDA_FRAME_DELAY));
    const posicoes = gerarPosicoes(f, CORRIDA_FRAMES);
    try {
      await sock.chatModify(
        { text: buildFrameCorrida(posicoes, `_Volta ${f} de ${CORRIDA_FRAMES}..._`) },
        msgCorrida.key
      );
    } catch {}
  }

  // ── Frame final — vencedor chegou
  await new Promise(r => setTimeout(r, CORRIDA_FRAME_DELAY));
  const posFinal = gerarPosicoes(CORRIDA_FRAMES, CORRIDA_FRAMES, vencedorIdx);
  try { await sock.chatModify({ text: buildFrameCorrida(posFinal, `_Finalizando..._`) }, msgCorrida.key); } catch {}
  await new Promise(r => setTimeout(r, 600));

  // ── Creditar prêmio e calcular saldo final
  const ganhou   = escolhaIdx === vencedorIdx;
  const premio   = ganhou ? Math.floor(aposta * CORRIDA_BICHOS[escolhaIdx].odds) : 0;
  const lucroLiq = premio - aposta;

  let saldoFinal = saldo - aposta;
  if (premio > 0) {
    const carteiraAtualizada = await alterarGold(senderJid, jid, premio, `Corrida (${CORRIDA_BICHOS[escolhaIdx].nome})`);
    saldoFinal = carteiraAtualizada.gold;
  }

  const textoFinal = buildResultadoCorrida(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal);

  try { await sock.chatModify({ text: textoFinal }, msgCorrida.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── Helpers do ranking ───────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function barraProgresso(valor, maximo, tamanho = 10) {
  if (!maximo || maximo <= 0) return '░'.repeat(tamanho);
  const preenchido = Math.min(Math.round((valor / maximo) * tamanho), tamanho);
  return '█'.repeat(preenchido) + '░'.repeat(tamanho - preenchido);
}

// ═══════════════════════════════════════════════════════════════
// ─── !rankgold ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRankGold(sock, msg, jid, contactNames = {}) {
  if (!jid?.endsWith('@g.us')) {
    await sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.',
    }, { quoted: msg });
    return;
  }

  try {
    // 1. Busca a lista de membros que realmente estão no grupo agora
    const metadata = await sock.groupMetadata(jid);
    const membrosAtuais = new Set(metadata.participants.map(p => p.id));

    // 2. Busca uma amostragem maior no banco para garantir que, filtrando os banidos, ainda sobrem 10
    const candidatos = await CarteiraGrupo.find({ idGrupo: jid, gold: { $gt: 0 } })
      .sort({ gold: -1 })
      .limit(100) // Puxa até 100 jogadores ativos localmente
      .lean();

    // 3. Filtra mantendo apenas quem ainda está presente no chat
    const top = candidatos
      .filter(u => membrosAtuais.has(u.idWhatsApp))
      .slice(0, 10); // Mantém o Top 10 real e ativo

    if (!top?.length) {
      await sock.sendMessage(jid, {
        text: '💰 *RANKING DE GOLD*\n\nNenhum membro ativo com Gold registrado neste grupo ainda!\n\n⛏️ Use *!garimpar* para começar a ganhar Gold.',
      }, { quoted: msg });
      return;
    }

    const totalGold = top.reduce((s, u) => s + (u.gold || 0), 0);
    const maxGold   = top[0].gold || 1;

    // Garante que a constante MEDALS tenha fallbacks seguros caso falte no escopo global
    const medalhasfbt = ['🥇', '🥈', '🥉', '🔹 4.', '🔹 5.', '🔹 6.', '🔹 7.', '🔹 8.', '🔹 9.', '🔹 10.'];

    const linhas = top.map((u, i) => {
      const count = u.gold || 0;
      const pct   = ((count / totalGold) * 100).toFixed(1);
      
      // Executa a barra de progresso visual (certifique-se de que a função barraProgresso existe no arquivo)
      const bar    = typeof barraProgresso === 'function' ? barraProgresso(count, maxGold) : '░░░░░░░░░░';
      const numero = u.idWhatsApp.split('@')[0].split(':')[0];
      const medal  = typeof MEDALS !== 'undefined' && MEDALS[i] ? MEDALS[i] : medalhasfbt[i];
      
      // Mudança para mencionar via @ em vez de injetar o nome de contato salvo
      return `${medal} @${numero}\n   ${bar} ${count} 💰 (${pct}%)`;
    }).join('\n\n');

    const mentions = top.map(u => u.idWhatsApp);

    await sock.sendMessage(jid, {
      text:
        `💰 *RANKING DE GOLD — MEMBROS ATIVOS* 💰\n\n` +
        `${linhas}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🏦 Total do Top 10: *${totalGold} Gold*\n` +
        `⛏️ Use *!garimpar* para subir no ranking!`,
      mentions,
    }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankGold] Erro:', err.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao carregar o ranking. Tente novamente.',
    }, { quoted: msg });
  }
}

// ─── !give ────────────────────────────────────────────────────────────────────

async function handleGive(sock, msg, jid, caption) {
  const userId       = msg.key.participant || msg.key.remoteJid;
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!mentionedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marca quem vai receber!\nExemplo: *!give @fulano pizza*',
    }, { quoted: msg });
    return;
  }

  if (mentionedJid.split('@')[0] === userId.split('@')[0]) {
    await sock.sendMessage(jid, {
      text: '😂 Você não pode dar item pra si mesmo!',
    }, { quoted: msg });
    return;
  }

  // Extrai o item ignorando a menção (@xxx)
  const match = caption.match(/give\s+@\S+\s+(\S+)/i) || caption.match(/give\s+(\S+)/i);
  if (!match) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!give @fulano <item>*\nExemplo: *!give @João pizza*',
    }, { quoted: msg });
    return;
  }

  const itemKey  = match[1].toLowerCase().trim();
  const itemInfo = ITENS_LOJA[itemKey];

  if (!itemInfo) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Item *${itemKey}* não existe!\n\n` +
        `Use *!loja* pra ver os itens disponíveis.`,
    }, { quoted: msg });
    return;
  }

  // ── Checar se o remetente tem o item
  const remetente = await Usuario.findOne({ idWhatsApp: userId }).select('inventory').lean();
  const qtd       = remetente?.inventory?.[itemKey] ?? 0;

  if (qtd <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Você não possui *${itemInfo.nome}* no inventário!\n\n` +
        `Use *!inventario* pra ver seus itens ou *!buy ${itemKey}* pra comprar.`,
    }, { quoted: msg });
    return;
  }

  // ── Remover do remetente
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $inc: { [`inventory.${itemKey}`]: -1 } }
  );

  // ── Adicionar ao destinatário
  await Usuario.findOneAndUpdate(
    { idWhatsApp: mentionedJid },
    { $inc: { [`inventory.${itemKey}`]: 1 } },
    { upsert: true }
  );

  const numeroAlvo = mentionedJid.split('@')[0].split(':')[0];

  await sock.sendMessage(jid, {
    text:
      `🎁 *PRESENTE ENVIADO!* 🎁\n\n` +
      `📦 Item: *${itemInfo.nome}*\n` +
      `➡️ Para: *@${numeroAlvo}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `_Use !inventario pra conferir seus itens._`,
    mentions: [mentionedJid],
  }, { quoted: msg });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

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
  getSaldoGrupo,   // substitui getSaldoAtual
  ITENS_LOJA,
  handleRankGold,
  handleGive,
};