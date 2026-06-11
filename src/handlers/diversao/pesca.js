'use strict';

/**
 * Handler de Pesca — Bot WhatsApp
 * Sistema de pesca com itens, cooldown, raridade e inventário por grupo
 *
 * v3.0:
 *  - Economia e inventário isolados por grupo (CarteiraGrupo)
 *  - Melhor vara/isca selecionada automaticamente (maior bônus)
 *  - !venderpesca [item] [qtd] — vende itens por 70% do valor
 *  - !rankingpesca              — top 10 pescadores do grupo
 *  - !statspesca                — equipamento atual + chances em tempo real
 *  - Logs de erro completos
 */

const path          = require('path');
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { getCarteira, alterarGold } = require(path.join(__dirname, '..', '..', 'utils', 'carteira'));

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────

const CONFIG_PESCA = {
  COOLDOWN_MS:       15 * 60 * 1000, // 15 minutos entre pescas
  CHANCE_FALHA_BASE: 30,             // 30% de falha sem vara
  CHANCE_FALHA_MIN:  5,              // mínimo de 5% de falha
  PERCENTUAL_VENDA:  0.70,           // 70% do valor base na venda
};

// ─── VARAS DE PESCA ───────────────────────────────────────────────────────────

const VARAS_PESCA = {
  vara_bambu:    { nome: '🎋 Vara de Bambu',   preco: 80,   bonus_raridade: 0,  reduce_falha: 5  },
  vara_madeira:  { nome: '🪵 Vara de Madeira',  preco: 150,  bonus_raridade: 5,  reduce_falha: 8  },
  vara_fibra:    { nome: '🎣 Vara de Fibra',    preco: 300,  bonus_raridade: 10, reduce_falha: 12 },
  vara_carbono:  { nome: '⚫ Vara de Carbono',  preco: 600,  bonus_raridade: 18, reduce_falha: 18 },
  vara_titanio:  { nome: '🔩 Vara de Titânio',  preco: 1200, bonus_raridade: 28, reduce_falha: 22 },
  vara_lendaria: { nome: '✨ Vara Lendária',    preco: 3000, bonus_raridade: 45, reduce_falha: 25 },
};

// ─── ISCAS ────────────────────────────────────────────────────────────────────

const ISCAS = {
  isca_minhoca:  { nome: '🪱 Minhoca',          preco: 20,  bonus_raridade: 0,  reduce_falha: 2  },
  isca_camarao:  { nome: '🦐 Camarão',          preco: 50,  bonus_raridade: 5,  reduce_falha: 5  },
  isca_mosca:    { nome: '🪰 Mosca Artificial',  preco: 80,  bonus_raridade: 8,  reduce_falha: 7  },
  isca_peixinho: { nome: '🐟 Peixinho Vivo',     preco: 120, bonus_raridade: 12, reduce_falha: 10 },
  isca_lula:     { nome: '🦑 Lula',              preco: 200, bonus_raridade: 18, reduce_falha: 14 },
  isca_magica:   { nome: '🌟 Isca Mágica',       preco: 500, bonus_raridade: 30, reduce_falha: 20 },
};

// ─── CATÁLOGO DE ITENS PESCÁVEIS ──────────────────────────────────────────────

const PEIXES_E_ITENS = {
  // Peixes
  peixe_pequeno:    { nome: '🐟 Peixe Pequeno',  raridade: 'comum',    peso: 60, gold: 15  },
  peixe_medio:      { nome: '🐠 Peixe Médio',     raridade: 'incomum',  peso: 25, gold: 35  },
  peixe_grande:     { nome: '🐡 Peixe Grande',    raridade: 'raro',     peso: 10, gold: 80  },
  peixe_espada:     { nome: '⚔️ Peixe-Espada',    raridade: 'epico',    peso: 4,  gold: 200 },
  peixe_lendario:   { nome: '🌈 Peixe Arco-Íris', raridade: 'lendario', peso: 1,  gold: 500 },
  // Lixo (gold = 0 → não vendável)
  bota_velha:       { nome: '👢 Bota Velha',       raridade: 'comum',    peso: 40, gold: 0   },
  lata_enferrujada: { nome: '🥫 Lata Enferrujada', raridade: 'comum',    peso: 35, gold: 0   },
  alga:             { nome: '🌿 Monte de Algas',    raridade: 'comum',    peso: 30, gold: 2   },
  // Tesouros
  moeda_antiga:     { nome: '🪙 Moeda Antiga',      raridade: 'incomum',  peso: 20, gold: 50  },
  anel_perdido:     { nome: '💍 Anel Perdido',      raridade: 'raro',     peso: 8,  gold: 150 },
  perola:           { nome: '🦪 Pérola Rara',       raridade: 'epico',    peso: 3,  gold: 400 },
  tesouro:          { nome: '💎 Cristal do Fundo',  raridade: 'lendario', peso: 1,  gold: 800 },
};

