import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  UpdateVariationInput
} from '../renderer/src/types'

const api = {
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll')
  },
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
    create: (data: CreateProductInput) => ipcRenderer.invoke('products:create', data),
    update: (data: UpdateProductInput) => ipcRenderer.invoke('products:update', data),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id)
  },
  variations: {
    create: (data: CreateVariationInput) => ipcRenderer.invoke('variations:create', data),
    update: (data: UpdateVariationInput) => ipcRenderer.invoke('variations:update', data),
    delete: (id: number) => ipcRenderer.invoke('variations:delete', id),
    addStock: (id: number, quantity: number) =>
      ipcRenderer.invoke('variations:addStock', id, quantity)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
