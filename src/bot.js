/**
 * WhatsApp Sticker Bot – Piroquinhas
 * bot.js principal – roteador completo
 */
require('dotenv').config(); // Carrega o .env nativamente na raiz do projeto

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ─── Core Node.js (SEMPRE PRIMEIRO) ──────────────────────────────────────────
const path = require('path');
const fs   = require('fs');

// ─── Dependências externas ────────────────────────────────────────────────────
const {
  default: makeWASocket,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { useMongoAuthState } = require('./mongoAuthState');
const { Boom }  = require('@hapi/boom');
const pino      = require('pino');
const QRCode    = require('qrcode');
const mongoose  = require('mongoose');

// ─── Scripts ───────────────────────────────────────────────────────────────────
const { rodarAtualizacao } = require('./scripts/atualizarGrupos.js');

// ─── Models ───────────────────────────────────────────────────────────────────
const Usuario       = require(path.join(__dirname, 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, 'models', 'CarteiraGrupo'));
const LidMapping    = require(path.join(__dirname, 'models', 'LidMapping'));

// Salva (ou atualiza) o par LID ↔ telefone real. Roda em background, sem
// travar o processamento da mensagem — se falhar, só loga e segue a vida.
async function salvarLidMapping(lid, pn) {
  if (!lid || !pn || !lid.endsWith('@lid')) return;
  try {
    await LidMapping.findOneAndUpdate({ lid }, { $set: { pn } }, { upsert: true });
  } catch (e) {
    console.error('⚠️ Erro ao salvar LID mapping:', e.message);
  }
}

// ─── Utils ───────────────────────────────────────────────────────────────────
const { normalizarJid } = require('./utils/jid');

function gerarVariantesNumero(termo) {
  const digitos = String(termo || '').replace(/\D/g, '');
  const variantes = new Set([digitos]);

  if (digitos.startsWith('55') && digitos.length >= 12) {
    const ddd   = digitos.slice(2, 4);
    const resto = digitos.slice(4);

    if (resto.length === 8) {
      variantes.add(`55${ddd}9${resto}`);
    } else if (resto.length === 9 && resto.startsWith('9')) {
      variantes.add(`55${ddd}${resto.slice(1)}`);
    }
  }

  return [...variantes];
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
const { prepareDailyMissionState } = require(path.join(__dirname, 'handlers', 'diversao', 'missoes'));

const figurinhaHandler      = require(path.join(__dirname, 'handlers', 'figurinha'));
const diversaoHandler       = require(path.join(__dirname, 'handlers', 'diversao'));
const relacionamentoHandler = require(path.join(__dirname, 'handlers', 'relacionamento'));
const grupoHandler        = require('./handlers/grupo');
const medievalHandler     = require('./handlers/medieval');
const medievalLojaHandler = require('./handlers/medievalLoja');
const imagemHandler         = require(path.join(__dirname, 'handlers', 'imagem'));
const textoHandler          = require(path.join(__dirname, 'handlers', 'texto'));
const utilidadeHandler      = require(path.join(__dirname, 'handlers', 'utilidade', 'index.js'));
const aniversarioHandler    = require(path.join(__dirname, 'handlers', 'aniversario'));
const alteradoresHandler    = require(path.join(__dirname, 'handlers', 'alteradores'));
const downloadsHandler      = require(path.join(__dirname, 'handlers', 'utilidade', 'downloads'));
const pinnedHandler         = require(path.join(__dirname, 'handlers', 'diversao', 'pinned'));
const pescaHandler          = require(path.join(__dirname, 'handlers', 'diversao', 'pesca'));

const { handleRankGold, handleGive }                                        = require(path.join(__dirname, 'handlers', 'diversao', 'economia'));
const { handleEmprestimo, handlePayEmprestimo, handleDivida }               = require(path.join(__dirname, 'handlers', 'diversao', 'emprestimo'));
const { initPetScheduler, registerActiveGroup, initFilhosScheduler }        = require(path.join(__dirname, 'handlers', 'diversao'));
const { initQuizRankingScheduler }                                          = require(path.join(__dirname, 'handlers', 'quizRanking'));
const painelHandler = require(path.join(__dirname, 'handlers', 'painel'));
const { isMuted, unmuteUser } = require(path.join(__dirname, 'handlers', 'grupo'));

// ─── Silenciar logs de sessão ─────────────────────────────────────────────────
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

// ─── Persistência ─────────────────────────────────────────────────────────────
const DATA_FILE = path.resolve(__dirname, '../data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.log('⚠️ Erro ao carregar data.json:', e.message); }
  return {
    msgCount:       {},
    stickerCount:   {},
    cmdCount:       {},
    pinnedMessages: {},
    groupConfig:    {},
    warnings:       {},
    relacionamentos:          {},
    relacionamentoXp:         {},
    relacionamentoBloqueados: {},
    relacionamentoDiarios:    {},
    relacionamentoXpBonus:    {},
  };
}

const _savedData   = loadData();
const msgCount     = new Map(Object.entries(_savedData.msgCount     || {}));
const stickerCount = new Map(Object.entries(_savedData.stickerCount || {}));
const cmdCount     = new Map(Object.entries(_savedData.cmdCount     || {}));

// Warnings: Map<groupJid, Map<userJid, count>>
const warnings = new Map();
for (const [gJid, usersObj] of Object.entries(_savedData.warnings || {})) {
  if (typeof usersObj === 'object') warnings.set(gJid, new Map(Object.entries(usersObj)));
}

// ── Restaura relacionamentos e estados associados ──
const relacionamentos = new Map(Object.entries(_savedData.relacionamentos || {}));

for (const [k, v] of Object.entries(_savedData.relacionamentoXp || {})) {
  relacionamentoHandler.xpCasais.set(k, v);
}
for (const [k, v] of Object.entries(_savedData.relacionamentoBloqueados || {})) {
  relacionamentoHandler.bloqueados.set(k, v);
}
for (const [k, v] of Object.entries(_savedData.relacionamentoDiarios || {})) {
  relacionamentoHandler.diariosUsados.set(k, v);
}
for (const [k, v] of Object.entries(_savedData.relacionamentoXpBonus || {})) {
  relacionamentoHandler.xpBonus.set(k, v);
}

console.log(`📂 Dados carregados: ${msgCount.size} usuário(s) no histórico, ${relacionamentos.size} relacionamento(s)`);

function saveData() {
  try {
    const existingData = fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {}
      : {};

    const warningsObj = {};
    for (const [gJid, usersMap] of warnings.entries()) {
      warningsObj[gJid] = Object.fromEntries([...usersMap.entries()]);
    }

    const data = {
      ...existingData,
      msgCount:       Object.fromEntries([...msgCount.entries()]),
      stickerCount:   Object.fromEntries([...stickerCount.entries()]),
      cmdCount:       Object.fromEntries([...cmdCount.entries()]),
      warnings:       warningsObj,
      groupConfig: {
        antiLink:    [...antiLinkGroups],
        autoSticker: [...autoStickerGroups],
        prefixos:    Object.fromEntries([...prefixMap.entries()]),
      },
      relacionamentos:          Object.fromEntries([...relacionamentos.entries()]),
      relacionamentoXp:         Object.fromEntries([...relacionamentoHandler.xpCasais.entries()]),
      relacionamentoBloqueados: Object.fromEntries([...relacionamentoHandler.bloqueados.entries()]),
      relacionamentoDiarios:    Object.fromEntries([...relacionamentoHandler.diariosUsados.entries()]),
      relacionamentoXpBonus:    Object.fromEntries([...relacionamentoHandler.xpBonus.entries()]),
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.log('⚠️ Erro ao salvar data.json:', e.message); }
}

setInterval(saveData, 60 * 1000);
process.on('SIGINT',  () => { saveData(); process.exit(); });
process.on('SIGTERM', () => { saveData(); process.exit(); });

// ── Configuração de grupo salva ───────────────────────────────────────────────
const _cfg = _savedData.groupConfig || {};
const antiLinkGroups    = new Set(_cfg.antiLink    || []);
const autoStickerGroups = new Set(_cfg.autoSticker || []);
const prefixMap         = new Map();
if (_cfg.prefixos) {
  for (const [k, v] of Object.entries(_cfg.prefixos)) prefixMap.set(k, v);
}

function getPrefix(jid) { return prefixMap.get(jid) || '!'; }

// ─── Estado Global adicional (faltante) ────────────────────────────────────
const contactNames     = {};
const mutedUsers       = new Map();
const pendingMusic     = new Map();
const activeGroups     = new Set();
const pedidosPendentes = new Map();
const pinnedMessages   = new Map(Object.entries(_savedData.pinnedMessages || {}));
const lastTexts        = new Map();

// ─── Limpeza de arquivos temporários ───────────────────────────────────────
const TMP_DIR = path.resolve(__dirname, '../tmp');

function limparTmpAntigos(maxAgeMs = 10 * 60 * 1000) {
  try {
    if (!fs.existsSync(TMP_DIR)) return;

    const agora = Date.now();
    const arquivos = fs.readdirSync(TMP_DIR);

    for (const nome of arquivos) {
      const caminho = path.join(TMP_DIR, nome);
      try {
        const stat = fs.statSync(caminho);
        if (!stat.isFile()) continue;

        const idadeMs = agora - stat.mtimeMs;
        if (idadeMs > maxAgeMs) {
          fs.unlinkSync(caminho);
          console.log(`🧹 Removido tmp antigo: ${nome}`);
        }
      } catch (e) {
        console.log(`⚠️ Erro ao processar tmp "${nome}":`, e.message);
      }
    }
  } catch (e) {
    console.log('⚠️ Erro ao limpar pasta tmp:', e.message);
  }
}

// ── XP do usuário ─────────────────────────────────────────────────────────────
async function addUserXp(userId, xp = 1, pushName = null) {
  if (!userId) return null;

  // Normaliza o JID antes de qualquer operação
  const userIdNorm = normalizarJid(userId);
if (!userIdNorm) return null;

  try {
    await prepareDailyMissionState(userIdNorm);

    const update = {
      $inc: { xp, mensagens: 1, 'dailyMissions.progress.xp100': xp },
      $setOnInsert: { level: 1, idWhatsApp: userIdNorm, createdAt: new Date() },
    };
    if (pushName) update.$set = { nome: pushName };

    const updated = await Usuario.findOneAndUpdate(
      { idWhatsApp: userIdNorm },
      update,
      { new: true, upsert: true }
    );

    // Mesma fórmula do bot.js — progressão exponencial
    const xpAtual   = updated?.xp ?? 0;
    const levelNovo = Math.floor(Math.pow(xpAtual / 100, 1 / 1.5)) + 1;

    if ((updated?.level ?? 1) !== levelNovo) {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userIdNorm },
        { $set: { level: levelNovo } }
      );
      updated.level = levelNovo;
    }

    return updated;
  } catch (e) {
    console.error('⚠️ Erro ao atualizar XP do usuário:', e.message);
    return null;
  }
}

// ── Carregar relacionamentos do MongoDB ───────────────────────────────────────
// NOTA: desativada. `Usuario.casadoCom` é um campo GLOBAL por pessoa, mas
// `relacionamentos` agora é escopado por grupo (relKey(jid, a, b)).
// Não é possível reconstruir o casamento por grupo a partir desse campo —
// ele serve apenas para checagens de bigamia/fidelidade em handleRelacionamento.
// Os relacionamentos por grupo são restaurados via data.json no boot.
// Se data.json for perdido (deploy no Render), os casamentos por grupo
// precisam ser recriados — recomenda-se migrar para um model `Relacionamento`
// com idGrupo, jidA, jidB, tipo e desde no MongoDB.
async function loadRelationshipsFromDb() {
  // Desativada — ver nota acima.
  return;
}

// ─── Helpers de prefixo ─────────────────────────────────────────────────────
const VALID_PREFIXES = ['!', '.', '/', ','];

function isAnyCmd(text) {
  return VALID_PREFIXES.some(p => text.startsWith(p));
}
function matchCmd(raw, cmdName) {
  for (const p of VALID_PREFIXES) {
    if (raw === p + cmdName) return true;
  }
  return false;
}
function matchCmdStart(raw, cmdName) {
  for (const p of VALID_PREFIXES) {
    if (raw.startsWith(p + cmdName)) return true;
  }
  return false;
}
// â”€â”€â”€ Contadores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function contarSticker(jid) {
  stickerCount.set(jid, (stickerCount.get(jid) || 0) + 1);
  saveData();
}
function contarCmd(jid) {
  cmdCount.set(jid, (cmdCount.get(jid) || 0) + 1);
  if (cmdCount.get(jid) % 5 === 0) saveData();
}
function contarMensagem(jid, nome) {
  const cur = msgCount.get(jid) || { nome, count: 0 };
  cur.nome  = nome || cur.nome;
  cur.count++;
  msgCount.set(jid, cur);
  if (cur.count % 10 === 0) saveData();
}

