/**
 * Nomes dos canais IPC, sem nenhuma dependência de runtime.
 *
 * O preload importa só este arquivo: com `sandbox: true` ele não consegue carregar
 * o zod, então nada que valide pode entrar no bundle dele. Os schemas de cada
 * domínio ficam em arquivos próprios e usam estas mesmas constantes.
 */
export const CANAIS_IPC = {
  categories: {
    getAll: 'categories:getAll'
  },
  products: {
    getAll: 'products:getAll',
    create: 'products:create',
    update: 'products:update',
    delete: 'products:delete',
    setArchived: 'products:setArchived'
  },
  variations: {
    create: 'variations:create',
    update: 'variations:update',
    delete: 'variations:delete',
    addStock: 'variations:addStock',
    setSalePrice: 'variations:setSalePrice',
    setArchived: 'variations:setArchived'
  },
  fairs: {
    getAll: 'fairs:getAll',
    create: 'fairs:create',
    update: 'fairs:update',
    delete: 'fairs:delete'
  },
  sales: {
    getAll: 'sales:getAll',
    create: 'sales:create',
    update: 'sales:update',
    delete: 'sales:delete',
    markAsReceived: 'sales:markAsReceived',
    unmarkAsReceived: 'sales:unmarkAsReceived'
  },
  dashboard: {
    getStats: 'dashboard:getStats'
  },
  insumos: {
    getAll: 'insumos:getAll',
    create: 'insumos:create',
    update: 'insumos:update',
    addStock: 'insumos:addStock',
    delete: 'insumos:delete',
    setArchived: 'insumos:setArchived',
    exportCsv: 'insumos:exportCsv'
  },
  expenseCategories: {
    getAll: 'expense-categories:getAll',
    create: 'expense-categories:create',
    update: 'expense-categories:update',
    delete: 'expense-categories:delete'
  },
  cashExpenses: {
    getAll: 'cash-expenses:getAll',
    create: 'cash-expenses:create',
    update: 'cash-expenses:update',
    delete: 'cash-expenses:delete',
    getStats: 'cash-expenses:getStats'
  },
  cashSettings: {
    get: 'cash-settings:get',
    setOpeningBalance: 'cash-settings:setOpeningBalance'
  },
  backup: {
    exportar: 'backup:exportar',
    restaurar: 'backup:restaurar',
    info: 'backup:info',
    abrirPasta: 'backup:abrirPasta'
  },
  app: {
    versao: 'app:versao',
    verificarAtualizacoes: 'app:verificarAtualizacoes'
  }
} as const
