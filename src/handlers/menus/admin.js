'use strict';

async function handleMenuAdm(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
    🛡️ MENU ADMINISTRAÇÃO
╚══════════════════════╝

⚙️ *CONFIGURAÇÃO DE GRUPO*
  ▸ ${P}antilink on/off — Ativar/desativar antilink
  ▸ ${P}autosticker on/off — Ativar/desativar auto-sticker
  ▸ ${P}medieval on/off — Ativar/desativar modo medieval
  ▸ ${P}bot on/off — Ativar/desativar bot no grupo

🔨 *MODERAÇÃO*
  ▸ ${P}ban @pessoa — Banir membro
  ▸ ${P}mute @pessoa — Mutar membro
  ▸ ${P}desmute @pessoa — Desmutar membro
  ▸ ${P}adv @pessoa — Dar advertência
  ▸ ${P}removerreporte @pessoa — Limpar advertência
  ▸ ${P}fechar — Fechar o grupo para mensagens
  ▸ ${P}abrir — Abrir o grupo para mensagens

📢 *COMUNICAÇÃO*
  ▸ ${P}todos [mensagem] — Marcar todos os membros
  ▸ ${P}avisar [mensagem] — Enviar aviso de admin
  ▸ ${P}enquete [título] [opção1, opção2...] — Criar enquete
  ▸ ${P}sorteio — Sortear um membro do grupo

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

module.exports = { handleMenuAdm };
