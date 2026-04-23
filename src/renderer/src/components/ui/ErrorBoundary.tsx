import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      const isDev = import.meta.env.DEV
      return (
        <div className="p-8">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--bad)' }}
          >
            Erro ao renderizar a página
          </h2>
          <pre
            className="rounded-[var(--radius-md)] p-4 text-xs overflow-auto whitespace-pre-wrap"
            style={{ background: 'var(--bad-wash)', border: '1px solid var(--bad)', color: 'var(--bad)' }}
          >
            {isDev
              ? `${this.state.error.message}\n\n${this.state.error.stack ?? ''}`
              : 'Ocorreu um erro inesperado. Feche e reabra a aplicação.'}
          </pre>
          <button
            className="btn btn-primary mt-4"
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
