'use strict';

// ── Classes ──────────────────────────────────────────────────────────────────
const CLASSES = [
  {
    nome: 'Guerreiro',
    emoji: '⚔️',
    descricao: 'Mestre do combate corpo a corpo',
    ataque: 14, defesa: 10, hp: 130, mana: 50,
    armasPermitidas: ['Espada', 'Machado', 'Lança', 'Lança Simples', 'Espada Longa', 'Martelo Sagrado', 'Machado de Guerra', 'Espada Rúnica', 'Machado Sombrio', 'Espada dos Titãs', 'Espada Celestial', 'Lâmina do Vazio'],
  },
  {
    nome: 'Mago',
    emoji: '🧙',
    descricao: 'Conjurador de feitiços poderosos',
    ataque: 18, defesa: 4, hp: 80, mana: 120,
    armasPermitidas: ['Cajado', 'Cajado de Madeira', 'Cetro Enferrujado', 'Cajado de Cristal', 'Cajado das Eras', 'Cetro do Apocalipse'],
  },
  {
    nome: 'Arqueiro',
    emoji: '🏹',
    descricao: 'Preciso e veloz à distância',
    ataque: 13, defesa: 7, hp: 100, mana: 70,
    armasPermitidas: ['Arco', 'Arco Simples', 'Adaga', 'Faca de Caça', 'Arco Élfico', 'Arco da Tempestade', 'Arco do Julgamento'],
  },
  {
    nome: 'Paladino',
    emoji: '🛡️',
    descricao: 'Guerreiro sagrado com poderes divinos',
    ataque: 12, defesa: 14, hp: 120, mana: 80,
    armasPermitidas: ['Espada', 'Lança', 'Lança Simples', 'Bordão Sagrado', 'Martelo Sagrado', 'Espada do Amanhecer', 'Lança Sagrada', 'Espada dos Titãs', 'Espada Celestial'],
  },
  {
    nome: 'Assassino',
    emoji: '🗡️',
    descricao: 'Letal nas sombras, rápido como a morte',
    ataque: 17, defesa: 5, hp: 90, mana: 75,
    armasPermitidas: ['Adaga', 'Faca de Caça', 'Adaga Envenenada', 'Faca Gêmea', 'Adaga da Sombra', 'Adaga do Caos', 'Punhal Eterno'],
  },
  {
    nome: 'Druida',
    emoji: '🌿',
    descricao: 'Em harmonia com a natureza e seus mistérios',
    ataque: 11, defesa: 8, hp: 100, mana: 110,
    armasPermitidas: ['Cajado', 'Cajado de Madeira', 'Arco', 'Arco Simples', 'Ramo Druídico', 'Cajado da Floresta', 'Arco Élfico', 'Arco da Tempestade', 'Cetro da Natureza', 'Cajado Ancestral', 'Arco do Julgamento'],
  },
  {
    nome: 'Necromante',
    emoji: '💀',
    descricao: 'Domina a magia negra e os mortos',
    ataque: 20, defesa: 3, hp: 75, mana: 130,
    armasPermitidas: ['Cajado', 'Cajado de Madeira', 'Cetro Enferrujado', 'Grimório Sombrio', 'Cajado dos Mortos', 'Grimório das Trevas', 'Cetro do Apocalipse'],
  },
];

