export interface Category {
  id: number
  name: string
}

export interface ProductVariation {
  id: number
  productId: number
  identifier: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  minimumStock: number
  createdAt: string
}

export interface Product {
  id: number
  name: string
  categoryId: number
  categoryName: string
  description: string | null
  createdAt: string
  variations: ProductVariation[]
}

export type CreateProductInput = {
  name: string
  categoryId: number
  description?: string
}

export type UpdateProductInput = CreateProductInput & { id: number }

export type CreateVariationInput = {
  productId: number
  identifier: string
  costPrice: number
  salePrice: number
  stockQuantity: number
  minimumStock: number
}

export type UpdateVariationInput = CreateVariationInput & { id: number }

export interface Fair {
  id: number
  name: string
  location: string
  organizer: string | null
  date: string
  enrollmentCost: number
  createdAt: string
}

export type CreateFairInput = {
  name: string
  location: string
  organizer?: string
  date: string
  enrollmentCost: number
}

export type UpdateFairInput = CreateFairInput & { id: number }
