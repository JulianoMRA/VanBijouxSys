# Changelog

## [1.16.0] - 2026-09-23

### Alterado

- **A atualização espera você**: o aplicativo não instala mais a versão nova sozinho depois de fechar. Quando ela termina de baixar, aparece a pergunta **Instalar agora** ou **Depois**. Instalando, o app fecha, mostra o andamento da instalação e abre de novo sozinho em cerca de um minuto; até ele voltar, não desligue nem suspenda o computador. Com **Depois**, a pergunta volta na próxima vez que o app abrir, ou no botão **Verificar atualizações**. Antes, a instalação rodava escondida depois de fechar o app, e se o computador fosse desligado ou suspenso logo em seguida ela parava no meio: o app continuava na versão antiga sem avisar, e numa das vezes deixou de abrir.
- **Instalação que não terminou é avisada**: se a instalação parar no meio, na próxima abertura o app avisa e oferece instalar de novo.

### Corrigido

- **Backups**: o app prometia dez dias de cópias, mas cada vez que procurava atualização gravava mais uma, e as mais antigas iam sendo apagadas: chegou a guardar só um dia. Agora ficam as cópias dos dez últimos dias de uso e, à parte, as feitas antes de uma atualização, de uma mudança no banco ou de uma restauração, com o motivo no nome do arquivo (por exemplo, "antes-da-1.16.0"). A cópia de antes de uma atualização sai uma vez só por versão.
- **Restaurar o backup mais antigo**: com a pasta de backups cheia, escolher o mais antigo fazia a restauração falhar e apagava justamente esse arquivo. Agora o arquivo escolhido fica protegido antes de qualquer outra coisa.
- **Datas à noite**: depois das 21h, o Painel contava o período até o dia seguinte, a feira do dia aparecia como realizada e a cópia do **Salvar backup agora** levava a data de amanhã no nome. Agora vale sempre o dia do relógio do computador.
- **Verificar atualizações sem internet**: a mensagem volta a pedir para conferir a conexão, em vez de um "Tente novamente" genérico.

### Segurança

- **Base do aplicativo atualizada**: o Electron, que é a base do app, foi da versão 41 para a 44. A 41 deixou de receber correções de segurança em agosto; a 44 recebe até março de 2027. Junto, a biblioteca de acesso ao banco de dados foi para uma versão que funciona com qualquer versão da base, sem precisar ser preparada de novo a cada troca.
- **Versão antiga por cima de dados novos**: se um instalador antigo for aberto por engano depois de uma versão que mudou o banco, o app antigo mostra uma mensagem e fecha, em vez de abrir sobre dados que não conhece. Nenhum dado é alterado. A proteção vale para as versões a partir desta; as anteriores não a têm.
- **O aplicativo confere a própria integridade ao abrir**: se os arquivos dele forem alterados depois da instalação, ele não abre.

### Interno

- O aplicativo instalado ocupa uns 40 MB a menos: as bibliotecas da tela, que já iam embutidas nela, deixaram de ser copiadas também em separado.
- O executável passa a mostrar o nome do autor, e não "GitHub, Inc.", em Propriedades e em Aplicativos instalados.
- Regra RN-15 (backup) atualizada com as duas cotas de cópias.
- A suíte de testes vai de 570 para 624.

---

## [1.15.1] - 2026-09-23

### Corrigido

- **Gráficos do Painel**: num mês com pouco movimento, o eixo dos gráficos "Faturamento e lucro" e "Entradas e saídas por mês" mostrava "R$0k" em todas as marcas, e não dava para ler a escala. Agora mostra os valores em reais ("R$25", "R$50") e, a partir de mil, em milhares ("R$1,5k"). O gráfico de vendas por dia das feiras passou a usar vírgula nos centavos.

### Interno

- Removida uma cópia antiga do banco que só os testes usavam e que nenhum teste chamava mais.
- A suíte de testes vai de 566 para 570.

---

## [1.15.0] - 2026-09-23

### Adicionado