// ─── Logger global (usado pelo socket e pelos handlers) ───────────────────────
const logger = pino({ level: 'silent' });

// ─── Configurar Handlers ────────────────────────────────────────────────────
figurinhaHandler.setLogger(logger);
imagemHandler.setLogger(logger);
alteradoresHandler.setLogger(logger);
downloadsHandler.setLogger(logger);

// ─── Helpers de formatação ──────────────────────────────────────────────────
function formatarNumeroBR(jid) {
  const numeroPuro = jid.split('@')[0];

  if (numeroPuro.startsWith('55') && numeroPuro.length === 12) {
    const ddd    = numeroPuro.slice(2, 4);
    const parte1 = numeroPuro.slice(4, 8);
    const parte2 = numeroPuro.slice(8, 12);
    return `+55 (${ddd}) 9${parte1}-${parte2}`;
  }

  if (numeroPuro.startsWith('55') && numeroPuro.length === 13) {
    const ddd    = numeroPuro.slice(2, 4);
    const parte1 = numeroPuro.slice(4, 9);
    const parte2 = numeroPuro.slice(9, 13);
    return `+55 (${ddd}) ${parte1}-${parte2}`;
  }

  return `+${numeroPuro}`;
}

function getSenderName(msg) {
  return msg.pushName || msg.key.remoteJid?.split('@')[0] || 'Usuário';
}

