import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { aboutDetail, buildMenuTemplate, menuLanguageFromLocale, type MenuOptions } from './menu'

function build(overrides: Partial<MenuOptions> = {}) {
  return buildMenuTemplate({
    platform: 'win32',
    language: 'en',
    isDev: false,
    onCommand: vi.fn(),
    onAbout: vi.fn(),
    ...overrides,
  })
}

const submenu = (item: MenuItemConstructorOptions) => item.submenu as MenuItemConstructorOptions[]
const roles = (items: MenuItemConstructorOptions[]) => items.map((i) => i.role).filter(Boolean)

describe('buildMenuTemplate', () => {
  it('Windows/Linux: File, Edit, View and Help with About', () => {
    const onAbout = vi.fn()
    const menu = build({ onAbout })
    expect(menu.map((m) => m.label)).toEqual(['&File', '&Edit', '&View', '&Help'])
    const about = submenu(menu[3])[0]
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
    expect(menu.map((m) => m.label)).toEqual(['&Archivo', '&Edición', '&Ver', 'Ay&uda'])
    expect(submenu(menu[3])[0].label).toBe('Acerca de GreekDir')
  })

  it('macOS: native app menu (with About), no Quit in File and no "&" mnemonics', () => {
    const menu = build({ platform: 'darwin' })
    expect(menu[0].role).toBe('appMenu')
    expect(menu.map((m) => m.label).filter(Boolean)).toEqual(['File', 'Edit', 'View', 'Window'])
    expect(roles(submenu(menu[1]))).not.toContain('quit')
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
