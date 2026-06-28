'use strict';

// ─── Utilitário interno ───────────────────────────────────────────────────────

async function enviar(sock, msg, jid, texto) {
  await sock.sendMessage(jid, { text: texto }, { quoted: msg });
}

// ─── !menu ────────────────────────────────────────────────────────────────────

async function handleMenu(sock, msg, jid, caption, getPrefix, author) {
  const P = getPrefix(jid);

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [data, hora] = agora.split(', ');
  const [hour] = hora.split(':').map(Number);
  const timeStr = hora.slice(0, 5);

  let greeting = 'Olá';
  if (hour >= 5  && hour < 12) greeting = '🌅 Bom dia';
  else if (hour >= 12 && hour < 18) greeting = '☀️ Boa tarde';
  else                               greeting = '🌙 Boa noite';

  const userMention = author ? `*${author}*` : '';

  const menu =
`╔══════════════════════╗
       🔥 PIROQUINHAS 🔥
╚══════════════════════╝

${greeting}, ${userMention}! São ${timeStr} ⏰

━━━━━━━━━━━━━━━━━━━━━━━━
🎨 *FIGURINHAS & EFEITOS*
  ▸ ${P}menufig
  ▸ ${P}menuefeitos

🛡️ *ADMINISTRAÇÃO*
  ▸ ${P}menuadm
  ▸ ${P}reportar _(marque a mensagem)_

🎮 *DIVERSÃO & JOGOS*
  ▸ ${P}menujogos
  ▸ ${P}brincadeiras
  ▸ ${P}alteradores
  ▸ ${P}menuroubar
  ▸ ${P}menusec
  ▸ ${P}menupet

💑 *RELACIONAMENTOS*
  ▸ ${P}menucasal
  ▸ ${P}menuaniversario
  ▸ ${P}menufilho

💼 *EMPREGOS*
  ▸ ${P}menuwork

🔧 *UTILIDADES*
  ▸ ${P}menuutil
━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menuutil ────────────────────────────────────────────────────────────────

async function handleMenuUtil(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
     🔧 MENU UTILIDADES
╚══════════════════════╝

📍 *CONSULTAS*
  ▸ ${P}cep _(número)_
  ▸ ${P}clima _(cidade)_
  ▸ ${P}calcular _(expressão)_

🌐 *TEXTO & IDIOMAS*
  ▸ ${P}traduzir _(idioma) (texto)_
  ▸ ${P}maiusculo _(texto)_
  ▸ ${P}invertido _(texto)_
  ▸ ${P}caixa _(texto)_

📡 *CÓDIGO MORSE*
  ▸ ${P}morse _(texto)_
  ▸ ${P}demorse _(código)_

🔗 *OUTROS*
  ▸ ${P}encurtar _(link)_
  ▸ ${P}qrcode _(texto)_
  ▸ ${P}dado _(lados)_
  ▸ ${P}moeda _(câmbio ou cara/coroa)_
  ▸ ${P}piada
  ▸ ${P}fato

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menujogos ───────────────────────────────────────────────────────────────

async function handleMenuJogos(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
   🎮 MENU JOGOS & DIVERSÃO
╚══════════════════════╝

💰 *ECONOMIA*
  ▸ ${P}menugold
  ▸ ${P}missao
  ▸ ${P}garimpar
  ▸ ${P}extrato

🧩 *MINI-JOGOS*
  ▸ ${P}quiz _(tema)_
  ▸ ${P}anagrama
  ▸ ${P}ppt _(pedra/papel/tesoura)_
  ▸ ${P}eununca
  ▸ ${P}brincadeiras

🎰 *APOSTAS & SORTE*
  ▸ ${P}apostar _(quantia)_
  ▸ ${P}slots
  ▸ ${P}corrida
  ▸ ${P}roletarussa
  ▸ ${P}roletarussa2
  ▸ ${P}roletarussa3

🎯 *OUTROS*
  ▸ ${P}tiro
  ▸ ${P}morte
  ▸ ${P}falta
  ▸ ${P}baterfalta
  ▸ ${P}pontos
  ▸ ${P}rankjogos
  ▸ ${P}ranklevel
  ▸ ${P}level

⚽ *COPA DO MUNDO*
  ▸ ${P}worldcup — Tabela da Copa 2026 🏆

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !alteradores ─────────────────────────────────────────────────────────────

async function handleAlteradores(sock, msg, jid) {
  const menu =
`╔══════════════════════╗
     🎛️ MENU ALTERADORES
╚══════════════════════╝

_Responda uma mídia com o comando desejado_

🎬 *VÍDEO*
  ▸ .videolento
  ▸ .videorapido
  ▸ .videocontrario
  ▸ .reversevideo

🎵 *ÁUDIO*
  ▸ .audiolento
  ▸ .audiorapido
  ▸ .audioreverse
  ▸ .grave
  ▸ .esquilo
  ▸ .bass

🎭 *VOZ*
  ▸ .vozmenino
  ▸ .vozgrossa
  ▸ .vozmulher
  ▸ .vozrobo
  ▸ .vozalien
  ▸ .vozvelho
  ▸ .vozcrianca
  ▸ .vozdemonio

🔊 *AMBIENTE*
  ▸ .eco
  ▸ .caverna
  ▸ .telefone
  ▸ .radio
  ▸ .megafone
  ▸ .underwater

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menucasal ───────────────────────────────────────────────────────────────

async function handleMenuRelacionamento(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      ❤️ MENU DO CASAL
╚══════════════════════╝

💍 *RELACIONAMENTO*
  ▸ ${P}casar @pessoa — Pedir em casamento
  ▸ ${P}euaceito — Aceitar pedido
  ▸ ${P}eurecuso — Recusar pedido
  ▸ ${P}cancelarpedido — Cancelar pedido enviado
  ▸ ${P}terminar — Terminar relacionamento _(bloqueia 10 min)_

💐 *DIÁRIOS (+5 XP cada, 1x/dia)*
  ▸ ${P}flores 🌹
  ▸ ${P}doces 🍬
  ▸ ${P}carta 💌
  ▸ ${P}mimo 🎁
  ▸ ${P}beijo 😘

💝 *ROMÂNTICOS*
  ▸ ${P}abraco — Dar um abraço
  ▸ ${P}presente — Dar um presente
  ▸ ${P}jantar — Jantar a dois
  ▸ ${P}cinematel — Sessão de cinema
  ▸ ${P}viajar — Viajar juntos
  ▸ ${P}serenata — Fazer uma serenata
  ▸ ${P}declarar — Declaração de amor
  ▸ ${P}ciumento — Demonstrar ciúme

🏆 *ESPECIAIS*
  ▸ ${P}statu — Status do casal
  ▸ ${P}meupar — Infos do seu par
  ▸ ${P}xpdobro — XP duplo por 1h
  ▸ ${P}aniversario_casal — Ver aniversário
  ▸ ${P}duelodecasais — Duelo entre casais
  ▸ ${P}rankcasais — Ranking de casais

🛒 *LOJA*
  ▸ ${P}lojacasal — Ver itens disponíveis

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menufilho ───────────────────────────────────────────────────────────────

async function handleMenuFilho(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      👶 MENU FILHOS
╚══════════════════════╝

👨‍👩‍👧 *FAMÍLIA*
  ▸ ${P}tentarfilho — Tentar ter um filho _(40% chance)_
  ▸ ${P}filho — Ver seus filhos e status
  ▸ ${P}cuidarfilho — Cuidar dos filhos _(cooldown 20h)_

💊 *SAÚDE*
  ▸ ${P}remediofil — Curar filho doente _(300 gold)_

━━━━━━━━━━━━━━━━━━━━━━━━
📋 *REGRAS*
  • Limite de *3 filhos* por casal
  • A cada *7 dias* o filho completa *1 ano*
  • Atributos caem com o tempo — cuide diariamente!
  • Felicidade zerada → filho fica *doente*
  • Em caso de separação → *guarda compartilhada*
    _(o filho troca de responsável a cada dia)_

━━━━━━━━━━━━━━━━━━━━━━━━
📊 *ATRIBUTOS*
  😊 Felicidade • 🍽️ Fome
  😴 Sono • 🎈 Alegria

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menubaixar ──────────────────────────────────────────────────────────────

async function handleMenuBaixar(sock, msg, jid, getPrefix) {
  const P = getPrefix ? getPrefix(jid) : '!';
  const menu =
`╔══════════════════════╗
      📥 MENU DOWNLOADS
╚══════════════════════╝

🎵 *MÚSICA & ÁUDIO*
  ▸ ${P}som _(nome da música)_
  ▸ ${P}audio _(link)_

📱 *VÍDEO & REDES SOCIAIS*
  ▸ ${P}tiktok _(link)_
  ▸ ${P}save _(link)_ - manutenção
  ▸ ${P}saverec _(link)_ _- manutenção_
  ▸ ${P}pinterest _- manutenção_

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !menuwork ────────────────────────────────────────────────────────────────

async function handleMenuWork(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);
  const menu =
`╔══════════════════════╗
      💼 MENU EMPREGOS
╚══════════════════════╝

🔎 *COMEÇAR*
  ▸ ${P}procuraremprego — Procura um emprego
  ▸ ${P}emprego — Ver seu cargo e status atual
  ▸ ${P}demitir — Pedir demissão voluntária

⏱️ *TRABALHAR*
  ▸ ${P}trabalhar — Bater o ponto e receber salário
  ▸ ${P}work — Atalho para !trabalhar

📈 *PROGRESSÃO*
  ▸ ${P}promocao — Subir de cargo (se tiver turnos suficientes)

━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *CARGOS DISPONÍVEIS*
  1. 🛵 Entregador de Pizza  _(inicial)_
  2. 🏪 Atendente de Loja
  3. 💻 Programador Júnior
  4. 🏢 Diretor de Empresa   _(máximo)_

━━━━━━━━━━━━━━━━━━━━━━━━
⏰ *REGRAS DO PONTO*
  • Cooldown entre turnos: *6h30*
  • Janela de tolerância: *2h* após o cooldown
  • Após *8h30* sem bater ponto → demissão por justa causa
  ⚠️ _Histórico sujo reduz chance de recontratação para 30%_

━━━━━━━━━━━━━━━━━━━━━━━━`;

  await sock.sendMessage(jid, { text: menu }, { quoted: msg });
}

// ─── !brincadeiras ────────────────────────────────────────────────────────────

async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🎭 *MENU BRINCADEIRAS*`,
    ``,
    `🎲 *Jogos de Sorte*`,
    `  🎲 *${P}dado* — Rolar um dado`,
    `  🪙 *${P}moeda* — Cara ou coroa`,
    `  🎱 *${P}8ball <pergunta>* — Bola mágica`,
    ``,
    `😄 *Diversão*`,
    `  🌈 *${P}gay* — Medidor gay`,
    `  💋 *${P}sexo @* — Medidor com alguém`,
    `  🦅 *${P}beijo @* — Dar um beijo`,
    `  👩‍❤️‍👩 *${P}lesbica @* — Medidor lésbica`,
    `  ✨ *${P}aura @* — Ver a aura`,
    ``,
    `🧠 *Quiz & Pontos*`,
    `  🧠 *${P}quiz* — Jogar quiz`,
    `  🏅 *${P}pontos* — Ver pontuação`,
    `  🏆 *${P}rankjogos* — Ranking de jogos`,
    ``,
    `🐾 *Pets & Missões*`,
    `  🎯 *${P}missao* — Missão diária`,
    `  🐾 *${P}pets* — Seus pets`,
    `  🏥 *${P}abrigo* — Abrigo de pets`,
    ``,
    `💰 *Economia*`,
    `  💰 *${P}ofertar* — Ofertar um item`,
    `  📊 *${P}ofertas* — Ver ofertas disponíveis`,
    `  🛒 *${P}comprarofferta* — Comprar oferta`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── !menugold ────────────────────────────────────────────────────────────────

async function handleMenuGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `💰 *MENU GOLD*`,
    ``,
    `💵 *Saldo & Inventário*`,
    `  💵 *${P}gold* — Ver saldo atual`,
    `  📊 *${P}invmed* — Ver inventário medieval`,
    ``,
    `🛒 *Loja*`,
    `  🛒 *${P}loja* — Loja principal`,
    `  🎁 *${P}comprar* — Comprar um item`,
    `  💸 *${P}vender* — Vender um item`,
    ``,
    `🤝 *Mercado de Jogadores*`,
    `  💰 *${P}ofertar* — Oferecer item para venda`,
    `  📲 *${P}ofertas* — Ver ofertas disponíveis`,
    `  🛍️ *${P}comprarofferta* — Comprar uma oferta`,
    ``,
    `⛏️ *Ganhar Gold*`,
    `  ⛏️ *${P}garimpar* — Garimpar ouro`,
    `  🎯 *${P}missao* — Missão diária`,
    ``,
    `ℹ️ Use *${P}sistemgold* para saber mais!`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── !menupet ─────────────────────────────────────────────────────────────────

async function handleMenuPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🐾 *MENU PET*`,
    ``,
    `🎯 *Captura*`,
    `  🎯 *${P}capturar* — Capturar pet selvagem`,
    ``,
    `❤️ *Cuidados Diários*`,
    `  🍖 *${P}alimentar* — Alimentar seu pet`,
    `  🎾 *${P}brincar* — Brincar com seu pet`,
    `  📊 *${P}statuspet* — Ver status completo`,
    ``,
    `🏥 *Abrigo*`,
    `  🏥 *${P}abrigo* — Ver pets disponíveis`,
    ``,
    `🏆 *Ranking*`,
    `  🏆 *${P}rankpet* — Top 10 melhores pets`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── !sistemgold ──────────────────────────────────────────────────────────────

async function handleSistemaGold(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `💰 *SISTEMA DE GOLD* 💰`,
    ``,
    `Gold é a moeda oficial do bot! Com ela você pode comprar`,
    `itens, adquirir pets especiais, investir e competir.`,
    ``,
    `📥 *COMO GANHAR GOLD?*`,
    `  🎯 *${P}missao* — Completar missões diárias`,
    `  ⛏️ *${P}garimpar* — Garimpar recursos`,
    `  💸 *${P}vender* — Vender itens do inventário`,
    `  🏦 *${P}banco* — Rendimento do banco`,
    ``,
    `📤 *ONDE GASTAR?*`,
    `  🛒 *${P}loja* — Loja geral`,
    `  🍔 *${P}lojafood* — Loja de comida`,
    `  🐾 *${P}lojapet* — Loja de pets`,
    `  💻 *${P}lojatec* — Loja de tecnologia`,
    ``,
    `💵 Use *${P}gold* para ver seu saldo atual.`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── !sistempet ───────────────────────────────────────────────────────────────

async function handleSistemaPet(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `🐾 *SISTEMA DE PETS* 🐾`,
    ``,
    `Capture, cuide e evolua seu próprio pet!`,
    ``,
    `🎯 *CAPTURAR PETS*`,
    `  • Um pet aparece no grupo a cada hora`,
    `  • Use *${P}capturar* para tentar capturá-lo`,
    `  • Raridades: Comum › Raro › Ultra-Raro › Lendário`,
    ``,
    `❤️ *CUIDADOS DIÁRIOS*`,
    `  🍖 *${P}alimentar* — Alimentar seu pet`,
    `  🎾 *${P}brincar* — Brincar e aumentar felicidade`,
    `  📊 *${P}statuspet* — Ver status completo`,
    ``,
    `🏥 *ABRIGO*`,
    `  🏥 *${P}abrigo* — Ver pets disponíveis para adoção`,
    `  *${P}abrigo deixar* — Deixar seu pet no abrigo`,
    `  *${P}abrigo <nome> pegar* — Adotar um pet`,
    ``,
    `🏆 *RANKING*`,
    `  🏆 *${P}rankpet* — Top 10 melhores pets do grupo`,
    ``,
    `📋 Use *${P}pets* para ver todos os tipos disponíveis!`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── !sistemmedieval ──────────────────────────────────────────────────────────

async function handleSistemaMedieval(sock, msg, jid, getPrefix) {
  const P = getPrefix(jid);

  const texto = [
    `⚔️🏰 *SISTEMA MEDIEVAL* 🏰⚔️`,
    ``,
    `O modo medieval é um RPG completo dentro do grupo!`,
    `Crie seu personagem, batalhe, evolua e domine o reino.`,
    ``,
    `👤 *PERSONAGEM*`,
    `  • Ao usar *${P}ficha* pela primeira vez, um personagem`,
    `    é criado automaticamente com classe e elemento aleatórios`,
    `  • Há 7 classes: Guerreiro, Mago, Arqueiro, Paladino,`,
    `    Assassino, Druida e Necromante`,
    `  • Cada classe tem ataque, defesa, HP e mana únicos`,
    ``,
    `🔥 *ELEMENTOS*`,
    `  • Seu personagem recebe um elemento aleatório`,
    `  • São 8 elementos: Fogo, Água, Terra, Ar, Trovão,`,
    `    Sombra, Luz e Magia Negra`,
    `  • Cada elemento tem vantagem (+50% dano) contra alguns`,
    `    e fraqueza (-30% dano) contra outros`,
    ``,
    `⚔️ *COMBATE*`,
    `  • *${P}atacar @alguém* — Ataque físico (cooldown 2min)`,
    `    Ganha 10 XP (15 se crítico). Crítico tem 15% de chance`,
    `    e multiplica o dano por 1.8x`,
    `  • *${P}magia @alguém* — Habilidade elemental (cooldown 5min)`,
    `    Consome 30 de mana. Dano 2.2x maior que ataque normal`,
    `    Ganha 20 XP. Não pode críticar`,
    `  • Derrotar um inimigo dá +30 XP (!atacar) ou +40 XP (!magia)`,
    `  • Inimigo derrotado fica com HP 0 até usar *${P}recargamana*`,
    ``,
    `🗺️ *MISSÕES*`,
    `  • *${P}missaomed* — Embarca em missão aleatória (cooldown 30min)`,
    `  • Requer HP mínimo de 20 para participar`,
    `  • 3 dificuldades: fácil, médio e difícil`,
    `  • Sucesso: XP + Gold | Falha: dano + 10 XP de consolação`,
    ``,
    `❤️ *RECUPERAÇÃO*`,
    `  • *${P}recargamana* — Recupera 60% do HP e 100% da mana`,
    `    Cooldown de 10 minutos`,
    `  • *Regeneração passiva* — Todo personagem recupera automaticamente`,
    `    +10% HP e +15% Mana a cada 1 hora (apenas grupos com medieval ativo)`,
    ``,
    `🏪 *LOJA E EQUIPAMENTOS*`,
    `  • *${P}lojamedieval* — Ver armas, armaduras e poções`,
    `  • *${P}comprar [item]* — Comprar com gold do grupo`,
    `  • *${P}equipar [item]* — Equipar arma ou armadura`,
    `  • *${P}desequipar arma/armadura* — Remover item equipado`,
    `  • *${P}invmed* — Ver seu inventário medieval`,
    `  • *${P}usarpocao [nome]* — Usar poção (sem cooldown!)`,
    `  • Armas aumentam o ataque | Armaduras aumentam a defesa`,
    `  • Poções recuperam HP e/ou mana instantaneamente`,
    `  • Raridades: comum → incomum → raro → lendário`,
    ``,
    `⭐ *PROGRESSÃO*`,
    `  • XP acumulado em batalhas e missões sobe seu nível`,
    `  • Cada level up aumenta HP máx, mana máx, ataque e defesa`,
    `  • Missões têm nível mínimo — quanto mais difícil, maior a recompensa`,
    `  • Itens raros e lendários exigem nível mínimo para comprar e equipar`,
    `  • *${P}rankmedieval* — Top 10 guerreiros por vitórias`,
    `  • *${P}historico* — Ver suas últimas 5 batalhas`,
    ``,
    `📜 *COMANDOS RÁPIDOS*`,
    `  👤 *${P}ficha* — Ver/criar seu personagem`,
    `  ⚔️ *${P}atacar @* — Atacar alguém`,
    `  🔮 *${P}magia @* — Usar habilidade elemental`,
    `  🗺️ *${P}missaomed* — Embarcar em missão`,
    `  🌟 *${P}recargamana* — Recuperar HP e mana`,
    `  🧪 *${P}usarpocao [nome]* — Usar poção`,
    `  🎒 *${P}invmed* — Ver inventário`,
    `  🏪 *${P}lojamedieval* — Ver loja`,
    `  🏆 *${P}rankmedieval* — Ranking`,
    `  📖 *${P}menumediev* — Menu de comandos`,
  ].join('\n');

  await enviar(sock, msg, jid, texto);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  handleMenu,
  handleMenuUtil,
  handleMenuJogos,
  handleMenuBaixar,
  handleMenuRelacionamento,
  handleAlteradores,
  handleMenuWork,
  handleMenuFilho,
  handleBrincadeiras,
  handleMenuGold,
  handleMenuPet,
  handleSistemaGold,
  handleSistemaPet,
  handleSistemaMedieval,
};