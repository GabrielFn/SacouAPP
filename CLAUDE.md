# Sacou — instruções para o Claude

Sacou é um app para organizar racha de vôlei amador: grupos, rodadas com presença e lista de espera, sorteio de times, placar com rotação por time, fila "quem perde sai" e cartinha do jogador. Dono do produto: **Gabriel**.

Este arquivo é a porta de entrada de toda sessão. Cada sessão começa do zero: **tudo que importa está no repositório**, nunca na memória de uma conversa.

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `docs/decisoes.md` | Resumo de todas as decisões de produto e arquitetura. **Prevalece sobre os outros docs em caso de conflito.** |
| `docs/produto.md` | Documento de produto completo |
| `docs/revisao-mvp.md` | Revisão do MVP (correções nas telas e ajustes de arquitetura já decididos) |
| `docs/plano-mvp.md` | Plano de execução: marcos M1–M7, backlog de 66 tarefas com critério de aceite, definição de pronto, riscos |
| `docs/backlog.md` | Mapa marco → tarefas e regra para escolher a próxima tarefa |
| `docs/dominio/rotacoes.md` | Especificação das regras de rotação e sobreposição (FIVB 2025–28) |
| `packages/volley-rules/src/formations/formations.json` | Coordenadas das formações (5x1, 6x2, 4x2, Livre) — fonte única, lida pelo TS e pelo C# |
| `docs/dominio/rotacoes-explorador.html` | Explorador interativo das formações (abrir no navegador) |
| `design/mvp/*.dc.html` | **As 43 telas do piloto, só com o que entra no MVP (ADR 0046 a 0048). É a referência das tarefas até o fim do piloto.** Títulos e ordem em `design/mvp/canvas.json` |
| `design/telas/*.dc.html` | As 33 telas do produto completo, inclusive o que ficou para depois do piloto. Títulos e ordem em `design/telas/canvas.json` |
| `docs/estado/progresso.md` | Marco atual, tarefas feitas / em andamento / bloqueadas |
| `docs/estado/pendencias.md` | Pendências herdadas das tarefas (só o orquestrador lê inteiro) |
| `docs/estado/tarefas/<ID>.md` | Plano detalhado de cada tarefa, escrito pelo analista |
| `docs/estado/sessoes/AAAA-MM-DD.md` | Diário de cada sessão |
| `docs/estado/perguntas.md` | Perguntas abertas para o Gabriel e respostas |
| `docs/arquitetura/` | Visão geral e ADRs (`adr/NNNN-titulo.md`) |
| `docs/seguranca/` | Modelo de ameaças, checklist (ASVS/MASVS), inventário LGPD, lista de segredos (só nomes) |
| `docs/padroes/frontend.md` | Regras obrigatórias do app: estado com registro único, layout só com unidades relativas, programação orientada a interfaces, reducer pattern |
| `docs/operacao/`, `docs/padroes/` | Ambientes, deploy, backup; convenções de código, testes, commits |
| `docs/ideias.md` | Ideias fora do escopo do MVP |

## Ritual de sessão (obrigatório)

1. **Início:** ler este arquivo, `docs/estado/progresso.md`, `docs/estado/pendencias.md`, o último diário em `docs/estado/sessoes/` e `docs/estado/perguntas.md`. Só então escolher a próxima tarefa do backlog (`docs/plano-mvp.md`), respeitando as dependências.
2. **Durante:** decisão técnica relevante vira ADR; regra nova vai para `docs/dominio/`; superfície de ataque nova atualiza `docs/seguranca/modelo-de-ameacas.md`; dado pessoal novo vai para `docs/seguranca/dados-pessoais.md`. **Salvamento contínuo** (pedido do Gabriel): o trabalho precisa sobreviver a um desligamento do computador ou ao fim do limite do plano, sem parar a sessão. Desenvolvedores fazem commit e push da própria branch a cada etapa, no máximo a cada 20 minutos (`wip(...)` é aceito, pois o merge é squash). O orquestrador atualiza `progresso.md` e o diário com o próximo passo exato a cada marco de tarefa, e antes disso sempre que o uso do plano passar de 80%.
3. **Fim:** escrever o diário da sessão com o **próximo passo exato**, atualizar `progresso.md` e fazer commit. Nenhuma sessão termina com trabalho fora do repositório.

