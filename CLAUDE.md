# CLAUDE.md

Guia operacional do Claude Code neste repositório. O processo completo, com os
comandos, está em [CONTRIBUTING.md](CONTRIBUTING.md); aqui ficam as regras que
não podem ser esquecidas.

## Contexto

App Electron com SQLite local, em uso diário por uma usuária real. O banco vive
só na máquina dela e o auto-update entrega cada release sem conferência humana.
Perda ou corrupção de dado é o pior cenário possível, e pesa mais que qualquer
funcionalidade.

## Regras invioláveis

1. **Branch por tema a partir da `main`** (`fix/`, `feat/`, `refactor/`, `docs/`,
   `chore/`). PR obrigatório para merge, por merge commit.
2. **Teste antes da implementação** em regra de negócio e handler IPC. O teste de
   integração chama o handler real; copiar o SQL para dentro do teste não protege
   o código que roda na máquina dela.
3. **Conventional Commits**, commits atômicos, corpo explicando o porquê.
4. **Pipeline local verde antes do PR**: `lint`, `typecheck`, `test`, `build`. Não
   há CI que verifique por você.
5. **Push, PR, merge e release só com confirmação explícita.** Commit local em
   branch de trabalho faz parte do fluxo; o que sai da máquina, não.
6. **Migrations publicadas são imutáveis.** Mudança de schema vai em migração nova.

## Descrição do PR

O que mudou, por que, e como foi verificado. O que **não** foi verificado vai
escrito, nunca omitido — a lacuna fica visível em vez de silenciosa.

## Após mergear `fix` ou `feat` na `main`

Merge não publica nada. Propor a release e aguardar confirmação, com:

1. O bump sugerido (`patch` para correção; `minor` para funcionalidade ou mudança
   de comportamento).
2. A entrada correspondente do CHANGELOG, escrita para quem usa o app.
3. Lembrete de usar `npm version`, nunca criar a tag na mão, e de anexar o
   `latest.yml` à release.
