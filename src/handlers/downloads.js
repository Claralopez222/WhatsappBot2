const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const sharp = require('sharp');
const { fetchBuffer } = require(path.join(__dirname, '..', 'fetchurl'));
const { convertVideoToSticker } = require(path.join(__dirname, '..', 'sticker'));

let _cachedYtDlpPath = null;
let _cachedFfmpegPath = null;
let _logger = console;

function setLogger(loggerInstance) {
  if (loggerInstance && typeof loggerInstance.info === 'function') {
    _logger = loggerInstance;
  }
}

const log = {
  info:  (...a) => _logger.info  ? _logger.info(...a)  : console.log(...a),
  warn:  (...a) => _logger.warn  ? _logger.warn(...a)  : console.warn(...a),
  error: (...a) => _logger.error ? _logger.error(...a) : console.error(...a),
};

// ─── Download automático do binário yt-dlp ────────────────────────────────────

async function ensureYtDlpBinary() {
  const binPath = '/tmp/yt-dlp';

  // Se já existe e funciona, retorna direto
  if (fs.existsSync(binPath)) {
    try {
      require('child_process').execSync(`"${binPath}" --version`, { timeout: 3000 });
      return binPath;
    } catch {
      // Binário corrompido ou desatualizado — remove e baixa novamente
      try { fs.unlinkSync(binPath); } catch {}
    }
  }

  log.info('yt-dlp não encontrado — baixando binário do GitHub...');

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(binPath);

    const doRequest = (url, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Muitos redirecionamentos ao baixar yt-dlp'));
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} ao baixar yt-dlp`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };

    doRequest('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp');
  });

  fs.chmodSync(binPath, 0o755);
  log.info('yt-dlp baixado com sucesso em /tmp/yt-dlp');
  return binPath;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function expandirUrl(urlEncurtada) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
  for (const method of ['head', 'get']) {
    try {
      const res = await axios[method](urlEncurtada, { maxRedirects: 5, timeout: 10000, headers });
      const final = res.request?.res?.responseUrl;
      if (final) return final;
    } catch {}
  }
  return urlEncurtada;
}

function getFfmpegPath() {
  if (_cachedFfmpegPath && fs.existsSync(_cachedFfmpegPath)) return _cachedFfmpegPath;

  try {
    const p = require('ffmpeg-static');
    if (p && fs.existsSync(p)) { _cachedFfmpegPath = p; return p; }
  } catch {}

  // Tenta o ffmpeg-installer como fallback no Render
  try {
    const p = require('@ffmpeg-installer/ffmpeg').path;
    if (p && fs.existsSync(p)) { _cachedFfmpegPath = p; return p; }
  } catch {}

  const candidates = process.platform === 'win32'
    ? ['C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe']
    : ['/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];

  for (const c of candidates) {
    if (fs.existsSync(c)) { _cachedFfmpegPath = c; return c; }
  }
  return 'ffmpeg';
}

function getFfprobePath() {
  try {
    const s = require('ffprobe-static');
    if (s?.path && fs.existsSync(s.path)) return s.path;
  } catch {}
  const candidates = process.platform === 'win32'
    ? [path.resolve(__dirname, '../node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')]
    : ['/usr/local/bin/ffprobe', '/usr/bin/ffprobe'];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return 'ffprobe';
}

function getYtDlpArgs() {
  const args = [];
  const ffmpegPath = getFfmpegPath();
  if (ffmpegPath && ffmpegPath !== 'ffmpeg') args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    const nodeExe = execSync(cmd, { timeout: 3000 }).toString().trim().split('\n')[0].trim();
    if (nodeExe) args.push('--js-runtimes', `node:${nodeExe}`);
  } catch {}
  return args;
}

async function getYtDlpPath() {
  if (_cachedYtDlpPath) {
    try {
      require('child_process').execSync(`"${_cachedYtDlpPath}" --version`, { timeout: 3000 });
      return _cachedYtDlpPath;
    } catch { _cachedYtDlpPath = null; }
  }

  const { execSync } = require('child_process');

  // 1. which/where
  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const p = execSync(cmd, { timeout: 3000 }).toString().trim().split('\n')[0].trim();
    if (p) { _cachedYtDlpPath = p; return p; }
  } catch {}

  // 2. Caminhos comuns Linux
  if (process.platform !== 'win32') {
    const linuxCandidates = [
  '/opt/render/project/src/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  path.join(process.env.HOME || '', '.local', 'bin', 'yt-dlp'),
  '/opt/render/project/.venv/bin/yt-dlp',
  '/opt/render/project/python/bin/yt-dlp',
  path.resolve(__dirname, '../yt-dlp'),
];
    for (const c of linuxCandidates) {
      try { if (fs.existsSync(c)) { _cachedYtDlpPath = c; return c; } } catch {}
    }

    // 3. Procura em todos os bin/ do sistema
    try {
      const found = execSync('find /usr /opt /root /home -name "yt-dlp" -type f 2>/dev/null | head -1', { timeout: 5000 }).toString().trim();
      if (found) { _cachedYtDlpPath = found; return found; }
    } catch {}

    // 4. Fallback: python -m yt_dlp
    for (const py of ['python3', 'python']) {
      try {
        execSync(`${py} -m yt_dlp --version`, { timeout: 3000, stdio: 'ignore' });
        const wrapper = path.resolve(__dirname, '../yt-dlp-wrapper.sh');
        fs.writeFileSync(wrapper, `#!/bin/sh\nexec ${py} -m yt_dlp "$@"\n`);
        fs.chmodSync(wrapper, 0o755);
        _cachedYtDlpPath = wrapper;
        log.info(`yt-dlp via ${py} -m yt_dlp (wrapper criado)`);
        return wrapper;
      } catch {}
    }
  }

  // 5. Windows
  if (process.platform === 'win32') {
    const winCandidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
      'C:\\Python312\\Scripts\\yt-dlp.exe',
      path.resolve(__dirname, '../yt-dlp.exe'),
    ];
    for (const c of winCandidates) {
      try { if (fs.existsSync(c)) { _cachedYtDlpPath = c; return c; } } catch {}
    }
  }

  // 6. Baixar binário direto do GitHub (último recurso — funciona no Render)
  try {
    const p = await ensureYtDlpBinary();
    if (p) { _cachedYtDlpPath = p; return p; }
  } catch (e) {
    log.warn('Falha ao baixar yt-dlp:', e.message);
  }

  log.warn('yt-dlp não encontrado em nenhum local — usando "yt-dlp" do PATH como fallback');
  return 'yt-dlp';
}

