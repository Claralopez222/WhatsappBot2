'use strict';

async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
       💼 MENU EMPREGOS
╚══════════════════════╝

🔍 *CARREIRA*
  ▸ ${P}procuraremprego — buscar vagas e ser contratado
  ▸ ${P}emprego — ver seu cargo e progresso
  ▸ ${P}promocao — tentar subir de nível na carreira
  ▸ ${P}demitir — pedir demissão voluntária

💰 *TRABALHO*
  ▸ ${P}trabalhar / ${P}work — bater o ponto e receber salário

⏰ *REGRAS*
  ▸ Horário: 12:30 às 22:30 (Brasília)
  ▸ Cooldown: 2 horas entre turnos

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

module.exports = { handleMenuWork };
