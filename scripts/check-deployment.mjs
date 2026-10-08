import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

export async function checkDeployment(address, request = fetch) {
  const base = new URL(address.endsWith('/') ? address : `${address}/`)
  const page = new URL(base)
  page.searchParams.set('viachat-check', `${Date.now()}-${Math.random()}`)
  const response = await request(page, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`O site respondeu HTTP ${response.status}.`)
  const html = await response.text()
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  )
  const assetBase = new URL('assets/', base).pathname
  const compiled = scripts
    .map((src) => new URL(src, base))
    .filter(
      (url) =>
        url.origin === base.origin &&
        url.pathname.startsWith(assetBase) &&
        url.pathname.endsWith('.js'),
    )
  if (!compiled.length || scripts.some((src) => /\.tsx?(?:[?#]|$)/.test(src))) {
    throw new Error(
      'O site publicou arquivos de desenvolvimento. Selecione GitHub Actions em Settings > Pages > Source.',
    )
  }
  for (const url of compiled) {
    const asset = await request(url, { signal: AbortSignal.timeout(15000) })
    if (!asset.ok)
      throw new Error(`JavaScript indisponível: HTTP ${asset.status} em ${url.pathname}.`)
    if (!/javascript|ecmascript/.test(asset.headers.get('content-type') ?? '')) {
      throw new Error(`O arquivo ${url.pathname} não foi servido como JavaScript.`)
    }
  }
  return compiled.length
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const address = process.argv[2]
  if (!address) throw new Error('Informe o endereço do site publicado.')
  let failure
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const count = await checkDeployment(address)
      console.log(
        `Publicação validada: site HTTP 200 e ${count} arquivo(s) JavaScript compilado(s) acessível(is).`,
      )
      process.exitCode = 0
      failure = null
      break
    } catch (error) {
      failure = error
      console.log(`Aguardando propagação da publicação (${attempt}/12): ${error.message}`)
      if (attempt < 12) await delay(5000)
    }
  }
  if (failure) {
    console.error(failure.message)
    process.exitCode = 1
  }
}
