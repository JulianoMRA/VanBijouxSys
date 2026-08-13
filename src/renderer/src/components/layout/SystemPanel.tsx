import { useEffect, useState } from 'react'
import { DatabaseBackup, FolderOpen, RotateCcw, Save } from 'lucide-react'
import Modal from '../ui/Modal'
import Toast from '../ui/Toast'
import { useToast } from '../../hooks/useToast'

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SystemPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null)
  const [pasta, setPasta] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [toastMsg, showToast, dismissToast] = useToast()

  async function carregarInfo(): Promise<void> {
    try {
      const info = await window.api.backup.info()
      setUltimoBackup(info.ultimoBackup)
      setPasta(info.pasta)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler informações de backup.')
    }
  }

  useEffect(() => {
    carregarInfo()
  }, [])

  async function handleExportar(): Promise<void> {
    setErro('')
    setOcupado(true)
    try {
      const resultado = await window.api.backup.exportar()
      if (resultado.salvo) {
        showToast('Backup salvo com sucesso.')
        await carregarInfo()
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o backup.')
    } finally {
      setOcupado(false)
    }
  }

  async function handleRestaurar(): Promise<void> {
    setErro('')
    setOcupado(true)
    try {
      await window.api.backup.restaurar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível restaurar o backup.')
    } finally {
      setOcupado(false)
    }
  }

  async function handleAbrirPasta(): Promise<void> {
    setErro('')
    try {
      await window.api.backup.abrirPasta()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível abrir a pasta.')
    }
  }

  return (
    <Modal title="Backup e dados" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-cream-50 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-700">
            {ultimoBackup
              ? `Último backup automático: ${formatarDataHora(ultimoBackup)}`
              : 'Nenhum backup automático ainda — o primeiro é criado na próxima abertura do app.'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            O aplicativo guarda uma cópia por dia e mantém as 10 mais recentes.
          </p>
        </div>

        {erro && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <p className="text-sm text-rose-700">{erro}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={handleExportar}
            disabled={ocupado}
          >
            <Save size={16} />
            Salvar backup agora
          </button>
          <p className="text-xs text-gray-400 px-1">
            Guarde a cópia num pendrive ou na nuvem — um backup no mesmo computador não protege
            contra defeito no disco.
          </p>

          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-cream-300 text-sm font-medium text-gray-600 hover:bg-cream-100 transition-colors disabled:opacity-50"
            onClick={handleAbrirPasta}
            disabled={ocupado}
          >
            <FolderOpen size={16} />
            Abrir pasta de backups
          </button>

          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
            onClick={handleRestaurar}
            disabled={ocupado}
          >
            <RotateCcw size={16} />
            Restaurar de um backup
          </button>
          <p className="text-xs text-gray-400 px-1">
            Substitui todos os dados atuais pelos do arquivo escolhido. O app pede confirmação e
            reinicia.
          </p>
        </div>

        {pasta && (
          <p className="text-[11px] text-gray-300 break-all pt-1 flex items-center gap-1.5">
            <DatabaseBackup size={12} className="shrink-0" />
            {pasta}
          </p>
        )}
      </div>
      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}
    </Modal>
  )
}