- **Pagamento em partes**: a venda "A receber" pode ser paga aos poucos. O botão **Receber**, na lista de Vendas, já vem com o valor que falta: é só confirmar para quitar de uma vez, ou trocar por um valor menor quando a cliente pagar uma parte. Cada pagamento guarda a forma (dinheiro, PIX, débito ou crédito), a taxa e a data. Numa venda de R$ 86,00 com R$ 50,00 pagos, a lista mostra "pago R$ 50,00 · falta R$ 36,00".
- **O "A receber" mostra o que falta**: na tela de Vendas e no Painel, o valor a receber passa a ser só o que ainda não foi pago, e não o valor cheio da venda.
- **Cada pagamento entra no Caixa no dia em que o dinheiro entrou**, já sem a taxa. A venda continua contando no faturamento desde o dia em que foi feita.
- **Pagamento lançado errado**: ao abrir a venda na lista, aparecem os pagamentos dela, e cada um pode ser excluído. O valor volta a faltar e sai do Caixa.
- **Nome da cliente na venda**: o formulário ganhou o campo **Cliente**, que sugere os nomes já usados para a mesma pessoa não aparecer escrita de dois jeitos. O nome aparece na lista de Vendas e no Caixa.
- **Busca pela cliente**: a busca de Vendas encontra pelo nome, sem diferenciar maiúsculas e acentos ("marcia" acha "Márcia"). Buscando uma cliente, o card "A receber" mostra quanto ela deve.

### Alterado

- **Venda "A receber" precisa do nome da cliente**, para saber de quem cobrar. Vale ao registrar e ao editar: uma venda a receber antiga, sem nome, vai pedir o nome na próxima vez que for editada. Receber o pagamento dela não depende disso.
- Numa venda com pagamento registrado, a forma continua "A receber" e o total não pode ficar abaixo do que já foi pago. Para mudar, exclua o pagamento antes.
- O card **Entradas** do Caixa conta recebimentos em vez de vendas, porque um pagamento parcial também é uma entrada.
- As vendas já recebidas continuam como estavam, inclusive com o "Desfazer recebimento".

### Interno

- Duas mudanças no banco, que só acrescentam: o nome da cliente na venda e a tabela de pagamentos. Nenhuma venda existente é alterada, e o app faz um backup antes de aplicá-las, como em toda mudança de banco.
- Regras RN-16 (cliente na venda a receber) e RN-17 (pagamento em partes) documentadas, e RN-08 atualizada.
- A suíte de testes vai de 468 para 566, com um fluxo de ponta a ponta novo: venda a receber paga em duas vezes.

---

## [1.14.0] - 2026-09-18

### Corrigido

- **Data da despesa**: apagar a data no formulário e salvar gravava a despesa sem data. Ela continuava na lista, mas sumia do resumo do período e do fluxo de caixa. Agora o app pede a data antes de salvar.

### Interno

- **Conferência do que chega antes de gravar**, agora em todas as telas: caixa, feiras, painel e backup completam o que insumos, produtos e vendas já tinham. Se vier algo fora do esperado, o app recusa com uma mensagem e não grava nada pela metade. Nada muda no uso normal.
- O período do painel passou a ser conferido: antes, um valor desconhecido era tratado como "este ano" sem aviso.
- O backup ganhou testes automáticos do caminho de restauração — escolher o arquivo, conferir que ele é mesmo um backup e confirmar o aviso.
- A suíte de testes vai de 397 para 446.

---

## [1.13.0] - 2026-09-18

### Corrigido

- **Data da venda**: apagar a data no formulário e salvar gravava a venda sem data. Ela continuava na lista, mas sumia dos relatórios por mês e das contas da feira. Agora o app pede a data antes de salvar.

### Interno

- **Conferência do que chega antes de gravar**: os cadastros de insumos, produtos, variações e vendas passam a conferir o formato dos dados antes de tocar no banco. Se vier algo fora do esperado, o app recusa com uma mensagem e não grava nada pela metade. Nada muda no uso normal das telas.
- A regra de cada cadastro saiu dos canais de comunicação interna para módulos próprios, com testes que chamam o código real.
- A suíte de testes vai de 331 para 397.

---

## [1.12.2] - 2026-09-14

### Corrigido

- **Data de cadastro**: produtos, variações, feiras, insumos, categorias de despesa e despesas eram salvos sem a data em que foram cadastrados. A partir desta versão, cada cadastro novo guarda essa data. Os cadastros feitos antes continuam sem ela, porque a data nunca chegou a ser registrada.
- **Caixa**: despesas com a mesma data passam a aparecer da mais recente para a mais antiga. Antes apareciam na ordem inversa.

### Interno

- Os testes de recebíveis, painel, exclusões e arquivamento passam a chamar o código real do app, e caixa e feiras ganham testes próprios.
- A suíte de testes vai de 299 para 331.

---

## [1.12.1] - 2026-09-14

### Segurança

- **Base do aplicativo atualizada**: o Electron, que é a base do app (a janela, o navegador interno e o acesso ao computador), foi da versão 41.0.4 para a 41.10.7, com as correções de segurança publicadas nesse intervalo. Nada muda no uso.
- **Bibliotecas atualizadas**: a de acesso ao banco de dados, a de navegação entre telas, uma das usadas pelos gráficos do painel e a que lê as informações de atualização passam para versões com correções de segurança.

