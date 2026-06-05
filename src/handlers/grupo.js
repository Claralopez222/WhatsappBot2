/**
 * Handler de Grupo — Piroquinhas Bot
 * Comandos: !ban, !mute, !desmute, !ranking, !sorteio, !enquete, !todos,
 *           !fechar, !abrir, !promover, !rebaixar, !tempo, !antilink,
 *           !autosticker, !reportar,
 *           [NOVOS] !grupinfo, !bemvindo, !linkgrupo, !apagarmsg,
 *                   !slowmode, !antiflood, !listaadm, !listamembros,
 *                   !avisar, !fixargrupo, !menuadm
 */

// ═══════════════════════════════════════════════════════════════
// ─── ESTADO GLOBAL ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const slowModeGroups  = new Map(); // jid → { segundos, lastMsg: Map<userJid, timestamp> }
const antiFloodGroups = new Map(); // jid → { limite, janela_ms, msgs: Map<userJid, number[]> }
const bemVindoGroups  = new Map(); // jid → { ativo: bool, mensagem: string }
const grupoAvisosMap  = new Map(); // jid → [avisos]

// ═══════════════════════════════════════════════════════════════
// ─── UTILS ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function isAdmin(sock, groupJid, userJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const part = meta.participants?.find(p => p.id === userJid || p.lid === userJid);
    return part?.admin === 'admin' || part?.admin === 'superadmin';
  } catch { return false; }
}

function normalizeJidBase(jid) {
  if (!jid || typeof jid !== 'string') return '';
  return jid.split(':')[0].split('@')[0].toLowerCase();
}

function isBotJid(jid, botJid) {
  if (!botJid || !jid) return false;
  return normalizeJidBase(jid) === normalizeJidBase(botJid);
}

async function isProtectedTarget(sock, groupJid, targetJid, botJid) {
  if (isBotJid(targetJid, botJid)) return true;
  return await isAdmin(sock, groupJid, targetJid);
}

async function resolveTargetJid(sock, msg, content, jid) {
  const mentionedJid = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quotedParticipant = content.extendedTextMessage?.contextInfo?.participant;
  if (mentionedJid.length === 0 && quotedParticipant) return quotedParticipant;
  if (mentionedJid.length === 0) return null;
  let rawJid = mentionedJid[0];
  if (rawJid.endsWith('@lid') && jid.endsWith('@g.us')) {
    try {
      const meta = await sock.groupMetadata(jid);
      const part = meta.participants?.find(p => p.id === rawJid || p.lid === rawJid);
      if (part?.id && !part.id.endsWith('@lid')) rawJid = part.id;
    } catch {}
  }
  return rawJid;
}

function somenteGrupo(jid) { return jid.endsWith('@g.us'); }

async function checkAdmin(sock, msg, jid, cmd = 'este comando') {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (!await isAdmin(sock, jid, senderJid)) {
    await sock.sendMessage(jid, { text: `❌ Apenas admins podem usar *!${cmd}*!` }, { quoted: msg });
    return false;
  }
  return true;
}

