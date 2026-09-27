'use strict';

const Usuario      = require('../../models/Usuario');
const GrupoConfig  = require('../../models/GrupoConfig');
const { normalizarJid } = require('../../utils/jid');

const {
  somenteGrupo,
  checkAdmin,
  getGroupMetadataCached,
  isMuted,
  mutedCount,
} = require('./helpers');

// ═══════════════════════════════════════════════════════════════
// ─── !grupinfo ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleGrupInfo(sock, msg, jid) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return;
  }

  let meta;
  try {
    meta = await getGroupMetadataCached(sock, jid);
  } catch (err) {
    console.error('[handleGrupInfo] Erro:', err.message);
    await sock.sendMessage(jid, {
      text: '❌ Não consegui buscar as informações do grupo.',
    }, { quoted: msg }); return;
  }

  const total   = meta.participants.length;
  const admins  = meta.participants.filter(p => p.admin).length;
  const membros = total - admins;
  const criado  = meta.creation
    ? new Date(meta.creation * 1000).toLocaleDateString('pt-BR')
    : '?';
  const desc    = meta.desc ? meta.desc.slice(0, 200) : '_Sem descrição_';
  const fechado = meta.announce ? '🔒 Fechado' : '🔓 Aberto';

  const cfgGrupo = await GrupoConfig.findOne({ idGrupo: jid }).lean();

  const slowCfg  = cfgGrupo?.slowModeAtivo
    ? `✅ *${cfgGrupo.slowModeSegundos}s por msg*`
    : '❌ Inativo';
  const floodCfg = cfgGrupo?.antiFloodAtivo
    ? `✅ *${cfgGrupo.antiFloodLimite} msgs/${cfgGrupo.antiFloodJanelaMs / 1000}s*`
    : '❌ Inativo';
  
  // Correção: Leitura do status de Boas-Vindas diretamente do MongoDB (GrupoConfig)
  const bvCfg    = cfgGrupo?.bemVindoAtivo !== false && cfgGrupo?.bemVindoAtivo
    ? '✅ Ativo'
    : '❌ Inativo';
    
  const muteCfg  = mutedCount(jid) > 0
    ? `✅ *${mutedCount(jid)} mutado(s)*`
    : '❌ Nenhum';

  await sock.sendMessage(jid, {
    text:
      `📋 *INFORMAÇÕES DO GRUPO*\n\n` +
      `📌 *Nome:* ${meta.subject}\n` +
      `📅 *Criado em:* ${criado}\n` +
      `🔑 *Status:* ${fechado}\n\n` +
      `👥 *Membros:* ${membros}\n` +
      `👑 *Admins:* ${admins}\n` +
      `📊 *Total:* ${total}\n\n` +
      `⏱️ *Slow Mode:* ${slowCfg}\n` +
      `🛡️ *Anti-Flood:* ${floodCfg}\n` +
      `🔇 *Mutados:* ${muteCfg}\n` +
      `👋 *Boas-vindas:* ${bvCfg}\n\n` +
      `📝 *Descrição:*\n${desc}`,
  }, { quoted: msg });
}

async function handleListaAdm(sock, msg, jid, contactNames) {
  if (!jid.endsWith('@g.us')) {
    await sock.sendMessage(jid, { text: '⚠️ Este comando só funciona em grupos.' }, { quoted: msg });
    return;
  }

  let meta;
  try {
    meta = await getGroupMetadataCached(sock, jid);
  } catch (err) {
    console.error('[handleListaAdm] Erro ao buscar metadados:', err.message);
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar os membros do grupo.' }, { quoted: msg });
    return;
  }

  const admins = meta.participants.filter(p => p.admin);

  if (admins.length === 0) {
    await sock.sendMessage(jid, { text: 'ℹ️ Nenhum administrador encontrado neste grupo.' }, { quoted: msg });
    return;
  }

  const mentions = admins.map(p => p.id);

  const linhas = admins.map((p, i) => {
    const numero = p.id.split('@')[0];
    const nome   = contactNames?.[p.id] || `@${numero}`;
    const tipo   = p.admin === 'superadmin' ? '👑 Dono' : '🛡️ Admin';
    return `${i + 1}. ${nome} — ${tipo}`;
  }).join('\n');

  await sock.sendMessage(jid, {
    text: `👑 *ADMINISTRADORES DO GRUPO*\n\n${linhas}\n\n_Total: ${admins.length} admin(s)_`,
    mentions,
  }, { quoted: msg });
}

