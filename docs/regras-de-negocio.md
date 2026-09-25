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
isso, insumo usado em receita não muda de unidade — o caminho é cadastrar outro
insumo com a unidade certa. Vale para qualquer receita, inclusive de variação
arquivada ou de produto arquivado, que podem voltar. Sem receita, a troca é
permitida, mas só junto com a contagem do estoque na unidade nova.

Até a 1.16 a tela travava a unidade só pelas variações ativas: num insumo de
receita arquivada, ela deixava escolher outra unidade, e o app recusava só ao
salvar.

- **Código**: `src/main/repositorios/insumos.ts` (`validarTrocaDeUnidade`),
  `src/main/database/consultas-estoque.ts` (`usadoEmReceitas`, a mesma contagem,
  que a tela usa) e `src/renderer/src/components/insumos/InsumoForm.tsx`.
- **Prova**: `src/tests/integration/insumos.test.ts` (`insumos:update trocando a
unidade`, `insumos:getAll: uso em receitas`),
  `src/tests/tela/insumo-e-exclusao.test.tsx` e
  `src/tests/tela/unidade-do-insumo.test.tsx` (botões das outras unidades
  desabilitados, com o aviso na tela).

### RN-19 — Esgotado é sem estoque; abaixo do mínimo é ter menos que o mínimo

Insumo sem estoque — zero ou negativo — está **esgotado**, tenha mínimo definido
ou não. Está **abaixo do mínimo** quando ainda tem estoque, mas menos que o mínimo
que a Van definiu; sem mínimo, nunca fica "abaixo". A tela de Estoque, o contador
da barra lateral e os avisos do Painel usam a mesma regra. Até a 1.16 o Painel
exigia mínimo definido para avisar de insumo esgotado, e a barra lateral contava
um número que o Painel não mostrava. Item arquivado não entra em aviso nenhum
(RN-10).

- **Código**: `src/renderer/src/utils/situacao-do-insumo.ts`
  (`situacaoDoInsumo`, `precisaDeReposicao`) e as consultas
  `SQL_INSUMOS_ESGOTADOS` e `SQL_INSUMOS_ABAIXO_DO_MINIMO` em
  `src/main/database/consultas-estoque.ts`.
- **Prova**: `src/tests/situacao-do-insumo.test.ts` e
  `src/tests/integration/insumos.test.ts` (`alerta de reposição`).

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
enquanto não é recebida. O que entra no caixa são os pagamentos dela (RN-17),
cada um pela data em que foi recebido, com a forma e a taxa informadas ali.

As vendas recebidas até a 1.14 guardam o recebimento na própria linha
(`received_at`) e continuam entrando no caixa por essa data. Desfazer o
recebimento delas devolve a venda para "a receber", sem taxa e com o líquido
igual ao total; editar a venda e escolher "A receber" faz o mesmo. Se a venda já
tiver pagamentos, as taxas deles continuam descontadas do líquido (RN-17). Numa
venda paga por pagamentos, desfazer é excluir o pagamento.

Até a 1.16 a edição mantinha o `received_at`: a venda voltava a dever tudo e
continuava marcada como recebida naquele dia.

- **Código**: `src/renderer/src/utils/cash-calculations.ts` (`cashDateOf`,
  `filterCashSales` e `filterCashPayments`: vendas pela data do recebimento, fora
  as "a receber", mais os pagamentos pela data deles), usado pela tela de Caixa;
  `src/main/repositorios/painel.ts` (entradas e fluxo de caixa do Painel) e
  `src/main/repositorios/vendas.ts` (`desmarcarRecebida`, que só age em venda com
  `received_at`, e `atualizarVenda`).
- **Prova**: `src/tests/integration/receivable.test.ts`,
  `src/tests/integration/pagamentos.test.ts` (`pagamento no caixa e no painel`,
  `vendas recebidas antes da migração 4`) e `src/tests/cash-calculations.test.ts`.

### RN-16 — Venda "a receber" precisa do nome da cliente

A venda a receber é cobrada depois, e sem o nome não há de quem cobrar. Por isso
ela só é salva com a cliente preenchida, ao registrar e ao editar; nas outras
formas de pagamento o nome é opcional. O nome é gravado sem espaço sobrando, e a
tela sugere os que já foram usados: "Maria" e "maria" contam como a mesma
cliente, para a cobrança dela não se espalhar em dois nomes. As vendas lançadas
antes da migração 3 ficam sem cliente até alguém editá-las.

