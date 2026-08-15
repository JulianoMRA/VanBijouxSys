import { useEffect, useState } from 'react'
import { DatabaseBackup, Download, FolderOpen, RotateCcw, Save } from 'lucide-react'
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

  async function handleVerificarAtualizacoes(): Promise<void> {
    setErro('')
    setOcupado(true)
    try {
      await window.api.app.verificarAtualizacoes()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível verificar atualizações.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal title="Backup e dados" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-bone-200 rounded-control px-4 py-3">
          <p className="text-body text-ink-800">
            {ultimoBackup
              ? `Último backup automático: ${formatarDataHora(ultimoBackup)}`
              : 'Nenhum backup automático ainda — o primeiro é criado na próxima abertura do app.'}
          </p>
          <p className="text-micro text-ink-300 mt-1">
            O aplicativo guarda uma cópia por dia e mantém as 10 mais recentes.
          </p>
        </div>

        {erro && (
          <div className="bg-clay-100 border border-bone-500 rounded-control px-4 py-3">
            <p className="text-body text-clay-600">{erro}</p>
          </div>
        )}

        <div className="space-y-2">
          <button className="btn-primary w-full" onClick={handleExportar} disabled={ocupado}>
            <Save size={16} />
            Salvar backup agora
          </button>
          <p className="text-micro text-ink-300 px-1">
            Guarde a cópia num pendrive ou na nuvem — um backup no mesmo computador não protege
            contra defeito no disco.
          </p>

          <button className="btn-secondary w-full" onClick={handleAbrirPasta} disabled={ocupado}>
            <FolderOpen size={16} />
            Abrir pasta de backups
          </button>

          <button
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-control border border-clay-100 text-body font-medium text-clay-500 hover:bg-clay-100 transition-colors duration-150 disabled:opacity-50"
            onClick={handleRestaurar}
            disabled={ocupado}
          >
            <RotateCcw size={16} />
            Restaurar de um backup
          </button>
          <p className="text-micro text-ink-300 px-1">
            Substitui todos os dados atuais pelos do arquivo escolhido. O app pede confirmação e
            reinicia.
          </p>
        </div>

        <div className="border-t border-bone-300 pt-4 space-y-2">
          <button
            className="btn-secondary w-full"
            onClick={handleVerificarAtualizacoes}
            disabled={ocupado}
          >
            <Download size={16} />
            Verificar atualizações
          </button>
          <p className="text-micro text-ink-300 px-1">
            O aplicativo também procura atualizações sozinho ao abrir. Um backup é feito antes de
            qualquer atualização ser aplicada.
          </p>
        </div>

        {pasta && (
          <p className="text-meta text-ink-200 break-all pt-1 flex items-center gap-1.5">
            <DatabaseBackup size={12} className="shrink-0" />
            {pasta}
          </p>
        )}
      </div>
      {toastMsg && <Toast message={toastMsg} onDismiss={dismissToast} />}
    </Modal>
  )
}
