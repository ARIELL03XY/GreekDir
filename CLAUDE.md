# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GreekDir is a WinDirStat-style desktop disk-usage analyzer built with Electron + React + TypeScript + Vite, styled with Tailwind, and using D3 for the treemap. The primary release target is Windows, distributed directly as an NSIS installer (not through any app store) that offers "Install" or "Run once, without installing"; the scanner also supports macOS and Linux.

## Commands

```bash
npm run dev          # Start Vite; vite-plugin-electron launches the Electron app with hot reload
npm run lint         # ESLint over src/ and electron/ (.ts,.tsx)
npm test             # Vitest unit tests (electron/*.test.ts); npm run test:watch to iterate
npm run build        # tsc typecheck + vite build + electron-builder (current platform)
npm run build:win    # Windows NSIS installer -> release/ (see build/README.md before touching it)
npm run icons        # Re-render build/icon.png, icon.ico, icon.icns from build/icon*.svg (after editing the SVGs)
```

Verification gates: `npm run lint`, `npx tsc --noEmit` and `npm test` (CI runs the same). The tests cover the Electron-free logic in `electron/scanner.ts`, `electron/validation.ts` and the menu template in `electron/menu.ts`; UI and IPC behaviour have no automated tests. To verify a change actually works at runtime (build + launch Electron + drive it via CDP), use the `verify` skill (`.claude/skills/verify/SKILL.md`).

## Architecture

The app has a two-process split; the IPC boundary is the most important thing to understand before changing scanning or data flow.

### Process boundary
- **Main process** (`electron/main.ts`, with the Electron-free logic split into `electron/scanner.ts` and `electron/validation.ts`): disk enumeration, window management and all IPC handlers — `get-drives`, `select-directory`, `scan-directory`, `cancel-scan`, `expand-directory`, `get-top-files`, `get-category-breakdown`, `search-files`, `export-report`, `reveal-in-folder`, `move-to-trash`, `set-language` (keeps the native menu, built from `electron/menu.ts`, in the UI language). The menu talks back to the renderer over the `menu-command` event (`onMenuCommand`). Runs in Node.
- **Preload** (`electron/preload.ts`): the only bridge. Exposes `window.electronAPI` via `contextBridge`. Any new main↔renderer call must be added in three places — `electron/main.ts` (register it with `secureHandle`, **never** bare `ipcMain.handle`: it rejects any sender other than the main window), `electron/preload.ts` (expose method), and `src/types.ts` (`ElectronAPI` interface). The renderer is untrusted: validate every argument with `electron/validation.ts`, and only act on file paths that exist in the current scan (`findScannedNode`).
- **Renderer** (`src/`): React UI. `App.tsx` is a 3-state machine (`idle` → `scanning` → `results`) that drives which top-level view renders.

### Shared types
`src/shared/types.ts` is the single source of truth for `FileNode`, `DiskInfo`, `ScanProgress` — imported by both the Electron and React sides. `src/shared/categories.ts` similarly holds the extension→category map (`getFileCategory`) used by both the renderer (file-type colors) and the main process (`get-category-breakdown` IPC handler) — keep it as the one place that mapping lives. `src/types.ts` re-exports these and adds the `ElectronAPI` window typing. Keep these in sync when changing the data model.

### Scanning & the shallow-tree/lazy-expand pattern (critical for performance)
A full recursive scan of a large drive produces a `FileNode` tree far too big to send over IPC or render at once. The scan avoids UI freezes with this design (logic in `electron/scanner.ts`, IPC wiring in `electron/main.ts`):

1. `scanDir` recurses the filesystem asynchronously, accumulating sizes and sorting children by size descending. It yields to the event loop (`setImmediate`) every 100 entries so progress IPC and cancellation are processed. Cancellation is cooperative via an `AbortController` (`cancel-scan` aborts; `scanDir` throws `AbortError` which the handler swallows to return `null`).
2. The **full** tree is kept in-memory (`fullScanCache`), but only the first `MAX_IPC_DEPTH` (3) levels are serialized to the renderer via `buildShallowTree`. Directories cut off at that depth drop their `children` and instead carry a `childCount` field.
3. When the user drills into a cut-off directory, the renderer calls `expand-directory`, which serves that node's children from `fullScanCache` on demand.

If you change `MAX_IPC_DEPTH`, the IPC payload size, or the scan-recursion, keep this shallow/lazy contract intact — it is the fix for the large-directory freeze (see commit `04bcd4a`). System dirs (`.`-prefixed, `node_modules`, `$Recycle.Bin`) are skipped during scan.

### Disk enumeration
`getDisks()` branches by platform. Windows tries PowerShell (`Get-CimInstance`) → `wmic` → drive-letter fallback, in that order, so a failure of one strategy degrades gracefully.

### i18n
`src/i18n.tsx` is a self-contained context provider (no external lib) with `en`/`es` dictionaries and a `{{placeholder}}` interpolation convention. Add UI strings as keys in both language dictionaries rather than hardcoding text in components.

### Theming
`src/theme.ts` (`useTheme` hook) tracks light/dark state, persists it to `localStorage`, and toggles the `dark` class on `<html>` — Tailwind is configured with `darkMode: 'class'` (`tailwind.config.js`), so components style dark mode via `dark:` variants rather than a CSS-variable or context-based theme.

## Path alias
`@` resolves to `./src` (configured in both `vite.config.ts` and `tsconfig.json`).

## Security model — keep it intact
- **No network, ever.** The packaged app ships a Content-Security-Policy (injected by `vite.config.ts` at build time) that only allows its own files, and the privacy policy promises it never connects to the internet. Fonts are bundled (`@fontsource`); do not add CDN links, remote images, analytics or update checks.
- Electron fuses are hardened in `package.json` (`build.electronFuses`): `RunAsNode`, `NODE_OPTIONS` and `--inspect` are off in the packaged app, so debugging the *packaged* build over CDP does not work with `--inspect` (use an unpackaged `electron .` for that).
- The renderer runs sandboxed with context isolation; the main window denies new windows, navigation away from the app, and every permission request.

## Windows installer
The installer customisation (Install / Run once, `/RUNONCE`) lives in `build/` and depends on patched copies of electron-builder's NSIS templates plus `scripts/patch-electron-builder.cjs`. `electron-builder` is pinned to an exact version for that reason — read `build/README.md` before upgrading it. Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed (as a draft). The installer is not code-signed yet.

## Release docs
Maintainer-only working notes live in `private-docs/` (git-ignored, never published). `CHANGELOG.md` and `ROADMAP.md` are the release-related docs tracked here.