// ── Iniciar bot ───────────────────────────────────────────────────────────────
async function startBot() {
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

  // ── Credenciais ───────────────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Atualizar nomes de contato ────────────────────────────────────────────────
  sock.ev.on('contacts.upsert', cs => {
    for (const c of cs) if (c.name || c.notify) contactNames[c.id] = c.name || c.notify;
  });

  sock.ev.on('contacts.update', cs => {
    for (const c of cs) if (c.name || c.notify) contactNames[c.id] = c.name || c.notify;
  });

  // ── Mensagens ─────────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message)   continue;

      const _jid       = msg.key.remoteJid || '';
      const _isPrivate = !_jid.endsWith('@g.us') && !_jid.endsWith('@broadcast');

      if (_isPrivate) {
        const _txt = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        console.log(`📩 Privado | ${_jid} | "${_txt.slice(0, 50)}"`);
      }

      (async () => {
        try {
          if (!_isPrivate) {
            const remetente     = msg.key.participant || msg.key.remoteJid;
            const remetenteNorm = normalizarJid(remetente);
            if (!remetenteNorm) return;

            // ── Captura o par LID↔telefone
            if (remetenteNorm.endsWith('@lid') && msg.key.participantPn) {
              const pnNorm = normalizarJid(msg.key.participantPn);
              if (pnNorm) salvarLidMapping(remetenteNorm, pnNorm);
            }

            const nomeDoCara = msg.pushName || 'Usuário do Zap';

            await prepareDailyMissionState(remetenteNorm);

            // ── Bônus diário de 100 gold (primeira mensagem do dia no grupo) ──
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            let remetenteReal = remetenteNorm;

// Se for @s.whatsapp.net, verifica se existe carteira com @lid no mesmo grupo
if (!remetenteNorm.endsWith('@lid')) {
  const lidMap = await LidMapping.findOne({ pn: remetenteNorm }).lean();
  if (lidMap?.lid) {
    const carteiraLid = await CarteiraGrupo.findOne({ idWhatsApp: lidMap.lid, idGrupo: _jid }).lean();
    if (carteiraLid) remetenteReal = lidMap.lid;
  }
}

const carteiraAtual = await CarteiraGrupo.findOne(
  { idWhatsApp: remetenteReal, idGrupo: _jid },
  { ultimoBonusDiario: 1, gold: 1 }
).lean();

            const recebeuHoje = carteiraAtual?.ultimoBonusDiario
              && new Date(carteiraAtual.ultimoBonusDiario) >= hoje;

            const incCarteira = { mensagens: 1, xp: 1 };
            const setCarteira = { nome: nomeDoCara };

            if (!recebeuHoje && carteiraAtual) {
              incCarteira.gold = 100;
              setCarteira.ultimoBonusDiario = new Date();
            }

            if (carteiraAtual) {
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: remetenteReal, idGrupo: _jid },
    { $inc: incCarteira, $set: setCarteira },
    { new: true }
  );

  if (!recebeuHoje) {
    await sock.sendMessage(_jid, {
      text: `🪙 *${nomeDoCara}*, você ganhou seu bônus diário de *100 gold*! Volte amanhã para ganhar mais. 💰`,
      mentions: [remetenteReal],
    }).catch(() => {});
  }
} else {
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: remetenteReal, idGrupo: _jid },
    { $inc: { mensagens: 1, xp: 1 }, $set: { nome: nomeDoCara, ultimoBonusDiario: new Date() } },
    { upsert: true }
  );
}

            // ── Usuario global: XP global, level e missões ────────────────────
            const hojeISO = new Date().toISOString().slice(0, 10);
            const usuarioAtualizado = await Usuario.findOneAndUpdate(
              { idWhatsApp: remetenteNorm },
              {
                $inc: {
                  mensagens: 1,
                  xp: 1,
                  'dailyMissions.progress.msg50': 1,
                  [`xpHistory.${hojeISO}`]: 1,
                },
                $set: { nome: nomeDoCara },
              },
              { upsert: true, new: true }
            );

            const xpAtual   = usuarioAtualizado?.xp ?? 0;
            const levelNovo = Math.floor(Math.pow(xpAtual / 100, 1 / 1.5)) + 1;

            if ((usuarioAtualizado?.level ?? 1) !== levelNovo) {
              await Usuario.findOneAndUpdate(
                { idWhatsApp: remetenteNorm },
                { $set: { level: levelNovo } }
              );
            }
          }

          await handleMessage(sock, msg);

          if (_jid.endsWith('@g.us')) {
            registerActiveGroup(_jid);
            activeGroups.add(_jid);
          }

        } catch (err) {
          console.error('❌ Erro no processamento da mensagem:', err.message);
        }
      })();
    }
  });

  // ── Eventos de grupo (entradas/saídas) ───────────────────────────────────────
  sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {

    // ── Entrada de membros ──────────────────────────────────────────────────
    if (action === 'add') {
      for (const userJid of participants) {
        const nome = contactNames[userJid] || userJid.split('@')[0];
        try {
          await grupoHandler.processarBemVindo(sock, groupJid, userJid, nome);
        } catch (e) {
          console.log('⚠️ Erro no bem-vindo:', e.message);
        }
      }
    }

    // ── Saída de membros ────────────────────────────────────────────────────
    if (action === 'remove') {
      for (const participantJid of participants) {

        // 🗑️ Remove a carteira do usuário neste grupo
        try {
          const jidNorm = normalizarJid(participantJid);
          if (jidNorm) {
            const deletado = await CarteiraGrupo.deleteOne({ idWhatsApp: jidNorm, idGrupo: groupJid });

            // Se não achou pelo JID direto, tenta via LidMapping
            if (!deletado.deletedCount) {
              const variantesPn = gerarVariantesNumero(jidNorm.split('@')[0])
                .map(d => `${d}@s.whatsapp.net`);
              const lidMap = await LidMapping.findOne({ pn: { $in: [jidNorm, ...variantesPn] } }).lean();
              if (lidMap?.lid) {
                await CarteiraGrupo.deleteOne({ idWhatsApp: lidMap.lid, idGrupo: groupJid });
              }
            }
            console.log(`🗑️ CarteiraGrupo removida: ${jidNorm} saiu de ${groupJid}`);
          }
        } catch (e) {
          console.error('⚠️ Erro ao remover CarteiraGrupo na saída:', e.message);
        }

        // 💔 Encerra relacionamento se houver
        const found = relacionamentoHandler.findRelByJid(groupJid, participantJid, relacionamentos);
        if (!found) continue;

        const { key, rel } = found;
        const parceiro = rel.jidA === participantJid ? rel.jidB : rel.jidA;

        relacionamentos.delete(key);
        if (relacionamentoHandler.xpCasais) {
          relacionamentoHandler.xpCasais.delete(key);
        }

        await relacionamentoHandler.clearCasamentoDb(participantJid, parceiro);

        await sock.sendMessage(groupJid, {
          text:     `💔 *@${participantJid.split('@')[0]}* saiu do grupo e o relacionamento foi encerrado automaticamente.`,
          mentions: [participantJid, parceiro].filter(Boolean),
        }).catch(() => {});
      }
    }
  }); // ← fecha group-participants.update

  // ── Conexão ───────────────────────────────────────────────────────────────────
  let schedulersIniciados = false;

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

    // ── QR Code ────────────────────────────────────────────────────────────────
    if (qr) {
      console.log('\n📱 Escaneie o QR Code:\n');
      try {
        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
        await QRCode.toFile(path.resolve(__dirname, '../qrcode.png'), qr, { width: 400 });
      } catch (err) {
        console.error('[QRCode] Erro ao gerar QR:', err.message);
      }
    }

    // ── Desconexão ─────────────────────────────────────────────────────────────
    if (connection === 'close') {
      schedulersIniciados = false;

      const code    = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const motivo  = lastDisconnect?.error?.message ?? 'desconhecido';
      const logado  = code !== DisconnectReason.loggedOut;

      console.warn(`🔌 Desconectado. Código: ${code} | Motivo: ${motivo}`);

      if (logado) {
        const delay = code === DisconnectReason.connectionReplaced ? 5_000 : 30_000;
        console.log(`🔄 Reconectando em ${delay / 1000}s...`);
        setTimeout(() => startBot(), delay);
      } else {
        console.log('🚪 Sessão encerrada definitivamente (loggedOut).');
        process.exit(0);
      }
    }

    // ── Conexão aberta ─────────────────────────────────────────────────────────
  if (connection === 'open') {
    botJid = sock.user?.id ?? null;
    console.log(`✅ Bot conectado! JID: ${botJid}\n`);

    if (!schedulersIniciados) {
      // Primeira conexão — inicializa os schedulers
      initPetScheduler(sock);
      initQuizRankingScheduler(sock, activeGroups);
      initFilhosScheduler();

      // Limpeza periódica de arquivos temporários (a cada 5min, remove >10min)
      setInterval(() => downloadsHandler.limparTmpAntigos(10 * 60 * 1000), 5 * 60 * 1000);
      downloadsHandler.limparTmpAntigos(10 * 60 * 1000);

      schedulersIniciados = true;
      console.log('[Schedulers] Iniciados.');

      // 🚀 Sincroniza nomes dos grupos no MongoDB + Firestore (apenas na 1ª conexão)
      setTimeout(() => rodarAtualizacao(sock), 8000);

    } else {
      // Reconexão — só atualiza o sock nos schedulers existentes
      initPetScheduler.updateSock?.(sock);
      initQuizRankingScheduler.updateSock?.(sock);
      console.log('[Schedulers] Sock atualizado após reconexão.');
    }
  }
});
}

