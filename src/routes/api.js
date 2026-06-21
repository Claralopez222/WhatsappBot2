'use strict';

const crypto        = require('crypto');
const express       = require('express');
const jwt           = require('jsonwebtoken');
const router        = express.Router();
const AuthToken     = require('../models/AuthToken');
const Usuario       = require('../models/Usuario');
const CarteiraGrupo = require('../models/CarteiraGrupo');

// ─── Variáveis obrigatórias ───────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY  = process.env.ADMIN_KEY;

if (!JWT_SECRET) throw new Error('JWT_SECRET não definida no .env');
if (!ADMIN_KEY)  console.warn('⚠️  ADMIN_KEY não definida — rotas /admin/* vão recusar acesso.');

const FRONTEND = 'https://piroquinhasbot.github.io';

// ─── CORS ────────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  FRONTEND);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapParaObjeto(valor) {
  if (!valor) return {};
  return valor instanceof Map ? Object.fromEntries(valor) : valor;
}

function somarMap(m) {
  const obj = mapParaObjeto(m);
  return Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

// Formata JID de grupo em nome legível como fallback
// "120363xxxxxxx@g.us" → "Grupo 120363xxx"
function nomeGrupoFallback(jid) {
  if (!jid) return 'Grupo sem nome';
  const numero = jid.replace('@g.us', '').replace('@s.whatsapp.net', '');
  return `Grupo ${numero.slice(0, 10)}…`;
}

// ─── MIDDLEWARE: JWT de sessão ────────────────────────────────────────────────
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

// ─── MIDDLEWARE: chave de admin ───────────────────────────────────────────────
function adminAuth(req, res, next) {
  const chave = req.headers['x-admin-key'];
  if (!ADMIN_KEY || !chave) return res.status(401).json({ error: 'Chave de admin inválida.' });
  const a = Buffer.from(String(chave));
  const b = Buffer.from(String(ADMIN_KEY));
  const valido = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valido) return res.status(401).json({ error: 'Chave de admin inválida.' });
  next();
}

// ─── RATE LIMIT de login admin ────────────────────────────────────────────────
// Em memória — reseta no restart do processo (suficiente para Render free tier).
const tentativasLogin = new Map();
const LOGIN_MAX       = 10;
const LOGIN_JANELA_MS = 15 * 60 * 1000;