## Ciclo de agentes por tarefa

Você é o **orquestrador**. Para cada tarefa do backlog, use os subagentes de `.claude/agents/`:

1. `analista` — detalha a tarefa: sub-passos, arquivos, casos de teste, riscos. Escreve o plano em `docs/estado/tarefas/<ID>.md`.
2. `desenvolvedor` — implementa numa branch `task/<ID>-<slug>`, com testes.
3. `revisor` — agente **novo**, que não viu o raciocínio do desenvolvedor. Confere a definição de pronto e a arquitetura.
4. `revisor-seguranca` — só para tarefas sensíveis (login, tokens, pagamentos, upload de foto, assumir a quadra, nota do admin, votação do MVP, dados pessoais).
5. `testador` — agente **novo**. Roda build, lint e testes; escreve testes extras para os critérios de aceite; tenta quebrar.
6. Se revisão e testes passam → merge na `main` (merge automático autorizado pelo Gabriel). Se falham → volta ao desenvolvedor com os achados. **3 ciclos falhando = parar e perguntar ao Gabriel.**

**Modelo de cada agente** (pedido do Gabriel). Passe sempre o `model` na chamada e cite-o no diário. O `model:` em `.claude/agents/` é só o padrão:

| Agente | Modelo |
|---|---|
| `analista`, `revisor`, `revisor-seguranca` | Opus |
| `testador` | Sonnet |
| `desenvolvedor` | Sonnet. **Opus** nas regras do vôlei e do motor (`volley-rules`, `match-engine`) e nas tarefas sensíveis |

Tarefas independentes podem rodar em paralelo, cada uma na sua branch (use worktrees).

### Economia de tokens (pedido do Gabriel, 09/11/2026)

1. **Leitura dirigida.** O brief de cada agente lista exatamente os arquivos e as seções a ler. Ninguém lê a base inteira "por garantia". As pendências herdadas ficam em `docs/estado/pendencias.md`, que só o orquestrador lê inteiro; o agente recebe só as linhas da tarefa.
2. **Ciclo de correção barato.** Depois de um ciclo reprovado, um único verificador novo confere só o diff da correção e os achados anteriores. O testador só volta se a correção mexer em regra de negócio. Se o histórico do desenvolvedor passar de cerca de 250 mil tokens, a correção vai para um desenvolvedor novo com brief curto, em vez de retomar o antigo.
3. **Uma revisão por parte depois da primeira.** Em tarefa sensível, a primeira parte tem `revisor` e `revisor-seguranca` separados. Nas partes seguintes, um único agente Opus faz as duas revisões.
4. **Menos partes.** Só dividir uma tarefa quando o PR passaria de cerca de 1.500 linhas alteradas.
5. **Entrega completa.** Antes de devolver, o desenvolvedor roda a bateria completa (build, lint, testes e portões) **depois do último commit** e espera a CI verde.
6. **Saídas e relatórios curtos** (skills `bateria` e `sabotagem` em `.claude/skills/`). Comandos com saída resumida (`tail`, modo silencioso); o testador escolhe as 5 ou 6 sabotagens mais importantes; relatórios de até 15 linhas, com achados numerados.

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
- **Commits, merges e títulos de PR em Conventional Commits** (`feat:`, `fix:`, `docs:`, `ci:`...), por pedido do Gabriel. Detalhes em `docs/padroes/commits-e-prs.md`.
- **Clean Code e DDD enxuto + Vertical Slice.** Domínio sem infraestrutura. Nomes do glossário (`docs/produto.md` e `docs/revisao-mvp.md`): PlayerCard, Formation, PartialExit, ServeAlignment, RotationIndex/`setterZone`, CourtSession, MemberId.
- TS strict, sem `any`. C# com nullable ativado e avisos como erro. Sem números mágicos. Imutabilidade por padrão. Result pattern em vez de exceções para regra de negócio. Sem MediatR e sem AutoMapper.
- Regras do vôlei e do motor sempre com **testes golden compartilhados entre TS e C#**.
- Eventos nunca carregam dado pessoal (só IDs). Tudo aponta para `MemberId`, nunca `UserId`.
- **App (`apps/mobile`):** seguir `docs/padroes/frontend.md` (estado com registro único, layout só com unidades relativas, orientado a interfaces, reducer pattern).
- Telas iguais a `design/mvp/` (no piloto; `design/telas/` é o produto completo), alvos de toque ≥ 44 px, contraste AA.

