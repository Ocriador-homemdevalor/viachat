export type CloudConfiguration =
  | { status: 'local' }
  | { status: 'invalid'; message: string }
  | { status: 'configured'; url: string; key: string }

// Never include supplied values in diagnostics: VITE_* is public build input.
export function validateCloudConfiguration(
  suppliedUrl?: string,
  suppliedKey?: string,
): CloudConfiguration {
  const url = suppliedUrl?.trim() ?? ''
  const key = suppliedKey?.trim() ?? ''
  const invalid = (message: string): CloudConfiguration => ({ status: 'invalid', message })
  if (!url && !key) return { status: 'local' }
  if (!url || !key)
    return invalid(
      'A configuração está incompleta. Faltam o endereço ou a chave pública do Supabase.',
    )
  try {
    const address = new URL(url)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
    if (
      !(address.protocol === 'https:' || (local && address.protocol === 'http:')) ||
      address.username ||
      address.password ||
      address.search ||
      address.hash ||
      address.pathname !== '/'
    )
      return invalid(
        'O endereço do Supabase é inválido. Use a URL do projeto, sem caminhos adicionais.',
      )
  } catch {
    return invalid(
      'O endereço do Supabase é inválido. Use a URL do projeto, sem caminhos adicionais.',
    )
  }
  if (key.startsWith('sb_secret_'))
    return invalid('Esta chave é privada. Use somente a chave pública publishable ou anon.')
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const parts = key.split('.')
      if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)))
        throw new Error('Invalid key')
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.role !== 'anon')
        return invalid('Esta chave não é pública. Use somente a chave publishable ou anon.')
    } catch {
      return invalid('A chave pública do Supabase é inválida. Confira a chave publishable ou anon.')
    }
  }
  return { status: 'configured', url: url.replace(/\/$/, ''), key }
}
