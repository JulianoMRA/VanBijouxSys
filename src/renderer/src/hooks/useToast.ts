import { useState, useCallback } from 'react'

export function useToast(): [string, (msg: string) => void, () => void] {
  const [message, setMessage] = useState('')
  const show = useCallback((msg: string) => setMessage(msg), [])
  const dismiss = useCallback(() => setMessage(''), [])
  return [message, show, dismiss]
}
