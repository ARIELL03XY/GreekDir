# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GreekDir is a WinDirStat-style desktop disk-usage analyzer built with Electron + React + TypeScript + Vite, styled with Tailwind, and using D3 for the treemap. The primary release target is Windows (NSIS installer + Microsoft Store APPX), though the scanner also supports macOS and Linux.

## Commands

```bash
npm run dev          # Start Vite; vite-plugin-electron launches the Electron app with hot reload
npm run lint         # ESLint over src (.ts,.tsx)
npm run build        # tsc typecheck + vite build + electron-builder (current platform)
npm run build:win    # Windows NSIS installer -> release/
npm run build:store  # Microsoft Store APPX -> release/ (requires GREEKDIR_IDENTITY_NAME,
                     #   GREEKDIR_PUBLISHER, GREEKDIR_PUBLISHER_DISPLAY_NAME env vars)
```

There is no test runner configured. Use `npm run lint` and `tsc` (via `npm run build`) as the verification gates. To verify a change actually works at runtime (build + launch Electron + drive it via CDP), use the `verify` skill (`.claude/skills/verify/SKILL.md`).

## Architecture

The app has a two-process split; the IPC boundary is the most important thing to understand before changing scanning or data flow.

### Process boundary
- **Main process** (`electron/main.ts`): filesystem scanning, disk enumeration, all IPC handlers. Runs in Node.
- **Preload** (`electron/preload.ts`): the only bridge. Exposes `window.electronAPI` via `contextBridge`. Any new main↔renderer call must be added in three places — `electron/main.ts` (`ipcMain.handle`), `electron/preload.ts` (expose method), and `src/types.ts` (`ElectronAPI` interface).
- **Renderer** (`src/`): React UI. `App.tsx` is a 3-state machine (`idle` → `scanning` → `results`) that drives which top-level view renders.

### Shared types
`src/shared/types.ts` is the single source of truth for `FileNode`, `DiskInfo`, `ScanProgress` — imported by both the Electron and React sides. `src/shared/categories.ts` similarly holds the extension→category map (`getFileCategory`) used by both the renderer (file-type colors) and the main process (`get-category-breakdown` IPC handler) — keep it as the one place that mapping lives. `src/types.ts` re-exports these and adds the `ElectronAPI` window typing. Keep these in sync when changing the data model.

### Scanning & the shallow-tree/lazy-expand pattern (critical for performance)
A full recursive scan of a large drive produces a `FileNode` tree far too big to send over IPC or render at once. The scan avoids UI freezes with this design in `electron/main.ts`:

1. `scanDir` recurses the filesystem asynchronously, accumulating sizes and sorting children by size descending. It yields to the event loop (`setImmediate`) every 100 entries so progress IPC and cancellation are processed. Cancellation is cooperative via an `AbortController` (`cancel-scan` aborts; `scanDir` throws `AbortError` which the handler swallows to return `null`).
2. The **full** tree is kept in-memory (`fullScanCache`), but only the first `MAX_IPC_DEPTH` (3) levels are serialized to the renderer via `buildShallowTree`. Directories cut off at that depth drop their `children` and instead carry a `childCount` field.
3. When the user drills into a cut-off directory, the renderer calls `expand-directory`, which serves that node's children from `fullScanCache` on demand.

If you change `MAX_IPC_DEPTH`, the IPC payload size, or the scan-recursion, keep this shallow/lazy contract intact — it is the fix for the large-directory freeze (see commit `04bcd4a`). System dirs (`.`-prefixed, `node_modules`, `$Recycle.Bin`) are skipped during scan.

### Disk enumeration
`getDisks()` branches by platform. Windows tries PowerShell (`Get-CimInstance`) → `wmic` → drive-letter fallback, in that order, so a failure of one strategy degrades gracefully.

### i18n
`src/i18n.tsx` is a self-contained context provider (no external lib) with `en`/`es` dictionaries and a `{{placeholder}}` interpolation convention. Add UI strings as keys in both language dictionaries rather than hardcoding text in components.

## Path alias
`@` resolves to `./src` (configured in both `vite.config.ts` and `tsconfig.json`).

## Windows release docs
Release process and store submission live in `docs/` (`windows-v1-scope.md`, `microsoft-store-checklist.md`, `windows-validation.md`, `partner-center-step-by-step.md`) plus `CHANGELOG.md` and `ROADMAP.md`.
