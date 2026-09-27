'use strict';

async function handleMenuMarket(sock, msg, jid, getPrefix) {
  const P = typeof getPrefix === 'function' ? getPrefix(jid) : '!';
  await sock.sendMessage(jid, {
    text:
      `🛒 *MARKETPLACE — COMPRA E VENDA* 🛒\n\n` +
      `${P}avenda — ver ofertas no mercado\n` +
      `${P}ofertar [item] [preço] [qtd] — colocar item à venda\n` +
      `${P}buyoferta [vendedor] [item] [qtd] — comprar oferta\n` +
      `${P}cancelaoferta [item] — remover sua oferta\n` +
      `${P}minhasofertas — ver suas ofertas ativas\n` +
      `${P}historicomarket — histórico de compras e vendas`,
  }, { quoted: msg });
}

module.exports = { handleMenuMarket };