function ytDlp(ytdlp, args, timeout = 120000) {
  const { execFile } = require('child_process');
  return new Promise((resolve) => {
    execFile(ytdlp, args, { timeout, maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        log.warn('yt-dlp err:', stderr?.slice(-400) || err.message);
        resolve({ ok: false, stdout: '', stderr: stderr || '' });
      } else {
        resolve({ ok: true, stdout: stdout || '', stderr: '' });
      }
    });
  });
}

function ffmpeg(bin, args, timeout = 120000) {
  const { execFile } = require('child_process');
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, maxBuffer: 1024 * 1024 * 50 }, (err, _stdout, stderr) => {
      if (err) {
        log.warn('ffmpeg err:', stderr?.slice(-400) || err.message);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function fetchMeta(ytdlp, link, extraArgs = []) {
  const args = [...getYtDlpArgs(), '--no-playlist', '--skip-download', '--print-json', '-o', 'dummy', ...extraArgs, link];
  const { ok, stdout } = await ytDlp(ytdlp, args, 15000);
  if (!ok || !stdout) return null;
  try { return JSON.parse(stdout.trim()); } catch { return null; }
}

function formatMeta(meta) {
  if (!meta) return '';
  const parts = [];
  if (meta.title)      parts.push(`📌 *Título:* ${meta.title}`);
  if (meta.uploader || meta.channel) parts.push(`👤 *Canal:* ${meta.uploader || meta.channel}`);
  if (meta.duration)   parts.push(`⏱️ *Duração:* ${Math.floor(meta.duration/60)}:${String(meta.duration%60).padStart(2,'0')}`);
  if (meta.view_count) parts.push(`👁️ *Views:* ${Number(meta.view_count).toLocaleString('pt-BR')}`);
  return parts.length ? parts.join('\n') + '\n\n' : '';
}

function tmpPath(id, suffix) {
  return path.join(require('os').tmpdir(), `${id}${suffix}`);
}

function safeDel(...paths) {
  for (const p of paths) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
}

const SIZE_LIMIT = 64 * 1024 * 1024;

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

  // Caption detalhada para vídeos
  const buildVideoCaption = (meta, fileSizeBytes, sourceLink) => {
    const titulo     = meta?.title || meta?.description?.slice(0, 100) || null;
    const autor      = meta?.uploader || meta?.channel || meta?.creator || null;
    const durSec     = meta?.duration || 0;
    const durStr     = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : null;
    const views      = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
    const likes      = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
    const comments   = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
    const shares     = meta?.repost_count  ? Number(meta.repost_count).toLocaleString('pt-BR')  : null;
    const width      = meta?.width && meta?.height ? `${meta.width}x${meta.height}` : null;
    const fps        = meta?.fps           ? `${meta.fps} fps`                                  : null;
    const fileSize   = fileSizeBytes       ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`  : null;
    const tags       = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
    const uploadDate = meta?.upload_date
      ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
      : null;

    const platform =
      /tiktok/i.test(sourceLink)           ? '🎵 TikTok'    :
      /instagram/i.test(sourceLink)        ? '📸 Instagram'  :
      /youtube\.com|youtu\.be/i.test(sourceLink) ? '▶️ YouTube'  :
      /twitter\.com|x\.com/i.test(sourceLink)    ? '🐦 Twitter/X' :
      /pinterest|pin\.it/i.test(sourceLink)      ? '📌 Pinterest' :
      /facebook|fb\.com/i.test(sourceLink)       ? '📘 Facebook'  :
      '🌐 Web';

    let txt = `━━━ [ ${platform} ] ━━━\n\n`;
    if (titulo)     txt += `📌 *Título:* ${titulo}\n`;
    if (autor)      txt += `👤 *Canal/Autor:* ${autor}\n`;
    if (durStr)     txt += `⏱️ *Duração:* ${durStr}\n`;
    if (uploadDate) txt += `📅 *Postado em:* ${uploadDate}\n`;
    if (width)      txt += `🎞️ *Resolução:* ${width}\n`;
    if (fps)        txt += `⚡ *FPS:* ${fps}\n`;
    if (fileSize)   txt += `💾 *Tamanho:* ${fileSize}\n`;
    if (views || likes || comments || shares) txt += `\n`;
    if (views)    txt += `👁️ *Views:* ${views}\n`;
    if (likes)    txt += `❤️ *Curtidas:* ${likes}\n`;
    if (comments) txt += `💬 *Comentários:* ${comments}\n`;
    if (shares)   txt += `🔁 *Compartilhamentos:* ${shares}\n`;
    if (tags)     txt += `\n🏷️ *Tags:* ${tags}\n`;
    txt += `\n🔗 ${sourceLink}`;
    return txt;
  };

  const infoText = formatMeta(meta);
  const isVideo = lower.match(/\.(mp4|mov|webm|mkv)$/);
  const cap = (txt) => isVideo
    ? buildVideoCaption(meta, buffer.length, link)
    : (infoText ? infoText + txt : txt);

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

  // Metadados em background
  const metaPromise = fetchMeta(ytdlp, link);

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

  const meta = await metaPromise;

  const buildRecCaption = (meta, fileSizeBytes, sourceLink) => {
    const titulo     = meta?.title || meta?.description?.slice(0, 100) || null;
    const autor      = meta?.uploader || meta?.channel || meta?.creator || null;
    const durSec     = meta?.duration || 0;
    const durStr     = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : null;
    const views      = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
    const likes      = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
    const comments   = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
    const shares     = meta?.repost_count  ? Number(meta.repost_count).toLocaleString('pt-BR')  : null;
    const width      = meta?.width && meta?.height ? `${meta.width}x${meta.height}` : null;
    const fps        = meta?.fps           ? `${meta.fps} fps`                                  : null;
    const fileSize   = fileSizeBytes       ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`  : null;
    const tags       = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
    const uploadDate = meta?.upload_date
      ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
      : null;

    const platform =
      /tiktok/i.test(sourceLink)                ? '🎵 TikTok'    :
      /instagram/i.test(sourceLink)             ? '📸 Instagram'  :
      /youtube\.com|youtu\.be/i.test(sourceLink)? '▶️ YouTube'   :
      /twitter\.com|x\.com/i.test(sourceLink)   ? '🐦 Twitter/X' :
      /pinterest|pin\.it/i.test(sourceLink)     ? '📌 Pinterest'  :
      /facebook|fb\.com/i.test(sourceLink)      ? '📘 Facebook'   :
      '🌐 Web';

    let txt = `━━━ [ ${platform} ] ━━━\n\n`;
    txt += `✂️ *Recorte:* primeiros 10 segundos\n\n`;
    if (titulo)     txt += `📌 *Título:* ${titulo}\n`;
    if (autor)      txt += `👤 *Canal/Autor:* ${autor}\n`;
    if (durStr)     txt += `⏱️ *Duração original:* ${durStr}\n`;
    if (uploadDate) txt += `📅 *Postado em:* ${uploadDate}\n`;
    if (width)      txt += `🎞️ *Resolução:* ${width}\n`;
    if (fps)        txt += `⚡ *FPS:* ${fps}\n`;
    if (fileSize)   txt += `💾 *Tamanho:* ${fileSize}\n`;
    if (views || likes || comments || shares) txt += `\n`;
    if (views)    txt += `👁️ *Views:* ${views}\n`;
    if (likes)    txt += `❤️ *Curtidas:* ${likes}\n`;
    if (comments) txt += `💬 *Comentários:* ${comments}\n`;
    if (shares)   txt += `🔁 *Compartilhamentos:* ${shares}\n`;
    if (tags)     txt += `\n🏷️ *Tags:* ${tags}\n`;
    txt += `\n🔗 ${sourceLink}`;
    return txt;
  };

  const finalCaption = buildRecCaption(meta, buffer.length, link);
  const name = path.basename(usePath);

  if (buffer.length > SIZE_LIMIT) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: finalCaption }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
  }

  try {
    const stickerBuffer = await convertVideoToSticker(buffer);
    await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
  } catch (e) { log.warn('sticker err:', e.message); }

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

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

  const buildTiktokCaption = (meta, fileSizeBytes) => {
    const titulo   = meta?.title || meta?.description?.slice(0, 100) || '—';
    const autor    = meta?.uploader || meta?.creator || meta?.uploader_id || '—';
    const durSec   = meta?.duration || 0;
    const durStr   = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : '—';
    const views    = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
    const likes    = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
    const comments = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
    const shares   = meta?.repost_count  ? Number(meta.repost_count).toLocaleString('pt-BR')  : null;
    const tags     = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ')  : null;
    const width    = meta?.width         ? `${meta.width}x${meta.height}`                      : null;
    const fps      = meta?.fps           ? `${meta.fps} fps`                                   : null;
    const fileSize = fileSizeBytes       ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`   : null;
    const uploadDate = meta?.upload_date
      ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
      : null;

    let txt = `━━━ [ 🎵 *TikTok* 🎵 ] ━━━\n\n`;
    txt += `📌 *Título:* ${titulo}\n`;
    txt += `👤 *Criador:* @${autor}\n`;
    txt += `⏱️ *Duração:* ${durStr}\n`;
    if (uploadDate) txt += `📅 *Postado em:* ${uploadDate}\n`;
    if (width)      txt += `🎞️ *Resolução:* ${width}\n`;
    if (fps)        txt += `⚡ *FPS:* ${fps}\n`;
    if (fileSize)   txt += `💾 *Tamanho:* ${fileSize}\n`;
    txt += `\n`;
    if (views)    txt += `👁️ *Views:* ${views}\n`;
    if (likes)    txt += `❤️ *Curtidas:* ${likes}\n`;
    if (comments) txt += `💬 *Comentários:* ${comments}\n`;
    if (shares)   txt += `🔁 *Compartilhamentos:* ${shares}\n`;
    if (tags)     txt += `\n🏷️ *Tags:* ${tags}\n`;
    txt += `\n🔗 ${link}`;
    return txt;
  };

  const finalCaption = buildTiktokCaption(meta, videoBuffer.length);

  await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  cleanupCookie();
}
// !audio
async function handleAudioDownload(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]*audio\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    return sock.sendMessage(jid, { text: '⚠️ Envie o link do vídeo.\nExemplo: *!audio https://youtu.be/xxx*' }, { quoted: msg });
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp = await getYtDlpPath();
  const ffmpegBin = getFfmpegPath();
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const rawTemplate = tmpPath(id, '_raw.%(ext)s');
  const outPath = tmpPath(id, '_out.mp3');

  // Metadados em background
  const metaPromise = fetchMeta(ytdlp, link);

  const dlArgs = [...getYtDlpArgs(), '--no-playlist', '-x', '--audio-format', 'best', '--audio-quality', '0', '--max-filesize', '100m', '-o', rawTemplate, link];
  const { ok: dlOk } = await ytDlp(ytdlp, dlArgs, 90000);
  if (!dlOk) return sock.sendMessage(jid, { text: '❌ Não consegui baixar o áudio.' }, { quoted: msg });

  const base = rawTemplate.replace('.%(ext)s', '');
  const rawPath = ['.mp3','.m4a','.opus','.ogg','.webm','.aac','.flac','.wav'].map(e => base + e).find(p => fs.existsSync(p)) || null;
  if (!rawPath) return sock.sendMessage(jid, { text: '❌ Arquivo de áudio não encontrado.' }, { quoted: msg });

  const encOk = await ffmpeg(ffmpegBin, [
    '-y', '-i', rawPath,
    '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', outPath
  ]);
  safeDel(rawPath);

  if (!encOk || !fs.existsSync(outPath)) return sock.sendMessage(jid, { text: '❌ Falha ao processar o áudio.' }, { quoted: msg });

  const audioBuffer = fs.readFileSync(outPath);
  safeDel(outPath);

  if (audioBuffer.length > SIZE_LIMIT) return sock.sendMessage(jid, { text: '❌ Áudio muito grande (máx 64MB).' }, { quoted: msg });

  const meta = await metaPromise;

  const buildAudioCaption = (meta, fileSizeBytes, sourceLink) => {
    const titulo     = meta?.title || null;
    const autor      = meta?.uploader || meta?.channel || meta?.artist || meta?.creator || null;
    const album      = meta?.album || null;
    const durSec     = meta?.duration || 0;
    const durStr     = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : null;
    const views      = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
    const likes      = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
    const fileSize   = fileSizeBytes       ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`  : null;
    const tags       = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
    const uploadDate = meta?.upload_date
      ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
      : null;

    const platform =
      /youtube\.com|youtu\.be/i.test(sourceLink) ? '▶️ YouTube'   :
      /soundcloud/i.test(sourceLink)             ? '🔊 SoundCloud' :
      /spotify/i.test(sourceLink)                ? '🎧 Spotify'    :
      /tiktok/i.test(sourceLink)                 ? '🎵 TikTok'     :
      /instagram/i.test(sourceLink)              ? '📸 Instagram'   :
      /twitter\.com|x\.com/i.test(sourceLink)    ? '🐦 Twitter/X'  :
      '🌐 Web';

    let txt = `━━━ [ ${platform} ] ━━━\n\n`;
    if (titulo)     txt += `🎵 *Título:* ${titulo}\n`;
    if (autor)      txt += `👤 *Artista/Canal:* ${autor}\n`;
    if (album)      txt += `💿 *Álbum:* ${album}\n`;
    if (durStr)     txt += `⏱️ *Duração:* ${durStr}\n`;
    if (uploadDate) txt += `📅 *Postado em:* ${uploadDate}\n`;
    txt += `🎚️ *Qualidade:* MP3 192kbps\n`;
    if (fileSize)   txt += `💾 *Tamanho:* ${fileSize}\n`;
    if (views || likes) txt += `\n`;
    if (views)      txt += `👁️ *Views:* ${views}\n`;
    if (likes)      txt += `❤️ *Curtidas:* ${likes}\n`;
    if (tags)       txt += `\n🏷️ *Tags:* ${tags}\n`;
    txt += `\n🔗 ${sourceLink}`;
    return txt;
  };

  const infoCaption = buildAudioCaption(meta, audioBuffer.length, link);
  await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
  await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  log.info('✅ Áudio MP3 enviado!');
}

