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
  // O router.js desembrulha mensagens temporárias (ephemeralMessage) e de
  // visualização única (viewOnceMessage) antes de rotear qualquer comando,
  // mas aqui a leitura era feita direto em msg.message, sem esse desembrulho.
  // Em grupos com mensagens temporárias ativadas, o comando citando um áudio
  // simplesmente não encontrava o contextInfo (e portanto a mídia citada),
  // e nada visível acontecia.
  const content =
    msg.message?.ephemeralMessage?.message ||
    msg.message?.viewOnceMessage?.message  ||
    msg.message;
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

// ─── Runner Genérico de Mídia ────────────────────────────────────────────────
async function processMedia(sock, msg, jid, {
  mediaType = 'audio',
  ext = 'mp3',
  mimetype = 'audio/mpeg',
  ptt = false,
  configureFfmpeg,
}) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const buffer = await getMediaFromMsg(sock, msg, jid);
  if (!buffer) return;

  const tmpId = randomUUID();
  const inPath = path.join(tmpdir(), `${tmpId}_in.${ext}`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.${ext}`);

  try {
    await fs.promises.writeFile(inPath, buffer);

    await new Promise((resolve, reject) => {
      let command = ffmpeg(inPath);
      command = configureFfmpeg(command);
      command
        .output(outPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    const resultBuffer = await fs.promises.readFile(outPath);
    if (mediaType === 'video') {
      if (resultBuffer.length > 64 * 1024 * 1024) {
        await sock.sendMessage(jid, { text: '❌ Vídeo muito grande após processamento.' }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { video: resultBuffer, mimetype: 'video/mp4' }, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      }
    } else {
      await sock.sendMessage(jid, { audio: resultBuffer, mimetype, ptt }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    }
  } catch (err) {
    console.error(`[alteradores] Erro ao processar ${mediaType}:`, err.message);
    await sock.sendMessage(jid, { text: `❌ Erro ao processar ${mediaType}.` }, { quoted: msg });
  } finally {
    try { await fs.promises.unlink(inPath); } catch {}
    try { await fs.promises.unlink(outPath); } catch {}
  }
}

// ─── Handlers de Vídeo ────────────────────────────────────────────────────────

function handleVideoLento(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'video',
    ext: 'mp4',
    configureFfmpeg: (cmd) => cmd.videoFilter('setpts=2.0*PTS').audioFilter('atempo=0.5'),
  });
}

function handleVideoRapido(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'video',
    ext: 'mp4',
    configureFfmpeg: (cmd) => cmd.videoFilter('setpts=0.5*PTS').audioFilter('atempo=2.0'),
  });
}

function handleVideoContrario(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'video',
    ext: 'mp4',
    configureFfmpeg: (cmd) => cmd.videoFilter('reverse').audioFilter('areverse'),
  });
}

function handleReverseVideo(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'video',
    ext: 'mp4',
    configureFfmpeg: (cmd) => cmd.audioFilter('areverse'),
  });
}

// ─── Handlers de Áudio ────────────────────────────────────────────────────────

function handleAudioLento(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=0.5'),
  });
}

function handleAudioRapido(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=2'),
  });
}

function handleGrave(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('equalizer=f=100:width_type=h:width=50:g=-15').audioFilter('autovolume=clip=off'),
  });
}

function handleEsquilo(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=1.5,asetrate=44100*1.5'),
  });
}

function handleBass(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('equalizer=f=60:width_type=h:width=50:g=15'),
  });
}

function handleVozMenino(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=1.2,asetrate=44100*1.2'),
  });
}

function handleVozGrossa(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=0.8,asetrate=44100*0.8'),
  });
}

function handleVozMulher(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=1.15,asetrate=44100*1.15'),
  });
}

function handleAudioReverse(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('areverse'),
  });
}

function handleVozRobo(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('aecho=0.8:0.9:50:0.6'),
  });
}

function handleVozAlien(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('asetrate=44100*0.7,atempo=1.4'),
  });
}

function handleVozVelho(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=0.9,asetrate=44100*0.9,equalizer=f=200:width_type=h:width=50:g=-5'),
  });
}

function handleVozCrianca(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=1.3,asetrate=44100*1.3'),
  });
}

function handleVozDemonio(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('atempo=0.75,asetrate=44100*0.75,equalizer=f=60:width_type=h:width=50:g=12'),
  });
}

function handleEco(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('aecho=0.8:0.8:5:0.6'),
  });
}

function handleCaverna(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('aecho=0.8:0.9:100:0.7'),
  });
}

function handleTelefone(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('highpass=f=300,lowpass=f=3400'),
  });
}

function handleRadio(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('highpass=f=200,lowpass=f=4000,volume=0.8'),
  });
}

function handleMegafone(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('highpass=f=300,lowpass=f=5000,volume=1.5'),
  });
}

function handleUnderwater(sock, msg, jid) {
  return processMedia(sock, msg, jid, {
    mediaType: 'audio',
    ext: 'mp3',
    configureFfmpeg: (cmd) => cmd.audioFilter('lowpass=f=800,aecho=0.7:0.8:40:0.5'),
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