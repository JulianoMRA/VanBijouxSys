# Regras de negócio

As regras que o app precisa respeitar para os números da Van baterem com a
realidade. Cada uma tem o que acontece na tela, por que é assim, onde mora no
código e qual teste prova. Quando uma regra mudar, a mudança passa por aqui.

Processo, pipeline e release estão no [CONTRIBUTING.md](../CONTRIBUTING.md);
modelo de ameaças e alertas aceitos, no [SECURITY.md](../SECURITY.md).

**Como citar**: use o número (`RN-05`) na descrição do PR e no comentário do
código que implementa a regra. Assim dá para ir do código ao motivo sem
arqueologia no histórico.

---

## Estoque de insumos

### RN-01 — Insumo baixa na produção, nunca na venda

Quando peças são produzidas, a receita da variação sai do estoque de insumos.
Vender não mexe em insumo nenhum: o material daquela peça já saiu quando ela foi
feita.

Baixam insumo: cadastrar variação com estoque inicial respondendo "Fiz agora",
"+ Estoque", e editar a variação subindo o estoque como produção. Devolvem
insumo: baixar o estoque como produção (produção lançada por engano) e excluir a
variação marcando "devolver insumos" (RN-11).

- **Código**: `src/main/repositorios/estoque.ts` (`movimentarEstoqueDaVariacao`,
  parâmetro `acompanharInsumos`), usado por `repositorios/produtos.ts`. Vendas
  chamam a mesma função com `acompanharInsumos: false`
  (`repositorios/vendas.ts`).
- **Prova**: `src/tests/integration/variations.test.ts`
  (`should_deduct_recipe_times_initial_stock_when_created_with_stock`,
  `should_add_pieces_and_deduct_recipe_times_quantity`) e
  `src/tests/integration/sales.test.ts`
  (`should_not_touch_insumos_because_they_were_deducted_at_production`).
  Ponta a ponta: `e2e/producao-e-venda.spec.ts`, "produzir peças pela tela baixa
  os insumos da receita".

### RN-02 — Mudou o estoque de peças, o app pergunta o motivo

Com receita cadastrada, toda mudança no estoque de peças abre a pergunta: **"Fiz
agora"** (produção) baixa os insumos; **"Já estavam prontas"** / **"Corrigir
contagem"** não mexe neles.

Sem receita, o app não pergunta: não há insumo para mover, e perguntar seria só
atrito.

- **Código**: `src/renderer/src/utils/ajuste-de-estoque.ts`
  (`precisaPerguntarMotivo`, `descreverPerguntaDeEstoque`) e o
  `MotivoDoEstoqueDialog`; o motivo viaja no canal como `motivoDoEstoqueInicial`
  ou `ajusteDeEstoque.motivo` (`src/shared/ipc/produtos.ts`).
- **Prova**: `src/tests/ajuste-de-estoque.test.ts`,
  `src/tests/tela/variacao.test.tsx` (pergunta com receita, silêncio sem receita)
  e `src/tests/integration/variations.test.ts` (`variations:update com ajuste de
estoque`).

### RN-03 — Saldo de insumo pode ficar negativo, e isso quer dizer algo

O estoque de um insumo pode ficar abaixo de zero. Não é erro a corrigir
automaticamente: negativo significa que faltou lançar uma compra, ou que a
receita pede mais material do que se usa de verdade. Truncar em zero descartaria
essa diferença e faria o resultado depender da ordem em que compra e produção
foram lançadas.

- **Código**: `src/main/repositorios/estoque.ts` (`saldoArredondado`).
- **Prova**: `src/tests/integration/variations.test.ts`
  (`should_let_insumo_go_negative_when_initial_stock_needs_more_than_available`,
  `should_reach_the_same_balance_whatever_is_registered_first`).

### RN-04 — Saldo de insumo arredonda em quatro casas

Insumo é fracionário (0,1 g de cola), e somas de ponto flutuante deixam resíduo:
0,3 − 3 × 0,1 dá −2,8e-17, que a tela mostra como "-0" e o alerta de esgotado não
reconhece. Quatro casas bastam para cm, g e unidade.

- **Código**: `src/main/repositorios/estoque.ts` (`saldoArredondado`, com
  `+ 0.0` para o zero negativo virar zero).
- **Prova**: `src/tests/integration/variations.test.ts`
  (`should_round_fractional_deductions_so_an_empty_insumo_is_exactly_zero`).

### RN-05 — Unidade do insumo trava quando ele está em receita

