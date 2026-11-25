# Sacou — Plano de execução do MVP

2026-10-30 · @Gabriel

## Resumo

O MVP (Fase 1) é entregue por um ciclo de agentes que eu orquestro: um analista detalha a tarefa, um desenvolvedor implementa, um revisor independente audita e um testador valida; só então o código entra na branch principal. O ciclo se repete tarefa a tarefa, em 7 marcos, até o piloto.

- **Fonte da verdade:** o repositório no GitHub. Backlog, decisões, progresso e regras para os agentes ficam dentro dele (`docs/` e `CLAUDE.md`), porque cada sessão de trabalho começa do zero.
- **Continuidade:** uma tarefa agendada retoma o trabalho a cada 4 horas, pega a próxima tarefa do backlog e segue o ciclo. Você recebe um relatório curto a cada marco.
- **Quando te consulto:** só para acessos e contas, decisões de produto que os documentos não cobrem, gastos, ações irreversíveis (publicar nas lojas, apagar dados de produção) e testes no seu celular.
- **O que preciso agora:** um repositório vazio no seu GitHub e as contas listadas em Pré-requisitos. Sem o repositório, nada começa.

Documentos de referência para os agentes: Produto do app, Revisão do MVP, Rotações do Sacou e o canvas de telas (31 telas).

## Fluxo de agentes

Cada tarefa passa por quatro agentes diferentes antes de entrar no código principal; o revisor e o testador são sempre agentes novos, que não viram o trabalho do desenvolvedor.

*[Diagrama não incluído: as etapas do ciclo estão no `CLAUDE.md`, seção "Ciclo de agentes por tarefa"]*

Tarefas independentes (por exemplo, motor da partida e base da API) rodam em paralelo, cada uma na sua branch. Se uma tarefa falha 3 ciclos seguidos, eu paro e te consulto.

## Autonomia

Eu decido sozinho tudo que os documentos já definem ou que é detalhe técnico reversível; só paro para te consultar nos 6 casos abaixo.

**Sigo sem perguntar:**

1. Escolhas técnicas dentro da arquitetura aprovada (bibliotecas menores, nomes, estrutura de pastas, padrões de teste).
2. Detalhes de interface que seguem o canvas e o sistema visual.
3. Correções de bugs, refatorações e dívidas técnicas.
4. Ordem das tarefas dentro de um marco, e o merge na branch principal quando revisão, segurança (se aplicável) e testes passam.
5. Decisões pequenas de produto que os documentos não cobrem, quando a escolha é fácil de mudar depois. Elas ficam registradas na base de conhecimento (ADR ou domínio) e aparecem no relatório do marco.

**Paro e te consulto:**

1. **Acessos e contas:** criar ou dar acesso a serviços, chaves e segredos.
2. **Dinheiro:** qualquer gasto novo ou mudança de plano pago.
3. **Irreversível:** publicar nas lojas, enviar para produção pela primeira vez, apagar dados reais, mudar algo que afeta jogadores do piloto.
4. **Produto:** decisão que muda o que o usuário vê ou paga e que os documentos não cobrem.
5. **Teste no celular:** quando um recurso só pode ser validado num aparelho real (recorte de foto, vibração, push, tela ligada).
6. **Travado:** uma tarefa que falhou 3 ciclos seguidos de revisão ou teste.

**Como te consulto:** uma mensagem curta com a pergunta, as opções numeradas e a minha recomendação. Enquanto espero, sigo com tarefas que não dependem da resposta.

## Pré-requisitos

Só o repositório bloqueia o início; as outras contas só são necessárias no marco indicado, e eu aviso com uma semana de antecedência.

