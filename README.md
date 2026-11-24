# Sacou

**O app do racha de vôlei amador.** Lista de presença, sorteio de times equilibrado e a fila de "quem perde sai" junto do placar, sem bagunça no WhatsApp.

Hoje não existe um app brasileiro feito para vôlei: os concorrentes nacionais são de futebol e tratam o vôlei como "outro esporte". O concorrente de verdade é a lista colada no grupo do WhatsApp.

## O que o Sacou faz

| | |
|---|---|
| **Grupos e rodadas** | Grupo fixo do racha, rodadas semanais com vagas, presença e lista de espera |
| **Sorteio de times** | Times equilibrados pelo nível dos jogadores (rating OpenSkill e nota do admin) |
| **Tela de quadra** | Placar, fila de times ("quem perde sai") e rotação na mesma tela. Nenhum concorrente junta a fila ao placar |
| **Rotação de verdade** | Formações Livre, 4x2, 5x1 e 6x2, com líbero e regras de sobreposição da FIVB 2025–28 |
| **Depois do jogo** | Resumo da rodada, cartinha do jogador, votação do MVP e notificações |
| **Página da rodada** | O jogador confirma presença por um link, sem instalar o app |

Princípios: tudo é opcional e configurável (cobrança, vagas, sets, pontos), com modelos prontos que escondem a complexidade. Só o organizador paga; o jogador usa grátis.

Mais detalhes em [`docs/produto.md`](docs/produto.md). O estado atual do desenvolvimento está em [`docs/estado/progresso.md`](docs/estado/progresso.md).

## Stack

| Parte | Tecnologia |
|---|---|
| App | Expo (React Native) + TypeScript strict, expo-router, expo-sqlite, TanStack Query |
| API | ASP.NET Core .NET 10 (Minimal APIs), monólito modular com DDD enxuto e fatias verticais |
| Banco | PostgreSQL 18 + EF Core (Neon na nuvem, Docker no local) |
| Regras compartilhadas | `packages/volley-rules`, `packages/match-engine`, `packages/rating`, com testes golden comuns ao TS e ao C# |
| Página da rodada | `apps/web` (Vite), servida pela própria API |
| Login | Firebase Auth (Google e e-mail/senha) |
| Hospedagem | Google Cloud Run (`us-east4`) e Neon, deploy pelo GitHub Actions com federação de identidade |
| Build do app | EAS Build (na nuvem da Expo) |
| Monorepo | pnpm workspaces + Turborepo |

Arquitetura completa em [`docs/arquitetura/visao-geral.md`](docs/arquitetura/visao-geral.md) e nos ADRs de [`docs/arquitetura/adr/`](docs/arquitetura/adr/).

## Estrutura do repositório

```
apps/
  api/        API .NET 10 (src/ e tests/), contrato OpenAPI em openapi/v1.json
  mobile/     App Expo (Android)
  web/        Página da rodada e convite (Vite)
packages/
  volley-rules/   Formações, rotação, sobreposição, cartinha
  match-engine/   Motor do placar, fila, banco e líbero (event sourcing)
  rating/         Rating OpenSkill
deploy/cloud-run/ Configuração do serviço no Cloud Run
scripts/          Portões de qualidade (EOL, duplicação, audit, contrato da API)
design/           Telas em HTML (mvp/ = piloto, telas/ = produto completo)
docs/             Produto, decisões, domínio, arquitetura, segurança, operação e estado
.claude/          Agentes e skills do Claude Code
```

---

# Montar o ambiente numa máquina nova

Tudo abaixo vale para Windows (o ambiente do Gabriel). Notas para Mac e Linux no fim de cada passo.

## 1. Ferramentas

| Ferramenta | Versão exigida | De onde vem a exigência |
|---|---|---|
| Git | qualquer recente | |
| Node.js | **22.20.0** (aceita `>=22.13 <23`) | `.nvmrc` e `engines` do `package.json` |
| pnpm | **12.16.1** | `packageManager` do `package.json` |
| .NET SDK | **10.0.403** (aceita patches mais novos da 10.0.4xx) | `global.json` |
| Docker Desktop | qualquer recente | Postgres local e testes de integração (imagem `postgres:18.6`) |
| GitHub CLI (`gh`) | qualquer recente | PRs, CI e clone |
| Android platform-tools (`adb`) | qualquer recente | Só para testar o app no celular pelo cabo |
| Claude Code | atual | Orquestração das tarefas (ver `CLAUDE.md`) |

Ferramentas que **não** precisam ser instaladas: `dotnet-ef` (vem do manifesto `.config/dotnet-tools.json`, versão 10.0.14, com `dotnet tool restore`), `eas-cli` (roda por `npx eas-cli@27.5.0`), Turborepo, ESLint, Prettier e Vitest (vêm do `pnpm install`). Android Studio, JDK e Android SDK completos também não: o APK é montado na nuvem pelo EAS.

