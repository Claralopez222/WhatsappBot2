'use strict';

// ─── handleBrincadeiras ───────────────────────────────────────────────────────
async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🎮 *BRINCADEIRAS* 🎮\n\n` +
      `${P}gay [@] — % de gay\n` +
      `${P}sexo [@] — % de sexo\n` +
      `${P}lesbica [@] — % lésbica\n` +
      `${P}trans [@] — % trans\n` +
      `${P}aura [@] — sua aura\n` +
      `${P}ship [@] [@] — shippar\n` +
      `${P}compatibilidade [@] — compatibilidade\n` +
      `${P}dado [lados] — jogar dado\n` +
      `${P}moeda — cara ou coroa\n` +
      `${P}8ball [pergunta] — bola 8\n` +
      `${P}rolar [min] [max] — número aleatório\n` +
      `${P}ppt — pedra papel tesoura\n` +
      `${P}quiz — quiz aleatório\n` +
      `${P}anagrama — jogo de anagrama\n` +
      `${P}roletarussa — roleta russa\n` +
      `${P}eununca — eu nunca\n` +
      `${P}verdadeoudesafio — verdade ou desafio\n` +
      `${P}xingar [@] — xingar alguém\n` +
      `${P}elogio [@] — elogiar alguém\n` +
      `${P}cantada [@] — cantada\n` +
      `${P}crush [@] — crush\n` +
      `${P}julgamento [@] — julgar\n` +
      `${P}fortuna — fortuna\n` +
      `${P}maldizer [@] — maldizer\n` +
      `${P}confissao — confissão`,
  }, { quoted: msg });
}

// ─── handleMenuGold ───────────────────────────────────────────────────────────
async function handleMenuGold(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🪙 *SISTEMA DE GOLD* 🪙\n\n` +
      `${P}gold — ver saldo\n` +
      `${P}loja — loja geral\n` +
      `${P}lojafood — loja de comida\n` +
      `${P}lojapet — loja de pets\n` +
      `${P}lojatec — loja de tecnologia\n` +
      `${P}lojacasal — loja de casal\n` +
      `${P}buy [item] — comprar item\n` +
      `${P}vender [item] — vender item\n` +
      `${P}inventario — ver inventário\n` +
      `${P}pix [@] [valor] — transferir gold\n` +
      `${P}apostar [valor] — apostar gold\n` +
      `${P}slots [valor] — jogar slots\n` +
      `${P}corrida [valor] — corrida de bichos\n` +
      `${P}garimpar — garimpar recursos\n` +
      `${P}extrato — histórico de gold\n` +
      `${P}banco [valor] — investir no banco\n` +
      `${P}resgatar — resgatar do banco\n` +
      `${P}rankgold — ranking de gold\n` +
      `${P}give [@] [valor] — dar gold`,
  }, { quoted: msg });
}

