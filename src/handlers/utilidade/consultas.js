'use strict';

const path = require('path');

async function safeReact(sock, jid, msgKey, emoji) {
  try {
    await sock.sendMessage(jid, { react: { text: emoji, key: msgKey } });
  } catch {}
}

async function handleCep(sock, msg, jid, caption) {
  const cep = caption.replace(/^[!.,\/#]cep\s*/i, '').trim().replace(/\D/g, '');
  if (!cep || cep.length !== 8) {
    await sock.sendMessage(jid, { text: '⚠️ Digite um CEP válido (8 dígitos).' }, { quoted: msg });
    return;
  }
  await safeReact(sock, jid, msg.key, '⏳');
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.erro) {
      await safeReact(sock, jid, msg.key, '❌');
      await sock.sendMessage(jid, { text: `❌ CEP *${cep}* não encontrado.` }, { quoted: msg });
      return;
    }
    const texto = [
      `📍 *CEP ${data.cep}*`,
      `🏡 *Logradouro:* ${data.logradouro || '—'}`,
      `🏘️ *Bairro:* ${data.bairro || '—'}`,
      `🏙️ *Cidade:* ${data.localidade} - ${data.uf}`,
      `📞 *DDD:* ${data.ddd || '—'}`,
    ].join('\n');
    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await safeReact(sock, jid, msg.key, '✅');
  } catch {
    await safeReact(sock, jid, msg.key, '❌');
    await sock.sendMessage(jid, { text: '❌ Não consegui consultar este CEP.' }, { quoted: msg });
  }
}

