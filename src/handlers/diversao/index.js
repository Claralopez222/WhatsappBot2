/**
 * Handler de Diversão — Piroquinhas Bot
 * Arquivo principal que coordena brincadeiras, economia, menus, pets, missões, marketplace e pesca
 */

// ─── Importar módulos específicos (mesma pasta) ───────────────────────────

const {
  handleProcurarEmprego,
  handleTrabalhar,
  handlePromocao,
  handleEmprego,
  handleDemitir,
  handleMenuWork,
} = require('./emprego');
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
  handleGold, handleLoja, handleLojaFood, handleLojaPet, handleLojaTec, handleLojaCasal,
  handleComprar, handleVender, handleInventario, handlePix, handleApostar,
  handleExtrato, handleGarimpar, handleSlots, handleCorrida,
  getSaldoAtual, changeGold, ITENS_LOJA
} = require('./economia');

// Menus
const {
  handleBrincadeiras, handleMenuGold, handleMenuPet,
  handleSistemaGold, handleSistemaPet, handleMenuAuxiliar
} = require('./menus');

// Marketplace (v3.1 — sem dependência de handlePescar no require direto)
const {
  handleAvenda, handleBuscarOferta, handleOfertar, handleBuy,
  handleCancelarOferta, handleMinhasOfertas, handleHistoricoMarket,
  handleOfertasRecebidas, handleAceitarOfferta,
  Oferta, MarketLog, CONFIG: CONFIG_MARKET, registerCatalog
} = require('./marketplace');

// Pesca
const {
  handlePescar, handleVaras, handleIscas, handleInventarioPesca,
  VARAS_PESCA, ISCAS, CATALOGO_PESCA, PEIXES_E_ITENS
} = require('./handlePescar');

// Registrar itens de pesca no catálogo do marketplace
registerCatalog({ ...VARAS_PESCA, ...ISCAS, ...PEIXES_E_ITENS });

// Quiz
const {
  handleQuiz, handlePontos, handleRankJogos, handleBanco, handleResgatar, quizState
} = require('./quiz');

// Missões
const {
  handleMissao, prepareDailyMissionState, findDailyMission, dailyMissionDefinitions
} = require('./missoes');

// Pets
const {
  handleCapturarPet, handleAlimentarPet, handleBrincarPet,
  handleStatusPet, handlePetRank, handlePets, handleAbrigo,
  petSystem, petData, shelterData, handleAdoptarPet
} = require('./pets');

// Roubo (Sistema de assaltos)
const {
  handleMenuRoubo, handleMenuSec, handleComprarRoubo, handleComprarSec,
  handleEquiparRoubo, handleEquiparSec, handleRoubar
} = require('./roubo');

// ─── Utilitários ────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg.key.remoteJid.split('@')[0] === msg.key.participant?.split('@')[0]
    ? msg.key.participant
    : msg.key.remoteJid;
}

async function initializePersistedData() {
  console.log('✅ Diversão handler inicializado com sucesso');
}

// ─── EXPORTS COMPLETO ───────────────────────────────────────────────────────

module.exports = {
  // ── Brincadeiras (33 funções) ──────────────────────────────────────────────
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

  // ── Economia (17 itens) ────────────────────────────────────────────────────
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

  // ── Menus (6 funções) ──────────────────────────────────────────────────────
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleMenuAuxiliar,

  // ── Marketplace v3.1 (11 itens) ────────────────────────────────────────────
  handleAvenda,
  handleBuscarOferta,
  handleOfertar,
  handleBuy,
  handleCancelarOferta,
  handleMinhasOfertas,
  handleHistoricoMarket,
  handleOfertasRecebidas,   // compatibilidade retroativa
  handleAceitarOfferta,     // compatibilidade retroativa
  Oferta,
  MarketLog,
  CONFIG_MARKET,
  registerCatalog,

  // ── Pesca (8 itens) ────────────────────────────────────────────────────────
  handlePescar,
  handleVaras,
  handleIscas,
  handleInventarioPesca,
  VARAS_PESCA,
  ISCAS,
  CATALOGO_PESCA,
  PEIXES_E_ITENS,

  // ── Quiz (6 itens) ────────────────────────────────────────────────────────
  handleQuiz,
  handlePontos,
  handleRankJogos,
  handleBanco,
  handleResgatar,
  quizState,

  // ── Missões (4 itens) ─────────────────────────────────────────────────────
  handleMissao,
  prepareDailyMissionState,
  findDailyMission,
  dailyMissionDefinitions,

  // ── Pets (11 itens) ───────────────────────────────────────────────────────
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

  // ── Roubo (7 itens) ───────────────────────────────────────────────────────
  handleMenuRoubo,
  handleMenuSec,
  handleComprarRoubo,
  handleComprarSec,
  handleEquiparRoubo,
  handleEquiparSec,
  handleRoubar,

  // Emprego
handleProcurarEmprego,
handleTrabalhar,
handlePromocao,
handleEmprego,

  // ── Utilitários (2 funções) ───────────────────────────────────────────────
  getUserId,
  initializePersistedData,
};