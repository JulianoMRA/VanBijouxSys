# Protocolo de handoff

Como uma sessão de trabalho entrega o bastão para a próxima. Este arquivo é
versionado; o handoff em si, não.

Aqui o trabalho acontece em sessões longas que atravessam dias, e o app está em
uso diário por uma pessoa real: perder contexto entre sessões custa caro, porque
a próxima pode repetir uma verificação já feita — ou, pior, pular uma.

## Onde cada coisa mora

| Arquivo                        | Versionado? | Para quê                                            |
| ------------------------------ | ----------- | --------------------------------------------------- |
| `HANDOFF_PROTOCOL.md` (este)   | sim         | a regra do jogo                                     |
| `.claude/HANDOFF.md`           | não         | o estado vivo: onde parou, próxima ação, armadilhas |
| `.claude/*.md` (planos, notas) | não         | planos de fase, investigações, rascunhos            |
| `CHANGELOG.md`                 | sim         | o que mudou, para quem usa o app                    |
| `docs/regras-de-negocio.md`    | sim         | as regras que o código precisa respeitar            |

A pasta `.claude/` inteira é ignorada pelo git. É de propósito: handoff tem
caminho de máquina, nome de arquivo de backup e anotação de meio de caminho —
nada disso pertence ao histórico público do projeto.

## Quando escrever ou atualizar o handoff

1. Quando a sessão estiver perto do limite de contexto. Pare o que estiver
   fazendo e escreva antes de qualquer outra coisa.
2. Quando o usuário sinalizar o fim da sessão.
3. Ao concluir uma fase ou um PR, antes de começar o próximo.
4. Quando o trabalho travar esperando decisão ou dependência externa.

Um handoff que vira tarde demais não serve: o que se perde é justamente a
armadilha que custou meia hora.

## Como a próxima sessão começa

1. Ler `.claude/HANDOFF.md` inteiro e, se houver, o plano da fase.
2. Reconciliar com a realidade: `git status -sb`, `git log --oneline -8`,
   `git ls-remote --heads origin` e `gh pr list`. O handoff descreve o que era
   verdade quando foi escrito; o repositório é a fonte.
3. Apresentar ao Juliano, em poucos bullets, onde o trabalho parou e qual é a
   próxima ação.
4. Aguardar confirmação antes de qualquer push, PR, merge ou release.

## O que o handoff precisa ter

- **Estado do repositório**: branch, árvore limpa ou não, o que a `main` já tem,
  PRs abertos, número de testes e se o pipeline estava verde.
- **O que foi concluído** nesta sessão, em um parágrafo.
- **Próxima ação concreta**, acionável sem reler todo o código.
- **Trabalho restante**, em passos ordenados por dependência.
- **Decisões pendentes** que precisam do usuário.
- **Como verificar**: os comandos que reproduzem o estado verde, e o que foi
  verificado no Electron de verdade.
- **Armadilhas desta sessão**: o que custou tempo e não pode custar de novo.

## Boas práticas

- Datas absolutas, nunca "ontem" ou "semana que vem".
- Números conferidos: quantos testes, qual cobertura, qual commit.
- Dizer o que **não** foi verificado, com a mesma clareza do que foi.
- Mudança não commitada precisa estar listada como tal.
- Sem emoji, como em todo o resto do projeto.
