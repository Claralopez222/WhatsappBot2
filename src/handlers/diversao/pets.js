/**
 * Sistema de Pets — Piroquinhas Bot (Spawn automático a cada hora)
 * Comandos: !capturar, !alimentar, !brincar, !statuspet, !rankpet, !pets, !abrigo
 * !abrigo — Lista pets / !abrigo deixar — Deixa pet / !abrigo <nome> pegar — Adota
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));

const petData = new Map();
const shelterData = new Map();
const spawnedPets = new Map(); // { groupId: { type, rarity, spawnedAt } }

const petSystem = {
  // COMUNS (40%)
  cachorro: { emoji: '🐶', nome: 'Cachorro', rarity: 'COMUM', xpMult: 1.5, pontMult: 1.5 },
  gato: { emoji: '🐱', nome: 'Gato', rarity: 'COMUM', xpMult: 1.4, pontMult: 1.4 },
  coelho: { emoji: '🐰', nome: 'Coelho', rarity: 'COMUM', xpMult: 1.3, pontMult: 1.3 },
  pinguim: { emoji: '🐧', nome: 'Pinguim', rarity: 'COMUM', xpMult: 1.4, pontMult: 1.4 },
  macaco: { emoji: '🐵', nome: 'Macaco', rarity: 'COMUM', xpMult: 1.6, pontMult: 1.6 },
  
  // RAROS (35%)
  lobo: { emoji: '🐺', nome: 'Lobo', rarity: 'RARO', xpMult: 1.7, pontMult: 1.7 },
  raposa: { emoji: '🦊', nome: 'Raposa', rarity: 'RARO', xpMult: 1.7, pontMult: 1.7 },
  urso: { emoji: '🐻', nome: 'Urso', rarity: 'RARO', xpMult: 1.8, pontMult: 1.8 },
  coruja: { emoji: '🦉', nome: 'Coruja', rarity: 'RARO', xpMult: 1.8, pontMult: 1.8 },
  elefante: { emoji: '🐘', nome: 'Elefante', rarity: 'RARO', xpMult: 1.9, pontMult: 1.9 },
  tigre: { emoji: '🐯', nome: 'Tigre', rarity: 'RARO', xpMult: 1.9, pontMult: 1.9 },
  girafa: { emoji: '🦒', nome: 'Girafa', rarity: 'RARO', xpMult: 1.5, pontMult: 1.5 },
  leao_marinho: { emoji: '🦭', nome: 'Leão Marinho', rarity: 'RARO', xpMult: 1.6, pontMult: 1.6 },
  
  // ULTRA-RAROS (20%)
  falcao: { emoji: '🦅', nome: 'Falcão', rarity: 'ULTRA-RARO', xpMult: 1.8, pontMult: 1.8 },
  leao: { emoji: '🦁', nome: 'Leão', rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0 },
  tubarao: { emoji: '🦈', nome: 'Tubarão', rarity: 'ULTRA-RARO', xpMult: 2.0, pontMult: 2.0 },
  
  // LENDÁRIOS (5%)
  dragao: { emoji: '🐉', nome: 'Dragão', rarity: 'LENDÁRIO', xpMult: 2.5, pontMult: 2.5 },
  fenix: { emoji: '🔥', nome: 'Fênix', rarity: 'LENDÁRIO', xpMult: 3.0, pontMult: 3.0 },
};

function spawnNewPet(groupId) {
  const rnd = Math.random() * 100;
  let rarity, petPool;
  
  // Nova distribuição mais rara para lendários
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
  spawnedPets.set(groupId, {
    type: petType,
    rarity: rarity,
    spawnedAt: new Date().toISOString(),
  });
  return { type: petType, rarity: rarity, ...petDef };
}

function getOrSpawnPet(groupId) {
  const now = new Date();
  let pet = spawnedPets.get(groupId);
  
  // Se não tem pet ou passou 1 hora desde o spawn
  if (!pet || (now - new Date(pet.spawnedAt)) > 3600000) {
    pet = spawnNewPet(groupId);
  }
  
  return pet;
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

// ─── !capturar (Novo sistema)
async function handleCapturarPet(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const groupId = jid;
  
  const currentPet = getOrSpawnPet(groupId);
  if (!currentPet) {
    await sock.sendMessage(jid, { text: '❌ Nenhum pet apareceu ainda. Aguarde um pouco!' }, { quoted: msg });
    return;
  }
  
  const userPet = await getPet(userId);
  if (userPet) {
    await sock.sendMessage(jid, { text: '⚠️ Você já tem um pet! Deixe-o no abrigo primeiro.' }, { quoted: msg });
    return;
  }
  
  const newPet = {
    type: currentPet.type,
    name: `${currentPet.nome} Selvagem`,
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
  
  await sock.sendMessage(jid, { text: `${rarityEmoji} *${currentPet.nome}* capturado! (${currentPet.rarity})\n\nUse *!statuspet* para ver detalhes!` }, { quoted: msg });
}

// ─── Stub para !adotar (mantém compatibilidade)
async function handleAdoptarPet(sock, msg, jid, caption) {
  await sock.sendMessage(jid, { text: '⚠️ Use *!capturar* para pegar um pet que aparecer no grupo!' }, { quoted: msg });
}

async function handleAlimentarPet(sock, msg, jid, author) {
  const userId = msg.key.participant;
  const pet = await getPet(userId);
  
  if (!pet) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não adotou um pet. Use *!adotar <tipo> [nome]*.' }, { quoted: msg });
    return;
  }
  
  pet.fullness = Math.min(100, pet.fullness + 30);
  pet.happiness = Math.min(100, pet.happiness + 10);
  
  await savePet(userId, pet);
  
  await sock.sendMessage(jid, { text: `🍖 Você alimentou *${pet.name}*!\n\n😊 Felicidade: ${pet.happiness}%\n🍽️ Fome: ${pet.fullness}%` }, { quoted: msg });
}

async function handleBrincarPet(sock, msg, jid, author) {
  const userId = msg.key.participant;
  const pet = await getPet(userId);
  
  if (!pet) {
    await sock.sendMessage(jid, { text: '⚠️ Você ainda não adotou um pet. Use *!adotar <tipo> [nome]*.' }, { quoted: msg });
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
  
  const petDef = petSystem[pet.type];
  let rarityEmoji = '⭐';
  if (pet.rarity === 'RARO') rarityEmoji = '🌟';
  else if (pet.rarity === 'ULTRA-RARO') rarityEmoji = '✨';
  else if (pet.rarity === 'LENDÁRIO') rarityEmoji = '💎';
  
  const texto = `${petDef.emoji} *${pet.name}*\n\n${rarityEmoji} *${pet.rarity}*\n🏆 Nível: ${pet.level}\n😊 Felicidade: ${pet.happiness}%\n⚡ Energia: ${pet.energy}%\n🍽️ Fome: ${pet.fullness}%\n📅 Capturado em: ${new Date(pet.capturedAt).toLocaleDateString()}\n\n🎯 Multiplicadores: ${petDef.xpMult}x XP | ${petDef.pontMult}x Pontos`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handlePetRank(sock, msg, jid, contactNames) {
  const ranks = [...petData.entries()]
    .map(([userId, pet]) => ({ userId, pet, score: getPetRankScore(pet) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (ranks.length === 0) {
    await sock.sendMessage(jid, { text: '📊 Nenhum pet adotado ainda. Seja o primeiro com *!adotar <tipo>*!' }, { quoted: msg });
    return;
  }

  const lines = ranks.map((entry, index) => {
    const name = contactNames[entry.userId] || entry.userId.split('@')[0];
    const petDef = petSystem[entry.pet.type] || petSystem.cachorro;
    return `${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▸'} ${name} – ${petDef.emoji} ${entry.pet.name} (Lvl ${entry.pet.level})`;
  });

  await sock.sendMessage(jid, { text: `🐾 *RANKING DE PETS*\n\n${lines.join('\n')}\n\n_Use *!adotar <tipo>* para ter seu pet!_` }, { quoted: msg });
}

async function handlePets(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  let texto = `🐾 *SEUS 20 PETS DISPONÍVEIS* 🐾\n\n`;
  
  let i = 1;
  for (const [key, pet] of Object.entries(petSystem)) {
    texto += `${i}. ${pet.emoji} *${pet.nome}* — ${pet.desc}\n`;
    i++;
  }
  
  texto += `\n💡 _Use *${P}adotar <tipo> [nome]* para adotar um pet_\nExemplo: *${P}adotar dragao Smaug*`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleAbrigo(sock, msg, jid, caption) {
  const userId = getUserId(msg);
  const args = caption.trim().split(/\s+/).slice(1); // Pega argumentos após !abrigo
  const action = args[0]?.toLowerCase();
  
  // ─── Opção 1: !abrigo (mostra pets no abrigo)
  if (!action) {
    if (shelterData.size === 0) {
      const texto = `🏥 ═══ ABRIGO DE PETS ═══ 🏥

😔 *Abrigo completamente vazio no momento!*

O abrigo está aguardando por novos hóspedes...

━━━━━━━━━━━━━━━━
*COMO COLOCAR UM PET?*
  📝 Use: *!abrigo deixar*
  
*NÃO TEM PET?*
  🎯 Capture um com: *!capturar*
  🐾 Pets spawnam a cada 1 hora

_Ajude um pet abandonado a encontrar um novo lar!_ 💕`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    let texto = `🏥 ═══ ABRIGO DE PETS ═══ 🏥\n\n✨ *${shelterData.size} pet(s) aguardando resgate* ✨\n\n`;
    let index = 1;
    for (const [_, shelter] of shelterData.entries()) {
      const petDef = petSystem[shelter.pet.type];
      const rarityEmoji = shelter.pet.rarity === 'COMUM' ? '⭐' : 
                          shelter.pet.rarity === 'RARO' ? '🌟' : 
                          shelter.pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
      const rarityName = shelter.pet.rarity.charAt(0) + shelter.pet.rarity.slice(1).toLowerCase();
      
      texto += `${index}️⃣ ${petDef.emoji} *${shelter.pet.name}* ${rarityEmoji}\n`;
      texto += `   └─ Raridade: ${rarityName}\n`;
      texto += `   └─ Nível: ${shelter.pet.level}\n`;
      texto += `   └─ Felicidade: ${shelter.pet.happiness}%\n\n`;
      
      index++;
    }
    
    texto += `━━━━━━━━━━━━━━━━
*COMO ADOTAR?*
  Use: *!abrigo <nome> pegar*
  Exemplo: *!abrigo Fluffy pegar*
  
*DICA:* Pets raros são mais difíceis de encontrar!
Use *!capturar* regularmente para completar sua coleção! 🎯`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  // ─── Opção 2: !abrigo deixar (deixa pet no abrigo)
  if (action === 'deixar') {
    const pet = await getPet(userId);
    
    if (!pet) {
      const texto = `⚠️ *ERRO: SEM PET*

Você não possui um pet para deixar no abrigo!

━━━━━━━━━━━━━━━━
*COMO CONSEGUIR UM PET?*
  🎯 Capture com: *!capturar*
  🏥 Adote do abrigo: *!abrigo*
  🛒 Compre na loja: *!lojapet*

_Primeiro você precisa ter um pet seu!_ 🐾`;
      
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
    
    const petDef = petSystem[pet.type];
    const rarityEmoji = pet.rarity === 'COMUM' ? '⭐' : 
                        pet.rarity === 'RARO' ? '🌟' : 
                        pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
    
    const texto = `🏥 *PET DEIXADO NO ABRIGO* 🏥

${petDef.emoji} *${pet.name}* ${rarityEmoji}

━━━━━━━━━━━━━━━━
*DETALHES:*
  Nível: ${pet.level}
  Felicidade: ${pet.happiness}%
  Tipo: ${pet.type}
  Raridade: ${pet.rarity}

✨ *${pet.name}* está à espera de um novo lar!

_Qualquer pessoa pode adotar com:_
*!abrigo ${pet.name} pegar*

💔 Esperamos que encontre um novo dono em breve!`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  // ─── Opção 3: !abrigo <nome> pegar (pega pet do abrigo)
  if (args.length >= 2 && args[1]?.toLowerCase() === 'pegar') {
    const petName = args[0];
    
    // Procura o pet pelo nome no abrigo
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
      const texto = `⚠️ *PET NÃO ENCONTRADO*

"${petName}" não existe no abrigo!

━━━━━━━━━━━━━━━━
*PETS DISPONÍVEIS:*
  Use: *!abrigo*
  Para ver todos os pets

_Verifique o nome e tente novamente!_ 🔍`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    const userCurrentPet = await getPet(userId);
    if (userCurrentPet) {
      const texto = `⚠️ *JÁ POSSUI PET*

Você já tem um pet! Não pode adotar outro no momento.

━━━━━━━━━━━━━━━━
*ALTERNATIVAS:*
  💔 Deixar seu pet: *!abrigo deixar*
  🏪 Vender seu pet: *!venderpet*
  🔄 Trocar seu pet: *!trocarpet*

_Libere espaço para um novo companheiro!_ 🐾`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    // Pega o pet do abrigo
    await savePet(userId, foundShelter.pet);
    shelterData.delete(foundShelterId);
    
    const petDef = petSystem[foundShelter.pet.type];
    const rarityEmoji = foundShelter.pet.rarity === 'COMUM' ? '⭐' : 
                        foundShelter.pet.rarity === 'RARO' ? '🌟' : 
                        foundShelter.pet.rarity === 'ULTRA-RARO' ? '✨' : '💎';
    
    const texto = `🎉 ═══ ADOÇÃO BEM-SUCEDIDA! ═══ 🎉

${petDef.emoji} *${foundShelter.pet.name}* ${rarityEmoji}

━━━━━━━━━━━━━━━━
*DETALHES DO SEU NOVO COMPANHEIRO:*
  ✅ Nível: ${foundShelter.pet.level}
  💚 Felicidade: ${foundShelter.pet.happiness}%
  ⭐ Tipo: ${foundShelter.pet.type}
  💎 Raridade: ${foundShelter.pet.rarity}

✨ *Parabéns!* Você acaba de salvar uma vida!

━━━━━━━━━━━━━━━━
*PRÓXIMOS PASSOS:*
  🍖 Alimentar: *!alimentar*
  🎾 Brincar: *!brincar*
  📊 Status: *!statuspet*
  🏆 Ranking: *!rankpet*

_Cuide bem do ${petDef.emoji} *${foundShelter.pet.name}*!_ 💕`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  // Comando inválido
  const texto = `ℹ️ *COMANDOS DO ABRIGO*

🏥 *!abrigo*
   → Lista todos os pets para adoção

💔 *!abrigo deixar*
   → Deixa seu pet no abrigo para adoção

🎉 *!abrigo <nome> pegar*
   → Adota um pet específico
   → Exemplo: *!abrigo Fluffy pegar*

━━━━━━━━━━━━━━━━
_Use um desses comandos acima!_`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

module.exports = {
  handleCapturarPet,
  handleAlimentarPet,
  handleBrincarPet,
  handleStatusPet,
  handlePetRank,
  handlePets,
  handleAbrigo,
  petSystem,
  petData,
  shelterData,
};
