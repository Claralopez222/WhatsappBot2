// ─── Adicionar no topo do downloads.js (junto aos outros requires) ─────────────
// const YTDlpWrap  = require('yt-dlp-wrap').default;
// const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
//
// const ytDlpWrap = new YTDlpWrap();
//
// async function ensureYtDlp() {
//   const binPath = path.join(require('os').tmpdir(), 'yt-dlp');
//   if (!fs.existsSync(binPath)) {
//     await YTDlpWrap.downloadFromGithub(binPath);
//   }
//   ytDlpWrap.setBinaryPath(binPath);
// }

// ─── !audio ───────────────────────────────────────────────────────────────────

async function handleAudioDownload(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]*audio\s*/i, '').trim();

  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Envie o link do vídeo.\nExemplo: *!audio https://youtu.be/xxx*',
    }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp       = await getYtDlpPath();
  const ffmpegBin   = getFfmpegPath();
  const id          = require('crypto').randomUUID();
  const rawTemplate = tmpPath(id, '_raw.%(ext)s');
  const outPath     = tmpPath(id, '_out.mp3');
  let rawPath       = null;

  try {
    // ── Download ──────────────────────────────────────────────────────────────
    const dlArgs = [
      ...getYtDlpArgs(),
      '--no-playlist',
      '-x',
      '--audio-format', 'best',
      '--audio-quality', '0',
      '--max-filesize', '100m',
      '-o', rawTemplate,
      link,
    ];

    const { ok: dlOk, stderr } = await ytDlp(ytdlp, dlArgs, 90_000);
    if (!dlOk) {
      const msg_erro = stderr.includes('max-filesize')
        ? '❌ Vídeo muito grande para baixar (máx 100 MB).'
        : stderr.includes('Unsupported URL') || stderr.includes('no video')
          ? '❌ Link inválido ou não suportado.'
          : '❌ Não consegui baixar o áudio.';
      return sock.sendMessage(jid, { text: msg_erro }, { quoted: msg });
    }

    // ── Localizar arquivo baixado ─────────────────────────────────────────────
    const base = rawTemplate.replace('.%(ext)s', '');
    rawPath = ['.mp3', '.m4a', '.opus', '.ogg', '.webm', '.aac', '.flac', '.wav']
      .map(ext => base + ext)
      .find(p => fs.existsSync(p)) ?? null;

    if (!rawPath) {
      return sock.sendMessage(jid, {
        text: '❌ Arquivo de áudio não encontrado após o download.',
      }, { quoted: msg });
    }

    // ── Converter para MP3 ────────────────────────────────────────────────────
    const encOk = await ffmpeg(ffmpegBin, [
      '-y', '-i', rawPath,
      '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2',
      outPath,
    ]);
    safeDel(rawPath);
    rawPath = null;

    if (!encOk || !fs.existsSync(outPath)) {
      return sock.sendMessage(jid, {
        text: '❌ Falha ao converter o áudio.',
      }, { quoted: msg });
    }

    // ── Verificar tamanho e enviar ────────────────────────────────────────────
    const audioBuffer = fs.readFileSync(outPath);
    safeDel(outPath);

    if (audioBuffer.length > SIZE_LIMIT) {
      return sock.sendMessage(jid, {
        text: '❌ Áudio muito grande (máx 64 MB).',
      }, { quoted: msg });
    }

    await sock.sendMessage(jid,
      { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    log.info(`[audio] MP3 enviado — ${(audioBuffer.length / 1_048_576).toFixed(1)} MB`);

  } catch (e) {
    log.error('[audio] handleAudioDownload:', e.message);
    safeDel(rawPath, outPath);
    return sock.sendMessage(jid, {
      text: '❌ Erro inesperado ao processar o áudio. Tente novamente.',
    }, { quoted: msg });
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// !save
async function handleSave(sock, msg, jid, caption) {
  let link = caption.replace(/^[!.,\/]*save\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, { text: '⚠️ Envie um link válido. Exemplo: *!save https://...*' }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  if (/vt\.tiktok|vm\.tiktok|pin\.it|t\.co|bit\.ly|tinyurl/i.test(link)) {
    try { link = await expandirUrl(link); } catch {}
  }

  const ytdlp = await getYtDlpPath();
  const ffmpegBin = getFfmpegPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const outTemplate = tmpPath(id, '_raw.%(ext)s');

  // Metadados em background
  const metaPromise = fetchMeta(ytdlp, link);

  const baseArgs = [...getYtDlpArgs(), '--no-playlist', '--max-filesize', '200m'];
  if (/pinterest|pin\.it/i.test(link)) {
    baseArgs.push(
      '--referer', 'https://www.pinterest.com',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
  }
  baseArgs.push('-o', outTemplate, link);

  const { ok: dlOk } = await ytDlp(ytdlp, baseArgs, 120000);
  if (!dlOk) {
    return sock.sendMessage(jid, { text: '❌ Não consegui baixar o conteúdo.' }, { quoted: msg });
  }

  const base = outTemplate.replace('.%(ext)s', '');
  const exts = ['.mp4','.mkv','.webm','.mov','.mp3','.m4a','.jpg','.jpeg','.png','.gif','.webp','.opus','.ogg','.pdf','.zip','.txt'];
  let filePath = exts.map(e => base + e).find(p => fs.existsSync(p)) || null;

  if (!filePath) {
    return sock.sendMessage(jid, { text: '❌ Arquivo baixado não encontrado.' }, { quoted: msg });
  }

  let buffer = fs.readFileSync(filePath);
  if (buffer.length < 1000) {
    safeDel(filePath);
    return sock.sendMessage(jid, { text: '❌ Conteúdo baixado está vazio.' }, { quoted: msg });
  }
  safeDel(filePath);

  let lower = filePath.toLowerCase();
  let name = path.basename(filePath);

  // Converte vídeo para MP4 compatível
  const videoExt = lower.match(/\.(mp4|mov|webm|mkv)$/);
  if (videoExt) {
    const inPath = tmpPath(id, `_in${videoExt[0]}`);
    const outPath = tmpPath(id, '_out.mp4');
    fs.writeFileSync(inPath, buffer);
    const ok = await ffmpeg(ffmpegBin, [
      '-y', '-i', inPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-r', '30',
      '-profile:v', 'baseline', '-level', '3.0',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath
    ]);
    safeDel(inPath);
    if (ok && fs.existsSync(outPath)) {
      const conv = fs.readFileSync(outPath);
      if (conv.length > 1000) { buffer = conv; lower = outPath.toLowerCase(); name = name.replace(videoExt[0], '.mp4'); }
      safeDel(outPath);
    }
  }

  const meta = await metaPromise;
  const infoText = formatMeta(meta);
  const cap = (txt) => infoText ? infoText + txt : txt;

  if (buffer.length > SIZE_LIMIT) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: cap('📄 Arquivo muito grande — enviado como documento.') }, { quoted: msg });
  } else if (lower.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    await sock.sendMessage(jid, { image: buffer, caption: cap('🖼️ Aqui está a imagem') }, { quoted: msg });
  } else if (lower.match(/\.(mp4|mov)$/)) {
    try {
      await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: cap('🎬 Aqui está o vídeo') }, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: cap('📄 Vídeo enviado como documento.') }, { quoted: msg });
    }
  } else if (lower.match(/\.(webm|mkv)$/)) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: cap('📄 Vídeo enviado como documento.') }, { quoted: msg });
  } else if (lower.match(/\.(mp3|m4a|opus|ogg)$/)) {
    if (infoText) await sock.sendMessage(jid, { text: infoText }, { quoted: msg });
    await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: cap('📄 Aqui está o arquivo') }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ──────────────────────────────────────────────────────────────────────────────

