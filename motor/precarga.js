#!/usr/bin/env node
// Precarga de la caché de fotos originales (I-13): baja de a poco, por la nube del sistema, las fotos de
// una parte del catálogo y las deja en FOTOS_CACHE con el mismo formato que motor/servidor.js (sha1 de la
// URL + .img/.tipo). Así el próximo cambio de marco casi no le pide fotos a la tienda. Lo corre
// auto/precarga.yml a mano, de madrugada; no toca el feed ni el repo.
//
//   node motor/precarga.js <tienda/nombre> --parte K --de N
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const arg = process.argv.slice(2);
const opcion = k => { const i = arg.indexOf(k); return i >= 0 ? arg[i + 1] : ''; };
const slug = arg.find(a => /^[a-z][a-z0-9-]*\/[\w-]+$/.test(a)) || '';
const PARTE = Number(opcion('--parte')) || 0, DE = Math.max(1, Number(opcion('--de')) || 1);
const CACHE = process.env.FOTOS_CACHE || '';
const NUBE = /^https:\/\/[\w.-]+\/proxy$/.test(process.env.PROXY_NUBE || '') ? process.env.PROXY_NUBE : '';
const HILOS = 2, PAUSA_MS = 150, PLAZO = Date.now() + 35 * 60e3;
if (!slug || !CACHE || !NUBE) { console.error('Uso: FOTOS_CACHE=... PROXY_NUBE=... node motor/precarga.js <tienda/nombre> --parte K --de N'); process.exit(1); }

// El mismo reparto que app/js/auto.js (FNV-1a sobre el sku): cada parte precarga justo lo que dibuja.
const dondeVa = sku => { const s = String(sku); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % DE; };
const archivo = u => path.join(CACHE, crypto.createHash('sha1').update(u).digest('hex'));
const dormir = ms => new Promise(r => setTimeout(r, ms));
const porNube = u => NUBE + '?url=' + encodeURIComponent(u);

// CSV o TSV (los feeds de Google de TI van con tabulador), con comillas y saltos de línea dentro.
function csv(texto) {
  texto = texto.replace(/^﻿/, '');
  const cab = texto.split('\n').find(l => l && !l.startsWith('#')) || '';
  const SEP = (cab.match(/\t/g) || []).length > (cab.match(/,/g) || []).length ? '\t' : ',';
  const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (SEP === '\t' && ch === '"' && !q) { c += ch; continue; }
    if (q) { if (ch === '"') { if (texto[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === SEP) { f.push(c); c = ''; }
    else if (ch === '\n') { f.push(c.replace(/\r$/, '')); filas.push(f); f = []; c = ''; }
    else c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  const datos = filas.filter(r => r.length > 1 && !String(r[0]).startsWith('#'));
  const k = (datos.shift() || []).map(x => x.trim());
  return datos.map(r => Object.fromEntries(k.map((x, i) => [x, (r[i] ?? '').trim()])));
}

(async () => {
  const receta = JSON.parse(fs.readFileSync(path.join('auto', 'recetas', slug + '.json'), 'utf8'));
  let texto;
  try { const r = await fetch(receta.feed_url, { signal: AbortSignal.timeout(240e3) }); if (!r.ok) throw new Error(r.status); texto = await r.text(); }
  catch { const r = await fetch(porNube(receta.feed_url), { signal: AbortSignal.timeout(240e3) }); texto = await r.text(); }
  const fotos = [...new Set(csv(texto).filter(p => p.id && dondeVa(p.id) === PARTE).map(p => p.image_link || p.image || '')
    .filter(u => /^https:\/\//.test(u) && !/\/no_selection\/?$/i.test(u)))];
  fs.mkdirSync(CACHE, { recursive: true });
  const faltan = fotos.filter(u => !fs.existsSync(archivo(u) + '.img'));
  console.log(`${slug} parte ${PARTE} de ${DE}: ${fotos.length} fotos, ${fotos.length - faltan.length} ya en caché, ${faltan.length} por bajar`);
  // Directo primero (la nube sale por IPs de Cloudflare que la tienda limita con 429) y la nube solo si
  // directo falla. Si fallan 25 seguidas, la tienda está cortando: se para y no se la castiga más.
  let i = 0, ok = 0, mal = 0, seguidas = 0, directas = 0, nube = 0, cortada = false;
  async function bajar(u) {
    const r = await fetch(u, { signal: AbortSignal.timeout(30e3), headers: { 'User-Agent': 'Mozilla/5.0' } });
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !tipo.startsWith('image/')) throw new Error(String(r.status));
    return { buf: Buffer.from(await r.arrayBuffer()), tipo };
  }
  async function hilo() {
    while (i < faltan.length && Date.now() < PLAZO && !cortada) {
      const u = faltan[i++];
      try {
        let x;
        try { x = await bajar(u); directas++; } catch { x = await bajar(porNube(u)); nube++; }
        const f = archivo(u);
        fs.writeFileSync(f + '.img', x.buf); fs.writeFileSync(f + '.tipo', x.tipo); ok++; seguidas = 0;
      } catch { mal++; if (++seguidas >= 25) cortada = true; await dormir(2000); }
      await dormir(PAUSA_MS);
    }
  }
  await Promise.all(Array.from({ length: HILOS }, hilo));
  console.log(`Listo: ${ok} bajadas (${directas} directas, ${nube} por la nube), ${mal} fallaron, ${faltan.length - ok - mal} quedaron para la próxima` + (cortada ? '. La tienda cortó: se paró para no castigarla' : ''));
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
