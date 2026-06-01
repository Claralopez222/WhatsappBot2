'use strict';

/**
 * Handler de Figurinhas — Piroquinhas Bot
 * Comandos: !s, !f, !desfig, !brat, !figtexto, !attp, !attp2,
 *           !toimg, !togif, !rename, !autorename, !delrename,
 *           !figaleatoria, !figgatos, !figemoji, !figroblox, !figmeme,
 *           !figanime, !figcoreana, !figraiva, !figengracada, !figdesenho,
 *           !fig, !pesquisafig, !qc, !qc2, !emojimix, !emoji, !menufig,
 *           !estourar
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp     = require('sharp');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const crypto    = require('crypto');
const { execFile } = require('child_process');

const {
  convertImageToSticker,
  convertVideoToSticker,
  convertBratSticker,
  convertTextoSticker,
} = require('../sticker');

const { fetchBuffer } = require('../fetchurl');

// ═══════════════════════════════════════════════════════════════
// ─── CONSTANTS ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const VIDEO_FPS      = 8;
const VIDEO_SIZE     = 384;
const VIDEO_QUALITY  = 25;
const VIDEO_MAX_FRAMES = 56;

// ─── Logger (substituível externamente) ──────────────────────
let logger = { level: 'silent' };
function setLogger(newLogger) { logger = newLogger; }

// ─── autoRename ───────────────────────────────────────────────
const autoRenameMap = new Map(); // jid → { pack, autor }

// ═══════════════════════════════════════════════════════════════
// ─── HELPER: detecta WebP animado pelo buffer ─────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta se um buffer é um WebP animado verificando a presença do
 * chunk ANIM na estrutura binária — independente do metadata do WhatsApp.
 *
 * O campo `stickerMessage.isAnimated` do Baileys é NÃO confiável:
 * vários clientes WhatsApp não o preenchem corretamente.
 * Esta função é a fonte de verdade para distinguir sticker de vídeo
 * de sticker de imagem.
 *
 * @param {Buffer} buf
 * @returns {boolean}
 */
