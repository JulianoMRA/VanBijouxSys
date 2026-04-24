# Plano de Revisão/Varredura do Repositório — VanBijouxSys

**Criado em:** 2026-04-19
**Contexto:** Após 9 fases de refactor visual (tema Atelier, commits `f552e56` + pendente
das fases 6-9), o repo precisa de uma varredura completa para consolidar mudanças,
eliminar resíduos, validar código e atualizar metadados.

**Como usar:** Execute as fases em ordem. Cada fase tem checkpoint de decisão
antes de prosseguir. Faça commits atômicos ao final de cada fase quando houver
mudanças de código.

---

## FASE 0 — Preservar trabalho pendente (CRÍTICO — fazer primeiro)

Há 9 arquivos modificados não commitados das fases 6-9 do refactor visual.
**Risco:** perda se o ambiente for trocado ou `git reset` for executado por engano.

### Passos

1. Rodar `git status` para confirmar os 9 arquivos (ver `HANDOFF-fases-6-9.md`).
2. Rodar `npm run typecheck` — se houver erro TS, corrigir antes de commitar.
3. Rodar `npm test` — devem passar 40 testes (21 unit + 19 integração).
4. Rodar `npm run dev` e abrir as 4 páginas refatoradas (Vendas, Feiras, Caixa,
   Precificação) + os 3 modais de formulário (SaleForm, FairForm, ExpenseForm).
   Checklist visual está no `HANDOFF-fases-6-9.md` seção "A verificar".
5. Se tudo passar, commitar com a mensagem sugerida no HANDOFF.
6. **Não deletar `HANDOFF-fases-6-9.md` ainda** — só na Fase 2 após confirmar que
   a revisão visual foi concluída.

### Decisão no final da Fase 0

- [ ] Commit das fases 6-9 feito? Prosseguir.
- [ ] Testes falharam? Corrigir (criar issue/nota) antes de continuar.

---

## FASE 1 — Smoke test: build + tipos + testes

Garantir que o estado atual do repo é tecnicamente saudável antes de remover coisas.

### Passos

1. `npm run typecheck` — zero erros.
2. `npm test` — 40/40 passando.
3. `npm run build` — build limpo sem warnings novos.
4. Abrir `npm run dev`, clicar em todas as 7 seções da sidebar
   (Dashboard, Produtos, Estoque, Vendas, Feiras, Caixa, Precificação).
5. Abrir todos os formulários/modais (Novo produto, Nova variação, Nova venda,
   Nova feira, Novo insumo, Despesa de caixa, Saldo de abertura).
6. Verificar console do DevTools em busca de warnings React (key, hooks, etc.).

### Saída esperada

Zero falhas. Se houver, anotar em `ISSUES.md` e priorizar antes de prosseguir.

---

## FASE 2 — Limpeza de arquivos e pastas inúteis

### Passos

1. Listar arquivos no root — procurar por:
   - `HANDOFF-*.md` — mover para `.planning/handoffs/` ou deletar após Fase 0.
   - `*.tsbuildinfo` — já estão no `.gitignore`, mas confirmar que não estão tracked.
   - `out/`, `dist/` — gerados, já no `.gitignore`. Confirmar que estão ignorados.
2. Rodar `git ls-files --others --ignored --exclude-standard` — tudo que o git
   está ignorando corretamente.
3. Rodar `git ls-files` e procurar arquivos suspeitos (logs, temporários, backups).
4. `.planning/` — é do GSD, manter (já ignorado).
5. `.claude/` — já ignorado, não tocar.
6. Verificar `scripts/` — confirmar que cada script ainda é usado (ex:
   `create-icon.mjs` só roda manualmente; OK manter).
7. Verificar `resources/` — só `.ico` e arquivos de build; OK.

### Comandos úteis

```bash
# Arquivos grandes que podem ter sido commitados por engano
git ls-files | xargs -I {} du -b {} 2>/dev/null | sort -n | tail -20

# Arquivos não referenciados em nenhum import (heurística, não definitiva)
# Rodar manualmente com Grep para cada .ts/.tsx suspeito
```

### Saída esperada

Lista de arquivos a remover. Commit: `chore: remove arquivos obsoletos após refactor visual`

---

## FASE 3 — Consolidação CSS (resíduo do refactor visual)

