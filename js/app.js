/* =====================================================================
   app.js  –  Dashboard Coberturas Sanitarias
   Lee data/coberturas.json (generado desde ambos archivos Excel)
   ===================================================================== */

// ---- Orden canónico de meses ----
const MESES_ORDER = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ---- Estado global ----
const state = {
  data:        [],     // todos los registros
  inventario:  [],     // inventario consolidado por municipio y zona
  zona:        'Vacunación',
  meses:       [],
  departamentos: [],
  añoActual:   null,
  añoAnterior: null,
};

// ---- Referencias DOM ----
const $ = id => document.getElementById(id);

// ---- Instancias Chart.js ----
let chartTendencia = null;
let chartBarras    = null;
let chartGauge     = null;

/* =========================================================
   ARRANQUE
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  fetch('data/coberturas.json')
    .then(r => r.json())
    .then(payload => {
      state.data = payload.records;
      state.inventario = payload.inventario;

      // Determinar años presentes
      const years = [...new Set(state.data.map(d => d.ano))].sort();
      state.añoActual   = years[years.length - 1];
      state.añoAnterior = years.length > 1 ? years[years.length - 2] : years[0];

      const mesActual = [...new Set(
        state.data.filter(d => d.ano === state.añoActual).map(d => d.mes)
      )]
        .filter(m => MESES_ORDER.includes(m))
        .sort((a, b) => MESES_ORDER.indexOf(b) - MESES_ORDER.indexOf(a))[0];
      $('last-update-label').textContent =
        mesActual ? `Datos al: ${mesActual} ${state.añoActual}` : `Datos al: ${state.añoActual}`;

      buildSidebar();
      buildZonaTabs();
      render();
      $('loading').classList.add('hidden');
    })
    .catch(err => {
      $('loading').innerHTML = `<p style="color:red">Error cargando datos: ${err.message}</p>`;
    });
});

/* =========================================================
   CONSTRUCCIÓN DE CONTROLES
   ========================================================= */
