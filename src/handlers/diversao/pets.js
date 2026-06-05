/**
 * Sistema de Pets — Piroquinhas Bot (Spawn automático a cada hora)
 * Comandos: !capturar, !alimentar, !brincar, !statuspet, !rankpet, !pets, !abrigo
 * !abrigo — Lista pets / !abrigo deixar — Deixa pet / !abrigo <nome> pegar — Adota
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

const petData = new Map();
const shelterData = new Map();
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

// Funções auxiliares locais essenciais
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

async function handleAlimentarPet(sock, msg, jid, author) {
  const userId = getUserId(msg);
  const pet = await getPet(userId);
  
  if (!pet) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não capturou um pet. Use *!capturar* quando um aparecer no grupo.' }, { quoted: msg });
    return;
  }
  
  pet.fullness = Math.min(100, pet.fullness + 30);
  pet.happiness = Math.min(100, pet.happiness + 10);
  
  await savePet(userId, pet);
  
  await sock.sendMessage(jid, { text: `🍖 Você alimentou *${pet.name}*!\n\n😊 Felicidade: ${pet.happiness}%\n🍽️ Fome: ${pet.fullness}%` }, { quoted: msg });
}

async function handleBrincarPet(sock, msg, jid, author) {
  const userId = getUserId(msg);
  const pet = await getPet(userId);
  
  if (!pet) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não capturou um pet. Use *!capturar* quando um aparecer no grupo.' }, { quoted: msg });
    return;
  }
  
  pet.happiness = Math.min(100, pet.happiness + 20);
  pet.energy = Math.max(0, pet.energy - 15);
  pet.fullness = Math.max(0, pet.fullness - 10);
  pet.level = Math.min(50, pet.level + 1);
  
  await savePet(userId, pet);
  
  await sock.sendMessage(jid, { text: `🎾 Você brincou com *${pet.name}*!\n\n😊 Felicidade: ${pet.happiness}%\n⚡ Energia: ${pet.energy}%\n🍽️ Fome: ${pet.fullness}%\n🏆 Nível: ${pet.level}` }, { quoted: msg });
}

async function handleStatusPet(sock, msg, jid) {
  const userId = getUserId(msg);
  const pet = await getPet(userId);
  
  if (!pet) {
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

async function handlePetRank(sock, msg, jid, contactNames = {}) {
  try {
    // Busca direto no banco todos os usuários que possuem pet ativo
    const usuariosComPet = await Usuario.find({ pet: { $ne: null } }).lean();
    
    const ranks = usuariosComPet
      .map(u => ({ userId: u.idWhatsApp, pet: u.pet, score: getPetRankScore(u.pet) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (ranks.length === 0) {
      await sock.sendMessage(jid, { text: '📊 Nenhum pet em atividade no momento. Capture o seu usando *!capturar*!' }, { quoted: msg });
      return;
    }

    const lines = ranks.map((entry, index) => {
      const name = contactNames[entry.userId] || entry.userId.split('@')[0];
      const petDef = petSystem[entry.pet.type] || { emoji: '🐾' };
      return `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▸'} ${name} – ${petDef.emoji} ${entry.pet.name} (Lvl ${entry.pet.level})`;
    });

    await sock.sendMessage(jid, { text: `🐾 *RANKING DE PETS DO BOT*\n\n${lines.join('\n')}\n\n_Use *!capturar* para conseguir o seu companheiro!_` }, { quoted: msg });
  } catch (e) {
    console.error('⚠️ Erro handlePetRank:', e.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar o ranking de pets.' }, { quoted: msg });
  }
}

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

async function handleAbrigo(sock, msg, jid, caption = '') {
  const userId = getUserId(msg);
  const args = caption.trim().split(/\s+/).slice(1);
  const action = args[args.length - 1]?.toLowerCase() === 'pegar' ? 'pegar' : args[0]?.toLowerCase();
  
  if (!action) {
    if (shelterData.size === 0) {
      const texto = `🏥 ═══ ABRIGO DE PETS ═══ 🏥\n\n😔 *Abrigo completamente vazio no momento!*\n\nO abrigo está aguardando por novos hóspedes...\n\n━━━━━━━━━━━━━━━━\n*COMO COLOCAR UM PET?*\n  📝 Use: *!abrigo deixar*\n  \n*NÃO TEM PET?*\n  🎯 Capture um com: *!capturar*\n  🐾 Pets spawnam a cada 1 hora\n\n_Ajude um pet abandonado a encontrar um novo lar!_ 💕`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    let texto = `🏥 ═══ ABRIGO DE PETS ═══ 🏥\n\n✨ *${shelterData.size} pet(s) aguardando resgate* ✨\n\n`;
    let index = 1;
    for (const [_, shelter] of shelterData.entries()) {
      const petDef = petSystem[shelter.pet.type] || { emoji: '🐾' };
      const rarityEmoji = shelter.pet.rarity === 'COMUM' ? '⭐' : 
                          shelter.pet.rarity === 'RARO' ? '🌟' : 
                          shelter.pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
      const rarityName = shelter.pet.rarity.charAt(0) + shelter.pet.rarity.slice(1).toLowerCase();
      
      texto += `${index}️⃣ ${petDef.emoji} *${shelter.pet.name}* ${rarityEmoji}\n`;
      texto += `    └─ Raridade: ${rarityName}\n`;
      texto += `    └─ Nível: ${shelter.pet.level}\n`;
      texto += `    └─ Felicidade: ${shelter.pet.happiness}%\n\n`;
      index++;
    }
    
    texto += `━━━━━━━━━━━━━━━━\n*COMO ADOTAR?*\n  Use: *!abrigo <nome> pegar*\n  Exemplo: *!abrigo Selvagem pegar*\n  \n*DICA:* Pets raros são mais difíceis de encontrar!\nUse *!capturar* regularmente para completar sua coleção! 🎯`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  if (action === 'deixar') {
    const pet = await getPet(userId);
    
    if (!pet) {
      const texto = `⚠️ *ERRO: SEM PET*\n\nVocê não possui um pet para deixar no abrigo!\n\n━━━━━━━━━━━━━━━━\n*COMO CONSEGUIR UM PET?*\n  🎯 Capture com: *!capturar*\n  🏥 Adote do abrigo: *!abrigo*\n\n_Primeiro você precisa ter um pet seu!_ 🐾`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    const shelterId = `shelter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    shelterData.set(shelterId, {
      pet: pet,
      owner: userId,
      leftAt: new Date().toISOString(),
    });
    
    petData.delete(userId);
    try {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $set: { pet: null } },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (e) {
      console.error('❌ Erro ao deletar pet:', e.message);
    }
    
    const petDef = petSystem[pet.type] || { emoji: '🐾' };
    const rarityEmoji = pet.rarity === 'COMUM' ? '⭐' : 
                        pet.rarity === 'RARO' ? '🌟' : 
                        pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
    
    const texto = `🏥 *PET DEIXADO NO ABRIGO* 🏥\n\n${petDef.emoji} *${pet.name}* ${rarityEmoji}\n\n━━━━━━━━━━━━━━━━\n*DETALHES:*\n  Nível: ${pet.level}\n  Felicidade: ${pet.happiness}%\n  Tipo: ${pet.type}\n  Raridade: ${pet.rarity}\n\n✨ *${pet.name}* está à espera de um novo lar!\n\n_Qualquer pessoa pode adotar com:_\n*!abrigo ${pet.name} pegar*\n\n💔 Esperamos que encontre um novo dono em breve!`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  if (action === 'pegar') {
    // Isola o nome composto capturando tudo entre "!abrigo" e a palavra "pegar"
    const petName = args.slice(0, args.length - 1).join(' ');
    
    if (!petName) {
      await sock.sendMessage(jid, { text: '⚠️ Especifique o nome do pet! Exemplo: *!abrigo Cachorro Selvagem pegar*' }, { quoted: msg });
      return;
    }

    let foundShelter = null;
    let foundShelterId = null;
    
    for (const [shelterId, shelter] of shelterData.entries()) {
      if (shelter.pet.name.toLowerCase().includes(petName.toLowerCase())) {
        foundShelter = shelter;
        foundShelterId = shelterId;
        break;
      }
    }
    
    if (!foundShelter) {
      const texto = `⚠️ *PET NÃO ENCONTRADO*\n\n"${petName}" não existe no abrigo!\n\n━━━━━━━━━━━━━━━━\n*PETS DISPONÍVEIS:*\n  Use: *!abrigo*\n  Para ver todos os pets\n\n_Verifique o nome e tente novamente!_ 🔍`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    const userCurrentPet = await getPet(userId);
    if (userCurrentPet) {
      const texto = `⚠️ *JÁ POSSUI PET*\n\nVocê já tem um pet! Não pode adotar outro no momento.\n\n━━━━━━━━━━━━━━━━\n*ALTERNATIVAS:*\n  💔 Deixar seu pet: *!abrigo deixar*\n\n_Libere espaço para um novo companheiro!_ 🐾`;
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    await savePet(userId, foundShelter.pet);
    shelterData.delete(foundShelterId);
    
    const petDef = petSystem[foundShelter.pet.type] || { emoji: '🐾' };
    const rarityEmoji = foundShelter.pet.rarity === 'COMUM' ? '⭐' : 
                        foundShelter.pet.rarity === 'RARO' ? '🌟' : 
                        foundShelter.pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
    
    const texto = `🎉 ═══ ADOÇÃO BEM-SUCEDIDA! ═══ 🎉\n\n${petDef.emoji} *${foundShelter.pet.name}* ${rarityEmoji}\n\n━━━━━━━━━━━━━━━━\n*DETALHES DO SEU NOVO PET:*\n  🏆 Nível: ${foundShelter.pet.level}\n  😊 Felicidade: ${foundShelter.pet.happiness}%\n  🍽️ Fome: ${foundShelter.pet.fullness}%\n\nCuide bem do seu novo amigo! Use *!statuspet* para vê-lo a qualquer momento. ❤️`;
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
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