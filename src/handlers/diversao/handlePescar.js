/**
 * Handler de Pesca — Bot
 * Sistema de pesca com itens, cooldown, raridade e inventário
 *
 * v1.0:
 *  - Pesca qualquer item que exista no bot (CATALOGO_PESCA gerado dinamicamente)
 *  - Varas e iscas melhoram chance e raridade
 *  - Cooldown configurável por usuário
 *  - Chance de não pegar nada (falha)
 *  - Raridades: comum, incomum, raro, épico, lendário
 *  - Inventário salvo em itensPesca no modelo Usuario
 */

'use strict';

const path    = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG_PESCA = {
  COOLDOWN_MS:       15 * 60 * 1000, // 15 minutos entre pescas
  CHANCE_FALHA_BASE: 30,             // 30% de chance de não pegar nada (sem vara)
  CHANCE_FALHA_MIN:  5,              // nunca abaixo de 5% de falha
};

// ─── VARAS DE PESCA ───────────────────────────────────────────────────────────

const VARAS_PESCA = {
  vara_bambu:    { nome: '🎋 Vara de Bambu',      preco: 80,   bonus_raridade: 0,  reduce_falha: 5  },
  vara_madeira:  { nome: '🪵 Vara de Madeira',     preco: 150,  bonus_raridade: 5,  reduce_falha: 8  },
  vara_fibra:    { nome: '🎣 Vara de Fibra',        preco: 300,  bonus_raridade: 10, reduce_falha: 12 },
  vara_carbono:  { nome: '⚫ Vara de Carbono',      preco: 600,  bonus_raridade: 18, reduce_falha: 18 },
  vara_titanio:  { nome: '🔩 Vara de Titânio',      preco: 1200, bonus_raridade: 28, reduce_falha: 22 },
  vara_lendaria: { nome: '✨ Vara Lendária',        preco: 3000, bonus_raridade: 45, reduce_falha: 25 },
};

// ─── ISCAS ────────────────────────────────────────────────────────────────────

const ISCAS = {
  isca_minhoca:  { nome: '🪱 Minhoca',             preco: 20,  bonus_raridade: 0,  reduce_falha: 2  },
  isca_camarao:  { nome: '🦐 Camarão',             preco: 50,  bonus_raridade: 5,  reduce_falha: 5  },
  isca_mosca:    { nome: '🪰 Mosca Artificial',    preco: 80,  bonus_raridade: 8,  reduce_falha: 7  },
  isca_peixinho: { nome: '🐟 Peixinho Vivo',       preco: 120, bonus_raridade: 12, reduce_falha: 10 },
  isca_lula:     { nome: '🦑 Lula',                preco: 200, bonus_raridade: 18, reduce_falha: 14 },
  isca_magica:   { nome: '🌟 Isca Mágica',         preco: 500, bonus_raridade: 30, reduce_falha: 20 },
};

// ─── CATÁLOGO DE ITENS PESCÁVEIS ──────────────────────────────────────────────
// Gerado dinamicamente: qualquer item do bot pode ser pescado.
// A raridade define o peso (chance) de aparecer.
// Raridades: comum(60), incomum(25), raro(10), epico(4), lendario(1)

const PEIXES_E_ITENS = {
  // ── Peixes (sempre disponíveis) ─────────────────────────────────────────
  peixe_pequeno:  { nome: '🐟 Peixe Pequeno',      raridade: 'comum',    peso: 60, gold: 15  },
  peixe_medio:    { nome: '🐠 Peixe Médio',         raridade: 'incomum',  peso: 25, gold: 35  },
  peixe_grande:   { nome: '🐡 Peixe Grande',        raridade: 'raro',     peso: 10, gold: 80  },
  peixe_espada:   { nome: '⚔️ Peixe-Espada',        raridade: 'epico',    peso: 4,  gold: 200 },
  peixe_lendario: { nome: '🌈 Peixe Arco-Íris',    raridade: 'lendario', peso: 1,  gold: 500 },

  // ── Lixo (penalidade leve) ──────────────────────────────────────────────
  bota_velha:     { nome: '👢 Bota Velha',          raridade: 'comum',    peso: 40, gold: 0   },
  lata_enferrujada:{ nome: '🥫 Lata Enferrujada',  raridade: 'comum',    peso: 35, gold: 0   },
  alga:           { nome: '🌿 Monte de Algas',      raridade: 'comum',    peso: 30, gold: 2   },

  // ── Tesouros (caem no inventário) ───────────────────────────────────────
  moeda_antiga:   { nome: '🪙 Moeda Antiga',        raridade: 'incomum',  peso: 20, gold: 50  },
  anel_perdido:   { nome: '💍 Anel Perdido',        raridade: 'raro',     peso: 8,  gold: 150 },
  perola:         { nome: '🦪 Pérola Rara',         raridade: 'epico',    peso: 3,  gold: 400 },
  tesouro:        { nome: '💎 Cristal do Fundo',    raridade: 'lendario', peso: 1,  gold: 800 },
};

