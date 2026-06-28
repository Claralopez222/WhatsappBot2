'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const { ARMAS, ARMADURAS, POCOES, getClasse, getElemento, getArma, getArmadura, getPocao } = require('../utils/medievalUtils');
const { getModoAtivo, getOuCriarPersonagem, somenteGrupo } = require('./medieval');

// ═══════════════════════════════════════════════════════════════
// ─── !lojamedieval ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleLojaMedieval(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }

  const [carteira, p] = await Promise.all([
    CarteiraGrupo.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean(),
    getOuCriarPersonagem(senderJid, jid, nomeDisplay),
  ]);
  const gold       = carteira?.gold || 0;
  const nivelJog   = p.nivel;

  const RARIDADE_EMOJI = { comum: '⚪', incomum: '🟢', raro: '🔵', lendário: '🟣' };

  const armasTexto = ARMAS.map(a => {
    const chave     = a.nome.replace(/ /g, '_');
    const bloqueado = nivelJog < a.nivelMinimo;
    const nivelTag  = bloqueado
      ? `   🔒 *BLOQUEADO* — Requer Nível ${a.nivelMinimo} (você: ${nivelJog})\n`
      : a.nivelMinimo > 1 ? `   ✅ Nível ${a.nivelMinimo}+ _(disponível)_\n` : '';
    const mana      = a.bonusMana ? `\n   💧 Bônus de mana: *+${a.bonusMana}*` : '';
    return (
      `${bloqueado ? '🔒' : a.emoji} *${a.nome}*${bloqueado ? ' _(bloqueado)_' : ''}\n` +
      `   🪙 Preço: *${a.preco} Gold*\n` +
      `   ⚔️ Bônus de ataque: *+${a.bonusAtaque}*${mana}\n` +
      `   ${RARIDADE_EMOJI[a.raridade] || '⚪'} Raridade: *${a.raridade}*\n` +
      nivelTag +
      `   _!comprar ${chave}_`
    );
  }).join('\n\n');

  const armadurasTexto = ARMADURAS.map(a => {
    const chave     = a.nome.replace(/ /g, '_');
    const bloqueado = nivelJog < a.nivelMinimo;
    const nivelTag  = bloqueado
      ? `   🔒 *BLOQUEADO* — Requer Nível ${a.nivelMinimo} (você: ${nivelJog})\n`
      : a.nivelMinimo > 1 ? `   ✅ Nível ${a.nivelMinimo}+ _(disponível)_\n` : '';
    const mana      = a.bonusMana ? `\n   💧 Bônus de mana: *+${a.bonusMana}*` : '';
    return (
      `${bloqueado ? '🔒' : a.emoji} *${a.nome}*${bloqueado ? ' _(bloqueado)_' : ''}\n` +
      `   🪙 Preço: *${a.preco} Gold*\n` +
      `   🛡️ Bônus de defesa: *+${a.bonusDefesa}*${mana}\n` +
      `   ${RARIDADE_EMOJI[a.raridade] || '⚪'} Raridade: *${a.raridade}*\n` +
      nivelTag +
      `   _!comprar ${chave}_`
    );
  }).join('\n\n');

  const pocoesTexto = POCOES.map(poc => {
    const chave  = poc.nome.replace(/ /g, '_');
    const tipoIc = poc.tipo === 'hp' ? '❤️' : poc.tipo === 'mana' ? '💧' : '❤️💧';
    const tipoTx = poc.tipo === 'ambos' ? 'HP e Mana' : poc.tipo.toUpperCase();
    return (
      `${poc.emoji} *${poc.nome}*\n` +
      `   🪙 Preço: *${poc.preco} Gold*\n` +
      `   ${tipoIc} Restaura: *+${poc.valor} ${tipoTx}*\n` +
      `   ${RARIDADE_EMOJI[poc.raridade] || '⚪'} Raridade: *${poc.raridade}*\n` +
      `   _!comprar ${chave}_`
    );
  }).join('\n\n');

  await sock.sendMessage(jid, {
    text:
      `🏪 *LOJA MEDIEVAL* 🏪\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🪙 Seu saldo: *${gold} Gold*\n\n` +
      `⚔️ *ARMAS*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${armasTexto}\n\n` +
      `🛡️ *ARMADURAS*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${armadurasTexto}\n\n` +
      `🧪 *POÇÕES*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${pocoesTexto}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Use o comando em itálico para comprar cada item!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !comprar ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleComprarMedieval(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  // Normaliza: substitui _ por espaço — aceita tanto "Espada_Rúnica" quanto "Espada Rúnica"
  const nomeItem = args.trim().replace(/_/g, ' ');
  if (!nomeItem) {
    return sock.sendMessage(jid, { text: '🏪 Diga o nome do item!\nExemplo: *!comprar Espada* ou *!comprar Espada_Rúnica*' }, { quoted: msg });
  }

  const arma     = ARMAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const armadura = ARMADURAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const pocao    = getPocao(nomeItem);
  const item     = arma || armadura || pocao;

  if (!item) {
    return sock.sendMessage(jid, {
      text: `❌ Item *"${nomeItem}"* não encontrado na loja!\nUse *!lojamedieval* para ver os itens disponíveis.`,
    }, { quoted: msg });
  }

  const p = await getOuCriarPersonagem(senderJid, jid, nomeDisplay);

  // Valida nível mínimo
  if (item.nivelMinimo && p.nivel < item.nivelMinimo) {
    return sock.sendMessage(jid, {
      text:
        `❌ Você precisa ser *Nível ${item.nivelMinimo}* para comprar *${item.nome}*!\n` +
        `📊 Seu nível atual: *${p.nivel}*`,
    }, { quoted: msg });
  }

  const chave = `inventarioMedieval.${item.nome.replace(/ /g, '_')}`;

  // Atômico: só debita se gold >= preco — previne gold negativo por race condition
  const carteiraAtualizada = await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: senderJid, idGrupo: jid, gold: { $gte: item.preco } },
    { $inc: { gold: -item.preco } },
    { new: true, upsert: false }
  );

  if (!carteiraAtualizada) {
    const carteira = await CarteiraGrupo.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean();
    const gold     = carteira?.gold || 0;
    return sock.sendMessage(jid, {
      text: `❌ Gold insuficiente!\n🪙 Você tem: *${gold}* | Necessário: *${item.preco}*`,
    }, { quoted: msg });
  }

  const gold = carteiraAtualizada.gold + item.preco; // gold antes do débito para exibir
  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $inc: { [chave]: 1 } }
  );

  const isPocao = !!pocao;
  await sock.sendMessage(jid, {
    text:
      `✅ *COMPRA REALIZADA!*\n\n` +
      `${item.emoji} *${item.nome}* adquirido!\n` +
      `🪙 Gasto: *${item.preco} gold*\n` +
      `🪙 Saldo restante: *${gold - item.preco} gold*\n\n` +
      (isPocao
        ? `_Use *!usarpocao ${item.nome}* para consumir!_`
        : `_Use *!equipar ${item.nome}* para equipar!_`),
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !equipar ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleEquipar(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const nomeItem = args.trim().replace(/_/g, ' ');
  if (!nomeItem) {
    return sock.sendMessage(jid, { text: '🎽 Diga o nome do item!\nExemplo: *!equipar Espada* ou *!equipar Espada_Rúnica*' }, { quoted: msg });
  }

  const arma     = ARMAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const armadura = ARMADURAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const item     = arma || armadura;

  if (!item) {
    return sock.sendMessage(jid, { text: `❌ Item *"${nomeItem}"* não encontrado!` }, { quoted: msg });
  }

  const p        = await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
  const chaveInv = item.nome.replace(/ /g, '_');
  const invMap   = p.inventarioMedieval instanceof Map
    ? p.inventarioMedieval
    : new Map(Object.entries(p.inventarioMedieval || {}));
  const qtdInv   = invMap.get(chaveInv) || 0;

  if (qtdInv <= 0) {
    return sock.sendMessage(jid, {
      text: `❌ Você não possui *${item.nome}* no inventário!\nUse *!comprar ${item.nome}* para comprar.`,
    }, { quoted: msg });
  }

  // ── Validação de nível mínimo ─────────────────────────────────────────────
  if (item.nivelMinimo && p.nivel < item.nivelMinimo) {
    return sock.sendMessage(jid, {
      text:
        `❌ Você precisa ser *Nível ${item.nivelMinimo}* para equipar *${item.nome}*!\n` +
        `📊 Seu nível atual: *${p.nivel}*`,
    }, { quoted: msg });
  }

  // ── Validação de classe para armas ────────────────────────────────────────
  if (arma) {
    const classeData = getClasse(p.classe);
    if (classeData && !classeData.armasPermitidas.includes(item.nome)) {
      return sock.sendMessage(jid, {
        text:
          `❌ *${p.classe}* não pode equipar *${item.nome}*!\n` +
          `🗡️ Armas permitidas: ${classeData.armasPermitidas.join(', ')}`,
      }, { quoted: msg });
    }
  }

  // ── Calcula ajuste de mana: desconta bônus da arma anterior antes de somar ─
  const updateFields = {};
  if (arma) {
    updateFields.armaEquipada = item.nome;
    if (item.bonusMana || p.armaEquipada) {
      const armaAnterior    = p.armaEquipada ? getArma(p.armaEquipada) : null;
      const bonusAnt        = armaAnterior?.bonusMana || 0;
      const bonusNovo       = item.bonusMana           || 0;
      const deltaMana       = bonusNovo - bonusAnt;
      const novoManaMax     = Math.max(1, p.manaMax + deltaMana);
      updateFields.manaMax  = novoManaMax;
      updateFields.mana     = Math.min(p.mana + deltaMana, novoManaMax);
    }
  } else {
    updateFields.armaduraEquipada = item.nome;
    // Trata bonusMana de armaduras (ex: Manto Sombrio)
    if (item.bonusMana) {
      const armaduraAnt     = p.armaduraEquipada ? ARMADURAS.find(a => a.nome === p.armaduraEquipada) : null;
      const bonusAnt        = armaduraAnt?.bonusMana || 0;
      const bonusNovo       = item.bonusMana;
      const deltaMana       = bonusNovo - bonusAnt;
      const novoManaMax     = Math.max(1, p.manaMax + deltaMana);
      updateFields.manaMax  = novoManaMax;
      updateFields.mana     = Math.min(p.mana + deltaMana, novoManaMax);
    }
  }

  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $set: updateFields }
  );

  await sock.sendMessage(jid, {
    text:
      `✅ *${item.emoji} ${item.nome}* equipado!\n\n` +
      (arma ? `⚔️ Bônus de ataque: +${item.bonusAtaque}` : `🛡️ Bônus de defesa: +${item.bonusDefesa}`) +
      (item.bonusMana ? `\n💧 Bônus de mana: +${item.bonusMana}` : '') +
      `\n\n_Use *!ficha* para ver seus status!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !desequipar ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleDesequipar(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const tipo = (args || '').trim().toLowerCase();
  if (!['arma', 'armadura'].includes(tipo)) {
    return sock.sendMessage(jid, {
      text: '🎽 Use *!desequipar arma* ou *!desequipar armadura*',
    }, { quoted: msg });
  }

  const p = await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
  const updateFields = {};

  if (tipo === 'arma') {
    if (!p.armaEquipada) {
      return sock.sendMessage(jid, { text: '❌ Você não tem nenhuma arma equipada.' }, { quoted: msg });
    }
    // Desconta bônus de mana da arma removida
    const armaAnt = getArma(p.armaEquipada);
    if (armaAnt?.bonusMana) {
      const novoManaMax      = Math.max(1, p.manaMax - armaAnt.bonusMana);
      updateFields.manaMax   = novoManaMax;
      updateFields.mana      = Math.min(p.mana, novoManaMax);
    }
    updateFields.armaEquipada = null;
  } else {
    if (!p.armaduraEquipada) {
      return sock.sendMessage(jid, { text: '❌ Você não tem nenhuma armadura equipada.' }, { quoted: msg });
    }
    // Desconta bonusMana da armadura removida (ex: Manto Sombrio)
    const armaduraAnt = ARMADURAS.find(a => a.nome === p.armaduraEquipada);
    if (armaduraAnt?.bonusMana) {
      const novoManaMax      = Math.max(1, p.manaMax - armaduraAnt.bonusMana);
      updateFields.manaMax   = novoManaMax;
      updateFields.mana      = Math.min(p.mana, novoManaMax);
    }
    updateFields.armaduraEquipada = null;
  }

  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $set: updateFields }
  );

  await sock.sendMessage(jid, {
    text: `✅ ${tipo === 'arma' ? '⚔️ Arma' : '🛡️ Armadura'} desequipada com sucesso!\n_Use *!ficha* para ver seus status._`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !inventario ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleInvMed(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const p = await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
  // Normaliza para Map independente de ser documento Mongoose ou objeto puro
  const invRaw = p.inventarioMedieval;
  const inv    = invRaw instanceof Map
    ? invRaw
    : new Map(Object.entries(invRaw || {}));

  if (!inv || inv.size === 0) {
    return sock.sendMessage(jid, {
      text: `🎒 Seu inventário está vazio!\nUse *!lojamedieval* para comprar itens.`,
    }, { quoted: msg });
  }

  const linhas = [];
  for (const [chave, qtd] of inv.entries()) {
    if (qtd <= 0) continue;
    const nomeReal = chave.replace(/_/g, ' ');
    const arma     = getArma(nomeReal);
    const armItem  = ARMADURAS.find(a => a.nome === nomeReal) || null;
    const pocao    = getPocao(nomeReal);
    const itemData = arma || armItem || pocao;
    const emoji    = itemData?.emoji || '📦';
    const equipado = p.armaEquipada === nomeReal || p.armaduraEquipada === nomeReal
      ? ' _(equipado)_' : '';
    linhas.push(`${emoji} *${nomeReal}* x${qtd}${equipado}`);
  }

  if (!linhas.length) {
    return sock.sendMessage(jid, {
      text: `🎒 Seu inventário está vazio!\nUse *!lojamedieval* para comprar itens.`,
    }, { quoted: msg });
  }

  await sock.sendMessage(jid, {
    text:
      `🎒 *INVENTÁRIO DE ${p.nome.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      linhas.join('\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *!equipar [item]* ou *!usarpocao [item]*_\n_Veja tudo com *!invmed*_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !usarpocao ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleUsarPocao(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const nomePocao = args.trim().replace(/_/g, ' ');
  if (!nomePocao) {
    return sock.sendMessage(jid, {
      text: '🧪 Diga o nome da poção!\nExemplo: *!usarpocao Poção_de_Cura* ou *!usarpocao Poção de Cura*',
    }, { quoted: msg });
  }

  const pocao = getPocao(nomePocao);
  if (!pocao) {
    return sock.sendMessage(jid, { text: `❌ Poção *"${nomePocao}"* não encontrada!` }, { quoted: msg });
  }

  const chaveInv = pocao.nome.replace(/ /g, '_');
  const chaveMap = `inventarioMedieval.${chaveInv}`;

  // Decrementa atomicamente apenas se qtd > 0 — previne race condition
  const resultado = await MedievalPersonagem.findOneAndUpdate(
    {
      idWhatsApp: senderJid,
      idGrupo:    jid,
      [chaveMap]: { $gt: 0 },
    },
    { $inc: { [chaveMap]: -1 } },
    { new: false } // retorna documento ANTES do update para calcular efeitos
  );

  if (!resultado) {
    return sock.sendMessage(jid, {
      text: `❌ Você não possui *${pocao.nome}*!\nUse *!comprar ${pocao.nome}* para comprar.`,
    }, { quoted: msg });
  }

  // Calcula efeitos com base no documento pré-update
  const updateFields  = {};
  const linhasEfeito  = [];
  const invResultado = resultado.inventarioMedieval instanceof Map
    ? resultado.inventarioMedieval
    : new Map(Object.entries(resultado.inventarioMedieval || {}));
  const qtdAntes = invResultado.get(chaveInv) || 0;

  if (pocao.tipo === 'hp' || pocao.tipo === 'ambos') {
    const hpAntes   = resultado.hp;
    const novoHp    = Math.min(resultado.hpMax, hpAntes + pocao.valor);
    updateFields.hp = novoHp;
    linhasEfeito.push(`❤️ HP: ${hpAntes} → ${novoHp} (+${novoHp - hpAntes})`);
  }
  if (pocao.tipo === 'mana' || pocao.tipo === 'ambos') {
    const manaAntes   = resultado.mana;
    const novaMana    = Math.min(resultado.manaMax, manaAntes + pocao.valor);
    updateFields.mana = novaMana;
    linhasEfeito.push(`💧 Mana: ${manaAntes} → ${novaMana} (+${novaMana - manaAntes})`);
  }

  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $set: updateFields }
  );

  await sock.sendMessage(jid, {
    text:
      `${pocao.emoji} *${pocao.nome}* usada!\n\n` +
      linhasEfeito.join('\n') +
      `\n\n_Restam: ${qtdAntes - 1}x ${pocao.nome}_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !rankmedieval ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRankMedieval(sock, msg, jid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }

  const personagens = await MedievalPersonagem.find({ idGrupo: jid })
    .sort({ vitorias: -1, nivel: -1 })
    .limit(10)
    .lean();

  if (!personagens.length) {
    return sock.sendMessage(jid, {
      text: '⚔️ Nenhum guerreiro registrado ainda!\nUse *!ficha* para criar seu personagem.',
    }, { quoted: msg });
  }

  const MEDALHAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const linhas   = personagens.map((p, i) => {
    const classe   = getClasse(p.classe);
    const elemento = getElemento(p.elemento);
    return `${MEDALHAS[i]} *${p.nome || p.idWhatsApp.split('@')[0]}*\n   ${classe?.emoji || '⚔️'} ${p.classe} | ${elemento?.emoji || '✨'} ${p.elemento}\n   🏆 ${p.vitorias} vitórias | ⭐ Nível ${p.nivel}`;
  }).join('\n\n');

  await sock.sendMessage(jid, {
    text:
      `⚔️ *RANKING DE GUERREIROS MEDIEVAIS* ⚔️\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${linhas}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Conquiste vitórias para subir no ranking!_`,
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !menumediev ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMenuMedieval(sock, msg, jid) {
  await sock.sendMessage(jid, {
    text:
      `⚔️🏰 *MENU MEDIEVAL* 🏰⚔️\n\n` +
      `👤 *PERSONAGEM*\n` +
      `▸ *!ficha* — Ver sua ficha de herói\n` +
      `▸ *!recargamana* — Recuperar HP e mana (10min)\n\n` +
      `⚔️ *COMBATE*\n` +
      `▸ *!atacar @alguém* — Atacar com arma (2min)\n` +
      `▸ *!magia @alguém* — Habilidade elemental (5min)\n\n` +
      `🗺️ *AVENTURA*\n` +
      `▸ *!missaomed* — Embarcar em missão (30min)\n\n` +
      `🏪 *LOJA E ITENS*\n` +
      `▸ *!lojamedieval* — Ver loja de armas, armaduras e poções\n` +
      `▸ *!comprar [item]* — Comprar um item\n` +
      `▸ *!equipar [item]* — Equipar arma ou armadura\n` +
      `▸ *!desequipar arma/armadura* — Remover item equipado\n` +
      `▸ *!usarpocao [nome]* — Usar poção do inventário\n` +
      `▸ *!invmed* — Ver seus itens\n` +
      `▸ *!sistemmedieval* — Como funciona o sistema\n\n` +
      `📊 *RANKING E HISTÓRICO*\n` +
      `▸ *!rankmedieval* — Ranking de guerreiros\n` +
      `▸ *!historico* — Suas últimas batalhas\n\n` +
      `⚙️ *ADMIN*\n` +
      `▸ *!medieval on/off* — Ativar/desativar modo\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🔥 *Elementos:* Fogo 💧 Água 🌍 Terra 🌪️ Ar ⚡ Trovão 🌑 Sombra ✨ Luz 🖤 Magia Negra\n` +
      `_Cada elemento tem vantagens e fraquezas!_`,
  }, { quoted: msg });
}

module.exports = {
  handleLojaMedieval,
  handleComprarMedieval,
  handleEquipar,
  handleDesequipar,
  handleInvMed,
  handleUsarPocao,
  handleRankMedieval,
  handleMenuMedieval,
};