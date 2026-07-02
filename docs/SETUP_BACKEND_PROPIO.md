# Configurar tu propio backend de pruebas (Google Sheets + Apps Script)

Guía para que tu fork apunte a **tu propio** Sheet y Apps Script, y puedas
experimentar (panel de centros, nuevos endpoints) sin tocar el backend del
proyecto original.

## Por qué lo necesitas

El `APPS_SCRIPT_URL` del código apunta al despliegue del autor original. Tú no
puedes desplegar cambios de backend ahí (ni deberías experimentar sobre datos
reales de una emergencia). Con tu propio Sheet + Script tienes un entorno de
pruebas completo y gratuito.

## Pasos (una sola vez, ~15 minutos)

### 1. Crear tu Google Sheet

1. Entra a https://sheets.new con tu cuenta de Google.
2. Ponle nombre, p. ej. `donaciones-venezuela-DEV`.
3. Copia el **ID** del Sheet de la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE-ID-LARGO`**`/edit`
4. No hace falta crear hojas ni columnas: el backend crea las hojas que
   necesita automáticamente (`asegurarHoja`) la primera vez que se usan.

### 2. Crear el proyecto de Apps Script

1. Entra a https://script.new (se abre un editor de Apps Script).
2. Ponle nombre, p. ej. `donaciones-backend-DEV`.
3. Borra el contenido del archivo `Código.gs` que viene por defecto.
4. Copia TODO el contenido de `apps-script/codigo.gs` de tu repo y pégalo ahí.
5. Menú **Archivo → Nuevo → Archivo de secuencia de comandos**, nómbralo
   `panel-centros` y pega el contenido de `apps-script/panel-centros.gs`.
6. En el `codigo.gs` pegado, busca la línea del `SHEET_ID` (al inicio):
   ```js
   const SHEET_ID = '...';
   ```
   y reemplaza el valor por **el ID de TU Sheet** del paso 1.

### 3. Desplegar como aplicación web

1. Botón **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - Ejecutar como: **Yo** (tu cuenta)
   - Quién tiene acceso: **Cualquier usuario** (necesario para que el
     frontend pueda llamarlo sin login de Google)
4. **Implementar** → autoriza los permisos cuando lo pida.
5. Copia la **URL de la aplicación web** (termina en `/exec`).

### 4. Apuntar tu frontend a TU backend

En `js/app.js`, busca la constante `APPS_SCRIPT_URL` (al inicio del archivo,
sección CONFIGURACIÓN) y reemplaza la URL por la tuya del paso 3.

> Sugerencia: haz este cambio en una rama local de pruebas y NO lo mezcles a
> `main` si quieres conservar la opción de volver al backend original.

### 5. Probar que funciona

Con tu URL `/exec`, abre en el navegador:

```
TU_URL/exec?accion=estadisticas
```

Debería responder JSON (aunque con datos vacíos al principio). Si responde,
tu backend está vivo.

## Probar el Paso A del panel (registrar un centro)

Abre en el navegador (o con curl):

```
TU_URL/exec?accion=registrar_centro_panel&nombre=Hospital%20Prueba&telefono=04121234567&pin=1234
```

Respuesta esperada:

```json
{
  "success": true,
  "id_centro": "CEN...",
  "token_centro": "CTR-XXXX-XXXX-XXXX",
  "panel_hash": "#centro/CTR-XXXX-XXXX-XXXX",
  "mensaje": "Centro registrado. Guarda tu enlace y tu PIN..."
}
```

Verifica en tu Sheet: debe existir la hoja `centros_panel` con la fila nueva,
y en la columna `pin_hash` verás una cadena hexadecimal de 64 caracteres —
**nunca el PIN en claro**. Eso confirma que el hash funciona.

Prueba también los errores:
- Repetir el mismo nombre → `"Ya existe un centro registrado con ese nombre"`.
- PIN con letras o corto (`pin=12`) → error de formato.

## Cambios futuros en el backend

Cada vez que edites los `.gs` en tu repo, repite: copiar/pegar el archivo en el
editor de Apps Script → **Implementar → Administrar implementaciones → editar
(lápiz) → Nueva versión → Implementar**. (Existe una vía automatizada con
`clasp` — ver `scripts/` — pero requiere configurar credenciales; el
copy-paste es suficiente para experimentar.)
