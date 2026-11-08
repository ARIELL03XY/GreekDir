# Build resources

Icons plus the customised Windows (NSIS) installer.

## Windows installer: "Install" or "Run once"

`GreekDir-Setup-<version>.exe` opens with a page that lets the user either **install** GreekDir or **run it once without installing**.

"Run once" unpacks the app into a temporary folder, starts it with a temporary `--user-data-dir`, waits for it to close, and then deletes everything. It creates no registry entries, shortcuts, uninstaller or saved preferences, and it never touches an existing installation.

The same mode is available from the command line (extra arguments are forwarded to the app):

```
GreekDir-Setup-1.0.0.exe /RUNONCE
```

Silent installs (`/S`, `/D=...`, `/currentuser`, `/allusers`) skip the page and behave exactly like the stock electron-builder installer.

### How it is wired (read this before upgrading electron-builder)

| File | What it is |
| --- | --- |
| `greekdir-installer.nsh` | `nsis.include`: the choice page, the run-once logic and the `/RUNONCE` switch. Must stay **UTF-8 with BOM** (it contains Spanish accents). |
| `installer.nsi` | Copy of electron-builder's `installer.nsi`. Only change: the app payload is embedded once inside `GreekDirExtractApp`, shared by both modes. See the `GREEKDIR:` markers. |
| `installSection.nsh` | Copy of electron-builder's `installSection.nsh`. Only change: it calls `GreekDirExtractApp`. See the `GREEKDIR:` markers. |
| `../scripts/patch-electron-builder.cjs` | By default electron-builder skips the uninstaller build when a custom `installer.nsi` is used. This tiny, idempotent patch restores it. It runs automatically before `npm run build*` and fails loudly if the expected code is not found. |

`electron-builder` is pinned to an exact version in `package.json` because the copied templates and the patch target that version. After bumping it, diff `installer.nsi` / `installSection.nsh` against `node_modules/app-builder-lib/templates/nsis/` and re-run the manual checks: silent install, silent uninstall, `/RUNONCE`, and the interactive "Run once" path.

Things worth knowing:

- Do **not** call `SpiderBanner::Show` from a page callback: it hangs the installer. The run-once page shows its "Preparing..." state in its own label instead.
- Run once unpacks to the system temp folder first, so it needs roughly 700 MB of free space for a few seconds, and the first start can take 5-30 seconds depending on the disk and antivirus.