| Acesso | Para quê | Quando | Custo |
|---|---|---|---|
| Repositório vazio `sacou` no seu GitHub (privado) | Todo o código, backlog e progresso | Agora | Grátis |
| Projeto no Firebase | Login com Google, Apple e e-mail | M2 | Grátis |
| Conta Expo (EAS) | Builds do app e atualizações | M3 | Grátis no início |
| Google Cloud (Cloud Run) + Neon | API e banco de testes e produção (ADR 0068; era Railway até 18/11/2026) | M4 | US$ 0 na faixa grátis, teto de US$ 1 |
| Cloudflare (R2 e DNS) | Domínio; fotos da cartinha só depois do piloto (ADR 0046). Os backups (E5.3) ficam no Cloud Storage do Google (ADR 0082) | M5 | Grátis no início |
| Chave de API de um provedor de IA | Texto do resumo da rodada: **pós-piloto** (ADR 0046) | Depois do M7 | Centavos por resumo |
| Apple Developer (com Small Business Program) | TestFlight e App Store | M6 | US$ 99/ano |
| Google Play Console | Teste interno e Play Store | M6 | US$ 25 uma vez |
| Sentry | Erros do piloto (PostHog só depois do piloto, ADR 0046) | M6 | Grátis |
| Domínios sacou.app / sacou.com.br | Página da rodada e links | M5 | ~R$ 150/ano |

**Como passar segredos:** nunca pelo chat. Você cadastra as chaves nos segredos do repositório (GitHub Actions) e no Secret Manager do Google Cloud; eu só referencio pelo nome.

**Fora do código, com você:** registrar o nome no INPI, recrutar os 3 a 5 grupos do piloto e falar com um contador.

## Marcos

São 7 marcos em sequência; cada um termina com algo que você pode ver ou testar e com um relatório curto. Os prazos são estimativas e dependem dos acessos chegarem a tempo.

1. **M1 · Fundação (semana 1):** monorepo, CI, padrões de código, `CLAUDE.md` com as regras para os agentes, backlog no repositório, formações das rotações em JSON. *Você vê:* repositório organizado e CI verde.
2. **M2 · Motor da partida (semanas 2–4):** placar, side-out, rotação por time, sobreposição, fila com saída parcial, desfazer e corrigir, ponto individual; testes golden em TS e C#. *Você vê:* um relatório de cenários testados (ex.: uma rodada inteira simulada).
3. **M3 · Base da API e do app (semanas 3–6):** login, grupos, membros, rodadas, presença com espera, convidados; app Expo com design system, navegação e telas de entrada. *Você vê:* primeiro build no seu celular.
4. **M4 · A quadra (semanas 6–9):** sorteio, pré-jogo, escalação, modo quadra offline com sincronização, menu, corrigir, fim de set e de partida, fila; API no ar em ambiente de teste. *Você vê:* uma rodada completa jogada no app.
5. **M5 · Depois do jogo (semanas 9–11):** estatísticas, MVP, perfil, cartinha com avatar, página web da rodada com login, notificações (rating, resumo com IA, story, foto e Pix ficam para depois do piloto, ADR 0046). *Você vê:* a sua cartinha.
6. **M6 · Prontidão para o piloto (semanas 11–13):** conta, exclusão e exportação de dados, termos e privacidade, observabilidade, backups, feature flags, builds no TestFlight e no teste interno do Google Play. *Você vê:* o app instalável por convite.
7. **M7 · Piloto (semanas 13–17):** 3 a 5 grupos reais, correções semanais, métricas do portão (60% das confirmações pelo link). *Você vê:* relatório semanal com as métricas.

## Backlog

São 66 tarefas em 8 épicos. As tabelas abaixo são a fonte de ID, tarefa, aceite e dependências; `docs/backlog.md` traz o mapa marco → tarefas e a regra da próxima tarefa; o analista detalha os sub-passos em `docs/estado/tarefas/<ID>.md` antes de começar.

### E0 · Fundação (M1)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E0.1 | Monorepo (pnpm + Turborepo): `apps/mobile`, `apps/api`, `packages/match-engine`, `packages/volley-rules` | `pnpm build` e `dotnet build` passam do zero | — |
| E0.2 | Solução .NET 10 com módulos e `Shared` | Estrutura da arquitetura aprovada, compila | E0.1 |
| E0.3 | Padrões: `.editorconfig`, analisadores, ESLint, Prettier, TS strict | Lint sem erros, avisos como erro | E0.1 |
| E0.4 | CI no GitHub Actions (build, lint, testes TS e .NET) | PR só entra com CI verde | E0.3 |
| E0.5 | `CLAUDE.md` e `docs/`: regras para agentes, backlog, decisões, progresso | Agentes conseguem retomar só lendo o repositório | E0.1 |
| E0.6 | Postgres local para desenvolvimento e testes de integração | Teste de integração de exemplo passa | E0.2 |
| E0.7 | Tarefa agendada diária que retoma o ciclo | Uma execução de teste conclui uma tarefa sozinha | E0.5 |