O refactor criou `atelier.css` mas manteve `globals.css`. O HANDOFF menciona
que algumas classes (`.input`, `.label`, `.btn-secondary`) foram perdidas e
tiveram que ser reimplantadas. Precisa consolidar.

### Passos

1. Ler `src/renderer/src/styles/globals.css` e `atelier.css` lado a lado.
2. Listar todas as classes definidas em `globals.css`.
3. Para cada classe:
   - Ainda usada? `grep -r "className=.*minha-classe"` em `src/renderer/`.
   - Já tem equivalente em `atelier.css`? Consolidar.
   - Não usada? Remover.
4. Buscar classes Tailwind antigas órfãs:
   ```
   grep -r "blush-" src/renderer/
   grep -r "cream-" src/renderer/
   grep -r "mauve-" src/renderer/
   ```
   Se o `tailwind.config.js` removeu essas cores mas algum componente ainda usa,
   ele renderiza sem estilo — bug silencioso.
5. Verificar ordem de import em `main.tsx`: `atelier.css` antes de `globals.css`?
   Tailwind utilities devem vencer — confirmar.
6. Revisar `tailwind.config.js` — se quase nada mais usa Tailwind custom,
   considerar migrar 100% para variáveis CSS e remover dependência
   (decisão de escopo — não executar sem confirmar).

### Saída esperada

Um único arquivo de estilos consolidado (ou `atelier.css` + Tailwind utilities).
Commit: `refactor(visual): consolida estilos no atelier.css e remove resíduos`

---

## FASE 4 — Dead code e imports órfãos

### Passos

1. Componentes não usados:
   ```
   # Para cada arquivo em src/renderer/src/components/**/*.tsx:
   # basename sem extensão → grep como nome de import
   ```
   Usar ferramenta: `npx ts-prune` (adicionar como devDep temp) ou `knip`.

2. Utils não usados:
   - `src/renderer/src/utils/` — conferir cada export.
   - `src/renderer/src/hooks/` — idem.

3. Tipos não usados:
   - `src/renderer/src/types/` — cada interface/type exportado.

4. Imports quebrados após refactor visual:
   ```
   grep -rn "from.*globals" src/renderer/
   grep -rn "import.*\.css" src/renderer/
   ```

5. IPC handlers não usados no backend:
   - `src/main/ipc/` — cada handler registrado tem consumidor em `window.api`?
   - `src/preload/index.ts` — cada exposição tem uso no renderer?

### Saída esperada

Lista de arquivos/exports a remover. Commit: `chore: remove código morto após refactor`

---

## FASE 5 — Revisão módulo a módulo (visual + UX + funcional)

Para cada uma das 7 seções da sidebar, executar checklist:

### Checklist por módulo

- [ ] Cabeçalho usa `.page-head` + `.page-kicker` + `.page-title` + `.page-subtitle`?
- [ ] Botões primários/secundários usam classes `.btn .btn-primary` / `.btn-ghost`?
- [ ] Tabelas usam `.table` com `.num` nas colunas numéricas?
- [ ] Empty states usam `.empty-state`?
- [ ] Erros usam `.alert-bar`?
- [ ] Badges de status têm cor correta?
- [ ] Responsivo OK em janelas menores (redimensionar Electron)?
- [ ] Formulários têm validação client-side?
- [ ] Mensagens de erro do backend são exibidas de forma amigável?
- [ ] Loading states em operações assíncronas?
- [ ] Confirmação antes de exclusões?

### Ordem sugerida

1. Dashboard — revisar gráficos e filtros.
2. Produtos — CRUD + variações + integração com insumos.
3. Estoque (Insumos) — CRUD + baixa automática + alertas.
4. Vendas — linhas expansíveis + baixa de estoque.
5. Feiras — custos + vendas vinculadas + lucro líquido.
6. Caixa — `.cash-strip` + categorias + saldo de abertura.
7. Precificação — fórmula + aplicação a variação.

### Saída esperada

`NOTES-revisao-modulos.md` com ajustes pequenos por módulo.
Commits separados por módulo quando ajustes forem aplicados.

---

## FASE 6 — Qualidade de código (TypeScript + React)

### Passos

1. Buscar `any` explícito e implícito:
   ```
   grep -rn ": any" src/ --include="*.ts" --include="*.tsx"
   grep -rn "as any" src/
   ```
2. Componentes grandes (> 300 linhas) — candidatos a split:
   ```
   find src/renderer/src -name "*.tsx" -exec wc -l {} + | sort -rn | head -20
   ```