Trocar a unidade não converte nada: 20 cm de fio numa receita virariam 20 g. Por
isso, insumo usado em variação ativa não muda de unidade — o caminho é cadastrar
outro insumo com a unidade certa. Sem receita, a troca é permitida, mas só junto
com a contagem do estoque na unidade nova.

- **Código**: `src/main/repositorios/insumos.ts` (`validarTrocaDeUnidade`).
- **Prova**: `src/tests/integration/insumos.test.ts` e
  `src/tests/tela/insumo-e-exclusao.test.tsx` (botões das outras unidades
  desabilitados, com o aviso na tela).

---

## Estoque de peças e vendas

### RN-06 — Estoque de peças é inteiro no cadastro; negativo, só por venda

O que a Van digita em "quantidade em estoque" é peça inteira e não negativa.
Venda acima do estoque é permitida — acontece na feira, com peça que ela fez e
não lançou — e deixa o saldo negativo, com aviso na tela antes de salvar.

- **Código**: `src/main/repositorios/estoque.ts` (`validarEstoqueDePecas`,
  mensagem "Quantidade em estoque inválida.") e o aviso no `SaleForm`.
- **Prova**: `src/tests/integration/produtos-payload.test.ts` (recusa de 1,5 e de
  negativo), `src/tests/tela/venda.test.tsx` (aviso com a conta certa) e
  `e2e/producao-e-venda.spec.ts` ("vender mais do que o estoque").

### RN-07 — O custo da venda é histórico

Cada item guarda o custo da peça no dia da venda. Editar a venda depois — trocar
a forma de pagamento, corrigir a data — **não** regrava esse custo com o custo de
hoje, senão o lucro de um mês fechado mudaria sozinho. Só item novo, ou item que
passou a apontar para outra variação, usa o custo atual.

- **Código**: `src/renderer/src/utils/itens-de-venda.ts` (`custoUnitarioDoItem`).
- **Prova**: `src/tests/itens-de-venda.test.ts` e
  `src/tests/tela/venda.test.tsx`
  (`should_keep_the_cost_recorded_in_the_sale_when_editing_an_old_one`).

### RN-08 — Venda "a receber" entra no caixa no dia em que o dinheiro entra

Venda fiada conta no faturamento desde o dia da venda, mas fica **fora** do caixa
enquanto não é recebida. Ao marcar como recebida, ela entra pela data do
recebimento, com a forma de pagamento e a taxa informadas ali. Desfazer o
recebimento devolve a venda para "a receber", zera a taxa e volta o líquido para
o total.

- **Código**: `src/main/repositorios/caixa.ts` (`estatisticas`, com
  `date(COALESCE(received_at, sold_at))` e o filtro `payment_method != 'areceber'`)
  e `repositorios/vendas.ts` (`marcarRecebida`, `desmarcarRecebida`).
- **Prova**: `src/tests/integration/receivable.test.ts`,
  `src/tests/integration/cash.test.ts` e `src/tests/cash-calculations.test.ts`.

---

## Preço

### RN-09 — Fórmula da precificação

O preço sugerido é `teto((materiais × 3 + mão de obra) × 1,10 + 1,00)`. Os três
multiplicam o material, a mão de obra entra depois, a margem de 10% cobre o
imprevisto e o arredondamento para cima fecha o preço num valor cheio.

Aplicar o preço sugerido a uma variação muda **apenas** o preço de venda: não
toca no custo, no estoque nem na receita. Esse foi o defeito mais caro do app
(v1.11.0), em que aplicar preço apagava a receita da variação em silêncio.

- **Código**: `src/renderer/src/utils/pricing.ts` (`calcSuggestedPrice`) e o
  canal `variations:setSalePrice` (`src/main/repositorios/produtos.ts`,
  `definirPrecoDeVenda`).
- **Prova**: `src/tests/pricing.test.ts`,
  `src/tests/tela/precificacao.test.tsx` (a tela só pode chamar
  `setSalePrice`), `src/tests/integration/variations.test.ts`
  (`should_keep_the_recipe_so_later_production_still_deducts_insumos`) e
  `e2e/producao-e-venda.spec.ts` ("aplicar preço mantém a receita").

---

## Histórico: arquivar e excluir

### RN-10 — Arquivar tira da frente sem apagar o passado

Produto, variação e insumo arquivados somem dos alertas, das listas e dos
seletores, mas continuam no histórico: as vendas antigas seguem apontando para
eles. Arquivar o produto inativa as variações **por derivação** — nada é escrito
nelas, para desarquivar não ressuscitar variação que já estava arquivada sozinha.

