'use strict';

const path = require('path');

// ─── Estado persistido (data.json — cache local; Mongo é a fonte de verdade) ─
const {
  msgCount,
  stickerCount,
  cmdCount,
  pinnedMessages,
  autoStickerGroups,
  getPrefix,
  contarMensagem,
  contarCmd,
  contarSticker,
  relacionamentos,
  saveData,
} = require('./utils/persistence');

// ─── Identidade / JID ─────────────────────────────────────────────────────
const { normalizarJid, extrairNumero, registrarLidEMapping } = require('./utils/identity');

// ─── Models ───────────────────────────────────────────────────────────────
const LidMapping    = require(path.join(__dirname, 'models', 'LidMapping'));
const CarteiraGrupo = require(path.join(__dirname, 'models', 'CarteiraGrupo'));

// ─── Handlers ─────────────────────────────────────────────────────────────
const menuHandler           = require('./handlers/menus');
const figurinhaHandler      = require('./handlers/figurinha');
const diversaoHandler       = require('./handlers/diversao');
const relacionamentoHandler = require('./handlers/relacionamento');
const grupoHandler          = require('./handlers/grupo');
const medievalHandler       = require('./handlers/medieval');
const imagemHandler         = require('./handlers/imagem');
const textoHandler          = require('./handlers/texto');
const utilidadeHandler      = require('./handlers/utilidade');
const aniversarioHandler    = require('./handlers/aniversario');
const alteradoresHandler    = require('./handlers/alteradores');
const downloadsHandler      = require('./handlers/utilidade/downloads');
const pinnedHandler         = require('./handlers/diversao/pinned');
const pescaHandler          = require('./handlers/diversao/pesca');

const { handleRankGold, handleGive }                                 = require('./handlers/diversao/economia');
const { handleEmprestimo, handlePayEmprestimo, handleDivida }        = require('./handlers/diversao/emprestimo');
const { registerActiveGroup }                                       = require('./handlers/diversao');

const { prepareDailyMissionState, incrementMission } = require('./handlers/diversao/missoes');
const { addUserXp, getBonusHorario }                 = require('./utils/xp');

// Fix #1: unmuteUser agora é corretamente re-exportado por handlers/grupo/index.js!
const { isMuted, unmuteUser } = require('./handlers/grupo');

// ═══════════════════════════════════════════════════════════════
// ─── Estado compartilhado com bot.js (NÃO persistido) ──────────
// ═══════════════════════════════════════════════════════════════

const contactNames     = {};
const pendingMusic     = new Map();
const activeGroups     = new Set();
const pedidosPendentes = new Map();
const lastTexts        = new Map();

let botJid = null;
function setBotJid(id) { botJid = id; }
function getBotJid() { return botJid; }

// ─── Helpers de prefixo ─────────────────────────────────────────────────────
const VALID_PREFIXES = ['!', '.', '/', ','];

function isAnyCmd(text) {
  return VALID_PREFIXES.some(p => text.startsWith(p));
}
function matchCmd(raw, cmdName) {
  for (const p of VALID_PREFIXES) {
    if (raw === p + cmdName) return true;
  }
  return false;
}
function matchCmdStart(raw, cmdName) {
  for (const p of VALID_PREFIXES) {
    if (raw.startsWith(p + cmdName)) return true;
  }
  return false;
}

function getSenderName(msg) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  return msg.pushName || senderJid?.split('@')[0] || 'Usuário';
}

