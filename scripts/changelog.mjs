#!/usr/bin/env node
/**
 * CHANGELOG.md is the single source for release notes:
 *
 *   node scripts/changelog.mjs site           writes docs/changelog.html (the website's "What's new") and
 *                                             points the homepage's download links at the newest release
 *   node scripts/changelog.mjs site --check   fails if either is out of date (CI)
 *   node scripts/changelog.mjs notes 1.0.0 [file]   prints (or writes to file, UTF-8) that version's
 *                                             section for the GitHub release notes; fails if
 *                                             CHANGELOG.md has no such section
 *
 * Expected format (Keep a Changelog): "## [Unreleased]", then "## [1.0.0-beta.2] - 2026-11-20" per
 * release, with "### Added/Changed/Fixed/Security" groups of "- " bullets. The notes stay in
 * English; the page around them follows the site's ES/EN toggle. No dependencies: the Markdown
 * subset used here (headings, bullets, paragraphs, **bold**, *italics*, `code`, [links](url))
 * is rendered below.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md')
const PAGE = path.join(ROOT, 'docs', 'changelog.html')
const HOME = path.join(ROOT, 'docs', 'index.html')
const REPO = 'https://github.com/ARIELL03XY/GreekDir'

/** Splits CHANGELOG.md into its version sections (newest first, as written). */
export function parseChangelog(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const versions = []
  let current = null
  for (const line of lines) {
    const heading = line.match(/^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/)
    if (heading) {
      current = { version: heading[1], date: heading[2] ?? null, lines: [] }
      versions.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  for (const v of versions) {
    while (v.lines.length && !v.lines[0].trim()) v.lines.shift()
    while (v.lines.length && !v.lines[v.lines.length - 1].trim()) v.lines.pop()
  }
  return versions
}

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline Markdown: `code` first (its content is literal), then links, bold and italics. */
function inline(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) return `<code>${escapeHtml(part.slice(1, -1))}</code>`
      return escapeHtml(part)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    })
    .join('')
}

/** Block Markdown for one version section: ### headings, - bullets (with wrapped lines), paragraphs. */
export function renderSection(lines) {
  const html = []
  let list = null
  let paragraph = null
  const flush = () => {
    if (paragraph) html.push(`<p>${inline(paragraph.join(' '))}</p>`)
    if (list) html.push(`<ul>\n${list.map((item) => `  <li>${inline(item)}</li>`).join('\n')}\n</ul>`)
    paragraph = null
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      if (paragraph) flush()
      continue
    }
    const heading = line.match(/^###\s+(.*)$/)
    if (heading) {
      flush()
      html.push(`<h3>${inline(heading[1])}</h3>`)
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      if (paragraph) flush()
      list ??= []
      list.push(bullet[1])
      continue
    }
    if (list && /^\s+\S/.test(raw)) {
      list[list.length - 1] += ' ' + line.trim()
      continue
    }
    if (list) flush()
    paragraph ??= []
    paragraph.push(line.trim())
  }
  flush()
  return html.join('\n')
}

function renderRelease({ version, date, lines }) {
  const prerelease = version.includes('-')
  const badge = prerelease ? '\n          <span class="badge">Beta</span>' : ''
  const when = date ? `\n          <time datetime="${date}">${date}</time>` : ''
  return `      <section class="release" id="v${escapeHtml(version)}">
        <h2>
          <a href="${REPO}/releases/tag/v${encodeURIComponent(version)}">${escapeHtml(version)}</a>${badge}${when}
        </h2>
${renderSection(lines)
  .split('\n')
  .map((l) => `        ${l}`)
  .join('\n')}
      </section>`
}

export function renderPage(versions) {
  const released = versions.filter((v) => v.version.toLowerCase() !== 'unreleased')
  const body = released.length
    ? released.map(renderRelease).join('\n\n')
    : `      <p class="es">Todavía no hay versiones publicadas.</p>\n      <p class="en">No releases yet.</p>`
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GreekDir — Novedades / What's new</title>
  <meta name="description" content="Release notes for every GreekDir version." />
  <!-- Generated from CHANGELOG.md by scripts/changelog.mjs (npm run changelog). Do not edit by hand. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="site.css?v=4" />
  <link rel="icon" type="image/svg+xml" href="assets/icon.svg" />
  <script>
    (function () {
      const theme = localStorage.getItem('site-theme')
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (theme === 'dark') document.documentElement.classList.add('dark');
      const lang = localStorage.getItem('site-lang')
        || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');
      document.documentElement.lang = lang;
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('lang-' + lang);
      });
    })();
    function toggleTheme() {
      const dark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('site-theme', dark ? 'dark' : 'light');
    }
    function toggleLang() {
      const next = document.body.classList.contains('lang-es') ? 'en' : 'es';
      document.body.classList.remove('lang-es', 'lang-en');
      document.body.classList.add('lang-' + next);
      document.documentElement.lang = next;
      localStorage.setItem('site-lang', next);
    }
  </script>
