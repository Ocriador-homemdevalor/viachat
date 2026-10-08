import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('configuração incompleta: avisa o problema e conserva os dados locais', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('test.supabase.co')) requests.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await expect(page.getByRole('alert')).toContainText('A configuração está incompleta')
  await expect(page.getByRole('alert')).toContainText('Sincronização indisponível')
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveCount(0)
  expect(
    (
      await new AxeBuilder({ page })
        .include('.settings-panel')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.getByRole('navigation').getByRole('button', { name: 'Meu dia', exact: true }).click()
  await page.getByLabel('Todos os dias').check()
  await page.getByLabel('Atividade 1', { exact: true }).fill('Meus dados continuam acessíveis')
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: 'Meu dia', exact: true }).click()
  await page.getByLabel('Todos os dias').check()
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue(
    'Meus dados continuam acessíveis',
  )
  expect(requests).toEqual([])
})
