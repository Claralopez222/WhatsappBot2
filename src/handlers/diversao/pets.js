/**
 * Sistema de Pets — Bot
 * Spawn automático a cada hora no grupo (auto-scheduler integrado)
 *
 * Comandos:
 *   !capturar           — Captura o pet spawado no grupo
 *   !alimentar          — Alimenta seu pet (consome 1x comida do inventário)
 *   !brincar            — Brinca com o pet (ganha nível)
 *   !statuspet          — Status completo do pet
 *   !renomearpet <nome> — Renomeia seu pet
 *   !curar              — Cura o pet (consome 1x remédio do inventário)
 *   !rankpet            — Ranking de pets do servidor
 *   !pets               — Lista todos os pets disponíveis
 *   !abrigo             — Lista pets no abrigo
 *   !abrigo deixar      — Deixa seu pet no abrigo
 *   !abrigo <nome> pegar — Adota um pet do abrigo
 *
 * v3.0 — Correções:
 *   - Auto-scheduler integrado: spawn automático sem dependência externa
 *   - Cache de pet agora invalida corretamente ao aplicar decaimento
 *   - Race condition corrigida: writes atômicos únicos por operação
 *   - handleAbrigo deixar: write unificado (sem dupla gravação)
 *   - Grupos ativos rastreados automaticamente ao receber mensagens
 *   - initPetScheduler exportado para ser chamado no boot do bot
 */

'use strict';

const path    = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

let prepareDailyMissionState;
try {
  ({ prepareDailyMissionState } = require('./missoes'));
} catch {
  prepareDailyMissionState = async () => {};
}

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG = {
  SPAWN_INTERVAL_MS:   60 * 60 * 1000, // 1 hora
  COOLDOWN_ALIMENTAR:  10 * 60 * 1000, // 10 min
  COOLDOWN_BRINCAR:    15 * 60 * 1000, // 15 min
  COOLDOWN_CURAR:      30 * 60 * 1000, // 30 min
  NIVEL_MAX:           50,
  STAT_MAX:            100,
  STAT_MIN:            0,
  DECAIMENTO_FOME:     8,
  DECAIMENTO_ENERGIA:  5,
  DECAIMENTO_HUMOR:    3,
};

// ─── CATÁLOGO DE PETS ─────────────────────────────────────────────────────────

const PET_SYSTEM = {
  // COMUNS (60%)
  cachorro:    { emoji: '🐶', nome: 'Cachorro',     rarity: 'COMUM',      xpMult: 1.5, pontMult: 1.5, desc: 'Fiel e companheiro para todas as horas.' },
  gato:        { emoji: '🐱', nome: 'Gato',          rarity: 'COMUM',      xpMult: 1.4, pontMult: 1.4, desc: 'Independente e muito caçador.' },
  coelho:      { emoji: '🐰', nome: 'Coelho',        rarity: 'COMUM',      xpMult: 1.3, pontMult: 1.3, desc: 'Rápido, fofinho e adora cenouras.' },
  pinguim:     { emoji: '🐧', nome: 'Pinguim',       rarity: 'COMUM',      xpMult: 1.4, pontMult: 1.4, desc: 'Gosta de frio e anda de um jeito engraçado.' },
  macaco:      { emoji: '🐵', nome: 'Macaco',        rarity: 'COMUM',      xpMult: 1.6, pontMult: 1.6, desc: 'Super inteligente e muito travesso.' },

  // RAROS (25%)
  lobo:        { emoji: '🐺', nome: 'Lobo',          rarity: 'RARO',       xpMult: 1.7, pontMult: 1.7, desc: 'O protetor da alcateia selvagem.' },
  raposa:      { emoji: '🦊', nome: 'Raposa',        rarity: 'RARO',       xpMult: 1.7, pontMult: 1.7, desc: 'Mágica, astuta e muito traiçoeira.' },
  urso:        { emoji: '🐻', nome: 'Urso',          rarity: 'RARO',       xpMult: 1.8, pontMult: 1.8, desc: 'Forte, robusto e adora um mel.' },
  coruja:      { emoji: '🦉', nome: 'Coruja',        rarity: 'RARO',       xpMult: 1.8, pontMult: 1.8, desc: 'Símbolo da sabedoria da noite.' },
  elefante:    { emoji: '🐘', nome: 'Elefante',      rarity: 'RARO',       xpMult: 1.9, pontMult: 1.9, desc: 'Gigante gentil com memória implacável.' },
  tigre:       { emoji: '🐯', nome: 'Tigre',         rarity: 'RARO',       xpMult: 1.9, pontMult: 1.9, desc: 'Ágil e com garras afiadíssimas.' },
  girafa:      { emoji: '🦒', nome: 'Girafa',        rarity: 'RARO',       xpMult: 1.5, pontMult: 1.5, desc: 'Observa tudo do alto com elegância.' },
  leao_marinho:{ emoji: '🦭', nome: 'Leão Marinho',  rarity: 'RARO',       xpMult: 1.6, pontMult: 1.6, desc: 'Adora fazer acrobacias na água.' },

  // ULTRA-RAROS (12%)
  falcao:      { emoji: '🦅', nome: 'Falcão',        rarity: 'ULTRA-RARO', xpMult: 1.8, pontMult: 1.8, desc: 'Visão cirúrgica e voo extremamente rápido.' },
  leao:        { emoji: '🦁', nome: 'Leão',          rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0, desc: 'O imponente rei da selva africana.' },
  tubarao:     { emoji: '🦈', nome: 'Tubarão',       rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0, desc: 'O maior predador dos oceanos.' },

  // LENDÁRIOS (3%)
  dragao:      { emoji: '🐉', nome: 'Dragão',        rarity: 'LENDÁRIO',   xpMult: 2.5, pontMult: 2.5, desc: 'Criatura mítica cuspidora de fogo puro.' },
  fenix:       { emoji: '🔥', nome: 'Fênix',         rarity: 'LENDÁRIO',   xpMult: 3.0, pontMult: 3.0, desc: 'Pássaro lendário que renasce das cinzas.' },
};

