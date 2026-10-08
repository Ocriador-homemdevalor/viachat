import { expect, test, type Page } from '@playwright/test'
import {
  emptyWorkspace,
  isWorkspace,
  progress,
  remaining,
  totals,
  type Workspace,
} from '../src/model'

async function blank(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('viachat:workspace:v1'))
      localStorage.setItem(
        'viachat:workspace:v1',
        JSON.stringify({ version: 1, example: false, tasks: [], entries: [], goals: [] }),
      )
  })
  await page.goto('/')
}
const navigate = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name, exact: true })
    .click()

test('atividade: criar, editar diretamente, concluir e persistir', async ({ page }) => {
  await blank(page)
  await navigate(page, 'Meu dia')
  await page.getByRole('button', { name: 'Nova atividade', exact: true }).first().click()
  await page.getByLabel('O que você vai fazer?').fill('Estudar inglês')
  await page.getByLabel('Horário', { exact: true }).fill('18:30')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Estudar inglês')
  await page.getByLabel('Atividade 1', { exact: true }).fill('Estudar francês')
  await page.getByLabel('Prioridade da atividade 1').selectOption('Alta')
  await page.getByLabel('Concluir atividade 1').click()
  await expect(page.getByLabel('Status da atividade 1')).toHaveValue('Concluído')
  await page.reload()
  await navigate(page, 'Meu dia')
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Estudar francês')
  await expect(page.getByLabel('Status da atividade 1')).toHaveValue('Concluído')
  await page.getByLabel('Data da atividade 1').fill('2030-01-15')
  await expect(page.getByText('Nenhuma atividade neste filtro')).toBeVisible()
  await page.getByLabel('Todos os dias').check()
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Estudar francês')
})

test('finanças: totais, edição decimal e exclusão recalculam o saldo', async ({ page }) => {
  await blank(page)
  await navigate(page, 'Finanças')
  const add = async (description: string, kind: string, amount: string) => {
    await page.getByRole('button', { name: 'Novo lançamento', exact: true }).first().click()
    await page.getByLabel('Descrição', { exact: true }).fill(description)
    await page.getByLabel('Tipo', { exact: true }).selectOption(kind)
    await page.getByLabel('Valor (R$)', { exact: true }).fill(amount)
    await page.getByLabel('Categoria', { exact: true }).fill('Pessoal')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  }
  await add('Pagamento', 'Entrada', '1000')
  await add('Compras', 'Saída', '250.50')
  await expect(page.locator('.stat').filter({ hasText: 'Saldo' }).locator('strong')).toHaveText(
    /749,50/,
  )
  await page.getByLabel('Valor do lançamento 2').fill('100.25')
  await page.getByLabel('Valor do lançamento 2').press('Tab')
  await expect(page.locator('.stat').filter({ hasText: 'Saldo' }).locator('strong')).toHaveText(
    /899,75/,
  )
  await page.getByRole('button', { name: 'Excluir Compras', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir lançamento' }).click()
  await expect(page.locator('.stat').filter({ hasText: 'Saldo' }).locator('strong')).toHaveText(
    /1\.000,00/,
  )
  await page.reload()
  await navigate(page, 'Finanças')
  await expect(page.getByLabel('Descrição do lançamento 1')).toHaveValue('Pagamento')
  await expect(page.getByLabel('Descrição do lançamento 2')).toHaveCount(0)
})

test('metas: gráfico mostra o que falta e passos não contam como dinheiro', async ({ page }) => {
  await blank(page)
  await navigate(page, 'Metas e objetivos')
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click()
  await page.getByLabel('Qual é o seu objetivo?').fill('Comprar um computador')
  await page.getByLabel('Total da meta').fill('5000')
  await page.getByLabel('Já conquistado').fill('1250')
  await page.getByLabel('Por que isso importa para você?').fill('Trabalhar no meu projeto')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(
    page.getByRole('img', { name: /Comprar um computador: 25% alcançado; faltam R\$.*3\.750,00/ }),
  ).toBeVisible()
  await page.getByLabel('Novo passo de Comprar um computador').fill('Separar parte do salário')
  await page.getByLabel('Adicionar passo em Comprar um computador').click()
  await page.getByLabel('Concluir passo 1 de Comprar um computador').check()
  await expect(page.locator('.ring-label strong')).toHaveText('25%')
  await page.getByRole('button', { name: 'Editar Comprar um computador', exact: true }).click()
  await page.getByLabel('Já conquistado').fill('5500')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Meta alcançada', { exact: true })).toBeVisible()
  await expect(page.locator('.ring-label strong')).toHaveText('100%')
  await page.reload()
  await navigate(page, 'Metas e objetivos')
  await expect(page.getByLabel('Concluir passo 1 de Comprar um computador')).toBeChecked()
  await expect(page.getByText('Meta alcançada', { exact: true })).toBeVisible()
})

test('exemplos: apagar pede confirmação e começa com painel vazio', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar do zero' }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByText('Planejar as prioridades do dia', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Começar do zero' }).click()
  await page.getByRole('button', { name: 'Apagar e começar', exact: true }).click()
  await expect(page.getByText('Seu dia está aberto')).toBeVisible()
  await expect(page.locator('.example-banner')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Seu dia está aberto')).toBeVisible()
})