function formatarTempo(ms) {
  const dias   = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas  = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins   = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (dias > 0)  return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${mins}min`;
  return `${mins}min`;
}

// ═══════════════════════════════════════════════════════════════
// ─── !ban ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleBan(sock, msg, content, jid, botJid, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'ban')) return;

  const senderJid = msg.key.participant || msg.key.remoteJid;
  const textCmd   = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll     = /@all/.test(textCmd);

  if (isAll) {
    let meta;
    try { meta = await sock.groupMetadata(jid); } catch {
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg }); return;
    }
    const targets = meta.participants.filter(p =>
      !p.admin &&
      !isBotJid(p.id, botJid) &&
      p.id !== senderJid &&
      p.id?.split('@')[0] !== senderJid.split('@')[0]
    ).map(p => p.id);

    if (targets.length === 0) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhum membro não-admin para remover.' }, { quoted: msg }); return;
    }

    await sock.sendMessage(jid, { text: `🔨 *Removendo ${targets.length} membro(s)...*\n_Aguarde um momento._` }, { quoted: msg });
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i += 5) {
      const lote = targets.slice(i, i + 5);
      try { await sock.groupParticipantsUpdate(jid, lote, 'remove'); ok += lote.length; }
      catch {
        for (const t of lote) {
          try { await sock.groupParticipantsUpdate(jid, [t], 'remove'); ok++; }
          catch { fail++; }
        }
      }
      if (i + 5 < targets.length) await new Promise(r => setTimeout(r, 1500));
    }
    await sock.sendMessage(jid, {
      text: `✅ *Ban em massa concluído!*\n\n🔨 Removidos: *${ok}*${fail > 0 ? `\n❌ Falhas: *${fail}*` : ''}\n_(Admins e o bot foram preservados)_`,
    }, { quoted: msg });
    return;
  }

  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Marque alguém.\nExemplo: *!ban @fulano* ou *!ban @all*' }, { quoted: msg }); return;
  }
  if (await isProtectedTarget(sock, jid, targetJid, botJid)) {
    const text = isBotJid(targetJid, botJid)
      ? '🤖 Não é possível banir o bot!'
      : '👑 Não é possível banir um admin.';
    await sock.sendMessage(jid, { text }, { quoted: msg }); return;
  }
  try {
    await sock.groupParticipantsUpdate(jid, [targetJid], 'remove');
    const nome = contactNames[targetJid] || targetJid.split('@')[0];
    await sock.sendMessage(jid, {
      text: `🔨 *${nome}* foi banido(a) do grupo! Tchau! 👋`,
      mentions: [targetJid],
    });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui remover. O bot é admin?' }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !mute ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMute(sock, msg, content, jid, botJid, mutedUsers, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'mute')) return;

  const senderJid = msg.key.participant || msg.key.remoteJid;
  const textCmd   = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll     = /@all/.test(textCmd);

  if (isAll) {
    let meta;
    try { meta = await sock.groupMetadata(jid); } catch {
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg }); return;
    }
    const targets = meta.participants.filter(p =>
      !p.admin &&
      !isBotJid(p.id, botJid) &&
      p.id !== senderJid
    ).map(p => p.id);

    if (targets.length === 0) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhum membro não-admin para mutar.' }, { quoted: msg }); return;
    }
    for (const t of targets) mutedUsers.set(t, true);
    await sock.sendMessage(jid, {
      text: `🔇 *${targets.length} membro(s) mutados!*\n_Se falarem serão removidos em 20s._`,
    }, { quoted: msg });
    return;
  }

  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Marque alguém.\nExemplo: *!mute @fulano* ou *!mute @all*' }, { quoted: msg }); return;
  }
  if (await isProtectedTarget(sock, jid, targetJid, botJid)) {
    const text = isBotJid(targetJid, botJid)
      ? '🤖 Não é possível mutar o bot.'
      : '👑 Não é possível mutar um admin.';
    await sock.sendMessage(jid, { text }, { quoted: msg }); return;
  }
  mutedUsers.set(targetJid, true);
  const nome = contactNames[targetJid] || targetJid.split('@')[0];
  await sock.sendMessage(jid, {
    text: `🔇 *${nome}* foi mutado(a)!\n_Se falar será removido(a) em 20s._`,
    mentions: [targetJid],
  });
}

// ═══════════════════════════════════════════════════════════════
// ─── !desmute ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleDesmute(sock, msg, content, jid, botJid, mutedUsers, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'desmute')) return;

  const textCmd = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  const isAll   = /@all/.test(textCmd);

  if (isAll) {
    if (mutedUsers.size === 0) {
      await sock.sendMessage(jid, { text: 'ℹ️ Nenhum membro está mutado.' }, { quoted: msg }); return;
    }
    const count = mutedUsers.size;
    mutedUsers.clear();
    await sock.sendMessage(jid, { text: `🔊 *${count} membro(s) desmutados!* Podem falar! 🎤` }, { quoted: msg });
    return;
  }

  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Marque alguém.\nExemplo: *!desmute @fulano* ou *!desmute @all*' }, { quoted: msg }); return;
  }
  if (!mutedUsers.has(targetJid)) {
    const nome = contactNames[targetJid] || targetJid.split('@')[0];
    await sock.sendMessage(jid, { text: `ℹ️ *${nome}* não está mutado(a).` }, { quoted: msg }); return;
  }
  mutedUsers.delete(targetJid);
  const nome = contactNames[targetJid] || targetJid.split('@')[0];
  await sock.sendMessage(jid, {
    text: `🔊 *${nome}* foi desmutado(a)! Pode falar! 🎤`,
    mentions: [targetJid],
  });
}

// ═══════════════════════════════════════════════════════════════
// ─── !ranking ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRanking(sock, msg, jid, msgCount) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (msgCount.size === 0) {
    await sock.sendMessage(jid, { text: 'ℹ️ Ainda não há mensagens registradas!' }, { quoted: msg }); return;
  }

  const sorted  = [...msgCount.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const medals  = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const total   = [...msgCount.values()].reduce((s, v) => s + v.count, 0);
  const linhas  = sorted.map(([j, d], i) => {
    const pct = ((d.count / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(d.count / sorted[0][1].count * 8)) + '░'.repeat(8 - Math.round(d.count / sorted[0][1].count * 8));
    return `${medals[i]} *${d.nome || j.split('@')[0]}*\n   ${bar} ${d.count} msgs (${pct}%)`;
  }).join('\n\n');

  await sock.sendMessage(jid, {
    text: `📊 *RANKING DE MENSAGENS*\n\n${linhas}\n\n📨 Total do grupo: *${total} msgs*`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !sorteio ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleSorteio(sock, msg, content, jid, contactNames) {
  const mentions = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
  let participantes = mentions;

  if (participantes.length === 0 && somenteGrupo(jid)) {
    try {
      const meta = await sock.groupMetadata(jid);
      participantes = meta.participants.map(p => p.id);
    } catch {}
  }

  if (participantes.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Marque os participantes ou use em grupo!' }, { quoted: msg }); return;
  }

  // Animação de sorteio
  const suspense = `🎰 *SORTEANDO...*\n\nEntre *${participantes.length}* participante(s)...\n\n_Girando a roleta.._ 🌀`;
  await sock.sendMessage(jid, { text: suspense }, { quoted: msg });
  await new Promise(r => setTimeout(r, 1500));

  const vencedor = participantes[Math.floor(Math.random() * participantes.length)];
  const nome     = contactNames[vencedor] || vencedor.split('@')[0];

  await sock.sendMessage(jid, {
    text:
      `🎉🏆 *RESULTADO DO SORTEIO* 🏆🎉\n\n` +
      `👑 Vencedor: *@${vencedor.split('@')[0]}*\n\n` +
      `🎊 Parabéns, *${nome}*! Você foi sorteado(a) entre *${participantes.length}* participante(s)!\n\n` +
      `_Boa sorte foi você que teve!_ 🍀`,
    mentions: [vencedor],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !enquete ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEnquete(sock, msg, jid, caption) {
  const texto = caption.replace(/^[!.,\/]enquete\s*/i, '').trim();
  if (!texto) {
    await sock.sendMessage(jid, { text: '⚠️ Digite a pergunta!\nExemplo: *!enquete Pizza ou hambúrguer?*' }, { quoted: msg }); return;
  }

  // Verifica se há opções personalizadas (separadas por |)
  const partes = texto.split('|').map(p => p.trim()).filter(Boolean);
  let pergunta = partes[0];
  let opcoes   = partes.slice(1);

  let mensagem = `📊 *ENQUETE*\n\n❓ *${pergunta}*\n\n`;
  if (opcoes.length >= 2) {
    const emojisOpcoes = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];
    opcoes.slice(0, 6).forEach((op, i) => {
      mensagem += `${emojisOpcoes[i]} ${op}\n`;
    });
    mensagem += `\n_Reaja com os números acima para votar!_`;
  } else {
    mensagem += `Reaja com:\n👍 *Sim / A favor*\n👎 *Não / Contra*\n🤔 *Talvez / Neutro*\n\n_Todos podem votar!_`;
  }

  await sock.sendMessage(jid, { text: mensagem }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !todos ────────────────────────────────────════════════════
// ═══════════════════════════════════════════════════════════════

async function handleTodos(sock, msg, jid, caption) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'todos')) return;

  let meta;
  try { meta = await sock.groupMetadata(jid); } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar os membros.' }, { quoted: msg }); return;
  }

  const members = meta.participants.map(p => p.id);
  const texto   = caption.replace(/^[!.,\/]todos\s*/i, '').trim() || '📢 *Atenção galera!*';
  const mencoes = members.map(m => `@${m.split('@')[0]}`).join(' ');

  await sock.sendMessage(jid, {
    text: `${texto}\n\n${mencoes}`,
    mentions: members,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !fechar / !abrir ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleFecharAbrir(sock, msg, jid, fechar) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, fechar ? 'fechar' : 'abrir')) return;

  try {
    await sock.groupSettingUpdate(jid, fechar ? 'announcement' : 'not_announcement');
    await sock.sendMessage(jid, {
      text: fechar
        ? '🔒 *Grupo fechado!* Apenas admins podem enviar mensagens.'
        : '🔓 *Grupo aberto!* Todos podem enviar mensagens.',
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui alterar. O bot é admin?' }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !promover / !rebaixar ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handlePromoverRebaixar(sock, msg, content, jid, acao, botJid, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, acao === 'promote' ? 'promover' : 'rebaixar')) return;
  if (acao === 'demote') {
    await sock.sendMessage(jid, { text: '⚠️ Não é possível rebaixar o bot ou outros admins.' }, { quoted: msg }); return;
  }

  const textMsg = content.conversation || content.extendedTextMessage?.text || '';
  const isAll   = /@all\b/i.test(textMsg);

  if (isAll) {
    let meta;
    try { meta = await sock.groupMetadata(jid); } catch {
      await sock.sendMessage(jid, { text: '❌ Não consegui buscar membros.' }, { quoted: msg }); return;
    }
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const alvos = acao === 'promote'
      ? meta.participants.filter(p => !p.admin && !isBotJid(p.id, botJid)).map(p => p.id)
      : meta.participants.filter(p => p.admin && !isBotJid(p.id, botJid) && p.id !== senderJid).map(p => p.id);

    if (alvos.length === 0) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhum membro disponível para esta ação.' }, { quoted: msg }); return;
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    let ok = 0, fail = 0;
    for (let i = 0; i < alvos.length; i += 5) {
      const chunk = alvos.slice(i, i + 5);
      try { await sock.groupParticipantsUpdate(jid, chunk, acao); ok += chunk.length; }
      catch { fail += chunk.length; }
      if (i + 5 < alvos.length) await new Promise(r => setTimeout(r, 800));
    }
    const emoji = acao === 'promote' ? '⬆️' : '⬇️';
    await sock.sendMessage(jid, {
      text: `${emoji} *@all ${acao === 'promote' ? 'promovidos' : 'rebaixados'}!*\n✔️ *${ok}*${fail > 0 ? `\n❌ Falhas: *${fail}*` : ''}`,
    }, { quoted: msg });
    return;
  }

  const targetJid = await resolveTargetJid(sock, msg, content, jid);
  if (!targetJid) {
    await sock.sendMessage(jid, { text: '⚠️ Marque alguém ou use @all.' }, { quoted: msg }); return;
  }
  if (acao === 'demote' && isBotJid(targetJid, botJid)) {
    await sock.sendMessage(jid, { text: '🤖 Não é possível rebaixar o bot.' }, { quoted: msg }); return;
  }

  try {
    await sock.groupParticipantsUpdate(jid, [targetJid], acao);
    const nome = contactNames[targetJid] || targetJid.split('@')[0];
    await sock.sendMessage(jid, {
      text: acao === 'promote'
        ? `⬆️ *${nome}* foi promovido(a) a admin! 👑`
        : `⬇️ *${nome}* perdeu o admin! 📉`,
      mentions: [targetJid],
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui alterar. O bot é admin?' }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !tempo ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleTempo(sock, msg, content, jid, author, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }

  const contextInfo  = content.extendedTextMessage?.contextInfo;
  const mentionedJid = contextInfo?.mentionedJid || [];
  const senderJid    = msg.key.participant || msg.key.remoteJid;
  const alvoJid      = mentionedJid[0] || senderJid;
  const nomeAlvo     = mentionedJid[0] ? (contactNames[alvoJid] || alvoJid.split('@')[0]) : author;

  let entradaTexto = '❓ desconhecido';
  try {
    const meta     = await sock.groupMetadata(jid);
    const criadoMs = (meta.creation || 0) * 1000;
    const diffMs   = Date.now() - criadoMs;
    const dias     = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const meses    = Math.floor(dias / 30);
    const anos     = Math.floor(dias / 365);
    if (anos > 0)       entradaTexto = `há *${anos} ano${anos > 1 ? 's' : ''}*`;
    else if (meses > 0) entradaTexto = `há *${meses} ${meses > 1 ? 'meses' : 'mês'}*`;
    else if (dias > 0)  entradaTexto = `há *${dias} dia${dias > 1 ? 's' : ''}*`;
    else                entradaTexto = `há *menos de 1 dia*`;
  } catch {}

  const frases = [
    `⏳ *@${alvoJid.split('@')[0]}* está nesse grupo ${entradaTexto}. Veterano(a) resistente! 🏅`,
    `📅 *@${alvoJid.split('@')[0]}* aguentou esse grupo ${entradaTexto}. Tem moral! 💪`,
    `🕰️ *@${alvoJid.split('@')[0]}* sobrevive aqui ${entradaTexto}. Corajoso(a)! 😂`,
    `📌 *@${alvoJid.split('@')[0]}* faz parte desse grupo ${entradaTexto}. Fidelidade máxima! 🤝`,
  ];

  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !antilink ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAntiLink(sock, msg, content, jid, antiLinkGroups, saveData) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'antilink')) return;

  const textMsg = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  if      (textMsg.includes('on')  || textMsg.includes('ativ'))   { antiLinkGroups.add(jid);    saveData(); await sock.sendMessage(jid, { text: '🔗✅ *Anti-Link ATIVADO!*\n_Links serão deletados e o usuário removido._' }, { quoted: msg }); }
  else if (textMsg.includes('off') || textMsg.includes('desativ')) { antiLinkGroups.delete(jid); saveData(); await sock.sendMessage(jid, { text: '🔗❌ *Anti-Link DESATIVADO!*' }, { quoted: msg }); }
  else {
    const status = antiLinkGroups.has(jid) ? '✅ *Ativado*' : '❌ *Desativado*';
    await sock.sendMessage(jid, {
      text: `🔗 *Anti-Link* — ${status}\n\n▸ *!antilink on* → ativar\n▸ *!antilink off* → desativar`,
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !autosticker ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAutoSticker(sock, msg, content, jid, autoStickerGroups, saveData) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'autosticker')) return;

  const textMsg = (content.conversation || content.extendedTextMessage?.text || '').toLowerCase();
  if      (textMsg.includes('on')  || textMsg.includes('ativ'))   { autoStickerGroups.add(jid);    saveData(); await sock.sendMessage(jid, { text: '🖼️✅ *Auto-Sticker ATIVADO!*\n_Imagens/vídeos viran figurinhas automaticamente._' }, { quoted: msg }); }
  else if (textMsg.includes('off') || textMsg.includes('desativ')) { autoStickerGroups.delete(jid); saveData(); await sock.sendMessage(jid, { text: '🖼️❌ *Auto-Sticker DESATIVADO!*' }, { quoted: msg }); }
  else {
    const status = autoStickerGroups.has(jid) ? '✅ *Ativado*' : '❌ *Desativado*';
    await sock.sendMessage(jid, {
      text: `🖼️ *Auto-Sticker* — ${status}\n\n▸ *!autosticker on* → ativar\n▸ *!autosticker off* → desativar`,
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !reportar ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleReportar(sock, msg, content, jid, warnings, contactNames, saveData, botJid) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'reportar')) return;

  const quotedMsg    = content.extendedTextMessage?.contextInfo?.quotedMessage;
  const reportedJid  = content.extendedTextMessage?.contextInfo?.participant;

  if (!quotedMsg || !reportedJid) {
    await sock.sendMessage(jid, {
      text: '⚠️ Responda a uma mensagem com *!reportar* para advertir o usuário.',
    }, { quoted: msg }); return;
  }

  if (await isProtectedTarget(sock, jid, reportedJid, botJid)) {
    const text = isBotJid(reportedJid, botJid)
      ? '🤖 Não é possível reportar o bot.'
      : '👑 Não é possível reportar um admin.';
    await sock.sendMessage(jid, { text }, { quoted: msg }); return;
  }

  if (!warnings.has(jid)) warnings.set(jid, new Map());
  const groupWarnings = warnings.get(jid);
  const current = (groupWarnings.get(reportedJid) || 0) + 1;
  groupWarnings.set(reportedJid, current);
  saveData();

  const nome = contactNames[reportedJid] || reportedJid.split('@')[0];

  if (current >= 3) {
    try {
      await sock.groupParticipantsUpdate(jid, [reportedJid], 'remove');
      groupWarnings.delete(reportedJid);
      saveData();
      await sock.sendMessage(jid, {
        text: `🚫 *${nome}* foi removido(a)!\n\n_Motivo: 3 advertências acumuladas. Mereceu!_ 👋`,
        mentions: [reportedJid],
      });
    } catch (e) {
      await sock.sendMessage(jid, {
        text: `⚠️ *${nome}* chegou a 3 advertências mas não consegui remover.\n_O bot é admin?_`,
        mentions: [reportedJid],
      }, { quoted: msg });
    }
  } else {
    const remaining = 3 - current;
    const nivelEmoji = current === 1 ? '🟡' : current === 2 ? '🟠' : '🔴';
    const nivelLabel = current === 1 ? 'PRIMEIRA' : current === 2 ? 'SEGUNDA' : 'TERCEIRA';
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
// ─── NOVAS FUNÇÕES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ─── !grupinfo ────────────────────────────────────────────────
async function handleGrupInfo(sock, msg, jid) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }

  let meta;
  try { meta = await sock.groupMetadata(jid); } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar as informações do grupo.' }, { quoted: msg }); return;
  }

  const total    = meta.participants.length;
  const admins   = meta.participants.filter(p => p.admin).length;
  const membros  = total - admins;
  const criado   = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('pt-BR') : '?';
  const desc     = meta.desc || '_Sem descrição_';
  const fechado  = meta.announce ? '🔒 Fechado' : '🔓 Aberto';

  const slowCfg  = slowModeGroups.has(jid) ? `⏱️ *${slowModeGroups.get(jid).segundos}s*` : '❌ Inativo';
  const floodCfg = antiFloodGroups.has(jid) ? `✅ *${antiFloodGroups.get(jid).limite} msgs/${antiFloodGroups.get(jid).janela_ms / 1000}s*` : '❌ Inativo';

  await sock.sendMessage(jid, {
    text:
      `📋 *INFORMAÇÕES DO GRUPO*\n\n` +
      `📌 *Nome:* ${meta.subject}\n` +
      `📅 *Criado em:* ${criado}\n` +
      `🔑 *Status:* ${fechado}\n\n` +
      `👥 *Membros:* ${membros}\n` +
      `👑 *Admins:* ${admins}\n` +
      `📊 *Total:* ${total}\n\n` +
      `⏱️ *Slow Mode:* ${slowCfg}\n` +
      `🛡️ *Anti-Flood:* ${floodCfg}\n\n` +
      `📝 *Descrição:*\n${desc.slice(0, 200)}`,
  }, { quoted: msg });
}

// ─── !listaadm ────────────────────────────────────────────────
async function handleListaAdm(sock, msg, jid, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }

  let meta;
  try { meta = await sock.groupMetadata(jid); } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar os membros.' }, { quoted: msg }); return;
  }

  const admins = meta.participants.filter(p => p.admin);
  if (admins.length === 0) {
    await sock.sendMessage(jid, { text: 'ℹ️ Nenhum admin encontrado.' }, { quoted: msg }); return;
  }

  const linhas = admins.map((p, i) => {
    const nome  = contactNames[p.id] || p.id.split('@')[0];
    const tipo  = p.admin === 'superadmin' ? '👑 Dono' : '🛡️ Admin';
    return `${i + 1}. *${nome}* — ${tipo}`;
  }).join('\n');

  await sock.sendMessage(jid, {
    text: `👑 *LISTA DE ADMINS*\n\n${linhas}\n\n_Total: ${admins.length} admin(s)_`,
  }, { quoted: msg });
}

// ─── !listamembros ────────────────────────────────────────────
async function handleListaMembros(sock, msg, jid, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'listamembros')) return;

  let meta;
  try { meta = await sock.groupMetadata(jid); } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar os membros.' }, { quoted: msg }); return;
  }

  const membros  = meta.participants.filter(p => !p.admin);
  const total    = meta.participants.length;

  if (membros.length === 0) {
    await sock.sendMessage(jid, { text: 'ℹ️ Nenhum membro não-admin encontrado.' }, { quoted: msg }); return;
  }

  // Divide em partes de 30 para não ultrapassar limite de mensagem
  const MAX = 30;
  const chunks = [];
  for (let i = 0; i < membros.length; i += MAX) chunks.push(membros.slice(i, i + MAX));

  for (let ci = 0; ci < chunks.length; ci++) {
    const linhas = chunks[ci].map((p, i) => {
      const nome = contactNames[p.id] || p.id.split('@')[0];
      return `${ci * MAX + i + 1}. *${nome}* (+${p.id.split('@')[0]})`;
    }).join('\n');
    await sock.sendMessage(jid, {
      text: `👥 *LISTA DE MEMBROS* (${ci * MAX + 1}-${Math.min((ci + 1) * MAX, membros.length)} de ${total})\n\n${linhas}`,
    }, { quoted: msg });
    if (ci < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

// ─── !bemvindo ────────────────────────────────────────────────
async function handleBemVindo(sock, msg, jid, caption) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'bemvindo')) return;

  const args = caption.replace(/^[!.,\/]bemvindo\s*/i, '').trim();

  if (args === 'off' || args === 'desativar') {
    bemVindoGroups.delete(jid);
    await sock.sendMessage(jid, { text: '👋❌ *Mensagem de boas-vindas desativada!*' }, { quoted: msg });
    return;
  }

  if (args === 'status') {
    const cfg = bemVindoGroups.get(jid);
    if (!cfg || !cfg.ativo) {
      await sock.sendMessage(jid, { text: '👋 Boas-vindas: ❌ *Desativado*' }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text: `👋 Boas-vindas: ✅ *Ativado*\n\n_Mensagem atual:_\n${cfg.mensagem}`,
      }, { quoted: msg });
    }
    return;
  }

  const mensagem = args || `👋 Bem-vindo(a) ao grupo, {nome}! 🎉\n_Leia as regras e divirta-se!_`;
  bemVindoGroups.set(jid, { ativo: true, mensagem });
  await sock.sendMessage(jid, {
    text:
      `👋✅ *Boas-vindas ativado!*\n\n` +
      `_Mensagem:_\n${mensagem}\n\n` +
      `💡 Use *{nome}* para mencionar o novo membro.\n` +
      `Use *!bemvindo off* para desativar.`,
  }, { quoted: msg });
}

// ─── Handler interno de boas-vindas (chamado no bot.js) ───────
async function processarBemVindo(sock, jid, novoMembro, nomeDisplay) {
  const cfg = bemVindoGroups.get(jid);
  if (!cfg || !cfg.ativo) return;

  const mensagem = cfg.mensagem.replace('{nome}', `@${novoMembro.split('@')[0]}`);
  await sock.sendMessage(jid, {
    text: mensagem,
    mentions: [novoMembro],
  });
}

// ─── !linkgrupo ───────────────────────────────────────────────
async function handleLinkGrupo(sock, msg, jid) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'linkgrupo')) return;

  try {
    const code = await sock.groupInviteCode(jid);
    await sock.sendMessage(jid, {
      text: `🔗 *Link de convite do grupo:*\n\nhttps://chat.whatsapp.com/${code}\n\n⚠️ _Apenas admins podem ver o link. Compartilhe com cuidado!_`,
    }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui obter o link. O bot é admin?' }, { quoted: msg });
  }
}

