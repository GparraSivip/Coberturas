/**
 * actualizar_datos.js
 * -------------------
 * Convierte baseCobertura.xlsx → data/coberturas.json
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
const OUT_PATH = path.join(__dirname, 'data', 'coberturas.json');

// ---- Leer el archivo ----
console.log('📂 Leyendo:', XL_PATH);
if (!fs.existsSync(XL_PATH)) {
  console.error('❌ No se encontró el archivo Excel en:', XL_PATH);
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

// ---- Transformar ----
function parseNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.round(val);
  const s = String(val).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

const records = raw
  .filter(r => r['año'] && r['mes'] && r['departamento'])
  .map(r => {
    const vacField = r['vacunados ó chapeteados'] ??
                     r['vacunados o chapeteados'] ?? 0;
    return {
      ano:     parseInt(r['año'])   || 0,
      mes:     String(r['mes']).trim(),
      zona:    String(r['zonaOrganizadas'] || '').trim(),
      depto:   String(r['departamento']   || '').trim(),
      mcpo:    String(r['nombreMcpo']     || '').trim(),
      inv:     parseNum(r['existenciasAnimales']),
      vacun:   parseNum(vacField),
      predios: parseNum(r['existenciaPredios']),
      vacPred: parseNum(r['predios']),
    };
  })
  .filter(r => r.ano > 0);

console.log('✅ Registros procesados:', records.length);

// ---- Guardar JSON ----
fs.writeFileSync(OUT_PATH, JSON.stringify(records));
const kb = Math.round(fs.statSync(OUT_PATH).size / 1024);
console.log(`💾 JSON guardado en: ${OUT_PATH}  (${kb} KB)`);
console.log('');
console.log('🚀 Ahora ejecuta:');
console.log('   git add data/coberturas.json');
console.log('   git commit -m "Datos ' + new Date().toLocaleDateString('es-CO', {month:'long', year:'numeric'}) + '"');
console.log('   git push');
