/**
 * Handler de Menus — Piroquinhas Bot
 * Menus de ajuda e informações de sistemas
 */

'use strict';

// ─── Utilitário interno ───────────────────────────────────────────────────────

/**
 * Envia uma mensagem de texto citando a mensagem original.
 * @param {object} sock  - Instância do socket WhatsApp
 * @param {object} msg   - Mensagem original (para quotar)
 * @param {string} jid   - ID do chat de destino
 * @param {string} texto - Conteúdo da mensagem
 */
async function enviar(sock, msg, jid, texto) {
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !brincadeiras ────────────────────────────────────────────────────────────

/**
 * Exibe o menu de brincadeiras e jogos.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🎭 *MENU BRINCADEIRAS*`,
    ``,
    `🎲 *Jogos de Sorte*`,
    `  🎲 *${P}dado* — Rolar um dado`,
    `  🪙 *${P}moeda* — Cara ou coroa`,
    `  🎱 *${P}8ball <pergunta>* — Bola mágica`,
    ``,
    `😄 *Diversão*`,
    `  🌈 *${P}gay* — Medidor gay`,
    `  💋 *${P}sexo @* — Medidor com alguém`,
    `  🦅 *${P}beijo @* — Dar um beijo`,
    `  👩‍❤️‍👩 *${P}lesbica @* — Medidor lésbica`,
    `  ✨ *${P}aura @* — Ver a aura`,
    ``,
    `🧠 *Quiz & Pontos*`,
    `  🧠 *${P}quiz* — Jogar quiz`,
    `  🏅 *${P}pontos* — Ver pontuação`,
    `  🏆 *${P}rankjogos* — Ranking de jogos`,
    ``,
    `🐾 *Pets & Missões*`,
    `  🎯 *${P}missao* — Missão diária`,
    `  🐾 *${P}pets* — Seus pets`,
    `  🏥 *${P}abrigo* — Abrigo de pets`,
    ``,
    `💰 *Economia*`,
    `  💰 *${P}ofertar* — Ofertar um item`,
    `  📊 *${P}ofertas* — Ver ofertas disponíveis`,
    `  🛒 *${P}comprarofferta* — Comprar oferta`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Menu Gold ────────────────────────────────────────────────────────────────

/**
 * Exibe o menu de economia/gold.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleMenuGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `💰 *MENU GOLD*`,
    ``,
    `💵 *Saldo & Inventário*`,
    `  💵 *${P}gold* — Ver saldo atual`,
    `  📊 *${P}inventario* — Ver seus itens`,
    ``,
    `🛒 *Loja*`,
    `  🛒 *${P}loja* — Loja principal`,
    `  🎁 *${P}comprar* — Comprar um item`,
    `  💸 *${P}vender* — Vender um item`,
    ``,
    `🤝 *Mercado de Jogadores*`,
    `  💰 *${P}ofertar* — Oferecer item para venda`,
    `  📲 *${P}ofertas* — Ver ofertas disponíveis`,
    `  🛍️ *${P}comprarofferta* — Comprar uma oferta`,
    ``,
    `⛏️ *Ganhar Gold*`,
    `  ⛏️ *${P}garimpar* — Garimpar ouro`,
    `  🎯 *${P}missao* — Missão diária`,
    ``,
    `ℹ️ Use *${P}sistemaGold* para saber mais!`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Menu Pet ─────────────────────────────────────────────────────────────────

/**
 * Exibe o menu de pets.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleMenuPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🐾 *MENU PET*`,
    ``,
    `🎯 *Captura*`,
    `  🎯 *${P}capturar* — Capturar pet selvagem`,
    ``,
    `❤️ *Cuidados Diários*`,
    `  🍖 *${P}alimentar* — Alimentar seu pet`,
    `  🎾 *${P}brincar* — Brincar com seu pet`,
    `  📊 *${P}statuspet* — Ver status completo`,
    ``,
    `🏥 *Abrigo*`,
    `  🏥 *${P}abrigo* — Ver pets disponíveis`,
    ``,
    `🏆 *Ranking*`,
    `  🏆 *${P}rankpet* — Top 10 melhores pets`,
    ``,
    `ℹ️ Use *${P}sistemaPet* para saber mais!`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Sistema Gold (Informativo) ───────────────────────────────────────────────

/**
 * Exibe informações detalhadas sobre o sistema de Gold.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleSistemaGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `💰 *SISTEMA DE GOLD* 💰`,
    ``,
    `Gold é a moeda oficial do bot! Com ela você pode comprar`,
    `itens, adquirir pets especiais, investir e competir.`,
    ``,
    `📥 *COMO GANHAR GOLD?*`,
    `  🎯 *${P}missao* — Completar missões diárias`,
    `  ⛏️ *${P}garimpar* — Garimpar recursos`,
    `  💸 *${P}vender* — Vender itens do inventário`,
    `  🏦 *${P}banco* — Rendimento do banco`,
    ``,
    `📤 *ONDE GASTAR?*`,
    `  🛒 *${P}loja* — Loja geral`,
    `  🍔 *${P}lojafood* — Loja de comida`,
    `  🐾 *${P}lojapet* — Loja de pets`,
    `  💻 *${P}lojatec* — Loja de tecnologia`,
    ``,
    `💵 Use *${P}gold* para ver seu saldo atual.`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Sistema Pet (Informativo) ────────────────────────────────────────────────

/**
 * Exibe informações detalhadas sobre o sistema de Pets.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleSistemaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🐾 *SISTEMA DE PETS* 🐾`,
    ``,
    `Capture, cuide e evolua seu próprio pet!`,
    ``,
    `🎯 *CAPTURAR PETS*`,
    `  • Um pet aparece no grupo a cada hora`,
    `  • Use *${P}capturar* para tentar capturá-lo`,
    `  • Raridades: Comum › Raro › Ultra-Raro › Lendário`,
    ``,
    `❤️ *CUIDADOS DIÁRIOS*`,
    `  🍖 *${P}alimentar* — Alimentar seu pet`,
    `  🎾 *${P}brincar* — Brincar e aumentar felicidade`,
    `  📊 *${P}statuspet* — Ver status completo`,
    ``,
    `🏥 *ABRIGO*`,
    `  🏥 *${P}abrigo* — Ver pets disponíveis para adoção`,
    `  *${P}abrigo deixar* — Deixar seu pet no abrigo`,
    `  *${P}abrigo <nome> pegar* — Adotar um pet`,
    ``,
    `🏆 *RANKING*`,
    `  🏆 *${P}rankpet* — Top 10 melhores pets do grupo`,
    ``,
    `📋 Use *${P}pets* para ver todos os tipos disponíveis!`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Menu Auxiliar ────────────────────────────────────────────────────────────

/**
 * Exibe o menu auxiliar com atalhos gerais.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleMenuAuxiliar(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `📋 *MENU AUXILIAR*`,
    ``,
    `🎮 *DIVERSÃO*`,
    `  🎭 *${P}brincadeiras* — Menu de brincadeiras`,
    `  🧠 *${P}quiz* — Jogar quiz`,
    `  🎯 *${P}missao* — Missão diária`,
    ``,
    `💰 *ECONOMIA*`,
    `  💵 *${P}gold* — Ver saldo`,
    `  🛒 *${P}loja* — Ir à loja`,
    `  ⛏️ *${P}garimpar* — Garimpar ouro`,
    ``,
    `🐾 *PETS*`,
    `  🐾 *${P}pets* — Seus pets`,
    `  🎯 *${P}capturar* — Capturar pet`,
    `  🏥 *${P}abrigo* — Abrigo de pets`,
    ``,
    `📖 *INFORMAÇÕES*`,
    `  💰 *${P}sistemaGold* — Como funciona o Gold`,
    `  🐾 *${P}sistemaPet* — Como funciona os Pets`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleMenuAuxiliar,
};