- **Código**: `src/main/repositorios/vendas.ts` (`exigirClienteNoAReceber`),
  `src/shared/clientes.ts` (`normalizarNomeDaCliente` e a mensagem, a mesma na
  tela e no processo principal) e `src/renderer/src/utils/sugestoes-de-clientes.ts`
  (`nomesDeClientes`).
- **Prova**: `src/tests/integration/cliente-da-venda.test.ts`,
  `src/tests/tela/venda.test.tsx` (`SaleForm: cliente`),
  `src/tests/clientes.test.ts` e `src/tests/sugestoes-de-clientes.test.ts`.

### RN-17 — Venda "a receber" pode ser paga em partes

Cada pagamento é um registro próprio, com valor, forma, taxa e data. O que falta
receber é o total da venda menos a soma dos valores pagos, e é isso que o "A
receber" mostra em todo lugar: na lista de Vendas, no card, no botão do filtro e
no Painel. A taxa não mexe nesse saldo, porque a cliente deve o valor cheio, mas
sai do lucro: na venda a receber, a taxa é a soma das taxas dos pagamentos e o
líquido é o total menos ela, recalculados na mesma transação de quem mexe nos
pagamentos ou no total. Assim o Painel continua lendo o líquido da venda.

O app recusa pagamento acima do que falta, em venda que não é a receber ou que
já foi quitada, e com data anterior à da venda. Com pagamento registrado, a venda
não troca de forma, não fica com total abaixo do que já foi pago e não passa a
ser posterior a um pagamento. As contas são em centavos, para 86 − 50 − 36 dar
zero exato. Excluir um pagamento devolve o valor ao que falta; excluir a venda
leva os pagamentos junto.

- **Código**: `src/main/repositorios/vendas.ts` (`registrarPagamento`,
  `excluirPagamento`, `recalcularLiquidoDaVendaAReceber`,
  `conferirEdicaoComPagamentos`, `quantoFalta`), a migração 4,
  `src/shared/recebimentos.ts` (as recusas, com o texto que a tela mostra),
  `src/shared/dinheiro.ts` (`emCentavos`) e
  `src/renderer/src/utils/recebimentos.ts`.
- **Prova**: `src/tests/integration/pagamentos.test.ts`,
  `src/tests/recebimentos.test.ts`, `src/tests/tela/receber.test.tsx`,
  `src/tests/tela/vendas.test.tsx` (`Vendas: pagamento parcial`) e
  `src/tests/tela/venda.test.tsx` (`SaleForm: venda com pagamento registrado`).

### RN-18 — O saldo do caixa conta todo o histórico, em qualquer período

O saldo de abertura é o que havia em caixa antes de a Van usar o app. Num
período (Mês, 3M, 6M, Ano, Personalizado), o caixa começa no **saldo inicial**:
a abertura mais tudo o que entrou e saiu antes do primeiro dia do período, pelas
mesmas regras das entradas (RN-08, RN-17) e das saídas, custos de feira
incluídos. Saldo inicial + entradas − saídas dá o saldo do fim do período, que é
o **saldo atual** quando o período chega até hoje; num personalizado que terminou
antes, ele aparece como "Saldo em DD/MM/AAAA". Em "Tudo" o primeiro número é a
própria abertura.

Até a 1.16 o período somava só a abertura cadastrada: em setembro, com agosto
movimentado, o "Mês" mostrava como saldo atual a abertura mais o que entrou em
setembro, e a coluna de saldo de cada linha herdava o erro. Registro antigo sem
data (RN-14) conta como anterior a qualquer período: o dinheiro existiu, e sem ele
o saldo do mês não bateria com o de "Tudo".

- **Código**: `src/renderer/src/utils/cash-calculations.ts`
  (`movimentoAntesDoPeriodo`, `calcCashSummary`, `rotuloDoSaldoInicial`,
  `rotuloDoSaldoFinal`), usado pela tela de Caixa, e `repositorios/painel.ts`
  (`startBalance` do caixa do período).
- **Prova**: `src/tests/cash-calculations.test.ts` (`movimentoAntesDoPeriodo`,
  `saldo do caixa em qualquer período`, `rótulos do saldo`),
  `src/tests/integration/dashboard.test.ts` (`dashboard: saldo do caixa no
período`), `src/tests/tela/caixa.test.tsx` e `src/tests/tela/painel.test.tsx`
  (`Painel: caixa do período`).

