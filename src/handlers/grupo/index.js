'use strict';

const {
  handleBan,
  handleMute,
  handleDesmute,
  handlePromoverRebaixar,
  handleReportar,
  handleRemoverReporte,
  handleApagarMsg,
  handleLimparWarns,
} = require('./moderacao');

const {
  handleAntiLink,
  handleAutoSticker,
  handleSlowMode,
  verificarSlowMode,
  handleAntiFlood,
  verificarAntiFlood,
  handleBemVindo,
  processarBemVindo,
  handleBotToggle,
  handleFecharAbrir,
} = require('./configuracao');

const {
  handleGrupInfo,
  handleListaAdm,
  handleListaMembros,
  handleTempo,
  handleAdvertencia,
  handleRanking,
  handleLinkGrupo,
  handleRegras,
  handleSetRegras,
  handleAdms,
  handleStatsGrupo,
} = require('./info');

const {
  handleSorteio,
  handleEnquete,
  registerPollVoteHandler,
  activePolls,
  handleTodos,
  handleAvisar,
  handleFixarGrupo,
} = require('./comunicacao');

const {
  isAdmin,
  getGroupOwner,
  isMuted,
  unmuteUser,
  setBemVindo,
} = require('./helpers');

// ═══════════════════════════════════════════════════════════════
// ─── !menuadm ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMenuAdm(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';

  const menu =
    `🛡️ *MENU DE ADMINISTRAÇÃO* 🛡️\n\n` +

    `👤 *MEMBROS & ADMINS*\n` +
    `▸ ${P}ban @fulano — Banir membro\n` +
    `▸ ${P}ban @all — Banir todos não-admins\n` +
    `▸ ${P}mute @fulano — Mutar membro\n` +
    `▸ ${P}mute @all — Mutar todos\n` +
    `▸ ${P}desmute @fulano — Desmutar membro\n` +
    `▸ ${P}desmute @all — Desmutar todos\n` +
    `▸ ${P}promover @fulano — Tornar admin\n` +
    `▸ ${P}rebaixar @fulano — Remover admin\n` +
    `▸ ${P}listamembros — Listar membros\n` +
    `▸ ${P}listaadm — Listar admins\n` +
    `▸ ${P}adms [motivo] — Notificar todos os admins\n` +
    `▸ ${P}tempo [@fulano] — Tempo no grupo\n\n` +

    `📋 *GRUPO & REGRAS*\n` +
    `▸ ${P}grupinfo — Informações do grupo\n` +
    `▸ ${P}statsgrupo — Estatísticas completas\n` +
    `▸ ${P}regras — Ver regras do grupo\n` +
    `▸ ${P}setregras [texto] — Definir regras do grupo\n` +
    `▸ ${P}fechar — Fechar grupo (só admins falam)\n` +
    `▸ ${P}abrir — Abrir grupo (todos falam)\n` +
    `▸ ${P}linkgrupo — Gerar link de convite\n` +
    `▸ ${P}todos [msg] — Mencionar todos\n` +
    `▸ ${P}enquete [pergunta|op1|op2] — Criar enquete\n` +
    `▸ ${P}sorteio [@membros] — Sortear vencedor\n\n` +

    `⚙️ *CONFIGURAÇÕES*\n` +
    `▸ ${P}bot on/off — Ligar/desligar bot no grupo\n` +
    `▸ ${P}antilink on/off — Anti-link\n` +
    `▸ ${P}autosticker on/off — Auto-sticker\n` +
    `▸ ${P}slowmode [seg] — Slow mode (1–3600s)\n` +
    `▸ ${P}antiflood [msgs]/[seg] — Anti-flood\n` +
    `▸ ${P}bemvindo on/off/[msg] — Configurar boas-vindas\n` +
    `▸ ${P}pet on/off — Spawn de pets selvagens\n\n` +

    `🔔 *COMUNICAÇÃO & MODERAÇÃO*\n` +
    `▸ ${P}avisar [texto] — Avisar e mencionar @todos\n` +
    `▸ ${P}fixargrupo — Fixar mensagem (reply)\n` +
    `▸ ${P}fixargrupo ver — Ver último aviso fixado\n` +
    `▸ ${P}apagarmsg — Apagar mensagem (reply)\n` +
    `▸ ${P}reportar — Advertir usuário (reply)\n` +
    `▸ ${P}removerreporte — Remover 1 advertência (reply/@)\n` +
    `▸ ${P}limparwarns — Zerar todas advertências (@/@all)\n` +
    `▸ ${P}adv / ${P}advertencia — Ver suas advertências\n\n` +

    `📊 *JOGO / ECONOMIA*\n` +
    `▸ ${P}rankgold — Ranking de Gold deste grupo`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── EXPORTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Moderação de membros
  handleBan,
  handleMute,
  handleDesmute,
  handleReportar,
  handlePromoverRebaixar,
  handleLimparWarns,

  // Informação, estatísticas e listas
  handleRanking,
  handleGrupInfo,
  handleListaAdm,
  handleListaMembros,
  handleTempo,
  handleRegras,
  handleSetRegras,
  handleAdms,
  handleStatsGrupo,

  // Interação com o grupo
  handleSorteio,
  handleEnquete,
  registerPollVoteHandler,
  activePolls,
  handleTodos,
  handleFecharAbrir,
  handleLinkGrupo,
  handleApagarMsg,

  // Configurações
  handleAntiLink,
  handleAutoSticker,
  handleSlowMode,
  handleAntiFlood,
  handleBemVindo,

  // Comunicação
  handleAvisar,
  handleFixarGrupo,
  handleMenuAdm,

  // Helpers para bot.js e router.js
  processarBemVindo,
  verificarSlowMode,
  verificarAntiFlood,
  isMuted,
  unmuteUser,
  isAdmin,
  getGroupOwner,
  handleRemoverReporte,
  handleAdvertencia,
  setBemVindo,
  handleBotToggle,
};
