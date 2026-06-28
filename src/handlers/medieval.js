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

// ── Anti-farm cache — limpa entradas expiradas a cada 10 minutos ──────────────
if (!global._medievalFarmCache) global._medievalFarmCache = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [chave, timestamp] of global._medievalFarmCache.entries()) {
    if (agora - timestamp > CD_MAGIA) global._medievalFarmCache.delete(chave);
  }
}, 10 * 60 * 1000);

// ── Helpers internos ──────────────────────────────────────────────────────────

function somenteGrupo(jid) {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

async function getModoAtivo(idGrupo) {
  const cfg = await GrupoConfig.findOne({ idGrupo }).lean();
  return cfg?.medievalAtivo === true;
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
      nome:     nome || idWhatsApp.split('@')[0],
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
      return MedievalPersonagem.findOne({ idWhatsApp, idGrupo });
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
 * Verifica e aplica level up em loop até não ter mais XP suficiente.
 * Garante que pulos de vários níveis de uma vez sejam aplicados corretamente.
 */
async function verificarLevelUp(sock, jid, senderJid) {
  let p = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid }).lean();
  if (!p) return;

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

    await sock.sendMessage(jid, {
      text:
        `⭐🎉 *LEVEL UP!* 🎉⭐\n\n` +
        `*${p.nome}* subiu para o *Nível ${novoNivel}*!\n\n` +
        `📈 *Melhorias:*\n` +
        `❤️ +${hpBonus} HP Máximo\n` +
        `💧 +${manaBonus} Mana Máxima\n` +
        `⚔️ +${ataqueBonus} Ataque\n` +
        `🛡️ +${defesaBonus} Defesa\n\n` +
        `_Continue batalhando para ficar mais forte!_`,
      mentions: [senderJid],
    });
  }
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

  const acao = (args || '').trim().toLowerCase();
  if (!['on', 'off'].includes(acao)) {
    return sock.sendMessage(jid, {
      text: '⚔️ Use *!medieval on* para ativar ou *!medieval off* para desativar.',
    }, { quoted: msg });
  }

  const ativo = acao === 'on';
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
        `▸ *!lojamedieval* — Ver loja de itens\n` +
        `▸ *!comprar [item]* — Comprar um item\n` +
        `▸ *!equipar [item]* — Equipar arma ou armadura\n` +
        `▸ *!desequipar arma/armadura* — Remover item equipado\n` +
        `▸ *!usarpocao [nome]* — Usar poção\n` +
        `▸ *!invmed* — Ver seu inventário\n` +
        `▸ *!rankmedieval* — Ranking de guerreiros\n` +
        `▸ *!menumediev* — Ver todos os comandos\n` +
        `▸ *!sistemmedieval* — Como funciona o sistema\n\n` +
        `_Use *!ficha* para criar seu personagem!_ ⚔️`,
    }, { quoted: msg });
  } else {
    return sock.sendMessage(jid, {
      text: `🏰 *Modo Medieval desativado.*\n_Os guerreiros descansam por ora..._`,
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !ficha ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleFicha(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo! Use *!medieval on*.' }, { quoted: msg });
  }

  const p        = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
    ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);
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
}

// ═══════════════════════════════════════════════════════════════
// ─── !atacar ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAtacar(sock, msg, jid, senderJid, nomeDisplay, targetJid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }
  if (!targetJid || targetJid === senderJid) {
    return sock.sendMessage(jid, { text: '⚔️ Marque um inimigo para atacar!\nExemplo: *!atacar @fulano*' }, { quoted: msg });
  }

  // findOne fresco — garante HP e cooldown atualizados mesmo com requests simultâneos
  const atacante = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
    ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);

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

  if (defensor.hp <= 0) {
    return sock.sendMessage(jid, {
      text: `💀 *@${targetJid.split('@')[0]}* já está derrotado!`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  // Anti-farm: limita XP contra o mesmo alvo a 1 vez por cooldown de ataque
  const chaveAntiFarm = `${senderJid}:${targetJid}`;
  if (!global._medievalFarmCache) global._medievalFarmCache = new Map();
  const ultimoContraEsse = global._medievalFarmCache.get(chaveAntiFarm) || 0;
  const farmBloqueado    = (Date.now() - ultimoContraEsse) < CD_ATAQUE;
  if (farmBloqueado) {
    return sock.sendMessage(jid, {
      text: `⚠️ Você atacou *@${targetJid.split('@')[0]}* recentemente!\n_Aguarde antes de atacar o mesmo alvo novamente._`,
      mentions: [targetJid],
    }, { quoted: msg });
  }
  global._medievalFarmCache.set(chaveAntiFarm, Date.now());

  const { dano, critico, multElemento } = calcularDano(atacante, defensor);
  const novoHp = Math.max(0, defensor.hp - dano);

  await MedievalPersonagem.updateOne(
    { idWhatsApp: targetJid, idGrupo: jid },
    { $set: { hp: novoHp } }
  );

  const xpGanho   = critico ? 15 : 10;
  const vitoria   = novoHp <= 0;
  const xpTotal   = vitoria ? xpGanho + 30 : xpGanho;

  // Update único do atacante — xp do ataque + xp de vitória juntos
  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    {
      $set: { ultimoAtaque: new Date() },
      $inc: { xpMedieval: xpTotal, ...(vitoria && { vitorias: 1 }) },
    }
  );

  if (vitoria) {
    await MedievalPersonagem.updateOne(
      { idWhatsApp: targetJid, idGrupo: jid },
      { $inc: { derrotas: 1 } }
    );
  }

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
    textoFinal += `\n\n💀 *@${targetJid.split('@')[0]} foi derrotado!*\n🏆 *${atacante.nome}* ganhou +30 XP de vitória!`;
  }

  await sock.sendMessage(jid, {
    text: textoFinal,
    mentions: [senderJid, targetJid],
  }, { quoted: msg });

  await verificarLevelUp(sock, jid, senderJid);
}

