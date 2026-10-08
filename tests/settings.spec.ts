import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const width of [1440, 390, 320]) {
  test(`configurações: leitura e acessibilidade no modo local em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Conta e configurações' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Modo local' })).toContainText(
      'somente neste navegador',
    )
    await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const fonts = await page
      .locator('.settings-panel p')
      .evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)))
    expect(fonts.every((size) => size >= 14)).toBe(true)
    const results = await new AxeBuilder({ page })
      .include('.settings-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
    const backup = page.getByRole('button', { name: 'Exportar backup' })
    await backup.focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Importar backup' })).toBeFocused()
    const download = page.waitForEvent('download')
    await backup.focus()
    await page.keyboard.press('Enter')
    expect((await download).suggestedFilename()).toMatch(/^viachat-backup-.*\.json$/)
    await expect(page.getByRole('status').filter({ hasText: 'Backup exportado' })).toBeVisible()
  })
}

test('configurações: ampliação de 200% mantém ações acessíveis sem rolagem horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await page.evaluate(() => {
    document.body.style.zoom = '2'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  await page.getByRole('button', { name: 'Apagar todos os registros' }).click()
  await expect(page.getByRole('dialog', { name: 'Começar do zero?' })).toBeVisible()
  expect(
    (
      await new AxeBuilder({ page })
        .include('.dialog')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