// ── Elementos ────────────────────────────────────────────────────────────────
const ELEMENTOS = [
  {
    nome: 'Fogo',
    emoji: '🔥',
    habilidadeUltima: 'Meteoro Infernal',
    descHabilidade: 'Chove pedras de fogo incandescentes sobre o inimigo, carbonizando tudo ao redor',
    danoBonusContra: ['Terra', 'Ar'],
    fraquezaContra:  ['Água'],
    corNarrativa: 'chamas ardentes',
  },
  {
    nome: 'Água',
    emoji: '💧',
    habilidadeUltima: 'Tsunami Eterno',
    descHabilidade: 'Uma onda colossal engole o inimigo arrastando-o para as profundezas',
    danoBonusContra: ['Fogo', 'Terra'],
    fraquezaContra:  ['Trovão'],
    corNarrativa: 'correntes geladas',
  },
  {
    nome: 'Terra',
    emoji: '🌍',
    habilidadeUltima: 'Terremoto Ancestral',
    descHabilidade: 'O chão racha em fissuras imensas engolindo o adversário nas entranhas da terra',
    danoBonusContra: ['Trovão', 'Sombra'],
    fraquezaContra:  ['Fogo', 'Água'],
    corNarrativa: 'pilares de pedra',
  },
  {
    nome: 'Ar',
    emoji: '🌪️',
    habilidadeUltima: 'Tornado Caótico',
    descHabilidade: 'Um tornado devastador lança o inimigo aos céus antes de despedaçá-lo no chão',
    danoBonusContra: ['Sombra', 'Luz'],
    fraquezaContra:  ['Terra'],
    corNarrativa: 'vendavais cortantes',
  },
  {
    nome: 'Trovão',
    emoji: '⚡',
    habilidadeUltima: 'Relâmpago Divino',
    descHabilidade: 'Um raio desce dos céus com força divina paralisando o inimigo em convulsões',
    danoBonusContra: ['Água', 'Ar'],
    fraquezaContra:  ['Terra'],
    corNarrativa: 'raios furiosos',
  },
  {
    nome: 'Sombra',
    emoji: '🌑',
    habilidadeUltima: 'Vazio Absoluto',
    descHabilidade: 'A escuridão total consome o inimigo drenando sua alma e deixando apenas o vazio',
    danoBonusContra: ['Luz', 'Fogo'],
    fraquezaContra:  ['Luz', 'Ar'],
    corNarrativa: 'trevas absolutas',
  },
  {
    nome: 'Luz',
    emoji: '✨',
    habilidadeUltima: 'Julgamento Celestial',
    descHabilidade: 'Um feixe de luz divina desce dos céus consumindo o alvo em pura energia sagrada',
    danoBonusContra: ['Sombra', 'Magia Negra'],
    fraquezaContra:  ['Sombra', 'Ar'],
    corNarrativa: 'brilho celestial',
  },
  {
    nome: 'Magia Negra',
    emoji: '🖤',
    habilidadeUltima: 'Maldição Eterna',
    descHabilidade: 'Uma maldição ancestral corrói o corpo e a alma do inimigo de dentro para fora',
    danoBonusContra: ['Luz', 'Trovão'],
    fraquezaContra:  ['Luz'],
    corNarrativa: 'energia amaldiçoada',
  },
];

