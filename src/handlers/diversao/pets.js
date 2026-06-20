'use strict';

const path          = require('path');
const Usuario       = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));

const { prepareDailyMissionState } = require('./missoes');

const somenteGrupo = (jid) => jid?.endsWith('@g.us') ?? false;

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  STAT_MAX:           100,
  NIVEL_MAX:          100,
  COOLDOWN_ALIMENTAR: 30 * 60 * 1000,  // 30 min
  COOLDOWN_BRINCAR:   20 * 60 * 1000,  // 20 min
  COOLDOWN_CURAR:     60 * 60 * 1000,  // 1 hora
};

// ─── CATÁLOGO DE PETS ─────────────────────────────────────────────────────────
const PET_SYSTEM = {
  gato:      { nome: 'Gato',      emoji: '🐱', rarity: 'COMUM',      desc: 'Independente e misterioso.',   xpMult: 1.0, pontMult: 1.0, catchRate: 0.75 },
  cachorro:  { nome: 'Cachorro',  emoji: '🐶', rarity: 'COMUM',      desc: 'Leal e cheio de energia.',     xpMult: 1.0, pontMult: 1.0, catchRate: 0.75 },
  coelho:    { nome: 'Coelho',    emoji: '🐰', rarity: 'COMUM',      desc: 'Fofo e saltitante.',           xpMult: 1.1, pontMult: 1.0, catchRate: 0.70 },
  papagaio:  { nome: 'Papagaio',  emoji: '🦜', rarity: 'RARO',       desc: 'Repete tudo que você fala.',   xpMult: 1.2, pontMult: 1.1, catchRate: 0.50 },
  raposa:    { nome: 'Raposa',    emoji: '🦊', rarity: 'RARO',       desc: 'Esperta e curiosa.',           xpMult: 1.3, pontMult: 1.2, catchRate: 0.45 },
  lobo:      { nome: 'Lobo',      emoji: '🐺', rarity: 'ULTRA-RARO', desc: 'Feroz e solitário.',           xpMult: 1.5, pontMult: 1.4, catchRate: 0.30 },
  dragao:    { nome: 'Dragão',    emoji: '🐲', rarity: 'LENDÁRIO',   desc: 'Criatura mística das lendas.', xpMult: 2.0, pontMult: 2.0, catchRate: 0.12 },
  unicornio: { nome: 'Unicórnio', emoji: '🦄', rarity: 'LENDÁRIO',   desc: 'Puro e cheio de magia.',       xpMult: 2.0, pontMult: 2.0, catchRate: 0.12 },
};

const RARITY_EMOJI = {
  'COMUM':      '⭐',
  'RARO':       '🌟',
  'ULTRA-RARO': '💎',
  'LENDÁRIO':   '👑',
};

const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

// ─── ESTADO EM MEMÓRIA ────────────────────────────────────────────────────────
const spawnedPets = new Map(); // jid    → { type, rarity, spawnedAt }

// Cache com TTL de 5 minutos para evitar dados velhos presos em memória
const PET_CACHE_TTL_MS = 5 * 60 * 1000;
const petCache = {
  _store: new Map(),

  get(userId) {
    const entry = this._store.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.ts > PET_CACHE_TTL_MS) {
      this._store.delete(userId);
      return null;
    }
    return entry.data;
  },

  set(userId, pet) {
    this._store.set(userId, { data: pet, ts: Date.now() });
  },

  delete(userId) {
    this._store.delete(userId);
  },

  has(userId) {
    return this.get(userId) !== null;
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Extrai o ID do usuário da mensagem (grupo ou privado).
 * @param {object} msg
 * @returns {string}
 */
function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

/**
 * Responde uma mensagem com quote.
 * @param {object} sock
 * @param {string} jid
 * @param {object} msg
 * @param {string} text
 */
function reply(sock, jid, msg, text) {
  return sock.sendMessage(jid, { text }, { quoted: msg });
}

// Mapa de cooldowns isolado (sem ficar pendurado na função)
const _cooldownMap = new Map();

/**
 * Verifica cooldown de um comando para um usuário.
 * @param {string} userId
 * @param {string} cmd
 * @param {number} ms — duração do cooldown em milissegundos
 * @returns {number} 0 se liberado, ou ms restantes se ainda em cooldown
 */
function checkCooldown(userId, cmd, ms) {
  const key  = `${userId}:${cmd}`;
  const last = _cooldownMap.get(key) ?? 0;
  const diff = Date.now() - last;
  if (diff < ms) return ms - diff;
  _cooldownMap.set(key, Date.now());
  return 0;
}

/**
 * Remove o cooldown de um usuário para um comando (útil em rollbacks).
 * @param {string} userId
 * @param {string} cmd
 */
function clearCooldown(userId, cmd) {
  _cooldownMap.delete(`${userId}:${cmd}`);
}

/**
 * Formata milissegundos em string legível.
 * Ex: 90min → "1h 30min" | 75s → "1min 15s"
 * @param {number} ms
 * @returns {string}
 */
function formatarTempo(ms) {
  if (ms <= 0) return '0s';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

/**
 * Retorna o estado de humor do pet com base na média dos atributos.
 * @param {object} pet
 * @returns {string}
 */
function getHumor(pet) {
  const avg = (
    (pet.happiness ?? 0) +
    (pet.energy    ?? 0) +
    (pet.fullness  ?? 0)
  ) / 3;
  if (avg >= 80) return '😄 Feliz';
  if (avg >= 50) return '😐 Normal';
  if (avg >= 25) return '😟 Triste';
  return '😢 Sofrendo';
}

/**
 * Calcula o score de ranking do pet (nível tem peso maior que XP).
 * @param {object} pet
 * @returns {number}
 */
function getRankScore(pet) {
  return (pet.level ?? 1) * 1000 + (pet.xp ?? 0);
}

/**
 * Busca o pet ativo do usuário (cache com TTL → banco).
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getPet(userId) {
  const cached = petCache.get(userId);
  if (cached) return cached;

  const user = await Usuario.findOne({ idWhatsApp: userId }).select('pet').lean();
  const pet  = user?.pet ?? null;

  if (pet?.name) petCache.set(userId, pet);
  return pet;
}

/**
 * Salva o pet ativo do usuário (cache + banco).
 * @param {string} userId
 * @param {object} pet
 */
async function savePet(userId, pet) {
  petCache.set(userId, pet);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $set: { pet } },
    { upsert: true }
  );
}

/**
 * Remove o pet ativo do usuário (cache + banco).
 * Use este em vez de fazer $unset manual espalhado pelo código.
 * @param {string} userId
 */
async function clearPet(userId) {
  petCache.delete(userId);
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { $unset: { pet: '' } }
  );
}

/**
 * Spawna um novo pet selvagem para um grupo.
 * Remove o spawn automaticamente após 1 hora.
 * @param {string} jid — JID do grupo
 * @returns {object} dados do spawn
 */
function spawnNovoPet(jid) {
  const tipos = Object.keys(PET_SYSTEM);
  const type  = tipos[Math.floor(Math.random() * tipos.length)];
  const def   = PET_SYSTEM[type];

  const spawn = {
    type,
    rarity:    def.rarity,
    spawnedAt: Date.now(),
  };

  spawnedPets.set(jid, spawn);

  // Só remove se ainda for este mesmo spawn (evita apagar spawn mais recente)
  setTimeout(() => {
    if (spawnedPets.get(jid)?.spawnedAt === spawn.spawnedAt) {
      spawnedPets.delete(jid);
    }
  }, 60 * 60 * 1000);

  return spawn;
}

