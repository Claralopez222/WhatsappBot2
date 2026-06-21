'use strict';

const crypto        = require('crypto');
const express       = require('express');
const jwt           = require('jsonwebtoken');
const router        = express.Router();
const AuthToken     = require('../models/AuthToken');
const Usuario       = require('../models/Usuario');
const CarteiraGrupo = require('../models/CarteiraGrupo');

// ─── Variáveis obrigatórias (Validação Lazy/Segura) ───────────────────────────
// Removemos o 'throw new Error' do escopo global. Agora a validação ocorre 
// dentro do middleware e das rotas que realmente utilizam a chave.
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

// Formata JID de grupo em nome legível como fallback
function nomeGrupoFallback(jid) {
  if (!jid) return 'Grupo sem nome';
  const numero = jid.replace('@g.us', '').replace('@s.whatsapp.net', '');
  return `Grupo ${numero.slice(0, 10)}…`;
}

// ✅ MELHORADO: Agora prioriza o nomeCustom (Painel), depois o nome (Sincronizado via Script do WhatsApp) 
// e só por último cai no Fallback feio baseado no JID.
function nomeGrupo(doc, jid) {
  const custom = doc && typeof doc.nomeCustom === 'string' ? doc.nomeCustom.trim() : '';
  if (custom) return custom;

  const realDoWhatsApp = doc && typeof doc.nomeReal === 'string' ? doc.nomeReal.trim() : '';
  return realDoWhatsApp || nomeGrupoFallback(jid);
}

// ─── MIDDLEWARE: JWT de sessão ────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token ausente.' });
  try {
    // Busca a chave de forma segura no momento do request
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
const tentativesLogin = new Map();
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
      getJwtSecret(), // Chamada segura aqui
      { expiresIn: '2h' }
    );

    return res.json({ jwt: sessionJwt });
  } catch (err) {
    console.error('[API] POST /auth/token:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/grupos
// Adicionado o campo 'nomeReal' no $group para fazer par com o script de atualização
router.get('/grupos', async (req, res) => {
  try {
    const grupos = await CarteiraGrupo.aggregate([
      { $match: { idGrupo: { $regex: /@g\.us$/ } } },
      {
        $group: {
          _id:         '$idGrupo',
          membros:     { $sum: 1 },
          xpTotal:     { $sum: '$xp' },
          nomeCustom:  { $first: '$nomeCustom' },
          nomeReal:    { $first: '$nome' }, // Captura o nome atualizado pelo script
          mensagens:   { $first: '$mensagens' },
          config:      { $first: '$config' },
        },
      },
      { $sort: { xpTotal: -1 } },
    ]);

    const resultado = grupos.map(g => ({
      jid:         g._id,
      idGrupo:     g._id,
      nome:        nomeGrupo(g, g._id),
      nomeCustom:  g.nomeCustom || null,
      membros:     g.membros,
      xpTotal:     g.xpTotal,
      mensagens:   g.mensagens || {},
      config:      g.config || {},
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
      nome:     nomeGrupo(c, c.idGrupo),
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
      nome:         nomeGrupo(c, c.idGrupo),
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
// FIX: agora também seleciona e devolve o campo "banido" — antes a query
// só pegava nome/telefone/idWhatsApp/warnings, então o admin.html nunca
// conseguia mostrar corretamente quem estava banido (sempre vinha undefined).
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

// PATCH /api/admin/usuario/:idWhatsApp/ban
// Bane ou desbane um usuário globalmente.
//
// ⚠️ Requer que o model Usuario.js tenha o campo:
//   banido: { type: Boolean, default: false }
// Sem isso, o Mongoose (modo strict, padrão) ignora silenciosamente o
// $set abaixo e a rota responde ok:true sem persistir nada.
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

// PATCH /api/admin/grupo/:jid/nome
// Define um nome de exibição manual para o grupo (nomeCustom), já que o
// CarteiraGrupo não guarda o nome real do grupo do WhatsApp — só o JID.
// Atualiza todos os documentos daquele grupo de uma vez (updateMany),
// então o nome fica consistente para todos os membros/queries.
//
// ⚠️ Requer que o model CarteiraGrupo.js tenha o campo:
//   nomeCustom: { type: String, default: null, trim: true }
// Sem isso, o Mongoose (modo strict, padrão) ignora silenciosamente o
// $set abaixo e a rota responde ok:true sem persistir nada.
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