// ── Armas ────────────────────────────────────────────────────────────────────
const ARMAS = [
  // ── Nível 1 ───────────────────────────────────────────────────────────────
  { nome: 'Espada',              emoji: '⚔️',  bonusAtaque: 8,  preco: 300,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Machado',             emoji: '🪓',  bonusAtaque: 12, preco: 450,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Adaga',               emoji: '🗡️',  bonusAtaque: 6,  preco: 200,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Cajado de Madeira',   emoji: '🪵',  bonusAtaque: 4,  preco: 150,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 15 },
  { nome: 'Arco Simples',        emoji: '🏹',  bonusAtaque: 5,  preco: 180,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Lança Simples',       emoji: '🔱',  bonusAtaque: 7,  preco: 220,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Cetro Enferrujado',   emoji: '🔩',  bonusAtaque: 3,  preco: 130,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 20 },  // Mago / Necromante iniciante
  { nome: 'Faca de Caça',        emoji: '🔪',  bonusAtaque: 8,  preco: 240,  raridade: 'comum',    nivelMinimo: 1  },                  // Assassino variante
  { nome: 'Bordão Sagrado',      emoji: '✝️',   bonusAtaque: 6,  preco: 260,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 10 },  // Paladino
  { nome: 'Ramo Druídico',       emoji: '🌿',  bonusAtaque: 4,  preco: 160,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 25 },  // Druida
  // ── Nível 3 ───────────────────────────────────────────────────────────────
  { nome: 'Lança',               emoji: '🔱',  bonusAtaque: 10, preco: 350,  raridade: 'incomum',  nivelMinimo: 3  },
  { nome: 'Cajado',              emoji: '🪄',  bonusAtaque: 5,  preco: 400,  raridade: 'incomum',  nivelMinimo: 3,  bonusMana: 30 },
  { nome: 'Arco',                emoji: '🏹',  bonusAtaque: 9,  preco: 380,  raridade: 'incomum',  nivelMinimo: 3  },
  { nome: 'Adaga Envenenada',    emoji: '💚',  bonusAtaque: 10, preco: 420,  raridade: 'incomum',  nivelMinimo: 3  },                  // Assassino
  { nome: 'Cajado da Floresta',  emoji: '🌲',  bonusAtaque: 6,  preco: 430,  raridade: 'incomum',  nivelMinimo: 3,  bonusMana: 40 },  // Druida
  { nome: 'Martelo Sagrado',     emoji: '🔨',  bonusAtaque: 11, preco: 390,  raridade: 'incomum',  nivelMinimo: 3  },                  // Paladino / Guerreiro
  { nome: 'Grimório Sombrio',    emoji: '📖',  bonusAtaque: 7,  preco: 460,  raridade: 'incomum',  nivelMinimo: 3,  bonusMana: 45 },  // Necromante
  { nome: 'Espada Longa',        emoji: '🗡️',  bonusAtaque: 13, preco: 500,  raridade: 'incomum',  nivelMinimo: 3  },                  // Guerreiro
  // ── Nível 5 ───────────────────────────────────────────────────────────────
  { nome: 'Arco Élfico',         emoji: '🌟',  bonusAtaque: 14, preco: 650,  raridade: 'incomum',  nivelMinimo: 5  },                  // Arqueiro / Druida
  { nome: 'Espada do Amanhecer', emoji: '🌅',  bonusAtaque: 13, preco: 620,  raridade: 'incomum',  nivelMinimo: 5,  bonusMana: 15 },  // Paladino
  { nome: 'Cajado de Cristal',   emoji: '💎',  bonusAtaque: 9,  preco: 680,  raridade: 'incomum',  nivelMinimo: 5,  bonusMana: 55 },  // Mago
  { nome: 'Faca Gêmea',          emoji: '⚡',  bonusAtaque: 15, preco: 700,  raridade: 'incomum',  nivelMinimo: 5  },                  // Assassino
  { nome: 'Machado de Guerra',   emoji: '🪓',  bonusAtaque: 16, preco: 720,  raridade: 'incomum',  nivelMinimo: 5  },                  // Guerreiro
  // ── Nível 7 ───────────────────────────────────────────────────────────────
  { nome: 'Espada Rúnica',       emoji: '🔮',  bonusAtaque: 18, preco: 900,  raridade: 'raro',     nivelMinimo: 7  },
  { nome: 'Machado Sombrio',     emoji: '💀',  bonusAtaque: 22, preco: 1200, raridade: 'raro',     nivelMinimo: 7  },
  { nome: 'Cajado das Eras',     emoji: '✨',  bonusAtaque: 15, preco: 1100, raridade: 'raro',     nivelMinimo: 7,  bonusMana: 60 },
  { nome: 'Adaga da Sombra',     emoji: '🌑',  bonusAtaque: 20, preco: 1050, raridade: 'raro',     nivelMinimo: 7  },                  // Assassino
  { nome: 'Arco da Tempestade',  emoji: '⛈️',  bonusAtaque: 19, preco: 980,  raridade: 'raro',     nivelMinimo: 7  },                  // Arqueiro / Druida
  { nome: 'Lança Sagrada',       emoji: '⚜️',  bonusAtaque: 17, preco: 950,  raridade: 'raro',     nivelMinimo: 7,  bonusMana: 25 },  // Paladino
  { nome: 'Cajado dos Mortos',   emoji: '💀',  bonusAtaque: 16, preco: 1000, raridade: 'raro',     nivelMinimo: 7,  bonusMana: 70 },  // Necromante
  { nome: 'Cetro da Natureza',   emoji: '🌺',  bonusAtaque: 14, preco: 920,  raridade: 'raro',     nivelMinimo: 7,  bonusMana: 65 },  // Druida
  // ── Nível 10 ──────────────────────────────────────────────────────────────
  { nome: 'Espada dos Titãs',    emoji: '⚡',  bonusAtaque: 23, preco: 1500, raridade: 'raro',     nivelMinimo: 10 },                  // Guerreiro / Paladino
  { nome: 'Adaga do Caos',       emoji: '🌀',  bonusAtaque: 24, preco: 1550, raridade: 'raro',     nivelMinimo: 10 },                  // Assassino
  { nome: 'Grimório das Trevas', emoji: '🖤',  bonusAtaque: 20, preco: 1600, raridade: 'raro',     nivelMinimo: 10, bonusMana: 90 },  // Necromante
  { nome: 'Cajado Ancestral',    emoji: '🌳',  bonusAtaque: 18, preco: 1480, raridade: 'raro',     nivelMinimo: 10, bonusMana: 85 },  // Druida
  // ── Nível 12 ──────────────────────────────────────────────────────────────
  { nome: 'Lâmina do Vazio',     emoji: '🌑',  bonusAtaque: 25, preco: 1800, raridade: 'lendário', nivelMinimo: 12 },
  { nome: 'Cetro do Apocalipse', emoji: '☄️',  bonusAtaque: 22, preco: 1900, raridade: 'lendário', nivelMinimo: 12, bonusMana: 100 }, // Necromante / Mago
  { nome: 'Arco do Julgamento',  emoji: '🏹',  bonusAtaque: 24, preco: 1850, raridade: 'lendário', nivelMinimo: 12 },                  // Arqueiro / Druida
  { nome: 'Espada Celestial',    emoji: '✨',  bonusAtaque: 26, preco: 2000, raridade: 'lendário', nivelMinimo: 12, bonusMana: 30 },  // Paladino / Guerreiro
  { nome: 'Punhal Eterno',       emoji: '🗡️',  bonusAtaque: 27, preco: 2100, raridade: 'lendário', nivelMinimo: 12 },                  // Assassino
];

// ── Poções ───────────────────────────────────────────────────────────────────
const POCOES = [
  { nome: 'Poção de Cura',        emoji: '🧪', tipo: 'hp',    valor: 50,  preco: 80,  raridade: 'comum'    },
  { nome: 'Poção Grande',         emoji: '💊', tipo: 'hp',    valor: 120, preco: 180, raridade: 'incomum'  },
  { nome: 'Poção Suprema de Vida', emoji: '❤️', tipo: 'hp',   valor: 250, preco: 400, raridade: 'raro'     },
  { nome: 'Elixir de Mana',       emoji: '🔷', tipo: 'mana',  valor: 60,  preco: 100, raridade: 'comum'    },
  { nome: 'Elixir Supremo',       emoji: '💎', tipo: 'mana',  valor: 150, preco: 220, raridade: 'incomum'  },
  { nome: 'Elixir do Arcano',     emoji: '🌀', tipo: 'mana',  valor: 300, preco: 450, raridade: 'raro'     },
  { nome: 'Poção de Batalha',     emoji: '⚗️', tipo: 'ambos', valor: 80,  preco: 250, raridade: 'raro'     },
  { nome: 'Poção Lendária',       emoji: '🌟', tipo: 'ambos', valor: 200, preco: 600, raridade: 'lendário' },
];

// ── Armaduras ────────────────────────────────────────────────────────────────
const ARMADURAS = [
  // ── Nível 1 ───────────────────────────────────────────────────────────────
  { nome: 'Armadura de Couro',    emoji: '🥋', bonusDefesa: 5,  preco: 200,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Cota de Malha',        emoji: '🛡️', bonusDefesa: 10, preco: 400,  raridade: 'comum',    nivelMinimo: 1  },
  { nome: 'Manto de Aprendiz',    emoji: '👘', bonusDefesa: 3,  preco: 150,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 20 }, // Mago / Necromante
  { nome: 'Capuz de Couro',       emoji: '🪖', bonusDefesa: 4,  preco: 170,  raridade: 'comum',    nivelMinimo: 1  },                 // Assassino / Arqueiro
  { nome: 'Veste de Druida',      emoji: '🍃', bonusDefesa: 4,  preco: 180,  raridade: 'comum',    nivelMinimo: 1,  bonusMana: 15 }, // Druida
  // ── Nível 3 ───────────────────────────────────────────────────────────────
  { nome: 'Armadura de Placas',   emoji: '🦾', bonusDefesa: 16, preco: 700,  raridade: 'incomum',  nivelMinimo: 3  },
  { nome: 'Manto Sombrio',        emoji: '🌑', bonusDefesa: 8,  preco: 500,  raridade: 'incomum',  nivelMinimo: 3,  bonusMana: 20 },
  { nome: 'Gibão Reforçado',      emoji: '🧥', bonusDefesa: 11, preco: 560,  raridade: 'incomum',  nivelMinimo: 3  },                 // Guerreiro / Paladino
  { nome: 'Manto dos Ossos',      emoji: '🦴', bonusDefesa: 6,  preco: 480,  raridade: 'incomum',  nivelMinimo: 3,  bonusMana: 35 }, // Necromante
  { nome: 'Colete de Escamas',    emoji: '🐍', bonusDefesa: 9,  preco: 520,  raridade: 'incomum',  nivelMinimo: 3  },                 // Arqueiro / Assassino
  // ── Nível 5 ───────────────────────────────────────────────────────────────
  { nome: 'Armadura Sagrada',     emoji: '✝️',  bonusDefesa: 14, preco: 750,  raridade: 'incomum',  nivelMinimo: 5,  bonusMana: 10 }, // Paladino
  { nome: 'Manto Arcano',         emoji: '🔵', bonusDefesa: 7,  preco: 720,  raridade: 'incomum',  nivelMinimo: 5,  bonusMana: 45 }, // Mago
  { nome: 'Couraça da Floresta',  emoji: '🌲', bonusDefesa: 10, preco: 700,  raridade: 'incomum',  nivelMinimo: 5,  bonusMana: 30 }, // Druida
  { nome: 'Sombra Entrelaçada',   emoji: '🌙', bonusDefesa: 12, preco: 780,  raridade: 'incomum',  nivelMinimo: 5  },                 // Assassino
  // ── Nível 7 ───────────────────────────────────────────────────────────────
  { nome: 'Veste Élfica',         emoji: '🌿', bonusDefesa: 12, preco: 650,  raridade: 'raro',     nivelMinimo: 7  },
  { nome: 'Armadura Rúnica',      emoji: '🔮', bonusDefesa: 20, preco: 1000, raridade: 'raro',     nivelMinimo: 7  },
  { nome: 'Manto das Trevas',     emoji: '🖤', bonusDefesa: 15, preco: 980,  raridade: 'raro',     nivelMinimo: 7,  bonusMana: 50 }, // Necromante
  { nome: 'Armadura de Titânio',  emoji: '🤖', bonusDefesa: 22, preco: 1100, raridade: 'raro',     nivelMinimo: 7  },                 // Guerreiro
  { nome: 'Veste da Lua Cheia',   emoji: '🌕', bonusDefesa: 13, preco: 900,  raridade: 'raro',     nivelMinimo: 7,  bonusMana: 40 }, // Druida
  // ── Nível 10 ──────────────────────────────────────────────────────────────
  { nome: 'Armadura do Crepúsculo', emoji: '🌇', bonusDefesa: 18, preco: 1350, raridade: 'raro',   nivelMinimo: 10, bonusMana: 20 }, // Paladino
  { nome: 'Manto do Vazio',       emoji: '🌀', bonusDefesa: 14, preco: 1300, raridade: 'raro',     nivelMinimo: 10, bonusMana: 70 }, // Mago / Necromante
  { nome: 'Colete Fantasma',      emoji: '👻', bonusDefesa: 16, preco: 1250, raridade: 'raro',     nivelMinimo: 10 },                 // Assassino
  // ── Nível 12 ──────────────────────────────────────────────────────────────
  { nome: 'Placas do Abismo',     emoji: '💀', bonusDefesa: 25, preco: 1500, raridade: 'lendário', nivelMinimo: 12 },
  { nome: 'Manto Celestial',      emoji: '✨', bonusDefesa: 20, preco: 1700, raridade: 'lendário', nivelMinimo: 12, bonusMana: 80 }, // Mago / Druida / Paladino
  { nome: 'Armadura do Caos',     emoji: '🌪️', bonusDefesa: 23, preco: 1800, raridade: 'lendário', nivelMinimo: 12 },                // Guerreiro / Assassino
  { nome: 'Veste do Além',        emoji: '🌌', bonusDefesa: 18, preco: 1600, raridade: 'lendário', nivelMinimo: 12, bonusMana: 100 },// Necromante
];

// ── Missões ──────────────────────────────────────────────────────────────────
const MISSOES = [
  // ── Nível 1+ (fácil) ──────────────────────────────────────────────────────
  { titulo: 'A Cripta dos Mortos Vivos',    dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 50,  goldReward: 100, emoji: '💀' },
  { titulo: 'O Pântano das Almas',          dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 60,  goldReward: 150, emoji: '🌿' },
  { titulo: 'A Aldeia dos Espíritos',       dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 70,  goldReward: 180, emoji: '👻' },
  { titulo: 'O Celeiro Amaldiçoado',        dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 55,  goldReward: 120, emoji: '🌾' },
  { titulo: 'A Caverna dos Morcegos',       dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 65,  goldReward: 160, emoji: '🦇' },
  { titulo: 'O Mercado Maldito',            dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 50,  goldReward: 130, emoji: '🏚️' },
  { titulo: 'A Ponte dos Fantasmas',        dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 60,  goldReward: 140, emoji: '🌉' },
  { titulo: 'O Poço Sem Fundo',             dificuldade: 'fácil',   nivelMinimo: 1,  xpReward: 75,  goldReward: 170, emoji: '🕳️' },

  // ── Nível 2+ (fácil) ──────────────────────────────────────────────────────
  { titulo: 'As Ruínas do Velho Reino',     dificuldade: 'fácil',   nivelMinimo: 2,  xpReward: 80,  goldReward: 190, emoji: '🏛️' },
  { titulo: 'O Acampamento Goblin',         dificuldade: 'fácil',   nivelMinimo: 2,  xpReward: 85,  goldReward: 200, emoji: '👺' },
  { titulo: 'A Estalagem Fantasma',         dificuldade: 'fácil',   nivelMinimo: 2,  xpReward: 80,  goldReward: 195, emoji: '🏠' },

  // ── Nível 4+ (médio) ──────────────────────────────────────────────────────
  { titulo: 'A Floresta Amaldiçoada',       dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 100, goldReward: 250, emoji: '🌲' },
  { titulo: 'As Minas do Esquecimento',     dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 120, goldReward: 300, emoji: '⛏️' },
  { titulo: 'O Covil do Lobisomem',         dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 130, goldReward: 320, emoji: '🐺' },
  { titulo: 'A Necrópole Esquecida',        dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 110, goldReward: 270, emoji: '⚰️' },
  { titulo: 'O Labirinto de Pedra',         dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 115, goldReward: 280, emoji: '🌀' },
  { titulo: 'A Fortaleza dos Bandidos',     dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 125, goldReward: 310, emoji: '⚔️' },
  { titulo: 'O Navio Fantasma',             dificuldade: 'médio',   nivelMinimo: 4,  xpReward: 120, goldReward: 295, emoji: '🚢' },

  // ── Nível 6+ (médio) ──────────────────────────────────────────────────────
  { titulo: 'O Santuário Corrompido',       dificuldade: 'médio',   nivelMinimo: 6,  xpReward: 140, goldReward: 340, emoji: '⛩️' },
  { titulo: 'A Arena dos Condenados',       dificuldade: 'médio',   nivelMinimo: 6,  xpReward: 150, goldReward: 360, emoji: '🏟️' },
  { titulo: 'O Desfiladeiro das Sombras',   dificuldade: 'médio',   nivelMinimo: 6,  xpReward: 145, goldReward: 350, emoji: '🌑' },
  { titulo: 'A Biblioteca Proibida',        dificuldade: 'médio',   nivelMinimo: 6,  xpReward: 135, goldReward: 330, emoji: '📚' },

  // ── Nível 8+ (difícil) ────────────────────────────────────────────────────
  { titulo: 'O Dragão das Montanhas',       dificuldade: 'difícil', nivelMinimo: 8,  xpReward: 200, goldReward: 500, emoji: '🐉' },
  { titulo: 'O Castelo do Rei Sombrio',     dificuldade: 'difícil', nivelMinimo: 8,  xpReward: 180, goldReward: 450, emoji: '🏰' },
  { titulo: 'O Golem de Ferro Ancestral',   dificuldade: 'difícil', nivelMinimo: 8,  xpReward: 190, goldReward: 470, emoji: '🤖' },
  { titulo: 'A Hidra dos Pântanos Negros',  dificuldade: 'difícil', nivelMinimo: 8,  xpReward: 195, goldReward: 480, emoji: '🐍' },
  { titulo: 'O Portal Dimensional',         dificuldade: 'difícil', nivelMinimo: 8,  xpReward: 185, goldReward: 460, emoji: '🌌' },

  // ── Nível 10+ (difícil) ───────────────────────────────────────────────────
  { titulo: 'A Torre do Mago Louco',        dificuldade: 'difícil', nivelMinimo: 10, xpReward: 220, goldReward: 550, emoji: '🔮' },
  { titulo: 'O Templo da Magia Negra',      dificuldade: 'difícil', nivelMinimo: 10, xpReward: 250, goldReward: 600, emoji: '🖤' },
  { titulo: 'O Lich dos Tempos Antigos',    dificuldade: 'difícil', nivelMinimo: 10, xpReward: 240, goldReward: 580, emoji: '💀' },
  { titulo: 'A Dimensão do Caos',           dificuldade: 'difícil', nivelMinimo: 10, xpReward: 235, goldReward: 570, emoji: '🌀' },
  { titulo: 'O Trono do Deus Esquecido',    dificuldade: 'difícil', nivelMinimo: 10, xpReward: 260, goldReward: 620, emoji: '👑' },

  // ── Nível 12+ (lendário) ──────────────────────────────────────────────────
  { titulo: 'O Despertar do Titã',          dificuldade: 'lendário', nivelMinimo: 12, xpReward: 350, goldReward: 900,  emoji: '⚡' },
  { titulo: 'A Forja dos Deuses',           dificuldade: 'lendário', nivelMinimo: 12, xpReward: 380, goldReward: 950,  emoji: '🔥' },
  { titulo: 'O Fim do Mundo Conhecido',     dificuldade: 'lendário', nivelMinimo: 12, xpReward: 400, goldReward: 1000, emoji: '🌍' },
  { titulo: 'A Ascensão do Rei Morto',      dificuldade: 'lendário', nivelMinimo: 12, xpReward: 370, goldReward: 930,  emoji: '👑' },
  { titulo: 'O Coração das Trevas Eternas', dificuldade: 'lendário', nivelMinimo: 12, xpReward: 420, goldReward: 1050, emoji: '🖤' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortearAleatorio(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  return lista[Math.floor(Math.random() * lista.length)];
}

function getClasse(nome) {
  return CLASSES.find(c => c.nome === nome) ?? null;
}

function getElemento(nome) {
  return ELEMENTOS.find(e => e.nome === nome) ?? null;
}

function getArma(nome) {
  return ARMAS.find(a => a.nome === nome) ?? null;
}

function getArmadura(nome) {
  return ARMADURAS.find(a => a.nome === nome) ?? null;
}

function getPocao(nome) {
  return POCOES.find(p => p.nome.toLowerCase() === nome.toLowerCase()) ?? null;
}

/**
 * Multiplicador elemental: 1.5 (vantagem) | 0.7 (fraqueza) | 1.0 (neutro)
 */
function calcularMultElemento(elementoAtacante, elementoDefensor) {
  const el = getElemento(elementoAtacante);
  if (!el) return 1.0;
  if (el.danoBonusContra.includes(elementoDefensor)) return 1.5;
  if (el.fraquezaContra.includes(elementoDefensor))  return 0.7;
  return 1.0;
}

/**
 * XP necessário para subir de nível.
 * Nível 1→2: 100xp | 2→3: 263xp | 5→6: 954xp | 10→11: 2511xp
 */
function xpParaNivel(nivel) {
  if (nivel < 1) return 100;
  return Math.floor(100 * Math.pow(Math.max(1, nivel), 1.4));
}

/**
 * Verifica cooldown de uma ação.
 * @returns {{ pode: boolean, tempoRestante: string|null }}
 */
function verificarCooldown(dataUltimaAcao, cooldownMs) {
  if (!dataUltimaAcao) return { pode: true, tempoRestante: null };
  const diff = Date.now() - new Date(dataUltimaAcao).getTime();
  if (diff >= cooldownMs) return { pode: true, tempoRestante: null };
  const restante = cooldownMs - diff;
  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  return { pode: false, tempoRestante: min > 0 ? `${min}min ${seg}s` : `${seg}s` };
}

/**
 * Calcula o dano de um ataque ou habilidade.
 * Habilidades NÃO rolam crítico — o multiplicador 2.2x já é o pico delas.
 * Ataques normais podem rolar crítico (15% de chance, 1.8x).
 */
function calcularDano(personagem, alvo, habilidade = false) {
  const arma        = personagem.armaEquipada    ? getArma(personagem.armaEquipada)       : null;
  const armaduraAlvo = alvo.armaduraEquipada     ? getArmadura(alvo.armaduraEquipada)     : null;

  const baseAtaque = personagem.ataque + (arma?.bonusAtaque     || 0);
  const baseDefesa = alvo.defesa       + (armaduraAlvo?.bonusDefesa || 0);

  const multElemento   = calcularMultElemento(personagem.elemento, alvo.elemento);
  // Habilidades não críticam — evita dano absurdo (2.2 × 1.8 = 3.96x)
  const critico        = !habilidade && Math.random() < 0.15;
  const multCrit       = critico    ? 1.8 : 1.0;
  const multHabilidade = habilidade ? 2.2 : 1.0;
  const variacao       = 0.85 + Math.random() * 0.3; // 85%–115%

  const dano = Math.max(1, Math.floor(
    (baseAtaque * multElemento * multCrit * multHabilidade * variacao) - (baseDefesa * 0.4)
  ));

  return { dano, critico, multElemento };
}

/**
 * Gera narração de combate.
 * Usa frases neutras para evitar problemas de concordância de gênero.
 */
function narrarCombate(atacante, defensor, dano, critico, habilidade = null) {
  const elAtacante = getElemento(atacante.elemento);
  const cor        = elAtacante?.corNarrativa || 'energia mística';

  let pool;

  if (habilidade) {
    pool = [
      `⚡ *${atacante.nome}* invoca *${habilidade}* e libera ${cor} sobre *${defensor.nome}*, causando *${dano}* de dano!`,
      `💥 Os céus tremem enquanto *${atacante.nome}* desencadeia *${habilidade}* sobre *${defensor.nome}* — *${dano}* de dano!`,
      `🌀 *${habilidade}* ressoa pelo campo de batalha! *${defensor.nome}* sofre *${dano}* de dano colossal!`,
    ];
  } else if (critico) {
    pool = [
      `💥 *GOLPE CRÍTICO!* *${atacante.nome}* desfere um ataque devastador com ${cor}, causando *${dano}* de dano em *${defensor.nome}*!`,
      `⚡ Incrível! *${atacante.nome}* encontrou a brecha perfeita e causou *${dano}* de dano em *${defensor.nome}*!`,
      `🔥 *${atacante.nome}* canalizou ${cor} num golpe certeiro — *${dano}* de dano crítico em *${defensor.nome}*!`,
    ];
  } else {
    pool = [
      `⚔️ *${atacante.nome}* ataca *${defensor.nome}* com ${cor}, causando *${dano}* de dano!`,
      `🗡️ *${atacante.nome}* avança com ${cor} e atinge *${defensor.nome}* por *${dano}* de dano!`,
      `🔥 *${atacante.nome}* lança ${cor} em direção a *${defensor.nome}*, causando *${dano}* de dano!`,
      `💫 Com precisão, *${atacante.nome}* usa ${cor} contra *${defensor.nome}* — *${dano}* de dano!`,
    ];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  CLASSES,
  ELEMENTOS,
  ARMAS,
  ARMADURAS,
  POCOES,
  MISSOES,
  sortearAleatorio,
  getClasse,
  getElemento,
  getArma,
  getArmadura,
  getPocao,
  calcularMultElemento,
  calcularDano,
  narrarCombate,
  xpParaNivel,
  verificarCooldown,
};