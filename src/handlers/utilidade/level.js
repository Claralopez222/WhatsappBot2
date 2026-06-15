'use strict';

const Usuario = require('../../models/Usuario');
const path = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

// ─────────────────────────────────────────────────────────────────────────
// ⚠️ IMPORTANTE — Identidade do usuário (idWhatsApp)
//
// Hoje o WhatsApp pode enviar o remetente em DOIS formatos de JID:
//   - "5511999999999@s.whatsapp.net"  (número de telefone "tradicional")
//   - "73396520337564@lid"            (LID — Linked Identifier, NÃO é telefone)
//
// O LID é apenas um identificador interno do WhatsApp. NUNCA extraia os
// dígitos de um @lid e monte um "@s.whatsapp.net" falso com eles — isso
// gera um JID inválido (ex: "73396520337564@s.whatsapp.net") que o
// WhatsApp tenta exibir como número de telefone, resultando em algo como
// "+1 73396520337564" na menção.
//
// A regra correta é: usar o JID original (em lowercase, com o sufixo que
// ele já tem — @lid ou @s.whatsapp.net) como idWhatsApp, tanto para salvar
// quanto para consultar e para a menção. O texto "@<dígitos>" no corpo da
// mensagem deve usar os dígitos DESSE MESMO jid (funciona para @lid e para
// @s.whatsapp.net, pois o WhatsApp casa o "@<dígitos>" do texto com o JID
// correspondente em "mentions").
//
// ⚠️ Essa MESMA normalização precisa ser usada em qualquer outro ponto do
// bot que grava idWhatsApp (ex: handler que concede XP por mensagem,
// economia, banco etc.), senão os registros ficam com identidades
// diferentes e !level/!ranklevel nunca vão coincidir.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normaliza o JID do remetente de uma mensagem.
 * Retorna { fullJid, numero } ou null se inválido.
 */
function normalizarRemetente(msg) {
  const rawSender = (msg.key.participant || msg.key.remoteJid)?.toLowerCase();
  if (!rawSender) return null;

  const numero = rawSender.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!numero) return null;

  // ✅ Mantém o sufixo original (@lid ou @s.whatsapp.net) — não converte!
  return { fullJid: rawSender, numero };
}

/**
 * !level — Mostra o nível e XP atual do próprio usuário NESTE grupo
 */
async function handleLevel(sock, msg, jid, author) {
  // ✅ !level também é por grupo, então exige uso dentro de um grupo —
  // consistente com !ranklevel e com o restante da economia (gold, banco etc.)
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.'
    }, { quoted: msg });
  }

  const remetente = normalizarRemetente(msg);
  if (!remetente) return; // JID inválido/inesperado

  const { fullJid, numero } = remetente;

  try {
    const user = await CarteiraGrupo.findOne({ idWhatsApp: fullJid, idGrupo: jid }).lean();

    const xp = Math.max(0, user?.xp ?? 0);

    if (!user || xp === 0) {
      return sock.sendMessage(jid, {
        text: `📊 *NÍVEL DE PROGRESSO*\n\n@${numero}, você ainda não tem XP registrado neste grupo.\nContinue interagindo para começar a pontuar!`,
        mentions: [fullJid]
      }, { quoted: msg });
    }

    // ✅ Nível e progresso SEMPRE derivados do XP via fórmula centralizada
    // do model — mesma lógica usada no !ranklevel, sem depender do campo
    // "level" salvo (que pode estar desatualizado)
    const level        = CarteiraGrupo.levelFromXp(xp);
    const xpAtualLevel = CarteiraGrupo.xpParaLevel(level);
    const xpProximo    = CarteiraGrupo.xpParaLevel(level + 1);
    const xpNoLevel    = Math.max(0, xp - xpAtualLevel);
    const xpNecessario = Math.max(1, xpProximo - xpAtualLevel);
    const progresso    = Math.min(100, Math.floor((xpNoLevel / xpNecessario) * 100));
    const barras       = Math.min(10, Math.max(0, Math.floor(progresso / 10)));
    const barraVisual  = '█'.repeat(barras) + '░'.repeat(10 - barras);

    const texto =
      `📊 *SEU STATUS DE NÍVEL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Usuário:* @${numero}\n` +
      `⭐ *Nível:* ${level}\n` +
      `✨ *XP Total:* ${xp.toLocaleString('pt-BR')} XP\n\n` +
      `📈 *Progresso para o nível ${level + 1}:*\n` +
      `[${barraVisual}] ${progresso}%\n` +
      `${xpNoLevel.toLocaleString('pt-BR')} / ${xpNecessario.toLocaleString('pt-BR')} XP\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_💬 Continue ativo para subir de nível!_`;

    return sock.sendMessage(jid, { text: texto, mentions: [fullJid] }, { quoted: msg });

  } catch (err) {
    console.error('[handleLevel] Erro:', err);
    return sock.sendMessage(jid, {
      text: '⚠️ Não foi possível carregar seu nível. Tente novamente mais tarde.'
    }, { quoted: msg });
  }
}

