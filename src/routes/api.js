'use strict';

const express   = require('express');
const jwt       = require('jsonwebtoken');
const router    = express.Router();
const AuthToken = require('../models/AuthToken');
const Usuario   = require('../models/Usuario');

const JWT_SECRET = process.env.JWT_SECRET || 'piroquinhas-secret-troque-no-env';
const FRONTEND   = 'https://piroquinhasbot.github.io';

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

router.post('/auth/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não informado.' });

    const registro = await AuthToken.findOne({ token });
    if (!registro)      return res.status(404).json({ error: 'Token inválido.' });
    if (registro.usado) return res.status(410).json({ error: 'Token já utilizado.' });
    if (registro.expiresAt < new Date()) return res.status(410).json({ error: 'Token expirado.' });

    registro.usado = true;
    await registro.save();

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

    const xpHistory        = usuario.xpHistory        ? Object.fromEntries(usuario.xpHistory) : {};
    const inventory        = usuario.inventory         ? Object.fromEntries(usuario.inventory)  : {};
    const atividadeSemanal = usuario.atividadeSemanal  || [0,0,0,0,0,0,0];
    const xpParaProximo    = Math.floor(usuario.level * 100 * 1.5);
    const xpProgresso      = Math.min(100, Math.floor((usuario.xp / xpParaProximo) * 100));
    const posicao          = await Usuario.countDocuments({ xp: { $gt: usuario.xp } });

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

// ─── MIDDLEWARE ADMIN ────────────────────────────────────────────────────────

const ADMIN_KEY = process.env.ADMIN_KEY || '';

function adminAuth(req, res, next) {
  const chave = req.headers['x-admin-key'];
  if (!chave || chave !== ADMIN_KEY)
    return res.status(401).json({ error: 'Chave de admin inválida.' });
  next();
}

// ─── GET /api/admin/verify ───────────────────────────────────────────────────
// Valida a chave de admin (usado na tela de login do painel)

router.get('/admin/verify', adminAuth, (req, res) => {
  return res.json({ ok: true });
});

// ─── GET /api/grupos ─────────────────────────────────────────────────────────
// Lista grupos distintos da collection CarteiraGrupo

const CarteiraGrupo = require('../models/CarteiraGrupo');

router.get('/grupos', adminAuth, async (req, res) => {
  try {
    const grupos = await CarteiraGrupo
      .find({})
      .select('idGrupo nome config')
      .lean();

    // Deduplica por idGrupo caso haja documentos repetidos
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

// ─── GET /api/user/ranking/grupo?jid=xxx ─────────────────────────────────────
// Top 100 de um grupo específico, ordenado por xp desc

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
      posicao:   i + 1,
      nome:      u.nome || u.telefone || 'Anônimo',
      idWhatsApp: u.idWhatsApp,
      xp:        u.xp,
      level:     u.level,
      mensagens: u.mensagens,
    }));

    return res.json({ ranking, total });
  } catch (err) {
    console.error('[API] /user/ranking/grupo:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── GET /api/admin/usuarios ──────────────────────────────────────────────────
// Lista usuários com warns > 0 ou banidos

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

// ─── DELETE /api/admin/warn/:idWhatsApp ───────────────────────────────────────
// Remove 1 warn do usuário

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

// ─── PATCH /api/admin/grupo/:jid/config ──────────────────────────────────────
// Atualiza toggles de configuração do grupo

router.patch('/admin/grupo/:jid/config', adminAuth, async (req, res) => {
  try {
    const jid    = decodeURIComponent(req.params.jid);
    const campos = req.body; // ex: { xpAtivo: true }

    const update = {};
    for (const [campo, valor] of Object.entries(campos)) {
      update[`config.${campo}`] = valor;
    }

    await CarteiraGrupo.updateMany({ idGrupo: jid }, { $set: update });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[API] /admin/grupo/config:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── PUT /api/admin/grupo/:jid/mensagens ─────────────────────────────────────
// Salva mensagem de boas-vindas e regras do grupo

router.put('/admin/grupo/:jid/mensagens', adminAuth, async (req, res) => {
  try {
    const jid          = decodeURIComponent(req.params.jid);
    const { boasVindas, regras } = req.body;

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