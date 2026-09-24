# Contribuindo

O Van Bijoux Sys roda todos os dias no computador de uma usuária real, com o
banco só na máquina dela. Toda mudança parte desse fato: um defeito que chega à
release chega ao dado dela, e o auto-update entrega a versão nova sem ninguém
conferir antes.

---

## Setup

Node na versão do [.nvmrc](.nvmrc) (`nvm use`). O mínimo aceito, declarado em
`engines`, é 22.12.

```bash
npm install        # instala deps e ativa o Husky
npm run dev        # Electron + Vite com HMR no renderer
```

O `npm run dev` usa a mesma pasta de dados do app instalado
(`%APPDATA%/van-bijoux-sys`). Para testar sem tocar nesse banco, aponte para uma
pasta isolada; banco, backups e log passam a viver nela:

```bash
VANBIJOUX_USER_DATA=/caminho/da/base-isolada npm run dev
```

---

## Fluxo de trabalho

1. Atualize a `main` (`git switch main && git pull --ff-only`).
2. Crie uma branch por tema a partir dela: `fix/<nome>`, `feat/<nome>`,
   `refactor/<nome>`, `docs/<nome>` ou `chore/<nome>`.
3. **Teste antes da implementação.** Regra de negócio e handler IPC começam com
   um teste falhando; a correção vem depois, e o teste precisa ficar vermelho se
   ela for revertida. Regra que já existe está em
   [docs/regras-de-negocio.md](docs/regras-de-negocio.md): cite o número
   (`RN-07`) no PR e no comentário do código.
4. Commits atômicos em Conventional Commits: uma mudança lógica por commit.
5. Rode o pipeline local (abaixo) até ficar verde.
6. Push da branch e PR contra a `main`. O merge é por **merge commit**, para que
   os commits atômicos continuem legíveis no histórico.

PR é obrigatório mesmo sem revisor: a descrição registra o que mudou, por quê e
como foi verificado — inclusive o que **não** foi verificado.

Entre sessões de trabalho, o bastão passa pelo
[HANDOFF_PROTOCOL.md](HANDOFF_PROTOCOL.md): o estado vivo fica em
`.claude/HANDOFF.md`, que não é versionado.

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
3. `npm run test:coverage` (a suíte inteira, mais os pisos de cobertura)
4. `npm run build`
5. `npm audit --omit=dev --audit-level=high` (dependências de produção)

Mudança visível no renderer também passa por conferência visual antes do PR.

### Testes de tela e de ponta a ponta

`npm test` roda dois projetos do vitest: `node` (lógica, handlers IPC sobre sql.js) e
`tela` (componentes React com jsdom, em `src/tests/tela`). Os dois entram no pipeline.

`npm run test:e2e` é outra coisa: ele compila o app e abre o **Electron de verdade**
pelo Playwright, cada fluxo numa pasta de dados nova (`VANBIJOUX_USER_DATA`). Leva
minutos e disputa o foco da máquina, então **fica fora do pipeline**: rode antes de
uma release, ou quando mexer em algo que atravessa main e renderer — e só com
confirmação de quem está na máquina, porque ele abre e fecha janelas.

### Conferência visual

`npm run smoke:visual` compila o app, abre o Electron numa pasta de dados nova,
semeia um cenário pequeno pelo próprio `window.api` e fotografa as sete telas em
`smoke-visual/` (a pasta não é versionada). As datas do cenário são contadas a
partir de hoje, senão o painel abre no mês atual e sai vazio. Serve para olhar
antes de um PR que mexe no visual — e falha se aparecer erro de console.

Para trabalhar o CSS com recarga automática, o harness de mock em `.claude/preview`
continua sendo o caminho mais rápido; ele não usa banco nem o processo principal.

### Cobertura

`npm run test:coverage` mede todo o código de produção (`src/main`, `src/preload` e
`src/renderer/src`) e falha abaixo dos pisos do `vitest.config.ts`. O relatório
detalhado fica em `coverage/index.html`.

