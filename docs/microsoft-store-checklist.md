# Microsoft Store checklist (GreekDir)

## 1) Preparación del producto

- [ ] Confirmar alcance de v1.0 en `/docs/windows-v1-scope.md`.
- [ ] Ejecutar pruebas manuales en discos pequeños/medianos/grandes.
- [ ] Validar manejo de errores y estados de carga.

## 2) Build para Windows

- [ ] Ejecutar `npm run build:win`.
- [ ] Verificar instalador en `release/`.
- [ ] Probar instalación limpia en otra máquina Windows.

## 3) Build para Microsoft Store (APPX)

Configurar variables antes del build:

```powershell
$env:GREEKDIR_IDENTITY_NAME="..."
$env:GREEKDIR_PUBLISHER="CN=..."
$env:GREEKDIR_PUBLISHER_DISPLAY_NAME="..."
```

Luego ejecutar:

```bash
npm run build:store
```

- [ ] Verificar APPX en `release/`.
- [ ] Confirmar versión, nombre e iconos.

## 4) Partner Center

- [ ] Crear cuenta en Microsoft Partner Center.
- [ ] Reservar nombre de la app.
- [ ] Completar metadata: descripción, capturas, categoría y keywords.
- [ ] Definir precio y regiones.
- [ ] Configurar clasificación por edad.

## 5) Cumplimiento

- [ ] Publicar política de privacidad (`/docs/privacy-policy.md`).
- [ ] Definir soporte de usuario (`/docs/support.md`).
- [ ] Revisar cumplimiento de políticas de Microsoft Store.

## 6) Envío y revisión

- [ ] Subir paquete APPX en Partner Center.
- [ ] Atender feedback de certificación.
- [ ] Reenviar hasta aprobación.

## 7) Post-lanzamiento

- [ ] Registrar cambios en `CHANGELOG.md`.
- [ ] Mantener próximos hitos en `ROADMAP.md`.
- [ ] Monitorear crashes, reseñas y reportes.
