# GreekDir v1.0 Scope (Windows only)

## Objetivo del release v1.0

Publicar una primera versión estable de GreekDir para Windows que permita analizar uso de disco de forma rápida y visual.

## Incluido en v1.0

- Escaneo de disco con progreso visible.
- Vista de treemap interactivo.
- Lista de archivos/carpetas por tamaño.
- Panel de detalle para elemento seleccionado.
- Build instalable para Windows (`NSIS`).
- Paquete para Microsoft Store (`APPX`).

## No incluido en v1.0

- Soporte oficial para macOS o Linux.
- Sincronización en la nube.
- Exportación avanzada de reportes.
- Sistema de plugins.

## Criterios de salida

- `npm run build:win` genera instalador sin errores.
- `npm run build:store` genera APPX válido con metadatos reales.
- Pruebas manuales básicas completadas en Windows real.