Acrescentadas para a base de conhecimento e a segurança:

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E0.8 | Base de conhecimento: estrutura de `docs/`, ADRs iniciais (stack, monorepo, event sourcing por quadra, modo de regra), glossário, modelo de ameaças, inventário LGPD, lista de segredos | Todas as decisões já tomadas registradas como ADR | E0.5 |
| E0.9 | Segurança na CI: varredura de segredos, dependências vulneráveis e análise estática | CI falha com um segredo de teste plantado | E0.4 |
| E0.10 | Portões de qualidade na CI: regras do front-end (`docs/padroes/frontend.md`) no ESLint, duplicação de código, complexidade ciclomática e tamanho máximo de arquivo, em TS e C# | CI reprova cada violação plantada; código atual dentro dos limites ou com exceção justificada e com prazo | E0.4, E4.1 |

### E1 · Regras do vôlei (`volley-rules`) (M1–M2)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E1.1 | Formações em JSON: 5x1 (6 rotações × recepção), 6x2, 4x2, Livre, posição base de saque | Dados iguais ao explorador `docs/dominio/rotacoes-explorador.html` | E0.1 |
| E1.2 | Validador de sobreposição (modos FIVB 2025–28 e Clássico, tolerância) | Todas as formações prontas passam; casos inválidos falham | E1.1 |
| E1.3 | Faixas da cartinha e conversão do rating para a nota 1–5 | Testes de borda (2,4 / 2,5 / 4,5) | E0.1 |
| E1.4 | Gerador de Pix copia e cola (BR Code com CRC16) | Testes golden com códigos válidos | E0.1 |
| E1.5 | Leitura dos mesmos JSON no C# | Mesmos resultados nos testes golden | E1.1, E0.2 |

### E2 · Motor da partida (`match-engine`) (M2)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E2.1 | Envelope de evento (ID do celular, sequência, lote, versão) e função de estado | Estado recalculado de forma determinística | E0.1 |
| E2.2 | Placar, sets, pontos configuráveis, tie-break, vantagem | Cenários de fim de set e partida. Parser estrito de payload por tipo, só com IDs (`MemberId`) | E2.1 |
| E2.3 | Saque, side-out e rotação por time (`setterZone`) | Nunca gira quem venceu sacando; sequência 1→6→5…4→3→2 | E2.2, E1.1 |
| E2.4 | Posições no saque por sistema e fase | Bate com as formações e passa no validador | E2.3, E1.2 |
| E2.5 | Banco manual e alteração de escalação em partida | Cenários com 7 e 8 jogadores | E2.3 |
| E2.6 | Fila da quadra da rodada com saída parcial e critérios | Cenário da revisão (2 reservas, Azul perde) | E2.3 |
| E2.7 | Desfazer, voltar a um ponto, trocar sacador, girar e desgirar | Linha do tempo reverte placar, rotação e fila juntos | E2.6 |
| E2.8 | Ponto individual (autor e tipo) e pontos sem autor | Preencher depois funciona. Parser estrito de payload por tipo, só com IDs (`MemberId`) | E2.2 |
| E2.9 | Estatísticas por jogador (saldo +/− em quadra, vitórias, sequência) | Rodada simulada com números conferidos à mão | E2.6 |
| E2.12 | Modos de fila: sempre o time inteiro, número fixo e "vencedor também sai" após X vitórias seguidas, com porte C# e golden (ADR 0048) | Cenários de cada modo, inclusive fila menor que N e os dois times saindo; golden TS/C# iguais | E2.6, E2.10 |
| E2.11 | Líbero ligado: configuração, 7º membro no evento e trocas | Só no fundo, nunca saca, sai ao chegar na 4, troca só com quem substituiu; golden | E2.4, E2.5 |
| E2.10 | Porte da função de estado para C# + testes golden compartilhados | TS e C# produzem o mesmo estado em todos os cenários | E2.9, E2.11, E1.5 |

