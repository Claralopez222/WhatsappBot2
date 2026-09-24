'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const GrupoConfig        = require('../models/GrupoConfig');
const {
  CLASSES, ELEMENTOS, MISSOES,
  sortearAleatorio, getClasse, getElemento, getArma, getArmadura,
  calcularDano, narrarCombate, xpParaNivel, verificarCooldown,
} = require('../utils/medievalUtils');

// ── Cooldowns (ms) ────────────────────────────────────────────────────────────
const CD_ATAQUE  = 2  * 60 * 1000;
const CD_MAGIA   = 5  * 60 * 1000;
const CD_MISSAO  = 30 * 60 * 1000;
const CD_RECARGA = 10 * 60 * 1000;
const JANELA_SAQUE_MS = 3 * 60 * 1000; // tempo que o derrotado fica vulnerável a saque

// ── Anti-farm agora é persistido no próprio documento do personagem
// (campos ultimoAlvoAtaque/quandoAtacouAlvo e ultimoAlvoMagia/quandoUsouMagiaAlvo).
// Isso sobrevive a restart do bot e funciona corretamente mesmo com múltiplas
// instâncias do processo rodando ao mesmo tempo — o cache em memória não.

// ── Regeneração passiva de HP e mana — roda a cada 1 hora ────────────────────
// Recupera 10% do HP máx e 15% da mana máx para todos os personagens vivos
// $expr garante que só atualiza quem está abaixo do máximo
if (!global._medievalRegenAtivo) {
  global._medievalRegenAtivo = true;
  setInterval(async () => {
    try {
      // Busca apenas grupos com medieval ativo
      const gruposAtivos = await GrupoConfig.find({ medievalAtivo: true }, { idGrupo: 1 }).lean();
      const idsAtivos    = gruposAtivos.map(g => g.idGrupo);
      if (!idsAtivos.length) return;

      await MedievalPersonagem.updateMany(
        {
          idGrupo: { $in: idsAtivos },
          $expr: { $or: [
            { $lt: ['$hp',   '$hpMax']   },
            { $lt: ['$mana', '$manaMax'] },
          ]},
        },
        [{ $set: {
          hp:   { $min: ['$hpMax',   { $add: ['$hp',   { $floor: { $multiply: ['$hpMax',   0.10] } }] }] },
          mana: { $min: ['$manaMax', { $add: ['$mana', { $floor: { $multiply: ['$manaMax', 0.15] } }] }] },
        }}]
      );
    } catch (err) {
      console.error('[Medieval] Erro na regeneração passiva:', err.message);
    }
  }, 60 * 60 * 1000);
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function somenteGrupo(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

async function getModoAtivo(idGrupo) {
  const cfg = await GrupoConfig.findOne({ idGrupo }).lean();
  return cfg?.medievalAtivo === true;
}

/**
 * Remove caracteres de formatação do WhatsApp (evita que o nome quebre o
 * negrito/itálico do resto da mensagem) e limita o tamanho.
 */
function sanitizarNome(nome, fallback) {
  const limpo = (nome || '')
    .replace(/[*_~`]/g, '')
    .trim()
    .slice(0, 30);
  return limpo || fallback;
}

/**
 * Busca ou cria personagem com proteção contra race condition.
 * Se dois !ficha chegarem ao mesmo tempo, o segundo findOne pega o criado pelo primeiro.
 */
async function getOuCriarPersonagem(idWhatsApp, idGrupo, nome) {
  const existente = await MedievalPersonagem.findOne({ idWhatsApp, idGrupo });
  if (existente) return existente;

  const classe   = sortearAleatorio(CLASSES);
  const elemento = sortearAleatorio(ELEMENTOS);

  // Guard defensivo — sortearAleatorio retorna null se lista vazia
  if (!classe || !elemento) throw new Error('Falha ao sortear classe/elemento medieval.');

  try {
    return await MedievalPersonagem.create({
      idWhatsApp,
      idGrupo,
      nome:     sanitizarNome(nome, idWhatsApp.split('@')[0]),
      classe:   classe.nome,
      elemento: elemento.nome,
      nivel:    1,
      xpMedieval: 0,
      hp:       classe.hp,
      hpMax:    classe.hp,
      mana:     classe.mana,
      manaMax:  classe.mana,
      ataque:   classe.ataque,
      defesa:   classe.defesa,
      vitorias: 0,
      derrotas: 0,
    });
  } catch (err) {
    // Erro 11000 = duplicate key — race condition, busca o que foi criado
    if (err.code === 11000) {
      return await MedievalPersonagem.findOne({ idWhatsApp, idGrupo });
    }
    throw err;
  }
}

function gerarBarra(atual, maximo, emoji = '❤️', tamanho = 8) {
  if (!maximo || maximo <= 0) return '░'.repeat(tamanho);
  const filled = Math.min(Math.round((atual / maximo) * tamanho), tamanho);
  return emoji.repeat(filled) + '░'.repeat(tamanho - filled);
}

/**
 * Se o personagem está marcado como derrotado e a janela de saque (3min) já
 * expirou, devolve um HP mínimo (30% do máximo) e limpa o estado de derrota.
 * Se ele já foi curado por outro meio (poção/recarga) antes da janela acabar,
 * só limpa o estado sem mexer no HP.
 *
 * Deve ser chamada sempre que um personagem é buscado do banco antes de ser
 * usado (ataque, magia, ficha, saque) — mesma lógica "lazy" já usada em
 * verificarCooldown, só que pra revivência.
 */
async function verificarRecuperacaoDerrota(p) {
  if (!p?.derrotadoEm) return p;

  const passouMs = Date.now() - new Date(p.derrotadoEm).getTime();
  if (passouMs < JANELA_SAQUE_MS) return p; // ainda dentro da janela de saque

  if (p.hp > 0) {
    await MedievalPersonagem.updateOne(
      { _id: p._id },
      { $unset: { derrotadoEm: '', derrotadoPor: '' } }
    );
  } else {
    const hpMinimo = Math.max(1, Math.floor(p.hpMax * 0.3));
    await MedievalPersonagem.updateOne(
      { _id: p._id },
      { $set: { hp: hpMinimo }, $unset: { derrotadoEm: '', derrotadoPor: '' } }
    );
    p.hp = hpMinimo;
  }
  p.derrotadoEm  = undefined;
  p.derrotadoPor = undefined;
  return p;
}

/**
 * Verifica e aplica level up em loop até não ter mais XP suficiente.
 * Garante que pulos de vários níveis de uma vez sejam aplicados corretamente.
 * Envia UMA única mensagem ao final, mesmo que suba vários níveis de uma vez.
 */
async function verificarLevelUp(sock, jid, senderJid, pAtual = null) {
  let p = pAtual ?? await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean();
  if (!p) return;

  const nivelInicial = p.nivel;
  let totalHp = 0, totalMana = 0, totalAtaque = 0, totalDefesa = 0;

  while (p.xpMedieval >= xpParaNivel(p.nivel + 1)) {
    const novoNivel   = p.nivel + 1;
    const hpBonus     = 15;
    const manaBonus   = 10;
    const ataqueBonus = 2;
    const defesaBonus = 1;

    // Calcula novos valores respeitando o teto ANTES de salvar
    const novoHpMax   = p.hpMax   + hpBonus;
    const novoManaMax = p.manaMax + manaBonus;

    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      {
        $set: {
          nivel:   novoNivel,
          hpMax:   novoHpMax,
          manaMax: novoManaMax,
          hp:      Math.min(p.hp   + hpBonus,   novoHpMax),
          mana:    Math.min(p.mana + manaBonus,  novoManaMax),
        },
        $inc: {
          ataque: ataqueBonus,
          defesa: defesaBonus,
        },
      }
    );

    // Atualiza p localmente para o próximo loop
    p.nivel  += 1;
    p.hpMax  += hpBonus;
    p.hp     += hpBonus;
    p.manaMax += manaBonus;
    p.mana   += manaBonus;
    p.ataque += ataqueBonus;
    p.defesa += defesaBonus;

    totalHp     += hpBonus;
    totalMana   += manaBonus;
    totalAtaque += ataqueBonus;
    totalDefesa += defesaBonus;
  }

  if (p.nivel === nivelInicial) return; // não subiu de nível, nada a enviar

  const textoNivel = (p.nivel - nivelInicial) > 1
    ? `dos Níveis *${nivelInicial}* → *${p.nivel}*`
    : `para o *Nível ${p.nivel}*`;

  await sock.sendMessage(jid, {
    text:
      `⭐🎉 *LEVEL UP!* 🎉⭐\n\n` +
      `*${p.nome}* subiu ${textoNivel}!\n\n` +
      `📈 *Melhorias totais:*\n` +
      `❤️ +${totalHp} HP Máximo\n` +
      `💧 +${totalMana} Mana Máxima\n` +
      `⚔️ +${totalAtaque} Ataque\n` +
      `🛡️ +${totalDefesa} Defesa\n\n` +
      `_Continue batalhando para ficar mais forte!_`,
    mentions: [senderJid],
  });
}

// ═══════════════════════════════════════════════════════════════
// ─── !medieval on/off ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMedievalToggle(sock, msg, jid, args, isAdmin) {
  if (!somenteGrupo(jid)) {
    return sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg });
  }
  if (!isAdmin) {
    return sock.sendMessage(jid, { text: '❌ Apenas admins podem ativar o modo medieval!' }, { quoted: msg });
  }

  try {
    const acao = (args || '').trim().toLowerCase();
    if (!['on', 'off'].includes(acao)) {
      return sock.sendMessage(jid, {
        text: '⚔️ Use *!medieval on* para ativar ou *!medieval off* para desativar.',
      }, { quoted: msg });
    }

    const ativo    = acao === 'on';
    const cfgAtual = await GrupoConfig.findOne({ idGrupo: jid }).lean();
    const jaAtivo  = cfgAtual?.medievalAtivo === true;

    if (ativo && jaAtivo) {
      return sock.sendMessage(jid, {
        text: `⚔️ O modo medieval *já está ativo* neste grupo!\n_Use *!medieval off* para desativar._`,
      }, { quoted: msg });
    }

    if (!ativo && !jaAtivo) {
      return sock.sendMessage(jid, {
        text: `🏰 O modo medieval *já está desativado* neste grupo!\n_Use *!medieval on* para ativar._`,
      }, { quoted: msg });
    }

    await GrupoConfig.findOneAndUpdate(
      { idGrupo: jid },
      { $set: { medievalAtivo: ativo } },
      { upsert: true }
    );

    if (ativo) {
      return sock.sendMessage(jid, {
        text:
          `⚔️🏰 *MODO MEDIEVAL ATIVADO!* 🏰⚔️\n\n` +
          `🗡️ O reino desperta! Guerreiros, magos e heróis — preparem-se para a batalha!\n\n` +
          `📜 *Comandos disponíveis:*\n` +
          `▸ *!ficha* — Ver sua ficha de personagem\n` +
          `▸ *!atacar @alguém* — Atacar um inimigo\n` +
          `▸ *!magia @alguém* — Usar habilidade elemental\n` +
          `▸ *!missaomed* — Embarcar em uma missão\n` +
          `▸ *!recargamana* — Recuperar HP e mana\n` +
          `▸ *!lojamedieval* — Ver loja de armas, armaduras e poções\n` +
        `▸ *!comprar [item]* — Comprar um item\n` +
        `▸ *!equipar [item]* — Equipar arma ou armadura\n` +
        `▸ *!desequipar arma/armadura* — Remover item equipado\n` +
        `▸ *!usarpocao [nome]* — Usar poção do inventário\n` +
        `▸ *!invmed* — Ver seus itens\n` +
        `▸ *!sistemmedieval* — Como funciona o sistema\n\n` +
        `📊 *RANKING E HISTÓRICO*\n` +
        `▸ *!rankmedieval* — Ranking de guerreiros\n` +
          `▸ *!historico* — Suas últimas batalhas\n` +
          `▸ *!menumediev* — Ver todos os comandos\n\n` +
          `_Use *!ficha* para criar seu personagem!_ ⚔️`,
      }, { quoted: msg });
    } else {
      return sock.sendMessage(jid, {
        text: `🏰 *Modo Medieval desativado.*\n_Os guerreiros descansam por ora..._`,
      }, { quoted: msg });
    }
  } catch (err) {
    console.error('⚠️ [Medieval:Toggle] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao alternar o modo medieval. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !ficha ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleFicha(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo! Use *!medieval on*.' }, { quoted: msg });
    }

    const p        = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
    await verificarRecuperacaoDerrota(p);
    const classe   = getClasse(p.classe);
    const elemento = getElemento(p.elemento);
    const arma     = p.armaEquipada     ? getArma(p.armaEquipada)         : null;
    const armadura = p.armaduraEquipada ? getArmadura(p.armaduraEquipada) : null;

    const xpAtual   = p.xpMedieval;
    const xpProx    = xpParaNivel(p.nivel + 1);
    const barraHP   = gerarBarra(p.hp, p.hpMax);
    const barraMana = gerarBarra(p.mana, p.manaMax, '🔵');
    const isNovo    = xpAtual === 0 && p.vitorias === 0;

    await sock.sendMessage(jid, {
      text:
        `${classe?.emoji || '⚔️'} *FICHA DE PERSONAGEM* ${elemento?.emoji || ''}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Nome:* ${p.nome}\n` +
        `🏅 *Classe:* ${p.classe} ${classe?.emoji || ''}\n` +
        `✨ *Elemento:* ${p.elemento} ${elemento?.emoji || ''}\n` +
        `⭐ *Nível:* ${p.nivel}\n` +
        `📊 *XP:* ${xpAtual}/${xpProx}\n\n` +
        `❤️ *HP:* ${p.hp}/${p.hpMax}\n` +
        `${barraHP}\n` +
        `💧 *Mana:* ${p.mana}/${p.manaMax}\n` +
        `${barraMana}\n\n` +
        `⚔️ *Ataque:* ${p.ataque}${arma     ? ` (+${arma.bonusAtaque} ${arma.emoji}) = *${p.ataque + arma.bonusAtaque}*`         : ''}\n` +
        `🛡️ *Defesa:* ${p.defesa}${armadura ? ` (+${armadura.bonusDefesa} ${armadura.emoji}) = *${p.defesa + armadura.bonusDefesa}*` : ''}\n\n` +
        `🗡️ *Arma:* ${arma     ? `${arma.emoji} ${arma.nome}`         : '_Nenhuma equipada_'}\n` +
        `🛡️ *Armadura:* ${armadura ? `${armadura.emoji} ${armadura.nome}` : '_Nenhuma equipada_'}\n\n` +
        `🏆 *Vitórias:* ${p.vitorias} | 💀 *Derrotas:* ${p.derrotas}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        (isNovo
          ? `_✨ Personagem criado! Boa sorte, ${p.classe}!_\n_Use !atacar @alguém para batalhar!_`
          : `_Use !magia para habilidades especiais!_`),
    }, { quoted: msg });
  } catch (err) {
    console.error('⚠️ [Medieval:Ficha] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar sua ficha. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !atacar ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAtacar(sock, msg, jid, senderJid, nomeDisplay, targetJid) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }
    if (!targetJid || targetJid === senderJid) {
      return sock.sendMessage(jid, { text: '⚔️ Marque um inimigo para atacar!\nExemplo: *!atacar @fulano*' }, { quoted: msg });
    }

    // findOne fresco — garante HP e cooldown atualizados mesmo com requests simultâneos
    const atacante = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
    await verificarRecuperacaoDerrota(atacante);

    const { pode, tempoRestante } = verificarCooldown(atacante.ultimoAtaque, CD_ATAQUE);
    if (!pode) {
      return sock.sendMessage(jid, {
        text: `⏳ Você ainda está se recuperando do último ataque!\n_Aguarde *${tempoRestante}* para atacar novamente._`,
      }, { quoted: msg });
    }

    if (atacante.hp <= 0) {
      return sock.sendMessage(jid, {
        text: `💀 Você está caído em batalha! Use *!recargamana* para se recuperar.`,
      }, { quoted: msg });
    }

    const defensor = await MedievalPersonagem.findOne({ idWhatsApp: targetJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(targetJid, jid, targetJid.split('@')[0]);
    await verificarRecuperacaoDerrota(defensor);

    if (defensor.hp <= 0) {
      return sock.sendMessage(jid, {
        text: `💀 *@${targetJid.split('@')[0]}* já está derrotado!`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    // Anti-farm persistente: limita XP contra o mesmo alvo a 1 vez por cooldown de ataque
    const farmBloqueado =
      atacante.ultimoAlvoAtaque === targetJid &&
      atacante.quandoAtacouAlvo &&
      (Date.now() - new Date(atacante.quandoAtacouAlvo).getTime()) < CD_ATAQUE;

    if (farmBloqueado) {
      return sock.sendMessage(jid, {
        text: `⚠️ Você atacou *@${targetJid.split('@')[0]}* recentemente!\n_Aguarde antes de atacar o mesmo alvo novamente._`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    const { dano, critico, multElemento } = calcularDano(atacante, defensor);

    // ── Aplica o dano atomicamente no banco — evita que !atacar e !magia
    // simultâneos no mesmo alvo se sobrescrevam (um "comendo" o dano do outro).
    const defensorAtualizado = await MedievalPersonagem.findOneAndUpdate(
      { idWhatsApp: targetJid, idGrupo: jid },
      [{ $set: { hp: { $max: [0, { $subtract: ['$hp', dano] }] } } }],
      { new: true }
    );
    const novoHp = defensorAtualizado.hp;

    const xpGanho   = critico ? 15 : 10;
    const vitoria   = novoHp <= 0;
    const xpTotal   = vitoria ? xpGanho + 30 : xpGanho;

    // Update único do atacante — inclui o registro de anti-farm persistente
    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      {
        $set: {
          ultimoAtaque: new Date(),
          ultimoAlvoAtaque: targetJid,
          quandoAtacouAlvo: new Date(),
        },
        $inc: { xpMedieval: xpTotal, ...(vitoria && { vitorias: 1 }) },
      }
    );

    const narr      = narrarCombate(atacante, defensor, dano, critico);
    const multTexto = multElemento > 1
      ? '\n🔥 *Vantagem elemental!* +50% de dano!'
      : multElemento < 1
        ? '\n💧 *Desvantagem elemental.* -30% de dano.'
        : '';
    const critTexto = critico ? '\n💥 *CRÍTICO!*' : '';
    const hpTexto   = `\n\n❤️ HP de *@${targetJid.split('@')[0]}*: ${novoHp}/${defensor.hpMax}`;

    let textoFinal = `${narr}${multTexto}${critTexto}${hpTexto}\n+${xpGanho} XP ⭐`;

    if (vitoria) {
      textoFinal +=
        `\n\n💀 *@${targetJid.split('@')[0]} foi derrotado!*\n🏆 *${atacante.nome}* ganhou +30 XP de vitória!` +
        `\n\n💰 Você tem *3 minutos* para saquear os pertences dele!\n_Use *!saquear @${targetJid.split('@')[0]}*._`;
    }

    await sock.sendMessage(jid, {
      text: textoFinal,
      mentions: [senderJid, targetJid],
    }, { quoted: msg });

    // ── Grava histórico + atualiza defensor num write só ─────────────────────
    const entradaAtacante = { tipo: 'ataque', oponente: defensor.nome, dano, resultado: vitoria ? 'vitoria' : 'neutro', critico };
    const entradaDefensor = { tipo: 'defesa', oponente: atacante.nome, dano, resultado: vitoria ? 'derrota' : 'neutro', critico };
    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      { $push: { historicoBatalhas: { $each: [entradaAtacante], $slice: -5 } } }
    );
    await MedievalPersonagem.updateOne(
      { idWhatsApp: targetJid, idGrupo: jid },
      {
        $set:  { ...(vitoria && { derrotadoEm: new Date(), derrotadoPor: senderJid }) },
        $inc:  { ...(vitoria && { derrotas: 1 }) },
        $push: { historicoBatalhas: { $each: [entradaDefensor], $slice: -5 } },
      }
    );

    // Sem passar "atacante": ele é o mesmo objeto buscado no início da função,
    // então xpMedieval ainda está no valor de ANTES do $inc de agora — passar
    // ele faria o level-up ficar sempre um ataque atrasado (mesma correção já
    // aplicada em !magia e !missaomed).
    await verificarLevelUp(sock, jid, senderJid);
  } catch (err) {
    console.error('⚠️ [Medieval:Atacar] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Ocorreu um erro ao atacar. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !magia ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMagia(sock, msg, jid, senderJid, nomeDisplay, targetJid) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }
    if (!targetJid || targetJid === senderJid) {
      return sock.sendMessage(jid, { text: '🔮 Marque um alvo para usar sua magia!\nExemplo: *!magia @fulano*' }, { quoted: msg });
    }

    // findOne fresco — garante mana e cooldown atualizados
    const atacante = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
    await verificarRecuperacaoDerrota(atacante);

    const { pode, tempoRestante } = verificarCooldown(atacante.ultimaMagia, CD_MAGIA);
    if (!pode) {
      return sock.sendMessage(jid, {
        text: `⏳ Sua magia ainda está se recarregando!\n_Aguarde *${tempoRestante}*._`,
      }, { quoted: msg });
    }

    const custMana = 30;
    if (atacante.mana < custMana) {
      return sock.sendMessage(jid, {
        text: `💧 Mana insuficiente! Você tem *${atacante.mana}/${atacante.manaMax}* de mana.\n_Use *!recargamana* para recuperar._`,
      }, { quoted: msg });
    }

    const defensor = await MedievalPersonagem.findOne({ idWhatsApp: targetJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(targetJid, jid, targetJid.split('@')[0]);
    await verificarRecuperacaoDerrota(defensor);
    if (defensor.hp <= 0) {
      return sock.sendMessage(jid, {
        text: `💀 *@${targetJid.split('@')[0]}* já está derrotado!`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    // Anti-farm persistente para magia
    const farmBloqueado =
      atacante.ultimoAlvoMagia === targetJid &&
      atacante.quandoUsouMagiaAlvo &&
      (Date.now() - new Date(atacante.quandoUsouMagiaAlvo).getTime()) < CD_MAGIA;

    if (farmBloqueado) {
      return sock.sendMessage(jid, {
        text: `⚠️ Você usou magia em *@${targetJid.split('@')[0]}* recentemente!\n_Aguarde antes de atacar o mesmo alvo novamente._`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    const elemento   = getElemento(atacante.elemento);
    const habilidade = elemento?.habilidadeUltima || 'Magia Elemental';
    const { dano }   = calcularDano(atacante, defensor, true);

    // ── Mesma correção de !atacar: aplica o dano atomicamente no banco
    const defensorAtualizado = await MedievalPersonagem.findOneAndUpdate(
      { idWhatsApp: targetJid, idGrupo: jid },
      [{ $set: { hp: { $max: [0, { $subtract: ['$hp', dano] }] } } }],
      { new: true }
    );
    const novoHp   = defensorAtualizado.hp;
    const novaMana = atacante.mana - custMana;

    const vitoria = novoHp <= 0;
    const xpTotal = vitoria ? 20 + 40 : 20;

    // Update único do atacante — inclui o registro de anti-farm persistente
    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      {
        $set: {
          ultimaMagia: new Date(),
          mana: novaMana,
          ultimoAlvoMagia: targetJid,
          quandoUsouMagiaAlvo: new Date(),
        },
        $inc: { xpMedieval: xpTotal, ...(vitoria && { vitorias: 1 }) },
      }
    );

    const narr = narrarCombate(atacante, defensor, dano, false, habilidade);
    let textoFinal =
      `${elemento?.emoji || '✨'} *HABILIDADE ESPECIAL!*\n\n` +
      `${narr}\n\n` +
      `❤️ HP de *@${targetJid.split('@')[0]}*: ${novoHp}/${defensor.hpMax}\n` +
      `💧 Sua mana: ${novaMana}/${atacante.manaMax}\n` +
      `+20 XP ⭐`;

    if (vitoria) {
      textoFinal +=
        `\n\n💀 *@${targetJid.split('@')[0]} foi aniquilado pela magia!*\n🏆 +40 XP de vitória!` +
        `\n\n💰 Você tem *3 minutos* para saquear os pertences dele!\n_Use *!saquear @${targetJid.split('@')[0]}*._`;
    }

    await sock.sendMessage(jid, {
      text: textoFinal,
      mentions: [senderJid, targetJid],
    }, { quoted: msg });

    // ── Grava histórico + atualiza defensor num write só ─────────────────────
    const entradaAtacante = { tipo: 'magia', oponente: defensor.nome, dano, resultado: vitoria ? 'vitoria' : 'neutro', critico: false };
    const entradaDefensor = { tipo: 'defesa', oponente: atacante.nome, dano, resultado: vitoria ? 'derrota' : 'neutro', critico: false };
    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      { $push: { historicoBatalhas: { $each: [entradaAtacante], $slice: -5 } } }
    );
    await MedievalPersonagem.updateOne(
      { idWhatsApp: targetJid, idGrupo: jid },
      {
        // Sem "hp: novoHp" aqui — o hp já foi gravado atomicamente lá em cima
        // (findOneAndUpdate com $subtract). Reescrevê-lo agora reabre a mesma
        // race condition que aquele update atômico existe pra evitar: se algo
        // mudou o hp do alvo entre as duas escritas (outro ataque, cura,
        // poção), esse $set apagaria essa mudança.
        $set:  { ...(vitoria && { derrotadoEm: new Date(), derrotadoPor: senderJid }) },
        $inc:  { ...(vitoria && { derrotas: 1 }) },
        $push: { historicoBatalhas: { $each: [entradaDefensor], $slice: -5 } },
      }
    );

    // Sem passar o objeto local: força leitura fresca do banco, já que o
    // $inc de xpMedieval acima não atualiza a variável "atacante" em memória.
    await verificarLevelUp(sock, jid, senderJid);
  } catch (err) {
    console.error('⚠️ [Medieval:Magia] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Ocorreu um erro ao lançar a magia. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}
// ═══════════════════════════════════════════════════════════════
// ─── !missaomed ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMissao(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }

    const p = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
    const { pode, tempoRestante } = verificarCooldown(p.ultimaMissao, CD_MISSAO);
    if (!pode) {
      return sock.sendMessage(jid, {
        text: `⏳ Você ainda está se recuperando da última missão!\n_Próxima missão em: *${tempoRestante}*_`,
      }, { quoted: msg });
    }

    if (p.hp < 20) {
      return sock.sendMessage(jid, {
        text: `💀 Você está muito ferido para missões! HP: *${p.hp}/${p.hpMax}*\n_Use *!recargamana* para recuperar._`,
      }, { quoted: msg });
    }

    // Filtra missões disponíveis para o nível do personagem
    const missoesDisponiveis = MISSOES.filter(m => p.nivel >= m.nivelMinimo);
    if (!missoesDisponiveis.length) {
      return sock.sendMessage(jid, {
        text: `⚠️ Nenhuma missão disponível para o seu nível!\n_Suba de nível para desbloquear missões._`,
      }, { quoted: msg });
    }
    const missao = sortearAleatorio(missoesDisponiveis);
    if (!missao) {
      return sock.sendMessage(jid, { text: '⚠️ Nenhuma missão disponível no momento.' }, { quoted: msg });
    }

    const taxaFracasso = missao.dificuldade === 'lendário' ? 0.65
      : missao.dificuldade === 'difícil' ? 0.45
      : missao.dificuldade === 'médio'   ? 0.30
      : 0.15;
    const sucesso = Math.random() > taxaFracasso;

    await sock.sendMessage(jid, {
      text:
        `${missao.emoji} *MISSÃO: ${missao.titulo}*\n` +
        `⚠️ Dificuldade: *${missao.dificuldade.toUpperCase()}*\n\n` +
        `_${p.nome} parte em busca de glória..._\n` +
        `⏳ _Aguarde o resultado..._`,
    }, { quoted: msg });

    // Delay reduzido: efeito narrativo sem travar o event loop por muito tempo
    await new Promise(r => setTimeout(r, 1200));

    if (sucesso) {
      const xpBonus   = Math.floor(missao.xpReward   * (0.8 + Math.random() * 0.4));
      const goldBonus = Math.floor(missao.goldReward  * (0.8 + Math.random() * 0.4));

      await MedievalPersonagem.updateOne(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $set: { ultimaMissao: new Date() }, $inc: { xpMedieval: xpBonus } }
      );
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $inc: { gold: goldBonus } },
        { upsert: true }
      );

      await sock.sendMessage(jid, {
        text:
          `✅ *MISSÃO CONCLUÍDA!*\n\n` +
          `${missao.emoji} *${missao.titulo}*\n\n` +
          `🏆 *${p.nome}* retornou vitorioso!\n\n` +
          `🎁 *Recompensas:*\n` +
          `⭐ +${xpBonus} XP Medieval\n` +
          `🪙 +${goldBonus} Gold\n\n` +
          `_Próxima missão disponível em 30 minutos._`,
      }, { quoted: msg });

      await verificarLevelUp(sock, jid, senderJid);
    } else {
      const danoTomado = Math.floor(Math.random() * 30) + 10;

      // { new: false } retorna o documento de ANTES do update atômico —
      // como a fórmula é determinística ($max: [5, hp - dano]), calculamos
      // o resultado exato a partir desse snapshot fresco do banco, em vez
      // de usar "p" (que pode estar velho por causa do delay de 1200ms acima).
      const antes = await MedievalPersonagem.findOneAndUpdate(
        { idWhatsApp: senderJid, idGrupo: jid },
        [{
          $set: {
            hp:           { $max: [5, { $subtract: ['$hp', danoTomado] }] },
            xpMedieval:   { $add: ['$xpMedieval', 10] },
            ultimaMissao: new Date(),
          },
        }],
        { new: false }
      );
      const novoHp   = Math.max(5, antes.hp - danoTomado);
      const danoReal = antes.hp - novoHp; // agora exato, calculado do estado real no momento do update

      await sock.sendMessage(jid, {
        text:
          `❌ *MISSÃO FRACASSADA!*\n\n` +
          `${missao.emoji} *${missao.titulo}*\n\n` +
          `💀 *${p.nome}* foi derrotado e recuou!\n` +
          `❤️ HP: ${novoHp}/${p.hpMax} (-${danoReal})\n` +
          `+10 XP pela tentativa ⭐\n\n` +
          `_Recupere-se e tente novamente em 30 minutos._`,
      }, { quoted: msg });

      await verificarLevelUp(sock, jid, senderJid);
    }
  } catch (err) {
    console.error('⚠️ [Medieval:Missao] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar a missão. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !recargamana ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRecargaMana(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }

    const p = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
    const { pode, tempoRestante } = verificarCooldown(p.ultimaRecarga, CD_RECARGA);
    if (!pode) {
      return sock.sendMessage(jid, {
        text: `⏳ Você ainda está meditando!\n_Próxima recarga em: *${tempoRestante}*_`,
      }, { quoted: msg });
    }

    // { new: false } retorna o documento de ANTES do update atômico — usamos
    // esse snapshot fresco (em vez de "p") para calcular hpGanho com exatidão,
    // e também para saber se a cura tirou o personagem do estado de derrota.
    const antes = await MedievalPersonagem.findOneAndUpdate(
      { idWhatsApp: senderJid, idGrupo: jid },
      [{
        $set: {
          hp:            { $min: ['$hpMax', { $add: ['$hp', { $floor: { $multiply: ['$hpMax', 0.6] } }] }] },
          mana:          '$manaMax',
          ultimaRecarga: new Date(),
        },
      }],
      { new: false }
    );

    const hpGanhoCalc = Math.floor(antes.hpMax * 0.6);
    const novoHp       = Math.min(antes.hpMax, antes.hp + hpGanhoCalc);
    const hpGanho       = novoHp - antes.hp; // exato agora
    const novaMana      = antes.manaMax;

    // Se a recarga trouxe o HP de volta acima de 0 e o personagem estava
    // marcado como derrotado, limpa o estado de derrota (não fica mais
    // saqueável mesmo dentro da janela de 3 minutos).
    if (novoHp > 0 && antes.derrotadoEm) {
      await MedievalPersonagem.updateOne(
        { idWhatsApp: senderJid, idGrupo: jid },
        { $unset: { derrotadoEm: '', derrotadoPor: '' } }
      );
    }

    // Mensagem diferente se já estava com HP cheio
    const hpTexto = hpGanho > 0
      ? `❤️ HP: ${novoHp}/${antes.hpMax} (+${hpGanho})`
      : `❤️ HP: ${novoHp}/${antes.hpMax} _(já estava cheio)_`;

    await sock.sendMessage(jid, {
      text:
        `🌟 *RECARGA COMPLETA!*\n\n` +
        `✨ *${p.nome}* medita e recupera suas forças!\n\n` +
        `${hpTexto}\n` +
        `💧 Mana: ${novaMana}/${antes.manaMax} _(Completa!)_\n\n` +
        `_Próxima recarga em 10 minutos._`,
    }, { quoted: msg });
  } catch (err) {
    console.error('⚠️ [Medieval:RecargaMana] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao recarregar. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !historico ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleHistorico(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }

    const p = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
      ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);

    if (!p.historicoBatalhas || p.historicoBatalhas.length === 0) {
      return sock.sendMessage(jid, {
        text: `📜 Você ainda não tem batalhas registradas!\nUse *!atacar @alguém* para começar.`,
      }, { quoted: msg });
    }

    const ICONES = { ataque: '⚔️', magia: '🔮', defesa: '🛡️' };
    const RESULT  = { vitoria: '🏆 Vitória', derrota: '💀 Derrota', neutro: '⚡ Combate' };

    const linhas = [...p.historicoBatalhas].reverse().map((b, i) => {
      const icone  = ICONES[b.tipo]  || '⚔️';
      const result = RESULT[b.resultado] || '⚡';
      const crit   = b.critico ? ' _(crítico!)_' : '';
      const data   = new Date(b.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `${i + 1}. ${icone} ${result} vs *${b.oponente}*\n   💥 ${b.dano} de dano${crit} — ${data}`;
    });

    await sock.sendMessage(jid, {
      text:
        `📜 *HISTÓRICO DE BATALHAS — ${p.nome.toUpperCase()}*\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        linhas.join('\n\n') +
        `\n\n━━━━━━━━━━━━━━━━━━━\n` +
        `_Últimas ${p.historicoBatalhas.length} batalhas registradas._`,
    }, { quoted: msg });
  } catch (err) {
    console.error('⚠️ [Medieval:Historico] Erro:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao carregar seu histórico. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  handleMedievalToggle,
  handleFicha,
  handleAtacar,
  handleMagia,
  handleMissao,
  handleRecargaMana,
  handleHistorico,
  // helpers exportados para medievalLoja.js
  getModoAtivo,
  getOuCriarPersonagem,
  somenteGrupo,
  // helpers exportados para medievalSaque.js
  verificarRecuperacaoDerrota,
  JANELA_SAQUE_MS,
};