/**
 * Retorna o spawn ativo de um grupo, ou null se não houver.
 * @param {string} jid
 * @returns {object|null}
 */
function getSpawnAtivo(jid) {
  return spawnedPets.get(jid) ?? null;
}

// ============================================================
//  PET HANDLERS — capturar / alimentar / brincar / curar
// ============================================================

// --------------- helpers internos ---------------------------

/**
 * Garante que um valor numérico fique entre 0 e CONFIG.STAT_MAX.
 */
const clamp = (val, min = 0, max = CONFIG.STAT_MAX) =>
  Math.min(max, Math.max(min, val));

/**
 * Retorna um objeto pet com lastInteraction atualizado para agora.
 */
const comTimestamp = (pet) => ({
  ...pet,
  lastInteraction: new Date().toISOString(),
});

// --------------- !capturar ----------------------------------

/**
 * Captura o pet que está ativo no grupo (jid).
 * Falha se o usuário já tiver um pet ou se não houver spawn ativo.
 */
async function handleCapturarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  const spawn = spawnedPets.get(jid);
  if (!spawn) {
    return reply(
      sock, jid, msg,
      '❌ Nenhum pet apareceu por aqui ainda. Aguarde o próximo spawn nos arbustos!',
    );
  }

  const def = PET_SYSTEM[spawn.type];
  if (!def) {
    console.error(`[capturar] Tipo de pet desconhecido: ${spawn.type}`);
    return reply(sock, jid, msg, '❌ Erro interno: tipo de pet inválido.');
  }

  // 1. Verifica se o usuário já possui um pet ativo
  let petExistente;
  try {
    petExistente = await getPet(userId);
  } catch (err) {
    console.error('[capturar] Erro ao buscar pet existente:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao verificar seu pet. Tente novamente!');
  }

  if (petExistente?.name) {
    return reply(
      sock, jid, msg,
      '⚠️ Você já tem um pet ativo! Use *!abrigo deixar* para liberá-lo antes de tentar capturar outro.',
    );
  }

  // 2. Trava de concorrência: Remove o spawn IMEDIATAMENTE para evitar capturas duplas simultâneas
  spawnedPets.delete(jid);

  // 3. Sistema de taxa de captura com base na raridade
  // Se não houver taxa definida no PET_SYSTEM, usa padrões de mercado equilibrados
  const taxasRaridade = { 'COMUM': 0.75, 'RARO': 0.50, 'ULTRA-RARO': 0.30, 'LENDÁRIO': 0.12 };
  const chanceSucesso = def.catchRate ?? taxasRaridade[spawn.rarity] ?? 0.50;
  
  if (Math.random() > chanceSucesso) {
    return reply(
      sock, jid, msg,
      `💨 *O PET FUGIU!*\n\nVocê tentou se aproximar de fininho, mas o *${def.nome}* se assustou e correu para longe! 🌲`
    );
  }

  // 4. Instanciação do novo pet capturado
  const novoPet = {
    type:            spawn.type,
    name:            `${def.nome} Selvagem`,
    rarity:          spawn.rarity,
    level:           1,
    xp:              0,
    happiness:       50,
    energy:          100,
    fullness:        100,
    capturedAt:      new Date().toISOString(),
    lastInteraction: new Date().toISOString(),
  };

  try {
    // Salva o novo pet na conta do usuário
    await savePet(userId, novoPet);
  } catch (err) {
    console.error('[capturar] Erro ao salvar pet:', err);
    // Caso dê um erro de banco de dados, devolve o spawn para o grupo não sair no prejuízo
    spawnedPets.set(jid, spawn); 
    return reply(sock, jid, msg, '❌ Erro de banco de dados ao guardar o pet na mochila. Tente novamente!');
  }

  // 5. Retorno visual de sucesso para o chat
  const emoji = RARITY_EMOJI[spawn.rarity] ?? '⭐';
  const limiteNivel = typeof CONFIG !== 'undefined' && CONFIG.NIVEL_MAX ? CONFIG.NIVEL_MAX : 100;

  return reply(
    sock, jid, msg,
    `${emoji} *${def.nome} CAPTURADO!* (${spawn.rarity}) ${emoji}\n\n` +
    `${def.emoji} _"${def.desc}"_\n\n` +
    `🏆 Nível: *1* | ✨ XP: *0 / ${limiteNivel > 1 ? '100' : '—'}*\n` +
    `😊 Felicidade: *50%* | ⚡ Energia: *100%* | 🍽️ Fome: *100%*\n\n` +
    `💡 Use *!statuspet* para ver as ações disponíveis ou dê um nome para ele com *!nomearpet [nome]*!`,
  );
}

// --------------- !alimentar ---------------------------------

/**
 * Alimenta o pet do usuário, consumindo 1 unidade de comida do inventário.
 * Aumenta fullness (+30) e happiness (+10).
 */
