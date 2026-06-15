'use strict';

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

async function listar() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Defina $env:MONGO_URI antes de rodar.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Conectado.');

  const admin = mongoose.connection.db.admin();
  const { databases } = await admin.listDatabases();

  console.log('\n📂 Bancos disponíveis neste cluster:\n');
  for (const db of databases) {
    console.log(`- ${db.name}  (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
  }

  await mongoose.disconnect();
}

listar().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});