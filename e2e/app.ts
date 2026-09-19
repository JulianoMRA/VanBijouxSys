import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface AppDeTeste {
  janela: Page
  app: ElectronApplication
  /** Erros de console e exceções vistos desde a abertura. */
  errosDeConsole: string[]
  pastaDeDados: string
}

/**
 * Cada teste abre o app numa pasta de dados nova: banco vazio, migrações
 * aplicadas no boot, nada da máquina de quem roda. `VANBIJOUX_USER_DATA` é lido
 * antes do lock de instância única, então os testes não brigam entre si nem com
 * o app instalado.
 */
export const test = base.extend<{ vanBijoux: AppDeTeste }>({
  vanBijoux: async ({}, use) => {
    const pastaDeDados = mkdtempSync(join(tmpdir(), 'van-bijoux-e2e-'))
    const app = await _electron.launch({
      args: [RAIZ],
      env: { ...process.env, VANBIJOUX_USER_DATA: pastaDeDados }
    })

    const janela = await app.firstWindow()
    const errosDeConsole: string[] = []
    janela.on('console', (mensagem) => {
      if (mensagem.type() === 'error') errosDeConsole.push(mensagem.text())
    })
    janela.on('pageerror', (erro) => errosDeConsole.push(erro.message))
    await janela.waitForSelector('text=Van Bijoux')

    await use({ janela, app, errosDeConsole, pastaDeDados })

    await app.close()
    rmSync(pastaDeDados, { recursive: true, force: true })
  }
})

export { expect } from '@playwright/test'

/** Chama um canal IPC pela própria janela, para semear dados sem passar pela tela. */
export async function pelaApi<T>(
  janela: Page,
  canal: string,
  ...argumentos: unknown[]
): Promise<T> {
  return janela.evaluate(
    ([caminho, args]) => {
      const partes = (caminho as string).split('.')
      const api = window as unknown as Record<string, unknown>
      let alvo: unknown = api['api']
      for (const parte of partes) {
        alvo = (alvo as Record<string, unknown>)[parte]
      }
      return (alvo as (...a: unknown[]) => Promise<T>)(...(args as unknown[]))
    },
    [canal, argumentos] as const
  )
}

/** Vai para uma tela pelo menu lateral e espera o título aparecer. */
export async function irPara(janela: Page, nome: string): Promise<void> {
  await janela.getByRole('link', { name: nome, exact: true }).click()
  await janela.waitForTimeout(400)
}
