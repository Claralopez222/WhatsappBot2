/**
 * Handler de Diversão — Piroquinhas Bot
 * Arquivo principal que coordena brincadeiras, economia, menus, pets, missões e marketplace
 */

// ─── Importar módulos específicos (mesma pasta) ───────────────────────────

// Brincadeiras
const {
  handleGay, handleSexo, handleNazista, handleLesbica, handleAura,
  handleDado, handleMoeda, handle8ball, handleShip, handleRolar,
  handleXingar, handleElogio, handleCrush, handleCantada, handleSafadeza,
  handleTiro, handleMorte, handleRoletaRussa, handleRoletaRussa2, handleRoletaRussa3,
  handleFalta, handleBaterFalta, handleEuNunca, handleAnagrama, handlePpt,
  handleVerdadeOuDesafio, handleConfissao, handleJulgamento, handlePodre, handleFrango,
  handleMaldizer, handleFortuna, handleCompatibilidade
} = require('./brincadeiras');

// Economia
const {
  handleGold, handleLoja, handleLojaFood, handleLojaPet, handleLojaTec,
  handleComprar, handleVender, handleInventario, handlePix, handleApostar,
  handleExtrato, handleGarimpar, getSaldoAtual, changeGold, ITENS_LOJA
} = require('./economia');

// Menus
const {
  handleBrincadeiras, handleMenuGold, handleMenuPet,
  handleSistemaGold, handleSistemaPet, handleMenuAuxiliar
} = require('./menus');

// Marketplace
const {
  handleAvenda, handleBuy, handleOfertar, handleOfertasRecebidas,
  handleAceitarOfferta, sellerOffers, playerOffers
} = require('./marketplace');

// Quiz (Corrigido para a pasta atual)
const {
  handleQuiz, handlePontos, handleRankJogos, handleBanco, handleResgatar, quizState
} = require('./quiz');

// Missões (ATIVADO E ATUALIZADO PARA O SEU ARQUIVO DE MISSOES)
const {
  handleMissao, prepareDailyMissionState, findDailyMission, dailyMissionDefinitions
} = require('./missoes');

// Pets
const {
  handleCapturarPet, handleAlimentarPet, handleBrincarPet,
  handleStatusPet, handlePetRank, handlePets, handleAbrigo,
  petSystem, petData, shelterData, handleAdoptarPet
} = require('./pets');

// ─── Utilitários ────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg.key.remoteJid.split('@')[0] === msg.key.participant.split('@')[0]
    ? msg.key.participant
    : msg.key.remoteJid;
}

async function initializePersistedData() {
  console.log('✅ Diversão handler inicializado com sucesso');
}

// ─── EXPORTS COMPLETO ───────────────────────────────────────────────────────

module.exports = {
  // Brincadeiras (33 funções)
  handleGay,
  handleSexo,
  handleNazista,
  handleLesbica,
  handleAura,
  handleDado,
  handleMoeda,
  handle8ball,
  handleShip,
  handleRolar,
  handleXingar,
  handleElogio,
  handleCrush,
  handleCantada,
  handleSafadeza,
  handleTiro,
  handleMorte,
  handleRoletaRussa,
  handleRoletaRussa2,
  handleRoletaRussa3,
  handleFalta,
  handleBaterFalta,
  handleEuNunca,
  handleAnagrama,
  handlePpt,
  handleVerdadeOuDesafio,
  handleConfissao,
  handleJulgamento,
  handlePodre,
  handleFrango,
  handleMaldizer,
  handleFortuna,
  handleCompatibilidade,

  // Economia (15 itens)
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

  // Menus (6 funções)
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleMenuAuxiliar,

  // Marketplace (7 itens)
  handleAvenda,
  handleBuy,
  handleOfertar,
  handleOfertasRecebidas,
  handleAceitarOfferta,
  sellerOffers,
  playerOffers,

  // Quiz (6 itens)
  handleQuiz,
  handlePontos,
  handleRankJogos,
  handleBanco,
  handleResgatar,
  quizState,

  // Missões (Sincronizado com as exportações do seu missao.js)
  handleMissao,
  prepareDailyMissionState,
  findDailyMission,
  dailyMissionDefinitions,

  // Pets (11 itens)
  handleCapturarPet,
  handleAdoptarPet,
  handleAlimentarPet,
  handleBrincarPet,
  handleStatusPet,
  handlePetRank,
  handlePets,
  handleAbrigo,
  petSystem,
  petData,
  shelterData,

  // Utilitários (2 funções)
  getUserId,
  initializePersistedData,
};