const PET_POOLS = {
  'COMUM':      Object.entries(PET_SYSTEM).filter(([, p]) => p.rarity === 'COMUM'),
  'RARO':       Object.entries(PET_SYSTEM).filter(([, p]) => p.rarity === 'RARO'),
  'ULTRA-RARO': Object.entries(PET_SYSTEM).filter(([, p]) => p.rarity === 'ULTRA-RARO'),
  'LENDÁRIO':   Object.entries(PET_SYSTEM).filter(([, p]) => p.rarity === 'LENDÁRIO'),
};

const RARITY_EMOJI = {
  'COMUM':      '⭐',
  'RARO':       '🌟',
  'ULTRA-RARO': '✨',
  'LENDÁRIO':   '💎',
};

// ─── ESTADO EM MEMÓRIA ────────────────────────────────────────────────────────

const petCache    = new Map(); // userId  → { pet, cachedAt }
const spawnedPets = new Map(); // groupId → { type, rarity, spawnedAt }
const cooldownMap = new Map(); // `${userId}:${action}` → timestamp
const activeGroups = new Set(); // grupos que receberam mensagem (para o scheduler)

// TTL do cache de pet: 5 minutos — garante que o decaimento seja recalculado periodicamente
const PET_CACHE_TTL_MS = 5 * 60 * 1000;

const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function somenteGrupo(jid) {
  return jid?.endsWith('@g.us') ?? false;
}

function resolverNome(idWhatsApp, contactNames) {
  return contactNames?.[idWhatsApp] || idWhatsApp.split('@')[0];
}

function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

function reply(sock, jid, msg, text) {
  return sock.sendMessage(jid, { text }, { quoted: msg });
}

function clamp(val, min = CONFIG.STAT_MIN, max = CONFIG.STAT_MAX) {
  return Math.min(max, Math.max(min, val));
}

function checkCooldown(userId, action, ms) {
  const key  = `${userId}:${action}`;
  const last = cooldownMap.get(key) ?? 0;
  const diff = Date.now() - last;
  if (diff < ms) return ms - diff;
  cooldownMap.set(key, Date.now());
  return 0;
}