async function handleListaMembros(sock, msg, jid, contactNames) {
  if (!jid.endsWith('@g.us')) {
    await sock.sendMessage(jid, { text: '⚠️ Este comando só funciona em grupos.' }, { quoted: msg });
    return;
  }

  if (!await checkAdmin(sock, msg, jid, 'listamembros')) return;

  let meta;
  try {
    meta = await getGroupMetadataCached(sock, jid);
  } catch (err) {
    console.error('[handleListaMembros] Erro ao buscar metadados:', err.message);
    await sock.sendMessage(jid, { text: '❌ Não consegui buscar os membros do grupo.' }, { quoted: msg });
    return;
  }

  const todos   = meta.participants;
  const membros = todos.filter(p => !p.admin);
  const total   = todos.length;

  if (membros.length === 0) {
    await sock.sendMessage(jid, {
      text: 'ℹ️ Nenhum membro não-admin encontrado neste grupo.',
    }, { quoted: msg });
    return;
  }

  const MAX = 30;
  const chunks = [];
  for (let i = 0; i < membros.length; i += MAX) {
    chunks.push(membros.slice(i, i + MAX));
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk    = chunks[ci];
    const mentions = chunk.map(p => p.id);

    const linhas = chunk.map((p, i) => {
      const numero = p.id.split('@')[0];
      const nome   = contactNames?.[p.id] || `@${numero}`;
      const mutado = isMuted(jid, p.id) ? ' 🔇' : '';
      const inicio = ci * MAX + i + 1;
      return `${inicio}. ${nome} (+${numero})${mutado}`;
    }).join('\n');

    const de  = ci * MAX + 1;
    const ate = Math.min((ci + 1) * MAX, membros.length);

    await sock.sendMessage(jid, {
      text: `👥 *MEMBROS DO GRUPO* (${de}–${ate} de ${total})\n\n${linhas}`,
      mentions,
    }, { quoted: msg });

    if (ci < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !tempo ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleTempo(sock, msg, content, jid, author, contactNames) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, { text: '⚠️ Apenas em grupos.' }, { quoted: msg }); return;
  }

  const mentionedJid = content.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const senderJid    = msg.key.participant || msg.key.remoteJid;
  const alvoJid      = mentionedJid[0] || senderJid;

  let entradaTexto = '❓ desconhecido';
  let isFallback   = false;

  try {
    const meta = await getGroupMetadataCached(sock, jid);
    const part = meta.participants?.find(p => p.id === alvoJid || p.lid === alvoJid);

    const entradaMs = part?.joinedAt
      ? part.joinedAt * 1000
      : (() => { isFallback = true; return (meta.creation || 0) * 1000; })();

    const diffMs = Date.now() - entradaMs;
    const dias   = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const meses  = Math.floor(dias / 30);
    const anos   = Math.floor(dias / 365);

    if (anos > 0)       entradaTexto = `há *${anos} ano${anos > 1 ? 's' : ''}*`;
    else if (meses > 0) entradaTexto = `há *${meses} ${meses > 1 ? 'meses' : 'mês'}*`;
    else if (dias > 0)  entradaTexto = `há *${dias} dia${dias > 1 ? 's' : ''}*`;
    else                entradaTexto = `há *menos de 1 dia*`;

    if (isFallback) entradaTexto += ' _(estimativa — desde a criação do grupo)_';
  } catch (err) {
    console.error('[handleTempo] Erro:', err.message);
  }

  const frases = [
    `⏳ *@${alvoJid.split('@')[0]}* está nesse grupo ${entradaTexto}. Veterano(a) resistente! 🏅`,
    `📅 *@${alvoJid.split('@')[0]}* aguentou esse grupo ${entradaTexto}. Tem moral! 💪`,
    `🕰️ *@${alvoJid.split('@')[0]}* sobrevive aqui ${entradaTexto}. Corajoso(a)! 😂`,
    `📌 *@${alvoJid.split('@')[0]}* faz parte desse grupo ${entradaTexto}. Fidelidade máxima! 🤝`,
  ];

  await sock.sendMessage(jid, {
    text: frases[Math.floor(Math.random() * frases.length)],
    mentions: [alvoJid],
  }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════════
// ─── !adv / !advertencia ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleAdvertencia(sock, msg, jid) {
  if (!somenteGrupo(jid)) {
    return sock.sendMessage(
      jid,
      { text: '⚠️ Esse comando só funciona em grupos.' },
      { quoted: msg }
    );
  }

  const senderJidRaw = msg.key.participant || msg.key.remoteJid;
  const senderJid     = senderJidRaw ? normalizarJid(senderJidRaw) : null;
  if (!senderJid) return;

  const groupKey = jid.replace(/\./g, '_');

  let usuario;
  try {
    usuario = await Usuario.findOne(
      { idWhatsApp: senderJid },
      { warnings: 1 }
    ).lean();
  } catch (err) {
    console.error('[handleAdvertencia] Erro ao buscar usuário:', err.message);
    return sock.sendMessage(
      jid,
      { text: '❌ Erro ao consultar suas advertências. Tente novamente.' },
      { quoted: msg }
    );
  }

  const atual = Math.max(0, Number(usuario?.warnings?.[groupKey] ?? 0));

  if (atual === 0) {
    return sock.sendMessage(
      jid,
      { text: '✅ Você está limpo(a)! Sem advertências neste grupo.' },
      { quoted: msg }
    );
  }

  const nivelEmoji = atual >= 3 ? '🔴' : atual === 2 ? '🟠' : '🟡';
  const restantes  = Math.max(0, 3 - atual);
  const statusMsg  = restantes === 0
    ? '🚨 *Você está no limite!* Qualquer nova advertência pode resultar em remoção.'
    : `⏳ Mais *${restantes}* e você será removido(a)!`;

  return sock.sendMessage(
    jid,
    {
      text:
        `${nivelEmoji} *SUAS ADVERTÊNCIAS NESTE GRUPO*\n\n` +
        `⚠️ Você tem *${atual}/3* advertência(s).\n` +
        `${statusMsg}\n\n` +
        `_Respeite as regras do grupo!_ 📜`,
    },
    { quoted: msg }
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── !ranking (mensagens) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function barraProgresso(valor, maximo, tamanho = 10) {
  if (!maximo || maximo <= 0) return '░'.repeat(tamanho);
  const filled = Math.min(Math.round((valor / maximo) * tamanho), tamanho);
  return '█'.repeat(filled) + '░'.repeat(tamanho - filled);
}

async function handleRanking(sock, msg, jid, msgCount = new Map()) {
  if (!jid?.endsWith('@g.us')) {
    await sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.',
    }, { quoted: msg });
    return;
  }

  try {
    const entradas = [...msgCount.entries()]
      .filter(([id]) => id.endsWith('@s.whatsapp.net') || id.endsWith('@c.us') || id.endsWith('@lid'))
      .map(([id, data]) => ({
        idWhatsApp: id,
        count: typeof data === 'object' ? (data.count ?? 0) : (data ?? 0),
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    if (!entradas.length) {
      await sock.sendMessage(jid, {
        text:
          `📊 *RANKING GERAL DE MENSAGENS*\n\n` +
          `📭 Nenhuma mensagem registrada ainda!\n\n` +
          `_Comece a conversar para aparecer no ranking!_`,
      }, { quoted: msg });
      return;
    }

    const totalMsgs = entradas.reduce((s, e) => s + e.count, 0);
    const maxCount  = entradas[0].count || 1;

    const linhas = entradas.map((e, i) => {
      const numero = e.idWhatsApp.split('@')[0].split(':')[0];
      const pct    = ((e.count / totalMsgs) * 100).toFixed(1);
      const bar    = barraProgresso(e.count, maxCount);
      return `${MEDALS[i]} *@${numero}*\n   ${bar} ${e.count} msgs (${pct}%)`;
    });

    const mentions = entradas.map(e => e.idWhatsApp);

    // Ajuste no cabeçalho para refletir com precisão a contagem global de mensagens
    await sock.sendMessage(jid, {
      text:
        `📊 *RANKING GERAL DE MENSAGENS* 📊\n\n` +
        `${linhas.join('\n\n')}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💬 Total: *${totalMsgs}* mensagens\n` +
        `👥 Participantes no ranking: *${entradas.length}*\n` +
        `_Continue conversando para subir no ranking!_`,
      mentions,
    }, { quoted: msg });

  } catch (e) {
    console.error('[Grupo] handleRanking:', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao carregar o ranking. Tente novamente!',
    }, { quoted: msg });
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── !linkgrupo ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function handleLinkGrupo(sock, msg, jid) {
  if (!jid.endsWith('@g.us')) {
    await sock.sendMessage(jid, { text: '⚠️ Este comando só funciona em grupos.' }, { quoted: msg });
    return;
  }
  if (!await checkAdmin(sock, msg, jid, 'linkgrupo')) return;

  try {
    const code = await sock.groupInviteCode(jid);
    await sock.sendMessage(jid, {
      text:
        `🔗 *Link de convite do grupo:*\n\n` +
        `https://chat.whatsapp.com/${code}\n\n` +
        `⚠️ _Compartilhe com cuidado! Qualquer pessoa com este link pode entrar no grupo._`,
    }, { quoted: msg });
  } catch (err) {
    console.error('[handleLinkGrupo] Erro ao obter link:', err.message);
    await sock.sendMessage(jid, {
      text: '❌ Não consegui obter o link do grupo. Verifique se o bot é administrador.',
    }, { quoted: msg });
  }
}

module.exports = {
  handleGrupInfo,
  handleListaAdm,
  handleListaMembros,
  handleTempo,
  handleAdvertencia,
  handleRanking,
  handleLinkGrupo,
};
