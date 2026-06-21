'use strict';

/**
 * mesclar-carteiras.js
 * Script pontual para mesclar carteiras "fantasma" (JIDs duplicados)
 * numa carteira real, preservando todos os dados.
 *
 * USO:
 *   node scripts/mesclar-carteiras.js           ← dry-run (só mostra o que faria, não mexe em nada)
 *   node scripts/mesclar-carteiras.js --executar ← executa de verdade
 *
 * ANTES DE RODAR:
 *   1. Preencha JID_REAL com o JID que aparece no painel do Felipe (ex: 17339652033756@lid)
 *   2. Confirme ID_GRUPO e JIDS_FANTASMA abaixo
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose      = require('mongoose');
const CarteiraGrupo = require('../models/CarteiraGrupo');
const LidMapping    = require('../models/LidMapping');

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

const ID_GRUPO = '120363158061167558@g.us';

// JID real do Felipe — copie do botão "copiar" no painel gold do grupo.
// Provavelmente é um @lid, tipo: 17339652033756@lid
const JID_REAL = '173396520337564@lid';

// Carteiras duplicadas que serão SOMADAS e depois APAGADAS.
const JIDS_FANTASMA = [
  { jid: '5565993354137@s.whatsapp.net', descricao: 'fantasma com 9 (165k gold)'  },
  { jid: '556593354137@s.whatsapp.net',  descricao: 'fantasma sem 9 (2.3k gold)'  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--executar');

function fmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }

function titulo(texto) {
  const linha = '─'.repeat(60);
  console.log(`\n${linha}\n  ${texto}\n${linha}`);
}

function linha(label, valor, cor = '') {
  const RESET = '\x1b[0m', VERDE = '\x1b[32m', AMARELO = '\x1b[33m', VERMELHO = '\x1b[31m', CYAN = '\x1b[36m';
  const cores = { verde: VERDE, amarelo: AMARELO, vermelho: VERMELHO, cyan: CYAN };
  const c = cores[cor] || '';
  console.log(`  ${c}${label.padEnd(22)}${valor}${RESET}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {

  // Validação antecipada da config
  if (JID_REAL === 'COLAR_AQUI_O_JID_DO_FELIPE') {
    console.error('\n❌  Preencha JID_REAL no topo do script antes de rodar.\n');
    process.exit(1);
  }
  if (!ID_GRUPO || JIDS_FANTASMA.length === 0) {
    console.error('\n❌  ID_GRUPO ou JIDS_FANTASMA vazio. Confere a config.\n');
    process.exit(1);
  }

  titulo(DRY_RUN
    ? '🔍  DRY-RUN — nada será alterado no banco'
    : '⚡  EXECUÇÃO REAL — alterações permanentes');

  if (DRY_RUN) {
    console.log('  Para executar de verdade, rode com a flag --executar\n');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('  ✅ MongoDB conectado\n');

  // ── 1. Busca carteira real ──────────────────────────────────────────────────
  const real = await CarteiraGrupo.findOne({ idWhatsApp: JID_REAL, idGrupo: ID_GRUPO });

  if (!real) {
    console.error(`\n❌  Carteira real NÃO ENCONTRADA para JID: ${JID_REAL}`);
    console.error('    Confere se o JID está certo e se é desse grupo.\n');
    process.exit(1);
  }

  titulo('📋  Estado ATUAL da carteira real (Felipe)');
  linha('JID',        real.idWhatsApp, 'cyan');
  linha('Gold',       fmt(real.gold),   'amarelo');
  linha('XP',         fmt(real.xp));
  linha('Mensagens',  fmt(real.mensagens));

  // ── 2. Busca e valida fantasmas ────────────────────────────────────────────
  titulo('👻  Carteiras fantasma encontradas');

  let totalGold = 0, totalXp = 0, totalMensagens = 0;
  const fantasmasEncontradas = [];

  for (const { jid, descricao } of JIDS_FANTASMA) {
    const doc = await CarteiraGrupo.findOne({ idWhatsApp: jid, idGrupo: ID_GRUPO });
    if (!doc) {
      linha(`${jid}`, `(não existe no banco — pulando)`, 'amarelo');
      continue;
    }

    linha(descricao, '');
    linha('  JID',       doc.idWhatsApp, 'cyan');
    linha('  Gold',      fmt(doc.gold),   'amarelo');
    linha('  XP',        fmt(doc.xp));
    linha('  Mensagens', fmt(doc.mensagens));
    console.log();

    totalGold      += doc.gold      || 0;
    totalXp        += doc.xp        || 0;
    totalMensagens += doc.mensagens || 0;
    fantasmasEncontradas.push(doc);
  }

  if (fantasmasEncontradas.length === 0) {
    console.log('  Nenhuma carteira fantasma encontrada. Nada a mesclar.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── 3. Prévia do resultado ─────────────────────────────────────────────────
  titulo('📊  Resultado APÓS a mesclagem (prévia)');
  linha('Gold',      `${fmt(real.gold)}  +  ${fmt(totalGold)}  =  ${fmt((real.gold || 0) + totalGold)}`, 'amarelo');
  linha('XP',        `${fmt(real.xp)}  +  ${fmt(totalXp)}  =  ${fmt((real.xp || 0) + totalXp)}`);
  linha('Mensagens', `${fmt(real.mensagens)}  +  ${fmt(totalMensagens)}  =  ${fmt((real.mensagens || 0) + totalMensagens)}`);
  linha('Deletados', `${fantasmasEncontradas.length} registro(s)`, 'vermelho');

  if (DRY_RUN) {
    console.log('\n  ⚠️  Dry-run concluído. Nada foi alterado.');
    console.log('  Para aplicar, rode: node scripts/mesclar-carteiras.js --executar\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── 4. Execução real ───────────────────────────────────────────────────────
  titulo('🚀  Aplicando mesclagem...');

  // Apaga fantasmas
  for (const doc of fantasmasEncontradas) {
    await CarteiraGrupo.deleteOne({ _id: doc._id });
    console.log(`  🗑️  Deletado: ${doc.idWhatsApp}`);
  }

  // Atualiza real
  real.gold      = (real.gold      || 0) + totalGold;
  real.xp        = (real.xp        || 0) + totalXp;
  real.mensagens = (real.mensagens || 0) + totalMensagens;
  await real.save();

  // Registra LidMapping se JID for @lid (aproveita pra já linkar)
  if (JID_REAL.endsWith('@lid')) {
    // Tenta pegar o PN de alguma fantasma @s.whatsapp.net
    const pnFantasma = JIDS_FANTASMA.find(f => f.jid.endsWith('@s.whatsapp.net'));
    if (pnFantasma) {
      await LidMapping.findOneAndUpdate(
        { lid: JID_REAL },
        { $set: { pn: pnFantasma.jid } },
        { upsert: true }
      );
      console.log(`  🔗  LidMapping salvo: ${JID_REAL} → ${pnFantasma.jid}`);
    }
  }

  titulo('✅  Concluído — carteira do Felipe atualizada');
  linha('Gold final',      fmt(real.gold),       'amarelo');
  linha('XP final',        fmt(real.xp));
  linha('Mensagens final', fmt(real.mensagens));

  await mongoose.disconnect();
  console.log('\n  Conexão encerrada.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Erro inesperado:', err);
  process.exit(1);
});