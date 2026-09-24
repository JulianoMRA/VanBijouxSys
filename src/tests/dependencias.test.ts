import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const raiz = fileURLToPath(new URL('../../', import.meta.url))

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho)
    return nome.endsWith('.ts') ? [caminho] : []
  })
}

/** Nome do pacote de cada import externo: `drizzle-orm/sqlite-core` conta como `drizzle-orm`. */
function pacotesImportados(pastas: string[]): Set<string> {
  const pacotes = new Set<string>()
  for (const arquivo of pastas.flatMap(arquivosTs)) {
    for (const [, especificador] of readFileSync(arquivo, 'utf8').matchAll(
      /from '([^'.][^']*)'/g
    )) {
      const partes = especificador.split('/')
      pacotes.add(especificador.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0])
    }
  }
  return pacotes
}

describe('dependências de produção', () => {
  it('should_only_list_what_the_main_process_loads_at_runtime', () => {
    // Pacote em dependencies vai inteiro para o app.asar. O renderer vai no bundle do
    // Vite: com React, Recharts e lucide ali, eram 73 dos 75 MB do app.asar.
    const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    const usados = pacotesImportados([join(raiz, 'src/main'), join(raiz, 'src/shared')])

    const sobrando = Object.keys(pacote.dependencies).filter((nome) => !usados.has(nome))

    expect(sobrando).toEqual([])
  })
})