// ═══════════════════════════════════════════════════════════════
// ─── !magia ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMagia(sock, msg, jid, senderJid, nomeDisplay, targetJid) {
  if (!somenteGrupo(jid)) return;
  if (!await getModoAtivo(jid)) {
    return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
  }
  if (!targetJid || targetJid === senderJid) {
    return sock.sendMessage(jid, { text: '🔮 Marque um alvo para usar sua magia!\nExemplo: *!magia @fulano*' }, { quoted: msg });
  }

  // findOne fresco — garante mana e cooldown atualizados
  const atacante = await MedievalPersonagem.findOne({ idWhatsApp: senderJid, idGrupo: jid })
    ?? await getOuCriarPersonagem(senderJid, jid, nomeDisplay);

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
  if (defensor.hp <= 0) {
    return sock.sendMessage(jid, {
      text: `💀 *@${targetJid.split('@')[0]}* já está derrotado!`,
      mentions: [targetJid],
    }, { quoted: msg });
  }

  // Anti-farm para magia — cache compartilhado com !atacar
  if (!global._medievalFarmCache) global._medievalFarmCache = new Map();
  const chaveAntiFarmMagia  = `${senderJid}:${targetJid}`;
  const ultimoMagia         = global._medievalFarmCache.get(chaveAntiFarmMagia) || 0;
  if ((Date.now() - ultimoMagia) < CD_MAGIA) {
    return sock.sendMessage(jid, {
      text: `⚠️ Você usou magia em *@${targetJid.split('@')[0]}* recentemente!\n_Aguarde antes de atacar o mesmo alvo novamente._`,
      mentions: [targetJid],
    }, { quoted: msg });
  }
  global._medievalFarmCache.set(chaveAntiFarmMagia, Date.now());

  const elemento   = getElemento(atacante.elemento);
  const habilidade = elemento?.habilidadeUltima || 'Magia Elemental';
  const { dano }   = calcularDano(atacante, defensor, true);
  const novoHp     = Math.max(0, defensor.hp - dano);
  const novaMana   = atacante.mana - custMana;

  await MedievalPersonagem.updateOne(
    { idWhatsApp: targetJid, idGrupo: jid },
    { $set: { hp: novoHp } }
  );
  const vitoria = novoHp <= 0;
  const xpTotal = vitoria ? 20 + 40 : 20;

  // Update único do atacante
  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    {
      $set: { ultimaMagia: new Date(), mana: novaMana },
      $inc: { xpMedieval: xpTotal, ...(vitoria && { vitorias: 1 }) },
    }
  );

  if (vitoria) {
    await MedievalPersonagem.updateOne(
      { idWhatsApp: targetJid, idGrupo: jid },
      { $inc: { derrotas: 1 } }
    );
  }

  const narr = narrarCombate(atacante, defensor, dano, false, habilidade);
  let textoFinal =
    `${elemento?.emoji || '✨'} *HABILIDADE ESPECIAL!*\n\n` +
    `${narr}\n\n` +
    `❤️ HP de *@${targetJid.split('@')[0]}*: ${novoHp}/${defensor.hpMax}\n` +
    `💧 Sua mana: ${novaMana}/${atacante.manaMax}\n` +
    `+20 XP ⭐`;

  if (vitoria) {
    textoFinal += `\n\n💀 *@${targetJid.split('@')[0]} foi aniquilado pela magia!*\n🏆 +40 XP de vitória!`;
  }

  await sock.sendMessage(jid, {
    text: textoFinal,
    mentions: [senderJid, targetJid],
  }, { quoted: msg });

  await verificarLevelUp(sock, jid, senderJid);
}

