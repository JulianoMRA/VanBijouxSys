# Revisão módulo a módulo — Fase 5

**Data:** 2026-04-23
**Branch:** `chore/revisao-repo-v1.6`
**Método:** checklist do PLAN-revisao-repo.md aplicado a cada uma das 7 páginas + componentes de formulário.

---

## Resumo executivo

### Achados críticos (bugs)

1. **`Dashboard.loadStats`, `Cash.loadAll`, `PriceCalculator.loadData` sem try/catch.**
   Se a chamada IPC falhar por qualquer motivo, `setLoading(false)` nunca é
   chamado e a tela fica travada em "Carregando…" sem feedback ao usuário.
   **Fix:** envelopar em try/catch com mensagem de erro em `.alert-bar`.

### Achados de inconsistência visual (resíduo do refactor)

2. **`Toast.tsx` usa classes fora da paleta Atelier:** `bg-emerald-600`,
   `rounded-2xl`, `shadow-lg`, `text-white`, `bottom-6`, `right-6`, `py-3`, `px-4`.
   Verde emerald-600 não existe na paleta — deveria usar `var(--good)`. Bordas e
   sombras também não batem com o resto do sistema.

3. **`ProductForm.tsx` e `VariationForm.tsx` ainda usam classes Tailwind genéricas
   que não existem na paleta Atelier:**
   - `text-gray-400`, `text-gray-500`, `text-gray-700` — deveria ser `var(--ink-4)` / `.text-dim`
   - `text-rose-500`, `text-rose-400`, `hover:text-rose-400` — deveria ser `var(--bad)`
   - `rounded-xl` — usa 12px, mas a paleta tem `--radius-md` (8px) e `--radius-lg` (12px). Inconsistência.

   Essas classes são "sobreviventes" do refactor visual — foram esquecidas
   porque compilam sem erro mesmo fora da paleta.

### Achados de DRY / consistência de código

4. **Botão "excluir" repetido inline em 6+ lugares:**
   ```tsx
   <button className="btn btn-xs btn-ghost" style={{ color: 'var(--bad)', borderColor: 'transparent' }}>
   ```
   Ocorrências: Products (2x), Stock (1x), Sales (1x), Fairs (1x), Cash (1x, icon-btn).
   **Proposta:** classe `.btn-ghost-danger` no atelier.css.

5. **Botão "+ Estoque" repetido inline:**
   ```tsx
   <button className="btn btn-xs btn-ghost" style={{ color: 'var(--good)', borderColor: 'transparent' }}>
   ```
   Ocorrências: Products, Stock.
   **Proposta:** classe `.btn-ghost-good`.

6. **`ConfirmDialog` usa estilo inline para botão perigoso:**
   ```tsx
   style={danger ? { background: 'var(--bad)', color: '#fff' } : undefined}
   ```
   **Proposta:** classe `.btn-danger` (sólido, bad) no atelier.css.

7. **`SELECT_STYLE` constante inline duplicada em Products e Stock** (11 linhas cada).
   **Proposta:** classe `.select` no atelier.css (já que `<select>` precisa de altura e cursor pointer diferentes do input).

### Polimento (baixa prioridade, anotados para futuro)

8. **Cards de loading uniformes** repetidos em 6 páginas:
   ```tsx
   <div className="card flex items-center justify-center" style={{ height: 160 }}>
     <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando…</span>
   </div>
   ```
   Poderia virar componente `<LoadingCard />` ou classe `.loading-card`.

9. **Página "Alert-bar" inline** idêntica em 5 páginas (Products, Stock, Sales, Fairs, Cash):
   ```tsx
   <div className="alert-bar" style={{ marginBottom: 16 }}>
     <span style={{ flex: 1 }}>{errorMessage}</span>
     <button className="icon-btn" onClick={...} style={{ fontSize: 18, lineHeight: 1 }}>×</button>
   </div>
   ```
   Poderia virar `<ErrorBar message onDismiss />`.

10. **Fluxo de exportar CSV em Stock** usa dropdown inline (30+ linhas de style).
    Poderia virar componente `<DropdownMenu />` reutilizável — mas é uso único.

---

## Checklist por módulo

### 1. Dashboard (`src/renderer/src/pages/Dashboard.tsx`)

- [x] `.page-head` + `.page-kicker` + `.page-title` — ✅
- [x] Botões usam `.segmented` (filtros de período) — ✅
- [x] Tabelas n/a (página só de leitura com gráficos) — ✅
- [x] Empty states usam `.empty-state` — ✅
- [ ] Mensagens de erro do backend — ❌ **`loadStats` sem try/catch**
- [x] Loading states — ✅
- [x] Badges semânticos via `.alert-tag` / `.chip-alert` — ✅
- [x] Confirmação antes de exclusões — n/a
- [x] Validação client-side — n/a (só filtros)

### 2. Produtos (`src/renderer/src/pages/Products.tsx`)

- [x] Header completo — ✅
- [x] Botões `.btn .btn-primary` / `.btn .btn-xs .btn-ghost` — ✅
- [x] Tabela `.table` com `.num` — ✅
- [x] Empty states `.empty-state` — ✅
- [x] Erros via `.alert-bar` (com dismissão) — ✅
- [x] Badges via componente `<Badge />` — ✅
- [x] Loading state — ✅
- [x] Confirmação antes de exclusão (produto e variação) — ✅
- [x] Mensagens de erro traduzem backend (restrição de FK) — ✅
- ⚠️ Usa `SELECT_STYLE` inline — ver item #7
- ⚠️ Botão excluir com estilo inline — ver item #4
- ⚠️ `ProductForm` tem classes Tailwind genéricas — ver item #3

### 3. Estoque — Insumos (`src/renderer/src/pages/Stock.tsx`)