// !saverec
async function handleSaveRec(sock, msg, jid, caption) {
  let link = caption.replace(/^[!.,\/]*saverec\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, { text: '⚠️ Envie um link válido. Exemplo: *!saverec https://...*' }, { quoted: msg });
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  if (/vt\.tiktok|vm\.tiktok|pin\.it|t\.co|bit\.ly|tinyurl/i.test(link)) {
    try { link = await expandirUrl(link); } catch {}
  }

  const ytdlp = await getYtDlpPath();
  const ffmpegBin = getFfmpegPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const outTemplate = tmpPath(id, '_raw.%(ext)s');

  const dlArgs = [...getYtDlpArgs(), '--no-playlist', '--max-filesize', '200m', '-o', outTemplate, link];
  if (/pinterest|pin\.it/i.test(link)) {
    dlArgs.push('--referer', 'https://www.pinterest.com', '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  }

  const { ok: dlOk } = await ytDlp(ytdlp, dlArgs, 120000);
  if (!dlOk) return sock.sendMessage(jid, { text: '❌ Não consegui baixar o conteúdo.' }, { quoted: msg });

  const base = outTemplate.replace('.%(ext)s', '');
  let filePath = ['.mp4','.mkv','.webm','.mov'].map(e => base + e).find(p => fs.existsSync(p)) || null;
  if (!filePath) return sock.sendMessage(jid, { text: '❌ Arquivo de vídeo não encontrado.' }, { quoted: msg });

  const recPath = tmpPath(id, '_rec.mp4');
  const ok = await ffmpeg(ffmpegBin, [
    '-y', '-i', filePath,
    '-t', '10', '-vf', 'scale=512:-2:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
    '-c:a', 'aac', '-b:a', '128k', recPath
  ]);
  safeDel(filePath);

  const usePath = (ok && fs.existsSync(recPath)) ? recPath : null;
  if (!usePath) return sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg });

  const buffer = fs.readFileSync(usePath);
  safeDel(usePath);

  const name = path.basename(usePath);
  if (buffer.length > SIZE_LIMIT) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: '📄 Vídeo muito grande — enviado como documento.' }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: '🎬 Aqui está o vídeo recortado!' }, { quoted: msg });
  }

  try {
    const stickerBuffer = await convertVideoToSticker(buffer);
    await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
  } catch (e) { log.warn('sticker err:', e.message); }

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ──────────────────────────────────────────────────────────────────────────────