// ─── !apagarmsg ───────────────────────────────────────────────
async function handleApagarMsg(sock, msg, content, jid) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'apagarmsg')) return;

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quotedKey   = contextInfo?.stanzaId;
  const quotedUser  = contextInfo?.participant;

  if (!quotedKey) {
    await sock.sendMessage(jid, { text: '⚠️ Responda a uma mensagem com *!apagarmsg* para deletá-la.' }, { quoted: msg }); return;
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
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui apagar a mensagem.' }, { quoted: msg });
  }
}

// ─── !slowmode ────────────────────────────────────────────────
async function handleSlowMode(sock, msg, jid, caption) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'slowmode')) return;

  const arg = caption.replace(/^[!.,\/]slowmode\s*/i, '').trim();

  if (arg === 'off' || arg === '0') {
    slowModeGroups.delete(jid);
    await sock.sendMessage(jid, { text: '⏱️❌ *Slow Mode desativado!*' }, { quoted: msg }); return;
  }

  const seg = parseInt(arg) || 0;
  if (seg < 1 || seg > 3600) {
    await sock.sendMessage(jid, {
      text: '⚠️ Informe o intervalo em segundos (1-3600).\nExemplo: *!slowmode 30* (1 msg a cada 30s)\nPara desativar: *!slowmode off*',
    }, { quoted: msg }); return;
  }

  slowModeGroups.set(jid, { segundos: seg, lastMsg: new Map() });
  await sock.sendMessage(jid, {
    text: `⏱️✅ *Slow Mode ativado!*\n_Intervalo: 1 mensagem a cada *${seg}s* por usuário._`,
  }, { quoted: msg });
}

