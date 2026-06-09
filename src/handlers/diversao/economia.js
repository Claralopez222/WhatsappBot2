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
// Importar catálogos de pesca para o !comprar reconhecer varas e iscas
const { VARAS_PESCA, ISCAS } = require('./pesca');

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
// ─── !loja (sem mudanças visuais) ────────────────────────────────────────────

async function handleLoja(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `🛒 *LOJA PIROQUINHAS* 🛒\n\n` +
    `🍔 *COMIDA*\n🍕 Pizza — 50 gold\n🍔 Hamburger — 40 gold\n🍗 Frango — 35 gold\n🍫 Chocolate — 25 gold\n\n` +
    `🐾 *PETS*\n🐶 Cachorro — 100 gold\n🐱 Gato — 100 gold\n🐰 Coelho — 80 gold\n\n` +
    `💕 *CASAL*\n💐 Flores — 60 gold\n💌 Carta de amor — 80 gold\n💎 Anel — 500 gold\n\n` +
    `✨ *ESTILO*\n👕 Camiseta — 50 gold\n👖 Calça — 60 gold\n👟 Sapato — 70 gold\n\n` +
    `💻 *TECNOLOGIA*\n📱 Celular — 200 gold\n💾 Memória USB — 150 gold\n🖥️ Computador — 500 gold\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*COMO COMPRAR?*\n  ${P}buy <nome_item>\n\n` +
    `*SEUS ITENS?*\n  ${P}inventario\n\n` +
    `*VENDER ITENS?*\n  ${P}vender <item>`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Lojas específicas (sem mudanças) ────────────────────────────────────────

async function handleLojaFood(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `🍔 *LOJA DE COMIDA* 🍔\n\n` +
    `🍕 *PIZZAS*\n  🍕 Pizza Margherita — 50 gold\n  🍕 Pizza Pepperoni — 60 gold\n  🍕 Pizza 4 Queijos — 70 gold\n\n` +
    `🍔 *LANCHES*\n  🍔 Hamburger Simples — 40 gold\n  🌭 Hot Dog — 35 gold\n  🥪 Sanduíche — 45 gold\n\n` +
    `🍗 *CARNES*\n  🍗 Frango Frito — 35 gold\n  🍗 Costela — 80 gold\n\n` +
    `🍫 *DOCES*\n  🍫 Chocolate — 25 gold\n  🍰 Bolo — 65 gold\n  🍦 Sorvete — 30 gold\n\n` +
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <nome_item>`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleLojaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `🐾 *LOJA DE PETS* 🐾\n\n` +
    `🦴 *COMIDAS*\n  🦴 Ração Normal — 20 gold\n  🦴 Ração Premium — 45 gold\n  🍖 Osso Saboroso — 40 gold\n\n` +
    `🎾 *BRINQUEDOS*\n  🎾 Bolinha de Tênis — 35 gold\n  🧸 Pelúcia — 50 gold\n  🎪 Disco Voador — 60 gold\n\n` +
    `💊 *MEDICAMENTOS*\n  💊 Remédio Geral — 80 gold\n  🩹 Bandagem — 50 gold\n  💉 Vacina — 120 gold\n\n` +
    `⚙️ *ACESSÓRIOS*\n  🎀 Coleira Colorida — 55 gold\n  👑 Coroa Pet — 100 gold\n\n` +
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <nome_item>`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleLojaTec(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `💻 *LOJA DE TECNOLOGIA* 💻\n\n` +
    `🖥️ *COMPUTADORES*\n  🖥️ Notebook Gamer — 5000 gold\n  💾 Notebook i5 — 3500 gold\n  🖥️ Desktop Gaming — 6000 gold\n\n` +
    `📱 *SMARTPHONES*\n  📱 Smartphone Premium — 2500 gold\n  📱 Smartphone Gamer — 3500 gold\n  📱 Tablet Pro — 3500 gold\n\n` +
    `🎮 *PERIFÉRICOS*\n  🖱️ Mouse Gamer — 350 gold\n  ⌨️ Teclado Mecânico — 450 gold\n  🖥️ Monitor 4K — 2500 gold\n  🎧 Headset Gamer — 800 gold\n\n` +
    `🔌 *ACESSÓRIOS*\n  🔌 Cabo USB-C — 50 gold\n  💾 SSD 1TB — 800 gold\n  💾 SSD 2TB — 1500 gold\n  💾 Memória RAM 16GB — 600 gold\n\n` +
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <nome_item>`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleLojaCasal(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto =
    `💕 *LOJA DE CASAL* 💕\n\n` +
    `🎁 *PRESENTES ROMÂNTICOS*\n  🌹 Flores — 60 gold\n  💌 Carta de Amor — 80 gold\n  🍫 Caixa de Chocolate — 75 gold\n  🍓 Morango com Chocolate — 55 gold\n  🧸 Ursinho de Pelúcia — 130 gold\n\n` +
    `💎 *JOIAS E ACESSÓRIOS*\n  💍 Anel — 500 gold\n  📿 Colar Casal — 200 gold\n  💪 Pulseira Casal — 120 gold\n\n` +
    `🎽 *VESTUÁRIO*\n  👕 Camiseta Casal — 110 gold\n  🧢 Gorro Casal — 85 gold\n  🩴 Chinelo de Casal — 95 gold\n\n` +
    `🏠 *DECORAÇÃO*\n  💡 Luminária Romântica — 140 gold\n  🕯️ Vela Aromática — 90 gold\n  🪞 Espelho com LED — 180 gold\n\n` +
    `🍷 *BEBIDAS E GOURMET*\n  ☕ Chá Especial Casal — 70 gold\n  🍷 Taça para Vinho — 160 gold\n  🍾 Garrafa Vinho Tinto — 250 gold\n\n` +
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}buy <nome_item>\n\n` +
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
  const itemInfo = ITENS_LOJA[itemNome] || VARAS_PESCA[itemNome] || ISCAS[itemNome];

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

  // 1) Adicionar ao inventário correto
  try {
    const ehPesca = !!(VARAS_PESCA[itemNome] || ISCAS[itemNome]);
    const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

    if (ehPesca) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: idGrupo },
        { $inc: { [`itensPesca.${itemNome}`]: 1 } },
        { upsert: true }
      );
    } else {
      let user = await Usuario.findOne({ idWhatsApp: userId });
      if (!user) {
        user = new Usuario({ idWhatsApp: userId, gold: 0, inventory: { [itemNome]: 1 } });
      } else {
        if (!user.inventory) user.inventory = {};
        user.inventory[itemNome] = (user.inventory[itemNome] || 0) + 1;
      }
      await user.save();
    }
  } catch (e) {
    console.error('⚠️ Erro ao adicionar inventário:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar a compra! Tente novamente.' }, { quoted: msg });
    return;
  }

  // 2) Debitar gold da carteira do grupo
  const carteiraAtualizada = await debitarGold(userId, idGrupo, preco, `Compra: ${itemInfo.nome}`);
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
    await sock.sendMessage(jid, { text: '⚠️ Use: *!vender <item> <preco> <quantidade>*\nExemplo: *!vender pizza 50 3*' }, { quoted: msg });
    return;
  }

  const itemKey   = match[1].toLowerCase().trim();
  const preco     = parseInt(match[2]);
  const quantidade = parseInt(match[3]);
  const itemInfo  = ITENS_LOJA[itemKey];

  if (!itemInfo)              { await sock.sendMessage(jid, { text: `⚠️ Item *${itemKey}* não existe!` }, { quoted: msg }); return; }
  if (preco <= 0 || quantidade <= 0) { await sock.sendMessage(jid, { text: '⚠️ Preço e quantidade devem ser maiores que 0!' }, { quoted: msg }); return; }

  const sellerName = userId.split('@')[0].split(':')[0];
  await sock.sendMessage(jid, {
    text:
      `✅ *OFERTA CRIADA!* ✅\n\n` +
      `📦 *Item:* ${itemInfo.nome}\n` +
      `💵 *Preço:* ${preco} gold cada\n` +
      `📊 *Quantidade:* ${quantidade}\n` +
      `👤 *Vendedor:* ${sellerName}\n\n` +
      `━━━━━━━━━━━━━━━━\n*PRÓXIMOS PASSOS:*\n  Ver ofertas: *!avenda*`,
  }, { quoted: msg });
}

