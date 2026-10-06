// Motor de los feeds de salida: lo que corre GitHub Actions en cada repo-<tienda> para dibujar las piezas
// y escribir el CSV (antes era parte de app/publicar.js, el servidor de la PC). auto.html (navegador sin
// pantalla) pide la receta, sube cada pieza y al final las filas; aquí se guardan en
// <PAGES_DIR>/<tienda>/<nombre>/{img,feed.csv,estado.nuevo.json}. Las recetas las escribe la nube en el
// repo (nube/feeds-salida.js); el motor solo las lee.
'use strict';
const fs = require('fs');
const path = require('path');

const ARCHIVO = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}\.(jpg|png)$/;
const COLS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link',
  'additional_image_link', 'brand', 'google_product_category', 'product_type', 'custom_label_0', 'custom_label_1', 'custom_label_2',
  'custom_label_3', 'custom_label_4'];

const RECETAS = path.join(__dirname, '..', 'auto', 'recetas');
const AUTO = path.resolve(process.env.PAGES_DIR || path.join(__dirname, '..', 'docs'));
const dirAuto = slug => path.join(AUTO, slug);
const FIRMA = /^[0-9a-f]{64}$/;
const CAIDA = 0.5; // si salen menos de la mitad de productos que la última vez, no se publica (feed roto)
const RUTA = /^[a-z][a-z0-9-]{1,39}\/[A-Za-z0-9][A-Za-z0-9_-]{1,59}$/; // slug = tienda/nombre
const vacio = () => ({ productos: {}, retirados: {} });
const esc = v => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const leerJson = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };

