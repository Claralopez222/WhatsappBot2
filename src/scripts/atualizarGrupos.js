'use strict';

const path = require('path');
require('dotenv').config();

// ─── MongoDB Models ───────────────────────────────────────────────────────────
const CarteiraGrupoModel = require(path.join(__dirname, '..', 'models', 'CarteiraGrupo'));
const GrupoConfigModel   = require(path.join(__dirname, '..', 'models', 'GrupoConfig'));

// ─── Firebase Firestore (SDK v9+ Modular) ────────────────────────────────────
const { db } = require(path.join(__dirname, '..', '..', 'firebaseConfig'));
const { doc, setDoc } = require('firebase/firestore');

// ─── Utilitário ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Descobre os grupos ativos do bot, remove do banco grupos dos quais o bot saiu,
 * e atualiza o nome real dos grupos restantes no MongoDB e Firestore.
 *
 * @param {Object} sock - Instância ativa do Baileys
 */
async function rodarAtualizacao(sock) {
  if (!sock) {
    console.error('❌ [rodarAtualizacao] Instância do sock não fornecida.');
    return;
  }

  console.log('━'.repeat(60));
  console.log('🔄 Iniciando sincronização e limpeza de grupos...');
  console.log('━'.repeat(60));

  // ── 1. Remove JIDs inválidos (que não terminam com @g.us) ─────────────────
  try {
    const resInvalidos = await CarteiraGrupoModel.deleteMany({ idGrupo: { $not: /@g\.us$/ } });
    if (resInvalidos.deletedCount > 0) {
      console.log(`🧹 Removidos ${resInvalidos.deletedCount} registro(s) com idGrupo inválido (não @g.us).`);
    }
  } catch (err) {
    console.error('⚠️ Erro ao remover JIDs inválidos:', err.message);
  }

  // ── 2. Busca a lista REAL de grupos em que o bot participa ativamente ──────
  let activeGroupJids = [];
  try {
    const participatingMap = await sock.groupFetchAllParticipating();
    activeGroupJids = Object.keys(participatingMap || {});
    console.log(`📋 O bot está participando ativamente de ${activeGroupJids.length} grupo(s).`);

    // Remove do banco todos os grupos que o bot NÃO faz mais parte
    const delCarteira = await CarteiraGrupoModel.deleteMany({ idGrupo: { $nin: activeGroupJids } });
    const delConfig   = await GrupoConfigModel.deleteMany({ idGrupo: { $nin: activeGroupJids } });

    if (delCarteira.deletedCount > 0) {
      console.log(`🧹 Removidos ${delCarteira.deletedCount} registro(s) de CarteiraGrupo de grupos em que o bot não está mais.`);
    }
    if (delConfig.deletedCount > 0) {
      console.log(`🧹 Removidos ${delConfig.deletedCount} registro(s) de GrupoConfig de grupos em que o bot não está mais.`);
    }
  } catch (err) {
    console.error('⚠️ Erro ao obter lista de grupos ativos do WhatsApp:', err.message);
  }

  // ── 3. Busca JIDs únicos com nome ausente ou genérico no MongoDB ────────────
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

  // ── 4. Itera sobre cada JID pendente ───────────────────────────────────────
  for (let i = 0; i < jidsPendentes.length; i++) {
    const jid     = jidsPendentes[i];
    const prefixo = `[${i + 1}/${total}]`;

    if (!jid || !jid.endsWith('@g.us')) {
      await CarteiraGrupoModel.deleteMany({ idGrupo: jid });
      falhas++;
      continue;
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      const nomeReal = metadata?.subject?.trim();

      if (!nomeReal) {
        throw new Error('Campo "subject" vazio ou ausente nos metadados.');
      }

      // ── 3b. Limpa membros fantasmas (que não estão mais no grupo) ─────────
      const participantesAtuais = metadata?.participants || [];
      if (participantesAtuais.length > 0) {
        const jidsAtivosGrupo = [];
        for (const p of participantesAtuais) {
          const rawNum = p.id.split(':')[0].split('@')[0];
          jidsAtivosGrupo.push(p.id);
          jidsAtivosGrupo.push(`${rawNum}@s.whatsapp.net`);
          jidsAtivosGrupo.push(`${rawNum}@lid`);
        }
        const delFantasmas = await CarteiraGrupoModel.deleteMany({
          idGrupo: jid,
          idWhatsApp: { $nin: jidsAtivosGrupo }
        });
        if (delFantasmas.deletedCount > 0) {
          console.log(`         🧹 Removidos ${delFantasmas.deletedCount} membro(s) fantasma(s) do grupo "${nomeReal}".`);
        }
      }

      const resultadoMongo = await CarteiraGrupoModel.updateMany(
        { idGrupo: jid },
        { $set: { nome: nomeReal } }
      );

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
      if (
        err.message.includes('not-authorized') ||
        err.message.includes('403') ||
        err.message.includes('404') ||
        err.message.includes('PERMISSION_DENIED')
      ) {
        await CarteiraGrupoModel.deleteMany({ idGrupo: jid });
        await GrupoConfigModel.deleteOne({ idGrupo: jid });
        console.log(`         🧹 Grupo ${jid} removido do banco pois o bot não tem mais acesso.`);
      }
    }

    await sleep(1200);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('📊 SINCRONIZAÇÃO E LIMPEZA CONCLUÍDAS');
  console.log('━'.repeat(60));
  console.log(`   ✅ Atualizados com sucesso : ${atualizados}`);
  console.log(`   ❌ Falhas / removidos      : ${falhas}`);
  console.log('━'.repeat(60) + '\n');
}

module.exports = { rodarAtualizacao };