function buildSidebar() {
  const mesContainer = $('mes-filters');
  mesContainer.innerHTML = '';
  appendFilterButton(mesContainer, 'Todos', 'mes', 'Todos', () => setMes('Todos'));

  MESES_ORDER.forEach(m => {
    appendFilterButton(mesContainer, m, 'mes', m, () => setMes(m));
  });

  const deptoContainer = $('departamento-filters');
  deptoContainer.innerHTML = '';
  appendFilterButton(deptoContainer, 'Todos', 'departamento', 'Todos',
    () => setDepartamento('Todos'));

  const departamentos = new Map();
  state.inventario.forEach(d => {
    const key = normalizarDepto(d.depto);
    if (key && !departamentos.has(key)) departamentos.set(key, d.depto);
  });
  state.data.forEach(d => {
    const key = normalizarDepto(d.depto);
    if (key) departamentos.set(key, d.depto);
  });

  [...departamentos.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .forEach(([key, label]) => {
      appendFilterButton(deptoContainer, label, 'departamento', key,
        () => setDepartamento(key));
    });

  $('departamento-search').addEventListener('input', filterDepartmentOptions);
  updateSelectionButtons('mes-filters', 'mes', state.meses);
  updateSelectionButtons('departamento-filters', 'departamento', state.departamentos);
}

function appendFilterButton(container, label, type, value, onClick) {
  const button = document.createElement('button');
  button.className = 'filter-btn';
  button.textContent = label;
  button.dataset[type] = value;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', onClick);
  container.appendChild(button);
}

function updateSelectionButtons(containerId, type, selected) {
  const allSelected = selected.length === 0;
  $(containerId).querySelectorAll('button').forEach(button => {
    const isAll = button.dataset[type] === 'Todos';
    const active = isAll ? allSelected : selected.includes(button.dataset[type]);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function filterDepartmentOptions() {
  const query = normalizarDepto($('departamento-search').value);
  $('departamento-filters').querySelectorAll('button').forEach(button => {
    button.hidden = button.dataset.departamento !== 'Todos' &&
      !normalizarDepto(button.textContent).includes(query);
  });
}

function buildZonaTabs() {
  const zonas = [...new Set(state.data.map(d => d.zona))].filter(Boolean).sort();
  const container = $('zona-tabs');
  container.innerHTML = '';
  zonas.forEach(z => {
    const btn = document.createElement('button');
    btn.className = 'zona-tab' + (z === state.zona ? ' active' : '');
    btn.textContent = z;
    btn.addEventListener('click', () => setZona(z));
    container.appendChild(btn);
  });
}

/* =========================================================
   FILTROS
   ========================================================= */
function setMes(m) {
  if (m === 'Todos') {
    state.meses = [];
  } else if (state.meses.includes(m)) {
    state.meses = state.meses.filter(mes => mes !== m);
  } else {
    state.meses = [...state.meses, m];
  }
  updateSelectionButtons('mes-filters', 'mes', state.meses);
  render();
}

function setDepartamento(depto) {
  if (depto === 'Todos') {
    state.departamentos = [];
  } else if (state.departamentos.includes(depto)) {
    state.departamentos = state.departamentos.filter(item => item !== depto);
  } else {
    state.departamentos = [...state.departamentos, depto];
  }
  updateSelectionButtons('departamento-filters', 'departamento', state.departamentos);
  render();
}

function setZona(z) {
  state.zona = z;
  document.querySelectorAll('.zona-tab').forEach(b => {
    b.classList.toggle('active', b.textContent === z);
  });
  render();
}

/* =========================================================
   FILTRADO DE DATOS
   ========================================================= */
function filtrar(ano, mes) {
  return state.data.filter(d =>
    d.zona === state.zona &&
    d.ano  === ano &&
    (mes === 'Todos' || d.mes === mes) &&
    (state.meses.length === 0 || state.meses.includes(d.mes)) &&
    (state.departamentos.length === 0 ||
      state.departamentos.includes(normalizarDepto(d.depto)))
  );
}

function filtrarInventario() {
  return state.inventario.filter(d =>
    d.zona === state.zona &&
    (state.departamentos.length === 0 ||
      state.departamentos.includes(normalizarDepto(d.depto)))
  );
}

function sumarInventarioAnimales(rows) {
  const animalesProcesados = new Set();
  let total = 0;

  rows.forEach(d => {
    const codigo = d.cod || `${d.depto}|${d.mcpo}`;
    const keyAnimales = `${codigo}|${d.zonaInv}`;

    if (!animalesProcesados.has(keyAnimales)) {
      total += d.inv || 0;
      animalesProcesados.add(keyAnimales);
    }
  });

  return total;
}

function inventarioSegunMedida(rows) {
  const total = sumarInventarioAnimales(rows);
  return state.zona === 'Vacunación' ? total / 2 : total;
}

/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */
function render() {
  updateZoneLabels();
  const datosCurr = filtrar(state.añoActual, 'Todos');

  renderKPIs(datosCurr);
  renderGauge(datosCurr);
  renderTendencia();
  renderBarras(datosCurr);
  renderTabla(datosCurr);
}

function nombreActividad() {
  return state.zona === 'Identificación'
    ? 'Animales identificados'
    : 'Animales vacunados';
}

function updateZoneLabels() {
  const actividad = nombreActividad();
  $('kpi-actividad-label').textContent = actividad;
  $('barras-titulo').textContent = `Inventario vs. ${actividad} — Top 15 departamentos`;
  $('tabla-animales-header').textContent = actividad;
}

/* =========================================================
   KPIs
   ========================================================= */
function renderKPIs(curr) {
  const inv = inventarioSegunMedida(filtrarInventario());
  const vacun = curr.reduce((s, d) => s + d.vacun, 0);
  const cob   = inv > 0 ? (vacun / inv * 100) : 0;

  $('kpi-inventario').textContent = fmtInventario(inv);
  $('kpi-vacunados').textContent  = fmt(vacun);
  $('kpi-cobertura').textContent  = cob.toFixed(1) + '%';
}

/* =========================================================
   GAUGE
   ========================================================= */
function renderGauge(curr) {
  const inv = inventarioSegunMedida(filtrarInventario());
  const vacun = curr.reduce((s, d) => s + d.vacun, 0);
  const cob   = inv > 0 ? Math.min((vacun / inv * 100), 200) : 0;

  const ctx = $('gaugeChart');
  if (!ctx) return;

  if (chartGauge) chartGauge.destroy();

  // Gauge con doughnut cortado a la mitad
  const pct  = Math.min(cob, 100);
  const rest = 100 - pct;

  chartGauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, rest, 100],   // segmento lleno, vacío, invisible (mitad inferior)
        backgroundColor: [
          cob >= 90 ? '#27ae60' : cob >= 70 ? '#f39c12' : '#2563a8',
          '#dde6f0',
          'transparent'
        ],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      }
    },
    plugins: [{
      id: 'gaugeText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2 + (bottom - top) * 0.15;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 2rem Segoe UI, sans-serif';
        const color = cob >= 90 ? '#27ae60' : cob >= 70 ? '#f39c12' : '#2563a8';
        ctx.fillStyle = color;
        ctx.fillText(cob.toFixed(1) + '%', cx, cy);
        ctx.font = '.7rem Segoe UI, sans-serif';
        ctx.fillStyle = '#7f8c8d';
        ctx.fillText('Cobertura total', cx, cy + 28);
        ctx.restore();
      }
    }]
  });
}

