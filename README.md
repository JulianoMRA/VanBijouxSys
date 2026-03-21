# Van Bijoux Sys

Sistema desktop de gestão para negócios de bijuterias. Controla produtos, estoque, insumos, vendas e feiras, com dashboard analítico e calculadora de precificação.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral de faturamento, lucro, ticket médio e alertas de estoque baixo |
| **Produtos** | Cadastro de produtos e variações com receita de insumos; busca, filtro por categoria e ordenação |
| **Estoque** | Controle de insumos com busca por nome, filtro por status (baixo/esgotado) e ordenação |
| **Precificação** | Calculadora com fórmula personalizada, integração com insumos do cadastro e aplicação direta à variação |
| **Vendas** | Registro de vendas por canal (WhatsApp, Instagram, Feira, Outro) |
| **Feiras** | Cadastro de feiras com período multi-dia, custos adicionais e resumo de vendas |

### Regras de negócio

- **Fórmula de precificação**: `teto((materiais × 3 + mão de obra) × 1,10 + R$ 1,00)`
- **Dedução de insumos**: ocorre na fabricação (adicionar estoque à variação), não na venda
- **Proteção de estoque negativo**: todas as deduções usam `MAX(0, estoque - quantidade)`
- **Canais de venda**: Feira, WhatsApp, Instagram, Outro
- **Feiras multi-dia**: suporte a períodos ilimitados com custos extras (combustível, alimentação etc.)

---

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Recharts
- **Backend**: Electron (main process) + better-sqlite3 + Drizzle ORM
- **Build**: electron-vite + electron-builder
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

Cobertura atual: **40 testes** — 21 unitários + 19 de integração.

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
│   │   ├── products/       # ProductForm, VariationForm, AddStockForm
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
| `product_variations` | Variações de cada produto (tamanho, cor etc.) com estoque |
| `insumos` | Matéria-prima com custo e estoque |
| `variation_insumos` | Receita: quantidade de cada insumo por variação |
| `fairs` | Feiras com período e custo de inscrição |
| `fair_additional_costs` | Custos extras por feira |
| `sales` | Vendas registradas por canal |
| `sale_items` | Itens de cada venda |
