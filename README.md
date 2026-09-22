# Van Bijoux Sys

Aplicativo desktop de gestão para negócios de bijuterias. Controla produtos e variações, insumos, vendas, feiras e fluxo de caixa num único lugar, com dashboard analítico e calculadora de precificação. Construí para uma usuária específica que precisava substituir planilhas dispersas por algo que rodasse offline no PC dela.

## Stack

O shell é **Electron 41** porque o app precisa rodar offline no Windows da usuária, com banco local e zero dependência de servidor. O empacotamento sai pelo **electron-builder** como instalador NSIS.

O renderer é **React 18 + TypeScript + Tailwind CSS**. Tailwind resolve o estilo sem abrir arquivos de CSS para cada tela, o que importa num app com muitos formulários parecidos. Os gráficos do dashboard usam **Recharts**, que já traz tudo que eu precisava (barras, linhas, comparativos) sem overhead de D3. Não há biblioteca de estado global: o estado vive nas telas, e o que atravessa (toasts) passa por um hook próprio.

Tudo o que atravessa a fronteira entre tela e processo principal é validado com **zod** antes de tocar no banco (ver [Fronteira IPC](#fronteira-ipc)).

A persistência é **SQLite via better-sqlite3**, com **Drizzle ORM** para tipar as queries. SQLite porque o banco vive no disco do usuário; better-sqlite3 porque é síncrono e roda direto no processo principal sem worker. O `postinstall` recompila o binário para o runtime do Electron.

Build e dev server são **electron-vite**, que combina HMR no renderer com reload no main. Os testes são **Vitest** em dois projetos — lógica e handlers sobre **sql.js** (SQLite em memória) e telas em **jsdom** com Testing Library — mais **Playwright** abrindo o Electron de verdade nos fluxos de ponta a ponta.

A distribuição usa **electron-updater** contra as releases do GitHub, com **electron-log** para deixar rastro do que o updater fez. Não há CI: a verificação roda em hooks locais de git (**husky** + **lint-staged** + **commitlint**), então lint, tipos e testes são checados na máquina antes do commit e do push.

## Estrutura

```
src/
├── shared/ipc/                 # Contrato dos canais: nomes e schemas zod
│   ├── channels.ts             # CANAIS_IPC (sem runtime: o preload é sandboxed)
│   ├── comum.ts                # id e data, usados por vários domínios
│   └── <dominio>.ts            # produtos, vendas, insumos, caixa, feiras, painel, backup
├── main/                       # Processo principal (Electron)
│   ├── database/
│   │   ├── index.ts            # Inicialização e migrations
│   │   ├── schema.ts           # Esquema Drizzle
│   │   ├── backup.ts           # Backup, validação e restauração
│   │   └── backup-rules.ts     # Regras puras de nomenclatura e rotação
│   ├── ipc/                    # Registro dos canais por domínio
│   │   ├── canal.ts            # registrarCanal: valida o payload e padroniza o erro
│   │   ├── mensagens.ts        # Tradução de erro técnico para a usuária
│   │   └── <dominio>.ts        # products, sales, insumos, cash, fairs, dashboard, backup
│   ├── repositorios/           # Regra de negócio e SQL, por domínio
│   │   ├── estoque.ts          # Único lugar que move saldo de peça e de insumo
│   │   └── produtos.ts, vendas.ts, insumos.ts, caixa.ts, feiras.ts, painel.ts
│   ├── servicos/backup.ts      # Fluxo de backup com diálogos por parâmetro
│   ├── updater.ts              # Auto-atualização via GitHub Releases
│   └── index.ts                # Boot, janela e as dependências reais dos canais
├── preload/
│   └── index.ts                # Bridge segura (contextBridge), sem zod
├── renderer/src/
│   ├── pages/                  # Cash, Dashboard, Fairs, PriceCalculator, Products, Sales, Stock
│   ├── components/             # ui/, products/, sales/, fairs/, insumos/, cash/, layout/
│   ├── hooks/                  # useToast
│   ├── utils/                  # numero, pricing, format, arquivamento, ajuste-de-estoque…
│   └── types/                  # Reexporta o contrato de src/shared/ipc
└── tests/
    ├── helpers/                # ambiente-ipc.ts (handlers reais sobre sql.js), testDb.ts
    ├── integration/            # Um arquivo por domínio, chamando os canais
    ├── tela/                   # Componentes React com jsdom e Testing Library
    └── *.test.ts               # Funções puras (números, precificação, arquivamento…)

e2e/                            # Playwright abrindo o Electron de verdade
scripts/smoke-visual.mjs        # Capturas das sete telas com dados semeados
docs/regras-de-negocio.md       # As regras numeradas (RN-01…RN-15)
```

## Rodando localmente

Requer Node.js 22.12 ou mais novo, o mínimo do `@electron/rebuild` que roda no `postinstall`. A versão usada no desenvolvimento está no [.nvmrc](.nvmrc).

```bash
npm install
npm run dev
```

O `postinstall` recompila o `better-sqlite3` para o Electron automaticamente. O dev server sobe o app com HMR no renderer.

## Scripts

| Comando                 | O que faz                                               |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | App em modo dev com HMR                                 |
| `npm run build`         | Compila main, preload e renderer                        |
| `npm run preview`       | Roda o build empacotado sem gerar instalador            |
| `npm run build:win`     | Gera instalador `.exe` (NSIS) em `dist/`                |
| `npm test`              | Suíte Vitest: lógica, handlers e telas                  |
| `npm run test:e2e`      | Playwright no Electron real (fora do pipeline)          |
| `npm run smoke:visual`  | Capturas das sete telas com dados semeados              |
| `npm run test:coverage` | Suíte com cobertura e pisos por camada                  |
| `npm run test:watch`    | Vitest em modo watch                                    |
| `npm run typecheck`     | Verifica tipos de main/preload, renderer e testes       |
| `npm run lint`          | ESLint em `src/`                                        |
| `npm run lint:fix`      | ESLint corrigindo o que der                             |
| `npm run format`        | Prettier no projeto inteiro                             |
| `npm run postinstall`   | Recompila `better-sqlite3` para o Electron (automático) |

## Verificação

Não há CI. As checagens rodam em hooks locais instalados pelo husky:

| Hook         | O que roda                                      |
| ------------ | ----------------------------------------------- |
| `pre-commit` | `lint-staged` (ESLint + Prettier)               |
| `commit-msg` | `commitlint` (Conventional Commits)             |
| `pre-push`   | `npm run lint && npm run typecheck && npm test` |

O `npm install` instala os hooks pelo script `prepare`. O fluxo de branches, PRs e commits está em [CONTRIBUTING.md](CONTRIBUTING.md).

## Banco de dados

O arquivo SQLite fica em `%APPDATA%/van-bijoux-sys/vanbijouxsys.db` no Windows. As migrations rodam no boot do app — não há comando manual para aplicar.

Tabelas: `categories`, `products`, `product_variations`, `insumos`, `variation_insumos`, `fairs`, `fair_additional_costs`, `sales`, `sale_items`, `expense_categories`, `cash_expenses`, `cash_settings`. O schema canônico está em [src/main/database/schema.ts](src/main/database/schema.ts) e precisa ser espelhado em [src/tests/helpers/testDb.ts](src/tests/helpers/testDb.ts) quando mudar, senão os testes de integração ficam defasados.

A tabela `sales` aceita `payment_method = 'areceber'` (fiado) com `received_at IS NULL`. Quando o cliente paga, o handler `sales:markAsReceived` troca o `payment_method` pelo método real (dinheiro/PIX/débito/crédito), aplica taxa se houver e grava `received_at`. Vendas pendentes contam em faturamento e lucro do Dashboard mas não entram no Caixa — entram apenas após o recebimento, pela data de `received_at`.

## Backup

Os backups ficam em `%APPDATA%/van-bijoux-sys/backups`. O app cria uma cópia no primeiro boot de cada dia e mantém as 10 mais recentes; a cópia usa a API de backup do SQLite, consistente mesmo com o WAL ativo. Também é feito um backup antes de aplicar uma atualização.

A restauração ([src/main/database/backup.ts](src/main/database/backup.ts)) valida integridade e presença das tabelas principais, guarda o estado atual numa cópia, sobrescreve o banco, apaga os arquivos `-wal`/`-shm` e reinicia o app — a conexão e os prepared statements não sobrevivem à troca do arquivo.

Backup na mesma máquina não protege contra defeito de disco. A exportação manual existe para a cópia sair do computador.

Sempre exporte pelo painel, nunca copiando `vanbijouxsys.db` na mão: o banco roda em WAL e as escritas recentes ficam em `vanbijouxsys.db-wal` até o checkpoint. Copiar só o `.db` leva um estado antigo — a API de backup do SQLite consolida os dois.

## Migrations

O schema é versionado por `PRAGMA user_version` e as migrações vivem em [src/main/database/migrations.ts](src/main/database/migrations.ts). No boot, o app aplica só as pendentes, cada uma na própria transação: se falhar no meio, o banco volta atrás e a versão não avança, então a tentativa se repete no próximo boot em vez de deixar o schema pela metade.

A versão 1 é a linha de base e reproduz o schema que os bancos em uso já tinham, por isso precisa continuar idempotente. Migrações novas entram como 2, 3, ... e nunca devem ser editadas depois de publicadas — o banco da cliente já as aplicou.

Quando existe migração pendente e o banco já existia, um backup é criado **antes** de o schema mudar. É o único momento em que ainda dá para voltar atrás, e importa mais agora que a atualização chega sozinha pelo updater.

## Publicando uma versão

O app se atualiza pelas releases do GitHub via electron-updater. O repositório é público, então o app baixa a atualização sem token nenhum; o arquivo que o updater lê é o `latest.yml` anexado à release.

O passo a passo — branch de documentação, `npm version`, build e `gh release create` com os três arquivos — está em [CONTRIBUTING.md](CONTRIBUTING.md#release), junto com as ressalvas sobre instalador sem assinatura e nome do artefato.

## Fronteira IPC

<a id="fronteira-ipc"></a>

Os 47 canais são registrados por `registrarCanal` ([src/main/ipc/canal.ts](src/main/ipc/canal.ts)), que valida os argumentos com o schema zod do domínio ([src/shared/ipc/](src/shared/ipc/)) **antes** de qualquer escrita. Payload fora do formato é recusado com uma mensagem legível, e o log guarda só o caminho e o código do problema — nunca os valores, que são dados do negócio.

Depois da validação, o handler delega para o repositório do domínio, que recebe a conexão por parâmetro. A falha sempre vira exceção — nunca um `{ success: false }` de retorno, que o renderer ignorava silenciosamente. A tradução de erro técnico (violação de chave estrangeira, nome duplicado) para texto que a cliente entende fica em [src/main/ipc/mensagens.ts](src/main/ipc/mensagens.ts), indexada por canal; um canal novo sem entrada cai numa mensagem genérica. No renderer, sempre trate a chamada com `try/catch` e mostre `err.message`.

O preload importa apenas `CANAIS_IPC`: com `sandbox: true` ele não carrega zod, e nenhum schema entra no bundle do renderer.

## Manutenção

**Adicionar um domínio novo (ex.: despesas recorrentes).** Na ordem: nomes dos canais em `src/shared/ipc/channels.ts`; schemas e tipos em `src/shared/ipc/<dominio>.ts`; teste de payload em `src/tests/integration/<dominio>-payload.test.ts` **antes** da implementação; regra e SQL em `src/main/repositorios/<dominio>.ts`; registro dos canais em `src/main/ipc/<dominio>.ts` e em `ipc/index.ts`, com o harness de teste (`src/tests/helpers/ambiente-ipc.ts`) registrando o mesmo domínio; API no `src/preload/index.ts`; página em `src/renderer/src/pages/` e rota no `App.tsx`. Se precisar de tabela, adiciona em `schema.ts` e replica em `testDb.ts`.

**Regras de negócio.** As quinze regras que o app precisa respeitar estão em [docs/regras-de-negocio.md](docs/regras-de-negocio.md), numeradas (RN-01…RN-15), com o código e o teste de cada uma. Os comentários no código citam o número. Mudou a regra, o documento muda junto.

**Dedução de estoque.** Insumos são deduzidos na fabricação, não na venda (RN-01). Toda escrita de estoque de peça fora das vendas passa por `movimentarEstoqueDaVariacao` em [src/main/repositorios/estoque.ts](src/main/repositorios/estoque.ts), que é também o único lugar que mexe no saldo de insumo. O detalhe de cada caso — motivo do ajuste, saldo negativo, arredondamento — está em RN-01 a RN-04.

**Camadas de teste.** `npm test` roda dois projetos: lógica e handlers (os canais reais sobre sql.js, por [src/tests/helpers/ambiente-ipc.ts](src/tests/helpers/ambiente-ipc.ts)) e telas (React com jsdom). Não copie o SQL do handler para dentro do teste: a cópia não protege o código que roda na máquina da usuária. Fora do pipeline, `npm run test:e2e` abre o Electron de verdade e `npm run smoke:visual` fotografa as sete telas — os dois estão no [CONTRIBUTING.md](CONTRIBUTING.md#testes-de-tela-e-de-ponta-a-ponta).

**Ícone do instalador.** O `build:win` depende de `resources/icon.ico`. Para regenerar a partir do SVG, existe `scripts/create-icon.mjs`.

**Versionamento.** Mudanças relevantes ficam em [CHANGELOG.md](CHANGELOG.md); a versão corrente está no `package.json` e é a que o electron-builder usa no instalador. A barra lateral lê essa mesma versão em tempo de execução, então não há segundo lugar para atualizar.
