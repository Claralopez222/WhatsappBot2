'use strict';

const fs   = require('fs');
const path = require('path');
const Usuario = require('../../models/Usuario');
const { normalizarJid } = require('../../utils/jid');

const {
  somenteGrupo,
  checkAdmin,
  isBotJid,
  normalizeJidBase,
  resolveTargetJid,
  muteUser,
  unmuteUser,
  isMuted,
  mutedCount,
  clearMuted,
} = require('./helpers');

const BAN_IMAGE_PATH = path.join(__dirname, '..', '..', '..', 'Audio-Image', 'imageban.jpg');
const BAN_AUDIO_PATH = path.join(__dirname, '..', '..', '..', 'Audio-Image', 'audioban.mp4');

// ═══════════════════════════════════════════════════════════════
// ─── !ban ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleBan(sock, msg, content, jid, botJid, contactNames) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg });
    return;
  }
  if (!await checkAdmin(sock, msg, jid, 'ban')) return;

  const senderJid  = msg.key.participant || msg.key.remoteJid;
  const senderBase = normalizeJidBase(senderJid);
  const textCmd    = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll      = /@all/.test(textCmd);

  // ── Ban em massa (@all) ────────────────────────────────────
  if (isAll) {
    let meta;
    try {
      meta = await sock.groupMetadata(jid);
    } catch (err) {
      console.error('[handleBan @all] Erro ao buscar metadata:', err.message);
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg });
      return;
    }

    const targets = meta.participants
      .filter(p => {
        if (isBotJid(p.id, botJid)) return false;
        const base    = normalizeJidBase(p.id);
        const baseLid = normalizeJidBase(p.lid || '');
        return base !== senderBase && baseLid !== senderBase;
      })
      .map(p => p.id);

    if (targets.length === 0) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhum membro para remover.' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, {
      text: `🔨 *Removendo ${targets.length} membro(s)...*\n_Aguarde um momento._`,
    }, { quoted: msg });

    let ok = 0, fail = 0;

    for (let i = 0; i < targets.length; i += 5) {
      const lote = targets.slice(i, i + 5);
      try {
        await sock.groupParticipantsUpdate(jid, lote, 'remove');
        ok += lote.length;
      } catch {
        for (const t of lote) {
          try {
            await sock.groupParticipantsUpdate(jid, [t], 'remove');
            ok++;
          } catch (err) {
            console.warn('[handleBan @all] Falha ao remover', t, err.message);
            fail++;
          }
        }
      }

      if (i + 5 < targets.length) await new Promise(r => setTimeout(r, 1500));
    }

    for (const t of targets) unmuteUser(jid, t);

    await sock.sendMessage(jid, {
      text:
        `✅ *Ban em massa concluído!*\n\n` +
        `🔨 Removidos: *${ok}*` +
        `${fail > 0 ? `\n❌ Falhas: *${fail}*` : ''}\n` +
        `_(O bot foi preservado)_`,
    }, { quoted: msg });
    return;
  }

  // ── Ban individual ─────────────────────────────────────────
  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém.\nExemplo: *!ban @fulano* ou *!ban @all*',
    }, { quoted: msg });
    return;
  }

  if (normalizeJidBase(targetJid) === senderBase) {
    await sock.sendMessage(jid, { text: '🤡 Você não pode banir a si mesmo.' }, { quoted: msg });
    return;
  }

  if (isBotJid(targetJid, botJid)) {
    await sock.sendMessage(jid, { text: '🤖 Não é possível banir o bot!' }, { quoted: msg });
    return;
  }

  try {
    const promises = [];

    if (fs.existsSync(BAN_IMAGE_PATH)) {
      promises.push(sock.sendMessage(jid, {
        image:    fs.readFileSync(BAN_IMAGE_PATH),
        caption:  `🔨 @${targetJid.split('@')[0]} foi banido(a) do grupo! Tchau! 👋`,
        mentions: [targetJid],
      }));
    }

    if (fs.existsSync(BAN_AUDIO_PATH)) {
      promises.push(sock.sendMessage(jid, {
        audio:    fs.readFileSync(BAN_AUDIO_PATH),
        mimetype: 'audio/mp4',
        ptt:      false,
      }));
    }

    await Promise.all(promises);
    await sock.groupParticipantsUpdate(jid, [targetJid], 'remove');
    unmuteUser(jid, targetJid);
  } catch (err) {
    console.error('[handleBan] Erro ao remover:', err.message);
    await sock.sendMessage(jid, {
      text: '❌ Não consegui remover. O bot é admin?',
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !mute ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMute(sock, msg, content, jid, botJid, contactNames) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg });
    return;
  }
  if (!await checkAdmin(sock, msg, jid, 'mute')) return;

  const senderJid  = msg.key.participant || msg.key.remoteJid;
  const senderBase = normalizeJidBase(senderJid);
  const textCmd    = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll      = /@all/.test(textCmd);

  // ── Mute em massa (@all) ───────────────────────────────────
  if (isAll) {
    let meta;
    try {
      meta = await sock.groupMetadata(jid);
    } catch (err) {
      console.error('[handleMute @all] Erro:', err.message);
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg });
      return;
    }

    const targets = meta.participants
      .filter(p => {
        if (isBotJid(p.id, botJid)) return false;
        const base    = normalizeJidBase(p.id);
        const baseLid = normalizeJidBase(p.lid || '');
        return base !== senderBase && baseLid !== senderBase;
      })
      .map(p => p.id);

    if (targets.length === 0) {
      await sock.sendMessage(jid, {
        text: '⚠️ Nenhum membro para mutar.',
      }, { quoted: msg });
      return;
    }

    for (const t of targets) muteUser(jid, t);

    await sock.sendMessage(jid, {
      text: `🔇 *${targets.length} membro(s) mutados!*\n_Se falarem serão removidos em 20s._`,
    }, { quoted: msg });
    return;
  }

  // ── Mute individual ────────────────────────────────────────
  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém.\nExemplo: *!mute @fulano* ou *!mute @all*',
    }, { quoted: msg });
    return;
  }

  if (isBotJid(targetJid, botJid)) {
    await sock.sendMessage(jid, { text: '🤖 Não é possível mutar o bot.' }, { quoted: msg });
    return;
  }

  const tag = `@${targetJid.split('@')[0]}`;

  if (isMuted(jid, targetJid)) {
    await sock.sendMessage(jid, {
      text: `ℹ️ *${tag}* já está mutado(a).`,
      mentions: [targetJid],
    }, { quoted: msg });
    return;
  }

  muteUser(jid, targetJid);

  await sock.sendMessage(jid, {
    text: `🔇 *${tag}* foi mutado(a)!\n_Se falar será removido(a) em 20s._`,
    mentions: [targetJid],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !desmute ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleDesmute(sock, msg, content, jid, botJid, contactNames) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg });
    return;
  }
  if (!await checkAdmin(sock, msg, jid, 'desmute')) return;

  const textCmd = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll   = /@all/.test(textCmd);

  // ── Desmute em massa (@all) ────────────────────────────────
  if (isAll) {
    const count = mutedCount(jid);
    if (count === 0) {
      await sock.sendMessage(jid, {
        text: 'ℹ️ Nenhum membro está mutado neste grupo.',
      }, { quoted: msg });
      return;
    }

    clearMuted(jid); // afeta apenas este grupo
    await sock.sendMessage(jid, {
      text: `🔊 *${count} membro(s) desmutados!* Podem falar! 🎤`,
    }, { quoted: msg });
    return;
  }

  // ── Desmute individual ─────────────────────────────────────
  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Marque alguém.\nExemplo: *!desmute @fulano* ou *!desmute @all*',
    }, { quoted: msg });
    return;
  }

  const nome = contactNames[targetJid] || targetJid.split('@')[0];

  if (!unmuteUser(jid, targetJid)) {
    await sock.sendMessage(jid, {
      text: `ℹ️ *${nome}* não está mutado(a) neste grupo.`,
    }, { quoted: msg });
    return;
  }

  // Cancela o timer de ban automático se existir
  if (global._muteTimers) {
    const chaveTimer = `mute:${jid}:${normalizarJid(targetJid)}`;
    const timer = global._muteTimers.get(chaveTimer);
    if (timer) {
      clearTimeout(timer);
      global._muteTimers.delete(chaveTimer);
    }
  }

  await sock.sendMessage(jid, {
    text: `🔊 *${nome}* foi desmutado(a)! Pode falar! 🎤`,
    mentions: [targetJid],
  });
}