### E3 · API (M3–M6)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E3.1 | Autenticação Firebase (Google, Apple, e-mail) e usuário | Token válido cria usuário; inválido recusa | E0.2, acesso Firebase |
| E3.2 | Grupos, membros, papéis, convite por link e QR | Autorização por papel testada | E3.1 |
| E3.3 | Configuração herdada (grupo → rodada → partida) e modelos | Resolver testado com sobrescritas | E3.2 |
| E3.4 | Rodadas, recorrência, presença, espera com concorrência, mensalista e avulso | Duas confirmações na última vaga: uma vai para a espera | E3.3 |
| E3.5 | Convidado sem conta (entra como avulso). Reivindicação por link: pós-piloto (ADR 0046) | Convidado joga e aparece nas estatísticas da rodada | E3.4 |
| E3.6 | Sorteio equilibrado com travas e reservas, pela nota do admin, ou a sugestão, ou 3,0 (ADR 0047) | Diferença de média mínima em casos de teste | E3.4 |
| E3.7 | Stream da quadra: sincronização idempotente, evento a evento. SignalR ao vivo: pós-piloto (ADR 0046) | Reenvio não duplica | E2.10 |
| E3.8 | Placar assume a quadra: Placar, Co-admin ou Admin assume a escrita do stream com confirmação (último ponto recebido e placar); um celular escreve por vez (ADR 0046) | Celular antigo é recusado após a troca; os eventos dele não enviados são recusados e o app avisa quantos pontos não entraram | E3.7 |
| E3.9 | Projeções de estatísticas e MVP, com o ranking do dia por dupla ou quarteto na areia (ADR 0048); rating OpenSkill por partida, calculado e escondido no piloto, com porte para C# e golden da `openskill` de TS (ADR 0047) | Correção recalcula tudo; nenhuma rota devolve o rating ao jogador | E3.7 |
| E3.10 | **Pós-piloto (ADR 0046).** Pagamentos: Pix copia e cola, "já paguei", confirmação | Fluxo completo testado | E3.4, E1.4 |
| E3.11 | Outbox, Hangfire e push (Expo) | Notificação de promoção da espera chega uma vez | E3.4 |
| E3.12 | Página web da rodada (Razor) com prévia no WhatsApp e login | Prévia aparece; VOU funciona logado e deslogado | E3.4 |
| E3.13 | **Pós-piloto (ADR 0046).** Resumo com IA e cota por grupo | Texto gerado com dados reais; falha usa texto padrão | E3.9 |
| E3.14 | **Pós-piloto (ADR 0046).** Fotos: upload para o R2 e denúncia | Sem EXIF; só o recorte é salvo | acesso Cloudflare |
| E3.15 | **Pós-piloto (ADR 0046).** Planos: `IGroupPlan` e `IUserPlan` (Pro liberado no piloto) | Recursos Pro bloqueados fora do piloto | E3.2 |
| E3.16 | Conta: exclusão, exportação e privacidade | Exclusão mantém o histórico como Ex-jogador | E3.1 |
| E3.18 | Votação do MVP: só quem jogou, sem votar em si, fecha em 24 h, voto secreto, empate pelo saldo (ADR 0048) | Voto duplicado e fora do prazo recusados; ninguém lê o voto de outro | E3.9 |
| E3.17 | Perfil do jogador: apelido, posições e nível sugerido (API); nota do membro definida pelo Admin ou Co-admin, privada (ADR 0047) | Perfil salvo e lido por `MemberId`/`UserId`, sem dado pessoal em evento | E3.2 |