### Interno

- Cobertura de testes medida com `npm run test:coverage`, com pisos por camada.
- `npm audit` de produção entra no pipeline; os dois alertas aceitos ficam registrados no `SECURITY.md`.
- `drizzle-kit`, que não era usado, sai das dependências.

---

## [1.12.0] - 2026-09-14

### Corrigido

- **Abrir o app duas vezes**: clicar no atalho com o app já aberto criava uma segunda janela ligada ao mesmo banco. Uma não via as vendas feitas na outra, e restaurar um backup numa delas podia estragar o que a outra estava gravando. Agora o segundo clique só traz para a frente a janela que já está aberta.
- **App que não abria sem dizer nada**: se o banco de dados não pudesse ser aberto, nenhuma janela aparecia e o app continuava rodando escondido. Agora aparece uma mensagem com o erro e o lugar onde ele ficou registrado, e o app fecha.
- **Erros ficam registrados**: falhas ao salvar, no backup diário ou ao atualizar a estrutura do banco passam a ser gravadas num arquivo de registro no computador. Nada muda na tela; é o que permite descobrir depois o que aconteceu.

### Interno

- Proteções do aplicativo: a janela não navega para fora do app e só abre links http e https no navegador; o executável deixa de aceitar ser usado para rodar outros scripts (fuses do Electron); a tela deixa de ter acesso às variáveis de ambiente do Windows e a canais internos genéricos.
- O instalador passa a levar só o app e as dependências dele. Até a 1.11.0 ele incluía também arquivos de desenvolvimento do repositório.
- `SECURITY.md` com o modelo de ameaças.
- A suíte de testes vai de 277 para 299.

---

## [1.11.0] - 2026-09-13

### Corrigido

- **Estoque de insumos**: aplicar um preço pela Precificação apagava, sem avisar, a lista de insumos da variação. Dali em diante, cada "+ Estoque" daquela peça deixava de descontar material, o estoque de insumos ficava maior que o real e o aviso de reposição parava de aparecer. Agora a Precificação muda só o preço. **As listas que já foram apagadas não voltam sozinhas**: vale abrir "Ver detalhes" nas variações e conferir se a composição continua lá.
- **Estoque de insumos**: vender mais peças do que o estoque registrado, ou excluir uma venda assim, fazia os números saírem do real. O estoque agora pode ficar negativo, e isso tem significado: peça vendida sem a produção registrada, ou compra de insumo ainda não lançada. Lançando o que faltou, o número volta ao certo.
- **Produtos**: mudar a quantidade em estoque pelo "Editar variação" não mexia nos insumos. Agora o app pergunta o que aconteceu: se foi produção, os insumos acompanham; se foi só correção de contagem, eles não mudam. A mesma pergunta aparece ao cadastrar uma variação já com estoque.
- **Produtos**: excluir uma variação cadastrada por engano ganha a opção de devolver os insumos das peças que ela tinha.
- **Números digitados**: "1.000" era gravado como 1 em vários campos, como o "+ Estoque" de insumo, a venda, as despesas e o saldo inicial do caixa. Agora os campos entendem o jeito brasileiro de escrever números e, ao sair do campo, mostram como leram: "1.000" vira "1000".
- **Insumos**: trocar a unidade (un., cm, g) de um insumo usado em receitas mudava o sentido das quantidades sem converter nada. A troca agora é bloqueada nesses casos.
- **Vendas**: editar uma venda antiga regravava o custo dos itens com o custo de hoje, mudando o lucro daquele mês. O custo registrado na venda agora é mantido.

### Interno

- Os testes de integração de estoque passam a chamar os handlers reais, em vez de copiar o SQL deles.
- Fluxo de branches, PRs e release documentado em CONTRIBUTING.md; o pre-push passa a rodar o lint.
- A suíte de testes vai de 218 para 277.

---

## [1.10.0] - 2026-08-15

### Corrigido

- **Menu de ações ("···")**: com a lista curta — depois de uma pesquisa, por exemplo — o menu abria para fora do card e as opções ficavam cortadas, impedindo escolher "Arquivar". Agora ele se posiciona pela tela e abre para cima quando não há espaço embaixo. O problema valia para as cinco telas que usam esse menu.

### Adicionado

