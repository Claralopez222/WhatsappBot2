/**
 * Handler de Menus — Piroquinhas Bot
 * Menus de ajuda e informações de sistemas
 */

// ─── !brincadeiras (Menu)
async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `🎭 *MENU BRINCADEIRAS*\n\n🌈 *${P}gay*\n💋 *${P}sexo @*\n🦅 *${P}nazista @*\n👩‍❤️‍👩 *${P}lesbica @*\n✨ *${P}aura @*\n🎲 *${P}dado*\n🪙 *${P}moeda*\n🎱 *${P}8ball <pergunta>*\n🧠 *${P}quiz*\n🏅 *${P}pontos*\n🏆 *${P}rankjogos*\n🎯 *${P}missao*\n🐾 *${P}pets*\n🏥 *${P}abrigo*\n💰 *${P}ofertar*\n📊 *${P}ofertas*\n🛒 *${P}comprarofferta*`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Menu Gold
async function handleMenuGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `💰 *MENU GOLD*\n\n💵 ${P}gold — Ver saldo\n🛒 ${P}loja — Loja principal\n🎁 ${P}comprar — Comprar item\n💸 ${P}vender — Vender item\n📊 ${P}inventario — Ver itens\n🎯 ${P}missao — Missão diária\n💰 ${P}ofertar — Oferecer item\n📲 ${P}ofertas — Ver ofertas\n🛍️ ${P}comprarofferta — Comprar oferta\n⛏️ ${P}garimpar — Garimpar ouro`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Menu Pet
async function handleMenuPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `🐾 *MENU PET*\n\n🎯 ${P}capturar — Capturar pet\n🍖 ${P}alimentar — Alimentar\n🎾 ${P}brincar — Brincar\n📊 ${P}statuspet — Status\n🏆 ${P}rankpet — Ranking\n🏥 ${P}abrigo — Ver abrigo`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Sistema Gold (Informativo)
async function handleSistemaGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `💰 *SISTEMA DE GOLD* 💰\n\nGold é a moeda principal do bot! Use-a para:\n  🛒 Comprar itens na loja\n  🎁 Adquirir pets especiais\n  💸 Investir no banco\n  🏆 Participar de competições\n\n*COMO GANHAR GOLD?*\n  📋 Missões diárias: ${P}missao\n  🔍 Garimpar recursos: ${P}garimpar\n  🛍️ Vender itens: ${P}vender\n  💼 Investimento: ${P}banco\n\n*ONDE USAR?*\n  🛒 Loja geral: ${P}loja\n  🍔 Loja de comida: ${P}lojafood\n  🐾 Loja de pets: ${P}lojapet\n  💻 Loja de tech: ${P}lojatec\n\nUse *${P}gold* para ver seu saldo!`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Sistema Pet (Informativo)
async function handleSistemaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `🐾 *SISTEMA DE PETS* 🐾\n\nTenha seu próprio pet e cuide dele!\n\n*CAPTURAR PETS*\n  🎯 Um pet spawna a cada hora\n  ${P}capturar — Captura o pet\n  Raridade: Comum → Raro → Ultra-Raro → Lendário\n\n*CUIDADOS DIÁRIOS*\n  🍖 ${P}alimentar — Alimentar o pet\n  🎾 ${P}brincar — Brincar com o pet\n  📊 ${P}statuspet — Ver status completo\n\n*ABRIGO*\n  🏥 ${P}abrigo — Ver pets disponíveis\n  ${P}abrigo deixar — Deixar seu pet para adoção\n  ${P}abrigo <nome> pegar — Adotar um pet\n\n*RANKING*\n  🏆 ${P}rankpet — Top 10 melhores pets\n\nUse *${P}pets* para ver todos os tipos!`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── Menu auxiliar
async function handleMenuAuxiliar(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const texto = `📋 *MENU AUXILIAR*\n\n🎮 *DIVERSÃO*\n  ${P}brincadeiras — Menu de brincadeiras\n  ${P}quiz — Jogar quiz\n  ${P}missao — Missão diária\n\n💰 *ECONOMIA*\n  ${P}gold — Ver saldo\n  ${P}loja — Ir à loja\n  ${P}garimpar — Garimpar ouro\n\n🐾 *PETS*\n  ${P}pets — Seus pets\n  ${P}capturar — Capturar pet\n  ${P}abrigo — Abrigo de pets\n\n📊 *INFORMAÇÃO*\n  ${P}sistemaGold — Info sobre Gold\n  ${P}sistemaPet — Info sobre Pets`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

module.exports = {
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleMenuAuxiliar,
};