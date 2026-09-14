import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 10000,
    // O padrão do vitest libera `.only` fora de CI, e aqui não há CI: um `it.only`
    // esquecido deixa a suíte verde pulando o resto. Para depurar um teste
    // isolado, VANBIJOUX_ALLOW_ONLY=1 — ou, melhor, filtre com `-t "nome"`.
    allowOnly: !!process.env.VANBIJOUX_ALLOW_ONLY,
    coverage: {
      provider: 'v8',
      include: ['src/main/**', 'src/preload/**', 'src/renderer/src/**'],
      reporter: ['text-summary', 'json-summary', 'html']
    }
  }
})
