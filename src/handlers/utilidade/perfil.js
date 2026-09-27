'use strict';

const path = require('path');
const fs   = require('fs');
const { fetchBuffer } = require(path.join(__dirname, '..', '..', 'fetchurl'));
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { ACESSORIOS_CASAL } = require('../diversao/acessoriosCasal');

const { resolveUsuarioInfo } = require(path.join(__dirname, '..', '..', 'utils', 'identity'));

const PET_EMOJIS = {
  tubarao: '🦈', dragao: '🐉', falcao: '🦅', leao: '🦁', tigre: '🐯',
  lobo: '🐺', urso: '🐻', macaco: '🐵', raposa: '🦊', coelho: '🐰',
  gato: '🐱', cachorro: '🐶', elefante: '🐘', girafa: '🦒', pinguim: '🐧',
  coruja: '🦉', fenix: '🔥', feneco: '🦝', leao_marinho: '🦭',
};

function extractNumber(jidStr) {
  if (!jidStr) return '';
  return jidStr.split('@')[0].split(':')[0];
}

function isLidJid(jidStr) {
  return jidStr?.endsWith('@lid');
}

async function handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos) {
  const contextInfo = content?.extendedTextMessage?.contextInfo
                    || msg?.message?.extendedTextMessage?.contextInfo;
  const mentions  = contextInfo?.mentionedJid || [];
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const alvoJid   = mentions[0] || contextInfo?.participant || senderJid;

  // Resolve informações completas do usuário (LID, PN, Telefone, Nome, Model Usuario)
  const userInfo = await resolveUsuarioInfo(alvoJid, sock, contactNames);
  const { resolvedJid, number, formattedNumber, nome, userData } = userInfo;

  const mentionsList = [];
  if (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) {
    mentionsList.push(resolvedJid);
  }

  let userGold = 0;
  let bankText = '❌ Sem investimento ativo';
  try {
    const carteira =
      await CarteiraGrupo.findOne({ idWhatsApp: resolvedJid, idGrupo: jid }) ||
      await CarteiraGrupo.findOne({ idWhatsApp: alvoJid,     idGrupo: jid }) ||
      (userInfo.lidJid ? await CarteiraGrupo.findOne({ idWhatsApp: userInfo.lidJid, idGrupo: jid }) : null);

    userGold = carteira?.gold ?? 0;
    const banco = carteira?.banco;
    if (banco?.amount > 0) {
      const msLeft = Math.max(0, new Date(banco.startDate).getTime() + 3 * 60 * 60 * 1000 - Date.now());
      const status = msLeft > 0
        ? `⏳ Faltam ${Math.ceil(msLeft / 60000)}min`
        : '✅ Pronto para resgatar!';
      bankText = `💳 ${banco.amount}g investido (${banco.interest}% juros)  ${status}`;
    }
  } catch {}

  const msgsRec = userData?.mensagens ?? (msgCount?.get?.(alvoJid)?.count ?? msgCount?.get?.(resolvedJid)?.count ?? 0);
  const cmdsRec = (cmdCount?.get?.(alvoJid) ?? cmdCount?.get?.(resolvedJid) ?? 0);
  const sticks  = (stickerCount?.get?.(alvoJid) ?? stickerCount?.get?.(resolvedJid) ?? 0);
  const total   = msgsRec + cmdsRec + sticks;
  const activity =
    total > 1000 ? '🔥 Hiperativo' :
    total > 500  ? '⚡ Ativo'      :
    total > 100  ? '😊 Participativo' : '📉 Calmo';

  let rankText = '';
  try {
    const ranks = [...(msgCount?.entries?.() ?? [])].sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0));
    const idx   = ranks.findIndex(([k]) => k === alvoJid || k === resolvedJid || (userInfo.lidJid && k === userInfo.lidJid));
    if (idx >= 0) rankText = `  ·  #${idx + 1} no grupo`;
  } catch {}

  let xp       = 0;
  let level    = 1;
  let xpNext   = 100;
  let xpPct    = 0;
  let xpBar    = '░'.repeat(10);

  try {
    const carteiraXp =
      await CarteiraGrupo.findOne({ idWhatsApp: resolvedJid, idGrupo: jid }) ||
      await CarteiraGrupo.findOne({ idWhatsApp: alvoJid,     idGrupo: jid }) ||
      (userInfo.lidJid ? await CarteiraGrupo.findOne({ idWhatsApp: userInfo.lidJid, idGrupo: jid }) : null);

    if (carteiraXp) {
      const prog = carteiraXp.getProgressoXp();
      xp      = prog.xp;
      level   = prog.level;
      xpNext  = prog.xpNecessario;
      xpPct   = prog.progresso;
      const barsOn = Math.floor(xpPct / 10);
      xpBar   = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);
    }
  } catch {}

  let isAdmin   = false;
  let groupName = '';
  if (jid.endsWith('@g.us')) {
    try { groupName = (await sock.groupMetadata(jid)).subject || ''; } catch {}
    try {
      const grupoHandler = require('../grupo');
      isAdmin = await grupoHandler.isAdmin(sock, jid, alvoJid);
    } catch {}
  }

  let missaoText = '';
  try {
    const { dailyMissionDefinitions, getTodayStr } = require('../diversao/missoes');
    const dm    = userData?.dailyMissions;
    const today = getTodayStr();
    if (dm && dm.date === today) {
      const concluidas = dailyMissionDefinitions.filter(m =>
        (dm.progress?.[m.id] || 0) >= m.target || dm.completed?.[m.id]
      ).length;
      const resgatadas = dailyMissionDefinitions.filter(m => dm.claimed?.[m.id]).length;
      missaoText = `${concluidas}/${dailyMissionDefinitions.length} concluídas  ·  ${resgatadas} resgatadas`;
    }
  } catch {}

  let petText = '❌ Sem pet';
  try {
    if (userData?.pet?.name) {
      const emoji = PET_EMOJIS[userData.pet.type] ?? '🐾';
      const hap   = userData.pet.happiness ?? 60;
      const mood  = hap >= 80 ? '😄' : hap >= 50 ? '😊' : '😔';
      petText = `${emoji} *${userData.pet.name}*  Lvl ${userData.pet.level || 1}  ${mood} ${hap}%`;
    }
  } catch {}

  let birthdayText = '';
  try {
    const dataPath = path.resolve(__dirname, '../../../data.json');
    if (fs.existsSync(dataPath)) {
      const dataFile = JSON.parse(fs.readFileSync(dataPath, 'utf8') || '{}');
      const bday     = dataFile?.birthdays?.[alvoJid]?.date;
      if (bday) {
        const [day, month, year] = bday.split('/');
        const today       = new Date();
        const next        = new Date(today.getFullYear(), Number(month) - 1, Number(day));
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const age       = next.getFullYear() - Number(year);
        const daysUntil = Math.ceil((next - today) / 86400000);
        birthdayText = `🎂 ${day}/${month}/${year}  ·  ${age} anos  ·  ${daysUntil === 0 ? '🥳 Hoje!' : `em ${daysUntil} dia(s)`}`;
      }
    }
  } catch {}

  let relStatus   = '💔 Solteiro(a)';
  let parceiroJid = null;
  try {
    if (relacionamentos) {
      for (const [k, v] of relacionamentos) {
        if (!k.startsWith(jid + '|')) continue;
        const ehA = v.jidA === resolvedJid || v.jidA === alvoJid;
        const ehB = v.jidB === resolvedJid || v.jidB === alvoJid;
        if (!ehA && !ehB) continue;

        parceiroJid = ehA ? v.jidB : v.jidA;
        relStatus = v.tipo === 'casamento'
          ? `💍 Casado(a) com @${extractNumber(parceiroJid)}`
          : `❤️ Namorando com @${extractNumber(parceiroJid)}`;
        break;
      }
    }

    if (relStatus === '💔 Solteiro(a)' && userData?.casadoCom) {
      parceiroJid = userData.casadoCom;
      if (!parceiroJid.includes('@')) parceiroJid = `${parceiroJid.split(':')[0]}@s.whatsapp.net`;
      relStatus = userData.casadoTipo === 'namoro'
        ? `❤️ Namorando com @${extractNumber(parceiroJid)}`
        : `💍 Casado(a) com @${extractNumber(parceiroJid)}`;
    }

    if (parceiroJid) mentionsList.push(parceiroJid);
  } catch {}

  let acessoriosText = '';
  try {
    const equipados = userData?.acessoriosCasal;
    if (equipados) {
      const ativos = [];
      for (const [key, info] of Object.entries(ACESSORIOS_CASAL)) {
        const isAtivo = typeof equipados.get === 'function' ? equipados.get(key) : equipados[key];
        if (isAtivo) ativos.push(`${info.emoji} ${info.nome}`);
      }
      if (ativos.length > 0) acessoriosText = ativos.join('  ');
    }
  } catch {}

  const bio = userData?.bio?.trim() || '';

  let picBuffer = null;
  try {
    const photoJid = (resolvedJid && resolvedJid.endsWith('@s.whatsapp.net')) ? resolvedJid : alvoJid;
    const url = await sock.profilePictureUrl(photoJid, 'image');
    if (url) picBuffer = await fetchBuffer(url);
  } catch {}

  const displayPhone = (number && number !== 'N/D')
    ? `@${number}` + (formattedNumber !== 'N/D' && formattedNumber !== `+${number}` ? ` (${formattedNumber})` : '')
    : 'N/D';

  const L = [
    `🔎 *PERFIL DO USUÁRIO* 🔎`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `👤 *Nome:* ${nome}`,
    `📞 *Número:* ${displayPhone}`,
  ];

  if (groupName)             L.push(`🏠 *Grupo:* ${groupName}`);
  if (jid.endsWith('@g.us')) L.push(`👑 *Admin:* ${isAdmin ? '✅ Sim' : '❌ Não'}`);
  if (bio)                   L.push(`📝 *Bio:* ${bio}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `📊 *ATIVIDADE*`,
    `💬 Mensagens: *${msgsRec}*${rankText}`,
    `🤖 Comandos:  *${cmdsRec}*`,
    `😄 Figurinhas: *${sticks}*`,
    `🔁 Total: *${total}*  ${activity}`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `⭐ *PROGRESSO*`,
    `🏅 Level *${level}*  ·  XP ${xp}/${xpNext} (${xpPct}%)`,
    `[${xpBar}]`,
  );

  if (missaoText) L.push(`🎯 Missões: ${missaoText}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `💰 *ECONOMIA*`,
    `👛 Carteira: *${userGold}g*`,
    `🏦 Banco: ${bankText}`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `🐾 *PET ATIVO*`,
    petText,
  );

  if (birthdayText) {
    L.push(`┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`, `🎂 *ANIVERSÁRIO*`, birthdayText);
  }

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `💑 *RELACIONAMENTO*`,
    relStatus,
  );

  if (acessoriosText) L.push(`💎 *Acessórios:* ${acessoriosText}`);

  L.push(
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `🤖 _Piroquinhas Bot_`,
  );

  const texto = L.join('\n');

  try {
    if (picBuffer) {
      await sock.sendMessage(jid, { image: picBuffer, caption: texto, mentions: mentionsList }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: texto, mentions: mentionsList }, { quoted: msg });
    }
  } catch (e) {
    console.error('⚠️ Erro ao enviar perfil:', e.message);
    try { await sock.sendMessage(jid, { text: texto, mentions: mentionsList }, { quoted: msg }); } catch {}
  }
}

async function handleBio(sock, msg, jid, caption) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const bio       = caption.replace(/^[!.,\/]bio\s*/i, '').trim();

  if (!bio) {
    await sock.sendMessage(jid, {
      text: '⚠️ Digite sua bio!\nExemplo: *!bio Amo jogar e ouvir música*\n\n_Máximo: 150 caracteres_',
    }, { quoted: msg });
    return;
  }

  if (bio.length > 150) {
    await sock.sendMessage(jid, {
      text: `⚠️ Bio muito longa (${bio.length}/150 caracteres). Resuma um pouco!`,
    }, { quoted: msg });
    return;
  }

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: senderJid },
      { $set: { bio } },
      { upsert: true }
    );

    await sock.sendMessage(jid, {
      text: `✅ *Bio atualizada!*\n\n📝 "${bio}"`,
    }, { quoted: msg });
  } catch (err) {
    console.error('⚠️ Erro ao salvar bio:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao salvar sua bio. Tente novamente.' }, { quoted: msg });
  }
}

module.exports = {
  handlePerfil,
  handleBio,
};
