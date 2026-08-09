# Roadmap

## v1.0 (Windows + Microsoft Store)

- ~~Finalize the base disk-analysis experience.~~ ✅
- Smoke test on real Windows hardware.
- Publish the Windows installer.
- Complete the Microsoft Store submission.

## v1.0 (macOS)

- ~~Universal build (DMG) and scanner support.~~ ✅
- ~~Frameless-window fixes, APFS firmlinks, and drive list.~~ ✅
- DMG signing and notarization (requires an Apple Developer ID) to distribute without a Gatekeeper warning.

## v1.1

- ~~Performance improvements scanning large folders.~~ ✅ (shallow tree + lazy expand)
- ~~UX improvements to navigation and filters.~~ ✅ (top files, rescan, breadcrumbs, hidden-files toggle)
- ~~File actions (show in folder, move to trash).~~ ✅
- Fixes based on early user feedback.

## Future

- ~~Dark mode.~~ ✅
- ~~Sort the list by column (name/size).~~ ✅
- ~~Export results and reports.~~ ✅ (CSV/JSON)
- ~~File-category breakdown (percentage by type).~~ ✅
- ~~Global search.~~ ✅
- ~~Duplicate finder.~~ ✅
- ~~Cleanup suggestions (node_modules, dist, .cache, …).~~ ✅
- ~~Multi-select and bulk delete.~~ ✅
- ~~User-configurable exclude filters.~~ ✅
- Evaluate support for more platforms.
- Auto-update (electron-updater) — pending publish/release setup on GitHub.
- Native recycle bin view (Windows).
- Compare two scans (snapshots) and see what grew.
- CLI/headless mode to automate scans and reports.
