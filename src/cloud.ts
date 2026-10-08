import { createClient } from '@supabase/supabase-js'
import { validateCloudConfiguration } from './cloudConfig'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const cloudConfiguration = validateCloudConfiguration(url, key)
export const cloud = (() => {
  if (cloudConfiguration.status !== 'configured') return null
  return createClient(cloudConfiguration.url, cloudConfiguration.key)
})()