async function handleAlimentarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  // ── Cooldown ──────────────────────────────────────────────
  const espera = checkCooldown(userId, 'alimentar', CONFIG.COOLDOWN_ALIMENTAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para alimentar novamente!`);
  }

  // ── Buscar pet ────────────────────────────────────────────
  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[alimentar] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  if (pet.fullness >= CONFIG.STAT_MAX) {
    return reply(sock, jid, msg,
      `❌ *${pet.name}* está completamente cheio (🍽️ 100%) e recusou a comida!`
    );
  }

  // ── Calcular novo estado ──────────────────────────────────
  const petAtualizado = comTimestamp({
    ...pet,
    fullness:  clamp(pet.fullness  + 30),
    happiness: clamp(pet.happiness + 10),
  });

  // ── Salvar no banco ───────────────────────────────────────
  let userAtualizado;
  try {
    await prepareDailyMissionState(userId);
    userAtualizado = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId, 'inventory.comida': { $gt: 0 } },
      {
        $set: { pet: petAtualizado },
        $inc: { 'inventory.comida': -1, 'dailyMissions.progress.pet10': 1 },
      },
      { new: true, upsert: false },
    );
  } catch (err) {
    console.error('[alimentar] Erro ao atualizar usuário:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao alimentar o pet. Tente novamente!');
  }

  // ── Sem comida no inventário ──────────────────────────────
  if (!userAtualizado) {
    return reply(sock, jid, msg,
      '❌ Você não tem comida no inventário! Compre na *!loja* antes de alimentar.'
    );
  }

  // ── Atualizar cache APÓS confirmação do banco ─────────────
  petCache.set(userId, petAtualizado);

  // ── Resposta ──────────────────────────────────────────────
  const qtdRestante = userAtualizado.inventory?.get?.('comida') ?? userAtualizado.inventory?.comida ?? 0;
  const aviso = qtdRestante === 0
    ? '\n\n⚠️ _Você ficou sem comida! Compre mais na *!loja*._'
    : qtdRestante <= 2
      ? `\n\n⚠️ _Estoque baixo! Só restam *${qtdRestante}* comida(s). Compre mais na *!loja*._`
      : '';

  return reply(sock, jid, msg,
    `🍖 Você alimentou *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade : *${petAtualizado.happiness}%*\n` +
    `🍽️ Fome       : *${petAtualizado.fullness}%*\n` +
    `📦 Comidas restantes: *${qtdRestante}*` +
    aviso
  );
}

// --------------- !brincar -----------------------------------

/**
 * Faz o usuário brincar com o pet, aumentando nível e felicidade,
 * mas consumindo energia e fome.
 */
async function handleBrincarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  // ── Cooldown ──────────────────────────────────────────────
  const espera = checkCooldown(userId, 'brincar', CONFIG.COOLDOWN_BRINCAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para brincar novamente!`);
  }

  // ── Buscar pet ────────────────────────────────────────────
  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[brincar] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  // ── Verificações de estado ────────────────────────────────
  const ENERGIA_MINIMA = 15;
  if ((pet.energy ?? 0) < ENERGIA_MINIMA) {
    return reply(sock, jid, msg,
      `❌ *${pet.name}* está sem energia para brincar! (⚡ ${pet.energy ?? 0}%)\n\n_Use *!curar* para recuperar energia._`
    );
  }

  if ((pet.fullness ?? 0) <= 0) {
    return reply(sock, jid, msg,
      `❌ *${pet.name}* está com fome demais para brincar! Use *!alimentar* primeiro.`
    );
  }

  // ── Sistema de XP ─────────────────────────────────────────
  const def        = PET_SYSTEM[pet.type] ?? { xpMult: 1.0 };
  const nivelAtual = pet.level ?? 1;
  const xpAtual    = pet.xp    ?? 0;
  const xpParaSubir = nivelAtual * 100;
  const xpGanho    = Math.round(20 * def.xpMult);
  const xpNovo     = xpAtual + xpGanho;

  const podeSubir  = nivelAtual < CONFIG.NIVEL_MAX && xpNovo >= xpParaSubir;
  const novoNivel  = podeSubir ? nivelAtual + 1 : nivelAtual;
  const xpFinal    = podeSubir ? xpNovo - xpParaSubir : xpNovo;
  const subiuNivel = novoNivel > nivelAtual;

  // ── Calcular novo estado ──────────────────────────────────
  const petAtualizado = comTimestamp({
    ...pet,
    happiness: clamp(pet.happiness + 20),
    energy:    clamp(pet.energy    - 15),
    fullness:  clamp(pet.fullness  - 10),
    level:     novoNivel,
    xp:        xpFinal,
  });

  // ── Salvar no banco ───────────────────────────────────────
  try {
    await prepareDailyMissionState(userId);
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      {
        $set: { pet: petAtualizado },
        $inc: { 'dailyMissions.progress.pet10': 1 },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('[brincar] Erro ao atualizar usuário:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao brincar com o pet. Tente novamente!');
  }

  // ── Atualizar cache APÓS confirmação do banco ─────────────
  petCache.set(userId, petAtualizado);

  // ── Montar resposta ───────────────────────────────────────
  const xpBar = buildXpBar(xpFinal, podeSubir ? novoNivel * 100 : xpParaSubir);

  const nivelMsg    = subiuNivel
    ? `\n\n🎉 *${petAtualizado.name}* subiu para o nível *${petAtualizado.level}*!`
    : '';
  const fomeAviso   = petAtualizado.fullness <= 20
    ? `\n⚠️ _${petAtualizado.name} está com fome! Use *!alimentar*._`
    : '';
  const energiaAviso = petAtualizado.energy <= 20
    ? `\n⚠️ _${petAtualizado.name} está cansado! Use *!curar* ou aguarde._`
    : '';

  return reply(sock, jid, msg,
    `🎾 Você brincou com *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade : *${petAtualizado.happiness}%*\n` +
    `⚡ Energia    : *${petAtualizado.energy}%*\n` +
    `🍽️ Fome       : *${petAtualizado.fullness}%*\n` +
    `🏆 Nível      : *${petAtualizado.level}/${CONFIG.NIVEL_MAX}*\n` +
    `✨ XP         : +${xpGanho} ${xpBar}` +
    nivelMsg +
    fomeAviso +
    energiaAviso
  );
}

// Barra de progresso de XP  ex: [████░░░░░░] 40/100
function buildXpBar(xpAtual, xpTotal, tamanho = 10) {
  if (!xpTotal || xpTotal <= 0) return `[██████████] MAX`;
  const preenchido = Math.min(Math.round((xpAtual / xpTotal) * tamanho), tamanho);
  const vazio      = tamanho - preenchido;
  return `[${'█'.repeat(preenchido)}${'░'.repeat(vazio)}] ${xpAtual}/${xpTotal}`;
}

// --------------- !curar -------------------------------------

/**
 * Usa um remédio do inventário para recuperar energia (+50) e felicidade (+20) do pet.
 */