/**
 * !ranklevel — Top 10 usuários com mais XP ativos no grupo (ranking por grupo)
 */
async function handleRankLevel(sock, msg, jid) {
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.'
    }, { quoted: msg });
  }

  try {
    const metadata = await sock.groupMetadata(jid);

    // ── Conjunto com os JIDs reais dos membros atuais do grupo (já vêm
    // como @lid ou @s.whatsapp.net, dependendo do participante) ──
    const membrosSet = new Set();
    for (const p of metadata.participants) {
      const rawId = p.id?.toLowerCase();
      if (!rawId) continue;
      membrosSet.add(rawId);
    }

    if (membrosSet.size === 0) {
      return sock.sendMessage(jid, {
        text: '❌ Não foi possível obter os membros deste grupo.'
      }, { quoted: msg });
    }

    // ── Busca o XP por GRUPO (CarteiraGrupo) — ranking separado por grupo ──
    const todosCandidatos = await CarteiraGrupo
      .find({ idGrupo: jid, xp: { $gt: 0 } })
      .sort({ xp: -1 })
      .lean();

    // ── Remove quem saiu/foi banido (checagem em tempo real contra o grupo) ──
    const candidatos = todosCandidatos
      .filter(u => {
        const idRaw = u.idWhatsApp?.toLowerCase();
        return idRaw ? membrosSet.has(idRaw) : false;
      })
      .slice(0, 10);

    if (candidatos.length === 0) {
      return sock.sendMessage(jid, {
        text: '❌ Nenhum membro deste grupo possui XP registrado ainda.\n_Interaja no grupo para ganhar XP!_'
      }, { quoted: msg });
    }

    const MEDALS   = ['🥇', '🥈', '🥉'];
    const mentions = [];

    const linhas = candidatos.map((user, i) => {
      const fullJid = user.idWhatsApp.toLowerCase();
      const numero  = fullJid.split('@')[0].split(':')[0].replace(/\D/g, '');
      mentions.push(fullJid);

      const prefix = MEDALS[i] ?? `🔹 *${i + 1}.*`;
      const xpRaw  = Math.max(0, user.xp ?? 0);
      const xp     = xpRaw.toLocaleString('pt-BR');

      // ✅ Nível e progresso SEMPRE derivados do XP, usando a mesma fórmula
      // centralizada do model (sem reimplementar localmente)
      const level        = CarteiraGrupo.levelFromXp(xpRaw);
      const xpAnterior   = CarteiraGrupo.xpParaLevel(level);
      const xpProximo    = CarteiraGrupo.xpParaLevel(level + 1);
      const xpNoLevel    = Math.max(0, xpRaw - xpAnterior);
      const xpNecessario = Math.max(1, xpProximo - xpAnterior);
      const progresso    = Math.min(100, Math.floor((xpNoLevel / xpNecessario) * 100));
      const barras       = Math.min(5, Math.max(0, Math.floor(progresso / 20)));
      const barraVisual  = '█'.repeat(barras) + '░'.repeat(5 - barras);

      return (
        `${prefix} @${numero}\n` +
        `┣ 🏅 Nível *${level}*  •  ✨ *${xp} XP*\n` +
        `┗ [${barraVisual}] ${progresso}% → nível ${level + 1}`
      );
    });

    const texto =
      `🏆 *RANKING DE XP — TOP ${candidatos.length}* 🏆\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *!level* para ver seu progresso pessoal!_`;

    return sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankLevel] Erro:', err);
    return sock.sendMessage(jid, {
      text: '⚠️ Erro ao processar o ranking. Tente novamente.'
    }, { quoted: msg });
  }
}

module.exports = { handleLevel, handleRankLevel, normalizarRemetente };