// !tiktok
async function handleTiktok(sock, msg, jid, caption, getPrefix) {
  const P = getPrefix(jid);
  let link = caption.replace(/^[!.,\/]*tiktok2?\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, { text: `⚠️ Envie o link do vídeo.\nExemplo: *${P}tiktok https://vm.tiktok.com/xxx*` }, { quoted: msg });
  }

  if (/vt\.tiktok|vm\.tiktok/i.test(link)) {
    try { link = await expandirUrl(link); } catch {}
  }

  const ytdlp = await getYtDlpPath();
  const ffmpegBin = getFfmpegPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();

  // Resolve cookies TikTok
  const tiktokCookiesEnv = process.env.TIKTOK_COOKIES?.trim();
  let cookieFilePath = null;
  let cookieTempFile = null;

  if (tiktokCookiesEnv) {
    log.info(`✅ TIKTOK_COOKIES encontrado (${tiktokCookiesEnv.length} bytes)`);
    cookieTempFile = tmpPath(id, '_tiktok_cookies.txt');
    try { fs.writeFileSync(cookieTempFile, tiktokCookiesEnv, 'utf8'); cookieFilePath = cookieTempFile; } catch (e) { log.warn('Erro ao gravar cookie:', e.message); }
  } else {
    const local = path.join(__dirname, '../../tiktok_cookies.txt');
    if (fs.existsSync(local)) { cookieFilePath = local; log.info('✅ Usando cookies locais'); }
    else log.warn('⚠️ Sem cookies TikTok — pode falhar');
  }

  const cleanupCookie = () => { if (cookieTempFile) safeDel(cookieTempFile); };

  // Metadados em background
  const metaExtraArgs = cookieFilePath ? ['--cookies', cookieFilePath] : [];
  const metaPromise = fetchMeta(ytdlp, link, metaExtraArgs);

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  log.info(`🎵 tiktok: baixando ${link}`);

  const rawPath = tmpPath(id, '_raw.mp4');
  const outPath = tmpPath(id, '_out.mp4');

  const dlArgs = [
    ...getYtDlpArgs(),
    '--no-playlist',
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    '--referer', 'https://www.tiktok.com/',
  ];
  if (cookieFilePath) { dlArgs.push('--cookies', cookieFilePath); log.info('🍪 Usando cookies'); }
  dlArgs.push('-o', rawPath, link);

  const { ok: dlOk, stderr: dlStderr } = await ytDlp(ytdlp, dlArgs, 60000);
  if (!dlOk) {
    cleanupCookie();
    const isPhoto = /photo/i.test(dlStderr);
    return sock.sendMessage(jid, {
      text: isPhoto
        ? '⚠️ Esse link é um *post de foto* do TikTok, não um vídeo!'
        : '❌ Não consegui baixar o vídeo.\nVerifique se o link é válido.'
    }, { quoted: msg });
  }

  if (!fs.existsSync(rawPath)) {
    cleanupCookie();
    return sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg });
  }

  const encOk = await ffmpeg(ffmpegBin, [
    '-y', '-i', rawPath,
    '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
    '-preset', 'fast', '-crf', '28',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', outPath
  ]);

  safeDel(rawPath);

  if (!encOk || !fs.existsSync(outPath)) {
    cleanupCookie();
    return sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg });
  }

  const videoBuffer = fs.readFileSync(outPath);
  safeDel(outPath);

  if (videoBuffer.length > SIZE_LIMIT) {
    cleanupCookie();
    return sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg });
  }

  const meta = await metaPromise;
  const infoText = formatMeta(meta);
  const finalCaption = infoText ? infoText + '🎵 Aqui está o vídeo!' : '🎵 Aqui está o vídeo!';

  await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  cleanupCookie();
}

