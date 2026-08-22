'use strict';

const MedievalPersonagem = require('../models/MedievalPersonagem');
const CarteiraGrupo      = require('../models/CarteiraGrupo');
const { ARMADURAS, getArma } = require('../utils/medievalUtils');
const {
  somenteGrupo, getModoAtivo, verificarRecuperacaoDerrota, JANELA_SAQUE_MS,
} = require('./medieval');

// Tempo que o vencedor tem pra responder com os números depois de abrir a lista.
const RESPOSTA_TIMEOUT_MS = 60 * 1000;

// Map<vencedorJid, { idGrupo, perdedorJid, opcoes, criadoEm, emProcessamento }>
const saqueState = new Map();

function limparEstado(vencedorJid) {
  saqueState.delete(vencedorJid);
}

// ── Limpeza periódica de estados esquecidos (vencedor nunca respondeu) ───────
// Sem isso, !saquear sem resposta ficaria pra sempre ocupando memória.
if (!global._saqueCleanupAtivo) {
  global._saqueCleanupAtivo = true;
  setInterval(() => {
    const agora = Date.now();
    for (const [vencedorJid, estado] of saqueState.entries()) {
      if (agora - estado.criadoEm > RESPOSTA_TIMEOUT_MS) saqueState.delete(vencedorJid);
    }
  }, 5 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════
// ─── !saquear @perdedor ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleSaquear(sock, msg, jid, senderJid, targetJid) {
  if (!somenteGrupo(jid)) return;

  try {
    if (!await getModoAtivo(jid)) {
      return sock.sendMessage(jid, { text: '⚔️ O modo medieval não está ativo!' }, { quoted: msg });
    }
    if (!targetJid) {
      return sock.sendMessage(jid, { text: '💰 Marque o jogador que você derrotou!\nExemplo: *!saquear @fulano*' }, { quoted: msg });
    }
    if (targetJid === senderJid) {
      return sock.sendMessage(jid, { text: '😂 Você não pode saquear a si mesmo!' }, { quoted: msg });
    }

    const perdedor = await MedievalPersonagem.findOne({ idWhatsApp: targetJid, idGrupo: jid });
    if (!perdedor) {
      return sock.sendMessage(jid, { text: '❌ Esse jogador não tem personagem medieval.' }, { quoted: msg });
    }

    await verificarRecuperacaoDerrota(perdedor);

    // Qualquer pessoa do grupo pode saquear alguém derrotado, não só quem
    // aplicou o golpe final — a única trava é a janela de 3 minutos.
    if (!perdedor.derrotadoEm) {
      return sock.sendMessage(jid, {
        text: `❌ *@${targetJid.split('@')[0]}* não está derrotado no momento (ou a janela já passou).`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    const passouMs = Date.now() - new Date(perdedor.derrotadoEm).getTime();
    if (passouMs >= JANELA_SAQUE_MS) {
      return sock.sendMessage(jid, {
        text: `⏳ A janela de *3 minutos* pra saquear *@${targetJid.split('@')[0]}* já expirou!`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    // ── Monta a lista numerada do que pode ser levado ─────────────────────────
    const carteiraPerdedor = await CarteiraGrupo.findOne({ idWhatsApp: targetJid, idGrupo: jid }).lean();
    const gold = carteiraPerdedor?.gold || 0;

    const invMap = perdedor.inventarioMedieval instanceof Map
      ? perdedor.inventarioMedieval
      : new Map(Object.entries(perdedor.inventarioMedieval || {}));

    const opcoes = [];
    if (gold > 0) {
      opcoes.push({ tipo: 'gold', valor: gold, label: `💰 ${gold} gold` });
    }

    // ── CORREÇÃO: sem isso, arma/armadura equipada aparecia 2x na lista
    // (uma vez como item do inventário, outra como "equipada"), permitindo
    // levar o mesmo item em dobro. Agora ela aparece só uma vez, com a
    // tag "(equipada)" junto do item do inventário.
    const nomesNoInventario = new Set();
    for (const [chave, qtd] of invMap.entries()) {
      if (qtd <= 0) continue;
      const nome = chave.replace(/_/g, ' ');
      nomesNoInventario.add(nome);
      const tagEquipado = (perdedor.armaEquipada === nome || perdedor.armaduraEquipada === nome)
        ? ' (equipada)' : '';
      opcoes.push({ tipo: 'item', chave, nome, qtd, label: `📦 ${nome} x${qtd}${tagEquipado}` });
    }

    // Fallback defensivo — só entra como opção separada se, por alguma
    // inconsistência de dados, o equipado não tiver entrada no inventário.
    if (perdedor.armaEquipada && !nomesNoInventario.has(perdedor.armaEquipada)) {
      opcoes.push({ tipo: 'arma', nome: perdedor.armaEquipada, label: `⚔️ ${perdedor.armaEquipada} (equipada)` });
    }
    if (perdedor.armaduraEquipada && !nomesNoInventario.has(perdedor.armaduraEquipada)) {
      opcoes.push({ tipo: 'armadura', nome: perdedor.armaduraEquipada, label: `🛡️ ${perdedor.armaduraEquipada} (equipada)` });
    }

    if (!opcoes.length) {
      return sock.sendMessage(jid, {
        text: `💨 *@${targetJid.split('@')[0]}* não tem nada pra saquear agora!`,
        mentions: [targetJid],
      }, { quoted: msg });
    }

    saqueState.set(senderJid, { idGrupo: jid, perdedorJid: targetJid, opcoes, criadoEm: Date.now(), emProcessamento: false });

    const listaTexto = opcoes.map((o, i) => `*${i}* — ${o.label}`).join('\n');

    await sock.sendMessage(jid, {
      text:
        `💰 *SAQUE — @${targetJid.split('@')[0]}* 💰\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${listaTexto}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `_Responda com os números do que quer levar, separados por espaço._\n` +
        `_Exemplo: *0 2 3*_\n\n` +
        `⏳ Você tem *60 segundos* para responder.`,
      mentions: [targetJid],
    }, { quoted: msg });

  } catch (err) {
    console.error('⚠️ Erro em handleSaquear:', err.message);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao iniciar o saque. Tente novamente.' }, { quoted: msg }).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── Resposta ao !saquear (números) ────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleRespostaSaque(sock, msg, jid, senderJid, textoResposta) {
  const estado = saqueState.get(senderJid);
  if (!estado) return false; // nada pendente — outros handlers tratam a mensagem
  if (estado.idGrupo !== jid) return false;

  const limpo = textoResposta.trim();
  if (!/^[\d\s,]+$/.test(limpo)) return false; // não parece resposta de saque — libera pra outros handlers

  // ── CORREÇÃO: trava síncrona contra saque duplicado ───────────────────────
  // O bot processa mensagens em paralelo. Se o vencedor mandar duas respostas
  // quase ao mesmo tempo, as duas podiam cair aqui antes de qualquer uma
  // limpar o estado, executando o saque 2x. Como JS não interrompe código
  // no meio de um trecho síncrono (sem "await"), checar e marcar a flag
  // aqui — antes de qualquer await — garante que só uma passe.
  if (estado.emProcessamento) return true;
  estado.emProcessamento = true;

  try {
    if (Date.now() - estado.criadoEm > RESPOSTA_TIMEOUT_MS) {
      limparEstado(senderJid);
      await sock.sendMessage(jid, { text: '⏳ Tempo pra escolher o saque esgotado. Use *!saquear @alvo* novamente.' }, { quoted: msg });
      return true;
    }

    const indices = [...new Set(limpo.split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n)))];
    const validos = indices.filter(i => i >= 0 && i < estado.opcoes.length);

    if (!validos.length) {
      estado.emProcessamento = false; // libera pra tentar de novo, estado continua vivo
      await sock.sendMessage(jid, { text: '⚠️ Nenhum número válido. Tente de novo (ex: *0 2 3*).' }, { quoted: msg });
      return true;
    }

    if (!await getModoAtivo(jid)) {
      limparEstado(senderJid);
      await sock.sendMessage(jid, { text: '⚔️ O modo medieval foi desativado neste grupo — saque cancelado.' }, { quoted: msg });
      return true;
    }

    // ── Revalida a janela de 3min no momento exato da execução ────────────────
    const perdedorAtual = await MedievalPersonagem.findOne({ idWhatsApp: estado.perdedorJid, idGrupo: jid });
    const aindaValido = perdedorAtual?.derrotadoEm
      && (Date.now() - new Date(perdedorAtual.derrotadoEm).getTime()) < JANELA_SAQUE_MS;

    if (!aindaValido) {
      limparEstado(senderJid);
      await sock.sendMessage(jid, { text: '⏳ A janela de saque expirou antes da sua confirmação. Nada foi levado.' }, { quoted: msg });
      return true;
    }

    const selecionados = validos.map(i => estado.opcoes[i]);
    const resumo = [];
    let manaMaxDelta    = 0;
    let removeuArma     = false;
    let removeuArmadura = false;

    for (const op of selecionados) {
      try {
        if (op.tipo === 'gold') {
          const debitado = await CarteiraGrupo.findOneAndUpdate(
            { idWhatsApp: estado.perdedorJid, idGrupo: jid, gold: { $gte: op.valor } },
            { $inc: { gold: -op.valor } }
          );
          if (!debitado) { resumo.push(`⚠️ Gold — não estava mais disponível`); continue; }

          // ── CORREÇÃO: estorno se o crédito no vencedor falhar ────────────
          try {
            await CarteiraGrupo.findOneAndUpdate(
              { idWhatsApp: senderJid, idGrupo: jid },
              { $inc: { gold: op.valor } },
              { upsert: true }
            );
            resumo.push(`💰 ${op.valor} gold`);
          } catch (errCredito) {
            console.error('⚠️ Erro ao creditar gold saqueado, estornando:', errCredito.message);
            await CarteiraGrupo.findOneAndUpdate(
              { idWhatsApp: estado.perdedorJid, idGrupo: jid },
              { $inc: { gold: op.valor } },
              { upsert: true }
            ).catch(() => {});
            resumo.push(`⚠️ Gold — erro ao transferir, estornado`);
          }
          continue;
        }

        if (op.tipo === 'item') {
          const chaveMap = `inventarioMedieval.${op.chave}`;
          const preDoc = await MedievalPersonagem.findOneAndUpdate(
            { idWhatsApp: estado.perdedorJid, idGrupo: jid, [chaveMap]: { $gte: op.qtd } },
            { $inc: { [chaveMap]: -op.qtd } }
          );
          if (!preDoc) { resumo.push(`⚠️ ${op.nome} — não estava mais disponível`); continue; }

          try {
            await MedievalPersonagem.updateOne(
              { idWhatsApp: senderJid, idGrupo: jid },
              { $inc: { [chaveMap]: op.qtd } }
            );
            resumo.push(`📦 ${op.nome} x${op.qtd}`);
          } catch (errCredito) {
            console.error('⚠️ Erro ao creditar item saqueado, estornando:', errCredito.message);
            await MedievalPersonagem.updateOne(
              { idWhatsApp: estado.perdedorJid, idGrupo: jid },
              { $inc: { [chaveMap]: op.qtd } }
            ).catch(() => {});
            resumo.push(`⚠️ ${op.nome} — erro ao transferir, estornado`);
            continue;
          }

          // Se o item levado era o equipado e não sobrou nenhuma unidade,
          // desequipa e ajusta a mana máxima do derrotado.
          const eraArma     = perdedorAtual.armaEquipada     === op.nome;
          const eraArmadura = perdedorAtual.armaduraEquipada === op.nome;
          if (eraArma || eraArmadura) {
            const invPreMap = preDoc.inventarioMedieval instanceof Map
              ? preDoc.inventarioMedieval
              : new Map(Object.entries(preDoc.inventarioMedieval || {}));
            const qtdAntes    = invPreMap.get(op.chave) || 0;
            const qtdRestante = qtdAntes - op.qtd;

            if (qtdRestante <= 0) {
              if (eraArma) {
                removeuArma = true;
                const armaData = getArma(op.nome);
                if (armaData?.bonusMana) manaMaxDelta -= armaData.bonusMana;
              }
              if (eraArmadura) {
                removeuArmadura = true;
                const armaduraData = ARMADURAS.find(a => a.nome === op.nome);
                if (armaduraData?.bonusMana) manaMaxDelta -= armaduraData.bonusMana;
              }
            }
          }
          continue;
        }

        // ── Fallback: equipado sem entrada no inventário (dado inconsistente)
        if (op.tipo === 'arma' && perdedorAtual.armaEquipada === op.nome) {
          const armaData = getArma(op.nome);
          if (armaData?.bonusMana) manaMaxDelta -= armaData.bonusMana;
          removeuArma = true;
          await MedievalPersonagem.updateOne(
            { idWhatsApp: senderJid, idGrupo: jid },
            { $inc: { [`inventarioMedieval.${op.nome.replace(/ /g, '_')}`]: 1 } }
          );
          resumo.push(`⚔️ ${op.nome} (equipada)`);
        }

        if (op.tipo === 'armadura' && perdedorAtual.armaduraEquipada === op.nome) {
          const armaduraData = ARMADURAS.find(a => a.nome === op.nome);
          if (armaduraData?.bonusMana) manaMaxDelta -= armaduraData.bonusMana;
          removeuArmadura = true;
          await MedievalPersonagem.updateOne(
            { idWhatsApp: senderJid, idGrupo: jid },
            { $inc: { [`inventarioMedieval.${op.nome.replace(/ /g, '_')}`]: 1 } }
          );
          resumo.push(`🛡️ ${op.nome} (equipada)`);
        }
      } catch (errItem) {
        console.error('⚠️ Erro ao processar item de saque:', errItem.message);
        resumo.push(`⚠️ Erro ao processar um dos itens selecionados.`);
      }
    }

    // ── Desequipa do perdedor + ajusta mana máxima ────────────────────────────
    if (removeuArma || removeuArmadura || manaMaxDelta !== 0) {
      const setFields = {};
      if (removeuArma)     setFields.armaEquipada     = null;
      if (removeuArmadura) setFields.armaduraEquipada = null;
      if (manaMaxDelta !== 0) {
        const novoManaMax = Math.max(1, perdedorAtual.manaMax + manaMaxDelta);
        setFields.manaMax  = novoManaMax;
        setFields.mana     = Math.min(perdedorAtual.mana, novoManaMax);
      }
      await MedievalPersonagem.updateOne(
        { idWhatsApp: estado.perdedorJid, idGrupo: jid },
        { $set: setFields }
      ).catch(err => console.error('⚠️ Erro ao desequipar após saque:', err.message));
    }

    // ── Já foi saqueado — limpa o estado de derrota ───────────────────────────
    await MedievalPersonagem.updateOne(
      { idWhatsApp: estado.perdedorJid, idGrupo: jid },
      { $unset: { derrotadoEm: '', derrotadoPor: '' } }
    ).catch(err => console.error('⚠️ Erro ao limpar estado de derrota:', err.message));

    limparEstado(senderJid);

    // ── CORREÇÃO: evita mensagem "Você levou:" com lista vazia ───────────────
    const houveSucesso = resumo.some(r => !r.startsWith('⚠️'));
    if (!houveSucesso) {
      await sock.sendMessage(jid, {
        text: `⚠️ Nada pôde ser saqueado — os itens selecionados não estavam mais disponíveis.`,
      }, { quoted: msg });
      return true;
    }

    await sock.sendMessage(jid, {
      text:
        `✅ *SAQUE REALIZADO!* ✅\n\n` +
        `Você levou de *@${estado.perdedorJid.split('@')[0]}*:\n` +
        resumo.map(r => `  ${r}`).join('\n'),
      mentions: [senderJid, estado.perdedorJid],
    }, { quoted: msg });

    return true;

  } catch (err) {
    console.error('⚠️ Erro em handleRespostaSaque:', err.message);
    limparEstado(senderJid);
    await sock.sendMessage(jid, { text: '⚠️ Erro ao processar o saque. Tente novamente.' }, { quoted: msg }).catch(() => {});
    return true;
  }
}

module.exports = { handleSaquear, handleRespostaSaque, saqueState };