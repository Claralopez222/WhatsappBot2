/**
 * Handler de Alteradores
 * Comandos: .videolento, .videorapido, .videocontrario, .reversevideo,
 *           .audiolento, .audiorapido, .grave, .esquilo, .bass, .vozmenino, .vozgrossa, .vozmulher, .audioreverse,
 *           .vozrobo, .vozalien, .vozvelho, .vozcrianca, .vozdemonio,
 *           .eco, .caverna, .telefone, .radio, .megafone, .underwater
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const fs = require('fs');
const { tmpdir } = require('os');
const { randomUUID } = require('crypto');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

let logger = { level: 'silent' };

function setLogger(newLogger) {
  logger = newLogger;
}

// ─── Helper: baixa mídia ──────────────────────────────────────────────────────
async function getMediaFromMsg(sock, msg, jid) {
  const content = msg.message;
  const contextInfo = content?.extendedTextMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;

  if (!quoted) {
    await sock.sendMessage(jid, { text: '⚠️ Responda a um *vídeo* ou *áudio*.' }, { quoted: msg });
    return null;
  }

  try {
    const buffer = await downloadMediaMessage(
      { key: { remoteJid: jid, id: contextInfo.stanzaId, fromMe: false, participant: contextInfo.participant }, message: quoted },
      'buffer',
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    return buffer;
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar mídia.' }, { quoted: msg });
    return null;
  }
}

// ─── Vídeo Lento ─────────────────────────────────────────────────────────────
async function handleVideoLento(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp4`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp4`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .setSpeed(0.5)
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          if (resultBuffer.length > 64 * 1024 * 1024) {
            await sock.sendMessage(jid, { text: '❌ Vídeo muito grande após processamento.' }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: resultBuffer, mimetype: 'video/mp4' }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
          }
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar vídeo.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar vídeo.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Vídeo Rápido ────────────────────────────────────────────────────────────
async function handleVideoRapido(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp4`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp4`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .setSpeed(2)
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          if (resultBuffer.length > 64 * 1024 * 1024) {
            await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: resultBuffer, mimetype: 'video/mp4' }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
          }
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar vídeo.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar vídeo.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Vídeo Contrário (Reversão) ───────────────────────────────────────────────
async function handleVideoContrario(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp4`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp4`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .videoFilter('reverse')
      .audioFilter('areverse')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          if (resultBuffer.length > 64 * 1024 * 1024) {
            await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: resultBuffer, mimetype: 'video/mp4' }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
          }
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar vídeo.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        console.log('Erro:', err);
        await sock.sendMessage(jid, { text: '❌ Erro ao processar vídeo.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Vídeo Reverse (apenas áudio reverso) ─────────────────────────────────────
async function handleReverseVideo(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp4`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp4`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('areverse')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          if (resultBuffer.length > 64 * 1024 * 1024) {
            await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: resultBuffer, mimetype: 'video/mp4' }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
          }
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar vídeo.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar vídeo.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Áudio Lento ─────────────────────────────────────────────────────────────
async function handleAudioLento(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=0.5')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Áudio Rápido ────────────────────────────────────────────────────────────
async function handleAudioRapido(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=2')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Áudio Grave (baixa frequência) ───────────────────────────────────────────
async function handleGrave(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('equalizer=f=100:width_type=h:width=50:g=-15')
      .audioFilter('autovolume=clip=off')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz de Esquilo ──────────────────────────────────────────────────────────
async function handleEsquilo(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=1.5,asetrate=44100*1.5')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Bass ────────────────────────────────────────────────────────────────────
async function handleBass(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('equalizer=f=60:width_type=h:width=50:g=15')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Menino ──────────────────────────────────────────────────────────────
async function handleVozMenino(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=1.2,asetrate=44100*1.2')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Grossa ──────────────────────────────────────────────────────────────
async function handleVozGrossa(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=0.8,asetrate=44100*0.8')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Mulher ──────────────────────────────────────────────────────────────
async function handleVozMulher(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=1.15,asetrate=44100*1.15')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Áudio Reverse ───────────────────────────────────────────────────────────
async function handleAudioReverse(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('areverse')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Robô ────────────────────────────────────────────────────────────────
async function handleVozRobo(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('aecho=0.8:0.9:50:0.6')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Alien ───────────────────────────────────────────────────────────────
async function handleVozAlien(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('asetrate=44100*0.7,atempo=1.4')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Velho ───────────────────────────────────────────────────────────────
async function handleVozVelho(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=0.9,asetrate=44100*0.9,equalizer=f=200:width_type=h:width=50:g=-5')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Criança ─────────────────────────────────────────────────────────────
async function handleVozCrianca(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=1.3,asetrate=44100*1.3')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Voz Demônio ─────────────────────────────────────────────────────────────
async function handleVozDemonio(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('atempo=0.75,asetrate=44100*0.75,equalizer=f=60:width_type=h:width=50:g=12')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Eco ──────────────────────────────────────────────────────────────────────
async function handleEco(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('aecho=0.8:0.8:5:0.6')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Caverna ──────────────────────────────────────────────────────────────────
async function handleCaverna(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('aecho=0.8:0.9:100:0.7')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Telefone ─────────────────────────────────────────────────────────────────
async function handleTelefone(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('highpass=f=300,lowpass=f=3400')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Rádio ────────────────────────────────────────────────────────────────────
async function handleRadio(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('highpass=f=200,lowpass=f=4000,volume=0.8')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Megafone ─────────────────────────────────────────────────────────────────
async function handleMegafone(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('highpass=f=300,lowpass=f=5000,volume=1.5')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

// ─── Underwater ───────────────────────────────────────────────────────────────
async function handleUnderwater(sock, msg, jid) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.mp3`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  fs.writeFileSync(inPath, buffer);

  return new Promise((resolve) => {
    ffmpeg(inPath)
      .audioFilter('lowpass=f=800,aecho=0.7:0.8:40:0.5')
      .output(outPath)
      .on('end', async () => {
        try {
          const resultBuffer = fs.readFileSync(outPath);
          await sock.sendMessage(jid, { audio: resultBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        } catch (e) {
          await sock.sendMessage(jid, { text: '❌ Erro ao enviar áudio.' }, { quoted: msg });
        } finally {
          try { fs.unlinkSync(inPath); } catch {}
          try { fs.unlinkSync(outPath); } catch {}
          resolve();
        }
      })
      .on('error', async (err) => {
        await sock.sendMessage(jid, { text: '❌ Erro ao processar áudio.' }, { quoted: msg });
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
        resolve();
      })
      .run();
  });
}

module.exports = {
  handleVideoLento,
  handleVideoRapido,
  handleVideoContrario,
  handleReverseVideo,
  handleAudioLento,
  handleAudioRapido,
  handleGrave,
  handleEsquilo,
  handleBass,
  handleVozMenino,
  handleVozGrossa,
  handleVozMulher,
  handleAudioReverse,
  handleVozRobo,
  handleVozAlien,
  handleVozVelho,
  handleVozCrianca,
  handleVozDemonio,
  handleEco,
  handleCaverna,
  handleTelefone,
  handleRadio,
  handleMegafone,
  handleUnderwater,
  setLogger,
};