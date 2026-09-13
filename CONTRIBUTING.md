# Contribuindo

O Van Bijoux Sys roda todos os dias no computador de uma usuária real, com o
banco só na máquina dela. Toda mudança parte desse fato: um defeito que chega à
release chega ao dado dela, e o auto-update entrega a versão nova sem ninguém
conferir antes.

---

## Setup

Node na versão do [.nvmrc](.nvmrc) (`nvm use`). O mínimo aceito, declarado em
`engines`, é 22.12, exigido pelo `@electron/rebuild` do `postinstall`.

```bash
npm install        # instala deps, recompila o better-sqlite3 e ativa o Husky
npm run dev        # Electron + Vite com HMR no renderer
```

---

## Fluxo de trabalho

1. Atualize a `main` (`git switch main && git pull --ff-only`).
2. Crie uma branch por tema a partir dela: `fix/<nome>`, `feat/<nome>`,
   `refactor/<nome>`, `docs/<nome>` ou `chore/<nome>`.
3. **Teste antes da implementação.** Regra de negócio e handler IPC começam com
   um teste falhando; a correção vem depois, e o teste precisa ficar vermelho se
   ela for revertida.
4. Commits atômicos em Conventional Commits: uma mudança lógica por commit.
5. Rode o pipeline local (abaixo) até ficar verde.
6. Push da branch e PR contra a `main`. O merge é por **merge commit**, para que
   os commits atômicos continuem legíveis no histórico.

PR é obrigatório mesmo sem revisor: a descrição registra o que mudou, por quê e
como foi verificado — inclusive o que **não** foi verificado.

---

## Conventional Commits

Validados pelo `commitlint` no hook `commit-msg`.

Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`,
`ci`, `perf`, `style`. Escopo opcional. Header de até 100 caracteres.

O corpo explica **por que** a mudança existe e o que ela custa, não repete o
diff. Texto puro, sem emoji e sem linha de coautoria.

```
fix(ui): menu de acoes deixa de ser cortado pela borda do card
feat(stock): arquiva insumos e limpa os avisos de reposicao
refactor: versiona migrations com user_version e faz backup antes de migrar
```

---

## Hooks do Husky

- **`pre-commit`**: `lint-staged` (ESLint e Prettier nos arquivos staged).
- **`commit-msg`**: `commitlint` valida o header.
- **`pre-push`**: `npm run lint && npm run typecheck && npm test`.

Não use `--no-verify`. Se um hook bloquear, investigue o que ele pegou.

---

## Pipeline local

Não há CI hospedada. Antes de abrir PR, na ordem:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Mudança visível no renderer também passa por conferência visual antes do PR.

---

## Release

Merge na `main` **não publica nada**. Um fix mergeado e não liberado continua
invisível para o app instalado, então todo `fix` ou `feat` que entra na `main`
termina com a proposta de release: o bump (`patch` para correção, `minor` para
funcionalidade ou mudança de comportamento) e a entrada do CHANGELOG.

Publicar empurra a versão para a máquina da usuária pelo auto-update. Por isso
cada passo abaixo acontece só depois de confirmado.

1. **Documentação.** Branch `docs/release-vX.Y.Z` com a entrada no
   [CHANGELOG.md](CHANGELOG.md) (escrita para quem usa o app, no formato das
   entradas anteriores) e o README, se algo nele mudou. Commit
   `docs: registra a vX.Y.Z no changelog e no README`, PR e merge.
2. **Versão.** Na `main` atualizada: `npm version <patch|minor|major>`. Ele cria o
   commit `X.Y.Z` e a tag `vX.Y.Z`; nunca crie a tag na mão. Depois
   `git push --follow-tags`.
3. **Build.** `npm run build:win`, que gera em `dist/` o instalador, o blockmap e o
   `latest.yml`.
4. **Publicação.** Release no GitHub para a tag, com os três arquivos:

   ```bash
   gh release create vX.Y.Z dist/VanBijouxSys-Setup-X.Y.Z.exe dist/VanBijouxSys-Setup-X.Y.Z.exe.blockmap dist/latest.yml --title "vX.Y.Z - Tema" --notes-file notas.md
   ```

   As notas repetem a entrada do CHANGELOG. **Sem o `latest.yml` o
   electron-updater não enxerga a versão nova** e o app instalado para de
   atualizar.

5. **Conferência.** Abra `releases/latest/download/latest.yml` pela URL e confira
   se o `path` bate com o nome do instalador anexado.

Duas ressalvas: o instalador não é assinado, então o SmartScreen alerta na
instalação; e o `artifactName` precisa continuar sem espaços, senão o nome do
arquivo diverge do que o `latest.yml` referencia e a atualização falha com 404.

---

## Migrations

Versionadas por `PRAGMA user_version` em
[src/main/database/migrations.ts](src/main/database/migrations.ts). Uma migração
publicada **nunca é editada**: o banco da usuária já a aplicou. Mudança de schema
entra como migração nova.