function isAnimatedWebp(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return false;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return false;
  // Chunk ANIM só existe em WebP animados — busca nos primeiros 64 KB
  const limit = Math.min(buf.length - 4, 65536);
  for (let i = 12; i < limit; i++) {
    if (buf.toString('ascii', i, i + 4) === 'ANIM') return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// ─── HELPER: detecta extensão real do buffer ──────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta o formato de um buffer de vídeo/imagem pela sua assinatura binária.
 * @param {Buffer} buffer
 * @returns {'mp4'|'webm'|'gif'|'webp'|'mkv'}
 */
function detectExt(buffer) {
  if (!buffer || buffer.length < 12) return 'mp4';
  // MP4: ftyp box nos bytes 4–7
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return 'mp4';
  // WebM / MKV: EBML header
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return 'webm';
  // GIF: "GIF"
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  // WebP: RIFF....WEBP
  if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'webp';
  return 'mp4';
}

// ═══════════════════════════════════════════════════════════════
// ─── HELPER: vídeo/GIF → WebP animado (sticker) ──────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Converte um buffer de vídeo ou GIF em WebP animado via ffmpeg.
 * Usa parâmetros otimizados para mobile: 384px, 8fps, qualidade 25.
 *
 * @param {Buffer} inputBuffer
 * @param {string} [inputExt='mp4']
 * @returns {Promise<Buffer|null>} WebP animado, ou null em caso de falha.
 */
async function videoToStickerBuffer(inputBuffer, inputExt = 'mp4') {
  const ffmpegBin = require('ffmpeg-static');
  const tmpId     = crypto.randomUUID();
  const tmpDir    = os.tmpdir();
  const inPath    = path.join(tmpDir, `${tmpId}_in.${inputExt}`);
  const framesDir = path.join(tmpDir, `${tmpId}_frames`);
  const outPath   = path.join(tmpDir, `${tmpId}_out.webp`);

  /**
   * Executa ffmpeg com timeout e retorna Promise<boolean>.
   * @param {string[]} args
   * @param {number} [timeoutMs=60000]
   * @returns {Promise<boolean>}
   */
  function runFfmpeg(args, timeoutMs = 60_000) {
    return new Promise((resolve) => {
      execFile(ffmpegBin, args, { timeout: timeoutMs }, (err, _stdout, stderr) => {
        if (err) console.log('ffmpeg err:', stderr?.slice(-300));
        resolve(!err);
      });
    });
  }

  fs.writeFileSync(inPath, inputBuffer);
  fs.mkdirSync(framesDir, { recursive: true });

  try {
    // ─── Extração de frames ──────────────────────────────────
    const extractOk = await runFfmpeg([
      '-y', '-i', inPath,
      '-vf', `fps=${VIDEO_FPS},scale=${VIDEO_SIZE}:${VIDEO_SIZE}`,
      '-f', 'image2',
      path.join(framesDir, 'f_%04d.png'),
    ]);

    console.log(`🎬 FFmpeg extração: ${extractOk ? 'OK' : 'FALHA'}`);
    if (!extractOk) return null;

    const frameFiles = fs
      .readdirSync(framesDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .slice(0, VIDEO_MAX_FRAMES);

    console.log(`📹 Frames extraídos: ${frameFiles.length} (máx:${VIDEO_MAX_FRAMES}, fps:${VIDEO_FPS}, size:${VIDEO_SIZE}x${VIDEO_SIZE})`);
    if (frameFiles.length === 0) return null;

    // ─── Montagem do WebP animado ─────────────────────────────
    const webpOk = await runFfmpeg([
      '-y',
      '-framerate', String(VIDEO_FPS),
      '-i', path.join(framesDir, 'f_%04d.png'),
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-q:v', String(VIDEO_QUALITY),
      '-method', '6',
      '-loop', '0',
      '-preset', 'default',
      '-an', '-vsync', '0',
      '-f', 'webp',
      outPath,
    ]);

    if (!webpOk || !fs.existsSync(outPath)) return null;

    const result = fs.readFileSync(outPath);
    console.log(`✅ Sticker gerado: ${(result.length / 1024).toFixed(0)}KB (fps:${VIDEO_FPS} q:${VIDEO_QUALITY} frames:${frameFiles.length})`);
    return result;

  } finally {
    for (const p of [inPath, outPath]) {
      try { fs.unlinkSync(p); } catch { /* ignora */ }
    }
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* ignora */ }
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── HELPER: monta objeto quotedMsg para downloadMediaMessage ─
// ═══════════════════════════════════════════════════════════════

/**
 * Constrói o objeto de mensagem citada no formato esperado pelo Baileys.
 * @param {string} jid
 * @param {object} contextInfo
 * @param {object} quoted
 * @returns {object}
 */
function buildQuotedMsg(jid, contextInfo, quoted) {
  return {
    key: {
      remoteJid:   jid,
      id:          contextInfo.stanzaId,
      fromMe:      false,
      participant: contextInfo.participant,
    },
    message: quoted,
  };
}

// ═══════════════════════════════════════════════════════════════
// ─── !s / !f ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleSticker(sock, msg, content, jid, author, stickerCount) {
  const imageMsg = content.imageMessage;
  const videoMsg = content.videoMessage;

  if (imageMsg || videoMsg) {
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    await processMedia(sock, msg, content, jid, author, stickerCount);
    return true;
  }

  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted      = contextInfo?.quotedMessage;

  if (quoted) {
    const qImage = quoted.imageMessage;
    const qVideo = quoted.videoMessage;
    if (!qImage && !qVideo) {
      await sock.sendMessage(jid, { text: '⚠️ Responda a uma *imagem* ou *vídeo* com !s.' }, { quoted: msg });
      return false;
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
    await processMedia(sock, buildQuotedMsg(jid, contextInfo, quoted), quoted, jid, author, stickerCount);
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// ─── processMedia ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function processMedia(sock, msg, content, jid, author, stickerCount) {
  const imageMsg = content.imageMessage;
  const videoMsg = content.videoMessage;
  if (!imageMsg && !videoMsg) return;

  let buffer;
  try {
    buffer = await downloadMediaMessage(
      msg, 'buffer', {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não consegui baixar a mídia. Tente reenviar.' }, { quoted: msg });
    return;
  }

  if (!buffer || buffer.length === 0) {
    await sock.sendMessage(jid, { text: '❌ Mídia vazia. Tente reenviar.' }, { quoted: msg });
    return;
  }

  const senderJid = msg.key.participant || msg.key.remoteJid;
  let sticker = null;

  if (videoMsg) {
    const durSec = videoMsg.seconds || 0;
    if (durSec > 7) {
      await sock.sendMessage(jid, {
        text: `⚠️ Vídeo com *${durSec}s* detectado!\n_O máximo suportado é *7 segundos*._\n🎬 Usando apenas os primeiros 7s...`,
      }, { quoted: msg });
    }

    try {
      sticker = await videoToStickerBuffer(buffer, detectExt(buffer));
      if (!sticker || sticker.length < 100) {
        console.log('⚠️ Tentando fallback convertVideoToSticker...');
        sticker = await convertVideoToSticker(buffer);
      }
    } catch (e) {
      console.log('❌ Erro sticker vídeo:', e.message);
      try {
        sticker = await convertVideoToSticker(buffer);
      } catch {
        await sock.sendMessage(jid, {
          text: '❌ Não consegui converter o vídeo para figurinha.\n_Tente com um vídeo mais curto (máx 7s)._',
        }, { quoted: msg });
        return;
      }
    }
  } else {
    try {
      sticker = await convertImageToSticker(buffer);
    } catch (e) {
      console.log('⚠️ Tentativa 1 falhou, normalizando imagem...', e.message);
      try {
        const normalized = await sharp(buffer)
          .rotate()
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .resize(384, 384, { fit: 'fill' })
          .webp({ quality: 85 })
          .toBuffer();
        sticker = await convertImageToSticker(normalized);
      } catch {
        await sock.sendMessage(jid, { text: '❌ Erro ao converter imagem. Tente outro arquivo.' }, { quoted: msg });
        return;
      }
    }
  }

  if (!sticker || sticker.length < 100) {
    await sock.sendMessage(jid, { text: '❌ Não consegui gerar a figurinha. Tente outro arquivo.' }, { quoted: msg });
    return;
  }

  if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);

  try {
    await sock.sendMessage(jid, { sticker });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.log('❌ Erro ao enviar sticker:', e.message);
    await sock.sendMessage(jid, { text: '❌ Não consegui enviar a figurinha.' }, { quoted: msg });
  }

  console.log(`✅ Figurinha enviada! (${(sticker.length / 1024).toFixed(0)}KB)`);
}

// ═══════════════════════════════════════════════════════════════
// ─── !desfig / !toimg ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleDesfig(sock, msg, content, jid) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted      = contextInfo?.quotedMessage;

  if (!quoted?.stickerMessage) {
    await sock.sendMessage(jid, { text: '⚠️ Responda a uma *figurinha* com !desfig.' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const buffer = await downloadMediaMessage(
    buildQuotedMsg(jid, contextInfo, quoted),
    'buffer', {},
    { logger, reuploadRequest: sock.updateMediaMessage }
  );

  // ✅ FIX: NÃO confiar no campo isAnimated do metadata — alguns clientes
  // WhatsApp não o enviam corretamente. Detectamos direto no buffer.
  const isAnimated = isAnimatedWebp(buffer);
  console.log(`🔍 desfig: isAnimated(metadata)=${quoted.stickerMessage.isAnimated} | isAnimated(buffer)=${isAnimated}`);

  if (isAnimated) {
    // O ffmpeg-static não consegue ler WebP animado diretamente como input.
    // Solução: extrair cada frame com sharp (que suporta WebP animado nativamente)
    // e montar o MP4 a partir dos PNGs — igual ao pipeline do videoToStickerBuffer.
    const ffmpegBin = require('ffmpeg-static');
    const tmpId     = crypto.randomUUID();
    const framesDir = path.join(os.tmpdir(), `${tmpId}_frames`);
    const outPath   = path.join(os.tmpdir(), `${tmpId}_out.mp4`);

    fs.mkdirSync(framesDir, { recursive: true });

    let frameCount = 0;
    try {
      // sharp lê todas as páginas (frames) de um WebP animado com { pages: -1 }
      const img   = sharp(buffer, { animated: true });
      const meta  = await img.metadata();
      const pages = meta.pages || 1;

      for (let i = 0; i < pages; i++) {
        const frameBuf = await sharp(buffer, { animated: false, page: i })
          .resize(512, 512, { fit: 'fill' })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`), frameBuf);
        frameCount++;
      }
    } catch (e) {
      console.log('❌ desfig sharp extract err:', e.message);
      try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
      await sock.sendMessage(jid, { text: '⚠️ Não consegui extrair os frames dessa figurinha.' }, { quoted: msg });
      return;
    }

    console.log(`📹 desfig: ${frameCount} frames extraídos via sharp`);

    const ok = await new Promise((resolve) => {
      execFile(ffmpegBin, [
        '-y',
        '-framerate', String(VIDEO_FPS),
        '-i', path.join(framesDir, 'f_%04d.png'),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outPath,
      ], { timeout: 30000 }, (err, _, stderr) => {
        if (err) console.log('❌ desfig mp4 err:', stderr?.slice(-500));
        resolve(!err);
      });
    });

    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* ignora */ }

    if (!ok || !fs.existsSync(outPath)) {
      await sock.sendMessage(jid, { text: '⚠️ Não consegui montar o vídeo da figurinha.' }, { quoted: msg });
      return;
    }

    const videoBuffer = fs.readFileSync(outPath);
    try { fs.unlinkSync(outPath); } catch { /* ignora */ }

    await sock.sendMessage(jid, {
      video: videoBuffer, mimetype: 'video/mp4', caption: '🎬 Vídeo da figurinha!',
    }, { quoted: msg });

  } else {
    const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    await sock.sendMessage(jid, {
      image: jpegBuffer, mimetype: 'image/jpeg', caption: '🖼️ Imagem da figurinha!',
    }, { quoted: msg });
  }
}

async function handleToImg(sock, msg, content, jid) {
  return handleDesfig(sock, msg, content, jid);
}

// ═══════════════════════════════════════════════════════════════
// ─── !togif ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleToGif(sock, msg, content, jid) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted      = contextInfo?.quotedMessage;

  if (!quoted?.stickerMessage) {
    await sock.sendMessage(jid, { text: '⚠️ Responda a uma *figurinha animada* com !togif.' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const buffer = await downloadMediaMessage(
    buildQuotedMsg(jid, contextInfo, quoted),
    'buffer', {},
    { logger, reuploadRequest: sock.updateMediaMessage }
  );

  // ✅ FIX: detecta animação pelo buffer, não pelo metadata
  if (!isAnimatedWebp(buffer)) {
    await sock.sendMessage(jid, { text: '⚠️ Essa figurinha não é animada.' }, { quoted: msg });
    return;
  }

  const ffmpegBin = require('ffmpeg-static');
  const tmpId     = crypto.randomUUID();
  const framesDir = path.join(os.tmpdir(), `${tmpId}_frames`);
  const outPath   = path.join(os.tmpdir(), `${tmpId}_out.gif`);

  fs.mkdirSync(framesDir, { recursive: true });

  let frameCount = 0;
  try {
    const meta  = await sharp(buffer, { animated: true }).metadata();
    const pages = meta.pages || 1;
    for (let i = 0; i < pages; i++) {
      const frameBuf = await sharp(buffer, { animated: false, page: i })
        .resize(384, 384, { fit: 'fill' })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`), frameBuf);
      frameCount++;
    }
  } catch (e) {
    console.log('❌ togif sharp extract err:', e.message);
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    await sock.sendMessage(jid, { text: '❌ Não consegui extrair os frames dessa figurinha.' }, { quoted: msg });
    return;
  }

  const ok = await new Promise((resolve) => {
    execFile(ffmpegBin, [
      '-y',
      '-framerate', String(VIDEO_FPS),
      '-i', path.join(framesDir, 'f_%04d.png'),
      '-vf', `fps=${VIDEO_FPS},scale=384:-1:flags=lanczos`,
      outPath,
    ], { timeout: 30000 }, (err) => resolve(!err));
  });

  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* ignora */ }

  if (!ok || !fs.existsSync(outPath)) {
    await sock.sendMessage(jid, { text: '❌ Não consegui converter para GIF.' }, { quoted: msg });
    return;
  }

  const gifBuf = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch { /* ignora */ }

  await sock.sendMessage(jid, {
    video: gifBuf, mimetype: 'video/mp4', gifPlayback: true, caption: '🎞️ GIF da figurinha!',
  }, { quoted: msg });
}

// (comando !roubar removido)

// ═══════════════════════════════════════════════════════════════
// ─── !rename / !autorename / !delrename ───────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRename(sock, msg, content, jid, caption, stickerCount) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted      = contextInfo?.quotedMessage;

  if (!quoted?.stickerMessage) {
    await sock.sendMessage(jid, { text: '⚠️ Responda a uma *figurinha* com !rename pack/autor' }, { quoted: msg });
    return;
  }

  const args  = caption.replace(/^[!.,\/]rename\s*/i, '').trim().split('/');
  const pack  = args[0]?.trim() || 'Piroquinhas';
  const autor = args[1]?.trim() || 'Bot';

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const buffer    = await downloadMediaMessage(
    buildQuotedMsg(jid, contextInfo, quoted),
    'buffer', {},
    { logger, reuploadRequest: sock.updateMediaMessage }
  );
  const sticker   = await convertImageToSticker(buffer);
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
  await sock.sendMessage(jid, { sticker });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleAutoRename(sock, msg, jid, caption) {
  const args  = caption.replace(/^[!.,\/]autorename\s*/i, '').trim().split('/');
  const pack  = args[0]?.trim();
  const autor = args[1]?.trim();

  if (!pack && !autor) {
    await sock.sendMessage(jid, { text: '⚠️ Use: *!autorename pack/autor*\nEx: *!autorename Memes/BotTop*' }, { quoted: msg });
    return;
  }

  autoRenameMap.set(jid, { pack: pack || 'Piroquinhas', autor: autor || 'Bot' });
  await sock.sendMessage(jid, {
    text: `✅ AutoRename configurado!\n📦 Pack: *${pack || 'Piroquinhas'}*\n👤 Autor: *${autor || 'Bot'}*`,
  }, { quoted: msg });
}

async function handleDelRename(sock, msg, jid) {
  autoRenameMap.delete(jid);
  await sock.sendMessage(jid, { text: '✅ AutoRename removido! Voltando ao padrão.' }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !estourar ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEstourar(sock, msg, content, jid) {
  const contextInfo = content.extendedTextMessage?.contextInfo;
  const quoted      = contextInfo?.quotedMessage;
  const textMsg     = content.conversation || content.extendedTextMessage?.text || '';

  if (!quoted?.audioMessage) {
    await sock.sendMessage(jid, {
      text: '⚠️ Responda a um *áudio* com !estourar.\nEx: *!estourar 80* _(padrão: 20x | máx: 100)_',
    }, { quoted: msg });
    return;
  }

  const match  = textMsg.match(/estourar\s+(\d+)/i);
  const volume = Math.max(1, Math.min(100, match ? parseInt(match[1]) : 20));

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const audioBuffer = await downloadMediaMessage(
    buildQuotedMsg(jid, contextInfo, quoted),
    'buffer', {},
    { logger, reuploadRequest: sock.updateMediaMessage }
  );

  const ffmpegBin = require('ffmpeg-static');
  const tmpId     = crypto.randomUUID();
  const inPath    = path.join(os.tmpdir(), `${tmpId}_in.ogg`);
  const outPath   = path.join(os.tmpdir(), `${tmpId}_out.ogg`);

  fs.writeFileSync(inPath, audioBuffer);

  const ok = await new Promise((resolve) => {
    execFile(ffmpegBin, [
      '-y', '-i', inPath,
      '-filter:a', `volume=${volume}`,
      '-c:a', 'libopus', '-b:a', '64k',
      outPath,
    ], { timeout: 30000 }, (err) => resolve(!err));
  });

  try { fs.unlinkSync(inPath); } catch { /* ignora */ }

  if (!ok || !fs.existsSync(outPath)) {
    await sock.sendMessage(jid, { text: '❌ Erro ao processar o áudio.' }, { quoted: msg });
    return;
  }

  const outBuffer = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch { /* ignora */ }

  await sock.sendMessage(jid, { audio: outBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ═══════════════════════════════════════════════════════════════
// ─── !brat / !figtexto ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleBrat(sock, msg, jid, caption, getPrefix, stickerCount) {
  const P    = getPrefix(jid);
  const text = caption.replace(/^[!.,\/]brat\s*/i, '').trim();

  if (!text) {
    await sock.sendMessage(jid, { text: `⚠️ Digite um texto!\nEx: *${P}brat seu texto aqui*` }, { quoted: msg });
    return false;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const sticker   = await convertBratSticker(text);
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
  await sock.sendMessage(jid, { sticker });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  return true;
}

async function handleFigtexto(sock, msg, jid, caption, getPrefix, stickerCount) {
  const P    = getPrefix(jid);
  const text = caption.replace(/^[!.,\/]figtexto\s*/i, '').trim();

  if (!text) {
    await sock.sendMessage(jid, { text: `⚠️ Digite um texto!\nEx: *${P}figtexto seu texto aqui*` }, { quoted: msg });
    return false;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const sticker   = await convertTextoSticker(text);
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
  await sock.sendMessage(jid, { sticker });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  return true;
}

// ═══════════════════════════════════════════════════════════════
// ─── !attp / !attp2 ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAttp(sock, msg, jid, caption, getPrefix, stickerCount, versao = 1) {
  const P   = getPrefix(jid);
  const cmd = versao === 2 ? 'attp2' : 'attp';
  const text = caption.replace(new RegExp(`^[!.,\/]${cmd}\\s*`, 'i'), '').trim();

  if (!text) {
    await sock.sendMessage(jid, { text: `⚠️ Digite um texto!\nEx: *${P}${cmd} Olá mundo*` }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const url = versao === 1
      ? `https://api.lolhuman.xyz/api/textsticker?apikey=galanggg&text=${encodeURIComponent(text)}`
      : `https://api.lolhuman.xyz/api/textsticker2?apikey=galanggg&text=${encodeURIComponent(text)}`;
    const buf       = await fetchBuffer(url);
    const senderJid = msg.key.participant || msg.key.remoteJid;
    if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
    await sock.sendMessage(jid, { sticker: buf });
  } catch {
    // Fallback para figtexto local
    await handleFigtexto(sock, msg, jid,
      caption.replace(new RegExp(`^[!.,\/]${cmd}`, 'i'), '!figtexto'),
      getPrefix, stickerCount);
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !qc / !qc2 ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleQc(sock, msg, jid, caption, getPrefix, stickerCount, versao = 1) {
  const P   = getPrefix(jid);
  const cmd = versao === 2 ? 'qc2' : 'qc';
  const text = caption.replace(new RegExp(`^[!.,\/]${cmd}\\s*`, 'i'), '').trim();

  if (!text) {
    await sock.sendMessage(jid, { text: `⚠️ Digite um texto!\nEx: *${P}${cmd} Frase aqui*` }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const bgColor  = versao === 1 ? '#1a1a2e' : '#2d1b69';
  const txtColor = versao === 1 ? '#e0e0e0' : '#f8c6ff';
  const acColor  = versao === 1 ? '#e94560' : '#c084fc';

  // Quebra o texto em linhas de até 28 caracteres
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + w).length > 28) { if (cur) lines.push(cur.trim()); cur = w + ' '; }
    else cur += w + ' ';
  }
  if (cur.trim()) lines.push(cur.trim());

  const lineHeight = 38;
  const h          = Math.max(200, 80 + lines.length * lineHeight + 60);

  const textSvgLines = lines
    .map((l, i) => {
      const safe = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="256" y="${80 + i * lineHeight}" font-family="Arial" font-size="24" fill="${txtColor}" text-anchor="middle">${safe}</text>`;
    })
    .join('\n');

  const svg = `<svg width="512" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="${h}" rx="20" fill="${bgColor}"/>
    <rect x="20" y="20" width="6" height="${h - 40}" rx="3" fill="${acColor}"/>
    ${textSvgLines}
  </svg>`;

  const imgBuf    = await sharp(Buffer.from(svg)).resize(512, h).webp().toBuffer();
  const sticker   = await convertImageToSticker(imgBuf);
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
  await sock.sendMessage(jid, { sticker });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ═══════════════════════════════════════════════════════════════
// ─── !emojimix / !emoji ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEmojiMix(sock, msg, jid, caption, getPrefix, stickerCount) {
  const P     = getPrefix(jid);
  const args  = caption.replace(/^[!.,\/]emojimix\s*/i, '').trim();
  const parts = args.split('+').map(s => s.trim()).filter(Boolean);

  if (parts.length < 2) {
    await sock.sendMessage(jid, { text: `⚠️ Use: *${P}emojimix 😀+😎*` }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const cp1 = parts[0].codePointAt(0)?.toString(16);
  const cp2 = parts[1].codePointAt(0)?.toString(16);

  if (!cp1 || !cp2) {
    await sock.sendMessage(jid, { text: '⚠️ Envie emojis válidos!' }, { quoted: msg });
    return;
  }

  try {
    const url     = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${cp1}/u${cp1}_u${cp2}.png`;
    const buf     = await fetchBuffer(url);
    const sticker = await convertImageToSticker(buf);
    const senderJid = msg.key.participant || msg.key.remoteJid;
    if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
    await sock.sendMessage(jid, { sticker });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não foi possível misturar esses emojis. Tente outros!' }, { quoted: msg });
  }
}

async function handleEmoji(sock, msg, jid, caption, getPrefix, stickerCount) {
  const P    = getPrefix(jid);
  const args = caption.replace(/^[!.,\/]emoji\s*/i, '').trim();

  if (!args) {
    await sock.sendMessage(jid, { text: `⚠️ Use: *${P}emoji 😀* ou *${P}emoji 😀/apple*` }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const [emojiPart, provider = 'twitter'] = args.split('/').map(s => s.trim());
  const cp = emojiPart.codePointAt(0)?.toString(16);

  if (!cp) {
    await sock.sendMessage(jid, { text: '⚠️ Emoji inválido!' }, { quoted: msg });
    return;
  }

  try {
    const url = provider === 'apple'
      ? `https://em-content.zobj.net/source/apple/354/${cp}.png`
      : `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${cp}.png`;
    const buf     = await fetchBuffer(url);
    const sticker = await convertImageToSticker(buf);
    const senderJid = msg.key.participant || msg.key.remoteJid;
    if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
    await sock.sendMessage(jid, { sticker });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Não encontrei esse emoji. Tente outro!' }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── BUSCA DE FIGURINHAS (Tenor) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function buscarFigurinha(sock, msg, jid, query, qtd, stickerCount) {
  const limit     = Math.min(Math.max(parseInt(qtd) || 1, 1), 10);
  const senderJid = msg.key.participant || msg.key.remoteJid;

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const key     = process.env.TENOR_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCyk';
    const url     = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${key}&limit=${limit}&media_filter=gif`;
    const buf     = await fetchBuffer(url);
    const data    = JSON.parse(buf.toString('utf8'));
    const results = data.results || [];

    if (!results.length) throw new Error('sem resultados');

    let sent = 0;
    for (const item of results) {
      const gifUrl = item.media_formats?.gif?.url || item.media_formats?.tinygif?.url;
      if (!gifUrl) continue;

      const gifBuf = await fetchBuffer(gifUrl);
      const ext    = detectExt(gifBuf);
      let sticker  = await videoToStickerBuffer(gifBuf, ext === 'mp4' ? 'mp4' : 'gif');
      if (!sticker || sticker.length < 100) sticker = await convertVideoToSticker(gifBuf);

      await sock.sendMessage(jid, { sticker });
      if (senderJid) stickerCount.set(senderJid, (stickerCount.get(senderJid) || 0) + 1);
      sent++;
    }

    if (sent === 0) throw new Error('nenhum gif enviado');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch {
    await sock.sendMessage(jid, {
      text: `❌ Não encontrei figurinhas de *${query}*. Tente outro tema!`,
    }, { quoted: msg });
  }
}

const TEMAS_ALEATORIOS = ['funny','meme','cat','anime','roblox','emoji','cute','reaction','dog','dance'];

async function handleFigAleatoria(sock, msg, jid, stickerCount) {
  const tema = TEMAS_ALEATORIOS[Math.floor(Math.random() * TEMAS_ALEATORIOS.length)];
  await buscarFigurinha(sock, msg, jid, tema, 1, stickerCount);
}

async function handleFigCategoria(sock, msg, jid, caption, cmd, query, stickerCount) {
  const qtd = caption.replace(new RegExp(`^[!.,\/]${cmd}\\s*`, 'i'), '').trim() || '1';
  await buscarFigurinha(sock, msg, jid, query, qtd, stickerCount);
}

async function handlePesquisaFig(sock, msg, jid, caption, getPrefix, stickerCount) {
  const P     = getPrefix(jid);
  const query = caption.replace(/^[!.,\/]pesquisafig\s*/i, '').trim();

  if (!query) {
    await sock.sendMessage(jid, {
      text: `⚠️ Digite o que buscar!\nEx: *${P}pesquisafig cachorro fofo*`,
    }, { quoted: msg });
    return;
  }

  await buscarFigurinha(sock, msg, jid, query, 1, stickerCount);
}

// ═══════════════════════════════════════════════════════════════
// ─── !menufig ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMenuFig(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
    `╭━━━━━━━━━━━━━━━━━╮\n` +
    `│  🎭 *MENU FIGURINHAS* 🎭\n│\n` +
    `│ ▸ ${P}s _— imagem/vídeo → sticker_\n` +
    `│ ▸ ${P}f _— alias do !s_\n` +
    `│ ▸ ${P}attp _<texto>_\n` +
    `│ ▸ ${P}attp2 _<texto>_\n` +
    `│ ▸ ${P}brat _<texto>_\n` +
    `│ ▸ ${P}figtexto _<texto>_\n` +
    `│ ▸ ${P}qc _<texto>_\n` +
    `│ ▸ ${P}qc2 _<texto>_\n` +
    `│ ▸ ${P}emojimix _😀+😎_\n` +
    `│ ▸ ${P}emoji _😀_\n` +
    `│ ▸ ${P}desfig _— sticker → imagem/vídeo_\n` +
    `│ ▸ ${P}toimg _— alias do !desfig_\n` +
    `│ ▸ ${P}togif _— sticker → gif_\n` +
    `` +
    `│ ▸ ${P}rename _pack/autor_\n` +
    `│ ▸ ${P}autorename _pack/autor_\n` +
    `│ ▸ ${P}delrename\n` +
    `│ ▸ ${P}estourar _— amplifica áudio_\n` +
    `│ ▸ ${P}figaleatoria\n` +
    `│ ▸ ${P}pesquisafig _<tema>_\n` +
    `│ ▸ ${P}figgatos / figemoji / figmeme\n` +
    `│ ▸ ${P}figanime / figcoreana / figraiva\n` +
    `╰━━━━━━━⊰ ✧ ⊱━━━━━━━╯`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
  console.log('🎭 Menu figurinhas enviado');
}

// ═══════════════════════════════════════════════════════════════
// ─── EXPORTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

module.exports = {
  handleSticker,
  processMedia,
  handleDesfig,
  handleToImg,
  handleToGif,
  handleRename,
  handleAutoRename,
  handleDelRename,
  handleEstourar,
  handleBrat,
  handleFigtexto,
  handleAttp,
  handleQc,
  handleEmojiMix,
  handleEmoji,
  handleFigAleatoria,
  handleFigCategoria,
  handlePesquisaFig,
  handleMenuFig,
  setLogger,
  videoToStickerBuffer,
};