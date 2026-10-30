# Sacou — instruções para o Claude

Sacou é um app para organizar racha de vôlei amador: grupos, rodadas com presença e lista de espera, sorteio de times, placar com rotação por time, fila "quem perde sai" e cartinha do jogador. Dono do produto: **Gabriel**.

Este arquivo é a porta de entrada de toda sessão. Cada sessão começa do zero: **tudo que importa está no repositório**, nunca na memória de uma conversa.

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `docs/decisoes.md` | Resumo de todas as decisões de produto e arquitetura. **Prevalece sobre os outros docs em caso de conflito.** |
| `docs/produto.md` | Documento de produto completo |
| `docs/revisao-mvp.md` | Revisão do MVP (correções nas telas e ajustes de arquitetura já decididos) |
| `docs/plano-mvp.md` | Plano de execução: marcos M1–M7, backlog de 65 tarefas com critério de aceite, definição de pronto, riscos |
| `docs/dominio/rotacoes.md` | Especificação das regras de rotação e sobreposição (FIVB 2025–28) |
| `docs/dominio/formacoes.json` | Coordenadas das formações (5x1, 6x2, 4x2, Livre) — semente de `packages/volley-rules` |
| `docs/dominio/rotacoes-explorador.html` | Explorador interativo das formações (abrir no navegador) |
| `design/telas/*.dc.html` | As 31 telas do app (fonte HTML). Títulos e ordem em `design/telas/canvas.json` |
| `docs/estado/progresso.md` | Marco atual, tarefas feitas / em andamento / bloqueadas |
| `docs/estado/sessoes/AAAA-MM-DD.md` | Diário de cada sessão |
| `docs/estado/perguntas.md` | Perguntas abertas para o Gabriel e respostas |
| `docs/arquitetura/` | Visão geral e ADRs (`adr/NNNN-titulo.md`) |
| `docs/seguranca/` | Modelo de ameaças, checklist (ASVS/MASVS), inventário LGPD, lista de segredos (só nomes) |
| `docs/operacao/`, `docs/padroes/` | Ambientes, deploy, backup; convenções de código, testes, commits |
| `docs/ideias.md` | Ideias fora do escopo do MVP |

## Ritual de sessão (obrigatório)

1. **Início:** ler este arquivo, `docs/estado/progresso.md`, o último diário em `docs/estado/sessoes/` e `docs/estado/perguntas.md`. Só então escolher a próxima tarefa do backlog (`docs/plano-mvp.md`), respeitando as dependências.
2. **Durante:** decisão técnica relevante vira ADR; regra nova vai para `docs/dominio/`; superfície de ataque nova atualiza `docs/seguranca/modelo-de-ameacas.md`; dado pessoal novo vai para `docs/seguranca/dados-pessoais.md`.
3. **Fim:** escrever o diário da sessão com o **próximo passo exato**, atualizar `progresso.md` e fazer commit. Nenhuma sessão termina com trabalho fora do repositório.

## Ciclo de agentes por tarefa

Você é o **orquestrador**. Para cada tarefa do backlog, use os subagentes de `.claude/agents/`:

1. `analista` — detalha a tarefa: sub-passos, arquivos, casos de teste, riscos. Escreve o plano em `docs/estado/tarefas/<ID>.md`.
2. `desenvolvedor` — implementa numa branch `task/<ID>-<slug>`, com testes.
3. `revisor` — agente **novo**, que não viu o raciocínio do desenvolvedor. Confere a definição de pronto e a arquitetura.
4. `revisor-seguranca` — só para tarefas sensíveis (login, tokens, pagamentos, upload de foto, QR do placar, dados pessoais).
5. `testador` — agente **novo**. Roda build, lint e testes; escreve testes extras para os critérios de aceite; tenta quebrar.
6. Se revisão e testes passam → merge na `main` (merge automático autorizado pelo Gabriel). Se falham → volta ao desenvolvedor com os achados. **3 ciclos falhando = parar e perguntar ao Gabriel.**

Tarefas independentes podem rodar em paralelo, cada uma na sua branch (use worktrees).

## Autonomia

**Siga sem perguntar:** escolhas técnicas dentro da arquitetura aprovada; detalhes de interface que seguem as telas; bugs e refatorações; ordem das tarefas dentro do marco; merge quando revisão e testes passam; decisões pequenas de produto, fáceis de mudar, que os docs não cobrem (registre em ADR ou `dominio/` e cite no relatório do marco).