- **Produtos**: variação cuja receita usa um insumo arquivado ganha a marca "insumo arquivado", e o card do produto mostra quantas estão nessa situação. Arquivar um insumo continua não arquivando o que é feito com ele — a marca existe justamente para você decidir caso a caso se vale trocar o material ou tirar a peça de circulação.

### Interno

- Suíte de testes vai de 213 para 218.

---

## [1.9.0] - 2026-08-15

### Adicionado

- **Arquivar produtos, variações e insumos**: o que saiu de circulação e você não pretende repor pode ser arquivado. O item sai dos avisos de estoque, das listas e dos seletores de venda e de receita — sem ser excluído. Era o único caminho até agora: excluir não era permitido, porque o histórico de vendas depende desses cadastros.
- **Nada muda no histórico**: vendas antigas continuam mostrando o que foi vendido, e faturamento, lucro, custos e "mais vendidas" ficam exatamente como estavam. Arquivar é sobre o que aparece na sua frente hoje, não sobre o que aconteceu.
- **Produtos**: "Arquivar" no menu do produto e no da variação, e um chip "Arquivados" para rever o que saiu. A variação arquivada some da tabela do produto, com a opção de exibir. Arquivar com estoque em mãos pede confirmação dizendo quantas unidades restam.
- **Estoque**: mesma coisa para insumos. Se o insumo ainda for usado por variações ativas, o aviso diz em quantas antes de confirmar — você decide. O valor parado em insumos arquivados aparece separado, para não inflar o valor em estoque.
- Arquivar um produto silencia as variações dele; desarquivar devolve exatamente o estado anterior, sem trazer de volta variação que você já tinha arquivado sozinha.
- Uma venda antiga que contém um item arquivado continua editável com o item no lugar.

### Interno

- Estrutura do banco na versão 2: coluna `archived_at` em produtos, variações e insumos, aplicada em transação como as demais.
- Consultas de alerta saem do handler do Dashboard para um módulo próprio, e os testes passam a executar o SQL real em vez de uma cópia dele.
- Testes de migração passam a aplicar as migrações de verdade sobre um banco em memória, cobrindo idempotência e preservação dos dados existentes.
- Suíte de testes vai de 174 para 213.

---

## [1.8.0] - 2026-08-15

### Alterado

- **Visual**: as sete telas foram reconstruídas. O rosa saturado dá lugar a um vinho único como cor de ação, sobre fundo e cards em tons neutros quentes; a barra lateral fica clara e integrada ao conteúdo; os números passam a usar alinhamento tabular, o que faz as colunas de valores baterem umas com as outras.
- **Dashboard**: o mural de alertas de estoque virou uma linha só, que diz o que precisa de atenção e aponta o item mais vendido entre os que estão em falta — a lista completa continua a um clique. Os quatro cards de caixa viraram um só, e as duas pizzas de categoria viraram um card de barras que mostra unidades e faturamento juntos.
- **Produtos**: as variações agora aparecem em tabela, com barra de estoque proporcional ao mínimo e a margem de cada uma.
- **Vendas**: a lista virou tabela contínua; a linha de pagamento diz forma, taxa e data de recebimento de uma vez; abrir a venda mostra os itens e o fechamento (custo, taxa, líquido, lucro).
- **Estoque**: passa a ordenar por reposição — esgotados primeiro, depois os mais distantes do mínimo.
- **Feiras**: próximas e realizadas ganham selo de data, e as realizadas mostram faturado, custo e líquido lado a lado.
- Ações repetidas de cada linha (editar, excluir, ver detalhes) foram recolhidas num menu, deixando visível só a ação principal.

### Adicionado

- **Vendas**: busca por produto, variação ou feira.
- **Caixa**: coluna de saldo, mostrando com quanto o caixa ficou depois de cada movimentação.
- **Estoque**: estimativa de quanto custa repor tudo que está abaixo do mínimo, e contador de itens a repor na barra lateral.
- **Precificação**: antes de aplicar um preço a uma variação, a tela mostra o preço atual, o novo e o tamanho da mudança.
- **Estoque**: custo unitário abaixo de dez centavos passa a aparecer com quatro casas — o fio de nylon custa R$ 0,0120/cm e a tela mostrava "R$ 0,01", o que não fechava com o valor total da linha.

### Interno

- Paleta e tokens antigos removidos do Tailwind; a fonte Playfair Display sai e entra a Fraunces.
- Nenhuma alteração no processo principal, no IPC ou no banco de dados.

---

## [1.7.1] - 2026-08-13

### Adicionado

- **Backup**: quando uma atualização precisa alterar a estrutura do banco, a cópia de segurança passa a ser feita **antes** da alteração, e não depois. É o único momento em que ainda é possível voltar atrás.

