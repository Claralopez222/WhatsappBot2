/**
 * Handler de Downloads
 * Comandos: .play, .play_video, .youtube, .instagram, .tiktok,
 *           .facebook, .twitter, .pinterest, .spotify, .soundcloud,
 *           .gimage, .pesquisayt, .twitch, .wallpapers
 *
 * ⚠️  Render não suporta binários como yt-dlp.
 *     Tudo aqui usa apenas APIs HTTP externas (sem execFile, sem ffmpeg-static).
 */

const path   = require('path');
const fs     = require('fs');
const sharp  = require('sharp');

// ─── fetchBuffer ──────────────────────────────────────────────────────────────
let fetchBuffer;
try {
  fetchBuffer = require(path.resolve(__dirname, '..', 'fetchurl.js')).fetchBuffer;
} catch {
  const axios = require('axios');
  fetchBuffer = async (url, headers = {}) => {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers,
    });
    return Buffer.from(res.data);
  };
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const API_KEY    = process.env.LOLHUMAN_KEY  || 'galanggg';
const RAPID_KEY  = process.env.RAPIDAPI_KEY  || '';         // opcional
const BASE       = 'https://api.lolhuman.xyz/api';
const MAX_VIDEO  = 64 * 1024 * 1024; // 64 MB

// ─── fetchJson ────────────────────────────────────────────────────────────────
async function fetchJson(url, headers = {}) {
  try {
    const buf = await fetchBuffer(url, headers);
    const txt = buf.toString('utf8').trim();
    if (txt.startsWith('<')) throw new Error('API retornou HTML (possível erro de cota ou URL errada)');
    return JSON.parse(txt);
  } catch (e) {
    console.error('[fetchJson]', e.message);
    return null;
  }
}

