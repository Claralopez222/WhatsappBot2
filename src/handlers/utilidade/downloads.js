const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { fetchBuffer } = require(path.join(__dirname, '..', '..', 'fetchurl'));
const { convertVideoToSticker } = require(path.join(__dirname, '..', '..', 'sticker'));

let _cachedYtDlpPath = null;
let _cachedFfmpegPath = null;

async function expandirUrl(urlEncurtada) {
  try {
    const response = await axios.head(urlEncurtada, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return response.request.res.responseUrl || urlEncurtada;
  } catch (error) {
    try {
      const response = await axios.get(urlEncurtada, {
        maxRedirects: 5,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.request.res.responseUrl || urlEncurtada;
    } catch {
      return urlEncurtada;
    }
  }
}

function getFfmpegPath() {
  if (_cachedFfmpegPath && fs.existsSync(_cachedFfmpegPath)) return _cachedFfmpegPath;

  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      _cachedFfmpegPath = ffmpegStatic;
      return ffmpegStatic;
    }
  } catch {}

  const candidates = process.platform === 'win32' ? [
    path.resolve(__dirname, '../node_modules/ffmpeg-static/ffmpeg.exe'),
    path.resolve(__dirname, '../node_modules/.bin/ffmpeg.exe'),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  ] : [
    path.resolve(__dirname, '../node_modules/ffmpeg-static/ffmpeg'),
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      _cachedFfmpegPath = c;
      return c;
    }
  }

  return 'ffmpeg';
}

function getFfprobePath() {
  try {
    const ffprobeStatic = require('ffprobe-static');
    if (ffprobeStatic?.path && fs.existsSync(ffprobeStatic.path)) return ffprobeStatic.path;
  } catch {}

  const candidates = process.platform === 'win32' ? [
    path.resolve(__dirname, '../node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'),
  ] : [
    '/usr/local/bin/ffprobe',
    '/usr/bin/ffprobe',
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return 'ffprobe';
}

function getYtDlpArgs() {
  const args = [];
  const ffmpegPath = getFfmpegPath();
  if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
    args.push('--ffmpeg-location', path.dirname(ffmpegPath));
  }
  try {
    const { execSync } = require('child_process');
    const nodeExe = execSync(
      process.platform === 'win32' ? 'where node' : 'which node',
      { timeout: 3000 }
    ).toString().trim().split('\n')[0].trim();
    if (nodeExe) args.push('--js-runtimes', `node:${nodeExe}`);
  } catch {}
  return args;
}

async function getYtDlpPath() {
  if (_cachedYtDlpPath && fs.existsSync(_cachedYtDlpPath)) return _cachedYtDlpPath;

  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const p = execSync(cmd, { timeout: 3000 }).toString().trim().split('\n')[0].trim();
    if (p) { _cachedYtDlpPath = p; return p; }
  } catch {}

  const candidates = process.platform === 'win32' ? [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'Scripts', 'yt-dlp.exe'),
    'C:\\Python312\\Scripts\\yt-dlp.exe',
    path.resolve(__dirname, '../yt-dlp.exe'),
    path.resolve(__dirname, 'yt-dlp.exe'),
  ] : [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.resolve(__dirname, '../yt-dlp'),
    path.resolve(__dirname, 'yt-dlp'),
  ];

  for (const c of candidates) {
    try { if (fs.existsSync(c)) { _cachedYtDlpPath = c; return c; } } catch {}
  }

  if (process.platform === 'win32') {
    const downloadPath = path.resolve(__dirname, '../yt-dlp.exe');
    if (!fs.existsSync(downloadPath)) {
      console.log('yt-dlp não encontrado. Baixando automaticamente...');
      try {
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(downloadPath);
          require('https').get('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
          }).on('error', (err) => { try { fs.unlinkSync(downloadPath); } catch {} reject(err); });
        });
        console.log('✅ yt-dlp.exe baixado em', downloadPath);
      } catch (e) {
        console.warn('Não foi possível baixar yt-dlp.exe:', e.message);
      }
    }
    if (fs.existsSync(downloadPath)) { _cachedYtDlpPath = downloadPath; return downloadPath; }
  }

  return 'yt-dlp';
}

