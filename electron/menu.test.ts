import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { aboutDetail, buildMenuTemplate, dialogText, emptyTrashLabel, menuLanguageFromLocale, type MenuOptions } from './menu'

function build(overrides: Partial<MenuOptions> = {}) {
  return buildMenuTemplate({
    platform: 'win32',
    language: 'en',
    isDev: false,
    onCommand: vi.fn(),
    onAbout: vi.fn(),
    selection: 'none',
    trash: null,
    onCleanup: vi.fn(),
    ...overrides,
  })
}

const submenu = (item: MenuItemConstructorOptions) => item.submenu as MenuItemConstructorOptions[]
const roles = (items: MenuItemConstructorOptions[]) => items.map((i) => i.role).filter(Boolean)

describe('buildMenuTemplate', () => {
  it('Windows/Linux: File, Edit, View, Clean Up and Help with About', () => {
    const onAbout = vi.fn()
    const menu = build({ onAbout })
    expect(menu.map((m) => m.label)).toEqual(['&File', '&Edit', '&View', '&Clean Up', '&Help'])
    const about = submenu(menu[4])[0]
    expect(about.label).toBe('About GreekDir')
    about.click!({} as never, undefined, {} as never)
    expect(onAbout).toHaveBeenCalledOnce()
  })

  it('File → Select Folder sends the select-folder command', () => {
    const onCommand = vi.fn()
    const item = submenu(build({ onCommand })[0])[0]
    expect(item.accelerator).toBe('CmdOrCtrl+O')
    item.click!({} as never, undefined, {} as never)
    expect(onCommand).toHaveBeenCalledWith('select-folder')
  })

  it('has no Reload or developer tools in production', () => {
    const view = submenu(build()[2])
    expect(roles(view)).not.toContain('reload')
    expect(roles(view)).not.toContain('toggleDevTools')
    expect(roles(submenu(build({ isDev: true })[2]))).toEqual(expect.arrayContaining(['reload', 'toggleDevTools']))
  })

  it('is translated to Spanish', () => {
    const menu = build({ language: 'es' })
    expect(menu.map((m) => m.label)).toEqual(['&Archivo', '&Edición', '&Ver', '&Limpieza', 'Ay&uda'])
    expect(submenu(menu[4])[0].label).toBe('Acerca de GreekDir')
  })

  it('macOS: native app menu (with About), no Quit in File and no "&" mnemonics', () => {
    const menu = build({ platform: 'darwin' })
    expect(menu[0].role).toBe('appMenu')
    expect(menu.map((m) => m.label).filter(Boolean)).toEqual(['File', 'Edit', 'View', 'Clean Up', 'Window'])
    expect(roles(submenu(menu[1]))).not.toContain('quit')
  })
})

describe('Clean Up menu', () => {
  const cleanup = (overrides: Partial<MenuOptions> = {}) => {
    const menu = build(overrides)
    return submenu(menu.find((m) => m.label?.replace('&', '') === 'Clean Up')!)
  }
  const byLabel = (items: MenuItemConstructorOptions[], label: string) => items.find((i) => i.label === label)!

  it('disables the actions on the selection while nothing is selected', () => {
    const items = cleanup()
    for (const label of ['Open', 'Show in Explorer', 'Open Terminal Here', 'Move to Recycle Bin', 'Move To…']) {
      expect(byLabel(items, label).enabled, label).toBe(false)
    }
    expect(byLabel(items, 'Empty Recycle Bin').enabled).toBe(true)
  })

  it('runs each action on the selection', () => {
    const onCleanup = vi.fn()
    const items = cleanup({ selection: 'file', onCleanup })
    const expected: Record<string, string> = {
      Open: 'open',
      'Show in Explorer': 'reveal',
      'Open Terminal Here': 'terminal',
      'Move to Recycle Bin': 'trash',
      'Move To…': 'move',
    }
    for (const [label, action] of Object.entries(expected)) {
      const item = byLabel(items, label)
      expect(item.enabled, label).toBe(true)
      item.click!({} as never, undefined, {} as never)
      expect(onCleanup).toHaveBeenLastCalledWith(action)
    }
  })

  it('shows Enter/Delete/Ctrl shortcuts without registering them on Windows (the renderer handles them)', () => {
    const items = cleanup({ selection: 'file' })
    expect(byLabel(items, 'Open')).toMatchObject({ accelerator: 'Enter', registerAccelerator: false })
    expect(byLabel(items, 'Move to Recycle Bin')).toMatchObject({ accelerator: 'Delete', registerAccelerator: false })
    expect(byLabel(items, 'Move To…')).toMatchObject({ accelerator: 'CmdOrCtrl+M', registerAccelerator: false })
  })

  it('labels the Recycle Bin with its size and disables it when empty', () => {
    const full = byLabel(cleanup({ trash: { items: 8, size: 24.6 * 1024 ** 3 } }), 'Empty Recycle Bin (8 items, 24.6 GB)')
    expect(full.enabled).toBe(true)
    const empty = byLabel(cleanup({ trash: { items: 0, size: 0 } }), 'Empty Recycle Bin (empty)')
    expect(empty.enabled).toBe(false)
    expect(emptyTrashLabel('es', 'win32', { items: 1, size: 2048 })).toBe('Vaciar papelera de reciclaje (1 elemento, 2.0 KB)')
  })

  it('offers the Windows cleanup tools only on Windows', () => {
    expect(cleanup().map((i) => i.label)).toEqual(expect.arrayContaining(['Windows Disk Cleanup', 'Installed Apps']))
    const linux = cleanup({ platform: 'linux' }).map((i) => i.label)
    expect(linux).not.toContain('Windows Disk Cleanup')
    expect(linux).toContain('Show in Folder')
    expect(linux).toContain('Empty Trash')
  })

  it('macOS: Finder wording and registered shortcuts', () => {
    const items = cleanup({ platform: 'darwin', selection: 'directory' })
    expect(byLabel(items, 'Show in Finder')).toBeDefined()
    expect(byLabel(items, 'Move to Trash')).toMatchObject({ accelerator: 'CmdOrCtrl+Backspace', registerAccelerator: true })
  })
})

describe('dialogText', () => {
  it('fills placeholders in the menu language', () => {
    expect(dialogText('en', 'trashMessage', { name: 'big.iso', size: '4.0 GB' })).toBe('Move “big.iso” (4.0 GB) to the trash?')
    expect(dialogText('es', 'moveExists', { name: 'a.txt' })).toContain('“a.txt”')
  })
})

describe('menuLanguageFromLocale', () => {
  it('maps Spanish locales to es and everything else to en', () => {
    expect(menuLanguageFromLocale('es-419')).toBe('es')
    expect(menuLanguageFromLocale('ES')).toBe('es')
    expect(menuLanguageFromLocale('en-US')).toBe('en')
    expect(menuLanguageFromLocale('pt-BR')).toBe('en')
  })
})

describe('aboutDetail', () => {
  const info = { version: '1.0.0-beta.1', electron: '45.2.3', chrome: '156.0', node: '24.1.0', platform: 'Windows', arch: 'x64' }

  it('shows the app version first, then runtime versions and the company', () => {
    const lines = aboutDetail('en', info).split('\n')
    expect(lines[0]).toBe('Version 1.0.0-beta.1')
    expect(lines).toContain('Electron 45.2.3 · Chromium 156.0 · Node.js 24.1.0')
    expect(lines).toContain('© 2026 CHV Network Technologies')
  })

  it('is translated to Spanish', () => {
    expect(aboutDetail('es', info).split('\n')[0]).toBe('Versión 1.0.0-beta.1')
  })
})
