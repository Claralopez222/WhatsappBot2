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
    `  📊 *${P}invmed* — Ver inventário medieval`,
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

// ─── Sistema Medieval (Informativo) ──────────────────────────────────────────

/**
 * Exibe informações detalhadas sobre o sistema Medieval.
 * @param {object} sock
 * @param {object} msg
 * @param {string} jid
 * @param {Function} getPrefix
 */
async function handleSistemaMedieval(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `⚔️🏰 *SISTEMA MEDIEVAL* 🏰⚔️`,
    ``,
    `O modo medieval é um RPG completo dentro do grupo!`,
    `Crie seu personagem, batalhe, evolua e domine o reino.`,
    ``,
    `👤 *PERSONAGEM*`,
    `  • Ao usar *${P}ficha* pela primeira vez, um personagem`,
    `    é criado automaticamente com classe e elemento aleatórios`,
    `  • Há 7 classes: Guerreiro, Mago, Arqueiro, Paladino,`,
    `    Assassino, Druida e Necromante`,
    `  • Cada classe tem ataque, defesa, HP e mana únicos`,
    ``,
    `🔥 *ELEMENTOS*`,
    `  • Seu personagem recebe um elemento aleatório`,
    `  • São 8 elementos: Fogo, Água, Terra, Ar, Trovão,`,
    `    Sombra, Luz e Magia Negra`,
    `  • Cada elemento tem vantagem (+50% dano) contra alguns`,
    `    e fraqueza (-30% dano) contra outros`,
    ``,
    `⚔️ *COMBATE*`,
    `  • *${P}atacar @alguém* — Ataque físico (cooldown 2min)`,
    `    Ganha 10 XP (15 se crítico). Crítico tem 15% de chance`,
    `    e multiplica o dano por 1.8x`,
    `  • *${P}magia @alguém* — Habilidade elemental (cooldown 5min)`,
    `    Consome 30 de mana. Dano 2.2x maior que ataque normal`,
    `    Ganha 20 XP. Não pode críticar`,
    `  • Derrotar um inimigo dá +30 XP (!atacar) ou +40 XP (!magia)`,
    `  • Inimigo derrotado fica com HP 0 até usar *${P}recargamana*`,
    ``,
    `🗺️ *MISSÕES*`,
    `  • *${P}missaomed* — Embarca em missão aleatória (cooldown 30min)`,
    `  • Requer HP mínimo de 20 para participar`,
    `  • 3 dificuldades: fácil, médio e difícil`,
    `  • Sucesso: XP + Gold | Falha: dano + 10 XP de consolação`,
    ``,
    `❤️ *RECUPERAÇÃO*`,
    `  • *${P}recargamana* — Recupera 60% do HP e 100% da mana`,
    `    Cooldown de 10 minutos`,
    `  • *Regeneração passiva* — Todo personagem recupera automaticamente`,
    `    +10% HP e +15% Mana a cada 1 hora (apenas grupos com medieval ativo)`,
    ``,
    `  • *Regeneração passiva* — Todo personagem recupera automaticamente`,
    `    +10% HP e +15% Mana a cada 1 hora (apenas grupos com medieval ativo)`,
    ``,
    `🏪 *LOJA E EQUIPAMENTOS*`,
    `  • *${P}lojamedieval* — Ver armas, armaduras e poções`,
    `  • *${P}comprar [item]* — Comprar com gold do grupo`,
    `  • *${P}equipar [item]* — Equipar arma ou armadura`,
    `  • *${P}desequipar arma/armadura* — Remover item equipado`,
    `  • *${P}invmed* — Ver seu inventário medieval`,
    `  • *${P}usarpocao [nome]* — Usar poção (sem cooldown!)`,
    `  • Armas aumentam o ataque | Armaduras aumentam a defesa`,
    `  • Poções recuperam HP e/ou mana instantaneamente`,
    `  • Raridades: comum → incomum → raro → lendário`,
    ``,
    `⭐ *PROGRESSÃO*`,
    `  • XP acumulado em batalhas e missões sobe seu nível`,
    `  • Cada level up aumenta HP máx, mana máx, ataque e defesa`,
    `  • Missões têm nível mínimo — quanto mais difícil, maior a recompensa`,
    `  • Itens raros e lendários exigem nível mínimo para comprar e equipar`,
    `  • *${P}rankmedieval* — Top 10 guerreiros por vitórias`,
    `  • *${P}historico* — Ver suas últimas 5 batalhas`,
    ``,
    `📜 *COMANDOS RÁPIDOS*`,
    `  👤 *${P}ficha* — Ver/criar seu personagem`,
    `  ⚔️ *${P}atacar @* — Atacar alguém`,
    `  🔮 *${P}magia @* — Usar habilidade elemental`,
    `  🗺️ *${P}missaomed* — Embarcar em missão`,
    `  🌟 *${P}recargamana* — Recuperar HP e mana`,
    `  🧪 *${P}usarpocao [nome]* — Usar poção`,
    `  🎒 *${P}invmed* — Ver inventário`,
    `  🏪 *${P}lojamedieval* — Ver loja`,
    `  🏆 *${P}rankmedieval* — Ranking`,
    `  📖 *${P}menumediev* — Menu de comandos`,
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
  handleSistemaMedieval,
};