'use strict';

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

  // ── Filtrar apenas itens conhecidos e com quantidade > 0
  const itensValidos = Object.entries(user?.inventory ?? {})
    .filter(([key, qtd]) => qtd > 0 && ITENS_LOJA[key])
    .map(([key, qtd]) => ({ info: ITENS_LOJA[key], qtd }));

  if (itensValidos.length === 0) {
    await sock.sendMessage(jid, { text: MSG_INVENTARIO_VAZIO }, { quoted: msg });
    return;
  }

  const totalItens = itensValidos.reduce((acc, { qtd }) => acc + qtd, 0);

  const linhas = itensValidos
    .map(({ info, qtd }) => `  • ${info.nome} × ${qtd}`)
    .join('\n');

  await sock.sendMessage(jid, {
    text:
      `📦 *SEU INVENTÁRIO* 📦\n\n` +
      `${linhas}\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*TOTAL:* ${totalItens} item(ns)\n\n` +
      `💰 *SALDO NESTE GRUPO:*\n` +
      `  Gold: *${carteira?.gold ?? 0}* gold`,
  }, { quoted: msg });
}

// ─── !pix ─────────────────────────────────────────────────────────────────────
// Transfere gold dentro do mesmo grupo (CarteiraGrupo → CarteiraGrupo)