function rateLimitAdmin(req, res, next) {
  const ip    = req.ip || 'desconhecido';
  const agora = Date.now();
  const reg   = tentativasLogin.get(ip);
  if (!reg || agora > reg.resetAt) {
    tentativasLogin.set(ip, { count: 1, resetAt: agora + LOGIN_JANELA_MS });
    return next();
  }
  if (reg.count >= LOGIN_MAX)
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  reg.count++;
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS PÚBLICAS
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/token
// Troca o token temporário do !meupainel por um JWT de sessão (2h).
// Operação atômica para evitar race condition em duplo clique.
router.post('/auth/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token não informado.' });

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

    const sessionJwt = jwt.sign(
      { telefone: registro.telefone, idWhatsApp: registro.idWhatsApp },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({ jwt: sessionJwt });
  } catch (err) {
    console.error('[API] POST /auth/token:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/user/ranking
// Ranking global: soma o XP, gold e mensagens de todos os grupos por usuário via CarteiraGrupo.
// Público — sem auth.
//
// FIX (bug do gold zerado): antes o pipeline filtrava { xp: { $gt: 0 } } ANTES de
// agrupar/somar. Isso descartava documentos onde o usuário tem gold > 0 mas xp = 0
// naquele grupo específico (ex: comprou/ganhou gold sem ter mandado mensagem ali),
// fazendo o goldTotal somado sair menor do que o real (ou 0).
// Agora agrupamos TODOS os documentos primeiro (somando xp/gold/mensagens de
// cada grupo do usuário), e só depois filtramos por xpTotal > 0 — assim nenhum
// gold é perdido na soma.
router.get('/user/ranking', async (req, res) => {
  try {
    const resultado = await CarteiraGrupo.aggregate([
      // Agrupa por usuário somando XP, mensagens e gold de TODOS os grupos,
      // sem filtrar nada ainda — preserva gold de docs com xp = 0
      {
        $group: {
          _id:       '$idWhatsApp',
          xpTotal:   { $sum: '$xp' },
          mensagens: { $sum: '$mensagens' },
          goldTotal: { $sum: '$gold' },
          // Pega o nome do documento com maior XP (nome mais recente/ativo)
          nome:      { $first: '$nome' },
        },
      },

      // Só agora filtra: mantém quem tem XP somado OU gold somado, para não
      // sumir do ranking quem só joga em grupos com xp=0 mas tem gold
      { $match: { $or: [{ xpTotal: { $gt: 0 } }, { goldTotal: { $gt: 0 } }] } },

      { $sort: { xpTotal: -1 } },
      { $limit: 100 },
    ]);

    // Calcula level a partir do XP somado usando a mesma fórmula do bot
    // level = floor((xpTotal / 100) ^ (1/1.5)) + 1
    const ranking = resultado.map((u, i) => ({
      posicao:    i + 1,
      nome:       u.nome || 'Anônimo',
      idWhatsApp: u._id,
      xp:         u.xpTotal   ?? 0,
      level:      Math.max(1, Math.floor(Math.pow((u.xpTotal ?? 0) / 100, 1 / 1.5)) + 1),
      mensagens:  u.mensagens ?? 0,
      gold:       u.goldTotal ?? 0,
    }));

    // Total de jogadores únicos com XP > 0 ou gold > 0
    const totalResult = await CarteiraGrupo.aggregate([
      {
        $group: {
          _id:       '$idWhatsApp',
          xpTotal:   { $sum: '$xp' },
          goldTotal: { $sum: '$gold' },
        },
      },
      { $match: { $or: [{ xpTotal: { $gt: 0 } }, { goldTotal: { $gt: 0 } }] } },
      { $count: 'total' },
    ]);
    const total = totalResult[0]?.total ?? ranking.length;

    // Total de mensagens globais
    const msgsResult = await CarteiraGrupo.aggregate([
      { $group: { _id: null, total: { $sum: '$mensagens' } } },
    ]);
    const totalMensagens = msgsResult[0]?.total ?? 0;

    return res.json({ ranking, total, totalMensagens, atualizadoEm: new Date() });
  } catch (err) {
    console.error('[API] GET /user/ranking:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/user/ranking/grupo?jid=xxx
// Top 100 de XP de um grupo específico via CarteiraGrupo. Público — sem auth.
//
// FIX (mesmo bug do gold): antes o find() filtrava { xp: { $gt: 0 } } direto na
// query, então um documento de grupo com xp=0 mas gold>0 nem aparecia. Agora
// buscamos por xp>0 OU gold>0, preservando o gold no ranking por grupo também.
router.get('/user/ranking/grupo', async (req, res) => {
  try {
    const { jid } = req.query;
    if (!jid) return res.status(400).json({ error: 'Parâmetro jid obrigatório.' });

    const filtro = { idGrupo: jid, $or: [{ xp: { $gt: 0 } }, { gold: { $gt: 0 } }] };

    const [top, total] = await Promise.all([
      CarteiraGrupo
        .find(filtro)
        .sort({ xp: -1 })
        .limit(100)
        .select('nome idWhatsApp xp level mensagens gold')
        .lean(),
      CarteiraGrupo.countDocuments(filtro),
    ]);

    const ranking = top.map((u, i) => ({
      posicao:    i + 1,
      nome:       u.nome || 'Anônimo',
      idWhatsApp: u.idWhatsApp,
      xp:         u.xp        ?? 0,
      level:      u.level     ?? 1,
      mensagens:  u.mensagens ?? 0,
      gold:       u.gold      ?? 0,
    }));

    return res.json({ ranking, total, atualizadoEm: new Date() });
  } catch (err) {
    console.error('[API] GET /user/ranking/grupo:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/grupos
// Lista grupos distintos com contagem de membros ativos.
// PÚBLICO — usado pelo select de grupos no index.html.
router.get('/grupos', async (req, res) => {
  try {
    const grupos = await CarteiraGrupo.aggregate([
      // Só grupos reais (JID de grupo termina com @g.us)
      { $match: { idGrupo: { $regex: /@g\.us$/ } } },

      {
        $group: {
          _id:     '$idGrupo',
          membros: { $sum: 1 },
          // xpTotal para ordenar os grupos mais ativos primeiro
          xpTotal: { $sum: '$xp' },
        },
      },

      { $sort: { xpTotal: -1 } },
    ]);

    const resultado = grupos.map(g => ({
      jid:     g._id,
      nome:    nomeGrupoFallback(g._id),
      membros: g.membros,
      xpTotal: g.xpTotal,
    }));

    return res.json({ grupos: resultado });
  } catch (err) {
    console.error('[API] GET /grupos:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS AUTENTICADAS (JWT de sessão)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/user/me
// Dados globais do usuário (Usuario.js) + dados por grupo (CarteiraGrupo.js).
router.get('/user/me', auth, async (req, res) => {
  try {
    const idWhatsApp = req.user.idWhatsApp;

    const [usuario, carteiras] = await Promise.all([
      Usuario.findOne({ idWhatsApp }).lean(),
      CarteiraGrupo.find({ idWhatsApp }).sort({ xp: -1 }).lean(),
    ]);

    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const xpTotal        = carteiras.reduce((s, c) => s + (c.xp        ?? 0), 0);
    const goldTotal      = carteiras.reduce((s, c) => s + (c.gold      ?? 0), 0);
    const mensagensTotal = carteiras.reduce((s, c) => s + (c.mensagens ?? 0), 0);

    const levelGlobal = Math.max(1, Math.floor(Math.pow(xpTotal / 100, 1 / 1.5)) + 1);

    const xpParaProximo = Math.ceil(100 * Math.pow(levelGlobal, 1.5));
    const xpInicioNivel = Math.ceil(100 * Math.pow(Math.max(0, levelGlobal - 1), 1.5));
    const xpNoNivel     = xpParaProximo - xpInicioNivel;
    const xpProgresso   = xpNoNivel > 0
      ? Math.min(100, Math.max(0, Math.floor(((xpTotal - xpInicioNivel) / xpNoNivel) * 100)))
      : 100;

    // FIX: usa a mesma lógica $group sem filtro prévio para não distorcer a posição
    const posicaoResult = await CarteiraGrupo.aggregate([
      { $group: { _id: '$idWhatsApp', xpTotal: { $sum: '$xp' } } },
      { $match: { xpTotal: { $gt: xpTotal } } },
      { $count: 'acima' },
    ]);
    const posicaoRanking = (posicaoResult[0]?.acima ?? 0) + 1;

    const grupos = carteiras.map(c => ({
      jid:      c.idGrupo,
      nome:     nomeGrupoFallback(c.idGrupo),
      xp:       c.xp        ?? 0,
      level:    c.level     ?? 1,
      gold:     c.gold      ?? 0,
      mensagens: c.mensagens ?? 0,
      empregoAtual: c.empregoAtual ?? null,
      varaEquipada: c.varaEquipada ?? null,
      statsPesca:   c.statsPesca   ?? null,
    }));

    return res.json({
      nome:     usuario.nome,
      telefone: usuario.telefone,
      bio:      usuario.bio,

      xp:         xpTotal,
      level:      levelGlobal,
      gold:       goldTotal,
      mensagens:  mensagensTotal,
      quizPoints: usuario.quizPoints ?? 0,
      xpParaProximo,
      xpProgresso,
      posicaoRanking,

      xpHistory:        mapParaObjeto(usuario.xpHistory),
      atividadeSemanal: usuario.atividadeSemanal || [0, 0, 0, 0, 0, 0, 0],
      inventory:        mapParaObjeto(usuario.inventory),
      goldHistory:      (usuario.goldHistory || []).slice(-20),
      pet:              usuario.pet       ?? null,
      casadoCom:        usuario.casadoCom  ?? null,
      casadoTipo:       usuario.casadoTipo ?? null,
      casadoDesde:      usuario.casadoDesde ?? null,

      grupos,
    });
  } catch (err) {
    console.error('[API] GET /user/me:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/user/grupos
// Retorna os dados do usuário em cada grupo (autenticado).
router.get('/user/grupos', auth, async (req, res) => {
  try {
    const carteiras = await CarteiraGrupo
      .find({ idWhatsApp: req.user.idWhatsApp })
      .sort({ xp: -1 })
      .lean();

    const grupos = carteiras.map(c => ({
      jid:          c.idGrupo,
      nome:         nomeGrupoFallback(c.idGrupo),
      xp:           c.xp           ?? 0,
      level:        c.level        ?? 1,
      gold:         c.gold         ?? 0,
      mensagens:    c.mensagens    ?? 0,
      empregoAtual: c.empregoAtual ?? null,
      varaEquipada: c.varaEquipada ?? null,
      statsPesca:   c.statsPesca   ?? null,
    }));

    return res.json({ grupos });
  } catch (err) {
    console.error('[API] GET /user/grupos:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS ADMIN (x-admin-key)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/verify
router.get('/admin/verify', rateLimitAdmin, adminAuth, (req, res) => {
  return res.json({ ok: true });
});

// GET /api/admin/usuarios
router.get('/admin/usuarios', adminAuth, async (req, res) => {
  try {
    const todos = await Usuario
      .find({})
      .select('nome telefone idWhatsApp warnings')
      .lean();

    const comWarns = todos
      .map(u => ({
        nome:          u.nome || u.telefone || 'Anônimo',
        telefone:      u.telefone || u.idWhatsApp?.split('@')[0] || '—',
        idWhatsApp:    u.idWhatsApp,
        warns:         somarMap(u.warnings),
        warnsPorGrupo: mapParaObjeto(u.warnings),
      }))
      .filter(u => u.warns > 0)
      .sort((a, b) => b.warns - a.warns);

    return res.json({ usuarios: comWarns });
  } catch (err) {
    console.error('[API] GET /admin/usuarios:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// DELETE /api/admin/warn/:idWhatsApp?grupo=xxx
router.delete('/admin/warn/:idWhatsApp', adminAuth, async (req, res) => {
  try {
    const { idWhatsApp } = req.params;
    const { grupo }      = req.query;

    const usuario = await Usuario.findOne({ idWhatsApp });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const warns = mapParaObjeto(usuario.warnings);

    if (grupo) {
      const atual = Number(warns[grupo] || 0);
      if (atual <= 1) delete warns[grupo];
      else warns[grupo] = atual - 1;
    } else {
      for (const k of Object.keys(warns)) delete warns[k];
    }

    usuario.warnings = new Map(Object.entries(warns));
    await usuario.save();

    return res.json({ ok: true, warns: mapParaObjeto(usuario.warnings) });
  } catch (err) {
    console.error('[API] DELETE /admin/warn/:id:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PATCH /api/admin/grupo/:jid/config
const CAMPOS_CONFIG_VALIDOS = ['xpAtivo', 'antiLink', 'boasVindas'];

router.patch('/admin/grupo/:jid/config', adminAuth, async (req, res) => {
  try {
    const jid    = decodeURIComponent(req.params.jid);
    const campos = req.body || {};
    const chaves = Object.keys(campos);

    if (!chaves.length) return res.status(400).json({ error: 'Nenhum campo enviado.' });

    const update = {};
    for (const campo of chaves) {
      if (!CAMPOS_CONFIG_VALIDOS.includes(campo))
        return res.status(400).json({ error: `Campo desconhecido: ${campo}` });
      if (typeof campos[campo] !== 'boolean')
        return res.status(400).json({ error: `"${campo}" deve ser true ou false.` });
      update[`config.${campo}`] = campos[campo];
    }

    await CarteiraGrupo.updateMany({ idGrupo: jid }, { $set: update });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[API] PATCH /admin/grupo/config:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// PUT /api/admin/grupo/:jid/mensagens
const MAX_MSG = 5000;

router.put('/admin/grupo/:jid/mensagens', adminAuth, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);
    const { boasVindas, regras } = req.body || {};

    if (boasVindas != null && typeof boasVindas !== 'string')
      return res.status(400).json({ error: 'boasVindas deve ser texto.' });
    if (regras != null && typeof regras !== 'string')
      return res.status(400).json({ error: 'regras deve ser texto.' });
    if ((boasVindas?.length || 0) > MAX_MSG || (regras?.length || 0) > MAX_MSG)
      return res.status(400).json({ error: `Máximo de ${MAX_MSG} caracteres por mensagem.` });

    await CarteiraGrupo.updateMany(
      { idGrupo: jid },
      { $set: { 'mensagens.boasVindas': boasVindas ?? '', 'mensagens.regras': regras ?? '' } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /admin/grupo/mensagens:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;