// ─── Verificação de slow mode (chamar no bot.js antes de processar) ──
function verificarSlowMode(jid, userJid) {
  const cfg = slowModeGroups.get(jid);
  if (!cfg) return true; // sem slow mode
  const agora    = Date.now();
  const ultimo   = cfg.lastMsg.get(userJid) || 0;
  const intervalo = cfg.segundos * 1000;
  if (agora - ultimo < intervalo) return false; // bloqueado
  cfg.lastMsg.set(userJid, agora);
  return true; // permitido
}

// ─── !antiflood ───────────────────────────────────────────────
async function handleAntiFlood(sock, msg, jid, caption) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'antiflood')) return;

  const arg = caption.replace(/^[!.,\/]antiflood\s*/i, '').trim();

  if (arg === 'off') {
    antiFloodGroups.delete(jid);
    await sock.sendMessage(jid, { text: '🛡️❌ *Anti-Flood desativado!*' }, { quoted: msg }); return;
  }

  // Formato: !antiflood 5/10 (5 msgs em 10 segundos)
  const match = arg.match(/^(\d+)\/(\d+)$/);
  const limite  = match ? parseInt(match[1]) : 5;
  const janela  = match ? parseInt(match[2]) * 1000 : 10000;

  if (limite < 2 || limite > 50 || janela < 2000) {
    await sock.sendMessage(jid, {
      text: '⚠️ Formato: *!antiflood [msgs]/[segundos]*\nExemplo: *!antiflood 5/10* (max 5 msgs em 10s)\nPara desativar: *!antiflood off*',
    }, { quoted: msg }); return;
  }

  antiFloodGroups.set(jid, { limite, janela_ms: janela, msgs: new Map() });
  await sock.sendMessage(jid, {
    text: `🛡️✅ *Anti-Flood ativado!*\n_Limite: *${limite} msgs* a cada *${janela / 1000}s*._\n_Quem ultrapassar será removido!_`,
  }, { quoted: msg });
}

