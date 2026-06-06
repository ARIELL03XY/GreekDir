# GreekDir

<p align="center">
  <strong>Analizador de disco con interfaz moderna</strong>
</p>

<p align="center">
  Una aplicación de escritorio estilo WinDirStat con una interfaz limpia y moderna inspirada en Claude.
  Visualiza el uso de espacio en tu disco con un treemap interactivo y una lista detallada de archivos.
</p>

---

## ✨ Características

- ��️ **Treemap interactivo** — Visualización de bloques proporcionales al tamaño de archivos
- 📋 **Vista de lista** — Archivos y carpetas ordenados por tamaño con barras de progreso
- 🎨 **Colores por tipo** — Cada extensión de archivo tiene un color diferente
- 📂 **Navegación profunda** — Haz clic para explorar subcarpetas
- 📊 **Panel de detalles** — Información completa del archivo seleccionado
- ⚡ **Escaneo rápido** — Análisis asíncrono con indicador de progreso
- 🎯 **Interfaz moderna** — Diseño limpio con esquinas redondeadas, sombras suaves y tipografía elegante

## 🛠️ Tech Stack

- **Electron** — App de escritorio multiplataforma
- **React 18** — UI declarativa con hooks
- **TypeScript** — Tipado estático
- **Vite** — Build tool ultra rápido
- **Tailwind CSS** — Estilos utility-first
- **D3.js** — Visualización del treemap

## 🚀 Desarrollo

### Prerrequisitos

- Node.js >= 18
- npm >= 9

### Instalación

```bash
npm install
```

### Ejecutar en modo desarrollo

```bash
npm run dev
```

Esto abre la app de Electron con hot-reload habilitado.

### Build para producción

```bash
npm run build
```

Genera el ejecutable para tu plataforma en la carpeta `dist/`.

## 📁 Estructura del Proyecto

```
GreekDir/
├── electron/           # Código del proceso principal de Electron
│   ├── main.ts         # Ventana principal, IPC handlers, scanner
│   └── preload.ts      # Bridge seguro entre main y renderer
├── src/                # Código del frontend (React)
│   ├── components/     # Componentes UI
│   │   ├── Header.tsx
│   │   ├── WelcomeScreen.tsx
│   │   ├── ScanningView.tsx
│   │   ├── ResultsView.tsx
│   │   ├── Treemap.tsx
│   │   ├── FileList.tsx
│   │   └── DetailPanel.tsx
│   ├── utils/          # Utilidades
│   │   ├── colors.ts   # Mapa de colores por extensión
│   │   └── format.ts   # Formateo de tamaños
│   ├── App.tsx         # Componente raíz
│   ├── main.tsx        # Entry point
│   ├── index.css       # Estilos globales
│   └── types.ts        # TypeScript interfaces
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 📸 Diseño

La interfaz sigue un estilo minimalista con:
- Fondo crema suave (`#FAF9F7`)
- Cards con bordes sutiles y sombras mínimas
- Esquinas redondeadas generosas
- Tipografía Inter
- Paleta de colores cálida y neutra
- Acentos en tonos tierra/cobre

## 📄 Licencia

MIT
