# Van Bijoux Sys

Aplicativo desktop de gestão para negócios de bijuterias. Controla produtos e variações, insumos, vendas, feiras e fluxo de caixa num único lugar, com dashboard analítico e calculadora de precificação. Construí para uma usuária específica que precisava substituir planilhas dispersas por algo que rodasse offline no PC dela.

## Stack

O shell é **Electron 41** porque o app precisa rodar offline no Windows da usuária, com banco local e zero dependência de servidor. O empacotamento sai pelo **electron-builder** como instalador NSIS.

O renderer é **React 18 + TypeScript + Tailwind CSS**. Tailwind resolve o estilo sem abrir arquivos de CSS para cada tela, o que importa num app com muitos formulários parecidos. Os gráficos do dashboard usam **Recharts**, que já traz tudo que eu precisava (barras, linhas, comparativos) sem overhead de D3. O estado global (toasts, preferências) usa **Zustand** — leve o suficiente para não justificar Redux.

A persistência é **SQLite via better-sqlite3**, com **Drizzle ORM** para tipar as queries. SQLite porque o banco vive no disco do usuário; better-sqlite3 porque é síncrono e roda direto no processo principal sem worker. O `postinstall` recompila o binário para o runtime do Electron.

Build e dev server são **electron-vite**, que combina HMR no renderer com reload no main. Testes são **Vitest + sql.js**: sql.js dá um SQLite em memória para integração sem mexer em arquivo real.

A distribuição usa **electron-updater** contra as releases do GitHub, com **electron-log** para deixar rastro do que o updater fez. Não há CI: a verificação roda em hooks locais de git (**husky** + **lint-staged** + **commitlint**), então lint, tipos e testes são checados na máquina antes do commit e do push.

## Estrutura

