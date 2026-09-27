'use strict';

// ─── Tabela de Cargos e Horários de Trabalho ──────────────────────────────────

const CARGOS = [
  { slug: 'entregador',  nome: '🛵 Entregador de Pizza',    nivel: 1, salarioMin: 50,   salarioMax: 100,  exigencia: 0,   exigenciaNome: null },
  { slug: 'atendente',   nome: '🏪 Atendente de Loja',      nivel: 2, salarioMin: 150,  salarioMax: 250,  exigencia: 10,  exigenciaNome: 'Entregador de Pizza' },
  { slug: 'mecanico',    nome: '🔧 Mecânico',                nivel: 3, salarioMin: 280,  salarioMax: 420,  exigencia: 18,  exigenciaNome: 'Atendente de Loja' },
  { slug: 'chef',        nome: '👨‍🍳 Chef de Cozinha',       nivel: 4, salarioMin: 400,  salarioMax: 580,  exigencia: 28,  exigenciaNome: 'Mecânico' },
  { slug: 'programador', nome: '💻 Programador Júnior',      nivel: 5, salarioMin: 600,  salarioMax: 850,  exigencia: 40,  exigenciaNome: 'Chef de Cozinha' },
  { slug: 'medico',      nome: '🩺 Médico',                  nivel: 6, salarioMin: 900,  salarioMax: 1200, exigencia: 55,  exigenciaNome: 'Programador Júnior' },
  { slug: 'diretor',     nome: '🏢 Diretor de Empresa',      nivel: 7, salarioMin: 1300, salarioMax: 1800, exigencia: 75,  exigenciaNome: 'Médico' },
  { slug: 'empresario',  nome: '💎 Empresário Bilionário',   nivel: 8, salarioMin: 2500, salarioMax: 4000, exigencia: 100, exigenciaNome: 'Diretor de Empresa' },
];

const CARGO_POR_SLUG  = Object.fromEntries(CARGOS.map(c => [c.slug, c]));
const CARGO_POR_NIVEL = Object.fromEntries(CARGOS.map(c => [c.nivel, c]));

const HORARIO = {
  INICIO_MIN: 12 * 60 + 30, // 12:30 → 750 min
  FIM_MIN:    22 * 60 + 30, // 22:30 → 1350 min
  FUSO:       'America/Sao_Paulo',
};

const COOLDOWN_WORK_MS = 2 * 60 * 60 * 1000; // 2 horas entre turnos

module.exports = {
  CARGOS,
  CARGO_POR_SLUG,
  CARGO_POR_NIVEL,
  HORARIO,
  COOLDOWN_WORK_MS,
};
