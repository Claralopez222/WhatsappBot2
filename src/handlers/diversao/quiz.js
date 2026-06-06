/**
 * Sistema de Quiz — Piroquinhas Bot
 * Comandos: !quiz, !quizfut, !quizctec, !quizgeo, !quizmat, !pontos, !rankjogos
 * - 100+ questões muito difíceis
 * - Limite de 10 quiz por dia
 * - Pontos salvos na nuvem (MongoDB)
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));

const quizState = new Map(); // userId → { r: resposta, timeout }
const pontosMap = new Map(); // userId → pontos (sincroniza com MongoDB)
const quizDailyCount = new Map(); // userId_YYYY-MM-DD → count

const perguntasQuiz = [
  // FUTEBOL
  { p: '⚽ Qual país venceu a primeira Copa do Mundo em 1930?', r: 'uruguai', d: 'Futebol' },
  { p: '⚽ Quem é o maior artilheiro da história das Copas do Mundo?', r: 'miroslav klose', d: 'Futebol' },
  { p: '⚽ Qual clube brasileiro tem mais títulos da Copa Libertadores da América?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Em que ano o Brasil ganhou sua primeira Copa do Mundo?', r: '1958', d: 'Futebol' },
  { p: '⚽ Qual jogador detém o recorde de mais Bolas de Ouro ganhas?', r: 'lionel messi', d: 'Futebol' },
  { p: '⚽ Qual time venceu a UEFA Champions League na temporada 2022/2023?', r: 'manchester city', d: 'Futebol' },
  { p: '⚽ Quem é conhecido como o "Rei do Futebol"?', r: 'pele', d: 'Futebol' },
  { p: '⚽ Qual jogador francês ganhou a Bola de Ouro em 2022?', r: 'karim benzema', d: 'Futebol' },
  { p: '⚽ Qual estádio brasileiro sediou a final da Copa do Mundo de 1950?', r: 'maracana', d: 'Futebol' },
  { p: '⚽ Qual seleção europeia venceu a Copa do Mundo de 2010?', r: 'espanha', d: 'Futebol' },
  { p: '⚽ Quantas vezes o Brasil ganhou a Copa do Mundo?', r: '5', d: 'Futebol' },
  { p: '⚽ Qual jogador argentino ganhou a Bola de Ouro em 2021?', r: 'lionel messi', d: 'Futebol' },
  { p: '⚽ Em que ano Cristiano Ronaldo ganhou sua primeira Bola de Ouro?', r: '2008', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 2014?', r: 'alemanha', d: 'Futebol' },
  { p: '⚽ Qual clube venceu a Champions League em 2021?', r: 'chelsea', d: 'Futebol' },
  { p: '⚽ Quem ganhou a Bola de Ouro em 2023?', r: 'lionel messi', d: 'Futebol' },
  { p: '⚽ Qual jogador brasileiro é o maior artilheiro da seleção?', r: 'pele', d: 'Futebol' },
  { p: '⚽ Em quantos anos o Real Madrid venceu a Champions League?', r: '14', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Eurocopa de 2020?', r: 'italia', d: 'Futebol' },
  { p: '⚽ Qual time brasileiro tem mais Libertadores?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Quantos gols Pelé fez na carreira?', r: '1000', d: 'Futebol' },
  { p: '⚽ Em que ano foi a primeira Champions League?', r: '1955', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa América de 2021?', r: 'argentina', d: 'Futebol' },
  { p: '⚽ Quantas Copas do Mundo o Brasil participou?', r: '22', d: 'Futebol' },
  { p: '⚽ Qual jogador tem o recorde de assistências em Copas?', r: 'diego maradona', d: 'Futebol' },
  { p: '⚽ Em que ano Ronaldo Fenômeno ganhou sua primeira Bola de Ouro?', r: '1997', d: 'Futebol' },

  // HISTÓRIA
  { p: '📜 Em que ano começou a Revolução Francesa?', r: '1789', d: 'História' },
  { p: '🏛️ Qual imperador romano foi assassinado em 44 a.C.?', r: 'julio cesar', d: 'História' },
  { p: '⚔️ Em que ano terminou a Guerra dos Cem Anos?', r: '1453', d: 'História' },
  { p: '🗡️ Quantos anos durou a Guerra de Independência dos EUA?', r: '8', d: 'História' },
  { p: '⏰ Em que ano eclodiu a Revolução Russa de Outubro?', r: '1917', d: 'História' },
  { p: '💣 Qual ano foi o lançamento das bombas atômicas no Japão?', r: '1945', d: 'História' },
  { p: '🏰 Em que ano ocorreu a Queda do Muro de Berlim?', r: '1989', d: 'História' },
  { p: '⚖️ Em que ano foi assinada a Magna Carta?', r: '1215', d: 'História' },
  { p: '🌍 Qual foi o primeiro país a declarar guerra na Primeira Guerra Mundial?', r: 'austria', d: 'História' },
  { p: '🐘 Em que ano terminou a Independência da Índia?', r: '1947', d: 'História' },
  { p: '🗿 Qual faraó construiu a Grande Pirâmide?', r: 'quefren', d: 'História' },
  { p: '⛩️ Em que ano começou a Era Meiji no Japão?', r: '1868', d: 'História' },
  { p: '🎭 Quantos filósofos fizeram parte da Academia de Platão?', r: '400', d: 'História' },
  { p: '🔱 Qual líder criou o Império Otomano?', r: 'osmã i', d: 'História' },
  { p: '🗻 Em que ano foi a Restauração Meiji no Japão?', r: '1868', d: 'História' },
  { p: '💀 Em que ano ocorreu a Peste Negra na Europa?', r: '1348', d: 'História' },
  { p: '🏛️ Em que ano Roma foi fundada?', r: '753', d: 'História' },
  { p: '⚔️ Qual era a estratégia de Aníbal na Batalha de Cannas?', r: 'envolvimento duplo', d: 'História' },
  { p: '🌙 Em que ano começou o Califado Omíada?', r: '661', d: 'História' },
  { p: '🎪 Qual civilização construiu Machu Picchu?', r: 'inca', d: 'História' },

  // GEOGRAFIA
  { p: '🏔️ Qual é a capital do Nepal?', r: 'katmandu', d: 'Geografia' },
  { p: '🌊 Qual é o segundo maior oceano do mundo?', r: 'atlantico', d: 'Geografia' },
  { p: '🏖️ Qual é a capital de Timor Leste?', r: 'dili', d: 'Geografia' },
  { p: '📍 Qual país tem a maior área de floresta tropical?', r: 'brasil', d: 'Geografia' },
  { p: '🗻 Qual é o vulcão mais alto do mundo?', r: 'ojos del salado', d: 'Geografia' },
  { p: '🌏 Qual é a capital de Brunei?', r: 'bandar seri begawan', d: 'Geografia' },
  { p: '🏙️ Qual cidade é conhecida como a Veneza da Ásia?', r: 'bangkok', d: 'Geografia' },
  { p: '🌐 Qual é o rio mais longo da Europa?', r: 'volga', d: 'Geografia' },
  { p: '⛰️ Qual é o deserto mais quente do mundo?', r: 'sahara', d: 'Geografia' },
  { p: '🏝️ Qual é o país com mais ilhas do mundo?', r: 'suecia', d: 'Geografia' },
  { p: '🌎 Qual é o país com maior população?', r: 'india', d: 'Geografia' },
  { p: '🗻 Qual montanha tem a maior proeminência de base?', r: 'everest', d: 'Geografia' },
  { p: '🌊 Qual é o lago de água doce mais profundo do mundo?', r: 'baikal', d: 'Geografia' },
  { p: '🏙️ Qual é a capital mais alta do mundo?', r: 'la paz', d: 'Geografia' },
  { p: '⛪ Em qual país fica o Vale do Danúbio?', r: 'romenia', d: 'Geografia' },
  { p: '🏜️ Qual é o maior deserto frio do mundo?', r: 'gobi', d: 'Geografia' },
  { p: '🌴 Qual é o país mais seco do mundo?', r: 'ataca', d: 'Geografia' },
  { p: '🏔️ Qual é o estado com maior altitude do Brasil?', r: 'minas gerais', d: 'Geografia' },
  { p: '🗺️ Qual é o país menos populoso do mundo?', r: 'vaticano', d: 'Geografia' },
  { p: '🌊 Qual estreito separa a Europa da Ásia?', r: 'bosfor', d: 'Geografia' },
  { p: '🏛️ Qual é a capital mais antiga do mundo ainda habitada?', r: 'damasco', d: 'Geografia' },
  { p: '🏝️ Qual é a maior ilha do Caribe?', r: 'cuba', d: 'Geografia' },
  { p: '👑 Qual é o país com mais vulcões ativos?', r: 'indonesia', d: 'Geografia' },
  { p: '🌲 Qual país tem a maior floresta boreal?', r: 'russia', d: 'Geografia' },
  { p: '🗿 Em qual país fica o Stonehenge?', r: 'inglaterra', d: 'Geografia' },

  // CIÊNCIA & TECNOLOGIA
  { p: '⚛️ Qual é o número atômico do ferro?', r: '26', d: 'Ciência' },
  { p: '🔬 Qual é a partícula elementar mais leve?', r: 'eletron', d: 'Ciência' },
  { p: '🧪 Qual é o pH de uma solução neutra?', r: '7', d: 'Química' },
  { p: '💨 Qual é a velocidade do som no ar em m/s?', r: '343', d: 'Física' },
  { p: '🌡️ A que temperatura o hélio ferve?', r: '4', d: 'Física' },
  { p: '🧬 Quantas bases nitrogenadas existem no DNA?', r: '4', d: 'Biologia' },
  { p: '🔭 Qual é a maior lua de Júpiter?', r: 'ganimedes', d: 'Astronomia' },
  { p: '⭐ Qual é a estrela mais brilhante do céu noturno?', r: 'sirius', d: 'Astronomia' },
  { p: '📡 Em que ano foi criada a World Wide Web?', r: '1989', d: 'Tecnologia' },
  { p: '💻 Qual foi o primeiro computador comercial de sucesso?', r: 'apple ii', d: 'Tecnologia' },
  { p: '⚡ Quantos volts tem um raio típico?', r: '1000000', d: 'Física' },
  { p: '🧲 Qual é a força fundamental mais fraca?', r: 'gravidade', d: 'Física' },
  { p: '🔬 Qual é a temperatura de Planck em Kelvin?', r: '1.4e32', d: 'Física' },
  { p: '💿 Qual é a velocidade de transferência do CD?', r: '1.4', d: 'Tecnologia' },
  { p: '🖥️ Quantos transistores tem um processador i7 moderno?', r: '1000000000', d: 'Tecnologia' },
  { p: '🧬 Qual é o tamanho do DNA em angstroms?', r: '20', d: 'Biologia' },
  { p: '🌌 Qual é a velocidade da luz em m/s?', r: '299792458', d: 'Física' },
  { p: '⚛️ Qual é o elemento mais abundante na crosta terrestre?', r: 'oxigenio', d: 'Química' },
  { p: '🔬 Quantos cromossomos tem um chimpanzé?', r: '48', d: 'Biologia' },
  { p: '📊 Em qual ano foi publicado o primeiro artigo de Alan Turing?', r: '1936', d: 'Tecnologia' },
  { p: '🧬 Qual é a molécula de DNA mais longa?', r: 'cromossomo 1', d: 'Biologia' },
  { p: '💡 Quantos watts tem uma lâmpada LED típica?', r: '8', d: 'Física' },
  { p: '🌊 Qual é a profundidade máxima do oceano?', r: '11000', d: 'Geografia' },
  { p: '⭐ Quantas estrelas existem no universo observável?', r: '10e24', d: 'Astronomia' },
  { p: '🔭 Qual é a distância do Sol até a Terra em km?', r: '149600000', d: 'Astronomia' },
  { p: '🌙 Qual é a idade da Lua aproximadamente?', r: '4500000000', d: 'Astronomia' },

  // MATEMÁTICA
  { p: '🔢 Qual é o resultado de 15² - 8²?', r: '161', d: 'Matemática' },
  { p: '📐 Quantos radianos equivalem a 180 graus?', r: 'pi', d: 'Matemática' },
  { p: '∞ Qual é o símbolo matemático para infinito?', r: 'infinito', d: 'Matemática' },
  { p: '📊 Qual é a raiz cúbica de 216?', r: '6', d: 'Matemática' },
  { p: '🧮 Qual é o número de Euler aproximadamente?', r: '2.71', d: 'Matemática' },
  { p: '📉 Qual é o MDC de 48 e 18?', r: '6', d: 'Matemática' },
  { p: '📈 Qual é o MMC de 12 e 18?', r: '36', d: 'Matemática' },
  { p: '🎲 Qual é a probabilidade de tirar um 6 em um dado?', r: '1/6', d: 'Matemática' },
  { p: '🔢 Quantas diagonais tem um hexágono?', r: '9', d: 'Geometria' },
  { p: '📐 Qual é a soma dos ângulos internos de um polígono com 10 lados?', r: '1440', d: 'Geometria' },
  { p: '🎯 Qual é o resultado de integral de 0 a 1 de x dx?', r: '0.5', d: 'Cálculo' },
  { p: '📊 Qual é a moda em {1,2,2,3,3,3}?', r: '3', d: 'Estatística' },
  { p: '📈 Qual é a mediana de {1,3,5,7,9}?', r: '5', d: 'Estatística' },
  { p: '🧮 Quanto é log₁₀(1000)?', r: '3', d: 'Matemática' },
  { p: '🔢 Qual é o primeiro número perfeito?', r: '6', d: 'Matemática' },
  { p: '📐 Qual é a constante de Archimedes (pi) até 5 decimais?', r: '3.14159', d: 'Matemática' },
  { p: '∑ Qual é a soma de 1 até 100?', r: '5050', d: 'Matemática' },
  { p: '🎲 Qual é o desvio padrão de {1,2,3,4,5}?', r: '1.41', d: 'Estatística' },
  { p: '🧮 Quanto é 2 elevado a 16?', r: '65536', d: 'Matemática' },
  { p: '📊 Qual é a combinação C(10,3)?', r: '120', d: 'Matemática' },
];

// ─── UTILITÁRIOS INTERNOS ────────────────────────────────────────────────────

function getTodayKey(senderJid) {
  const today = new Date().toISOString().split('T')[0];
  return `${senderJid}_${today}`;
}

async function syncQuizPointsFromDB(userId) {
  try {
    const user = await Usuario.findOne({ idWhatsApp: userId }).lean();
    if (user && typeof user.quizPoints === 'number') {
      pontosMap.set(userId, user.quizPoints);
    }
  } catch (e) {
    console.error('⚠️ Erro ao sincronizar pontos quiz:', e.message);
  }
}

async function saveQuizPointsToDB(userId, pontos) {
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { quizPoints: pontos } },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Pontos salvos: ${userId} → ${pontos} pts`);
  } catch (e) {
    console.error('⚠️ Erro ao salvar pontos quiz no MongoDB:', e.message);
  }
}

async function changeGold(userId, amount) {
  try {
    const update = { $inc: { gold: amount } };
    // Incrementa progresso da missão de ganhar 500 gold apenas se for ganho positivo
    if (amount > 0) {
      update['$inc']['dailyMissions.progress.gold500'] = amount;
    }
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      update,
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Gold alterado: ${userId} → ${amount} (novo saldo: ${user?.gold})`);
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

// ─── !quiz / !quizfut / !quizctec / !quizgeo / !quizmat ─────────────────────

async function handleQuiz(sock, msg, jid, author, senderJid, caption = '') {
  await syncQuizPointsFromDB(senderJid);

  // Verificar se está respondendo uma pergunta ativa
  if (quizState.has(senderJid)) {
    const state = quizState.get(senderJid);
    const resposta = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
      .trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const correta = state.r.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    clearTimeout(state.timeout);
    quizState.delete(senderJid);

    if (resposta.includes(correta) || correta.includes(resposta)) {
      const pts = (pontosMap.get(senderJid) || 0) + 10;
      pontosMap.set(senderJid, pts);
      await saveQuizPointsToDB(senderJid, pts);
      const goldReward = 15;
      await changeGold(senderJid, goldReward);
      // Incrementar progresso da missão quiz5
      try {
        await Usuario.findOneAndUpdate(
          { idWhatsApp: senderJid },
          { $inc: { 'dailyMissions.progress.quiz5': 1 } }
        );
      } catch (e) {
        console.error('⚠️ Erro ao atualizar progresso quiz5:', e.message);
      }
      await sock.sendMessage(jid, {
        text: `✅ *CORRETO!* Parabéns, *${author}*! 🎉\n\n💰 *+10 pontos!* Total: *${pts} pts* ☁️\n💵 *+${goldReward} gold!*`,
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text: `❌ *ERROU!* *${author}*!\n\nResposta correta era: *${state.r}* 😬`,
      }, { quoted: msg });
    }
    return;
  }

  // Verificar limite diário de 10 quiz
  const todayKey = getTodayKey(senderJid);
  const quizCount = quizDailyCount.get(todayKey) || 0;

  if (quizCount >= 10) {
    await sock.sendMessage(jid, {
      text: `⚠️ *${author}*, você atingiu o limite de 10 quiz por dia! Volte amanhã! 😴`,
    }, { quoted: msg });
    return;
  }

  // Filtrar perguntas por categoria
  const cmd = caption.trim().toLowerCase().split(' ')[0];
  let perguntasFiltradas = perguntasQuiz;

  if (cmd === '!quizfut') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Futebol');
  } else if (cmd === '!quizctec') {
    perguntasFiltradas = perguntasQuiz.filter(q =>
      ['Ciência', 'Química', 'Física', 'Biologia', 'Astronomia', 'Tecnologia'].includes(q.d)
    );
  } else if (cmd === '!quizgeo') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Geografia');
  } else if (cmd === '!quizmat') {
    perguntasFiltradas = perguntasQuiz.filter(q =>
      ['Matemática', 'Geometria', 'Cálculo', 'Estatística'].includes(q.d)
    );
  } else if (cmd === '!quizhis') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'História');
  }

  if (perguntasFiltradas.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Nenhuma pergunta disponível para essa categoria no momento.' }, { quoted: msg });
    return;
  }

  quizDailyCount.set(todayKey, quizCount + 1);

  // Sortear pergunta sem repetir recentemente
  if (!global.recentQuiz) global.recentQuiz = {};
  if (!global.recentQuiz[senderJid]) global.recentQuiz[senderJid] = [];

  let q;
  let tentativas = 0;
  do {
    q = perguntasFiltradas[Math.floor(Math.random() * perguntasFiltradas.length)];
    tentativas++;
  } while (global.recentQuiz[senderJid].includes(q.p) && tentativas < 20 && perguntasFiltradas.length > 2);

  global.recentQuiz[senderJid].push(q.p);
  if (global.recentQuiz[senderJid].length > 5) global.recentQuiz[senderJid].shift();

  const timeout = setTimeout(() => {
    quizState.delete(senderJid);
    sock.sendMessage(jid, {
      text: `⏰ Tempo esgotado, *${author}*!\n\nResposta correta era: *${q.r}* 😬`,
    });
  }, 30000);

  quizState.set(senderJid, { r: q.r, timeout });

  await sock.sendMessage(jid, {
    text: `🧠 *QUIZ — ${q.d.toUpperCase()}*\n\n❓ *${q.p}*\n\n_Você tem 30 segundos!_\n_Quiz ${quizCount + 1}/10 hoje_`,
  }, { quoted: msg });
}

// ─── !pontos ─────────────────────────────────────────────────────────────────

async function handlePontos(sock, msg, jid, author, senderJid) {
  await syncQuizPointsFromDB(senderJid);
  const pts = pontosMap.get(senderJid) || 0;
  const comentario = pts === 0 ? 'Que inútil, nem um ponto ainda!' :
    pts < 30 ? 'Tá fraco(a)! Joga mais!' :
    pts < 80 ? 'Razoável, pode melhorar!' :
    pts < 150 ? 'Bom desempenho! Continua!' :
    pts < 250 ? 'Excelente! Quase lá!' : 'MONSTRO! Que pontuação!';

  await sock.sendMessage(jid, {
    text: `🏅 *${author}*, você tem *${pts} pontos* no quiz! ☁️\n\n_${comentario}_`,
  }, { quoted: msg });
}

// ─── !rankjogos ──────────────────────────────────────────────────────────────

async function handleRankJogos(sock, msg, jid, contactNames) {
  try {
    const allUsers = await Usuario.find({ quizPoints: { $exists: true, $gt: 0 } }).lean();
    for (const user of allUsers) {
      pontosMap.set(user.idWhatsApp, user.quizPoints);
    }
  } catch (e) {
    console.error('⚠️ Erro ao sincronizar ranking:', e.message);
  }

  if (pontosMap.size === 0) {
    await sock.sendMessage(jid, { text: '📭 Nenhum ponto registrado! Joga *!quiz* primeiro!' }, { quoted: msg });
    return;
  }

  const sorted = [...pontosMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let texto = `🏆 *RANKING DE QUIZ* 🏆\n\n`;
  sorted.forEach(([jidU, pts], i) => {
    const nome = contactNames[jidU] || jidU.split('@')[0];
    texto += `${medals[i]} *${nome}* — ${pts} pts ☁️\n`;
  });
  texto += `\n_Joga *!quiz* pra subir!_`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !banco ───────────────────────────────────────────────────────────────────

const DAILY_DEPOSIT_LIMIT = 10000;

async function handleBanco(sock, msg, jid, caption) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const match = caption.match(/banco\s+(\d+)/i);

  let user = await Usuario.findOne({ idWhatsApp: userId });
  if (!user) {
    user = await Usuario.create({ idWhatsApp: userId, gold: 0 });
  }

  if (!user.bank) user.bank = {};

  const today = new Date().toISOString().split('T')[0];

  if (user.bank.lastDepositDate !== today) {
    user.bank.depositedToday = 0;
    user.bank.lastDepositDate = today;
  }

  if (!match) {
    if (!user.bank.amount || user.bank.amount <= 0) {
      const texto = `💼 ═══ BANCO PIROQUINHAS ═══ 💼\n\n` +
                    `💰 *Nenhum investimento ativo no momento!*\n\n` +
                    `O seu dinheiro está seguro, mas ocioso...\n\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `*COMO INVESTIR?*\n` +
                    `  📊 Use: *!banco <quantia>*\n` +
                    `  💵 Exemplo: *!banco 500*\n\n` +
                    `*RENDIMENTOS:*\n` +
                    `  📈 Juros: 5-15% ao dia\n` +
                    `  ⏰ Prazo: 1-7 dias aleatórios\n\n` +
                    `*RESGATE:*\n` +
                    `  💎 Use: *!resgatar*\n` +
                    `  _Após o prazo expirar!_\n\n` +
                    `_Deixe seu dinheiro trabalhar para você!_ 🚀`;

      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }

    const daysLeft = Math.max(0, user.bank.daysRemaining - Math.floor((Date.now() - new Date(user.bank.startDate)) / 86400000));
    const futureAmount = Math.round(user.bank.amount * (1 + (user.bank.interest / 100)));
    const ganho = futureAmount - user.bank.amount;
    let status = daysLeft > 0 ? `⏳ Dias restantes: *${daysLeft}*` : `✅ *PRONTO PARA RESGATAR!*`;
    let emoji = daysLeft > 0 ? '⌛' : '🎯';

    const texto = `💼 ═══ SEU INVESTIMENTO ═══ 💼\n\n` +
                  `${emoji} ${status}\n\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `*DETALHES:*\n` +
                  `  💵 Investido: *${user.bank.amount}* gold\n` +
                  `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
                  `  💎 Retorno esperado: *${futureAmount}* gold\n` +
                  `  💹 Lucro previsto: *+${ganho}* gold\n\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `*AÇÕES:*\n` +
                  `  ${daysLeft > 0 ? `⏳ Aguarde ${daysLeft} dia(s) para resgatar!` : '✅ Use *!resgatar* para sacar seu dinheiro!'}\n\n` +
                  `_Seu investimento está crescendo..._ 📊`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  const amount = parseInt(match[1]);
  if (isNaN(amount) || amount <= 0) {
    await sock.sendMessage(jid, { text: `⚠️ *QUANTIDADE INVÁLIDA*\n\nA quantia deve ser um número positivo!\n\n*EXEMPLO:*\n  *!banco 500*` }, { quoted: msg });
    return;
  }

  const depositedToday = user.bank.depositedToday || 0;
  const remainingLimit = DAILY_DEPOSIT_LIMIT - depositedToday;

  if (amount > remainingLimit) {
    const texto = `⚠️ *LIMITE DIÁRIO ATINGIDO*\n\nVocê já depositou *${depositedToday}* gold hoje!\n\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `*LIMITES:*\n` +
                  `  📊 Limite diário: *${DAILY_DEPOSIT_LIMIT}* gold\n` +
                  `  ✅ Depositado hoje: *${depositedToday}* gold\n` +
                  `  🔒 Limite restante: *${remainingLimit}* gold\n\n` +
                  `*VOCÊ TENTOU DEPOSITAR:* ${amount} gold\n\n` +
                  `_Tente com uma quantia menor ou volte amanhã!_ ⏰`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  if (user.bank.amount && user.bank.amount > 0) {
    const currentDaysLeft = Math.max(0, user.bank.daysRemaining - Math.floor((Date.now() - new Date(user.bank.startDate)) / 86400000));
    const texto = `⚠️ *INVESTIMENTO ATIVO*\n\nVocê já tem um investimento em andamento!\n\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `*DETALHES:*\n` +
                  `  💵 Investido: *${user.bank.amount}* gold\n` +
                  `  📈 Taxa: *${user.bank.interest}%*\n` +
                  `  ⏰ Dias restantes: *${currentDaysLeft}*\n\n` +
                  `━━━━━━━━━━━━━━━━\n` +
                  `*OPÇÕES:*\n` +
                  `  💎 Use *!banco* para ver seus detalhes\n` +
                  `  🏦 Use *!resgatar* para sacar quando pronto`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  const updatedUser = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, gold: { $gte: amount } },
    { $inc: { gold: -amount } },
    { new: true }
  );

  if (!updatedUser) {
    const myGold = user.gold || 0;
    await sock.sendMessage(jid, { text: `⚠️ *SALDO INSUFICIENTE*\n\nVocê não tem *${amount}* gold!\n\n━━━━━━━━━━━━━━━━\n*SEU SALDO:*\n  💰 Disponível: *${myGold}* gold` }, { quoted: msg });
    return;
  }

  const interest = 5 + Math.floor(Math.random() * 11); // 5-15%
  const days = 1 + Math.floor(Math.random() * 7);       // 1-7 dias

  await Usuario.updateOne(
    { idWhatsApp: userId },
    {
      $set: {
        'bank.amount': amount,
        'bank.interest': interest,
        'bank.daysRemaining': days,
        'bank.startDate': new Date().toISOString(),
        'bank.lastDepositDate': today,
        'bank.depositedToday': depositedToday + amount,
      }
    }
  );

  const futureAmount = Math.round(amount * (1 + (interest / 100)));
  const ganho = futureAmount - amount;

  const texto = `✅ ═══ INVESTIMENTO REALIZADO! ═══ ✅\n\n` +
                `💼 *Seu dinheiro está trabalhando!*\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*RESUMO DO INVESTIMENTO:*\n` +
                `  💵 Valor investido: *${amount}* gold\n` +
                `  📈 Taxa de juros: *${interest}%* ao dia\n` +
                `  ⏰ Prazo: *${days} dia(s)*\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*RETORNO ESPERADO:*\n` +
                `  💎 Resgate em: *${futureAmount}* gold\n` +
                `  💹 Lucro esperado: *+${ganho}* gold\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*SALDO ATUAL:*\n` +
                `  💰 Disponível: *${updatedUser.gold}* gold\n` +
                `  🏦 Investido: *${amount}* gold`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !resgatar ────────────────────────────────────────────────────────────────

async function handleResgatar(sock, msg, jid) {
  const userId = msg.key.participant || msg.key.remoteJid;
  const user = await Usuario.findOne({ idWhatsApp: userId });

  if (!user || !user.bank || !user.bank.amount || user.bank.amount <= 0) {
    await sock.sendMessage(jid, { text: `⚠️ *SEM INVESTIMENTOS ATIVOS*\n\nVocê não possui nenhum investimento ativo no banco!` }, { quoted: msg });
    return;
  }

  const daysLeft = Math.max(0, user.bank.daysRemaining - Math.floor((Date.now() - new Date(user.bank.startDate)) / 86400000));

  if (daysLeft > 0) {
    await sock.sendMessage(jid, { text: `⏳ ═══ INVESTIMENTO EM ANDAMENTO ═══ ⏳\n\n⌛ *Seu investimento vence em ${daysLeft} dia(s)!*` }, { quoted: msg });
    return;
  }

  const futureAmount = Math.round(user.bank.amount * (1 + (user.bank.interest / 100)));
  const ganho = futureAmount - user.bank.amount;

  const updateResgate = {
    $inc: { gold: futureAmount },
    $set: { 'bank.amount': 0, 'bank.interest': 0, 'bank.daysRemaining': 0, 'bank.startDate': null }
  };
  // Atualizar progresso da missão ao resgatar banco
  if (ganho > 0) {
    updateResgate['$inc']['dailyMissions.progress.gold500'] = ganho;
  }
  const finalUser = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId },
    updateResgate,
    { new: true }
  );

  const texto = `🎉 ═══ RESGATE BEM-SUCEDIDO! ═══ 🎉\n\n` +
                `💎 *Parabéns! Seu investimento rendeu!*\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*RESUMO:*\n` +
                `  💵 Investimento inicial: *${user.bank.amount}* gold\n` +
                `  📈 Taxa de juros: *${user.bank.interest}%*\n` +
                `  💰 Resgate em: *${futureAmount}* gold\n` +
                `  💹 Lucro obtido: *+${ganho}* gold\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `*SALDO FINAL:*\n` +
                `  ✅ Total na conta: *${finalUser.gold}* gold`;

  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  handleQuiz,
  handlePontos,
  handleRankJogos,
  handleBanco,
  handleResgatar,
  changeGold,
  quizState,
  perguntasQuiz,
};