3. `useEffect` com dependências suspeitas — revisar cada ocorrência.
4. Handlers IPC que retornam erros não tratados no frontend.
5. `console.log` esquecidos:
   ```
   grep -rn "console\." src/ --include="*.ts" --include="*.tsx"
   ```
6. Comentários `TODO`/`FIXME`/`HACK`:
   ```
   grep -rnE "(TODO|FIXME|HACK|XXX)" src/
   ```

### Saída esperada

Issues pequenas para correção. Commit: `refactor: melhora tipagem e remove debug code`

---

## FASE 7 — Banco, migrations, IPC

### Passos

1. Ler `src/main/database/migrations` — cada migration é idempotente
   (`PRAGMA table_info()` antes de `ALTER`)?
2. Queries SQL em handlers — usam prepared statements (Drizzle/better-sqlite3)?
   Nada de concatenação de strings.
3. Operações compostas (ex: venda → baixa de estoque) — estão em transação?
4. Validação de input em IPC handlers — tipos/ranges/nulls tratados?
5. Testes de integração cobrem casos de erro (FK, NOT NULL, estoque zero)?

### Saída esperada

Fortalecimento de integridade. Commit: `fix(db): adiciona transações e validações em handlers`

---

## FASE 8 — Segurança

Invocar o skill `/security-review` — faz review completa dos changes pendentes.

Checklist manual extra:

- [ ] `contextIsolation: true` e `nodeIntegration: false` no Electron?
- [ ] `preload` expõe apenas funções específicas (não `ipcRenderer` direto)?
- [ ] `npm audit` — vulnerabilidades críticas?
- [ ] Inputs do usuário usados em queries são sempre parametrizados?
- [ ] Arquivos de banco em `%APPDATA%` com permissões corretas?
- [ ] Nenhum secret em código (`grep -rn "API_KEY\|SECRET\|PASSWORD" src/`)?

### Saída esperada

`SECURITY-REVIEW.md` com findings. Commits separados por fix.

---

## FASE 9 — Documentação e metadados

### Passos

1. Atualizar `package.json` versão: 1.5.1 → **1.6.0** (refactor visual completo
   = MINOR justificado).
2. Atualizar `src/renderer/src/components/Sidebar.tsx` badge de versão.
3. Atualizar `README.md`:
   - Seção "Design System" — descrever tema Atelier.
   - Versão atual.
   - Screenshots se aplicável.
4. Atualizar `CHANGELOG.md`:
   - Nova entrada `## [1.6.0] — 2026-04-XX`
   - Listar refactor visual fases 1-9.
5. Atualizar memory do projeto (`project_vanbijouxsys.md`):
   - Nova versão.
   - Estado do design system pós-refactor.

### Saída esperada

Commit final: `chore: bump versão 1.6.0 e atualiza docs`
Tag: `git tag v1.6.0`

---

## FASE 10 — Build e distribuição

### Passos

1. `npm run build:win` — gera novo instalador em `dist/`.
2. Testar instalação por cima da versão atual — banco preservado?
3. Validar funcionamento completo após install (todas as 7 seções).
4. Push + tag:
   ```
   git push origin main
   git push origin v1.6.0
   ```
5. (Opcional) Criar release no GitHub com o `.exe` anexado.

### Saída esperada

Release 1.6.0 disponível. Usuária final pode atualizar.

---

## Checklist consolidado (marcar durante execução)

- [x] Fase 0: commit das fases 6-9 feito
- [x] Fase 1: typecheck + test + build + dev OK
- [x] Fase 2: arquivos inúteis removidos
- [x] Fase 3: CSS consolidado (sem resíduos blush-*/cream-*)
- [x] Fase 4: dead code removido
- [x] Fase 5: módulos revisados um a um
- [x] Fase 6: qualidade TS/React
- [ ] Fase 7: DB/IPC auditados
- [ ] Fase 8: security review passou
- [ ] Fase 9: docs e versão atualizadas
- [ ] Fase 10: build + release 1.6.0

---

## Princípios durante a execução

- **Commits atômicos por fase** — facilita rollback.
- **Não refatorar além do escopo** — se achar algo fora, anotar em `NOTES-followup.md`.
- **Confirmar antes de deletar** — use `git rm` + revisão antes de `git commit`.
- **Backup do `.db` antes de testar migrations** — copiar `%APPDATA%/van-bijoux-sys/`.
- **Executar em branch separada** (`chore/revisao-repo-v1.6`) e merge via PR no final.

