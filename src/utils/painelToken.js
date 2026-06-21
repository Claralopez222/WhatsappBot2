const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não definido no .env — necessário para o sistema de painel.');
}

const TEMP_TOKEN_TTL    = '5m';
const SESSION_TOKEN_TTL = '7d';

function gerarTokenTemporario(idWhatsApp) {
  return jwt.sign({ sub: idWhatsApp, scope: 'painel_temp' }, JWT_SECRET, { expiresIn: TEMP_TOKEN_TTL });
}

function validarTokenTemporario(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.scope !== 'painel_temp') throw new Error('Token de escopo inválido.');
  return payload.sub;
}

function gerarTokenSessao(idWhatsApp) {
  return jwt.sign({ sub: idWhatsApp, scope: 'painel_session' }, JWT_SECRET, { expiresIn: SESSION_TOKEN_TTL });
}

function validarTokenSessao(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.scope !== 'painel_session') throw new Error('Token de escopo inválido.');
  return payload.sub;
}

module.exports = { gerarTokenTemporario, validarTokenTemporario, gerarTokenSessao, validarTokenSessao };