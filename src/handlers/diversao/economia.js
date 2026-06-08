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
const { getCarteira, alterarGold } = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));
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
    `*COMO COMPRAR?*\n  ${P}comprar <nome_item>\n\n` +
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
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}comprar <nome_item>`;
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
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}comprar <nome_item>`;
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
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}comprar <nome_item>`;
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
    `━━━━━━━━━━━━━━━━\n*COMO COMPRAR?*\n  ${P}comprar <nome_item>\n\n` +
    `💑 _Mostre seu amor com presentes incríveis!_`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !comprar ─────────────────────────────────────────────────────────────────
// Gold debitado da CarteiraGrupo; inventário salvo no Usuario global.

async function handleComprar(sock, msg, jid, caption) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;
  const match   = caption.match(/comprar\s+(.+)/i);

  if (!match) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!comprar <nome_do_item>*\nExemplo: *!comprar pizza*' }, { quoted: msg });
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
        `*USE:*\n  !comprar <item>\n  Exemplo: !comprar pizza`,
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

// ─── !inventario (global — sem mudança) ──────────────────────────────────────

async function handleInventario(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });

    if (!user?.inventory || Object.keys(user.inventory).length === 0) {
      await sock.sendMessage(jid, {
        text:
          `📦 *SEU INVENTÁRIO* 📦\n\nVocê não possui itens no momento!\n\n` +
          `*COMO GANHAR ITENS?*\n  🛒 Comprar na loja: !loja\n  📋 Completar missões: !missao\n\nUse *!comprar <item>* para começar!`,
      }, { quoted: msg });
      return;
    }

    let texto     = `📦 *SEU INVENTÁRIO* 📦\n\n`;
    let totalItens = 0;

    for (const [itemKey, quantidade] of Object.entries(user.inventory)) {
      const itemInfo = ITENS_LOJA[itemKey];
      if (itemInfo && quantidade > 0) {
        texto += `  • ${itemInfo.nome} × ${quantidade}\n`;
        totalItens += quantidade;
      }
    }

    if (totalItens === 0) {
      await sock.sendMessage(jid, { text: `📦 *SEU INVENTÁRIO* 📦\n\nVocê não possui itens no momento!` }, { quoted: msg });
      return;
    }

    texto += `\n━━━━━━━━━━━━━━━━\n*TOTAL:* ${totalItens} item(ns)\n\n💰 *SALDO NESTE GRUPO:*\n  Gold: *${await getSaldoGrupo(userId, jid)}* gold`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleInventario:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao buscar inventário!' }, { quoted: msg });
  }
}

// ─── !pix ─────────────────────────────────────────────────────────────────────
// Transfere gold dentro do mesmo grupo (CarteiraGrupo → CarteiraGrupo)

async function handlePix(sock, msg, jid, caption) {
  const userId       = msg.key.participant || msg.key.remoteJid;
  const idGrupo      = jid;
  const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  let targetJid  = mentionedJid;
  let numeroPura = '';
  let quantia    = 0;

  if (targetJid) {
    numeroPura = targetJid.split('@')[0].split(':')[0];
    const parts = caption.trim().split(/\s+/);
    quantia = parseInt(parts[parts.length - 1]);
  } else {
    const numMatch = caption.match(/(?:pix|transferir)\s+@?(\d+)\s+(\d+)/i);
    if (numMatch) {
      numeroPura = numMatch[1].replace(/\D/g, '');
      targetJid  = `${numeroPura}@s.whatsapp.net`;
      quantia    = parseInt(numMatch[2]);
    }
  }

  if (!targetJid || isNaN(quantia) || quantia <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!pix @pessoa quantia*\nExemplo: *!pix @Felipe 30*' }, { quoted: msg });
    return;
  }

  if (userId === targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Você não pode fazer PIX para si mesmo!' }, { quoted: msg });
    return;
  }

  // Debitar remetente (atômico)
  const remetente = await debitarGold(userId, idGrupo, quantia, `PIX para @${numeroPura}`);
  if (!remetente) {
    const saldo = await getSaldoGrupo(userId, idGrupo);
    await sock.sendMessage(jid, {
      text: `⚠️ *SALDO INSUFICIENTE!*\n\n💰 Você tem: *${saldo}* gold\n💸 Precisa de: *${quantia}* gold`,
    }, { quoted: msg });
    return;
  }

  // Creditar destinatário no mesmo grupo
  await alterarGold(targetJid, idGrupo, quantia, `PIX de @${userId.split('@')[0].split(':')[0]}`);

  await sock.sendMessage(jid, {
    text:
      `✅ *TRANSFERÊNCIA REALIZADA!* ✅\n\n` +
      `💸 *${quantia} gold* enviado para *@${numeroPura}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💰 Seu novo saldo: *${remetente.gold}* gold`,
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

// ─── !extrato ─────────────────────────────────────────────────────────────────
// Mostra o histórico da CarteiraGrupo (local ao grupo)

async function handleExtrato(sock, msg, jid) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;

  const carteira = await getCarteira(userId, idGrupo);

  if (!carteira) {
    await sock.sendMessage(jid, { text: '❌ Você não tem cadastro neste grupo!' }, { quoted: msg });
    return;
  }

  const historico = carteira.goldHistory ?? [];

  if (historico.length === 0) {
    await sock.sendMessage(jid, {
      text:
        `📊 *EXTRATO DE TRANSAÇÕES* 📊\n\n` +
        `😔 Nenhuma transação registrada ainda.\n\n` +
        `💰 *Saldo atual:* ${carteira.gold} gold`,
    }, { quoted: msg });
    return;
  }

  const ultimas = [...historico].reverse().slice(0, 10);
  let totalEntrada = 0, totalSaida = 0;
  const linhas = [];

  for (const t of ultimas) {
    const data = t.date ? new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '??/??';
    const hora = t.date ? new Date(t.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '??:??';
    if (t.type === 'recebido') { totalEntrada += t.amount; linhas.push(`  ✅ *+${t.amount}g* | ${t.item} | ${data} ${hora}`); }
    else                       { totalSaida   += t.amount; linhas.push(`  ❌ *-${t.amount}g* | ${t.item} | ${data} ${hora}`); }
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

function formatarTempoGarimpo(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

async function handleGarimpar(sock, msg, jid) {
  const userId  = msg.key.participant || msg.key.remoteJid;
  const idGrupo = jid;
  const agora   = Date.now();

  // Cooldown salvo na CarteiraGrupo via campo ultimoGarimpo no Usuario global
  // (mantemos no Usuario para não duplicar cooldowns por grupo)
  const userGlobal = await Usuario.findOne({ idWhatsApp: userId });
  const ultimoGarimpo = userGlobal?.ultimoGarimpo ? new Date(userGlobal.ultimoGarimpo).getTime() : 0;
  const tempoPassado  = agora - ultimoGarimpo;

  if (tempoPassado < GARIMPO_COOLDOWN_MS) {
    const restante = GARIMPO_COOLDOWN_MS - tempoPassado;
    await sock.sendMessage(jid, {
      text:
        `⏳ *GARIMPO EM COOLDOWN* ⏳\n\n` +
        `⛏️ Você já garimpou recentemente!\n\n` +
        `⏰ Próximo garimpo em: *${formatarTempoGarimpo(restante)}*`,
    }, { quoted: msg });
    return;
  }

  try {
    const ouro = Math.floor(Math.random() * 100) + 30; // 30–129 gold

    // Atualizar cooldown no Usuario global
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { ultimoGarimpo: new Date() } },
      { upsert: true }
    );

    // Creditar na carteira do grupo + missão diária
    await prepareDailyMissionState(userId);
    const carteira = await alterarGold(userId, idGrupo, ouro, 'Garimpo');

    // Missão de gold (ainda no Usuario global)
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { 'dailyMissions.progress.gold500': ouro } }
    );

    await sock.sendMessage(jid, {
      text:
        `⛏️ ═══ GARIMPO ═══ ⛏️\n\n` +
        `🪨 Você cavou fundo e encontrou ouro!\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💎 Encontrado: *+${ouro} gold*\n` +
        `💰 Novo saldo: *${carteira.gold}* gold\n\n` +
        `⏰ Próximo garimpo em: *1 hora*`,
    }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handleGarimpar:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao garimpar! Tente novamente.' }, { quoted: msg });
  }
}

// ─── !slots ───────────────────────────────────────────────────────────────────

async function handleSlots(sock, msg, jid, senderJid, caption) {
  const idGrupo = jid;
  const args    = caption.trim().split(/\s+/);
  const aposta  = parseInt(args[1]);

  if (!aposta || isNaN(aposta) || aposta <= 0) {
    await sock.sendMessage(jid, { text: '⚠️ Uso correto: *!slots [valor]*\nExemplo: *!slots 50*' }, { quoted: msg });
    return;
  }

  const userDebited = await debitarGold(senderJid, idGrupo, aposta, 'Slots');
  if (!userDebited) {
    const saldo = await getSaldoGrupo(senderJid, idGrupo);
    await sock.sendMessage(jid, {
      text: `❌ Saldo insuficiente!\n\n💰 Seu saldo: *${saldo}* gold\n💸 Aposta: *${aposta}* gold`,
    }, { quoted: msg });
    return;
  }

  const frutas = ['🍒', '🍋', '🍇', '🍉', '🔔'];
  const r1 = frutas[Math.floor(Math.random() * frutas.length)];
  const r2 = frutas[Math.floor(Math.random() * frutas.length)];
  const r3 = frutas[Math.floor(Math.random() * frutas.length)];

  const msgInicial = await sock.sendMessage(jid, {
    text: `🎰 *CASSINO PIROQUINHAS* 🎰\n\n     [ 🎲 | 🎲 | 🎲 ]\n\n_Girando..._`,
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

  let multiplicador = 0;
  let resultadoMsg  = '❌ *Você perdeu!* O banco agradece.';
  if (r1 === r2 && r2 === r3)                       { multiplicador = 10;  resultadoMsg = '🎉 *JACKPOT MÁXIMO!* Três iguais! Multiplicado por 10!'; }
  else if (r1 === r2 || r2 === r3 || r1 === r3)     { multiplicador = 2.5; resultadoMsg = '✨ *QUASE JACKPOT!* Duas iguais! Multiplicado por 2.5!'; }

  const premio   = Math.floor(aposta * multiplicador);
  const lucroLiq = premio - aposta;

  // Creditar prêmio na carteira do grupo
  let saldoFinal = userDebited.gold + lucroLiq;
  if (premio > 0) {
    const carteira = await alterarGold(senderJid, idGrupo, premio, `Slots (${multiplicador}x)`);
    saldoFinal = carteira?.gold ?? saldoFinal;
  }

  // Missão de gold (Usuario global)
  if (lucroLiq > 0) {
    await prepareDailyMissionState(senderJid);
    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid },
      { $inc: { 'dailyMissions.progress.gold500': lucroLiq } }
    );
  }

  const textoFinal =
    `🎰 *CASSINO PIROQUINHAS* 🎰\n\n` +
    `     [ ${r1} | ${r2} | ${r3} ]\n\n` +
    `${resultadoMsg}\n` +
    `━━━━━━━━━━━━━━━━\n*DETALHES:*\n` +
    `  💵 Aposta: *${aposta}* gold\n` +
    (multiplicador > 0 ? `  ✖️ Multiplicador: *${multiplicador}x*\n  💰 Prêmio: *${premio}* gold\n` : '') +
    `  ${lucroLiq >= 0 ? '✅' : '❌'} Resultado: *${lucroLiq >= 0 ? '+' : ''}${lucroLiq}* gold\n` +
    `  💎 Saldo: *${saldoFinal}* gold`;

  try { await sock.chatModify({ text: textoFinal }, msgInicial.key); }
  catch { await sock.sendMessage(jid, { text: textoFinal }, { quoted: msg }); }
}

// ─── !corrida ─────────────────────────────────────────────────────────────────

async function handleCorrida(sock, msg, jid, senderJid, caption) {
  const idGrupo = jid;
  const args    = caption.trim().split(/\s+/);
  const escolha = parseInt(args[1]);
  const aposta  = parseInt(args[2]);

  if (!escolha || !aposta || isNaN(escolha) || isNaN(aposta) || escolha < 1 || escolha > 4 || aposta <= 0) {
    await sock.sendMessage(jid, {
      text:
        `⚠️ Uso correto: *!corrida [bicho] [valor]*\n\n` +
        `*Escolha seu corredor:*\n` +
        `1️⃣ 🐎 Cavalo\n2️⃣ 🐅 Tigre\n3️⃣ 🐢 Tartaruga\n4️⃣ 🐕 Cachorro\n\n` +
        `Exemplo: *!corrida 1 50* (Aposta 50 no Cavalo)`,
    }, { quoted: msg });
    return;
  }

  const userDebited = await debitarGold(senderJid, idGrupo, aposta, `Corrida`);
  if (!userDebited) {
    const saldo = await getSaldoGrupo(senderJid, idGrupo);
    await sock.sendMessage(jid, {
      text: `❌ Saldo insuficiente!\n\n💰 Seu saldo: *${saldo}* gold\n💸 Aposta: *${aposta}* gold`,
    }, { quoted: msg });
    return;
  }

  const bichos     = ['🐎 Cavalo', '🐅 Tigre', '🐢 Tartaruga', '🐕 Cachorro'];
  const emojis     = ['🐎', '🐅', '🐢', '🐕'];
  const vencedorIdx = Math.floor(Math.random() * 4);
  const ganhou     = (escolha - 1) === vencedorIdx;
  const premio     = ganhou ? aposta * 3 : 0;
  const lucroLiq   = premio - aposta;

  let saldoFinal = userDebited.gold + lucroLiq;
  if (premio > 0) {
    const carteira = await alterarGold(senderJid, idGrupo, premio, `Corrida (${bichos[escolha - 1]})`);
    saldoFinal = carteira?.gold ?? saldoFinal;
  }

  if (lucroLiq > 0) {
    await prepareDailyMissionState(senderJid);
    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid },
      { $inc: { 'dailyMissions.progress.gold500': lucroLiq } }
    );
  }

  let pista = `🏁 *CORRIDA DE BICHOS* 🏁\n\n`;
  for (let i = 0; i < 4; i++) {
    pista += i === vencedorIdx
      ? `${emojis[i]} ══════════════ 💨 🏆\n`
      : `${emojis[i]} ${'═'.repeat(Math.floor(Math.random() * 8) + 2)}\n`;
  }

  pista += `\n━━━━━━━━━━━━━━━━\n`;
  pista += `🎯 Você apostou no *${bichos[escolha - 1]}*\n`;
  pista += `🏆 Vencedor: *${bichos[vencedorIdx]}*\n\n`;
  pista += ganhou
    ? `🎉 *VITÓRIA!* Você ganhou *+${aposta * 3}* gold!\n`
    : `❌ *DERROTA!* Você perdeu *${aposta}* gold.\n`;
  pista += `💰 Saldo: *${saldoFinal}* gold`;

  await sock.sendMessage(jid, { text: pista }, { quoted: msg });
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