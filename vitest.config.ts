import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// O padrão do vitest libera `.only` fora de CI, e aqui não há CI: um `it.only`
// esquecido deixa a suíte verde pulando o resto. Para depurar um teste isolado,
// VANBIJOUX_ALLOW_ONLY=1 — ou, melhor, filtre com `-t "nome"`.
const allowOnly = !!process.env.VANBIJOUX_ALLOW_ONLY

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/tests/**/*.test.ts'],
          testTimeout: 10000,
          allowOnly
        }
      },
      {
        // As telas são React: precisam do jsdom e do plugin que compila o JSX.
        plugins: [react()],
        test: {
          name: 'tela',
          environment: 'jsdom',
          include: ['src/tests/tela/**/*.test.tsx'],
          setupFiles: ['src/tests/tela/preparar.ts'],
          testTimeout: 10000,
          allowOnly
        }
      }
    ],
    coverage: {
      provider: 'v8',
      include: ['src/main/**', 'src/preload/**', 'src/renderer/src/**', 'src/shared/**'],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Catraca: cada piso fica no múltiplo de 5 logo abaixo do medido em
      // 19/09/2026, e sobe quando a camada sobe. O preload continua sem piso
      // próprio (0%): entra no global, onde o número baixo fica visível.
      thresholds: {
        // main 74,5 / utils 97,3 / componentes 38,8 / global 43,4 (linhas)
        'src/main/**': { lines: 70, statements: 70, functions: 70, branches: 65 },
        'src/renderer/src/utils/**': { lines: 95, statements: 95, functions: 95, branches: 95 },
        'src/renderer/src/components/**': {
          lines: 35,
          statements: 35,
          functions: 40,
          branches: 40
        },
        lines: 40,
        statements: 40,
        functions: 35,
        branches: 35
      }
    }
  }
})