// ═══════════════════════════════════════════════════════════════
// ─── HANDLER PRINCIPAL ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;

  const content =
    msg.message?.ephemeralMessage?.message ||
    msg.message?.viewOnceMessage?.message  ||
    msg.message;
  if (!content) return;

  const imageMsg  = content.imageMessage;
  const videoMsg  = content.videoMessage;
  const textMsg   = content.conversation || content.extendedTextMessage?.text || '';
  const caption   = (imageMsg?.caption || videoMsg?.caption || textMsg || '').trim();
  const author    = getSenderName(msg);
  const senderJid = msg.key.participant || msg.key.remoteJid;

  const raw     = caption.toLowerCase();
  const cmdWord = raw.split(/\s+/)[0];
  const cmd     = raw;

  const isPrivate = jid && !jid.endsWith('@g.us') && !jid.endsWith('@broadcast');
  const isGroup   = jid && jid.endsWith('@g.us');

  // ── Mute check ───────────────────────────────────────────────
  if (isGroup && senderJid) {
    const senderNorm = normalizarJid(senderJid);
    if (senderNorm && isMuted(jid, senderNorm)) {
      try {
        await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
      } catch (e) {
        console.error('❌ Erro ao remover mutado:', e.message);
      }
      unmuteUser(jid, senderNorm);
      return;
    }
  }

  if (senderJid) {
    contarMensagem(senderJid, author);
    await addUserXp(senderJid, 1, msg.pushName || author);
  }

  // ── Slow Mode ────────────────────────────────────────────────
  if (isGroup && !isAnyCmd(raw)) {
    const permitido = grupoHandler.verificarSlowMode(jid, senderJid);
    if (!permitido) return;
  }

  // ── Anti-Flood ───────────────────────────────────────────────
  if (isGroup) {
    try {
      const flood = await grupoHandler.verificarAntiFlood(sock, jid, senderJid, botJid);
      if (flood) {
        await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
        await sock.sendMessage(jid, {
          text: `🚫 *@${senderJid.split('@')[0]}* foi removido por flood!`,
          mentions: [senderJid],
        });
        return;
      }
    } catch {}
  }

  // ── Substituição estilo vim (s/antigo/novo/) ─────────────────
  const subMatch = caption.match(/^[!.]s\/([^\/]+)\/([^\/]+)\/?/i);
  if (subMatch && (isPrivate || content.extendedTextMessage?.contextInfo?.quotedMessage)) {
    if (senderJid) contarCmd(senderJid);
    const pattern     = subMatch[1];
    const replacement = subMatch[2];
    const targetText  =
      content.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      lastTexts.get(jid) ||
      '';

    if (!targetText) {
      await sock.sendMessage(jid, { text: '⚠️ Nenhuma mensagem para corrigir.' }, { quoted: msg });
    } else {
      try {
        const newText = targetText.replace(new RegExp(pattern, 'g'), replacement);
        await sock.sendMessage(jid, {
          text: newText === targetText ? '⚠️ Nada foi alterado.' : newText,
        }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, { text: '⚠️ Padrão inválido.' }, { quoted: msg });
      }
    }
    return;
  }

  // Guardar última msg de texto no PV
  if (isPrivate && textMsg && !isAnyCmd(raw)) lastTexts.set(jid, textMsg);

  // ── Anti-Link ────────────────────────────────────────────────
  if (isGroup && antiLinkGroups.has(jid) && !isAnyCmd(raw)) {
    const hasLink = /(https?:\/\/|wa\.me\/|chat\.whatsapp\.com)/i.test(caption);
    if (hasLink) {
      const isAdm = await grupoHandler.isAdmin(sock, jid, senderJid).catch(() => false);
      if (!isAdm) {
        try {
          await sock.sendMessage(jid, {
            text: `🚫 *${getSenderName(msg)}*, links não são permitidos neste grupo!`,
            mentions: [senderJid],
          });
          await sock.groupParticipantsUpdate(jid, [senderJid], 'remove');
        } catch {}
        return;
      }
    }
  }

  // ── Auto-Sticker ─────────────────────────────────────────────
  if (isGroup && autoStickerGroups.has(jid) && !isAnyCmd(raw)) {
    if (imageMsg || videoMsg) {
      try { await figurinhaHandler.processMedia(sock, msg, content, jid, author, stickerCount); } catch {}
      return;
    }
  }

  // ── Pedido de casamento (sim/não) ────────────────────────────
  if (pedidosPendentes.has(senderJid)) {
    const resp = raw.trim();
    if (resp === 'sim' || resp === 'nao' || resp === 'não') {
      await relacionamentoHandler.handleResposta(sock, msg, jid, senderJid, resp, relacionamentos, pedidosPendentes, contactNames);
      return;
    }
  }

  // ── Quiz ativo ───────────────────────────────────────────────
  if (diversaoHandler.quizState?.has(senderJid)) {
    await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption);
    return;
  }

  // ── Anagrama ativo ───────────────────────────────────────────
  if (diversaoHandler.anagramaState?.has(senderJid)) {
    await diversaoHandler.handleAnagrama(sock, msg, jid, author, senderJid);
    return;
  }

  // Ignorar sem prefixo
  if (!isAnyCmd(raw)) return;
  if (senderJid) contarCmd(senderJid);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â”€â”€â”€ ROTEADOR
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // ── ACESSÓRIOS DE CASAL (equipar via .item) ──────────────────────────────────
if (cmdWord.startsWith('.')) {
  const itemKey = cmdWord.slice(1);
  const { handleEquiparAcessorio } = require(path.join(__dirname, 'handlers', 'diversao', 'acessoriosCasal'));
  const tratado = await handleEquiparAcessorio(sock, msg, jid, senderJid, itemKey);
  if (tratado) return;
}

  // ── PERFIL ────────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'perfil'))
  { await utilidadeHandler.handlePerfil(sock, msg, content, jid, contactNames, msgCount, cmdCount, stickerCount, relacionamentos); return; }
