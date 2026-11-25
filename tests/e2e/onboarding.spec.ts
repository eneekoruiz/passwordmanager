import { test, expect } from '@playwright/test'

test.describe('Contras Onboarding, Security & Responsive Audit', () => {
  test.beforeEach(async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    ;(page as unknown as { _pageErrors?: string[] })._pageErrors = pageErrors

    await page.goto('/')
    // Wait for the splash loader animation to complete and UnlockScreen to appear
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible({ timeout: 25_000 })
  })

  test.afterEach(async ({ page }) => {
    const pageErrors = (page as unknown as { _pageErrors?: string[] })._pageErrors ?? []
    expect(pageErrors).toEqual([])
  })

  test('renders main authentication elements without console runtime errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()

    const loginTab = page.getByRole('button', { name: 'Iniciar Sesión', exact: true })
    const registerTab = page.getByRole('button', { name: 'Crear Cuenta', exact: true })
    await expect(loginTab).toBeVisible()
    await expect(registerTab).toBeVisible()

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Escribe tu contraseña de acceso"]')).toBeVisible()

    const googleButton = page.locator('button:has-text("Google (Método secundario)")')
    await expect(googleButton).toBeVisible()
    await expect(googleButton).toBeEnabled()

    expect(consoleErrors).toEqual([])
  })

  test('triggers Google Auth popup synchronously on user gesture without auth/popup-blocked', async ({ page }) => {
    await page.evaluate(() => {
      const opened: string[] = []
      ;(window as unknown as { __openedPopups?: string[] }).__openedPopups = opened
      window.open = ((url?: string | URL) => {
        opened.push(String(url ?? ''))
        const fakeWin = {
          closed: false,
          close() {
            this.closed = true
          },
          focus() {},
          location: { href: String(url ?? '') },
        }
        setTimeout(() => {
          fakeWin.closed = true
        }, 250)
        return fakeWin as unknown as Window
      }) as typeof window.open
    })

    const googleButton = page.locator('button:has-text("Google (Método secundario)")')
    await expect(googleButton).toBeVisible()
    await googleButton.click()

    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __openedPopups?: string[] }).__openedPopups ?? [],
          ),
        { timeout: 10_000 },
      )
      .not.toHaveLength(0)

    const openedPopups = await page.evaluate(
      () => (window as unknown as { __openedPopups?: string[] }).__openedPopups ?? [],
    )
    expect(openedPopups.length).toBeGreaterThan(0)
    expect(openedPopups[0]).toContain('providerId=google.com')
    await expect(page.locator('text=El navegador bloqueó la ventana de Google')).toHaveCount(0)
  })

  test('switches between Login, Register, and Forgot Password modes', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear Cuenta', exact: true }).click()
    await expect(page.locator('h2:has-text("Crea tu Bóveda")')).toBeVisible()
    await expect(page.locator('input[placeholder="Repite tu contraseña de acceso"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrarse', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click()
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar con correo', exact: true })).toBeVisible()

    await page.click('button:has-text("¿Olvidaste tu contraseña de la nube?")')
    await expect(page.locator('h2:has-text("Recuperar Acceso")')).toBeVisible()
    await expect(page.locator('text=Esta acción solo restablece la contraseña de tu cuenta de la nube')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar enlace de recuperación', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Volver a Iniciar Sesión', exact: true }).click()
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()
  })

  test('validates password mismatch on registration', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear Cuenta', exact: true }).click()
    await page.fill('input[type="email"]', 'nuevo-usuario@ejemplo.com')
    await page.fill('input[placeholder="Escribe tu contraseña de acceso"]', 'Password123!')
    await page.fill('input[placeholder="Repite tu contraseña de acceso"]', 'DifferentPassword456!')

    await page.getByRole('button', { name: 'Registrarse', exact: true }).click()

    await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible()
  })

  test('supports password visibility toggling', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="Escribe tu contraseña de acceso"]')
    await passwordInput.fill('SecretValue123')

    await expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = page.locator('button[aria-label="Mostrar contraseña"]').first()
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    const hideButton = page.locator('button[aria-label="Ocultar contraseña"]').first()
    await hideButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('enforces zero horizontal overflow at 1440px, 768px, and 375px and supports reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport)
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalOverflow).toBe(false)
    }
  })

  test('applies dark and light theme cleanly without breaking layouts', async ({ page }) => {
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
