# Perguntas para o Gabriel

## Abertas
1. Preços dos planos (propostos): Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ do Jogador R$ 5,90/mês ou R$ 44,90/ano. Confirma? (Não bloqueia até o M6.)
2. Retenção e base legal (LGPD): nenhum documento define por quanto tempo cada dado fica guardado nem a base legal, inclusive em backups. Pede orientação jurídica. Opções: (1) levar ao advogado ou contador na E6.2, com uma proposta minha para revisão; (2) definir antes. **Recomendação: opção 1.** Não bloqueia até o M6; o inventário fica "a definir".
3. Encarregado de dados (LGPD): `docs/produto.md` exige o canal, mas não diz quem é nem qual o contato. Opções: (1) você mesmo, com um e-mail do domínio do Sacou; (2) terceirizar. **Recomendação: opção 1 no piloto.** Não bloqueia até o M6 (E6.1, política de privacidade).
4. Provedor de IA do resumo: nenhum documento nomeia. Envolve conta e gasto, então a decisão é sua no M5 (E3.13). **Recomendação: decidir no início do M5.** Não bloqueia agora.
5. Editor de formação do Pro: como a sobreposição é só aviso (ADR 0010), o editor deixa salvar uma formação inválida? Opções: (1) deixa salvar, mostrando o aviso; (2) não deixa. **Recomendação: opção 1**, coerente com "aviso, nunca bloqueio". Não bloqueia até a tarefa do editor.
6. Sets "livre": `produto.md:75` lista "livre, único, md3, md5", mas as telas 08 e 20 só oferecem 1 set, Melhor de 3 e Melhor de 5, e nenhum documento diz o que é "livre". Opções: (1) fora do MVP, como nas telas; (2) partida sem número de sets, que só termina em "Encerrar partida". **Recomendação: opção 1**; entrar depois só acrescenta um valor a `bestOf`. Não bloqueia agora: a E2.2 aceita 1, 3 ou 5.
7. "Encerrar partida" antes do fim (tela 23): nenhum documento diz quem vence com partida incompleta, o que define quem sai na fila. Opções: (1) vence quem lidera em sets e, se empatar, em pontos; empate total fica sem vencedor e ninguém sai; (2) o admin escolhe sempre; (3) a partida é anulada, sem vencedor. **Recomendação: opção 1.** Não bloqueia agora: o `MatchEnded` da E2.2 aceita as três, e a resposta decide só a chamada, nas E2.6 e E4.

