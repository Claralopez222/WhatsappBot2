'use strict';

async function handleMenuGold(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `💰 *SALDO E MOEDA* 💰\n\n` +
      `${P}gold — ver saldo (comando antigo)\n` +
      `${P}loja — loja geral\n` +
      `${P}lojafood — loja de comida\n` +
      `${P}lojapet — loja de pets\n` +
      `${P}lojatec — loja de tecnologia\n` +
      `${P}lojacasal — loja de casal\n` +
      `${P}buy [item] — comprar item\n` +
      `${P}vender [item] — vender item\n` +
      `${P}inventario — ver inventário\n` +
      `${P}pix [@] [valor] — transferir saldo\n` +
      `${P}apostar [valor] — apostar saldo\n` +
      `${P}slots [valor] — jogar slots\n` +
      `${P}corrida [valor] — corrida de bichos\n` +
      `${P}garimpar — garimpar recursos\n` +
      `${P}extrato — histórico de movimentações\n` +
      `${P}banco [valor] — investir no banco\n` +
      `${P}resgatar — resgatar do banco\n` +
      `${P}rankgold — ranking de saldo\n` +
      `${P}give [@] [valor] — enviar saldo`,
  }, { quoted: msg });
}

async function handleSistemaGold(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `📖 *COMO FUNCIONA O SALDO* 📖\n\n` +
      `💰 *Moeda da conta*\n` +
      `O saldo do app e do bot é compartilhado e exibido na moeda do país da sua conta.\n\n` +
      `📥 *Como ganhar saldo:*\n` +
      `• Trabalhar com ${P}trabalhar\n` +
      `• Garimpar com ${P}garimpar\n` +
      `• Vender itens com ${P}vender\n` +
      `• Ganhar no cassino/corrida\n` +
      `• Pescar e vender peixes\n\n` +
      `📤 *Como usar o saldo:*\n` +
      `• Comprar itens na loja (${P}loja)\n` +
      `• Transferir para amigos (${P}pix)\n` +
      `• Apostar no cassino (${P}slots, ${P}apostar)\n` +
      `• Investir no banco (${P}banco)`,
  }, { quoted: msg });
}

module.exports = { handleMenuGold, handleSistemaGold };
