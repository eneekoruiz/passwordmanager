import fs from 'node:fs'
import path from 'node:path'
import { chromium, defineConfig, devices } from '@playwright/test'

function resolveLocalChromiumExecutable(): string | undefined {
  if (process.env.CI) return undefined
  try {
    const defaultPath = chromium.executablePath()
    if (defaultPath && fs.existsSync(defaultPath)) return defaultPath
  } catch {
    // Fall through to cached ms-playwright lookup
  }

  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return undefined
  const msPlaywrightDir = path.join(localAppData, 'ms-playwright')
  if (!fs.existsSync(msPlaywrightDir)) return undefined

  const candidates = fs
    .readdirSync(msPlaywrightDir)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()
    .reverse()

  for (const dir of candidates) {
    const exePath = path.join(msPlaywrightDir, dir, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(exePath)) return exePath
  }
  return undefined
}

const localChromiumExecutable = resolveLocalChromiumExecutable()

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromiumExecutable
          ? { launchOptions: { executablePath: localChromiumExecutable } }
          : process.env.CI
            ? {}
            : { channel: 'chrome' }),
      },
    },
  ],
})