const ITENS_BONUS_PESCA = {
  mascara:   { nome: '🎭 Máscara',     raridade: 'incomum', peso: 15, gold: 0 },
  corda:     { nome: '🪢 Corda Ninja', raridade: 'raro',    peso: 6,  gold: 0 },
  chocolate: { nome: '🍫 Chocolate',   raridade: 'comum',   peso: 25, gold: 0 },
  flores:    { nome: '🌹 Flores',      raridade: 'incomum', peso: 15, gold: 0 },
};

const CATALOGO_PESCA = { ...PEIXES_E_ITENS, ...ITENS_BONUS_PESCA };

// Itens que vão para o inventário mas não têm gold (não vendáveis diretamente)
const LIXO_KEYS     = new Set(['bota_velha', 'lata_enferrujada', 'alga']);
// Itens que ficam apenas na mensagem, não vão para o inventário
const DESCARTAVEL_KEYS = new Set(['bota_velha', 'lata_enferrujada']);

const RARIDADE_LABEL = {
  comum:    '⚪ Comum',
  incomum:  '🟢 Incomum',
  raro:     '🔵 Raro',
  epico:    '🟣 Épico',
  lendario: '🟡 Lendário',
};

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

function reply(sock, jid, msg, texto) {
  return sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

/**
 * Resolve userId e groupId a partir da mensagem.
 * Retorna null em groupId se for conversa privada.
 */
function resolverContexto(msg) {
  const userId  = msg?.key?.participant || msg?.key?.remoteJid || null;
  const remoteJid = msg?.key?.remoteJid ?? '';
  const groupId = remoteJid.endsWith('@g.us') ? remoteJid : null;
  return { userId, groupId };
}

/**
 * Lê quantidade de um item no mapa itensPesca (suporta Map Mongoose ou objeto plano).
 */
function getQtdItem(carteira, key) {
  const mapa = carteira?.itensPesca;
  if (!mapa) return 0;
  const val = mapa instanceof Map ? mapa.get(key) : mapa[key];
  return val ?? 0;
}

/**
 * Seleciona a melhor vara disponível no inventário (maior bonus_raridade).
 */
function selecionarMelhorVara(carteira) {
  return Object.entries(VARAS_PESCA)
    .filter(([k]) => getQtdItem(carteira, k) > 0)
    .sort((a, b) => b[1].bonus_raridade - a[1].bonus_raridade)[0]?.[0] ?? null;
}

/**
 * Seleciona a melhor isca disponível no inventário (maior bonus_raridade).
 */
function selecionarMelhorIsca(carteira) {
  return Object.entries(ISCAS)
    .filter(([k]) => getQtdItem(carteira, k) > 0)
    .sort((a, b) => b[1].bonus_raridade - a[1].bonus_raridade)[0]?.[0] ?? null;
}

function calcularChanceFalha(varaKey, iscaKey) {
  const r = (VARAS_PESCA[varaKey]?.reduce_falha ?? 0) + (ISCAS[iscaKey]?.reduce_falha ?? 0);
  return Math.max(CONFIG_PESCA.CHANCE_FALHA_MIN, CONFIG_PESCA.CHANCE_FALHA_BASE - r);
}

function calcularBonusRaridade(varaKey, iscaKey) {
  return (VARAS_PESCA[varaKey]?.bonus_raridade ?? 0) + (ISCAS[iscaKey]?.bonus_raridade ?? 0);
}

function sortearItem(bonusRaridade = 0) {
  const mult = {
    comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
    incomum:  1 + bonusRaridade * 0.01,
    raro:     1 + bonusRaridade * 0.03,
    epico:    1 + bonusRaridade * 0.05,
    lendario: 1 + bonusRaridade * 0.08,
  };

  const pool = Object.entries(CATALOGO_PESCA).map(([key, item]) => ({
    key,
    ...item,
    pesoAjustado: Math.max(0.5, item.peso * (mult[item.raridade] ?? 1)),
  }));

  const total = pool.reduce((acc, i) => acc + i.pesoAjustado, 0);
  let sorteio = Math.random() * total;

  for (const item of pool) {
    sorteio -= item.pesoAjustado;
    if (sorteio <= 0) return item;
  }
  return pool[0];
}

function formatarTempo(ms) {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

// ─── !pescar ──────────────────────────────────────────────────────────────────

async function handlePescar(sock, msg, jid) {
  // 1. Garante a resolução correta do contexto do grupo e usuário
  const ctx = await resolverContexto(msg);
  if (!ctx) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu contexto.');
  const { userId, groupId } = ctx;

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg,
      '🎣 *A pesca só funciona em grupos!*\n\n' +
      'Entre em um grupo e use *!pescar* por lá.'
    );
  }

  try {
    const carteira = await getCarteira(userId, groupId);
    const cooldownLimite = CONFIG_PESCA?.COOLDOWN_MS ?? 600000; // 10 minutos padrão

    // ── Cooldown ──────────────────────────────────────────────────────────
    const agora       = Date.now();
    const ultimaPesca = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const msPassado   = agora - ultimaPesca;

    if (msPassado < cooldownLimite) {
      const restante = cooldownLimite - msPassado;
      return reply(sock, jid, msg,
        `⏳ *AGUARDE PARA PESCAR!*\n\n` +
        `🎣 Você pescou recentemente neste grupo.\n` +
        `⏰ Próxima pesca em: *${typeof formatarTempo === 'function' ? formatarTempo(restante) : restante + 'ms'}*`
      );
    }

    // ── Melhor vara e isca disponíveis ────────────────────────────────────
    const varaKey = typeof selecionarMelhorVara === 'function' ? selecionarMelhorVara(carteira) : null;
    const iscaKey = typeof selecionarMelhorIsca === 'function' ? selecionarMelhorIsca(carteira) : null;

    if (!varaKey || !VARAS_PESCA?.[varaKey]) {
      return reply(sock, jid, msg,
        `🎣 *VOCÊ PRECISA DE UMA VARA!*\n\n` +
        `Sem vara de pesca não dá pra pescar neste grupo!\n\n` +
        `🛒 Compre uma na loja: *!comprar vara_bambu*\n` +
        `📋 Ver varas disponíveis: *!varas*`
      );
    }

    // ── Registrar cooldown + consumir isca de forma atômica e segura ──────
    // Evita exploits de iscas negativas caso o usuário execute comandos simultâneos
    const queryUpdate = { idWhatsApp: userId, idGrupo: groupId };
    if (iscaKey) {
      queryUpdate[`itensPesca.${iscaKey}`] = { $gt: 0 }; 
    }

    const atualizacaoConsumo = await CarteiraGrupo.findOneAndUpdate(
      queryUpdate,
      {
        $set: { ultimaPesca: new Date() },
        ...(iscaKey ? { $inc: { [`itensPesca.${iscaKey}`]: -1 } } : {}),
      },
      { new: true }
    );

    // Se o update falhar contendo iscaKey, significa que a isca acabou bem na hora do clique
    const usouIscaEfetivamente = !!(iscaKey && atualizacaoConsumo);

    const varaNome = VARAS_PESCA[varaKey].nome;
    const iscaNome = usouIscaEfetivamente ? ISCAS?.[iscaKey]?.nome : null;

    const cabecalho =
      `🎣 *PESCARIA!*\n\n` +
      `🪝 Vara: *${varaNome}*\n` +
      (iscaNome ? `🪱 Isca: *${iscaNome}* _(consumida)_\n` : `🪱 Isca: _nenhuma_\n`) +
      `━━━━━━━━━━━━━━━━\n`;

    // ── Sistema de Falha ──────────────────────────────────────────────────
    const chanceFalha   = typeof calcularChanceFalha === 'function' ? calcularChanceFalha(varaKey, usouIscaEfetivamente ? iscaKey : null) : 30;
    const bonusRaridade = typeof calcularBonusRaridade === 'function' ? calcularBonusRaridade(varaKey, usouIscaEfetivamente ? iscaKey : null) : 0;
    const falhou        = Math.random() * 100 < chanceFalha;

    if (falhou) {
      const mensagensFalha = [
        '🌊 O peixe deu uma mordida na linha e escapou!',
        '💨 Nada por aqui... a água está quieta demais neste momento.',
        '😔 Você ficou esperando horas na beirada, mas nada apareceu.',
        '🐟 O peixe olhou para a sua proposta e foi embora desdenhando.',
        '🌿 Você puxou a linha com força e veio um bando de algas inúteis.',
        '🤣 Um peixinho esperto roubou sua isca e sumiu na correnteza!',
        '🌧️ O tempo mudou de repente e espantou os cardumes.',
        '🦈 Uma sombra gigantesca passou por baixo e assustou os peixes menores...',
      ];
      const msgFalha = mensagensFalha[Math.floor(Math.random() * mensagensFalha.length)];

      return reply(sock, jid, msg,
        cabecalho +
        `\n${msgFalha}\n\n` +
        `💡 Tente novamente em *${typeof formatarTempo === 'function' ? formatarTempo(cooldownLimite) : cooldownLimite + 'ms'}*\n` +
        `📈 Equipe iscas melhores para mitigar perdas! _(Taxa atual: ${chanceFalha.toFixed(1)}% de falha)_`
      );
    }

    // ── Sucesso: Sortear item do catálogo ─────────────────────────────────
    if (typeof sortearItem !== 'function') throw new Error('Função sortearItem não localizada no escopo.');
    const item     = sortearItem(bonusRaridade);
    const rarLabel = typeof RARIDADE_LABEL !== 'undefined' ? (RARIDADE_LABEL[item.raridade] ?? item.raridade) : item.raridade;
    
    const ehLixo   = typeof LIXO_KEYS !== 'undefined' ? LIXO_KEYS.has(item.key) : false;
    const ehDesc   = typeof DESCARTAVEL_KEYS !== 'undefined' ? DESCARTAVEL_KEYS.has(item.key) : false;

    // ── Persistência de Recompensas e Inventário ──────────────────────────
    if (item.gold > 0) {
      if (typeof alterarGold === 'function') {
        await alterarGold(userId, groupId, item.gold, `Pesca: ${item.nome}`);
      } else {
        await CarteiraGrupo.updateOne({ idWhatsApp: userId, idGrupo: groupId }, { $inc: { gold: item.gold } });
      }
    }

    if (!ehDesc) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: { [`itensPesca.${item.key}`]: 1 } }
      );
    }

    // ── Geração de Resposta Visual ────────────────────────────────────────
    const reacoes = {
      comum:    '',
      incomum:  '✨ Não é de todo mal!',
      raro:     '🔥 Que sorte absurda! Um item raro despontou na água!',
      epico:    '🤩 CARÁCULO, É ÉPICO! Uma fisgada digna de histórias!',
      lendario: '🏆 MEU DEUS, LENDÁRIO!! VOCÊ ACABA DE SE TORNAR UM MESTRE DOS MARES!!!',
    };

    const taxaVenda  = CONFIG_PESCA?.PERCENTUAL_VENDA ?? 0.7;
    const precoVenda = item.gold > 0 ? Math.floor(item.gold * taxaVenda) : null;

    let resultado =
      cabecalho +
      `\n🎉 *VOCÊ SUCEDEU NA PESCARIA!*\n\n` +
      `📦 *${item.nome}*\n` +
      `🏷️ Raridade: *${rarLabel}*\n`;

    if (item.gold > 0) resultado += `💰 *+${item.gold} Gold* (creditados no grupo)\n`;

    if (ehDesc)   resultado += `\n🗑️ _Apenas entulho de rio descartável desta vez..._\n`;
    else          resultado += `\n📥 _Item guardado com sucesso no inventário do grupo._\n`;

    if (precoVenda && !ehLixo && !ehDesc) {
      resultado += `💵 _Venda rápida por: *${precoVenda} Gold* → !sellpesca ${item.key}_\n`;
    }

    const reacao = reacoes[item.raridade] ?? '';
    if (reacao) resultado += `\n${reacao}\n`;

    resultado +=
      `\n━━━━━━━━━━━━━━━━\n` +
      `⏰ Próxima pesca em *${typeof formatarTempo === 'function' ? formatarTempo(cooldownLimite) : cooldownLimite + 'ms'}*\n` +
      `📦 Veja seus pertences: *!inventariopesca*`;

    return reply(sock, jid, msg, resultado);

  } catch (err) {
    console.error('[Pesca] handlePescar:', err);
    return reply(sock, jid, msg, '⚠️ Ocorreu um erro interno ao processar a pescaria! Tente novamente.');
  }
}