/* =========================================================
   GRÁFICO TENDENCIA (línea comparativa por mes)
   ========================================================= */
function renderTendencia() {
  const ctx = $('tendenciaChart');
  if (!ctx) return;

  // Acumular por mes para cada año
  function porMes(ano) {
    return MESES_ORDER.map(m => {
      const rows = filtrar(ano, m);
      const vacun = rows.reduce((s, d) => s + d.vacun, 0);
      return vacun; // total animales vacunados ese mes
    });
  }

  const dataCurr = porMes(state.añoActual);
  const dataAnt  = porMes(state.añoAnterior);

  if (chartTendencia) chartTendencia.destroy();
  chartTendencia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MESES_ORDER.map(m => m.substring(0,3)),
      datasets: [
        {
          label: String(state.añoAnterior),
          data: dataAnt,
          borderColor: '#4a90d9',
          backgroundColor: 'rgba(74,144,217,.08)',
          borderWidth: 2,
          pointRadius: 4,
          tension: .35,
          fill: true,
        },
        {
          label: String(state.añoActual),
          data: dataCurr,
          borderColor: '#1a3a5c',
          backgroundColor: 'rgba(26,58,92,.10)',
          borderWidth: 2.5,
          pointRadius: 5,
          tension: .35,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)} animales`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => fmtK(v),
            font: { size: 10 }
          }
        },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

/* =========================================================
   GRÁFICO BARRAS HORIZONTALES (Inventario vs Vacunados por depto)
   ========================================================= */
function renderBarras(curr) {
  const ctx = $('barrasChart');
  if (!ctx) return;

  const porDepto = new Map();
  const inventarioProcesado = new Set();
  filtrarInventario()
    .forEach(d => {
      const deptoKey = normalizarDepto(d.depto);
      if (!porDepto.has(deptoKey)) {
        porDepto.set(deptoKey, { depto: d.depto, inv: 0, vacun: 0 });
      }
      const item = porDepto.get(deptoKey);
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      const key = `${codigo}|${d.zonaInv}`;
      if (!inventarioProcesado.has(key)) {
        item.inv += d.inv || 0;
        inventarioProcesado.add(key);
      }
    });

  curr.forEach(d => {
    const deptoKey = normalizarDepto(d.depto);
    if (!porDepto.has(deptoKey)) {
      porDepto.set(deptoKey, { depto: d.depto, inv: 0, vacun: 0 });
    }
    porDepto.get(deptoKey).depto = d.depto;
    porDepto.get(deptoKey).vacun += d.vacun;
  });

  if (state.zona === 'Vacunación') {
    porDepto.forEach(item => { item.inv /= 2; });
  }

  // Ordenar por inventario desc, tomar top 15
  const sorted = [...porDepto.entries()]
    .sort((a, b) => b[1].inv - a[1].inv)
    .slice(0, 15);

  const labels = sorted.map(([, v]) => v.depto);
  const invs   = sorted.map(([, v]) => v.inv);
  const vacuns = sorted.map(([, v]) => v.vacun);

  if (chartBarras) chartBarras.destroy();
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Inventario',
          data: invs,
          backgroundColor: 'rgba(74,144,217,.75)',
          borderRadius: 4,
        },
        {
          label: nombreActividad(),
          data: vacuns,
          backgroundColor: 'rgba(26,58,92,.85)',
          borderRadius: 4,
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${
              ctx.dataset.label === 'Inventario' ? fmtInventario(ctx.raw) : fmt(ctx.raw)
            }`
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => fmtK(v), font: { size: 10 } }
        },
        y: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

function normalizarDepto(depto) {
  return String(depto || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+(ZC|ZE|ZL1|ZL2|DC)$/i, '');
}

/* =========================================================
   TABLA
   ========================================================= */