- **Código**: `src/renderer/src/utils/arquivamento.ts` (`variacaoInativa`,
  `variacoesAtivas`) e o `archivedAt` nos repositórios.
- **Prova**: `src/tests/arquivamento-helpers.test.ts` e
  `src/tests/integration/arquivamento.test.ts`.

### RN-11 — Exclusão é barrada quando apagaria histórico

Não se exclui o que tem passado: produto ou variação com venda, feira com venda,
insumo em receita, categoria de despesa com despesa. A recusa chega à tela com
texto explicando o motivo, nunca com erro técnico.

- **Código**: `src/main/ipc/mensagens.ts` (mensagens por canal, inclusive a
  tradução de violação de chave estrangeira) e `repositorios/caixa.ts` para a
  categoria.
- **Prova**: `src/tests/integration/delete-constraints.test.ts` e
  `src/tests/ipc-mensagens.test.ts`.

### RN-12 — Excluir variação pode devolver os insumos

Quando a variação tem peças e receita, a exclusão oferece devolver aos insumos o
material dessas peças. A opção vem **desmarcada**: o caso normal é que as peças
existiram e o material foi mesmo usado. Marcar só faz sentido quando o cadastro
foi engano e as peças nunca foram feitas. A devolução e a exclusão acontecem na
mesma transação.

- **Código**: `src/main/repositorios/produtos.ts` (`excluirVariacao`) e
  `ExcluirVariacaoDialog`.
- **Prova**: `src/tests/integration/variations.test.ts` (`variations:delete`) e
  `src/tests/tela/insumo-e-exclusao.test.tsx`.

---

## Números e datas

### RN-13 — Número digitado segue o jeito brasileiro

"1.000" é mil, "0,35" é trinta e cinco centésimos. O `<input type="number">` do
Chromium segue o idioma do Windows e erra em silêncio, então os campos do app são
texto, lidos por um interpretador próprio; ao sair do campo, o texto é reescrito
como foi entendido.

- **Código**: `src/renderer/src/utils/numero.ts` (`interpretarNumero`,
  `formatarNumeroParaCampo`) e o componente `CampoNumerico`.
- **Prova**: `src/tests/numero.test.ts`,
  `src/tests/tela/campo-numerico.test.tsx` e `e2e/producao-e-venda.spec.ts`
  ("número com ponto de milhar").

### RN-14 — Data pode vir com hora nos registros antigos

As telas mandam `AAAA-MM-DD`. Registros gravados até a v1.12.1 guardam
`AAAA-MM-DD HH:MM:SS`, escrito pelo próprio SQLite. Os dois formatos são aceitos
nos canais, e todo filtro de período usa `date(...)` para o registro antigo cair
no período certo. Data da venda e da despesa são obrigatórias: sem elas o
registro some dos relatórios por mês.

- **Código**: `src/shared/ipc/comum.ts` (`dataIsoSchema` aceita os dois;
  `dataSimplesSchema`, só data, para o período do painel) e os `date(...)` em
  `repositorios/painel.ts` e `repositorios/caixa.ts`.
- **Prova**: `src/tests/integration/dashboard.test.ts` (`dashboard: data com hora
em sold_at`, `dashboard: bordas do período`),
  `src/tests/integration/vendas-payload.test.ts` e
  `src/tests/integration/datas-de-criacao.test.ts`.

---

## Backup

### RN-15 — Backup diário, dez dias de histórico, cópia antes de restaurar

O app faz um backup por dia na abertura e mantém os dez mais recentes. Antes de
uma atualização e antes de restaurar, ele grava um backup extra: restaurar o
arquivo errado não pode ser um caminho sem volta. A cópia usa a API de backup do
SQLite, consistente mesmo com o WAL ativo.

Restaurar tem três portas: escolher o arquivo, o app conferir que ele é mesmo um
banco do Van Bijoux (integridade e tabelas) e a confirmação do aviso. Depois da
troca, o app reinicia, porque a conexão e os prepared statements morrem ali.

- **Código**: `src/main/database/backup.ts`, `database/backup-rules.ts`
  (`MAX_BACKUPS = 10`) e `src/main/servicos/backup.ts` (as três portas).
- **Prova**: `src/tests/backup-rules.test.ts` e
  `src/tests/integration/backup-payload.test.ts` (16 testes do fluxo, incluindo
  arquivo inválido e aviso cancelado).
