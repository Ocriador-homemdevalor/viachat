import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { validateCloudConfiguration } from '../src/cloudConfig.ts'

const url = 'https://test.supabase.co'
const key = 'sb_publishable_configuration_test'
const jwt = (role) =>
  `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ role })).replace(/=/g, '')}.test_signature`

test('sem configuração usa armazenamento local', () => {
  assert.equal(validateCloudConfiguration('', ' ').status, 'local')
})
test('configuração parcial avisa qual requisito falta', () => {
  assert.equal(validateCloudConfiguration(url, '').status, 'invalid')
  assert.equal(validateCloudConfiguration('', key).status, 'invalid')
})
test('aceita chave publishable e normaliza espaços e barra final', () => {
  assert.deepEqual(validateCloudConfiguration(` ${url}/ `, ` ${key} `), {
    status: 'configured',
    url,
    key,
  })
})
test('aceita a chave anon legada e Supabase local', () => {
  assert.equal(validateCloudConfiguration(url, jwt('anon')).status, 'configured')
  assert.equal(validateCloudConfiguration('http://127.0.0.1:54321', key).status, 'configured')
})
test('recusa endereços malformados, inseguros ou com credenciais e caminhos', () => {
  for (const address of [
    'invalido',
    'http://test.supabase.co',
    `${url}/rest/v1`,
    `${url}?token=privado`,
    `${url}#hash`,
    'https://usuario:senha@test.supabase.co',
  ])
    assert.equal(validateCloudConfiguration(address, key).status, 'invalid')
})
test('recusa chaves privadas, de usuário ou malformadas sem expor os valores', () => {
  for (const supplied of [
    'sb_secret_test_private_key',
    jwt('service_role'),
    jwt('authenticated'),
    'not-a-public-key',
    'e30.not-json.signature',
  ]) {
    const result = validateCloudConfiguration(url, supplied)
    assert.equal(result.status, 'invalid')
    assert.equal(JSON.stringify(result).includes(supplied), false)
  }
})
test('build de produção recusa uma chave privada antes de publicar', () => {
  const supplied = 'sb_secret_never_publish_this_test_value'
  const result = spawnSync('npx', ['vite', 'build'], {
    encoding: 'utf8',
    env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: supplied },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Esta chave é privada/)
  assert.equal((result.stdout + result.stderr).includes(supplied), false)
})
