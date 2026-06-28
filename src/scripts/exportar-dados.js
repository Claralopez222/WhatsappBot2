'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const fs            = require('fs');
const mongoose      = require('mongoose');
const path          = require('path');
const Usuario       = require(path.join(__dirname, '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', 'models', 'CarteiraGrupo'));
const Filho         = require(path.join(__dirname, '..', 'models', 'Filho'));
const LidMapping    = require(path.join(__dirname, '..', 'models', 'LidMapping'));

const RESET    = '\x1b[0m';
const VERDE    = '\x1b[32m';
const AMARELO  = '\x1b[33m';
const VERMELHO = '\x1b[31m';
const CYAN     = '\x1b[36m';
const BRANCO   = '\x1b[37m';

const OUTPUT_FILE = path.resolve(__dirname, '..', '..', 'dados.json');

function sep()     { console.log(`${BRANCO}${'─'.repeat(70)}${RESET}`); }
function titulo(t) { sep(); console.log(`  ${AMARELO}${t}${RESET}`); sep(); }
function ok(t)     { console.log(`  ${VERDE}✅ ${t}${RESET}`); }
function info(t)   { console.log(`  ${CYAN}ℹ️  ${t}${RESET}`); }
function erro(t)   { console.log(`  ${VERMELHO}❌ ${t}${RESET}`); }

async function main() {
  titulo('💾  EXPORTAÇÃO LOCAL — dados.json');

  await mongoose.connect(process.env.MONGO_URI);
  ok('MongoDB conectado\n');

  info('Buscando coleções...');

  const [usuarios, carteiras, filhos, lidMappings] = await Promise.all([
    Usuario.find({}).lean(),
    CarteiraGrupo.find({}).lean(),
    Filho.find({}).lean(),
    LidMapping.find({}).lean(),
  ]);

  // Monta mapa lid → telefone para enriquecer os dados
  const lidParaTelefone = {};
  for (const m of lidMappings) {
    if (m.lid && m.pn) lidParaTelefone[m.lid] = m.pn;
  }

  // Enriquece usuários com o telefone real quando disponível
  const usuariosEnriquecidos = usuarios.map(u => ({
    ...u,
    telefone: lidParaTelefone[u.idWhatsApp] ?? u.telefone ?? null,
  }));

  const dados = {
    exportadoEm: new Date().toISOString(),
    totais: {
      usuarios:    usuarios.length,
      carteiras:   carteiras.length,
      filhos:      filhos.length,
      lidMappings: lidMappings.length,
    },
    usuarios: usuariosEnriquecidos,
    carteiras,
    filhos,
    lidMappings,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dados, null, 2), 'utf8');

  const tamanhoKb = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);

  titulo('📊  RESUMO DA EXPORTAÇÃO');
  const comTelefone = usuariosEnriquecidos.filter(u => u.telefone).length;

  ok(`Usuários  : ${usuarios.length} (${comTelefone} com telefone)`);
  ok(`Carteiras : ${carteiras.length}`);
  ok(`Filhos    : ${filhos.length}`);
  ok(`LidMapping: ${lidMappings.length}`);
  info(`Arquivo   : ${OUTPUT_FILE}`);
  info(`Tamanho   : ${tamanhoKb} KB`);

  console.log(`\n  ${VERDE}✅ dados.json salvo com sucesso!${RESET}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  erro(`Erro fatal: ${err.message}`);
  process.exit(1);
});