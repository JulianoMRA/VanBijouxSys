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
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className={`font-medium px-4 py-2 rounded-xl transition-colors duration-200 text-sm text-white ${
            danger
              ? 'bg-rose-500 hover:bg-rose-600'
              : 'bg-blush-500 hover:bg-blush-600'
          }`}
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
