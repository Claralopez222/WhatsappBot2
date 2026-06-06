/**
 * Sistema de Pets — Piroquinhas Bot (Spawn automático a cada hora)
 * Comandos: !capturar, !alimentar, !brincar, !statuspet, !rankpet, !pets, !abrigo
 * !abrigo — Lista pets / !abrigo deixar — Deixa pet / !abrigo <nome> pegar — Adota
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

const petData = new Map();
const spawnedPets = new Map(); // { groupId: { type, rarity, spawnedAt } }

const petSystem = {
  // COMUNS (40%)
  cachorro: { emoji: '🐶', nome: 'Cachorro', rarity: 'COMUM', xpMult: 1.5, pontMult: 1.5, desc: 'Fiel e companheiro para todas as horas.' },
  gato: { emoji: '🐱', nome: 'Gato', rarity: 'COMUM', xpMult: 1.4, pontMult: 1.4, desc: 'Independente e muito caçador.' },
  coelho: { emoji: '🐰', nome: 'Coelho', rarity: 'COMUM', xpMult: 1.3, pontMult: 1.3, desc: 'Rápido, fofinho e adora cenouras.' },
  pinguim: { emoji: '🐧', nome: 'Pinguim', rarity: 'COMUM', xpMult: 1.4, pontMult: 1.4, desc: 'Gosta de frio e anda de um jeito engraçado.' },
  macaco: { emoji: '🐵', nome: 'Macaco', rarity: 'COMUM', xpMult: 1.6, pontMult: 1.6, desc: 'Super inteligente e muito travesso.' },
  
  // RAROS (35%)
  lobo: { emoji: '🐺', nome: 'Lobo', rarity: 'RARO', xpMult: 1.7, pontMult: 1.7, desc: 'O protetor da alcateia selvagem.' },
  raposa: { emoji: '🦊', nome: 'Raposa', rarity: 'RARO', xpMult: 1.7, pontMult: 1.7, desc: 'Mágica, astuta e muito traiçoeira.' },
  urso: { emoji: '🐻', nome: 'Urso', rarity: 'RARO', xpMult: 1.8, pontMult: 1.8, desc: 'Forte, robusto e adora um mel.' },
  coruja: { emoji: '🦉', nome: 'Coruja', rarity: 'RARO', xpMult: 1.8, pontMult: 1.8, desc: 'Símbolo da sabedoria da noite.' },
  elefante: { emoji: '🐘', nome: 'Elefante', rarity: 'RARO', xpMult: 1.9, pontMult: 1.9, desc: 'Gigante gentil com memória implacável.' },
  tigre: { emoji: '🐯', nome: 'Tigre', rarity: 'RARO', xpMult: 1.9, pontMult: 1.9, desc: 'Ágil e com garras afiadíssimas.' },
  girafa: { emoji: '🦒', nome: 'Girafa', rarity: 'RARO', xpMult: 1.5, pontMult: 1.5, desc: 'Observa tudo do alto com elegância.' },
  leao_marinho: { emoji: '🦭', nome: 'Leão Marinho', rarity: 'RARO', xpMult: 1.6, pontMult: 1.6, desc: 'Adora fazer acrobacias na água.' },
  
  // ULTRA-RAROS (20%)
  falcao: { emoji: '🦅', nome: 'Falcão', rarity: 'ULTRA-RARO', xpMult: 1.8, pontMult: 1.8, desc: 'Visão cirúrgica e voo extremamente rápido.' },
  leao: { emoji: '🦁', nome: 'Leão', rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0, desc: 'O imponente rei da selva africana.' },
  tubarao: { emoji: '🦈', nome: 'Tubarão', rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0, desc: 'O maior e mais temido predador dos oceanos.' },
  
  // LENDÁRIOS (5%)
  dragao: { emoji: '🐉', nome: 'Dragão', rarity: 'LENDÁRIO', xpMult: 2.5, pontMult: 2.5, desc: 'Criatura mítica cuspidora de fogo puro.' },
  fenix: { emoji: '🔥', nome: 'Fênix', rarity: 'LENDÁRIO', xpMult: 3.0, pontMult: 3.0, desc: 'Pássaro lendário que renasce das próprias cinzas.' },
};

function getUserId(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

function getPetRankScore(pet) {
  if (!pet) return 0;
  const levelScore = (pet.level || 1) * 100;
  const statusScore = (pet.happiness || 0) + (pet.energy || 0) + (pet.fullness || 0);
  return levelScore + statusScore;
}

function spawnNewPet(groupId) {
  const rnd = Math.random() * 100;
  let rarity, petPool;
  
  if (rnd < 60) {
    rarity = 'COMUM';
    petPool = Object.entries(petSystem).filter(([_, p]) => p.rarity === 'COMUM');
  } else if (rnd < 85) {
    rarity = 'RARO';
    petPool = Object.entries(petSystem).filter(([_, p]) => p.rarity === 'RARO');
  } else if (rnd < 97) {
    rarity = 'ULTRA-RARO';
    petPool = Object.entries(petSystem).filter(([_, p]) => p.rarity === 'ULTRA-RARO');
  } else {
    rarity = 'LENDÁRIO';
    petPool = Object.entries(petSystem).filter(([_, p]) => p.rarity === 'LENDÁRIO');
  }
  
  const [petType, petDef] = petPool[Math.floor(Math.random() * petPool.length)];
  const petDataObj = {
    type: petType,
    rarity: rarity,
    spawnedAt: new Date().toISOString(),
  };
  spawnedPets.set(groupId, petDataObj);
  return { type: petType, rarity: rarity, ...petDef };
}

function getOrSpawnPet(groupId) {
  const now = new Date();
  let pet = spawnedPets.get(groupId);
  
  if (!pet || (now - new Date(pet.spawnedAt)) > 3600000) {
    pet = spawnNewPet(groupId);
  }
  
  const baseDef = petSystem[pet.type];
  return { ...pet, ...baseDef };
}

async function savePet(userId, petObj) {
  petData.set(userId, petObj);
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { pet: petObj } },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (e) {
    console.error('⚠️ Erro ao salvar pet:', e.message);
  }
}

async function getPet(userId) {
  if (petData.has(userId)) return petData.get(userId);
  
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    if (user?.pet) {
      petData.set(userId, user.pet);
      return user.pet;
    }
  } catch (e) {
    console.error('⚠️ Erro ao buscar pet:', e.message);
  }
  return null;
}

// ─── !capturar
async function handleCapturarPet(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const groupId = jid;
  
  const currentPet = getOrSpawnPet(groupId);
  if (!currentPet) {
    await sock.sendMessage(jid, { text: '❌ Nenhum pet apareceu ainda. Aguarde um pouco!' }, { quoted: msg });
    return;
  }
  
  const userPet = await getPet(userId);
  if (userPet) {
    await sock.sendMessage(jid, { text: '⚠️ Você já tem um pet! Deixe-o no abrigo primeiro usando *!abrigo deixar*.' }, { quoted: msg });
    return;
  }
  
  const newPet = {
    type: currentPet.type,
    name: `${currentPet.nome || currentPet.type} Selvagem`,
    rarity: currentPet.rarity,
    level: 1,
    happiness: 50,
    energy: 100,
    fullness: 100,
    capturedAt: new Date().toISOString(),
  };
  
  await savePet(userId, newPet);
  spawnedPets.delete(groupId);
  
  let rarityEmoji = '⭐';
  if (currentPet.rarity === 'RARO') rarityEmoji = '🌟';
  else if (currentPet.rarity === 'ULTRA-RARO') rarityEmoji = '✨';
  else if (currentPet.rarity === 'LENDÁRIO') rarityEmoji = '💎';
  
  await sock.sendMessage(jid, { text: `${rarityEmoji} *${currentPet.nome || currentPet.type}* capturado! (${currentPet.rarity})\n\nUse *!statuspet* para ver detalhes!` }, { quoted: msg });
}

// ─── Stub para !adotar
async function handleAdoptarPet(sock, msg, jid, caption) {
  await sock.sendMessage(jid, { text: '⚠️ Use *!capturar* para pegar um pet que aparecer no grupo!' }, { quoted: msg });
}

// ─── !alimentar
async function handleAlimentarPet(sock, msg, jid, author) {
  const userId = getUserId(msg);
  const user = await Usuario.findOne({ idWhatsApp: userId });
  const pet = user?.pet;
  
  if (!pet || !pet.name) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não capturou um pet. Use *!capturar* quando um aparecer no grupo.' }, { quoted: msg });
    return;
  }

  if (pet.fullness >= 100) {
    await sock.sendMessage(jid, { text: `❌ *${pet.name}* está completamente cheio (🍽️ 100%) e recusou a comida!` }, { quoted: msg });
    return;
  }

  const quantidadeComida = user.inventario?.comida || 0;
  if (quantidadeComida <= 0) {
    await sock.sendMessage(jid, { text: '❌ Você não possui comida no seu inventário! Compre itens na loja antes de alimentar seu companheiro.' }, { quoted: msg });
    return;
  }

  pet.fullness = Math.min(100, pet.fullness + 30);
  pet.happiness = Math.min(100, pet.happiness + 10);
  
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { 
      $set: { pet: pet },
      $inc: { 
        'inventario.comida': -1,
        'dailyMissions.progress.pet10': 1 
      } 
    }
  );
  
  petData.set(userId, pet);
  await sock.sendMessage(jid, { text: `🍖 Você usou 1x Comida e alimentou *${pet.name}*!\n\n😊 Felicidade: ${pet.happiness}%\n🍽️ Fome: ${pet.fullness}%\n📦 Comidas restantes: ${quantidadeComida - 1}` }, { quoted: msg });
}

// ─── !brincar
async function handleBrincarPet(sock, msg, jid, author) {
  const userId = getUserId(msg);
  const pet = await getPet(userId);
  
  if (!pet || !pet.name) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não capturou um pet. Use *!capturar* quando um aparecer no grupo.' }, { quoted: msg });
    return;
  }

  if (pet.happiness >= 80) {
    await sock.sendMessage(jid, { text: `❌ *${pet.name}* já está muito feliz! Deixe ele descansar um pouco antes de brincar de novo (😊 ${pet.happiness}%).` }, { quoted: msg });
    return;
  }
  
  pet.happiness = Math.min(100, pet.happiness + 20);
  pet.energy = Math.max(0, pet.energy - 15);
  pet.fullness = Math.max(0, pet.fullness - 10);
  pet.level = Math.min(50, pet.level + 1);
  
  await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    { 
      $set: { pet: pet },
      $inc: { 'dailyMissions.progress.pet10': 1 }
    }
  );

  petData.set(userId, pet);
  await sock.sendMessage(jid, { text: `🎾 Você brincou com *${pet.name}*!\n\n😊 Felicidade: ${pet.happiness}%\n⚡ Energia: ${pet.energy}%\n🍽️ Fome: ${pet.fullness}%\n🏆 Nível: ${pet.level}` }, { quoted: msg });
}

// ─── !statuspet
async function handleStatusPet(sock, msg, jid) {
  const userId = getUserId(msg);
  const pet = await getPet(userId);
  
  if (!pet || !pet.name) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não capturou um pet. Use *!capturar* quando um aparecer!' }, { quoted: msg });
    return;
  }
  
  const petDef = petSystem[pet.type] || { emoji: '🐾', nome: pet.type, xpMult: 1.0, pontMult: 1.0 };
  let rarityEmoji = '⭐';
  if (pet.rarity === 'RARO') rarityEmoji = '🌟';
  else if (pet.rarity === 'ULTRA-RARO') rarityEmoji = '✨';
  else if (pet.rarity === 'LENDÁRIO') rarityEmoji = '💎';
  
  const texto = `${petDef.emoji} *${pet.name}*\n\n${rarityEmoji} *${pet.rarity}*\n🏆 Nível: ${pet.level}\n😊 Felicidade: ${pet.happiness}%\n⚡ Energia: ${pet.energy}%\n🍽️ Fome: ${pet.fullness}%\n📅 Capturado em: ${new Date(pet.capturedAt).toLocaleDateString()}\n\n🎯 Multiplicadores: ${petDef.xpMult}x XP | ${petDef.pontMult}x Pontos`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !rankpet (Filtrado e corrigido conforme a image_374eae.png)
async function handlePetRank(sock, msg, jid, contactNames = {}) {
  try {
    // Traz apenas registros que não sejam grupos e que tenham o subobjeto de pet e nome válidos
    const usuariosComPet = await Usuario.find({
      idWhatsApp: { $not: /@g.us$/ },
      'pet.name': { $exists: true, $ne: null, $ne: '' }
    }).lean();
    
    const ranks = usuariosComPet
      .map(u => ({ 
        idWhatsApp: u.idWhatsApp, 
        nome: u.nome, 
        pet: u.pet, 
        score: getPetRankScore(u.pet) 
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (ranks.length === 0) {
      await sock.sendMessage(jid, { text: '🐾 *RANKING DE PETS DO BOT*\n\nℹ️ Nenhum pet registrado no momento.\n\n_Use *!capturar* para conseguir o seu companheiro!_' }, { quoted: msg });
      return;
    }

    const lines = ranks.map((entry, index) => {
      const userId = entry.idWhatsApp;
      const name = entry.nome || contactNames[userId] || userId.split('@')[0];
      const petDef = petSystem[entry.pet.type] || { emoji: '🐾' };
      
      return `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▸'} ${name} – ${petDef.emoji} ${entry.pet.name} (Lvl ${entry.pet.level || 1})`;
    });

    await sock.sendMessage(jid, { text: `🐾 *RANKING DE PETS DO BOT*\n\n${lines.join('\n')}\n\n_Use *!capturar* para conseguir o seu companheiro!_` }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handlePetRank:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar o ranking de pets.' }, { quoted: msg });
  }
}

// ─── !pets
async function handlePets(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  let texto = `🐾 *PETS DISPONÍVEIS NA NATUREZA* 🐾\n\n`;
  
  let i = 1;
  for (const [key, pet] of Object.entries(petSystem)) {
    texto += `${i}. ${pet.emoji} *${pet.nome}* (${pet.rarity})\n_${pet.desc}_\n\n`;
    i++;
  }
  
  texto += `💡 _Fique de olho nos grupos! Um pet selvagem surge aleatoriamente a cada 1 hora. Quando aparecer, digite rápido *${P}capturar*!_`;
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !abrigo (Totalmente reconstruído e persistido no Banco de Dados)
async function handleAbrigo(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  const parts = caption.trim().split(/\s+/);
  const commandArg = parts[1]?.toLowerCase();

  // Caso 1: !abrigo deixar
  if (commandArg === 'deixar') {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    const pet = user?.pet;
    
    if (!pet || !pet.name) {
      await sock.sendMessage(jid, { text: `⚠️ *ERRO: SEM PET*\n\nYou não possui um pet ativo para abrigar!\n\n_Capture um com *!capturar* primeiro._` }, { quoted: msg });
      return;
    }
    
    // Aloca o pet no abrigo global do banco de dados (usando uma flag no próprio model do usuário)
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { pet: null, 'petShelter.isSheltered': true, 'petShelter.shelteredPet': pet, 'petShelter.leftAt': new Date().toISOString() } }
    );
    
    petData.delete(userId);
    
    const petDef = petSystem[pet.type] || { emoji: '🐾' };
    await sock.sendMessage(jid, { text: `🏥 *PET ENVIADO AO ABRIGO* 🏥\n\n${petDef.emoji} *${pet.name}* foi guardado com sucesso!\n\nPara pegá-lo de volta ou listar os animais disponíveis, digite *!abrigo*.` }, { quoted: msg });
    return;
  }
  
  // Caso 2: !abrigo <nome> pegar
  if (parts.length >= 3 && parts[parts.length - 1].toLowerCase() === 'pegar') {
    const petName = parts.slice(1, parts.length - 1).join(' ');
    
    // Busca no banco algum usuário que deixou o pet especificado no abrigo
    const shelterTarget = await Usuario.findOne({
      'petShelter.isSheltered': true,
      'petShelter.shelteredPet.name': { $regex: new RegExp(petName, 'i') }
    });
    
    if (!shelterTarget || !shelterTarget.petShelter?.shelteredPet) {
      await sock.sendMessage(jid, { text: `⚠️ *PET NÃO ENCONTRADO*\n\nNão encontramos nenhum pet no abrigo contendo o nome "${petName}". Digite *!abrigo* para ver a lista.` }, { quoted: msg });
      return;
    }
    
    const requester = await Usuario.findOne({ idWhatsApp: userId });
    if (requester?.pet && requester.pet.name) {
      await sock.sendMessage(jid, { text: `⚠️ *AÇÃO NEGADA*\n\nVocê já possui um pet companheiro ativo! Deixe seu pet atual no abrigo antes de adotar outro.` }, { quoted: msg });
      return;
    }
    
    const petAdotado = shelterTarget.petShelter.shelteredPet;
    
    // Remove o pet do abrigo antigo e injeta no novo dono
    await Usuario.findOneAndUpdate(
      { idWhatsApp: shelterTarget.idWhatsApp },
      { $set: { petShelter: { isSheltered: false, shelteredPet: null, leftAt: null } } }
    );
    
    await savePet(userId, petAdotado);
    
    const petDef = petSystem[petAdotado.type] || { emoji: '🐾' };
    await sock.sendMessage(jid, { text: `🎉 ═══ ADOÇÃO CONCLUÍDA! ═══ 🎉\n\n${petDef.emoji} *${petAdotado.name}* foi adotado e agora é o seu novo companheiro!\n\nUse *!statuspet* para ver os atributos dele.` }, { quoted: msg });
    return;
  }
  
  // Caso 3: !abrigo (Listagem Geral)
  const abrigaLista = await Usuario.find({ 'petShelter.isSheltered': true }).lean();
  
  if (abrigaLista.length === 0) {
    const textoVazio = `🏥 ═══ ABRIGO DE PETS ═══ 🏥\n\n😔 *O abrigo está completamente vazio no momento!*\n\n━━━━━━━━━━━━━━━━\n*COMO DEIXAR SEU PET?*\n📝 Use: *!abrigo deixar*\n\n_Quando houver animais abandonados, eles aparecerão listados aqui!_`;
    await sock.sendMessage(jid, { text: textoVazio }, { quoted: msg });
    return;
  }
  
  let textoLista = `🏥 ═══ ABRIGO DE PETS ═══ 🏥\n\n✨ *${abrigaLista.length} pet(s) aguardando resgate:* \n\n`;
  abrigaLista.forEach((u, index) => {
    const p = u.petShelter.shelteredPet;
    const petDef = petSystem[p.type] || { emoji: '🐾' };
    textoLista += `${index + 1}️⃣ ${petDef.emoji} *${p.name}* (${p.rarity})\n    └─ Nível: ${p.level} | 🎭 Felicidade: ${p.happiness}%\n\n`;
  });
  
  textoLista += `━━━━━━━━━━━━━━━━\n*COMO ADOTAR?*\nUse: *!abrigo <nome-do-pet> pegar*\nExemplo: _!abrigo ${abrigaLista[0].petShelter.shelteredPet.name} pegar_`;
  await sock.sendMessage(jid, { text: textoLista }, { quoted: msg });
}

module.exports = {
  handleCapturarPet,
  handleAdoptarPet,
  handleAlimentarPet,
  handleBrincarPet,
  handleStatusPet,
  handlePetRank,
  handlePets,
  handleAbrigo
};