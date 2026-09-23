# Política de segurança

O Van Bijoux Sys é um app desktop usado por uma única pessoa. O banco SQLite vive
só na máquina dela e nenhum dado do negócio sai de lá. A única comunicação de rede
é a checagem de atualização no GitHub Releases.

Por isso a prioridade deste documento é a **integridade do banco**: perder ou
corromper estoque, vendas e caixa é o pior cenário, e pesa mais que sigilo.

## Versões suportadas

Só a última release publicada em
[GitHub Releases](https://github.com/JulianoMRA/VanBijouxSys/releases). O
auto-update leva a correção até quem usa; versões anteriores não recebem patch.

## Reportar uma vulnerabilidade

**Não abra issue pública.** Reporte por
[GitHub Security Advisories privado](https://github.com/JulianoMRA/VanBijouxSys/security/advisories/new),
com:

- descrição do problema e passos para reproduzir;
- impacto estimado;
- versão afetada (nome do instalador ou a versão exibida no app).

Projeto pessoal, sem SLA formal. Segurança é tratada antes de funcionalidade.

## Modelo de ameaças

### Atualização automática

É o caminho mais curto entre o repositório e a máquina da usuária, e não passa por
conferência humana dela.

- O `electron-updater` baixa o instalador da release marcada como latest e confere
  o sha512 declarado no `latest.yml`. Como os dois vêm da mesma release, isso
  protege contra download corrompido, não contra release maliciosa.
- **O instalador não é assinado.** Sem `publisherName`, o `electron-updater` não
  verifica assinatura: quem conseguir publicar uma release no repositório entrega
  código à máquina dela. A proteção real é a conta do GitHub que publica.
- Antes de o instalador ser aplicado, o app faz backup do banco
  (`update-downloaded` em `src/main/updater.ts`), porque a versão nova pode migrar
  o schema. É uma cópia por versão, numa cota separada da dos backups diários.

### Janela, renderer e preload

- `sandbox: true`; `contextIsolation` e `nodeIntegration` nos padrões do Electron
  (ligado e desligado).
- CSP estrita (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`)
  injetada como meta tag no HTML de produção pelo plugin `csp-producao` do
  `electron.vite.config.ts`. Em `npm run dev` não há CSP, porque o HMR do Vite
  precisa de script inline.
- Navegação só é aceita para o mesmo documento que a janela já carrega; só o
  fragmento pode mudar, que é como o `HashRouter` troca de tela
  (`src/main/navegacao.ts`). A comparação é por protocolo, host e caminho, **nunca
  por origem** (a de toda URL `file:` é `'null'`) **nem por prefixo**. Janela sem
  página recusa tudo.
- O preload expõe só o `window.api`, com uma função por canal IPC do app. Não há
  `ipcRenderer` genérico nem `process` ao alcance do renderer.
- `window.open` é sempre negado. Só URL `http:` ou `https:` segue para o navegador
  do sistema; `javascript:`, `file:`, `data:` e handlers de protocolo do Windows
  são recusados e registrados no log.

### Processo principal e binário

- Instância única (`requestSingleInstanceLock`). Não é só conforto: restaurar um
  backup sobrescreve o `.db` e apaga o WAL, o que corromperia o que outra instância
  aberta ainda estivesse escrevendo.
- Fuses do Electron no binário empacotado: `runAsNode`, `NODE_OPTIONS` e argumentos
  de inspect desligados; o app só carrega de dentro do `app.asar`.
- O `app.asar` leva só `out/`, o `package.json` e as dependências de produção
  (`files` no `build` do `package.json`). Arquivo local do repositório, como
  `.claude/` ou um `.env`, não entra no instalador público.
- Falha de boot ou exceção síncrona não capturada grava no log, avisa, fecha o
  banco e encerra o app com código 1 (`src/main/encerramento.ts`). Rejeição de
  promise sem tratamento só vai para o log.

### Banco, backup e restauração

- Backup pela API de backup online do SQLite, consistente com o WAL ativo; nunca
  por cópia de arquivo com o banco aberto.
- Backup antes de migrar o schema, backup diário com 10 dias de histórico e backup
  do estado atual antes de restaurar outro. Diários e extras têm cotas separadas
  (RN-15), e o arquivo escolhido para restaurar é copiado antes que a rotação
  possa apagá-lo.
- Os caminhos de exportar e restaurar são escolhidos em diálogo nativo aberto pelo
  processo principal. O renderer não envia caminho nenhum.
- Antes de restaurar, o arquivo passa por `integrity_check` e precisa ter as tabelas
  do app; a usuária confirma num segundo diálogo.
- Valor que vai para o SQL passa sempre por parâmetro, pelo Drizzle ou por `prepare`
  com `?`. O que se concatena são trechos fixos do código: nomes de tabela nas
  migrações e filtros de data do painel, montados com placeholders.

### Log

`<userData>/logs/main.log` recebe falhas de handler, de backup, de migração e de
boot, com stack. Fica só na máquina e não é enviado a lugar nenhum.

## Lacunas conhecidas

Registradas para não ficarem silenciosas:

- **Canais IPC sem validação de schema** do payload recebido.

## Dependências

O pipeline roda `npm audit --omit=dev --audit-level=high`. Ele reporta a árvore de
produção, mas **não mostra o Electron**, que é dependência de desenvolvimento e ao
mesmo tempo o runtime que vai inteiro no instalador (Chromium, Node, `contextBridge`).
Alerta do pacote `electron` chega à máquina da usuária: conferir com `npm audit`
completo e manter o Electron no patch mais recente da major em uso.

Em 2026-09-14 o Electron foi de 41.0.4 para 41.10.7 (19 advisories da linha 41, três
high), e o audit de produção foi de 6 alertas para 2.

### Advisories aceitos

Os dois do `react-router` 6.30.6, corrigidos só na 7.18. Revisar a cada release; a
migração para a 7 fica para depois dos testes de tela.

- **GHSA-wrjc-x8rr-h8h6** (moderate), open redirect por barra invertida em `<Link>` e
  `useNavigate`. Exige um caminho de navegação vindo de fora; as rotas do app são
  constantes no código, e a janela recusa navegar para outro documento.
- **GHSA-337j-9hxr-rhxg** (moderate), injeção de construtor em `deserializeErrors()`
  na hidratação SSR. O app não tem SSR: o `HashRouter` roda só no cliente.

Se uma dessas premissas mudar, o advisory volta a valer.

### Só na cadeia de build

O `npm audit` completo ainda lista alertas em ferramentas que rodam só no build e não
vão para o instalador, a maioria na cadeia do `electron-builder` 26.8.1 (`tar`,
`@xmldom/xmldom`, `app-builder-lib`) e do Vite. Atualizar o `electron-builder` mexe
no instalador e no updater, e fica para um PR próprio, com teste de instalação e de
auto-update.

## Fora de escopo

- Acesso físico ou conta do Windows comprometida: o banco não é criptografado, e
  quem tem a conta da usuária tem os dados.
- Vulnerabilidade em dependência sem caminho explorável neste app.
