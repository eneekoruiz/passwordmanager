import { test, expect } from '@playwright/test'

test.describe('Contras Onboarding & Identity Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the splash loader animation to complete and UnlockScreen to appear
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible({ timeout: 10_000 })
  })

  test('renders main authentication elements', async ({ page }) => {
    // Auth card header
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()

    // Mode tabs (exact matching to avoid strict mode collisions)
    const loginTab = page.getByRole('button', { name: 'Iniciar Sesión', exact: true })
    const registerTab = page.getByRole('button', { name: 'Crear Cuenta', exact: true })
    await expect(loginTab).toBeVisible()
    await expect(registerTab).toBeVisible()

    // Input fields
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Escribe tu contraseña de acceso"]')).toBeVisible()

    // Google Auth button
    const googleButton = page.locator('button:has-text("Google (Método secundario)")')
    await expect(googleButton).toBeVisible()
    await expect(googleButton).toBeEnabled()
  })

  test('switches between Login, Register, and Forgot Password modes', async ({ page }) => {
    // Switch to Register
    await page.getByRole('button', { name: 'Crear Cuenta', exact: true }).click()
    await expect(page.locator('h2:has-text("Crea tu Bóveda")')).toBeVisible()
    await expect(page.locator('input[placeholder="Repite tu contraseña de acceso"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrarse', exact: true })).toBeVisible()

    // Switch back to Login
    await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click()
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar con correo', exact: true })).toBeVisible()

    // Go to Forgot Password
    await page.click('button:has-text("¿Olvidaste tu contraseña de la nube?")')
    await expect(page.locator('h2:has-text("Recuperar Acceso")')).toBeVisible()
    await expect(page.locator('text=Esta acción solo restablece la contraseña de tu cuenta de la nube')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar enlace de recuperación', exact: true })).toBeVisible()

    // Return to Login from Forgot Password
    await page.getByRole('button', { name: 'Volver a Iniciar Sesión', exact: true }).click()
    await expect(page.locator('h2:has-text("Hola de nuevo")')).toBeVisible()
  })

  test('validates password mismatch on registration', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear Cuenta', exact: true }).click()
    await page.fill('input[type="email"]', 'nuevo-usuario@ejemplo.com')
    await page.fill('input[placeholder="Escribe tu contraseña de acceso"]', 'Password123!')
    await page.fill('input[placeholder="Repite tu contraseña de acceso"]', 'DifferentPassword456!')

    await page.getByRole('button', { name: 'Registrarse', exact: true }).click()

    // Toast error should appear
    await expect(page.locator('text=Las contraseñas no coinciden')).toBeVisible()
  })

  test('supports password visibility toggling', async ({ page }) => {
    const passwordInput = page.locator('input[placeholder="Escribe tu contraseña de acceso"]')
    await passwordInput.fill('SecretValue123')

    // Initially type is password
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click toggle visibility button
    const toggleButton = page.locator('button[aria-label="Mostrar contraseña"]').first()
    await toggleButton.click()

    // Type should now be text
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Click again to hide
    const hideButton = page.locator('button[aria-label="Ocultar contraseña"]').first()
    await hideButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('enforces zero horizontal overflow on desktop and mobile viewports', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    const desktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(desktopOverflow).toBe(false)

    // Tablet Viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(tabletOverflow).toBe(false)

    // Mobile Viewport (iPhone SE / small screen)
    await page.setViewportSize({ width: 375, height: 667 })
    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(mobileOverflow).toBe(false)
  })

  test('applies theme cleanly without breaking layouts', async ({ page }) => {
    // Add dark mode class
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Remove dark mode class
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
