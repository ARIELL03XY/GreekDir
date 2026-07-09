# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Top files view**: ranked list of the 100 largest files across the whole scan, with full path, share of total, and quick actions.
- **File actions**: "Show in folder" (Finder/Explorer) and "Move to trash" (with two-step confirmation) from the detail panel.
- **Rescan button** in the results toolbar to refresh the current folder.
- **Hidden folders toggle**: optionally include hidden/system folders (`.git`, `node_modules`, …) in the scan.
- **Language persistence**: the en/es choice is remembered across sessions and defaults to the OS language on first run.
- **Window state persistence**: size and position are restored on relaunch.
- Custom application menu; production builds drop View/Reload so an accidental Ctrl+R/Cmd+R can no longer lose scan results.
- Permission-denied folders are now flagged (lock icon + notice) instead of silently reading 0 B.
- Windows release scripts: `build:win` and `build:store`.
- Microsoft Store APPX builder config in `electron-builder.store.json`.
- Windows v1 scope and Microsoft Store publishing checklists in `/docs`.
- Initial privacy and support documentation templates.

### Fixed

- **macOS**: scanning `/` no longer double-counts data through APFS firmlinks (`/System/Volumes/Data`) and no longer descends into `/Volumes` (external drives are scanned individually).
- **macOS**: the disk list hides APFS helper volumes (Preboot, Update, Data, VM) and reports real container usage instead of the sealed system volume's own blocks.
- **macOS**: frameless window is draggable again (missing drag-region CSS) and the traffic lights no longer overlap the header.
- **Windows**: the native window frame is kept (the macOS-only `hiddenInset` title bar is no longer applied) and `System Volume Information` is skipped during scans.
- Treemap drill-down works again for directories above the IPC depth cutoff.
- Faster deep navigation: `expand-directory` resolves paths by prefix descent instead of walking the whole tree.
- Scan errors return the UI to the start screen instead of leaving it stuck on "Scanning…".
- Long breadcrumb trails scroll (and auto-scroll to the current folder) instead of overlapping the toolbar.
