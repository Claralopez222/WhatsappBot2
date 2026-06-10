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
  if (!userId) return;
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
  if (!userId) return;
  try {
    await Usuario.findOneAndUpdate(
      { idWhatsApp: userId },
      { $set: { quizPoints: pontos } },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('⚠️ Erro ao salvar pontos quiz no MongoDB:', e.message);
  }
}

async function changeGold(userId, amount, groupJid) {
  if (!userId || userId.endsWith('@lid')) {
    console.warn('⚠️ changeGold ignorado: jid inválido:', userId);
    return 0;
  }
  try {
    if (amount > 0) await prepareDailyMissionState(userId);
    const update = { $inc: { gold: amount } };
    if (amount > 0) update['$inc']['dailyMissions.progress.gold500'] = amount;

    if (groupJid) {
      await CarteiraGrupo.findOneAndUpdate(
        { idWhatsApp: userId, idGrupo: groupJid },
        update,
        { upsert: true, new: true }
      );
    }

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
  { p: '⚽ Qual clube brasileiro foi tricampeão da Copa Libertadores?', r: 'independiente', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou mais Copas do Mundo como jogador?', r: 'pele', d: 'Futebol' },
  { p: '⚽ Em que ano o Brasil conquistou sua primeira Copa do Mundo?', r: '1958', d: 'Futebol' },
  { p: '⚽ Qual foi o artilheiro da Copa do Mundo de 2006?', r: 'miroslav klose', d: 'Futebol' },
  { p: '⚽ Qual técnico levou a Alemanha ao tetracampeonato em 1990?', r: 'franz beckenbauer', d: 'Futebol' },
  { p: '⚽ Em qual estádio foi disputada a final da Copa de 2014?', r: 'maracana', d: 'Futebol' },
  { p: '⚽ Qual seleção ganhou a Copa América de 2021?', r: 'argentina', d: 'Futebol' },
  { p: '⚽ Qual jogador é conhecido como "O Rei"?', r: 'pele', d: 'Futebol' },
  { p: '⚽ Em que clube Zidane encerrou a carreira como jogador?', r: 'real madrid', d: 'Futebol' },
  { p: '⚽ Qual seleção foi campeã da Eurocopa de 2016?', r: 'portugal', d: 'Futebol' },
  { p: '⚽ Qual jogador marcou o gol de bicicleta mais famoso da história do futebol em 2018?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Em que ano o Flamengo venceu sua primeira Copa Libertadores?', r: '1981', d: 'Futebol' },
  { p: '⚽ Qual clube tem mais títulos do Campeonato Brasileiro?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Quantas vezes Messi ganhou a Bola de Ouro?', r: '8', d: 'Futebol' },
  { p: '⚽ Qual jogador é o maior artilheiro da história da Seleção Argentina?', r: 'lionel messi', d: 'Futebol' },
  { p: '⚽ Em que ano o Paris Saint-Germain foi fundado?', r: '1970', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 2010?', r: 'espanha', d: 'Futebol' },
  { p: '⚽ Qual jogador foi artilheiro da Copa do Mundo de 2018?', r: 'harry kane', d: 'Futebol' },
  { p: '⚽ Em que cidade fica o estádio Camp Nou?', r: 'barcelona', d: 'Futebol' },
  { p: '⚽ Qual seleção derrotou o Brasil na semifinal da Copa de 2014?', r: 'alemanha', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou a Chuteira de Ouro na Copa de 2014?', r: 'james rodriguez', d: 'Futebol' },
  { p: '⚽ Qual clube italiano tem o apelido de "La Vecchia Signora"?', r: 'juventus', d: 'Futebol' },
  { p: '⚽ Em que ano o São Paulo venceu sua última Copa Libertadores?', r: '1994', d: 'Futebol' },
  { p: '⚽ Qual jogador é conhecido como "CR7"?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Quantos títulos da Eurocopa a Espanha tem?', r: '3', d: 'Futebol' },
  { p: '⚽ Qual jogador levou o Liverpool ao título da Premier League em 2020?', r: 'jordan henderson', d: 'Futebol' },
  { p: '⚽ Qual foi o primeiro país africano a chegar às semifinais de uma Copa?', r: 'camaroes', d: 'Futebol' },
  { p: '⚽ Em qual posição Cafu jogou durante toda a sua carreira?', r: 'lateral direito', d: 'Futebol' },
  { p: '⚽ Qual clube vendeu Neymar ao PSG pelo valor recorde de 222 milhões de euros?', r: 'barcelona', d: 'Futebol' },
  { p: '⚽ Qual técnico venceu a Liga dos Campeões com dois clubes diferentes?', r: 'jose mourinho', d: 'Futebol' },
  { p: '⚽ Qual seleção ganhou a Copa do Mundo de 2006?', r: 'italia', d: 'Futebol' },
  { p: '⚽ Em que ano foi realizada a primeira Copa do Mundo?', r: '1930', d: 'Futebol' },
  { p: '⚽ Qual país foi campeão da primeira Copa do Mundo?', r: 'uruguai', d: 'Futebol' },
  { p: '⚽ Qual clube inglês tem o apelido de "The Blues"?', r: 'chelsea', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou o Prêmio Puskas de 2022?', r: 'marcin oleksy', d: 'Futebol' },
  { p: '⚽ Em que ano o Cruzeiro foi fundado?', r: '1921', d: 'Futebol' },
  { p: '⚽ Quantas Copas do Mundo o Brasil conquistou?', r: '5', d: 'Futebol' },
  { p: '⚽ Qual foi o último país a sediar a Copa do Mundo pela segunda vez?', r: 'brasil', d: 'Futebol' },
  { p: '⚽ Em que posição jogava Roberto Carlos?', r: 'lateral esquerdo', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa das Confederações de 2017?', r: 'alemanha', d: 'Futebol' },
  { p: '⚽ Qual time italiano foi campeão da Champions League em 2003?', r: 'milan', d: 'Futebol' },
  { p: '⚽ Qual é o apelido do estádio do Corinthians?', r: 'neo quimica arena', d: 'Futebol' },
  { p: '⚽ Qual jogador é o maior artilheiro da história da Champions League?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Em que ano Ronaldinho Gaúcho venceu a Copa do Mundo?', r: '2002', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 1998?', r: 'franca', d: 'Futebol' },
  { p: '⚽ Qual jogador tem mais títulos na história do futebol europeu?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Qual clube ganhou a Libertadores de 2022?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Em que ano o Grêmio ganhou sua última Copa Libertadores?', r: '1995', d: 'Futebol' },
  { p: '⚽ Qual jogador ficou conhecido como "O Fenômeno"?', r: 'ronaldo', d: 'Futebol' },
  { p: '⚽ Qual clube holandês revelou Johan Cruyff?', r: 'ajax', d: 'Futebol' },

  // ── HISTÓRIA ──────────────────────────────────────────────────────────────
  { p: '📜 Em que ano ocorreu a Revolução Francesa?', r: '1789', d: 'História' },
  { p: '🏛️ Quem foi o último faraó do Egito Antigo?', r: 'cleópatra', d: 'História' },
  { p: '⚔️ Em que ano Alexandre o Grande morreu?', r: '323 ac', d: 'História' },
  { p: '📚 Qual foi a primeira civilização da América a usar a escrita?', r: 'olmeca', d: 'História' },
  { p: '⚖️ Quem assinou a Lei Áurea no Brasil?', r: 'princesa isabel', d: 'História' },
  { p: '🗡️ Em que ano ocorreu a queda de Constantinopla?', r: '1453', d: 'História' },
  { p: '💀 Qual imperador romano é conhecido como "o Augusto"?', r: 'augusto', d: 'História' },
  { p: '⚔️ Em que ano começou a Revolução Industrial?', r: '1760', d: 'História' },
  { p: '🏛️ Qual civilização construiu Machu Picchu?', r: 'inca', d: 'História' },
  { p: '📜 Em que ano ocorreu a Independência do México?', r: '1810', d: 'História' },
  { p: '🔥 Em que ano ocorreu a Revolução Russa?', r: '1917', d: 'História' },
  { p: '⚔️ Em que ano começou a Segunda Guerra Mundial?', r: '1939', d: 'História' },
  { p: '🏰 Qual foi o último czar da Rússia?', r: 'nicolau ii', d: 'História' },
  { p: '🌙 Em que ano foi lançado o primeiro homem ao espaço?', r: '1961', d: 'História' },
  { p: '💣 Qual país lançou as bombas atômicas no Japão?', r: 'estados unidos', d: 'História' },
  { p: '📜 Qual imperador mandou construir a Grande Muralha da China?', r: 'qin shi huang', d: 'História' },
  { p: '🏛️ Em que ano foi promulgada a Constituição Brasileira atual?', r: '1988', d: 'História' },
  { p: '⚔️ Em que batalha os persas foram derrotados pelos gregos em 490 a.C.?', r: 'maratona', d: 'História' },
  { p: '🗡️ Quem foi o fundador do Islã?', r: 'maome', d: 'História' },
  { p: '🌍 Em que ano Nelson Mandela se tornou presidente da África do Sul?', r: '1994', d: 'História' },
  { p: '📚 Qual foi o primeiro livro impresso por Gutenberg?', r: 'biblia', d: 'História' },
  { p: '⚖️ Em que ano os EUA declararam guerra ao Japão?', r: '1941', d: 'História' },
  { p: '🔱 Qual foi o maior império da história em extensão territorial?', r: 'britanico', d: 'História' },
  { p: '🌊 Em que ano ocorreu o bombardeio de Pearl Harbor?', r: '1941', d: 'História' },
  { p: '🏰 Em que ano Getúlio Vargas assumiu o poder no Brasil?', r: '1930', d: 'História' },
  { p: '⚔️ Qual tratado dividiu o mundo entre Portugal e Espanha?', r: 'tordesilhas', d: 'História' },
  { p: '📜 Qual filósofo grego foi condenado à morte por corromper a juventude?', r: 'socrates', d: 'História' },
  { p: '🌍 Em que ano a União Soviética foi dissolvida?', r: '1991', d: 'História' },
  { p: '🏛️ Qual civilização inventou a democracia?', r: 'grega', d: 'História' },
  { p: '⚔️ Quantos anos durou a Primeira Guerra Mundial?', r: '4', d: 'História' },

  // ── GEOGRAFIA ─────────────────────────────────────────────────────────────
  { p: '🌍 Qual é a capital da Nova Zelândia?', r: 'wellington', d: 'Geografia' },
  { p: '🏔️ Qual é a montanha mais alta do mundo?', r: 'everest', d: 'Geografia' },
  { p: '🌊 Qual é o lago mais profundo do mundo?', r: 'baikal', d: 'Geografia' },
  { p: '🌐 Qual é o menor país do mundo?', r: 'vaticano', d: 'Geografia' },
  { p: '🏙️ Qual é a cidade mais populosa do Brasil?', r: 'sao paulo', d: 'Geografia' },
  { p: '🌴 Em qual continente fica o Rio Amazonas?', r: 'america do sul', d: 'Geografia' },
  { p: '🏝️ Qual é a maior ilha do mundo?', r: 'groelandia', d: 'Geografia' },
  { p: '🌏 Qual país tem a maior população do mundo?', r: 'india', d: 'Geografia' },
  { p: '🏙️ Qual é a capital da Argentina?', r: 'buenos aires', d: 'Geografia' },
  { p: '🗺️ Qual é o maior estado do Brasil?', r: 'amazonas', d: 'Geografia' },
  { p: '🏔️ Qual é o ponto mais baixo da Terra?', r: 'mar morto', d: 'Geografia' },
  { p: '🌊 Qual é o maior oceano do mundo?', r: 'pacifico', d: 'Geografia' },
  { p: '🏜️ Qual é o maior deserto quente do mundo?', r: 'saara', d: 'Geografia' },
  { p: '🗿 Em qual continente fica o Egito?', r: 'africa', d: 'Geografia' },
  { p: '🌍 Qual é a capital da África do Sul?', r: 'pretoria', d: 'Geografia' },
  { p: '🏝️ De qual país faz parte a Ilha de Páscoa?', r: 'chile', d: 'Geografia' },
  { p: '🌊 Qual é o maior mar do mundo?', r: 'mar das filipinas', d: 'Geografia' },
  { p: '🌐 Qual é o rio mais longo da América do Sul?', r: 'amazonas', d: 'Geografia' },
  { p: '🏙️ Qual é a capital do México?', r: 'cidade do mexico', d: 'Geografia' },
  { p: '🗺️ Qual é a capital da Coreia do Sul?', r: 'seul', d: 'Geografia' },
  { p: '🌍 Qual é o país mais extenso da América do Sul?', r: 'brasil', d: 'Geografia' },
  { p: '🏔️ Em qual país ficam os Alpes?', r: 'suica franca italia austria', d: 'Geografia' },
  { p: '🌐 Qual é o ponto mais fundo do oceano?', r: 'fossa das marianas', d: 'Geografia' },
  { p: '🏜️ Qual é o maior país da África?', r: 'algeria', d: 'Geografia' },
  { p: '🌊 Qual estreito separa a Europa da África?', r: 'gibraltar', d: 'Geografia' },

  // ── CIÊNCIA & TECNOLOGIA ──────────────────────────────────────────────────
  { p: '⚛️ Qual é o número atômico do carbono?', r: '6', d: 'Ciência' },
  { p: '🔬 Quem descobriu a teoria da gravitação universal?', r: 'isaac newton', d: 'Ciência' },
  { p: '🌌 Qual é o planeta mais distante do Sol?', r: 'netuno', d: 'Astronomia' },
  { p: '💻 Qual empresa criou o sistema iOS?', r: 'apple', d: 'Tecnologia' },
  { p: '🧬 Quantas bases nitrogenadas compõem o DNA?', r: '4', d: 'Biologia' },
  { p: '⭐ Qual é o nome da nossa estrela?', r: 'sol', d: 'Astronomia' },
  { p: '🧪 Qual é o símbolo químico da prata?', r: 'ag', d: 'Química' },
  { p: '🔭 Em que ano foi lançado o Telescópio Hubble?', r: '1990', d: 'Astronomia' },
  { p: '💡 Quem inventou o telefone?', r: 'alexander graham bell', d: 'Tecnologia' },
  { p: '🚀 Qual foi o primeiro homem a ir ao espaço?', r: 'yuri gagarin', d: 'Tecnologia' },
  { p: '⚛️ Qual partícula subatômica tem carga positiva?', r: 'proton', d: 'Física' },
  { p: '🌡️ A quantos graus Celsius a água congela?', r: '0', d: 'Física' },
  { p: '🧲 Qual cientista descobriu a teoria da evolução?', r: 'charles darwin', d: 'Biologia' },
  { p: '💻 Qual linguagem de programação é usada para desenvolvimento web front-end?', r: 'javascript', d: 'Tecnologia' },
  { p: '🔬 Qual é a unidade de medida da corrente elétrica?', r: 'ampere', d: 'Física' },
  { p: '🧬 Quantos reinos existem na classificação dos seres vivos?', r: '5', d: 'Biologia' },
  { p: '⚛️ Qual é o símbolo químico do sódio?', r: 'na', d: 'Química' },
  { p: '🌌 Qual é o maior planeta do sistema solar?', r: 'jupiter', d: 'Astronomia' },
  { p: '💡 Qual é a força que atrai os objetos para o centro da Terra?', r: 'gravidade', d: 'Física' },
  { p: '🧪 Qual gás os animais expiram no processo da respiração?', r: 'dioxido de carbono', d: 'Biologia' },
  { p: '🚀 Qual foi a missão que levou o primeiro homem à Lua?', r: 'apollo 11', d: 'Tecnologia' },
  { p: '⚛️ Qual é o nome da partícula responsável pela força eletromagnética?', r: 'foton', d: 'Física' },
  { p: '🌡️ Qual é o elemento com maior ponto de ebulição?', r: 'tungstenio', d: 'Física' },
  { p: '💻 Qual empresa criou o Android?', r: 'google', d: 'Tecnologia' },
  { p: '🔬 Qual estrutura celular é responsável pela síntese de proteínas?', r: 'ribossomo', d: 'Biologia' },

  // ── MATEMÁTICA ────────────────────────────────────────────────────────────
  { p: '🔢 Qual é o resultado de 5! (fatorial de 5)?', r: '120', d: 'Matemática' },
  { p: '📐 Qual é a fórmula para calcular a área de um triângulo?', r: 'base vezes altura dividido por 2', d: 'Matemática' },
  { p: '📊 Qual é o valor aproximado de π (pi)?', r: '3.14', d: 'Matemática' },
  { p: '🧮 Quantos lados tem um decágono?', r: '10', d: 'Matemática' },
  { p: '📈 Qual é o quinto número de Fibonacci?', r: '5', d: 'Matemática' },
  { p: '🔢 Qual é o resultado de 2^10?', r: '1024', d: 'Matemática' },
  { p: '📐 Quantos graus tem um ângulo raso?', r: '180', d: 'Geometria' },
  { p: '🎯 Qual é a derivada de sen(x)?', r: 'cos x', d: 'Cálculo' },
  { p: '📈 Quantos números primos existem entre 1 e 10?', r: '4', d: 'Matemática' },
  { p: '🧮 Quanto é cos(0°)?', r: '1', d: 'Matemática' },
  { p: '🔢 Qual é o resultado de 144 / 12?', r: '12', d: 'Matemática' },
  { p: '📐 Quantos ângulos iguais tem um triângulo equilátero?', r: '3', d: 'Geometria' },
  { p: '∑ Qual é a soma dos ângulos internos de um quadrilátero?', r: '360', d: 'Geometria' },
  { p: '🎲 Qual é a probabilidade de tirar cara em um lançamento de moeda?', r: '1/2', d: 'Matemática' },
  { p: '🧮 Quanto é log₁₀(1000)?', r: '3', d: 'Matemática' },
  { p: '📊 Qual é a moda de {3, 3, 5, 7, 7, 7, 9}?', r: '7', d: 'Estatística' },
  { p: '🔢 Qual é o resultado de 15² - 10²?', r: '125', d: 'Matemática' },
  { p: '📐 Qual é a área de um quadrado com lado 6?', r: '36', d: 'Geometria' },
  { p: '∑ Qual é o resultado da soma de 1 + 2 + 3 + ... + 10?', r: '55', d: 'Matemática' },

  // ── BASQUETE ──────────────────────────────────────────────────────────────
  { p: '🏀 Qual jogador é conhecido como "The Answer"?', r: 'allen iverson', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2021?', r: 'milwaukee bucks', d: 'Basquete' },
  { p: '🏀 Em qual time Hakeem Olajuwon ganhou seus dois títulos?', r: 'houston rockets', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA o Golden State Warriors tem?', r: '7', d: 'Basquete' },
  { p: '🏀 Qual jogador é conhecido como "The Point God"?', r: 'chris paul', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2022?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Em que posição joga um armador?', r: 'point guard', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA Michael Jordan ganhou?', r: '6', d: 'Basquete' },
  { p: '🏀 Qual jogador ganhou o MVP da temporada NBA em 2024?', r: 'nikola jokic', d: 'Basquete' },
  { p: '🏀 Em que time Magic Johnson jogou toda a carreira?', r: 'los angeles lakers', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2023?', r: 'denver nuggets', d: 'Basquete' },
  { p: '🏀 Qual jogador tem o apelido de "The Big Fundamental"?', r: 'tim duncan', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA Bill Russell ganhou pelo Celtics?', r: '11', d: 'Basquete' },
  { p: '🏀 Em que posição joga um pivô?', r: 'center', d: 'Basquete' },
  { p: '🏀 Qual brasileiro atuou no Phoenix Suns?', r: 'leandro barbosa', d: 'Basquete' },
  { p: '🏀 Qual jogador tem mais assistências na história da NBA?', r: 'john stockton', d: 'Basquete' },
  { p: '🏀 Quantos pontos vale uma cesta de três pontos?', r: '3', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2018?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Shaquille O\'Neal?', r: 'shaq', d: 'Basquete' },
  { p: '🏀 Em que estado fica o time dos Celtics?', r: 'massachusetts', d: 'Basquete' },
  { p: '🏀 Qual jogador marcou 100 pontos em um único jogo da NBA?', r: 'wilt chamberlain', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2024?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Quantas temporadas LeBron James jogou no Miami Heat?', r: '4', d: 'Basquete' },
  { p: '🏀 Em que time Charles Barkley jogou a maior parte da carreira?', r: 'phoenix suns', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2015?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Qual país venceu o basquete masculino nas Olimpíadas de 2024?', r: 'estados unidos', d: 'Basquete' },
  { p: '🏀 Qual foi a pontuação máxima de Wilt Chamberlain em uma temporada?', r: '50.4', d: 'Basquete' },
  { p: '🏀 Qual jogador é chamado de "The Joker"?', r: 'nikola jokic', d: 'Basquete' },
  { p: '🏀 Qual time ganhou o primeiro título da NBA depois de ser criado em 1966?', r: 'chicago bulls', d: 'Basquete' },
  { p: '🏀 Quantos MVPs da NBA LeBron James ganhou?', r: '4', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Jayson Tatum?', r: 'tatum', d: 'Basquete' },
  { p: '🏀 Qual foi o Dream Team mais famoso (ano)?', r: '1992', d: 'Basquete' },
  { p: '🏀 Em que cidade ficam os Lakers?', r: 'los angeles', d: 'Basquete' },
  { p: '🏀 Qual seleção venceu o basquete feminino nas Olimpíadas de 2024?', r: 'estados unidos', d: 'Basquete' },
  { p: '🏀 Qual seleção ganhou o Mundial FIBA de 2019?', r: 'espanha', d: 'Basquete' },
  { p: '🏀 Quantos pontos vale um lançamento livre?', r: '1', d: 'Basquete' },
  { p: '🏀 Quantos minutos dura uma partida de basquete olímpico?', r: '40', d: 'Basquete' },
  { p: '🏀 Quantos segundos um time tem para cruzar a linha do meio-campo na NBA?', r: '8', d: 'Basquete' },
  { p: '🏀 Qual é a distância da linha de três pontos ao aro na NBA (em metros)?', r: '7.24', d: 'Basquete' },
  { p: '🏀 Quantas faltas técnicas resultam em expulsão na NBA?', r: '2', d: 'Basquete' },
  { p: '🏀 Qual franquia da NBA nunca ganhou um título?', r: 'oklahoma city thunder', d: 'Basquete' },
  { p: '🏀 Em qual país o basquete foi criado?', r: 'canada', d: 'Basquete' },
  { p: '🏀 Em que ano Kobe Bryant foi draftado pela NBA?', r: '1996', d: 'Basquete' },
  { p: '🏀 Qual é o nome do troféu de MVP da temporada NBA?', r: 'maurice podoloff', d: 'Basquete' },
  { p: '🏀 Em que ano a WNBA foi fundada?', r: '1996', d: 'Basquete' },
];

async function handleQuiz(sock, msg, jid, author, senderJid, caption = '') {
  await syncQuizPointsFromDB(senderJid);

  // ── Resolver @lid para jid real
  let resolvedJid = senderJid;
  if (senderJid?.endsWith('@lid')) {
    try {
      const number = senderJid.split('@')[0].split(':')[0];
      const results = await sock.onWhatsApp(number);
      if (results?.length > 0 && results[0].jid) {
        resolvedJid = results[0].jid;
      }
    } catch {
      resolvedJid = senderJid; // mantém o original se falhar
    }
  }

  // ── Verificar se está respondendo uma pergunta ativa
  if (quizState.has(senderJid)) {
    const state = quizState.get(senderJid);

    const textoRaw = caption ||
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.ephemeralMessage?.message?.conversation ||
      msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text || '';

    const resposta = normalize(textoRaw);
    const correta  = normalize(state.r);

    if (
      textoRaw.startsWith('!') ||
      textoRaw.startsWith('.') ||
      textoRaw.startsWith('/') ||
      textoRaw.startsWith(',')
    ) {
      return;
    }

    clearTimeout(state.timeout);
    quizState.delete(senderJid);

    if (!resposta.trim()) {
      await sock.sendMessage(jid, {
        text: `❌ Você deve enviar uma *resposta em texto*! 😅`,
      }, { quoted: msg });
      return;
    }

    const respostasValidas = correta.split('/').map(r => r.trim()).filter(Boolean);
    const acertou = respostasValidas.some(rv =>
      resposta.includes(rv) || rv.includes(resposta)
    );

    if (acertou) {
      const pts = (pontosMap.get(resolvedJid) || 0) + 10;  // ← corrigido
      pontosMap.set(resolvedJid, pts);                      // ← corrigido
      await saveQuizPointsToDB(resolvedJid, pts);           // ← corrigido
      const goldReward = 15;
      await changeGold(resolvedJid, goldReward, jid);

      try {
        await prepareDailyMissionState(resolvedJid);
        await Usuario.findOneAndUpdate(
          { idWhatsApp: resolvedJid },
          { $inc: { 'dailyMissions.progress.quiz5': 1 } }
        );
      } catch (e) {
        console.error('⚠️ Erro ao atualizar progresso quiz5:', e.message);
      }

      await sock.sendMessage(jid, {
        text:
          `✅ *CORRETO!* Parabéns, *${author}*! 🎉\n\n` +
          `💰 *+10 pontos!* Total: *${pts} pts* ☁️\n` +
          `💵 *+${goldReward} gold!*`,
      }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, {
        text:
          `❌ *ERROU!* *${author}*!\n\n` +
          `✅ Resposta correta: *${state.r}* 😬`,
      }, { quoted: msg });
    }
    return;
  }

  // ── Verificar limite diário de 10 quiz
  const todayKey  = getTodayKey(senderJid);
  const quizCount = quizDailyCount.get(todayKey) || 0;

  if (quizCount >= 10) {
    await sock.sendMessage(jid, {
      text: `⚠️ *${author}*, você atingiu o limite de *10 quiz por dia*! Volte amanhã! 😴`,
    }, { quoted: msg });
    return;
  }

  // ── Filtrar por categoria
  const cmdRaw   = caption.trim().toLowerCase().split(' ')[0];
  const cmdClean = cmdRaw.replace(/^[!.,\/@]/, '');

  const categoriaMap = {
    quizfut:  q => q.d === 'Futebol',
    quizctec: q => ['Ciência', 'Química', 'Física', 'Biologia', 'Astronomia', 'Tecnologia'].includes(q.d),
    quizgeo:  q => q.d === 'Geografia',
    quizmat:  q => ['Matemática', 'Geometria', 'Cálculo', 'Estatística'].includes(q.d),
    quizhis:  q => q.d === 'História',
    quizbsq:  q => q.d === 'Basquete',
  };

  const filtro = categoriaMap[cmdClean];
  const perguntasFiltradas = filtro ? perguntasQuiz.filter(filtro) : perguntasQuiz;

  if (perguntasFiltradas.length === 0) {
    await sock.sendMessage(jid, {
      text: '⚠️ Nenhuma pergunta disponível para essa categoria no momento.',
    }, { quoted: msg });
    return;
  }

  // ── Incrementar contador diário
  quizDailyCount.set(todayKey, quizCount + 1);

  // ── Sortear pergunta sem repetir recentemente
  if (!global.recentQuiz)            global.recentQuiz = {};
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

  // ── Timeout de 30s
  const timeout = setTimeout(() => {
    if (quizState.has(senderJid)) {
      quizState.delete(senderJid);
      sock.sendMessage(jid, {
        text: `⏰ *Tempo esgotado*, *${author}*!\n\n✅ Resposta correta: *${q.r}* 😬`,
      }).catch(() => {});
    }
  }, 30000);

  quizState.set(senderJid, { r: q.r, timeout });

  const restantes = 10 - quizCount - 1;

  await sock.sendMessage(jid, {
    text:
      `🧠 *QUIZ — ${q.d.toUpperCase()}*\n\n` +
      `❓ *${q.p}*\n\n` +
      `⏱️ _Você tem 30 segundos!_\n` +
      `📊 _Quiz ${quizCount + 1}/10 hoje · ${restantes} restante(s)_`,
  }, { quoted: msg });
}

// ─── !pontos ─────────────────────────────────────────────────────────────────

async function handlePontos(sock, msg, jid, author, senderJid) {

  // ── Resolver @lid para jid real
  let resolvedJid = senderJid;
  if (senderJid?.endsWith('@lid')) {
    try {
      const number = senderJid.split('@')[0].split(':')[0];
      const results = await sock.onWhatsApp(number);
      if (results?.length > 0 && results[0].jid) {
        resolvedJid = results[0].jid;
      }
    } catch {
      resolvedJid = senderJid;
    }
  }

  await syncQuizPointsFromDB(resolvedJid);        // ← corrigido
  const pts = pontosMap.get(resolvedJid) || 0;    // ← corrigido

  const { emoji, titulo, comentario } =
    pts === 0   ? { emoji: '😴', titulo: 'Novato',        comentario: 'Nem começou ainda... joga logo!' } :
    pts < 30    ? { emoji: '😬', titulo: 'Iniciante',     comentario: 'Tá fraco(a)! Joga mais!' } :
    pts < 80    ? { emoji: '🙂', titulo: 'Aprendiz',      comentario: 'Razoável, pode melhorar!' } :
    pts < 150   ? { emoji: '😊', titulo: 'Intermediário', comentario: 'Bom desempenho! Continua assim!' } :
    pts < 250   ? { emoji: '😎', titulo: 'Avançado',      comentario: 'Excelente! Quase no topo!' } :
    pts < 500   ? { emoji: '🏆', titulo: 'Expert',        comentario: 'Impressionante! Você é bom(a)!' } :
                  { emoji: '👑', titulo: 'LENDA',          comentario: 'MONSTRO! Que pontuação absurda!' };

  // Barra de progresso
  const niveis     = [0, 30, 80, 150, 250, 500, Infinity];
  const nivelAtual = niveis.findIndex(n => pts < n) - 1;
  const ptsBase    = niveis[Math.max(nivelAtual, 0)];
  const ptsTopo    = niveis[Math.min(nivelAtual + 1, niveis.length - 1)];
  const pct        = ptsTopo === Infinity ? 100 : Math.floor(((pts - ptsBase) / (ptsTopo - ptsBase)) * 100);
  const barsOn     = Math.min(10, Math.floor(pct / 10));
  const barra      = '█'.repeat(barsOn) + '░'.repeat(10 - barsOn);

  await sock.sendMessage(jid, {
    text:
      `${emoji} *PONTUAÇÃO DE QUIZ*\n\n` +
      `👤 *Jogador:* ${author}\n` +
      `🏅 *Pontos:* ${pts} pts\n` +
      `🎖️ *Rank:* ${titulo}\n\n` +
      `📊 *Progresso:* [${barra}] ${pct}%\n\n` +
      `💬 _${comentario}_`,
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