if (matchCmdStart(cmd, 'bio ') || matchCmd(cmdWord, 'bio'))
  { await utilidadeHandler.handleBio(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'meupainel'))   { await painelHandler.handleMeuPainel(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'resetsenha'))  {
  await sock.sendMessage(jid, {
    text:
      `🔑 Para resetar sua senha, acesse o painel e use a opção *"Alterar senha"* após fazer login.\n\n` +
      `🌐 ${PAINEL_URL ?? 'https://piroquinhasbot.github.io/painel-piroquinhas/perfil.html'}`,
  }, { quoted: msg });
  return;
}

  // ── MENUS ─────────────────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'menu') || matchCmdStart(cmd, 'menu '))
    { await utilidadeHandler.handleMenu(sock, msg, jid, caption, getPrefix, author); return; }
  if (matchCmd(cmdWord, 'menuutil'))
    { await utilidadeHandler.handleMenuUtil(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menujogos'))
    { await utilidadeHandler.handleMenuJogos(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menubaixar'))
    { await utilidadeHandler.handleMenuBaixar(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menucasal') || matchCmd(cmdWord, 'menurelacionamento') || matchCmd(cmdWord, 'menurelacionamentos'))
    { await utilidadeHandler.handleMenuRelacionamento(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menufilho'))
    { await utilidadeHandler.handleMenuFilho(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menuadm'))
    { await grupoHandler.handleMenuAdm(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menufig'))
    { await figurinhaHandler.handleMenuFig(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menuefeitos'))
    { await imagemHandler.handleMenuEfeitos(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menuaniversario'))
    { await aniversarioHandler.handleMenuAniversario(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'brincadeiras'))
    { await diversaoHandler.handleBrincadeiras(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'sistemgold'))
    { await diversaoHandler.handleSistemaGold(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'sistempet'))
    { await diversaoHandler.handleSistemaPet(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menugold'))
    { await diversaoHandler.handleMenuGold(sock, msg, jid, getPrefix); return; }
  if (matchCmd(cmdWord, 'menupet'))
    { await diversaoHandler.handleMenuPet(sock, msg, jid, getPrefix); return; }

// ── ECONOMIA ──────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'gold'))
  { await diversaoHandler.handleGold(sock, msg, jid, getPrefix, contactNames); return; }
if (matchCmd(cmdWord, 'loja'))
  { await diversaoHandler.handleLoja(sock, msg, jid, getPrefix); return; }
if (matchCmd(cmdWord, 'lojafood'))
  { await diversaoHandler.handleLojaFood(sock, msg, jid, getPrefix); return; }
if (matchCmd(cmdWord, 'lojapet'))
  { await diversaoHandler.handleLojaPet(sock, msg, jid, getPrefix); return; }
if (matchCmd(cmdWord, 'lojatec'))
  { await diversaoHandler.handleLojaTec(sock, msg, jid, getPrefix); return; }
if (matchCmd(cmdWord, 'lojacasal'))
  { await diversaoHandler.handleLojaCasal(sock, msg, jid, getPrefix); return; }
if (matchCmdStart(cmd, 'buy ') || matchCmd(cmdWord, 'buy'))
  { await diversaoHandler.handleComprar(sock, msg, jid, caption); return; }
if (matchCmdStart(cmd, 'give ') || matchCmd(cmdWord, 'give'))
  { await handleGive(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'vender') || matchCmdStart(cmd, 'vender '))
  { await diversaoHandler.handleVender(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'inventario') || matchCmd(cmdWord, 'inv'))
  { await diversaoHandler.handleInventario(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'pix') || matchCmd(cmdWord, 'transferir') || matchCmdStart(cmd, 'pix ') || matchCmdStart(cmd, 'transferir '))
  { await diversaoHandler.handlePix(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'apostar') || matchCmdStart(cmd, 'apostar '))
  { await diversaoHandler.handleApostar(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'slots') || matchCmdStart(cmd, 'slots '))
  { await diversaoHandler.handleSlots(sock, msg, jid, senderJid, caption); return; }
if (matchCmd(cmdWord, 'corrida') || matchCmdStart(cmd, 'corrida '))
  { await diversaoHandler.handleCorrida(sock, msg, jid, senderJid, caption); return; }
if (matchCmd(cmdWord, 'extrato'))
  { await diversaoHandler.handleExtrato(sock, msg, jid, contactNames); return; }
if (matchCmd(cmdWord, 'garimpar') || matchCmd(cmdWord, 'explorar') || matchCmd(cmdWord, 'pesquisar'))
  { await diversaoHandler.handleGarimpar(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'emprestimo') || matchCmdStart(cmd, 'emprestimo '))
  { await handleEmprestimo(sock, msg, jid, caption); return; }
if (matchCmdStart(cmd, 'pay emprestimo'))
  { await handlePayEmprestimo(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'divida'))
  { await handleDivida(sock, msg, jid); return; }

// ── MISSÕES ───────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'missao') || matchCmd(cmdWord, 'missoes'))
  { await diversaoHandler.handleMissao(sock, msg, jid, caption, getPrefix); return; }

// ── MEDIEVAL ──────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'medieval') || matchCmdStart(cmd, 'medieval '))
  { await medievalHandler.handleMedievalToggle(sock, msg, jid, caption.replace(/^[!.,/]medieval\s*/i, ''), await grupoHandler.isAdmin(sock, jid, senderJid)); return; }
if (matchCmd(cmdWord, 'ficha'))
  { await medievalHandler.handleFicha(sock, msg, jid, senderJid, author); return; }
if (matchCmd(cmdWord, 'atacar') || matchCmdStart(cmd, 'atacar ')) {
  const targetAtacar = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
  await medievalHandler.handleAtacar(sock, msg, jid, senderJid, author, targetAtacar); return;
}
if (matchCmd(cmdWord, 'magia') || matchCmdStart(cmd, 'magia ')) {
  const targetMagia = content?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;
  await medievalHandler.handleMagia(sock, msg, jid, senderJid, author, targetMagia); return;
}
if (matchCmd(cmdWord, 'missaomed'))
  { await medievalHandler.handleMissao(sock, msg, jid, senderJid, author); return; }
if (matchCmd(cmdWord, 'recargamana'))
  { await medievalHandler.handleRecargaMana(sock, msg, jid, senderJid, author); return; }
if (matchCmd(cmdWord, 'lojamedieval'))
  { await medievalLojaHandler.handleLojaMedieval(sock, msg, jid, senderJid); return; }
if (matchCmd(cmdWord, 'comprar') || matchCmdStart(cmd, 'comprar '))
  { await medievalLojaHandler.handleComprarMedieval(sock, msg, jid, senderJid, author, caption.replace(/^[!.,/]comprar\s*/i, '')); return; }
if (matchCmd(cmdWord, 'equipar') || matchCmdStart(cmd, 'equipar '))
  { await medievalLojaHandler.handleEquipar(sock, msg, jid, senderJid, author, caption.replace(/^[!.,/]equipar\s*/i, '')); return; }
if (matchCmd(cmdWord, 'rankmedieval'))
  { await medievalLojaHandler.handleRankMedieval(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'menumediev'))
  { await medievalLojaHandler.handleMenuMedieval(sock, msg, jid); return; }

  // ── PETS ──────────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'capturar'))
  { await diversaoHandler.handleCapturarPet(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'alimentar') || matchCmd(cmdWord, 'alimentarpet'))
  { await diversaoHandler.handleAlimentarPet(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'brincar'))
  { await diversaoHandler.handleBrincarPet(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'curar') || matchCmd(cmdWord, 'curarpet'))
  { await diversaoHandler.handleCurarPet(sock, msg, jid); return; }

// !pet on / !pet off / !pet status — precisa vir ANTES de !pet sozinho (statuspet)
if (matchCmd(cmdWord, 'pet') && /\s+(on|off|status)\s*$/i.test(cmd))
  { await diversaoHandler.handlePetToggle(sock, msg, jid, caption); return; }

if (matchCmd(cmdWord, 'statuspet') || matchCmd(cmdWord, 'pet'))
  { await diversaoHandler.handleStatusPet(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'petrank') || matchCmd(cmdWord, 'rankpet'))
  { await diversaoHandler.handlePetRank(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'pets'))
  { await diversaoHandler.handlePets(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'abrigo') || matchCmd(cmdWord, 'shelter'))
  { await diversaoHandler.handleAbrigo(sock, msg, jid, caption); return; }
if (matchCmdStart(cmd, 'renomearpet ') || matchCmd(cmdWord, 'renomearpet') ||
    matchCmdStart(cmd, 'nomearpet ')   || matchCmd(cmdWord, 'nomearpet'))
  { await diversaoHandler.handleRenomearPet(sock, msg, jid, caption); return; }

  // ── MARKETPLACE ───────────────────────────────────────────────────────────────
  if (matchCmd(cmdWord, 'avenda') || matchCmdStart(cmd, 'avenda '))
    { await diversaoHandler.handleAvenda(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'buscaroferta') || matchCmd(cmdWord, 'buscaoferta') || matchCmdStart(cmd, 'buscaroferta ') || matchCmdStart(cmd, 'buscaoferta '))
    { await diversaoHandler.handleBuscarOferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'ofertar') || matchCmdStart(cmd, 'ofertar '))
    { await diversaoHandler.handleOfertar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'buyoferta') || matchCmdStart(cmd, 'buyoferta '))
    { await diversaoHandler.handleBuy(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'cancelaroferta') || matchCmd(cmdWord, 'canceloferta') || matchCmdStart(cmd, 'cancelaroferta ') || matchCmdStart(cmd, 'canceloferta '))
    { await diversaoHandler.handleCancelarOferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'minhasofertas') || matchCmd(cmdWord, 'mesofertas'))
    { await diversaoHandler.handleMinhasOfertas(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'historicomarket') || matchCmd(cmdWord, 'mercadohistorico') || matchCmdStart(cmd, 'historicomarket ') || matchCmdStart(cmd, 'mercadohistorico '))
    { await diversaoHandler.handleHistoricoMarket(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'minhasofertas') || matchCmd(cmdWord, 'mesofertas') || matchCmd(cmdWord, 'ofertasrecebidas'))
    { await diversaoHandler.handleMinhasOfertas(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'aceitarofferta') || matchCmd(cmdWord, 'aceitaroferta'))
    { await diversaoHandler.handleAceitarOfferta(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'menumarket') || matchCmd(cmdWord, 'menumercado'))
    { await diversaoHandler.handleMenuMarket(sock, msg, jid, getPrefix); return; }

 // ── PESCA ─────────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'pescar') || matchCmd(cmdWord, 'pesca'))
  { await pescaHandler.handlePescar(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'varas') || matchCmd(cmdWord, 'lojavara') || matchCmd(cmdWord, 'varapesca'))
  { await pescaHandler.handleVaras(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'iscas') || matchCmd(cmdWord, 'lojaisca') || matchCmd(cmdWord, 'isca'))
  { await pescaHandler.handleIscas(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'buypesca') || matchCmdStart(cmd, 'buypesca '))
  { await pescaHandler.handleComprarPesca(sock, msg, jid, caption.replace(/^[!.,/]buypesca\s*/i, '')); return; }
if (matchCmd(cmdWord, 'inventariopesca') || matchCmd(cmdWord, 'invpesca') || matchCmd(cmdWord, 'minhapesca'))
  { await pescaHandler.handleInventarioPesca(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'sellpesca') || matchCmdStart(cmd, 'sellpesca '))
  { await pescaHandler.handleVenderPesca(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'givepesca') || matchCmdStart(cmd, 'givepesca '))
  { await pescaHandler.handleGivePesca(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'rankingpesca'))
  { await pescaHandler.handleRankingPesca(sock, msg, jid, contactNames); return; }
if (matchCmd(cmdWord, 'statspesca'))
  { await pescaHandler.handleStatsPesca(sock, msg, jid); return; }

// ── EMPREGO ───────────────────────────────────────────────────────────────────
if (matchCmd(cmdWord, 'procuraremprego') || matchCmd(cmdWord, 'buscaemprego'))
  { await diversaoHandler.handleProcurarEmprego(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'trabalhar') || matchCmd(cmdWord, 'work'))
  { await diversaoHandler.handleTrabalhar(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'promocao') || matchCmd(cmdWord, 'promcao'))
  { await diversaoHandler.handlePromocao(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'emprego') || matchCmd(cmdWord, 'meuemprego'))
  { await diversaoHandler.handleEmprego(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'demitir') || matchCmd(cmdWord, 'pedirdemissao'))
  { await diversaoHandler.handleDemitir(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'menuwork') || matchCmd(cmdWord, 'menuemprego'))
  { await diversaoHandler.handleMenuWork(sock, msg, jid, getPrefix); return; }

// ─── Sistema de Roubo ─────────────────────────────────────────────────────────

if (matchCmd(cmdWord, 'menuroubar'))   { await diversaoHandler.handleMenuRoubo(sock, msg, jid, getPrefix); return; }
if (matchCmd(cmdWord, 'menusec'))      { await diversaoHandler.handleMenuSec(sock, msg, jid, getPrefix);   return; }
if (matchCmd(cmdWord, 'buyroubo'))     { await diversaoHandler.handleComprarRoubo(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'buysec'))       { await diversaoHandler.handleComprarSec(sock, msg, jid, caption);   return; }
if (matchCmd(cmdWord, 'equiparroubo')) { await diversaoHandler.handleEquiparRoubo(sock, msg, jid, caption); return; }
if (matchCmd(cmdWord, 'equiparsec'))   { await diversaoHandler.handleEquiparSec(sock, msg, jid, caption);   return; }
if (matchCmd(cmdWord, 'roubar'))       { await diversaoHandler.handleRoubar(sock, msg, jid, caption);       return; }
if (matchCmd(cmdWord, 'roubarbanco'))  { await diversaoHandler.handleRoubarBanco(sock, msg, jid);           return; }
if (matchCmd(cmdWord, 'invroubo'))     { await diversaoHandler.handleInvRoubo(sock, msg, jid);              return; }
if (matchCmd(cmdWord, 'invsec'))       { await diversaoHandler.handleInvSec(sock, msg, jid);                return; }
if (matchCmd(cmdWord, 'policia'))      { await diversaoHandler.handlePolicia(sock, msg, jid);               return; }

// ─── Utilitários ──────────────────────────────────────────────────────────────

if (matchCmd(cmdWord, 'alteradores'))  { await utilidadeHandler.handleAlteradores(sock, msg, jid); return; }

if (matchCmdStart(cmd, 'qrcode ')      || matchCmd(cmdWord, 'qrcode'))      { await utilidadeHandler.handleQrcode(sock, msg, jid, caption);       return; }
if (matchCmdStart(cmd, 'encurtar ')    || matchCmd(cmdWord, 'encurtar'))    { await utilidadeHandler.handleEncurtar(sock, msg, jid, caption);     return; }
if (matchCmdStart(cmd, 'cep ')         || matchCmd(cmdWord, 'cep'))         { await utilidadeHandler.handleCep(sock, msg, jid, caption);          return; }
if (matchCmdStart(cmd, 'clima ')       || matchCmd(cmdWord, 'clima'))       { await utilidadeHandler.handleClima(sock, msg, jid, caption);        return; }
if (matchCmdStart(cmd, 'calcular ')    || matchCmd(cmdWord, 'calcular'))    { await utilidadeHandler.handleCalcular(sock, msg, jid, caption);     return; }
if (matchCmdStart(cmd, 'traduzir ')    || matchCmd(cmdWord, 'traduzir'))    { await utilidadeHandler.handleTraduzir(sock, msg, jid, caption);     return; }
if (matchCmd(cmdWord, 'piada'))                                             { await utilidadeHandler.handlePiada(sock, msg, jid);                 return; }
if (matchCmd(cmdWord, 'fato'))                                              { await utilidadeHandler.handleFato(sock, msg, jid);                  return; }

if (matchCmdStart(cmd, 'codigomorse ') || matchCmd(cmdWord, 'codigomorse') ||
    matchCmdStart(cmd, 'morse ')        || matchCmd(cmdWord, 'morse'))
  { await utilidadeHandler.handleCodigoMorse(sock, msg, jid, caption); return; }

if (matchCmdStart(cmd, 'decodificarmorse ') || matchCmd(cmdWord, 'decodificarmorse') ||
    matchCmdStart(cmd, 'demorse ')           || matchCmd(cmdWord, 'demorse'))
  { await utilidadeHandler.handleDecodificarMorse(sock, msg, jid, caption); return; }

// !moeda: 3 args numéricos → câmbio, senão → cara/coroa
if (matchCmdStart(cmd, 'moeda ')) {
  const args = caption.replace(/^[!.,\/]moeda\s*/i, '').trim().split(/\s+/);
  if (args.length >= 3 && !isNaN(parseFloat(args[0])))
    { await utilidadeHandler.handleMoeda(sock, msg, jid, caption); }
  else
    { await diversaoHandler.handleMoeda(sock, msg, jid); }
  return;
}
if (matchCmd(cmdWord, 'moeda')) { await diversaoHandler.handleMoeda(sock, msg, jid); return; }

  // â”€â”€ DOWNLOADS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (matchCmdStart(cmd, 'tiktok'))
    { await utilidadeHandler.handleTiktok(sock, msg, jid, caption, getPrefix); return; }
  if (matchCmd(cmdWord, 'save') || matchCmdStart(cmd, 'save '))
    { await utilidadeHandler.handleSave(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'saverec'))
    { await utilidadeHandler.handleSaveRec(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'audio'))
    { await utilidadeHandler.handleAudioDownload(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'som ') || matchCmd(cmdWord, 'som') || matchCmdStart(cmd, 'play '))
    { await utilidadeHandler.handleSom(sock, msg, jid, caption, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'playmp4'))
    { await utilidadeHandler.handlePlayMp4(sock, msg, jid, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'playdoc'))
    { await utilidadeHandler.handlePlayDoc(sock, msg, jid, getPrefix, pendingMusic); return; }
  if (matchCmd(cmdWord, 'pinterest') || matchCmd(cmdWord, 'pinterest2'))
    { await downloadsHandler.handlePinterest(sock, msg, jid, caption); return; }

  // â”€â”€ FIGURINHAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (
    (matchCmd(cmd, 's') || matchCmdStart(cmd, 's ')) &&
    (imageMsg || videoMsg || content.extendedTextMessage?.contextInfo?.quotedMessage)
  ) { await figurinhaHandler.handleSticker(sock, msg, content, jid, author, stickerCount); return; }

  if (
    matchCmd(cmdWord, 'f') &&
    (imageMsg || videoMsg || content.extendedTextMessage?.contextInfo?.quotedMessage)
  ) { await figurinhaHandler.handleSticker(sock, msg, content, jid, author, stickerCount); return; }

  if (matchCmdStart(cmd, 'desfig'))       { await figurinhaHandler.handleDesfig(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'estourar'))     { await figurinhaHandler.handleEstourar(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'brat '))        { await figurinhaHandler.handleBrat(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'figtexto '))    { await figurinhaHandler.handleFigtexto(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmd(cmdWord, 'attp') || matchCmdStart(cmd, 'attp '))   { await figurinhaHandler.handleAttp(sock, msg, jid, caption, getPrefix, stickerCount, 1); return; }
  if (matchCmd(cmdWord, 'attp2') || matchCmdStart(cmd, 'attp2 ')) { await figurinhaHandler.handleAttp(sock, msg, jid, caption, getPrefix, stickerCount, 2); return; }
  if (matchCmdStart(cmd, 'qc '))          { await figurinhaHandler.handleQc(sock, msg, jid, caption, getPrefix, stickerCount, 1); return; }
  if (matchCmdStart(cmd, 'qc2 '))         { await figurinhaHandler.handleQc(sock, msg, jid, caption, getPrefix, stickerCount, 2); return; }
  if (matchCmdStart(cmd, 'emojimix'))     { await figurinhaHandler.handleEmojiMix(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'emoji'))        { await figurinhaHandler.handleEmoji(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  if (matchCmdStart(cmd, 'toimg'))        { await figurinhaHandler.handleToImg(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'togif'))        { await figurinhaHandler.handleToGif(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'figemoji'))     { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figemoji',    'emoji meme',      stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figroblox'))    { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figroblox',   'roblox meme',     stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figmeme'))      { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figmeme',     'funny meme',      stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figcoreana'))   { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figcoreana',  'kpop cute',       stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figraiva'))     { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figraiva',    'angry reaction',  stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figengracada')) { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figengracada','funny laugh',     stickerCount, author); return; }
  if (matchCmdStart(cmd, 'figdesenho'))   { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'figdesenho',  'cartoon sticker', stickerCount, author); return; }
  if (matchCmdStart(cmd, 'fig '))         { await figurinhaHandler.handleFigCategoria(sock, msg, jid, caption, 'fig',         'sticker',         stickerCount, author); return; }
  if (matchCmdStart(cmd, 'pesquisafig'))  { await figurinhaHandler.handlePesquisaFig(sock, msg, jid, caption, getPrefix, stickerCount); return; }
  
// ── RELACIONAMENTO ────────────────────────────────────────────
  if (matchCmdStart(cmd, 'casar'))
    { await relacionamentoHandler.handleRelacionamento(sock, msg, content, jid, author, 'casamento', relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmdStart(cmd, 'namorar'))
    { await relacionamentoHandler.handleRelacionamento(sock, msg, content, jid, author, 'namoro', relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmd(cmdWord, 'terminar'))
    { await relacionamentoHandler.handleCancelarCasamento(sock, msg, jid, senderJid, relacionamentos); return; }
  if (matchCmd(cmdWord, 'cancelarpedido'))
    { await relacionamentoHandler.handleCancelarPedido(sock, msg, jid, senderJid, pedidosPendentes); return; }
  if (matchCmd(cmdWord, 'euaceito'))
    { await relacionamentoHandler.handleEuAceito(sock, msg, jid, senderJid, relacionamentos, pedidosPendentes, contactNames); return; }
  if (matchCmd(cmdWord, 'eurecuso'))
    { await relacionamentoHandler.handleEuRecuso(sock, msg, jid, senderJid, pedidosPendentes, contactNames); return; }
if (matchCmd(cmdWord, 'flores'))           { await relacionamentoHandler.handleFlores(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'doces'))            { await relacionamentoHandler.handleDoces(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'carta'))            { await relacionamentoHandler.handleCarta(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'mimo'))             { await relacionamentoHandler.handleMimo(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'beijo'))            { await relacionamentoHandler.handleBeijo(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'abraco'))           { await relacionamentoHandler.handleAbraco(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'presente'))         { await relacionamentoHandler.handlePresente(sock, msg, jid, author, senderJid, relacionamentos, caption); return; }
if (matchCmd(cmdWord, 'jantar'))           { await relacionamentoHandler.handleJantar(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'cinematel'))        { await relacionamentoHandler.handleCinemaRel(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'viajar'))           { await relacionamentoHandler.handleViajar(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'serenata'))         { await relacionamentoHandler.handleSerenata(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'declarar'))         { await relacionamentoHandler.handleDeclarar(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmdStart(cmd, 'ciumento'))        { await relacionamentoHandler.handleCiumento(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames); return; }
if (matchCmd(cmdWord, 'statu'))            { await relacionamentoHandler.handleStatu(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'meupar'))           { await relacionamentoHandler.handleMeuPar(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'xpdobro'))          { await relacionamentoHandler.handleXpDobro(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmd(cmdWord, 'aniversario_casal')){ await relacionamentoHandler.handleAniversarioCasal(sock, msg, jid, author, senderJid, relacionamentos); return; }
if (matchCmdStart(cmd, 'duelodecasais'))   { await relacionamentoHandler.handleDueloDeCasais(sock, msg, content, jid, author, senderJid, relacionamentos, contactNames); return; }
if (matchCmd(cmdWord, 'rankcasais'))       { await relacionamentoHandler.handleRankCasais(sock, msg, jid, relacionamentos); return; }
if (matchCmd(cmdWord, 'tentarfilho'))  { await diversaoHandler.handleTentarFilho(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'filho'))        { await diversaoHandler.handleVerFilho(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'cuidarfilho'))  { await diversaoHandler.handleCuidarFilho(sock, msg, jid); return; }
if (matchCmd(cmdWord, 'remediofil'))   { await diversaoHandler.handleRemedioFilho(sock, msg, jid); return; }

// ── PINNED ────────────────────────────────────────────────────
  if (matchCmdStart(cmd, 'fixar'))
    { await pinnedHandler.handleFixar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'desfixar'))
    { await pinnedHandler.handleDesfixar(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'pinned') || matchCmd(cmdWord, 'mensagemfixada'))
    { await pinnedHandler.handlePinned(sock, msg, jid); return; }

  // â”€â”€ ANIVERSÃRIOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (matchCmdStart(cmd, 'reganiversario'))
    { await aniversarioHandler.handleRegAniversario(sock, msg, jid, caption, author, senderJid); return; }
  if (matchCmd(cmdWord, 'excluiraniversario'))
    { await aniversarioHandler.handleExcluirAniversario(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'meuaniversario'))
    { await aniversarioHandler.handleMeuAniversario(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'listaniversarios'))
    { await aniversarioHandler.handleListAniversarios(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'sistemaniversario')) {
    const isAdm = await grupoHandler.isAdmin(sock, jid, senderJid).catch(() => false);
    await aniversarioHandler.handleSistemaAniversario(sock, msg, jid, isAdm);
    return;
  }

  // ── DIVERSÃO ──────────────────────────────────────────────────────────────────
  if (matchCmdStart(cmd, 'gay'))           { await diversaoHandler.handleGay(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'sexo'))          { await diversaoHandler.handleSexo(sock, msg, content, jid, author, contactNames); return; }
  
  if (matchCmdStart(cmd, 'lesbica'))       { await diversaoHandler.handleLesbica(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'aura'))          { await diversaoHandler.handleAura(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'podre'))         { await diversaoHandler.handlePodre(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'frango'))        { await diversaoHandler.handleFrango(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'dado'))          { await diversaoHandler.handleDado(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, '8ball'))         { await diversaoHandler.handle8ball(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'ship'))          { await diversaoHandler.handleShip(sock, msg, content, jid, contactNames); return; }
  if (matchCmdStart(cmd, 'compatibilidade')) { await diversaoHandler.handleCompatibilidade(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'rolar'))         { await diversaoHandler.handleRolar(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'xingar'))        { await diversaoHandler.handleXingar(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'elogio'))        { await diversaoHandler.handleElogio(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'crush'))         { await diversaoHandler.handleCrush(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'cantada'))       { await diversaoHandler.handleCantada(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'safadeza'))      { await diversaoHandler.handleSafadeza(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'trans'))         { await diversaoHandler.handleTrans(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'corno'))         { await diversaoHandler.handleCorno(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'gado'))          { await diversaoHandler.handleGado(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'peitudo'))       { await diversaoHandler.handlePeitudo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'pauzudo'))       { await diversaoHandler.handlePauzudo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'bundudo'))       { await diversaoHandler.handleBundudo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'gordo'))         { await diversaoHandler.handleGordo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'cuzudo'))        { await diversaoHandler.handleCuzudo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'tiro'))          { await diversaoHandler.handleTiro(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'morte'))         { await diversaoHandler.handleMorte(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'maldizer'))      { await diversaoHandler.handleMaldizer(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'fortuna'))       { await diversaoHandler.handleFortuna(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'julgamento'))    { await diversaoHandler.handleJulgamento(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'confissao'))     { await diversaoHandler.handleConfissao(sock, msg, content, jid, author); return; }
  if (matchCmdStart(cmd, 'verdadeoudesafio')) { await diversaoHandler.handleVerdadeOuDesafio(sock, msg, content, jid, author); return; }
  if (matchCmd(cmdWord, 'roletarussa'))    { await diversaoHandler.handleRoletaRussa(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'roletarussa2'))   { await diversaoHandler.handleRoletaRussa2(sock, msg, jid, author); return; }
  if (matchCmd(cmdWord, 'roletarussa3'))   { await diversaoHandler.handleRoletaRussa3(sock, msg, jid, author, senderJid); return; }
  if (matchCmdStart(cmd, 'falta'))         { await diversaoHandler.handleFalta(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmd(cmdWord, 'baterfalta'))     { await diversaoHandler.handleBaterFalta(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'eununca'))        { await diversaoHandler.handleEuNunca(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'quiz') || matchCmdStart(cmd, 'quiz '))
    { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizfut'))        { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizctec'))       { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizgeo'))        { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizmat'))        { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizhis'))        { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizbsq'))        { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; }
  if (matchCmd(cmdWord, 'quizanime'))      { await diversaoHandler.handleQuiz(sock, msg, jid, author, senderJid, caption); return; } // ← novo
  if (matchCmd(cmdWord, 'pontos'))         { await diversaoHandler.handlePontos(sock, msg, jid, author, senderJid); return; }
  if (matchCmd(cmdWord, 'rankjogos'))      { await diversaoHandler.handleRankJogos(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'banco') || matchCmdStart(cmd, 'banco '))
    { await diversaoHandler.handleBanco(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'historicobanco')) { await diversaoHandler.handleHistoricoBanco(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'resgatar'))       { await diversaoHandler.handleResgatar(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'levelon'))        { await utilidadeHandler.handleLevelOn(sock, msg, jid, author); return; }
  if (matchCmd(cmdWord, 'level'))          { await utilidadeHandler.handleLevel(sock, msg, jid, author, msgCount); return; }
  if (matchCmd(cmdWord, 'ranklevel'))      { await utilidadeHandler.handleRankLevel(sock, msg, jid, contactNames, msgCount); return; }
  if (matchCmd(cmdWord, 'anagrama') || matchCmdStart(cmd, 'anagrama '))
    { await diversaoHandler.handleAnagrama(sock, msg, jid, author, senderJid); return; }
  if (matchCmdStart(cmd, 'ppt'))           { await diversaoHandler.handlePpt(sock, msg, jid, caption, author, senderJid); return; }
if (matchCmdStart(cmd, 'bucetudo'))      { await diversaoHandler.handleBucetudo(sock, msg, content, jid, author, contactNames); return; }
if (matchCmd(cmdWord, 'worldcup'))       { await diversaoHandler.handleWorldCup(sock, msg, jid); return; }

 // ── GRUPO ────────────────────────────────────────────────────────────────────
  if (matchCmdStart(cmd, 'ban'))           { await grupoHandler.handleBan(sock, msg, content, jid, botJid, contactNames); return; }
  if (matchCmdStart(cmd, 'mute'))          { await grupoHandler.handleMute(sock, msg, content, jid, botJid, mutedUsers, contactNames); return; }
  if (matchCmdStart(cmd, 'desmute'))       { await grupoHandler.handleDesmute(sock, msg, content, jid, botJid, mutedUsers, contactNames); return; }
  if (matchCmdStart(cmd, 'ranking'))       { await grupoHandler.handleRanking(sock, msg, jid, msgCount); return; }
  if (matchCmd(cmdWord, 'rankgold'))       { await handleRankGold(sock, msg, jid, contactNames); return; }
  if (matchCmdStart(cmd, 'sorteio'))       { await grupoHandler.handleSorteio(sock, msg, content, jid, contactNames); return; }
  if (matchCmdStart(cmd, 'enquete'))       { await grupoHandler.handleEnquete(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'todos'))         { await grupoHandler.handleTodos(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'fechar'))        { await grupoHandler.handleFecharAbrir(sock, msg, jid, true); return; }
  if (matchCmdStart(cmd, 'abrir'))         { await grupoHandler.handleFecharAbrir(sock, msg, jid, false); return; }
  if (matchCmdStart(cmd, 'promover'))      { await grupoHandler.handlePromoverRebaixar(sock, msg, content, jid, 'promote', botJid, contactNames); return; }
  if (matchCmdStart(cmd, 'rebaixar'))      { await grupoHandler.handlePromoverRebaixar(sock, msg, content, jid, 'demote', botJid, contactNames); return; }
  if (matchCmdStart(cmd, 'tempo'))         { await grupoHandler.handleTempo(sock, msg, content, jid, author, contactNames); return; }
  if (matchCmdStart(cmd, 'antilink'))      { await grupoHandler.handleAntiLink(sock, msg, content, jid, antiLinkGroups, saveData); return; }
  if (matchCmdStart(cmd, 'autosticker'))   { await grupoHandler.handleAutoSticker(sock, msg, content, jid, autoStickerGroups, saveData); return; }
  if (matchCmdStart(cmd, 'reportar'))      { await grupoHandler.handleReportar(sock, msg, content, jid, warnings, contactNames, saveData, botJid); return; }
  if (matchCmdStart(cmd, 'removerreporte')){ await grupoHandler.handleRemoverReporte(sock, msg, content, jid, contactNames, botJid); return; }
  if (matchCmd(cmdWord, 'adv') || matchCmd(cmdWord, 'advertencia'))
  { await grupoHandler.handleAdvertencia(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'grupinfo'))       { await grupoHandler.handleGrupInfo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'listaadm'))       { await grupoHandler.handleListaAdm(sock, msg, jid, contactNames); return; }
  if (matchCmd(cmdWord, 'listamembros'))   { await grupoHandler.handleListaMembros(sock, msg, jid, contactNames); return; }
  if (matchCmdStart(cmd, 'bemvindo'))      { await grupoHandler.handleBemVindo(sock, msg, jid, caption); return; }
  if (matchCmd(cmdWord, 'linkgrupo'))      { await grupoHandler.handleLinkGrupo(sock, msg, jid); return; }
  if (matchCmdStart(cmd, 'apagarmsg'))     { await grupoHandler.handleApagarMsg(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'slowmode'))      { await grupoHandler.handleSlowMode(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'antiflood'))     { await grupoHandler.handleAntiFlood(sock, msg, jid, caption); return; }
  if (matchCmdStart(cmd, 'avisar'))        { await grupoHandler.handleAvisar(sock, msg, jid, caption, contactNames); return; }
  if (matchCmdStart(cmd, 'fixargrupo'))    { await grupoHandler.handleFixarGrupo(sock, msg, content, jid, caption); return; }

  // â”€â”€ FILTROS DE IMAGEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (matchCmdStart(cmd, 'pbiphone'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'pbiphone',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'pb'))         { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'pb',        getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'girar180'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'girar180',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'girar270'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'girar270',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'girar'))      { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'girar',     getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'pixelar'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'pixelar',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'pixel'))      { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'pixel',     getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'blur'))       { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'blur',      getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'espelhar'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'espelhar',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'flipv'))      { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'flipv',     getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'negativo'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'negativo',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'sepia'))      { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'sepia',     getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'vintage'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'vintage',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'brilho'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'brilho',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'contraste'))  { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'contraste', getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'saturar'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'saturar',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'nitido'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'nitido',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'corecore'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'corecore',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'desfazer'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'desfazer',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'sfundo'))     { await imagemHandler.handleSfundo(sock, msg, content, jid); return; }
  if (matchCmdStart(cmd, 'cartoon'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'cartoon',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'glitch'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'glitch',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'vinheta'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'vinheta',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'radiancia'))  { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'radiancia', getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'matrix'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'matrix',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'polaroid'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'polaroid',  getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'sketch'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'sketch',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'calor'))      { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'calor',     getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'gelo'))       { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'gelo',      getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'dourado'))    { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'dourado',   getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'neon'))       { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'neon',      getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'cinema'))     { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'cinema',    getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'old'))        { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'old',       getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'halloween'))  { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'halloween', getPrefix(jid)); return; }
  if (matchCmdStart(cmd, 'aquarela'))   { await imagemHandler.handleImageFilter(sock, msg, content, jid, 'aquarela',  getPrefix(jid)); return; }

  // â”€â”€ ALTERADORES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (matchCmd(cmdWord, 'videolento'))     { await alteradoresHandler.handleVideoLento(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'videorapido'))    { await alteradoresHandler.handleVideoRapido(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'videocontrario')) { await alteradoresHandler.handleVideoContrario(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'reversevideo'))   { await alteradoresHandler.handleReverseVideo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'audiolento'))     { await alteradoresHandler.handleAudioLento(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'audiorapido'))    { await alteradoresHandler.handleAudioRapido(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'grave'))          { await alteradoresHandler.handleGrave(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'esquilo'))        { await alteradoresHandler.handleEsquilo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'bass'))           { await alteradoresHandler.handleBass(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozmenino'))      { await alteradoresHandler.handleVozMenino(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozgrossa'))      { await alteradoresHandler.handleVozGrossa(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozmulher'))      { await alteradoresHandler.handleVozMulher(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'audioreverse'))   { await alteradoresHandler.handleAudioReverse(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozrobo'))        { await alteradoresHandler.handleVozRobo(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozalien'))       { await alteradoresHandler.handleVozAlien(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozvelho'))       { await alteradoresHandler.handleVozVelho(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozcrianca'))     { await alteradoresHandler.handleVozCrianca(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'vozdemonio'))     { await alteradoresHandler.handleVozDemonio(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'eco'))            { await alteradoresHandler.handleEco(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'caverna'))        { await alteradoresHandler.handleCaverna(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'telefone'))       { await alteradoresHandler.handleTelefone(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'radio'))          { await alteradoresHandler.handleRadio(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'megafone'))       { await alteradoresHandler.handleMegafone(sock, msg, jid); return; }
  if (matchCmd(cmdWord, 'underwater'))     { await alteradoresHandler.handleUnderwater(sock, msg, jid); return; }

  // â”€â”€ TEXTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (matchCmdStart(cmd, 'maiusculo'))  { await textoHandler.handleTextoFun(sock, msg, jid, caption, getPrefix(jid), 'maiusculo'); return; }
  if (matchCmdStart(cmd, 'invertido'))  { await textoHandler.handleTextoFun(sock, msg, jid, caption, getPrefix(jid), 'invertido'); return; }
  if (matchCmdStart(cmd, 'caixa'))      { await textoHandler.handleTextoFun(sock, msg, jid, caption, getPrefix(jid), 'caixa');     return; }
}