// ─── Verificação de anti-flood (retorna true = remover) ───────
async function verificarAntiFlood(sock, jid, userJid, botJid) {
  const cfg = antiFloodGroups.get(jid);
  if (!cfg) return false;
  if (await isAdmin(sock, jid, userJid).catch(() => false)) return false;
  if (isBotJid(userJid, botJid)) return false;

  const agora  = Date.now();
  const lista  = (cfg.msgs.get(userJid) || []).filter(t => agora - t < cfg.janela_ms);
  lista.push(agora);
  cfg.msgs.set(userJid, lista);

  return lista.length > cfg.limite;
}

// ─── !avisar ─────────────────────────────────────────────────
async function handleAvisar(sock, msg, jid, caption, contactNames) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'avisar')) return;

  const aviso = caption.replace(/^[!.,\/]avisar\s*/i, '').trim();
  if (!aviso) {
    await sock.sendMessage(jid, { text: '⚠️ Digite o aviso!\nExemplo: *!avisar Reunião hoje às 20h!*' }, { quoted: msg }); return;
  }

  // Guarda no histórico
  if (!grupoAvisosMap.has(jid)) grupoAvisosMap.set(jid, []);
  const lista = grupoAvisosMap.get(jid);
  lista.push({ texto: aviso, data: Date.now() });
  if (lista.length > 10) lista.shift(); // mantém só os 10 últimos

  let meta;
  let members = [];
  try { meta = await sock.groupMetadata(jid); members = meta.participants.map(p => p.id); } catch {}

  const mencoes = members.map(m => `@${m.split('@')[0]}`).join(' ');

  await sock.sendMessage(jid, {
    text:
      `📢 *AVISO DO GRUPO* 📢\n\n` +
      `${aviso}\n\n` +
      `${mencoes}`,
    mentions: members,
  }, { quoted: msg });
}