function formatarTempo(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function getHumor(pet) {
  const media = ((pet.happiness ?? 0) + (pet.energy ?? 0) + (pet.fullness ?? 0)) / 3;
  if (media >= 80) return '😄 Ótimo';
  if (media >= 60) return '😊 Bem';
  if (media >= 40) return '😐 Regular';
  if (media >= 20) return '😔 Mal';
  return '😢 Péssimo';
}

function getRankScore(pet) {
  if (!pet) return 0;
  return ((pet.level ?? 1) * 100)
       + (pet.happiness ?? 0)
       + (pet.energy    ?? 0)
       + (pet.fullness  ?? 0);
}

function aplicarDecaimento(pet) {
  if (!pet?.lastInteraction) return pet;
  const horasPassadas = (Date.now() - new Date(pet.lastInteraction).getTime()) / 3600000;
  if (horasPassadas < 0.1) return pet;
  return {
    ...pet,
    fullness:  clamp(Math.round((pet.fullness  ?? 100) - CONFIG.DECAIMENTO_FOME    * horasPassadas)),
    energy:    clamp(Math.round((pet.energy    ?? 100) - CONFIG.DECAIMENTO_ENERGIA * horasPassadas)),
    happiness: clamp(Math.round((pet.happiness ?? 100) - CONFIG.DECAIMENTO_HUMOR   * horasPassadas)),
  };
}

// ─── PERSISTÊNCIA ─────────────────────────────────────────────────────────────

/**
 * Salva o pet e invalida o cache do usuário.
 * Sempre atualiza lastInteraction ao salvar.
 */
async function savePet(userId, petObj) {
  // Invalida o cache imediatamente
  petCache.delete(userId);

  const update = petObj
    ? { $set: { pet: { ...petObj, lastInteraction: new Date().toISOString() } } }
    : { $unset: { pet: '' } };

  try {
    await Usuario.findOneAndUpdate({ idWhatsApp: userId }, update, { upsert: true });
  } catch (e) {
    console.error('[Pets] savePet:', e.message);
  }
}

/**
 * Retorna o pet com decaimento aplicado.
 * Usa cache com TTL de 5 min para evitar queries repetidas;
 * invalida o cache se o TTL venceu (garante recálculo do decaimento).
 */
async function getPet(userId) {
  const cached = petCache.get(userId);
  if (cached) {
    // Invalida se TTL expirou para recalcular o decaimento
    if (Date.now() - cached.cachedAt < PET_CACHE_TTL_MS) {
      return cached.pet ? aplicarDecaimento(cached.pet) : null;
    }
    petCache.delete(userId);
  }

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    const pet  = user?.pet ?? null;
    petCache.set(userId, { pet, cachedAt: Date.now() });
    return pet ? aplicarDecaimento(pet) : null;
  } catch (e) {
    console.error('[Pets] getPet:', e.message);
    return null;
  }
}

// ─── SPAWN ────────────────────────────────────────────────────────────────────

function spawnNovoPet(groupId) {
  const rnd = Math.random() * 100;
  let raridade;
  if      (rnd < 60) raridade = 'COMUM';
  else if (rnd < 85) raridade = 'RARO';
  else if (rnd < 97) raridade = 'ULTRA-RARO';
  else               raridade = 'LENDÁRIO';

  const pool     = PET_POOLS[raridade];
  const [tipo]   = pool[Math.floor(Math.random() * pool.length)];
  const spawnObj = { type: tipo, rarity: raridade, spawnedAt: Date.now() };
  spawnedPets.set(groupId, spawnObj);
  return spawnObj;
}

function getSpawnAtivo(groupId) {
  const spawn = spawnedPets.get(groupId);
  if (!spawn) return null;
  if (Date.now() - spawn.spawnedAt > CONFIG.SPAWN_INTERVAL_MS) {
    spawnedPets.delete(groupId);
    return null;
  }
  return spawn;
}

// ─── AUTO-SCHEDULER ───────────────────────────────────────────────────────────

let _sock = null; // referência ao sock salva no init

/**
 * Registra o grupo como ativo para receber spawns.
 * Chame isso no handler principal de mensagens de grupo.
 *
 * Exemplo no seu index.js / messageHandler:
 *   if (jid.endsWith('@g.us')) registerActiveGroup(jid);
 */
function registerActiveGroup(groupJid) {
  activeGroups.add(groupJid);
}

/**
 * Dispara o spawn em todos os grupos ativos.
 * Chamado internamente pelo setInterval a cada hora.
 */
