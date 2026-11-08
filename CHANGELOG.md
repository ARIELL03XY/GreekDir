# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Run once, without installing**: the Windows installer now opens with a choice between installing GreekDir and running it once. "Run once" unpacks the app into a temporary folder, runs it with temporary settings, and deletes everything when it is closed — no registry entries, shortcuts or saved preferences. Also available as `GreekDir-Setup.exe /RUNONCE`. See `build/README.md`.

- **Duplicate finder**: a "Duplicates" tab groups files by size, hashes the size-groups with the most potential wasted space first (bounded by a hash budget so it stays fast on large drives), and lists them sorted by wasted space, largest first.
- **Cleanup suggestions**: a "Cleanup" tab surfaces known build-artifact/cache/dependency folders already present in the scan (`node_modules`, `dist`, `.cache`, …), sorted by size.
- **Multi-select + bulk trash**: checkboxes in the List, Top files, Duplicates, and Cleanup tables, with a floating action bar to move several items to the trash at once (two-step confirm, same as the single-file action).
- **Keyboard shortcuts**: `Ctrl/Cmd+F` focuses the search box; `Escape` closes the detail panel.
- **Configurable exclude filters**: add extra folder names to skip during a scan (beyond the built-in system/hidden skip list), persisted across sessions.
- **Global search**: the toolbar search box now searches the entire scan (files and folders), largest first, with details and context-menu actions on every result.
- **Category breakdown**: the treemap view shows a stacked bar of the current folder's bytes by file type, with sizes and percentages.
- **Dark mode**: light/dark toggle in the header, persisted across sessions and following the OS theme on first run.
- **Export report**: save the scan as CSV (top 100 files) or JSON (summary + folders + top files) via a native save dialog.
- **Context menu**: right-click any row or treemap tile for Details / Show in folder / Move to trash.
- **Column sorting**: click Name or Size in the list view to reorder.
- **Filter box**: filter the list and top-files views by name or extension.
- **Modified date**: files now carry their last-modified date, shown in the detail panel.
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