// ─── !varas ───────────────────────────────────────────────────────────────────

async function handleVaras(sock, msg, jid) {
  try {
    // 1. Validação preventiva para o caso do objeto VARAS_PESCA não estar definido globalmente
    const listaVaras = Object.entries(VARAS_PESCA ?? {});
    
    if (listaVaras.length === 0) {
      return reply(sock, jid, msg, '⚠️ Nenhuma vara de pesca cadastrada na loja no momento.');
    }

    let texto = `🎣 *VARAS DE PESCA*\n\n_A melhor vara disponível no seu inventário é usada automaticamente nas pescarias._\n\n`;

    // 2. Loop seguro pelas varas configuradas
    for (const [key, vara] of listaVaras) {
      if (!vara) continue;
      
      texto +=
        `${vara.nome}\n` +
        `   💵 Preço: *${vara.preco ?? 0} Gold*\n` +
        `   📈 Bônus raridade: *+${vara.bonus_raridade ?? 0}*\n` +
        `   🎯 Reduz falha: *-${vara.reduce_falha ?? 0}%*\n` +
        `   🛒 \`!comprar ${key}\`\n\n`;
    }

    texto +=
      `━━━━━━━━━━━━━━━━\n` +
      `🪱 Ver iscas disponíveis: *!iscas*\n` +
      `🎣 Pescar agora: *!pescar*`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleVaras:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno ao carregar o menu de varas!');
  }
}

