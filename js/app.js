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
  metrica:     'Animales',
  vistaMapa:   'departamento',
  departamentoMapa: null,
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
let mapaCobertura = null;
let capaCobertura = null;
let geoMunicipios = null;
let geoMunicipiosPromise = null;
let geoDepartamentos = null;
let geoDepartamentosPromise = null;
let mapaVistaActual = null;
let mapaRenderVersion = 0;
let departamentoTablaExpandido = null;

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
      buildMetricaTabs();
      buildMapaTabs();
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

function buildMetricaTabs() {
  document.querySelectorAll('.metrica-tab').forEach(button => {
    button.addEventListener('click', () => setMetrica(button.dataset.metrica));
  });
}

function buildMapaTabs() {
  document.querySelectorAll('.map-view-tab').forEach(button => {
    button.addEventListener('click', () => {
      state.vistaMapa = button.dataset.vistaMapa;
      state.departamentoMapa = null;
      actualizarControlesMapa();
      renderMapa(filtrar(state.añoActual, 'Todos'));
    });
  });

  $('mapa-volver').addEventListener('click', () => {
    state.vistaMapa = 'departamento';
    state.departamentoMapa = null;
    actualizarControlesMapa();
    renderMapa(filtrar(state.añoActual, 'Todos'));
  });
}

