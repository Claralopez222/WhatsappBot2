/**
 * Handler de Downloads
 * Comandos: .play, .play_video, .youtube, .instagram, .tiktok, .facebook, .twitter, .spotify, etc
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fetchBuffer } = require('../fetchurl');
const path = require('path');
const fs = require('fs');
const { tmpdir } = require('os');
const { randomUUID } = require('crypto');
const sharp = require('sharp');

let logger = { level: 'silent' };

function setLogger(newLogger) {
  logger = newLogger;
}

// ─── Helper: busca JSON via URL ──────────────────────────────────────────────
async function fetchJson(url, headers = {}) {
  try {
    const buf = await fetchBuffer(url);
    const txt = buf.toString('utf8').trim();
    if (txt.startsWith('<')) {
      console.error('fetchJson recebeu HTML em vez de JSON:', txt.slice(0, 200).replace(/\s+/g, ' '));
      return null;
    }
    return JSON.parse(txt);
  } catch (e) {
    console.error('Erro ao buscar JSON:', e.message);
    return null;
  }
}

// ─── Helper: envia texto/carta de metadados ─────────────────────────────────
async function sendMetaCard(sock, jid, msg, meta = {}, query = '') {
  let cardBuffer = null;
  let texto = `━━━ [ 🔎 *Informações* 🔎 ] ━━━\n\n`;
  if (query) texto += `• 🔎 *Pesquisa:* _${query}_\n\n`;
  if (meta.title) texto += `• 📌 *Título:* _${meta.title}_\n\n`;
  if (meta.duration) {
    const durSec = meta.duration;
    const durStr = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : '—';
    texto += `• ⏱️ *Duração:* ${durStr}\n`;
  }
  if (meta.uploader) texto += `• 👤 *Canal:* _${meta.uploader}_\n`;
  if (meta.views) texto += `• 👁️ *Views:* ${meta.views}\n`;

  // build card image if thumbnail provided
  if (meta.thumbnail) {
    try {
      const buf = await fetchBuffer(meta.thumbnail);
      let baseImage = await sharp(buf).resize(800,450,{fit:'cover',position:'centre'}).jpeg({quality:85}).toBuffer();
      const overlay = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.82"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>`);
      cardBuffer = await sharp(baseImage).composite([{input:overlay,blend:'over'}]).jpeg({quality:88}).toBuffer();
    } catch (e) {
      // ignore failures, send text only
    }
  }

  if (cardBuffer) {
    await sock.sendMessage(jid, { image: cardBuffer, caption: texto }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

// ─── !play / !play2 ─────────────────────────────────────────────────────────
async function handlePlay(sock, msg, jid, caption, version = 1) {
  const query = caption.replace(/^[!.]play2?\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .play <música>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    // fetch metadata in background (don't wait for slow queries)
    const { execFile } = require('child_process');
    const util = require('./utilidade');
    const ytdlp = util.getYtDlpPath ? await util.getYtDlpPath() : 'yt-dlp';
    let meta = null;
    
    setImmediate(() => {
      try {
        execFile(ytdlp, ['--no-playlist', '--print-json', '--skip-download', `ytsearch1:${query}`], { timeout: 10000 }, (err, stdout) => {
          if (!err && stdout) {
            try { meta = JSON.parse(stdout); } catch { }
          }
        });
      } catch { }
    });

    // build description immediately without waiting for metadata
    let cardBuffer = null;
    let texto = `━━━ [ 🎧 *Piroquinhas* 🎧 ] ━━━\n\n`;
    texto += `• 🔎 *Pesquisa:* _${query}_\n`;
    texto += `• ⏳ *Processando...*\n\n`;
    texto += `━━━ [ 📱 *MAIS OPÇÕES* 📱 ] ━━━\n`;
    texto += `🎬 *.playmp4* - _Baixa como vídeo_\n`;
    texto += `📄 *.playdoc* - _Baixa como documento_`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });

    // now download audio
    const tmpId = randomUUID();
    const outTemplate = path.join(tmpdir(), `${tmpId}.%(ext)s`);

    const dlOk = await new Promise((resolve) => {
      execFile(ytdlp, [
        '--no-playlist', '-x', '--audio-format', 'mp3',
        '--max-filesize', '120m', '-o', outTemplate,
        `ytsearch1:${query}`
      ], { timeout: 180000 }, (err, _stdout, stderr) => {
        if (err) { console.log('yt-dlp play err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
      });
    });

    if (!dlOk) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar a música.' }, { quoted: msg });
      return;
    }

    const mp3Path = path.join(tmpdir(), `${tmpId}.mp3`);
    if (!fs.existsSync(mp3Path)) {
      await sock.sendMessage(jid, { text: '❌ Arquivo não encontrado após download.' }, { quoted: msg });
      return;
    }

    const audioBuffer = fs.readFileSync(mp3Path);
    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    try { fs.unlinkSync(mp3Path); } catch {};
  } catch (e) {
    console.error('play error', e);
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar música.' }, { quoted: msg });
  }
}

// ─── !play_video / !play_video2 ─────────────────────────────────────────────
async function handlePlayVideo(sock, msg, jid, caption, version = 1) {
  const query = caption.replace(/^[!.]play_video2?\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .play_video <vídeo>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const { execFile } = require('child_process');
    const util = require('./utilidade');
    const ytdlp = util.getYtDlpPath ? await util.getYtDlpPath() : 'yt-dlp';
    let meta = null;
    try {
      const info = await new Promise((resolve) => {
        execFile(ytdlp, ['--no-playlist','--print-json','--skip-download',`ytsearch1:${query}`], { timeout: 30000 }, (err, stdout) => {
          if (!err && stdout) {
            try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
          } else resolve(null);
        });
      });
      if (info) meta = info;
    } catch {}

    // show metadata text similar to audio
    let cardBuffer = null;
    let texto = `━━━ [ 🎬 *Piroquinhas* 🎬 ] ━━━\n\n`;
    texto += `• 🔎 *Pesquisa:* _${query}_\n\n`;
    if (meta) {
      const titulo = meta.title || query;
      const durSec = meta.duration || 0;
      const durStr = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2,'0')}` : '—';
      const uploader = meta.uploader || meta.channel || null;
      const views = meta.view_count ? Number(meta.view_count).toLocaleString('pt-BR') : null;
      texto += `• 🎥 *Título:* _${titulo}_\n\n`;
      texto += `• ⏱️ *Duração:* ${durStr}\n`;
      if (uploader) texto += `• 👤 *Canal:* _${uploader}_\n`;
      if (views) texto += `• 👁️ *Views:* ${views}_\n`;

      const thumbUrl = meta.thumbnail || (meta.thumbnails?.length ? meta.thumbnails[meta.thumbnails.length-1]?.url : null);
      if (thumbUrl) {
        try {
          const buf = await fetchBuffer(thumbUrl);
          let baseImage = await sharp(buf).resize(800,450,{fit:'cover',position:'centre'}).jpeg({quality:85}).toBuffer();
          const overlay = Buffer.from(`<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.82"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>`);
          cardBuffer = await sharp(baseImage).composite([{input:overlay,blend:'over'}]).jpeg({quality:88}).toBuffer();
        } catch {}
      }
    }
    texto += `\n━━━ [ 📱 *MAIS OPÇÕES* 📱 ] ━━━\n`;
    texto += `🎵 *.play* - _Som mp3_\n`;
    texto += `📄 *.playdoc* - _Baixa como documento_`;

    if (cardBuffer) {
      await sock.sendMessage(jid, { image: cardBuffer, caption: texto }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    }

    const tmpId = randomUUID();
    const outTemplate = path.join(tmpdir(), `${tmpId}.%(ext)s`);

    const dlOk = await new Promise((resolve) => {
      execFile(ytdlp, [
        '--no-playlist', '-f', 'best', '--max-filesize', '120m',
        '-o', outTemplate,
        `ytsearch1:${query}`
      ], { timeout: 180000 }, (err, _stdout, stderr) => {
        if (err) { console.log('yt-dlp playvideo err:', stderr?.slice(-400)); resolve(false); } else resolve(true);
      });
    });

    if (!dlOk) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg });
      return;
    }

    const vidPath = path.join(tmpdir(), `${tmpId}.mp4`);
    if (!fs.existsSync(vidPath)) {
      const alt = ['.mkv','.webm','.mov'].map(ext=>path.join(tmpdir(), `${tmpId}${ext}`)).find(p=>fs.existsSync(p));
      if (alt) vidPath = alt;
    }
    if (!fs.existsSync(vidPath)) {
      await sock.sendMessage(jid, { text: '❌ Arquivo não encontrado após download.' }, { quoted: msg });
      return;
    }

    const videoBuffer = fs.readFileSync(vidPath);
    try { fs.unlinkSync(vidPath); } catch {}

    if (videoBuffer.length > 64 * 1024 * 1024) {
      await sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { video: videoBuffer, mimetype: 'video/mp4' }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('play video error', e);
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar vídeo.' }, { quoted: msg });
  }
}

// ─── !youtube / !youtubemp4 / !youtubemp3 ───────────────────────────────────
async function handleYouTube(sock, msg, jid, caption, format = 'info') {
  const link = caption.replace(/^[!.](youtube|youtubemp4|youtubemp3)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .youtube <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    // metadata card for any format
    const data = await fetchJson(`https://api.lolhuman.xyz/api/youtube2mp4?apikey=galanggg&url=${encodeURIComponent(link)}`);
    if (!data?.result) throw new Error('Erro ao processar');
    const meta = {
      title: data.result.title || null,
      uploader: data.result.channel || data.result.uploader || null,
      duration: data.result.duration || null,
      views: data.result.views || data.result.view_count || null,
      thumbnail: data.result.thumbnail || data.result.image || null,
    };
    await sendMetaCard(sock, jid, msg, meta, link);

    if (format === 'mp4') {
      if (!data.result.downloadUrl) throw new Error('Erro ao processar');
      const buffer = await fetchBuffer(data.result.downloadUrl);
      if (buffer.length > 64 * 1024 * 1024) {
        await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
        return;
      }
      await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4' }, { quoted: msg });
    } else if (format === 'mp3') {
      if (!data.result.downloadUrl) throw new Error('Erro ao processar');
      const buffer = await fetchBuffer(data.result.downloadUrl);
      await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: `❌ Erro ao baixar ${format}.` }, { quoted: msg });
  }
}

// ─── !instagram / !instagram2 ───────────────────────────────────────────────
async function handleInstagram(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](instagram2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .instagram <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/instagram?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result?.length) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    // first item metadata
    const first = data.result[0] || {};
    await sendMetaCard(sock, jid, msg, {
      title: first.caption || null,
      thumbnail: first.thumbnail || first.url || null
    }, link);

    for (const media of data.result.slice(0, 3)) {
      if (media.type === 'image') {
        const imgBuffer = await fetchBuffer(media.url);
        await sock.sendMessage(jid, { image: imgBuffer }, { quoted: msg });
      } else if (media.type === 'video') {
        const vidBuffer = await fetchBuffer(media.url);
        if (vidBuffer.length < 64 * 1024 * 1024) {
          await sock.sendMessage(jid, { video: vidBuffer, mimetype: 'video/mp4' }, { quoted: msg });
        }
      }
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Instagram.' }, { quoted: msg });
  }
}

// ─── !tiktok / !tiktok2 ─────────────────────────────────────────────────────
async function handleTikTok(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](tiktok2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .tiktok <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/tiktok?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar o vídeo.' }, { quoted: msg });
      return;
    }

    const { title, author, duration, thumbnail, link: videoUrl } = data.result;

    // Send metadata card
    await sendMetaCard(sock, jid, msg, {
      title: title || null,
      uploader: author?.nickname || null,
      duration: duration || null,
      thumbnail: thumbnail || null,
    }, link);

    const vidBuffer = await fetchBuffer(videoUrl);
    if (vidBuffer.length > 64 * 1024 * 1024) {
      await sock.sendMessage(jid, { text: '❌ Vídeo muito grande (máx 64MB).' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { video: vidBuffer, mimetype: 'video/mp4', caption: `🎵 ${title || 'TikTok'}` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar TikTok.' }, { quoted: msg });
  }
}

// ─── !facebook / !facebook2 ─────────────────────────────────────────────────
async function handleFacebook(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](facebook2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .facebook <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/facebook?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result?.download) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    // send metadata card
    await sendMetaCard(sock, jid, msg, {
      title: data.result.title || null,
      duration: data.result.duration || null,
      uploader: data.result.uploader || null,
      thumbnail: data.result.thumbnail || null
    }, link);

    const vidBuffer = await fetchBuffer(data.result.download);
    
    if (vidBuffer.length > 64 * 1024 * 1024) {
      await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { video: vidBuffer, mimetype: 'video/mp4' }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Facebook.' }, { quoted: msg });
  }
}

// ─── !twitter / !x ──────────────────────────────────────────────────────────
async function handleTwitter(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](twitter|x)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .twitter <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/twitter?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    // metadata card using first item
    const first = data.result[0] || {};
    await sendMetaCard(sock, jid, msg, {
      title: first.title || first.text || null,
      thumbnail: first.thumbnail || first.url || null,
      duration: first.duration || null
    }, link);

    if (first.url) {
      const media = await fetchBuffer(first.url);
      if (first.type === 'image') {
        await sock.sendMessage(jid, { image: media }, { quoted: msg });
      } else {
        if (media.length < 64 * 1024 * 1024) {
          await sock.sendMessage(jid, { video: media, mimetype: 'video/mp4' }, { quoted: msg });
        }
      }
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Twitter.' }, { quoted: msg });
  }
}

// ─── !pinterest / !pinterest2 ───────────────────────────────────────────────
async function handlePinterest(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](pinterest2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .pinterest <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/pinterest?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title: link,
      thumbnail: data.result || null
    }, link);

    const imgBuffer = await fetchBuffer(data.result);
    await sock.sendMessage(jid, { image: imgBuffer }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Pinterest.' }, { quoted: msg });
  }
}

// ─── !spotify ───────────────────────────────────────────────────────────────
async function handleSpotify(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.]spotify\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .spotify <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/spotify?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result?.preview_url) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar. (preview não disponível)' }, { quoted: msg });
      return;
    }

    const title = data.result.name || 'Spotify';
    const artist = data.result.artist || 'Unknown';
    await sendMetaCard(sock, jid, msg, {
      title,
      uploader: artist,
      thumbnail: data.result.thumbnail || null,
      duration: data.result.duration || null
    }, link);

    const audioBuffer = await fetchBuffer(data.result.preview_url);
    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    await sock.sendMessage(jid, { text: `🎵 *${title}* - ${artist}` }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Spotify.' }, { quoted: msg });
  }
}

// ─── !soundcloud / !sou ndcloud ─────────────────────────────────────────────
async function handleSoundCloud(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](soundcloud|sou\s*ndcloud)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .soundcloud <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/soundcloud?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result?.download) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title: data.result.title || null,
      uploader: data.result.uploader || data.result.artist || null,
      duration: data.result.duration || null,
      thumbnail: data.result.thumbnail || null
    }, link);

    const audioBuffer = await fetchBuffer(data.result.download);
    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar SoundCloud.' }, { quoted: msg });
  }
}

// ─── !gimage ────────────────────────────────────────────────────────────────
async function handleGImage(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]gimage\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .gimage <termo>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  await sendMetaCard(sock, jid, msg, { title: `Resultados para "${query}"` }, query);

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/google/image?apikey=galanggg&query=${encodeURIComponent(query)}`);
    
    if (!data?.result?.length) {
      await sock.sendMessage(jid, { text: '❌ Nenhuma imagem encontrada.' }, { quoted: msg });
      return;
    }

    for (const img of data.result.slice(0, 3)) {
      try {
        const imgBuffer = await fetchBuffer(img);
        await sock.sendMessage(jid, { image: imgBuffer }, { quoted: msg });
      } catch { }
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao buscar imagens.' }, { quoted: msg });
  }
}

// ─── !pesquisayt ────────────────────────────────────────────────────────────
async function handlePesquisaYT(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]pesquisayt\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .pesquisayt <termo>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  await sendMetaCard(sock, jid, msg, { title: `Resultados para "${query}"` }, query);

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/youtube/search?apikey=galanggg&query=${encodeURIComponent(query)}`);
    
    if (!data?.result?.length) {
      await sock.sendMessage(jid, { text: '❌ Nenhum vídeo encontrado.' }, { quoted: msg });
      return;
    }

    let resultado = `🔍 *Resultados para: "${query}"*\n\n`;
    
    for (let i = 0; i < Math.min(5, data.result.length); i++) {
      const video = data.result[i];
      resultado += `${i + 1}. *${video.title}*\n`;
      resultado += `   URL: ${video.url}\n`;
      resultado += `   \n`;
    }

    await sock.sendMessage(jid, { text: resultado }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao pesquisar.' }, { quoted: msg });
  }
}

// ─── !twitch ────────────────────────────────────────────────────────────────
async function handleTwitch(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.]twitch\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: .twitch <link>' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`https://api.lolhuman.xyz/api/twitch?apikey=galanggg&url=${encodeURIComponent(link)}`);
    
    if (!data?.result?.video_url) {
      await sock.sendMessage(jid, { text: '❌ Não consegui baixar.' }, { quoted: msg });
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title: data.result.title || null,
      thumbnail: data.result.thumbnail || null,
      duration: data.result.duration || null
    }, link);

    const vidBuffer = await fetchBuffer(data.result.video_url);
    if (vidBuffer.length < 64 * 1024 * 1024) {
      await sock.sendMessage(jid, { video: vidBuffer, mimetype: 'video/mp4' }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: '❌ Vídeo muito grande.' }, { quoted: msg });
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao baixar Twitch.' }, { quoted: msg });
  }
}

// ─── !wallpapers / !wallpaper-animes / !wallpaper-carros ─────────────────────
async function handleWallpapers(sock, msg, jid, category = 'wallpapers') {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  let query = 'wallpaper';
  if (category === 'animes') query = 'anime wallpaper 4k';
  else if (category === 'carros') query = 'car wallpaper 4k';
  await sendMetaCard(sock, jid, msg, { title: `Resultados para "${query}"` }, query);

  try {
    

    const data = await fetchJson(`https://api.lolhuman.xyz/api/google/image?apikey=galanggg&query=${encodeURIComponent(query)}`);
    
    if (!data?.result?.length) {
      await sock.sendMessage(jid, { text: '❌ Nenhum wallpaper encontrado.' }, { quoted: msg });
      return;
    }

    for (const img of data.result.slice(0, 2)) {
      try {
        const imgBuffer = await fetchBuffer(img);
        await sock.sendMessage(jid, { image: imgBuffer }, { quoted: msg });
      } catch { }
    }
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    await sock.sendMessage(jid, { text: '❌ Erro ao buscar wallpapers.' }, { quoted: msg });
  }
}

module.exports = {
  handlePlay,
  handlePlayVideo,
  handleYouTube,
  handleInstagram,
  handleTikTok,
  handleFacebook,
  handleTwitter,
  handlePinterest,
  handleSpotify,
  handleSoundCloud,
  handleGImage,
  handlePesquisaYT,
  handleTwitch,
  handleWallpapers,
  setLogger,
};
