'use strict';

const { normalizarJid } = require('../../utils/jid');

// ═══════════════════════════════════════════════════════════════
// ─── ESTADO GLOBAL COMPARTILHADO (em memória) ──────────────────
// ═══════════════════════════════════════════════════════════════

/** @type {Map<string, { ativo: boolean, mensagem: string }>} */
const bemVindoGroups = new Map();

function setBemVindo(jid, mensagem) {
  if (!mensagem || !mensagem.trim()) {
    bemVindoGroups.delete(jid);
  } else {
    bemVindoGroups.set(jid, { ativo: true, mensagem: mensagem.trim() });
  }
}

/**
 * Map<grupoJid, Set<userJid>> — isolado por grupo para evitar
 * que mutes de um grupo vazem para outro.
 * @type {Map<string, Set<string>>}
 */
const mutedUsers = new Map();

// ═══════════════════════════════════════════════════════════════
// ─── CACHE DE METADATA DE GRUPO ────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// Evita rate-limit do WhatsApp em grupos movimentados. TTL de 5 minutos;
// invalidado automaticamente por tempo (sem limpeza manual necessária).

if (!global._groupMetadataCache) global._groupMetadataCache = new Map();
const GROUP_METADATA_TTL_MS = 5 * 60 * 1000;

async function getGroupMetadataCached(sock, groupJid, forceRefresh = false) {
  const agora = Date.now();
  const cached = global._groupMetadataCache.get(groupJid);

  if (!forceRefresh && cached && (agora - cached.fetchedAt) < GROUP_METADATA_TTL_MS) {
    return cached.meta;
  }

  const meta = await sock.groupMetadata(groupJid);
  global._groupMetadataCache.set(groupJid, { meta, fetchedAt: agora });
  return meta;
}

// ═══════════════════════════════════════════════════════════════
// ─── IDENTIDADE / PERMISSÕES ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function isAdmin(sock, groupJid, userJid) {
  try {
    const meta = await getGroupMetadataCached(sock, groupJid);
    const part = meta.participants?.find(
      p => p.id === userJid || p.lid === userJid
    );
    return part?.admin === 'admin' || part?.admin === 'superadmin';
  } catch (err) {
    console.error('[isAdmin] Erro ao buscar metadata:', err.message);
    return false;
  }
}

/**
 * Normaliza um JID removendo sufixos de dispositivo.
 * Exemplos:
 *   "5511912345678:3@s.whatsapp.net" → "5511912345678"
 *   "5511912345678@s.whatsapp.net"   → "5511912345678"
 */
function normalizeJidBase(jid) {
  if (!jid || typeof jid !== 'string') return '';
  return jid.split(':')[0].split('@')[0].toLowerCase();
}

function isBotJid(jid, botJid) {
  if (!botJid || !jid) return false;
  return normalizeJidBase(jid) === normalizeJidBase(botJid);
}

/**
 * Resolve o JID do alvo a partir de menção direta ou reply.
 * Prioridade: menção (@tag) → reply (participant do quoted).
 * Tenta resolver @lid para @s.whatsapp.net quando possível.
 */
async function resolveTargetJid(sock, msg, content, jid) {
  const ctx               = content.extendedTextMessage?.contextInfo;
  const mentionedJid      = ctx?.mentionedJid || [];
  const quotedParticipant = ctx?.participant;

  // Sem menção → tenta reply
  if (mentionedJid.length === 0) {
    if (!quotedParticipant) return null;
    return normalizarJid(quotedParticipant) || quotedParticipant;
  }

  let rawJid = mentionedJid[0];

  // Resolve @lid → @s.whatsapp.net quando o grupo fornece o mapeamento
  if (rawJid.endsWith('@lid') && jid.endsWith('@g.us')) {
    try {
      const meta = await getGroupMetadataCached(sock, jid);
      const part = meta.participants?.find(
        p => p.id === rawJid || p.lid === rawJid
      );
      if (part?.id && !part.id.endsWith('@lid')) rawJid = part.id;
    } catch (err) {
      console.error('[resolveTargetJid] Erro ao resolver @lid:', err.message);
    }
  }

  return normalizarJid(rawJid) || rawJid;
}

function somenteGrupo(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

/**
 * Checa se o remetente é admin do grupo.
 * Se não for, envia aviso e retorna false.
 */
async function checkAdmin(sock, msg, jid, cmd = 'este comando') {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (!await isAdmin(sock, jid, senderJid)) {
    await sock.sendMessage(
      jid,
      { text: `❌ Apenas admins podem usar *!${cmd}*!` },
      { quoted: msg }
    );
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// ─── HELPERS DE MUTE (isolados por grupo) ─────────────────────
// ═══════════════════════════════════════════════════════════════

function isMuted(groupJid, userJid) {
  return mutedUsers.get(groupJid)?.has(userJid) ?? false;
}

function muteUser(groupJid, userJid) {
  if (!mutedUsers.has(groupJid)) mutedUsers.set(groupJid, new Set());
  mutedUsers.get(groupJid).add(userJid);
}

function unmuteUser(groupJid, userJid) {
  const s = mutedUsers.get(groupJid);
  if (!s) return false;
  const deleted = s.delete(userJid);
  if (s.size === 0) mutedUsers.delete(groupJid);
  return deleted;
}

function mutedCount(groupJid) {
  return mutedUsers.get(groupJid)?.size ?? 0;
}

function clearMuted(groupJid) {
  mutedUsers.delete(groupJid);
}

function getMutedSet(groupJid) {
  return new Set(mutedUsers.get(groupJid) ?? []);
}

module.exports = {
  bemVindoGroups,
  setBemVindo,

  getGroupMetadataCached,
  isAdmin,
  normalizeJidBase,
  isBotJid,
  resolveTargetJid,
  somenteGrupo,
  checkAdmin,

  isMuted,
  muteUser,
  unmuteUser,
  mutedCount,
  clearMuted,
  getMutedSet,
};
