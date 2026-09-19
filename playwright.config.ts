import { defineConfig } from '@playwright/test'

/**
 * E2E no Electron de verdade. Não entra no pipeline normal: cada fluxo sobe o
 * app, e a suíte inteira leva minutos. Roda com `npm run test:e2e`, que faz o
 * build antes — o app empacotado é o que os testes abrem.
 *
 * Um worker só: cada teste abre uma janela do Electron, e mais de uma ao mesmo
 * tempo disputa foco e deixa o resultado instável.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
