# Follow-ups — Revisão de Repo v1.6

Anotações de oportunidades identificadas **fora de escopo** da revisão atual,
para endereçar em milestones futuras.

---

## Componentes grandes (> 300 linhas) — candidatos a split

Mapeados na Fase 6. **Não refatorados** — risco/escopo alto, fora do objetivo
de consolidação da v1.6.

| Arquivo                                                     | Linhas | Sugestão de split                                                                 |
| ----------------------------------------------------------- | -----: | --------------------------------------------------------------------------------- |
| `src/renderer/src/pages/Dashboard.tsx`                      |    612 | Extrair seções de gráficos (Recharts) em subcomponentes: `<SalesChart />`, `<StockAlerts />`, `<PeriodKpis />`. |
| `src/renderer/src/pages/Cash.tsx`                           |    596 | Separar modal de categorias e modal de saldo em componentes próprios.             |
| `src/renderer/src/components/sales/SaleForm.tsx`            |    491 | Extrair linha de item (`<SaleItemRow />`) e totais (`<SaleTotals />`).            |
| `src/renderer/src/components/products/VariationForm.tsx`    |    453 | Separar a seção de insumos (`<InsumoPicker />`) e o bloco de precificação.        |
| `src/renderer/src/pages/Products.tsx`                       |    447 | Extrair linhas de produto expansíveis em `<ProductRow />`.                        |
| `src/renderer/src/pages/PriceCalculator.tsx`                |    447 | Separar painel de resultado/breakdown em componente.                              |
| `src/renderer/src/pages/Stock.tsx`                          |    387 | Extrair dropdown de exportar (também virou item no NOTES-revisao-modulos.md).     |
| `src/renderer/src/components/fairs/FairForm.tsx`            |    306 | Já está no limite — monitorar.                                                     |

---

## `useEffect` com deps incompletas — revisão manual

1. **`SaleForm.tsx:59`** — `load()` usa `sale` (prop) mas deps é `[]`.
   Hoje funciona porque o modal é **remontado** a cada abertura (o pai desmonta
   quando `showForm === false`). **Não mexer sem confirmar padrão de montagem.**
   Se a remontagem vier a mudar, vira bug: ao abrir em modo edição, items não
   aparecem.

---

## Componentização repetida (também em NOTES-revisao-modulos.md item 8/9/10)

- `<LoadingCard />` — card "Carregando…" repetido em 6 páginas.
- `<ErrorBar message onDismiss />` — alert-bar inline idêntico em 5 páginas.
- `.input-prefix` — helper para prefixo "R$" em inputs (PriceCalculator).
- `<DropdownMenu />` — menu de exportar CSV (Stock).

---

## Lint

Devs deps de ESLint (`@electron-toolkit/eslint-config-ts`) instaladas mas
**sem script `lint`** no `package.json` e sem config `.eslintrc`/`eslint.config.js`.

Adicionar script `lint` + config habilitaria `react-hooks/exhaustive-deps` e
outros guardrails. Fora de escopo para v1.6.

---

## Validação de input no boundary IPC (Fase 7)

Hoje os handlers IPC confiam no frontend para enviar dados válidos. Não há
guards explícitos contra:

- Campos `null`/`undefined` onde o schema espera `NOT NULL` (FKs, nomes, datas).
- Números negativos em quantidades, preços, estoques.
- Strings vazias onde o schema permite (mas o negócio não).
- Tipos trocados (número enviado como string não-parseável).

Em app Electron local single-user, risco é baixo — o frontend é o único
cliente. Vale adicionar guards no futuro para facilitar diagnosticar bugs
e endurecer contra chamadas IPC vazadas/manipuladas.

## Testes adicionais (Fase 7)

Cobertura integração atual é boa mas poderia ampliar para:

- Violação de FK ao deletar categoria com despesas vinculadas.
- Atualização de venda que zera estoque (verificar `MAX(0, …)`).
- Rollback de transação quando um dos inserts de BOM falha em `variations:create`.
