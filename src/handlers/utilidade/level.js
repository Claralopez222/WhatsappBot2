'use strict';

const Usuario = require('../../models/Usuario');
const path = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

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

  const rawSender = msg.key.participant || msg.key.remoteJid;
  if (!rawSender) return;

  const numero = rawSender.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!numero) return; // JID inválido/inesperado — evita @s.whatsapp.net sem número

  const fullJid = `${numero}@s.whatsapp.net`;

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

// ── Fórmulas de XP/Nível ──────────────────────────────────────────────────
// IMPORTANTE: o nível exibido é SEMPRE calculado a partir do XP, nunca lido
// direto do campo "level" do banco. Isso elimina o problema de "nível 163
// com 8.143 XP e 0%" — nível e progresso ficam sempre coerentes entre si.

function xpParaLevel(level) {
  return Math.floor(100 * Math.pow(Math.max(0, level - 1), 1.5));
}

function levelFromXp(xp) {
  const xpSeguro = Math.max(0, xp);
  return Math.max(1, Math.floor(Math.pow(xpSeguro / 100, 1 / 1.5)) + 1);
}

async function handleRankLevel(sock, msg, jid) {
  if (!jid?.endsWith('@g.us')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.'
    }, { quoted: msg });
  }

  try {
    const metadata = await sock.groupMetadata(jid);

    // ── Conjunto com TODOS os formatos possíveis de identificação dos
    // membros atuais do grupo (number@s.whatsapp.net, number@lid e o id
    // "crú" do Baileys) — cobre tanto participantes @lid quanto número normal
    const membrosSet = new Set();
    for (const p of metadata.participants) {
      const rawId = p.id?.toLowerCase();
      if (!rawId) continue;

      membrosSet.add(rawId);

      const num = rawId.split('@')[0].split(':')[0].replace(/\D/g, '');
      if (num) {
        membrosSet.add(`${num}@s.whatsapp.net`);
        membrosSet.add(`${num}@lid`);
      }
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
    const candidatos = todosCandidatos.filter(u => {
      const idRaw = u.idWhatsApp?.toLowerCase();
      if (!idRaw) return false;
      if (membrosSet.has(idRaw)) return true;

      const num = idRaw.split('@')[0].split(':')[0].replace(/\D/g, '');
      return num
        ? (membrosSet.has(`${num}@s.whatsapp.net`) || membrosSet.has(`${num}@lid`))
        : false;
    }).slice(0, 10);

    if (candidatos.length === 0) {
      return sock.sendMessage(jid, {
        text: '❌ Nenhum membro deste grupo possui XP registrado ainda.\n_Interaja no grupo para ganhar XP!_'
      }, { quoted: msg });
    }

    const MEDALS   = ['🥇', '🥈', '🥉'];
    const mentions = [];

    const linhas = candidatos.map((user, i) => {
      const numero = user.idWhatsApp.split('@')[0].split(':')[0].replace(/\D/g, '');
      mentions.push(user.idWhatsApp);

      const prefix = MEDALS[i] ?? `🔹 *${i + 1}.*`;
      const xpRaw  = Math.max(0, user.xp ?? 0);
      const xp     = xpRaw.toLocaleString('pt-BR');

      // Nível e progresso SEMPRE derivados do XP — sem dessincronia
      const level        = levelFromXp(xpRaw);
      const xpAnterior   = xpParaLevel(level);
      const xpProximo    = xpParaLevel(level + 1);
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

module.exports = { handleLevel, handleRankLevel };