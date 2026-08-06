# Roadmap

## v1.0 (Windows + Microsoft Store)

- ~~Finalizar experiencia base de análisis de disco.~~ ✅
- Smoke test en Windows real (checklist en `docs/windows-validation.md`).
- Publicar instalador de Windows.
- Completar publicación en Microsoft Store.

## v1.0 (macOS)

- ~~Build universal (DMG) y soporte del scanner.~~ ✅
- ~~Correcciones de ventana sin marco, firmlinks APFS y lista de discos.~~ ✅
- Firma y notarización del DMG (requiere Apple Developer ID) para distribuir sin aviso de Gatekeeper.

## v1.1

- ~~Mejoras de rendimiento en escaneo de carpetas grandes.~~ ✅ (árbol superficial + expansión perezosa)
- ~~Mejoras de UX en navegación y filtros.~~ ✅ (top archivos, reescanear, breadcrumbs, toggle de ocultos)
- ~~Acciones sobre archivos (mostrar en carpeta, mover a la papelera).~~ ✅
- Correcciones según feedback inicial de usuarios.

## Futuro

- ~~Modo oscuro.~~ ✅
- ~~Ordenar la lista por columnas (nombre/tamaño).~~ ✅
- ~~Exportación de resultados y reportes.~~ ✅ (CSV/JSON)
- ~~Desglose por categoría de archivo (porcentaje por tipo).~~ ✅
- ~~Buscador global.~~ ✅
- ~~Buscador de duplicados.~~ ✅
- ~~Sugerencias de limpieza (node_modules, dist, .cache, …).~~ ✅
- ~~Selección múltiple y borrado en lote.~~ ✅
- ~~Filtros de exclusión configurables por el usuario.~~ ✅
- Evaluar soporte para más plataformas.
- Auto-actualización (electron-updater) — pendiente de publish/release configurado en GitHub.
- Vista nativa de la papelera de reciclaje (Windows).
- Comparar dos escaneos (snapshots) y ver qué creció.
- Modo CLI/headless para automatizar escaneos y reportes.
