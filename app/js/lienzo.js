// Lienzo de la Fábrica: la plantilla, cómo se dibuja una pieza y el editor con arrastre.
// Las posiciones van en fracciones del lienzo (0 a 1) por formato, así una misma plantilla
// sirve para 1:1, 4:5, 9:16 y banner, y cada formato se puede acomodar por separado.
import { proxied } from './config.js';

export const NOMBRES = { foto: 'Foto del producto', caja1: 'Caja de color 1', caja2: 'Caja de color 2', logo: 'Logo', sello: 'Sello', dto: 'Descuento (-%)', ahorro: 'Ahorro (Ahorra S/)', marca: 'Marca', titulo: 'Título', antes: 'Precio regular (tachado)', precio: 'Precio de oferta', sku: 'SKU', texto: 'Texto libre' };
// Capas que se calculan con la oferta del producto: si no hay oferta, no salen en la pieza.
export const SOLO_OFERTA = ['antes', 'dto', 'ahorro'];

export function plantillaBase() {
  return {
    id: 'base', nombre: 'Base',
    // w/h = tamaño real de la imagen de fondo (0 = no hay). De ahí sale el formato «Plantilla».
    // ajuste: 'cubrir' recorta para llenar, 'contener' entra entera (deja ver el degradado).
    // encima: la plantilla se dibuja SOBRE las capas (marco); con blanco = true sus blancos
    // se vuelven transparentes, así el producto se ve por los huecos y puede salirse de la caja.
    fondo: { c1: '#c8102e', c2: '#4a0510', img: '', w: 0, h: 0, ajuste: 'cubrir', encima: false, blanco: false, tol: 12 },
    // Las cajas de color van justo después de la foto (y del marco): sirven de banda o fondo detrás de los textos.
    orden: ['foto', 'caja1', 'caja2', 'logo', 'sello', 'dto', 'ahorro', 'marca', 'titulo', 'antes', 'precio', 'sku', 'texto'],
    capas: {
      // blanco = true: el fondo blanco de la foto del producto se vuelve transparente (tol como en el fondo).
      // sombra = true: sombra suave debajo de la foto (se luce con «Quitar fondo blanco»).
      foto: { vis: true, tarjeta: true, cTarjeta: '#ffffff', blanco: false, tol: 12, sombra: false },
      // Cajas de color: rectángulos lisos para bandas o fondos. `radio` en px de la pieza, `opac` de 0 a 100.
      caja1: { vis: false, bg: '#0072CE', radio: 0, opac: 100 },
      caja2: { vis: false, bg: '#FFD400', radio: 24, opac: 100 },
      // -% calculado con el precio regular y el de oferta. forma: circulo, pildora o rect.
      dto: { vis: false, bg: '#E30613', color: '#ffffff', forma: 'circulo', pre: '-', post: '%', fuente: '', tam: '' },
      // Cuánto se ahorra (regular menos oferta), con el mismo formato de número que los precios.
      ahorro: { vis: false, bg: '#FFD400', color: '#0B1F4D', pre: 'Ahorra S/ ', post: '', fuente: '', tam: '', dec: 'auto', miles: ',' },
      // delMarco = true: el pedazo de la plantilla que cae dentro de la caja del logo se vuelve a
      // dibujar al frente (círculo o rectángulo), para que el logo que trae el marco no quede tapado
      // por la tarjeta de la foto.
      logo: { vis: true, src: '', delMarco: false, forma: 'circulo' },
      // `tam` = tamaño de la letra en px de la pieza; vacío = el más grande que entra en la caja.
      // Con número, si el texto no entra a ese tamaño se achica lo justo (nunca se sale de la caja).
      // soloOferta = true: el sello sale solo en los productos con precio de oferta.
      sello: { vis: false, texto: 'OFERTA', bg: '#ffd400', color: '#1a1a1a', fuente: '', tam: '', soloOferta: false },
      // ocultar: marcas (separadas por coma) que no se escriben en la pieza, p. ej. «Genérico».
      marca: { vis: true, color: '#ffd9de', bold: false, align: 'left', mayus: true, fuente: '', tam: '', ocultar: '' },
      // minTam: la letra no baja de este tamaño; lo que no entra se corta con «…».
      titulo: { vis: true, color: '#ffffff', bold: true, align: 'left', fuente: '', tam: '', minTam: '' },
      // Los dos precios son capas aparte, cada una con su caja, su texto antes y después, su tachado y su -%.
      // Se escriben: [pre]1'299.90[post]. `dec` = cuantos decimales ('auto' = solo si los tiene),
      // `miles` = que separa los miles (coma, punto, apostrofo, espacio o nada; el decimal sale de ahi).
      // `antes` (precio regular) sale solo si el feed trae sale_price; `precio` es el que se paga.
      // simChico = true: el texto de antes del número («S/ ») sale a media altura, arriba, como en las tiendas.
      antes: { vis: false, color: '#ffffff', bg: '', bold: false, align: 'left', fuente: '', tam: '',
        pre: 'Antes S/ ', post: '', dec: 'auto', miles: ',', tachado: true, dto: false, simChico: false },
      precio: { vis: true, color: '#ffffff', bg: '', bold: true, align: 'left', fuente: '', tam: '',
        pre: null, post: '', dec: 'auto', miles: ',', tachado: false, dto: false, simChico: false },
      // El código del producto (id del feed), con un texto delante: «SKU: cf-123».
      sku: { vis: false, pre: 'SKU: ', color: '#ffffff', bold: false, align: 'left', fuente: '', tam: '' },
      texto: { vis: false, texto: 'Solo por hoy', color: '#ffffff', bold: false, align: 'left', fuente: '', tam: '' },
    },
    pos: {
      '1x1': { caja1: [.04, .66, .92, .3], caja2: [.55, .8, .4, .14], dto: [.06, .05, .16, .16], ahorro: [.06, .23, .34, .06],  antes: [.08, .83, .4, .035], sku: [.66, .82, .28, .04], logo: [.06, .05, .3, .09], sello: [.66, .05, .28, .08], foto: [.08, .17, .84, .5], marca: [.08, .7, .84, .04], titulo: [.08, .745, .84, .11], precio: [.08, .865, .6, .1], texto: [.66, .88, .28, .06] },
      '4x5': { caja1: [.04, .64, .92, .32], caja2: [.55, .8, .4, .12], dto: [.06, .04, .16, .128], ahorro: [.06, .18, .34, .05],  antes: [.08, .8, .4, .03], sku: [.66, .8, .28, .035], logo: [.06, .04, .3, .075], sello: [.66, .04, .28, .065], foto: [.08, .14, .84, .5], marca: [.08, .67, .84, .035], titulo: [.08, .71, .84, .11], precio: [.08, .835, .6, .1], texto: [.66, .86, .28, .05] },
      '9x16': { caja1: [.04, .62, .92, .34], caja2: [.08, .78, .84, .1], dto: [.08, .14, .2, .1125], ahorro: [.08, .26, .5, .035],  antes: [.08, .76, .5, .028], sku: [.08, .93, .84, .025], logo: [.08, .06, .36, .06], sello: [.6, .06, .32, .045], foto: [.08, .18, .84, .44], marca: [.08, .65, .84, .025], titulo: [.08, .685, .84, .09], precio: [.08, .79, .84, .08], texto: [.08, .88, .84, .04] },
      '3x1': { caja1: [.33, .04, .64, .92], caja2: [.76, .3, .22, .4], dto: [.03, .08, .09, .27], ahorro: [.78, .76, .19, .12],  antes: [.78, .66, .19, .08], sku: [.35, .82, .4, .1], foto: [.03, .08, .28, .84], logo: [.35, .1, .2, .2], marca: [.35, .36, .4, .1], titulo: [.35, .48, .4, .3], precio: [.78, .34, .19, .3], sello: [.78, .1, .19, .18], texto: [.78, .7, .19, .15] },
    },
  };
}

