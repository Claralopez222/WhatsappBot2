/**
 * scripts/install-ytdlp.js
 * Baixa o binário yt-dlp no Linux (Render) em tempo de build.
 * No Windows é ignorado (usa yt-dlp do PATH local).
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

if (process.platform === 'win32') {
  console.log('Windows detectado — pulando instalação do yt-dlp.');
  process.exit(0);
}

const DEST = path.resolve(__dirname, '..', 'yt-dlp');
const URL  = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

// Já existe e é executável?
if (fs.existsSync(DEST)) {
  try {
    execSync(`${DEST} --version`, { timeout: 5000 });
    console.log('✅ yt-dlp já instalado:', DEST);
    process.exit(0);
  } catch {
    console.log('⚠️ yt-dlp existente mas com problema — re-baixando...');
  }
}

console.log('⬇️  Baixando yt-dlp de', URL);

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Muitos redirecionamentos'));
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error',  reject);
    }).on('error', reject);
  });
}

download(URL, DEST)
  .then(() => {
    fs.chmodSync(DEST, 0o755);
    const ver = execSync(`${DEST} --version`, { timeout: 10000 }).toString().trim();
    console.log(`✅ yt-dlp ${ver} instalado em ${DEST}`);
  })
  .catch(err => {
    console.error('❌ Falha ao instalar yt-dlp:', err.message);
    process.exit(1);
  });