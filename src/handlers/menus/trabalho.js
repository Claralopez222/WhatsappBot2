'use strict';

async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `💼 *MENU DE EMPREGOS* 💼\n\n` +
      `${P}procuraremprego — buscar vagas e ser contratado\n` +
      `${P}trabalhar / ${P}work — bater o ponto e receber salário\n` +
      `${P}promocao — tentar subir de nível na carreira\n` +
      `${P}emprego — ver seu cargo e progresso\n` +
      `${P}demitir — pedir demissão voluntária\n\n` +
      `⏰ *Horário de Trabalho:* 12:30 às 22:30 (Brasília)\n` +
      `⏳ *Cooldown:* 2 horas entre turnos`,
  }, { quoted: msg });
}

module.exports = { handleMenuWork };
