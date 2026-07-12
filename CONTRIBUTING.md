# Contributing to GreekDir

Thanks for your interest in improving GreekDir! Issues and pull requests are
welcome, in English or Spanish.

## Getting started

```bash
git clone https://github.com/ARIELL03XY/GreekDir.git
cd GreekDir
npm install
npm run dev        # launches the Electron app with hot reload
```

## Before opening a pull request

1. Make sure `npm run lint` passes and the app builds (`npm run build`).
2. Test your change in the running app — both light and dark mode if it
   touches the UI.
3. UI strings must be added to **both** the `en` and `es` dictionaries in
   `src/i18n.tsx` (never hardcode text in components).
4. New IPC calls must be added in three places: `electron/main.ts`
   (`ipcMain.handle`), `electron/preload.ts`, and the `ElectronAPI`
   interface in `src/types.ts`.
5. Keep the scanner's shallow-tree/lazy-expand contract intact (see
   `CLAUDE.md` for the architecture overview).

## Reporting bugs

Open an [issue](https://github.com/ARIELL03XY/GreekDir/issues) and include:

- GreekDir version and OS (macOS or Windows) with version.
- Steps to reproduce.
- Screenshots if the problem is visual.

## Scope

GreekDir is a local-only disk analyzer: features that send data over the
network (telemetry, accounts, cloud sync) are out of scope by design.
