import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = 'Confirmar',
  danger = false
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          style={danger ? { background: 'var(--bad)', color: '#fff' } : undefined}
          onClick={() => { onConfirm(); onClose() }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
