# GreekDir

<p align="center">
  <strong>Disk analyzer with a modern interface</strong>
</p>

<p align="center">
  A WinDirStat-style desktop application with a clean, modern interface inspired by Claude.
  Visualize disk space usage with an interactive treemap and a detailed file list.
</p>

---

## ✨ Features

- 🗂️ **Interactive treemap** — Block visualization proportional to file size
- 📋 **List view** — Files and folders sorted by size with progress bars
- 🎨 **Type-based colors** — Each file extension has a different color
- 📂 **Deep navigation** — Click to explore subfolders
- 📊 **Detail panel** — Complete information for the selected file
- ⚡ **Fast scanning** — Asynchronous analysis with progress indicator
- 🎯 **Modern interface** — Clean design with rounded corners, soft shadows, and elegant typography

## 🛠️ Tech Stack

- **Electron** — Cross-platform desktop app
- **React 18** — Declarative UI with hooks
- **TypeScript** — Static typing
- **Vite** — Ultra-fast build tool
- **Tailwind CSS** — Utility-first styling
- **D3.js** — Treemap visualization

## 🚀 Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This opens the Electron app with hot reload enabled.

### Production build

```bash
npm run build
```

This generates the executable for your platform in the `dist/` folder.

### Windows-specific builds

```bash
npm run build:win
```

Builds a Windows installer (`NSIS`) in the `release/` folder.

```bash
npm run build:store
```

Builds a Microsoft Store package (`APPX`) in the `release/` folder.
Before running this command, set:

- `GREEKDIR_IDENTITY_NAME`
- `GREEKDIR_PUBLISHER`
- `GREEKDIR_PUBLISHER_DISPLAY_NAME`

See `/docs/microsoft-store-checklist.md` for the complete publication process.

## 📁 Project Structure

```
GreekDir/
├── electron/           # Electron main process code
│   ├── main.ts         # Main window, IPC handlers, scanner
│   └── preload.ts      # Secure bridge between main and renderer
├── src/                # Frontend code (React)
│   ├── components/     # UI components
│   │   ├── Header.tsx
│   │   ├── WelcomeScreen.tsx
│   │   ├── ScanningView.tsx
│   │   ├── ResultsView.tsx
│   │   ├── Treemap.tsx
│   │   ├── FileList.tsx
│   │   └── DetailPanel.tsx
│   ├── utils/          # Utilities
│   │   ├── colors.ts   # Extension-to-color map
│   │   └── format.ts   # Size formatting
│   ├── App.tsx         # Root component
│   ├── main.tsx        # Entry point
│   ├── index.css       # Global styles
│   └── types.ts        # TypeScript interfaces
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 📸 Design

The interface follows a minimalist style with:
- Soft cream background (`#FAF9F7`)
- Cards with subtle borders and minimal shadows
- Generous rounded corners
- Inter typography
- Warm, neutral color palette
- Earth/copper accent tones

## 📦 Windows release docs

- Scope v1.0: `/docs/windows-v1-scope.md`
- Microsoft Store checklist: `/docs/microsoft-store-checklist.md`
- Windows validation runbook: `/docs/windows-validation.md`
- Partner Center step-by-step: `/docs/partner-center-step-by-step.md`
- Privacy policy: `/docs/privacy-policy.md`
- Support channels: `/docs/support.md`
- Change history: `/CHANGELOG.md`
- Product roadmap: `/ROADMAP.md`

## 📄 License

MIT
