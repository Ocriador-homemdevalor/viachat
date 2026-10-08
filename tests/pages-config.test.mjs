import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pagesEnvironment } from '../scripts/build-pages.mjs'

const settings = {
  supabaseUrl: 'https://test.supabase.co',
  publishableKey: 'sb_publishable_test_public',
}

test('Pages usa a configuração pública quando as variáveis não estão preenchidas', () => {
  const env = pagesEnvironment(
    { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    settings,
  )
  assert.equal(env.VITE_SUPABASE_URL, settings.supabaseUrl)
  assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, settings.publishableKey)
  assert.equal(env.VITE_BASE_PATH, '/viachat/')
})
test('Pages permite substituir ambas as variáveis e preserva a base do repositório', () => {
  const env = pagesEnvironment(
    {
      VITE_SUPABASE_URL: 'https://another.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_another',
      VITE_BASE_PATH: '/another/',
    },
    settings,
  )
  assert.equal(env.VITE_SUPABASE_URL, 'https://another.supabase.co')
  assert.equal(env.VITE_SUPABASE_PUBLISHABLE_KEY, 'sb_publishable_another')
  assert.equal(env.VITE_BASE_PATH, '/another/')
})
test('Pages recusa substituição parcial e chaves privadas antes de gerar o site', () => {
  assert.throws(
    () => pagesEnvironment({ VITE_SUPABASE_URL: 'https://another.supabase.co' }, settings),
    /incompleta/,
  )
  assert.throws(
    () => pagesEnvironment({}, { ...settings, publishableKey: 'sb_secret_test_private' }),
    /chave é privada/,
  )
})