// ─── !fixargrupo ──────────────────────────────────────────────
async function handleFixarGrupo(sock, msg, content, jid, caption) {
  if (!somenteGrupo(jid)) { await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return; }
  if (!await checkAdmin(sock, msg, jid, 'fixargrupo')) return;

  const args = caption.replace(/^[!.,\/]fixargrupo\s*/i, '').trim();

  if (args === 'ver') {
    if (!grupoAvisosMap.has(jid) || grupoAvisosMap.get(jid).length === 0) {
      await sock.sendMessage(jid, { text: 'ℹ️ Nenhum aviso salvo.' }, { quoted: msg }); return;
    }
    const lista  = grupoAvisosMap.get(jid);
    const ultimo = lista[lista.length - 1];
    const data   = new Date(ultimo.data).toLocaleString('pt-BR');
    await sock.sendMessage(jid, {
      text: `📌 *AVISO FIXADO*\n\n${ultimo.texto}\n\n_Publicado em: ${data}_`,
    }, { quoted: msg });
    return;
  }

  // Fixa mensagem quoted
  const quotedMsg = content.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quotedMsg) {
    await sock.sendMessage(jid, {
      text: '⚠️ Responda uma mensagem com *!fixargrupo* para fixá-la.\nOu use *!fixargrupo ver* para ver o último aviso.',
    }, { quoted: msg }); return;
  }

  const texto = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '<mídia>';
  if (!grupoAvisosMap.has(jid)) grupoAvisosMap.set(jid, []);
  const lista = grupoAvisosMap.get(jid);
  lista.push({ texto, data: Date.now() });
  if (lista.length > 10) lista.shift();

  await sock.sendMessage(jid, {
    text: `📌 *Aviso fixado com sucesso!*\n\nUse *!fixargrupo ver* para visualizar a qualquer momento.`,
  }, { quoted: msg });
}

