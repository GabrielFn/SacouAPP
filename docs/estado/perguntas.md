# Perguntas para o Gabriel

## Abertas
1. Preços dos planos (propostos): Pro do Grupo R$ 12,90/mês ou R$ 99/ano; Sacou+ do Jogador R$ 5,90/mês ou R$ 44,90/ano. Confirma? (Não bloqueia até o M6.)
2. Retenção e base legal (LGPD): nenhum documento define por quanto tempo cada dado fica guardado nem a base legal, inclusive em backups. Pede orientação jurídica. Opções: (1) levar ao advogado ou contador na E6.2, com uma proposta minha para revisão; (2) definir antes. **Recomendação: opção 1.** Não bloqueia até o M6; o inventário fica "a definir".
3. Encarregado de dados (LGPD): `docs/produto.md` exige o canal, mas não diz quem é nem qual o contato. Opções: (1) você mesmo, com um e-mail do domínio do Sacou; (2) terceirizar. **Recomendação: opção 1 no piloto.** Não bloqueia até o M6 (E6.1, política de privacidade).
4. Provedor de IA do resumo: nenhum documento nomeia. Envolve conta e gasto, então a decisão é sua no M5 (E3.13). **Recomendação: decidir no início do M5.** Não bloqueia agora.
5. E0.6, Postgres local sem assinatura: `bin\postgres.exe` da EDB não é assinado, nem no 18.6-3 nem no 18.6-5; dos binários da própria EDB, só o `stackbuilder.exe` é. O SHA-256 do zip 18.6-3 bate com a referência de terceiros do plano. Opções: (1) aceitar o 18.6-3 sem assinatura, com hash fixado e servidor só em localhost; (2) Postgres só na CI, sem testes de integração locais por enquanto; (3) Docker Desktop, instalado por você. **Recomendação: opção 1.** Bloqueia a E0.6 e o fim do M1.

## Respondidas
- **`zod` na E0.9 (01/11/2026):** exceção aceita até 31/01/2027 para GHSA-mrhx-c7xc-m3w5 no `zod` 3.25.76, que vem do `@expo/cli` e não entra no bundle. Análise no ADR 0007; um teste reprova a exceção vencida.
- **`testador.md` (01/11/2026):** autorizada a correção do caminho das formações.
- **Proteção da `main` (30/10/2026):** repositório privado e grátis, sem bloqueio imposto pelo GitHub; o orquestrador só faz merge depois de conferir a CI verde.
- **E0.5 travada (30/10/2026):** enxugar o `docs/backlog.md`: só o mapa de marcos e uma regra curta remetendo ao `CLAUDE.md`, com mais uma revisão.
- **Livre e 6x0 (30/10/2026):** um botão só na interface, "Livre / 6x0".
- **Cadência das sessões:** o plano fala em "4 horas" (linha 10) e "diária" (E0.7), e `docs/decisoes.md` em "quando quiser". O Gabriel decidiu: sessões manuais e E0.7 para depois (`PROMPT-INICIAL.md`). O orquestrador decidiu que o plano só muda quando a E0.7 for retomada.

## Decidido pelo orquestrador
- **CI verde antes da E0.4:** ver [ADR 0003](../arquitetura/adr/0003-local-validation-before-ci.md).
