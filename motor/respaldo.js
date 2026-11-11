// Respaldo sin marco: si una corrida falló, la URL del feed no puede quedarse con datos viejos ni vacía.
// Para cada feed de la corrida cuyo último registro en historial.json es un error (o no es de esta
// corrida), se escribe docs/<tienda>/<nombre>/feed.csv con el feed de la tienda TAL CUAL: mismos
// productos, precios y textos, y la foto original de la tienda (sin marco). No toca estado.json ni las
// piezas: la próxima corrida buena vuelve a publicar las imágenes con marco en la misma URL.
// Uso: node motor/respaldo.js tienda/nombre [...]   (lo llama auto/publica.yml si «dibujar» o «unir» fallan)
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PAGES = path.resolve(process.env.PAGES_DIR || path.join(RAIZ, 'docs'));
const COLS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link',
  'additional_image_link', 'brand', 'google_product_category', 'product_type', 'custom_label_0', 'custom_label_1', 'custom_label_2',
  'custom_label_3', 'custom_label_4'];
const RUTA = /^[a-z][a-z0-9-]{1,39}\/[A-Za-z0-9][A-Za-z0-9_-]{1,59}$/;
const VENTANA_MS = 3 * 3600e3; // una corrida sana (dibujar + unir) dura menos de 2 h
const CABECERAS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': '*/*' };
const esc = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const leerJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };

async function bajar(url) {
  const nube = /^https:\/\/[\w.-]+\/proxy$/.test(process.env.PROXY_NUBE || '') ? process.env.PROXY_NUBE : '';
  for (const u of [url, nube && nube + '?url=' + encodeURIComponent(url)].filter(Boolean)) {
    try {
      const r = await fetch(u, { headers: CABECERAS, signal: AbortSignal.timeout(600e3) });
      if (r.ok) return await r.text();
      console.log(`  ${u.slice(0, 80)} respondió ${r.status}`);
    } catch (e) { console.log(`  ${u.slice(0, 80)}: ${e.message}`); }
  }
  throw new Error('no se pudo bajar el feed de la tienda');
}

async function respaldo(slug, feeds) {
  const dir = path.join(PAGES, slug), hist = leerJson(path.join(dir, 'historial.json'), []);
  const ult = Array.isArray(hist) ? hist[0] : null;
  const reciente = ult && !ult.error && Date.now() - new Date(ult.cuando).getTime() < VENTANA_MS;
  if (reciente) return console.log(`${slug}: la corrida publicó bien, no hace falta respaldo`);
  const receta = leerJson(path.join(process.env.RECETAS_DIR || path.join(RAIZ, 'auto', 'recetas'), slug + '.json'), null);
  if (!receta || !receta.feed_url) throw new Error(`${slug}: no hay receta`);
  const prods = feeds.parsear(await bajar(receta.feed_url));
  const lineas = [COLS.join(',')];
  let n = 0;
  for (const p of prods) {
    if (!p.image || !(p.price?.v > 0) || !/^https?:\/\//.test(p.link || '')) continue;
    const { fila } = feeds.filaMeta(p);
    fila.image_link = p.image;
    lineas.push(COLS.map(c => esc(fila[c])).join(','));
    n++;
  }
  if (n < 50) throw new Error(`${slug}: el feed de la tienda trae solo ${n} productos; no se publica el respaldo`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'feed.csv'), '﻿' + lineas.join('\n') + '\n');
  const motivo = ult && ult.error ? String(ult.error).slice(0, 300) : 'la corrida no terminó';
  hist.unshift({ cuando: new Date().toISOString(), productos: n, nuevas: 0, reusadas: 0, retiradas: 0, paso: 'Respaldo sin marco', respaldo: true, motivo });
  fs.writeFileSync(path.join(dir, 'historial.json'), JSON.stringify(hist.slice(0, 60), null, 1));
  console.log(`${slug}: respaldo publicado con ${n} productos y fotos originales (motivo: ${motivo})`);
}

(async () => {
  const slugs = process.argv.slice(2).filter(s => RUTA.test(s));
  if (!slugs.length) return console.log('Sin feeds para respaldar');
  const feeds = await import(path.join(RAIZ, 'app', 'js', 'feeds.js'));
  let fallo = 0;
  for (const s of slugs) { try { await respaldo(s, feeds); } catch (e) { console.log('::error::' + e.message); fallo = 1; } }
  process.exitCode = fallo;
})();