---

## Estado atual da execução (2026-04-21)

**Branch de trabalho:** `chore/revisao-repo-v1.6` (criada a partir de `main` em 2026-04-21).
**Último commit na main:** `076ed95` (fases 6-9 do refactor visual).

### Fases concluídas

- **Fase 0, 1, 2:** concluídas em sessão anterior.
- **Fase 3 (CSS):** concluída em 2026-04-21. Commits:
  - `641bd72` — `fix(visual): corrige renderização quebrada após refactor visual`
  - `e726fba` — `refactor(visual): consolida CSS no atelier.css e enxuga tailwind.config`

### O que a Fase 3 fez (resumo técnico)

1. **Bug silencioso corrigido:** 26 ocorrências de `blush-*`/`cream-*` em 5 componentes (`InsumoForm`, `AddInsumoStockForm`, `AddStockForm`, `VariationDetailsModal`, `VariationForm`) renderizavam sem estilo porque essas cores foram removidas do `tailwind.config.js` no refactor anterior. Substituídas por `bg-[var(--accent)]`, `text-[var(--accent-2)]`, `border-[var(--hairline)]`, `bg-[var(--accent-wash)]`, etc. (Tailwind arbitrary values apontando para os CSS vars do tema Atelier).
2. **Botões quadrados corrigidos:** 6 componentes (`InsumoForm`, `AddInsumoStockForm`, `AddStockForm`, `ProductForm`, `VariationForm`, `ErrorBoundary`) usavam `.btn-primary` standalone — e em `atelier.css` esse seletor só define cor/background. Padronizados para `btn btn-primary` / `btn btn-ghost` (padrão combinado, já usado em Cash/Fairs/Stock/Sales/Products).
3. **CSS consolidado:** `globals.css` (que tinha só `@tailwind base/components/utilities`) foi fundido em `atelier.css` — `@tailwind base; @tailwind components;` no topo, tema no meio, `@tailwind utilities;` no fim. Import de `globals.css` removido de `main.tsx`. Arquivo `globals.css` deletado.
4. **Classe redundante removida:** `.btn-secondary` standalone (era idêntica a `.btn-ghost`) foi removida do `atelier.css`.
5. **`tailwind.config.js` enxugado** de 41 → 8 linhas: removido `theme.extend` morto (cores/fontes/raios custom mapeados para CSS vars, mas que **nenhum código** usava como utilities Tailwind). Tokens permanecem vivos no `:root` do `atelier.css`. **Decisão:** NÃO migrar 100% para CSS vars (remover Tailwind). Motivo: 158 ocorrências de utilities de layout Tailwind (`flex`, `gap-*`, `p-*`, `text-*`, `grid-cols-*`) em 19 arquivos — reescrita seria enorme e fora de escopo.

### Validações na Fase 3

- Testes: **62/62** passando (não 40 como o plano dizia — testes foram adicionados em fases anteriores).
- Build Vite: OK, CSS final 43.65 kB, 1 único bundle.
- Typecheck: **NÃO existe script `typecheck` no `package.json`**. Rodando `npx tsc -p tsconfig.web.json --noEmit` há **1 erro pré-existente** (não introduzido pela Fase 3):
  ```
  src/renderer/src/components/ui/ErrorBoundary.tsx(25,33):
  error TS2339: Property 'env' does not exist on type 'ImportMeta'.
  ```
  **Causa:** falta declaração de tipos do Vite. **Fix sugerido na Fase 6:** criar `src/renderer/src/env.d.ts` com `/// <reference types="vite/client" />`, ou adicionar `"types": ["vite/client"]` em `tsconfig.web.json`. Adicionalmente, criar script `"typecheck": "tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json"` no `package.json`.

### Próximo passo (Fase 4 — Dead code)

Quando retomar:
1. Confirmar branch ativa: `git branch --show-current` deve ser `chore/revisao-repo-v1.6`.
2. Instalar temporariamente `knip` ou `ts-prune` (`npm i -D knip`) para detectar exports/files não usados — remover devDep ao final da fase.
3. Auditar:
   - Componentes não usados em `src/renderer/src/components/**/*.tsx`
   - Utils/hooks não usados em `src/renderer/src/utils/` e `src/renderer/src/hooks/`
   - Tipos não usados em `src/renderer/src/types/`
   - Imports quebrados (`grep -rn "from.*globals"` e `grep -rn "import.*\.css"`) — verificar que ninguém mais referencia `globals.css`
   - IPC handlers sem consumidor (`src/main/ipc/` × `src/preload/index.ts` × `window.api` no renderer)