</head>
<body>
  <header class="site">
    <div class="container">
      <a class="brand" href="./">
        <img class="logo-img" src="assets/icon.svg" alt="" width="34" height="34" />
        GreekDir
      </a>
      <nav>
        <a class="doc-link es" href="support.html">Soporte</a>
        <a class="doc-link en" href="support.html">Support</a>
        <a class="doc-link" href="${REPO}">GitHub</a>
        <button class="pill-btn" onclick="toggleLang()" title="Español / English">ES / EN</button>
        <button class="pill-btn" onclick="toggleTheme()" title="Light / Dark">☀︎ / ☾</button>
      </nav>
    </div>
  </header>

  <main class="doc container changelog">
    <h1><span class="es">Novedades</span><span class="en">What's new</span></h1>
    <p class="lead es">Los cambios de cada versión de GreekDir. Las versiones <strong>Beta</strong> son versiones de prueba. Las notas están en inglés.</p>
    <p class="lead en">What changed in each GreekDir version. <strong>Beta</strong> versions are pre-releases.</p>
    <p class="lead">
      <a class="es" href="${REPO}/releases">Descargas en GitHub →</a><a class="en" href="${REPO}/releases">Downloads on GitHub →</a>
    </p>

${body}
  </main>

  <footer class="site">
    <div class="container">
      <span>© 2026 GreekDir · CHV Network Technologies</span>
      <span>
        <a class="es" href="./">Inicio</a><a class="en" href="./">Home</a> ·
        <a class="es" href="privacy.html">Privacidad</a><a class="en" href="privacy.html">Privacy</a> ·
        <a class="es" href="support.html">Soporte</a><a class="en" href="support.html">Support</a> ·
        <a href="${REPO}">GitHub</a>
      </span>
    </div>
  </footer>
</body>
</html>
`
}

/** The homepage's download button, release link and version label, for the newest released version. */
export function updateHomepage(html, version) {
  return html
    // Any download (GreekDir-Setup-1.0.0.exe, GreekDir-1.0.0-arm64.dmg, …): new tag, and the old version in the file name.
    .replace(/releases\/download\/v([\w.-]+?)\/(GreekDir-[\w.-]+)/g, (_m, old, file) => `releases/download/v${version}/${file.split(old).join(version)}`)
    .replace(/releases\/tag\/v[\w.-]+/g, `releases/tag/v${version}`)
    .replace(/(<span class="release-version">)[^<]*(<\/span>)/g, `$1${version}$2`)
}

function main(argv) {
  const [command, arg, outFile] = argv
  const versions = parseChangelog(fs.readFileSync(CHANGELOG, 'utf8'))

  if (command === 'site') {
    const html = renderPage(versions)
    const latest = versions.find((v) => v.version.toLowerCase() !== 'unreleased')
    const homeNow = fs.readFileSync(HOME, 'utf8').replace(/\r\n/g, '\n')
    const home = latest ? updateHomepage(homeNow, latest.version) : homeNow
    if (arg === '--check') {
      const current = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8').replace(/\r\n/g, '\n') : ''
      const stale = [current !== html && 'docs/changelog.html', home !== homeNow && 'the download links in docs/index.html'].filter(Boolean)
      if (stale.length) {
        console.error(`Out of date: ${stale.join(' and ')}. Run \`npm run changelog\` and commit the result.`)
        process.exit(1)
      }
      console.log('docs/changelog.html and the homepage download links are up to date.')
      return
    }
    fs.writeFileSync(PAGE, html)
    if (home !== homeNow) fs.writeFileSync(HOME, home)
    console.log(`Wrote docs/changelog.html (${versions.filter((v) => v.version !== 'Unreleased').length} release(s)); homepage links point at ${latest?.version ?? 'nothing yet'}.`)
    return
  }

  if (command === 'notes' && arg) {
    const wanted = arg.replace(/^v/, '')
    const section = versions.find((v) => v.version === wanted)
    if (!section || section.lines.every((l) => !l.trim())) {
      console.error(`CHANGELOG.md has no "## [${wanted}]" section with content. Move the Unreleased notes under it first.`)
      process.exit(1)
    }
    const notes = section.lines.join('\n') + '\n'
    if (outFile) fs.writeFileSync(outFile, notes)
    else process.stdout.write(notes)
    return
  }

  console.error('usage: changelog.mjs site [--check] | notes <version> [file]')
  process.exit(2)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