// ──────────────────────────────────────────────────────────────────────────────

// ─── !audio ───────────────────────────────────────────────────────────────────
// Dependências: npm install yt-dlp-wrap @ffmpeg-installer/ffmpeg

const YTDlpWrap  = require('yt-dlp-wrap').default;
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ytDlpWrap = new YTDlpWrap();

const execFileAsync = promisify(execFile);

// Instância única reutilizada entre chamadas
const ytDlpWrap = new YTDlpWrap();

// Garante que o binário yt-dlp existe em /tmp (baixa na primeira execução)
async function ensureYtDlp() {
  const binPath = path.join('/tmp', 'yt-dlp');
  if (!fs.existsSync(binPath)) {
    await YTDlpWrap.downloadFromGithub(binPath);
  }
  ytDlpWrap.setBinaryPath(binPath);
}

async function handleAudioDownload(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]*audio\s*/i, '').trim();

  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, {
      text: '⚠️ Envie o link do vídeo.\nExemplo: *!audio https://youtu.be/xxx*',
    }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const id          = randomUUID();
  const rawTemplate = path.join('/tmp', `${id}_raw.%(ext)s`);
  const outPath     = path.join('/tmp', `${id}_out.mp3`);

  try {
    // ── Garantir binário yt-dlp ───────────────────────────────────────────────
    await ensureYtDlp();

    // ── Download do áudio ─────────────────────────────────────────────────────
    await ytDlpWrap.execPromise([
      '--no-playlist',
      '-x',
      '--audio-format', 'best',
      '--audio-quality', '0',
      '--max-filesize', '100m',
      '-o', rawTemplate,
      link,
    ]);

    // ── Localizar arquivo baixado ─────────────────────────────────────────────
    const base    = rawTemplate.replace('.%(ext)s', '');
    const rawPath = ['.mp3', '.m4a', '.opus', '.ogg', '.webm', '.aac', '.flac', '.wav']
      .map(ext => base + ext)
      .find(p => fs.existsSync(p)) ?? null;

    if (!rawPath) {
      return sock.sendMessage(jid, {
        text: '❌ Arquivo de áudio não encontrado após o download.',
      }, { quoted: msg });
    }

    // ── Converter para MP3 com ffmpeg ─────────────────────────────────────────
    try {
      await execFileAsync(ffmpegPath, [
        '-y', '-i', rawPath,
        '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2',
        outPath,
      ]);
    } finally {
      fs.existsSync(rawPath) && fs.unlinkSync(rawPath);
    }

    if (!fs.existsSync(outPath)) {
      return sock.sendMessage(jid, {
        text: '❌ Falha ao converter o áudio.',
      }, { quoted: msg });
    }

    // ── Verificar tamanho e enviar ────────────────────────────────────────────
    const audioBuffer = fs.readFileSync(outPath);
    fs.unlinkSync(outPath);

    if (audioBuffer.length > SIZE_LIMIT) {
      return sock.sendMessage(jid, {
        text: '❌ Áudio muito grande (máx 64 MB).',
      }, { quoted: msg });
    }

    await sock.sendMessage(jid,
      { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false },
      { quoted: msg }
    );
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    log.info(`[audio] MP3 enviado — ${(audioBuffer.length / 1_048_576).toFixed(1)} MB`);

  } catch (e) {
    log.error('[audio] handleAudioDownload:', e.message);

    // Limpeza de emergência
    [rawPath, outPath].forEach(p => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} });

    const msg_erro = e.message?.includes('max-filesize')
      ? '❌ Vídeo muito grande para baixar (máx 100 MB).'
      : e.message?.includes('Unsupported URL') || e.message?.includes('no video')
        ? '❌ Link inválido ou não suportado.'
        : '❌ Erro ao processar o áudio. Tente novamente.';

    return sock.sendMessage(jid, { text: msg_erro }, { quoted: msg });
  }
}

