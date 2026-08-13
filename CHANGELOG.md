# Changelog

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