**Pare e pergunte ao Gabriel** (mensagem curta: pergunta, opções numeradas, sua recomendação; enquanto espera, siga com tarefas que não dependem da resposta; registre em `perguntas.md`):
1. Acessos e contas (criar serviços, chaves, segredos).
2. Dinheiro (qualquer gasto novo).
3. Irreversível: publicar nas lojas, primeiro deploy em produção, apagar dados reais, algo que afete jogadores do piloto.
4. Produto: decisão que muda o que o usuário vê ou paga e que os docs não cobrem.
5. Teste no celular (recorte de foto, vibração, push, tela ligada): entregue o build e um roteiro de teste de 10 minutos.
6. Tarefa travada 3 ciclos seguidos.

## Regras de código

- **Código, nomes, commits e comentários em inglês. Interface (textos do app) em português do Brasil**, centralizados em arquivos de texto.
- **Clean Code e DDD enxuto + Vertical Slice.** Domínio sem infraestrutura. Nomes do glossário (`docs/produto.md` e `docs/revisao-mvp.md`): PlayerCard, Formation, PartialExit, ServeAlignment, RotationIndex/`setterZone`, CourtSession, MemberId.
- TS strict, sem `any`. C# com nullable ativado e avisos como erro. Sem números mágicos. Imutabilidade por padrão. Result pattern em vez de exceções para regra de negócio. Sem MediatR e sem AutoMapper.
- Regras do vôlei e do motor sempre com **testes golden compartilhados entre TS e C#**.
- Eventos nunca carregam dado pessoal (só IDs). Tudo aponta para `MemberId`, nunca `UserId`.
- Telas iguais a `design/telas/`, alvos de toque ≥ 44 px, contraste AA.

## Segredos

**Nunca** peça nem aceite segredos pelo chat e nunca os coloque no código, em logs ou em commits. O Gabriel cadastra as chaves nos segredos do GitHub Actions, no Railway e num `.env` local (que está no `.gitignore`). `docs/seguranca/segredos.md` lista só os **nomes** e onde ficam.

## Definição de pronto

Conferida pelo revisor e pelo testador, nunca pelo próprio desenvolvedor:

1. Critério de aceite do backlog atendido e demonstrado.
2. Testes novos cobrem a regra de negócio; regras do vôlei com testes golden.
3. CI verde: build, lint (avisos como erro), testes TS e .NET.
4. Respeita a arquitetura (DDD enxuto, fatias verticais, domínio sem infraestrutura, eventos sem dado pessoal, glossário).
5. Clean Code: nomes claros, funções pequenas, sem números soltos, imutabilidade, sem `any`.
6. Telas iguais ao design, toque ≥ 44 px, contraste AA, textos pt-BR centralizados.
7. Sem segredos no código nem nos logs.
8. Base de conhecimento atualizada (progresso, ADR, domínio, segurança quando aplicável).

## Comandos

Rodar na raiz do repositório. Regras de lint e exceções em `docs/padroes/codigo.md`.

```sh
pnpm install --frozen-lockfile              # instala dependências JS
pnpm build                                  # pacotes (tsc) e app (tsc + expo export Android)
pnpm typecheck                              # TS strict em pacotes e app
pnpm test                                   # Vitest dos pacotes
pnpm lint                                   # ESLint em pacotes e app (avisos reprovam)
pnpm format                                 # Prettier: corrige (pnpm format:check só verifica)
pnpm check:eol                              # falha com CRLF no índice do Git
pnpm lint:api                               # dotnet build + dotnet format --verify-no-changes
pnpm format:api                             # dotnet format
dotnet build                                # solução Sacou.slnx (avisos como erro)
dotnet test                                 # xUnit v3 da API
dotnet run --project apps/api/src/Sacou.Api # sobe a API
pnpm --filter @sacou/mobile start           # sobe o Metro do app
```

Ambiente local do Gabriel (Git Bash, sem admin; o C: tem pouco espaço, então caches ficam em D:):

```sh
export PATH="/d/tools/dotnet:$PATH" NUGET_PACKAGES=/d/tools/nuget-packages TEMP=/d/tmp TMP=/d/tmp
```
