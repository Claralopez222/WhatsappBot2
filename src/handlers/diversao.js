/**
 * Handler de Diversão — Piroquinhas Bot
 * Arquivo compatibilidade que re-exporta tudo do módulo diversao/
 * 
 * Este arquivo mantém compatibilidade com bot.js ao re-exportar
 * todas as funções do módulo diversao organizado em 5 arquivos:
 * - brincadeiras.js: Funções divertidas (Gay, Sexo, Nazista, etc)
 * - economia.js: Sistema de Gold, Loja, Compra/Venda
 * - menus.js: Menus de ajuda
 * - marketplace.js: Sistema de compra/venda entre usuários
 * - index.js: Arquivo coordenador central
 */

const path = require('path');

// Re-exportar tudo do módulo diversao/index.js
const diversaoModule = require(path.join(__dirname, 'diversao', 'index.js'));

module.exports = {
  ...diversaoModule
};
