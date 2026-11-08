#!/usr/bin/env node
/**
 * Makes electron-builder run its normal two-pass NSIS build (which generates the uninstaller) even
 * when a custom installer script is configured (`build.nsis.script`).
 *
 * Why: by default, electron-builder returns early for custom scripts, skips building the
 * uninstaller, and leaves UNINSTALLER_OUT_FILE empty. A script based on the stock template (like
 * build/installer.nsi, which adds the "run once" option) then fails to compile at
 * `File "/oname=Uninstall ..." "${UNINSTALLER_OUT_FILE}"`.
 *
 * The change is tiny and idempotent. If the installed app-builder-lib does not match the expected
 * code (e.g. electron-builder was upgraded), this script fails loudly instead of patching blindly:
 * re-check build/installer.nsi, build/installSection.nsh and this patch against the new templates.
 */
const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'app-builder-lib',
  'out',
  'targets',
  'nsis',
  'NsisTarget.js'
)

const ORIGINAL = `        if (customScriptPath != null) {
            builder_util_1.log.info({ reason: "custom NSIS script is used" }, "uninstaller is not signed by electron-builder");
            return { script, isCustomScript: true };
        }`

const PATCHED = `        if (customScriptPath != null) {
            // GREEKDIR PATCH (scripts/patch-electron-builder.cjs): keep going so the uninstaller is still built.
            builder_util_1.log.info({ reason: "custom NSIS script is used" }, "custom NSIS script; uninstaller is still built in two passes");
        }`

if (!fs.existsSync(target)) {
  console.error(`patch-electron-builder: ${target} not found. Run "npm install" first.`)
  process.exit(1)
}

const source = fs.readFileSync(target, 'utf8')
// Normalise line endings so the check works regardless of how npm unpacked the file.
const eol = source.includes('\r\n') ? '\r\n' : '\n'
const text = source.replace(/\r\n/g, '\n')

if (text.includes('GREEKDIR PATCH')) {
  console.log('patch-electron-builder: already applied')
  process.exit(0)
}

if (!text.includes(ORIGINAL)) {
  console.error(
    'patch-electron-builder: the expected code was not found in app-builder-lib.\n' +
      'electron-builder was probably upgraded. Re-verify the custom NSIS installer\n' +
      '(build/installer.nsi, build/installSection.nsh) and update this patch.'
  )
  process.exit(1)
}

fs.writeFileSync(target, text.replace(ORIGINAL, PATCHED).replace(/\n/g, eol))
console.log('patch-electron-builder: applied')
