'use strict';

// ─── Configurações do Banco ───────────────────────────────────────────────────

const BANCO_CONFIG = {
  PRAZO_MS:         3 * 60 * 60 * 1000, // 3 horas
  JUROS_MIN:        5,
  JUROS_MAX:        15,
  DAILY_LIMIT:      100000,
  HISTORICO_LIMITE: 10,
};

module.exports = {
  BANCO_CONFIG,
};
