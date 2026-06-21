'use strict';

const path = require('path');
require('dotenv').config();

// ─── MongoDB Model ────────────────────────────────────────────────────────────
const CarteiraGrupoModel = require(path.join(__dirname, '..', 'models', 'CarteiraGrupo'));

// ─── Firebase Firestore (SDK v9+ Modular) ────────────────────────────────────
const { db } = require(path.join(__dirname, '..', '..', 'firebaseConfig'));
const { doc, setDoc } = require('firebase/firestore');

// ─── Utilitário ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Descobre o nome real dos grupos via Baileys e sincroniza:
 *  - MongoDB  → campo `nome` em CarteiraGrupo (updateMany por idGrupo)
 *  - Firestore → coleção `configuracoes_grupo`, documento com ID = JID do grupo
 *
 * @param {Object} sock - Instância ativa do Baileys
 */
async function rodarAtualizacao(sock) {
  if (!sock) {
    console.error('❌ [rodarAtualizacao] Instância do sock não fornecida.');
    return;
  }

  console.log('━'.repeat(60));
  console.log('🔄 Iniciando sincronização de nomes de grupos...');
  console.log('━'.repeat(60));

  // ── 1. Busca JIDs únicos com nome ausente ou genérico no MongoDB ────────────
  let jidsPendentes;
  try {
    jidsPendentes = await CarteiraGrupoModel.distinct('idGrupo', {
      $or: [
        { nome: { $exists: false } },
        { nome: null },
        { nome: '' },
        { nome: /^Grupo /i },
      ],
    });
  } catch (err) {
    console.error('💥 Erro ao consultar o MongoDB:', err.message);
    return;
  }

  const total = jidsPendentes.length;

  if (total === 0) {
    console.log('✅ Nenhum grupo pendente. Todos os nomes já estão atualizados.');
    console.log('━'.repeat(60));
    return;
  }

  console.log(`📦 ${total} grupo(s) pendente(s) encontrado(s).\n`);

  let atualizados = 0;
  let falhas      = 0;

  // ── 2. Itera sobre cada JID pendente ───────────────────────────────────────
  for (let i = 0; i < jidsPendentes.length; i++) {
    const jid     = jidsPendentes[i];
    const prefixo = `[${i + 1}/${total}]`;

    // Validação básica do JID
    if (!jid || !jid.endsWith('@g.us')) {
      console.warn(`${prefixo} ⚠️  JID inválido ignorado: "${jid}"`);
      falhas++;
      continue;
    }

    try {
      // ── 3. Busca metadados em tempo real no WhatsApp ──────────────────────
      const metadata = await sock.groupMetadata(jid);
      const nomeReal = metadata?.subject?.trim();

      if (!nomeReal) {
        throw new Error('Campo "subject" vazio ou ausente nos metadados.');
      }

      // ── 4a. Atualiza o MongoDB ────────────────────────────────────────────
      const resultadoMongo = await CarteiraGrupoModel.updateMany(
        { idGrupo: jid },
        { $set: { nome: nomeReal } }
      );

      // ── 4b. Atualiza o Firestore ──────────────────────────────────────────
      const docRef = doc(db, 'configuracoes_grupo', jid);
      await setDoc(
        docRef,
        {
          idGrupo   : jid,
          nomeGrupo : nomeReal,
          updatedAt : new Date(),
        },
        { merge: true }
      );

      atualizados++;
      console.log(
        `${prefixo} ✅ "${nomeReal}"\n` +
        `         MongoDB   → ${resultadoMongo.modifiedCount} registro(s) atualizado(s)\n` +
        `         Firestore → configuracoes_grupo/${jid}`
      );

    } catch (err) {
      falhas++;
      console.error(`${prefixo} ❌ Ignorado (${jid}): ${err.message}`);
    }

    // Delay anti-flood entre chamadas ao WhatsApp (1.2s)
    await sleep(1200);
  }

  // ── 5. Relatório Final ─────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(60));
  console.log('📊 SINCRONIZAÇÃO CONCLUÍDA');
  console.log('━'.repeat(60));
  console.log(`   ✅ Atualizados com sucesso : ${atualizados}`);
  console.log(`   ❌ Falhas / sem acesso     : ${falhas}`);
  console.log('━'.repeat(60) + '\n');
}

module.exports = { rodarAtualizacao };