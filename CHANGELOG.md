# Changelog

## [1.6.0] - 2026-04-25

### Refactor visual — tema Atelier

- Novo design system **Atelier**: paleta de tokens CSS (blush, vinho, off-white), tipografia Cormorant Garamond + Inter, classes de componente (`.btn`, `.page-head`, `.table`, `.modal`, `.cash-strip`, `.empty-state`, `.alert-bar`).
- CSS consolidado: `globals.css` fundido em `atelier.css`; `tailwind.config.js` enxugado de 41 → 8 linhas (tokens de cor/fonte movidos para `:root`).
- Bug silencioso corrigido: 26 ocorrências de classes `blush-*`/`cream-*` em 5 componentes substituídas por Tailwind arbitrary values apontando para CSS vars (`bg-[var(--accent)]` etc.).
- Botões padronizados em todos os formulários para `btn btn-primary` / `btn btn-ghost`.
- Sidebar, Dashboard, Produtos, Estoque, Vendas, Feiras, Caixa e Precificação refatorados para usar as classes do tema.

### Revisão de repositório v1.6

- **Limpeza**: arquivos `HANDOFF-*.md` e resíduos pós-refactor removidos.
- **Dead code**: exports não usados em componentes, utils e types removidos; imports órfãos eliminados.
- **Qualidade TS/React**: script `typecheck` adicionado ao `package.json`; `"types": ["vite/client"]` em `tsconfig.web.json` (resolve `import.meta.env`); `src/renderer/src/types` incluído em `tsconfig.node.json`; `useEffect` com deps corrigidos; `try/catch` adicionado em `SaleForm`, `VariationForm` e `Cash`.
- **Banco e IPC**: operações compostas (`variations:create/update/addStock`, `fairs:create/update`) envolvidas em `sqlite.transaction()`; TOCTOU corrigido em contadores de estoque (`UPDATE … SET stock = stock + ?`); `try/catch` padronizado em `insumos.ts` e `cash.ts`.
- **Segurança**: `npm audit fix` resolve 7 de 12 vulnerabilidades; `preload` lança erro se `contextIsolation=false` (em vez de fallback dev); Content Security Policy adicionada ao HTML do renderer; `SECURITY-REVIEW.md` documenta auditoria completa.

---

## [0.2.1] - 2026-03-22

### Adicionado

- **Estoque de insumos**: botão para recolher/expandir a lista de alertas de estoque baixo, evitando que uma lista grande ocupe excessivamente a tela
- **Estoque de insumos**: exportação da lista em CSV (compatível com Excel/Google Sheets) com três opções — todos os insumos, apenas estoque baixo/esgotado, ou visão atual da tela; o arquivo inclui nome, unidade, estoque atual, estoque mínimo e déficit por item

---

## [0.2.0] - 2026-03-21

### Adicionado

- **Estoque de insumos**: barra de pesquisa por nome, filtro por status (Todos / Baixo / Esgotado) e ordenação (Último adicionado, Nome A→Z, Nome Z→A, Estoque ↑↓, Custo/un. ↑↓)
- **Produtos**: ordenação da lista (Último adicionado, Nome A→Z, Nome Z→A, Mais variações, Menos variações) e contador "X de Y produtos" no subtítulo ao filtrar
- **Calculadora de precificação**: integração com insumos cadastrados — cada linha de material agora permite selecionar um insumo do banco e informar a quantidade, com o custo calculado automaticamente (quantidade × custo/un.); o modo manual continua disponível

### Corrigido

- README: descrição de feiras multi-dia corrigida para refletir a ausência de limite de dias

---

## [0.1.0] - 2026-03-15

### Lançamento inicial

- Dashboard analítico com filtros de período, gráficos de faturamento/lucro/canal/variações e alertas de estoque
- Módulo de produtos com variações, receita de insumos e calculadora de custo
- Estoque de insumos com CRUD completo, estoque mínimo e alertas
- Calculadora de precificação com fórmula `teto((materiais × 3 + mão de obra) × 1,10 + R$ 1,00)` e aplicação direta à variação
- Registro de vendas por canal (Feira, WhatsApp, Instagram, Outro) com baixa automática de estoque
- Feiras multi-dia com custos adicionais e resumo de lucro líquido
- Ícone personalizado (gema facetada vinho/blush) e instalador `.exe` para Windows