// ─── handleMenuPet ────────────────────────────────────────────────────────────
async function handleMenuPet(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🐾 *SISTEMA DE PETS* 🐾\n\n` +
      `${P}capturar — capturar pet selvagem\n` +
      `${P}statuspet — ver status do seu pet\n` +
      `${P}alimentar — alimentar o pet\n` +
      `${P}brincar — brincar com o pet\n` +
      `${P}curar — curar o pet\n` +
      `${P}renomearpet [nome] — renomear\n` +
      `${P}abrigo — colocar pet no abrigo\n` +
      `${P}pets — ver todos os pets\n` +
      `${P}petrank — ranking de pets\n` +
      `${P}lojapet — loja de pets\n` +
      `${P}sistempet — como funciona`,
  }, { quoted: msg });
}

// ─── handleSistemaGold ───────────────────────────────────────────────────────
async function handleSistemaGold(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `📖 *COMO FUNCIONA O GOLD* 📖\n\n` +
      `💰 *O que é Gold?*\n` +
      `Gold é a moeda virtual do bot. Use para comprar itens, apostar e muito mais!\n\n` +
      `📥 *Como ganhar Gold:*\n` +
      `• Bônus diário de 100 gold ao mandar mensagem\n` +
      `• Trabalhar com ${P}trabalhar\n` +
      `• Garimpar com ${P}garimpar\n` +
      `• Vender itens com ${P}vender\n` +
      `• Ganhar no cassino/corrida\n` +
      `• Pescar e vender peixes\n\n` +
      `📤 *Como gastar Gold:*\n` +
      `• Comprar itens na loja\n` +
      `• Apostar em jogos\n` +
      `• Transferir para outros\n` +
      `• Investir no banco\n\n` +
      `💡 *Dica:* Use ${P}menugold para ver todos os comandos!`,
  }, { quoted: msg });
}

// ─── handleSistemaPet ────────────────────────────────────────────────────────
async function handleSistemaPet(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `📖 *COMO FUNCIONA OS PETS* 📖\n\n` +
      `🐾 *O que são Pets?*\n` +
      `Pets são companheiros virtuais que você pode capturar e cuidar!\n\n` +
      `📊 *Atributos do Pet:*\n` +
      `• ❤️ Energia — diminui com o tempo\n` +
      `• 🍖 Fome — precisa alimentar\n` +
      `• 😊 Felicidade — brinque com ele\n` +
      `• ⚡ XP e Level — sobe com interações\n\n` +
      `🎯 *Raridades:*\n` +
      `• ⚪ Comum → 🟢 Incomum → 🔵 Raro\n` +
      `• 🟣 Épico → 🟡 Lendário\n\n` +
      `⚠️ *Atenção:*\n` +
      `• Pet sem cuidados pode fugir\n` +
      `• Use ${P}abrigo para deixar no abrigo\n\n` +
      `💡 *Dica:* Use ${P}menupet para ver todos os comandos!`,
  }, { quoted: msg });
}

// ─── handleMenuAuxiliar ──────────────────────────────────────────────────────
async function handleMenuAuxiliar(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `📋 *MENU AUXILIAR* 📋\n\n` +
      `🎮 *Jogos e Diversão:*\n` +
      `▸ ${P}brincadeiras — ver brincadeiras\n` +
      `▸ ${P}menugold — comandos de gold\n` +
      `▸ ${P}menupet — comandos de pets\n` +
      `▸ ${P}menumarket — marketplace\n` +
      `▸ ${P}menuwork — empregos\n\n` +
      `⚙️ *Sistemas:*\n` +
      `▸ ${P}sistemgold — como funciona o gold\n` +
      `▸ ${P}sistempet — como funciona os pets\n` +
      `▸ ${P}sistemmedieval — sistema medieval\n\n` +
      `👥 *Grupos:*\n` +
      `▸ ${P}menuadm — comandos de admin\n` +
      `▸ ${P}menucasal — comandos de casal\n` +
      `▸ ${P}menufilho — comandos de filho`,
  }, { quoted: msg });
}

// ─── handleSistemaMedieval ───────────────────────────────────────────────────
async function handleSistemaMedieval(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `⚔️🏰 *SISTEMA MEDIEVAL* 🏰⚔️\n\n` +
      `O modo medieval é um RPG completo dentro do grupo!\n` +
      `Crie seu personagem, batalhe, evolua e domine o reino.\n\n` +
      `👤 *PERSONAGEM*\n` +
      `  • Ao usar *${P}ficha* pela primeira vez, um personagem\n` +
      `    é criado automaticamente com classe e elemento aleatórios\n` +
      `  • Há 7 classes: Guerreiro, Mago, Arqueiro, Paladino,\n` +
      `    Assassino, Druida e Necromante\n` +
      `  • Cada classe tem ataque, defesa, HP e mana únicos\n\n` +
      `🔥 *ELEMENTOS*\n` +
      `  • Seu personagem recebe um elemento aleatório\n` +
      `  • São 8 elementos: Fogo, Água, Terra, Ar, Trovão,\n` +
      `    Sombra, Luz e Magia Negra\n` +
      `  • Cada elemento tem vantagem (+50% dano) contra alguns\n` +
      `    e fraqueza (-30% dano) contra outros\n\n` +
      `⚔️ *COMBATE*\n` +
      `  • *${P}atacar @alguém* — Ataque físico (cooldown 2min)\n` +
      `    Ganha 10 XP (15 se crítico). Crítico tem 15% de chance\n` +
      `    e multiplica o dano por 1.8x\n` +
      `  • *${P}magia @alguém* — Habilidade elemental (cooldown 5min)\n` +
      `    Consome 30 de mana. Dano 2.2x maior que ataque normal\n` +
      `    Ganha 20 XP. Não pode críticar\n` +
      `  • Derrotar um inimigo dá +30 XP (!atacar) ou +40 XP (!magia)\n` +
      `  • Inimigo derrotado fica com HP 0 até usar *${P}recargamana*\n\n` +
      `🗺️ *MISSÕES*\n` +
      `  • *${P}missaomed* — Embarca em missão aleatória (cooldown 30min)\n` +
      `  • Requer HP mínimo de 20 para participar\n` +
      `  • 3 dificuldades: fácil, médio e difícil\n` +
      `  • Sucesso: XP + Gold | Falha: dano + 10 XP de consolação\n\n` +
      `❤️ *RECUPERAÇÃO*\n` +
      `  • *${P}recargamana* — Recupera 60% do HP e 100% da mana\n` +
      `    Cooldown de 10 minutos\n` +
      `  • *Regeneração passiva* — Todo personagem recupera automaticamente\n` +
      `    +10% HP e +15% Mana a cada 1 hora (apenas grupos com medieval ativo)\n\n` +
      `🏪 *LOJA E EQUIPAMENTOS*\n` +
      `  • *${P}lojamedieval* — Ver armas, armaduras e poções\n` +
      `  • *${P}comprar [item]* — Comprar com gold do grupo\n` +
      `  • *${P}equipar [item]* — Equipar arma ou armadura\n` +
      `  • *${P}desequipar arma/armadura* — Remover item equipado\n` +
      `  • *${P}invmed* — Ver seu inventário medieval\n` +
      `  • *${P}usarpocao [nome]* — Usar poção (sem cooldown!)\n` +
      `  • Armas aumentam o ataque | Armaduras aumentam a defesa\n` +
      `  • Poções recuperam HP e/ou mana instantaneamente\n` +
      `  • Raridades: comum → incomum → raro → lendário\n\n` +
      `⭐ *PROGRESSÃO*\n` +
      `  • XP acumulado em batalhas e missões sobe seu nível\n` +
      `  • Cada level up aumenta HP máx, mana máx, ataque e defesa\n` +
      `  • Missões têm nível mínimo — quanto mais difícil, maior a recompensa\n` +
      `  • Itens raros e lendários exigem nível mínimo para comprar e equipar\n` +
      `  • *${P}rankmedieval* — Top 10 guerreiros por vitórias\n` +
      `  • *${P}historico* — Ver suas últimas 5 batalhas\n\n` +
      `📜 *COMANDOS RÁPIDOS*\n` +
      `  👤 *${P}ficha* — Ver/criar seu personagem\n` +
      `  ⚔️ *${P}atacar @* — Atacar alguém\n` +
      `  🔮 *${P}magia @* — Usar habilidade elemental\n` +
      `  🗺️ *${P}missaomed* — Embarcar em missão\n` +
      `  🌟 *${P}recargamana* — Recuperar HP e mana\n` +
      `  🧪 *${P}usarpocao [nome]* — Usar poção\n` +
      `  🎒 *${P}invmed* — Ver inventário\n` +
      `  🏪 *${P}lojamedieval* — Ver loja\n` +
      `  🏆 *${P}rankmedieval* — Ranking\n` +
      `  📖 *${P}menumediev* — Menu de comandos`,
  }, { quoted: msg });
}

// ─── handleMenuMarket ────────────────────────────────────────────────────────
async function handleMenuMarket(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🏪 *MARKETPLACE* 🏪\n\n` +
      `Compre e venda itens com outros jogadores!\n\n` +
      `📤 *Anunciar / Vender:*\n` +
      `▸ ${P}ofertar [item] [preço] [quantidade] — anunciar item à venda\n` +
      `▸ ${P}cancelaroferta [item] — cancelar seu anúncio (pelo nome do item)\n` +
      `▸ ${P}minhasofertas — ver seus anúncios ativos\n\n` +
      `📥 *Navegar / Comprar:*\n` +
      `▸ ${P}avenda [página] — navegar pelos itens à venda no mercado\n` +
      `▸ ${P}buscaroferta [item] — buscar ofertas de um item específico\n` +
      `▸ ${P}buyoferta [vendedor] [item] [quantidade] — comprar de um anúncio\n\n` +
      `📊 *Histórico:*\n` +
      `▸ ${P}historicomarket — histórico de vendas\n\n` +
      `_Obs: ${P}aceitaroferta foi descontinuado — use ${P}buyoferta para comprar diretamente._`,
  }, { quoted: msg });
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
  handleMenuMarket,
};