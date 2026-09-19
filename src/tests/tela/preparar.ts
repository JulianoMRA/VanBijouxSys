import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sem `globals: true`, a limpeza automática da Testing Library não roda: sem ela,
// a tela anterior fica no documento e o teste seguinte encontra dois formulários.
afterEach(() => {
  cleanup()
})