## Respondidas
- **Padrões do app e métricas (03/11/2026):** seguir as recomendações (pastas por funcionalidade, fronteiras por lint, sem estilo e cor soltos, RNTL) e acrescentar duplicidade, complexidade ciclomática e tamanho de componentes e arquivos na CI, sem componente e subcomponente no mesmo arquivo. Ferramenta de duplicação: `jscpd`. Vira a tarefa E4.0.
- **Estatísticas, E2.9 (03/11/2026):** sequência é vitórias seguidas; partida encerrada sem vencedor quebra a sequência; "time" no Resumo é a cor (lado A/B). Fecha a pendência de `revisao-mvp.md:43`.
- **Ponto individual, E2.8 (03/11/2026):** o app barra combinações impossíveis (Ace só de quem sacou o rali; líbero nunca leva Ace nem Bloqueio); autor só preenchido com a partida aberta; sem apagar autor, só trocar ou DESFAZER.
- **Correções, E2.7 (03/11/2026):** "Trocar sacador" troca só o time que saca, sem girar ninguém, e no 0–0 corrige também quem começou o set; DESFAZER desfaz a última ação, seja ela qual for.
- **Fila, E2.6 (03/11/2026):** todos do time podem sair, inclusive banco e líbero, e quem entra no lugar do líbero vai para o fim do banco; empate em "mais partidas seguidas" desempata por mais partidas na rodada e depois por ordem de chegada; "Nível" fora do MVP; só saída parcial automática no MVP, sem o interruptor, "N fixo" nem "vencedor sai após X vitórias".
- **Líbero, E2.11 (03/11/2026):** entrada e saída calculadas, sem evento (amplia a exceção a `decisoes.md:26`, já anotada); cobre os dois centrais, alternando; só no 5x1 e no 6x2, então o grátis fica sem líbero.
- **Banco, E2.5 (02/11/2026):** só Manual no MVP. "Sai quem saca" não tinha definição nos documentos nem padrão na internet, e foi para `docs/ideias.md`. Isso dispensa as perguntas sobre o momento da troca, o levantador e a exceção a `decisoes.md:26`. A linha "Banco" saiu da tela `AjustesGrupo`.
- **Cópia das formações, E2.4 (02/11/2026):** número `formationsVersion` no evento e catálogo imutável por versão, em vez da cópia completa. Exceção a `decisoes.md:26`, já ajustado; a cópia real entra junto com o editor do Pro.
- **Líbero ligado no MVP (02/11/2026):** entra, contra a recomendação. Vira a tarefa E2.11, no M2 e antes do porte em C#. Faltam o controle em "Avançado" e a tela: `produto.md:94` prevê, mas o design não tem.
- **Toque em dois jogadores na tela 22 (02/11/2026):** troca a ordem oficial (`lineup`), e o alerta trata só de funções, como "Levantadores não estão opostos". O texto "Lia e Ana estão fora de ordem" (`Escalacao.dc.html:91`) muda na E4.8.
- **Rotação do set seguinte, E2.3 (02/11/2026):** opção 1, continua de onde parou. Definitivo. O app só troca o lado do desenho; a escolha está isolada em `chooseNextSetZones` (ADR 0024).
- **Primeiro saque do set decisivo, E2.3 (02/11/2026):** opção 2, sorteio no set decisivo de md3 e md5; nos demais sets, alterna. `confirmSetEnd` aceita `firstServer` de fora, e a interface do sorteio é da E4.10. `rotacoes.md:40` corrigido.
- **Time sem 6 jogadores, E2.3 (02/11/2026):** opção 1, rotação desligada (`rotations.<lado>: null`), e o app mostra só o time que saca. Decide o que as E4.7 e E4.8 mostram.
- **Porta do Ryuk (01/11/2026):** risco aceito por ora, sem mudança na máquina (ADR 0020).
- **Empate lateral (01/11/2026):** seguir a FIVB 2025-28, regra 7.4.3.2 ("level with"): empate lateral é permitido, como o frente/fundo. Corrige `rotacoes.md`, o explorador e o validador na E1.2. O texto de edições anteriores, para o modo Clássico, não foi conferido.
- **Actions no GitHub (01/11/2026):** o orquestrador configurou, com autorização: SHA obrigatório e só as 5 actions usadas hoje.
- **Aviso de CVE (01/11/2026):** só alertas do Dependabot, já ligados. Sem execução agendada: a validade do `zod` continua sendo cobrada só em execução com código.
- **Postgres local na E0.6 (01/11/2026):** Docker Desktop, instalado pelo Gabriel. Recusados os binários da EDB, porque `bin\postgres.exe` não tem assinatura, e o Postgres só na CI.
- **Disco D: (01/11/2026):** "use o disco local D quando precisar". O orquestrador leu isso como autorização para pôr no D: os temporários, os caches e, se o C: ficar abaixo de 2 GB livres, o disco de imagens do Docker. Quem move o disco é o orquestrador.
- **`zod` na E0.9 (01/11/2026):** exceção aceita até 31/01/2027 para GHSA-mrhx-c7xc-m3w5 no `zod` 3.25.76, que vem do `@expo/cli` e não entra no bundle. Análise no ADR 0007; um teste reprova a exceção vencida.
- **`testador.md` (01/11/2026):** autorizada a correção do caminho das formações.
- **Proteção da `main` (30/10/2026):** repositório privado e grátis, sem bloqueio imposto pelo GitHub; o orquestrador só faz merge depois de conferir a CI verde.
- **E0.5 travada (30/10/2026):** enxugar o `docs/backlog.md`: só o mapa de marcos e uma regra curta remetendo ao `CLAUDE.md`, com mais uma revisão.
- **Livre e 6x0 (30/10/2026):** um botão só na interface, "Livre / 6x0".
- **Cadência das sessões:** o plano fala em "4 horas" (linha 10) e "diária" (E0.7), e `docs/decisoes.md` em "quando quiser". O Gabriel decidiu: sessões manuais e E0.7 para depois (`PROMPT-INICIAL.md`). O orquestrador decidiu que o plano só muda quando a E0.7 for retomada.

## Decidido pelo orquestrador
- **CI verde antes da E0.4:** ver [ADR 0003](../arquitetura/adr/0003-local-validation-before-ci.md).