test('backup: exportação válida, importação confirmada e arquivo inválido rejeitado', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(isWorkspace(JSON.parse(Buffer.concat(chunks).toString()))).toBe(true)
  await page
    .getByLabel('Arquivo de backup')
    .setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":1}'),
    })
  await expect(page.getByText(/Arquivo inválido/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const backup = emptyWorkspace()
  backup.goals.push({
    id: 'imported',
    name: 'Viajar para a praia',
    target: 1000,
    current: 100,
    unit: 'R$',
    deadline: '',
    reason: 'Descansar',
    steps: [],
  })
  await page
    .getByLabel('Arquivo de backup')
    .setInputFiles({
      name: 'valid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })
  await expect(page.getByRole('dialog')).toContainText('1 metas')
  await page.getByRole('button', { name: 'Restaurar backup', exact: true }).click()
  await navigate(page, 'Metas e objetivos')
  await expect(page.getByRole('heading', { name: 'Viajar para a praia' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Minha reserva de emergência' })).toHaveCount(0)
})

test('celular: navegação, edição e página sem transbordamento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tudo começa com um bom plano.' })).toBeVisible()
  for (const name of ['Meu dia', 'Finanças', 'Metas e objetivos']) {
    await navigate(page, name)
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(width.scroll).toBeLessThanOrEqual(width.viewport)
  }
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Qual é o seu objetivo?').fill('Correr 100 km')
  await page.getByLabel('Como você vai medir?').selectOption('unidades')
  await page.getByLabel('Total da meta').fill('100')
  await page.getByLabel('Já conquistado').fill('10')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Correr 100 km' })).toBeVisible()
})

test('dados: rejeita datas inválidas, ids duplicados e valores inválidos', () => {
  const sample: Workspace = emptyWorkspace()
  sample.entries.push({
    id: '1',
    date: '2026-02-28',
    description: 'Teste',
    category: 'Pessoal',
    kind: 'Entrada',
    amount: 100,
  })
  expect(isWorkspace(sample)).toBe(true)
  expect(isWorkspace({ ...sample, entries: [{ ...sample.entries[0], date: '2026-02-30' }] })).toBe(
    false,
  )
  expect(isWorkspace({ ...sample, entries: [sample.entries[0], sample.entries[0]] })).toBe(false)
  expect(isWorkspace({ ...sample, entries: [{ ...sample.entries[0], amount: -10 }] })).toBe(false)
  expect(isWorkspace({ ...sample, entries: [{ ...sample.entries[0], amount: Infinity }] })).toBe(
    false,
  )
  const goal = {
    id: 'g',
    name: 'Meta',
    unit: 'R$' as const,
    target: 100,
    current: 150,
    deadline: '',
    reason: '',
    steps: [],
  }
  expect(progress(goal)).toBe(100)
  expect(remaining(goal)).toBe(0)
  expect(isWorkspace({ ...sample, goals: [{ ...goal, target: 0 }] })).toBe(false)
  expect(totals(sample.entries, '2026-02').balance).toBe(100)
  expect(totals(sample.entries, '2026-03').balance).toBe(0)
})
