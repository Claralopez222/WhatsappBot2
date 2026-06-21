'use strict';

const crypto    = require('crypto');
const express   = require('express');
const jwt       = require('jsonwebtoken');
const router    = express.Router();
const AuthToken = require('../models/AuthToken');
const Usuario   = require('../models/Usuario');
const CarteiraGrupo = require('../models/CarteiraGrupo');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não definida no .env — obrigatória para autenticação do painel.');
}

const FRONTEND = 'https://piroquinhasbot.github.io';

router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  FRONTEND);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Converte campos Map do Mongoose pra objeto plano — funciona tanto com
// documentos normais (Map de verdade) quanto com .lean() (já vem como objeto)
function mapParaObjeto(valor) {
  if (!valor) return {};
  return valor instanceof Map ? Object.fromEntries(valor) : valor;
}

router.post('/auth/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não informado.' });

    // Operação atômica: marca como usado e busca em um único passo,
    // evitando que duas requisições simultâneas resgatem o mesmo token
    const registro = await AuthToken.findOneAndUpdate(
      { token, usado: false, expiresAt: { $gt: new Date() } },
      { $set: { usado: true } },
      { new: false }
    );

    if (!registro) {
      const existe = await AuthToken.findOne({ token });
      if (!existe)      return res.status(404).json({ error: 'Token inválido.' });
      if (existe.usado) return res.status(410).json({ error: 'Token já utilizado.' });
      return res.status(410).json({ error: 'Token expirado.' });
    }

    const sessionToken = jwt.sign(
      { telefone: registro.telefone, idWhatsApp: registro.idWhatsApp },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({ jwt: sessionToken });
  } catch (err) {
    console.error('[API] /auth/token:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.get('/user/me', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findOne({ idWhatsApp: req.user.idWhatsApp }).lean();
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const xpHistory        = mapParaObjeto(usuario.xpHistory);
    const inventory        = mapParaObjeto(usuario.inventory);
    const atividadeSemanal = usuario.atividadeSemanal || [0,0,0,0,0,0,0];

    // Mesma fórmula de level usada em addUserXp() no bot.js:
    // level = floor((xp/100)^(1/1.5)) + 1  →  xp pro level L = 100 * L^1.5
    const nivelAtual        = usuario.level || 1;
    const xpInicioNivel     = 100 * Math.pow(Math.max(0, nivelAtual - 1), 1.5);
    const xpParaProximo     = Math.ceil(100 * Math.pow(nivelAtual, 1.5));
    const xpNecessarioNivel = xpParaProximo - xpInicioNivel;
    const xpProgresso       = xpNecessarioNivel > 0
      ? Math.min(100, Math.max(0, Math.floor(((usuario.xp - xpInicioNivel) / xpNecessarioNivel) * 100)))
      : 100;

    const posicao = await Usuario.countDocuments({ xp: { $gt: usuario.xp } });

    return res.json({
      nome:           usuario.nome,
      telefone:       usuario.telefone,
      bio:            usuario.bio,
      xp:             usuario.xp,
      level:          usuario.level,
      gold:           usuario.gold,
      mensagens:      usuario.mensagens,
      quizPoints:     usuario.quizPoints,
      xpParaProximo,
      xpProgresso,
      posicaoRanking: posicao + 1,
      xpHistory,
      atividadeSemanal,
      inventory,
      goldHistory:    (usuario.goldHistory || []).slice(-20),
      pet:            usuario.pet,
      casadoCom:      usuario.casadoCom,
      casadoTipo:     usuario.casadoTipo,
      casadoDesde:    usuario.casadoDesde,
    });
  } catch (err) {
    console.error('[API] /user/me:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.get('/user/ranking', async (req, res) => {
  try {
    const top = await Usuario
      .find({ xp: { $gt: 0 } })
      .sort({ xp: -1 })
      .limit(100)
      .select('nome telefone xp level mensagens')
      .lean();

    const ranking = top.map((u, i) => ({
      posicao:   i + 1,
      nome:      u.nome || u.telefone || 'Anônimo',
      xp:        u.xp,
      level:     u.level,
      mensagens: u.mensagens,
    }));

    return res.json({ ranking, total: ranking.length, atualizadoEm: new Date() });
  } catch (err) {
    console.error('[API] /user/ranking:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.get('/user/ranking/grupo', async (req, res) => {
  try {
    const { jid } = req.query;
    if (!jid) return res.status(400).json({ error: 'Parâmetro jid obrigatório.' });

    const total = await CarteiraGrupo.countDocuments({ idGrupo: jid });

    const top = await CarteiraGrupo
      .find({ idGrupo: jid })
      .sort({ xp: -1 })
      .limit(100)
      .select('nome telefone idWhatsApp xp level mensagens')
      .lean();

    const ranking = top.map((u, i) => ({
      posicao:    i + 1,
      nome:       u.nome || u.telefone || 'Anônimo',
      idWhatsApp: u.idWhatsApp,
      xp:         u.xp,
      level:      u.level,
      mensagens:  u.mensagens,
    }));

    return res.json({ ranking, total });
  } catch (err) {
    console.error('[API] /user/ranking/grupo:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── MIDDLEWARE ADMIN ────────────────────────────────────────────────────────

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) {
  console.warn('⚠️ ADMIN_KEY não definida — todas as rotas /api/admin/* vão recusar acesso.');
}

function adminAuth(req, res, next) {
  const chave = req.headers['x-admin-key'];
  if (!ADMIN_KEY || !chave) return res.status(401).json({ error: 'Chave de admin inválida.' });

  const a = Buffer.from(String(chave));
  const b = Buffer.from(String(ADMIN_KEY));
  const valido = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valido) return res.status(401).json({ error: 'Chave de admin inválida.' });

  next();
}

// Limita tentativas de login do admin por IP (precisa de "trust proxy"
// configurado no bot.js pra req.ip refletir o IP real do cliente no Render)
const tentativasLogin = new Map();
const LOGIN_MAX_TENTATIVAS = 10;
const LOGIN_JANELA_MS = 15 * 60 * 1000;

function rateLimitAdminLogin(req, res, next) {
  const ip = req.ip || 'desconhecido';
  const agora = Date.now();
  const registro = tentativasLogin.get(ip);

  if (!registro || agora > registro.resetAt) {
    tentativasLogin.set(ip, { count: 1, resetAt: agora + LOGIN_JANELA_MS });
    return next();
  }

  if (registro.count >= LOGIN_MAX_TENTATIVAS) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }

  registro.count++;
  next();
}

router.get('/admin/verify', rateLimitAdminLogin, adminAuth, (req, res) => {
  return res.json({ ok: true });
});

router.get('/grupos', adminAuth, async (req, res) => {
  try {
    const grupos = await CarteiraGrupo
      .find({})
      .select('idGrupo nome config mensagens')
      .lean();

    const vistos = new Set();
    const unicos = grupos.filter(g => {
      if (vistos.has(g.idGrupo)) return false;
      vistos.add(g.idGrupo);
      return true;
    });

    return res.json({ grupos: unicos });
  } catch (err) {
    console.error('[API] /grupos:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.get('/admin/usuarios', adminAuth, async (req, res) => {
  try {
    const usuarios = await Usuario
      .find({ $or: [{ warns: { $gt: 0 } }, { banido: true }] })
      .select('nome telefone idWhatsApp warns maxWarns banido')
      .sort({ warns: -1 })
      .lean();

    return res.json({ usuarios });
  } catch (err) {
    console.error('[API] /admin/usuarios:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

router.delete('/admin/warn/:idWhatsApp', adminAuth, async (req, res) => {
  try {
    const { idWhatsApp } = req.params;
    const usuario = await Usuario.findOne({ idWhatsApp });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    usuario.warns = Math.max(0, (usuario.warns || 1) - 1);
    await usuario.save();

    return res.json({ ok: true, warns: usuario.warns });
  } catch (err) {
    console.error('[API] /admin/warn/:id:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Define o número de warns diretamente (usado pelo botão "Zerar" no admin)
router.put('/admin/warn/:idWhatsApp', adminAuth, async (req, res) => {
  try {
    const { idWhatsApp } = req.params;
    const { warns } = req.body;

    if (typeof warns !== 'number' || !Number.isInteger(warns) || warns < 0 || warns > 1000) {
      return res.status(400).json({ error: 'Valor de warns inválido.' });
    }

    const usuario = await Usuario.findOneAndUpdate(
      { idWhatsApp },
      { $set: { warns } },
      { new: true }
    );
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({ ok: true, warns: usuario.warns });
  } catch (err) {
    console.error('[API] PUT /admin/warn/:id:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Bane/desbane um usuário
router.patch('/admin/usuario/:idWhatsApp/ban', adminAuth, async (req, res) => {
  try {
    const { idWhatsApp } = req.params;
    const { banido } = req.body;

    if (typeof banido !== 'boolean') {
      return res.status(400).json({ error: 'Campo "banido" deve ser true ou false.' });
    }

    const usuario = await Usuario.findOneAndUpdate(
      { idWhatsApp },
      { $set: { banido } },
      { new: true }
    );
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({ ok: true, banido: usuario.banido });
  } catch (err) {
    console.error('[API] PATCH /admin/usuario/:id/ban:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

const CAMPOS_CONFIG_PERMITIDOS = ['xpAtivo', 'antiLink', 'boasVindas'];

router.patch('/admin/grupo/:jid/config', adminAuth, async (req, res) => {
  try {
    const jid    = decodeURIComponent(req.params.jid);
    const campos = req.body || {};

    const chaves = Object.keys(campos);
    if (!chaves.length) {
      return res.status(400).json({ error: 'Nenhum campo enviado.' });
    }

    const update = {};
    for (const campo of chaves) {
      if (!CAMPOS_CONFIG_PERMITIDOS.includes(campo)) {
        return res.status(400).json({ error: `Campo de configuração desconhecido: ${campo}` });
      }
      if (typeof campos[campo] !== 'boolean') {
        return res.status(400).json({ error: `O campo "${campo}" deve ser true ou false.` });
      }
      update[`config.${campo}`] = campos[campo];
    }

    await CarteiraGrupo.updateMany({ idGrupo: jid }, { $set: update });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[API] /admin/grupo/config:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

const TAMANHO_MAX_MENSAGEM = 5000;

router.put('/admin/grupo/:jid/mensagens', adminAuth, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const { boasVindas, regras } = req.body || {};

    if (boasVindas != null && typeof boasVindas !== 'string') {
      return res.status(400).json({ error: 'boasVindas deve ser texto.' });
    }
    if (regras != null && typeof regras !== 'string') {
      return res.status(400).json({ error: 'regras deve ser texto.' });
    }
    if ((boasVindas?.length || 0) > TAMANHO_MAX_MENSAGEM || (regras?.length || 0) > TAMANHO_MAX_MENSAGEM) {
      return res.status(400).json({ error: `Cada mensagem deve ter no máximo ${TAMANHO_MAX_MENSAGEM} caracteres.` });
    }

    await CarteiraGrupo.updateMany(
      { idGrupo: jid },
      { $set: { 'mensagens.boasVindas': boasVindas, 'mensagens.regras': regras } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[API] /admin/grupo/mensagens:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;