// ─── !menuadm ─────────────────────────────────────────────────
async function handleMenuAdm(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const menu =
    `🛡️ *MENU DE ADMINISTRAÇÃO* 🛡️\n\n` +
    `👤 *MEMBROS*\n` +
    `▸ ${P}ban @fulano — Banir membro\n` +
    `▸ ${P}ban @all — Banir todos não-admins\n` +
    `▸ ${P}mute @fulano — Mutar membro\n` +
    `▸ ${P}mute @all — Mutar todos\n` +
    `▸ ${P}desmute @fulano — Desmutar\n` +
    `▸ ${P}promover @fulano — Tornar admin\n` +
    `▸ ${P}rebaixar @fulano — Remover admin\n` +
    `▸ ${P}listamembros — Listar membros\n` +
    `▸ ${P}listaadm — Listar admins\n` +
    `▸ ${P}tempo @fulano — Tempo no grupo\n\n` +
    `📋 *GRUPO*\n` +
    `▸ ${P}grupinfo — Info do grupo\n` +
    `▸ ${P}fechar — Fechar grupo\n` +
    `▸ ${P}abrir — Abrir grupo\n` +
    `▸ ${P}linkgrupo — Link de convite\n` +
    `▸ ${P}todos [msg] — Mencionar todos\n` +
    `▸ ${P}enquete [pergunta] — Criar enquete\n` +
    `▸ ${P}sorteio [@membros] — Sortear\n\n` +
    `⚙️ *CONFIGURAÇÕES*\n` +
    `▸ ${P}antilink on/off — Anti-link\n` +
    `▸ ${P}autosticker on/off — Auto-sticker\n` +
    `▸ ${P}slowmode [seg] — Slow mode\n` +
    `▸ ${P}antiflood [n]/[seg] — Anti-flood\n` +
    `▸ ${P}bemvindo [msg] — Boas-vindas\n\n` +
    `🔔 *COMUNICAÇÃO*\n` +
    `▸ ${P}avisar [texto] — Avisar @todos\n` +
    `▸ ${P}fixargrupo — Fixar mensagem\n` +
    `▸ ${P}apagarmsg — Apagar mensagem\n` +
    `▸ ${P}reportar — Advertir (reply)\n` +
    `▸ ${P}ranking — Ranking de mensagens`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── EXPORTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Originais
  handleBan,
  handleMute,
  handleDesmute,
  handleRanking,
  handleSorteio,
  handleEnquete,
  handleTodos,
  handleFecharAbrir,
  handlePromoverRebaixar,
  handleTempo,
  handleAntiLink,
  handleAutoSticker,
  handleReportar,
  // Novos
  handleGrupInfo,
  handleListaAdm,
  handleListaMembros,
  handleBemVindo,
  handleLinkGrupo,
  handleApagarMsg,
  handleSlowMode,
  handleAntiFlood,
  handleAvisar,
  handleFixarGrupo,
  handleMenuAdm,
  // Helpers para bot.js
  processarBemVindo,
  verificarSlowMode,
  verificarAntiFlood,
  isAdmin,
};