**Windows (PowerShell):**

```powershell
winget install Git.Git
winget install Schniz.fnm                    # gerenciador de versões do Node
winget install Microsoft.DotNet.SDK.10
winget install Docker.DockerDesktop
winget install GitHub.cli
winget install Google.PlatformTools          # adb (opcional, só para o celular)
irm https://claude.ai/install.ps1 | iex      # Claude Code
```

Feche e abra o terminal, depois:

```powershell
fnm install 22.20.0
fnm default 22.20.0
npm install -g pnpm@12.16.1
gh auth login
```

Sem `fnm`, instale o Node 22.20.0 direto pelo instalador de [nodejs.org](https://nodejs.org/download/release/v22.20.0/). O pacote `OpenJS.NodeJS.LTS` do winget pode trazer outra versão principal, e o `pnpm install` recusa.

**Sem admin** (como na máquina antiga): baixe o .NET SDK em zip para `D:\tools\dotnet` e o `platform-tools` em zip para uma pasta sua, e ponha as duas no `PATH`.

**Mac:** `brew install git fnm gh` · `brew install --cask dotnet-sdk docker android-platform-tools` · `fnm install 22.20.0` · `npm i -g pnpm@12.16.1` · `curl -fsSL https://claude.ai/install.sh | bash`.

**Confira:**

```sh
git --version
node -v          # v22.20.0
pnpm -v          # 12.16.1
dotnet --version # 10.0.4xx
docker version   # precisa responder o "Server" (Docker Desktop aberto)
gh auth status
adb version      # opcional
claude --version
```

## 2. Configurar o Git (antes de clonar)

O repositório é todo em LF (`.gitattributes` com `eol=lf`, e a CI reprova CRLF com `pnpm check:eol`). Garanta que o Git não converta no Windows:

```sh
git config --global core.autocrlf false
git config --global user.name "Seu Nome"
git config --global user.email "seu-email"
```

## 3. Clonar

Clone **fora do C:** se ele tiver pouco espaço (o `node_modules`, o cache do NuGet e as worktrees dos agentes pesam vários GB). O caminho antigo era `D:\projetos\SacouAPP`; usar o mesmo caminho mantém a memória do Claude Code no lugar (passo 6).

```sh
cd /d/projetos
gh repo clone GabrielFn/SacouAPP
cd SacouAPP
```

## 4. Variáveis de ambiente da sessão (Windows com pouco espaço no C:)

No Git Bash, para os caches ficarem no D: (é o que o `CLAUDE.md` usa). Ponha no `~/.bashrc` para não repetir:

```sh
export PATH="/d/tools/dotnet:$PATH"        # só se o .NET estiver em zip no D:
export NUGET_PACKAGES=/d/tools/nuget-packages
export TEMP=/d/tmp TMP=/d/tmp
```

Também vale mover o store do pnpm para o D: (`pnpm config set store-dir D:\tools\pnpm-store`) e, no Docker Desktop, o disco de imagens (Settings → Resources → Advanced → Disk image location).

## 5. Arquivos que não estão no Git (copiar da máquina antiga)

Estes arquivos ficam fora do repositório de propósito. **Copie-os da máquina antiga** (pendrive, nunca por chat, e-mail ou commit):

| Arquivo | Para que serve | Se perder |
|---|---|---|
| `.env` (raiz) | `POSTGRES_PASSWORD` do Postgres local | Copie `.env.example` para `.env` e invente uma senha local; rode `docker compose down -v` se o volume antigo existir |
| `apps/mobile/.env` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e `EXPO_PUBLIC_API_URL` (ex.: `http://localhost:5080`) | O client ID web está no console do Firebase (`sacou-79493` → Authentication → Google) |
| `apps/mobile/google-services.json` | Configuração do Firebase no Android | Baixe de novo no console do Firebase (app Android `com.sacou.app`) |
| `.claude/settings.local.json` | Permissões de comando já aprovadas no Claude Code | Sem problema: o Claude Code volta a perguntar |
| `C:\Users\<você>\.claude\projects\D--projetos-SacouAPP\memory\` | Memória do Claude Code deste projeto (custo de agentes, limite do plano, teste com cabo) | Recrie a pasta e copie os `.md`; o nome da pasta segue o caminho do clone (`D:\projetos\SacouAPP` → `D--projetos-SacouAPP`) |
| `D:\tmp\contas-teste.txt` | Contas de teste do percurso no celular (ambiente de teste) | Crie contas novas no ambiente de teste |

Os nomes de todos os segredos (sem valores) e onde cada um fica estão em [`docs/seguranca/segredos.md`](docs/seguranca/segredos.md). A keystore do Android **não** fica na máquina: o EAS guarda na nuvem da Expo, então o SHA-1 cadastrado no Firebase continua valendo.

## 6. Contas para entrar de novo

| Conta | Comando ou lugar | Para quê |
|---|---|---|
| GitHub | `gh auth login` | Clone, push, PRs, acompanhar a CI |
| Claude | `claude` (abre o navegador no primeiro uso) | Sessões de desenvolvimento |
| Expo | `cd apps/mobile && npx eas-cli@27.5.0 login` | Gerar APKs no EAS |
| Google Cloud | `gcloud auth login` (opcional) | Só para rodar os scripts de `scripts/gcp/`; o deploy normal é feito pelo GitHub Actions, sem chave |

## 7. Instalar e conferir

```sh
pnpm install --frozen-lockfile
dotnet tool restore
pnpm build        # pacotes e app
pnpm typecheck
pnpm lint
pnpm test         # Vitest dos pacotes
dotnet build      # solução Sacou.slnx, avisos como erro
dotnet test       # xUnit da API (sem Docker)
```

Com o Docker Desktop aberto:

```sh
dotnet test --project apps/api/tests/Sacou.Integration.Tests   # sobe um Postgres próprio (Testcontainers)
```

Tudo verde = máquina pronta. A lista completa de comandos está no [`CLAUDE.md`](CLAUDE.md#comandos).

---

# Rodar o projeto

## Banco local

```sh
cp .env.example .env               # só na primeira vez, e troque a senha
docker compose up -d --wait        # Postgres 18 em 127.0.0.1:5432, usuário postgres
docker compose down -v             # para e apaga os dados (descartáveis)
```

Problemas comuns (porta ocupada, senha trocada com volume velho) em [`docs/operacao/postgres-local.md`](docs/operacao/postgres-local.md).

## API

No Git Bash, com o banco ligado:

```sh
set -a; . ./.env; set +a   # lê o POSTGRES_PASSWORD sem imprimir
export ConnectionStrings__Sacou="Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=$POSTGRES_PASSWORD"
export Database__MigrateOnStartup=true
ASPNETCORE_URLS=http://localhost:5080 ASPNETCORE_ENVIRONMENT=Development dotnet run --project apps/api/src/Sacou.Api
```

Confira em `http://localhost:5080/health`. Nunca rode `env` sem filtro nem `echo` da connection string: imprimem a senha.

## App no celular (Android, pelo cabo)

1. Celular com depuração USB liberada (`adb devices` mostra `device`).
2. APK de desenvolvimento instalado. Para gerar um novo: `cd apps/mobile && npx eas-cli@27.5.0 build --platform android --profile development`, depois `adb install <apk>`.
3. Com a API rodando:

```sh
adb reverse tcp:5080 tcp:5080   # API
adb reverse tcp:8081 tcp:8081   # Metro
pnpm --filter @sacou/volley-rules --filter @sacou/match-engine run build   # o app lê o dist/ dos pacotes
CI=1 EXPO_PUBLIC_DEV_TOOLS=1 pnpm --filter @sacou/mobile start
```

O `CI=1` era necessário na máquina antiga (HD lento, Metro não terminava de varrer os arquivos). Num SSD, teste sem ele: o Metro passa a recarregar sozinho a cada edição. APK de teste (`preview`), login com Google e roteiros completos em [`docs/operacao/teste-no-celular.md`](docs/operacao/teste-no-celular.md).

## Deploy

Merge na `main` com a CI verde sobe a API sozinha no ambiente de teste (`sacou-api-test`); a produção espera a aprovação manual no GitHub Actions. Nada de deploy sai da máquina local. Fluxo em [`docs/operacao/deploy.md`](docs/operacao/deploy.md).

---

# Como o desenvolvimento funciona

O projeto é construído por sessões do Claude Code com agentes (analista, desenvolvedor, revisor, revisor de segurança, testador), seguindo o [`CLAUDE.md`](CLAUDE.md). Para retomar numa máquina nova:

```sh
cd /d/projetos/SacouAPP
claude
```

e cole o prompt de **sessões seguintes** de [`PROMPT-INICIAL.md`](PROMPT-INICIAL.md). O estado de tudo fica no repositório, em [`docs/estado/`](docs/estado/): a sessão nova retoma do último diário, sem depender da máquina antiga.

| Documento | Conteúdo |
|---|---|
| [`docs/decisoes.md`](docs/decisoes.md) | Todas as decisões (prevalece em caso de conflito) |
| [`docs/plano-mvp.md`](docs/plano-mvp.md) | Marcos M1–M7 e backlog com critérios de aceite |
| [`docs/dominio/`](docs/dominio/) | Regras do vôlei: rotação, placar, fila, rodadas |
| [`docs/padroes/`](docs/padroes/) | Código, testes, commits e regras do app |
| [`docs/seguranca/`](docs/seguranca/) | Ameaças, checklist, LGPD e nomes dos segredos |
| [`design/mvp/`](design/mvp/) | As telas do piloto |
