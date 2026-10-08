import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkDeployment } from '../scripts/check-deployment.mjs'

const address = 'https://example.com/viachat/'
const productionHtml =
  '<div id="root"></div><script type="module" src="/viachat/assets/app-abc.js"></script>'
const mock = (html, asset) => async (url) =>
  new URL(url).pathname.endsWith('.js') ? asset : new Response(html, { status: 200 })

test('publicação rejeita HTML de desenvolvimento mesmo com HTTP 200', async () => {
  await assert.rejects(
    checkDeployment(
      address,
      mock('<div id="root"></div><script type="module" src="/src/main.tsx"></script>'),
    ),
    /arquivos de desenvolvimento/,
  )
})
test('publicação detecta JavaScript ausente', async () => {
  await assert.rejects(
    checkDeployment(address, mock(productionHtml, new Response('', { status: 404 }))),
    /JavaScript indisponível/,
  )
})
test('publicação detecta HTML retornado no lugar do JavaScript', async () => {
  await assert.rejects(
    checkDeployment(
      address,
      mock(
        productionHtml,
        new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      ),
    ),
    /não foi servido como JavaScript/,
  )
})
test('publicação aceita JavaScript compilado no subdiretório do site', async () => {
  assert.equal(
    await checkDeployment(
      address,
      mock(
        productionHtml,
        new Response('console.log("app")', { headers: { 'content-type': 'text/javascript' } }),
      ),
    ),
    1,
  )
})
