// Tipos de insumo vêm do contrato do canal, com os schemas que o main valida.
export type {
  CreateInsumoInput,
  Insumo,
  InsumoUnit,
  UpdateInsumoInput
} from '../../../shared/ipc/insumos'

// Tipos de produto e variação vêm do contrato dos canais de produtos.
export type {
  AjusteDeEstoque,
  Category,
  CreateProductInput,
  CreateVariationInput,
  DeleteVariationOptions,
  MotivoDeAjuste,
  Product,
  ProductVariation,
  UpdateProductInput,
  UpdateVariationInput,
  VariationInsumo
} from '../../../shared/ipc/produtos'

// Tipos de feira vêm do contrato dos canais de feiras.
export type {
  CreateFairInput,
  Fair,
  FairAdditionalCost,
  UpdateFairInput
} from '../../../shared/ipc/feiras'

// Tipos de venda vêm do contrato dos canais de vendas.
export type {
  CreateSaleInput,
  CreateSaleItemInput,
  PaymentMethod,
  ReceivedPaymentMethod,
  RegisterPaymentInput,
  Sale,
  SaleChannel,
  SaleItem,
  SalePayment,
  UpdateSaleInput
} from '../../../shared/ipc/vendas'

// Tipos de caixa vêm do contrato dos canais de despesas e configurações.
export type {
  CashExpense,
  CashSettings,
  CreateCashExpenseInput,
  CreateExpenseCategoryInput,
  ExpenseCategory,
  UpdateCashExpenseInput,
  UpdateExpenseCategoryInput
} from '../../../shared/ipc/caixa'

// Tipos do painel vêm do contrato do canal do painel.
export type { DashboardParams, DashboardStats } from '../../../shared/ipc/painel'

// Tipos de backup vêm do contrato dos canais de backup e do aplicativo.
export type {
  BackupInfo,
  ErroDaTela,
  ResultadoDaExportacao,
  ResultadoDaRestauracao
} from '../../../shared/ipc/backup'
