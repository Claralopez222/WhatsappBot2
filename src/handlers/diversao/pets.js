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

  const espera = checkCooldown(userId, 'alimentar', CONFIG.COOLDOWN_ALIMENTAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para alimentar novamente!`);
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  if (pet.fullness >= CONFIG.STAT_MAX) {
    return reply(
      sock, jid, msg,
      `❌ *${pet.name}* está completamente cheio (🍽️ 100%) e recusou a comida!`,
    );
  }

  const petAtualizado = comTimestamp({
    ...pet,
    fullness:  clamp(pet.fullness  + 30),
    happiness: clamp(pet.happiness + 10),
  });

  petCache.delete(userId);

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

  if (!userAtualizado) {
    return reply(
      sock, jid, msg,
      '❌ Você não tem comida no inventário! Compre na *!loja* antes de alimentar.',
    );
  }

  const qtdRestante = userAtualizado.inventory?.comida ?? 0;
  const aviso       = qtdRestante === 0
    ? '\n\n⚠️ _Você ficou sem comida! Compre mais na *!loja*._'
    : qtdRestante <= 2
      ? `\n\n⚠️ _Estoque baixo! Só restam ${qtdRestante} comida(s). Compre mais na *!loja*._`
      : '';

  return reply(
    sock, jid, msg,
    `🍖 Você alimentou *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade : ${petAtualizado.happiness}%\n` +
    `🍽️ Fome       : ${petAtualizado.fullness}%\n` +
    `📦 Comidas restantes: ${qtdRestante}` +
    aviso,
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

  const espera = checkCooldown(userId, 'brincar', CONFIG.COOLDOWN_BRINCAR);
  if (espera > 0) {
    return reply(sock, jid, msg, `⏳ Aguarde *${formatarTempo(espera)}* para brincar novamente!`);
  }

  const pet = await getPet(userId);
  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  const ENERGIA_MINIMA = 15;
  if (pet.energy < ENERGIA_MINIMA) {
    return reply(
      sock, jid, msg,
      `❌ *${pet.name}* está sem energia para brincar! Aguarde ele recuperar (⚡ ${pet.energy}%).`,
    );
  }

  if (pet.fullness <= 0) {
    return reply(
      sock, jid, msg,
      `❌ *${pet.name}* está com fome demais para brincar! Use *!alimentar* primeiro.`,
    );
  }

  // ── Sistema de XP ────────────────────────────────────────────────────────────
  const def        = PET_SYSTEM[pet.type] ?? { xpMult: 1.0 };
  const nivelAtual = pet.level ?? 1;
  const xpAtual    = pet.xp    ?? 0;

  // XP necessário cresce com o nível: 100 * nível atual
  const xpParaSubir  = nivelAtual * 100;
  const xpGanho      = Math.round(20 * def.xpMult);
  const xpNovo       = xpAtual + xpGanho;

  const podeSubir  = nivelAtual < CONFIG.NIVEL_MAX && xpNovo >= xpParaSubir;
  const novoNivel  = podeSubir ? nivelAtual + 1 : nivelAtual;
  const xpFinal    = podeSubir ? xpNovo - xpParaSubir : xpNovo;
  const subiuNivel = novoNivel > nivelAtual;
  // ─────────────────────────────────────────────────────────────────────────────

  const petAtualizado = comTimestamp({
    ...pet,
    happiness: clamp(pet.happiness + 20),
    energy:    clamp(pet.energy    - 15),
    fullness:  clamp(pet.fullness  - 10),
    level:     novoNivel,
    xp:        xpFinal,
  });

  petCache.delete(userId);

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

  const xpBar      = buildXpBar(xpFinal, podeSubir ? novoNivel * 100 : xpParaSubir);
  const nivelMsg   = subiuNivel
    ? `\n\n🎉 *${petAtualizado.name}* subiu para o nível ${petAtualizado.level}!`
    : '';
  const fomeAviso  = petAtualizado.fullness <= 20
    ? `\n⚠️ _${petAtualizado.name} está com fome! Use *!alimentar*._`
    : '';
  const energiAviso = petAtualizado.energy <= 20
    ? `\n⚠️ _${petAtualizado.name} está cansado! Use *!curar* ou aguarde._`
    : '';

  return reply(
    sock, jid, msg,
    `🎾 Você brincou com *${petAtualizado.name}*!\n\n` +
    `😊 Felicidade : ${petAtualizado.happiness}%\n` +
    `⚡ Energia    : ${petAtualizado.energy}%\n` +
    `🍽️ Fome       : ${petAtualizado.fullness}%\n` +
    `🏆 Nível      : ${petAtualizado.level}/${CONFIG.NIVEL_MAX}\n` +
    `✨ XP         : +${xpGanho} ${xpBar}` +
    nivelMsg +
    fomeAviso +
    energiAviso,
  );
}

// Barra de progresso de XP  ex: [████░░░░░░] 40/100
function buildXpBar(xpAtual, xpTotal, tamanho = 10) {
  const preenchido = Math.round((xpAtual / xpTotal) * tamanho);
  const vazio      = tamanho - preenchido;
  return `[${`█`.repeat(preenchido)}${`░`.repeat(vazio)}] ${xpAtual}/${xpTotal}`;
}

// --------------- !curar -------------------------------------

/**
 * Usa um remédio do inventário para recuperar energia (+50) e felicidade (+20) do pet.
 */
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

  const energiaCheia    = pet.energy    >= CONFIG.STAT_MAX;
  const felicidadeCheia = pet.happiness >= CONFIG.STAT_MAX;

  if (energiaCheia && felicidadeCheia) {
    return reply(sock, jid, msg, `✅ *${pet.name}* já está completamente saudável!`);
  }

  // Avisa o que será curado antes de consumir o remédio
  const beneficios = [];
  if (!energiaCheia)    beneficios.push(`⚡ Energia +50`);
  if (!felicidadeCheia) beneficios.push(`😊 Felicidade +20`);

  const petAtualizado = comTimestamp({
    ...pet,
    energy:    clamp(pet.energy    + 50),
    happiness: clamp(pet.happiness + 20),
  });

  petCache.delete(userId);

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
    return reply(sock, jid, msg, '❌ Você não tem remédios no inventário! Compre na *!loja*.');
  }

  const qtdRestante = userAtualizado.inventory?.remedio ?? 0;
  const aviso       = qtdRestante === 0 ? '\n\n⚠️ _Você ficou sem remédios! Compre mais na *!loja*._' : '';

  return reply(
    sock, jid, msg,
    `💊 Você curou *${petAtualizado.name}*!\n` +
    `${beneficios.join(' | ')}\n\n` +
    `⚡ Energia    : ${petAtualizado.energy}%\n` +
    `😊 Felicidade : ${petAtualizado.happiness}%\n` +
    `📦 Remédios restantes: ${qtdRestante}` +
    aviso,
  );
}

// !renomearpet <nome>
async function handleRenomearPet(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  if (!userId) return;

  const novoNome = caption.replace(/^[!.,/]?renomearpet\s*/i, '').trim();

  if (!novoNome) {
    return reply(sock, jid, msg, '⚠️ Você precisa informar um nome!\nExemplo: *!renomearpet Farofa*');
  }

  if (novoNome.length < 2 || novoNome.length > 24) {
    return reply(sock, jid, msg, `⚠️ Nome inválido! Use entre 2 e 24 caracteres. (atual: ${novoNome.length})`);
  }

  // Bloqueia caracteres especiais / emojis abusivos
  if (!/^[\w\s\u00C0-\u024F\u{1F300}-\u{1F9FF}]{2,24}$/u.test(novoNome)) {
    return reply(sock, jid, msg, '⚠️ Nome com caracteres inválidos! Use letras, números e espaços.');
  }

  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[renomear] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet para renomear!');
  }

  // Evita renomear para o mesmo nome
  if (pet.name.toLowerCase() === novoNome.toLowerCase()) {
    return reply(sock, jid, msg, `⚠️ *${pet.name}* já tem esse nome!`);
  }

  const nomeAntigo    = pet.name;
  const petAtualizado = comTimestamp({ ...pet, name: novoNome });

  petCache.delete(userId);

  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { pet: petAtualizado } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[renomear] Erro ao salvar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao renomear. Tente novamente!');
  }

  return reply(sock, jid, msg, `✅ *${nomeAntigo}* agora se chama *${novoNome}*!`);
}

// !statuspet
async function handleStatusPet(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return;

  let pet;
  try {
    pet = await getPet(userId);
  } catch (err) {
    console.error('[statuspet] Erro ao buscar pet:', err);
    return reply(sock, jid, msg, '❌ Erro interno ao buscar seu pet. Tente novamente!');
  }

  if (!pet?.name) {
    return reply(sock, jid, msg, '⚠️ Você não tem um pet. Use *!capturar* quando um aparecer!');
  }

  const def     = PET_SYSTEM[pet.type] ?? { emoji: '🐾', nome: pet.type, xpMult: 1.0, pontMult: 1.0 };
  const re      = RARITY_EMOJI[pet.rarity] ?? '⭐';
  const humor   = getHumor(pet);
  const capData = pet.capturedAt ? new Date(pet.capturedAt).toLocaleDateString('pt-BR') : '?';

  // Barra de XP — consistente com handleBrincarPet
  const nivelAtual  = pet.level ?? 1;
  const xpAtual     = pet.xp    ?? 0;
  const xpParaSubir = nivelAtual * 100;
  const xpBar       = nivelAtual >= CONFIG.NIVEL_MAX
    ? '✨ *NÍVEL MÁXIMO*'
    : `✨ XP: ${buildXpBar(xpAtual, xpParaSubir)} (${xpAtual}/${xpParaSubir})`;

  return reply(sock, jid, msg,
    `${def.emoji} *${pet.name}*\n\n` +
    `${re} *${pet.rarity}*\n` +
    `🏆 Nível : ${nivelAtual}/${CONFIG.NIVEL_MAX}\n` +
    `${xpBar}\n` +
    `💭 Humor : ${humor}\n` +
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
async function handlePetRank(sock, msg, jid) {
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

    const mencoes = ranks.map(entry => ({ id: entry.idWhatsApp }));

    const linhas = ranks.map((entry, i) => {
      const def = PET_SYSTEM[entry.pet.type] ?? { emoji: '🐾' };
      const re  = RARITY_EMOJI[entry.pet.rarity] ?? '⭐';
      return `${MEDALS[i]} @${entry.idWhatsApp.split('@')[0]} — ${def.emoji} ${entry.pet.name} ${re} Lvl ${entry.pet.level ?? 1}`;
    });

    await sock.sendMessage(jid, {
      text:
        `🐾 *RANKING DE PETS — ESTE GRUPO* 🐾\n\n` +
        linhas.join('\n') +
        `\n\n_Use *!capturar* para entrar no ranking!_`,
      mentions: mencoes.map(m => m.id),
    });

  } catch (e) {
    console.error('[Pets] handlePetRank:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o ranking.');
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

// !abrigo
async function handleAbrigo(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  if (!userId) return;

  // Detecta o prefixo usado pelo usuário (! . , /)
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
    const pet = await getPet(userId);
    if (!pet?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você não tem um pet para deixar no abrigo.\n_Capture um com *${prefix}capturar*!_`
      );
    }

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
      `Para vê-lo novamente: *${prefix}abrigo*\n` +
      `Para adotá-lo de volta: *${prefix}abrigo ${pet.name} pegar*`
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
        `❌ Nenhum pet com o nome "*${nomeBusca}*" encontrado no abrigo.\n\nVer lista: *${prefix}abrigo*`
      );
    }

    const petAtual = await getPet(userId);
    if (petAtual?.name) {
      return reply(sock, jid, msg,
        `⚠️ Você já tem *${petAtual.name}*! Use *${prefix}abrigo deixar* antes de adotar outro.`
      );
    }

    const petAdotado = alvo.petShelter.shelteredPet;

    await Usuario.findOneAndUpdate(
      { idWhatsApp: alvo.idWhatsApp },
      { $set: { 'petShelter.isSheltered': false, 'petShelter.shelteredPet': null } }
    );

    await savePet(userId, petAdotado);

    const def = PET_SYSTEM[petAdotado.type] ?? { emoji: '🐾' };
    return reply(sock, jid, msg,
      `🎉 *ADOÇÃO CONCLUÍDA!*\n\n` +
      `${def.emoji} *${petAdotado.name}* (${petAdotado.rarity}) agora é seu!\n\n` +
      `Use *${prefix}statuspet* para ver os atributos.`
    );
  }

  // ── !abrigo (listagem) ───────────────────────────────────────────────────────
  try {
    const lista = await Usuario.find({ 'petShelter.isSheltered': true }).lean();

    if (lista.length === 0) {
      return reply(sock, jid, msg,
        `🏥 *ABRIGO DE PETS*\n\n😔 O abrigo está vazio!\n\n` +
        `Deixe seu pet: *${prefix}abrigo deixar*`
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
    texto += `*Para adotar:* ${prefix}abrigo <nome> pegar\n`;
    texto += `Exemplo: _${prefix}abrigo ${lista[0].petShelter.shelteredPet.name} pegar_`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Pets] handleAbrigo lista:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar o abrigo.');
  }
}

// Stub de compatibilidade
async function handleAdoptarPet(sock, msg, jid, caption = '') {
  const prefixMatch = caption?.match(/^([!.,/])/);
  const prefix = prefixMatch ? prefixMatch[1] : '!';
  return reply(sock, jid, msg, `⚠️ Use *${prefix}abrigo <nome> pegar* para adotar um pet do abrigo!`);
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

const activeGroups = new Set();

function registerActiveGroup(jid) {
  activeGroups.add(jid);
}

function initPetScheduler(sock) {
  setInterval(() => {
    for (const jid of activeGroups) {
      triggerSpawn(sock, jid).catch(err =>
        console.error('[PetScheduler] Erro no spawn:', err)
      );
    }
  }, 60 * 60 * 1000); // 1 hora
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