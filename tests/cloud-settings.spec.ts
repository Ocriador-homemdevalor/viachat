import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('configurações: formulário legível no celular, confirmação e URL de retorno sem parâmetros', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  let redirect = ''
  await page.route('https://test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/signup') {
      redirect = url.searchParams.get('redirect_to') ?? ''
      return route.fulfill({
        json: {
          user: { id: '11111111-1111-4111-8111-111111111111', email: 'teste@example.com' },
          session: null,
        },
      })
    }
    return route.fulfill({
      status: 400,
      json: { message: 'Acesso recusado', error_code: 'invalid_credentials' },
    })
  })
  await page.goto('/?v=revision-de-teste')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await expect(page.locator('.settings-panel').first()).toContainText(
    'Até entrar, os dados permanecem neste navegador',
  )
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
  expect(
    await page
      .getByLabel('Senha', { exact: true })
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  expect(
    (
      await new AxeBuilder({ page })
        .include('.settings-panel')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Criar conta', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste')
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await expect(page.getByRole('status')).toContainText('Confira seu e-mail para confirmar')
  expect(redirect).toBe('http://127.0.0.1:5174/')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('status')).toContainText('Não foi possível entrar')
  expect(
    (
      await new AxeBuilder({ page })
        .include('.settings-panel')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
})
