/**
 * WhatsApp Sticker Bot – Piroquinhas
 * bot.js principal – Integrado com o router modular (router.js)
 */
require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ─── Core Node.js ─────────────────────────────────────────────────────────────
const path = require('path');
const fs   = require('fs');

// ─── Dependências externas ────────────────────────────────────────────────────
const {
  default: makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { useMongoAuthState, clearMongoAuthState } = require('./mongoAuthState');
const { Boom }  = require('@hapi/boom');
const pino      = require('pino');
const QRCode    = require('qrcode');
const mongoose  = require('mongoose');

// ─── Scripts & Utils ──────────────────────────────────────────────────────────
const { rodarAtualizacao } = require('./scripts/atualizarGrupos.js');
const { acquireLock, startHeartbeat, releaseLock } = require('./utils/instanceLock');
const { saveData } = require('./utils/persistence');

// ─── Router & Handlers ────────────────────────────────────────────────────────
// Fix #3: Conectado ao router.js modular!
const { handleMessage, setBotJid } = require('./router');
const { processarBemVindo }       = require('./handlers/grupo');

const { initPetScheduler, registerActiveGroup, initFilhosScheduler } = require('./handlers/diversao');
const { initQuizRankingScheduler }                                   = require('./handlers/quizRanking');
const downloadsHandler                                               = require('./handlers/utilidade/downloads');

// ─── Silenciar logs ruidosos ──────────────────────────────────────────────────
const _log = console.log.bind(console);
const _err = console.error.bind(console);
const NOISE = [
  'Closing open session', 'Closing session:', 'SessionEntry', '_chains',
  'registrationId', 'currentRatchet', 'indexInfo', 'ephemeralKeyPair',
  'lastRemoteEphemeralKey', 'previousCounter', 'rootKey', 'baseKey',
  'remoteIdentityKey', 'Bad MAC', 'MessageCounterError', 'Failed to decrypt',
  'chainKey', 'chainType', 'messageKeys', 'pubKey', 'privKey',
];
const isNoise = (...args) => {
  try {
    for (const x of args) {
      if (x && typeof x === 'object') {
        const keys = Object.keys(x);
        if (keys.some(k => NOISE.includes(k))) return true;
        const name = x?.constructor?.name || '';
        if (name === 'SessionEntry' || NOISE.some(p => name.includes(p))) return true;
      }
    }
    const s = args
      .map(x => { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch { return ''; } })
      .join(' ');
    return NOISE.some(p => s.includes(p));
  } catch { return false; }
};
console.log   = (...a) => { if (!isNoise(...a)) _log(...a); };
console.error = (...a) => { if (!isNoise(...a)) _err(...a); };

// ─── Diretórios ───────────────────────────────────────────────────────────────
const SESSION_DIR = path.resolve(__dirname, '../session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let _botSock = null;

// ─── Guards de crash ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection capturado:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ uncaughtException capturado:', err?.message || err);
});

process.on('SIGINT',  async () => { saveData(); await releaseLock(); process.exit(); });
process.on('SIGTERM', async () => { saveData(); await releaseLock(); process.exit(); });

// ─── Logger global ───────────────────────────────────────────────────────────
const logger = pino({ level: 'silent' });

// ─── Iniciar bot ───────────────────────────────────────────────────────────────
async function startBot() {
  if (_botSock) {
    console.warn('⚠️ startBot() chamado, mas já existe um socket ativo.');
    return;
  }

  const { state, saveCreds } = await useMongoAuthState();
  const { version }          = await fetchLatestBaileysVersion();

  console.log(`\n🤖 Iniciando bot com Baileys v${version.join('.')}\n`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['Ubuntu', 'Chrome-Bot', '1.0.0'],
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(
        message.buttonsMessage  ||
        message.templateMessage ||
        message.listMessage     ||
        message.stickerMessage
      );
      if (requiresPatch) {
        message = {
          viewOnceMessageV2: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
              },
              ...message,
            },
          },
        };
      }
      return message;
    },
  });

  _botSock = sock;

  sock.ev.on('creds.update', saveCreds);

  // Votos de enquete
  const grupoHandler = require('./handlers/grupo');
  grupoHandler.registerPollVoteHandler(sock);

  // Boas-Vindas em novos membros no grupo
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (action === 'add') {
      for (const p of participants) {
        await processarBemVindo(sock, id, p, p.split('@')[0]);
      }
    }
  });

  // Mensagens
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error('❌ Erro no processamento da mensagem:', err?.stack || err?.message || err);
      }
    }
  });

  // Conexão
  let schedulersIniciados = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR Code:\n');
      try {
        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
        await QRCode.toFile(path.resolve(__dirname, '../qrcode.png'), qr, { width: 400 });
      } catch (err) {
        console.error('[QRCode] Erro ao gerar QR:', err.message);
      }
    }

    if (connection === 'close') {
      schedulersIniciados = false;
      _botSock = null;

      const code   = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const motivo = lastDisconnect?.error?.message ?? 'desconhecido';
      const logado = code !== DisconnectReason.loggedOut;

      console.warn(`🔌 Desconectado. Código: ${code} | Motivo: ${motivo}`);

      if (code === DisconnectReason.connectionReplaced) {
        console.error('🚨 CONEXÃO SUBSTITUÍDA (440). Parando...');
        await releaseLock();
        process.exit(1);
      }

      if (logado) {
        const isRestartRequired = code === DisconnectReason.restartRequired;
        const delay = isRestartRequired ? 1_000 : 3_000;

        console.log(`🔄 Reconectando em ${delay / 1000}s...`);
        setTimeout(() => {
          startBot().catch(err => console.error('❌ Erro ao reiniciar:', err));
        }, delay);
      } else {
        console.log('🚪 Sessão encerrada no WhatsApp (loggedOut - 401). Limpando credenciais...');
        await clearMongoAuthState();
        saveData();
        await releaseLock();
        console.log('\n⚠️ Credenciais resetadas com sucesso! Execute "npm start" para gerar um novo QR Code.\n');
        process.exit(0);
      }
    }

    if (connection === 'open') {
      const bJid = sock.user?.id ?? null;
      setBotJid(bJid);
      console.log(`✅ Bot conectado! JID: ${bJid}\n`);

      if (!schedulersIniciados) {
        initPetScheduler(sock);
        initQuizRankingScheduler(sock, new Set());
        initFilhosScheduler();

        setInterval(() => downloadsHandler.limparTmpAntigos(10 * 60 * 1000), 5 * 60 * 1000);
        downloadsHandler.limparTmpAntigos(10 * 60 * 1000);

        schedulersIniciados = true;
        console.log('[Schedulers] Iniciados.');

        setTimeout(() => rodarAtualizacao(sock), 8000);
      }
    }
  });
}

// ── Iniciar ───────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/piroquinhas';
  try {
    console.log('⏳ Conectando ao MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB conectado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err.message);
    process.exit(1);
  }

  const acquired = await acquireLock();
  if (acquired) {
    startHeartbeat();
    startBot().catch(console.error);
  } else {
    console.error('🚨 Outra instância do bot já está rodando. Encerrando...');
    process.exit(1);
  }
}

main().catch(console.error);
