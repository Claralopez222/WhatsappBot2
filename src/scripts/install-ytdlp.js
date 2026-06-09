/**
 * src/scripts/install-ytdlp.js
 * Instala yt-dlp via pip no Linux (Render).
 * No Windows é ignorado.
 */
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  console.log('Windows detectado — pulando instalação do yt-dlp.');
  process.exit(0);
}

function run(cmd) {
  return execSync(cmd, { timeout: 60000, stdio: 'inherit' });
}

// Já instalado?
try {
  const ver = execSync('yt-dlp --version', { timeout: 5000 }).toString().trim();
  console.log('✅ yt-dlp já instalado:', ver);
  process.exit(0);
} catch {}

console.log('⬇️  Instalando yt-dlp via pip...');
try {
  run('pip install -q yt-dlp');
  const ver = execSync('yt-dlp --version', { timeout: 5000 }).toString().trim();
  console.log('✅ yt-dlp', ver, 'instalado com sucesso!');
} catch (e) {
  console.error('❌ Falha ao instalar yt-dlp via pip:', e.message);
  // Tenta pip3
  try {
    run('pip3 install -q yt-dlp');
    const ver = execSync('yt-dlp --version', { timeout: 5000 }).toString().trim();
    console.log('✅ yt-dlp', ver, 'instalado via pip3!');
  } catch (e2) {
    console.error('❌ Falha também com pip3:', e2.message);
    process.exit(1);
  }
}