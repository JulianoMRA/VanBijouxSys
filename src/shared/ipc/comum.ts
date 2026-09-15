import { z } from 'zod'

/** Id de linha do SQLite: inteiro positivo. */
export const idSchema = z.number().int().positive()