| Camada                        | Piso (linhas) | Medido em 19/09/2026 |
| ----------------------------- | ------------- | -------------------- |
| `src/main`                    | 70%           | 74,5%                |
| `src/renderer/src/utils`      | 95%           | 97,3%                |
| `src/renderer/src/components` | 35%           | 38,8%                |
| **global**                    | **40%**       | **43,4%**            |

Os pisos ficam no múltiplo de 5 logo abaixo do medido: seguram regressão sem
quebrar no primeiro commit, e sobem quando a camada sobe. O preload continua em 0% e
sem piso próprio; ele aparece no global, onde o número baixo fica visível.

Os testes de integração chamam os handlers reais pelo
`src/tests/helpers/ambiente-ipc.ts`, sobre o sql.js; todos os domínios passam por
ele, menos o backup. Teste que monta o próprio SQL não protege o código que roda no
app: com cinco mutações nos handlers, os testes antigos de recebíveis, painel,
exclusão e arquivamento continuavam todos verdes.

Dívida conhecida: os handlers de backup (abrem diálogo nativo e reiniciam o app) e o
que só roda com o Electron de verdade (`src/main/index.ts`, `database/index.ts` e a
cola do `updater.ts` com o electron-updater) seguem sem teste automatizado. O fluxo
de atualização mora em `src/main/servicos/atualizacao.ts`, com teste; a instalação de
verdade só se confere com uma release publicada. O `database/backup.ts` roda em
`src/tests/integration/backup-arquivos.test.ts` numa pasta temporária, com o
Electron e a API de backup do SQLite trocados; o `validarBackup`, que abre o arquivo
pelo better-sqlite3, fica de fora.

### Dependências

- **Nunca rode `npm audit fix --omit=dev`.** O `--omit=dev` vale também para a
  instalação: o dry-run desse comando mostrou que ele removeria 691 pacotes de
  desenvolvimento do `node_modules`. Corrija com `npm install <pacote>@<versão>` ou
  `npm update <pacote>`, e confira no lockfile quais pacotes mudaram.
- **O audit de produção não mostra o Electron.** Ele é dependência de
  desenvolvimento, mas é o runtime do instalador. Rode também o `npm audit` completo
  e mantenha o Electron no patch mais recente da major. Cada major tem cerca de seis
  meses de suporte (a 44 vai até 2027-03-02): troque antes, porque depois disso o
  Chromium do instalador deixa de receber correção.
- **O binário do Electron baixa no primeiro uso**, não no `npm install`: desde a 42,
  o primeiro `npm run dev` ou `npm run test:e2e` depois de trocar de versão faz o
  download.
- **Pacote do renderer é dependência de desenvolvimento.** O Vite embute no bundle
  tudo o que o renderer importa; `dependencies` fica só com o que o processo
  principal carrega em tempo de execução (hoje `better-sqlite3`, `drizzle-orm`,
  `electron-log`, `electron-updater` e `zod`). Pacote em `dependencies` vai inteiro
  para o `app.asar`: até a 1.15, eram 73 dos 75 MB dele. O audit de produção também
  não mostra os do renderer, que chegam à máquina dela dentro do bundle.
- **O `better-sqlite3` não é recompilado.** Desde a 13 ele usa N-API e traz o binário
  pronto no pacote, que serve para qualquer Electron; por isso não há `postinstall` e
  o electron-builder roda com `npmRebuild: false`. Até a 12, cada Electron novo
  pedia um binário próprio, e sem compilador C++ na máquina não havia como seguir.
  Dependência nativa nova que precise de compilação quebra o empacotamento nessa
  máquina: prefira pacotes com N-API.
- Advisory aceito, com o motivo, fica registrado no [SECURITY.md](SECURITY.md).

### `.only` é barrado

A suíte falha se encontrar `it.only` ou `describe.only`. É proposital: sem CI, um
`.only` esquecido deixava a suíte verde pulando o resto do arquivo, com saída 0.

Para depurar um teste isolado, prefira filtrar sem `.only`, porque aí não há o que
esquecer no commit:

```bash
npx vitest run -t "nome do teste"
```

Se precisar mesmo do `.only`, a escotilha é `VANBIJOUX_ALLOW_ONLY=1 npm test`.

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
