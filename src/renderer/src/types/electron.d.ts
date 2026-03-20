import type {
  Category,
  Product,
  ProductVariation,
  CreateProductInput,
  UpdateProductInput,
  CreateVariationInput,
  UpdateVariationInput
} from '.'

declare global {
  interface Window {
    api: {
      categories: {
        getAll: () => Promise<Category[]>
      }
      products: {
        getAll: () => Promise<Product[]>
        create: (data: CreateProductInput) => Promise<{ id: number }>
        update: (data: UpdateProductInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      variations: {
        create: (data: CreateVariationInput) => Promise<{ id: number }>
        update: (data: UpdateVariationInput) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
        addStock: (id: number, quantity: number) => Promise<{ success: boolean }>
      }
    }
  }
}