// ─── !iscas ───────────────────────────────────────────────────────────────────

async function handleIscas(sock, msg, jid) {
  try {
    // 1. Validação preventiva para o caso do objeto ISCAS não estar definido globalmente
    const listaIscas = Object.entries(ISCAS ?? {});
    
    if (listaIscas.length === 0) {
      return reply(sock, jid, msg, '⚠️ Nenhuma isca cadastrada na loja no momento.');
    }

    let texto = `🪱 *ISCAS DE PESCA*\n\n_A melhor isca disponível no seu inventário é usada automaticamente (1 por tentativa)._\n\n`;

    // 2. Loop seguro pelas iscas configuradas
    for (const [key, isca] of listaIscas) {
      if (!isca) continue;
      
      texto +=
        `${isca.nome}\n` +
        `   💵 Preço: *${isca.preco ?? 0} Gold*\n` +
        `   📈 Bônus raridade: *+${isca.bonus_raridade ?? 0}*\n` +
        `   🎯 Reduz falha: *-${isca.reduce_falha ?? 0}%*\n` +
        `   🛒 \`!comprar ${key}\`\n\n`;
    }

    texto +=
      `━━━━━━━━━━━━━━━━\n` +
      `💡 _A isca é consumida a cada pesca executada!_\n` +
      `🎣 Ver varas disponíveis: *!varas*`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleIscas:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno ao carregar o menu de iscas!');
  }
}

