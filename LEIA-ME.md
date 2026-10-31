# Sacou — como começar no seu PC

Este kit é o ponto de partida do repositório. Tudo que os agentes precisam (decisões, produto, revisão, plano com 65 tarefas, regras de rotação, as 31 telas e as instruções dos agentes) já está aqui dentro.

## 1. Instalar as ferramentas (uma vez)

**Windows** (PowerShell):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Microsoft.DotNet.SDK.10
winget install Docker.DockerDesktop
winget install GitHub.cli
irm https://claude.ai/install.ps1 | iex
```

Feche e abra o terminal, depois:

```powershell
npm install -g pnpm
gh auth login
```

**Mac** (com Homebrew): `brew install git node gh pnpm` · `brew install --cask dotnet-sdk docker` · `curl -fsSL https://claude.ai/install.sh | bash` · `gh auth login`.

O Claude Code precisa de uma assinatura paga do Claude (Pro ou Max) ou de uma conta na Claude Console. No primeiro `claude`, ele abre o navegador para você entrar.

O projeto exige Node `>=22.13 <23` (`.nvmrc`: 22.20.0). O pacote LTS do winget e o `node` do Homebrew podem instalar outra versão principal; se isso acontecer, instale a 22.20.0 pelo site nodejs.org.

Confira: `git --version`, `node -v` (`>=22.13 <23`), `pnpm -v`, `dotnet --version` (10.x), `docker --version`, `claude --version`.

## 2. Preparar a pasta

1. Clone o repositório fora do C:, que tem pouco espaço:

```powershell
cd D:\projetos
gh repo clone gabrielfn/SacouAPP
```

2. Abra o Docker Desktop (o Postgres local roda nele).
3. No terminal:

```powershell
cd D:\projetos\SacouAPP
claude
```

## 3. Colar o prompt

Abra `PROMPT-INICIAL.md`, copie o bloco da **1ª sessão** e cole no Claude Code. Ele começa o marco M1.

Nas próximas vezes, abra a pasta, rode `claude` e cole o prompt de **sessões seguintes**.

## Durante o trabalho

- O Claude Code pede autorização antes de rodar comandos. Você pode aprovar comandos recorrentes (pnpm, dotnet, git) para ele não perguntar de novo.
- Segredos (chaves do Firebase, Railway etc.) nunca vão pelo chat: crie um arquivo `.env` local (já ignorado pelo git) e os segredos do GitHub Actions; o Claude só usa os nomes.
- O estado do projeto fica em `docs/estado/` — se fechar no meio, a próxima sessão retoma de lá.

## O que tem no kit

| Caminho | Conteúdo |
|---|---|
| `CLAUDE.md` | Regras para o Claude: ritual, ciclo de agentes, autonomia, padrões, definição de pronto |
| `.claude/agents/` | Os 5 agentes: analista, desenvolvedor, revisor, revisor-seguranca, testador |
| `docs/decisoes.md` | Todas as decisões consolidadas (prevalece em caso de conflito) |
| `docs/produto.md`, `revisao-mvp.md`, `plano-mvp.md` | Os três documentos do projeto |
| `docs/dominio/` | Regras de rotação, coordenadas das formações (JSON) e o explorador visual |
| `design/telas/` | As 31 telas em HTML (títulos em `canvas.json`) |
| `docs/estado/` | Progresso, perguntas abertas e diários de sessão |
