# Van Bijoux Sys

Aplicativo desktop de gestão para negócios de bijuterias. Controla produtos e variações, insumos, vendas, feiras e fluxo de caixa num único lugar, com dashboard analítico e calculadora de precificação. Construí para uma usuária específica que precisava substituir planilhas dispersas por algo que rodasse offline no PC dela.

## Stack

O shell é **Electron 41** porque o app precisa rodar offline no Windows da usuária, com banco local e zero dependência de servidor. O empacotamento sai pelo **electron-builder** como instalador NSIS.

O renderer é **React 18 + TypeScript + Tailwind CSS**. Tailwind resolve o estilo sem abrir arquivos de CSS para cada tela, o que importa num app com muitos formulários parecidos. Os gráficos do dashboard usam **Recharts**, que já traz tudo que eu precisava (barras, linhas, comparativos) sem overhead de D3. O estado global (toasts, preferências) usa **Zustand** — leve o suficiente para não justificar Redux.

A persistência é **SQLite via better-sqlite3**, com **Drizzle ORM** para tipar as queries. SQLite porque o banco vive no disco do usuário; better-sqlite3 porque é síncrono e roda direto no processo principal sem worker. O `postinstall` recompila o binário para o runtime do Electron.

Build e dev server são **electron-vite**, que combina HMR no renderer com reload no main. Testes são **Vitest + sql.js**: sql.js dá um SQLite em memória para integração sem mexer em arquivo real.

## Estrutura

```
src/
├── main/                       # Processo principal (Electron)
│   ├── database/
│   │   ├── index.ts            # Inicialização e migrations
│   │   └── schema.ts           # Esquema Drizzle
│   ├── ipc/                    # Handlers IPC por domínio
│   │   ├── cash.ts             # Fluxo de caixa
│   │   ├── dashboard.ts        # KPIs e agregações
│   │   ├── fairs.ts            # Feiras
│   │   ├── insumos.ts          # Matéria-prima
│   │   ├── products.ts         # Produtos e variações
│   │   └── sales.ts            # Vendas
│   └── index.ts
├── preload/
│   └── index.ts                # Bridge segura (contextBridge)
├── renderer/src/
│   ├── pages/                  # Cash, Dashboard, Fairs, PriceCalculator, Products, Sales, Stock
│   ├── components/             # ui/, products/, sales/, fairs/, insumos/, cash/, layout/
│   ├── hooks/                  # useToast
│   ├── utils/                  # pricing.ts, format.ts
│   └── types/
└── tests/
    ├── helpers/testDb.ts       # SQLite em memória via sql.js
    ├── pricing.test.ts
    ├── format.test.ts
    └── integration/
```

## Rodando localmente

Requer Node.js 22+ e npm 10+.

```bash
npm install
npm run dev
```

O `postinstall` recompila o `better-sqlite3` para o Electron automaticamente. O dev server sobe o app com HMR no renderer.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | App em modo dev com HMR |
| `npm run build` | Compila main, preload e renderer |
| `npm run preview` | Roda o build empacotado sem gerar instalador |
| `npm run build:win` | Gera instalador `.exe` (NSIS) em `dist/` |
| `npm test` | Roda a suíte Vitest uma vez |
| `npm run test:watch` | Vitest em modo watch |
| `npm run typecheck` | Checa tipos TS (main + renderer) sem emitir arquivos |
| `npm run postinstall` | Recompila `better-sqlite3` para o Electron (automático) |

## Design System

O app usa um tema próprio chamado **Atelier**, definido inteiramente em variáveis CSS em `src/renderer/src/styles/atelier.css`. O arquivo é a única folha de estilos do projeto — importa as diretivas `@tailwind base/components/utilities` e define todos os tokens de cor, tipografia e componentes sobre elas.

**Paleta principal** (variáveis `:root`):

| Token | Papel |
|-------|-------|
| `--bg` | Fundo da janela (off-white quente) |
| `--surface` | Cards e painéis |
| `--accent` | Cor de destaque (blush rosado) |
| `--accent-2` | Secundária (vinho/mauve) |
| `--fg` | Texto principal |
| `--fg-dim` | Texto secundário/placeholder |
| `--hairline` | Bordas e divisores |

**Classes de componente** definidas no arquivo (sem Tailwind custom):

- `.btn .btn-primary` / `.btn-ghost` / `.btn-danger` / `.btn-ghost-danger` / `.btn-ghost-good`
- `.page-head`, `.page-kicker`, `.page-title`, `.page-subtitle`
- `.table`, `.num` (alinhamento de colunas numéricas)
- `.empty-state`, `.alert-bar`
- `.modal-overlay`, `.modal`
- `.cash-strip`

O `tailwind.config.js` tem apenas 8 linhas (`content` + `plugins`): nenhuma cor ou fonte custom — todos os tokens vivem no `:root` do `atelier.css`. Classes de layout (`flex`, `gap-*`, `p-*`, `grid-cols-*`) ainda vêm do Tailwind.

## Banco de dados

O arquivo SQLite fica em `%APPDATA%/van-bijoux-sys/vanbijouxsys.db` no Windows. As migrations rodam no boot do app — não há comando manual para aplicar.

Tabelas: `categories`, `products`, `product_variations`, `insumos`, `variation_insumos`, `fairs`, `fair_additional_costs`, `sales`, `sale_items`. O schema canônico está em [src/main/database/schema.ts](src/main/database/schema.ts) e precisa ser espelhado em [src/tests/helpers/testDb.ts](src/tests/helpers/testDb.ts) quando mudar, senão os testes de integração ficam defasados.

## Manutenção

**Adicionar um domínio novo (ex.: despesas recorrentes).** Cria o handler em `src/main/ipc/` e registra em `src/main/ipc/index.ts`; expõe a API no `src/preload/index.ts`; cria a página em `src/renderer/src/pages/` e registra a rota no `App.tsx`; se precisar de tabela, adiciona em `schema.ts` e replica em `testDb.ts`.

**Regras de negócio.** A fórmula de precificação e a formatação de datas/valores ficam em `src/renderer/src/utils/` (`pricing.ts`, `format.ts`). Mudanças ali têm teste dedicado em `src/tests/pricing.test.ts` e `format.test.ts` — atualize junto.

**Dedução de estoque.** Insumos são deduzidos na fabricação (quando se adiciona estoque a uma variação), não na venda. Todas as deduções usam `MAX(0, estoque - quantidade)` para não permitir negativo. A edição de venda faz restauração + novo desconto.

**Ícone do instalador.** O `build:win` depende de `resources/icon.ico`. Para regenerar a partir do SVG, existe `scripts/create-icon.mjs`.

**Versionamento.** Mudanças relevantes ficam em [CHANGELOG.md](CHANGELOG.md); a versão corrente está no `package.json` e é a que o electron-builder usa no instalador.
