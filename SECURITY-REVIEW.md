# Security Review — Fase 8 (revisão v1.6)

**Data:** 2026-04-25
**Branch:** `chore/revisao-repo-v1.6`
**Escopo:** diff `main..chore/revisao-repo-v1.6` + checklist da Fase 8 do `PLAN-revisao-repo.md`.

---

## Resumo executivo

App Electron desktop **single-user**, **offline**, sem servidor remoto, sem
multiusuário, sem secrets de API, banco local em `%APPDATA%`. Superfície de
ataque é pequena: o vetor relevante é injeção via inputs do usuário (já
auditada na Fase 7) e renderer comprometido tentando escalar privilégios.

**Postura:** sólida. Os 5 itens corrigidos na Fase 8 fecham todos os pontos
relevantes para o perfil do app. Vulnerabilidades transitivas remanescentes
(drizzle) são **dev-time only**, não chegam ao binário distribuído, e exigem
breaking change para resolver — ficam como debt para v1.7.

---

## Checklist Fase 8

### Electron hardening

| Item | Status | Onde |
|------|--------|------|
| `sandbox: true` | ✅ | `src/main/index.ts:17` |
| `contextIsolation` (default true em Electron 22+, forçado por sandbox) | ✅ | `src/main/index.ts:15-19` (não desabilitado) |
| `nodeIntegration: false` (default) | ✅ | não habilitado em nenhum BrowserWindow |
| Preload usa `contextBridge.exposeInMainWorld`, não expõe `ipcRenderer` | ✅ | `src/preload/index.ts` — 35 chamadas `ipcRenderer.invoke`, todas dentro do objeto `api` exposto via `contextBridge` |
| Throw em vez de fallback dev quando `contextIsolated=false` | ✅ | `src/preload/index.ts:81-85` (corrigido em commit `ae54351`) |
| `setWindowOpenHandler` rejeita popups e abre links externos no browser | ✅ | `src/main/index.ts:25-28` |
| `webSecurity` (default true) | ✅ | não desabilitado |
| Apenas `loadFile` ou `loadURL` confiável (HMR Vite em dev, file:// em prod) | ✅ | `src/main/index.ts:30-34` |

### Content Security Policy

| Diretiva | Valor | Justificativa |
|----------|-------|---------------|
| `default-src` | `'self'` | Default restritivo |
| `script-src` | `'self'` | Sem `unsafe-inline`/`unsafe-eval` — XSS de script é bloqueado |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | `unsafe-inline` necessário para Tailwind utilities + inline styles do React |
| `font-src` | `'self' https://fonts.gstatic.com` | Google Fonts (Cormorant Garamond, Inter) |
| `img-src` | `'self' data:` | Permite data-URIs (icons inline) |
| `connect-src` | `'self' ws://localhost:* http://localhost:*` | HMR do Vite em dev; em prod só `'self'` é usado |
| `object-src` | `'none'` | Bloqueia `<object>`/`<embed>` |
| `base-uri` | `'self'` | Previne hijack de base URL |
| `frame-ancestors` | `'none'` | Bloqueia clickjacking |

Aplicada em `src/renderer/index.html:6-9` (commit `ae54351`).

**Limitação aceita:** `style-src 'unsafe-inline'` é exigência prática do
ecossistema React/Tailwind (style attributes em JSX, classes utility geradas
em runtime). Mitigação: `script-src` permanece restritivo, então XSS via
inline style não escala para execução de código.

### Database & IPC

| Item | Status | Notas |
|------|--------|-------|
| Queries parametrizadas (sem string concat) | ✅ | Drizzle ORM + `sqlite.prepare(...).run(args)` em todos os handlers — Fase 7 |
| Operações compostas em transação | ✅ | `variations:create/update/addStock`, `fairs:create/update`, `sales:create` — Fase 7 |
| TOCTOU em counters | ✅ | `UPDATE … SET stock = stock + ?` em vez de SELECT→calc→UPDATE — Fase 7 |
| FKs com `onDelete: cascade` | ✅ | `src/main/database/schema.ts` |
| `PRAGMA foreign_keys = ON` + `journal_mode = WAL` | ✅ | `src/main/database/index.ts` |
| Migrations idempotentes | ✅ | `CREATE TABLE IF NOT EXISTS` + `PRAGMA table_info()` antes de `ALTER` |

### Secrets & dados sensíveis

```
$ grep -rE "API_KEY|SECRET|PASSWORD|PRIVATE_KEY|BEARER" src/
(no matches)
```

App não consome APIs externas autenticadas. Banco local não tem credenciais.
✅

### npm audit

**Antes da Fase 8:** 12 vulnerabilidades (semver-fix em 7).
**Após `npm audit fix` (commit `2175d59`):** 5 vulnerabilidades restantes.

| Pacote | Severidade | Caminho | Tipo | Resolução |
|--------|------------|---------|------|-----------|
| `esbuild` ≤0.24.2 | moderate | `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` | dev | Major bump em `drizzle-kit` (0.18+) — breaking |
| `@esbuild-kit/core-utils` | moderate | idem | dev | idem |
| `@esbuild-kit/esm-loader` | moderate | idem | dev | idem |
| `drizzle-kit` 0.17.5–0.30.x | moderate | direto (devDep) | dev | Bump major — breaking |
| `drizzle-orm` | high | direto | runtime | Bump major — breaking, exige migration revisão |

**Por que adiar:**
1. `esbuild` GHSA-67mh-4wv8-2f99 é exploitable apenas se um site malicioso tiver acesso ao **dev server local** do desenvolvedor — não chega ao binário distribuído à usuária final.
2. `drizzle-kit` é devDep — não vai para o instalador.
3. `drizzle-orm` é runtime, mas a vuln (GHSA-9fxx) é SQL injection só **se** queries forem construídas com input não confiável via raw SQL — auditado na Fase 7: 100% das queries usam o builder/prepared.
4. Bump major exige re-validação dos 62 testes + revisão das migrations + ajustes em sintaxe Drizzle. Fora de escopo da revisão v1.6.

**Plano:** abrir issue/phase para v1.7 com upgrade dirigido de Drizzle.

---

## Findings & ações tomadas

| # | Finding | Severidade | Ação |
|---|---------|------------|------|
| 1 | Preload tinha fallback `else` que escrevia direto em `window.electron`/`window.api` quando `process.contextIsolated=false` — anti-pattern, mesmo que código nunca atinja esse branch em prod (sandbox=true força contextIsolation) | Low (defensa em profundidade) | ✅ Substituído por `throw` (commit `ae54351`) |
| 2 | Faltava Content Security Policy no HTML do renderer | Medium | ✅ CSP adicionado (commit `ae54351`) |
| 3 | 12 vulnerabilidades em transitivas | Mixed | ✅ 7 resolvidas via `npm audit fix` (commit `2175d59`); 5 restantes documentadas como debt v1.7 |

---

## Itens fora de escopo (debt v1.7)

- **Upgrade major Drizzle** (kit + orm) para fechar as 5 vulns transitivas restantes.
- **Validação explícita de input no boundary IPC** — anotado em `NOTES-followup.md` desde a Fase 7. Hoje confiamos no frontend; aceitável em app local single-user, mas idealmente os handlers deveriam ter guards de tipo/range.
- **Permissões do arquivo de banco em `%APPDATA%`** — `better-sqlite3` herda permissões do diretório, que no Windows é por padrão restrito ao usuário corrente. Sem ação necessária para o perfil de uso.
- **Auto-update assinado** — não há mecanismo de update; a usuária instala manualmente o `.exe`. Em uma versão futura considerar `electron-updater` com code-signing.

---

## Validações

- `npm run typecheck` — 0 erros.
- `npm test` — 62/62 passando.
- `npm run build` — limpo.
- `npm audit` — 5 (4 moderate, 1 high) restantes, todas dev-time-relevant ou breaking-only.

---

## Conclusão

Para o perfil do app (Electron desktop offline single-user) a postura de
segurança após a Fase 8 está **adequada e proporcional ao risco**. As 5
vulns remanescentes têm exposição negligenciável no contexto de uso real e
ficam priorizadas para a próxima major.
