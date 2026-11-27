/**
 * actualizar_datos.js
 * -------------------
 * Convierte baseCobertura.xlsx y baseInventario.xlsx → data/coberturas.json
 *
 * Uso:  node actualizar_datos.js
 *
 * Requisito: tener instalado el paquete xlsx
 *   npm install xlsx
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ---- Ruta del Excel (ajusta si lo mueves) ----
const XL_PATH  = path.join(__dirname, '..', 'baseCobertura.xlsx');
const INV_PATH = path.join(__dirname, '..', 'baseInventario.xlsx');
const OUT_PATH = path.join(__dirname, 'data', 'coberturas.json');

// ---- Leer el archivo ----
console.log('📂 Leyendo:', XL_PATH);
if (!fs.existsSync(XL_PATH)) {
  console.error('❌ No se encontró el archivo Excel en:', XL_PATH);
  process.exit(1);
}
if (!fs.existsSync(INV_PATH)) {
  console.error('❌ No se encontró el archivo de inventario en:', INV_PATH);
  process.exit(1);
}

const wb = XLSX.readFile(XL_PATH, { cellText: false, cellDates: true });
const ws = wb.Sheets['Base'];
if (!ws) {
  console.error('❌ No existe la hoja llamada "Base" en el archivo.');
  process.exit(1);
}

const raw = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log('✅ Filas leídas:', raw.length);

const invWb = XLSX.readFile(INV_PATH, { cellText: false, cellDates: true });
const invWs = invWb.Sheets['inventario'];
if (!invWs) {
  console.error('❌ No existe la hoja llamada "inventario" en baseInventario.xlsx.');
  process.exit(1);
}

const rawInventario = XLSX.utils.sheet_to_json(invWs, { defval: null });
console.log('✅ Inventario leído:', rawInventario.length, 'filas');

// ---- Transformar ----
function parseNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.round(val);
  const s = String(val).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

function normalizeCodigo(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

const categoriaPorZona = {
  ZC: 'Vacunación',
  ZE: 'Identificación',
  ZL1: 'Identificación',
  ZL2: 'Identificación',
};

// Animales se agregan por municipio y zona operativa; cada fila de inventario
// representa un predio y se cuenta dentro de su categoría de cobertura.
const inventarioAnimales = new Map();
const prediosPorMunicipioCategoria = new Map();
rawInventario.forEach(r => {
  const codigo = normalizeCodigo(r.cod_munpio);
  const zona = String(r.zona || '').trim();
  const categoria = categoriaPorZona[zona];
  if (!codigo || !zona || !categoria) {
    throw new Error(`Fila de inventario inválida: código "${codigo}", zona "${zona}".`);
  }

  const key = `${codigo}|${zona}`;
  if (!inventarioAnimales.has(key)) {
    inventarioAnimales.set(key, {
      codigo,
      zona,
      categoria,
      depto: String(r.nom_depto || '').trim(),
      animales: 0,
    });
  }
  inventarioAnimales.get(key).animales += parseNum(r['inventario animales']);

  const predioKey = `${codigo}|${categoria}`;
  prediosPorMunicipioCategoria.set(
    predioKey,
    (prediosPorMunicipioCategoria.get(predioKey) || 0) + 1
  );
});

const inventario = [...inventarioAnimales.values()].map(item => ({
  cod: item.codigo,
  zonaInv: item.zona,
  zona: item.categoria,
  depto: item.depto,
  inv: item.animales,
  predios: prediosPorMunicipioCategoria.get(`${item.codigo}|${item.categoria}`) || 0,
}));

const records = raw
  .filter(r => r['año'] && r['mes'] && r['departamento'])
  .map(r => {
    const vacField = r['vacunados ó chapeteados'] ??
                     r['vacunados o chapeteados'] ?? 0;
    const codigoMunicipio = normalizeCodigo(r['codMcpo']);
    return {
      ano:     parseInt(r['año'])   || 0,
      mes:     String(r['mes']).trim(),
      zona:    String(r['zonaOrganizadas'] || '').trim(),
      depto:   String(r['departamento']   || '').trim(),
      mcpo:    String(r['nombreMcpo']     || '').trim(),
      cod:     codigoMunicipio,
      vacun:   parseNum(vacField),
      vacPred: parseNum(r['predios']),
    };
  })
  .filter(r => r.ano > 0);

console.log('✅ Registros procesados:', records.length);

// ---- Guardar JSON ----
fs.writeFileSync(OUT_PATH, JSON.stringify({ records, inventario }));
const kb = Math.round(fs.statSync(OUT_PATH).size / 1024);
console.log(`💾 JSON guardado en: ${OUT_PATH}  (${kb} KB)`);
console.log('');
console.log('🚀 Ahora ejecuta:');
console.log('   git add data/coberturas.json');
console.log('   git commit -m "Datos ' + new Date().toLocaleDateString('es-CO', {month:'long', year:'numeric'}) + '"');
console.log('   git push');
