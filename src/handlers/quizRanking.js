'use strict';

/**
 * Sistema de Premiação Semanal de Quiz
 * - Todo domingo às 15:30h
 * - Avisos: 1h antes, 10min antes, 5min antes
 * - Top 3 por grupo ganham gold
 * - quizPoints resetam após premiação
 */

const CarteiraGrupo = require('../models/CarteiraGrupo');

const PREMIOS = [1000, 500, 350];
const MEDALS  = ['🥇', '🥈', '🥉'];

const DOMINGO   = 0;   // 0 = domingo
const HORA      = 15;
const MINUTO    = 30;

// ─── Controle de avisos já enviados ──────────────────────────────────────────
// Chave: `${anoSemana}` → Set de avisos já disparados ('60min','10min','5min','premio')
const avisosEnviados = new Map();

function getWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function getAvisosSet() {
  const key = getWeekKey();
  if (!avisosEnviados.has(key)) avisosEnviados.set(key, new Set());
  return avisosEnviados.get(key);
}

// ─── Calcula quantos ms faltam para o próximo domingo 15:30 ──────────────────
function msParaProximoDomingo() {
  const now  = new Date();
  const alvo = new Date();

  alvo.setDate(now.getDate() + ((DOMINGO - now.getDay() + 7) % 7));
  alvo.setHours(HORA, MINUTO, 0, 0);

  if (alvo <= now) alvo.setDate(alvo.getDate() + 7);
  return alvo - now;
}

// ─── Premiação ────────────────────────────────────────────────────────────────
async function executarPremiacao(sock, gruposAtivos) {
  console.log('[QuizRanking] Executando premiação semanal...');

  for (const groupJid of gruposAtivos) {
    try {
      const top3 = await CarteiraGrupo.find({ idGrupo: groupJid, quizPoints: { $gt: 0 } })
        .sort({ quizPoints: -1 })
        .limit(3)
        .lean();

      if (!top3.length) continue;

      let texto = `🏆 *PREMIAÇÃO SEMANAL DE QUIZ!* 🏆\n\n`;
      texto += `Parabéns aos campeões desta semana!\n\n`;

      const mentions = [];

      for (let i = 0; i < top3.length; i++) {
        const u = top3[i];
        const gold = PREMIOS[i];

        await CarteiraGrupo.findOneAndUpdate(
          { idWhatsApp: u.idWhatsApp, idGrupo: groupJid },
          { $inc: { gold }, $set: { quizPoints: 0 } },
          { upsert: true }
        );

        texto += `${MEDALS[i]} *@${u.idWhatsApp.split('@')[0]}* — ${u.quizPoints} pts → *+${gold} gold!*\n`;
        mentions.push(u.idWhatsApp);
      }

      // Zera todos os outros do grupo também
      await CarteiraGrupo.updateMany(
        { idGrupo: groupJid, quizPoints: { $gt: 0 } },
        { $set: { quizPoints: 0 } }
      );

      texto += `\n_Os pontos foram resetados. Boa sorte na próxima semana!_ 🍀\n`;
      texto += `_Use *!quiz* para acumular pontos!_`;

      await sock.sendMessage(groupJid, { text: texto, mentions });
      console.log(`[QuizRanking] Premiação enviada para ${groupJid}`);

    } catch (e) {
      console.error(`[QuizRanking] Erro no grupo ${groupJid}:`, e.message);
    }
  }
}

// ─── Aviso ────────────────────────────────────────────────────────────────────
async function enviarAviso(sock, gruposAtivos, tipo) {
  const textos = {
    '60min': `⏰ *ATENÇÃO!* A premiação semanal de quiz começa em *1 hora!*\n\n🏆 Top 3 ganham:\n🥇 1.000 gold\n🥈 500 gold\n🥉 350 gold\n\n_Joga *!quiz* agora pra subir no ranking!_`,
    '10min': `🔔 *Faltam apenas 10 minutos* para a premiação semanal de quiz!\n\n_Use *!rankjogos* para ver sua posição!_`,
    '5min':  `🚨 *ÚLTIMOS 5 MINUTOS!* A premiação começa já já!\n\n_Última chance de jogar *!quiz* e subir no ranking!_ 🏃`,
  };

  for (const groupJid of gruposAtivos) {
    try {
      await sock.sendMessage(groupJid, { text: textos[tipo] });
    } catch (e) {
      console.error(`[QuizRanking] Erro ao enviar aviso ${tipo} para ${groupJid}:`, e.message);
    }
  }
}

// ─── Scheduler principal ──────────────────────────────────────────────────────
function initQuizRankingScheduler(sock, gruposAtivos) {
  console.log('[QuizRanking] Scheduler iniciado.');

  function agendar() {
    const msTotal   = msParaProximoDomingo();
    const ms60min   = msTotal - 60 * 60 * 1000;
    const ms10min   = msTotal - 10 * 60 * 1000;
    const ms5min    = msTotal -  5 * 60 * 1000;

    const avisos = getAvisosSet();

    if (ms60min > 0 && !avisos.has('60min')) {
      setTimeout(async () => {
        if (avisos.has('60min')) return;
        avisos.add('60min');
        await enviarAviso(sock, gruposAtivos, '60min');
      }, ms60min);
    }

    if (ms10min > 0 && !avisos.has('10min')) {
      setTimeout(async () => {
        if (avisos.has('10min')) return;
        avisos.add('10min');
        await enviarAviso(sock, gruposAtivos, '10min');
      }, ms10min);
    }

    if (ms5min > 0 && !avisos.has('5min')) {
      setTimeout(async () => {
        if (avisos.has('5min')) return;
        avisos.add('5min');
        await enviarAviso(sock, gruposAtivos, '5min');
      }, ms5min);
    }

    if (!avisos.has('premio')) {
      setTimeout(async () => {
        if (avisos.has('premio')) return;
        avisos.add('premio');
        await executarPremiacao(sock, gruposAtivos);
        // Agenda para a próxima semana
        setTimeout(agendar, 60 * 1000);
      }, msTotal);
    }

    const horas = Math.floor(msTotal / 3600000);
    const mins  = Math.floor((msTotal % 3600000) / 60000);
    console.log(`[QuizRanking] Próxima premiação em ${horas}h ${mins}min`);
  }

  agendar();
}

module.exports = { initQuizRankingScheduler };