/**
 * Extrai { targetJid, numeroPura, quantia } do contexto da mensagem.
 * Retorna null se não for possível resolver os parâmetros.
 */
function parsearPix(msg, caption) {
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  // ── Caso 1: menção via @tag
  if (mentionedJid) {
    const parts   = caption.trim().split(/\s+/);
    const quantia = parseInt(parts[parts.length - 1], 10);
    if (isNaN(quantia) || quantia <= 0) return null;
    return {
      targetJid:  mentionedJid,
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

  return {
    targetJid:  `${numeroPura}@s.whatsapp.net`,
    numeroPura,
    quantia,
  };
}

async function handlePix(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
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

  // ── Usa transferirGold do carteiraService: débito + crédito atômicos em sequência.
  //    Se o débito falhar (saldo insuficiente), o crédito não acontece.
  let resultado;
  try {
    resultado = await transferirGold(
      userId,
      targetJid,
      jid,
      quantia,
      'PIX'
    );
  } catch (e) {
    if (e instanceof RangeError) {
      const saldo = (await getCarteira(userId, jid))?.gold ?? 0;
      await sock.sendMessage(jid, {
        text:
          `⚠️ *SALDO INSUFICIENTE!*\n\n` +
          `💰 Você tem: *${saldo}* gold\n` +
          `💸 Precisa de: *${quantia}* gold`,
      }, { quoted: msg });
      return;
    }
    throw e; // erro inesperado — deixa subir
  }

  const remetenteNum = userId.split('@')[0].split(':')[0];

  await sock.sendMessage(jid, {
    text:
      `✅ *TRANSFERÊNCIA REALIZADA!* ✅\n\n` +
      `💸 *${quantia} gold* enviado para *@${numeroPura}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 Seu novo saldo: *${resultado.de.gold}* gold`,
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

const EXTRATO_LIMITE = 10;

const EXTRATO_DATE_FMT = { day: '2-digit', month: '2-digit' };
const EXTRATO_HORA_FMT = { hour: '2-digit', minute: '2-digit' };

function formatarDataHora(date) {
  if (!date) return { data: '??/??', hora: '??:??' };
  const d = new Date(date);
  return {
    data: d.toLocaleDateString('pt-BR', EXTRATO_DATE_FMT),
    hora: d.toLocaleTimeString('pt-BR', EXTRATO_HORA_FMT),
  };
}

function buildLinhaTransacao(t) {
  const { data, hora } = formatarDataHora(t.date);
  const recebido = t.type === 'recebido';
  return `  ${recebido ? '✅' : '❌'} *${recebido ? '+' : '-'}${t.amount}g* | ${t.item} | ${data} ${hora}`;
}

async function handleExtrato(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  const carteira  = await getCarteira(userId, jid);
  const historico = carteira?.goldHistory ?? [];

  if (historico.length === 0) {
    await sock.sendMessage(jid, {
      text:
        `📊 *EXTRATO DE TRANSAÇÕES* 📊\n\n` +
        `😔 Nenhuma transação registrada ainda.\n\n` +
        `💰 *Saldo atual:* ${carteira?.gold ?? 0} gold`,
    }, { quoted: msg });
    return;
  }

  const ultimas = historico.slice(-EXTRATO_LIMITE).reverse();

  let totalEntrada = 0;
  let totalSaida   = 0;
  const linhas     = [];

  for (const t of ultimas) {
    if (t.type === 'recebido') totalEntrada += t.amount;
    else                       totalSaida   += t.amount;
    linhas.push(buildLinhaTransacao(t));
  }

  await sock.sendMessage(jid, {
    text:
      `📊 ═══ EXTRATO DE TRANSAÇÕES ═══ 📊\n\n` +
      `*ÚLTIMAS ${ultimas.length} TRANSAÇÕES:*\n` +
      linhas.join('\n') +
      `\n\n━━━━━━━━━━━━━━━━\n*RESUMO DO PERÍODO:*\n` +
      `  📈 Entradas: *+${totalEntrada}* gold\n` +
      `  📉 Saídas: *-${totalSaida}* gold\n` +
      `  💰 Saldo atual: *${carteira.gold}* gold`,
  }, { quoted: msg });
}

// ─── !garimpar ────────────────────────────────────────────────────────────────

const GARIMPO_COOLDOWN_MS = 60 * 60 * 1000;
const GARIMPO_GOLD_MIN    = 30;
const GARIMPO_GOLD_MAX    = 129;

// Cache local: userId → timestamp do último garimpo bem-sucedido
// Evita round-trip ao banco em chamadas duplicadas / double-tap
const garimpoCache = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortearOuro() {
  return (
    Math.floor(Math.random() * (GARIMPO_GOLD_MAX - GARIMPO_GOLD_MIN + 1)) +
    GARIMPO_GOLD_MIN
  );
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

async function handleGarimpar(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const agora  = Date.now();

  // ── 1. Checar cache local (evita chamada desnecessária ao banco e double-tap)
  const tsCache = garimpoCache.get(userId) ?? 0;
  if (tsCache > 0) {
    const passado = agora - tsCache;
    if (passado < GARIMPO_COOLDOWN_MS) {
      await sock.sendMessage(jid, { text: msgCooldown(GARIMPO_COOLDOWN_MS - passado) }, { quoted: msg });
      return;
    }
  }

  // ── 2. Update atômico: só avança se o cooldown realmente expirou no banco.
  //       Elimina race condition entre instâncias / após reinicialização.
  const agora_date   = new Date(agora);
  const limiteData   = new Date(agora - GARIMPO_COOLDOWN_MS);

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
    { new: false, upsert: false } // `new: false` → retorna doc ANTES da alteração
  );

  // Se não encontrou doc elegível, o cooldown ainda está ativo no banco
  if (!userAtualizado) {
    const userAtual = await Usuario.findOne({ idWhatsApp: userId })
      .select('ultimoGarimpo')
      .lean();

    const tsUltimo = userAtual?.ultimoGarimpo
      ? new Date(userAtual.ultimoGarimpo).getTime()
      : agora;

    const restante = GARIMPO_COOLDOWN_MS - (agora - tsUltimo);

    // Sincroniza cache com a realidade do banco
    garimpoCache.set(userId, tsUltimo);

    await sock.sendMessage(jid, { text: msgCooldown(Math.max(restante, 0)) }, { quoted: msg });
    return;
  }

  // ── 3. Cooldown confirmado como livre — marcar cache imediatamente
  garimpoCache.set(userId, agora);

  try {
    const ouro = sortearOuro();

    // Atualizar missão diária e creditar gold em paralelo
    await prepareDailyMissionState(userId);

    const [carteira] = await Promise.all([
      alterarGold(userId, jid, ouro, 'Garimpo'),
      Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { 'dailyMissions.progress.gold500': ouro } },
        { upsert: true }
      ),
    ]);

    await sock.sendMessage(
      jid,
      {
        text:
          `⛏️ ═══ GARIMPO ═══ ⛏️\n\n` +
          `🪨 Você cavou fundo e encontrou ouro!\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `💎 Encontrado: *+${ouro} gold*\n` +
          `💰 Novo saldo: *${carteira.gold} gold*\n\n` +
          `⏰ Próximo garimpo em: *1 hora*`,
      },
      { quoted: msg }
    );
  } catch (e) {
    // Rollback do cooldown no banco para o estado anterior
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { ultimoGarimpo: userAtualizado.ultimoGarimpo ?? null } }
    ).catch(() => {}); // silencia erro secundário

    // Desfaz cache para liberar nova tentativa
    garimpoCache.delete(userId);

    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
  }
}

'use strict';

// ─── Helpers compartilhados ───────────────────────────────────────────────────

/**
 * Tenta debitar gold usando o update atômico do carteiraService.
 * Retorna a carteira atualizada ou null se saldo insuficiente.
 */
async function tentarDebitar(userId, idGrupo, valor, descricao) {
  try {
    return await alterarGold(userId, idGrupo, -valor, descricao);
  } catch (e) {
    if (e instanceof RangeError) return null; // saldo insuficiente
    throw e;
  }
}

/**
 * Credita prêmio e atualiza missão diária em paralelo.
 * Retorna o saldo final atualizado.
 */
async function creditarPremioEMissao(userId, idGrupo, premio, descricao, lucroLiq, saldoFallback) {
  const ops = [];

  if (premio > 0) {
    ops.push(alterarGold(userId, idGrupo, premio, descricao));
  }

  if (lucroLiq > 0) {
    ops.push(
      prepareDailyMissionState(userId).then(() =>
        Usuario.findOneAndUpdate(
          { idWhatsApp: userId },
          { $inc: { 'dailyMissions.progress.gold500': lucroLiq } }
        )
      )
    );
  }

  if (ops.length === 0) return saldoFallback;

  const [carteira] = await Promise.all(ops);
  return carteira?.gold ?? saldoFallback;
}

function msgSaldoInsuficiente(saldo, aposta) {
  return (
    `❌ *Saldo insuficiente!*\n\n` +
    `💰 Seu saldo: *${saldo}* gold\n` +
    `💸 Aposta: *${aposta}* gold`
  );
}

// ─── !slots ───────────────────────────────────────────────────────────────────

const SLOTS_FRUTAS       = ['🍒', '🍋', '🍇', '🍉', '🔔'];
const SLOTS_FRAMES       = [
  `[ 🎲 | 🍒 | 🎲 ]`,
  `[ 🍋 | 🎲 | 🍇 ]`,
  `[ 🍉 | 🍒 | 🔔 ]`,
  `[ 🔔 | 🍋 | 🍒 ]`,
  `[ 🍇 | 🍉 | 🍋 ]`,
];
const SLOTS_FRAME_DELAY  = 300;

function sortearSlots() {
  const pick = () => SLOTS_FRUTAS[Math.floor(Math.random() * SLOTS_FRUTAS.length)];
  return [pick(), pick(), pick()];
}

function calcularMultiplicador(r1, r2, r3) {
  if (r1 === r2 && r2 === r3)                   return { mult: 10,  label: '🎉 *JACKPOT MÁXIMO!* Três iguais! Multiplicado por 10!' };
  if (r1 === r2 || r2 === r3 || r1 === r3)      return { mult: 2.5, label: '✨ *QUASE JACKPOT!* Duas iguais! Multiplicado por 2.5!' };
  return { mult: 0, label: '❌ *Você perdeu!* O banco agradece.' };
}

function buildSlotsFrame(frame) {
  return `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     ${frame}\n\n_Girando..._`;
}

function buildSlotsResultado(r1, r2, r3, aposta, multiplicador, label, lucroLiq, saldoFinal) {
  const premio = Math.floor(aposta * multiplicador);
  return (
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `     [ ${r1} | ${r2} | ${r3} ]\n\n` +
    `${label}\n` +
    `━━━━━━━━━━━━━━━━\n*DETALHES:*\n` +
    `  💵 Aposta: *${aposta}* gold\n` +
    (multiplicador > 0
      ? `  ✖️ Multiplicador: *${multiplicador}x*\n  💰 Prêmio: *${premio}* gold\n`
      : '') +
    `  ${lucroLiq >= 0 ? '✅' : '❌'} Resultado: *${lucroLiq >= 0 ? '+' : ''}${lucroLiq}* gold\n` +
    `  💎 Saldo: *${saldoFinal}* gold`
  );
}

async function handleSlots(sock, msg, jid, senderJid, caption) {
  const args   = caption.trim().split(/\s+/);
  const aposta = parseInt(args[1]);

  if (!aposta || isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Uso correto: *!slots [valor]*\nExemplo: *!slots 50*',
    }, { quoted: msg });
    return;
  }

  // ── Débito atômico (usa RangeError do carteiraService para saldo insuficiente)
  const carteiraDebitada = await tentarDebitar(senderJid, jid, aposta, 'Slots');
  if (!carteiraDebitada) {
    const saldo = (await getCarteira(senderJid, jid))?.gold ?? 0;
    await sock.sendMessage(jid, { text: msgSaldoInsuficiente(saldo, aposta) }, { quoted: msg });
    return;
  }

  // ── Animação de giro
  const msgInicial = await sock.sendMessage(jid, {
    text: buildSlotsFrame('[ 🎲 | 🎲 | 🎲 ]'),
  }, { quoted: msg });

  for (const frame of SLOTS_FRAMES) {
    await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));
    try { await sock.chatModify({ text: buildSlotsFrame(frame) }, msgInicial.key); } catch {}
  }
  await new Promise(r => setTimeout(r, SLOTS_FRAME_DELAY));

  // ── Resultado
  const [r1, r2, r3]      = sortearSlots();
  const { mult, label }   = calcularMultiplicador(r1, r2, r3);
  const premio            = Math.floor(aposta * mult);
  const lucroLiq          = premio - aposta;
  const saldoFallback     = carteiraDebitada.gold + lucroLiq;

  const saldoFinal = await creditarPremioEMissao(
    senderJid, jid, premio, `Slots (${mult}x)`, lucroLiq, saldoFallback
  );

  const textoFinal = buildSlotsResultado(r1, r2, r3, aposta, mult, label, lucroLiq, saldoFinal);

  try { await sock.chatModify({ text: textoFinal }, msgInicial.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── !corrida ─────────────────────────────────────────────────────────────────

const CORRIDA_BICHOS  = ['🐎 Cavalo', '🐅 Tigre', '🐢 Tartaruga', '🐕 Cachorro'];
const CORRIDA_EMOJIS  = ['🐎', '🐅', '🐢', '🐕'];
const CORRIDA_MULT    = 3;

function buildPista(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal) {
  let pista = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;

  for (let i = 0; i < CORRIDA_BICHOS.length; i++) {
    pista += i === vencedorIdx
      ? `${CORRIDA_EMOJIS[i]} ══════════════ 💨 🏆\n`
      : `${CORRIDA_EMOJIS[i]} ${'═'.repeat(Math.floor(Math.random() * 8) + 2)}\n`;
  }

  pista +=
    `\n━━━━━━━━━━━━━━━━\n` +
    `🎯 Você apostou no *${CORRIDA_BICHOS[escolhaIdx]}*\n` +
    `🏆 Vencedor: *${CORRIDA_BICHOS[vencedorIdx]}*\n\n`;

  pista += lucroLiq > 0
    ? `🎉 *VITÓRIA!* Você ganhou *+${aposta * CORRIDA_MULT}* gold!\n`
    : `❌ *DERROTA!* Você perdeu *${aposta}* gold.\n`;

  pista += `💰 Saldo: *${saldoFinal}* gold`;

  return pista;
}

async function handleCorrida(sock, msg, jid, senderJid, caption) {
  const args    = caption.trim().split(/\s+/);
  const escolha = parseInt(args[1]); // 1–4
  const aposta  = parseInt(args[2]);

  const escolhaValida = escolha >= 1 && escolha <= CORRIDA_BICHOS.length;

  if (!escolha || !aposta || isNaN(escolha) || isNaN(aposta) || !escolhaValida || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Uso correto: *!corrida [bicho] [valor]*\n\n` +
        `*Escolha seu corredor:*\n` +
        CORRIDA_BICHOS.map((b, i) => `${i + 1}️⃣ ${b}`).join('\n') +
        `\n\nExemplo: *!corrida 1 50* (Aposta 50 no Cavalo)`,
    }, { quoted: msg });
    return;
  }

  const escolhaIdx = escolha - 1;

  // ── Débito atômico
  const carteiraDebitada = await tentarDebitar(
    senderJid, jid, aposta, `Corrida (${CORRIDA_BICHOS[escolhaIdx]})`
  );
  if (!carteiraDebitada) {
    const saldo = (await getCarteira(senderJid, jid))?.gold ?? 0;
    await sock.sendMessage(jid, { text: msgSaldoInsuficiente(saldo, aposta) }, { quoted: msg });
    return;
  }

  // ── Resultado
  const vencedorIdx  = Math.floor(Math.random() * CORRIDA_BICHOS.length);
  const ganhou       = escolhaIdx === vencedorIdx;
  const premio       = ganhou ? aposta * CORRIDA_MULT : 0;
  const lucroLiq     = premio - aposta;
  const saldoFallback = carteiraDebitada.gold + lucroLiq;

  const saldoFinal = await creditarPremioEMissao(
    senderJid, jid, premio, `Corrida (${CORRIDA_BICHOS[escolhaIdx]})`, lucroLiq, saldoFallback
  );

  await sock.sendMessage(jid, {
    text: buildPista(vencedorIdx, escolhaIdx, aposta, lucroLiq, saldoFinal),
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
};