// ═══════════════════════════════════════════════════════════════
// ─── !promover / !rebaixar ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handlePromoverRebaixar(sock, msg, content, jid, acao, botJid, contactNames) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return;
  }
  if (!await checkAdmin(sock, msg, jid, acao === 'promote' ? 'promover' : 'rebaixar')) return;

  const textMsg   = content.conversation || content.extendedTextMessage?.text || '';
  const isAll     = /@all\b/i.test(textMsg);
  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (isAll) {
    let meta;
    try {
      meta = await sock.groupMetadata(jid);
    } catch (err) {
      console.error('[handlePromoverRebaixar @all] Erro:', err.message);
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg }); return;
    }

    const alvos = acao === 'promote'
      ? meta.participants
          .filter(p => !p.admin && !isBotJid(p.id, botJid))
          .map(p => p.id)
      : meta.participants
          .filter(p =>
            p.admin &&
            !isBotJid(p.id, botJid) &&
            p.id !== senderJid
          )
          .map(p => p.id);

    if (alvos.length === 0) {
      await sock.sendMessage(jid, {
        text: '⚠️ Nenhum membro disponível para esta ação.',
      }, { quoted: msg }); return;
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    let ok = 0, fail = 0;
    for (let i = 0; i < alvos.length; i += 5) {
      const chunk = alvos.slice(i, i + 5);
      try {
        await sock.groupParticipantsUpdate(jid, chunk, acao);
        ok += chunk.length;
      } catch { fail += chunk.length; }
      if (i + 5 < alvos.length) await new Promise(r => setTimeout(r, 800));
    }

    const emoji = acao === 'promote' ? '⬆️' : '⬇️';
    await sock.sendMessage(jid, {
      text:
        `${emoji} *@all ${acao === 'promote' ? 'promovidos' : 'rebaixados'}!*\n` +
        `✔️ *${ok}*${fail > 0 ? `\n❌ Falhas: *${fail}*` : ''}`,
    }, { quoted: msg });
    return;
  }

  // ── Ação individual ────────────────────────────────────────
  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Marque alguém ou use @all.' }, { quoted: msg }); return;
  }

  // ─── Apenas o bot é protegido ────────────────────────────────
  if (isBotJid(targetJid, botJid)) {
    await sock.sendMessage(jid, {
      text: acao === 'promote'
        ? '🤖 O bot já cuida de si mesmo, obrigado!'
        : '🤖 Não é possível rebaixar o bot.',
    }, { quoted: msg }); return;
  }

  if (acao === 'demote' && targetJid === senderJid) {
    await sock.sendMessage(jid, { text: '🤡 Você não pode se rebaixar.' }, { quoted: msg }); return;
  }

  try {
    await sock.groupParticipantsUpdate(jid, [targetJid], acao);
    const nome = contactNames[targetJid] || targetJid.split('@')[0];
    await sock.sendMessage(jid, {
      text: acao === 'promote'
        ? `⬆️ *@${targetJid.split('@')[0]}* foi promovido(a) a admin! 👑`
        : `⬇️ *@${targetJid.split('@')[0]}* perdeu o admin! 📉`,
      mentions: [targetJid],
    }, { quoted: msg });
  } catch (err) {
    console.error('[handlePromoverRebaixar] Erro:', err.message);
    await sock.sendMessage(jid, { text: '❌ Não consegui alterar. O bot é admin?' }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !reportar ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleReportar(sock, msg, content, jid, contactNames, botJid) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return;
  }
  if (!await checkAdmin(sock, msg, jid, 'reportar')) return;

  const quotedMsg      = content.extendedTextMessage?.contextInfo?.quotedMessage;
  const reportedJidRaw = content.extendedTextMessage?.contextInfo?.participant;
  const reportedJid    = reportedJidRaw ? normalizarJid(reportedJidRaw) : null;

  if (!quotedMsg || !reportedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Responda a uma mensagem com *!reportar* para advertir o usuário.',
    }, { quoted: msg }); return;
  }

  const senderJid = normalizarJid(msg.key.participant || msg.key.remoteJid);
  if (reportedJid === senderJid) {
    await sock.sendMessage(jid, { text: '🤡 Você não pode se reportar.' }, { quoted: msg }); return;
  }

  // ─── Apenas o bot é protegido ────────────────────────────────
  if (isBotJid(reportedJid, botJid)) {
    await sock.sendMessage(jid, { text: '🤖 Não é possível reportar o bot.' }, { quoted: msg }); return;
  }

  // ─── Incrementa advertência no MongoDB ───────────────────────
  const groupKey = jid.replace(/\./g, '_');

  const usuario = await Usuario.findOneAndUpdate(
    { idWhatsApp: reportedJid },
    { $inc: { [`warnings.${groupKey}`]: 1 } },
    { upsert: true, new: true },
  );

  const current = usuario.warnings.get(groupKey) || 0;
  const nome    = contactNames[reportedJid] || reportedJid.split('@')[0];

  if (current >= 3) {
    try {
      await sock.groupParticipantsUpdate(jid, [reportedJid], 'remove');

      await Usuario.updateOne(
        { idWhatsApp: reportedJid },
        { $unset: { [`warnings.${groupKey}`]: '' } },
      );

      await sock.sendMessage(jid, {
        text: `🚫 *${nome}* foi removido(a)!\n\n_Motivo: 3 advertências acumuladas. Mereceu!_ 👋`,
        mentions: [reportedJid],
      });
    } catch (err) {
      console.error('[handleReportar] Erro ao remover:', err.message);
      await sock.sendMessage(jid, {
        text: `⚠️ *${nome}* chegou a 3 advertências mas não consegui remover.\n_O bot é admin?_`,
        mentions: [reportedJid],
      }, { quoted: msg });
    }
  } else {
    const remaining  = 3 - current;
    const nivelEmoji = current === 1 ? '🟡' : '🟠';
    const nivelLabel = current === 1 ? 'PRIMEIRA' : 'SEGUNDA';
    await sock.sendMessage(jid, {
      text:
        `⚠️ *ADVERTÊNCIA ${nivelLabel}* ⚠️\n\n` +
        `👤 Usuário: *@${reportedJid.split('@')[0]}*\n` +
        `${nivelEmoji} Advertências: *${current}/3*\n` +
        `⏳ Mais *${remaining}* para ser removido!\n\n` +
        `_Respeite as regras do grupo!_ 📜`,
      mentions: [reportedJid],
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !removerreporte ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRemoverReporte(sock, msg, content, jid, contactNames, botJid) {
  if (!somenteGrupo(jid)) {
    return sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg });
  }

  if (!await checkAdmin(sock, msg, jid, 'removerreporte')) return;

  const senderJid  = normalizarJid(msg.key.participant || msg.key.remoteJid);
  const senderBase = normalizeJidBase(senderJid);

  const targetJidRaw =
    content.extendedTextMessage?.contextInfo?.participant ??
    content.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ??
    null;
  const targetJid = targetJidRaw ? normalizarJid(targetJidRaw) : null;

  if (!targetJid) {
    return sock.sendMessage(jid, {
      text:
        '⚠️ Informe quem terá a advertência removida.\n' +
        '_Responda a uma mensagem ou mencione o usuário: *!removerreporte @pessoa*_',
    }, { quoted: msg });
  }

  if (normalizeJidBase(targetJid) === senderBase) {
    return sock.sendMessage(jid, {
      text: '🤡 Você não pode remover sua própria advertência. Peça a outro admin.',
    }, { quoted: msg });
  }

  if (isBotJid(targetJid, botJid)) {
    return sock.sendMessage(jid, {
      text: '🤖 O bot não possui advertências.',
    }, { quoted: msg });
  }

  const groupKey = jid.replace(/\./g, '_');
  const nome     = contactNames[targetJid] || targetJid.split('@')[0];

  const usuario = await Usuario.findOne({ idWhatsApp: targetJid }).lean();
  const atual   = Number(usuario?.warnings?.[groupKey] ?? 0);

  if (!usuario || atual <= 0) {
    return sock.sendMessage(jid, {
      text: `✅ *${nome}* não possui advertências neste grupo.`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  const novoValor = atual - 1;

  if (novoValor === 0) {
    await Usuario.updateOne(
      { idWhatsApp: targetJid },
      { $unset: { [`warnings.${groupKey}`]: '' } },
    );
  } else {
    await Usuario.updateOne(
      { idWhatsApp: targetJid },
      { $set: { [`warnings.${groupKey}`]: novoValor } },
    );
  }

  const nivelEmoji  = novoValor === 0 ? '🟢' : novoValor === 1 ? '🟡' : '🟠';
  const textoStatus = novoValor === 0
    ? `🎉 *${nome}* está limpo(a)! Sem advertências neste grupo.`
    : `${nivelEmoji} *${nome}* agora tem *${novoValor}/3* advertência(s).`;

  await sock.sendMessage(jid, {
    text:
      `✅ *ADVERTÊNCIA REMOVIDA*\n\n` +
      `👤 Usuário: *@${targetJid.split('@')[0]}*\n` +
      `📉 Era: *${atual}/3* → Agora: *${novoValor}/3*\n\n` +
      textoStatus,
    mentions: [targetJid],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !apagarmsg ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleApagarMsg(sock, msg, content, jid) {
  if (!jid.endsWith('@g.us')) {
    await sock.sendMessage(jid, { text: '⚠️ Este comando só funciona em grupos.' }, { quoted: msg });
    return;
  }
  if (!await checkAdmin(sock, msg, jid, 'apagarmsg')) return;

  const contextInfo = content?.extendedTextMessage?.contextInfo
                   || msg?.message?.extendedTextMessage?.contextInfo;

  const quotedKey  = contextInfo?.stanzaId;
  const quotedUser = contextInfo?.participant;

  if (!quotedKey) {
    await sock.sendMessage(jid, {
      text: '⚠️ Responda a uma mensagem com *!apagarmsg* para deletá-la.',
    }, { quoted: msg });
    return;
  }

  try {
    await sock.sendMessage(jid, {
      delete: {
        remoteJid:   jid,
        fromMe:      false,
        id:          quotedKey,
        participant: quotedUser,
      },
    });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (err) {
    console.error('[handleApagarMsg] Erro ao apagar mensagem:', err.message);
    await sock.sendMessage(jid, {
      text: '❌ Não consegui apagar a mensagem. Verifique se o bot é administrador.',
    }, { quoted: msg });
  }
}

module.exports = {
  handleBan,
  handleMute,
  handleDesmute,
  handlePromoverRebaixar,
  handleReportar,
  handleRemoverReporte,
  handleApagarMsg,
};