'use strict';

const mongoose = require('mongoose');
const { db }   = require('../../firebaseConfig.js');
require('dotenv').config();

const pkg = require('../models/Usuario.js');
const Usuario = pkg.Usuario ?? pkg;

function limparJid(jid = '') {
  return jid.split(':')[0].trim();
}

function numeroDe(jid = '') {
  return jid.split('@')[0].replace(/\D/g, '');
}

async function migrar() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('✅ MongoDB conectado.');

  const usuarios = await Usuario.find({});
  const total = usuarios.length;
  console.log('📦 ' + total + ' usuário(s) encontrado(s). Iniciando migração...');

  let migrados = 0;
  let falhas = 0;

  for (const usuario of usuarios) {
    try {
      const jidOriginal = usuario.jid ?? usuario.idWhatsApp ?? '';
      const jidLimpo = limparJid(jidOriginal);
      const numero = numeroDe(jidLimpo);

      if (!numero) {
        console.warn('⚠️ Sem número válido: ' + jidOriginal);
        falhas++;
        continue;
      }

      await db.collection('usuarios').doc(numero).set({
        idWhatsApp: jidLimpo ?? null,
        xp:         usuario.xp ?? 0,
        level:      usuario.level ?? usuario.nivel ?? 1,
        nome:       usuario.nome ?? usuario.pushName ?? null,
        updatedAt:  new Date()
      }, { merge: true });

      migrados++;
      if (migrados % 10 === 0 || migrados === total) {
        console.log('🔄 Migrado ' + migrados + '/' + total + ' usuários...');
      }
    } catch (err) {
      falhas++;
      console.error('❌ Erro:', err.message);
    }
  }

  console.log('\n✅ Concluído! Sucesso: ' + migrados + ' | Falhas: ' + falhas);
  await mongoose.disconnect();
  process.exit(0);
}

migrar().catch(err => {
  console.error('💥 Erro fatal:', err.message);
  process.exit(1);
});