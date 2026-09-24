import { afterAll, beforeAll } from 'vitest'

/**
 * Roda o arquivo de teste no fuso da cliente (UTC-3, sem horário de verão desde
 * 2019). Em UTC puro, 23h30 local e UTC caem no mesmo dia e o defeito de trocar o
 * dia à noite não aparece. O Node refaz o cálculo de fuso quando TZ muda.
 */
export function noFusoDaCliente(): void {
  let original: string | undefined
  beforeAll(() => {
    original = process.env.TZ
    process.env.TZ = 'America/Sao_Paulo'
  })
  afterAll(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })
}
