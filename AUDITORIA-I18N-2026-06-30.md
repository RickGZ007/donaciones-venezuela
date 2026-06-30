# Auditoría i18n - 2026-06-30

## Alcance auditado

- `index.html`: navegación, header, hero, dashboard, secciones, filtros, formularios, tarjetas, modales, alertas, validaciones, resultados familiares, navegación móvil y metadatos SEO.
- `services/sheets.js`: sin copy visible de interfaz; se conserva como capa de datos/cache.
- `apps-script/codigo.gs`: respuestas y nombres de columnas forman parte del contrato con Google Sheets; no se modifican para no romper integraciones.
- `data/ejemplo.json` y `data/familiares-ejemplo.json`: datos demo visibles. La UI traduce valores conocidos en tiempo de render sin alterar los archivos fuente.

## Superficies traducidas

- Navegación desktop y mobile.
- Selector de idioma, labels ARIA y textos accesibles.
- Hero, llamadas a la acción y panel operativo.
- Dashboard, estadísticas, resúmenes y fechas relativas.
- Centros de ayuda, hospitales, refugios, necesidades, disponibilidad, categorías, urgencia, unidades y acciones de contacto.
- Formularios de centros, voluntarios, rescatistas, transportistas, trayectos, apoyo logístico y búsqueda familiar.
- Validaciones, errores, confirmaciones, estados de guardado, toasts y banners.
- Modales de historial, trayectos, registro de trayecto, apoyo logístico y transportista.
- Tarjetas de voluntarios, rescatistas, transportistas y familiares.
- SEO internacional: `lang`, title, meta description, Open Graph, Twitter card, JSON-LD y `hreflang`.

## Decisión de compatibilidad

Los valores enviados al backend se mantienen en español cuando son parte del contrato existente (`Centro`, `Hospital`, `Necesita`, `Tiene disponible`, profesiones, especialidades y vehículos). Solo cambia el texto visible. Esto conserva filtros, payloads y compatibilidad con Google Sheets.
