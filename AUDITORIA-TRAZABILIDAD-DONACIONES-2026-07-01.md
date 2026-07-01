# Auditoria de trazabilidad de donaciones

Fecha: 2026-07-01

## Resultado

La aplicacion queda integrada con una sola fuente operativa: Google Sheets mediante el Apps Script publicado. Si Apps Script no responde, el frontend muestra error y no pinta registros alternativos.

Nota de despliegue: al verificar la URL actual del Apps Script, la respuesta fue HTML de inicio de sesion de Google en lugar de JSON. El codigo esta preparado para produccion, pero el despliegue de Apps Script debe publicarse con acceso anonimo al web app para que el frontend pueda consultar Sheets.

## Archivos modificados

- `apps-script/codigo.gs`
- `services/sheets.js`
- `index.html`
- `locales/es.json`
- `locales/en.json`
- `locales/fr.json`
- `README.md`
- `README-ARQUITECTURA.md`
- `CLAUDE.md`
- `AGENTS.md`

Tambien se retiraron archivos locales de registros operativos y reportes antiguos que conservaban referencias historicas obsoletas.

## Errores encontrados

- Existian rutas de lectura que podian terminar mostrando registros no remotos.
- La trazabilidad financiera no tenia hojas dedicadas ni endpoint publico por token.
- La hoja `donaciones` no estaba disponible para facturas porque el flujo de transportistas ocupaba ese nombre internamente.
- El backend necesitaba un acceso unico y explicito al Spreadsheet por ID.
- La UI no tenia una pagina publica para consultar factura, avance financiero, historial y evidencias.
- Un texto visible heredado contenia un contacto no oficial; fue reemplazado por una nota de publicacion pendiente.

## Errores corregidos

- `services/sheets.js` devuelve listas vacias con estado de error cuando no hay respuesta real de Apps Script.
- `apps-script/codigo.gs` usa `getSpreadsheet()` y `SpreadsheetApp.openById(SHEET_ID)` como acceso unico.
- Se separo `donaciones_motorizados` de la nueva hoja financiera `donaciones`.
- Se agregaron las hojas `facturas`, `donaciones`, `movimientos_factura` y `evidencias` con inicializacion automatica.
- Se agrego generacion y validacion de token publico no secuencial con formato `DV-XXXX-XXXX-XXXX`.
- Se agrego seguimiento publico por `?token=` y por `#seguimiento/TOKEN`.
- El endpoint publico redacta correos, telefonos, coordenadas y referencias bancarias si esos valores llegan por error en campos publicos.

## Antes y despues

Antes:

```js
// Si la consulta remota fallaba, la UI podia terminar con registros no remotos.
return obtenerRegistrosAlternativos();
```

Despues:

```js
async function getAll() {
  try {
    const data = await fetchJson(withQuery('', {}));
    return { data: normalizeAll(data), source: 'live' };
  } catch (err) {
    return { data: emptyAll(), source: 'error', error: err };
  }
}
```

Antes:

```js
// La hoja de aportes logisticos ocupaba el nombre reservado para facturas.
const hojaAportes = 'donaciones';
```

Despues:

```js
const DONACIONES_MOTORIZADOS_SHEET = "donaciones_motorizados";
const DONACIONES_SHEET = "donaciones";
```

Antes:

```js
// No existia consulta publica por token de factura.
```

Despues:

```js
if (accion === "seguimiento_factura" || accion === "seguimiento_token" || accion === "trazabilidad") {
  return obtenerSeguimientoFactura(params);
}
```

## Nuevas funciones Apps Script

- `getSpreadsheet()`
- `normalizarTokenPublico(valor)`
- `tokenFacturaValido(token)`
- `generarTokenPublico()`
- `generarNumeroFactura()`
- `registrarFactura(payload)`
- `registrarDonacionFactura(payload)`
- `registrarMovimientoFactura(payload)`
- `registrarEvidenciaFactura(payload)`
- `listarFacturas()`
- `obtenerSeguimientoFactura(params)`
- `textoPublico(valor)`

## Nuevos endpoints

- `crear_factura`
- `registrar_factura`
- `registrar_donacion`
- `registrar_donacion_factura`
- `registrar_movimiento_factura`
- `registrar_evidencia`
- `registrar_evidencia_factura`
- `seguimiento_factura`
- `seguimiento_token`
- `trazabilidad`
- `facturas`

## Nuevas hojas de Google Sheets

### facturas

`id`, `numero_factura`, `token_publico`, `objetivo`, `descripcion`, `monto_requerido`, `monto_recaudado`, `estado`, `fecha_creacion`, `fecha_cierre`

### donaciones

`id`, `factura_id`, `nombre_donante`, `monto`, `referencia_pago`, `fecha`, `estado`

### movimientos_factura

`id`, `factura_id`, `tipo`, `descripcion`, `monto`, `fecha`

### evidencias

`id`, `factura_id`, `archivo`, `descripcion`, `fecha`

## Pagina de seguimiento por token

La vista `seguimiento` en `index.html` permite consultar:

- factura y token publico;
- objetivo y descripcion publica;
- monto requerido y monto recaudado;
- porcentaje completado;
- historial financiero;
- evidencias publicas;
- estado actual.

La pagina no renderiza telefonos, correos, coordenadas, nombres de voluntarios, nombres de rescatistas, centros internos, depositos, referencias bancarias ni datos operativos.

## Arquitectura final

`index.html` solo habla con `services/sheets.js`. Ese servicio solo habla con Apps Script. Apps Script solo abre el Spreadsheet configurado por ID. El frontend operativo sigue cargando lugares, voluntarios, rescatistas, transportistas y busqueda familiar. La trazabilidad financiera queda aislada en hojas propias y se expone al publico unicamente mediante token.