### E4 · App (M3–M6)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E4.1 | Expo, Expo Router, Unistyles com tokens e temas Sol/Noite | Componentes base iguais ao canvas | E0.1 |
| E4.2 | Cliente da API gerado, TanStack Query, tratamento de erro e offline | Tipos sempre iguais aos da API | E3.1 |
| E4.3 | Login, perfil rápido (onboarding) e conta, com exportar e excluir | Telas 02, 27, 30, 30a, 30b | E4.2 |
| E4.4 | Início, lista de grupos, notificações | Telas 03, 17, 28 | E4.2 |
| E4.5 | Criar grupo, ajustes "Como jogamos", membros, com a nota do admin e a sugestão do jogador (ADR 0047); regra da fila (ADR 0048) e criar do zero | Telas 04, 04a, 05, 18, 18a, 19, 19a, 19b, 19c, 19d | E3.3 |
| E4.6 | Criar rodada, detalhe (admin e jogador), adicionar jogador e convidado | Telas 06, 20, 21, 21a, 26 | E3.4 |
| E4.7 | Sorteio e pré-jogo | Telas 07, 08 | E3.6 |
| E4.8 | Escalação por time | Tela 22 | E2.4, E2.5 |
| E4.9 | Modo quadra offline (SQLite, tela ligada, vibração, trava) | Telas 09, 10; partida inteira em modo avião | E2.7 |
| E4.10 | Menu, corrigir, fim de set e de partida, ponto individual | Telas 11, 23, 23a, 24, 25, 31 | E4.9 |
| E4.11 | Sincronização a cada ponto, com sinal (ADR 0046). Placar ao vivo: pós-piloto | Cada ponto chega ao servidor logo depois de gravado; volta da internet sem perder pontos; assumir a quadra e pontos recusados nas telas 09a, 09b e 09c (E3.8) | E3.7 |
| E4.12 | Resumo da rodada sem IA: saldo, vitórias, sequência e MVP do dia (tela 12 sem o texto da IA). Texto da IA e story (tela 13): pós-piloto (ADR 0046) | Tela 12 com os números da E3.9, iguais aos conferidos à mão na rodada simulada da E2.9 | E3.9 |
| E4.13 | Perfil e cartinha (com avatar no piloto; foto pós-piloto, ADR 0046) | Telas 14, 15 | E3.9 |
| E4.14 | **Pós-piloto (ADR 0046).** Módulo nativo de recorte de foto (Vision e ML Kit) + editor | Tela 16; teste no seu aparelho | E4.13 |
| E4.15 | **Pós-piloto (ADR 0046).** Paywall (informativo no piloto) | Tela 29 | E3.15 |
| E4.16 | **Pós-piloto (ADR 0046).** Links que abrem o app (universal links) | Link da rodada abre no app instalado | E3.12 |
| E4.18 | Votação do MVP e resumo da areia com ranking do dia (ADR 0048) | Telas 12a, 12b | E3.18, E4.12 |
| E4.17 | Modo quadra: aviso de bateria abaixo de 20% sugerindo ligar no carregador (ADR 0046) e modo paisagem (Time A à esquerda, B à direita, "Inverter lados") (`produto.md:139-140`) | Aviso aparece uma vez abaixo de 20%; paisagem igual ao layout aprovado pelo Gabriel (não há tela no design) | E4.9 |

### E5 · Operação (M4–M6)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E5.1 | Deploy da API no Google Cloud Run e banco no Neon (teste e produção) | Deploy automático a partir da branch principal. Criar o projeto Neon com `pg_version` 18, a mesma versão principal dos testes (ADR 0020) | acesso Google Cloud e Neon |
| E5.2 | Sentry e logs estruturados (PostHog: pós-piloto, ADR 0046) | Erro proposital aparece no painel | acessos |
| E5.3 | Backups diários, limite de requisições, feature flags e versão mínima | Restauração de backup testada | E5.1 |
| E5.3b | Custo do replay do stream da quadra (revisão da E3.7 Parte 2) | Lote no 20.000º evento abaixo de 500 ms em Release, por snapshot do estado ou teto menor de eventos, com ADR. Bloqueia o piloto | E3.7 |
| E5.4 | Builds EAS e envio para TestFlight e teste interno | Instalável por convite. O AAB tem `targetSdkVersion` 36 ou mais (lacuna G8 da E6.2; como conferir em `docs/operacao/google-play.md`) | acessos das lojas |