async function handleSave(sock, msg, jid, caption) {
  let link = caption.replace(/^[!.,\/]*save\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: '⚠️ Envie um link válido para baixar. Exemplo: *!save https://...*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const isShortened = /vt\.tiktok\.com|vm\.tiktok\.com|pin\.it|t\.co|bit\.ly|tinyurl\.com/i.test(link);
  if (isShortened) {
    try {
      const expandedLink = await expandirUrl(link);
      if (expandedLink && expandedLink !== link) {
        console.log(`🔗 Link expandido: ${link} → ${expandedLink}`);
        link = expandedLink;
      }
    } catch (e) {
      console.log(`⚠️ Não consegui expandir o link: ${e.message}`);
    }
  }

  const ytdlp = await getYtDlpPath();
  let meta = null;
  setImmediate(() => {
    try {
      const { execFile } = require('child_process');
      const args = [...getYtDlpArgs(), '--no-playlist', '--skip-download', '--print-json', '-o', 'dummy', link];
      execFile(ytdlp, args, { timeout: 10000 }, (err, stdout) => {
        if (!err && stdout) { try { meta = JSON.parse(stdout.trim()); } catch {} }
      });
    } catch {}
  });

  const { execFile } = require('child_process');
  const { tmpdir } = require('os');
  const { randomUUID } = require('crypto');
  const tmpId = randomUUID();
  const outTemplate = path.join(tmpdir(), `${tmpId}_raw.%(ext)s`);

  const dlOk = await new Promise((resolve) => {
    const baseArgs = [...getYtDlpArgs(), '--no-playlist', '--max-filesize', '200m'];
    if (link.includes('pinterest') || link.includes('pin.it')) {
      baseArgs.push('--referer', 'https://www.pinterest.com', '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }
    baseArgs.push('-o', outTemplate, link);
    execFile(ytdlp, baseArgs, { timeout: 120000 }, (err, _stdout, stderr) => {
      if (err) { console.log('yt-dlp save err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!dlOk) { await sock.sendMessage(jid, { text: '❌ Não consegui baixar o conteúdo.' }, { quoted: msg }); return; }

  const base = outTemplate.replace('.%(ext)s', '');
  const exts = ['.mp4', '.mkv', '.webm', '.mov', '.mp3', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.opus', '.ogg', '.pdf', '.zip', '.txt'];
  let filePath = null;
  for (const e of exts) {
    const p = base + e;
    if (fs.existsSync(p)) { filePath = p; break; }
  }

  if (!filePath) { await sock.sendMessage(jid, { text: '❌ Arquivo baixado não encontrado.' }, { quoted: msg }); return; }

  let buffer;
  try { buffer = fs.readFileSync(filePath); } catch { await sock.sendMessage(jid, { text: '❌ Erro ao ler o arquivo baixado.' }, { quoted: msg }); return; }
  if (buffer.length < 1000) { await sock.sendMessage(jid, { text: '❌ Conteúdo baixado está vazio ou muito pequeno.' }, { quoted: msg }); return; }
  try { fs.unlinkSync(filePath); } catch {}

  const sizeLimit = 64 * 1024 * 1024;
  let name = path.basename(filePath);
  let lower = filePath.toLowerCase();

  const videoExt = lower.match(/\.(mp4|mov|webm|mkv)$/);
  if (videoExt) {
    try {
      const ffmpegBin = getFfmpegPath();
      const inPath = path.join(require('os').tmpdir(), `save_in_${Date.now()}${videoExt[0]}`);
      const outPath = path.join(require('os').tmpdir(), `save_out_${Date.now()}.mp4`);
      fs.writeFileSync(inPath, buffer);
      const convertOk = await new Promise((resolve) => {
        execFile(ffmpegBin, [
          '-y', '-i', inPath,
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-r', '30',
          '-profile:v', 'baseline', '-level', '3.0',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath
        ], { timeout: 120000, maxBuffer: 1024 * 1024 * 50 }, (err, _stdout, stderr) => {
          if (err) { console.log('ffmpeg convert err:', stderr?.slice(-400) || err.message); resolve(false); } else resolve(true); }
        );
      });
      if (convertOk && fs.existsSync(outPath)) {
        const converted = fs.readFileSync(outPath);
        if (converted.length > 1000) { buffer = converted; lower = outPath.toLowerCase(); name = name.replace(videoExt[0], '.mp4'); }
        try { fs.unlinkSync(outPath); } catch {}
      }
      try { fs.unlinkSync(inPath); } catch {}
    } catch (e) { console.log('Erro na conversão de vídeo:', e.message); }
  }

  let infoText = '';
  if (meta) {
    const title = meta.title || '';
    const uploader = meta.uploader || meta.channel || '';
    const durSec = meta.duration || 0;
    const duration = durSec ? `${Math.floor(durSec/60)}:${String(durSec%60).padStart(2,'0')}` : '';
    const views = meta.view_count ? Number(meta.view_count).toLocaleString('pt-BR') : '';
    if (title) infoText += `📌 *Título:* ${title}\n`;
    if (uploader) infoText += `👤 *Canal:* ${uploader}\n`;
    if (duration) infoText += `⏱️ *Duração:* ${duration}\n`;
    if (views) infoText += `👁️ *Visualizações:* ${views}\n`;
    if (infoText) infoText += '\n';
  }
  const makeCaption = (text) => infoText ? infoText + text : text;

  if (buffer.length > sizeLimit) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: makeCaption('📄 Arquivo muito grande — enviado como documento.') }, { quoted: msg });
  } else if (lower.match(/\.(jpg|jpeg|png|webp|gif)$/)) {
    await sock.sendMessage(jid, { image: buffer, caption: makeCaption('🖼️ Aqui está a imagem') }, { quoted: msg });
  } else if (lower.match(/\.(mp4|mov)$/)) {
    try {
      await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: makeCaption('🎬 Aqui está o vídeo') }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: makeCaption('📄 Arquivo de vídeo enviado como documento.') }, { quoted: msg });
    }
  } else if (lower.match(/\.(webm|mkv)$/)) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: makeCaption('📄 Vídeo enviado como documento.') }, { quoted: msg });
  } else if (lower.match(/\.(mp3|m4a|opus|ogg)$/)) {
    if (infoText) await sock.sendMessage(jid, { text: infoText }, { quoted: msg });
    await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: makeCaption('📄 Aqui está o arquivo') }, { quoted: msg });
  }

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleSaveRec(sock, msg, jid, caption) {
  let link = caption.replace(/^[!.,\/]*saverec\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: '⚠️ Envie um link válido. Exemplo: *!saverec https://...*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const isShortened = /vt\.tiktok\.com|vm\.tiktok\.com|pin\.it|t\.co|bit\.ly|tinyurl\.com/i.test(link);
  if (isShortened) {
    try {
      const expandedLink = await expandirUrl(link);
      if (expandedLink && expandedLink !== link) {
        console.log(`🔗 Link expandido: ${link} → ${expandedLink}`);
        link = expandedLink;
      }
    } catch (e) {
      console.log(`⚠️ Não consegui expandir o link: ${e.message}`);
    }
  }

  const ytdlp = await getYtDlpPath();
  const { execFile } = require('child_process');
  const { tmpdir } = require('os');
  const { randomUUID } = require('crypto');
  const tmpId = randomUUID();
  const outTemplate = path.join(tmpdir(), `${tmpId}_raw.%(ext)s`);

  const dlOk = await new Promise((resolve) => {
    const args = [...getYtDlpArgs(), '--no-playlist', '--max-filesize', '200m'];
    if (link.includes('pinterest') || link.includes('pin.it')) {
      args.push('--referer', 'https://www.pinterest.com', '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }
    args.push('-o', outTemplate, link);
    execFile(ytdlp, args, { timeout: 120000 }, (err, _stdout, stderr) => {
      if (err) { console.log('yt-dlp saverec err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!dlOk) { await sock.sendMessage(jid, { text: '❌ Não consegui baixar o conteúdo.' }, { quoted: msg }); return; }

  const base = outTemplate.replace('.%(ext)s', '');
  let filePath = null;
  for (const e of ['.mp4', '.mkv', '.webm', '.mov']) {
    const p = base + e;
    if (fs.existsSync(p)) { filePath = p; break; }
  }
  if (!filePath) { await sock.sendMessage(jid, { text: '❌ Arquivo baixado não encontrado.' }, { quoted: msg }); return; }

  const ffmpegBin = getFfmpegPath();
  const tmpOut = path.join(require('os').tmpdir(), `${tmpId}_rec.mp4`);
  try {
    await new Promise((resolve) => {
      execFile(ffmpegBin, ['-y', '-i', filePath, '-t', '10', '-vf', 'scale=512:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'fast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', tmpOut], { timeout: 120000 }, (err) => {
        if (!err && fs.existsSync(tmpOut)) filePath = tmpOut;
        resolve();
      });
    });
  } catch (e) { console.log('ffmpeg saverec err:', e.message); }

  const buffer = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  if (buffer.length > 64 * 1024 * 1024) {
    await sock.sendMessage(jid, { document: buffer, mimetype: 'application/octet-stream', fileName: name, caption: '📄 Vídeo muito grande — enviado como documento.' }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: '🎬 Aqui está o vídeo recortado!' }, { quoted: msg });
  }

  try {
    const stickerBuffer = await convertVideoToSticker(buffer);
    await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });
  } catch (e) { console.log('sticker conversion err:', e.message); }

  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleTiktok(sock, msg, jid, caption, getPrefix) {
  const P = getPrefix(jid);
  let link = caption.replace(/^[!.,\/]*tiktok2?\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: `⚠️ Envie o link do vídeo.\nExemplo: *${P}tiktok https://vm.tiktok.com/xxx*` }, { quoted: msg });
    return;
  }

  const isShortened = /vt\.tiktok\.com|vm\.tiktok\.com/i.test(link);
  if (isShortened) {
    try {
      const expandedLink = await expandirUrl(link);
      if (expandedLink && expandedLink !== link) {
        console.log(`🔗 Link TikTok expandido: ${link} → ${expandedLink}`);
        link = expandedLink;
      }
    } catch (e) {
      console.log(`⚠️ Não consegui expandir link TikTok: ${e.message}`);
    }
  }

  const ytdlp = await getYtDlpPath();
  let meta = null;
  const { tmpdir } = require('os');
  const tiktokCookiesEnv = process.env.TIKTOK_COOKIES?.trim();
  let cookieFilePath = null;
  let cookieTempFile = null;

  if (tiktokCookiesEnv) {
    console.log(`✅ TIKTOK_COOKIES encontrado em process.env (${tiktokCookiesEnv.length} bytes)`);
    cookieTempFile = path.join(tmpdir(), `tiktok_cookies_${require('crypto').randomUUID()}.txt`);
    try { fs.writeFileSync(cookieTempFile, tiktokCookiesEnv, 'utf8'); } catch (e) { console.log('❌ Erro ao gravar cookie TikTok em temp:', e.message); }
    cookieFilePath = cookieTempFile;
  } else {
    console.log('⚠️ TIKTOK_COOKIES não encontrado em process.env');
    const localCookies = path.join(__dirname, '../../tiktok_cookies.txt');
    if (fs.existsSync(localCookies)) {
      console.log(`✅ Usando arquivo local de cookies: ${localCookies}`);
      cookieFilePath = localCookies;
    } else {
      console.log(`⚠️ Nenhum arquivo de cookies encontrado em: ${localCookies}`);
    }
  }

  if (!cookieFilePath) {
    console.log('⚠️ AVISO: Bot vai tentar download SEM cookies (pode falhar)');
  }

  const cleanupCookieFile = () => {
    if (cookieTempFile) {
      try { fs.unlinkSync(cookieTempFile); } catch {}
      cookieTempFile = null;
    }
  };

  try {
    meta = await new Promise((resolve) => {
      const { execFile } = require('child_process');
      let args = [...getYtDlpArgs(), '--no-playlist', '--skip-download', '--print-json', '-o', 'dummy', link];
      if (cookieFilePath) args.push('--cookies', cookieFilePath);
      execFile(ytdlp, args, { timeout: 30000 }, (err, stdout) => {
        if (!err && stdout) { try { resolve(JSON.parse(stdout.trim())); } catch {} }
        resolve(null);
      });
    });
  } catch {}

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  console.log(`🎵 tiktok: baixando ${link}`);

  const { execFile } = require('child_process');
  const { randomUUID } = require('crypto');
  const ffmpegBin = getFfmpegPath();
  const tmpId = randomUUID();
  const rawPath = path.join(tmpdir(), `${tmpId}_raw.mp4`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp4`);

  let dlStderr = '';
  const dlOk = await new Promise((resolve) => {
    const args = [...getYtDlpArgs(), '--no-playlist', '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4'];
    if (cookieFilePath) {
      args.push('--cookies', cookieFilePath);
      console.log(`🍪 Usando cookies no download TikTok: ${cookieFilePath}`);
    } else {
      console.log(`⚠️ Download TikTok SEM cookies - pode dar erro 403`);
    }
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    args.push('--referer', 'https://www.tiktok.com/');
    args.push('-o', rawPath, link);
    console.log(`🎬 Iniciando download: ${link}`);
    execFile(ytdlp, args, { timeout: 60000 }, (err, _stdout, stderr) => {
      dlStderr = stderr || '';
      if (err) { console.log('yt-dlp tiktok err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!dlOk) {
    const isPhoto = /\/photo\//i.test(dlStderr) || /photo/i.test(dlStderr);
    if (isPhoto) {
      await sock.sendMessage(jid, { text: '⚠️ Esse link é um *post de foto* do TikTok, não um vídeo!' }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.\nVerifique se o link é válido.' }, { quoted: msg });
    }
    cleanupCookieFile();
    return;
  }

  if (!fs.existsSync(rawPath)) { await sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg }); cleanupCookieFile(); return; }

  const encOk = await new Promise((resolve) => {
    const child = require('child_process').execFile(ffmpegBin, [
      '-y', '-i', rawPath,
      '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
      '-preset', 'fast', '-crf', '28',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
    ], { timeout: 120000, maxBuffer: 1024 * 1024 * 50 }, (err) => {
      if (err) { console.log('ffmpeg tiktok err:', err.message?.slice(-400)); resolve(false); } else resolve(true); }
    );
    setTimeout(() => { try { child.kill(); } catch {} resolve(false); }, 120000);
  });

  try { fs.unlinkSync(rawPath); } catch {}
  if (!encOk || !fs.existsSync(outPath)) { await sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg }); return; }

  const videoBuffer = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch {}
  if (videoBuffer.length > 64 * 1024 * 1024) { await sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg }); return; }

  let infoText = '';
  if (meta) {
    const title = meta.title || '';
    const uploader = meta.uploader || meta.channel || '';
    const durSec = meta.duration || 0;
    const duration = durSec ? `${Math.floor(durSec/60)}:${String(durSec%60).padStart(2,'0')}` : '';
    const views = meta.view_count ? Number(meta.view_count).toLocaleString('pt-BR') : '';
    if (title) infoText += `📌 *Título:* ${title}\n`;
    if (uploader) infoText += `👤 *Canal:* ${uploader}\n`;
    if (duration) infoText += `⏱️ *Duração:* ${duration}\n`;
    if (views) infoText += `👁️ *Visualizações:* ${views}\n`;
    if (infoText) infoText += '\n';
  }
  const finalCaption = infoText ? infoText + '🎵 Aqui está o vídeo!' : '🎵 Aqui está o vídeo!';

  await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: finalCaption }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  cleanupCookieFile();
}

async function handleAudioDownload(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.,\/]*audio\s*/i, '').trim();
  if (!link || !link.startsWith('http')) {
    await sock.sendMessage(jid, { text: '⚠️ Envie o link do vídeo.\nExemplo: *!audio https://youtu.be/xxx*' }, { quoted: msg });
    return;
  }
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp = await getYtDlpPath();
  const { execFile } = require('child_process');
  const { tmpdir } = require('os');
  const { randomUUID } = require('crypto');
  const ffmpegBin = getFfmpegPath();
  const tmpId = randomUUID();
  const rawTemplate = path.join(tmpdir(), `${tmpId}_raw.%(ext)s`);
  const outPath = path.join(tmpdir(), `${tmpId}_out.mp3`);

  const dlOk = await new Promise((resolve) => {
    const args = [...getYtDlpArgs(), '--no-playlist', '-x', '--audio-format', 'best', '--audio-quality', '0', '--max-filesize', '100m', '-o', rawTemplate, link];
    execFile(ytdlp, args, { timeout: 90000 }, (err, _stdout, stderr) => {
      if (err) { console.log('yt-dlp audio err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!dlOk) { await sock.sendMessage(jid, { text: '❌ Não consegui baixar o áudio.' }, { quoted: msg }); return; }

  let rawPath = null;
  const base = rawTemplate.replace('.%(ext)s', '');
  for (const ext of ['.mp3', '.m4a', '.opus', '.ogg', '.webm', '.aac', '.flac', '.wav']) {
    const p = base + ext;
    if (fs.existsSync(p)) { rawPath = p; break; }
  }

  if (!rawPath) { await sock.sendMessage(jid, { text: '❌ Arquivo de áudio não encontrado.' }, { quoted: msg }); return; }

  const encOk = await new Promise((resolve) => {
    execFile(ffmpegBin, ['-y', '-i', rawPath, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', outPath], { timeout: 120000 }, (err) => { if (err) resolve(false); else resolve(true); });
  });

  try { fs.unlinkSync(rawPath); } catch {}
  if (!encOk || !fs.existsSync(outPath)) { await sock.sendMessage(jid, { text: '❌ Falha ao processar o áudio.' }, { quoted: msg }); return; }

  const audioBuffer = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch {}
  if (audioBuffer.length > 64 * 1024 * 1024) { await sock.sendMessage(jid, { text: '❌ Áudio muito grande (máx 64MB).' }, { quoted: msg }); return; }

  await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  console.log('✅ Áudio MP3 enviado!');
}

async function handleSom(sock, msg, jid, caption, getPrefix, pendingMusic) {
  const P = getPrefix(jid);
  const nome = caption.replace(/^[!.,\/]*som\s*/i, '').trim();
  if (!nome) {
    await sock.sendMessage(jid, { text: `⚠️ Digite o nome da música.\nExemplo: *${P}som Ela Deixou um Bilhete*` }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const ytdlp = await getYtDlpPath();
  const { execFile } = require('child_process');
  const { tmpdir } = require('os');
  const { randomUUID } = require('crypto');
  const tmpId = randomUUID();
  const outTemplate = path.join(tmpdir(), `${tmpId}.%(ext)s`);

  let meta = null;
  setImmediate(() => {
    try {
      const args = [...getYtDlpArgs(), '--no-playlist', '--skip-download', '--print-json', '--match-filter', '!is_live', '-o', path.join(tmpdir(), `${tmpId}_dummy`), `ytsearch1:${nome} official audio`];
      execFile(ytdlp, args, { timeout: 10000 }, (err, stdout) => {
        if (!err && stdout.trim()) { try { meta = JSON.parse(stdout.trim()); } catch {} }
      });
    } catch {}
  });

  const downloadOk = await new Promise((resolve) => {
    const args = [...getYtDlpArgs(), '--no-playlist', '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--match-filter', '!is_live', '--max-filesize', '50m', '-o', outTemplate, `ytsearch1:${nome} official audio`];
    execFile(ytdlp, args, { timeout: 90000 }, (err, _stdout, stderr) => {
      if (err) { console.log('yt-dlp som err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!downloadOk) { await sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg }); return; }

  let finalPath = null;
  const base = outTemplate.replace('.%(ext)s', '');
  for (const ext of ['.mp3', '.m4a', '.opus', '.ogg', '.webm']) {
    const p = base + ext;
    if (fs.existsSync(p)) { finalPath = p; break; }
  }

  if (!finalPath) { await sock.sendMessage(jid, { text: `❌ Não encontrei a música *"${nome}"*.` }, { quoted: msg }); return; }

  const audioBuffer = fs.readFileSync(finalPath);
  fs.unlinkSync(finalPath);

  if (audioBuffer.length > 64 * 1024 * 1024) { await sock.sendMessage(jid, { text: '❌ Arquivo muito grande (máx 64MB).' }, { quoted: msg }); return; }

  let thumbBuffer = null;
  const thumbUrl = meta?.thumbnail || (meta?.thumbnails?.length ? meta.thumbnails[meta.thumbnails.length - 1]?.url : null);
  if (thumbUrl) { try { thumbBuffer = await fetchBuffer(thumbUrl); } catch {} }

  let cardBuffer = null;
  try {
    let baseImage;
    if (thumbBuffer) {
      baseImage = await sharp(thumbBuffer).resize(800, 450, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toBuffer();
    } else {
      baseImage = await sharp(Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="450" fill="#0f3460"/></svg>`)).jpeg({ quality: 90 }).toBuffer();
    }
    const overlay = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.82"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>`);
    cardBuffer = await sharp(baseImage).composite([{ input: overlay, blend: 'over' }]).jpeg({ quality: 88 }).toBuffer();
  } catch {}

  const titulo = meta?.title || nome;
  const durSec = meta?.duration || 0;
  const durStr = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : '—';
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
  console.log(`✅ Música "${titulo}" enviada!`);
}

async function handlePlayMp4(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending = pendingMusic.get(senderJid);
  const P = getPrefix(jid);
  if (!pending) { await sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg }); return; }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const { execFile } = require('child_process');
  const ffmpegBin = getFfmpegPath();
  const tmpId = require('crypto').randomUUID();
  const rawPath = path.join(require('os').tmpdir(), `${tmpId}_raw.mp4`);
  const outPath = path.join(require('os').tmpdir(), `${tmpId}_out.mp4`);
  const target = pending.meta?.webpage_url || `ytsearch1:${pending.nome} official video`;
  const ytdlp = await getYtDlpPath();

  const dlOk = await new Promise((resolve) => {
    const args = [...getYtDlpArgs(), '--no-playlist', '-f', 'bestvideo+bestaudio/best', '--merge-output-format', 'mp4', '--max-filesize', '120m', '-o', rawPath, target];
    execFile(ytdlp, args, { timeout: 180000 }, (err, _stdout, stderr) => {
      if (err) { console.log('yt-dlp mp4 err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
    });
  });

  if (!dlOk || !fs.existsSync(rawPath)) { await sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg }); return; }

  const encOk = await new Promise((resolve) => {
    execFile(ffmpegBin, ['-y', '-i', rawPath, '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'fast', '-crf', '28', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-max_muxing_queue_size', '1024', outPath], { timeout: 180000 }, (err) => { if (err) resolve(false); else resolve(true); });
  });

  try { fs.unlinkSync(rawPath); } catch {}
  if (!encOk || !fs.existsSync(outPath)) { await sock.sendMessage(jid, { text: '❌ Falha ao processar o vídeo.' }, { quoted: msg }); return; }

  const videoBuffer = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch {}
  if (videoBuffer.length > 64 * 1024 * 1024) { await sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg }); return; }

  await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4', caption: `🎬 *${pending.titulo}*` }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handlePlayDoc(sock, msg, jid, getPrefix, pendingMusic) {
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const pending = pendingMusic.get(senderJid);
  const P = getPrefix(jid);
  if (!pending) { await sock.sendMessage(jid, { text: `⚠️ Nenhuma música recente. Use *${P}som <música>* primeiro.` }, { quoted: msg }); return; }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });
  const safeName = (pending.titulo || 'musica').replace(/[^\w\s\-]/g, '').replace(/\s+/g, '_').slice(0, 60);
  await sock.sendMessage(jid, { document: pending.audioBuffer, mimetype: 'audio/mpeg', fileName: `${safeName}.mp3`, caption: `📄 *${pending.titulo}*\n_Enviado como documento_` }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

module.exports = {
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
