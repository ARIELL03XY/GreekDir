# Guía de publicación de GreekDir

Qué necesitas para publicar en la **Mac App Store**, en la **Microsoft Store**, y para montar la **página web** del producto. Última actualización: julio 2026.

---

## 1. Apple / macOS

Hay **dos caminos** para distribuir en Mac, y conviene entender la diferencia antes de pagar nada:

| | Mac App Store | Fuera de la Store (web) |
|---|---|---|
| Cuenta | Apple Developer Program ($99 USD/año) | Apple Developer Program ($99 USD/año) |
| Firma | Certificado "Apple Distribution" | Certificado "Developer ID Application" |
| Revisión de Apple | Sí (días) | No (solo notarización automática, ~minutos) |
| **App Sandbox** | **Obligatorio** | No requerido |
| Escanear todo el disco | ⚠️ Muy limitado | ✅ Funciona (con Full Disk Access) |

### ⚠️ El problema del sandbox para GreekDir

La Mac App Store **exige App Sandbox**: la app solo puede leer archivos que el usuario seleccione explícitamente con el diálogo nativo. Eso significa:

- ✅ "Seleccionar otra carpeta…" funcionaría (el diálogo otorga permiso).
- ❌ Escanear `Macintosh HD` desde la lista de discos **no funcionaría** — el sandbox bloquea la lectura de `/`.
- Apps como DaisyDisk resuelven esto pidiendo al usuario que seleccione el disco en un diálogo (con security-scoped bookmarks para recordarlo).

**Recomendación**: empieza distribuyendo el DMG **fuera de la Store** (firmado + notarizado, descarga desde tu web). Es lo estándar para utilidades de disco. La versión Mac App Store puede venir después si adaptas el flujo al sandbox.

### Camino recomendado: DMG firmado + notarizado

1. **Inscríbete en el Apple Developer Program** ($99/año): <https://developer.apple.com/programs/enroll/> — necesitas Apple ID con 2FA. Puede ser como individuo (aparece tu nombre) o como empresa (necesita D-U-N-S).
2. **Crea el certificado "Developer ID Application"** en Xcode (Settings → Accounts → Manage Certificates) o en <https://developer.apple.com/account/resources/certificates>.
3. **Configura electron-builder** (`package.json`): quita `"identity": null` y añade:
   ```json
   "mac": {
     "hardenedRuntime": true,
     "gatekeeperAssess": false,
     "notarize": { "teamId": "TU_TEAM_ID" }
   }
   ```
4. **Credenciales de notarización** (variables de entorno al hacer build):
   ```bash
   export APPLE_ID="tu@appleid.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # generada en appleid.apple.com
   export APPLE_TEAM_ID="XXXXXXXXXX"
   npm run build:mac
   ```
5. Verifica: `spctl -a -vv release/mac-universal/GreekDir.app` debe decir `accepted · Notarized Developer ID`.
6. Sube el DMG a GitHub Releases o a tu web. Los usuarios lo abren sin avisos de Gatekeeper.

**Nota**: al escanear el disco completo, macOS pedirá **Full Disk Access** para leer carpetas protegidas (Documentos, Escritorio, Mail…). La app ya marca las carpetas sin acceso con 🔒; considera añadir en la web/FAQ cómo activarlo (Ajustes del Sistema → Privacidad y seguridad → Acceso total al disco).

### Si más adelante quieres la Mac App Store

- Target `mas` en electron-builder + certificados "Apple Distribution" y "Mac Installer Distribution" + provisioning profile.
- `entitlements.plist` con `com.apple.security.app-sandbox` y `com.apple.security.files.user-selected.read-only`.
- Rediseñar el flujo de discos: solo carpetas seleccionadas por diálogo (guardando security-scoped bookmarks).
- Ficha en App Store Connect: nombre, descripción, capturas (mín. 1280×800), **URL de política de privacidad** (→ sección 3), categoría Utilidades, precio.
- Revisión de Apple: 1–3 días típicamente.

---

## 2. Microsoft Store (Windows)

Ya hay documentación detallada en este repo — esta es la vista de conjunto:

1. **Cuenta de Partner Center** — registro único: $19 USD (individuo) o $99 USD (empresa): <https://partner.microsoft.com/dashboard/registration>.
2. **Reserva el nombre "GreekDir"** en Partner Center (Apps and games → New product). Esto te da los tres valores de identidad.
3. **Build APPX** con la identidad real:
   ```powershell
   $env:GREEKDIR_IDENTITY_NAME="12345Tu.GreekDir"
   $env:GREEKDIR_PUBLISHER="CN=XXXXXXXX-XXXX-..."
   $env:GREEKDIR_PUBLISHER_DISPLAY_NAME="Tu Nombre"
   npm run build:store
   ```
   (Los tres valores salen de Partner Center → Product identity.) No necesitas comprar certificado: la Store firma el paquete.
4. **Smoke test en Windows real** antes de subir — checklist en `docs/windows-validation.md`. Aún está pendiente.
5. **Ficha de la Store**: descripción (es + en), capturas (mín. 1, ideal 3–5 de 1366×768+), **URL de política de privacidad (obligatoria)** y URL de soporte (→ sección 3), clasificación de edad (IARC, cuestionario rápido), categoría: Utilities & tools.
6. **Certificación**: 24–72 h típicamente.

Paso a paso completo: `docs/partner-center-step-by-step.md` y `docs/microsoft-store-checklist.md`.

**Alternativa/complemento sin Store**: el instalador NSIS (`npm run build:win`) se puede distribuir desde la web. Sin certificado de firma de código, SmartScreen mostrará un aviso las primeras semanas (se gana reputación con descargas). Un certificado OV/EV de firma (~$100–400/año, p. ej. Certum, SSL.com) elimina el aviso; con la Store no hace falta.

---

## 3. Página web

Ambas tiendas **exigen URL pública de política de privacidad**, y la de soporte es muy recomendable — la web no es opcional si publicas. Lo mínimo:

### Opción recomendada: GitHub Pages (gratis)

1. Crea el repo `ARIELL03XY/greekdir-site` (o usa la rama `gh-pages` de este repo, o `/docs` como carpeta publicada).
2. Actívalo en Settings → Pages. URL resultante: `https://ariell03xy.github.io/greekdir/`.
3. (Opcional) Dominio propio (~$10–15/año, p. ej. `greekdir.app`): se configura con un archivo `CNAME` + DNS. El TLD `.app` fuerza HTTPS, que GitHub Pages ya da gratis.

### Páginas mínimas

| Página | Para qué | Base existente |
|---|---|---|
| **Inicio** | Qué es GreekDir, capturas (¡usa el modo oscuro!), botones de descarga DMG/EXE apuntando a GitHub Releases | — |
| **Privacidad** | Requisito de ambas tiendas. GreekDir no recolecta datos ni se conecta a internet: la política es corta y fácil | `docs/privacy-policy.md` |
| **Soporte** | Requisito de la Microsoft Store; enlaza a GitHub Issues y un correo | `docs/support.md` |
| **FAQ** (opcional) | Full Disk Access en macOS, por qué SmartScreen avisa, etc. | — |

### Contenido sugerido para el inicio

- Hero: nombre + tagline ("Descubre qué está ocupando tu disco") + captura del treemap.
- 3–4 features: treemap interactivo, top archivos, búsqueda global, modo oscuro, es/en.
- Descargas: botón macOS (DMG universal) + botón Windows (Store badge + instalador directo).
- Footer: privacidad · soporte · GitHub.

Las descargas pueden vivir en **GitHub Releases** (gratis, con estadísticas): crea un release `v1.0.0` con el DMG y el instalador NSIS adjuntos y enlázalos desde la web.

---

## 4. Orden sugerido

1. ☐ Smoke test en Windows real (`docs/windows-validation.md`).
2. ☐ Cuenta Partner Center ($19) → reservar nombre → build APPX → enviar a certificación.
3. ☐ Publicar la web con privacidad + soporte (requisito previo de las fichas).
4. ☐ Apple Developer Program ($99/año) → certificado Developer ID → notarizar DMG → GitHub Release.
5. ☐ (Más adelante) evaluar versión Mac App Store adaptada al sandbox.

**Costo total para arrancar**: $19 (Microsoft, único) + $99/año (Apple) + dominio opcional.
