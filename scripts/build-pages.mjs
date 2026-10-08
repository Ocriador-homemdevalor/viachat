import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { validateCloudConfiguration } from '../src/cloudConfig.ts'

export function pagesEnvironment(env, publicSettings) {
  const override = Boolean(
    env.VITE_SUPABASE_URL?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  )
  const configuration = validateCloudConfiguration(
    override ? env.VITE_SUPABASE_URL : publicSettings.supabaseUrl,
    override ? env.VITE_SUPABASE_PUBLISHABLE_KEY : publicSettings.publishableKey,
  )
  if (configuration.status !== 'configured')
    throw new Error(
      configuration.status === 'invalid'
        ? configuration.message
        : 'Configure a conexão pública antes de publicar.',
    )
  return {
    ...env,
    VITE_BASE_PATH: env.VITE_BASE_PATH || '/viachat/',
    VITE_SUPABASE_URL: configuration.url,
    VITE_SUPABASE_PUBLISHABLE_KEY: configuration.key,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const settings = JSON.parse(
    readFileSync(new URL('../config/pages.json', import.meta.url), 'utf8'),
  )
  const env = pagesEnvironment(process.env, settings)
  console.log('Gerando o Viachat com login e armazenamento no Supabase configurados.')
  const build = spawn('npm', ['run', 'build'], { env, stdio: 'inherit' })
  build.on('error', () => {
    console.error('Não foi possível iniciar o build.')
    process.exitCode = 1
  })
  build.on('exit', (code) => {
    process.exitCode = code ?? 1
  })
}
