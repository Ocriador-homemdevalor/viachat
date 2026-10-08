import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { validateCloudConfiguration } from './src/cloudConfig.ts'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuration = validateCloudConfiguration(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  if (command === 'build' && configuration.status === 'invalid')
    throw new Error(
      `${configuration.message} Corrija as variáveis VITE_SUPABASE_* antes de publicar.`,
    )
  return { plugins: [react()], base: env.VITE_BASE_PATH || '/' }
})
