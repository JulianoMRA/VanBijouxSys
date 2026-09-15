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
      include: ['src/main/**', 'src/preload/**', 'src/renderer/src/**', 'src/shared/**'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Catraca: cada piso fica no múltiplo de 5 logo abaixo do medido em
      // 14/09/2026 (linhas: main 66,9 / utils 96,8 / global 26,7). Segura
      // regressão sem quebrar no primeiro commit e sobe quando a camada sobe.
      // Preload e telas (0%) não têm piso próprio até existirem testes de tela;
      // entram só no global, onde o número baixo fica visível.
      thresholds: {
        'src/main/**': { lines: 65, statements: 65, functions: 55, branches: 60 },
        'src/renderer/src/utils/**': { lines: 95, statements: 95, functions: 95, branches: 90 },
        lines: 25,
        statements: 25,
        functions: 20,
        branches: 15
      }
    }
  }
})