function renderTabla(curr) {
  const porDepto = new Map();
  const inventarioProcesado = new Set();
  const prediosProcesados = new Set();

  filtrarInventario()
    .forEach(d => {
      const deptoKey = normalizarDepto(d.depto);
      if (!porDepto.has(deptoKey)) {
        porDepto.set(deptoKey, {
          depto: d.depto, inv: 0, vacun: 0, predios: 0, vacPred: 0,
        });
      }
      const item = porDepto.get(deptoKey);
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      const keyInventario = `${codigo}|${d.zonaInv}`;
      if (!inventarioProcesado.has(keyInventario)) {
        item.inv += d.inv || 0;
        inventarioProcesado.add(keyInventario);
      }
    });

  filtrarInventario()
    .forEach(d => {
      const deptoKey = normalizarDepto(d.depto);
      const item = porDepto.get(deptoKey);
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      if (!prediosProcesados.has(codigo)) {
        item.predios += d.predios || 0;
        prediosProcesados.add(codigo);
      }
    });

  curr.forEach(d => {
    const deptoKey = normalizarDepto(d.depto);
    if (!porDepto.has(deptoKey)) {
      porDepto.set(deptoKey, {
        depto: d.depto, inv: 0, vacun: 0, predios: 0, vacPred: 0,
      });
    }
    const item = porDepto.get(deptoKey);
    item.depto = d.depto;
    item.vacun += d.vacun;
    item.vacPred += d.vacPred;
  });

  if (state.zona === 'Vacunación') {
    porDepto.forEach(item => { item.inv /= 2; });
  }

  const rows = [...porDepto.values()]
    .map(v => ({
      ...v,
      cobAnim: v.inv > 0 ? v.vacun / v.inv * 100 : 0,
      cobPred: v.predios > 0 ? v.vacPred / v.predios * 100 : 0,
    }))
    .sort((a, b) => a.depto.localeCompare(b.depto, 'es', {
      sensitivity: 'base',
      numeric: true,
    }));

  const total = rows.reduce((acc, r) => ({
    inv: acc.inv + r.inv,
    vacun: acc.vacun + r.vacun,
    predios: acc.predios + r.predios,
    vacPred: acc.vacPred + r.vacPred,
  }), { inv: 0, vacun: 0, predios: 0, vacPred: 0 });
  total.cobAnim = total.inv > 0 ? total.vacun / total.inv * 100 : 0;
  total.cobPred = total.predios > 0 ? total.vacPred / total.predios * 100 : 0;

  window._tableData = rows;
  drawTable(rows, total);
}

function drawTable(rows, total) {
  const tbody = $('tabla-body');
  if (!tbody) return;

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.depto}</td>
      <td style="text-align:right">${fmtInventario(r.inv)}</td>
      <td style="text-align:right">${fmt(r.vacun)}</td>
      <td>${pctBar(r.cobAnim)}</td>
      <td style="text-align:right">${fmt(r.predios)}</td>
      <td style="text-align:right">${fmt(r.vacPred)}</td>
      <td>${pctBar(r.cobPred)}</td>
    </tr>
  `).join('');

  // Fila total
  const tfoot = $('tabla-foot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="font-weight:700; background:#d6e8f7;">
        <td>TOTAL</td>
        <td style="text-align:right">${fmtInventario(total.inv)}</td>
        <td style="text-align:right">${fmt(total.vacun)}</td>
        <td>${pctBar(total.cobAnim)}</td>
        <td style="text-align:right">${fmt(total.predios)}</td>
        <td style="text-align:right">${fmt(total.vacPred)}</td>
        <td>${pctBar(total.cobPred)}</td>
      </tr>`;
  }
}

// Búsqueda en tabla
function setupSearch() {
  const input = $('tabla-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    const filtered = (window._tableData || []).filter(r =>
      r.depto.toLowerCase().includes(q)
    );
    // Recalcular totales del filtro
    const total = filtered.reduce((acc, r) => ({
      inv:     acc.inv     + r.inv,
      vacun:   acc.vacun   + r.vacun,
      predios: acc.predios + r.predios,
      vacPred: acc.vacPred + r.vacPred,
    }), { inv: 0, vacun: 0, predios: 0, vacPred: 0 });
    total.cobAnim = total.inv > 0 ? total.vacun / total.inv * 100 : 0;
    total.cobPred = total.predios > 0 ? total.vacPred / total.predios * 100 : 0;
    drawTable(filtered, total);
  });
}
document.addEventListener('DOMContentLoaded', setupSearch);

/* =========================================================
   HELPERS
   ========================================================= */
function fmt(n) {
  return Math.round(n).toLocaleString('es-CO');
}

function fmtInventario(n) {
  return Math.round(n).toLocaleString('es-CO');
}

function fmtK(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0)     + 'k';
  return String(n);
}

function pctBar(pct) {
  const p   = Math.min(pct, 100);
  const cls = pct >= 90 ? 'alta' : pct >= 70 ? 'media' : 'baja';
  return `
    <div class="pct-bar">
      <div class="pct-bar-track">
        <div class="pct-bar-fill ${cls}" style="width:${p}%"></div>
      </div>
      <span style="font-size:.75rem;min-width:40px;text-align:right">${pct.toFixed(1)}%</span>
    </div>`;
}