4. Commit: `chore: remove código morto após refactor`.

### Follow-ups anotados (para fases futuras ou imediatas)

- **Fase 6:** adicionar script `typecheck` no `package.json` + resolver erro de tipos Vite em `ErrorBoundary.tsx` (ver acima).
- **Fase 6:** auditar `contextIsolation`, `nodeIntegration`, handlers IPC sem validação.

### Arquivos-chave da Fase 3 (para referência futura)

- `src/renderer/src/styles/atelier.css` — único CSS do projeto, tokens + classes + diretivas `@tailwind`.
- `tailwind.config.js` — 8 linhas, só `content` + `plugins`.
- `src/renderer/src/main.tsx` — importa apenas `./styles/atelier.css`.

---

## Estado da execução — Fase 6 concluída (2026-04-24)

### O que foi feito antes desta sessão (commit `cc5bf7b`)

- Script `typecheck` adicionado ao `package.json`.
- `"types": ["vite/client"]` em `tsconfig.web.json` — resolve o erro
  `import.meta.env` em `ErrorBoundary.tsx`.
- `src/renderer/src/types` incluído em `tsconfig.node.json` — resolve TS6307 nos handlers IPC.
- Removidos `any` nos callbacks de Legend do Dashboard (Recharts).

### Varredura nesta sessão

1. **`: any` / `as any`** — zero ocorrências. ✅
2. **`TODO`/`FIXME`/`HACK`/`XXX`** — zero ocorrências. ✅
3. **`console.*`** — 27 ocorrências triadas. **Todas** são `console.error` em
   blocos catch (6 no renderer, 20 em handlers IPC do main, 1 em ErrorBoundary,
   1 no preload). **Mantidas** — valor operacional em produção Electron.
4. **`useEffect` com deps suspeitas:**
   - `Dashboard.tsx:296` — deps `[customFrom, customTo]` não incluía `period`.
     Incluído `period` para explicitar a intenção.
   - `SaleForm.tsx:59` — usa prop `sale` mas deps é `[]`. Funciona porque
     modal remonta a cada abertura. Anotado em `NOTES-followup.md` (não mexer
     sem revisar padrão de montagem).
5. **Handlers IPC sem try/catch no frontend:**
   - `SaleForm.tsx` `load()` no useEffect — SEM try/catch. Adicionado.
   - `VariationForm.tsx` `load()` no useEffect — SEM try/catch. Adicionado.
   - `Cash.tsx` `handleSaveOpeningBalance` — SEM try/catch. Adicionado.
   Completa o trabalho iniciado na Fase 5 (Dashboard/Cash.loadAll/PriceCalculator).
6. **Componentes > 300 linhas (8 arquivos: Dashboard 612, Cash 596, SaleForm 491,
   VariationForm 453, Products 447, PriceCalculator 447, Stock 387, FairForm 306).**
   **Não refatorados** — só mapeados em `NOTES-followup.md` com sugestões de split.

### Validações

- **Typecheck:** OK (0 erros).
- **Testes:** 62/62 passando.

### Commit sugerido

```
refactor(robustez): completa tratamento de erros e exhaustive-deps

- SaleForm.load, VariationForm.load, Cash.handleSaveOpeningBalance: try/catch
  com feedback via error state.
- Dashboard custom-period effect: inclui `period` nas deps.
- Cria NOTES-followup.md com componentes >300 linhas (candidatos a split) e
  demais oportunidades fora do escopo v1.6.
```

### Próximo passo (Fase 7 — Banco, migrations, IPC)

1. Ler `src/main/database/schema.ts` e verificar migrations idempotentes.
2. Confirmar que todas as queries usam Drizzle/better-sqlite3 prepared (sem
   concatenação de strings).
3. Operações compostas (venda → baixa estoque, exclusão → reversão) em
   transações (`db.transaction(() => …)`).
4. Validação de input nos 6 módulos IPC (`cash/dashboard/fairs/insumos/products/sales`).
5. Cobertura de testes de integração para casos de erro (FK, NOT NULL, estoque zero).