// Itens do bot que também podem aparecer na pesca (com raridade forçada)
// Adicione aqui qualquer item de outros módulos que queira incluir:
const ITENS_BONUS_PESCA = {
  // de roubo.js
  mascara:    { nome: '🎭 Máscara',            raridade: 'incomum', peso: 15, gold: 0 },
  corda:      { nome: '🪢 Corda Ninja',        raridade: 'raro',    peso: 6,  gold: 0 },
  // de loja
  chocolate:  { nome: '🍫 Chocolate',          raridade: 'comum',   peso: 25, gold: 0 },
  flores:     { nome: '🌹 Flores',             raridade: 'incomum', peso: 15, gold: 0 },
};

// Catálogo completo pescável
const CATALOGO_PESCA = {
  ...PEIXES_E_ITENS,
  ...ITENS_BONUS_PESCA,
};

// ─── RARIDADE ─────────────────────────────────────────────────────────────────

const RARIDADE_LABEL = {
  comum:    '⚪ Comum',
  incomum:  '🟢 Incomum',
  raro:     '🔵 Raro',
  epico:    '🟣 Épico',
  lendario: '🟡 Lendário',
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function getUserId(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid || null;
}

async function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

function getItemInventario(user, campo, itemKey) {
  return user[campo]?.get?.(itemKey) ?? user[campo]?.[itemKey] ?? 0;
}

/**
 * Sorteia um item do catálogo levando em conta:
 *  - bonus_raridade (da vara + isca): aumenta o peso dos itens raros
 *  - Lixo tem peso reduzido conforme o bonus aumenta
 */
function sortearItem(bonusRaridade = 0) {
  const itens = Object.entries(CATALOGO_PESCA);

  // Ajusta pesos: bonus_raridade multiplica pesos de raros/épicos/lendários
  const multiplicadores = {
    comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
    incomum:  1 + bonusRaridade * 0.01,
    raro:     1 + bonusRaridade * 0.03,
    epico:    1 + bonusRaridade * 0.05,
    lendario: 1 + bonusRaridade * 0.08,
  };

  const pool = itens.map(([key, item]) => ({
    key,
    ...item,
    pesoAjustado: Math.max(0.5, item.peso * (multiplicadores[item.raridade] ?? 1)),
  }));

  const totalPeso = pool.reduce((acc, i) => acc + i.pesoAjustado, 0);
  let sorteio     = Math.random() * totalPeso;

  for (const item of pool) {
    sorteio -= item.pesoAjustado;
    if (sorteio <= 0) return item;
  }

  return pool[0]; // fallback
}

/**
 * Calcula a chance de falha real (em %) considerando vara e isca equipadas.
 */
function calcularChanceFalha(vara, isca) {
  let reducao = 0;
  if (vara) reducao += (VARAS_PESCA[vara]?.reduce_falha ?? 0);
  if (isca) reducao += (ISCAS[isca]?.reduce_falha ?? 0);
  return Math.max(CONFIG_PESCA.CHANCE_FALHA_MIN, CONFIG_PESCA.CHANCE_FALHA_BASE - reducao);
}

/**
 * Calcula o bonus de raridade total (vara + isca).
 */
function calcularBonusRaridade(vara, isca) {
  const bVara = VARAS_PESCA[vara]?.bonus_raridade ?? 0;
  const bIsca = ISCAS[isca]?.bonus_raridade       ?? 0;
  return bVara + bIsca;
}

// ─── HANDLER PRINCIPAL: !pescar ───────────────────────────────────────────────

async function handlePescar(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId });
    if (!user) {
      return reply(sock, jid, msg,
        '⚠️ Você ainda não tem conta! Use *!perfil* para criar.'
      );
    }

    // ── Cooldown ────────────────────────────────────────────────────────────
    const agora         = Date.now();
    const ultimaPesca   = user.ultimaPesca ? new Date(user.ultimaPesca).getTime() : 0;
    const tempoPassado  = agora - ultimaPesca;

    if (tempoPassado < CONFIG_PESCA.COOLDOWN_MS) {
      const restante = CONFIG_PESCA.COOLDOWN_MS - tempoPassado;
      const min      = Math.ceil(restante / 60_000);
      return reply(sock, jid, msg,
        `⏳ *AGUARDE PARA PESCAR!*\n\n` +
        `🎣 Você pescou recentemente.\n` +
        `⏰ Próxima pesca em: *${min} minuto(s)*`
      );
    }

    // ── Verificar vara e isca equipadas ─────────────────────────────────────
    // Busca a melhor vara que o usuário tem no inventário
    const varaEquipada = Object.keys(VARAS_PESCA)
      .reverse() // varas mais caras primeiro
      .find(v => getItemInventario(user, 'itensPesca', v) > 0)
      ?? null;

    const iscaEquipada = Object.keys(ISCAS)
      .reverse()
      .find(i => getItemInventario(user, 'itensPesca', i) > 0)
      ?? null;

    if (!varaEquipada) {
      return reply(sock, jid, msg,
        `🎣 *VOCÊ PRECISA DE UMA VARA!*\n\n` +
        `Sem vara de pesca não dá pra pescar!\n\n` +
        `🛒 Compre uma na loja: *!comprar vara_bambu*\n` +
        `📋 Ver varas disponíveis: *!varas*`
      );
    }

    // ── Registrar cooldown imediatamente ────────────────────────────────────
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { ultimaPesca: new Date() } }
    );

    // ── Consumir isca (1 unidade por pesca) ──────────────────────────────────
    if (iscaEquipada) {
      await Usuario.findOneAndUpdate(
        { idWhatsApp: userId },
        { $inc: { [`itensPesca.${iscaEquipada}`]: -1 } }
      );
    }

    // ── Calcular chance de falha e bonus ────────────────────────────────────
    const chanceFalha    = calcularChanceFalha(varaEquipada, iscaEquipada);
    const bonusRaridade  = calcularBonusRaridade(varaEquipada, iscaEquipada);
    const falhou         = Math.random() * 100 < chanceFalha;

    const varaNome = VARAS_PESCA[varaEquipada]?.nome ?? varaEquipada;
    const iscaNome = iscaEquipada ? (ISCAS[iscaEquipada]?.nome ?? iscaEquipada) : null;

    const cabecalho =
      `🎣 *PESCARIA!*\n\n` +
      `🪝 Vara: *${varaNome}*\n` +
      (iscaNome ? `🪱 Isca: *${iscaNome}*\n` : `🪱 Isca: _nenhuma_\n`) +
      `━━━━━━━━━━━━━━━━\n`;

    // ── Falhou ──────────────────────────────────────────────────────────────
    if (falhou) {
      const mensagensFalha = [
        '🌊 O peixe deu uma mordida e escapou!',
        '💨 Nada por aqui... a água está quieta demais.',
        '😔 Você ficou esperando, mas nada apareceu.',
        '🐟 O peixe olhou para a isca e foi embora.',
        '🌿 Você pescou um monte de algas. Nada útil.',
        '🤣 Um peixinho roubou sua isca e fugiu!',
      ];
      const msg_falha = mensagensFalha[Math.floor(Math.random() * mensagensFalha.length)];

      return reply(sock, jid, msg,
        cabecalho +
        `\n${msg_falha}\n\n` +
        `💡 Tente novamente em *${Math.ceil(CONFIG_PESCA.COOLDOWN_MS / 60_000)} minutos*\n` +
        `📈 Use iscas melhores para reduzir falhas!`
      );
    }

    // ── Sortear item ─────────────────────────────────────────────────────────
    const itemPescado = sortearItem(bonusRaridade);
    const rarLabel    = RARIDADE_LABEL[itemPescado.raridade] ?? itemPescado.raridade;

    // ── Atualizar inventário e gold ──────────────────────────────────────────
    const updates = { $inc: {} };

    if (itemPescado.gold > 0) {
      updates.$inc.gold = itemPescado.gold;
    }

    // Itens que não são lixo vão para o inventário
    const ehLixo = ['bota_velha', 'lata_enferrujada', 'alga'].includes(itemPescado.key);
    if (!ehLixo) {
      updates.$inc[`itensPesca.${itemPescado.key}`] = 1;
    }

    if (Object.keys(updates.$inc).length > 0) {
      await Usuario.findOneAndUpdate({ idWhatsApp: userId }, updates);
    }

    // ── Mensagens especiais por raridade ────────────────────────────────────
    const reacoes = {
      comum:    '',
      incomum:  '✨ Não é ruim!',
      raro:     '🔥 Que sorte! Item raro!',
      epico:    '🤩 ÉPICO! Pescada incrível!!',
      lendario: '🏆 LENDÁRIO!! VOCÊ É UM MESTRE DA PESCA!!!',
    };
    const reacao = reacoes[itemPescado.raridade] ?? '';

    let resultado =
      cabecalho +
      `\n🎉 *VOCÊ PESCOU!*\n\n` +
      `📦 *${itemPescado.nome}*\n` +
      `🏷️ Raridade: *${rarLabel}*\n`;

    if (itemPescado.gold > 0) {
      resultado += `💰 *+${itemPescado.gold} gold*\n`;
    }

    if (ehLixo) {
      resultado += `\n🗑️ _Só lixo desta vez..._\n`;
    } else {
      resultado += `\n📥 _Item adicionado ao inventário!_\n`;
    }

    if (reacao) resultado += `\n${reacao}\n`;

    resultado +=
      `\n━━━━━━━━━━━━━━━━\n` +
      `⏰ Próxima pesca em *${Math.ceil(CONFIG_PESCA.COOLDOWN_MS / 60_000)} minutos*\n` +
      `📦 Ver inventário: *!inventario*`;

    return reply(sock, jid, msg, resultado);

  } catch (e) {
    console.error('[Pesca] handlePescar:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao pescar! Tente novamente.');
  }
}

