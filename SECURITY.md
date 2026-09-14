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
  o schema.

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
  do estado atual antes de restaurar outro.
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
- **`npm audit --omit=dev`**: 6 alertas (3 high, 3 moderate) em 2026-09-14, em
  `drizzle-orm`, `lodash`, `js-yaml` e `@remix-run/router`, ainda não triados
  quanto a caminho explorável neste app.

## Fora de escopo

- Acesso físico ou conta do Windows comprometida: o banco não é criptografado, e
  quem tem a conta da usuária tem os dados.
- Vulnerabilidade em dependência sem caminho explorável neste app.
