# Arquitectura

## Flujo principal

1. `index.html` carga `services/sheets.js`.
2. `services/sheets.js` consulta exclusivamente el Apps Script `/exec` configurado.
3. `apps-script/codigo.gs` abre el Spreadsheet por ID mediante `getSpreadsheet()`.
4. Las respuestas JSON reconstruyen listados, contadores, filtros, prioridades y estadísticas.
5. Después de cada escritura, el frontend vuelve a leer Google Sheets y renderiza desde esa respuesta.

## Backend

`apps-script/codigo.gs` expone:

- `doGet`: lecturas y escrituras verificables desde el navegador estático.
- `doPost`: compatibilidad para clientes servidor-servidor o llamadas directas.
- `getSheet()`: acceso explícito a la hoja `lugares` del Spreadsheet principal.
- `sincronizarRegistrosLugares(payload)`: inserta registros faltantes evitando duplicados por `nombre + insumo + estado`.
- `buscarFamiliares(params)`: busca en `personas` o `familiares` dentro del mismo Spreadsheet.
- `registrarFactura(payload)`: crea factura con número `FAC-AAAA-000001` y token público no secuencial.
- `registrarDonacionFactura(payload)`: guarda la donación asociada a factura y actualiza el monto recaudado cuando está confirmada.
- `registrarMovimientoFactura(payload)`: agrega movimientos financieros a la factura.
- `registrarEvidenciaFactura(payload)`: registra evidencia pública asociada.
- `obtenerSeguimientoFactura(params)`: devuelve solo datos públicos por token.

## Fuente única

No hay registros embebidos, archivos locales de datos, almacenamiento persistente del navegador ni endpoint externo para información operativa. Las opciones estáticas que quedan en HTML son controles de interfaz, no registros.

## Escrituras

El frontend llama `SheetsService.post(payload)`. El servicio construye una URL con `accion` y parámetros, lee la respuesta JSON del Apps Script y lanza error si el backend responde `error`, `success:false` o `exito:false`.

Acciones cubiertas:

- `registrar_lugar`
- `registrar_voluntario`
- `registrar_rescatista`
- `registrar_motorizado`
- `registrar_trayecto`
- `donar_motorizado`
- `buscar_familiar`
- `crear_factura` / `registrar_factura`
- `registrar_donacion` / `registrar_donacion_factura`
- `registrar_movimiento_factura`
- `registrar_evidencia` / `registrar_evidencia_factura`
- `seguimiento_factura` / `seguimiento_token` / `trazabilidad`

## Trazabilidad financiera

El módulo público de seguimiento se consulta con `?token=DV-XXXX-XXXX-XXXX` o `#seguimiento/DV-XXXX-XXXX-XXXX`. El frontend llama a Apps Script y renderiza únicamente:

- factura, objetivo y descripción pública;
- monto requerido, monto recaudado y porcentaje completado;
- historial financiero publicado;
- evidencias públicas;
- estado actual.

Los datos de donante, referencia de pago y cualquier dato operativo quedan en Google Sheets y no se devuelven en el endpoint público. El backend además sanitiza texto público para redactar correos, teléfonos, coordenadas y referencias bancarias si fueran escritos por error en campos visibles.

Hojas financieras inicializadas por Apps Script:

- `facturas`
- `donaciones`
- `movimientos_factura`
- `evidencias`

## Integridad

`registrarLugar` y `sincronizarRegistrosLugares` usan la misma clave única:

```text
nombre + insumo + estado
```

Si una clave ya existe, no se inserta otra fila.