// Raíz pública del feed: PAGES_URL o, en Actions, la de Pages del propio repo. Termina escrita en cada
// image_link del CSV público: no puede llevar usuario ni clave.
function config() {
  let pages = String(process.env.PAGES_URL || '').trim().replace(/\/+$/, '');
  if (!pages && /^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '')) {
    const [o, r] = process.env.GITHUB_REPOSITORY.split('/');
    pages = `https://${o.toLowerCase()}.github.io/${r}`;
  }
  const publica = v => { try { const x = new URL(v); return /^https?:$/.test(x.protocol) && !x.username && !x.password && !/[\s"<>]/.test(v); } catch { return false; } };
  if (!publica(pages)) pages = '';
  return { pagesUrl: pages, raiz: pages };
}

function csvAuto(filas, raiz) {
  const lineas = [COLS.join(',')];
  for (const f of filas) lineas.push(COLS.map(c => esc(c === 'image_link' ? raiz + '/img/' + f._img : f[c])).join(','));
  return '\uFEFF' + lineas.join('\n') + '\n';
}

async function auto(req, u, accion, slug, ctx, c) {
  const { out } = ctx, d = dirAuto(slug);
  const fin = x => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'fin.json'), JSON.stringify({ ...x, cuando: new Date().toISOString() })); };
  if (accion === 'progreso') { console.log(`[${slug}] ${(await ctx.cuerpo(2000)).toString('utf8').slice(0, 300)}`); return out(200, { ok: true }); }
  if (accion === 'auto-fin') { // la página avisa que se cortó
    const r = JSON.parse((await ctx.cuerpo(20000)).toString('utf8') || '{}');
    fin({ ok: false, error: String(r.error || 'error desconocido').slice(0, 500) });
    return out(200, { ok: true });
  }
  if (accion === 'auto-img') {
    const archivo = u.searchParams.get('archivo') || '';
    if (!ARCHIVO.test(archivo) || !archivo.endsWith('.jpg')) return out(400, { error: 'Nombre de archivo no válido' });
    const buf = await ctx.cuerpo(8e6);
    if (!(buf[0] === 0xff && buf[1] === 0xd8)) return out(400, { error: 'No es un JPG' });
    fs.mkdirSync(path.join(d, 'img'), { recursive: true });
    fs.writeFileSync(path.join(d, 'img', archivo), buf);
    return out(200, { ok: true });
  }
  if (accion === 'auto-parte') { // una parte de un lote repartido: solo deja sus filas para el paso de unir
    const parte = Number(u.searchParams.get('parte'));
    if (!Number.isInteger(parte) || parte < 0 || parte > 99) return out(400, { error: 'parte no válida' });
    const b = JSON.parse((await ctx.cuerpo(400e6)).toString('utf8'));
    if (!Array.isArray(b.filas)) return out(400, { error: 'La parte no trae filas' });
    fs.mkdirSync(path.join(d, 'partes'), { recursive: true });
    fs.writeFileSync(path.join(d, 'partes', `parte${parte}.json`), JSON.stringify(b));
    const res = { ok: true, parte, filas: b.filas.length, nuevas: Number(b.dibujadas) || 0 };
    fin(res);
    return out(200, res);
  }
  if (accion === 'auto-unir') { // junta las partes y escribe el CSV (lo corre app/publica.js, no el navegador)
    const de = Number(u.searchParams.get('de')) || 1;
    const dp = path.join(d, 'partes');
    const hay = fs.existsSync(dp) ? fs.readdirSync(dp).filter(f => /^parte\d+\.json$/.test(f)) : [];
    // Con una parte de menos el CSV saldría incompleto y Meta daría de baja esos productos:
    // antes que publicar a medias, se deja el feed anterior y falla la corrida.
    if (hay.length < de) return out(409, { error: `Faltan partes: llegaron ${hay.length} de ${de}. No se publica un CSV incompleto` });
    const b = { filas: [], leidos: 0, atrasadas: 0, dibujadas: 0, fuera: {} };
    for (const f of hay) {
      const p = leerJson(path.join(dp, f), {});
      b.filas.push(...(p.filas || []));
      b.leidos += Number(p.leidos) || 0;
      b.atrasadas += Number(p.atrasadas) || 0;
      b.dibujadas += Number(p.dibujadas) || 0;
      for (const [k, v] of Object.entries(p.fuera || {})) b.fuera[k] = (b.fuera[k] || 0) + (Number(v) || 0);
    }
    return cerrar(b);
  }
  if (accion === 'auto-feed') return cerrar(JSON.parse((await ctx.cuerpo(400e6)).toString('utf8')));

  out(404, { error: 'Acción desconocida' });

  // Escribe feed.csv y estado.nuevo.json con TODAS las filas de la corrida (enteras o ya unidas).
  // Quien sube (ftp.js) o hace commit (publica.js) se encarga después de las imágenes retiradas.
  function cerrar(b) {
    if (!c.raiz) return out(409, { error: 'Falta PAGES_URL (o FTP_URL): la dirección pública donde vive el feed' });
    if (!Array.isArray(b.filas) || !b.filas.length) return out(400, { error: 'El feed no trae filas' });
    const prev = { ...vacio(), ...leerJson(path.join(d, 'estado.json'), {}) };
    const receta = leerJson(path.join(RECETAS, slug + '.json'), {});
    const conocidos = new Set([...Object.values(prev.productos).map(x => x[1]), ...Object.keys(prev.retirados)]);
    const nPrev = Object.keys(prev.productos).length;
    if (nPrev >= 50 && b.filas.length < nPrev * CAIDA && !receta.permitir_caida) {
      const error = `Salen ${b.filas.length} productos contra ${nPrev} la última vez: no se publica (¿el feed de la tienda vino roto?). Si la baja es real, pon "permitir_caida": true en la receta una vez.`;
      fin({ ok: false, error }); return out(409, { error });
    }
    const img = path.join(d, 'img'), productos = {}, filas = [];
    let nuevas = 0, repetidos = 0;
    for (const f of b.filas) {
      if (!f || !f.id || !ARCHIVO.test(f._img || '') || !FIRMA.test(f._firma || '')) return out(400, { error: 'Fila sin id, imagen o firma: ' + String(f && f.id).slice(0, 40) });
      if (Object.hasOwn(productos, f.id)) { repetidos++; continue; } // dos partes pueden traer el mismo id: gana la primera
      const local = fs.existsSync(path.join(img, f._img));
      if (!local && !conocidos.has(f._img)) return out(400, { error: 'Falta la imagen ' + f._img });
      if (local) nuevas++;
      productos[f.id] = [f._firma, f._img, /^[0-9a-f]{16}$/.test(f._pf || '') ? f._pf : ''];
      filas.push(Object.fromEntries([...COLS.filter(k => k !== 'image_link').map(k => [k, String(f[k] ?? '').slice(0, 10000)]), ['_img', f._img]]));
    }
    // Con Pages img/ es la carpeta del repo (no se vacía cada corrida), así que «nuevas» lo dice el navegador.
    if (process.env.PAGES_DIR) nuevas = Number(b.dibujadas) || 0;
    // Lo que salió del feed no se borra enseguida: Meta pudo leer el CSV anterior y aún no bajar esa imagen.
    const usados = new Set(Object.values(productos).map(x => x[1])), ahora = new Date().toISOString(), retirados = {};
    for (const a of conocidos) if (!usados.has(a)) retirados[a] = prev.retirados[a] || ahora;
    fs.writeFileSync(path.join(d, 'feed.csv'), csvAuto(filas, c.raiz + '/' + slug));
    fs.writeFileSync(path.join(d, 'estado.nuevo.json'), JSON.stringify({ version: 1, slug, actualizado: ahora, productos, retirados }));
    const res = { productos: filas.length, nuevas, reusadas: filas.length - nuevas, retiradas: Object.keys(retirados).length,
      atrasadas: Number(b.atrasadas) || 0, leidos: Number(b.leidos) || 0,
      fuera: { ...(b.fuera || {}), repetidos: ((b.fuera || {}).repetidos || 0) + repetidos } };
    fin({ ok: true, ...res });
    return out(200, res);
  }
}

// ---------- Rutas /publicar/* del motor ----------
// ctx: { out(code, body), cuerpo(max) → Promise<Buffer> }
async function publicar(req, res, u, ctx) {
  const { out } = ctx, c = config(), accion = u.pathname.slice('/publicar/'.length), slug = u.searchParams.get('slug') || '';
  if (req.method === 'GET' && accion === 'estado') return out(200, { ok: true, motor: true, pages_url: c.pagesUrl });
  if (!RUTA.test(slug)) return out(400, { error: 'Nombre de feed no válido (tienda/nombre)' });
  if (req.method === 'GET' && accion === 'receta') {
    const receta = leerJson(path.join(RECETAS, slug + '.json'), null);
    if (!receta) return out(404, { error: 'No hay receta ' + slug });
    return out(200, { receta, estado: { ...vacio(), ...leerJson(path.join(dirAuto(slug), 'estado.json'), {}) } });
  }
  if (req.method !== 'POST') return out(405, { error: 'Método no permitido' });
  if (['progreso', 'auto-fin', 'auto-img', 'auto-feed', 'auto-parte', 'auto-unir'].includes(accion)) return auto(req, u, accion, slug, ctx, c);
  out(404, { error: 'Acción desconocida' });
}

module.exports = { publicar, AUTO, RECETAS };