- [x] Header — ✅
- [x] Botões — ✅
- [x] Tabela com `.num` — ✅
- [x] Alerts panel para estoque baixo — ✅
- [x] Empty states — ✅
- [x] Erro de FK (insumo em uso) traduzido — ✅
- [x] Badges `.badge .bad` / `.badge .warn` — ✅
- [x] Loading state — ✅
- [x] Confirmação antes de exclusão — ✅
- ⚠️ `SELECT_STYLE` inline — ver item #7
- ⚠️ Botões "+ Estoque" e "Excluir" com estilo inline — itens #4 e #5
- ⚠️ Dropdown de exportar com muitos inline styles — item #10

### 4. Vendas (`src/renderer/src/pages/Sales.tsx`)

- [x] Header — ✅
- [x] Botões — ✅
- [x] KPIs `.kpi` — ✅
- [x] Linhas expansíveis reutilizam `.product-row` — ✅
- [x] Tabela interna com `.num` e totais em `<tfoot>` — ✅
- [x] Empty states — ✅
- [x] Erro via `.alert-bar` — ✅
- [x] Loading — ✅
- [x] Confirmação antes de exclusão (avisa que itens voltam ao estoque) — ✅
- [x] Filtros de canal via `.chip` — ✅
- ⚠️ Botão excluir com estilo inline — item #4

### 5. Feiras (`src/renderer/src/pages/Fairs.tsx`)

- [x] Header — ✅
- [x] Seções "Próximas" / "Realizadas" — ✅
- [x] Card customizado de feira com badge de data — ✅
- [x] Tabela de vendas vinculadas com totais e lucro líquido — ✅
- [x] Erro de FK tratado — ✅
- [x] Loading — ✅
- [x] Confirmação antes de exclusão — ✅
- ⚠️ Botão excluir com estilo inline — item #4
- ⚠️ Badge de data na FairCard é implementado 100% inline (19 linhas) — poderia virar classe `.date-chip` mas é uso único.

### 6. Caixa (`src/renderer/src/pages/Cash.tsx`)

- [x] Header — ✅
- [x] `.cash-strip` com 4 células — ✅
- [x] Filtros `.chip` com custom — ✅
- [x] Lista de movimentações (cards) com indicador colorido — ✅
- [x] Empty state — ✅
- [x] Erros via `.alert-bar` — ✅
- [x] Modal de categorias funcional (CRUD completo) — ✅
- [x] Modal de saldo de abertura — ✅
- [x] Confirmação antes de exclusões (despesa, categoria) — ✅
- [ ] **`loadAll` sem try/catch** — item #1
- ⚠️ Dropdown de "Alterar" saldo com botão estilizado inline

### 7. Precificação (`src/renderer/src/pages/PriceCalculator.tsx`)

- [x] Header — ✅
- [x] Coluna de entrada + coluna de resultado — ✅
- [x] Breakdown passo-a-passo com linhas divisoras — ✅
- [x] `.formula-display` para fórmula — ✅
- [x] `.formula-result` para preço final — ✅
- [x] Aplicação a variação (produto+variação selects) — ✅
- [x] Persistência de mão de obra padrão em localStorage — ✅
- [ ] **`loadData` sem try/catch** — item #1
- ⚠️ Prefixo "R$" nos inputs é feito 100% inline (posição absoluta manual). Pattern repetido 2x.

---

## Plano de fixes (ordem de execução)

### Commit 1 — Robustez (bugs críticos)
Adicionar try/catch em:
- `Dashboard.loadStats` — exibir erro em `.alert-bar` como nas outras páginas.
- `Cash.loadAll`
- `PriceCalculator.loadData`

### Commit 2 — Toast: alinhar ao tema Atelier
- Substituir `bg-emerald-600 text-white rounded-2xl shadow-lg` por estilo consistente com tema (fundo `var(--good)` ou um card com borda + ícone).
- Manter `fixed bottom-6 right-6 z-50` (posicionamento ok).

### Commit 3 — Formulários: remover classes Tailwind genéricas
Em `ProductForm.tsx` e `VariationForm.tsx`:
- `text-gray-*` → `.text-dim` ou `var(--ink-4)`
- `text-rose-*` → `var(--bad)`
- `rounded-xl` → `rounded-[var(--radius-md)]` ou `rounded-[var(--radius-lg)]`

### Commit 4 — Novas classes no atelier.css
- `.btn-danger` (sólido, background bad)
- `.btn-ghost-danger` (ghost, texto bad, borda transparente)
- `.btn-ghost-good` (ghost, texto good, borda transparente)
- `.select` (select estilizado como input com cursor pointer, altura 36)

Aplicar em:
- `ConfirmDialog.tsx` → usar `.btn-danger` no botão confirmar.
- `Products.tsx`, `Stock.tsx`, `Sales.tsx`, `Fairs.tsx`, `Cash.tsx` → substituir inline styles.
- `Products.tsx`, `Stock.tsx` → usar `.select` e remover `SELECT_STYLE`.

### Commits futuros (fora de escopo imediato — anotar)

- Componente `<LoadingCard />` ou classe `.loading-card`.
- Componente `<ErrorBar message onDismiss />`.
- Helper `.input-prefix` para inputs com prefixo R$.
- `<DropdownMenu />` para o menu de exportar em Stock.

---

## Observações finais

O refactor visual (Atelier) foi sólido em sua maior parte — a base de classes
`.page-head`, `.btn`, `.table`, `.kpi`, `.cash-strip`, `.empty-state` foi bem
adotada. Os achados são **resíduos** do refactor (classes antigas que não foram
substituídas) e **oportunidades** de consolidar padrões repetidos em classes
semânticas.

Nenhum módulo está quebrado visualmente — são ajustes de polimento e
consistência que elevam o sistema ao nível de produção do tema.