// ═══════════════════════════════════════════════════════════════
// ─── !missaomed ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleMissao(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
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

  const missao = sortearAleatorio(MISSOES);
  // Guard — sortearAleatorio retorna null se MISSOES estiver vazia
  if (!missao) {
    return sock.sendMessage(jid, { text: '⚠️ Nenhuma missão disponível no momento.' }, { quoted: msg });
  }

  const taxaFracasso = missao.dificuldade === 'difícil' ? 0.45
    : missao.dificuldade === 'médio' ? 0.3
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
    const danoTomado  = Math.floor(Math.random() * 30) + 10;
    const novoHp      = Math.max(5, p.hp - danoTomado);
    const danoReal    = p.hp - novoHp; // dano efetivo considerando o teto mínimo de 5

    await MedievalPersonagem.updateOne(
      { idWhatsApp: senderJid, idGrupo: jid },
      { $set: { ultimaMissao: new Date(), hp: novoHp }, $inc: { xpMedieval: 10 } }
    );

    await sock.sendMessage(jid, {
      text:
        `❌ *MISSÃO FRACASSADA!*\n\n` +
        `${missao.emoji} *${missao.titulo}*\n\n` +
        `💀 *${p.nome}* foi derrotado e recuou!\n` +
        `❤️ HP: ${novoHp}/${p.hpMax} (-${danoReal})\n` +
        `+10 XP pela tentativa ⭐\n\n` +
        `_Recupere-se e tente novamente em 30 minutos._`,
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !recargamana ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRecargaMana(sock, msg, jid, senderJid, nomeDisplay) {
  if (!somenteGrupo(jid)) return;
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

  const hpRecupera  = Math.floor(p.hpMax * 0.6);
  const hpAntes     = p.hp;
  const novoHp      = Math.min(p.hpMax, p.hp + hpRecupera);
  const hpGanho     = novoHp - hpAntes;
  const novaMana    = p.manaMax;

  await MedievalPersonagem.updateOne(
    { idWhatsApp: senderJid, idGrupo: jid },
    { $set: { ultimaRecarga: new Date(), hp: novoHp, mana: novaMana } }
  );

  // Mensagem diferente se já estava com HP cheio
  const hpTexto = hpGanho > 0
    ? `❤️ HP: ${novoHp}/${p.hpMax} (+${hpGanho})`
    : `❤️ HP: ${novoHp}/${p.hpMax} _(já estava cheio)_`;

  await sock.sendMessage(jid, {
    text:
      `🌟 *RECARGA COMPLETA!*\n\n` +
      `✨ *${p.nome}* medita e recupera suas forças!\n\n` +
      `${hpTexto}\n` +
      `💧 Mana: ${novaMana}/${p.manaMax} _(Completa!)_\n\n` +
      `_Próxima recarga em 10 minutos._`,
  }, { quoted: msg });
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  handleMedievalToggle,
  handleFicha,
  handleAtacar,
  handleMagia,
  handleMissao,
  handleRecargaMana,
  // helpers exportados para medievalLoja.js
  getModoAtivo,
  getOuCriarPersonagem,
  somenteGrupo,
};