// ──────────────────────────────────────────────────────────────────────────────

// !som
async function handleSom(sock, msg, jid, caption, getPrefix, pendingMusic) {
  const P = getPrefix(jid);
  const nome = caption.replace(/^[!.,\/]*(som|play)\s*/i, '').trim();
  if (!nome) {
    return sock.sendMessage(jid, { text: `⚠️ Digite o nome da música.\nExemplo: *${P}som Ela Deixou um Bilhete*` }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp = await getYtDlpPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const outTemplate = tmpPath(id, '.%(ext)s');
  const query = `ytsearch1:${nome} official audio`;

  // Metadados em background
  const metaPromise = fetchMeta(ytdlp, query, ['--match-filter', '!is_live']);

  const dlArgs = [
    ...getYtDlpArgs(), '--no-playlist', '-x', '--audio-format', 'mp3',
    '--audio-quality', '0', '--match-filter', '!is_live',
    '--max-filesize', '50m', '-o', outTemplate, query
  ];
  const { ok } = await ytDlp(ytdlp, dlArgs, 90000);
  if (!ok) return sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg });

  const base = outTemplate.replace('.%(ext)s', '');
  const finalPath = ['.mp3','.m4a','.opus','.ogg','.webm'].map(e => base + e).find(p => fs.existsSync(p)) || null;
  if (!finalPath) return sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg });

  const audioBuffer = fs.readFileSync(finalPath);
  safeDel(finalPath);
  if (audioBuffer.length > SIZE_LIMIT) return sock.sendMessage(jid, { text: '❌ Arquivo muito grande (máx 64MB).' }, { quoted: msg });

  const meta = await metaPromise;

  // Thumbnail como card
  let cardBuffer = null;
  const thumbUrl = meta?.thumbnail || (meta?.thumbnails?.length ? meta.thumbnails[meta.thumbnails.length - 1]?.url : null);
  if (thumbUrl) {
    try {
      const thumbBuffer = await fetchBuffer(thumbUrl);
      const base64 = (await sharp(thumbBuffer).resize(800, 450, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toBuffer()).toString('base64');
      const baseImage = Buffer.from(base64, 'base64');
      const overlay = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.82"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>`);
      cardBuffer = await sharp(baseImage).composite([{ input: overlay, blend: 'over' }]).jpeg({ quality: 88 }).toBuffer();
    } catch {}
  }
  if (!cardBuffer) {
    try {
      const svg = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="450" fill="#0f3460"/></svg>`);
      cardBuffer = await sharp(svg).jpeg({ quality: 90 }).toBuffer();
    } catch {}
  }

  const titulo = meta?.title || nome;
  const durSec = meta?.duration || 0;
  const durStr = durSec ? `${Math.floor(durSec/60)}:${String(durSec%60).padStart(2,'0')}` : '—';
  const uploader = meta?.uploader || meta?.channel || null;
  const views = meta?.view_count ? Number(meta.view_count).toLocaleString('pt-BR') : null;

  const senderJid = msg.key.participant || msg.key.remoteJid;
  pendingMusic.set(senderJid, { audioBuffer, titulo, meta, nome });
  setTimeout(() => pendingMusic.delete(senderJid), 10 * 60 * 1000);

  let texto = `━━━ [ 🎧 *Piroquinhas* 🎧 ] ━━━\n\n`;
  texto += `• 🔎 *Pesquisa:* _${nome}_\n\n`;
  texto += `• 🎵 *Título:* _${titulo}_\n\n`;
  texto += `• ⏱️ *Duração:* ${durStr}\n`;
  if (uploader) texto += `• 👤 *Canal:* _${uploader}_\n`;
  if (views)    texto += `• 👁️ *Views:* ${views}\n`;
  texto += `\n━━━ [ 📱 *MAIS OPÇÕES* 📱 ] ━━━\n`;
  texto += `🎬 *${P}playmp4* - _Baixa como vídeo_\n`;
  texto += `📄 *${P}playdoc* - _Baixa como documento_`;

  if (cardBuffer) {
    await sock.sendMessage(jid, { image: cardBuffer, caption: texto }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }

  await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  log.info(`✅ Música "${titulo}" enviada!`);
}

// ──────────────────────────────────────────────────────────────────────────────

// !playmp4 - Baixa a música recente como vídeo (se disponível)
async function handlePlayMp4(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending = pendingMusic.get(senderJid);
  const P = getPrefix(jid);
  if (!pending) return sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg });

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp = await getYtDlpPath();
  const ffmpegBin = getFfmpegPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const rawPath = tmpPath(id, '_raw.mp4');
  const outPath = tmpPath(id, '_out.mp4');
  const target = pending.meta?.webpage_url || `ytsearch1:${pending.nome} official video`;

  const dlArgs = [...getYtDlpArgs(), '--no-playlist', '-f', 'bestvideo+bestaudio/best', '--merge-output-format', 'mp4', '--max-filesize', '120m', '-o', rawPath, target];
  const { ok: dlOk } = await ytDlp(ytdlp, dlArgs, 180000);

  if (!dlOk || !fs.existsSync(rawPath)) return sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg });

  const encOk = await ffmpeg(ffmpegBin, [
    '-y', '-i', rawPath,
    '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
    '-preset', 'fast', '-crf', '28',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', '-max_muxing_queue_size', '1024', outPath
  ]);

  safeDel(rawPath);
  if (!encOk || !fs.existsSync(outPath)) return sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg });

  const videoBuffer = fs.readFileSync(outPath);
  safeDel(outPath);

  if (videoBuffer.length > SIZE_LIMIT) return sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg });

  await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: `🎬 *${pending.titulo}*` }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ──────────────────────────────────────────────────────────────────────────────

// !playdoc - Baixa a música recente como documento (se disponível)
async function handlePlayDoc(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending = pendingMusic.get(senderJid);
  const P = getPrefix(jid);
  if (!pending) return sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg });

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const safeName = (pending.titulo || 'musica').replace(/[^\w\s\-]/g, '').replace(/\s+/g, '_').slice(0, 60);
  await sock.sendMessage(jid, {
    document: pending.audioBuffer,
    mimetype: 'audio/mpeg',
    fileName: `${safeName}.mp3`,
    caption: `📄 *${pending.titulo}*\n_Enviado como documento_`
  }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ──────────────────────────────────────────────────────────────────────────────

module.exports = {
  setLogger,
  handleSave,
  handleSaveRec,
  handleTiktok,
  handleAudioDownload,
  handleSom,
  handlePlayMp4,
  handlePlayDoc,
  getYtDlpPath,
  getYtDlpArgs,
  getFfmpegPath,
  getFfprobePath,
};