async function _runSpawnCycle() {
  if (!_sock) return;
  console.log(`[Pets] Spawn cycle — ${activeGroups.size} grupo(s) ativo(s)`);

  for (const groupJid of activeGroups) {
    try {
      await triggerSpawn(_sock, groupJid);
    } catch (e) {
      console.error(`[Pets] Erro ao fazer spawn em ${groupJid}:`, e.message);
    }
  }
}

/**
 * Inicializa o scheduler automático de spawn.
 * Chame UMA VEZ no boot do bot, passando o sock.
 *
 * Exemplo no index.js:
 *   const { initPetScheduler } = require('./handlers/pets');
 *   initPetScheduler(sock);
 */
function initPetScheduler(sock) {
  if (_sock) {
    console.warn('[Pets] initPetScheduler chamado mais de uma vez — ignorado.');
    return;
  }
  _sock = sock;
  console.log('[Pets] Scheduler de spawn iniciado. Intervalo: 1 hora.');

  // Primeiro spawn após 1 hora
  setInterval(_runSpawnCycle, CONFIG.SPAWN_INTERVAL_MS);
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

// !capturar
async function handleCapturarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const spawn = getSpawnAtivo(jid);
  if (!spawn) {
    return reply(sock, jid, msg, '❌ Nenhum pet apareceu ainda. Aguarde o próximo spawn!');
  }

  const petExistente = await getPet(userId);
  if (petExistente) {
    return reply(sock, jid, msg, '⚠️ Você já tem um pet! Use *!abrigo deixar* para liberá-lo antes de capturar outro.');
  }

  const def = PET_SYSTEM[spawn.type];
  const novoPet = {
    type:            spawn.type,
    name:            `${def.nome} Selvagem`,
    rarity:          spawn.rarity,
    level:           1,
    happiness:       50,
    energy:          100,
    fullness:        100,
    capturedAt:      new Date().toISOString(),
    lastInteraction: new Date().toISOString(),
  };

  await savePet(userId, novoPet);
  spawnedPets.delete(jid);

  const re = RARITY_EMOJI[spawn.rarity] ?? '⭐';
  return reply(sock, jid, msg,
    `${re} *${def.nome}* capturado com sucesso! (${spawn.rarity})\n\n` +
    `${def.emoji} _${def.desc}_\n\n` +
    `Use *!statuspet* para ver seus atributos.`
  );
}

// !alimentar
async function handleAlimentarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const espera = checkCooldown(userId, 'alimentar', CONFIG.COOLDOWN_ALIMENTAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para alimentar novamente!`);
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  if (pet.fullness >= CONFIG.STAT_MAX) {
    return reply(sock, jid, msg, `❌ *${pet.name}* está completamente cheio (🍽️ 100%) e recusou a comida!`);
  }

  const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
  const qtdComida = user?.inventory?.comida ?? 0;

  if (qtdComida <= 0) {
    return reply(sock, jid, msg, '❌ Você não tem comida no inventário! Compre na *!loja* antes de alimentar.');
  }

  const petAtualizado = {
    ...pet,
    fullness:  clamp(pet.fullness  + 30),
    happiness: clamp(pet.happiness + 10),
  };

  // Write atômico único — sem dupla gravação
  petCache.delete(userId);
  await prepareDailyMissionState(userId);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    {
      $set: { pet: { ...petAtualizado, lastInteraction: new Date().toISOString() } },
      $inc: { 'inventory.comida': -1, 'dailyMissions.progress.pet10': 1 },
    },
    { upsert: true }
  );

  return reply(sock, jid, msg,
    `🍖 Você alimentou *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade: ${petAtualizado.happiness}%\n` +
    `🍽️ Fome: ${petAtualizado.fullness}%\n` +
    `📦 Comidas restantes: ${qtdComida - 1}`
  );
}

// !brincar
async function handleBrincarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const espera = checkCooldown(userId, 'brincar', CONFIG.COOLDOWN_BRINCAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para brincar novamente!`);
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  if (pet.energy < 15) {
    return reply(sock, jid, msg, `❌ *${pet.name}* está sem energia para brincar! Aguarde ele recuperar (⚡ ${pet.energy}%).`);
  }

  const petAtualizado = {
    ...pet,
    happiness: clamp(pet.happiness + 20),
    energy:    clamp(pet.energy    - 15),
    fullness:  clamp(pet.fullness  - 10),
    level:     Math.min(CONFIG.NIVEL_MAX, (pet.level ?? 1) + 1),
  };

  // Write atômico único
  petCache.delete(userId);
  await prepareDailyMissionState(userId);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    {
      $set: { pet: { ...petAtualizado, lastInteraction: new Date().toISOString() } },
      $inc: { 'dailyMissions.progress.pet10': 1 },
    },
    { upsert: true }
  );

  return reply(sock, jid, msg,
    `🎾 Você brincou com *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade: ${petAtualizado.happiness}%\n` +
    `⚡ Energia: ${petAtualizado.energy}%\n` +
    `🍽️ Fome: ${petAtualizado.fullness}%\n` +
    `🏆 Nível: ${petAtualizado.level}/${CONFIG.NIVEL_MAX}`
  );
}

