# Windows validation runbook

Este documento registra la validación real en Windows antes de publicar.

## Entorno de prueba

- Equipo: `<completar>`
- Versión de Windows: `<completar>`
- Fecha: `<completar>`

## Validación instalador (NSIS)

1. Ejecutar:

```bash
npm run build:win
```

2. Confirmar instalador generado en `release/`.
3. Instalar en una máquina Windows limpia.
4. Verificar:
   - La app abre correctamente.
   - Escaneo de disco funciona.
   - Treemap y lista de archivos se renderizan.
   - No hay errores visibles en flujos básicos.

Resultado:

- Estado: `PENDIENTE`
- Notas: `<completar>`

## Validación Microsoft Store (APPX)

1. Configurar variables en PowerShell:

```powershell
$env:GREEKDIR_IDENTITY_NAME="..."
$env:GREEKDIR_PUBLISHER="CN=..."
$env:GREEKDIR_PUBLISHER_DISPLAY_NAME="..."
```

2. Ejecutar:

```bash
npm run build:store
```

3. Confirmar APPX en `release/`.
4. Validar metadatos de paquete (nombre, versión, iconos).

Resultado:

- Estado: `PENDIENTE`
- Notas: `<completar>`

## Limitaciones del entorno de desarrollo actual

- En Linux, `npm run build:win` puede fallar por dependencia de `wine` para firmado/empaquetado.
- En Linux, `npm run build:store` (APPX) falla porque AppX requiere Windows 10+ para build.
- Por lo anterior, la validación final de NSIS/APPX debe ejecutarse en una máquina Windows real.
