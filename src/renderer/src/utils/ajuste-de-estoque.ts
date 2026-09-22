import type { MotivoDeAjuste } from '../types'

export interface OpcaoDeMotivo {
  motivo: MotivoDeAjuste
  titulo: string
  detalhe: string
}

export interface PerguntaDeEstoque {
  titulo: string
  pergunta: string
  opcoes: [OpcaoDeMotivo, OpcaoDeMotivo]
}

function pecas(quantidade: number): string {
  return `${quantidade} peça${quantidade !== 1 ? 's' : ''}`
}

/**
 * RN-02. Sem receita não há insumo para mover, então o motivo não muda nada e
 * perguntar seria só atrito. `anterior` nulo é o cadastro da variação.
 */
export function precisaPerguntarMotivo(
  anterior: number | null,
  novo: number,
  temReceita: boolean
): boolean {
  if (!temReceita) return false
  return anterior === null ? novo > 0 : novo !== anterior
}

export function descreverPerguntaDeEstoque(
  anterior: number | null,
  novo: number
): PerguntaDeEstoque {
  if (anterior === null) {
    return {
      titulo: 'Estoque inicial',
      pergunta: `Você está cadastrando ${pecas(novo)} em estoque. De onde elas vieram?`,
      opcoes: [
        {
          motivo: 'producao',
          titulo: 'Fiz agora',
          detalhe: `Baixa dos insumos o que a receita usa para ${pecas(novo)}.`
        },
        {
          motivo: 'contagem',
          titulo: 'Já estavam prontas',
          detalhe: 'Não mexe nos insumos: o material dessas peças já tinha saído do estoque.'
        }
      ]
    }
  }

  const diferenca = Math.abs(novo - anterior)
  const titulo = `Estoque de ${anterior} para ${novo}`

  if (novo > anterior) {
    return {
      titulo,
      pergunta: `De onde vieram as ${pecas(diferenca)} a mais?`,
      opcoes: [
        {
          motivo: 'producao',
          titulo: `Produzi ${pecas(diferenca)}`,
          detalhe: 'Baixa dos insumos o que a receita usa.'
        },
        {
          motivo: 'contagem',
          titulo: 'Só estou corrigindo a contagem',
          detalhe: 'As peças já existiam. Não mexe nos insumos.'
        }
      ]
    }
  }

  return {
    titulo,
    pergunta: `Por que saíram ${pecas(diferenca)}?`,
    opcoes: [
      {
        motivo: 'producao',
        titulo: 'Lancei produção a mais por engano',
        detalhe: `Devolve aos insumos o que a receita usa para ${pecas(diferenca)}.`
      },
      {
        motivo: 'contagem',
        titulo: 'Perdi, quebrei ou contei errado',
        detalhe: 'Não mexe nos insumos.'
      }
    ]
  }
}
