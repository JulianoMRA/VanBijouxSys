import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'

// Fontes empacotadas: o app roda offline e antes dependia do Google Fonts,
// caindo em Georgia/system-ui sempre que a cliente estivesse sem internet.
import '@fontsource/dm-sans/300.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'

import './styles/globals.css'
import { registrarErroDaTela } from './utils/registro-de-erros'

// Erro fora da renderização — num clique ou numa promessa sem catch — não passa pelo
// ErrorBoundary. O log do app é o único lugar onde ele fica registrado.
window.addEventListener('error', (evento) =>
  registrarErroDaTela('excecao', evento.error ?? evento.message)
)
window.addEventListener('unhandledrejection', (evento) =>
  registrarErroDaTela('promessa', evento.reason)
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
