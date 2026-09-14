export interface Registro {
  info: (...dados: unknown[]) => void
  warn: (...dados: unknown[]) => void
  error: (...dados: unknown[]) => void
}

let destino: Registro = console

/**
 * O boot liga o `electron-log`, que grava em `<userData>/logs/main.log`. Fica
 * injetável porque o app empacotado não tem console, mas os testes não carregam
 * o Electron de verdade.
 */
export function definirRegistro(novo: Registro): void {
  destino = novo
}

export const registro: Registro = {
  info: (...dados) => destino.info(...dados),
  warn: (...dados) => destino.warn(...dados),
  error: (...dados) => destino.error(...dados)
}
