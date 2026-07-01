# Notas operativas

- Proyecto estático sin dependencias: `index.html`, `services/sheets.js`, `apps-script/codigo.gs`, `locales/` y archivos de despliegue.
- La única fuente de registros es el Apps Script `/exec` apuntando al Spreadsheet `1fnXiSy1TbPqwlLKDSfPoBfKs8pH0WptoECGq_zu_Lco`.
- No reintroducir archivos locales con registros, datos embebidos ni almacenamiento persistente del navegador para listados o estadísticas.
- Después de cada guardado, la UI debe llamar `cargarTodo()` y volver a pintar desde Google Sheets.
- La búsqueda familiar usa `accion=buscar_familiar` y lee las hojas `personas` o `familiares` si existen.
- La trazabilidad pública usa `accion=seguimiento_factura` por token y solo puede mostrar factura, objetivo, montos, porcentaje, historial financiero, evidencias públicas y estado.
- La hoja `donaciones` pertenece a facturas; los aportes logísticos a transportistas siguen en `donaciones_motorizados`.
- Al cambiar `apps-script/codigo.gs`, desplegar una nueva versión sobre el despliegue existente para conservar la URL `/exec`.