// !curar
async function handleCurarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const espera = checkCooldown(userId, 'curar', CONFIG.COOLDOWN_CURAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para curar novamente!`);
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  if (pet.energy >= CONFIG.STAT_MAX && pet.happiness >= CONFIG.STAT_MAX) {
    return reply(sock, jid, msg, `✅ *${pet.name}* já está completamente saudável!`);
  }

  const user   = await Usuario.findOne({ idWhatsApp: userId }).lean();
  const qtdRem = user?.inventory?.remedio ?? 0;

  if (qtdRem <= 0) {
    return reply(sock, jid, msg, '❌ Você não tem remédios no inventário! Compre na *!loja*.');
  }

  const petAtualizado = {
    ...pet,
    energy:    clamp(pet.energy    + 50),
    happiness: clamp(pet.happiness + 20),
  };

  petCache.delete(userId);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    {
      $set: { pet: { ...petAtualizado, lastInteraction: new Date().toISOString() } },
      $inc: { 'inventory.remedio': -1 },
    },
    { upsert: true }
  );

  return reply(sock, jid, msg,
    `💊 Você curou *${petAtualizado.name}*!\n\n` +
    `⚡ Energia: ${petAtualizado.energy}%\n` +
    `😊 Felicidade: ${petAtualizado.happiness}%\n` +
    `📦 Remédios restantes: ${qtdRem - 1}`
  );
}

// !renomearpet <nome>
async function handleRenomearPet(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return;

  const novoNome = caption.replace(/renomearpet\s*/i, '').trim();
  if (!novoNome || novoNome.length < 2 || novoNome.length > 24) {
    return reply(sock, jid, msg, '⚠️ Nome inválido! Use entre 2 e 24 caracteres.\nExemplo: *!renomearpet Farofa*');
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet para renomear!');
  }

  const nomeAntigo   = pet.name;
  const petAtualizado = { ...pet, name: novoNome };

  petCache.delete(userId);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $set: { pet: { ...petAtualizado, lastInteraction: new Date().toISOString() } } },
    { upsert: true }
  );

  return reply(sock, jid, msg, `✅ *${nomeAntigo}* agora se chama *${novoNome}*!`);
}

// !statuspet
async function handleStatusPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  const def     = PET_SYSTEM[pet.type] ?? { emoji: '🐾', nome: pet.type, xpMult: 1.0, pontMult: 1.0 };
  const re      = RARITY_EMOJI[pet.rarity] ?? '⭐';
  const humor   = getHumor(pet);
  const capData = pet.capturedAt ? new Date(pet.capturedAt).toLocaleDateString('pt-BR') : '?';

  return reply(sock, jid, msg,
    `${def.emoji} *${pet.name}*\n\n` +
    `${re} *${pet.rarity}*\n` +
    `🏆 Nível: ${pet.level ?? 1}/${CONFIG.NIVEL_MAX}\n` +
    `💭 Humor: ${humor}\n` +
    `━━━━━━━━━━━\n` +
    `😊 Felicidade : ${pet.happiness ?? 0}%\n` +
    `⚡ Energia    : ${pet.energy    ?? 0}%\n` +
    `🍽️ Fome       : ${pet.fullness  ?? 0}%\n` +
    `━━━━━━━━━━━\n` +
    `🎯 XP mult: ${def.xpMult}x | Pts mult: ${def.pontMult}x\n` +
    `📅 Capturado em: ${capData}`
  );
}

// !rankpet
async function handlePetRank(sock, msg, jid, contactNames = {}) {
  if (!somenteGrupo(jid)) {
    return reply(sock, jid, msg, '⚠️ Este comando só pode ser usado em grupos.');
  }

  try {
    const membros = await CarteiraGrupo.find({ idGrupo: jid }).lean();
    if (!membros.length) {
      return reply(sock, jid, msg,
        `🐾 *RANKING DE PETS — ESTE GRUPO*\n\nNenhum membro registrado.\n\n_Use *!capturar* para conseguir o seu!_`
      );
    }

    const idsMembros = membros.map(m => m.idWhatsApp);

    const usuarios = await Usuario.find({
      idWhatsApp:  { $in: idsMembros },
      'pet.name':  { $exists: true, $nin: [null, ''] },
      'pet.level': { $exists: true },
    }).lean();

    const ranks = usuarios
      .map(u => ({ ...u, score: getRankScore(u.pet) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (ranks.length === 0) {
      return reply(sock, jid, msg,
        `🐾 *RANKING DE PETS — ESTE GRUPO*\n\nNenhum pet registrado ainda.\n\n_Use *!capturar* para conseguir o seu!_`
      );
    }

    const linhas = ranks.map((entry, i) => {
      const nome = resolverNome(entry.idWhatsApp, contactNames) || entry.nome;
      const def  = PET_SYSTEM[entry.pet.type] ?? { emoji: '🐾' };
      const re   = RARITY_EMOJI[entry.pet.rarity] ?? '⭐';
      return `${MEDALS[i]} *${nome}* — ${def.emoji} ${entry.pet.name} ${re} Lvl ${entry.pet.level ?? 1}`;
    });

    return reply(sock, jid, msg,
      `🐾 *RANKING DE PETS — ESTE GRUPO* 🐾\n\n` +
      linhas.join('\n') +
      `\n\n_Use *!capturar* para entrar no ranking!_`
    );
  } catch (e) {
    console.error('[Pets] handlePetRank:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o ranking.');
  }
}

// !pets
async function handlePets(sock, msg, jid) {
  const grupos = { 'COMUM': [], 'RARO': [], 'ULTRA-RARO': [], 'LENDÁRIO': [] };

  for (const [, pet] of Object.entries(PET_SYSTEM)) {
    grupos[pet.rarity]?.push(`  ${pet.emoji} *${pet.nome}* — _${pet.desc}_`);
  }

  let texto = `🐾 *PETS DA NATUREZA* 🐾\n\n`;
  for (const [rar, lista] of Object.entries(grupos)) {
    const re = RARITY_EMOJI[rar] ?? '';
    texto += `${re} *${rar}*\n${lista.join('\n')}\n\n`;
  }
  texto += `💡 _Um pet selvagem aparece a cada hora. Use *!capturar* na hora certa!_`;

  return reply(sock, jid, msg, texto);
}

// !abrigo
async function handleAbrigo(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  if (!userId) return;

  const args = caption
    .replace(/^[!./]?abrigo\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s.toLowerCase());

  // ── !abrigo deixar ───────────────────────────────────────────────────────────
  if (args[0] === 'deixar') {
    const pet = await getPet(userId);
    if (!pet?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você não tem um pet para deixar no abrigo.\n_Capture um com *!capturar*!_`
      );
    }

    // Write atômico único: remove pet e salva no abrigo de uma vez
    petCache.delete(userId);
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $unset: { pet: '' },
        $set: {
          'petShelter.isSheltered':  true,
          'petShelter.shelteredPet': pet,
          'petShelter.leftAt':       new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    const def = PET_SYSTEM[pet.type] ?? { emoji: '🐾' };
    return reply(sock, jid, msg,
      `🏥 *PET ENVIADO AO ABRIGO!*\n\n` +
      `${def.emoji} *${pet.name}* foi guardado com segurança.\n\n` +
      `Para vê-lo novamente: *!abrigo*\n` +
      `Para adotá-lo de volta: *!abrigo ${pet.name} pegar*`
    );
  }

  // ── !abrigo <nome> pegar ─────────────────────────────────────────────────────
  if (args.length >= 2 && args[args.length - 1] === 'pegar') {
    const nomeBusca = args.slice(0, -1).join(' ');

    const alvo = await Usuario.findOne({
      'petShelter.isSheltered': true,
      'petShelter.shelteredPet.name': { $regex: new RegExp(nomeBusca, 'i') },
    }).lean();

    if (!alvo?.petShelter?.shelteredPet) {
      return reply(sock, jid, msg,
        `❌ Nenhum pet com o nome "*${nomeBusca}*" encontrado no abrigo.\n\nVer lista: *!abrigo*`
      );
    }

    const petAtual = await getPet(userId);
    if (petAtual?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você já tem *${petAtual.name}*! Deixe-o no abrigo antes de adotar outro.`
      );
    }

    const petAdotado = alvo.petShelter.shelteredPet;

    // Libera do abrigo
    await Usuario.findOneAndUpdate(
      { idWhatsApp: alvo.idWhatsApp },
      { $set: { 'petShelter.isSheltered': false, 'petShelter.shelteredPet': null } }
    );

    // Dá o pet ao novo dono (usando savePet para invalidar cache corretamente)
    await savePet(userId, petAdotado);

    const def = PET_SYSTEM[petAdotado.type] ?? { emoji: '🐾' };
    return reply(sock, jid, msg,
      `🎉 *ADOÇÃO CONCLUÍDA!*\n\n` +
      `${def.emoji} *${petAdotado.name}* (${petAdotado.rarity}) agora é seu!\n\n` +
      `Use *!statuspet* para ver os atributos.`
    );
  }

  // ── !abrigo (listagem) ───────────────────────────────────────────────────────
  try {
    const lista = await Usuario.find({ 'petShelter.isSheltered': true }).lean();

    if (lista.length === 0) {
      return reply(sock, jid, msg,
        `🏥 *ABRIGO DE PETS*\n\n😔 O abrigo está vazio!\n\n` +
        `Deixe seu pet: *!abrigo deixar*`
      );
    }

    let texto = `🏥 *ABRIGO DE PETS* — ${lista.length} pet(s)\n\n`;
    lista.forEach((u, i) => {
      const p   = u.petShelter.shelteredPet;
      const def = PET_SYSTEM[p.type] ?? { emoji: '🐾' };
      const re  = RARITY_EMOJI[p.rarity] ?? '⭐';
      texto += `${i + 1}. ${def.emoji} *${p.name}* ${re} (${p.rarity})\n`;
      texto += `   └ Lvl ${p.level ?? 1} | 😊 ${p.happiness ?? 0}% | ⚡ ${p.energy ?? 0}%\n\n`;
    });

    texto += `━━━━━━━━━━━\n`;
    texto += `*Para adotar:* !abrigo <nome> pegar\n`;
    texto += `Exemplo: _!abrigo ${lista[0].petShelter.shelteredPet.name} pegar_`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Pets] handleAbrigo lista:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o abrigo.');
  }
}

// Stub de compatibilidade
async function handleAdoptarPet(sock, msg, jid) {
  return reply(sock, jid, msg, '⚠️ Use *!abrigo <nome> pegar* para adotar um pet do abrigo!');
}

// ─── TRIGGER MANUAL (compatibilidade + uso interno do scheduler) ──────────────

async function triggerSpawn(sock, groupJid) {
  const spawn = spawnNovoPet(groupJid);
  const def   = PET_SYSTEM[spawn.type];
  const re    = RARITY_EMOJI[spawn.rarity];

  await sock.sendMessage(groupJid, {
    text:
      `🌿 *UM PET SELVAGEM APARECEU!* 🌿\n\n` +
      `${def.emoji} *${def.nome}* ${re} (${spawn.rarity})\n` +
      `_${def.desc}_\n\n` +
      `⚡ Digite *!capturar* para pegar!\n` +
      `⏳ Desaparece em 1 hora.`,
  });
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────

module.exports = {
  // Inicialização — chame no boot
  initPetScheduler,
  registerActiveGroup,

  // Handlers de comandos
  handleCapturarPet,
  handleAdoptarPet,
  handleAlimentarPet,
  handleBrincarPet,
  handleCurarPet,
  handleRenomearPet,
  handleStatusPet,
  handlePetRank,
  handlePets,
  handleAbrigo,

  // Utilitários externos
  triggerSpawn,
  PET_SYSTEM,
  getSpawnAtivo,
};