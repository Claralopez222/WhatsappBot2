/**
 * Sistema de Quiz — Piroquinhas Bot
 * Comandos: !quiz, !pontos, !rankjogos
 * - 100+ questões muito difíceis
 * - Limite de 10 quiz por dia
 * - Pontos salvos na nuvem (MongoDB)
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', 'models', 'Usuario'));

const quizState = new Map(); // userId → { r: resposta, timeout }
const pontosMap = new Map(); // userId → pontos (sincroniza com MongoDB)
const quizDailyCount = new Map(); // userId_YYYY-MM-DD → count

const perguntasQuiz = [
  // HISTÓRIA (25 questões difíceis)
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
  
  // GEOGRAFIA (30 questões difíceis)
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
  { p: '⛩️ Qual é o país com mais vulcões ativos?', r: 'indonesia', d: 'Geografia' },
  { p: '🌲 Qual país tem a maior floresta boreal?', r: 'russia', d: 'Geografia' },
  { p: '🗿 Em qual país fica o Stonehenge?', r: 'inglaterra', d: 'Geografia' },
  
  // CIÊNCIA & TECNOLOGIA (30 questões difíceis)
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
  
  // MATEMÁTICA (25 questões difíceis)
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
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $inc: { gold: amount } },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✅ Gold alterado: ${userId} → ${amount} (novo saldo: ${user?.gold})`);
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

async function handleQuiz(sock, msg, jid, author, senderJid) {
  // Sincronizar pontos do DB
  await syncQuizPointsFromDB(senderJid);

  // Verificar se está respondendo
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
      
      // Salvar pontos na nuvem (MongoDB)
      await saveQuizPointsToDB(senderJid, pts);
      
      const goldReward = 15;
      // Salvar gold na nuvem (MongoDB)
      await changeGold(senderJid, goldReward);
      
      await sock.sendMessage(jid, {
        text: `✅ *CORRETO!* Parabéns, *${author}*! 🎉

💰 *+10 pontos!* Total: *${pts} pts* ☁️
💵 *+${goldReward} gold!*`,
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text: `❌ *ERROU!* *${author}*!\n\nResposta: *${state.r}* 😬`,
      }, { quoted: msg });
    }
    return;
  }

  // Verificar limite de 10 quiz por dia
  const todayKey = getTodayKey(senderJid);
  const quizCount = quizDailyCount.get(todayKey) || 0;

  if (quizCount >= 10) {
    await sock.sendMessage(jid, {
      text: `⚠️ *${author}*, você atingiu o limite de 10 quiz por dia! Volte amanhã! 😴`,
    }, { quoted: msg });
    return;
  }

  // Incrementar contador do dia
  quizDailyCount.set(todayKey, quizCount + 1);

  // Sortear pergunta sem repetir recentemente
  const recentKey = `recent_${senderJid}`;
  if (!global.recentQuiz) global.recentQuiz = {};
  if (!global.recentQuiz[senderJid]) global.recentQuiz[senderJid] = [];

  let q;
  do {
    q = perguntasQuiz[Math.floor(Math.random() * perguntasQuiz.length)];
  } while (global.recentQuiz[senderJid].includes(q.p) && perguntasQuiz.length > 5);

  global.recentQuiz[senderJid].push(q.p);
  if (global.recentQuiz[senderJid].length > 5) global.recentQuiz[senderJid].shift();

  const timeout = setTimeout(() => {
    quizState.delete(senderJid);
    sock.sendMessage(jid, {
      text: `⏰ Tempo esgotado, *${author}*!\n\nResposta: *${q.r}* 😬`,
    });
  }, 30000);

  quizState.set(senderJid, { r: q.r, timeout });
  await sock.sendMessage(jid, {
    text: `🧠 *QUIZ — ${q.d}*

❓ *${q.p}*

_Você tem 30 segundos!_
_Quiz ${quizCount + 1}/10 hoje_`,
  }, { quoted: msg });
}

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

// ─── !banco (Sistema de investimento de gold)
const bankData = new Map(); // { userId: { amount, interest, daysRemaining, startDate } }
const bankDailyDeposits = new Map(); // { userId_YYYY-MM-DD: totalDeposited }
const DAILY_DEPOSIT_LIMIT = 10000; // Limite diário de depósito

async function handleBanco(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const match = caption.match(/banco\s+(\d+)/i);
  
  if (!match) {
    // Verificar saldo do banco
    const banco = bankData.get(userId);
    if (!banco) {
      const texto = `💼 ═══ BANCO PIROQUINHAS ═══ 💼

💰 *Nenhum investimento ativo no momento!*

O seu dinheiro está seguro, mas ociosos...

━━━━━━━━━━━━━━━━
*COMO INVESTIR?*
  📊 Use: *!banco <quantia>*
  💵 Exemplo: *!banco 500*
  
*RENDIMENTOS:*
  📈 Juros: 5-15% ao dia
  ⏰ Prazo: 1-7 dias aleatórios
  
*RESGATE:*
  💎 Use: *!resgatar*
  _Após o prazo expirar!_

_Deixe seu dinheiro trabalhar para você!_ 🚀`;
      
      await sock.sendMessage(jid, { text: texto }, { quoted: msg });
      return;
    }
    
    const daysLeft = Math.max(0, banco.daysRemaining - Math.floor((Date.now() - new Date(banco.startDate)) / 86400000));
    const futureAmount = Math.round(banco.amount * (1 + (banco.interest / 100)));
    const ganho = futureAmount - banco.amount;
    
    let status = daysLeft > 0 ? `⏳ Dias restantes: *${daysLeft}*` : `✅ *PRONTO PARA RESGATAR!*`;
    let emoji = daysLeft > 0 ? '⌛' : '🎯';
    
    const texto = `💼 ═══ SEU INVESTIMENTO ═══ 💼

${emoji} ${status}

━━━━━━━━━━━━━━━━
*DETALHES:*
  💵 Investido: *${banco.amount}* gold
  📈 Taxa de juros: *${banco.interest}%*
  💎 Retorno esperado: *${futureAmount}* gold
  💹 Lucro previsto: *+${ganho}* gold

━━━━━━━━━━━━━━━━
*AÇÕES:*
  ${daysLeft > 0 ? `⏳ Aguarde ${daysLeft} dia(s) para resgatar!` : '✅ Use *!resgatar* para sacar seu dinheiro!'}
  
_Seu investimento está crescendo..._ 📊`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const amount = parseInt(match[1]);
  if (isNaN(amount) || amount <= 0) {
    const texto = `⚠️ *QUANTIDADE INVÁLIDA*

A quantia deve ser um número positivo!

*EXEMPLO:*
  *!banco 500*
  Investe 500 gold`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  // Validar limite diário
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailyKey = `${userId}_${today}`;
  const depositedToday = bankDailyDeposits.get(dailyKey) || 0;
  const remainingLimit = DAILY_DEPOSIT_LIMIT - depositedToday;
  
  if (amount > remainingLimit) {
    const texto = `⚠️ *LIMITE DIÁRIO ATINGIDO*

Você já depositou *${depositedToday}* gold hoje!

━━━━━━━━━━━━━━━━
*LIMITES:*
  📊 Limite diário: *${DAILY_DEPOSIT_LIMIT}* gold
  ✅ Depositado hoje: *${depositedToday}* gold
  🔒 Limite restante: *${remainingLimit}* gold
  
*VOCÊ TENTOU DEPOSITAR:* ${amount} gold
  
_Tente com uma quantia menor ou volte amanhã!_ ⏰`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  // Verificar investimento ativo ANTES de tentar investir
  if (bankData.has(userId)) {
    const banco = bankData.get(userId);
    const texto = `⚠️ *INVESTIMENTO ATIVO*

Você já tem um investimento em andamento!

━━━━━━━━━━━━━━━━
*DETALHES:*
  💵 Investido: *${banco.amount}* gold
  📈 Taxa: *${banco.interest}%*
  ⏰ Dias restantes: *${Math.max(0, banco.daysRemaining - Math.floor((Date.now() - new Date(banco.startDate)) / 86400000))}*

━━━━━━━━━━━━━━━━
*OPÇÕES:*
  💎 Use *!banco* para ver seus detalhes
  🏦 Use *!resgatar* para sacar quando pronto
  
_Aguarde o término do investimento anterior!_ ⏳`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  // Fazer transação ATÔMICA: descontar só se tiver saldo suficiente
  const user = await Usuario.findOneAndUpdate(
    { idWhatsApp: userId, gold: { $gte: amount } },  // Só atualiza se tiver saldo
    { $inc: { gold: -amount } },
    { new: true }
  );
  
  if (!user) {
    // Saldo insuficiente
    const userData = await Usuario.findOne({ idWhatsApp: userId });
    const myGold = userData?.gold || 0;
    const texto = `⚠️ *SALDO INSUFICIENTE*

Você não tem *${amount}* gold!

━━━━━━━━━━━━━━━━
*SEU SALDO:*
  💰 Disponível: *${myGold}* gold
  
*FORMA DE GANHAR GOLD:*
  📋 Missões: !missao
  🔍 Garimpar: !garimpar
  🛍️ Vender: !vender <item>
  
_Ganhe mais gold e tente novamente!_ 💪`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }

  // Gerar juros e dias (5-15% ao dia, 1-7 dias)
  const interest = 5 + Math.floor(Math.random() * 11); // 5-15%
  const days = 1 + Math.floor(Math.random() * 7); // 1-7 dias
  
  // Registrar o investimento
  bankData.set(userId, {
    amount: amount,
    interest: interest,
    daysRemaining: days,
    startDate: new Date().toISOString(),
  });
  
  // Registrar o depósito diário
  bankDailyDeposits.set(dailyKey, depositedToday + amount);
  
  const futureAmount = Math.round(amount * (1 + (interest / 100)));
  const ganho = futureAmount - amount;
  const saldoAtual = user?.gold || 0;  // Saldo APÓS o desconto
  const novoLimiteRestante = remainingLimit - amount;
  
  const texto = `✅ ═══ INVESTIMENTO REALIZADO! ═══ ✅

💼 *Seu dinheiro está trabalhando!*

━━━━━━━━━━━━━━━━
*RESUMO DO INVESTIMENTO:*
  💵 Valor investido: *${amount}* gold
  📈 Taxa de juros: *${interest}%* ao dia
  ⏰ Prazo: *${days} dia(s)*
  
━━━━━━━━━━━━━━━━
*RETORNO ESPERADO:*
  💎 Resgate em: *${futureAmount}* gold
  💹 Lucro esperado: *+${ganho}* gold
  
━━━━━━━━━━━━━━━━
*LIMITE DIÁRIO:*
  📊 Depositado hoje: *${depositedToday + amount}* / *${DAILY_DEPOSIT_LIMIT}* gold
  🔒 Restante para hoje: *${novoLimiteRestante}* gold
  
━━━━━━━━━━━━━━━━
*SALDO ATUAL:*
  💰 Disponível: *${saldoAtual}* gold
  🏦 Investido: *${amount}* gold
  
*PRÓXIMOS PASSOS:*
  📊 Ver status: *!banco*
  🏦 Resgatar: *!resgatar* (após ${days} dia(s))
  
_Volte em ${days} dia(s) para sacar seus ganhos!_ 🚀`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

async function handleResgatar(sock, msg, jid, caption) {
  const userId = msg.key.participant;
  const banco = bankData.get(userId);
  
  if (!banco) {
    const texto = `⚠️ *SEM INVESTIMENTOS ATIVOS*

Você não possui nenhum investimento ativo no banco!

━━━━━━━━━━━━━━━━
*COMECE A INVESTIR:*
  💼 Use: *!banco <quantia>*
  💵 Exemplo: *!banco 500*
  
_Seu dinheiro pode crescer enquanto você joga!_ 📈`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const daysLeft = Math.max(0, banco.daysRemaining - Math.floor((Date.now() - new Date(banco.startDate)) / 86400000));
  
  if (daysLeft > 0) {
    const texto = `⏳ ═══ INVESTIMENTO AINDA EM ANDAMENTO ═══ ⏳

⌛ *Seu investimento vence em ${daysLeft} dia(s)!*

━━━━━━━━━━━━━━━━
*DETALHES:*
  💵 Investido: *${banco.amount}* gold
  📈 Taxa: *${banco.interest}%*
  ⏰ Dias restantes: *${daysLeft}*
  
*DICA:*
  Volte aqui em ${daysLeft} dia(s) para resgatar com lucro!
  
_Tenha paciência, o dinheiro está crescendo..._ 💰`;
    
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    return;
  }
  
  const futureAmount = Math.round(banco.amount * (1 + (banco.interest / 100)));
  const ganho = futureAmount - banco.amount;
  
  // Recuperar o valor investido + ganho usando changeGold para garantir persistência
  const saldoFinal = await changeGold(userId, futureAmount);
  
  bankData.delete(userId);
  
  const texto = `🎉 ═══ RESGATE BEM-SUCEDIDO! ═══ 🎉

💎 *Parabéns! Seu investimento rendeu!*

━━━━━━━━━━━━━━━━
*RESUMO:*
  💵 Investimento inicial: *${banco.amount}* gold
  📈 Taxa de juros: *${banco.interest}%*
  💰 Resgate em: *${futureAmount}* gold
  💹 Lucro obtido: *+${ganho}* gold
  
━━━━━━━━━━━━━━━━
*SALDO FINAL:*
  ✅ Total na conta: *${saldoFinal}* gold
  
*PRÓXIMAS AÇÕES:*
  💼 Investir novamente: *!banco <quantia>*
  📊 Ver saldo: *!gold*
  🛒 Gastar na loja: *!loja*
  
_Excelente negócio! Invista novamente para ganhar mais!_ 🚀`;
  
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

module.exports = {
  handleQuiz,
  handlePontos,
  handleRankJogos,
  handleBanco,
  handleResgatar,
  changeGold,
  bankData,
  quizState,
  perguntasQuiz,
};