### E6 · Conformidade (M6)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E6.1 | Termos de uso e política de privacidade | Publicados e linkados no login | — |
| E6.2 | Revisão de LGPD e das exigências das lojas | Checklist completo | E3.16 |
| E6.3 | Reexclusão depois de restaurar o backup (lacuna G1 da E6.2, ADR 0082, D10). ~400 linhas; **sensível** | Um comando (Cloud Run Job ou modo do executável) lê `identity.deleted_accounts` e reaplica o `DELETE /v1/me` de cada marca no banco restaurado; teste de integração: conta apagada depois do dump volta na restauração e some depois do comando, sem tocar nas outras. Bloqueia o piloto com jogadores reais | E5.3 |
| E6.4 | Página web de exclusão de conta (lacuna G2, pergunta 220, opção 1). ~150 linhas; **sensível** | Página estática `/excluir-conta` (como `/termos`) com o passo a passo do app e o e-mail do encarregado para pedir sem o app; link no Data safety (`docs/operacao/google-play.md`). Bloqueia o teste fechado e a produção da Play, não o teste interno | E6.1, pergunta 199 |
| E6.5 | Prazo da marca de exclusão (lacuna G3, pergunta 222). ~150 linhas | A varredura diária (ADR 0069) apaga de `identity.deleted_accounts` as marcas com mais de 60 dias; teste com 59 e 61 dias. Não bloqueia | E3.16 |
| E6.6 | "Denunciar" no app (lacuna G4, pergunta 221). ~400 linhas | Na tela do membro e do grupo, "Denunciar" manda só IDs (grupo, membro, motivo de lista fechada) a uma tabela que o Gabriel lê; "Remover membro" do admin segue como a ação; sem texto livre nem dado pessoal no registro. Bloqueia o teste fechado e a produção da Play | E3.2, E4.5 |
| E6.7 | Apelidos da página `/r` escondidos depois da rodada (lacuna G6, pergunta 224). ~100 linhas | A página `/r/{código}` mostra a lista de apelidos só até 7 dias depois do início da rodada; depois, só grupo, data e local; teste com 6 e 8 dias. Não bloqueia | E3.12 |
| E6.8 | Pontos pendentes de uma conta apagada no aparelho (lacuna G7, pergunta 225, M4-B7). ~150 linhas | A exclusão feita no aparelho (tela 30b) apaga do `sacou.db` as sessões da quadra cujo `owner_key` é da conta apagada; as de outras contas ficam (teste). Não bloqueia | E4.3, E4.11 |

### E7 · Piloto (M7)

| ID | Tarefa | Aceite | Depende de |
|---|---|---|---|
| E7.1 | Onboarding dos grupos do piloto | 3 a 5 grupos ativos | M6 |
| E7.2 | Painel de métricas do portão, contado direto no banco (sem PostHog, ADR 0046) | 60% pelo link medido | E3.4, E3.12 |
| E7.3 | Ciclo semanal de correções | Relatório semanal | E7.1 |

## Base de conhecimento

Tudo o que uma sessão nova precisa para continuar o trabalho fica no repositório, em `docs/`, com a arquitetura e a segurança registradas como decisões rastreáveis. Nenhum agente depende de lembrar de uma conversa anterior.

| Pasta / arquivo | Conteúdo | Quem atualiza |
|---|---|---|
| `CLAUDE.md` | Porta de entrada: como trabalhar, regras, onde está cada coisa, ritual de início e fim de sessão | Orquestrador, quando as regras mudam |
| `docs/estado/progresso.md` | Marco atual, tarefas feitas, em andamento e bloqueadas | Toda tarefa concluída |
| `docs/estado/sessoes/AAAA-MM-DD.md` | Diário de cada sessão: o que foi feito, o que ficou pendente, próximo passo | Fim de cada sessão |
| `docs/estado/perguntas.md` | Perguntas abertas para o Gabriel e respostas recebidas | Quando surge ou se resolve uma dúvida |
| `docs/arquitetura/visao-geral.md` | Módulos, fluxos, diagramas, stack | Quando a estrutura muda |
| `docs/arquitetura/adr/NNNN-titulo.md` | Registro de decisões de arquitetura: contexto, decisão, alternativas, consequências | Toda decisão técnica relevante |
| `docs/dominio/` | Glossário, regras do vôlei e rotações, catálogo de eventos, regras da fila e do MVP | Quando uma regra muda |
| `docs/seguranca/modelo-de-ameacas.md` | Ameaças por componente (STRIDE) e mitigações | Novas superfícies (login, pagamento, upload, assumir a quadra, votação) |
| `docs/seguranca/checklist.md` | Checklist baseado no OWASP ASVS (API) e MASVS (app) | Revisão de segurança de cada marco |
| `docs/seguranca/dados-pessoais.md` | Inventário LGPD: que dado, onde fica, por quê, por quanto tempo | Todo dado pessoal novo |
| `docs/seguranca/segredos.md` | Lista de segredos por nome e onde ficam (nunca os valores) | Todo segredo novo |
| `docs/operacao/` | Ambientes, deploy, rollback, restauração de backup, resposta a incidentes | Toda mudança de infraestrutura |
| `docs/padroes/` | Convenções de código, testes, commits e PRs | Quando o padrão muda |
| `docs/ideias.md` | Ideias fora do escopo do MVP | Qualquer agente |