// Proporciones de los formatos fijos, para estrenar un formato nuevo copiando el más parecido
// en vez de dejar las capas en cualquier sitio.
const RATIO = { '1x1': 1, '4x5': .8, '9x16': .5625, '3x1': 3 };
// Devuelve (creándolas si hacen falta) las posiciones de un formato en esta plantilla.
export function asegurarPos(pl, fmtId, w = 0, h = 0) {
  if (pl.pos[fmtId]) return pl.pos[fmtId];
  const r = w && h ? w / h : 1;
  const cerca = Object.keys(RATIO).filter(id => pl.pos[id]).sort((a, b) => Math.abs(RATIO[a] - r) - Math.abs(RATIO[b] - r))[0];
  pl.pos[fmtId] = structuredClone(pl.pos[cerca] || Object.values(pl.pos)[0] || {});
  return pl.pos[fmtId];
}

// ---------- imágenes ----------
// Caché con tope: en un lote de miles de productos no se guardan todas las fotos a la vez.
// Los data:/blob: (logo y fondo subidos) no se desalojan.
const imgs = new Map(), TOPE_IMGS = 150;
export function cargarImg(src) {
  if (!src) return Promise.resolve(null);
  if (imgs.has(src)) { const p = imgs.get(src); imgs.delete(src); imgs.set(src, p); return p; } // la más usada va al final
  for (const k of imgs.keys()) { if (imgs.size < TOPE_IMGS) break; if (!/^(data|blob):/.test(k)) imgs.delete(k); }
  // Un corte de red no se guarda como «sin foto»: se reintenta una vez y el fallo no queda en caché.
  const una = () => new Promise(ok => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => ok(im);
    im.onerror = () => ok(null); // sin foto no se cae el lote: la pieza sale sin ella y se avisa
    im.src = proxied(src);
  });
  const p = una().then(im => im || new Promise(r => setTimeout(r, 700)).then(una)).then(im => { if (!im && imgs.get(src) === p) imgs.delete(src); return im; });
  imgs.set(src, p);
  return p;
}