// ─── !varas ───────────────────────────────────────────────────────────────────

async function handleVaras(sock, msg, jid) {
  let texto = `🎣 *VARAS DE PESCA*\n\n`;

  for (const [key, vara] of Object.entries(VARAS_PESCA)) {
    texto += `${vara.nome}\n`;
    texto += `   💵 Preço: *${vara.preco} gold*\n`;
    texto += `   📈 Bonus raridade: *+${vara.bonus_raridade}*\n`;
    texto += `   🎯 Reduz falha: *-${vara.reduce_falha}%*\n`;
    texto += `   🛒 \`!comprar ${key}\`\n\n`;
  }

  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `🪱 Ver iscas: *!iscas*\n` +
    `🎣 Pescar agora: *!pescar*`;

  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !iscas ───────────────────────────────────────────────────────────────────

async function handleIscas(sock, msg, jid) {
  let texto = `🪱 *ISCAS DE PESCA*\n\n`;

  for (const [key, isca] of Object.entries(ISCAS)) {
    texto += `${isca.nome}\n`;
    texto += `   💵 Preço: *${isca.preco} gold*\n`;
    texto += `   📈 Bonus raridade: *+${isca.bonus_raridade}*\n`;
    texto += `   🎯 Reduz falha: *-${isca.reduce_falha}%*\n`;
    texto += `   🛒 \`!comprar ${key}\`\n\n`;
  }

  texto +=
    `━━━━━━━━━━━━━━━━\n` +
    `💡 _A isca é consumida a cada pesca!_\n` +
    `🎣 Ver varas: *!varas*`;

  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !inventariopesca ─────────────────────────────────────────────────────────

async function handleInventarioPesca(sock, msg, jid) {
  const userId = getUserId(msg);
  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');

  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    if (!user) return reply(sock, jid, msg, '⚠️ Usuário não encontrado.');

    const itensPesca = user.itensPesca ?? {};
    const chaves     = Object.keys(itensPesca).filter(k => (itensPesca[k] ?? 0) > 0);

    if (chaves.length === 0) {
      return reply(sock, jid, msg,
        `🎣 *SEU INVENTÁRIO DE PESCA ESTÁ VAZIO*\n\n` +
        `Compre uma vara: *!varas*\n` +
        `Compre uma isca: *!iscas*\n` +
        `Então: *!pescar*`
      );
    }

    let texto = `🎣 *INVENTÁRIO DE PESCA*\n\n`;

    // Varas
    const varas = chaves.filter(k => VARAS_PESCA[k]);
    if (varas.length > 0) {
      texto += `🪝 *VARAS*\n`;
      for (const k of varas) {
        texto += `   ${VARAS_PESCA[k].nome} × ${itensPesca[k]}\n`;
      }
      texto += '\n';
    }

    // Iscas
    const iscas = chaves.filter(k => ISCAS[k]);
    if (iscas.length > 0) {
      texto += `🪱 *ISCAS*\n`;
      for (const k of iscas) {
        texto += `   ${ISCAS[k].nome} × ${itensPesca[k]}\n`;
      }
      texto += '\n';
    }

    // Itens pescados
    const pescados = chaves.filter(k => !VARAS_PESCA[k] && !ISCAS[k]);
    if (pescados.length > 0) {
      texto += `📦 *ITENS PESCADOS*\n`;
      for (const k of pescados) {
        const nome = CATALOGO_PESCA[k]?.nome ?? k;
        texto     += `   ${nome} × ${itensPesca[k]}\n`;
      }
    }

    texto += `\n━━━━━━━━━━━━━━━━\n🎣 *!pescar* para pescar novamente!`;

    return reply(sock, jid, msg, texto);
  } catch (e) {
    console.error('[Pesca] handleInventarioPesca:', e.message);
    return reply(sock, jid, msg, '⚠️ Erro ao carregar inventário de pesca!');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  // Handlers de comandos
  handlePescar,
  handleVaras,
  handleIscas,
  handleInventarioPesca,

  // Catálogos (usados pelo marketplace.js)
  VARAS_PESCA,
  ISCAS,
  CATALOGO_PESCA,
  PEIXES_E_ITENS,
};