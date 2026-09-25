import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
  confirmLabel?: string
  danger?: boolean
  /** Conteúdo entre a mensagem e os botões, como uma opção a marcar. */
  children?: React.ReactNode
}

export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = 'Confirmar',
  danger = false,
  children
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal title={title} onClose={onClose} size="sm" fechaAoClicarFora>
      <p className="text-body text-ink-600 mb-6">{message}</p>
      {children && <div className="-mt-3 mb-6">{children}</div>}
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
