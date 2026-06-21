'use strict';
require('dotenv').config();
const mongoose       = require('mongoose');
const CarteiraGrupo  = require('../models/CarteiraGrupo');

// ⚠️ PREENCHER ANTES DE RODAR:
const ID_GRUPO   = '120363158061167558@g.us'; // grupo "Tropa do..."
const JID_REAL   = 'COLAR_AQUI_O_JID_DO_FELIPE'; // o que tem nome "Felipe", 406 gold
const JIDS_FANTASMA = [
  '5565993354137@s.whatsapp.net', // 165.676 gold
  '556593354137@s.whatsapp.net',  // 2.334 gold
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const real = await CarteiraGrupo.findOne({ idWhatsApp: JID_REAL, idGrupo: ID_GRUPO });
  if (!real) {
    console.error('❌ Carteira real do Felipe não encontrada com esse JID. Confere o JID e tenta de novo.');
    process.exit(1);
  }

  let totalGoldSomado = 0, totalXpSomado = 0, totalMsgsSomado = 0;

  for (const jidFantasma of JIDS_FANTASMA) {
    const fantasma = await CarteiraGrupo.findOne({ idWhatsApp: jidFantasma, idGrupo: ID_GRUPO });
    if (!fantasma) {
      console.log(`(pulando, não existe: ${jidFantasma})`);
      continue;
    }

    console.log(`Mesclando ${jidFantasma} -> gold: ${fantasma.gold}, xp: ${fantasma.xp}, mensagens: ${fantasma.mensagens}`);

    totalGoldSomado += fantasma.gold     || 0;
    totalXpSomado   += fantasma.xp       || 0;
    totalMsgsSomado += fantasma.mensagens || 0;

    await CarteiraGrupo.deleteOne({ _id: fantasma._id });
  }

  real.gold      = (real.gold      || 0) + totalGoldSomado;
  real.xp         = (real.xp        || 0) + totalXpSomado;
  real.mensagens = (real.mensagens || 0) + totalMsgsSomado;
  await real.save();

  console.log(`✅ Concluído. Felipe agora tem: gold=${real.gold}, xp=${real.xp}, mensagens=${real.mensagens}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });