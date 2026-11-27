# Dashboard Coberturas Sanitarias

Dashboard web para seguimiento de coberturas de vacunación e identificación animal en Colombia.

🔗 **Ver dashboard:** https://GparraSivip.github.io/Coberturas/

---

## Actualización mensual (cada fin de mes)

1. Agrega los nuevos datos en `baseCobertura.xlsx` (hoja `Base`)
2. Desde esta carpeta, ejecuta:
   ```
   node actualizar_datos.js
   ```
3. Publica los cambios:
   ```
   git add data/coberturas.json
   git commit -m "Datos <mes> <año>"
   git push
   ```
El dashboard se actualiza automáticamente en ~2 minutos.

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

## Tecnologías

- HTML + CSS + JavaScript puro (sin framework)
- [Chart.js 4](https://www.chartjs.org/) para gráficos
- [SheetJS](https://sheetjs.com/) para leer Excel (solo en el script de actualización)
- GitHub Pages para publicación gratuita
