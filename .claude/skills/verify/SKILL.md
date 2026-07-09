---
name: verify
description: Build, launch, and drive GreekDir (Electron) to verify changes at runtime via CDP
---

# Verifying GreekDir

## Build & launch (production mode, no dev server)

```bash
npx vite build                      # builds renderer (dist/) AND main+preload (dist-electron/) via vite-plugin-electron
npx electron . --remote-debugging-port=9223   # run in background
```

Wait for CDP: poll `curl -s http://localhost:9223/json` until it returns a page target.

- Renderer-only change → `npx vite build` + `location.reload()` via CDP is enough.
- `electron/main.ts` or `preload.ts` change → must kill and relaunch Electron.

## Driving the app via CDP

No Playwright needed. Install `ws` in the scratchpad and use a minimal driver
(Runtime.evaluate with `awaitPromise`/`returnByValue`, Page.captureScreenshot).
Key selectors/flows:

- Disk cards: `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Macintosh HD')).click()` starts a scan.
- Scanning state: `document.body.innerText.includes('Scanning')`; Cancel button text is `Cancel`.
- Treemap tiles are SVG cells: `document.querySelectorAll('svg g[transform]')` (filter those containing a `rect`); dispatch a bubbling MouseEvent('click') on the cell `<g>` — the d3 click handler lives on the cell, and the outer `<g>` container also matches text searches, so filter by `[transform]`.
- Breadcrumbs: `document.querySelectorAll('nav button')`.
- `window.electronAPI` is available for IPC-surface checks (`getDrives()`, `platform`).

## Main-process checks

Launch with `--inspect=9229` and evaluate in the main process over the node
inspector websocket (`http://localhost:9229/json` → Runtime.evaluate with
`includeCommandLineAPI: true`; `require('electron')` works). Useful for
Menu/BrowserWindow assertions and for triggering a real window close
(`BrowserWindow.getAllWindows()[0].close()`).

## Gotchas

- `window.close()` from the renderer closes the window but does NOT emit the
  BrowserWindow `close` event — use `win.close()` from the main process to
  test close handlers.

- "Select folder" / "Select another folder…" open a **native dialog** — do not click them under automation (undismissable).
- A full scan of `/` on this machine takes a few minutes (~1.3M files); scan + Cancel is the fast way to exercise the scan path.
- Foreground `sleep` is blocked in the harness; poll with a background `until … done` loop.