**Ritual de sessão:**

1. **Início:** ler `CLAUDE.md`, `progresso.md`, o último diário de sessão e `perguntas.md`; só então pegar a próxima tarefa.
2. **Durante:** decisão técnica relevante vira ADR; regra nova vai para `dominio/`; superfície de ataque nova atualiza o modelo de ameaças.
3. **Fim:** escrever o diário da sessão com o próximo passo exato, atualizar `progresso.md` e fazer commit. Uma sessão nunca termina com trabalho fora do repositório.

**Segurança no fluxo:**

1. Tarefas sensíveis (login, tokens, pagamentos, upload de foto, assumir a quadra, nota do admin, votação do MVP, dados pessoais) passam também por um **revisor de segurança**, um agente separado que confere o modelo de ameaças e o checklist.
2. A CI roda varredura de segredos, dependências vulneráveis (`npm audit`, `dotnet list package --vulnerable`) e análise estática.
3. No fim de cada marco, uma **revisão de segurança geral** atualiza o checklist; achados graves bloqueiam o marco.

## Definição de pronto

Uma tarefa só entra na branch principal quando cumpre os 8 itens abaixo, conferidos pelo revisor e pelo testador, nunca pelo próprio desenvolvedor.

1. O critério de aceite do backlog está atendido e demonstrado.
2. Testes novos cobrem a regra de negócio da tarefa; regras do vôlei sempre com testes golden.
3. CI verde: build, lint (avisos como erro), testes TS e .NET.
4. Respeita a arquitetura: DDD enxuto, fatias verticais, domínio sem infraestrutura, eventos sem dado pessoal, código em inglês com o glossário.
5. Clean Code: nomes claros, funções pequenas, sem números soltos, imutabilidade, sem `any`.
6. Telas iguais ao canvas, alvos de toque de 44 px ou mais, contraste AA, textos em pt-BR centralizados.
7. Sem segredos no código nem nos logs.
8. `Base de conhecimento atualizada: progresso, ADR para decisões técnicas, domínio, e segurança quando a tarefa muda a superfície de ataque ou os dados pessoais`

## Riscos e limitações

O modelo autônomo funciona bem para código e testes; os limites estão no que exige um aparelho real, contas suas ou julgamento de quadra.

| Risco | Impacto | Como trato |
|---|---|---|
| Não tenho celular para testar | Recorte de foto, vibração, push e tela ligada só validam no aparelho | Build pronto + roteiro de teste de 10 minutos para você em cada marco |
| Cada sessão começa do zero | Perda de contexto entre execuções | Todo estado no repositório: backlog, progresso, decisões e `CLAUDE.md` |
| Acessos atrasam | Marcos M3 a M6 param | Aviso com uma semana de antecedência; sigo com tarefas sem dependência |
| Testes de integração precisam de Postgres | Ambiente na nuvem pode não ter Docker | Testcontainers com Postgres 18 fixado por digest, em Docker Desktop local e no runner da CI (ADR 0020) |
| Bugs de regra na quadra derrubam a confiança | Piloto abandona o app | Motor isolado, testes golden e cenários reais antes do piloto |
| Agentes concordando entre si | Erros passam pela revisão | Revisor e testador sempre novos, sem ver o raciocínio do desenvolvedor |
| Escopo crescer | Atraso no piloto | Ideias novas vão para `docs/ideias.md` e só entram depois do M7 |