// ─── !inventariopesca ─────────────────────────────────────────────────────────

async function handleInventarioPesca(sock, msg, jid) {
  // 1. Garante a resolução correta do contexto do grupo e usuário
  const ctx = await resolverContexto(msg);
  if (!ctx) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu contexto.');
  const { userId, groupId } = ctx;

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg, '🎣 O inventário de pesca é por grupo!\nUse este comando em um grupo.');
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    const semItens =
      `🎣 *SEU INVENTÁRIO DE PESCA ESTÁ VAZIO*\n\n` +
      `Compre uma vara: *!varas*\n` +
      `Compre uma isca: *!iscas*\n` +
      `Então use: *!pescar*`;

    if (!carteira) return reply(sock, jid, msg, semItens);

    // Suporte a Map Mongoose e objeto plano estruturado
    const invRaw = carteira.itensPesca;
    const inv    = invRaw instanceof Map ? Object.fromEntries(invRaw) : (invRaw ?? {});

    const chaves = Object.keys(inv).filter(k => (inv[k] ?? 0) > 0);
    if (chaves.length === 0) return reply(sock, jid, msg, semItens);

    // Filtros por categoria com verificação opcional segura
    const varas    = chaves.filter(k => VARAS_PESCA?.[k]);
    const iscas    = chaves.filter(k => ISCAS?.[k]);
    const pescados = chaves.filter(k => !VARAS_PESCA?.[k] && !ISCAS?.[k]);

    let texto = `🎣 *INVENTÁRIO DE PESCA* _(neste grupo)_\n\n`;

    // 2. Seção de varas de pesca
    if (varas.length > 0) {
      const melhorVara = typeof selecionarMelhorVara === 'function' ? selecionarMelhorVara(carteira) : null;
      texto += `🪝 *VARAS*\n`;
      for (const k of varas) {
        const infoVara = VARAS_PESCA?.[k];
        if (!infoVara) continue;
        const ativa = k === melhorVara ? ' ✅ _(ativa)_' : '';
        texto += `   ${infoVara.nome} × ${inv[k]}${ativa}\n`;
      }
      texto += '\n';
    }

    // 3. Seção de iscas de pesca
    if (iscas.length > 0) {
      const melhorIsca = typeof selecionarMelhorIsca === 'function' ? selecionarMelhorIsca(carteira) : null;
      texto += `🪱 *ISCAS*\n`;
      for (const k of iscas) {
        const infoIsca = ISCAS?.[k];
        if (!infoIsca) continue;
        const ativa = k === melhorIsca ? ' ✅ _(próxima)_' : '';
        texto += `   ${infoIsca.nome} × ${inv[k]}${ativa}\n`;
      }
      texto += '\n';
    }

    // 4. Seção de peixes e lixos coletados
    if (pescados.length > 0) {
      texto += `📦 *ITENS PESCADOS*\n`;
      const taxaVenda = CONFIG_PESCA?.PERCENTUAL_VENDA ?? 0.7; // Padrão de 70% caso ausente nas configs
      
      for (const k of pescados) {
        const info       = CATALOGO_PESCA?.[k];
        const nome       = info?.nome ?? k;
        const goldBase   = info?.gold ?? 0;
        const precoVenda = goldBase > 0 ? Math.floor(goldBase * taxaVenda) : null;
        
        const vendaLabel = precoVenda
          ? ` _(venda: ${precoVenda}g → !venderpesca ${k})_`
          : ` _(sem valor de mercado)_`;
          
        texto += `   ${nome} × ${inv[k]}${vendaLabel}\n`;
      }
    }

    // 5. Cálculo e formatação do cooldown de pesca
    const agora       = Date.now();
    const ultimaPesca = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const tempoLimite = CONFIG_PESCA?.COOLDOWN_MS ?? 600000; // Padrão de 10 minutos em milissegundos
    const msRestante  = Math.max(0, tempoLimite - (agora - ultimaPesca));
    
    const cooldownStr = msRestante > 0
      ? `⏳ Próxima pesca em *${typeof formatarTempo === 'function' ? formatarTempo(msRestante) : msRestante + 'ms'}*`
      : `✅ *Pronto para pescar!*`;

    texto +=
      `\n💰 Gold neste grupo: *${carteira.gold ?? 0}*\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `${cooldownStr}\n\n` +
      `🎣 *!pescar* · 💵 *!venderpesca <item> [qtd]* · 📊 *!statspesca*`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleInventarioPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno ao carregar seu inventário de pesca!');
  }
}

// ─── !sellpesca ──────────────────────────────────────────────────────────────

/**
 * !sellpesca <item> [quantidade]
 * Vende itens pescados por CONFIG_PESCA.PERCENTUAL_VENDA do valor base.
 * Varas e iscas não podem ser vendidas por este comando.
 */
async function handleVenderPesca(sock, msg, jid, caption) {
  // 1. Garante que o contexto seja resolvido corretamente antes de prosseguir
  const ctx = await resolverContexto(msg);
  if (!ctx) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu contexto.');
  const { userId, groupId } = ctx;

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Venda de pesca só funciona em grupos!');
  }

  // Tratamento dos argumentos da mensagem
  const partes  = (caption ?? '').trim().split(/\s+/);
  const itemKey = partes[0]?.toLowerCase() || null;
  const qtd     = Math.max(1, parseInt(partes[1] ?? '1', 10) || 1);

  if (!itemKey) {
    return reply(sock, jid, msg,
      `💵 *VENDER ITEM DE PESCA*\n\n` +
      `Uso: *!sellpesca <item> [quantidade]*\n` +
      `Exemplo: *!sellpesca peixe_pequeno 5*\n\n` +
      `📦 Ver seus itens: *!inventariopesca*`
    );
  }

  // Varas e iscas não são vendáveis por aqui
  if ((typeof VARAS_PESCA !== 'undefined' && VARAS_PESCA[itemKey]) || 
      (typeof ISCAS !== 'undefined' && ISCAS[itemKey])) {
    return reply(sock, jid, msg,
      `⚠️ *${itemKey}* é um equipamento de pesca e não pode ser vendido por aqui.\n\n` +
      `_Use a loja do grupo para negociar ou melhorar seus equipamentos._`
    );
  }

  const info = typeof CATALOGO_PESCA !== 'undefined' ? CATALOGO_PESCA[itemKey] : null;
  if (!info) {
    return reply(sock, jid, msg,
      `⚠️ Item *${itemKey}* não encontrado no catálogo de pesca.\n\n` +
      `📦 Veja seus itens usando: *!inventariopesca*`
    );
  }

  if ((info.gold ?? 0) === 0) {
    return reply(sock, jid, msg,
      `🗑️ *${info.nome}* não tem valor comercial (é lixo de rio).\n\n` +
      `_Use para crafting ou guarde de recordação._`
    );
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    // Suporte a instâncias do Map Mongoose ou objetos planos normais
    const invRaw     = carteira?.itensPesca;
    const inv        = invRaw instanceof Map ? Object.fromEntries(invRaw) : (invRaw ?? {});
    const disponivel = inv[itemKey] ?? 0;

    if (disponivel <= 0) {
      return reply(sock, jid, msg,
        `⚠️ Você não possui *${info.nome}* no seu inventário deste grupo.\n\n` +
        `📦 Digite *!inventariopesca* para verificar seus itens.`
      );
    }

    const qtdVender     = Math.min(qtd, disponivel);
    const taxaVenda     = CONFIG_PESCA?.PERCENTUAL_VENDA ?? 0.7; // Fallback de 70% se não configurado
    const precoUnitario = Math.floor(info.gold * taxaVenda);
    const totalGold     = precoUnitario * qtdVender;

    // 2. SEGURANÇA MÁXIMA ANTI-DUP: 
    // Só atualiza se o usuário ainda tiver a quantidade informada no exato momento da transação
    const operacaoMochila = await CarteiraGrupo.findOneAndUpdate(
      { 
        idWhatsApp: userId, 
        idGrupo: groupId, 
        [`itensPesca.${itemKey}`]: { $gte: qtdVender } 
      },
      { $inc: { [`itensPesca.${itemKey}`]: -qtdVender } },
      { new: true } // Retorna os dados já atualizados
    );

    if (!operacaoMochila) {
      return reply(sock, jid, msg, '⚠️ Falha de sincronia na mochila. Você tentou vender mais itens do que possui!');
    }

    // 3. Credita o valor gerado na conta do usuário
    if (typeof alterarGold === 'function') {
      await alterarGold(userId, groupId, totalGold, `Venda pesca: ${info.nome} ×${qtdVender}`);
    } else {
      await CarteiraGrupo.updateOne(
        { idWhatsApp: userId, idGrupo: groupId },
        { $inc: { gold: totalGold } }
      );
    }

    // Busca o saldo final consolidado do grupo
    const carteiraFinal = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .select('gold')
      .lean();

    return reply(sock, jid, msg,
      `💵 *VENDA REALIZADA COM SUCESSO!*\n\n` +
      `📦 Item: *${info.nome}*\n` +
      `🔢 Quantidade vendida: *${qtdVender}×*\n` +
      `💰 Valor unitário: *${precoUnitario} Gold* (${Math.round(taxaVenda * 100)}% do valor base)\n` +
      `🏆 Total recebido: *+${totalGold} Gold* 💰\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📦 Restante no inventário: *${disponivel - qtdVender}×*\n` +
      `💰 Saldo atual no grupo: *${carteiraFinal?.gold ?? 0} Gold*`
    );

  } catch (err) {
    console.error('[Pesca] handleVenderPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno do sistema ao processar a venda! Tente novamente.');
  }
}

// ─── !rankingpesca ────────────────────────────────────────────────────────────

async function handleRankingPesca(sock, msg, jid, contactNames) {
  // 1. Correção preventiva: adicionado await caso o resolverContexto seja assíncrono
  const ctx = await resolverContexto(msg);
  if (!ctx) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu contexto.');
  const { groupId } = ctx;

  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Ranking de pesca só funciona em grupos!');
  }

  try {
    // 2. Coleta os membros que pertencem ao grupo neste exato momento
    const metadata = await sock.groupMetadata(jid);
    const membrosAtuais = new Set(metadata.participants.map(p => p.id));

    // 3. Busca os registros locais do grupo no banco de dados
    const carteiras = await CarteiraGrupo
      .find({ idGrupo: groupId })
      .lean();

    // 4. Mapeia e filtra mantendo apenas os usuários ativos com pontuação válida
    const candidatos = carteiras
      .map(c => {
        const inv   = c.itensPesca ?? {};
        const total = Object.entries(inv)
          .filter(([k]) => !VARAS_PESCA?.[k] && !ISCAS?.[k])
          .reduce((acc, [, v]) => acc + (v ?? 0), 0);
        return { idWhatsApp: c.idWhatsApp, total, gold: c.gold ?? 0 };
      })
      .filter(s => s.total > 0 && membrosAtuais.has(s.idWhatsApp)); // Remove inativos/banidos

    // Organiza por pontuação decrescente e extrai o Top 10 real
    const scores = candidatos
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (scores.length === 0) {
      return reply(sock, jid, msg,
        `🎣 *RANKING DE PESCA*\n\n` +
        `Nenhum membro ativo pescou nada neste grupo ainda!\n\n` +
        `Seja o primeiro usando: *!pescar*`
      );
    }

    // Alinhamento visual unificado usando o padrão de medalhas dos outros rankings
    const medalhas = ['🥇', '🥈', '🥉', '🔹 4.', '🔹 5.', '🔹 6.', '🔹 7.', '🔹 8.', '🔹 9.', '🔹 10.'];
    const maxTotal = scores[0].total || 1;
    const totalGeralGrupo = scores.reduce((a, x) => a + x.total, 0);

    let texto = `🎣 *RANKING DE PESCA — MEMBROS ATIVOS* 🎣\n\n`;

    scores.forEach((s, i) => {
      const numero  = s.idWhatsApp.split('@')[0].split(':')[0];
      const medalha = medalhas[i] ?? `🔹 *${i + 1}.*`;
      
      // Cálculo preciso de porcentagem e renderização da barra de progresso
      const pct = totalGeralGrupo > 0 ? ((s.total / totalGeralGrupo) * 100).toFixed(1) : '0.0';
      const tamanhoBarra = Math.min(Math.round((s.total / maxTotal) * 10), 10);
      const bar = '█'.repeat(tamanhoBarra) + '░'.repeat(10 - tamanhoBarra);

      texto +=
        `${medalha} *@${numero}*\n` +
        `   ${bar} ${s.total} 🐟 (${pct}%)\n` +
        `   💰 ${s.gold} Gold\n\n`;
    });

    const mentions = scores.map(s => s.idWhatsApp);

    texto +=
      `━━━━━━━━━━━━━━━━\n` +
      `🐟 Total pescado no Top 10: *${totalGeralGrupo} itens*\n` +
      `🎣 Use *!pescar* para subir no ranking!`;

    await sock.sendMessage(jid, {
      text: texto,
      mentions,
    }, { quoted: msg });

  } catch (err) {
    console.error('[Pesca] handleRankingPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno ao carregar o ranking de pesca. Tente novamente!');
  }
}

// ─── !statspesca ─────────────────────────────────────────────────────────────

/**
 * Mostra equipamento atual, cooldown restante, chance de falha e bônus de raridade.
 */
async function handleStatsPesca(sock, msg, jid) {
  // 1. Correção preventiva: adicionado await caso o resolverContexto seja assíncrono
  const ctx = await resolverContexto(msg);
  if (!ctx) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu contexto.');
  const { userId, groupId } = ctx;

  if (!userId) return reply(sock, jid, msg, '⚠️ Não foi possível identificar seu usuário.');
  if (!groupId) {
    return reply(sock, jid, msg, '🎣 Stats de pesca só funcionam em grupos!');
  }

  try {
    const carteira = await CarteiraGrupo
      .findOne({ idWhatsApp: userId, idGrupo: groupId })
      .lean();

    if (!carteira) {
      return reply(sock, jid, msg,
        `🎣 *STATS DE PESCA*\n\nVocê ainda não tem uma carteira neste grupo.\n\n` +
        `Compre uma vara usando: *!varas*`
      );
    }

    const varaKey = selecionarMelhorVara(carteira);
    const iscaKey = selecionarMelhorIsca(carteira);

    const varaNome  = varaKey && VARAS_PESCA?.[varaKey] ? VARAS_PESCA[varaKey].nome : '_Nenhuma_';
    const iscaNome  = iscaKey && ISCAS?.[iscaKey]       ? ISCAS[iscaKey].nome       : '_Nenhuma_';

    const chanceFalha   = typeof calcularChanceFalha === 'function' ? calcularChanceFalha(varaKey, iscaKey) : 0;
    const bonusRaridade = typeof calcularBonusRaridade === 'function' ? calcularBonusRaridade(varaKey, iscaKey) : 0;
    const chanceAcerto  = Math.max(0, 100 - chanceFalha);

    // 2. Cooldown restante com fallbacks de segurança
    const agora       = Date.now();
    const ultimaPesca = carteira.ultimaPesca ? new Date(carteira.ultimaPesca).getTime() : 0;
    const cooldownMs  = CONFIG_PESCA?.COOLDOWN_MS ?? 600000; // Fallback para 10 minutos se indefinido
    const msRestante  = Math.max(0, cooldownMs - (agora - ultimaPesca));
    
    const cooldownStr = msRestante > 0 
      ? `⏳ *${typeof formatarTempo === 'function' ? formatarTempo(msRestante) : msRestante}* restantes` 
      : `✅ *Pronto para pescar!*`;

    // 3. Normalização e cálculo seguro da distribuição de raridades
    const mult = {
      comum:    Math.max(0.1, 1 - bonusRaridade * 0.015),
      incomum:  Math.max(0.1, 1 + bonusRaridade * 0.01),
      raro:     Math.max(0.1, 1 + bonusRaridade * 0.03),
      epico:    Math.max(0.1, 1 + bonusRaridade * 0.05),
      lendario: Math.max(0.1, 1 + bonusRaridade * 0.08),
    };

    const pesoBase = { comum: 47, incomum: 20, raro: 9, epico: 3.5, lendario: 1 };
    const pesoAdj  = Object.fromEntries(
      Object.entries(pesoBase).map(([r, p]) => [r, p * (mult[r] ?? 1)])
    );
    
    const totalPeso = Object.values(pesoAdj).reduce((a, b) => a + b, 0) || 1;
    const chances   = Object.fromEntries(
      Object.entries(pesoAdj).map(([r, p]) => [r, ((p / totalPeso) * 100).toFixed(1)])
    );

    // 4. Montagem do menu visual estruturado
    const texto =
      `🎣 *STATS DE PESCA* _(neste grupo)_\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `*EQUIPAMENTO ATIVO:*\n` +
      `  🪝 Vara: *${varaNome}*\n` +
      `  🪱 Isca: *${iscaNome}*\n\n` +
      `*COOLDOWN:*\n` +
      `  ${cooldownStr}\n\n` +
      `*CHANCES (se pescar agora):*\n` +
      `  ✅ Acerto: *${chanceAcerto}%* | ❌ Falha: *${chanceFalha}%*\n\n` +
      `*DISTRIBUIÇÃO DE RARIDADE:*\n` +
      `  ⚪ Comum:    *${chances.comum}%*\n` +
      `  🟢 Incomum:  *${chances.incomum}%*\n` +
      `  🔵 Raro:     *${chances.raro}%*\n` +
      `  🟣 Épico:    *${chances.epico}%*\n` +
      `  🟡 Lendário: *${chances.lendario}%*\n\n` +
      `  📈 Bônus raridade total: *+${bonusRaridade}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📦 *!inventariopesca* · 🎣 *!pescar*`;

    return reply(sock, jid, msg, texto);

  } catch (err) {
    console.error('[Pesca] handleStatsPesca:', err);
    return reply(sock, jid, msg, '⚠️ Erro interno ao carregar seus dados de pesca!');
  }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

module.exports = {
  handlePescar,
  handleVaras,
  handleIscas,
  handleInventarioPesca,
  handleVenderPesca,
  handleRankingPesca,
  handleStatsPesca,

  // Catálogos (usados pelo marketplace.js)
  VARAS_PESCA,
  ISCAS,
  CATALOGO_PESCA,
  PEIXES_E_ITENS,
};