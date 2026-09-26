import type { ApiDoApp } from '../../../shared/ipc/api'

declare global {
  interface Window {
    /** Declarado uma vez só, em `shared/ipc/api.ts`, e conferido contra o preload. */
    api: ApiDoApp
  }
}
