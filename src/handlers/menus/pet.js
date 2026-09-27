'use strict';

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

async function handleSistemaPet(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🐾 *COMO FUNCIONA O SISTEMA DE PETS* 🐾\n\n` +
      `🐾 *Captura:*\n` +
      `Pets aparecem aleatoriamente nos grupos. Use ${P}capturar quando um aparecer!\n\n` +
      `❤️ *Cuidados:*\n` +
      `Mantenha seu pet com Fome, Felicidade e Saúde em alta usando itens da ${P}lojapet.\n\n` +
      `⭐ *Evolução:*\n` +
      `Brincar e cuidar do seu pet aumenta a experiência dele!`,
  }, { quoted: msg });
}

module.exports = { handleMenuPet, handleSistemaPet };
