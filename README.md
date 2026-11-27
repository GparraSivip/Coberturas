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

Los filtros de mes y departamento admiten selección múltiple y se combinan entre sí. Usa `Todos` en cada lista para quitar la selección de ese filtro; el buscador ayuda a encontrar departamentos.

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

El código municipal se relaciona con `codMcpo` de la hoja `Base`. La zona operativa se relaciona con `zona`, mientras que la pestaña del dashboard usa `zonaOrganizadas` (`Vacunación` o `Identificación`). La hoja `respaldo`, si existe, no se usa.

---

## Tecnologías

- HTML + CSS + JavaScript puro (sin framework)
- [Chart.js 4](https://www.chartjs.org/) para gráficos
- [SheetJS](https://sheetjs.com/) para leer Excel (solo en el script de actualización)
- GitHub Pages para publicación gratuita
