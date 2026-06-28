'use strict';

const fs   = require('fs');
const path = require('path');

const RESET    = '\x1b[0m';
const VERDE    = '\x1b[32m';
const AMARELO  = '\x1b[33m';
const VERMELHO = '\x1b[31m';
const CYAN     = '\x1b[36m';
const BRANCO   = '\x1b[37m';

const INPUT_FILE  = path.resolve(__dirname, '..', '..', 'dados.json');
const OUTPUT_FILE = path.resolve(__dirname, '..', '..', 'numeros.json');

function sep()     { console.log(`${BRANCO}${'─'.repeat(70)}${RESET}`); }
function titulo(t) { sep(); console.log(`  ${AMARELO}${t}${RESET}`); sep(); }
function ok(t)     { console.log(`  ${VERDE}✅ ${t}${RESET}`); }
function info(t)   { console.log(`  ${CYAN}ℹ️  ${t}${RESET}`); }
function erro(t)   { console.log(`  ${VERMELHO}❌ ${t}${RESET}`); }
function warn(t)   { console.log(`  ${AMARELO}⚠️  ${t}${RESET}`); }

function extrairNumero(jid = '') {
  // Preserva @lid (privacidade WhatsApp), extrai número dos demais
  if (jid.includes('@lid')) return null;
  return jid.replace(/@.+$/, '').replace(/:\d+$/, '').trim() || null;
}

function main() {
  titulo('🔍  EXTRAÇÃO DE NÚMEROS — dados.json');

  if (!fs.existsSync(INPUT_FILE)) {
    erro('dados.json não encontrado. Rode primeiro: node src/scripts/exportar-dados.js');
    process.exit(1);
  }

  const dados = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const { usuarios = [], carteiras = [] } = dados;

  info(`dados.json exportado em: ${dados.exportadoEm ?? 'desconhecido'}\n`);

  // Monta mapa: numero → { idWhatsApp, nome, grupos[] }
  const mapa = new Map();

  for (const u of usuarios) {
    const numero = extrairNumero(u.idWhatsApp);
    if (!numero) continue;

    if (!mapa.has(numero)) {
      mapa.set(numero, {
        numero,
        idWhatsApp: u.idWhatsApp,
        nome:       u.nome ?? u.pushName ?? null,
        gold:       u.gold ?? 0,
        xp:         u.xp   ?? 0,
        nivel:      u.nivel ?? u.level ?? 0,
        grupos:     [],
      });
    }
  }

  for (const c of carteiras) {
    const numero = extrairNumero(c.idWhatsApp);
    if (!numero) continue;

    if (mapa.has(numero)) {
      mapa.get(numero).grupos.push({
        idGrupo: c.idGrupo,
        gold:    c.gold  ?? 0,
        banco:   c.banco ?? 0,
        xp:      c.xp    ?? 0,
        nivel:   c.nivel ?? c.level ?? 0,
      });
    } else {
      // Usuário que só tem carteira (sem doc em Usuario)
      mapa.set(numero, {
        numero,
        idWhatsApp: c.idWhatsApp,
        nome:       null,
        gold:       0,
        xp:         0,
        nivel:      0,
        grupos: [{
          idGrupo: c.idGrupo,
          gold:    c.gold  ?? 0,
          banco:   c.banco ?? 0,
          xp:      c.xp    ?? 0,
          nivel:   c.nivel ?? c.level ?? 0,
        }],
      });
    }
  }

  const lista = [...mapa.values()].sort((a, b) => a.numero.localeCompare(b.numero));

  const saida = {
    geradoEm:      new Date().toISOString(),
    baseExportada: dados.exportadoEm ?? null,
    total:         lista.length,
    usuarios:      lista,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(saida, null, 2), 'utf8');

  const tamanhoKb = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);

  // Estatísticas rápidas
  const semNome    = lista.filter(u => !u.nome).length;
  const semGrupo   = lista.filter(u => u.grupos.length === 0).length;
  const comGrupo   = lista.filter(u => u.grupos.length  > 0).length;

  titulo('📊  RESUMO');
  ok(`Total de números únicos : ${lista.length}`);
  ok(`Com grupo(s)            : ${comGrupo}`);
  if (semGrupo) warn(`Sem grupo               : ${semGrupo}`);
  if (semNome)  warn(`Sem nome                : ${semNome}`);
  info(`Arquivo : ${OUTPUT_FILE}`);
  info(`Tamanho : ${tamanhoKb} KB`);

  console.log(`\n  ${VERDE}✅ numeros.json salvo com sucesso!${RESET}\n`);
}

main();