// La plantilla con los blancos vueltos transparentes. Se guarda hecha: en un lote de miles de
// piezas se recorta una sola vez, no una por pieza. `tol` = cuánto se aleja del blanco puro
// un píxel que igual se borra; los `SUAVE` siguientes se desvanecen para que el borde no quede
// de sierra.
// Las fotos de producto van en su propia caché: en un lote cada pieza trae otra foto y no deben
// desalojar a la plantilla, que es la misma en todas. En la foto (`borde` = true) solo se borra el
// blanco que toca el borde de la imagen y lo que está pegado a él: el fondo, no las partes blancas
// del producto (una refrigeradora blanca no se queda hueca).
const fondosTratados = new Map(), TOPE_FONDOS = 3, fotosTratadas = new Map(), TOPE_FOTOS = 20, SUAVE = 14;
function sinBlanco(im, tol, cache = fondosTratados, tope = TOPE_FONDOS, borde = false) {
  const k = im.src + '|' + tol + '|' + borde;
  if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas');
  const W = cv.width = im.naturalWidth || im.width, H = cv.height = im.naturalHeight || im.height;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  try {
    const d = x.getImageData(0, 0, W, H), p = d.data;
    const dif = i => 255 - Math.min(p[i], p[i + 1], p[i + 2]);
    const borrar = i => {
      const v = dif(i);
      if (v <= tol) p[i + 3] = 0;
      else if (v <= tol + SUAVE) p[i + 3] = Math.round(p[i + 3] * (v - tol) / SUAVE);
    };
    if (!borde) {
      for (let i = 0; i < p.length; i += 4) if (p[i + 3]) borrar(i);
    } else {
      // Relleno desde los cuatro bordes por los píxeles casi blancos (los del degradé también, para
      // suavizar el contorno, pero desde ellos no se sigue avanzando).
      const visto = new Uint8Array(W * H), pila = [];
      const meter = (px, py) => { const n = py * W + px; if (!visto[n]) { visto[n] = 1; pila.push(n); } };
      for (let px = 0; px < W; px++) { meter(px, 0); meter(px, H - 1); }
      for (let py = 0; py < H; py++) { meter(0, py); meter(W - 1, py); }
      while (pila.length) {
        const n = pila.pop(), i = n * 4;
        if (!p[i + 3]) continue;
        const v = dif(i);
        if (v > tol + SUAVE) continue;
        borrar(i);
        if (v > tol) continue;
        const px = n % W, py = (n - px) / W;
        if (px > 0) meter(px - 1, py); if (px < W - 1) meter(px + 1, py);
        if (py > 0) meter(px, py - 1); if (py < H - 1) meter(px, py + 1);
      }
    }
    x.putImageData(d, 0, 0);
  } catch { return im; } // si el lienzo quedara manchado, se usa la imagen tal cual
  if (cache.size >= tope) cache.delete(cache.keys().next().value);
  cache.set(k, cv);
  return cv;
}

