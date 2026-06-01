async function handleFixar(sock, msg, content, jid, author, pinnedMessages, contactNames) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;
  const origSender = contextInfo?.participant || '';

  if (!quoted) {
    await sock.sendMessage(jid, {
      text: '❗ Responda a uma mensagem com *!fixar* para fixá-la.',
    }, { quoted: msg });
    return;
  }

  let origName = null;
  if (origSender) {
    origName = contactNames[origSender];
    if (!origName) {
      try {
        const info = await sock.onWhatsApp(origSender);
        if (info?.[0]) origName = info[0].notify || info[0].name || null;
      } catch {}
    }
    if (!origName) origName = origSender.split('@')[0];
  }

  let pinnedText = '';
  if (quoted.conversation) pinnedText = quoted.conversation;
  else if (quoted.extendedTextMessage?.text) pinnedText = quoted.extendedTextMessage.text;
  else if (quoted.imageMessage) pinnedText = '📷 <imagem>';
  else if (quoted.videoMessage) pinnedText = '🎬 <vídeo>';
  else if (quoted.stickerMessage) pinnedText = '😄 <figurinha>';
  else if (quoted.audioMessage) pinnedText = '🎵 <áudio>';
  else pinnedText = '<conteúdo>';

  pinnedMessages.set(jid, {
    text: pinnedText,
    by: author,
    time: Date.now(),
    orig: origSender,
  });

  const header = origName
    ? `📌 Mensagem de *${origName}* fixada por *${author}*:`
    : `📌 Mensagem fixada por *${author}*:`;

  await sock.sendMessage(jid, {
    text: `${header}\n\n${pinnedText}`,
    mentions: origSender ? [origSender] : [],
  }, { quoted: msg });
}

async function handlePinned(sock, msg, jid, pinnedMessages, contactNames) {
  const pm = pinnedMessages.get(jid);
  if (!pm) {
    await sock.sendMessage(jid, {
      text: 'ℹ️ Não há nenhuma mensagem fixada neste chat.',
    }, { quoted: msg });
    return;
  }

  const when = new Date(pm.time).toLocaleString('pt-BR');
  let header = `📌 *Fixada por ${pm.by} em ${when}:*`;
  if (pm.orig) {
    let name = contactNames[pm.orig];
    if (!name) {
      try {
        const info = await sock.onWhatsApp(pm.orig);
        if (info?.[0]) name = info[0].notify || info[0].name;
      } catch {}
    }
    header = `📌 *Msg de ${name || pm.orig.split('@')[0]}* | fixada por ${pm.by} em ${when}:`;
  }
  await sock.sendMessage(jid, { text: `${header}\n\n${pm.text}` }, { quoted: msg });
}

async function handleDesfixar(sock, msg, jid, pinnedMessages) {
  if (pinnedMessages.has(jid)) {
    pinnedMessages.delete(jid);
    await sock.sendMessage(jid, { text: '✅ Mensagem desfixada com sucesso!' }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: 'ℹ️ Não há mensagem fixada para desfixar.' }, { quoted: msg });
  }
}

module.exports = {
  handleFixar,
  handlePinned,
  handleDesfixar,
};
