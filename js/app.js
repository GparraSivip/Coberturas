/* =====================================================================
   app.js  –  Dashboard Coberturas Sanitarias
   Lee data/coberturas.json (generado desde baseCobertura.xlsx)
   ===================================================================== */

// ---- Orden canónico de meses ----
const MESES_ORDER = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ---- Estado global ----
const state = {
  data:        [],     // todos los registros
  zona:        'Vacunación',
  mes:         'Todos',
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
    .then(data => {
      state.data = data;

      // Determinar años presentes
      const years = [...new Set(data.map(d => d.ano))].sort();
      state.añoActual   = years[years.length - 1];
      state.añoAnterior = years.length > 1 ? years[years.length - 2] : years[0];

      const mesActual = [...new Set(
        data.filter(d => d.ano === state.añoActual).map(d => d.mes)
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
  const container = $('mes-filters');
  container.innerHTML = '';

  // Botón "Todos"
  const btn = document.createElement('button');
  btn.className = 'filter-btn active';
  btn.textContent = 'Todos';
  btn.dataset.mes = 'Todos';
  btn.addEventListener('click', () => setMes('Todos'));
  container.appendChild(btn);

  MESES_ORDER.forEach(m => {
    const b = document.createElement('button');
    b.className = 'filter-btn';
    b.textContent = m;
    b.dataset.mes = m;
    b.addEventListener('click', () => setMes(m));
    container.appendChild(b);
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
  state.mes = m;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mes === m);
  });
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
    (mes === 'Todos' || d.mes === mes)
  );
}

/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */
function render() {
  const datosCurr = filtrar(state.añoActual,   state.mes);
  const datosAnt  = filtrar(state.añoAnterior, state.mes);

  renderKPIs(datosCurr, datosAnt);
  renderGauge(datosCurr);
  renderTendencia();
  renderBarras(datosCurr);
  renderTabla(datosCurr);
}

/* =========================================================
   KPIs
   ========================================================= */
function renderKPIs(curr, ant) {
  const inv   = curr.reduce((s, d) => s + d.inv,   0);
  const vacun = curr.reduce((s, d) => s + d.vacun, 0);
  const cob   = inv > 0 ? (vacun / inv * 100) : 0;

  const invAnt   = ant.reduce((s, d) => s + d.inv,   0);
  const vacunAnt = ant.reduce((s, d) => s + d.vacun, 0);

  const delta = vacun - vacunAnt;
  const signo = delta >= 0 ? '+' : '';

  $('kpi-inventario').textContent = fmt(inv);
  $('kpi-vacunados').textContent  = fmt(vacun);
  $('kpi-cobertura').textContent  = cob.toFixed(1) + '%';
  $('kpi-delta').textContent      = signo + fmt(delta);
  $('kpi-delta').style.color      = delta >= 0 ? '#27ae60' : '#2563a8';
  $('kpi-año').textContent = `${state.añoActual} vs ${state.añoAnterior}`;
}

/* =========================================================
   GAUGE
   ========================================================= */
function renderGauge(curr) {
  const inv   = curr.reduce((s, d) => s + d.inv,   0);
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
      const inv   = rows.reduce((s, d) => s + d.inv,   0);
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

  // Agrupar por departamento
  const porDepto = {};
  curr.forEach(d => {
    if (!porDepto[d.depto]) porDepto[d.depto] = { inv: 0, vacun: 0 };
    porDepto[d.depto].inv   += d.inv;
    porDepto[d.depto].vacun += d.vacun;
  });

  // Ordenar por inventario desc, tomar top 15
  const sorted = Object.entries(porDepto)
    .sort((a, b) => b[1].inv - a[1].inv)
    .slice(0, 15);

  const labels = sorted.map(([d]) => d);
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
          label: 'Vacunados',
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
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`
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

/* =========================================================
   TABLA
   ========================================================= */
function renderTabla(curr) {
  // Agrupar por departamento
  const porDepto = {};
  curr.forEach(d => {
    if (!porDepto[d.depto]) porDepto[d.depto] = { inv: 0, vacun: 0, predios: 0, vacPred: 0 };
    porDepto[d.depto].inv     += d.inv;
    porDepto[d.depto].vacun   += d.vacun;
    porDepto[d.depto].predios += d.predios;
    porDepto[d.depto].vacPred += d.vacPred;
  });

  const rows = Object.entries(porDepto)
    .map(([depto, v]) => ({
      depto,
      inv:     v.inv,
      vacun:   v.vacun,
      cobAnim: v.inv > 0 ? v.vacun / v.inv * 100 : 0,
      predios: v.predios,
      vacPred: v.vacPred,
      cobPred: v.predios > 0 ? v.vacPred / v.predios * 100 : 0,
    }))
    .sort((a, b) => b.inv - a.inv);

  // Totales
  const total = rows.reduce((acc, r) => ({
    inv:     acc.inv     + r.inv,
    vacun:   acc.vacun   + r.vacun,
    predios: acc.predios + r.predios,
    vacPred: acc.vacPred + r.vacPred,
  }), { inv: 0, vacun: 0, predios: 0, vacPred: 0 });
  total.cobAnim = total.inv > 0 ? total.vacun / total.inv * 100 : 0;
  total.cobPred = total.predios > 0 ? total.vacPred / total.predios * 100 : 0;

  window._tableData = rows;  // para búsqueda

  drawTable(rows, total);
}

function drawTable(rows, total) {
  const tbody = $('tabla-body');
  if (!tbody) return;

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.depto}</td>
      <td style="text-align:right">${fmt(r.inv)}</td>
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
        <td style="text-align:right">${fmt(total.inv)}</td>
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
