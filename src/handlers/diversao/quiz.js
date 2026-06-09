/**
 * Sistema de Quiz — Piroquinhas Bot
 * Comandos: !quiz, !quizfut, !quizctec, !quizgeo, !quizmat, !quizhis, !quizbsq
 *           !pontos, !rankjogos
 * - 185+ questões
 * - Limite de 10 quiz por dia por usuário
 * - Pontos salvos na nuvem (MongoDB)
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { prepareDailyMissionState } = require('./missoes');
const { handleBanco, handleResgatar } = require('./banco');

// ─── ESTADO ──────────────────────────────────────────────────────────────────
const quizState      = new Map(); // senderJid → { r, timeout }
const pontosMap      = new Map(); // senderJid → pts (cache)
const quizDailyCount = new Map(); // "senderJid_YYYY-MM-DD" → número de quizzes jogados hoje

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

function somenteGrupo(jid) {
  return jid?.endsWith('@g.us') ?? false;
}

function resolverNome(idWhatsApp, contactNames) {
  return contactNames?.[idWhatsApp] || idWhatsApp.split('@')[0];
}

function normalize(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getTodayKey(senderJid) {
  const today = new Date().toISOString().split('T')[0];
  return `${senderJid}_${today}`;
}

// ─── BANCO DE DADOS ──────────────────────────────────────────────────────────

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
      { upsert: true, new: true }
    );
    console.log(`✅ Pontos salvos: ${userId} → ${pontos} pts`);
  } catch (e) {
    console.error('⚠️ Erro ao salvar pontos quiz no MongoDB:', e.message);
  }
}

async function changeGold(userId, amount) {
  try {
    if (amount > 0) await prepareDailyMissionState(userId);
    const update = { $inc: { gold: amount } };
    if (amount > 0) update['$inc']['dailyMissions.progress.gold500'] = amount;
    const user = await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      update,
      { upsert: true, new: true }
    );
    console.log(`✅ Gold alterado: ${userId} → ${amount} (novo saldo: ${user?.gold})`);
    return user?.gold || 0;
  } catch (e) {
    console.error('⚠️ Erro ao alterar gold:', e.message);
    return 0;
  }
}

// ─── PERGUNTAS ────────────────────────────────────────────────────────────────

const perguntasQuiz = [
  // ── FUTEBOL ───────────────────────────────────────────────────────────────
  { p: '⚽ Qual jogador marcou o gol de "la mano de dios"?', r: 'maradona', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou a chuteira de ouro na Copa de 2022?', r: 'mbappe', d: 'Futebol' },
  { p: '⚽ Em qual cidade fica o estádio Azteca?', r: 'cidade do mexico', d: 'Futebol' },
  { p: '⚽ Qual foi o placar da goleada da Alemanha sobre o Brasil em 2014?', r: '7 a 1', d: 'Futebol' },
  { p: '⚽ Qual jogador é o maior artilheiro de todos os tempos do Real Madrid?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Em que ano o Corinthians venceu o Mundial de Clubes?', r: '2000', d: 'Futebol' },
  { p: '⚽ Qual país sediou a primeira Eurocopa da história?', r: 'franca', d: 'Futebol' },
  { p: '⚽ Qual time ganhou a Libertadores em 2023?', r: 'fluminense', d: 'Futebol' },
  { p: '⚽ Qual jogador venceu a Bola de Ouro em 2018?', r: 'luka modric', d: 'Futebol' },
  { p: '⚽ Em que país foi realizada a Copa do Mundo de 1994?', r: 'estados unidos', d: 'Futebol' },
  { p: '⚽ Qual jogador marcou o gol decisivo na final da Copa de 2018?', r: 'mbappe', d: 'Futebol' },
  { p: '⚽ Em que ano o Atlético Mineiro venceu sua primeira Libertadores?', r: '2013', d: 'Futebol' },
  { p: '⚽ Qual seleção perdeu a final da Copa de 2022 para a Argentina?', r: 'franca', d: 'Futebol' },
  { p: '⚽ Quantas vezes Ronaldinho Gaúcho ganhou a Bola de Ouro?', r: '1', d: 'Futebol' },
  { p: '⚽ Em qual Copa do Mundo Rivaldo jogou sua melhor fase?', r: '2002', d: 'Futebol' },
  { p: '⚽ Qual jogador tem mais gols na história da Premier League?', r: 'alan shearer', d: 'Futebol' },
  { p: '⚽ Em que ano o Leicester City venceu o campeonato inglês?', r: '2016', d: 'Futebol' },
  { p: '⚽ Qual seleção africana chegou às semifinais da Copa de 2022?', r: 'marrocos', d: 'Futebol' },
  { p: '⚽ Quantas vezes o São Paulo foi campeão brasileiro?', r: '6', d: 'Futebol' },
  { p: '⚽ Qual jogador foi artilheiro da Copa do Mundo de 2014?', r: 'james rodriguez', d: 'Futebol' },
  { p: '⚽ Em que ano o Brasil perdeu para o Uruguai no Maracanã?', r: '1950', d: 'Futebol' },
  { p: '⚽ Qual clube tem mais títulos do Campeonato Inglês?', r: 'manchester united', d: 'Futebol' },
  { p: '⚽ Em que ano a Holanda chegou à final da Copa do Mundo pela última vez?', r: '2010', d: 'Futebol' },
  { p: '⚽ Qual foi o artilheiro da Copa de 1994?', r: 'hristo stoichkov', d: 'Futebol' },
  { p: '⚽ Quantos títulos da Champions League o Barcelona tem?', r: '5', d: 'Futebol' },
  { p: '⚽ Em que ano Ronaldo Fenômeno venceu o Mundial pela segunda vez?', r: '2002', d: 'Futebol' },
  { p: '⚽ Qual seleção saiu na fase de grupos da Copa de 2022 de forma surpreendente?', r: 'belgica', d: 'Futebol' },
  { p: '⚽ Qual time inglês foi fundado em 1878 como Newton Heath?', r: 'manchester united', d: 'Futebol' },
  { p: '⚽ Qual seleção eliminou o Brasil nas quartas de final da Copa de 2010?', r: 'holanda', d: 'Futebol' },
  { p: '⚽ Qual clube foi o primeiro a vencer a Champions League?', r: 'real madrid', d: 'Futebol' },
  { p: '⚽ Qual jogador marcou hat-trick na final do Mundial de Clubes de 2017?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Qual técnico levou o Liverpool a vencer a Champions 2019?', r: 'jurgen klopp', d: 'Futebol' },
  { p: '⚽ Qual jogador tem mais gols pela seleção brasileira na história?', r: 'neymar', d: 'Futebol' },
  { p: '⚽ Em que cidade fica o estádio Bernabéu?', r: 'madri', d: 'Futebol' },
  { p: '⚽ Qual jogador foi revelado nas categorias de base do Grêmio?', r: 'ronaldinho', d: 'Futebol' },
  { p: '⚽ Em que ano o Chelsea foi fundado?', r: '1905', d: 'Futebol' },
  { p: '⚽ Qual país sediará a Copa do Mundo de 2026?', r: 'eua canada mexico', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou o prêmio de melhor da Copa de 2022?', r: 'lionel messi', d: 'Futebol' },
  { p: '⚽ Em que posição jogava Ronaldinho Gaúcho?', r: 'meia', d: 'Futebol' },
  { p: '⚽ Qual técnico comandou o Brasil no hexa frustrado de 2014?', r: 'luiz felipe scolari', d: 'Futebol' },
  { p: '⚽ Qual clube inglês nunca foi rebaixado da Premier League?', r: 'arsenal', d: 'Futebol' },
  { p: '⚽ Qual goleiro defendeu o pênalti decisivo na final da Copa de 2006?', r: 'gigi buffon', d: 'Futebol' },
  { p: '⚽ Qual jogador foi eleito melhor do mundo pela FIFA em 2023?', r: 'erling haaland', d: 'Futebol' },
  { p: '⚽ Qual jogador foi revelado pelo Santos e hoje joga no Real Madrid?', r: 'rodrygo', d: 'Futebol' },
  { p: '⚽ Quantos títulos da Champions League tem o Liverpool?', r: '6', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa das Nações Africanas em 2024?', r: 'costa do marfim', d: 'Futebol' },
  { p: '⚽ Qual jogador tem o recorde de gols em Copas do Mundo?', r: 'miroslav klose', d: 'Futebol' },
  { p: '⚽ Qual clube brasileiro foi pentacampeão do Campeonato Brasileiro?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Qual time europeu venceu mais Champions League?', r: 'real madrid', d: 'Futebol' },
  { p: '⚽ Em que ano o Brasil ganhou sua última Copa do Mundo?', r: '2002', d: 'Futebol' },

  // ── HISTÓRIA ──────────────────────────────────────────────────────────────
  { p: '📜 Em que ano foi assinada a Declaração de Independência dos EUA?', r: '1776', d: 'História' },
  { p: '🏛️ Qual imperador romano construiu o Coliseu?', r: 'vespasiano', d: 'História' },
  { p: '⚔️ Em que batalha Napoleão foi definitivamente derrotado?', r: 'waterloo', d: 'História' },
  { p: '📚 Qual foi a primeira civilização a usar a escrita?', r: 'sumeria', d: 'História' },
  { p: '⚖️ Quem foi o primeiro presidente dos Estados Unidos?', r: 'george washington', d: 'História' },
  { p: '🗡️ Em que ano o Império Romano do Ocidente caiu?', r: '476', d: 'História' },
  { p: '💀 Quem comandou o exército mongol que conquistou a Ásia?', r: 'gengis khan', d: 'História' },
  { p: '⚔️ Em que ano ocorreu a Batalha de Hastings?', r: '1066', d: 'História' },
  { p: '🏛️ Qual faraó é conhecido por ter reinado mais tempo no Egito?', r: 'ramses ii', d: 'História' },
  { p: '📜 Em que ano Colombo chegou à América?', r: '1492', d: 'História' },
  { p: '🔥 Em que ano começou a Guerra do Vietnã?', r: '1955', d: 'História' },
  { p: '⚔️ Em que ano terminou a Primeira Guerra Mundial?', r: '1918', d: 'História' },
  { p: '🏰 Qual rainha foi a soberana mais longeva da Inglaterra?', r: 'elizabeth ii', d: 'História' },
  { p: '🌙 Em que ano o homem pisou na Lua pela primeira vez?', r: '1969', d: 'História' },
  { p: '💣 Em que cidade foi lançada a primeira bomba atômica?', r: 'hiroshima', d: 'História' },
  { p: '📜 Qual foi o primeiro país a conceder o sufrágio feminino?', r: 'nova zelandia', d: 'História' },
  { p: '🏛️ Em que ano foi proclamada a República no Brasil?', r: '1889', d: 'História' },
  { p: '⚔️ Quem liderou o Dia D na Normandia pelos Aliados?', r: 'dwight eisenhower', d: 'História' },
  { p: '🗡️ Qual rei inglês criou a Igreja Anglicana?', r: 'henrique viii', d: 'História' },
  { p: '🌍 Em que ano terminou o Apartheid na África do Sul?', r: '1991', d: 'História' },
  { p: '📚 Em que ano Gutenberg inventou a imprensa com tipos móveis?', r: '1440', d: 'História' },
  { p: '⚖️ Em que ano a Alemanha foi reunificada?', r: '1990', d: 'História' },
  { p: '🔱 Qual foi o último imperador romano do Ocidente?', r: 'romulo augustulo', d: 'História' },
  { p: '🌊 Em que ano o Titanic afundou?', r: '1912', d: 'História' },
  { p: '🏰 Em que ano foi proclamada a Independência do Brasil?', r: '1822', d: 'História' },
  { p: '⚔️ Qual foi o tratado que encerrou a Primeira Guerra Mundial?', r: 'versalhes', d: 'História' },
  { p: '📜 Qual imperador francês foi exilado na ilha de Santa Helena?', r: 'napoleao', d: 'História' },
  { p: '🌍 Em que ano o Muro de Berlim foi construído?', r: '1961', d: 'História' },
  { p: '🏛️ Qual civilização construiu o Partenon?', r: 'grega', d: 'História' },
  { p: '⚔️ Quantos anos durou a Guerra dos Trinta Anos?', r: '30', d: 'História' },

  // ── GEOGRAFIA ─────────────────────────────────────────────────────────────
  { p: '🌍 Qual é a capital da Austrália?', r: 'camberra', d: 'Geografia' },
  { p: '🏔️ Qual é a montanha mais alta das Américas?', r: 'aconcagua', d: 'Geografia' },
  { p: '🌊 Qual é o rio mais extenso do mundo?', r: 'nilo', d: 'Geografia' },
  { p: '🌐 Em qual continente fica o Saara?', r: 'africa', d: 'Geografia' },
  { p: '🏙️ Qual é a cidade mais populosa do Japão?', r: 'tokyo', d: 'Geografia' },
  { p: '🌴 Qual é o rio mais caudaloso do mundo?', r: 'amazonas', d: 'Geografia' },
  { p: '🏝️ Em qual oceano fica Madagascar?', r: 'indico', d: 'Geografia' },
  { p: '🌏 Qual país tem mais fronteiras terrestres?', r: 'russia', d: 'Geografia' },
  { p: '🏙️ Qual é a capital da Turquia?', r: 'ancara', d: 'Geografia' },
  { p: '🗺️ Quantos países fazem fronteira com o Brasil?', r: '10', d: 'Geografia' },
  { p: '🏔️ Qual é o ponto mais alto do Brasil?', r: 'pico da neblina', d: 'Geografia' },
  { p: '🌊 Qual é o menor oceano do mundo?', r: 'artico', d: 'Geografia' },
  { p: '🏜️ Qual é o maior deserto da América do Sul?', r: 'atacama', d: 'Geografia' },
  { p: '🗿 Em qual país fica Machu Picchu?', r: 'peru', d: 'Geografia' },
  { p: '🌍 Qual é a capital da Etiópia?', r: 'adis abeba', d: 'Geografia' },
  { p: '🏝️ Qual é a maior ilha do Mediterrâneo?', r: 'sicilia', d: 'Geografia' },
  { p: '🌊 Qual é o mar mais salgado do mundo?', r: 'mar morto', d: 'Geografia' },
  { p: '🌐 Em qual país fica o Lago Titicaca?', r: 'peru e bolivia', d: 'Geografia' },
  { p: '🏙️ Qual é a capital do Canadá?', r: 'otawa', d: 'Geografia' },
  { p: '🗺️ Qual é o país mais populoso da África?', r: 'nigeria', d: 'Geografia' },
  { p: '🌍 Qual é o segundo maior país do mundo em área?', r: 'canada', d: 'Geografia' },
  { p: '🏔️ Qual é o país com mais fronteiras na América do Sul?', r: 'brasil', d: 'Geografia' },
  { p: '🌐 Em qual país fica o Monte Fuji?', r: 'japao', d: 'Geografia' },
  { p: '🏜️ Qual é o maior arquipélago do mundo?', r: 'indonesia', d: 'Geografia' },
  { p: '🌊 Qual estreito liga o Mar Mediterrâneo ao Mar Negro?', r: 'bosfor', d: 'Geografia' },

  // ── CIÊNCIA & TECNOLOGIA ──────────────────────────────────────────────────
  { p: '⚛️ Qual é o elemento mais leve da tabela periódica?', r: 'hidrogenio', d: 'Ciência' },
  { p: '🔬 Qual cientista descobriu a penicilina?', r: 'alexander fleming', d: 'Ciência' },
  { p: '🌌 Quantos planetas tem o sistema solar?', r: '8', d: 'Astronomia' },
  { p: '💻 Qual empresa criou o sistema operacional Windows?', r: 'microsoft', d: 'Tecnologia' },
  { p: '🧬 Qual é a estrutura que carrega as informações genéticas?', r: 'dna', d: 'Biologia' },
  { p: '⭐ Qual é o nome da galáxia onde vivemos?', r: 'via lactea', d: 'Astronomia' },
  { p: '🧪 Qual é o gás mais abundante na atmosfera terrestre?', r: 'nitrogenio', d: 'Química' },
  { p: '🔭 Qual telescópio foi lançado em 2021 para substituir o Hubble?', r: 'james webb', d: 'Astronomia' },
  { p: '💡 Quem inventou a lâmpada incandescente?', r: 'thomas edison', d: 'Tecnologia' },
  { p: '🚀 Qual foi o primeiro satélite artificial lançado ao espaço?', r: 'sputnik', d: 'Tecnologia' },
  { p: '⚛️ Qual partícula subatômica não tem carga?', r: 'neutron', d: 'Física' },
  { p: '🌡️ A quantos graus Celsius a água ferve ao nível do mar?', r: '100', d: 'Física' },
  { p: '🧲 Qual cientista formulou a teoria da relatividade?', r: 'albert einstein', d: 'Física' },
  { p: '💻 Qual linguagem de programação foi criada por Guido van Rossum?', r: 'python', d: 'Tecnologia' },
  { p: '🔬 Qual é a unidade de medida da frequência?', r: 'hertz', d: 'Física' },
  { p: '🧬 Quantos pares de cromossomos tem o ser humano?', r: '23', d: 'Biologia' },
  { p: '⚛️ Qual é o símbolo químico do ouro?', r: 'au', d: 'Química' },
  { p: '🌌 Qual é o planeta mais próximo do Sol?', r: 'mercurio', d: 'Astronomia' },
  { p: '💡 Qual é a velocidade aproximada da luz em km/s?', r: '300000', d: 'Física' },
  { p: '🧪 Qual ácido é encontrado no estômago humano?', r: 'acido cloridrico', d: 'Biologia' },
  { p: '🚀 Qual agência espacial criou o Telescópio Hubble?', r: 'nasa', d: 'Tecnologia' },
  { p: '⚛️ Quantos elétrons tem o átomo de carbono?', r: '6', d: 'Ciência' },
  { p: '🌡️ Qual é o ponto de fusão do ferro em graus Celsius?', r: '1538', d: 'Física' },
  { p: '💻 Quem é considerado o pai da computação?', r: 'alan turing', d: 'Tecnologia' },
  { p: '🔬 Qual organela é responsável pela produção de energia na célula?', r: 'mitocondria', d: 'Biologia' },

  // ── MATEMÁTICA ────────────────────────────────────────────────────────────
  { p: '🔢 Qual é o resultado de 2³ + 3²?', r: '17', d: 'Matemática' },
  { p: '📐 Qual é a área de um círculo com raio 5 (use π≈3,14)?', r: '78.5', d: 'Matemática' },
  { p: '📊 Qual é o valor aproximado do número de ouro φ?', r: '1.618', d: 'Matemática' },
  { p: '🧮 Quantos zeros tem um trilhão?', r: '12', d: 'Matemática' },
  { p: '📈 Qual é o décimo número de Fibonacci?', r: '55', d: 'Matemática' },
  { p: '🔢 Qual é o resultado de 12! (fatorial de 12)?', r: '479001600', d: 'Matemática' },
  { p: '📐 Quantos graus tem um ângulo reto?', r: '90', d: 'Geometria' },
  { p: '🎯 Qual é a derivada de x²?', r: '2x', d: 'Cálculo' },
  { p: '📈 Quais são os números primos entre 10 e 20?', r: '11 13 17 19', d: 'Matemática' },
  { p: '🧮 Quanto é sen(90°)?', r: '1', d: 'Matemática' },
  { p: '🔢 Qual é o resultado de 100 / 4 + 5²?', r: '50', d: 'Matemática' },
  { p: '📐 Qual é o perímetro de um quadrado com lado 7?', r: '28', d: 'Geometria' },
  { p: '∑ Qual é a soma dos ângulos internos de um triângulo?', r: '180', d: 'Geometria' },
  { p: '🎲 Qual é a probabilidade de tirar número par em um dado?', r: '1/2', d: 'Matemática' },
  { p: '🧮 Quanto é log₂(64)?', r: '6', d: 'Matemática' },
  { p: '📊 Qual é a mediana de {2,4,6,8,10,12}?', r: '7', d: 'Estatística' },
  { p: '🔢 Qual é o resultado de (3+7) × (10-4)?', r: '60', d: 'Matemática' },
  { p: '📐 Qual é a hipotenusa de um triângulo com catetos 3 e 4?', r: '5', d: 'Geometria' },
  { p: '∑ Qual é a soma de 1 até 100?', r: '5050', d: 'Matemática' },

  // ── BASQUETE ──────────────────────────────────────────────────────────────
  { p: '🏀 Qual jogador foi chamado de "Black Mamba"?', r: 'kobe bryant', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2016?', r: 'cleveland cavaliers', d: 'Basquete' },
  { p: '🏀 Em qual time Shaquille O\'Neal ganhou 3 títulos seguidos?', r: 'los angeles lakers', d: 'Basquete' },
  { p: '🏀 Quantos títulos Shaquille O\'Neal ganhou na NBA?', r: '4', d: 'Basquete' },
  { p: '🏀 Qual jogador é conhecido como "The Mailman"?', r: 'karl malone', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2019?', r: 'toronto raptors', d: 'Basquete' },
  { p: '🏀 Em que posição joga Nikola Jokic?', r: 'pivo', d: 'Basquete' },
  { p: '🏀 Quantos MVPs das Finais LeBron James ganhou?', r: '4', d: 'Basquete' },
  { p: '🏀 Qual jogador ganhou o MVP das Finais em 2023?', r: 'nikola jokic', d: 'Basquete' },
  { p: '🏀 Em que time Larry Bird jogou toda a carreira?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Qual time perdeu para o Cleveland nas finais de 2016?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Em que universidade Michael Jordan jogou na faculdade?', r: 'carolina do norte', d: 'Basquete' },
  { p: '🏀 Quantos MVPs da temporada Kareem Abdul-Jabbar ganhou?', r: '6', d: 'Basquete' },
  { p: '🏀 Em que posição joga LeBron James?', r: 'ala', d: 'Basquete' },
  { p: '🏀 Qual brasileiro jogou no Cleveland Cavaliers?', r: 'anderson varejao', d: 'Basquete' },
  { p: '🏀 Qual jogador tem o recorde de bolas de três em uma temporada (402)?', r: 'stephen curry', d: 'Basquete' },
  { p: '🏀 Quantos times participam da NBA?', r: '30', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2020?', r: 'los angeles lakers', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Kevin Durant?', r: 'kd', d: 'Basquete' },
  { p: '🏀 Em que estado fica o time dos Spurs?', r: 'texas', d: 'Basquete' },
  { p: '🏀 Qual foi o número de Kobe Bryant aposentado pelo Lakers?', r: '8 e 24', d: 'Basquete' },
  { p: '🏀 Qual jogador ganhou o MVP das Finais de 2024?', r: 'jaylen brown', d: 'Basquete' },
  { p: '🏀 Quantas temporadas Dwyane Wade jogou pelo Miami Heat?', r: '16', d: 'Basquete' },
  { p: '🏀 Em que time Paul Pierce jogou a maior parte da carreira?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2014?', r: 'san antonio spurs', d: 'Basquete' },
  { p: '🏀 Qual país organizou os Jogos Olímpicos de 2024?', r: 'franca', d: 'Basquete' },
  { p: '🏀 Qual foi a pontuação máxima de Kobe Bryant em um único jogo?', r: '81', d: 'Basquete' },
  { p: '🏀 Qual jogador foi campeão da NBA com Phil Jackson além do Bulls?', r: 'kobe bryant', d: 'Basquete' },
  { p: '🏀 Qual time venceu o primeiro campeonato da NBA?', r: 'philadelphia warriors', d: 'Basquete' },
  { p: '🏀 Quantos MVPs da NBA Stephen Curry ganhou?', r: '2', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Giannis Antetokounmpo?', r: 'greek freak', d: 'Basquete' },
  { p: '🏀 Qual foi o primeiro Dream Team olímpico dos EUA (ano)?', r: '1992', d: 'Basquete' },
  { p: '🏀 Em que cidade foram os Jogos Olímpicos do Dream Team de 1992?', r: 'barcelona', d: 'Basquete' },
  { p: '🏀 Qual seleção derrotou os EUA no basquete olímpico de 2004?', r: 'argentina', d: 'Basquete' },
  { p: '🏀 Qual seleção venceu o Mundial FIBA de 2023?', r: 'alemanha', d: 'Basquete' },
  { p: '🏀 Quantos jogadores de cada time ficam em quadra no basquete?', r: '5', d: 'Basquete' },
  { p: '🏀 Quantos minutos dura um quarto na NBA?', r: '12', d: 'Basquete' },
  { p: '🏀 Quantos segundos um time tem para arremessar na NBA (shot clock)?', r: '24', d: 'Basquete' },
  { p: '🏀 Qual é a altura oficial do aro de basquete em metros?', r: '3.05', d: 'Basquete' },
  { p: '🏀 Quantas faltas um jogador pode cometer antes de ser expulso na NBA?', r: '6', d: 'Basquete' },
  { p: '🏀 Qual franquia da NBA tem mais títulos?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Quem inventou o basquete?', r: 'james naismith', d: 'Basquete' },
  { p: '🏀 Em que ano o basquete foi inventado?', r: '1891', d: 'Basquete' },
  { p: '🏀 Qual é o nome do troféu entregue ao campeão da NBA?', r: 'larry obrien', d: 'Basquete' },
  { p: '🏀 Em que ano foi fundada a NBA?', r: '1946', d: 'Basquete' },
];

// ─── HANDLE QUIZ ─────────────────────────────────────────────────────────────

async function handleQuiz(sock, msg, jid, author, senderJid, caption = '') {
  await syncQuizPointsFromDB(senderJid);

  // ── Verificar se está respondendo uma pergunta ativa
  if (quizState.has(senderJid)) {
    const state = quizState.get(senderJid);
    const resposta = normalize(
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    );
    const correta = normalize(state.r);

    clearTimeout(state.timeout);
    quizState.delete(senderJid);

    if (!resposta) {
      await sock.sendMessage(jid, {
        text: `❌ Você deve enviar uma *resposta em texto*, não figurinha! 😅`,
      }, { quoted: msg });
      return;
    }

    if (resposta.includes(correta) || correta.includes(resposta)) {
      const pts = (pontosMap.get(senderJid) || 0) + 10;
      pontosMap.set(senderJid, pts);
      await saveQuizPointsToDB(senderJid, pts);
      const goldReward = 15;
      await changeGold(senderJid, goldReward);

      try {
        await prepareDailyMissionState(senderJid);
        await Usuario.findOneAndUpdate(
          { idWhatsApp: senderJid },
          { $inc: { 'dailyMissions.progress.quiz5': 1 } }
        );
        console.log(`✅ Missão quiz5 atualizada para ${senderJid}`);
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

  // ── Verificar limite diário de 10 quiz
  const todayKey = getTodayKey(senderJid);
  const quizCount = quizDailyCount.get(todayKey) || 0;

  if (quizCount >= 10) {
    await sock.sendMessage(jid, {
      text: `⚠️ *${author}*, você atingiu o limite de 10 quiz por dia! Volte amanhã! 😴`,
    }, { quoted: msg });
    return;
  }

  // ── Filtrar por categoria
  const cmd = caption.trim().toLowerCase().split(' ')[0];
  const cmdClean = cmd.replace(/^[!.,\/@]/, '');
  let perguntasFiltradas = perguntasQuiz;

  if (cmdClean === 'quizfut') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Futebol');
  } else if (cmdClean === 'quizctec') {
    perguntasFiltradas = perguntasQuiz.filter(q =>
      ['Ciência', 'Química', 'Física', 'Biologia', 'Astronomia', 'Tecnologia'].includes(q.d)
    );
  } else if (cmdClean === 'quizgeo') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Geografia');
  } else if (cmdClean === 'quizmat') {
    perguntasFiltradas = perguntasQuiz.filter(q =>
      ['Matemática', 'Geometria', 'Cálculo', 'Estatística'].includes(q.d)
    );
  } else if (cmdClean === 'quizhis') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'História');
  } else if (cmdClean === 'quizbsq') {
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Basquete');
  }

  if (perguntasFiltradas.length === 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Nenhuma pergunta disponível para essa categoria no momento.',
    }, { quoted: msg });
    return;
  }

  // ── Incrementar contador diário ANTES de sortear
  quizDailyCount.set(todayKey, quizCount + 1);

  // ── Sortear pergunta sem repetir recentemente (por usuário)
  if (!global.recentQuiz) global.recentQuiz = {};
  if (!global.recentQuiz[senderJid]) global.recentQuiz[senderJid] = [];

  let q;
  let tentativas = 0;
  do {
    q = perguntasFiltradas[Math.floor(Math.random() * perguntasFiltradas.length)];
    tentativas++;
  } while (
    global.recentQuiz[senderJid].includes(q.p) &&
    tentativas < 20 &&
    perguntasFiltradas.length > 2
  );

  global.recentQuiz[senderJid].push(q.p);
  if (global.recentQuiz[senderJid].length > 5) global.recentQuiz[senderJid].shift();

  // ── Timeout de 30s para expirar a pergunta
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
  const comentario =
    pts === 0   ? 'Que inútil, nem um ponto ainda!' :
    pts < 30    ? 'Tá fraco(a)! Joga mais!' :
    pts < 80    ? 'Razoável, pode melhorar!' :
    pts < 150   ? 'Bom desempenho! Continua!' :
    pts < 250   ? 'Excelente! Quase lá!' :
                  'MONSTRO! Que pontuação!';

  await sock.sendMessage(jid, {
    text: `🏅 *${author}*, você tem *${pts} pontos* no quiz! ☁️\n\n_${comentario}_`,
  }, { quoted: msg });
}

// ─── !rankjogos ──────────────────────────────────────────────────────────────

async function handleRankJogos(sock, msg, jid, contactNames = {}) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.',
    }, { quoted: msg });
    return;
  }

  try {
    const membros = await CarteiraGrupo.find({ idGrupo: jid }).lean();
    if (!membros.length) {
      await sock.sendMessage(jid, {
        text: '📭 Nenhum membro registrado neste grupo! Joga *!quiz* primeiro!',
      }, { quoted: msg });
      return;
    }

    const idsMembros = membros.map(m => m.idWhatsApp);

    const usuarios = await Usuario.find({
      idWhatsApp: { $in: idsMembros },
      quizPoints:  { $exists: true, $gt: 0 },
    }).lean();

    if (!usuarios.length) {
      await sock.sendMessage(jid, {
        text: '📭 Nenhum ponto registrado neste grupo! Joga *!quiz* primeiro!',
      }, { quoted: msg });
      return;
    }

    const sorted = usuarios
      .sort((a, b) => b.quizPoints - a.quizPoints)
      .slice(0, 10);

    let texto = `🏆 *RANKING DE QUIZ — ESTE GRUPO* 🏆\n\n`;
    sorted.forEach((u, i) => {
      const nome = resolverNome(u.idWhatsApp, contactNames);
      texto += `${MEDALS[i]} *${nome}* — ${u.quizPoints} pts ☁️\n`;
    });
    texto += `\n_Joga *!quiz* pra subir!_`;

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
  } catch (e) {
    console.error('[RankJogos] handleRankJogos:', e.message);
    await sock.sendMessage(jid, {
      text: '⚠️ Erro ao carregar o ranking.',
    }, { quoted: msg });
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

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