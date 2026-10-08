import { expect, test, type Page } from '@playwright/test'
import { emptyWorkspace, type Workspace } from '../src/model'

const ALICE = '11111111-1111-4111-8111-111111111111'
const BOB = '22222222-2222-4222-8222-222222222222'
type Row = { user_id: string; data: Workspace; updated_at: string }
function workspace(title: string): Workspace {
  const data = emptyWorkspace()
  data.tasks.push({
    id: 'task',
    title,
    date: '2030-01-01',
    time: '',
    area: 'Pessoal',
    priority: 'Alta',
    status: 'A fazer',
  })
  return data
}

async function mockCloud(page: Page) {
  let tick = 0
  const timestamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, ++tick)).toISOString()
  const rows = new Map<string, Row>([
    [ALICE, { user_id: ALICE, data: workspace('Plano de Alice'), updated_at: timestamp() }],
    [BOB, { user_id: BOB, data: workspace('Plano de Bruno'), updated_at: timestamp() }],
  ])
  const state = { failNext: false, conflictNext: false, patches: 0, delay: 0 }
  let activeUser = ALICE
  const user = (uid: string) => ({
    id: uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: uid === ALICE ? 'alice@example.com' : 'bruno@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  })
  const token = (uid: string) =>
    `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`
  await page.route('https://test.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.endsWith('/token')) {
      const body = request.postDataJSON()
      activeUser = body.email === 'bruno@example.com' ? BOB : ALICE
      return route.fulfill({
        json: {
          access_token: token(activeUser),
          refresh_token: 'refresh-test',
          token_type: 'bearer',
          expires_in: 3600,
          user: user(activeUser),
        },
        headers,
      })
    }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user(activeUser), headers })
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers })
    if (url.pathname === '/rest/v1/workspaces') {
      const uid = (url.searchParams.get('user_id') ?? '').replace('eq.', '')
      if (request.method() === 'GET')
        return route.fulfill({ json: rows.has(uid) ? [rows.get(uid)] : [], headers })
      if (request.method() === 'POST') {
        const body = request.postDataJSON()
        const row = { ...body, updated_at: timestamp() }
        rows.set(body.user_id, row)
        return route.fulfill({ json: { updated_at: row.updated_at }, status: 201, headers })
      }
      if (request.method() === 'PATCH') {
        state.patches++
        if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
        if (state.failNext) {
          state.failNext = false
          return route.abort('failed')
        }
        const current = rows.get(uid)!
        if (state.conflictNext) {
          state.conflictNext = false
          current.updated_at = timestamp()
          current.data = workspace('Versão mais recente')
        }
        if (url.searchParams.get('updated_at') !== `eq.${current.updated_at}`)
          return route.fulfill({ json: [], headers })
        const row = { user_id: uid, data: request.postDataJSON().data, updated_at: timestamp() }
        rows.set(uid, row)
        return route.fulfill({ json: [{ updated_at: row.updated_at }], headers })
      }
    }
    return route.fulfill({ status: 404, json: { message: 'Unexpected mocked endpoint' }, headers })
  })
  return { rows, state }
}
async function login(page: Page, email = 'alice@example.com') {
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Entrar na minha conta' }).click()
  await expect(page.getByRole('button', { name: 'Salvo na nuvem' })).toBeVisible()
}
async function routine(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Meu dia', exact: true }).click()
  await page.getByLabel('Todos os dias').check()
}

test('nuvem: carrega a conta, serializa edições e mantém as contas separadas', async ({ page }) => {
  const mock = await mockCloud(page)
  await page.goto('/')
  await login(page)
  await routine(page)
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Plano de Alice')
  mock.state.delay = 600
  await page.getByLabel('Atividade 1', { exact: true }).fill('Primeira alteração')
  await expect.poll(() => mock.state.patches).toBe(1)
  await page.getByLabel('Atividade 1', { exact: true }).fill('Última alteração de Alice')
  await expect
    .poll(() => mock.rows.get(ALICE)!.data.tasks[0].title)
    .toBe('Última alteração de Alice')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await login(page, 'bruno@example.com')
  await routine(page)
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Plano de Bruno')
  await expect
    .poll(() => mock.rows.get(ALICE)!.data.tasks[0].title)
    .toBe('Última alteração de Alice')
})

