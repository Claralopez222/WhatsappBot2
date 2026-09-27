'use strict';

const CarteiraGrupo = require('../../../models/CarteiraGrupo');

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function barraProgresso(valor, maximo, tamanho = 10) {
  if (!maximo || maximo <= 0) return '░'.repeat(tamanho);
  const preenchido = Math.min(Math.round((valor / maximo) * tamanho), tamanho);
  return '█'.repeat(preenchido) + '░'.repeat(tamanho - preenchido);
}

// !rankgold
async function handleRankGold(sock, msg, jid, contactNames = {}) {
  if (!jid?.endsWith('@g.us')) {
    await sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.',
    }, { quoted: msg });
    return;
  }

  try {
    // 1. Busca a lista de membros que realmente estão no grupo agora
    const metadata = await sock.groupMetadata(jid);
    const membrosAtuais = new Set(metadata.participants.map(p => p.id));

    // 2. Busca uma amostragem maior no banco para garantir que, filtrando os banidos, ainda sobrem 10
    const candidatos = await CarteiraGrupo.find({ idGrupo: jid, gold: { $gt: 0 } })
      .sort({ gold: -1 })
      .limit(100) // Puxa até 100 jogadores ativos localmente
      .lean();

    // 3. Filtra mantendo apenas quem ainda está presente no chat
    const top = candidatos
      .filter(u => membrosAtuais.has(u.idWhatsApp))
      .slice(0, 10); // Mantém o Top 10 real e ativo

    if (!top?.length) {
      await sock.sendMessage(jid, {
        text: '💰 *RANKING DE GOLD*\n\nNenhum membro ativo com Gold registrado neste grupo ainda!\n\n⛏️ Use *!garimpar* para começar a ganhar Gold.',
      }, { quoted: msg });
      return;
    }

    const totalGold = top.reduce((s, u) => s + (u.gold || 0), 0);
    const maxGold   = top[0].gold || 1;

    const linhas = top.map((u, i) => {
      const count = u.gold || 0;
      const pct   = ((count / totalGold) * 100).toFixed(1);
      const bar    = barraProgresso(count, maxGold);
      const numero = u.idWhatsApp.split('@')[0].split(':')[0];
      const medal  = MEDALS[i];

      // Mudança para mencionar via @ em vez de injetar o nome de contato salvo
      return `${medal} @${numero}\n   ${bar} ${count} 💰 (${pct}%)`;
    }).join('\n\n');

    const mentions = top.map(u => u.idWhatsApp);

    await sock.sendMessage(jid, {
      text:
        `💰 *RANKING DE GOLD — MEMBROS ATIVOS* 💰\n\n` +
        `${linhas}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🏦 Total do Top 10: *${totalGold} Gold*\n` +
        `⛏️ Use *!garimpar* para subir no ranking!`,
      mentions,
    }, { quoted: msg });

  } catch (err) {
    console.error('[handleRankGold] Erro:', err.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao carregar o ranking. Tente novamente. ',
    }, { quoted: msg });
  }
}

module.exports = { handleRankGold };