### RN-20 — Taxa e líquido da venda são calculados pelo app

Na venda paga na hora, a taxa em reais é o total vezes a porcentagem informada, e
o líquido é o total menos a taxa. A conta é feita ao gravar e ao editar a venda,
fora da tela: a tela mostra a mesma conta enquanto a venda é preenchida, mas o
líquido gravado, que o Painel e o Caixa leem, não depende do que ela enviou. Na
venda a receber, a taxa vem dos pagamentos (RN-17).

Até a 1.16 a tela mandava a taxa e o líquido prontos, e o app gravava o que
viesse: uma conta errada na tela iria direto para o faturamento e o caixa.

- **Código**: `src/main/repositorios/vendas.ts` (`taxaELiquido`, em `criarVenda` e
  `atualizarVenda`).
- **Prova**: `src/tests/integration/vendas-payload.test.ts` (`vendas: taxa e
líquido calculados no processo principal`).

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

Até a 1.13 (vendas) e a 1.14 (despesas), apagar a data e salvar gravava o campo
vazio, e essas linhas continuam no banco: a data real não dá para recuperar. Elas
ficam fora de todo período com data e aparecem só em "Tudo", onde as telas mostram
"Sem data" — na lista de Vendas, no Caixa e nos gráficos por mês do Painel, que
antes quebravam. Editar a venda e informar o dia resolve.

- **Código**: `src/shared/ipc/comum.ts` (`dataIsoSchema` aceita os dois;
  `dataSimplesSchema`, só data, para o período do painel), os `date(...)` em
  `repositorios/painel.ts` e `repositorios/caixa.ts`, e
  `src/renderer/src/utils/format.ts` (`partesDaData`, `formatDate`, `SEM_DATA`).
- **Prova**: `src/tests/integration/dashboard.test.ts` (`dashboard: data com hora
em sold_at`, `dashboard: bordas do período`, `dashboard: venda antiga sem data`),
  `src/tests/integration/vendas-payload.test.ts`,
  `src/tests/integration/datas-de-criacao.test.ts`, `src/tests/format.test.ts`,
  `src/tests/tela/painel.test.tsx` e `src/tests/tela/vendas.test.tsx`
  (`Vendas: data de venda antiga`).

---

## Backup

### RN-15 — Backup diário, dez dias de histórico, cópia antes de restaurar

O app faz um backup por dia na abertura e mantém os dez dias mais recentes. Antes
de uma atualização, de uma mudança no banco e de uma restauração, ele grava um
backup extra, com o motivo no nome do arquivo (`...-antes-da-1.16.0.db`,
`...-antes-de-migrar.db`, `...-antes-de-restaurar.db`): restaurar o arquivo
errado não pode ser um caminho sem volta. A cópia usa a API de backup do SQLite,
consistente mesmo com o WAL ativo.

Os dois tipos têm cotas separadas, dez de cada. Com uma cota só, cada checagem
de atualização gravava uma cópia e empurrava os dias anteriores para fora: em
setembro de 2026 a cliente ficou com dez backups de um dia só. Pelo mesmo motivo,
a cópia de antes de uma atualização sai uma vez por versão, e não a cada vez que
a checagem encontra a atualização já baixada.

Restaurar tem três portas: escolher o arquivo, o app conferir que ele é mesmo um
banco do Van Bijoux (integridade e tabelas) e a confirmação do aviso. O arquivo
escolhido é copiado antes do backup de segurança, porque a rotação pode apagá-lo:
restaurar o mais antigo de uma pasta cheia falhava com o banco já fechado. Depois
da troca, o app reinicia, porque a conexão e os prepared statements morrem ali.

- **Código**: `src/main/database/backup.ts`, `database/backup-rules.ts`
  (`MAX_BACKUPS_DIARIOS` e `MAX_BACKUPS_DE_EVENTO`) e
  `src/main/servicos/backup.ts` (as três portas).
- **Prova**: `src/tests/backup-rules.test.ts` (nomes, cotas e a cópia do dia),
  `src/tests/integration/backup-arquivos.test.ts` (o `backup.ts` de verdade numa
  pasta temporária: restauração do mais antigo, dez dias preservados, uma cópia
  por versão) e `src/tests/integration/backup-payload.test.ts` (o fluxo das três
  portas, incluindo arquivo inválido e aviso cancelado).