// ---------- ayudas de dibujo ----------
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const FUENTE = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
// Fuentes elegibles por capa. Solo familias que ya estan en Windows y en el runner de Actions
// (fonts-liberation): una fuente que no exista en la maquina que dibuja saldria distinta en el lote.
export const FUENTES = [
  ['', 'La del sistema'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['"Arial Black", Arial, sans-serif', 'Arial Black'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Verdana, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", Arial, sans-serif', 'Trebuchet MS'],
  ['Impact, "Arial Black", sans-serif', 'Impact'],
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Courier New", Courier, monospace', 'Courier New'],
];
const fam = c => c?.fuente || FUENTE;

// ---------- precio ----------
// Como se escribe un numero: decimales y separador de miles a eleccion (el decimal es el otro signo).
export function fmtNum(v, c = {}) {
  const miles = c.miles == null ? ',' : c.miles;
  const d = String(c.dec) === '0' ? 0 : String(c.dec) === '2' ? 2 : (Math.abs(v % 1) > 1e-9 ? 2 : 0);
  const [ent, fr] = Math.abs(v).toFixed(d).split('.');
  const sep = miles === '.' ? ',' : '.';
  return (v < 0 ? '-' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, miles) + (fr ? sep + fr : '');
}
// `pre` en null = el simbolo que trae el feed (S/ para PEN). Con texto propio, manda el texto.
export function precioTxt(p, c = {}, demo = 0) {
  const v = p ? p.v : demo, cur = p ? p.cur : 'PEN';
  const pre = c.pre == null ? (cur === 'PEN' ? 'S/ ' : cur + ' ') : c.pre;
  return pre + fmtNum(v, c) + (c.post || '');
}
const dtoTxt = (antes, ahora) => { const d = Math.round((1 - ahora / antes) * 100); return d > 0 && d < 100 ? ' -' + d + '%' : ''; };

function partir(ctx, texto, ancho) {
  const lineas = []; let l = '';
  for (const p of texto.split(/\s+/)) {
    const prueba = l ? l + ' ' + p : p;
    if (ctx.measureText(prueba).width <= ancho || !l) l = prueba; else { lineas.push(l); l = p; }
  }
  if (l) lineas.push(l);
  return lineas;
}

// Busca el tamaño más grande que entra en la caja; si no entra ni al mínimo, corta con "…".
// `minTam`: tamaño más chico permitido; si el texto no entra ni así, se corta con «…» a ese tamaño
// (un título larguísimo ya no se achica hasta no poder leerse).
function encajar(ctx, texto, w, h, bold, maxLineas = 4, f = FUENTE, tam = 0, minTam = 10) {
  const piso = Math.max(10, minTam || 10);
  for (let s = Math.floor(tam > 0 ? tam : h * .9); s >= piso; s = Math.floor(s * .93)) {
    ctx.font = `${bold ? 700 : 400} ${s}px ${f}`;
    const ls = partir(ctx, texto, w);
    if (ls.length <= maxLineas && ls.length * s * 1.15 <= h && ls.every(x => ctx.measureText(x).width <= w)) return { s, ls };
  }
  const s = piso; ctx.font = `${bold ? 700 : 400} ${s}px ${f}`;
  const ls = partir(ctx, texto, w).slice(0, Math.max(1, Math.min(maxLineas, Math.floor(h / (s * 1.15)))));
  let u = ls[ls.length - 1] + '…';
  while (u.length > 1 && ctx.measureText(u).width > w) u = u.slice(0, -2).trimEnd() + '…';
  ls[ls.length - 1] = u;
  return { s, ls };
}

export function textoEnCaja(ctx, texto, [x, y, w, h], c) {
  if (!texto) return;
  const { s, ls } = encajar(ctx, texto, w, h, c.bold, 4, fam(c), +c.tam || 0, +c.minTam || 10);
  ctx.fillStyle = c.color; ctx.textBaseline = 'top';
  ctx.textAlign = c.align || 'left';
  const ax = c.align === 'center' ? x + w / 2 : c.align === 'right' ? x + w : x;
  ls.forEach((l, i) => {
    const ty = y + i * s * 1.15;
    ctx.fillText(l, ax, ty);
    if (!c.tachar) return; // el precio de antes va cruzado por una linea, como en la tienda
    const a = ctx.measureText(l).width;
    const lx = c.align === 'center' ? ax - a / 2 : c.align === 'right' ? ax - a : ax;
    ctx.fillRect(lx, ty + s * .55, a, Math.max(1, s * .07));
  });
}

// Precio con el símbolo chico: «S/» a media altura arriba y el número grande, en una sola línea.
function precioPartido(ctx, pre, num, [x, y, w, h], c) {
  const f = fam(c), peso = c.bold ? 700 : 400;
  let s = Math.floor(+c.tam > 0 ? +c.tam : h * .9);
  const ancho = n => { ctx.font = `${peso} ${n * .5}px ${f}`; const a = ctx.measureText(pre).width; ctx.font = `${peso} ${n}px ${f}`; return a + n * .04 + ctx.measureText(num).width; };
  while (s > 10 && (ancho(s) > w || s * 1.15 > h)) s = Math.floor(s * .93);
  const total = ancho(s);
  ctx.font = `${peso} ${s * .5}px ${f}`; const aPre = ctx.measureText(pre).width;
  const x0 = c.align === 'center' ? x + (w - total) / 2 : c.align === 'right' ? x + w - total : x;
  ctx.fillStyle = c.color; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(pre, x0, y + s * .08);
  ctx.font = `${peso} ${s}px ${f}`; ctx.fillText(num, x0 + aPre + s * .04, y);
  if (c.tachar) ctx.fillRect(x0, y + s * .55, total, Math.max(1, s * .07));
}

export function contener(ctx, im, x, y, w, h) {
  const k = Math.min(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

// ---------- una pieza ----------
export async function dibujar(ctx, W, H, pl, fmt, prod, op = {}) {
  const [foto, logo, fondoImg] = await Promise.all([cargarImg(prod?.image), cargarImg(pl.capas.logo.src), cargarImg(pl.fondo.img)]);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W * .4, H);
  g.addColorStop(0, pl.fondo.c1); g.addColorStop(1, pl.fondo.c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // La plantilla va detrás de todo, o en modo marco: justo encima de la foto del producto y
  // debajo del logo y los textos, para que la foto pueda salirse del hueco sin tapar lo demás.
  // En el formato «Plantilla» el lienzo mide lo mismo que la imagen, así que cubrir = calcado.
  const pintarPlantilla = () => {
    if (!fondoImg) return;
    const im = pl.fondo.blanco ? sinBlanco(fondoImg, Math.max(0, Math.min(90, +pl.fondo.tol || 0))) : fondoImg;
    const k = pl.fondo.ajuste === 'contener'
      ? Math.min(W / im.width, H / im.height)
      : Math.max(W / im.width, H / im.height);
    ctx.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k);
  };
  if (!pl.fondo.encima) pintarPlantilla();

  const P = pl.pos[fmt] || asegurarPos(pl, fmt, W, H);
  const caja = id => { const p = P[id]; return [p[0] * W, p[1] * H, p[2] * W, p[3] * H]; };
  const r = Math.min(W, H) * .03;
  let marcoPuesto = false;
  for (const id of pl.orden) {
    const c = pl.capas[id];
    if (!c || !c.vis) continue;
    const [x, y, w, h] = caja(id);
    if (id === 'foto') {
      if (c.tarjeta) { ctx.fillStyle = c.cTarjeta; rrect(ctx, x, y, w, h, r); ctx.fill(); }
      const pad = c.tarjeta ? Math.min(w, h) * .06 : 0;
      const im = foto && c.blanco ? sinBlanco(foto, Math.max(0, Math.min(90, +c.tol || 0)), fotosTratadas, TOPE_FOTOS, true) : foto;
      if (im && c.sombra) { ctx.save(); ctx.shadowColor = 'rgba(11,31,77,.28)'; ctx.shadowBlur = Math.min(W, H) * .035; ctx.shadowOffsetY = Math.min(W, H) * .018; contener(ctx, im, x + pad, y + pad, w - pad * 2, h - pad * 2); ctx.restore(); }
      else if (im) contener(ctx, im, x + pad, y + pad, w - pad * 2, h - pad * 2);
      else if (op.editor) { ctx.fillStyle = '#0003'; ctx.font = `${h * .06}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.fillText(prod ? 'Sin foto' : 'Elige un producto', x + w / 2, y + h / 2); }
      if (pl.fondo.encima) { pintarPlantilla(); marcoPuesto = true; } // el marco tapa la foto, no el resto
    } else if (id === 'logo') {
      if (c.delMarco && fondoImg) {
        ctx.save(); ctx.beginPath();
        if (c.forma === 'rect') ctx.rect(x, y, w, h);
        else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.clip(); pintarPlantilla(); ctx.restore();
      }
      if (logo) contener(ctx, logo, x, y, w, h);
      else if (op.editor && !(c.delMarco && fondoImg)) { ctx.strokeStyle = '#fff8'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); textoEnCaja(ctx, 'Sube tu logo', [x + w * .1, y + h * .25, w * .8, h * .5], { color: '#fffa', align: 'center' }); }
    } else if (id === 'caja1' || id === 'caja2') {
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(100, c.opac ?? 100)) / 100;
      ctx.fillStyle = c.bg || '#0072CE'; rrect(ctx, x, y, w, h, Math.max(0, +c.radio || 0)); ctx.fill(); ctx.restore();
    } else if (id === 'dto' || id === 'ahorro') {
      // Solo con oferta. En el editor, sin oferta, se ve tenue con un número de muestra para acomodarla.
      const of = prod?.oldPrice && prod?.price && prod.oldPrice.v > prod.price.v;
      if (!of && !op.editor) continue;
      const antes = of ? prod.oldPrice.v : 1299, ahora = of ? prod.price.v : 999;
      const t = id === 'dto' ? (c.pre ?? '-') + Math.round((1 - ahora / antes) * 100) + (c.post ?? '%')
        : (c.pre ?? 'Ahorra S/ ') + fmtNum(antes - ahora, c) + (c.post || '');
      ctx.save(); if (!of) ctx.globalAlpha = .45;
      ctx.fillStyle = c.bg || '#E30613';
      if (id === 'dto' && c.forma === 'circulo') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      else { rrect(ctx, x, y, w, h, id === 'dto' && c.forma === 'rect' ? r * .5 : h / 2); ctx.fill(); }
      const ix = id === 'dto' && c.forma === 'circulo' ? w * .16 : h * .3, iy = h * (id === 'dto' && c.forma === 'circulo' ? .24 : .17);
      textoEnCaja(ctx, t, [x + ix, y + iy, w - ix * 2, h - iy * 2], { color: c.color, bold: true, align: 'center', fuente: c.fuente, tam: c.tam });
      ctx.restore();
    } else if (id === 'sello') {
      const conOferta = prod?.oldPrice && prod?.price && prod.oldPrice.v > prod.price.v;
      if (c.soloOferta && !conOferta && !op.editor) continue;
      ctx.fillStyle = c.bg; rrect(ctx, x, y, w, h, h / 2); ctx.fill();
      textoEnCaja(ctx, c.texto, [x + h * .35, y + h * .18, w - h * .7, h * .64], { color: c.color, bold: true, align: 'center', fuente: c.fuente, tam: c.tam });
    } else if (id === 'marca') {
      const t = prod?.brand || 'MARCA';
      const llave = m => String(m).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      if (String(c.ocultar || '').split(',').map(llave).filter(Boolean).includes(llave(t))) continue;
      textoEnCaja(ctx, c.mayus ? t.toUpperCase() : t, [x, y, w, h], c);
    } else if (id === 'titulo') {
      textoEnCaja(ctx, prod?.title || 'Título del producto', [x, y, w, h], c);
    } else if (id === 'precio' && !pl.capas.antes) {
      // Plantillas guardadas antes de separar los precios (recetas de feeds ya creadas): salen igual que siempre.
      if (c.bg) { ctx.fillStyle = c.bg; rrect(ctx, x, y, w, h, r); ctx.fill(); }
      const pad = c.bg ? h * .12 : 0;
      const bx = x + pad, by = y + pad, bw = w - pad * 2, bh = h - pad * 2;
      const ahora = precioTxt(prod?.price, c, 999.9);
      const viejo = prod?.oldPrice || (op.editor && c.antes === 'siempre' ? { v: 1299, cur: 'PEN' } : null);
      if (viejo && c.antes !== 'nunca') {
        const t = (c.antesPre == null ? 'Antes ' : c.antesPre) + precioTxt(viejo, c) + (c.antesPost || '')
          + (c.dto && prod?.price ? dtoTxt(viejo.v, prod.price.v) : '');
        textoEnCaja(ctx, t, [bx, by, bw, bh * .32], { ...c, color: c.antesColor || c.color, bold: false, tachar: c.antesTachado !== false, tam: 0 });
        textoEnCaja(ctx, ahora, [bx, by + bh * .34, bw, bh * .66], { ...c, bold: true, tachar: false, tam: 0 });
      } else textoEnCaja(ctx, ahora, [bx, by, bw, bh], { ...c, bold: true, tachar: false, tam: 0 });
    } else if (id === 'precio' || id === 'antes') {
      // Precio de oferta (el que se paga) y precio regular (el de antes, solo si hay oferta).
      // En el editor, si el producto no tiene oferta, el regular se ve tenue con un número de muestra
      // para poder acomodarlo; en la pieza real no sale.
      const demo = id === 'antes' && !prod?.oldPrice;
      if (demo && !op.editor) continue;
      const v = id === 'antes' ? (prod?.oldPrice || { v: 1299, cur: prod?.price?.cur || 'PEN' }) : prod?.price;
      const t = precioTxt(v, c, 999.9) + (c.dto && prod?.oldPrice && prod?.price ? dtoTxt(prod.oldPrice.v, prod.price.v) : '');
      ctx.save(); if (demo) ctx.globalAlpha = .45;
      if (c.bg) { ctx.fillStyle = c.bg; rrect(ctx, x, y, w, h, r); ctx.fill(); }
      const pad = c.bg ? h * .12 : 0;
      const caja = [x + pad, y + pad, w - pad * 2, h - pad * 2];
      const pre = c.pre == null ? (v?.cur && v.cur !== 'PEN' ? v.cur + ' ' : 'S/ ') : c.pre;
      if (c.simChico && pre.trim()) precioPartido(ctx, pre.trimEnd(), t.slice(pre.length), caja, { ...c, tachar: !!c.tachado });
      else textoEnCaja(ctx, t, caja, { ...c, tachar: !!c.tachado });
      ctx.restore();
    } else if (id === 'sku') {
      textoEnCaja(ctx, (c.pre ?? 'SKU: ') + (prod?.sku || 'cf-000000'), [x, y, w, h], c);
    } else if (id === 'texto') {
      textoEnCaja(ctx, c.texto, [x, y, w, h], c);
    }
  }

  if (pl.fondo.encima && !marcoPuesto) pintarPlantilla(); // la foto estaba oculta: el marco va igual

  if (op.sel && pl.capas[op.sel]?.vis) {
    const [x, y, w, h] = caja(op.sel), k = op.k || 1;
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2 * k; ctx.setLineDash([8 * k, 5 * k]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(x + w - 9 * k, y + h - 9 * k, 18 * k, 18 * k);
  }
  ctx.restore();
  return { sinFoto: !!prod && !foto };
}

// ---------- editor ----------
// Arrastrar mueve la capa; la esquina inferior derecha la redimensiona; flechas la empujan.
export class Editor {
  constructor(canvas, { alCambiar, alElegir }) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.alCambiar = alCambiar; this.alElegir = alElegir;
    this.pl = null; this.fmt = null; this.prod = null; this.sel = null; this.turno = 0;
    canvas.addEventListener('pointerdown', e => this.bajar(e));
    canvas.addEventListener('pointermove', e => this.mover(e));
    canvas.addEventListener('pointerup', e => this.subir(e));
    canvas.addEventListener('pointercancel', e => this.subir(e));
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', e => this.tecla(e));
  }
  poner({ pl = this.pl, fmt = this.fmt, prod = this.prod } = {}) {
    this.pl = pl; this.prod = prod;
    if (pl && fmt) asegurarPos(pl, fmt.id, fmt.w, fmt.h);
    if (!this.fmt || fmt.id !== this.fmt.id || fmt.w !== this.fmt.w || fmt.h !== this.fmt.h) { this.fmt = fmt; this.cv.width = fmt.w; this.cv.height = fmt.h; }
    return this.pintar();
  }
  async pintar() {
    const t = ++this.turno, k = this.cv.width / this.cv.getBoundingClientRect().width || 1;
    const off = document.createElement('canvas'); off.width = this.cv.width; off.height = this.cv.height;
    const r = await dibujar(off.getContext('2d'), off.width, off.height, this.pl, this.fmt.id, this.prod, { editor: true, sel: this.sel, k });
    if (t === this.turno) { this.ctx.clearRect(0, 0, off.width, off.height); this.ctx.drawImage(off, 0, 0); }
    return r;
  }
  punto(e) { const b = this.cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; }
  pos(id) { return this.pl.pos[this.fmt.id][id]; }
  bajar(e) {
    const [px, py] = this.punto(e), b = this.cv.getBoundingClientRect();
    const hx = 14 / b.width, hy = 14 / b.height;
    if (this.sel) { const [x, y, w, h] = this.pos(this.sel); if (Math.abs(px - (x + w)) < hx && Math.abs(py - (y + h)) < hy) { this.arr = { modo: 'tam', px, py, o: [...this.pos(this.sel)] }; this.cv.setPointerCapture(e.pointerId); return; } }
    const hit = [...this.pl.orden].reverse().find(id => { if (!this.pl.capas[id].vis) return false; const [x, y, w, h] = this.pos(id); return px >= x && px <= x + w && py >= y && py <= y + h; }) || null;
    this.elegir(hit);
    if (hit) { this.arr = { modo: 'mover', px, py, o: [...this.pos(hit)] }; this.cv.setPointerCapture(e.pointerId); }
  }
  mover(e) {
    const [px, py] = this.punto(e);
    if (!this.arr) {
      if (!this.sel) { this.cv.style.cursor = 'default'; return; }
      const [x, y, w, h] = this.pos(this.sel), b = this.cv.getBoundingClientRect();
      this.cv.style.cursor = Math.abs(px - (x + w)) < 14 / b.width && Math.abs(py - (y + h)) < 14 / b.height ? 'nwse-resize' : 'move';
      return;
    }
    const { modo, o } = this.arr, dx = px - this.arr.px, dy = py - this.arr.py, p = this.pos(this.sel);
    if (modo === 'mover') { p[0] = Math.min(Math.max(o[0] + dx, -o[2] * .5), 1 - o[2] * .5); p[1] = Math.min(Math.max(o[1] + dy, -o[3] * .5), 1 - o[3] * .5); }
    else { p[2] = Math.max(.03, o[2] + dx); p[3] = Math.max(.02, o[3] + dy); }
    this.pintar();
  }
  subir() { if (this.arr) { this.arr = null; this.alCambiar(); } }
  tecla(e) {
    if (!this.sel || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const p = this.pos(this.sel), d = e.shiftKey ? .01 : .002;
    if (e.key === 'ArrowLeft') p[0] -= d; if (e.key === 'ArrowRight') p[0] += d; if (e.key === 'ArrowUp') p[1] -= d; if (e.key === 'ArrowDown') p[1] += d;
    this.pintar(); this.alCambiar();
  }
  elegir(id) { this.sel = id; this.alElegir(id); this.pintar(); }
}

// Pieza final a tamaño real, sin marcas de edición.
// Exporta con `toDataURL` y no con `toBlob`: medido en Chrome (2026-09-22, 1080x1080 JPEG),
// `toBlob` tarda ~1020 ms por pieza y `toDataURL` ~20 ms con el mismo codificador y la misma
// calidad. El lienzo se dibuja en 5 ms, así que ese segundo era casi todo el costo de un lote
// (62.476 piezas = 17 h). Pasar el base64 a bytes a mano cuesta ~2 ms. Devuelve también `bytes`
// para que quien arma un ZIP no tenga que volver a leer el blob.
// Salida de las piezas que van a un feed (Meta/TikTok) y se publican en GitHub Pages.
// Se dibuja a tamaño completo (1080) y se entrega reducida: Meta pide 500x500 como mínimo
// para catálogo y no muestra la pieza más grande que eso en ningún sitio del feed.
// Medido el 2026-09-23 contra el sistema que ya lleva 2 meses en producción
// (analyticsdatajg2025-cmd/GITHUB_FEED_LC: 600x600 calidad 80 -> 36-38 KB por pieza)
// frente a nuestros 1080x1080 calidad 90 -> 116 KB. Con 15.619 productos eso es
// 1,8 GB contra ~0,6 GB, y GitHub Pages recomienda no pasar de 1 GB por sitio.
// Vive en este archivo a propósito: el `phash` de `js/auto.js` incluye el texto de
// `lienzo.js`, así que cambiar estos números rehace todas las piezas en la próxima corrida.
export const SALIDA_FEED = { lado: 600, calidad: .8 };

export async function renderPng(pl, fmt, prod, tipo = 'image/png', salida = null) {
  const cv = document.createElement('canvas'); cv.width = fmt.w; cv.height = fmt.h;
  const r = await dibujar(cv.getContext('2d'), fmt.w, fmt.h, pl, fmt.id, prod);
  let du, lienzo = cv, calidad = .9;
  if (salida && salida.lado > 0) {
    const mayor = Math.max(fmt.w, fmt.h);
    if (salida.lado < mayor) {
      const k = salida.lado / mayor, ch = document.createElement('canvas');
      ch.width = Math.max(1, Math.round(fmt.w * k)); ch.height = Math.max(1, Math.round(fmt.h * k));
      const cx = ch.getContext('2d');
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(cv, 0, 0, ch.width, ch.height);
      lienzo = ch;
    }
    if (salida.calidad > 0) calidad = salida.calidad;
  }
  try { du = lienzo.toDataURL(tipo, calidad); } catch { throw new Error('el lienzo no se pudo exportar'); }
  if (!du || du.length < 100) throw new Error('el lienzo no se pudo exportar');
  const b64 = atob(du.slice(du.indexOf(',') + 1)), bytes = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) bytes[i] = b64.charCodeAt(i);
  return { blob: new Blob([bytes], { type: tipo }), bytes, sinFoto: r.sinFoto };
}