async function handleCurarPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  // ── Cooldown ──────────────────────────────────────────────
  const espera = checkCooldown(userId, 'curar', CONFIG.COOLDOWN_CURAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para curar novamente!`);
  }

  // ── Buscar pet ────────────────────────────────────────────
  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[curar] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  // ── Verificar se já está saudável ─────────────────────────
  const energiaCheia    = (pet.energy    ?? 0) >= CONFIG.STAT_MAX;
  const felicidadeCheia = (pet.happiness ?? 0) >= CONFIG.STAT_MAX;

  if (energiaCheia && felicidadeCheia) {
    return reply(sock, jid, msg,
      `✅ *${pet.name}* já está completamente saudável!\n\n` +
      `⚡ Energia    : *${pet.energy}%*\n` +
      `😊 Felicidade : *${pet.happiness}%*`
    );
  }

  // ── Calcular novo estado ──────────────────────────────────
  const beneficios = [];
  if (!energiaCheia)    beneficios.push(`⚡ Energia +50`);
  if (!felicidadeCheia) beneficios.push(`😊 Felicidade +20`);

  const petAtualizado = comTimestamp({
    ...pet,
    energy:    clamp(pet.energy    + 50),
    happiness: clamp(pet.happiness + 20),
  });

  // ── Salvar no banco ───────────────────────────────────────
  let userAtualizado;
  try {
    userAtualizado = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId, 'inventory.remedio': { $gt: 0 } },
      {
        $set: { pet: petAtualizado },
        $inc: { 'inventory.remedio': -1 },
      },
      { new: true, upsert: false },
    );
  } catch (err) {
    console.error('[curar] Erro ao atualizar usuário:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao curar o pet. Tente novamente!');
  }

  if (!userAtualizado) {
    return reply(sock, jid, msg,
      '❌ Você não tem remédios no inventário! Compre na *!loja*.'
    );
  }

  // ── Atualizar cache APÓS confirmação do banco ─────────────
  petCache.set(userId, petAtualizado);

  // ── Resposta ──────────────────────────────────────────────
  const qtdRestante = userAtualizado.inventory?.get?.('remedio') ?? userAtualizado.inventory?.remedio ?? 0;
  const aviso = qtdRestante === 0
    ? '\n\n⚠️ _Você ficou sem remédios! Compre mais na *!loja*._'
    : qtdRestante <= 2
      ? `\n\n⚠️ _Estoque baixo! Só restam *${qtdRestante}* remédio(s). Compre mais na *!loja*._`
      : '';

  return reply(sock, jid, msg,
    `💊 Você curou *${petAtualizado.name}*!\n` +
    `${beneficios.join(' | ')}\n\n` +
    `⚡ Energia    : *${petAtualizado.energy}%*\n` +
    `😊 Felicidade : *${petAtualizado.happiness}%*\n` +
    `📦 Remédios restantes: *${qtdRestante}*` +
    aviso
  );
}

// !renomearpet / !nomearpet <nome>
async function handleRenomearPet(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return;

  // Aceita tanto !renomearpet quanto !nomearpet (com qualquer prefixo)
  const novoNome = caption
    .replace(/^[!.,/]?(?:renomearpet|nomearpet)\s*/i, '')
    .trim();

  // ── Validações de entrada ─────────────────────────────────
  if (!novoNome) {
    return reply(sock, jid, msg,
      '⚠️ Informe o novo nome!\n\n*Exemplo:* !nomearpet Farofa'
    );
  }

  if (novoNome.length < 2 || novoNome.length > 24) {
    return reply(sock, jid, msg,
      `⚠️ Nome deve ter entre *2 e 24 caracteres*.\n_Atual: ${novoNome.length} caractere(s)._`
    );
  }

  // ── Buscar pet ────────────────────────────────────────────
  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[renomear] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg,
      '⚠️ Você não tem um pet para renomear!\n_Use *!capturar* quando um aparecer._'
    );
  }

  // ── Evita renomear para o mesmo nome ─────────────────────
  if (pet.name.toLowerCase() === novoNome.toLowerCase()) {
    return reply(sock, jid, msg, `⚠️ *${pet.name}* já tem esse nome!`);
  }

  // ── Salvar ────────────────────────────────────────────────
  const nomeAntigo    = pet.name;
  const petAtualizado = comTimestamp({ ...pet, name: novoNome });

  petCache.delete(userId);

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { pet: petAtualizado } },
      { upsert: true }
    );
    petCache.set(userId, petAtualizado);
  } catch (err) {
    console.error('[renomear] Erro ao salvar pet:', err);
    petCache.set(userId, pet);
    return reply(sock, jid, msg, '❌ Erro interno ao renomear. Tente novamente!');
  }

  const def = PET_SYSTEM[pet.type] ?? { emoji: '🐾' };

  return reply(sock, jid, msg,
    `✅ *Pet renomeado com sucesso!*\n\n` +
    `${def.emoji} *${nomeAntigo}* → *${novoNome}*\n\n` +
    `_Use *!statuspet* para ver seu pet atualizado!_`
  );
}

// !rankpet
async function handlePetRank(sock, msg, jid) {
  // ── Garantir que é grupo ──────────────────────────────────
  if (!jid?.endsWith('@g.us')) {
    return reply(sock, jid, msg, '⚠️ Este comando só pode ser usado em grupos.');
  }

  try {
    // ── Buscar membros do grupo ───────────────────────────────
    let metadata;
    try {
      metadata = await sock.groupMetadata(jid);
    } catch (err) {
      console.error('[PetRank] Erro ao buscar metadata do grupo:', err);
      return reply(sock, jid, msg, '⚠️ Não consegui acessar os dados do grupo. Tente novamente.');
    }

    if (!metadata?.participants?.length) {
      return reply(sock, jid, msg,
        `🐾 *RANKING DE PETS*\n\nNão foi possível obter os membros do grupo.`
      );
    }

    // ── JIDs reais dos membros atuais — sem reconstruir @lid como telefone ──
const membrosAtuais = new Set(
  metadata.participants
    .map(p => p.id?.toLowerCase())
    .filter(Boolean)
);

    if (membrosAtuais.size === 0) {
      return reply(sock, jid, msg, `🐾 *RANKING DE PETS*\n\nNenhum membro encontrado no grupo.`);
    }

    // ── Buscar usuários com pet ───────────────────────────────
    const usuarios = await Usuario.find({
      idWhatsApp:  { $in: [...membrosAtuais] },
      'pet.name':  { $exists: true, $nin: [null, ''] },
      'pet.level': { $exists: true },
    })
      .select('idWhatsApp pet')
      .lean();

    if (!usuarios.length) {
      return reply(sock, jid, msg,
        `🐾 *RANKING DE PETS — ESTE GRUPO*\n\nNenhum pet registrado ainda.\n\n_Use *!capturar* para conseguir o seu!_`
      );
    }

    // ── Ordenar por score e pegar top 10 ─────────────────────
    const ranks = usuarios
      .map(u => ({ ...u, score: getRankScore(u.pet) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // ── Montar linhas ─────────────────────────────────────────
    const mentions = [];
    const linhas   = ranks.map((entry, i) => {
      const fullJid = entry.idWhatsApp.toLowerCase();
const numero  = fullJid.split('@')[0].split(':')[0];
mentions.push(fullJid);

      const def   = PET_SYSTEM[entry.pet.type] ?? { emoji: '🐾' };
      const re    = RARITY_EMOJI[entry.pet.rarity] ?? '⭐';
      const nivel = entry.pet.level ?? 1;
      const xp    = entry.pet.xp    ?? 0;
      const humor = getHumor(entry.pet);

      return (
        `${MEDALS[i]} @${numero}\n` +
        `   ${def.emoji} *${entry.pet.name}* ${re} (${entry.pet.rarity ?? '?'})\n` +
        `   🏆 Nível *${nivel}* | ✨ XP *${xp}* | ${humor}`
      );
    });

    const texto =
      `🐾 *RANKING DE PETS — TOP ${ranks.length}* 🐾\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━\n` +
      `_Use *!capturar* para entrar no ranking!_`;

    return sock.sendMessage(jid, { text: texto, mentions }, { quoted: msg });

  } catch (e) {
    console.error('[PetRank] Erro geral:', e);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o ranking de pets. Tente novamente.');
  }
}

// !pets
async function handlePets(sock, msg, jid, caption = '') {
  const prefixMatch = caption.match(/^([!.,/])/);
  const prefix      = prefixMatch ? prefixMatch[1] : '!';

  const grupos = { 'COMUM': [], 'RARO': [], 'ULTRA-RARO': [], 'LENDÁRIO': [] };

  for (const [, pet] of Object.entries(PET_SYSTEM)) {
    if (!pet.rarity || !grupos[pet.rarity]) continue; // ignora raridade desconhecida
    grupos[pet.rarity].push(`  ${pet.emoji} *${pet.nome}* — _${pet.desc}_`);
  }

  // Mostra o spawn ativo do grupo, se houver
  const spawnAtivo  = getSpawnAtivo(jid);
  const spawnAviso  = spawnAtivo
    ? `\n🌿 *UM PET ESTÁ APARECIDO AGORA!* Use *${prefix}capturar* rápido!\n`
    : '';

  let texto = `🐾 *PETS DA NATUREZA* 🐾\n${spawnAviso}\n`;

  for (const [rar, lista] of Object.entries(grupos)) {
    if (!lista.length) continue; // omite raridade sem nenhum pet
    const re = RARITY_EMOJI[rar] ?? '';
    texto += `${re} *${rar}* (${lista.length})\n${lista.join('\n')}\n\n`;
  }

  texto += `💡 _Um pet selvagem aparece a cada hora. Use *${prefix}capturar* na hora certa!_`;

  return reply(sock, jid, msg, texto);
}

// handleAbrigo — !abrigo deixar / !abrigo <nome> pegar
async function handleAbrigo(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  if (!userId) return;

  const prefixMatch = caption.match(/^([!.,/])/);
  const prefix = prefixMatch ? prefixMatch[1] : '!';

  const args = caption
    .replace(/^[!.,/]?abrigo\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s.toLowerCase());

  // ── !abrigo deixar ───────────────────────────────────────────────────────────
  if (args[0] === 'deixar') {
    let pet;
    try {
      pet = await getPet(userId);
    } catch (err) {
      console.error('[abrigo:deixar] Erro ao buscar pet:', err);
      return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
    }

    if (!pet?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você não tem um pet para deixar no abrigo.\n_Capture um com *${prefix}capturar*!_`
      );
    }

    // Verifica se já tem um pet no abrigo
    try {
      const jaNoAbrigo = await Usuario.findOne({
        idWhatsApp: userId,
        'petShelter.isSheltered': true,
        'petShelter.shelteredPet.name': { $exists: true },
      }).lean();

      if (jaNoAbrigo?.petShelter?.shelteredPet?.name) {
        const nomePetAbrigo = jaNoAbrigo.petShelter.shelteredPet.name;
        const nomeCmdResgatar = nomePetAbrigo.includes(' ') ? `"${nomePetAbrigo}"` : nomePetAbrigo;
        return reply(sock, jid, msg,
          `⚠️ Você já tem *${nomePetAbrigo}* no abrigo!\n\n` +
          `_Resgate-o primeiro com: *${prefix}abrigo ${nomeCmdResgatar} pegar*_`
        );
      }
    } catch (err) {
      console.error('[abrigo:deixar] Erro ao verificar abrigo:', err);
    }

    petCache.delete(userId);

    try {
      const resultado = await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        {
          $unset: { pet: '' },
          $set: {
            'petShelter.isSheltered':  true,
            'petShelter.shelteredPet': pet,
            'petShelter.leftAt':       new Date().toISOString(),
            'petShelter.ownerId':      userId,
          },
        },
        { new: true }
      );

      if (!resultado) {
        petCache.set(userId, pet);
        return reply(sock, jid, msg, '⚠️ Usuário não encontrado no banco de dados.');
      }
    } catch (err) {
      petCache.set(userId, pet);
      console.error('[abrigo:deixar] Erro ao salvar no banco:', err);
      return reply(sock, jid, msg, '❌ Erro interno ao enviar pet ao abrigo. Tente novamente!');
    }

    const def = PET_SYSTEM[pet.type] ?? { emoji: '🐾' };
    const re  = RARITY_EMOJI[pet.rarity] ?? '⭐';
    const nomeCmdPegar = pet.name.includes(' ') ? `"${pet.name}"` : pet.name;

    return reply(sock, jid, msg,
      `🏥 *PET ENVIADO AO ABRIGO!*\n\n` +
      `${def.emoji} *${pet.name}* ${re} (${pet.rarity ?? '?'})\n` +
      `🏆 Nível *${pet.level ?? 1}* | ✨ XP *${pet.xp ?? 0}*\n` +
      `😊 Felicidade *${pet.happiness ?? 0}%* | ⚡ Energia *${pet.energy ?? 0}%* | 🍽️ Fome *${pet.fullness ?? 0}%*\n\n` +
      `📋 Para ver o abrigo: *${prefix}abrigo*\n` +
      `🔄 Para resgatar: *${prefix}abrigo ${nomeCmdPegar} pegar*\n\n` +
      `💡 _Qualquer pessoa pode adotar seu pet enquanto ele estiver no abrigo!_`
    );
  }

  // ── !abrigo <nome> pegar ─────────────────────────────────────────────────────
  if (args.length >= 2 && args[args.length - 1] === 'pegar') {
    // Reconstrói o nome preservando capitalização original (antes do .toLowerCase())
    const nomeBusca = caption
      .replace(/^[!.,/]?abrigo\s*/i, '')
      .trim()
      .replace(/\s+pegar$/i, '')
      .trim();

    let alvo;
    try {
      alvo = await Usuario.findOne({
        'petShelter.isSheltered': true,
        'petShelter.shelteredPet.name': { $regex: new RegExp(nomeBusca, 'i') },
      }).lean();
    } catch (err) {
      console.error('[abrigo:pegar] Erro ao buscar no banco:', err);
      return reply(sock, jid, msg, '❌ Erro interno ao buscar no abrigo. Tente novamente!');
    }

    if (!alvo?.petShelter?.shelteredPet) {
      // Lista os pets disponíveis para ajudar o usuário
      let sugestoes = '';
      try {
        const disponiveis = await Usuario.find({ 'petShelter.isSheltered': true })
          .select('petShelter.shelteredPet.name petShelter.shelteredPet.type petShelter.shelteredPet.rarity')
          .lean();
        const nomes = disponiveis
          .map(u => {
            const p = u.petShelter?.shelteredPet;
            if (!p?.name) return null;
            const def = PET_SYSTEM[p.type] ?? { emoji: '🐾' };
            const re  = RARITY_EMOJI[p.rarity] ?? '⭐';
            return `${def.emoji} *${p.name}* ${re}`;
          })
          .filter(Boolean);
        if (nomes.length) {
          sugestoes = `\n\n🐾 *Pets disponíveis no abrigo:*\n${nomes.map(n => `• ${n}`).join('\n')}`;
        }
      } catch {}

      return reply(sock, jid, msg,
        `❌ Nenhum pet com o nome "*${nomeBusca}*" encontrado no abrigo.\n` +
        `_Verifique o nome exato — use o nome que aparece na lista._` +
        sugestoes +
        `\n\nVer lista completa: *${prefix}abrigo*`
      );
    }

    // Verifica se o usuário já tem um pet ativo
    let petAtual;
    try {
      petAtual = await getPet(userId);
    } catch (err) {
      console.error('[abrigo:pegar] Erro ao buscar pet atual:', err);
      return reply(sock, jid, msg, '❌ Erro interno. Tente novamente!');
    }

    if (petAtual?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você já tem *${petAtual.name}*!\n\n` +
        `Use *${prefix}abrigo deixar* antes de adotar outro.`
      );
    }

    const petAdotado   = alvo.petShelter.shelteredPet;
    const donoOriginal = alvo.idWhatsApp;
    const ehSeuProprio = donoOriginal === userId;

    // Trava otimista: marca como não-sheltered antes de salvar no adotante
    // para evitar adoções duplas simultâneas
    let liberou;
    try {
      liberou = await Usuario.findOneAndUpdate(
        { idWhatsApp: donoOriginal, 'petShelter.isSheltered': true },
        {
          $set: {
            'petShelter.isSheltered':  false,
            'petShelter.shelteredPet': null,
          },
        },
        { new: true }
      );
    } catch (err) {
      console.error('[abrigo:pegar] Erro ao liberar pet do abrigo:', err);
      return reply(sock, jid, msg, '❌ Erro interno ao liberar o pet do abrigo. Tente novamente!');
    }

    if (!liberou) {
      return reply(sock, jid, msg,
        `⚠️ *${petAdotado.name}* já foi adotado por outra pessoa agora mesmo!\n\n` +
        `Ver lista atualizada: *${prefix}abrigo*`
      );
    }

    try {
      await savePet(userId, petAdotado);
    } catch (err) {
      console.error('[abrigo:pegar] Erro ao salvar pet no adotante:', err);
      // Reverte a liberação para não perder o pet
      await Usuario.findOneAndUpdate(
        { idWhatsApp: donoOriginal },
        {
          $set: {
            'petShelter.isSheltered':  true,
            'petShelter.shelteredPet': petAdotado,
          },
        }
      ).catch(() => {});
      return reply(sock, jid, msg, '❌ Erro interno ao adotar o pet. Tente novamente!');
    }

    const def    = PET_SYSTEM[petAdotado.type] ?? { emoji: '🐾' };
    const re     = RARITY_EMOJI[petAdotado.rarity] ?? '⭐';
    const numero = donoOriginal.split('@')[0].split(':')[0].replace(/\D/g, '');
    const dono   = ehSeuProprio ? '_era seu próprio pet_' : `_de @${numero}_`;

    return sock.sendMessage(jid, {
      text:
        `🎉 *ADOÇÃO CONCLUÍDA!*\n\n` +
        `${def.emoji} *${petAdotado.name}* ${re} (${petAdotado.rarity ?? '?'})\n` +
        `🏆 Nível *${petAdotado.level ?? 1}* | ✨ XP *${petAdotado.xp ?? 0}*\n` +
        `😊 Felicidade *${petAdotado.happiness ?? 0}%* | ⚡ Energia *${petAdotado.energy ?? 0}%*\n` +
        `${dono}\n\n` +
        `Use *${prefix}statuspet* para ver os atributos completos.`,
      mentions: ehSeuProprio ? [] : [`${numero}@s.whatsapp.net`],
    }, { quoted: msg });
  }

  // ── !abrigo (listagem) ───────────────────────────────────────────────────────
  try {
    const lista = await Usuario.find({ 'petShelter.isSheltered': true })
      .select('idWhatsApp petShelter')
      .lean();

    // Filtra entradas inválidas (sem pet ou sem nome)
    const validos = lista.filter(u => u.petShelter?.shelteredPet?.name);

    if (!validos.length) {
      return reply(sock, jid, msg,
        `🏥 *ABRIGO DE PETS*\n\n` +
        `😔 O abrigo está vazio no momento!\n\n` +
        `💡 Deixe seu pet com: *${prefix}abrigo deixar*`
      );
    }

    // Ordena: pet do próprio usuário aparece primeiro
    validos.sort((a, b) => {
      if (a.idWhatsApp === userId) return -1;
      if (b.idWhatsApp === userId) return 1;
      return 0;
    });

    let texto = `🏥 *ABRIGO DE PETS* — ${validos.length} pet(s)\n━━━━━━━━━━━━━━━━━━\n\n`;

    validos.forEach((u, i) => {
      const p      = u.petShelter.shelteredPet;
      const def    = PET_SYSTEM[p.type] ?? { emoji: '🐾' };
      const re     = RARITY_EMOJI[p.rarity] ?? '⭐';
      const humor  = getHumor(p);
      const numero = u.idWhatsApp.split('@')[0].split(':')[0].replace(/\D/g, '');
      const ehSeu  = u.idWhatsApp === userId;
      const dono   = ehSeu ? ' *(seu)*' : ` _@${numero}_`;

      // Tempo no abrigo
      let tempoAbrigo = '';
      if (u.petShelter?.leftAt) {
        const diffMs = Date.now() - new Date(u.petShelter.leftAt).getTime();
        tempoAbrigo = ` • ⏳ ${formatarTempo(diffMs)} no abrigo`;
      }

      texto += `${i + 1}. ${def.emoji} *${p.name}* ${re}${dono}${tempoAbrigo}\n`;
      texto += `   └ 🏆 Nível *${p.level ?? 1}* | 😊 *${p.happiness ?? 0}%* | ⚡ *${p.energy ?? 0}%* | 🍽️ *${p.fullness ?? 0}%*\n`;
      texto += `   └ ${humor}\n`;
      texto += `   └ 📋 _${prefix}abrigo ${p.name.includes(' ') ? `"${p.name}"` : p.name} pegar_\n\n`;
    });

    texto += `━━━━━━━━━━━━━━━━━━\n`;
    texto += `🔄 *Adotar:* _${prefix}abrigo <nome exato> pegar_\n`;
    texto += `📤 *Deixar seu pet:* _${prefix}abrigo deixar_`;

    return reply(sock, jid, msg, texto);
  } catch (err) {
    console.error('[abrigo:listar] Erro ao carregar lista:', err);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o abrigo. Tente novamente!');
  }
}

// Stub de compatibilidade
async function handleAdoptarPet(sock, msg, jid, caption = '') {
  const prefixMatch = caption?.match(/^([!.,/])/);
  const prefix = prefixMatch ? prefixMatch[1] : '!';
  return reply(sock, jid, msg, `⚠️ Use *${prefix}abrigo <nome> pegar* para adotar um pet do abrigo!`);
}

// ─── TRIGGER MANUAL (compatibilidade + uso interno do scheduler) ──────────────

// ─── SPAWN DE PETS ────────────────────────────────────────────────────────────

/**
 * Dispara um spawn de pet selvagem num grupo.
 * Retorna true em sucesso, false em falha (sem lançar exceção).
 */
async function triggerSpawn(sock, groupJid) {
  const spawn = spawnNovoPet(groupJid);
  const def   = PET_SYSTEM[spawn.type];
  const re    = RARITY_EMOJI[spawn.rarity] ?? '⭐';

  if (!def) {
    console.error(`[triggerSpawn] Tipo de pet inválido após spawn: "${spawn.type}"`);
    spawnedPets.delete(groupJid); // limpa spawn inválido
    return false;
  }

  // Mensagem varia levemente por raridade para dar mais impacto
  const abertura = {
    'COMUM':      '🌿 *UM PET SELVAGEM APARECEU!* 🌿',
    'RARO':       '🌟 *UM PET RARO SURGIU DAS SOMBRAS!* 🌟',
    'ULTRA-RARO': '💎 *UM PET ULTRA-RARO EMERGIU!* 💎',
    'LENDÁRIO':   '👑 *UM PET LENDÁRIO DESCEU DOS CÉUS!* 👑',
  }[spawn.rarity] ?? '🌿 *UM PET SELVAGEM APARECEU!* 🌿';

  try {
    await sock.sendMessage(groupJid, {
      text:
        `${abertura}\n\n` +
        `${def.emoji} *${def.nome}* ${re} (${spawn.rarity})\n` +
        `_"${def.desc}"_\n\n` +
        `⚡ Digite *!capturar* para tentar pegar!\n` +
        `📊 Taxa de captura: *${Math.round((def.catchRate ?? 0.5) * 100)}%*\n` +
        `⏳ Desaparece em *1 hora*.\n\n` +
        `_Seja rápido — só um jogador pode capturá-lo!_`,
    });
    return true;
  } catch (err) {
    console.error(`[triggerSpawn] Falha ao enviar mensagem para ${groupJid}:`, err.message ?? err);
    // Remove o spawn do mapa se não conseguiu nem avisar o grupo
    spawnedPets.delete(groupJid);
    return false;
  }
}

// ─── REGISTRO DE GRUPOS ATIVOS ────────────────────────────────────────────────

const activeGroups = new Set();

/**
 * Registra um grupo como ativo para receber spawns periódicos.
 * Idempotente — chamar múltiplas vezes com o mesmo JID não duplica.
 */
function registerActiveGroup(jid) {
  if (!jid?.endsWith('@g.us')) return; // ignora JIDs inválidos silenciosamente
  activeGroups.add(jid);
}

// ─── HELPERS DO SCHEDULER ─────────────────────────────────────────────────────

/**
 * Verifica se o socket está pronto para enviar mensagens.
 */
function isSockReady(sock) {
  return !!(sock?.user);
}

/**
 * Aguarda N milissegundos.
 */
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Tenta disparar o spawn com retentativas em caso de falha de conexão.
 * Não lança exceção — erros são logados e absorvidos.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {number} tentativas — máximo de tentativas (padrão 3)
 * @param {number} delayMs    — espera entre tentativas em ms (padrão 15s)
 */
async function tentarSpawnComRetry(sock, jid, tentativas = 3, delayMs = 15_000) {
  for (let i = 1; i <= tentativas; i++) {

    // Aguarda a conexão estar pronta antes de tentar
    if (!isSockReady(sock)) {
      console.warn(
        `[PetScheduler] Socket não pronto para ${jid} ` +
        `(tentativa ${i}/${tentativas}). Aguardando ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
      continue;
    }

    const ok = await triggerSpawn(sock, jid);

    if (ok) {
      if (i > 1) console.log(`[PetScheduler] Spawn concluído para ${jid} na tentativa ${i}.`);
      return;
    }

    // triggerSpawn retornou false — verifica se vale tentar de novo
    if (i < tentativas) {
      console.warn(
        `[PetScheduler] Spawn falhou para ${jid} ` +
        `(tentativa ${i}/${tentativas}). Nova tentativa em ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
    } else {
      console.error(
        `[PetScheduler] Spawn abandonado para ${jid} após ${tentativas} tentativa(s).`
      );
    }
  }
}

// ─── SCHEDULER PRINCIPAL ──────────────────────────────────────────────────────

const PetSpawn = require('../../models/PetSpawn');

const INTERVALO_MS = 20 * 60 * 1000; // 20 minutos

/**
 * Inicia o scheduler de spawn de pets com persistência no MongoDB.
 * O timestamp do último spawn é salvo por grupo, então reinicializações
 * do servidor não resetam o cooldown.
 */
function initPetScheduler(sock) {
  let currentSock = sock;

  initPetScheduler.updateSock = (newSock) => {
    currentSock = newSock;
    console.log('[PetScheduler] Socket atualizado após reconexão.');
  };

  async function cicloSpawn() {
    const total = activeGroups.size;

    if (total === 0) {
      console.log('[PetScheduler] Nenhum grupo ativo, ciclo ignorado.');
      return;
    }

    if (!isSockReady(currentSock)) {
      console.warn('[PetScheduler] Socket não pronto, ciclo ignorado.');
      return;
    }

    console.log(`[PetScheduler] Ciclo iniciado — ${total} grupo(s) ativo(s).`);

    const agora = Date.now();
    let sucessos = 0;
    let ignorados = 0;

    for (const jid of activeGroups) {
      try {
        // Busca o timestamp do último spawn deste grupo no banco
        const registro = await PetSpawn.findOne({ idGrupo: jid }).lean();
        const ultimoSpawn = registro?.ultimoSpawn ? new Date(registro.ultimoSpawn).getTime() : 0;
        const tempoPassado = agora - ultimoSpawn;

        // Se ainda não passou 1 hora desde o último spawn, pula
        if (tempoPassado < INTERVALO_MS) {
          const falta = INTERVALO_MS - tempoPassado;
          const min   = Math.ceil(falta / 60000);
          console.log(`[PetScheduler] ${jid} — próximo spawn em ${min}min, pulando.`);
          ignorados++;
          continue;
        }

        // Salva o novo timestamp ANTES de enviar (evita spawn duplo em caso de crash)
        await PetSpawn.findOneAndUpdate(
          { idGrupo: jid },
          { $set: { ultimoSpawn: new Date(agora) } },
          { upsert: true }
        );

        await tentarSpawnComRetry(currentSock, jid);
        sucessos++;

        if (total > 1) await sleep(500);
      } catch (err) {
        console.error(`[PetScheduler] Erro ao processar spawn para ${jid}:`, err.message);
      }
    }

    console.log(
      `[PetScheduler] Ciclo concluído — ✅ ${sucessos} spawn(s) | ⏭️ ${ignorados} ignorado(s).`
    );
  }

  // Roda a cada 5 minutos para verificar quais grupos precisam de spawn
  // (em vez de exatamente 1 hora, pois o bot pode reiniciar no meio do intervalo)
  const CHECK_INTERVAL = 5 * 60 * 1000; // verifica a cada 5min

  // Primeira verificação após 1 minuto do boot
  setTimeout(() => {
    cicloSpawn();
    setInterval(cicloSpawn, CHECK_INTERVAL);
  }, 60 * 1000);

  console.log('[PetScheduler] Iniciado. Primeiro spawn em 20 minutos.');
}

// !statuspet
async function handleStatusPet(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  if (!userId) return;

  const prefixMatch = caption?.match(/^([!.,/])/);
  const prefix = prefixMatch ? prefixMatch[1] : '!';

  // ── Buscar pet ────────────────────────────────────────────
  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[statuspet] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg,
      `⚠️ Você não tem um pet!\n\n_Aguarde um spawn e use *${prefix}capturar* para pegar um._`
    );
  }

  // ── Dados do pet ──────────────────────────────────────────
  const def   = PET_SYSTEM[pet.type] ?? { emoji: '🐾', nome: '?', desc: '?', rarity: '?' };
  const re    = RARITY_EMOJI[pet.rarity] ?? '⭐';
  const humor = getHumor(pet);
  const nivel = pet.level ?? 1;
  const xp    = pet.xp    ?? 0;

  // Nível máximo → barra cheia; caso contrário, XP até o próximo nível
  const xpMax = nivel < CONFIG.NIVEL_MAX ? nivel * 100 : null;
  const xpBar = xpMax !== null ? buildXpBar(xp, xpMax) : '👑 *NÍVEL MÁXIMO*';

  // ── Barra visual de atributos ─────────────────────────────
  const barraAtributo = (val) => {
    const v       = Math.max(0, Math.min(100, val ?? 0));
    const cheio   = Math.round(v / 10);
    const vazio   = 10 - cheio;
    const cor     = v >= 60 ? '🟩' : v >= 30 ? '🟨' : '🟥';
    return `${cor.repeat(cheio)}${'⬛'.repeat(vazio)} *${v}%*`;
  };

  // ── Cooldowns ─────────────────────────────────────────────
  const tempoRestante = (cmd, cooldownMs) => {
    const last  = _cooldownMap.get(`${userId}:${cmd}`);
    if (!last) return '✅ Pronto';
    const resto = cooldownMs - (Date.now() - last);
    return resto > 0 ? `⏳ ${formatarTempo(resto)}` : '✅ Pronto';
  };

  const cdAlimentar = tempoRestante('alimentar', CONFIG.COOLDOWN_ALIMENTAR);
  const cdBrincar   = tempoRestante('brincar',   CONFIG.COOLDOWN_BRINCAR);
  const cdCurar     = tempoRestante('curar',     CONFIG.COOLDOWN_CURAR);

  // ── Alertas de estado crítico ─────────────────────────────
  const alertas = [];
  if ((pet.fullness  ?? 0) <= 20) alertas.push(`🍽️ _${pet.name} está com fome! Use *${prefix}alimentar*._`);
  if ((pet.energy    ?? 0) <= 20) alertas.push(`⚡ _${pet.name} está sem energia! Use *${prefix}curar*._`);
  if ((pet.happiness ?? 0) <= 20) alertas.push(`😟 _${pet.name} está triste! Use *${prefix}brincar*._`);

  const alertaTexto = alertas.length > 0
    ? `\n⚠️ *AVISOS URGENTES:*\n${alertas.join('\n')}\n`
    : '';

  // ── Tempo desde última interação ──────────────────────────
  let ultimaInteracao = '_Nunca interagiu_';
  if (pet.lastInteraction) {
    const diffMs  = Date.now() - new Date(pet.lastInteraction).getTime();
    ultimaInteracao = diffMs < 60_000
      ? 'Agora há pouco'
      : `há ${formatarTempo(diffMs)}`;
  }

  // ── Montar resposta ───────────────────────────────────────
  return reply(sock, jid, msg,
    `${def.emoji} *${pet.name}* ${re}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Tipo    :* ${def.nome} (${pet.rarity ?? '?'})\n` +
    `🎭 *Humor   :* ${humor}\n` +
    `🏆 *Nível   :* ${nivel}/${CONFIG.NIVEL_MAX}\n` +
    `✨ *XP      :* ${xpBar}\n` +
    `🕒 *Última  :* ${ultimaInteracao}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `😊 *Felicidade*\n${barraAtributo(pet.happiness)}\n` +
    `⚡ *Energia*\n${barraAtributo(pet.energy)}\n` +
    `🍽️ *Fome*\n${barraAtributo(pet.fullness)}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⏱️ *Cooldowns:*\n` +
    `  🍖 Alimentar : ${cdAlimentar}\n` +
    `  🎾 Brincar   : ${cdBrincar}\n` +
    `  💊 Curar     : ${cdCurar}\n` +
    `━━━━━━━━━━━━━━━━━━` +
    alertaTexto +
    (alertaTexto ? '' : '\n') +
    `📌 *Comandos:*\n` +
    `  *${prefix}alimentar* | *${prefix}brincar* | *${prefix}curar*\n` +
    `  *${prefix}renomearpet* | *${prefix}abrigo deixar*`
  );
}

// ─── !pet on / !pet off ───────────────────────────────────────────────────────
//
// Liga ou desliga o spawn automático de pets selvagens no grupo.
// Apenas admins podem usar. Quando desativado, o cicloSpawn pula o grupo
// mesmo que ele esteja em activeGroups.
//
// Persistido no MongoDB (model PetSpawn) para sobreviver a reinícios.
// ────────────────────────────────────────────────────────────────────────────

// !pet on / !pet off / !pet status
async function handlePetToggle(sock, msg, jid, caption = '') {
  if (!jid?.endsWith('@g.us')) {
    return reply(sock, jid, msg, '⚠️ Este comando só pode ser usado em grupos.');
  }

  // ── Extrai o argumento (on/off/status) ─────────────────────
  const arg = caption
    .replace(/^[!.,/]?pet\s*/i, '')
    .trim()
    .toLowerCase();

  if (!['on', 'off', 'status'].includes(arg)) {
    return reply(sock, jid, msg,
      `⚠️ Uso incorreto!\n\n` +
      `*!pet on* — ativa o spawn de pets neste grupo\n` +
      `*!pet off* — desativa o spawn de pets neste grupo\n` +
      `*!pet status* — vê o status atual`
    );
  }

  // ── Status: qualquer membro pode consultar ──────────────────
  if (arg === 'status') {
    let registro;
    try {
      registro = await PetSpawn.findOne({ idGrupo: jid }).select('spawnAtivo').lean();
    } catch (err) {
      console.error('[handlePetToggle] Erro ao buscar status:', err.message);
      return reply(sock, jid, msg, '❌ Erro ao consultar status. Tente novamente!');
    }

    const ativo = registro?.spawnAtivo !== false; // default true se nunca configurado
    return reply(sock, jid, msg,
      `🐾 *SPAWN DE PETS — STATUS*\n\n` +
      `${ativo ? '✅ *Ativado*' : '❌ *Desativado*'} neste grupo.\n\n` +
      `_Use *!pet ${ativo ? 'off' : 'on'}* para ${ativo ? 'desativar' : 'ativar'}._`
    );
  }

  // ── Ligar/Desligar exige admin ───────────────────────────────
  const senderJid = msg.key.participant || msg.key.remoteJid;
  let souAdmin = false;
  try {
    const meta = await sock.groupMetadata(jid);
    const part = meta.participants?.find(
      p => p.id === senderJid || p.lid === senderJid
    );
    souAdmin = part?.admin === 'admin' || part?.admin === 'superadmin';
  } catch (err) {
    console.error('[handlePetToggle] Erro ao checar admin:', err.message);
    return reply(sock, jid, msg, '❌ Erro ao verificar permissões. Tente novamente!');
  }

  if (!souAdmin) {
    return reply(sock, jid, msg, '❌ Apenas admins podem ativar/desativar o spawn de pets!');
  }

  const novoEstado = arg === 'on';

  // ── Evita escrita desnecessária se já está no estado pedido ──
  let registroAtual;
  try {
    registroAtual = await PetSpawn.findOne({ idGrupo: jid }).select('spawnAtivo').lean();
  } catch (err) {
    console.error('[handlePetToggle] Erro ao verificar estado atual:', err.message);
    return reply(sock, jid, msg, '❌ Erro interno ao consultar configuração. Tente novamente!');
  }

  const estadoAtual = registroAtual?.spawnAtivo !== false;
  if (estadoAtual === novoEstado) {
    return reply(sock, jid, msg,
      `ℹ️ O spawn de pets já está *${novoEstado ? 'ativado' : 'desativado'}* neste grupo!`
    );
  }

  try {
    await PetSpawn.findOneAndUpdate(
      { idGrupo: jid },
      { $set: { spawnAtivo: novoEstado } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[handlePetToggle] Erro ao salvar:', err.message);
    return reply(sock, jid, msg, '❌ Erro interno ao salvar configuração. Tente novamente!');
  }

  if (novoEstado) {
    registerActiveGroup(jid); // garante que volta a ser monitorado pelo scheduler
  }

  return reply(sock, jid, msg,
    novoEstado
      ? `✅ *Spawn de pets ATIVADO* neste grupo! 🐾\n\n_Pets selvagens voltarão a aparecer periodicamente._`
      : `❌ *Spawn de pets DESATIVADO* neste grupo.\n\n_Nenhum pet selvagem vai mais aparecer aqui até reativar com *!pet on*._`
  );
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
  handlePetRank,
  handlePets,
  handleAbrigo,
  handleStatusPet,
  handlePetToggle,

  // Utilitários externos
  triggerSpawn,
  PET_SYSTEM,
  getSpawnAtivo,
};