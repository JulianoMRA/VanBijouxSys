# Changelog

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
