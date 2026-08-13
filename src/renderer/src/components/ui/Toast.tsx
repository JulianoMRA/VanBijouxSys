import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

interface ToastProps {
  message: string
  onDismiss: () => void
}

export default function Toast({ message, onDismiss }: ToastProps): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-ink-900 text-bone-50 px-4 py-3 rounded-control shadow-pop">
      <CheckCircle size={16} className="text-sage-400" />
      <span className="text-body font-medium">{message}</span>
    </div>
  )
}
