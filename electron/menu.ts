/**
 * The application menu, as plain data so it can be unit-tested without Electron.
 * main.ts builds it with Menu.buildFromTemplate() and rebuilds it when the UI language changes.
 */
import type { MenuItemConstructorOptions } from 'electron'
import { formatSize } from '../src/utils/format'
import type { TrashInfo } from './fileActions'

export type MenuLanguage = 'en' | 'es'

/** Commands the menu sends to the renderer over the 'menu-command' channel. */
export type MenuCommand = 'select-folder'

/** What is selected in the results view; the Clean Up items that act on it are disabled without one. */
export type SelectionKind = 'none' | 'file' | 'directory'

/** Clean Up menu actions, run by main.ts on the current selection (or system-wide). */
export type CleanupAction = 'open' | 'reveal' | 'terminal' | 'trash' | 'move' | 'empty-trash' | 'disk-cleanup' | 'installed-apps'

export interface MenuOptions {
  platform: NodeJS.Platform
  language: MenuLanguage
  /** Development build: adds Reload and the developer tools. */
  isDev: boolean
  /** Runs a renderer command (sent over IPC by main.ts). */
  onCommand: (command: MenuCommand) => void
  /** Shows the About dialog (Windows/Linux; macOS uses the native About panel). */
  onAbout: () => void
  /** Current selection in the results view. */
  selection: SelectionKind
  /** Size of the Recycle Bin / Trash, or null while unknown or unreadable. */
  trash: TrashInfo | null
  onCleanup: (action: CleanupAction) => void
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
    cleanup: '&Clean Up',
    open: 'Open',
    revealWin: 'Show in Explorer',
    revealMac: 'Show in Finder',
    revealLinux: 'Show in Folder',
    terminal: 'Open Terminal Here',
    trashWin: 'Move to Recycle Bin',
    trashOther: 'Move to Trash',
    moveTo: 'Move To…',
    emptyWin: 'Empty Recycle Bin',
    emptyOther: 'Empty Trash',
    emptyCount: '{{items}} items, {{size}}',
    emptyOne: '1 item, {{size}}',
    emptyNone: 'empty',
    diskCleanup: 'Windows Disk Cleanup',
    installedApps: 'Installed Apps',
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
    cleanup: '&Limpieza',
    open: 'Abrir',
    revealWin: 'Mostrar en el Explorador',
    revealMac: 'Mostrar en Finder',
    revealLinux: 'Mostrar en la carpeta',
    terminal: 'Abrir terminal aquí',
    trashWin: 'Mover a la papelera de reciclaje',
    trashOther: 'Mover a la papelera',
    moveTo: 'Mover a…',
    emptyWin: 'Vaciar papelera de reciclaje',
    emptyOther: 'Vaciar papelera',
    emptyCount: '{{items}} elementos, {{size}}',
    emptyOne: '1 elemento, {{size}}',
    emptyNone: 'vacía',
    diskCleanup: 'Liberador de espacio en disco de Windows',
    installedApps: 'Aplicaciones instaladas',
  },
} satisfies Record<MenuLanguage, Record<string, string>>

export function menuLabels(language: MenuLanguage) {
  return LABELS[language]
}

