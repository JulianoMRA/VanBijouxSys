import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  // O Vite emite estilos inline e o recharts aplica style no elemento.
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "frame-ancestors 'none'"

/**
 * A CSP só entra no HTML de produção: em dev o HMR do Vite precisa de inline
 * script e eval, e uma política estrita no arquivo-fonte quebraria o `npm run dev`.
 * Em produção o renderer carrega por file://, onde não há header HTTP para
 * interceptar — a meta tag é o único ponto que funciona.
 */
function cspProducaoPlugin(): Plugin {
  return {
    name: 'csp-producao',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<title>',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <title>`
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), cspProducaoPlugin()]
  }
})
