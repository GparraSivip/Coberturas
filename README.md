# Dashboard Coberturas Sanitarias

Dashboard web para seguimiento de coberturas de vacunación e identificación animal en Colombia.

🔗 **Ver dashboard:** https://GparraSivip.github.io/Coberturas/

---

## Actualización mensual (cada fin de mes)

1. Agrega los nuevos datos en `baseCobertura.xlsx` (hoja `Base`)
2. Mantén junto a esta carpeta los archivos `baseCobertura.xlsx` y `baseInventario.xlsx`.
3. Desde esta carpeta, ejecuta:
   ```
   node actualizar_datos.js
   ```
4. Publica los cambios:
   ```
   git add data/coberturas.json
   git commit -m "Datos <mes> <año>"
   git push
   ```
El dashboard se actualiza automáticamente en ~2 minutos.

---

## Filtros del dashboard

Los filtros de zona (Vacunación / Identificación) y tipo de cobertura (Animales / Predios) actualizan conjuntamente los KPI, gráficos, mapa y tabla. El control dentro del mapa alterna entre cobertura por departamento y por municipio sin cambiar los demás filtros. Al seleccionar un departamento en la vista departamental, el mapa se acerca a sus municipios; usa `Volver a Departamentos` para regresar. Esta exploración solo afecta el mapa. Pasa el cursor sobre una zona para consultar los valores. Los filtros de mes y departamento admiten selección múltiple y se combinan entre sí. Usa `Todos` en cada lista para quitar la selección de ese filtro; el buscador ayuda a encontrar departamentos.

La tabla permite desplegar los municipios de cada departamento en orden alfabético y muestra en paralelo inventario, actividad y cobertura de animales y predios. En Animales, el inventario de Vacunación se divide entre dos por la evaluación semestral; Identificación conserva el inventario anual completo.

---

## Estructura del Excel esperada (hoja `Base`)

| Columna | Descripción |
|---|---|
| `año` | Año numérico (2025, 2026…) |
| `mes` | Nombre del mes (Enero, Febrero…) |
| `zonaOrganizadas` | Vacunación / Identificación |
| `departamento` | Nombre del departamento |
| `nombreMcpo` | Nombre del municipio |
| `existenciasAnimales` | Inventario de animales |
| `existenciaPredios` | Inventario de predios |
| `vacunados ó chapeteados` | Animales tratados |
| `predios` | Predios tratados |

---

## Fuente de inventario

`baseInventario.xlsx` usa la hoja `inventario`:

- Los animales se suman agrupando por `cod_munpio` y `zona`.
- Cada fila representa un predio. Se cuentan filas por `cod_munpio` dentro de cada categoría: `ZC` corresponde a Vacunación y `ZE`, `ZL1` y `ZL2` a Identificación. En total, la fuente contiene 218.118 filas: 177.512 de Vacunación y 40.606 de Identificación.
- El JSON guarda el inventario consolidado separado de las capturas mensuales, por lo que cambiar mes o año no duplica ni reduce el inventario.
- El KPI suma `inventario animales` dentro de la categoría seleccionada. Para Vacunación divide el inventario zonal entre 2 por su evaluación semestral; para Identificación usa el inventario completo por su evaluación anual.

El código municipal se relaciona con `codMcpo` de la hoja `Base`. La zona operativa se relaciona con `zona`, mientras que la pestaña del dashboard usa `zonaOrganizadas` (`Vacunación` o `Identificación`). La hoja `respaldo`, si existe, no se usa.

## Mapa municipal

Los límites departamentales (`data/colombia-departamentos.geojson`) y municipales (`data/municipios.geojson`) provienen de [GeoBoundaries ADM1/ADM2 para Colombia](https://www.geoboundaries.org/), basados en la cartografía del DANE (2020) y distribuidos bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). El archivo municipal está simplificado para su uso en el dashboard. Los nombres se relacionan con el código municipal del inventario y los registros de cobertura. Belén de Bajirá no tiene un polígono independiente en esta versión de los límites y no se representa en el mapa.

---

## Tecnologías

- HTML + CSS + JavaScript puro (sin framework)
- [Chart.js 4](https://www.chartjs.org/) para gráficos
- [SheetJS](https://sheetjs.com/) para leer Excel (solo en el script de actualización)
- GitHub Pages para publicación gratuita
