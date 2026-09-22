import { z } from 'zod'

/** Id de linha do SQLite: inteiro positivo. */
export const idSchema = z.number().int().positive()

/**
 * RN-14. Data como o banco guarda: `AAAA-MM-DD`, que é o que os campos `<input type="date">`
 * mandam, ou com a hora que o próprio SQLite gravou (`AAAA-MM-DD HH:MM:SS`) nos
 * registros antigos, que os relatórios ainda leem. O texto vai direto para o banco e
 * é comparado como texto, então formato errado estraga mês, feira e contas a receber.
 */
export const dataIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/)

/**
 * Data sem hora, do jeito que os campos `<input type="date">` mandam. Usada onde
 * o valor não vem do banco e serve só para recortar o período.
 */
export const dataSimplesSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
