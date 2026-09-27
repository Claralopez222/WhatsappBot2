'use strict';

async function handleSistemaMedieval(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🏰 *COMO FUNCIONA O MODO MEDIEVAL* 🏰\n\n` +
      `⚔️ *O que é?*\n` +
      `Um RPG completo onde você escolhe uma classe, ganha XP, batalha e conquista itens raros!\n\n` +
      `📜 *Comandos Básicos:*\n` +
      `• ${P}ficha — ver sua ficha e atributos\n` +
      `• ${P}atacar @alvo — batalhar contra outro jogador\n` +
      `• ${P}magia @alvo — lançar feitiço elemental\n` +
      `• ${P}missaomed — embarcar em missões por XP e Gold\n` +
      `• ${P}recargamana — meditar e recuperar energia\n` +
      `• ${P}lojamedieval — comprar equipamentos e poções\n` +
      `• ${P}saquear @alvo — levar pertences de inimigos derrotados`,
  }, { quoted: msg });
}

module.exports = { handleSistemaMedieval };