## Segredos

**Nunca** peça nem aceite segredos pelo chat e nunca os coloque no código, em logs ou em commits. O Gabriel cadastra as chaves nos segredos do GitHub Actions, no Railway e num `.env` local (que está no `.gitignore`). `docs/seguranca/segredos.md` lista só os **nomes** e onde ficam.

## Definição de pronto

Conferida pelo revisor e pelo testador, nunca pelo próprio desenvolvedor:

1. Critério de aceite do backlog atendido e demonstrado.
2. Testes novos cobrem a regra de negócio; regras do vôlei com testes golden.
3. CI verde: build, lint (avisos como erro), testes TS e .NET.
4. Respeita a arquitetura (DDD enxuto, fatias verticais, domínio sem infraestrutura, eventos sem dado pessoal, glossário).
5. Clean Code: nomes claros, funções pequenas, sem números soltos, imutabilidade, sem `any`.
6. No app, regras de `docs/padroes/frontend.md` atendidas. Telas iguais a `design/mvp/`, toque ≥ 44 px, contraste AA, textos pt-BR centralizados.
7. Sem segredos no código nem nos logs.
8. Base de conhecimento atualizada (progresso, ADR, domínio, segurança quando aplicável).

## Comandos

Rodar na raiz do repositório. Regras de lint e exceções em `docs/padroes/codigo.md`.

```sh
pnpm install --frozen-lockfile              # instala dependências JS
pnpm build                                  # pacotes (tsc) e app (tsc + expo export Android)
pnpm typecheck                              # TS strict em pacotes e app
pnpm test                                   # Vitest dos pacotes
pnpm lint                                   # ESLint em pacotes, app e scripts (avisos reprovam)
pnpm lint:regression                        # confirma que o lint reprova os desvios conhecidos
pnpm format                                 # Prettier: corrige (pnpm format:check só verifica)
pnpm check:eol                              # falha com CRLF no índice do Git
pnpm test:tooling                           # testes dos scripts e da política de exceções do audit
pnpm audit --audit-level high               # dependências JS vulneráveis (corte em High)
pnpm audit:api                              # dependências .NET vulneráveis (corte em High)
pnpm lint:api                               # dotnet build + dotnet format --verify-no-changes
pnpm format:api                             # dotnet format
dotnet build                                # solução Sacou.slnx (avisos como erro)
dotnet test                                 # xUnit v3 da API
dotnet test --project apps/api/tests/Sacou.Integration.Tests # integração com Postgres real (Docker ligado; fora do dotnet test da solução)
docker compose up -d --wait                 # Postgres de desenvolvimento (copie .env.example para .env e troque a senha)
docker compose down -v                      # derruba o Postgres de desenvolvimento e apaga o volume
dotnet run --project apps/api/src/Sacou.Api # sobe a API
pnpm --filter @sacou/mobile start           # sobe o Metro do app
```

Ambiente local do Gabriel (Git Bash, sem admin; o C: tem pouco espaço, então caches ficam em D:):

```sh
export PATH="/d/tools/dotnet:$PATH" NUGET_PACKAGES=/d/tools/nuget-packages TEMP=/d/tmp TMP=/d/tmp
```