// ─── Servidor Web ─────────────────────────────────────────────────────────────
const express = require('express');
const app  = express();
const port = process.env.PORT || 3000;

// Necessário pro rate limit por IP (em routes/api.js) funcionar certo atrás
// do proxy do Render — sem isso, req.ip mostra o IP interno do proxy pra todo mundo.
app.set('trust proxy', 1);

// Evita anunciar "Express" no header x-powered-by
app.disable('x-powered-by');

// ─── CORS global (antes de tudo) ─────────────────────────────────────────────
const FRONTEND = 'https://piroquinhasbot.github.io';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  FRONTEND);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Bot Online!'));

// ─── Painel API ───────────────────────────────────────────────────────────────
let apiRouter;
try {
  apiRouter = require('./routes/api');
  app.use('/api', apiRouter);
  console.log('✅ API router carregado com sucesso');
} catch (err) {
  console.error('❌ ERRO AO CARREGAR API ROUTER:', err);
}

// Qualquer rota /api/* que não bateu em nada do apiRouter cai aqui
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Captura JSON malformado no corpo da requisição e qualquer erro não tratado
// vindo das rotas acima — precisa ser o último app.use(), com 4 argumentos
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  console.error('[Servidor Web] Erro não tratado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(port, () => console.log(`Servidor web do bot rodando na porta ${port}`));

// ─── Iniciar (apenas uma vez) ─────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGO_URI não definida! Configure o .env ou variável de ambiente.');
  mongoose.set('strictQuery', false);
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB conectado');

  await diversaoHandler.initializePersistedData();
  await loadRelationshipsFromDb();
  startBot();
}

let _botSock = null;
function getSock() { return _botSock; }

async function sendMessage(jid, content) {
  if (!_botSock) throw new Error('Bot não conectado.');
  return _botSock.sendMessage(jid, content);
}

module.exports = { sendMessage, getSock, get sock() { return _botSock; } };

main().catch(err => console.error('❌ Erro crítico na inicialização:', err));