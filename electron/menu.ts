/**
 * The application menu, as plain data so it can be unit-tested without Electron.
 * main.ts builds it with Menu.buildFromTemplate() and rebuilds it when the UI language changes.
 */
import type { MenuItemConstructorOptions } from 'electron'

export type MenuLanguage = 'en' | 'es'

/** Commands the menu sends to the renderer over the 'menu-command' channel. */
export type MenuCommand = 'select-folder'

export interface MenuOptions {
  platform: NodeJS.Platform
  language: MenuLanguage
  /** Development build: adds Reload and the developer tools. */
  isDev: boolean
  /** Runs a renderer command (sent over IPC by main.ts). */
  onCommand: (command: MenuCommand) => void
  /** Shows the About dialog (Windows/Linux; macOS uses the native About panel). */
  onAbout: () => void
}

const LABELS = {
  en: {
    file: '&File',
    selectFolder: 'Select Folder…',
    quit: 'E&xit',
    edit: '&Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: '&View',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Actual Size',
    fullScreen: 'Toggle Full Screen',
    reload: 'Reload',
    devTools: 'Developer Tools',
    window: '&Window',
    help: '&Help',
    about: 'About GreekDir',
  },
  es: {
    file: '&Archivo',
    selectFolder: 'Seleccionar carpeta…',
    quit: '&Salir',
    edit: '&Edición',
    undo: 'Deshacer',
    redo: 'Rehacer',
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    selectAll: 'Seleccionar todo',
    view: '&Ver',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    resetZoom: 'Tamaño real',
    fullScreen: 'Pantalla completa',
    reload: 'Recargar',
    devTools: 'Herramientas de desarrollo',
    window: 'Ve&ntana',
    help: 'Ay&uda',
    about: 'Acerca de GreekDir',
  },
} satisfies Record<MenuLanguage, Record<string, string>>

export function menuLabels(language: MenuLanguage) {
  return LABELS[language]
}

/** The UI language for the menu: 'es' for Spanish locales, otherwise 'en'. */
export function menuLanguageFromLocale(locale: string): MenuLanguage {
  return locale.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function buildMenuTemplate({ platform, language, isDev, onCommand, onAbout }: MenuOptions): MenuItemConstructorOptions[] {
  const t = LABELS[language]
  const isMac = platform === 'darwin'
  // macOS shows "&" literally and has no mnemonics.
  const label = (text: string) => (isMac ? text.replace('&', '') : text)

  const file: MenuItemConstructorOptions = {
    label: label(t.file),
    submenu: [
      { label: t.selectFolder, accelerator: 'CmdOrCtrl+O', click: () => onCommand('select-folder') },
      ...(isMac ? [] : [{ type: 'separator' } as const, { role: 'quit', label: label(t.quit) } as const]),
    ],
  }

  const edit: MenuItemConstructorOptions = {
    label: label(t.edit),
    submenu: [
      { role: 'undo', label: t.undo },
      { role: 'redo', label: t.redo },
      { type: 'separator' },
      { role: 'cut', label: t.cut },
      { role: 'copy', label: t.copy },
      { role: 'paste', label: t.paste },
      { role: 'selectAll', label: t.selectAll },
    ],
  }

  // No Reload in production: reloading the renderer would drop the scan results.
  const view: MenuItemConstructorOptions = {
    label: label(t.view),
    submenu: [
      { role: 'zoomIn', label: t.zoomIn },
      { role: 'zoomOut', label: t.zoomOut },
      { role: 'resetZoom', label: t.resetZoom },
      { type: 'separator' },
      { role: 'togglefullscreen', label: t.fullScreen },
      ...(isDev
        ? [
            { type: 'separator' } as const,
            { role: 'reload', label: t.reload } as const,
            { role: 'toggleDevTools', label: t.devTools } as const,
          ]
        : []),
    ],
  }

  if (isMac) {
    return [
      // The app menu's "About GreekDir" opens the native panel (see app.setAboutPanelOptions).
      { role: 'appMenu' },
      file,
      edit,
      view,
      { role: 'windowMenu', label: label(t.window) },
    ]
  }

  return [
    file,
    edit,
    view,
    { label: label(t.help), submenu: [{ label: t.about, click: onAbout }] },
  ]
}

export interface AboutInfo {
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
}

/** The text of the About dialog, also what "Copy" puts on the clipboard. */
export function aboutDetail(language: MenuLanguage, info: AboutInfo): string {
  const versionLabel = language === 'es' ? 'Versión' : 'Version'
  return [
    `${versionLabel} ${info.version}`,
    '',
    `Electron ${info.electron} · Chromium ${info.chrome} · Node.js ${info.node}`,
    `${info.platform} ${info.arch}`,
    '',
    '© 2026 CHV Network Technologies',
    language === 'es' ? 'Creado por ARIELL03XY · Licencia MIT' : 'Created by ARIELL03XY · MIT License',
  ].join('\n')
}
