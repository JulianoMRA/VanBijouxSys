# Van Bijoux Sys

> **v1.5.1** — corrige vulnerabilidades de segurança e qualidade: SQL parametrizado no Dashboard (elimina interpolação de datas em queries), stack trace oculto em produção no ErrorBoundary, try/catch em todos os IPC handlers e funções de carregamento do renderer, ErrorBoundary envolvendo as rotas, schema de testes sincronizado com produção e funções utilitárias centralizadas.

Sistema desktop de gestão para negócios de bijuterias. Controla produtos, estoque, insumos, vendas, feiras e fluxo de caixa, com dashboard analítico e calculadora de precificação.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | KPIs com comparativo do período anterior, painel de insights automáticos, faturamento por categoria, alertas recolhíveis separados por esgotado/baixo, distribuição de vendas por dia dentro de cada feira e filtro de período personalizado |
| **Produtos** | Cadastro de produtos e variações com receita de insumos, mão de obra, modal de detalhes financeiros; busca, filtro por categoria e ordenação |
| **Estoque** | Controle de insumos com busca por nome, filtro por status (baixo/esgotado), ordenação, alerta recolhível de estoque baixo e exportação em CSV |
| **Precificação** | Calculadora com fórmula personalizada, campo de mão de obra, integração com insumos do cadastro e aplicação direta à variação |
| **Vendas** | Registro e edição de vendas por canal (WhatsApp, Instagram, Feira, Outro) com forma de pagamento (Dinheiro, PIX, Débito, Crédito), cálculo de taxa e reajuste automático de estoque |
| **Feiras** | Cadastro de feiras com período multi-dia, custos adicionais e resumo de vendas |
| **Caixa** | Fluxo de caixa com entradas (vendas líquidas), saídas manuais por categoria, custos de feira como saídas automáticas, saldo de abertura, filtros de período pré-definidos e intervalo personalizado |

### Regras de negócio

- **Fórmula de precificação**: `teto((materiais × 3 + mão de obra) × 1,10 + R$ 1,00)`
- **Mão de obra por variação**: custo de `labor_cost` salvo individualmente; valor padrão persistido em `localStorage`
- **Modal de detalhes da variação**: composição de insumos, precificação sugerida e resumo financeiro
- **Dedução de insumos**: ocorre na fabricação (adicionar estoque à variação), não na venda
- **Proteção de estoque negativo**: todas as deduções usam `MAX(0, estoque - quantidade)`
- **Canais de venda**: Feira, WhatsApp, Instagram, Outro
- **Formas de pagamento**: Dinheiro (sem taxa), PIX, Débito e Crédito; taxa (%) preenchida pela usuária com memória da última usada por método; valor líquido calculado automaticamente
- **Fluxo de caixa**: entradas geradas pelas vendas (valor líquido após taxa); saídas manuais com categorias criadas pela usuária; custos de feira (inscrição + adicionais) contabilizados automaticamente como saídas; saldo de abertura configurável; filtros: este mês, 3 meses, 6 meses, este ano, tudo e intervalo personalizado
- **Edição de venda**: todos os campos editáveis com reajuste automático de estoque (devolve itens antigos e desconta os novos)
- **Feiras multi-dia**: suporte a períodos ilimitados com custos extras (combustível, alimentação etc.)

---

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Recharts
- **Backend**: Electron 41 (main process) + better-sqlite3 + Drizzle ORM
- **Build**: electron-vite 3 + electron-builder
- **Testes**: Vitest + sql.js

---

## Pré-requisitos

- Node.js 22+
- npm 10+

---

## Instalação

```bash
npm install
```

> O `postinstall` recompila automaticamente o `better-sqlite3` para o runtime do Electron.

---

## Desenvolvimento

```bash
npm run dev
```

Abre o app em modo desenvolvimento com hot reload no renderer.

---

## Testes

```bash
# Executa todos os testes uma vez
npm test

# Modo watch (re-executa ao salvar)
npm run test:watch
```

Cobertura atual: **62 testes** — unitários + integração.

| Suite | O que testa |
|---|---|
| `pricing.test.ts` | Fórmula de precificação (8 casos) |
| `format.test.ts` | Formatação de datas e cálculos de venda (13 casos) |
| `integration/variations.test.ts` | Dedução de insumos, MAX(0), cascade delete |
| `integration/sales.test.ts` | Criação/deleção de vendas, restauração de estoque |
| `integration/insumos.test.ts` | CRUD, addStock, FK constraint, low stock query |

---

## Build para produção

```bash
# Apenas compila os arquivos
npm run build

# Gera instalador .exe para Windows
npm run build:win
```

O instalador gerado fica em `dist/`.

> Requer o arquivo `resources/icon.ico` para o ícone do instalador.

---

## Estrutura do projeto

```
src/
├── main/                   # Processo principal (Electron)
│   ├── database/
│   │   ├── index.ts        # Inicialização do banco e migrations
│   │   └── schema.ts       # Esquema Drizzle ORM
│   ├── ipc/                # Handlers de comunicação IPC
│   │   ├── products.ts     # Produtos e variações
│   │   ├── sales.ts        # Vendas
│   │   ├── fairs.ts        # Feiras
│   │   ├── insumos.ts      # Insumos
│   │   └── dashboard.ts    # Estatísticas do dashboard
│   └── index.ts            # Entry point do main process
├── preload/
│   └── index.ts            # Bridge segura (contextBridge)
├── renderer/src/           # Interface (React)
│   ├── components/         # Componentes reutilizáveis
│   │   ├── ui/             # Modal, Badge, Toast, ConfirmDialog
│   │   ├── products/       # ProductForm, VariationForm, VariationDetailsModal, AddStockForm
│   │   ├── sales/          # SaleForm
│   │   ├── fairs/          # FairForm
│   │   └── insumos/        # InsumoForm, AddInsumoStockForm
│   ├── pages/              # Páginas da aplicação
│   ├── hooks/              # useToast
│   ├── utils/              # pricing.ts, format.ts
│   └── types/              # Interfaces TypeScript
└── tests/                  # Testes
    ├── helpers/testDb.ts   # Banco SQLite em memória (sql.js)
    ├── pricing.test.ts
    ├── format.test.ts
    └── integration/
```

---

## Banco de dados

O banco SQLite fica em `%APPDATA%/van-bijoux-sys/vanbijouxsys.db` (Windows).

As migrations rodam automaticamente na inicialização — não é necessário nenhum comando manual.

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `categories` | Categorias fixas (Colar, Pulseira, Brinco, Tiara, Pingente) |
| `products` | Produtos com categoria |
| `product_variations` | Variações de cada produto (tamanho, cor etc.) com estoque e mão de obra (`labor_cost`) |
| `insumos` | Matéria-prima com custo e estoque |
| `variation_insumos` | Receita: quantidade de cada insumo por variação |
| `fairs` | Feiras com período e custo de inscrição |
| `fair_additional_costs` | Custos extras por feira |
| `sales` | Vendas registradas por canal |
| `sale_items` | Itens de cada venda |