// !som
async function handleSom(sock, msg, jid, caption, getPrefix, pendingMusic) {
  const P    = getPrefix(jid);
  const nome = caption.replace(/^[!.,\/]*(som|play)\s*/i, '').trim();
  if (!nome) {
    return sock.sendMessage(jid, { text: `⚠️ Digite o nome da música.\nExemplo: *${P}som Ela Deixou um Bilhete*` }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const ytdlp       = await getYtDlpPath();
    const id          = require('crypto').randomUUID();
    const outTemplate = tmpPath(id, '.%(ext)s');
    const query       = `ytsearch1:${nome} official audio`;

    // ── Cookies do YouTube ──
    const youtubeCookiesEnv = process.env.YOUTUBE_COOKIES?.trim();
    let cookieFilePath = null;
    let cookieTempFile = null;

    if (youtubeCookiesEnv) {
      cookieTempFile = tmpPath(id, '_yt_cookies.txt');
      try {
        fs.writeFileSync(cookieTempFile, youtubeCookiesEnv, 'utf8');
        cookieFilePath = cookieTempFile;
        log.info(`✅ YOUTUBE_COOKIES carregado (${youtubeCookiesEnv.length} bytes)`);
      } catch (e) {
        log.warn('Erro ao gravar cookie:', e.message);
      }
    } else {
      const local = path.join(__dirname, '../youtube_cookies.txt');
      if (fs.existsSync(local)) { cookieFilePath = local; log.info('✅ Usando cookies locais'); }
      else log.warn('⚠️ Sem cookies do YouTube');
    }

    const cookieArgs    = cookieFilePath ? ['--cookies', cookieFilePath] : [];
    const cleanupCookie = () => { if (cookieTempFile) safeDel(cookieTempFile); };

    // ── Download + metadados em uma só chamada ──
    const dlArgs = [
      ...getYtDlpArgs(),
      '--no-playlist', '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--match-filter', '!is_live',
      '--max-filesize', '50m',
      '--write-info-json',   // salva metadados em arquivo .info.json
      ...cookieArgs,
      '-o', outTemplate,
      query,
    ];

    const { ok, stderr } = await ytDlp(ytdlp, dlArgs, 120000);
    cleanupCookie();

    if (!ok) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg });
    }

    // ── Localiza arquivo de áudio ──
    const base      = outTemplate.replace('.%(ext)s', '');
    const finalPath = ['.mp3', '.m4a', '.opus', '.ogg', '.webm'].map(e => base + e).find(p => fs.existsSync(p)) || null;
    if (!finalPath) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg });
    }

    const audioBuffer = fs.readFileSync(finalPath);
    safeDel(finalPath);

    if (audioBuffer.length > SIZE_LIMIT) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: '❌ Arquivo muito grande (máx 64MB).' }, { quoted: msg });
    }

    // ── Lê metadados do .info.json gerado pelo download ──
    let meta = null;
    const infoPath = base + '.info.json';
    if (fs.existsSync(infoPath)) {
      try { meta = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
      safeDel(infoPath);
    }
    // limpa qualquer outro arquivo gerado (thumbnail, etc)
    for (const ext of ['.jpg', '.png', '.webp', '.part']) {
      safeDel(base + ext);
    }

    // ── Thumbnail ──
    let cardBuffer = null;
    const thumbUrl = meta?.thumbnail
      || (meta?.thumbnails?.length ? meta.thumbnails[meta.thumbnails.length - 1]?.url : null);

    if (thumbUrl) {
      try {
        const thumbBuffer = await fetchBuffer(thumbUrl);
        const resized     = await sharp(thumbBuffer)
          .resize(800, 450, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 85 })
          .toBuffer();
        const overlay = Buffer.from(
          `<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">` +
          `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="50%" stop-color="black" stop-opacity="0"/>` +
          `<stop offset="100%" stop-color="black" stop-opacity="0.82"/>` +
          `</linearGradient></defs>` +
          `<rect width="800" height="450" fill="url(#g)"/>` +
          `</svg>`
        );
        cardBuffer = await sharp(resized)
          .composite([{ input: overlay, blend: 'over' }])
          .jpeg({ quality: 88 })
          .toBuffer();
      } catch (e) {
        log.warn('Erro ao processar thumbnail:', e.message);
      }
    }

    if (!cardBuffer) {
      try {
        cardBuffer = await sharp({
          create: { width: 800, height: 450, channels: 3, background: { r: 15, g: 52, b: 96 } },
        }).jpeg({ quality: 90 }).toBuffer();
      } catch {}
    }

    // ── Dados para exibição ──
    const titulo     = meta?.title || nome;
    const autor      = meta?.uploader || meta?.channel || meta?.artist || null;
    const album      = meta?.album || null;
    const durSec     = meta?.duration || 0;
    const durStr     = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : '—';
    const views      = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
    const likes      = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
    const comments   = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
    const fileSize   = `${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB`;
    const tags       = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
    const uploadDate = meta?.upload_date
      ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
      : null;
    const videoUrl   = meta?.webpage_url || null;

    // ── Salva para !playmp4 / !playdoc ──
    const senderJid = msg.key.participant || msg.key.remoteJid;
    pendingMusic.set(senderJid, { audioBuffer, titulo, meta, nome });
    setTimeout(() => pendingMusic.delete(senderJid), 10 * 60 * 1000);

    // ── Monta texto ──
    let texto = `━━━ [ 🎧 *Piroquinhas* 🎧 ] ━━━\n\n`;
    texto += `🔎 *Pesquisa:* _${nome}_\n\n`;
    texto += `🎵 *Título:* _${titulo}_\n`;
    if (autor)      texto += `👤 *Artista/Canal:* _${autor}_\n`;
    if (album)      texto += `💿 *Álbum:* _${album}_\n`;
    texto += `⏱️ *Duração:* ${durStr}\n`;
    if (uploadDate) texto += `📅 *Postado em:* ${uploadDate}\n`;
    texto += `🎚️ *Qualidade:* MP3 320kbps\n`;
    texto += `💾 *Tamanho:* ${fileSize}\n`;
    if (views || likes || comments) texto += `\n`;
    if (views)    texto += `👁️ *Views:* ${views}\n`;
    if (likes)    texto += `❤️ *Curtidas:* ${likes}\n`;
    if (comments) texto += `💬 *Comentários:* ${comments}\n`;
    if (tags)     texto += `\n🏷️ *Tags:* ${tags}\n`;
    if (videoUrl) texto += `\n🔗 ${videoUrl}\n`;
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
    log.info(`✅ Música "${titulo}" enviada (${fileSize})`);

  } catch (err) {
    log.error(`❌ Erro em handleSom: ${err.message}`);
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    await sock.sendMessage(jid, { text: `❌ Erro ao processar *"${nome}"*. Tente novamente.` }, { quoted: msg }).catch(() => {});
  }
}

