// Helper para download de URL via https/http nativo do Node
const https = require('https');
const http  = require('http');

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: 10000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * fetchJson — suporta GET e POST
 * @param {string} url
 * @param {object} options  — { method, headers, body }
 *                            Se omitido faz GET simples.
 */
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method  = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {};
    const body    = options.body ? Buffer.from(options.body) : null;

    if (body) {
      headers['Content-Length'] = body.length;
    }

    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname : parsed.hostname,
      path     : parsed.pathname + parsed.search,
      method,
      headers,
      timeout  : 15000,
    };

    const req = lib.request(reqOptions, res => {
      let str = '';
      res.setEncoding('utf8');
      res.on('data',  chunk => str += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(str)); }
        catch (e) { reject(new Error(`JSON inválido: ${str.slice(0, 200)}`)); }
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('fetchJson timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

module.exports = { fetchBuffer, fetchJson };