/** The UI language for the menu: 'es' for Spanish locales, otherwise 'en'. */
export function menuLanguageFromLocale(locale: string): MenuLanguage {
  return locale.toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** "8 items, 24.6 GB" / "1 item, 2.0 KB" / "empty". */
export function trashSummary(language: MenuLanguage, trash: TrashInfo): string {
  const t = LABELS[language]
  const template = trash.items === 0 ? t.emptyNone : trash.items === 1 ? t.emptyOne : t.emptyCount
  return template.replace('{{items}}', trash.items.toLocaleString(language)).replace('{{size}}', formatSize(trash.size))
}

/** "Empty Recycle Bin (8 items, 24.6 GB)"; just the name while the size is unknown. */
export function emptyTrashLabel(language: MenuLanguage, platform: NodeJS.Platform, trash: TrashInfo | null): string {
  const t = LABELS[language]
  const name = platform === 'win32' ? t.emptyWin : t.emptyOther
  return trash ? `${name} (${trashSummary(language, trash)})` : name
}

function cleanupMenu({ platform, language, selection, trash, onCleanup }: MenuOptions): MenuItemConstructorOptions[] {
  const t = LABELS[language]
  const isMac = platform === 'darwin'
  const hasSelection = selection !== 'none'
  // Windows/Linux: the renderer handles these keys itself (so Enter and Delete keep working in
  // text fields); the menu only displays them. macOS registers them as usual.
  const keys = isMac
    ? { open: 'CmdOrCtrl+Down', reveal: 'CmdOrCtrl+E', terminal: 'CmdOrCtrl+T', trash: 'CmdOrCtrl+Backspace', move: undefined }
    : { open: 'Enter', reveal: 'CmdOrCtrl+E', terminal: 'CmdOrCtrl+T', trash: 'Delete', move: 'CmdOrCtrl+M' }
  const item = (label: string, action: CleanupAction, accelerator: string | undefined, enabled = true): MenuItemConstructorOptions => ({
    label,
    enabled,
    click: () => onCleanup(action),
    ...(accelerator ? { accelerator, registerAccelerator: isMac } : {}),
  })
  const reveal = platform === 'win32' ? t.revealWin : isMac ? t.revealMac : t.revealLinux
  return [
    item(t.open, 'open', keys.open, hasSelection),
    item(reveal, 'reveal', keys.reveal, hasSelection),
    item(t.terminal, 'terminal', keys.terminal, hasSelection),
    { type: 'separator' },
    item(platform === 'win32' ? t.trashWin : t.trashOther, 'trash', keys.trash, hasSelection),
    item(t.moveTo, 'move', keys.move, hasSelection),
    { type: 'separator' },
    item(emptyTrashLabel(language, platform, trash), 'empty-trash', undefined, trash?.items !== 0),
    ...(platform === 'win32'
      ? [
          { type: 'separator' } as const,
          item(t.diskCleanup, 'disk-cleanup', undefined),
          item(t.installedApps, 'installed-apps', undefined),
        ]
      : []),
  ]
}

export function buildMenuTemplate(options: MenuOptions): MenuItemConstructorOptions[] {
  const { platform, language, isDev, onCommand, onAbout } = options
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

  const cleanup: MenuItemConstructorOptions = { label: label(t.cleanup), submenu: cleanupMenu(options) }

  if (isMac) {
    return [
      // The app menu's "About GreekDir" opens the native panel (see app.setAboutPanelOptions).
      { role: 'appMenu' },
      file,
      edit,
      view,
      cleanup,
      { role: 'windowMenu', label: label(t.window) },
    ]
  }

  return [
    file,
    edit,
    view,
    cleanup,
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

const DIALOGS = {
  en: {
    cancel: 'Cancel',
    openRunTitle: 'Run this program?',
    openRunMessage: '“{{name}}” is a program or script. Opening it will run it.',
    openRunDetail: 'Only run it if you know what it is and where it came from.',
    openRunConfirm: 'Run',
    trashTitle: 'Move to trash',
    trashMessage: 'Move “{{name}}” ({{size}}) to the trash?',
    trashDetail: 'You can restore it from the trash until it is emptied.',
    trashConfirm: 'Move to trash',
    emptyTitle: 'Empty the trash',
    emptyMessage: 'Permanently delete everything in the trash ({{detail}})?',
    emptyMessageUnknown: 'Permanently delete everything in the trash?',
    emptyDetail: 'This cannot be undone. Items deleted from every drive are included.',
    emptyConfirm: 'Empty',
    moveTitle: 'Move “{{name}}” to…',
    moveButton: 'Move here',
    openFailed: 'Could not open “{{name}}”.',
    terminalFailed: 'Could not open a terminal in “{{dir}}”.',
    trashFailed: 'Could not move “{{name}}” to the trash (in use, or no permission).',
    emptyFailed: 'Could not empty the trash.',
    moveSameFolder: '“{{name}}” is already in that folder.',
    moveInside: 'A folder cannot be moved into itself.',
    moveExists: 'That folder already has an item named “{{name}}”. Nothing was moved.',
    moveFailed: 'Could not move “{{name}}” (in use, or no permission). Nothing was changed.',
    moveSourceKept: '“{{name}}” was copied to {{dest}}, but the original could not be deleted. Both copies exist now.',
  },
  es: {
    cancel: 'Cancelar',
    openRunTitle: '¿Ejecutar este programa?',
    openRunMessage: '“{{name}}” es un programa o script. Abrirlo lo ejecutará.',
    openRunDetail: 'Ejecútalo solo si sabes qué es y de dónde viene.',
    openRunConfirm: 'Ejecutar',
    trashTitle: 'Mover a la papelera',
    trashMessage: '¿Mover “{{name}}” ({{size}}) a la papelera?',
    trashDetail: 'Puedes restaurarlo desde la papelera hasta que la vacíes.',
    trashConfirm: 'Mover a la papelera',
    emptyTitle: 'Vaciar la papelera',
    emptyMessage: '¿Borrar definitivamente todo lo que hay en la papelera ({{detail}})?',
    emptyMessageUnknown: '¿Borrar definitivamente todo lo que hay en la papelera?',
    emptyDetail: 'No se puede deshacer. Incluye lo borrado de todas las unidades.',
    emptyConfirm: 'Vaciar',
    moveTitle: 'Mover “{{name}}” a…',
    moveButton: 'Mover aquí',
    openFailed: 'No se pudo abrir “{{name}}”.',
    terminalFailed: 'No se pudo abrir una terminal en “{{dir}}”.',
    trashFailed: 'No se pudo mover “{{name}}” a la papelera (en uso, o sin permiso).',
    emptyFailed: 'No se pudo vaciar la papelera.',
    moveSameFolder: '“{{name}}” ya está en esa carpeta.',
    moveInside: 'Una carpeta no se puede mover dentro de sí misma.',
    moveExists: 'Esa carpeta ya tiene un elemento llamado “{{name}}”. No se movió nada.',
    moveFailed: 'No se pudo mover “{{name}}” (en uso, o sin permiso). No se cambió nada.',
    moveSourceKept: '“{{name}}” se copió a {{dest}}, pero no se pudo borrar el original. Ahora existen las dos copias.',
  },
} satisfies Record<MenuLanguage, Record<string, string>>

export type DialogKey = keyof (typeof DIALOGS)['en']

/** A native-dialog string in the menu language, with {{placeholders}} filled in. */
export function dialogText(language: MenuLanguage, key: DialogKey, values: Record<string, string> = {}): string {
  return Object.entries(values).reduce((text, [k, v]) => text.split(`{{${k}}}`).join(v), DIALOGS[language][key] as string)
}
