import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: that one loads the Electron/renderer plugins, which
// rewrite Node built-ins and break plain-Node unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
