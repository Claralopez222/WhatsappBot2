'use strict';

async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
       💼 MENU EMPREGOS
╚══════════════════════╝

🔍 *CARREIRA & VAGAS*
  ▸ ${P}procuraremprego — Listar vagas disponíveis para o seu nível (7 opções)
  ▸ ${P}procuraremprego <1-7> — Escolher a vaga desejada
  ▸ ${P}emprego — Ver seu cargo, salário, progresso e status
  ▸ ${P}promocao — Qualificar para próxima categoria de cargos
  ▸ ${P}demitir — Pedir demissão voluntária (preserva histórico)

💰 *TRABALHO*
  ▸ ${P}trabalhar / ${P}work — Bater o ponto e receber seu salário
  💡 _Cargos de gerência e executivos desempenham múltiplas funções por turno!_

⏰ *REGRAS DO EXPEDIENTE*
  ▸ Horário comercial: *08:00 às 23:00 (Brasília)*
  ▸ Cooldown entre turnos: *2 horas*
  ▸ Tolerância: *2 horas* no horário comercial (congelada à noite)

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

module.exports = { handleMenuWork };
