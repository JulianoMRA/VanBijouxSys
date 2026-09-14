/**
 * Decisões de navegação da janela, sem depender do Electron para ter teste.
 *
 * São guardas de fronteira: o que passar por elas carrega NA janela que mantém o
 * preload, com `window.api` inteiro ao alcance — inclusive restaurar backup.
 * Trazidas do Tally (`electron/navegacao.ts`).
 */

/**
 * Uma navegação é interna quando aponta para o MESMO documento que a janela já
 * carrega; só o fragmento pode mudar, que é como o `HashRouter` troca de tela.
 *
 * Compara protocolo, host e caminho em vez de `origin`, porque a origem de toda
 * URL `file:` é a string `'null'` e deixaria passar qualquer arquivo do disco.
 * Também não compara por prefixo: `http://localhost:5173.exemplo.invalido`
 * começa com `http://localhost:5173`. Janela ainda sem página recusa tudo.
 */
export function ehNavegacaoInterna(urlAtual: string, urlDestino: string): boolean {
  if (urlAtual.length === 0) return false

  let atual: URL
  let destino: URL
  try {
    atual = new URL(urlAtual)
    destino = new URL(urlDestino)
  } catch {
    return false
  }

  return (
    destino.protocol === atual.protocol &&
    destino.host === atual.host &&
    destino.pathname === atual.pathname
  )
}

/**
 * Devolve a URL a abrir no navegador do sistema, ou null se não for http(s).
 * A comparação exata de protocolo barra `javascript:`, `file:`, `data:` e os
 * handlers de protocolo do Windows, que o `shell.openExternal` executaria.
 */
export function urlExternaPermitida(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.href
}