// ─── sendMetaCard ────────────────────────────────────────────────────────────
async function sendMetaCard(sock, jid, msg, meta = {}, query = '') {
  let texto = `━━━ [ 🔎 *Informações* ] ━━━\n\n`;
  if (query)        texto += `• 🔎 *Pesquisa:* _${query}_\n\n`;
  if (meta.title)   texto += `• 📌 *Título:* _${meta.title}_\n`;
  if (meta.duration) {
    const m = Math.floor(meta.duration / 60);
    const s = String(meta.duration % 60).padStart(2, '0');
    texto += `• ⏱️ *Duração:* ${m}:${s}\n`;
  }
  if (meta.uploader) texto += `• 👤 *Canal:* _${meta.uploader}_\n`;
  if (meta.views)    texto += `• 👁️ *Views:* ${Number(meta.views).toLocaleString('pt-BR')}\n`;

  let cardBuffer = null;
  if (meta.thumbnail) {
    try {
      const raw     = await fetchBuffer(meta.thumbnail);
      const base    = await sharp(raw).resize(800, 450, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toBuffer();
      const overlay = Buffer.from(
        `<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="50%" stop-color="black" stop-opacity="0"/>` +
        `<stop offset="100%" stop-color="black" stop-opacity="0.82"/>` +
        `</linearGradient></defs>` +
        `<rect width="800" height="450" fill="url(#g)"/></svg>`
      );
      cardBuffer = await sharp(base).composite([{ input: overlay, blend: 'over' }]).jpeg({ quality: 88 }).toBuffer();
    } catch { /* sem thumbnail, tudo bem */ }
  }

  if (cardBuffer) {
    await sock.sendMessage(jid, { image: cardBuffer, caption: texto }, { quoted: msg });
  } else {
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Baixa mídia e valida tamanho. Retorna null se muito grande. */
async function safeFetch(url, maxBytes = MAX_VIDEO) {
  const buf = await fetchBuffer(url);
  if (buf.length > maxBytes) return null;
  return buf;
}

/** Reage com ❌ e envia texto de erro */
async function sendError(sock, jid, msg, texto) {
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
}

// ═══════════════════════════════════════════════════════════════
// ─── !play (áudio via API) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handlePlay(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]play2?\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.play <música>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    // 1) Busca metadados + link de download via API
    const data = await fetchJson(
      `${BASE}/youtube2mp3?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
    );

    if (!data?.result?.downloadUrl && !data?.result?.link) {
      // Fallback: pesquisa e pega o primeiro resultado
      const search = await fetchJson(
        `${BASE}/youtube/search?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
      );
      const first = search?.result?.[0];
      if (!first?.url) {
        await sendError(sock, jid, msg, '❌ Não encontrei essa música.');
        return;
      }
      // tenta baixar pelo link direto
      const data2 = await fetchJson(
        `${BASE}/youtube2mp3?apikey=${API_KEY}&url=${encodeURIComponent(first.url)}`
      );
      if (!data2?.result?.downloadUrl) {
        await sendError(sock, jid, msg, '❌ Não consegui baixar essa música.');
        return;
      }
      Object.assign(data, data2);
    }

    const result      = data.result;
    const downloadUrl = result.downloadUrl || result.link;

    await sendMetaCard(sock, jid, msg, {
      title:    result.title    || query,
      uploader: result.channel  || result.uploader || null,
      duration: result.duration || null,
      thumbnail: result.thumbnail || null,
    }, query);

    const audioBuffer = await fetchBuffer(downloadUrl);
    await sock.sendMessage(jid, {
      audio:    audioBuffer,
      mimetype: 'audio/mpeg',
      ptt:      false,
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[play]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar música.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !play_video (vídeo via API) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handlePlayVideo(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]play_video2?\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.play_video <vídeo>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(
      `${BASE}/youtube2mp4?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
    );

    if (!data?.result?.downloadUrl && !data?.result?.link) {
      await sendError(sock, jid, msg, '❌ Não encontrei esse vídeo.');
      return;
    }

    const result      = data.result;
    const downloadUrl = result.downloadUrl || result.link;

    await sendMetaCard(sock, jid, msg, {
      title:    result.title    || query,
      uploader: result.channel  || result.uploader || null,
      duration: result.duration || null,
      views:    result.views    || result.view_count || null,
      thumbnail: result.thumbnail || null,
    }, query);

    const vidBuffer = await safeFetch(downloadUrl);
    if (!vidBuffer) {
      await sendError(sock, jid, msg, '❌ Vídeo muito grande (máx 64 MB).');
      return;
    }

    await sock.sendMessage(jid, { video: vidBuffer, mimetype: 'video/mp4' }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[play_video]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar vídeo.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !youtube / !youtubemp4 / !youtubemp3 ────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleYouTube(sock, msg, jid, caption, format = 'info') {
  const link = caption.replace(/^[!.](youtube|youtubemp4|youtubemp3)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.youtube <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const endpoint = format === 'mp3' ? 'youtube2mp3' : 'youtube2mp4';
    const data     = await fetchJson(`${BASE}/${endpoint}?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    if (!data?.result) {
      await sendError(sock, jid, msg, '❌ Não consegui processar o link.');
      return;
    }

    const result = data.result;
    await sendMetaCard(sock, jid, msg, {
      title:    result.title    || null,
      uploader: result.channel  || result.uploader || null,
      duration: result.duration || null,
      views:    result.views    || result.view_count || null,
      thumbnail: result.thumbnail || result.image || null,
    }, link);

    const downloadUrl = result.downloadUrl || result.link;
    if (!downloadUrl) {
      await sendError(sock, jid, msg, '❌ Link de download não disponível.');
      return;
    }

    if (format === 'mp3') {
      const buf = await fetchBuffer(downloadUrl);
      await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    } else if (format === 'mp4') {
      const buf = await safeFetch(downloadUrl);
      if (!buf) {
        await sendError(sock, jid, msg, '❌ Vídeo muito grande (máx 64 MB).');
        return;
      }
      await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4' }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[youtube]', e.message);
    await sendError(sock, jid, msg, `❌ Erro ao baixar (${format}).`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !instagram ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleInstagram(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](instagram2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.instagram <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/instagram?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    if (!data?.result?.length) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar esse post.');
      return;
    }

    const first = data.result[0];
    await sendMetaCard(sock, jid, msg, {
      title:     first.caption   || null,
      thumbnail: first.thumbnail || first.url || null,
    }, link);

    let sent = 0;
    for (const media of data.result.slice(0, 5)) {
      try {
        if (media.type === 'image') {
          const buf = await fetchBuffer(media.url);
          await sock.sendMessage(jid, { image: buf }, { quoted: msg });
          sent++;
        } else if (media.type === 'video') {
          const buf = await safeFetch(media.url);
          if (!buf) continue;
          await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4' }, { quoted: msg });
          sent++;
        }
      } catch (e) {
        console.warn('[instagram] item falhou:', e.message);
      }
    }

    if (sent === 0) {
      await sendError(sock, jid, msg, '❌ Nenhuma mídia pôde ser enviada.');
      return;
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[instagram]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Instagram.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !tiktok ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleTikTok(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](tiktok2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.tiktok <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/tiktok?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    if (!data?.result) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar esse TikTok.');
      return;
    }

    const { title, author, duration, thumbnail } = data.result;
    const videoUrl = data.result.link || data.result.downloadUrl || data.result.video;

    if (!videoUrl) {
      await sendError(sock, jid, msg, '❌ URL de download não encontrada.');
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title:    title     || null,
      uploader: author?.nickname || author?.name || null,
      duration: duration  || null,
      thumbnail: thumbnail || null,
    }, link);

    const buf = await safeFetch(videoUrl);
    if (!buf) {
      await sendError(sock, jid, msg, '❌ Vídeo muito grande (máx 64 MB).');
      return;
    }

    await sock.sendMessage(jid, {
      video:    buf,
      mimetype: 'video/mp4',
      caption:  `🎵 ${title || 'TikTok'}`,
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[tiktok]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar TikTok.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !facebook ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleFacebook(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](facebook2?)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.facebook <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/facebook?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    const downloadUrl = data?.result?.download || data?.result?.downloadUrl || data?.result?.link;
    if (!downloadUrl) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar esse vídeo.');
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title:    data.result.title    || null,
      duration: data.result.duration || null,
      uploader: data.result.uploader || null,
      thumbnail: data.result.thumbnail || null,
    }, link);

    const buf = await safeFetch(downloadUrl);
    if (!buf) {
      await sendError(sock, jid, msg, '❌ Vídeo muito grande (máx 64 MB).');
      return;
    }

    await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4' }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[facebook]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Facebook.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !twitter / !x ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleTwitter(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.](twitter|x)\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.twitter <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/twitter?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    const items  = data?.result ? (Array.isArray(data.result) ? data.result : [data.result]) : [];
    const first  = items[0];

    if (!first?.url) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar esse post.');
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title:    first.title || first.text || null,
      thumbnail: first.thumbnail || null,
      duration: first.duration   || null,
    }, link);

    for (const item of items.slice(0, 3)) {
      try {
        const buf = await safeFetch(item.url);
        if (!buf) continue;
        if (item.type === 'image' || /\.(jpg|jpeg|png|webp)/i.test(item.url)) {
          await sock.sendMessage(jid, { image: buf }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4' }, { quoted: msg });
        }
      } catch (e) {
        console.warn('[twitter] item falhou:', e.message);
      }
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[twitter]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Twitter/X.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !pinterest ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handlePinterest(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.](pinterest2?)\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.pinterest <nome ou link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const isLink = /^https?:\/\//i.test(query) || /pinterest\.com/i.test(query);

  try {
    if (isLink) {
      const data = await fetchJson(`${BASE}/pinterest?apikey=${API_KEY}&url=${encodeURIComponent(query)}`);
      const imgUrl = data?.result;

      if (!imgUrl) {
        await sendError(sock, jid, msg, '❌ Não consegui baixar essa imagem.');
        return;
      }

      const buf = await fetchBuffer(imgUrl);
      await sock.sendMessage(jid, { image: buf }, { quoted: msg });
    } else {
      // Pesquisa por termo
      const data = await fetchJson(
        `${BASE}/google/image?apikey=${API_KEY}&query=${encodeURIComponent(query + ' pinterest')}`
      );

      if (!data?.result?.length) {
        await sendError(sock, jid, msg, '❌ Nenhuma imagem encontrada.');
        return;
      }

      let sent = 0;
      for (const img of data.result.slice(0, 3)) {
        try {
          const buf = await fetchBuffer(img);
          await sock.sendMessage(jid, { image: buf }, { quoted: msg });
          sent++;
        } catch { /* tenta próximo */ }
      }

      if (sent === 0) {
        await sendError(sock, jid, msg, '❌ Nenhuma imagem pôde ser enviada.');
        return;
      }
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[pinterest]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Pinterest.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !spotify ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleSpotify(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.]spotify\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.spotify <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/spotify?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    const previewUrl = data?.result?.preview_url;
    if (!previewUrl) {
      await sendError(sock, jid, msg, '❌ Preview não disponível para essa faixa.');
      return;
    }

    const title  = data.result.name   || 'Spotify';
    const artist = data.result.artist || 'Desconhecido';

    await sendMetaCard(sock, jid, msg, {
      title,
      uploader:  artist,
      thumbnail: data.result.thumbnail || null,
      duration:  data.result.duration  || null,
    }, link);

    const buf = await fetchBuffer(previewUrl);
    await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[spotify]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Spotify.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !soundcloud ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleSoundCloud(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.]soundcloud\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.soundcloud <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/soundcloud?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    const downloadUrl = data?.result?.download || data?.result?.downloadUrl;
    if (!downloadUrl) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar essa faixa.');
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title:    data.result.title    || null,
      uploader: data.result.uploader || data.result.artist || null,
      duration: data.result.duration || null,
      thumbnail: data.result.thumbnail || null,
    }, link);

    const buf = await fetchBuffer(downloadUrl);
    await sock.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[soundcloud]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar SoundCloud.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !gimage ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleGImage(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]gimage\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.gimage <termo>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(
      `${BASE}/google/image?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
    );

    if (!data?.result?.length) {
      await sendError(sock, jid, msg, '❌ Nenhuma imagem encontrada.');
      return;
    }

    let sent = 0;
    for (const img of data.result.slice(0, 3)) {
      try {
        const buf = await fetchBuffer(img);
        await sock.sendMessage(jid, { image: buf }, { quoted: msg });
        sent++;
      } catch { /* tenta próximo */ }
    }

    if (sent === 0) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar as imagens.');
      return;
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[gimage]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao buscar imagens.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !pesquisayt ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handlePesquisaYT(sock, msg, jid, caption) {
  const query = caption.replace(/^[!.]pesquisayt\s*/i, '').trim();
  if (!query) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.pesquisayt <termo>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(
      `${BASE}/youtube/search?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
    );

    if (!data?.result?.length) {
      await sendError(sock, jid, msg, '❌ Nenhum vídeo encontrado.');
      return;
    }

    let texto = `🔍 *Resultados para "${query}"*\n\n`;
    data.result.slice(0, 5).forEach((v, i) => {
      texto += `*${i + 1}.* ${v.title}\n`;
      if (v.duration) texto += `⏱️ ${v.duration}  `;
      if (v.views)    texto += `👁️ ${Number(v.views).toLocaleString('pt-BR')} views`;
      texto += `\n🔗 ${v.url}\n\n`;
    });

    await sock.sendMessage(jid, { text: texto.trim() }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[pesquisayt]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao pesquisar no YouTube.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !twitch ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleTwitch(sock, msg, jid, caption) {
  const link = caption.replace(/^[!.]twitch\s*/i, '').trim();
  if (!link) {
    await sock.sendMessage(jid, { text: '⚠️ Digite: *.twitch <link>*' }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  try {
    const data = await fetchJson(`${BASE}/twitch?apikey=${API_KEY}&url=${encodeURIComponent(link)}`);

    const videoUrl = data?.result?.video_url || data?.result?.downloadUrl;
    if (!videoUrl) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar esse clipe.');
      return;
    }

    await sendMetaCard(sock, jid, msg, {
      title:    data.result.title     || null,
      thumbnail: data.result.thumbnail || null,
      duration: data.result.duration  || null,
    }, link);

    const buf = await safeFetch(videoUrl);
    if (!buf) {
      await sendError(sock, jid, msg, '❌ Vídeo muito grande (máx 64 MB).');
      return;
    }

    await sock.sendMessage(jid, { video: buf, mimetype: 'video/mp4' }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[twitch]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao baixar Twitch.');
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !wallpapers ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function handleWallpapers(sock, msg, jid, category = 'wallpapers') {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

  const queries = {
    animes:     'anime wallpaper 4k',
    carros:     'car wallpaper 4k',
    wallpapers: 'wallpaper 4k',
  };
  const query = queries[category] || 'wallpaper 4k';

  try {
    const data = await fetchJson(
      `${BASE}/google/image?apikey=${API_KEY}&query=${encodeURIComponent(query)}`
    );

    if (!data?.result?.length) {
      await sendError(sock, jid, msg, '❌ Nenhum wallpaper encontrado.');
      return;
    }

    let sent = 0;
    for (const img of data.result.slice(0, 3)) {
      try {
        const buf = await fetchBuffer(img);
        await sock.sendMessage(jid, { image: buf }, { quoted: msg });
        sent++;
      } catch { /* tenta próximo */ }
    }

    if (sent === 0) {
      await sendError(sock, jid, msg, '❌ Não consegui baixar os wallpapers.');
      return;
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
  } catch (e) {
    console.error('[wallpapers]', e.message);
    await sendError(sock, jid, msg, '❌ Erro ao buscar wallpapers.');
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────
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
};