```
src/
├── main/                       # Processo principal (Electron)
│   ├── database/
│   │   ├── index.ts            # Inicialização e migrations
│   │   ├── schema.ts           # Esquema Drizzle
│   │   ├── backup.ts           # Backup, validação e restauração
│   │   └── backup-rules.ts     # Regras puras de nomenclatura e rotação
│   ├── ipc/                    # Handlers IPC por domínio
│   │   ├── handle.ts           # Wrapper que padroniza erro dos handlers
│   │   ├── mensagens.ts        # Tradução de erro técnico para a usuária
│   │   ├── backup.ts           # Backup, restauração e versão do app
│   │   ├── cash.ts             # Fluxo de caixa
│   │   ├── dashboard.ts        # KPIs e agregações
│   │   ├── fairs.ts            # Feiras
│   │   ├── insumos.ts          # Matéria-prima
│   │   ├── products.ts         # Produtos e variações
│   │   └── sales.ts            # Vendas
│   ├── updater.ts              # Auto-atualização via GitHub Releases
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

| Comando               | O que faz                                               |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | App em modo dev com HMR                                 |
| `npm run build`       | Compila main, preload e renderer                        |
| `npm run preview`     | Roda o build empacotado sem gerar instalador            |
| `npm run build:win`   | Gera instalador `.exe` (NSIS) em `dist/`                |
| `npm test`            | Roda a suíte Vitest uma vez                             |
| `npm run test:watch`  | Vitest em modo watch                                    |
| `npm run typecheck`   | Verifica tipos dos dois projetos (main/preload e web)   |
| `npm run lint`        | ESLint em `src/`                                        |
| `npm run lint:fix`    | ESLint corrigindo o que der                             |
| `npm run format`      | Prettier no projeto inteiro                             |
| `npm run postinstall` | Recompila `better-sqlite3` para o Electron (automático) |

## Verificação

Não há CI. As checagens rodam em hooks locais instalados pelo husky:

| Hook         | O que roda                          |
| ------------ | ----------------------------------- |
| `pre-commit` | `lint-staged` (ESLint + Prettier)   |
| `commit-msg` | `commitlint` (Conventional Commits) |
| `pre-push`   | `npm run typecheck && npm test`     |

O `npm install` instala os hooks pelo script `prepare`.

## Banco de dados

O arquivo SQLite fica em `%APPDATA%/van-bijoux-sys/vanbijouxsys.db` no Windows. As migrations rodam no boot do app — não há comando manual para aplicar.

Tabelas: `categories`, `products`, `product_variations`, `insumos`, `variation_insumos`, `fairs`, `fair_additional_costs`, `sales`, `sale_items`, `expense_categories`, `cash_expenses`, `cash_settings`. O schema canônico está em [src/main/database/schema.ts](src/main/database/schema.ts) e precisa ser espelhado em [src/tests/helpers/testDb.ts](src/tests/helpers/testDb.ts) quando mudar, senão os testes de integração ficam defasados.

A tabela `sales` aceita `payment_method = 'areceber'` (fiado) com `received_at IS NULL`. Quando o cliente paga, o handler `sales:markAsReceived` troca o `payment_method` pelo método real (dinheiro/PIX/débito/crédito), aplica taxa se houver e grava `received_at`. Vendas pendentes contam em faturamento e lucro do Dashboard mas não entram no Caixa — entram apenas após o recebimento, pela data de `received_at`.

## Backup

Os backups ficam em `%APPDATA%/van-bijoux-sys/backups`. O app cria uma cópia no primeiro boot de cada dia e mantém as 10 mais recentes; a cópia usa a API de backup do SQLite, consistente mesmo com o WAL ativo. Também é feito um backup antes de aplicar uma atualização.

A restauração ([src/main/database/backup.ts](src/main/database/backup.ts)) valida integridade e presença das tabelas principais, guarda o estado atual numa cópia, sobrescreve o banco, apaga os arquivos `-wal`/`-shm` e reinicia o app — a conexão e os prepared statements não sobrevivem à troca do arquivo.

Backup na mesma máquina não protege contra defeito de disco. A exportação manual existe para a cópia sair do computador.

## Publicando uma versão

O app se atualiza pelas releases do GitHub via electron-updater. O fluxo é:

1. Subir a versão do `package.json` (`npm version patch|minor|major`, que já cria o commit e a tag) e registrar as mudanças no CHANGELOG.
2. Gerar e publicar:

```bash
npm run build && npx electron-builder --win --publish always
```

O `electron-builder` precisa de um token no ambiente (`GH_TOKEN`) com permissão de escrita em releases; ele sobe o instalador e o `latest.yml`, que é o arquivo lido pelo updater. O repositório é público, então o app baixa a atualização sem token nenhum.

Duas ressalvas: o instalador não é assinado, então o SmartScreen alerta na instalação; e o `artifactName` precisa continuar sem espaços, senão o nome do arquivo diverge do que o `latest.yml` referencia e a atualização falha com 404.

## Erros no IPC

Todo handler é registrado por `handleIpc` ([src/main/ipc/handle.ts](src/main/ipc/handle.ts)), que faz a falha sempre virar exceção — nunca um `{ success: false }` de retorno, que o renderer ignorava silenciosamente. A tradução de erro técnico (violação de chave estrangeira, nome duplicado) para texto que a cliente entende fica em [src/main/ipc/mensagens.ts](src/main/ipc/mensagens.ts), indexada por canal; um canal novo sem entrada cai numa mensagem genérica. No renderer, sempre trate a chamada com `try/catch` e mostre `err.message`.

## Manutenção

**Adicionar um domínio novo (ex.: despesas recorrentes).** Cria o handler em `src/main/ipc/` e registra em `src/main/ipc/index.ts`; expõe a API no `src/preload/index.ts`; cria a página em `src/renderer/src/pages/` e registra a rota no `App.tsx`; se precisar de tabela, adiciona em `schema.ts` e replica em `testDb.ts`.

**Regras de negócio.** A fórmula de precificação e a formatação de datas/valores ficam em `src/renderer/src/utils/` (`pricing.ts`, `format.ts`). Mudanças ali têm teste dedicado em `src/tests/pricing.test.ts` e `format.test.ts` — atualize junto.

**Dedução de estoque.** Insumos são deduzidos na fabricação (quando se adiciona estoque a uma variação), não na venda. Todas as deduções usam `MAX(0, estoque - quantidade)` para não permitir negativo. A edição de venda faz restauração + novo desconto.

**Ícone do instalador.** O `build:win` depende de `resources/icon.ico`. Para regenerar a partir do SVG, existe `scripts/create-icon.mjs`.

**Versionamento.** Mudanças relevantes ficam em [CHANGELOG.md](CHANGELOG.md); a versão corrente está no `package.json` e é a que o electron-builder usa no instalador. A barra lateral lê essa mesma versão em tempo de execução, então não há segundo lugar para atualizar.
