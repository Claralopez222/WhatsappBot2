'use strict';

async function handleMenuJogos(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
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

async function handleBrincadeiras(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🎮 *BRINCADEIRAS* 🎮\n\n` +
      `${P}gay [@] — % de gay\n` +
      `${P}sexo [@] — % de sexo\n` +
      `${P}lesbica [@] — % lésbica\n` +
      `${P}trans [@] — % trans\n` +
      `${P}aura [@] — sua aura\n` +
      `${P}ship [@] [@] — shippar\n` +
      `${P}compatibilidade [@] — compatibilidade\n` +
      `${P}dado [lados] — jogar dado\n` +
      `${P}moeda — cara ou coroa\n` +
      `${P}8ball [pergunta] — bola 8\n` +
      `${P}rolar [min] [max] — número aleatório\n` +
      `${P}ppt — pedra papel tesoura\n` +
      `${P}quiz — quiz aleatório\n` +
      `${P}anagrama — jogo de anagrama\n` +
      `${P}roletarussa — roleta russa\n` +
      `${P}eununca — eu nunca\n` +
      `${P}verdadeoudesafio — verdade ou desafio\n` +
      `${P}xingar [@] — xingar alguém\n` +
      `${P}elogio [@] — elogiar alguém\n` +
      `${P}cantada [@] — cantada\n` +
      `${P}crush [@] — crush\n` +
      `${P}julgamento [@] — julgar\n` +
      `${P}fortuna — fortuna\n` +
      `${P}maldizer [@] — maldizer\n` +
      `${P}confissao — confissão\n` +
      `${P}fofoca [@] — contar fofoca\n` +
      `${P}inverter [texto] — inverter texto\n` +
      `${P}gerarnome — gerador de nicknames`,
  }, { quoted: msg });
}

module.exports = { handleMenuJogos, handleBrincadeiras };
