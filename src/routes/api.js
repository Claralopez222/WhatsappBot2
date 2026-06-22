'use strict';

const crypto        = require('crypto');
const express       = require('express');
const jwt           = require('jsonwebtoken');
const router        = express.Router();
const AuthToken     = require('../models/AuthToken');
const Usuario       = require('../models/Usuario');
const CarteiraGrupo = require('../models/CarteiraGrupo');
const LidMapping    = require('../models/LidMapping');

// ─── Variáveis obrigatórias ───────────────────────────────────────────────────
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ ERRO CRÍTICO: JWT_SECRET não definida no arquivo .env!');
    throw new Error('JWT_SECRET não definida no .env');
  }
  return secret;
};

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) console.warn('⚠️  ADMIN_KEY não definida — rotas /admin/* vão recusar acesso.');

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

function nomeGrupoFallback(jid) {
  if (!jid) return 'Grupo sem nome';
  const numero = jid.replace('@g.us', '').replace('@s.whatsapp.net', '');
  return `Grupo ${numero.slice(0, 10)}…`;
}

function nomeGrupo(doc, jid) {
  const custom = doc && typeof doc.nomeCustom === 'string' ? doc.nomeCustom.trim() : '';
  if (custom) return custom;
  const realDoWhatsApp = doc && typeof doc.nomeReal === 'string' ? doc.nomeReal.trim() : '';
  return realDoWhatsApp || nomeGrupoFallback(jid);
}

// Normaliza número/JID para JID completo
function normalizarJid(termo) {
  const t = String(termo || '').trim().toLowerCase();
  if (t.includes('@')) return t;
  // Remove tudo que não é dígito
  const digitos = t.replace(/\D/g, '');
  return `${digitos}@s.whatsapp.net`;
}

// Gera as possíveis variantes de JID para números brasileiros (55 + DDD + número),
// já que o WhatsApp pode ter o contato salvo com ou sem o "9" extra na frente
// do número (números antigos vs. novos). Sem isso, digitar o número "errado"
// cria uma carteira nova em vez de achar a pessoa que já existe no grupo.
// Gera variantes de DÍGITOS (sem domínio) pra números brasileiros, cobrindo
// o "9" extra que pode estar presente ou não, dependendo de quando o
// contato foi salvo.
function gerarVariantesNumero(termo) {
  const digitos = String(termo || '').replace(/\D/g, '');
  const variantes = new Set([digitos]);

  if (digitos.startsWith('55') && digitos.length >= 12) {
    const ddd   = digitos.slice(2, 4);
    const resto = digitos.slice(4);

    if (resto.length === 8) {
      variantes.add(`55${ddd}9${resto}`);
    } else if (resto.length === 9 && resto.startsWith('9')) {
      variantes.add(`55${ddd}${resto.slice(1)}`);
    }
  }

  return [...variantes];
}

// Resolve o que o admin digitou (telefone OU JID) pro idWhatsApp REAL usado
// nas carteiras desse grupo. Ordem de prioridade:
//   1. Já veio como JID completo (@lid ou @s.whatsapp.net) -> usa direto.
//   2. É um telefone com LID mapeado (capturado pelo bot.js)  -> usa o LID.
//   3. Telefone sem mapeamento, mas já tem carteira nesse grupo -> usa essa.
//   4. Nada encontrado -> usa a variante "completa" (com o 9) pra criar.
async function resolverIdWhatsApp(termo, idGrupo) {
  const t = String(termo || '').trim().toLowerCase();
  if (t.includes('@')) return t;

  const variantesDigitos = gerarVariantesNumero(t);
  const variantesPn      = variantesDigitos.map(d => `${d}@s.whatsapp.net`);

  const mapeamento = await LidMapping.findOne({ pn: { $in: variantesPn } }).lean();
  if (mapeamento) return mapeamento.lid;

  const existente = await CarteiraGrupo.findOne({
    idWhatsApp: { $in: variantesPn },
    idGrupo,
  }).select('idWhatsApp').lean();
  if (existente) return existente.idWhatsApp;

  return variantesPn.sort((a, b) => b.length - a.length)[0];
}

