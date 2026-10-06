// Servidor mínimo del motor de feeds: lo levanta motor/publica.js dentro de GitHub Actions (nunca en una
// PC) para que auto.html dibuje las piezas en Chrome sin pantalla. Sirve las pantallas de app/, el proxy
// de feeds e imágenes de los sitios del grupo (no mandan CORS y sin él el lienzo no exporta) y las rutas
// /publicar/* de motor/publicar.js. Solo escucha en 127.0.0.1.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { publicar } = require('./publicar.js');

const PORT = Number(process.env.PORT) || 5192;
const APP = path.join(__dirname, '..', 'app');
const LOCAL = 'http://127.0.0.1:' + PORT;
// Mismo PERMITIDOS que nube/reglas.js.
const PERMITIDOS = ['lacuracao.pe', 'efe.com.pe', 'tiendasefe.com.pe', 'juntoz.com', 'motocorp.com.pe', 'efectiva.com.pe', 'juntozstgsrvproduction.blob.core.windows.net'];
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const SEGURO = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" };
const permitido = u => {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && PERMITIDOS.some(d => x.hostname === d || x.hostname.endsWith('.' + d)); }
  catch { return false; }
};
const MAX_BYTES = 80e6;
// Baja una URL permitida. Un minuto para que responda; después, hasta 2 min para una imagen y 10
// para un feed (el de Juntoz pesa ~48 MB y tarda ~4 min).
// Nos presentamos como un navegador, no como un robot. No es un disfraz caprichoso: el WAF de
// lacuracao.pe corta en seco a las IP de datacenter que piden fotos con un User-Agent de programa,
// y entonces una maquina entera de Actions recibe 502 en TODAS las fotos y la parte se pierde
// (le paso a las partes 5 y 6 de la corrida 35827761529). El sistema que lleva dos meses corriendo
// usa exactamente estas tres cabeceras y baja con 48 hilos sin que lo frenen; las cabeceras
// *elaboradas* (sec-fetch-*, Referer inventado) son las que gatillan el WAF, asi que no se agregan.
const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
};
async function traer(destino) {
  const ctl = new AbortController();
  let reloj = setTimeout(() => ctl.abort(new Error('el sitio no respondió en 60 s')), 60000);
  try {
    // Redirecciones a mano: cada salto tiene que seguir dentro de PERMITIDOS.
    let r, url = destino;
    for (let salto = 0; ; salto++) {
      r = await fetch(url, { headers: CABECERAS, redirect: 'manual', signal: ctl.signal });
      if (r.status < 300 || r.status > 399) break;
      url = new URL(r.headers.get('location') || '', url).href;
      if (salto >= 4 || !permitido(url)) throw new Error('redirección fuera de los dominios permitidos');
    }
    const tipo = r.headers.get('content-type') || 'application/octet-stream';
    clearTimeout(reloj);
    reloj = setTimeout(() => ctl.abort(new Error('la descarga pasó el tiempo máximo')), tipo.startsWith('image/') ? 120000 : 600000);
    if (Number(r.headers.get('content-length')) > MAX_BYTES) throw new Error('archivo de más de 80 MB');
    const partes = []; let n = 0;
    for await (const p of r.body) { n += p.length; if (n > MAX_BYTES) throw new Error('archivo de más de 80 MB'); partes.push(p); }
    return { status: r.status, ok: r.ok, tipo, buf: Buffer.concat(partes) };
  } finally { clearTimeout(reloj); }
}

async function proxy(req, res, destino) {
  if (!permitido(destino)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Dominio no permitido'); }
  try {
    const { status, tipo, buf } = await traer(destino);
    res.writeHead(status, { ...SEGURO, 'Content-Type': tipo, 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No se pudo leer: ' + e.message);
  }
}

function atender(req, res) {
  const u = new URL(req.url, 'http://x');
  const out = (code, d) => { if (res.headersSent) return; res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(d)); };
  if (u.pathname === '/proxy') return proxy(req, res, u.searchParams.get('url') || '');
  if (u.pathname.startsWith('/publicar/')) {
    // Escrituras solo desde la propia página (o de publica.js, que manda el mismo Origin).
    if (req.method !== 'GET' && req.headers.origin !== LOCAL && req.headers.origin !== 'http://localhost:' + PORT) return out(403, { error: 'Origen no permitido' });
    const cuerpo = max => new Promise((ok, mal) => {
      const partes = []; let n = 0;
      req.on('data', c => { n += c.length; if (n > max) { mal(new Error('Archivo demasiado grande')); req.destroy(); } else partes.push(c); });
      req.on('end', () => ok(Buffer.concat(partes)));
      req.on('error', mal);
    });
    return publicar(req, res, u, { out, cuerpo }).catch(e => out(400, { error: e.message }));
  }
  const f = path.join(APP, decodeURIComponent(u.pathname === '/' ? '/auto.html' : u.pathname));
  const rel = path.relative(APP, f);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('No existe'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(d);
  });
}

http.createServer((req, res) => {
  try { atender(req, res); }
  catch { if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Petición inválida'); }
}).listen(PORT, '127.0.0.1', () => console.log('Motor de feeds en ' + LOCAL));
