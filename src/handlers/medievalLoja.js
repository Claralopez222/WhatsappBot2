'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const { ARMAS, ARMADURAS, POCOES, getClasse, getElemento, getArma, getArmadura, getPocao } = require('../utils/medievalUtils');
const { getModoAtivo, getOuCriarPersonagem, somenteGrupo } = require('./medieval');

// ═══════════════════════════════════════════════════════════════
// ─── !lojamedieval ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleLojaMedieval(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }

  const [carteira, p] = await Promise.all([
    CarteiraGrupo.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean(),
    getOuCriarPersonagem(senderJid, jid, nomeDisplay),
  ]);
  const gold            = carteira?.gold || 0;
  const nivelJog        = p.nivel;
  const mostrarTodas    = typeof args === 'string' && args.trim().toLowerCase() === 'todas';
  const classeData      = getClasse(p.classe);
  const armasPermitidas = classeData?.armasPermitidas || [];
  const RARIDADE_EMOJI  = { comum: '⚪', incomum: '🟢', raro: '🔵', lendário: '🟣' };

  // ── Filtra por nível (ou mostra tudo se "todas") ──────────────────────────
  const armasFiltradas     = mostrarTodas ? ARMAS     : ARMAS.filter(a => nivelJog >= a.nivelMinimo && armasPermitidas.includes(a.nome));
  const armadurasFiltradas = mostrarTodas ? ARMADURAS : ARMADURAS.filter(a => nivelJog >= a.nivelMinimo);

  // ── Monta texto das armas ─────────────────────────────────────────────────
  const armasTexto = armasFiltradas.length === 0
    ? '_Nenhuma arma disponível para o seu nível e classe._'
    : armasFiltradas.map(a => {
        const chave           = a.nome.replace(/ /g, '_');
        const bloqueadoNivel  = nivelJog < a.nivelMinimo;
        const bloqueadoClasse = !armasPermitidas.includes(a.nome);
        const bloqueado       = bloqueadoNivel || bloqueadoClasse;
        const mana            = a.bonusMana ? `\n   💧 Bônus de mana: *+${a.bonusMana}*` : '';

        let statusTag = '';
        if (mostrarTodas && bloqueadoClasse) {
          statusTag = `   ⛔ *Classe incompatível*\n`;
        } else if (mostrarTodas && bloqueadoNivel) {
          statusTag = `   🔒 Requer Nível ${a.nivelMinimo}\n`;
        }

        return (
          `${bloqueadoClasse && mostrarTodas ? '⛔' : bloqueadoNivel && mostrarTodas ? '🔒' : a.emoji} *${a.nome}*\n` +
          `📦 Preço: *${a.preco} Gold*\n` +
          `⚔️ Bônus de ataque: *+${a.bonusAtaque}*${mana}\n` +
          `${RARIDADE_EMOJI[a.raridade] || '⚪'} Raridade: *${a.raridade}*\n` +
          statusTag +
          `🛒 \`!comprar ${chave}\``
        );
      }).join('\n\n');

  // ── Monta texto das armaduras ─────────────────────────────────────────────
  const armadurasTexto = armadurasFiltradas.length === 0
    ? '_Nenhuma armadura disponível para o seu nível._'
    : armadurasFiltradas.map(a => {
        const chave    = a.nome.replace(/ /g, '_');
        const bloqueado = nivelJog < a.nivelMinimo;
        const mana     = a.bonusMana ? `\n   💧 Bônus de mana: *+${a.bonusMana}*` : '';
        const statusTag = mostrarTodas && bloqueado
          ? `   🔒 Requer Nível ${a.nivelMinimo}\n`
          : '';
        return (
          `${bloqueado && mostrarTodas ? '🔒' : a.emoji} *${a.nome}*\n` +
          `📦 Preço: *${a.preco} Gold*\n` +
          `🛡️ Bônus de defesa: *+${a.bonusDefesa}*${mana}\n` +
          `${RARIDADE_EMOJI[a.raridade] || '⚪'} Raridade: *${a.raridade}*\n` +
          statusTag +
          `🛒 \`!comprar ${chave}\``
        );
      }).join('\n\n');

  // ── Poções não têm nível mínimo — aparecem sempre ─────────────────────────
  const pocoesTexto = POCOES.map(poc => {
    const chave  = poc.nome.replace(/ /g, '_');
    const tipoIc = poc.tipo === 'hp' ? '❤️' : poc.tipo === 'mana' ? '💧' : '❤️💧';
    const tipoTx = poc.tipo === 'ambos' ? 'HP e Mana' : poc.tipo.toUpperCase();
    return (
      `${poc.emoji} *${poc.nome}*\n` +
      `📦 Preço: *${poc.preco} Gold*\n` +
      `${tipoIc} Restaura: *+${poc.valor} ${tipoTx}*\n` +
      `${RARIDADE_EMOJI[poc.raridade] || '⚪'} Raridade: *${poc.raridade}*\n` +
      `🛒 \`!comprar ${chave}\``
    );
  }).join('\n\n');

  const rodape = mostrarTodas
    ? `_Mostrando todos os itens. Use *!lojamedieval* para ver só os do seu nível._`
    : `_Mostrando itens do Nível ${nivelJog}. Use *!lojamedieval todas* para ver tudo._`;

  await sock.sendMessage(jid, {
    text:
      `🏪 *LOJA MEDIEVAL* — Nível ${nivelJog} 🏪\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🪙 Seu saldo: *${gold} Gold*\n` +
      `🏅 Classe: *${p.classe}* ${classeData?.emoji || ''}\n\n` +
      `⚔️ *ARMAS DISPONÍVEIS*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${armasTexto}\n\n` +
      `🛡️ *ARMADURAS DISPONÍVEIS*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${armadurasTexto}\n\n` +
      `🧪 *POÇÕES*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${pocoesTexto}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      rodape,
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

  // Valida classe para armas — avisa antes de desperdiçar gold
  if (arma) {
    const classeData = getClasse(p.classe);
    if (classeData && !classeData.armasPermitidas.includes(item.nome)) {
      return sock.sendMessage(jid, {
        text:
          `❌ *${p.classe}* não pode equipar *${item.nome}*!\n` +
          `🗡️ Armas permitidas para sua classe: *${classeData.armasPermitidas.join(', ')}*\n\n` +
          `_Você não pode comprar itens que sua classe não consegue usar._`,
      }, { quoted: msg });
    }
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
// ─── !sellmed ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleSellMed(sock, msg, jid, senderJid, nomeDisplay, args) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) return;

  const partes      = (args || '').trim().split(/\s+/);
  const ultimaParte = partes[partes.length - 1];
  const temQtd      = /^\d+$/.test(ultimaParte) && partes.length > 1;
  const quantidade  = temQtd ? Math.max(1, parseInt(ultimaParte, 10)) : 1;
  const nomeItem    = (temQtd ? partes.slice(0, -1) : partes).join(' ').replace(/_/g, ' ').trim();

  if (!nomeItem) {
    return sock.sendMessage(jid, {
      text:
        `🏷️ *Como vender:*\n` +
        `▸ *!sellmed Espada* — vende 1 unidade\n` +
        `▸ *!sellmed Poção_de_Cura 3* — vende 3 unidades\n\n` +
        `_Use *!invmed* para ver seus itens._`,
    }, { quoted: msg });
  }

  // Resolve item em qualquer categoria (busca case-insensitive)
  const arma     = ARMAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const armadura = ARMADURAS.find(a => a.nome.toLowerCase() === nomeItem.toLowerCase());
  const pocao    = POCOES.find(p => p.nome.toLowerCase() === nomeItem.toLowerCase());
  const item     = arma || armadura || pocao;

  if (!item) {
    return sock.sendMessage(jid, {
      text: `❌ Item *"${nomeItem}"* não encontrado!\n_Use *!invmed* para ver seus itens._`,
    }, { quoted: msg });
  }

  const chaveInv = item.nome.replace(/ /g, '_');
  const chaveMap = `inventarioMedieval.${chaveInv}`;

  // Busca personagem fresco para checar estoque e equipamentos
  const p = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
    ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);

  const invMap   = p.inventarioMedieval instanceof Map
    ? p.inventarioMedieval
    : new Map(Object.entries(p.inventarioMedieval || {}));
  const qtdAtual = invMap.get(chaveInv) || 0;

  if (qtdAtual <= 0) {
    return sock.sendMessage(jid, {
      text: `❌ Você não possui *${item.nome}* no inventário!\n_Use *!invmed* para ver seus itens._`,
    }, { quoted: msg });
  }

  if (quantidade > qtdAtual) {
    return sock.sendMessage(jid, {
      text: `❌ Você só tem *${qtdAtual}x ${item.nome}* no inventário!`,
    }, { quoted: msg });
  }

  // Impede vender item equipado no momento
  if (p.armaEquipada === item.nome) {
    return sock.sendMessage(jid, {
      text: `❌ *${item.nome}* está equipado!\nUse *!desequipar arma* primeiro.`,
    }, { quoted: msg });
  }
  if (p.armaduraEquipada === item.nome) {
    return sock.sendMessage(jid, {
      text: `❌ *${item.nome}* está equipado!\nUse *!desequipar armadura* primeiro.`,
    }, { quoted: msg });
  }

  // Valor de venda = 50% do preço original por unidade
  const valorUnit  = Math.floor(item.preco * 0.5);
  const valorTotal = valorUnit * quantidade;

  // Remove do inventário atomicamente — só executa se ainda tiver estoque suficiente
  const resultado = await MedievalPersonagem.findOneAndUpdate(
    {
      idWhatsApp: senderJid,
      idGrupo:    jid,
      [chaveMap]: { $gte: quantidade },
    },
    { $inc: { [chaveMap]: -quantidade } },
    { new: false }
  );

  // Se resultado for null, outro request consumiu o estoque entre a leitura e o update
  if (!resultado) {
    return sock.sendMessage(jid, {
      text: `❌ Não foi possível vender *${item.nome}*.\n_Verifique seu inventário com *!invmed*._`,
    }, { quoted: msg });
  }

  // Credita o gold na carteira (upsert garante que cria se não existir)
  await CarteiraGrupo.findOneAndUpdate(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $inc: { gold: valorTotal } },
    { upsert: true }
  );

  const qtdRestante = qtdAtual - quantidade;

  await sock.sendMessage(jid, {
    text:
      `💰 *VENDA REALIZADA!*\n\n` +
      `${item.emoji} *${item.nome}* x${quantidade}\n\n` +
      `🪙 Valor unitário: *${valorUnit} Gold*\n` +
      `🪙 Total recebido: *+${valorTotal} Gold*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      (qtdRestante > 0
        ? `_Restam *${qtdRestante}x ${item.nome}* no inventário._`
        : `_Você não tem mais *${item.nome}* no inventário._`),
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
  handleSellMed,
  handleRankMedieval,
  handleMenuMedieval,
};