// ═══════════════════════════════════════════════════════════════
// ─── HANDLER PRINCIPAL (ROTEADOR DE COMANDOS) ──────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;

  const content =
    msg.message?.ephemeralMessage?.message ||
    msg.message?.viewOnceMessage?.message  ||
    msg.message;
  if (!content) return;

  const imageMsg  = content.imageMessage;
  const videoMsg  = content.videoMessage;
  const textMsg   = content.conversation || content.extendedTextMessage?.text || '';
  const caption   = (imageMsg?.caption || videoMsg?.caption || textMsg || '').trim();
  const author    = getSenderName(msg);
  const senderJid = msg.key.participant || msg.key.remoteJid;

  const raw     = caption.toLowerCase();
  const cmdWord = raw.split(/\s+/)[0];
  const cmd     = raw;

  const isPrivate = jid && !jid.endsWith('@g.us') && !jid.endsWith('@broadcast');
  const isGroup   = jid && jid.endsWith('@g.us');

  if (isGroup) {
    registerActiveGroup(jid);
    activeGroups.add(jid);
  }

  // ── Guard !bot on/off ──────────────────────────────────────────
  if (isGroup && (matchCmd(cmdWord, 'bot') || matchCmdStart(cmd, 'bot '))) {
    const isAdm = await grupoHandler.isAdmin(sock, jid, senderJid).catch(() => false);
    const args  = caption.replace(/^[!.,\/]bot\s*/i, '').trim();
    await grupoHandler.handleBotToggle(sock, msg, jid, args, isAdm);
    return;
  }

  // ── Guard bot ativo no grupo ──────────────────────────────────
  if (isGroup) {
    const GrupoConfig = require('./models/GrupoConfig');
    const cfgGrupo    = await GrupoConfig.findOne({ idGrupo: jid }).lean();
    if (cfgGrupo?.botAtivo === false) return;
  }

  // ── Mute check (agora funciona perfeitamente com unmuteUser exportado!) ──
  if (isGroup && senderJid) {
    const senderNorm = normalizarJid(senderJid);
    if (senderNorm && isMuted(jid, senderNorm)) {
      const chaveTimer = `mute:${jid}:${senderNorm}`;

      if (!global._muteTimers) global._muteTimers = new Map();

      if (!global._muteTimers.has(chaveTimer)) {
        await sock.sendMessage(jid, {
          text: `🔇 *@${senderNorm.split('@')[0]}* está mutado! Será removido em *20 segundos* se falar novamente.`,
          mentions: [senderJid],
        }).catch(() => {});

        const timer = setTimeout(async () => {
          try {
            await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
          } catch (e) {
            console.error('❌ Erro ao remover mutado após cooldown:', e.message);
          }
          unmuteUser(jid, senderNorm);
          global._muteTimers.delete(chaveTimer);
        }, 20 * 1000);

        global._muteTimers.set(chaveTimer, timer);
      }

      return;
    }
  }

  if (senderJid) {
    contarMensagem(senderJid, author);
    const bonusInfo = getBonusHorario();
    const xpGanho   = bonusInfo.xp;

    await addUserXp(senderJid, xpGanho, msg.pushName || author);

    if (isGroup) {
      const senderNorm = normalizarJid(senderJid);
      const resGroup   = await CarteiraGrupo.incrementXp(senderNorm, jid, xpGanho);

      if (resGroup?.levelUp) {
        await sock.sendMessage(jid, {
          text: `🎉 *@${senderNorm.split('@')[0]}* subiu para o *Nível ${resGroup.level}*! 🏅\n` +
                `_${bonusInfo.emoji} ${bonusInfo.bonusName}: +${xpGanho} XP por mensagem!_`,
          mentions: [senderJid],
        }).catch(() => {});
      }
    }

    registrarLidEMapping(msg, msg.pushName || author).catch(() => {});
  }

  // ── Slow Mode ────────────────────────────────────────────────
  if (isGroup && !isAnyCmd(raw)) {
    const permitido = await grupoHandler.verificarSlowMode(jid, senderJid);
    if (!permitido) return;
  }

  // ── Anti-Flood ───────────────────────────────────────────────
  if (isGroup) {
    try {
      const flood = await grupoHandler.verificarAntiFlood(sock, jid, senderJid, botJid);
      if (flood) {
        await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
        await sock.sendMessage(jid, {
          text: `🚫 *@${senderJid.split('@')[0]}* foi removido por flood!`,
          mentions: [senderJid],
        });
        return;
      }
    } catch {}
  }

  // ── Substituição estilo vim (s/antigo/novo/) ─────────────────
  const subMatch = caption.match(/^[!.]s\/([^\/]+)\/([^\/]+)\/?/i);
  if (subMatch && (isPrivate || content.extendedTextMessage?.contextInfo?.quotedMessage)) {
    if (senderJid) contarCmd(senderJid);
    const pattern     = subMatch[1];
    const replacement = subMatch[2];
    const targetText  =
      content.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      lastTexts.get(jid) ||
      '';

    if (!targetText) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhuma mensagem para corrigir.' }, { quoted: msg });
    } else {
      try {
        const newText = targetText.replace(new RegExp(pattern, 'g'), replacement);
        await sock.sendMessage(jid, {
          text: newText === targetText ? '⚠️ Nada foi alterado.' : newText,
        }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, { text: '⚠️ Padrão inválido.' }, { quoted: msg });
      }
    }
    return;
  }

  if (isPrivate && textMsg && !isAnyCmd(raw)) lastTexts.set(jid, textMsg);

  // ── Anti-Link ────────────────────────────────────────────────
  if (isGroup && !isAnyCmd(raw)) {
    const hasLink = /(https?:\/\/|wa\.me\/|chat\.whatsapp\.com)/i.test(caption);
    if (hasLink) {
      const GrupoConfig = require('./models/GrupoConfig');
      const cfgLink = await GrupoConfig.findOne({ idGrupo: jid }, { antiLink: 1 }).lean();
      if (cfgLink?.antiLink) {
        const isAdm = await grupoHandler.isAdmin(sock, jid, senderJid).catch(() => false);
        if (!isAdm) {
          try {
            await sock.sendMessage(jid, {
              text: `🚫 *${getSenderName(msg)}*, links não são permitidos neste grupo!`,
              mentions: [senderJid],
            });
            await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
          } catch {}
          return;
        }
      }
    }
  }

  // ── Auto-Sticker ─────────────────────────────────────────────
  if (isGroup && autoStickerGroups.has(jid) && !isAnyCmd(raw)) {
    if (imageMsg || videoMsg) {
      try { await figurinhaHandler.processMedia(sock, msg, content, jid, author, stickerCount); } catch {}
      return;
    }
  }

  // ── Pedido de casamento (sim/não) ────────────────────────────
  if (pedidosPendentes.has(senderJid)) {
    const resp = raw.trim();
    if (resp === 'sim' || resp === 'nao' || resp === 'não') {
      await relacionamentoHandler.handleResposta(sock, msg, jid, senderJid, resp, relacionamentos, pedidosPendentes, contactNames);
      return;
    }
  }

  // ── Quiz ativo ───────────────────────────────────────────────
  if (diversaoHandler.quizState?.has(senderJid)) {
    await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption);
    return;
  }

  // ── Resposta pendente de !saquear ─────────────────────────────
  if (isGroup && medievalHandler.saqueState.has(senderJid)) {
    const tratado = await medievalHandler.handleRespostaSaque(sock, msg, jid, senderJid, caption);
    if (tratado) return;
  }

  // ── Anagrama ativo ───────────────────────────────────────────
  if (diversaoHandler.anagramaState?.has(senderJid)) {
    await diversaoHandler.handleAnagrama(sock, msg, jid, author, senderJid);
    return;
  }

  if (!isAnyCmd(raw)) return;
  if (senderJid) contarCmd(senderJid);

  // ── ACESSÓRIOS DE CASAL ───────────────────────────────────────
  const CMDS_MEDIEVAIS = ['invmed', 'sellmed', 'givemed', 'saquear', 'lojamedieval', 'lojamed', 'ficha', 'atacar', 'magia', 'missaomed', 'recargamana', 'historico', 'rankmedieval', 'menumediev', 'comprar', 'equipar', 'desequipar', 'usarpocao', 'medieval', 'sistemmedieval'];
  if (!CMDS_MEDIEVAIS.includes(cmdWord.slice(1)) && cmdWord.startsWith('.')) {
    const itemKey = cmdWord.slice(1);
    const { handleEquiparAcessorio } = require(path.join(__dirname, 'handlers', 'diversao', 'acessoriosCasal'));
    const tratado = await handleEquiparAcessorio(sock, msg, jid, senderJid, itemKey);
    if (tratado) return;
  }

  // ── PERFIL ────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'perfil'))
    { await utilidadeHandler.handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos); return; }
  if (matchCmdStart(cmd, 'bio ') || matchCmd(cmdWord, 'bio'))
    { await utilidadeHandler.handleBio(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'meupainel'))   { await require('./handlers/painel').handleMeuPainel(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'resetsenha'))  {
    await sock.sendMessage(jid, {
      text:
        `🔑 Para resetar sua senha, acesse o painel e use a opção *"Alterar senha"* após fazer login.\n\n` +
        `🌐 https://piroquinhasbot.github.io/painel-piroquinhas/perfil.html`,
    }, { quoted: msg });
    return;
  }

  // ── MENUS ─────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'menu') || matchCmdStart(cmd, 'menu '))
    { await utilidadeHandler.handleMenu(sock, msg, jid, caption, getPrefix, author); return; }
  if (matchCmd(cmdWord, 'menuutil'))
    { await utilidadeHandler.handleMenuUtil(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menujogos'))
    { await utilidadeHandler.handleMenuJogos(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menubaixar'))
    { await utilidadeHandler.handleMenuBaixar(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menucasal') || matchCmd(cmdWord, 'menurelacionamento') || matchCmd(cmdWord, 'menurelacionamentos'))
    { await utilidadeHandler.handleMenuRelacionamento(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menufilho'))
    { await utilidadeHandler.handleMenuFilho(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menuadm'))
    { await grupoHandler.handleMenuAdm(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menufig'))
    { await figurinhaHandler.handleMenuFig(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menuefeitos'))
    { await imagemHandler.handleMenuEfeitos(sock, msg, jid, getPrefix(jid)); return; }
  if (matchCmd(cmdWord, 'menuaniversario'))
    { await aniversarioHandler.handleMenuAniversario(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'brincadeiras'))
    { await diversaoHandler.handleBrincadeiras(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'sistemgold'))
    { await diversaoHandler.handleSistemaGold(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'sistempet'))
  { await diversaoHandler.handleSistemaPet(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menugold'))
    { await diversaoHandler.handleMenuGold(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menupet'))
    { await diversaoHandler.handleMenuPet(sock, msg, jid, getPrefix); return; }

  // ── GRUPO & MODERAÇÃO ──────────────────────────────────────────
  if (matchCmd(cmdWord, 'ban') || matchCmdStart(cmd, 'ban '))
    { await grupoHandler.handleBan(sock, msg, content, jid, botJid); return; }
  if (matchCmd(cmdWord, 'mute') || matchCmdStart(cmd, 'mute '))
    { await grupoHandler.handleMute(sock, msg, content, jid); return; }
  if (matchCmd(cmdWord, 'desmute') || matchCmdStart(cmd, 'desmute '))
    { await grupoHandler.handleDesmute(sock, msg, content, jid); return; }
  if (matchCmd(cmdWord, 'promover') || matchCmdStart(cmd, 'promover '))
    { await grupoHandler.handlePromoverRebaixar(sock, msg, content, jid, true); return; }
  if (matchCmd(cmdWord, 'rebaixar') || matchCmdStart(cmd, 'rebaixar '))
    { await grupoHandler.handlePromoverRebaixar(sock, msg, content, jid, false); return; }
  if (matchCmd(cmdWord, 'grupinfo'))
    { await grupoHandler.handleGrupInfo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'listaadm'))
    { await grupoHandler.handleListaAdm(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'listamembros'))
    { await grupoHandler.handleListaMembros(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'tempo') || matchCmdStart(cmd, 'tempo '))
    { await grupoHandler.handleTempo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmd(cmdWord, 'adv') || matchCmd(cmdWord, 'advertencia'))
    { await grupoHandler.handleAdvertencia(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'reportar') || matchCmdStart(cmd, 'reportar '))
    { await grupoHandler.handleReportar(sock, msg, content, jid, botJid); return; }
  if (matchCmd(cmdWord, 'removerreporte') || matchCmdStart(cmd, 'removerreporte '))
    { await grupoHandler.handleRemoverReporte(sock, msg, content, jid); return; }
  if (matchCmd(cmdWord, 'limparwarns') || matchCmd(cmdWord, 'clearwarns') || matchCmdStart(cmd, 'limparwarns ') || matchCmdStart(cmd, 'clearwarns '))
    { await grupoHandler.handleLimparWarns(sock, msg, content, jid, botJid); return; }
  if (matchCmd(cmdWord, 'apagarmsg'))
    { await grupoHandler.handleApagarMsg(sock, msg, content, jid); return; }
  if (matchCmd(cmdWord, 'todos') || matchCmdStart(cmd, 'todos '))
    { await grupoHandler.handleTodos(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'avisar') || matchCmdStart(cmd, 'avisar '))
    { await grupoHandler.handleAvisar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'fixargrupo') || matchCmdStart(cmd, 'fixargrupo '))
    { await grupoHandler.handleFixarGrupo(sock, msg, content, jid, caption); return; }
  if (matchCmd(cmdWord, 'sorteio') || matchCmdStart(cmd, 'sorteio '))
    { await grupoHandler.handleSorteio(sock, msg, content, jid, botJid, contactNames); return; }
  if (matchCmd(cmdWord, 'enquete') || matchCmdStart(cmd, 'enquete '))
    { await grupoHandler.handleEnquete(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'antilink') || matchCmdStart(cmd, 'antilink '))
    { await grupoHandler.handleAntiLink(sock, msg, content, jid); return; }
  if (matchCmd(cmdWord, 'autosticker') || matchCmdStart(cmd, 'autosticker '))
    { await grupoHandler.handleAutoSticker(sock, msg, content, jid, autoStickerGroups, saveData); return; }
  if (matchCmd(cmdWord, 'slowmode') || matchCmdStart(cmd, 'slowmode '))
    { await grupoHandler.handleSlowMode(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'antiflood') || matchCmdStart(cmd, 'antiflood '))
    { await grupoHandler.handleAntiFlood(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'bemvindo') || matchCmdStart(cmd, 'bemvindo '))
    { await grupoHandler.handleBemVindo(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'fechar'))
    { await grupoHandler.handleFecharAbrir(sock, msg, jid, true); return; }
  if (matchCmd(cmdWord, 'abrir'))
    { await grupoHandler.handleFecharAbrir(sock, msg, jid, false); return; }
  if (matchCmd(cmdWord, 'linkgrupo'))
    { await grupoHandler.handleLinkGrupo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'regras') || matchCmd(cmdWord, 'regrasgrupo'))
    { await grupoHandler.handleRegras(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'setregras') || matchCmdStart(cmd, 'setregras '))
    { await grupoHandler.handleSetRegras(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'adms') || matchCmd(cmdWord, 'marcaradms') || matchCmd(cmdWord, 'chamaradms') || matchCmdStart(cmd, 'adms '))
    { await grupoHandler.handleAdms(sock, msg, jid, caption, contactNames); return; }
  if (matchCmd(cmdWord, 'statsgrupo') || matchCmd(cmdWord, 'estatisticas'))
    { await grupoHandler.handleStatsGrupo(sock, msg, jid); return; }

  // ── ECONOMIA ──────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'gold'))
    { await diversaoHandler.handleGold(sock, msg, jid, getPrefix, contactNames); return; }
  if (matchCmd(cmdWord, 'loja'))
    { await diversaoHandler.handleLoja(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'lojafood'))
    { await diversaoHandler.handleLojaFood(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'lojapet'))
    { await diversaoHandler.handleLojaPet(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'lojatec'))
    { await diversaoHandler.handleLojaTec(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'lojacasal'))
    { await diversaoHandler.handleLojaCasal(sock, msg, jid, getPrefix); return; }
  if (matchCmdStart(cmd, 'buy ') || matchCmd(cmdWord, 'buy'))
    { await diversaoHandler.handleComprar(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'give ') || matchCmd(cmdWord, 'give'))
    { await handleGive(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'vender') || matchCmdStart(cmd, 'vender '))
    { await diversaoHandler.handleVender(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'inventario') || matchCmd(cmdWord, 'inv'))
    { await diversaoHandler.handleInventario(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'pixmulti') || matchCmd(cmdWord, 'pixtodos') || matchCmdStart(cmd, 'pixmulti ') || matchCmdStart(cmd, 'pixtodos '))
    { await diversaoHandler.handlePixMulti(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'pixdoar') || matchCmd(cmdWord, 'doargold') || matchCmdStart(cmd, 'pixdoar ') || matchCmdStart(cmd, 'doargold '))
    { await diversaoHandler.handlePixDoar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'pix') || matchCmd(cmdWord, 'transferir') || matchCmdStart(cmd, 'pix ') || matchCmdStart(cmd, 'transferir '))
    { await diversaoHandler.handlePix(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'apostar') || matchCmdStart(cmd, 'apostar '))
    { await diversaoHandler.handleApostar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'slots') || matchCmdStart(cmd, 'slots '))
    { await diversaoHandler.handleSlots(sock, msg, jid, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'corrida') || matchCmdStart(cmd, 'corrida '))
    { await diversaoHandler.handleCorrida(sock, msg, jid, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'extrato'))
    { await diversaoHandler.handleExtrato(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'garimpar') || matchCmd(cmdWord, 'explorar') || matchCmd(cmdWord, 'pesquisar'))
    { await diversaoHandler.handleGarimpar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'emprestimo') || matchCmdStart(cmd, 'emprestimo '))
    { await handleEmprestimo(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'pay emprestimo'))
    { await handlePayEmprestimo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'divida'))
    { await handleDivida(sock, msg, jid); return; }

  // ── MISSÕES ───────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'missao') || matchCmd(cmdWord, 'missoes'))
    { await diversaoHandler.handleMissao(sock, msg, jid, caption, getPrefix); return; }

  // ── MEDIEVAL ──────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'medieval') || matchCmdStart(cmd, 'medieval '))
    { await medievalHandler.handleMedievalToggle(sock, msg, jid, caption.replace(/^[!.,\/]medieval\s*/i, ''), await grupoHandler.isAdmin(sock, jid, senderJid)); return; }
  if (matchCmd(cmdWord, 'ficha'))
    { await medievalHandler.handleFicha(sock, msg, jid, senderJid, author); return; }
  if (matchCmd(cmdWord, 'atacar') || matchCmdStart(cmd, 'atacar ')) {
    const targetAtacar = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
    await medievalHandler.handleAtacar(sock, msg, jid, senderJid, author, targetAtacar); return;
  }
  if (matchCmd(cmdWord, 'magia') || matchCmdStart(cmd, 'magia ')) {
    const targetMagia = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
    await medievalHandler.handleMagia(sock, msg, jid, senderJid, author, targetMagia); return;
  }
  if (matchCmd(cmdWord, 'missaomed'))
    { await medievalHandler.handleMissao(sock, msg, jid, senderJid, author); return; }
  if (matchCmd(cmdWord, 'saquear') || matchCmdStart(cmd, 'saquear ')) {
    const targetSaque = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
    await medievalHandler.handleSaquear(sock, msg, jid, senderJid, targetSaque);
    return;
  }
  if (matchCmd(cmdWord, 'recargamana'))
    { await medievalHandler.handleRecargaMana(sock, msg, jid, senderJid, author); return; }
  if (matchCmd(cmdWord, 'historico'))
    { await medievalHandler.handleHistorico(sock, msg, jid, senderJid, author); return; }
  if (matchCmd(cmdWord, 'lojamedieval') || matchCmdStart(cmd, 'lojamedieval ') ||
      matchCmd(cmdWord, 'lojamed')      || matchCmdStart(cmd, 'lojamed ')) {
    const argsLoja = caption.replace(/^[!.,\/](lojamedieval|lojamed)\s*/i, '').trim();
    await medievalHandler.handleLojaMedieval(sock, msg, jid, senderJid, author, argsLoja);
    return;
  }
  if (matchCmd(cmdWord, 'comprar') || matchCmdStart(cmd, 'comprar '))
    { await medievalHandler.handleComprarMedieval(sock, msg, jid, senderJid, author, caption.replace(/^[!.,\/]comprar\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'equipar') || matchCmdStart(cmd, 'equipar '))
    { await medievalHandler.handleEquipar(sock, msg, jid, senderJid, author, caption.replace(/^[!.,\/]equipar\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'desequipar') || matchCmdStart(cmd, 'desequipar '))
    { await medievalHandler.handleDesequipar(sock, msg, jid, senderJid, author, caption.replace(/^[!.,\/]desequipar\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'invmed'))
    { await medievalHandler.handleInvMed(sock, msg, jid, senderJid, author); return; }
  if (matchCmd(cmdWord, 'sellmed') || matchCmdStart(cmd, 'sellmed '))
    { await medievalHandler.handleSellMed(sock, msg, jid, senderJid, author, caption.replace(/^[!.,\/]sellmed\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'givemed') || matchCmdStart(cmd, 'givemed ')) {
    const targetGive = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
    const argsGive    = caption.replace(/^[!.,\/]givemed\s*/i, '').replace(/@\d+/g, '').trim();
    await medievalHandler.handleGiveMed(sock, msg, jid, senderJid, author, targetGive, argsGive);
    return;
  }
  if (matchCmd(cmdWord, 'usarpocao') || matchCmdStart(cmd, 'usarpocao '))
    { await medievalHandler.handleUsarPocao(sock, msg, jid, senderJid, author, caption.replace(/^[!.,\/]usarpocao\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'rankmedieval'))
    { await medievalHandler.handleRankMedieval(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'menumediev'))
    { await medievalHandler.handleMenuMedieval(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'sistemmedieval') || matchCmd(cmdWord, 'comomediev'))
    { await diversaoHandler.handleSistemaMedieval(sock, msg, jid, getPrefix); return; }

  // ── PETS ──────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'capturar'))
    { await diversaoHandler.handleCapturarPet(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'alimentar') || matchCmd(cmdWord, 'alimentarpet'))
    { await diversaoHandler.handleAlimentarPet(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'brincar'))
    { await diversaoHandler.handleBrincarPet(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'curar') || matchCmd(cmdWord, 'curarpet'))
    { await diversaoHandler.handleCurarPet(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'pet') && /\s+(on|off|status)\s*$/i.test(cmd))
    { await diversaoHandler.handlePetToggle(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'statuspet') || matchCmd(cmdWord, 'pet'))
    { await diversaoHandler.handleStatusPet(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'petrank') || matchCmd(cmdWord, 'rankpet'))
    { await diversaoHandler.handlePetRank(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'pets'))
    { await diversaoHandler.handlePets(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'abrigo') || matchCmd(cmdWord, 'shelter'))
    { await diversaoHandler.handleAbrigo(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'renomearpet ') || matchCmd(cmdWord, 'renomearpet') ||
      matchCmdStart(cmd, 'nomearpet ')   || matchCmd(cmdWord, 'nomearpet'))
    { await diversaoHandler.handleRenomearPet(sock, msg, jid, caption); return; }

  // ── MARKETPLACE ───────────────────────────────────────────────
  if (matchCmd(cmdWord, 'avenda') || matchCmdStart(cmd, 'avenda '))
    { await diversaoHandler.handleAvenda(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'buscaroferta') || matchCmd(cmdWord, 'buscaoferta') || matchCmdStart(cmd, 'buscaroferta ') || matchCmdStart(cmd, 'buscaoferta '))
    { await diversaoHandler.handleBuscarOferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'ofertar') || matchCmdStart(cmd, 'ofertar '))
    { await diversaoHandler.handleOfertar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'buyoferta') || matchCmdStart(cmd, 'buyoferta '))
    { await diversaoHandler.handleBuy(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'cancelaroferta') || matchCmd(cmdWord, 'canceloferta') || matchCmdStart(cmd, 'cancelaroferta ') || matchCmdStart(cmd, 'canceloferta '))
    { await diversaoHandler.handleCancelarOferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'minhasofertas') || matchCmd(cmdWord, 'mesofertas'))
    { await diversaoHandler.handleMinhasOfertas(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'historicomarket') || matchCmd(cmdWord, 'mercadohistorico') || matchCmdStart(cmd, 'historicomarket ') || matchCmdStart(cmd, 'mercadohistorico '))
    { await diversaoHandler.handleHistoricoMarket(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'aceitarofferta') || matchCmd(cmdWord, 'aceitaroferta'))
    { await diversaoHandler.handleAceitarOfferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'menumarket') || matchCmd(cmdWord, 'menumercado'))
    { await diversaoHandler.handleMenuMarket(sock, msg, jid, getPrefix); return; }

  // ── PESCA ─────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'pescar') || matchCmd(cmdWord, 'pesca'))
    { await pescaHandler.handlePescar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'varas') || matchCmd(cmdWord, 'lojavara') || matchCmd(cmdWord, 'varapesca'))
    { await pescaHandler.handleVaras(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'iscas') || matchCmd(cmdWord, 'lojaisca') || matchCmd(cmdWord, 'isca'))
    { await pescaHandler.handleIscas(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'buypesca') || matchCmdStart(cmd, 'buypesca '))
    { await pescaHandler.handleComprarPesca(sock, msg, jid, caption.replace(/^[!.,/]buypesca\s*/i, '')); return; }
  if (matchCmd(cmdWord, 'inventariopesca') || matchCmd(cmdWord, 'invpesca') || matchCmd(cmdWord, 'minhapesca'))
    { await pescaHandler.handleInventarioPesca(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'sellpesca') || matchCmdStart(cmd, 'sellpesca '))
    { await pescaHandler.handleVenderPesca(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'givepesca') || matchCmdStart(cmd, 'givepesca '))
    { await pescaHandler.handleGivePesca(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'rankingpesca'))
    { await pescaHandler.handleRankingPesca(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'statspesca'))
    { await pescaHandler.handleStatsPesca(sock, msg, jid); return; }

  // ── EMPREGO ───────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'procuraremprego') || matchCmd(cmdWord, 'buscaemprego'))
    { await diversaoHandler.handleProcurarEmprego(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'trabalhar') || matchCmd(cmdWord, 'work'))
    { await diversaoHandler.handleTrabalhar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'promocao') || matchCmd(cmdWord, 'promcao'))
    { await diversaoHandler.handlePromocao(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'emprego') || matchCmd(cmdWord, 'meuemprego'))
    { await diversaoHandler.handleEmprego(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'demitir') || matchCmd(cmdWord, 'pedirdemissao'))
    { await diversaoHandler.handleDemitir(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'menuwork') || matchCmd(cmdWord, 'menuemprego'))
    { await diversaoHandler.handleMenuWork(sock, msg, jid, getPrefix); return; }

  // ── ROUBO ─────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'menuroubar'))   { await diversaoHandler.handleMenuRoubo(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menusec'))      { await diversaoHandler.handleMenuSec(sock, msg, jid, getPrefix);   return; }
  if (matchCmd(cmdWord, 'buyroubo'))     { await diversaoHandler.handleComprarRoubo(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'buysec'))       { await diversaoHandler.handleComprarSec(sock, msg, jid, caption);   return; }
  if (matchCmd(cmdWord, 'equiparroubo')) { await diversaoHandler.handleEquiparRoubo(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'equiparsec'))   { await diversaoHandler.handleEquiparSec(sock, msg, jid, caption);   return; }
  if (matchCmd(cmdWord, 'roubar'))       { await diversaoHandler.handleRoubar(sock, msg, jid, caption);       return; }
  if (matchCmd(cmdWord, 'roubarbanco'))  { await diversaoHandler.handleRoubarBanco(sock, msg, jid);           return; }
  if (matchCmd(cmdWord, 'invroubo'))     { await diversaoHandler.handleInvRoubo(sock, msg, jid);              return; }
  if (matchCmd(cmdWord, 'invsec'))       { await diversaoHandler.handleInvSec(sock, msg, jid);                return; }
  if (matchCmd(cmdWord, 'policia'))      { await diversaoHandler.handlePolicia(sock, msg, jid);               return; }

  // ── UTILITÁRIOS ────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'level') || matchCmd(cmdWord, 'nivel') || matchCmd(cmdWord, 'mylevel') || matchCmd(cmdWord, 'meunivel'))
    { await utilidadeHandler.handleLevel(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'ranklevel') || matchCmd(cmdWord, 'ranknivel') || matchCmd(cmdWord, 'rankxp') || matchCmd(cmdWord, 'toplevel') || matchCmd(cmdWord, 'topnivel'))
    { await utilidadeHandler.handleRankLevel(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'alteradores'))  { await utilidadeHandler.handleAlteradores(sock, msg, jid); return; }
  if (matchCmdStart(cmd, 'qrcode ')      || matchCmd(cmdWord, 'qrcode'))      { await utilidadeHandler.handleQrcode(sock, msg, jid, caption);       return; }
  if (matchCmdStart(cmd, 'encurtar ')    || matchCmd(cmdWord, 'encurtar'))    { await utilidadeHandler.handleEncurtar(sock, msg, jid, caption);     return; }
  if (matchCmdStart(cmd, 'cep ')         || matchCmd(cmdWord, 'cep'))         { await utilidadeHandler.handleCep(sock, msg, jid, caption);          return; }
  if (matchCmdStart(cmd, 'clima ')       || matchCmd(cmdWord, 'clima'))       { await utilidadeHandler.handleClima(sock, msg, jid, caption);        return; }
  if (matchCmdStart(cmd, 'calcular ')    || matchCmd(cmdWord, 'calcular'))    { await utilidadeHandler.handleCalcular(sock, msg, jid, caption);     return; }
  if (matchCmdStart(cmd, 'traduzir ')    || matchCmd(cmdWord, 'traduzir'))    { await utilidadeHandler.handleTraduzir(sock, msg, jid, caption);     return; }
  if (matchCmd(cmdWord, 'piada'))                                             { await utilidadeHandler.handlePiada(sock, msg, jid);                 return; }
  if (matchCmd(cmdWord, 'fato'))                                              { await utilidadeHandler.handleFato(sock, msg, jid);                  return; }

  if (matchCmdStart(cmd, 'codigomorse ') || matchCmd(cmdWord, 'codigomorse') ||
      matchCmdStart(cmd, 'morse ')        || matchCmd(cmdWord, 'morse'))
    { await utilidadeHandler.handleCodigoMorse(sock, msg, jid, caption); return; }

  if (matchCmdStart(cmd, 'decodificarmorse ') || matchCmd(cmdWord, 'decodificarmorse') ||
      matchCmdStart(cmd, 'demorse ')           || matchCmd(cmdWord, 'demorse'))
    { await utilidadeHandler.handleDecodificarMorse(sock, msg, jid, caption); return; }

  if (matchCmdStart(cmd, 'inverter ') || matchCmd(cmdWord, 'inverter'))
    { await utilidadeHandler.handleReverseText(sock, msg, jid, caption); return; }

  if (matchCmdStart(cmd, 'fofoca ') || matchCmd(cmdWord, 'fofoca'))
    { await utilidadeHandler.handleSayFofoca(sock, msg, content, jid, author, contactNames); return; }

  if (matchCmdStart(cmd, 'gerarnome ') || matchCmd(cmdWord, 'gerarnome'))
    { await utilidadeHandler.handleGerarNome(sock, msg, jid, caption); return; }

  if (matchCmdStart(cmd, 'moeda ')) {
    const args = caption.replace(/^[!.,\/]moeda\s*/i, '').trim().split(/\s+/);
    if (args.length >= 3 && !isNaN(parseFloat(args[0])))
      { await utilidadeHandler.handleMoeda(sock, msg, jid, caption); }
    else
      { await diversaoHandler.handleMoeda(sock, msg, jid); }
    return;
  }
  if (matchCmd(cmdWord, 'moeda')) { await diversaoHandler.handleMoeda(sock, msg, jid); return; }

  // ── DOWNLOADS ─────────────────────────────────────────────────
  if (matchCmdStart(cmd, 'tiktok'))
    { await utilidadeHandler.handleTiktok(sock, msg, jid, caption, getPrefix); return; }
  if (matchCmd(cmdWord, 'save') || matchCmdStart(cmd, 'save '))
    { await utilidadeHandler.handleSave(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'saverec'))
    { await utilidadeHandler.handleSaveRec(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'audio'))
    { await utilidadeHandler.handleAudioDownload(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'som ') || matchCmd(cmdWord, 'som') || matchCmdStart(cmd, 'play '))
    { await utilidadeHandler.handleSom(sock, msg, jid, caption, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'playmp4'))
    { await utilidadeHandler.handlePlayMp4(sock, msg, jid, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'playdoc'))
    { await utilidadeHandler.handlePlayDoc(sock, msg, jid, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'pinterest') || matchCmd(cmdWord, 'pinterest2'))
    { await downloadsHandler.handlePinterest(sock, msg, jid, caption); return; }

  // ── FIGURINHAS ────────────────────────────────────────────────
  if (
    (matchCmd(cmd, 's') || matchCmdStart(cmd, 's ')) &&
    (imageMsg || videoMsg || content.extendedTextMessage?.contextInfo?.quotedMessage)
  ) { await figurinhaHandler.handleSticker(sock, msg, content, jid, author, stickerCount); return; }

  if (
    matchCmd(cmdWord, 'f') &&
    (imageMsg || videoMsg || content.extendedTextMessage?.contextInfo?.quotedMessage)
  ) { await figurinhaHandler.handleSticker(sock, msg, content, jid, author, stickerCount); return; }

  if (matchCmdStart(cmd, 'desfig'))       { await figurinhaHandler.handleDesfig(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'estourar'))     { await figurinhaHandler.handleEstourar(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'brat '))        { await figurinhaHandler.handleBrat(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'figtexto '))    { await figurinhaHandler.handleFigtexto(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmd(cmdWord, 'attp') || matchCmdStart(cmd, 'attp '))   { await figurinhaHandler.handleAttp(sock, msg, jid, caption, getPrefix, stickerCount, 1); return; }
  if (matchCmd(cmdWord, 'attp2') || matchCmdStart(cmd, 'attp2 ')) { await figurinhaHandler.handleAttp(sock, msg, jid, caption, getPrefix, stickerCount, 2); return; }
  if (matchCmdStart(cmd, 'qc '))          { await figurinhaHandler.handleQc(sock, msg, jid, caption, getPrefix, stickerCount, 1); return; }
  if (matchCmdStart(cmd, 'qc2 '))         { await figurinhaHandler.handleQc(sock, msg, jid, caption, getPrefix, stickerCount, 2); return; }
  if (matchCmdStart(cmd, 'emojimix'))     { await figurinhaHandler.handleEmojiMix(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'emoji'))        { await figurinhaHandler.handleEmoji(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'toimg'))        { await figurinhaHandler.handleToImg(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'togif'))        { await figurinhaHandler.handleToGif(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'figemoji'))     { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figemoji',    'emoji meme',      stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figroblox'))    { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figroblox',   'roblox meme',     stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figmeme'))      { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figmeme',     'funny meme',      stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figcoreana'))   { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figcoreana',  'kpop cute',       stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figraiva'))     { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figraiva',    'angry reaction',  stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figengracada')) { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figengracada','funny laugh',     stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figdesenho'))   { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figdesenho',  'cartoon sticker', stickerCount, author); return; }
  if (matchCmdStart(cmd, 'fig '))         { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'fig',         'sticker',         stickerCount, author); return; }
  if (matchCmdStart(cmd, 'pesquisafig'))  { await figurinhaHandler.handlePesquisaFig(sock, msg, jid, caption, getPrefix, stickerCount); return; }

  // ── RELACIONAMENTO ─────────────────────────────────────────────
  if (matchCmdStart(cmd, 'casar'))
    { await relacionamentoHandler.handleRelacionamento(sock, msg, content, jid, author, 'casamento', relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmdStart(cmd, 'namorar'))
    { await relacionamentoHandler.handleRelacionamento(sock, msg, content, jid, author, 'namoro', relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmd(cmdWord, 'terminar'))
    { await relacionamentoHandler.handleCancelarCasamento(sock, msg, jid, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'cancelarpedido'))
    { await relacionamentoHandler.handleCancelarPedido(sock, msg, jid, senderJid, pedidosPendentes); return; }
  if (matchCmd(cmdWord, 'euaceito'))
    { await relacionamentoHandler.handleEuAceito(sock, msg, jid, senderJid, relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmd(cmdWord, 'eurecuso'))
    { await relacionamentoHandler.handleEuRecuso(sock, msg, jid, senderJid, pedidosPendentes, contactNames); return; }
  if (matchCmd(cmdWord, 'flores'))           { await relacionamentoHandler.handleFlores(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'doces'))            { await relacionamentoHandler.handleDoces(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'carta'))            { await relacionamentoHandler.handleCarta(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'mimo'))             { await relacionamentoHandler.handleMimo(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'beijo'))            { await relacionamentoHandler.handleBeijo(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'abraco'))           { await relacionamentoHandler.handleAbraco(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'presente'))         { await relacionamentoHandler.handlePresente(sock, msg, jid, author, senderJid, relacionamentos, caption); return; }
  if (matchCmd(cmdWord, 'jantar'))           { await relacionamentoHandler.handleJantar(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'cinematel'))        { await relacionamentoHandler.handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'viajar'))           { await relacionamentoHandler.handleViajar(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'serenata'))         { await relacionamentoHandler.handleSerenata(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'declarar'))         { await relacionamentoHandler.handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmdStart(cmd, 'ciumento'))        { await relacionamentoHandler.handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames); return; }
  if (matchCmd(cmdWord, 'statu'))            { await relacionamentoHandler.handleStatu(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'meupar'))           { await relacionamentoHandler.handleMeuPar(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'xpdobro'))          { await relacionamentoHandler.handleXpDobro(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'aniversario_casal')){ await relacionamentoHandler.handleAniversarioCasal(sock, msg, jid, author, senderJid, relacionamentos); return; }
  if (matchCmdStart(cmd, 'duelodecasais'))   { await relacionamentoHandler.handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames); return; }
  if (matchCmd(cmdWord, 'rankcasais'))       { await relacionamentoHandler.handleRankCasais(sock, msg, jid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'tentarfilho'))  { await diversaoHandler.handleTentarFilho(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'filho'))        { await diversaoHandler.handleVerFilho(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'cuidarfilho'))  { await diversaoHandler.handleCuidarFilho(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'remediofil'))   { await diversaoHandler.handleRemedioFilho(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'renomearfilho') || matchCmdStart(cmd, 'renomearfilho ')) {
    const argsRenomear = caption.replace(/^[!.,\/]renomearfilho\s*/i, '');
    await diversaoHandler.handleRenomearFilho(sock, msg, jid, argsRenomear);
    return;
  }

  // ── PINNED ──────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'fixarinfo') || matchCmd(cmdWord, 'ajudafixar'))
    { await pinnedHandler.handleFixarInfo(sock, msg, jid); return; }
  if (matchCmdStart(cmd, 'fixar'))
    { await pinnedHandler.handleFixar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'desfixar'))
    { await pinnedHandler.handleDesfixar(sock, msg, jid, pinnedMessages); return; }
  if (matchCmd(cmdWord, 'pinned') || matchCmd(cmdWord, 'mensagemfixada'))
    { await pinnedHandler.handlePinned(sock, msg, jid, pinnedMessages); return; }

  // ── ANIVERSÁRIOS ──────────────────────────────────────────────
  if (matchCmdStart(cmd, 'reganiversario'))
    { await aniversarioHandler.handleRegAniversario(sock, msg, jid, caption, author, senderJid); return; }
  if (matchCmd(cmdWord, 'excluiraniversario'))
    { await aniversarioHandler.handleExcluirAniversario(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'meuaniversario'))
    { await aniversarioHandler.handleMeuAniversario(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'listaniversarios'))
    { await aniversarioHandler.handleListAniversarios(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'sistemaniversario')) {
    const isAdm = await grupoHandler.isAdmin(sock, jid, senderJid).catch(() => false);
    await aniversarioHandler.handleSistemaAniversario(sock, msg, jid, isAdm);
    return;
  }

  // ── DIVERSÃO ──────────────────────────────────────────────────
  if (matchCmdStart(cmd, 'gay'))           { await diversaoHandler.handleGay(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'sexo'))          { await diversaoHandler.handleSexo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'lesbica'))       { await diversaoHandler.handleLesbica(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'aura'))          { await diversaoHandler.handleAura(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'podre'))         { await diversaoHandler.handlePodre(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'frango'))        { await diversaoHandler.handleFrango(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'dado'))          { await diversaoHandler.handleDado(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, '8ball'))         { await diversaoHandler.handle8ball(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'ship'))          { await diversaoHandler.handleShip(sock, msg, content, jid, contactNames); return; }
  if (matchCmdStart(cmd, 'compatibilidade')) { await diversaoHandler.handleCompatibilidade(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'rolar'))         { await diversaoHandler.handleRolar(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'xingar'))        { await diversaoHandler.handleXingar(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'elogio'))        { await diversaoHandler.handleElogio(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'crush'))         { await diversaoHandler.handleCrush(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'cantada'))       { await diversaoHandler.handleCantada(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'safadeza'))      { await diversaoHandler.handleSafadeza(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'trans'))         { await diversaoHandler.handleTrans(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'corno'))         { await diversaoHandler.handleCorno(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'gado'))          { await diversaoHandler.handleGado(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'peitudo'))       { await diversaoHandler.handlePeitudo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'pauzudo'))       { await diversaoHandler.handlePauzudo(sock, msg, content, jid, author, contactNames); return; }
}

module.exports = {
  handleMessage,
  setBotJid,
  getBotJid,
};