### Interno

- Estrutura do banco passa a ser versionada (`PRAGMA user_version`), com cada alteração aplicada em transação própria: se falhar no meio, o banco volta ao estado anterior e a tentativa se repete no próximo boot, em vez de ficar pela metade.
- Cálculos do Caixa (período, filtros, somatórios e lista de movimentações) extraídos para módulo próprio e cobertos por testes.
- Insights do Dashboard extraídos e cobertos por testes, incluindo regressão para a categoria mais vendida por unidade e para o plural de "itens esgotados".
- Suíte de testes vai de 110 para 174.

---

## [1.7.0] - 2026-08-12

### Adicionado

- **Backup**: cópia automática do banco a cada dia de uso, mantendo os 10 backups mais recentes em `%APPDATA%/van-bijoux-sys/backups`. Até então o histórico inteiro vivia num único arquivo sem nenhuma cópia.
- **Backup**: painel "Backup e dados" na barra lateral, com data do último backup, exportação para um local à escolha, atalho para a pasta de backups e restauração a partir de um arquivo.
- **Backup**: a restauração valida a integridade do arquivo, pede confirmação, guarda o estado atual numa cópia antes de sobrescrever e reinicia o aplicativo.
- **Atualização**: o aplicativo verifica atualizações sozinho ao abrir e traz um botão "Verificar atualizações" no painel. Um backup do banco é feito antes de qualquer atualização ser aplicada.

### Corrigido

- **Produtos, Feiras**: excluir um produto, uma variação ou uma feira com vendas registradas não faz mais nada em silêncio. Antes a confirmação era aceita, a exclusão falhava por vínculo com o histórico de vendas e nenhuma mensagem aparecia na tela.
- **Caixa**: mensagens de erro deixam de exibir texto técnico do Electron (`Error invoking remote method...`).
- **Dashboard**: a tela avisa quando as estatísticas não carregam, em vez de ficar presa em "Carregando…".
- **Dashboard**: corrige o plural do insight de estoque, que escrevia "itemns esgotados".
- **Estoque**: cadastrar variação com estoque inicial e dar entrada de estoque passaram a rodar em transação — uma falha no meio não deixa mais o estoque de insumos inconsistente.
- **Offline**: as fontes passam a ser empacotadas com o aplicativo. Sem internet, a tipografia caía em fontes de sistema.

### Interno

- Hooks de git locais (husky): lint e formatação no commit, padrão de mensagem no commit, verificação de tipos e testes antes do push.
- ESLint 9, Prettier e verificação de tipos configurados — antes estavam instalados sem configuração e não rodavam.
- Corrigidos 3 erros de tipo que o build nunca revelava, e adicionada Content-Security-Policy no build de produção.
- Dependabot removido; atualização de dependências passa a ser manual.

---

## [1.6.1] - 2026-05-14

### Corrigido

- **Dashboard**: insight "categoria mais vendida" agora identifica corretamente a categoria com mais unidades vendidas (antes usava a de maior faturamento por erro de ordenação).
- **Dashboard**: gráfico único de categoria dividido em dois — "Vendas por categoria" (por unidades) e "Faturamento por categoria" (por receita), eliminando a confusão visual entre as duas métricas.

---

## [1.6.0] - 2026-05-14

### Adicionado

- **Vendas**: nova forma de pagamento "A receber" (fiado) para clientes conhecidos que pagam depois. Ao registrar, a venda fica com badge "Pendente" na lista de vendas e não entra no caixa, mas conta em faturamento e lucro.
- **Vendas**: botão "✓ Marcar recebida" na linha de cada venda pendente, que abre um modal onde a cliente escolhe a forma de pagamento real (dinheiro/PIX/débito/crédito), taxa (se houver) e data efetiva do recebimento.
- **Vendas**: botão "↶ Desfazer" para reverter um recebimento erroneamente marcado, retornando a venda ao status "A receber".
- **Dashboard**: novo KPI "A receber" exibe o total pendente de recebimento no período.
- **Caixa**: vendas pendentes ficam fora das entradas; vendas que foram "A receber" e foram liquidadas depois entram pela data de recebimento, não da venda.

### Corrigido

- **Dashboard**: filtros de data passaram a usar `date()` para incluir vendas legadas com timestamp completo (corrige discrepâncias silenciosas em "hoje").
- **Dashboard**: faturamento por categoria passa a usar `LEFT JOIN` + "Sem categoria", garantindo que o somatório das fatias bate com o KPI Faturamento bruto mesmo com itens órfãos.

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