async function handleClima(sock, msg, jid, caption) {
  const cidade = caption.replace(/^[!.,\/#]clima\s*/i, '').trim();
  if (!cidade) {
    await sock.sendMessage(jid, { text: '⚠️ Digite a cidade.\nExemplo: *!clima São Paulo*' }, { quoted: msg });
    return;
  }
  await safeReact(sock, jid, msg.key, '⏳');
  try {
    const url = `https://wttr.in/${encodeURIComponent(cidade)}?format=j1&lang=pt`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cur  = data.current_condition?.[0];
    if (!cur) throw new Error('Sem dados de clima');

    const desc  = cur.lang_pt?.[0]?.value || cur.weatherDesc?.[0]?.value || '—';
    const temp  = cur.temp_C          ?? '—';
    const sens  = cur.FeelsLikeC      ?? '—';
    const umid  = cur.humidity        ?? '—';
    const vento = cur.windspeedKmph   ?? '—';
    const uv    = cur.uvIndex         ?? '—';
    const vis   = cur.visibility      ?? '—';
    const press = cur.pressure        ?? '—';

    const area  = data.nearest_area?.[0];
    const local = area
      ? `${area.areaName?.[0]?.value || ''}, ${area.country?.[0]?.value || ''}`.replace(/^,\s*|,\s*$/g, '')
      : cidade;

    const t = Number(temp);
    const emoji =
      t >= 35 ? '🔥' :
      t >= 28 ? '🥵' :
      t >= 20 ? '☀️' :
      t >= 10 ? '🌤️' :
      t >= 0  ? '🧊' : '🥶';

    const texto = [
      `${emoji} *Clima em ${local}*`,
      '',
      `🌡️ *Temperatura:* ${temp}°C`,
      `🤔 *Sensação térmica:* ${sens}°C`,
      `📋 *Condição:* ${desc}`,
      `💧 *Umidade:* ${umid}%`,
      `💨 *Vento:* ${vento} km/h`,
      `☀️ *Índice UV:* ${uv}`,
      `👁️ *Visibilidade:* ${vis} km`,
      `🔵 *Pressão:* ${press} hPa`,
    ].join('\n');

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await safeReact(sock, jid, msg.key, '✅');
  } catch (err) {
    await safeReact(sock, jid, msg.key, '❌');
    await sock.sendMessage(jid, { text: `❌ Não consegui obter o clima de *${cidade}*.` }, { quoted: msg });
  }
}

async function handleMoeda(sock, msg, jid, caption) {
  const input = caption.replace(/^[!.,\/#]moeda\s*/i, '').trim();
  const parts = input.split(/\s+/);
  if (parts.length < 3) {
    await sock.sendMessage(jid, { text: '⚠️ Uso: *!moeda [valor] [de] [para]*\nExemplo: *!moeda 100 USD BRL*' }, { quoted: msg });
    return;
  }
  const valor = parseFloat(parts[0].replace(',', '.'));
  const de    = parts[1].toUpperCase();
  const para  = parts[2].toUpperCase();

  if (isNaN(valor) || valor <= 0 || de.length !== 3 || para.length !== 3) {
    await sock.sendMessage(jid, { text: '⚠️ Valor ou código de moeda inválido. Ex: *!moeda 100 USD BRL*' }, { quoted: msg });
    return;
  }

  await safeReact(sock, jid, msg.key, '⏳');

  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${de}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const taxa = data.rates?.[para];
    if (!taxa) throw new Error(`Par ${de}/${para} não encontrado`);

    const resultado   = (valor * taxa).toFixed(2);
    const taxaInversa = (1 / taxa).toFixed(4);
    const atualizado  = data.date ?? '—';

    const fmtValor     = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtResultado = parseFloat(resultado).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const texto = [
      `💱 *Conversão de Moeda*`,
      '',
      `💵 *${fmtValor} ${de}* = *${fmtResultado} ${para}*`,
      '',
      `📊 *Taxa:* 1 ${de} = ${taxa.toFixed(4)} ${para}`,
      `🔁 *Inversa:* 1 ${para} = ${taxaInversa} ${de}`,
      `📅 *Atualizado em:* ${atualizado}`,
    ].join('\n');

    await sock.sendMessage(jid, { text: texto }, { quoted: msg });
    await safeReact(sock, jid, msg.key, '✅');
  } catch {
    await safeReact(sock, jid, msg.key, '❌');
    await sock.sendMessage(jid, { text: `❌ Não consegui converter *${de}* para *${para}*.` }, { quoted: msg });
  }
}

async function handleCalcular(sock, msg, jid, caption) {
  const expr = caption.replace(/^[!.,\/#]calcular\s*/i, '').trim();
  if (!expr || !/^[\d\s+\-*/().%^,]+$/.test(expr)) {
    await sock.sendMessage(jid, { text: '⚠️ Digite uma expressão válida. Ex: *!calcular 15 * 3 + 2*' }, { quoted: msg });
    return;
  }
  try {
    const safeExpr = expr.replace(/,/g, '.').replace(/\^/g, '**');
    const resultado = Function(`'use strict'; return (${safeExpr})`)();
    if (typeof resultado !== 'number' || !isFinite(resultado)) throw new Error('Inválido');
    const fmtResultado = parseFloat(resultado.toPrecision(12)).toString();
    await sock.sendMessage(jid, { text: `🧮 *Resultado:* *${fmtResultado}*` }, { quoted: msg });
  } catch {
    await sock.sendMessage(jid, { text: '❌ Erro de cálculo. Verifique a expressão.' }, { quoted: msg });
  }
}

async function handleTraduzir(sock, msg, jid, caption) {
  const NOMES_IDIOMA = {
    en: 'Inglês', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano',
    ja: 'Japonês', zh: 'Chinês', ru: 'Russo', ar: 'Árabe', pt: 'Português',
  };
  const raw = caption.replace(/^[!.,\/#]traduzir\s*/i, '').trim();
  const parts = raw.split(/\s+/);

  let idioma = 'en';
  let texto = '';

  if (parts.length >= 1 && /^[a-z]{2,3}$/i.test(parts[0])) {
    idioma = parts[0].toLowerCase();
    texto = parts.slice(1).join(' ').trim();
  } else {
    texto = raw;
  }

  // Suporte a mensagem citada (reply) se nenhum texto direto foi fornecido
  if (!texto) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMsg) {
      texto =
        quotedMsg.conversation ||
        quotedMsg.extendedTextMessage?.text ||
        quotedMsg.imageMessage?.caption ||
        quotedMsg.videoMessage?.caption ||
        '';
    }
  }

  if (!texto) {
    await sock.sendMessage(jid, {
      text: '⚠️ Use: *!traduzir [idioma] [texto]* ou responda a uma mensagem com *!traduzir [idioma]*.\nExemplo: *!traduzir en Olá mundo*',
    }, { quoted: msg });
    return;
  }

  await safeReact(sock, jid, msg.key, '⏳');
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=pt|${idioma}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const traduzido = data?.responseData?.translatedText?.trim();
    if (!traduzido) throw new Error('Sem tradução');
    const nomeIdioma = NOMES_IDIOMA[idioma] ?? idioma.toUpperCase();
    await sock.sendMessage(jid, { text: `🌐 *Tradução (${nomeIdioma}):*\n\n*${traduzido}*` }, { quoted: msg });
    await safeReact(sock, jid, msg.key, '✅');
  } catch {
    await safeReact(sock, jid, msg.key, '❌');
    await sock.sendMessage(jid, { text: '❌ Erro ao traduzir o texto.' }, { quoted: msg });
  }
}

module.exports = {
  handleCep,
  handleClima,
  handleMoeda,
  handleCalcular,
  handleTraduzir,
};
