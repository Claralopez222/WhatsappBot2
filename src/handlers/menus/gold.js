'use strict';

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
      `• Comprar itens na loja (${P}loja)\n` +
      `• Transferir para amigos (${P}pix)\n` +
      `• Apostar no cassino (${P}slots, ${P}apostar)\n` +
      `• Investir no banco (${P}banco)`,
  }, { quoted: msg });
}

module.exports = { handleMenuGold, handleSistemaGold };
