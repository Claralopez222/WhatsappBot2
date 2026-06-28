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
      `${P}ship [@] — shippar\n` +
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
      `⚔️ *COMO FUNCIONA O SISTEMA MEDIEVAL* ⚔️\n\n` +
      `🏰 *O que é?*\n` +
      `Um RPG de batalha onde você cria um personagem e luta contra outros!\n\n` +
      `📊 *Atributos:*\n` +
      `• ❤️ HP — vida do personagem\n` +
      `• 💧 Mana — para usar magias\n` +
      `• ⚔️ Ataque — dano físico\n` +
      `• 🛡️ Defesa — reduz dano recebido\n` +
      `• ✨ Magia — dano mágico\n\n` +
      `🎯 *Classes:*\n` +
      `• ⚔️ Guerreiro — alto HP e Defesa\n` +
      `• 🧙 Mago — alta Magia e Mana\n` +
      `• 🏹 Arqueiro — alto Ataque\n` +
      `• 🗡️ Ladino — velocidade e crítico\n\n` +
      `📜 *Comandos básicos:*\n` +
      `▸ ${P}ficha — ver sua ficha\n` +
      `▸ ${P}atacar [@] — atacar alguém\n` +
      `▸ ${P}magia [@] — usar magia\n` +
      `▸ ${P}lojamedieval — loja medieval\n` +
      `▸ ${P}missaomed — missão diária\n` +
      `▸ ${P}menumediev — menu completo`,
  }, { quoted: msg });
}

// ─── handleMenuMarket ────────────────────────────────────────────────────────
async function handleMenuMarket(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🏪 *MARKETPLACE* 🏪\n\n` +
      `Compre e venda itens com outros jogadores!\n\n` +
      `📤 *Vender:*\n` +
      `▸ ${P}avenda [item] [qtd] [preço] — anunciar item\n` +
      `▸ ${P}cancelaroferta [id] — cancelar anúncio\n` +
      `▸ ${P}minhasofertas — seus anúncios\n\n` +
      `📥 *Comprar:*\n` +
      `▸ ${P}buscaroferta [item] — buscar ofertas\n` +
      `▸ ${P}buyoferta [id] — comprar oferta\n\n` +
      `🤝 *Trocar:*\n` +
      `▸ ${P}ofertar [@] [item] [qtd] — propor troca\n` +
      `▸ ${P}aceitaroferta [id] — aceitar troca\n` +
      `▸ ${P}ofertasrecebidas — ver propostas\n\n` +
      `📊 *Histórico:*\n` +
      `▸ ${P}historicomarket — histórico de vendas`,
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