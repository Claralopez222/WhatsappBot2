/**
 * Sistema de Quiz — Piroquinhas Bot
 * Comandos: !quiz, !quizfut, !quizctec, !quizgeo, !quizmat, !quizhis, !quizbsq
 *           !pontos, !rankjogos
 * - 160+ questões muito difíceis
 * - Limite de 10 quiz por dia
 * - Pontos salvos na nuvem (MongoDB)
 */

const path = require('path');
const Usuario = require(path.join(__dirname, '..', '..', 'models', 'Usuario'));
const CarteiraGrupo = require(path.join(__dirname, '..', '..', 'models', 'CarteiraGrupo'));
const { prepareDailyMissionState } = require('./missoes');
const { handleBanco, handleResgatar } = require('./banco');

const quizState = new Map();
const pontosMap = new Map();
const quizDailyCount = new Map();

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function somenteGrupo(jid) {
  return jid?.endsWith('@g.us') ?? false;
}

function resolverNome(idWhatsApp, contactNames) {
  return contactNames?.[idWhatsApp] || idWhatsApp.split('@')[0];
}
const perguntasQuiz = [
  // ── FUTEBOL ───────────────────────────────────────────────────────────────
  { p: '⚽ Qual país venceu a primeira Copa do Mundo em 1930?', r: 'uruguai', d: 'Futebol' },
  { p: '⚽ Quem é o maior artilheiro da história das Copas do Mundo?', r: 'miroslav klose', d: 'Futebol' },
  { p: '⚽ Qual clube brasileiro tem mais títulos da Copa Libertadores?', r: 'flamengo', d: 'Futebol' },
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
  { p: '⚽ Em que ano Ronaldo Fenômeno ganhou sua primeira Bola de Ouro?', r: '1997', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 1982?', r: 'italia', d: 'Futebol' },
  { p: '⚽ Quantos títulos mundiais tem o Manchester United?', r: '3', d: 'Futebol' },
  { p: '⚽ Qual jogador ganhou 8 Bolas de Ouro?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Em que ano Diego Maradona ganhou a Copa do Mundo?', r: '1986', d: 'Futebol' },
  { p: '⚽ Qual time europeu venceu mais Champions League?', r: 'real madrid', d: 'Futebol' },
  { p: '⚽ Quantas vezes a Itália ganhou a Copa do Mundo?', r: '4', d: 'Futebol' },
  { p: '⚽ Qual jogador brasileiro conquistou a Bola de Ouro em 1997?', r: 'ronaldo', d: 'Futebol' },
  { p: '⚽ Em que país foi a Copa do Mundo de 1970?', r: 'mexico', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Eurocopa de 2016?', r: 'portugal', d: 'Futebol' },
  { p: '⚽ Quantas Libertadores o São Paulo venceu?', r: '3', d: 'Futebol' },
  { p: '⚽ Qual jogador foi tri-campeão do mundo?', r: 'pele', d: 'Futebol' },
  { p: '⚽ Em que ano Neymar conquistou a Copa América?', r: '2021', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 2006?', r: 'italia', d: 'Futebol' },
  { p: '⚽ Quantos títulos Europeus tem a Juventus?', r: '2', d: 'Futebol' },
  { p: '⚽ Em que ano o Barcelona venceu a Champions League 6 vezes?', r: '2015', d: 'Futebol' },
  { p: '⚽ Qual país sediou a Copa de 2018?', r: 'russia', d: 'Futebol' },
  { p: '⚽ Quantas Copas do Mundo a Alemanha venceu?', r: '4', d: 'Futebol' },
  { p: '⚽ Qual jogador é o maior artilheiro da Champions League?', r: 'cristiano ronaldo', d: 'Futebol' },
  { p: '⚽ Em que ano Messi conquistou a Copa do Mundo?', r: '2022', d: 'Futebol' },
  { p: '⚽ Qual seleção venceu a Copa do Mundo de 1998?', r: 'franca', d: 'Futebol' },
  { p: '⚽ Quantos títulos tem o Palmeiras na Libertadores?', r: '3', d: 'Futebol' },
  { p: '⚽ Qual clube ganhou a Libertadores em 2022?', r: 'flamengo', d: 'Futebol' },
  { p: '⚽ Quem venceu a Copa America de 2024?', r: 'argentina', d: 'Futebol' },
  { p: '⚽ Em que ano o Brasil ganhou sua última Copa do Mundo?', r: '2002', d: 'Futebol' },
  { p: '⚽ Qual seleção é a maior campeã da Eurocopa?', r: 'alemanha', d: 'Futebol' },
  { p: '⚽ Quantas Libertadores tem o Cruzeiro?', r: '2', d: 'Futebol' },

  // ── HISTÓRIA ──────────────────────────────────────────────────────────────
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
  { p: '🔱 Qual líder criou o Império Otomano?', r: 'osma i', d: 'História' },
  { p: '💀 Em que ano ocorreu a Peste Negra na Europa?', r: '1348', d: 'História' },
  { p: '🏛️ Em que ano Roma foi fundada?', r: '753', d: 'História' },
  { p: '⚔️ Qual era a estratégia de Aníbal na Batalha de Cannas?', r: 'envolvimento duplo', d: 'História' },
  { p: '🌙 Em que ano começou o Califado Omíada?', r: '661', d: 'História' },
  { p: '🎪 Qual civilização construiu Machu Picchu?', r: 'inca', d: 'História' },

  // ── GEOGRAFIA ─────────────────────────────────────────────────────────────
  { p: '🏔️ Qual é a capital do Nepal?', r: 'katmandu', d: 'Geografia' },
  { p: '🌊 Qual é o segundo maior oceano do mundo?', r: 'atlantico', d: 'Geografia' },
  { p: '🏖️ Qual é a capital de Timor Leste?', r: 'dili', d: 'Geografia' },
  { p: '📍 Qual país tem a maior área de floresta tropical?', r: 'brasil', d: 'Geografia' },
  { p: '🗻 Qual é o vulcão mais alto do mundo?', r: 'ojos del salado', d: 'Geografia' },
  { p: '🌏 Qual é a capital de Brunei?', r: 'bandar seri begawan', d: 'Geografia' },
  { p: '🌐 Qual é o rio mais longo da Europa?', r: 'volga', d: 'Geografia' },
  { p: '⛰️ Qual é o deserto mais quente do mundo?', r: 'sahara', d: 'Geografia' },
  { p: '🏝️ Qual é o país com mais ilhas do mundo?', r: 'suecia', d: 'Geografia' },
  { p: '🌎 Qual é o país com maior população?', r: 'india', d: 'Geografia' },
  { p: '🌊 Qual é o lago de água doce mais profundo do mundo?', r: 'baikal', d: 'Geografia' },
  { p: '🏙️ Qual é a capital mais alta do mundo?', r: 'la paz', d: 'Geografia' },
  { p: '🏜️ Qual é o maior deserto frio do mundo?', r: 'gobi', d: 'Geografia' },
  { p: '🏔️ Qual é o estado com maior altitude do Brasil?', r: 'minas gerais', d: 'Geografia' },
  { p: '🗺️ Qual é o país menos populoso do mundo?', r: 'vaticano', d: 'Geografia' },
  { p: '🏛️ Qual é a capital mais antiga do mundo ainda habitada?', r: 'damasco', d: 'Geografia' },
  { p: '🏝️ Qual é a maior ilha do Caribe?', r: 'cuba', d: 'Geografia' },
  { p: '👑 Qual é o país com mais vulcões ativos?', r: 'indonesia', d: 'Geografia' },
  { p: '🌲 Qual país tem a maior floresta boreal?', r: 'russia', d: 'Geografia' },
  { p: '🗿 Em qual país fica o Stonehenge?', r: 'inglaterra', d: 'Geografia' },
  { p: '🌴 Qual é o país mais seco do mundo?', r: 'ataca', d: 'Geografia' },
  { p: '🌊 Qual estreito separa a Europa da Ásia?', r: 'bosfor', d: 'Geografia' },
  { p: '🏝️ Qual é a maior ilha do Pacífico (excluindo continentes)?', r: 'nova guine', d: 'Geografia' },
  { p: '🏙️ Qual é a cidade mais populosa da América do Sul?', r: 'sao paulo', d: 'Geografia' },
  { p: '⛰️ Qual é a cordilheira mais longa do mundo?', r: 'andes', d: 'Geografia' },

  // ── CIÊNCIA & TECNOLOGIA ──────────────────────────────────────────────────
  { p: '⚛️ Qual é o número atômico do ferro?', r: '26', d: 'Ciência' },
  { p: '🔬 Qual é a partícula elementar mais leve?', r: 'eletron', d: 'Ciência' },
  { p: '🧪 Qual é o pH de uma solução neutra?', r: '7', d: 'Química' },
  { p: '💨 Qual é a velocidade do som no ar em m/s?', r: '343', d: 'Física' },
  { p: '🧬 Quantas bases nitrogenadas existem no DNA?', r: '4', d: 'Biologia' },
  { p: '🔭 Qual é a maior lua de Júpiter?', r: 'ganimedes', d: 'Astronomia' },
  { p: '⭐ Qual é a estrela mais brilhante do céu noturno?', r: 'sirius', d: 'Astronomia' },
  { p: '📡 Em que ano foi criada a World Wide Web?', r: '1989', d: 'Tecnologia' },
  { p: '💻 Qual foi o primeiro computador comercial de sucesso?', r: 'apple ii', d: 'Tecnologia' },
  { p: '🧲 Qual é a força fundamental mais fraca?', r: 'gravidade', d: 'Física' },
  { p: '🌌 Qual é a velocidade da luz em m/s?', r: '299792458', d: 'Física' },
  { p: '⚛️ Qual é o elemento mais abundante na crosta terrestre?', r: 'oxigenio', d: 'Química' },
  { p: '🔬 Quantos cromossomos tem um chimpanzé?', r: '48', d: 'Biologia' },
  { p: '📊 Em qual ano foi publicado o primeiro artigo de Alan Turing?', r: '1936', d: 'Tecnologia' },
  { p: '🌊 Qual é a profundidade máxima do oceano?', r: '11000', d: 'Geografia' },
  { p: '🔭 Qual é a distância do Sol até a Terra em km?', r: '149600000', d: 'Astronomia' },
  { p: '🌙 Qual é a idade da Lua aproximadamente?', r: '4500000000', d: 'Astronomia' },

  // ── MATEMÁTICA ────────────────────────────────────────────────────────────
  { p: '🔢 Qual é o resultado de 15² - 8²?', r: '161', d: 'Matemática' },
  { p: '📐 Quantos radianos equivalem a 180 graus?', r: 'pi', d: 'Matemática' },
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

  // ── BASQUETE ──────────────────────────────────────────────────────────────
  // Lendas & Histórico
  { p: '🏀 Quantos títulos da NBA Michael Jordan conquistou?', r: '6', d: 'Basquete' },
  { p: '🏀 Em qual equipe Michael Jordan passou a maior parte da carreira?', r: 'chicago bulls', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Earvin Johnson, lenda do Los Angeles Lakers?', r: 'magic johnson', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA Kareem Abdul-Jabbar conquistou?', r: '6', d: 'Basquete' },
  { p: '🏀 Quem detém o recorde de maior pontuação em um único jogo da NBA?', r: 'wilt chamberlain', d: 'Basquete' },
  { p: '🏀 Quantos pontos Wilt Chamberlain marcou em seu jogo histórico de 1962?', r: '100', d: 'Basquete' },
  { p: '🏀 Qual jogador é conhecido como "The Logo" da NBA?', r: 'jerry west', d: 'Basquete' },
  { p: '🏀 Qual lenda do Boston Celtics ganhou 11 títulos da NBA como jogador?', r: 'bill russell', d: 'Basquete' },
  { p: '🏀 Quem foi o primeiro jogador selecionado no Draft diretamente do colégio?', r: 'darryl dawkins', d: 'Basquete' },
  { p: '🏀 Em que ano foi fundada a NBA?', r: '1946', d: 'Basquete' },
  { p: '🏀 Qual é o nome do troféu entregue ao campeão da NBA?', r: 'larry obrien', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA o Kobe Bryant conquistou?', r: '5', d: 'Basquete' },
  { p: '🏀 Em qual time Kobe Bryant jogou toda a sua carreira na NBA?', r: 'los angeles lakers', d: 'Basquete' },
  { p: '🏀 Quem inventou o basquete?', r: 'james naismith', d: 'Basquete' },
  { p: '🏀 Em que ano o basquete foi inventado?', r: '1891', d: 'Basquete' },
  // Recordes & Estatísticas
  { p: '🏀 Quem é o maior pontuador da história da NBA?', r: 'lebron james', d: 'Basquete' },
  { p: '🏀 Qual jogador detém o recorde de maior número de assistências na NBA?', r: 'john stockton', d: 'Basquete' },
  { p: '🏀 Qual jogador detém o recorde de mais rebotes na história da NBA?', r: 'wilt chamberlain', d: 'Basquete' },
  { p: '🏀 Qual jogador tem a maior média de pontos por jogo em uma temporada da NBA?', r: 'wilt chamberlain', d: 'Basquete' },
  { p: '🏀 Quantos títulos de MVP das Finais Stephen Curry conquistou?', r: '1', d: 'Basquete' },
  { p: '🏀 Qual jogador tem o recorde de mais triplos-duplos na história da NBA?', r: 'russell westbrook', d: 'Basquete' },
  { p: '🏀 Qual jogador tem a maior média de bloqueios por jogo na história da NBA?', r: 'mark eaton', d: 'Basquete' },
  { p: '🏀 Quantas temporadas Kevin Durant foi campeão da NBA?', r: '2', d: 'Basquete' },
  { p: '🏀 Em que temporada Steph Curry quebrou o próprio recorde de bolas de três?', r: '2015', d: 'Basquete' },
  { p: '🏀 Quantos pontos por jogo Michael Jordan média na temporada 1986-87?', r: '37.1', d: 'Basquete' },
  // Times & Franquias
  { p: '🏀 Qual franquia da NBA tem mais títulos?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Quantos títulos da NBA o Boston Celtics tem?', r: '18', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2023?', r: 'denver nuggets', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2024?', r: 'boston celtics', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2021?', r: 'milwaukee bucks', d: 'Basquete' },
  { p: '🏀 Qual time foi campeão da NBA em 2022?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Quantos títulos o Golden State Warriors tem ao total?', r: '7', d: 'Basquete' },
  { p: '🏀 Qual foi o recorde de vitórias em uma temporada regular (73-9)?', r: 'golden state warriors', d: 'Basquete' },
  { p: '🏀 Em que cidade jogam os Knicks da NBA?', r: 'nova york', d: 'Basquete' },
  { p: '🏀 Em que estado americano fica o time Phoenix Suns?', r: 'arizona', d: 'Basquete' },
  { p: '🏀 Qual time da NBA joga no Crypto.com Arena?', r: 'los angeles lakers', d: 'Basquete' },
  { p: '🏀 Qual time mudou de Seattle para Oklahoma City?', r: 'oklahoma city thunder', d: 'Basquete' },
  // Jogadores Atuais
  { p: '🏀 Quantas vezes LeBron James foi MVP da NBA?', r: '4', d: 'Basquete' },
  { p: '🏀 Quantas vezes Stephen Curry foi MVP da NBA?', r: '2', d: 'Basquete' },
  { p: '🏀 Qual jogador ganhou o MVP da NBA em 2023?', r: 'joel embiid', d: 'Basquete' },
  { p: '🏀 Em qual time Nikola Jokic joga?', r: 'denver nuggets', d: 'Basquete' },
  { p: '🏀 Quantos MVPs da NBA Nikola Jokic conquistou?', r: '3', d: 'Basquete' },
  { p: '🏀 Qual jogador brasileiro foi Draft na primeira rodada e jogou no Spurs?', r: 'leandro barbosa', d: 'Basquete' },
  { p: '🏀 Em qual time Giannis Antetokounmpo joga?', r: 'milwaukee bucks', d: 'Basquete' },
  { p: '🏀 Qual é o apelido de Giannis Antetokounmpo?', r: 'greek freak', d: 'Basquete' },
  { p: '🏀 Quantos MVPs Giannis Antetokounmpo ganhou?', r: '2', d: 'Basquete' },
  { p: '🏀 Em qual posição joga Luka Doncic?', r: 'armador', d: 'Basquete' },
  { p: '🏀 De qual país Luka Doncic é natural?', r: 'eslovenia', d: 'Basquete' },
  { p: '🏀 Qual brasileiro joga no basquete americano e foi campeão da NBA?', r: 'anderson varejao', d: 'Basquete' },
  // Olimpíadas & Seleções
  { p: '🏀 Qual foi o primeiro Dream Team olímpico dos EUA (ano)?', r: '1992', d: 'Basquete' },
  { p: '🏀 Em que cidade foram os Jogos Olímpicos onde o Dream Team de 1992 competiu?', r: 'barcelona', d: 'Basquete' },
  { p: '🏀 Qual seleção derrotou os EUA no basquete olímpico de Atenas 2004?', r: 'argentina', d: 'Basquete' },
  { p: '🏀 Qual país é o maior campeão mundial de basquete masculino (FIBA)?', r: 'estados unidos', d: 'Basquete' },
  { p: '🏀 Em que ano o Brasil ganhou a medalha de prata no basquete olímpico masculino?', r: '1964', d: 'Basquete' },
  { p: '🏀 Qual seleção venceu o Mundial FIBA de 2023?', r: 'alemanha', d: 'Basquete' },
  // Regras & Curiosidades
  { p: '🏀 Quantos jogadores de cada time ficam em quadra no basquete?', r: '5', d: 'Basquete' },
  { p: '🏀 Quantos minutos dura um quarto na NBA?', r: '12', d: 'Basquete' },
  { p: '🏀 Quantos segundos um time tem para arremessar (shot clock) na NBA?', r: '24', d: 'Basquete' },
  { p: '🏀 Quantos pontos vale uma cesta de três pontos no basquete?', r: '3', d: 'Basquete' },
  { p: '🏀 Qual é a altura oficial do aro de basquete em metros?', r: '3.05', d: 'Basquete' },
  { p: '🏀 Quantas faltas um jogador pode cometer antes de ser expulso na NBA?', r: '6', d: 'Basquete' },
  { p: '🏀 Qual é o nome do movimento em que o jogador dribla entre as pernas?', r: 'crossover', d: 'Basquete' },
  { p: '🏀 Quantos times participam do playoff da NBA?', r: '16', d: 'Basquete' },
  { p: '🏀 Qual é o nome da liga de desenvolvimento da NBA?', r: 'g league', d: 'Basquete' },
  { p: '🏀 Quantos segundos para passar a bola para a quadra do adversário na NBA?', r: '8', d: 'Basquete' },
  { p: '🏀 Qual é o nome do drible icônico de Allen Iverson?', r: 'crossover', d: 'Basquete' },
  { p: '🏀 Qual arena sedia os jogos do Boston Celtics?', r: 'td garden', d: 'Basquete' },
  { p: '🏀 Qual foi a pontuação máxima de Kobe Bryant em um único jogo?', r: '81', d: 'Basquete' },
  { p: '🏀 Quantos All-Stars Michael Jordan foi selecionado?', r: '14', d: 'Basquete' },
  { p: '🏀 Qual jogador foi campeão da NBA tanto pelo Bulls quanto pelo Lakers?', r: 'dennis rodman', d: 'Basquete' },
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
      { upsert: true, new: true }
    );
    console.log(`✅ Pontos salvos: ${userId} → ${pontos} pts`);
  } catch (e) {
    console.error('⚠️ Erro ao salvar pontos quiz no MongoDB:', e.message);
  }
}

async function changeGold(userId, amount) {
  try {
    if (amount > 0) {
      await prepareDailyMissionState(userId);
    }
    const update = { $inc: { gold: amount } };
    if (amount > 0) {
      update['$inc']['dailyMissions.progress.gold500'] = amount;
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

// ─── HANDLE QUIZ ─────────────────────────────────────────────────────────────

async function handleQuiz(sock, msg, jid, author, senderJid, caption = '') {
  await syncQuizPointsFromDB(senderJid);

  // ── Verificar se está respondendo uma pergunta ativa
  if (quizState.has(senderJid)) {
    const state = quizState.get(senderJid);
    const resposta = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
      .trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const correta = state.r.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
    // ── NOVO: filtro de basquete
    perguntasFiltradas = perguntasQuiz.filter(q => q.d === 'Basquete');
  }

  if (perguntasFiltradas.length === 0) {
    await sock.sendMessage(jid, { text: '⚠️ Nenhuma pergunta disponível para essa categoria no momento.' }, { quoted: msg });
    return;
  }

  quizDailyCount.set(todayKey, quizCount + 1);

  // ── Sortear pergunta sem repetir recentemente
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

module.exports = { handleQuiz };
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

// ─── !rankjogos ─────────────────────────────────────────────────────────────
async function handleRankJogos(sock, msg, jid, contactNames = {}) {
  if (!somenteGrupo(jid)) {
    await sock.sendMessage(jid, {
      text: '⚠️ Este comando só pode ser usado em grupos.',
    }, { quoted: msg });
    return;
  }
 
  try {
    // Busca membros deste grupo
    const membros = await CarteiraGrupo.find({ idGrupo: jid }).lean();
    if (!membros.length) {
      await sock.sendMessage(jid, {
        text: '📭 Nenhum membro registrado neste grupo! Joga *!quiz* primeiro!',
      }, { quoted: msg });
      return;
    }
 
    const idsMembros = membros.map(m => m.idWhatsApp);
 
    // Busca pontos de quiz apenas dos membros deste grupo
    const usuarios = await Usuario.find({
      idWhatsApp:  { $in: idsMembros },
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
 module.exports = {
  handleQuiz,
  handlePontos,
  handleRankJogos,  // ← precisa estar aqui
  handleBanco,
  handleResgatar,
  changeGold,
  quizState,
  perguntasQuiz,
};