// Calcula nível a partir do XP (mesma fórmula usada no bot e no frontend)
function calcularLevel(xp) {
  return Math.max(1, Math.floor(Math.pow((xp || 0) / 100, 1 / 1.5)) + 1);
}

// ─── MIDDLEWARE: JWT de sessão ────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente.' });
  try {
    req.user = jwt.verify(token, getJwtSecret());
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
      getJwtSecret(),
      { expiresIn: '2h' }
    );

    return res.json({ jwt: sessionJwt });
  } catch (err) {
    console.error('[API] POST /auth/token:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/grupos
router.get('/grupos', async (req, res) => {
  try {
    const grupos = await CarteiraGrupo.aggregate([
      { $match: { idGrupo: { $regex: /@g\.us$/ } } },
      {
        $group: {
          _id:        '$idGrupo',
          membros:    { $sum: 1 },
          xpTotal:    { $sum: '$xp' },
          nomeCustom: { $first: '$nomeCustom' },
          nomeReal:   { $first: '$nome' },
          mensagens:  { $first: '$mensagens' },
          config:     { $first: '$config' },
        },
      },
      { $sort: { xpTotal: -1 } },
    ]);

    const resultado = grupos.map(g => ({
      jid:        g._id,
      idGrupo:    g._id,
      nome:       nomeGrupo(g, g._id),
      nomeCustom: g.nomeCustom || null,
      membros:    g.membros,
      xpTotal:    g.xpTotal,
      mensagens:  g.mensagens || {},
      config:     g.config || {},
    }));

    return res.json({ grupos: resultado });
  } catch (err) {
    console.error('[API] GET /grupos:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/ranking
// Ranking global — soma xp/gold/mensagens de cada usuário em todos os grupos.
//
// Query params: limit (padrão 100, máx 200)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/ranking', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

    const [agregados, totaisGlobais] = await Promise.all([
      CarteiraGrupo.aggregate([
        {
          $group: {
            _id:       '$idWhatsApp',
            xp:        { $sum: '$xp' },
            gold:      { $sum: '$gold' },
            mensagens: { $sum: '$mensagens' },
          },
        },
        { $sort: { xp: -1 } },
        { $limit: limit },
      ]),
      CarteiraGrupo.aggregate([
        {
          $group: {
            _id:            null,
            totalMensagens: { $sum: '$mensagens' },
            totalUsuarios:  { $addToSet: '$idWhatsApp' },
          },
        },
      ]),
    ]);

    const jids = agregados.map(a => a._id);
    const usuariosMap = {};
    if (jids.length) {
      const usuarios = await Usuario.find({ idWhatsApp: { $in: jids } })
        .select('idWhatsApp nome telefone')
        .lean();
      for (const u of usuarios) usuariosMap[u.idWhatsApp] = u;
    }

    const ranking = agregados.map((a, i) => {
      const u = usuariosMap[a._id] || {};
      return {
        idWhatsApp: a._id,
        nome:       u.nome || u.telefone || a._id?.split('@')[0] || 'Anônimo',
        xp:         a.xp        ?? 0,
        gold:       a.gold      ?? 0,
        mensagens:  a.mensagens ?? 0,
        level:      calcularLevel(a.xp),
        posicao:    i + 1,
      };
    });

    const t = totaisGlobais[0] || {};

    return res.json({
      ranking,
      total:          t.totalUsuarios?.length || ranking.length,
      totalMensagens: t.totalMensagens || 0,
      atualizadoEm:   new Date(),
    });
  } catch (err) {
    console.error('[API] GET /user/ranking:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/ranking/grupo?jid=xxx
// Ranking de um grupo específico (xp/gold/mensagens daquele grupo).
//
// Query params: jid (obrigatório), limit (padrão 100, máx 200)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user/ranking/grupo', async (req, res) => {
  try {
    const jid = decodeURIComponent(req.query.jid || '');
    if (!jid) return res.status(400).json({ error: 'jid é obrigatório.' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

    const membros = await CarteiraGrupo
      .find({ idGrupo: jid })
      .sort({ xp: -1 })
      .limit(limit)
      .lean();

    const jidsUsuarios = membros.map(m => m.idWhatsApp);
    const usuariosMap = {};
    if (jidsUsuarios.length) {
      const usuarios = await Usuario.find({ idWhatsApp: { $in: jidsUsuarios } })
        .select('idWhatsApp nome telefone')
        .lean();
      for (const u of usuarios) usuariosMap[u.idWhatsApp] = u;
    }

    const ranking = membros.map((m, i) => {
      const u = usuariosMap[m.idWhatsApp] || {};
      return {
        idWhatsApp: m.idWhatsApp,
        nome:       u.nome || u.telefone || m.idWhatsApp?.split('@')[0] || 'Anônimo',
        xp:         m.xp        ?? 0,
        gold:       m.gold      ?? 0,
        mensagens:  m.mensagens ?? 0,
        level:      m.level ?? calcularLevel(m.xp),
        posicao:    i + 1,
      };
    });

    const total = await CarteiraGrupo.countDocuments({ idGrupo: jid });

    return res.json({ ranking, total });
  } catch (err) {
    console.error('[API] GET /user/ranking/grupo:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS AUTENTICADAS (JWT de sessão)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/user/me
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

    const levelGlobal = calcularLevel(xpTotal);

    const xpParaProximo = Math.ceil(100 * Math.pow(levelGlobal, 1.5));
    const xpInicioNivel = Math.ceil(100 * Math.pow(Math.max(0, levelGlobal - 1), 1.5));
    const xpNoNivel     = xpParaProximo - xpInicioNivel;
    const xpProgresso   = xpNoNivel > 0
      ? Math.min(100, Math.max(0, Math.floor(((xpTotal - xpInicioNivel) / xpNoNivel) * 100)))
      : 100;

    const posicaoResult = await CarteiraGrupo.aggregate([
      { $group: { _id: '$idWhatsApp', xpTotal: { $sum: '$xp' } } },
      { $match: { xpTotal: { $gt: xpTotal } } },
      { $count: 'acima' },
    ]);
    const posicaoRanking = (posicaoResult[0]?.acima ?? 0) + 1;

    const grupos = carteiras.map(c => ({
      jid:          c.idGrupo,
      nome:         nomeGrupo(c, c.idGrupo),
      xp:           c.xp           ?? 0,
      level:        c.level        ?? 1,
      gold:         c.gold         ?? 0,
      mensagens:    c.mensagens    ?? 0,
      empregoAtual: c.empregoAtual ?? null,
      varaEquipada: c.varaEquipada ?? null,
      statsPesca:   c.statsPesca   ?? null,
    }));

    // Resolve casadoCom: se for @lid, tenta achar o telefone real no LidMapping
    let casadoComResolvido = usuario.casadoCom ?? null;
    if (casadoComResolvido && casadoComResolvido.endsWith('@lid')) {
      const mapa = await LidMapping.findOne({ lid: casadoComResolvido }).lean();
      if (mapa?.pn) casadoComResolvido = mapa.pn;
    }

    // xpHistory: garante que é um objeto plano com chaves "YYYY-MM-DD"
    const xpHistoryRaw  = mapParaObjeto(usuario.xpHistory);
    const xpHistoryLimpo = {};
    for (const [k, v] of Object.entries(xpHistoryRaw)) {
      // aceita só chaves no formato de data válido e valores numéricos
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(Number(v))) {
        xpHistoryLimpo[k] = Number(v);
      }
    }

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

      xpHistory:        xpHistoryLimpo,
      atividadeSemanal: usuario.atividadeSemanal || [0, 0, 0, 0, 0, 0, 0],
      inventory:        mapParaObjeto(usuario.inventory),
      goldHistory:      (usuario.goldHistory || []).slice(-20),
      pet:              usuario.pet        ?? null,
      casadoCom:        casadoComResolvido,
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
router.get('/user/grupos', auth, async (req, res) => {
  try {
    const carteiras = await CarteiraGrupo
      .find({ idWhatsApp: req.user.idWhatsApp })
      .sort({ xp: -1 })
      .lean();

    // Busca nomes reais dos grupos a partir de qualquer carteira que tenha o campo
    const jidsGruposUser = carteiras.map(c => c.idGrupo);
    const nomesGruposMap = {};
    if (jidsGruposUser.length) {
      const docsNomes = await CarteiraGrupo.aggregate([
        { $match: { idGrupo: { $in: jidsGruposUser } } },
        { $group: {
          _id:        '$idGrupo',
          nomeCustom: { $first: { $ifNull: ['$nomeCustom', null] } },
          nomeReal:   { $first: { $ifNull: ['$nomeReal',   null] } },
        }},
      ]);
      for (const d of docsNomes) nomesGruposMap[d._id] = nomeGrupo(d, d._id);
    }

    const grupos = carteiras.map(c => ({
      jid:          c.idGrupo,
      nome:         nomesGruposMap[c.idGrupo] || nomeGrupoFallback(c.idGrupo),
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/usuarios
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/usuarios', adminAuth, async (req, res) => {
  try {
    const todos = await Usuario
      .find({})
      .select('nome telefone idWhatsApp warnings banido')
      .lean();

    const comWarns = todos
      .map(u => ({
        nome:          u.nome || u.telefone || 'Anônimo',
        telefone:      u.telefone || u.idWhatsApp?.split('@')[0] || '—',
        idWhatsApp:    u.idWhatsApp,
        warns:         somarMap(u.warnings),
        warnsPorGrupo: mapParaObjeto(u.warnings),
        banido:        !!u.banido,
      }))
      .filter(u => u.warns > 0 || u.banido)
      .sort((a, b) => b.warns - a.warns);

    return res.json({ usuarios: comWarns });
  } catch (err) {
    console.error('[API] GET /admin/usuarios:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/usuario/:idWhatsApp
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/usuario/:idWhatsApp', adminAuth, async (req, res) => {
  try {
    const jid = normalizarJid(decodeURIComponent(req.params.idWhatsApp));

    const [usuario, carteiras] = await Promise.all([
      Usuario.findOne({ idWhatsApp: jid }).lean(),
      CarteiraGrupo.find({ idWhatsApp: jid }).sort({ xp: -1 }).lean(),
    ]);

    if (!usuario && !carteiras.length)
      return res.status(404).json({ error: 'Usuário não encontrado.' });

    const xpTotal        = carteiras.reduce((s, c) => s + (c.xp        ?? 0), 0);
    const goldTotal      = carteiras.reduce((s, c) => s + (c.gold      ?? 0), 0);
    const mensagensTotal = carteiras.reduce((s, c) => s + (c.mensagens ?? 0), 0);
    const levelGlobal    = calcularLevel(xpTotal);

    // Resolve nomes dos grupos usando agregação
    const jidsGrupos = carteiras.map(c => c.idGrupo);
    const gruposDocs = jidsGrupos.length
      ? await CarteiraGrupo.aggregate([
          { $match: { idGrupo: { $in: jidsGrupos } } },
          { $group: { _id: '$idGrupo', nomeCustom: { $first: '$nomeCustom' }, nomeReal: { $first: '$nome' } } }
        ])
      : [];
    const nomesMap = Object.fromEntries(gruposDocs.map(g => [g._id, nomeGrupo(g, g._id)]));

    const grupos = carteiras.map(c => ({
      idGrupo:      c.idGrupo,
      nomeGrupo:    nomesMap[c.idGrupo] || nomeGrupoFallback(c.idGrupo),
      xp:           c.xp           ?? 0,
      level:        c.level        ?? 1,
      gold:         c.gold         ?? 0,
      mensagens:    c.mensagens    ?? 0,
      empregoAtual: c.empregoAtual ?? null,
    }));

    return res.json({
      usuario: {
        idWhatsApp: jid,
        nome:       usuario?.nome     || '(sem nome)',
        telefone:   usuario?.telefone || jid.split('@')[0],
        xp:         xpTotal,
        level:      levelGlobal,
        gold:       goldTotal,
        mensagens:  mensagensTotal,
        grupos,
      }
    });
  } catch (err) {
    console.error('[API] GET /admin/usuario/:id:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/warn/:idWhatsApp?grupo=xxx
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/usuario/:idWhatsApp/ban
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/usuario/:idWhatsApp/ban', adminAuth, async (req, res) => {
  try {
    const { idWhatsApp } = req.params;
    const { banido }     = req.body || {};

    if (typeof banido !== 'boolean')
      return res.status(400).json({ error: '"banido" deve ser true ou false.' });

    const usuario = await Usuario.findOneAndUpdate(
      { idWhatsApp },
      { $set: { banido } },
      { new: true }
    ).lean();

    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    return res.json({ ok: true, idWhatsApp, banido: !!usuario.banido });
  } catch (err) {
    console.error('[API] PATCH /admin/usuario/ban:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/usuario/:idWhatsApp/gold
// Dá ou remove gold de um usuário em um grupo específico.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/usuario/:idWhatsApp/gold', adminAuth, async (req, res) => {
  try {
    const termoOriginal = decodeURIComponent(req.params.idWhatsApp);
    const { idGrupo, valor, operacao } = req.body || {};

    if (!idGrupo)
      return res.status(400).json({ error: 'idGrupo é obrigatório.' });
    if (!Number.isFinite(valor) || valor <= 0)
      return res.status(400).json({ error: 'valor deve ser um número positivo.' });
    if (!['dar', 'remover'].includes(operacao))
      return res.status(400).json({ error: 'operacao deve ser "dar" ou "remover".' });

    // Resolve qual variante do JID (com/sem o "9") já existe nesse grupo
    const idWhatsApp = await resolverIdWhatsApp(termoOriginal, idGrupo);

    if (operacao === 'remover') {
      const existe = await CarteiraGrupo.exists({ idWhatsApp, idGrupo });
      if (!existe)
        return res.status(404).json({ error: 'Esse usuário ainda não tem carteira nesse grupo (nada para remover).' });
    }

    const incremento = operacao === 'dar' ? valor : -valor;

    const carteira = await CarteiraGrupo.findOneAndUpdate(
      { idWhatsApp, idGrupo },
      { $inc: { gold: incremento } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    if (carteira.gold < 0) {
      await CarteiraGrupo.updateOne({ idWhatsApp, idGrupo }, { $set: { gold: 0 } });
      carteira.gold = 0;
    }

    return res.json({ ok: true, idWhatsApp, goldAtual: carteira.gold });
  } catch (err) {
    console.error('[API] PATCH /admin/usuario/gold:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/usuario/:idWhatsApp/gold/reset
// Zera o gold do usuário em todos os grupos.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/admin/usuario/:idWhatsApp/gold/reset', adminAuth, async (req, res) => {
  try {
    const idWhatsApp = normalizarJid(decodeURIComponent(req.params.idWhatsApp));

    const resultado = await CarteiraGrupo.updateMany(
      { idWhatsApp },
      { $set: { gold: 0 } }
    );

    if (!resultado.matchedCount)
      return res.status(404).json({ error: 'Nenhuma carteira encontrada para esse usuário.' });

    return res.json({ ok: true, gruposAtualizados: resultado.modifiedCount });
  } catch (err) {
    console.error('[API] DELETE /admin/usuario/gold/reset:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/gold/transferir
// Transfere gold de um usuário (origem) para outro (destino) dentro do mesmo grupo.
//
// Body: { idGrupo, idOrigem, idDestino, valor }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin/gold/transferir', adminAuth, async (req, res) => {
  try {
    const { idGrupo, idOrigem, idDestino, valor } = req.body || {};

    if (!idGrupo)
      return res.status(400).json({ error: 'idGrupo é obrigatório.' });
    if (!idOrigem || !idDestino)
      return res.status(400).json({ error: 'idOrigem e idDestino são obrigatórios.' });
    if (!Number.isFinite(valor) || valor <= 0)
      return res.status(400).json({ error: 'valor deve ser um número positivo.' });

    const jidOrigem  = normalizarJid(idOrigem);
    const jidDestino = normalizarJid(idDestino);

    if (jidOrigem === jidDestino)
      return res.status(400).json({ error: 'Origem e destino não podem ser o mesmo usuário.' });

    // Verifica saldo da origem
    const carteiraOrigem = await CarteiraGrupo.findOne({ idWhatsApp: jidOrigem, idGrupo }).lean();
    if (!carteiraOrigem)
      return res.status(404).json({ error: 'Carteira de origem não encontrada.' });
    if ((carteiraOrigem.gold || 0) < valor)
      return res.status(400).json({ error: `Saldo insuficiente. Origem tem ${carteiraOrigem.gold || 0} gold.` });

    // Verifica se o destino existe no grupo (cria se não existir via upsert)
    const [, carteiraDestinoAtual] = await Promise.all([
      CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: jidOrigem,  idGrupo },
        { $inc: { gold: -valor } },
        { new: true }
      ),
      CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: jidDestino, idGrupo },
        { $inc: { gold: valor } },
        { new: true, upsert: true }
      ),
    ]);

    return res.json({
      ok: true,
      goldOrigem:  (carteiraOrigem.gold || 0) - valor,
      goldDestino: carteiraDestinoAtual.gold,
    });
  } catch (err) {
    console.error('[API] POST /admin/gold/transferir:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/grupo/:jid/config
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/grupo/:jid/nome
// ─────────────────────────────────────────────────────────────────────────────
const MAX_NOME_GRUPO = 80;

router.patch('/admin/grupo/:jid/nome', adminAuth, async (req, res) => {
  try {
    const jid  = decodeURIComponent(req.params.jid);
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';

    if (!nome) return res.status(400).json({ error: 'Nome não pode ser vazio.' });
    if (nome.length > MAX_NOME_GRUPO)
      return res.status(400).json({ error: `Nome muito longo (máx ${MAX_NOME_GRUPO} caracteres).` });

    const resultado = await CarteiraGrupo.updateMany(
      { idGrupo: jid },
      { $set: { nomeCustom: nome } }
    );

    if (!resultado.matchedCount)
      return res.status(404).json({ error: 'Nenhum registro encontrado para esse grupo.' });

    return res.json({ ok: true, jid, nome });
  } catch (err) {
    console.error('[API] PATCH /admin/grupo/nome:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/grupo/:jid/mensagens
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/grupo/:jid/gold-ranking
// Retorna o ranking de gold dos membros de um grupo específico (top 20).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/grupo/:jid/gold-ranking', adminAuth, async (req, res) => {
  try {
    const jid   = decodeURIComponent(req.params.jid);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const membros = await CarteiraGrupo
      .find({ idGrupo: jid, gold: { $gt: 0 } })
      .sort({ gold: -1 })
      .limit(limit)
      .lean();

    // Enriquece com nome do Usuario
    const jids = membros.map(m => m.idWhatsApp);
    const usuariosMap = {};
    if (jids.length) {
      const usuarios = await Usuario.find({ idWhatsApp: { $in: jids } })
        .select('idWhatsApp nome telefone')
        .lean();
      for (const u of usuarios) usuariosMap[u.idWhatsApp] = u;
    }

    const ranking = membros.map(m => {
      const u         = usuariosMap[m.idWhatsApp] || {};
      const numeroPuro = m.idWhatsApp?.split('@')[0] || '';
      return {
        idWhatsApp: m.idWhatsApp,
        nome:       u.nome || u.telefone || numeroPuro || '—',
        telefone:   u.telefone || numeroPuro || '—', // sempre mandado separado, mesmo quando há nome
        gold:       m.gold ?? 0,
        xp:         m.xp   ?? 0,
        level:      m.level ?? 1,
      };
    });

    return res.json({ ranking });
  } catch (err) {
    console.error('[API] GET /admin/grupo/:jid/gold-ranking:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/grupo/:jid/gold/reset
// Zera o gold de TODOS os membros de um grupo.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/admin/grupo/:jid/gold/reset', adminAuth, async (req, res) => {
  try {
    const jid = decodeURIComponent(req.params.jid);

    const resultado = await CarteiraGrupo.updateMany(
      { idGrupo: jid },
      { $set: { gold: 0 } }
    );

    if (!resultado.matchedCount)
      return res.status(404).json({ error: 'Nenhum membro encontrado nesse grupo.' });

    return res.json({ ok: true, membrosAtualizados: resultado.modifiedCount });
  } catch (err) {
    console.error('[API] DELETE /admin/grupo/:jid/gold/reset:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/economia
// Estatísticas globais de economia + top 10 por gold, xp e mensagens.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/economia', adminAuth, async (req, res) => {
  try {
    // Agrega por usuário (soma de todos os grupos)
    const [totais, topGoldRaw, topXpRaw, topMsgsRaw] = await Promise.all([
      // Totais gerais
      CarteiraGrupo.aggregate([
        {
          $group: {
            _id:          null,
            totalGold:    { $sum: '$gold' },
            totalXp:      { $sum: '$xp' },
            totalMsgs:    { $sum: '$mensagens' },
            comGold:      { $sum: { $cond: [{ $gt: ['$gold', 0] }, 1, 0] } },
            totalUsuarios: { $addToSet: '$idWhatsApp' },
          }
        }
      ]),
      // Top 10 gold (por usuário, soma de todos os grupos)
      CarteiraGrupo.aggregate([
        { $match: { gold: { $gt: 0 } } },
        { $group: { _id: '$idWhatsApp', gold: { $sum: '$gold' }, nomeGrupo: { $first: '$idGrupo' } } },
        { $sort: { gold: -1 } },
        { $limit: 10 },
      ]),
      // Top 10 XP
      CarteiraGrupo.aggregate([
        { $match: { xp: { $gt: 0 } } },
        { $group: { _id: '$idWhatsApp', xp: { $sum: '$xp' } } },
        { $sort: { xp: -1 } },
        { $limit: 10 },
      ]),
      // Top 10 mensagens
      CarteiraGrupo.aggregate([
        { $match: { mensagens: { $gt: 0 } } },
        { $group: { _id: '$idWhatsApp', mensagens: { $sum: '$mensagens' } } },
        { $sort: { mensagens: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Enriquece tops com nomes de usuário
    const todosJids = [
      ...topGoldRaw, ...topXpRaw, ...topMsgsRaw
    ].map(x => x._id);
    const usuariosMap = {};
    if (todosJids.length) {
      const us = await Usuario.find({ idWhatsApp: { $in: todosJids } })
        .select('idWhatsApp nome telefone')
        .lean();
      for (const u of us) usuariosMap[u.idWhatsApp] = u;
    }

    function enriquecer(lista, campoValor) {
      return lista.map(item => {
        const u = usuariosMap[item._id] || {};
        return {
          idWhatsApp: item._id,
          nome:       u.nome || u.telefone || item._id?.split('@')[0] || '—',
          [campoValor]: item[campoValor],
        };
      });
    }

    const t = totais[0] || {};

    return res.json({
      totalGold:              t.totalGold || 0,
      totalXp:                t.totalXp   || 0,
      totalMsgs:              t.totalMsgs  || 0,
      totalUsuariosComGold:   t.comGold    || 0,
      mediaGold: (t.comGold && t.comGold > 0)
        ? Math.round((t.totalGold || 0) / t.comGold)
        : 0,
      topGold: enriquecer(topGoldRaw,  'gold'),
      topXp:   enriquecer(topXpRaw,   'xp'),
      topMsgs: enriquecer(topMsgsRaw, 'mensagens'),
    });
  } catch (err) {
    console.error('[API] GET /admin/economia:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/logs
// Retorna logs do bot com paginação, filtro por tipo e busca por texto.
//
// Query params: pagina, limite, tipo (cmd|erro|warn|info), busca
//
// ⚠️ Requer um model BotLog (models/BotLog.js) com schema:
//   { timestamp, tipo, comando, mensagem, detalhe, usuario, grupo }
//
// Se o model não existir ainda, a rota retorna array vazio sem erro,
// então o frontend simplesmente exibe "Nenhum log encontrado" até
// você criar o model e começar a salvar logs no bot.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/logs', adminAuth, async (req, res) => {
  try {
    let BotLog;
    try {
      BotLog = require('../models/BotLog');
    } catch {
      // Model ainda não existe — retorna vazio graciosamente
      return res.json({ logs: [], total: 0 });
    }

    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
    const tipo   = req.query.tipo  || null;
    const busca  = req.query.busca || null;

    const filtro = {};
    if (tipo)  filtro.tipo = tipo;
    if (busca) {
      const re = new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [
        { comando:  re },
        { mensagem: re },
        { detalhe:  re },
        { usuario:  re },
        { grupo:    re },
      ];
    }

    const [logs, total] = await Promise.all([
      BotLog.find(filtro)
        .sort({ timestamp: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      BotLog.countDocuments(filtro),
    ]);

    return res.json({ logs, total });
  } catch (err) {
    console.error('[API] GET /admin/logs:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

module.exports = router;