function actualizarControlesMapa() {
  const vistaMunicipal = state.vistaMapa === 'municipio';
  const vista = vistaMunicipal ? 'municipio' : 'departamento';
  const sujetos = state.metrica === 'Predios' ? 'predios' : 'animales';

  document.querySelectorAll('.map-view-tab').forEach(tab => {
    const active = tab.dataset.vistaMapa === state.vistaMapa;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });

  $('mapa-titulo').textContent =
    `Mapa de cobertura de ${sujetos} por ${vista}` +
    (state.departamentoMapa ? ` · ${state.departamentoMapa}` : '');
  $('mapaCobertura').setAttribute(
    'aria-label',
    `Mapa de cobertura por ${vista}${state.departamentoMapa ? ` de ${state.departamentoMapa}` : ''}`
  );
  $('mapa-volver').hidden = !state.departamentoMapa;
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

function setMetrica(metrica) {
  state.metrica = metrica;
  document.querySelectorAll('.metrica-tab').forEach(button => {
    const active = button.dataset.metrica === metrica;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
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
  if (state.metrica === 'Predios') {
    const prediosProcesados = new Set();
    return rows.reduce((total, d) => {
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      if (prediosProcesados.has(codigo)) return total;
      prediosProcesados.add(codigo);
      return total + (d.predios || 0);
    }, 0);
  }

  const total = sumarInventarioAnimales(rows);
  return state.zona === 'Vacunación' ? total / 2 : total;
}

/* =========================================================
   RENDER PRINCIPAL
   ========================================================= */
function render() {
  updateDashboardLabels();
  const datosCurr = filtrar(state.añoActual, 'Todos');

  renderKPIs(datosCurr);
  renderGauge(datosCurr);
  renderTendencia();
  renderBarras(datosCurr);
  renderMapa(datosCurr);
  renderTabla(datosCurr);
}

function nombreActividad() {
  if (state.metrica === 'Predios') return 'Predios visitados';
  return state.zona === 'Identificación'
    ? 'Animales identificados'
    : 'Animales vacunados';
}

function nombreInventario() {
  return state.metrica === 'Predios'
    ? 'Predios en inventario'
    : 'Inventario de animales';
}

function valorActividad(registro) {
  return state.metrica === 'Predios' ? registro.vacPred : registro.vacun;
}

function updateDashboardLabels() {
  const actividad = nombreActividad();
  const sujetos = state.metrica === 'Predios' ? 'predios' : 'animales';
  const inventario = nombreInventario();
  $('kpi-inventario-label').textContent = inventario;
  $('kpi-actividad-label').textContent = actividad;
  $('kpi-cobertura-label').textContent = `Cobertura de ${sujetos}`;
  $('gauge-titulo').textContent = `Cobertura nacional de ${sujetos}`;
  $('barras-titulo').textContent = `${inventario} vs. ${actividad} — Top 15 departamentos`;
  $('tendencia-titulo').textContent = `Comparativo mensual — ${actividad}`;
  actualizarControlesMapa();
  const actividadAnimales = state.zona === 'Identificación'
    ? 'Animales identificados'
    : 'Animales vacunados';
  $('tabla-head').innerHTML = `
    <tr>
      <th>Departamento / Municipio</th>
      <th style="text-align:right">Inventario de animales</th>
      <th style="text-align:right">${actividadAnimales}</th>
      <th style="text-align:right">Cobertura de animales (%)</th>
      <th style="text-align:right">Inventario de predios</th>
      <th style="text-align:right">Predios visitados</th>
      <th style="text-align:right">Cobertura de predios (%)</th>
    </tr>`;
}

/* =========================================================
   KPIs
   ========================================================= */
function renderKPIs(curr) {
  const inv = inventarioSegunMedida(filtrarInventario());
  const actividad = curr.reduce((total, registro) => total + valorActividad(registro), 0);
  const cob = inv > 0 ? (actividad / inv * 100) : 0;

  $('kpi-inventario').textContent = fmtInventario(inv);
  $('kpi-vacunados').textContent  = fmt(actividad);
  $('kpi-cobertura').textContent  = cob.toFixed(1) + '%';
}

/* =========================================================
   GAUGE
   ========================================================= */
function renderGauge(curr) {
  const inv = inventarioSegunMedida(filtrarInventario());
  const actividad = curr.reduce((total, registro) => total + valorActividad(registro), 0);
  const cob = inv > 0 ? Math.min((actividad / inv * 100), 200) : 0;

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
        ctx.fillText(`Cobertura de ${state.metrica.toLowerCase()}`, cx, cy + 28);
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
      return rows.reduce((total, registro) => total + valorActividad(registro), 0);
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
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)} ${state.metrica.toLowerCase()}`
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
   GRÁFICO BARRAS HORIZONTALES (Inventario vs actividad por departamento)
   ========================================================= */
function renderBarras(curr) {
  const ctx = $('barrasChart');
  if (!ctx) return;

  const porDepto = new Map();
  const inventarioAnimalesProcesado = new Set();
  const inventarioPrediosProcesado = new Set();
  const esAnimales = state.metrica === 'Animales';

  filtrarInventario().forEach(d => {
    const deptoKey = normalizarDepto(d.depto);
    if (!porDepto.has(deptoKey)) {
      porDepto.set(deptoKey, { depto: d.depto, inventario: 0, actividad: 0 });
    }
    const item = porDepto.get(deptoKey);
    const codigo = d.cod || `${d.depto}|${d.mcpo}`;
    if (esAnimales) {
      const key = `${codigo}|${d.zonaInv}`;
      if (!inventarioAnimalesProcesado.has(key)) {
        item.inventario += d.inv || 0;
        inventarioAnimalesProcesado.add(key);
      }
    } else if (!inventarioPrediosProcesado.has(codigo)) {
      item.inventario += d.predios || 0;
      inventarioPrediosProcesado.add(codigo);
    }
  });

  curr.forEach(d => {
    const deptoKey = normalizarDepto(d.depto);
    if (!porDepto.has(deptoKey)) {
      porDepto.set(deptoKey, { depto: d.depto, inventario: 0, actividad: 0 });
    }
    const item = porDepto.get(deptoKey);
    item.depto = d.depto;
    item.actividad += valorActividad(d);
  });

  if (esAnimales && state.zona === 'Vacunación') {
    porDepto.forEach(item => { item.inventario /= 2; });
  }

  // Ordenar por inventario desc, tomar top 15
  const sorted = [...porDepto.entries()]
    .sort((a, b) => b[1].inventario - a[1].inventario)
    .slice(0, 15);

  const labels = sorted.map(([, v]) => v.depto);
  const inventarios = sorted.map(([, v]) => v.inventario);
  const actividades = sorted.map(([, v]) => v.actividad);

  if (chartBarras) chartBarras.destroy();
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: nombreInventario(),
          data: inventarios,
          backgroundColor: 'rgba(74,144,217,.75)',
          borderRadius: 4,
        },
        {
          label: nombreActividad(),
          data: actividades,
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
              ctx.dataset.label === nombreInventario() ? fmtInventario(ctx.raw) : fmt(ctx.raw)
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

/* =========================================================
   MAPA DE CALOR MUNICIPAL
   ========================================================= */
function renderMapa(curr) {
  const mapa = $('mapaCobertura');
  const leyenda = $('mapaLeyenda');
  if (!mapa || !leyenda || typeof L === 'undefined') return;
  const renderVersion = ++mapaRenderVersion;
  const vista = state.vistaMapa;
  const vistaMunicipal = vista === 'municipio';

  const porMunicipio = new Map();
  const municipiosPorNombre = new Map();
  const inventarioAnimalesProcesado = new Set();
  const inventarioPrediosProcesado = new Set();
  const municipioPorCodigo = new Map();
  const esAnimales = state.metrica === 'Animales';

  state.data.forEach(d => {
    if (d.cod) {
      municipioPorCodigo.set(String(d.cod), {
        depto: d.depto,
        mcpo: d.mcpo,
      });
    }
  });

  function obtenerMunicipio(depto, mcpo) {
    const nombre = normalizarMunicipio(mcpo);
    const key = `${normalizarDepto(depto)}|${nombre}`;
    if (!porMunicipio.has(key)) {
      porMunicipio.set(key, {
        depto: normalizarDepto(depto),
        municipio: nombre,
        actividad: 0,
        inventario: 0,
      });
    }
    return porMunicipio.get(key);
  }

  filtrarInventario().forEach(d => {
    const ubicacion = municipioPorCodigo.get(String(d.cod));
    if (!ubicacion) return;
    const item = obtenerMunicipio(ubicacion.depto, ubicacion.mcpo);
    const codigo = d.cod || `${d.depto}|${d.mcpo}`;

    if (esAnimales) {
      const claveInventario = `${codigo}|${d.zonaInv}`;
      if (!inventarioAnimalesProcesado.has(claveInventario)) {
        item.inventario += d.inv || 0;
        inventarioAnimalesProcesado.add(claveInventario);
      }
    } else if (!inventarioPrediosProcesado.has(codigo)) {
      item.inventario += d.predios || 0;
      inventarioPrediosProcesado.add(codigo);
    }
  });

  curr.forEach(d => {
    obtenerMunicipio(d.depto, d.mcpo).actividad += valorActividad(d);
  });

  if (esAnimales && state.zona === 'Vacunación') {
    porMunicipio.forEach(item => { item.inventario /= 2; });
  }

  const porDepartamento = new Map();
  porMunicipio.forEach(item => {
    if (!porDepartamento.has(item.depto)) {
      porDepartamento.set(item.depto, {
        depto: item.depto,
        actividad: 0,
        inventario: 0,
      });
    }
    const departamento = porDepartamento.get(item.depto);
    departamento.actividad += item.actividad;
    departamento.inventario += item.inventario;
  });

  porMunicipio.forEach(item => {
    if (!municipiosPorNombre.has(item.municipio)) {
      municipiosPorNombre.set(item.municipio, []);
    }
    municipiosPorNombre.get(item.municipio).push(item);
  });

  leyenda.innerHTML = `
    <span class="map-legend-item"><span class="map-legend-swatch" style="background:#cde4f7"></span>0–25%</span>
    <span class="map-legend-item"><span class="map-legend-swatch" style="background:#83b5df"></span>25–50%</span>
    <span class="map-legend-item"><span class="map-legend-swatch" style="background:#4a90d9"></span>50–75%</span>
    <span class="map-legend-item"><span class="map-legend-swatch" style="background:#2563a8"></span>75–90%</span>
    <span class="map-legend-item"><span class="map-legend-swatch" style="background:#27ae60"></span>≥90%</span>
  `;

  function dibujarMapa(geojson) {
    if (!mapaCobertura) {
      mapa.innerHTML = '';
      mapaCobertura = L.map(mapa, {
        scrollWheelZoom: true,
        attributionControl: false,
        zoomControl: true,
        minZoom: 4,
        maxZoom: 10,
      });
    }

    if (capaCobertura) mapaCobertura.removeLayer(capaCobertura);

    capaCobertura = L.geoJSON(geojson, {
      style(feature) {
        const { deptoKey, item } = obtenerDatosFeature(feature);
        const cobertura = item && item.inventario > 0
          ? item.actividad / item.inventario * 100
          : null;
        const seleccionado = state.departamentos.length === 0 ||
          state.departamentos.includes(deptoKey);

        return {
          fillColor: seleccionado ? colorCobertura(cobertura) : '#edf2f7',
          weight: vistaMunicipal ? .55 : 1.1,
          opacity: 1,
          color: '#526477',
          fillOpacity: seleccionado && cobertura != null ? 0.9 : 0.48,
        };
      },
      onEachFeature(feature, layer) {
        const nombreGeo = feature.properties.shapeName || 'Municipio';
        const { departamento, item } = obtenerDatosFeature(feature);
        const cobertura = item && item.inventario > 0
          ? item.actividad / item.inventario * 100
          : null;

        const detalle = document.createElement('div');
        const titulo = document.createElement('strong');
        titulo.textContent = vistaMunicipal
          ? `${nombreGeo} · ${departamento}`
          : nombreGeo;
        detalle.appendChild(titulo);
        const porcentaje = document.createElement('div');
        porcentaje.textContent = `Cobertura: ${cobertura == null ? 'Sin datos' : cobertura.toFixed(1) + '%'}`;
        detalle.appendChild(porcentaje);
        if (item) {
          const actividad = document.createElement('div');
          actividad.textContent = `${nombreActividad()}: ${fmt(item.actividad)}`;
          detalle.appendChild(actividad);
          const inventario = document.createElement('div');
          inventario.textContent = `${nombreInventario()}: ${fmt(item.inventario)}`;
          detalle.appendChild(inventario);
        }

        layer.bindTooltip(detalle, {
          className: vistaMunicipal ? 'municipio-tooltip' : 'departamento-tooltip',
          sticky: true,
        });

        if (!vistaMunicipal) {
          layer.on('click', () => {
            state.vistaMapa = 'municipio';
            state.departamentoMapa = nombreGeo;
            actualizarControlesMapa();
            renderMapa(curr);
          });
        }
      }
    }).addTo(mapaCobertura);

    const vistaKey = `${vista}|${state.departamentoMapa || ''}`;
    const bounds = capaCobertura.getBounds();
    if (vistaKey !== mapaVistaActual && bounds.isValid()) {
      mapaCobertura.fitBounds(bounds, { padding: [12, 12] });
      mapaVistaActual = vistaKey;
    }
  }

  function buscarMunicipioUnico(nombre) {
    const coincidencias = municipiosPorNombre.get(nombre) || [];
    return coincidencias.length === 1 ? coincidencias[0] : null;
  }

  function obtenerDatosFeature(feature) {
    const departamento = vistaMunicipal
      ? feature.properties.department || ''
      : feature.properties.shapeName || '';
    const deptoKey = normalizarDepto(departamento);
    const municipioKey = normalizarMunicipio(feature.properties.shapeName);
    const item = vistaMunicipal
      ? porMunicipio.get(`${deptoKey}|${municipioKey}`) || buscarMunicipioUnico(municipioKey)
      : porDepartamento.get(deptoKey);
    return { departamento, deptoKey, item };
  }

  let geojson = vistaMunicipal ? geoMunicipios : geoDepartamentos;
  if (geojson) {
    if (vistaMunicipal && state.departamentoMapa) {
      const departamentoKey = normalizarDepto(state.departamentoMapa);
      geojson = {
        ...geojson,
        features: geojson.features.filter(feature =>
          normalizarDepto(feature.properties.department) === departamentoKey
        ),
      };
    }
    dibujarMapa(geojson);
    return;
  }

  let geojsonPromise;
  if (vistaMunicipal) {
    if (!geoMunicipiosPromise) {
      geoMunicipiosPromise = fetch('data/municipios.geojson')
        .then(response => {
          if (!response.ok) throw new Error(`No se pudo cargar el mapa (${response.status})`);
          return response.json();
        })
        .then(data => {
          geoMunicipios = data;
          return data;
        });
    }
    geojsonPromise = geoMunicipiosPromise;
  } else {
    if (!geoDepartamentosPromise) {
      geoDepartamentosPromise = fetch('data/colombia-departamentos.geojson')
        .then(response => {
          if (!response.ok) throw new Error(`No se pudo cargar el mapa (${response.status})`);
          return response.json();
        })
        .then(data => {
          geoDepartamentos = data;
          return data;
        });
    }
    geojsonPromise = geoDepartamentosPromise;
  }

  geojsonPromise
      .then(geojson => {
        if (renderVersion !== mapaRenderVersion) return;
        if (vistaMunicipal && state.departamentoMapa) {
          const departamentoKey = normalizarDepto(state.departamentoMapa);
          geojson = {
            ...geojson,
            features: geojson.features.filter(feature =>
              normalizarDepto(feature.properties.department) === departamentoKey
            ),
          };
        }
        dibujarMapa(geojson);
      })
      .catch(error => {
        if (renderVersion === mapaRenderVersion) mapa.textContent = error.message;
      });
}

function colorCobertura(valor) {
  if (valor == null) return '#edf2f7';
  if (valor >= 90) return '#27ae60';
  if (valor >= 75) return '#2563a8';
  if (valor >= 50) return '#4a90d9';
  if (valor >= 25) return '#83b5df';
  return '#cde4f7';
}

function normalizarDepto(depto) {
  let valor = String(depto || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.]/g, '')
    .replace(/\s+(ZC|ZE|ZL1|ZL2|DC)$/i, '');

  if (/^BOGOTA/.test(valor)) return 'BOGOTA';
  if (/^SAN ANDRES/.test(valor)) return 'SAN ANDRES';
  if (/^ARCHIPIELAGO DE SAN ANDRES/.test(valor)) return 'SAN ANDRES';
  return valor;
}

function normalizarMunicipio(municipio) {
  const valor = String(municipio || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(ZC|ZE|ZL1|ZL2|DC)$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+D\.?\s*C\.?$/i, '')
    .replace(/\bD\s*C\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
  const equivalencias = {
    BECERRIL: 'BECERRILL',
    SANJOSEDEFRAGUA: 'SANJOSEDELFRAGUA',
    SANANDRESDECUERQUIA: 'SANANDRES',
    ITSMINA: 'ISTMINA',
    CARTAGENA: 'CARTAGENADEINDIAS',
    ELCARMEN: 'ELCARMENDECHUCURI',
    TIQUISIO: 'TIQUISO',
    COLOSO: 'RICAURTE',
    SINCE: 'SANLUISDESINCE',
    TOLU: 'SANTIAGODETOLU',
    PIJINO: 'PIJINODELCARMEN',
    SANSEBASTIANBUENAVISTA: 'SANSEBASTIANDEBUENAVISTA',
    MARIQUITA: 'SANSEBASTIANDEMARIQUITA',
    BARRANQUILLA: 'DISTRITOESPECIALINDUSTRIALYPORTUARIODEBARR',
    SANPEDRODELOSMILAGROS: 'SANPEDRO',
    ELTABLON: 'ELTABLONDEGOMEZ',
    SANANTONIODETEQUENDAMA: 'SANANTONIODELTEQUENDAMA',
    LAURIBE: 'URIBE',
    JORDAN: 'JORDANSUBE',
    PUEBLORICO: 'PUEBLORRICO',
    ELPENOL: 'PENOL',
    CANTONDELSANPABLO: 'ELCANTONDELSANPABLO',
    COLONPUTUMAYO: 'COLON',
  };
  return equivalencias[valor] || valor;
}

/* =========================================================
   TABLA
   ========================================================= */
function renderTabla(curr) {
  const porDepto = new Map();
  const inventarioProcesado = new Set();
  const prediosProcesados = new Set();
  const municipioPorCodigo = new Map();

  state.data.forEach(d => {
    if (d.cod) {
      municipioPorCodigo.set(String(d.cod), {
        depto: d.depto,
        mcpo: d.mcpo,
      });
    }
  });

  function obtenerDepartamento(depto) {
    const deptoKey = normalizarDepto(depto);
    if (!porDepto.has(deptoKey)) {
      porDepto.set(deptoKey, {
        depto, inv: 0, vacun: 0, predios: 0, vacPred: 0, municipios: new Map(),
      });
    }
    return porDepto.get(deptoKey);
  }

  function obtenerMunicipio(depto, mcpo, cod) {
    const departamento = obtenerDepartamento(depto);
    const municipioKey = String(cod || normalizarMunicipio(mcpo));
    if (!departamento.municipios.has(municipioKey)) {
      departamento.municipios.set(municipioKey, {
        mcpo: String(mcpo || '').replace(/\s+(ZC|ZE|ZL1|ZL2)$/i, '').trim(),
        inv: 0, vacun: 0, predios: 0, vacPred: 0,
      });
    }
    return departamento.municipios.get(municipioKey);
  }

  filtrarInventario()
    .forEach(d => {
      const item = obtenerDepartamento(d.depto);
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      const keyInventario = `${codigo}|${d.zonaInv}`;
      if (!inventarioProcesado.has(keyInventario)) {
        item.inv += d.inv || 0;
        const ubicacion = municipioPorCodigo.get(String(d.cod));
        if (ubicacion) {
          obtenerMunicipio(ubicacion.depto, ubicacion.mcpo, d.cod).inv += d.inv || 0;
        }
        inventarioProcesado.add(keyInventario);
      }
    });

  filtrarInventario()
    .forEach(d => {
      const item = obtenerDepartamento(d.depto);
      const codigo = d.cod || `${d.depto}|${d.mcpo}`;
      if (!prediosProcesados.has(codigo)) {
        item.predios += d.predios || 0;
        const ubicacion = municipioPorCodigo.get(String(d.cod));
        if (ubicacion) {
          obtenerMunicipio(ubicacion.depto, ubicacion.mcpo, d.cod).predios += d.predios || 0;
        }
        prediosProcesados.add(codigo);
      }
    });

  curr.forEach(d => {
    const item = obtenerDepartamento(d.depto);
    item.depto = d.depto;
    item.vacun += d.vacun;
    item.vacPred += d.vacPred;
    const municipio = obtenerMunicipio(d.depto, d.mcpo, d.cod);
    municipio.vacun += d.vacun;
    municipio.vacPred += d.vacPred;
  });

  if (state.zona === 'Vacunación') {
    porDepto.forEach(item => {
      item.inv /= 2;
      item.municipios.forEach(municipio => { municipio.inv /= 2; });
    });
  }

  const rows = [...porDepto.entries()]
    .map(([deptoKey, v]) => ({
      ...v,
      deptoKey,
      municipios: [...v.municipios.values()]
        .map(municipio => ({
          ...municipio,
          cobAnim: municipio.inv > 0 ? municipio.vacun / municipio.inv * 100 : 0,
          cobPred: municipio.predios > 0 ? municipio.vacPred / municipio.predios * 100 : 0,
        }))
        .sort((a, b) => a.mcpo.localeCompare(b.mcpo, 'es', {
          sensitivity: 'base',
          numeric: true,
        })),
      cobAnim: v.inv > 0 ? v.vacun / v.inv * 100 : 0,
      cobPred: v.predios > 0 ? v.vacPred / v.predios * 100 : 0,
    }))
    .sort((a, b) => a.depto.localeCompare(b.depto, 'es', {
      sensitivity: 'base',
      numeric: true,
    }));

  if (!rows.some(row => row.deptoKey === departamentoTablaExpandido)) {
    departamentoTablaExpandido = null;
  }

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

  tbody.innerHTML = rows.map((r, index) => {
    const expandido = departamentoTablaExpandido === r.deptoKey;
    const filaDepartamento = `
      <tr>
        <td>
          <button type="button" class="table-expand-button" data-depto-index="${index}"
                  aria-expanded="${expandido}"
                  aria-label="${expandido ? 'Ocultar' : 'Mostrar'} municipios de ${r.depto}">
            <span class="table-expand-icon" aria-hidden="true">${expandido ? '−' : '+'}</span>
            <span>${r.depto}</span>
          </button>
        </td>
        <td style="text-align:right">${fmtInventario(r.inv)}</td>
        <td style="text-align:right">${fmt(r.vacun)}</td>
        <td>${pctBar(r.cobAnim)}</td>
        <td style="text-align:right">${fmtInventario(r.predios)}</td>
        <td style="text-align:right">${fmt(r.vacPred)}</td>
        <td>${pctBar(r.cobPred)}</td>
      </tr>`;
    if (!expandido) return filaDepartamento;

    const filasMunicipios = r.municipios.map(municipio => `
      <tr class="table-municipality-row">
        <td>${municipio.mcpo}</td>
        <td style="text-align:right">${fmtInventario(municipio.inv)}</td>
        <td style="text-align:right">${fmt(municipio.vacun)}</td>
        <td>${pctBar(municipio.cobAnim)}</td>
        <td style="text-align:right">${fmtInventario(municipio.predios)}</td>
        <td style="text-align:right">${fmt(municipio.vacPred)}</td>
        <td>${pctBar(municipio.cobPred)}</td>
      </tr>
    `).join('');
    return filaDepartamento + filasMunicipios;
  }).join('');

  tbody.querySelectorAll('.table-expand-button').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.deptoIndex);
      const row = rows[index];
      if (!row) return;
      departamentoTablaExpandido =
        departamentoTablaExpandido === row.deptoKey ? null : row.deptoKey;
      drawTable(rows, total);
      const focusedButton = tbody.querySelector(
        `.table-expand-button[data-depto-index="${index}"]`
      );
      if (focusedButton) focusedButton.focus();
    });
  });

  // Fila total
  const tfoot = $('tabla-foot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="font-weight:700; background:#d6e8f7;">
        <td>TOTAL</td>
        <td style="text-align:right">${fmtInventario(total.inv)}</td>
        <td style="text-align:right">${fmt(total.vacun)}</td>
        <td>${pctBar(total.cobAnim)}</td>
        <td style="text-align:right">${fmtInventario(total.predios)}</td>
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