test('nuvem: conflito preserva alterações locais e permite carregar a versão atual', async ({
  page,
}) => {
  const mock = await mockCloud(page)
  await page.goto('/')
  await login(page)
  await routine(page)
  mock.state.conflictNext = true
  await page.getByLabel('Atividade 1', { exact: true }).fill('Minha alteração pendente')
  await expect(page.getByRole('alert')).toContainText('Há uma versão mais recente na nuvem')
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue(
    'Minha alteração pendente',
  )
  await expect(page.getByLabel('Atividade 1', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Carregar versão atual' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Carregar da nuvem' }).click()
  await expect(page.getByRole('button', { name: 'Salvo na nuvem' })).toBeVisible()
  await page.getByLabel('Todos os dias').check()
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue('Versão mais recente')
  await expect(page.getByLabel('Atividade 1', { exact: true })).toBeEnabled()
})

test('nuvem: falha de rede mantém backup local e reenvia sem apagar dados', async ({ page }) => {
  const mock = await mockCloud(page)
  await page.goto('/')
  await login(page)
  await routine(page)
  mock.state.failNext = true
  await page.getByLabel('Atividade 1', { exact: true }).fill('Alteração offline')
  await expect(page.getByRole('alert')).toContainText('Suas alterações estão neste navegador')
  const saved = await page.evaluate(
    (uid) => JSON.parse(localStorage.getItem(`viachat:workspace:v1:${uid}`)!),
    ALICE,
  )
  expect(saved.tasks[0].title).toBe('Alteração offline')
  expect(mock.rows.get(ALICE)!.data.tasks[0].title).toBe('Plano de Alice')
  await page.getByRole('button', { name: 'Tentar sincronizar' }).click()
  await expect.poll(() => mock.rows.get(ALICE)!.data.tasks[0].title).toBe('Alteração offline')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('nuvem: alterações pendentes sobrevivem ao recarregamento', async ({ page }) => {
  const mock = await mockCloud(page)
  await page.goto('/')
  await login(page)
  await routine(page)
  mock.state.failNext = true
  await page.getByLabel('Atividade 1', { exact: true }).fill('Não perder ao recarregar')
  await expect(page.getByRole('alert')).toContainText('Suas alterações estão neste navegador')
  await page.reload()
  await expect
    .poll(() => mock.rows.get(ALICE)!.data.tasks[0].title)
    .toBe('Não perder ao recarregar')
  await routine(page)
  await expect(page.getByLabel('Atividade 1', { exact: true })).toHaveValue(
    'Não perder ao recarregar',
  )
  expect(
    await page.evaluate(
      (uid) => localStorage.getItem(`viachat:workspace:v1:${uid}:pending`),
      ALICE,
    ),
  ).toBeNull()
})

test('nuvem: conta nova recebe os dados locais, sem copiar outra conta', async ({ page }) => {
  const mock = await mockCloud(page)
  mock.rows.delete(BOB)
  await page.goto('/')
  await login(page)
  await routine(page)
  await page.getByLabel('Atividade 1', { exact: true }).fill('Registro privado de Alice')
  await expect
    .poll(() => mock.rows.get(ALICE)!.data.tasks[0].title)
    .toBe('Registro privado de Alice')
  await page.getByRole('button', { name: 'Conta e configurações' }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await login(page, 'bruno@example.com')
  const imported = mock.rows.get(BOB)!.data
  expect(imported.tasks[0].title).toBe('Planejar as prioridades do dia')
  expect(imported.tasks.some((t) => t.title === 'Registro privado de Alice')).toBe(false)
})