// !playmp4
async function handlePlayMp4(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending   = pendingMusic.get(senderJid);
  const P         = getPrefix(jid);

  if (!pending) {
    return sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const ytdlp     = await getYtDlpPath();
    const ffmpegBin = getFfmpegPath();
    const id        = require('crypto').randomUUID();
    const rawPath   = tmpPath(id, '_raw.mp4');
    const outPath   = tmpPath(id, '_out.mp4');
    const target    = pending.meta?.webpage_url || `ytsearch1:${pending.nome} official video`;

    // ── Cookies do YouTube ──
    const youtubeCookiesEnv = process.env.YOUTUBE_COOKIES?.trim();
    let cookieFilePath = null;
    let cookieTempFile = null;

    if (youtubeCookiesEnv) {
      cookieTempFile = tmpPath(id, '_youtube_cookies.txt');
      try {
        fs.writeFileSync(cookieTempFile, youtubeCookiesEnv, 'utf8');
        cookieFilePath = cookieTempFile;
      } catch (e) {
        log.warn('Erro ao gravar cookie do YouTube:', e.message);
      }
    } else {
      const local = path.join(__dirname, '../youtube_cookies.txt');
      if (fs.existsSync(local)) cookieFilePath = local;
    }

    const cookieArgs    = cookieFilePath ? ['--cookies', cookieFilePath] : [];
    const cleanupCookie = () => { if (cookieTempFile) safeDel(cookieTempFile); };

    // ── Download ──
    const dlArgs = [
      ...getYtDlpArgs(),
      '--no-playlist',
      '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best',
      '--merge-output-format', 'mp4',
      '--max-filesize', '120m',
      ...cookieArgs,
      '-o', rawPath,
      target,
    ];
    const { ok: dlOk } = await ytDlp(ytdlp, dlArgs, 180000);

    if (!dlOk || !fs.existsSync(rawPath)) {
      cleanupCookie();
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg });
    }

    cleanupCookie();

    const rawSize = fs.statSync(rawPath).size;

    // Envia direto se já estiver dentro do limite — sem ffmpeg, economiza RAM
    if (rawSize <= SIZE_LIMIT) {
      const videoBuffer  = fs.readFileSync(rawPath);
      safeDel(rawPath);
      const meta         = pending.meta;
      const finalCaption = buildMp4Caption(meta, pending, videoBuffer.length);
      await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      return;
    }

    // Arquivo grande — reencoda em 480p
    const encOk = await ffmpeg(ffmpegBin, [
      '-y', '-i', rawPath,
      '-vf', 'scale=480:-2:flags=lanczos',
      '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
      '-preset', 'fast', '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-max_muxing_queue_size', '1024',
      outPath,
    ]);

    safeDel(rawPath);

    if (!encOk || !fs.existsSync(outPath)) {
      safeDel(outPath);
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg });
    }

    const videoBuffer = fs.readFileSync(outPath);
    safeDel(outPath);

    if (videoBuffer.length > SIZE_LIMIT) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
      return sock.sendMessage(jid, { text: '❌ Vídeo muito grande mesmo após compressão (máx 64MB).' }, { quoted: msg });
    }

    const finalCaption = buildMp4Caption(pending.meta, pending, videoBuffer.length);
    await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

  } catch (err) {
    log.error(`❌ Erro em handlePlayMp4: ${err.message}`);
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    await sock.sendMessage(jid, { text: '❌ Erro ao processar o vídeo. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

function buildMp4Caption(meta, pending, fileSizeBytes) {
  const titulo     = meta?.title      || pending?.titulo || pending?.nome || '—';
  const autor      = meta?.uploader   || meta?.channel   || meta?.artist  || null;
  const album      = meta?.album      || null;
  const durSec     = meta?.duration   || 0;
  const durStr     = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : null;
  const views      = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
  const likes      = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
  const comments   = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
  const width      = meta?.width && meta?.height ? `${meta.width}x${meta.height}` : null;
  const fps        = meta?.fps    ? `${meta.fps} fps` : null;
  const fileSize   = `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB`;
  const tags       = meta?.tags?.length ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
  const uploadDate = meta?.upload_date
    ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
    : null;
  const videoUrl   = meta?.webpage_url || null;

  let txt = `━━━ [ ▶️ *YouTube* ] ━━━\n\n`;
  txt += `🎵 *Título:* ${titulo}\n`;
  if (autor)      txt += `👤 *Artista/Canal:* ${autor}\n`;
  if (album)      txt += `💿 *Álbum:* ${album}\n`;
  if (durStr)     txt += `⏱️ *Duração:* ${durStr}\n`;
  if (uploadDate) txt += `📅 *Postado em:* ${uploadDate}\n`;
  if (width)      txt += `🎞️ *Resolução:* ${width}\n`;
  if (fps)        txt += `⚡ *FPS:* ${fps}\n`;
  txt += `💾 *Tamanho:* ${fileSize}\n`;
  if (views || likes || comments) txt += `\n`;
  if (views)    txt += `👁️ *Views:* ${views}\n`;
  if (likes)    txt += `❤️ *Curtidas:* ${likes}\n`;
  if (comments) txt += `💬 *Comentários:* ${comments}\n`;
  if (tags)     txt += `\n🏷️ *Tags:* ${tags}\n`;
  if (videoUrl) txt += `\n🔗 ${videoUrl}`;
  return txt;
}

// !playdoc
async function handlePlayDoc(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending = pendingMusic.get(senderJid);
  const P = getPrefix(jid);
  if (!pending) return sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg });

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const meta = pending.meta;

  const titulo      = meta?.title || pending.titulo || pending.nome;
  const autor       = meta?.uploader || meta?.channel || meta?.artist || null;
  const album       = meta?.album || null;
  const durSec      = meta?.duration || 0;
  const durStr      = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : null;
  const views       = meta?.view_count    ? Number(meta.view_count).toLocaleString('pt-BR')    : null;
  const likes       = meta?.like_count    ? Number(meta.like_count).toLocaleString('pt-BR')    : null;
  const comments    = meta?.comment_count ? Number(meta.comment_count).toLocaleString('pt-BR') : null;
  const fileSize    = `${(pending.audioBuffer.length / 1024 / 1024).toFixed(1)} MB`;
  const tags        = meta?.tags?.length  ? meta.tags.slice(0, 5).map(t => `#${t}`).join(' ') : null;
  const uploadDate  = meta?.upload_date
    ? `${meta.upload_date.slice(6,8)}/${meta.upload_date.slice(4,6)}/${meta.upload_date.slice(0,4)}`
    : null;
  const videoUrl    = meta?.webpage_url || null;

  let docCaption = `━━━ [ 🎵 *Música* ] ━━━\n\n`;
  docCaption += `🎵 *Título:* ${titulo}\n`;
  if (autor)      docCaption += `👤 *Artista/Canal:* ${autor}\n`;
  if (album)      docCaption += `💿 *Álbum:* ${album}\n`;
  if (durStr)     docCaption += `⏱️ *Duração:* ${durStr}\n`;
  if (uploadDate) docCaption += `📅 *Postado em:* ${uploadDate}\n`;
  docCaption += `🎚️ *Qualidade:* MP3 192kbps\n`;
  docCaption += `💾 *Tamanho:* ${fileSize}\n`;
  if (views || likes || comments) docCaption += `\n`;
  if (views)    docCaption += `👁️ *Views:* ${views}\n`;
  if (likes)    docCaption += `❤️ *Curtidas:* ${likes}\n`;
  if (comments) docCaption += `💬 *Comentários:* ${comments}\n`;
  if (tags)     docCaption += `\n🏷️ *Tags:* ${tags}\n`;
  if (videoUrl) docCaption += `\n🔗 ${videoUrl}`;

  const safeName = titulo.replace(/[^\w\s\-]/g, '').replace(/\s+/g, '_').slice(0, 60);

  await sock.sendMessage(jid, {
    document: pending.audioBuffer,
    mimetype: 'audio/mpeg',
    fileName: `${safeName}.mp3`,
    caption: docCaption
  }, { quoted: msg });

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

function tmpPath(id, suffix) {
  const dir = path.join(require('os').tmpdir(), 'piroquinhas-tmp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${id}${suffix}`);
}

function safeDel(...paths) {
  for (const p of paths) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
}

// ─── Limpeza de arquivos temporários órfãos ────────────────────────────────────
function limparTmpAntigos(maxIdadeMs = 10 * 60 * 1000) {
  try {
    const dir = path.join(require('os').tmpdir(), 'piroquinhas-tmp');
    if (!fs.existsSync(dir)) return;

    const agora = Date.now();
    let removidos = 0;

    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile() && (agora - stat.mtimeMs) > maxIdadeMs) {
          fs.unlinkSync(fp);
          removidos++;
        }
      } catch {}
    }

    if (removidos > 0) log.info(`🧹 Limpeza tmp: ${removidos} arquivo(s) removido(s).`);
  } catch (e) {
    log.error('[limparTmpAntigos] Erro:', e.message);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

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