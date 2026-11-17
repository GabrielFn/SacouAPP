# ADR 0060 · Sorteio e pré-jogo no app

**Status:** aceito em parte (17/11/2026): a Parte 1 da E4.7 (tela 07). A Parte 2 (tela 08, `MatchStarted`, origem da quadra no SQLite) completa este ADR. **Decidido por:** plano da E4.7 (`docs/estado/tarefas/E4.7.md`), dentro da arquitetura aprovada. O plano chamava este ADR de 0059; o número foi para o ícone do app.

## Contexto

A tela 07 mostra os times sorteados pelo servidor (`POST .../rounds/{roundId}/draw`, [ADR 0055](0055-sorteio-no-servidor.md)), com a **nota do admin** de todos os confirmados ([ADR 0047](0047-nota-do-admin-e-rating-openskill.md): só Admin e Co-admin). O sorteio não grava nada no servidor: cada chamada é um sorteio novo, e o admin troca e trava nomes antes de confirmar. A regra 1 de `frontend.md` pede um lugar só para cada informação, e dado do servidor fica no TanStack Query.

## Decisão

1. **Rota e papéis (D1).** `groups/[groupId]/rounds/[roundId]/draw.tsx`, só com IDs na rota. `canDraw(papel)` (`admin` e `coAdmin`) decide se a 06 mostra "Sortear times" (saiu `"draw"` de `PENDING_ROUND_SCREENS`). Aberta por outro papel, a tela mostra "Só admins sorteiam os times." sem chamar a API; um 403 dá o mesmo texto e relê o grupo e a rodada. Placar e Jogador não sorteiam nem começam a primeira partida: os times confirmados só existem no aparelho de quem sorteou; o Placar entra depois por "Assumir a quadra" (E3.8).
2. **O resultado do sorteio vive só no reducer (D3).** Não é dado de consulta: é a resposta única de um comando que não grava nada e que as trocas editam. `draw-flow.reducer.ts` guarda o arranjo (times, reservas, níveis em décimos inteiros), as travas, a seleção, o modo (trocar ou travar) e o aviso local. O status do pedido fica na mutação do TanStack (`scope: draw:<roundId>`, `gcTime: 0`). **A resposta nunca fica no estado da mutação:** o `mutationFn` entrega a resposta ao reducer por um `deliver` e devolve `null`, então nem o `MutationCache` guarda as notas enquanto a tela está aberta (mais estrito que o "ninguém lê `mutation.data`" do plano). Título, medidor, cartões, dicas e a lista que mudou são derivados.
3. **Primeiro sorteio automático, uma vez por abertura (D4).** Um efeito chama a mutação quando nada impede (papel, rodada cancelada, sorteio desligado, menos de 4 confirmados, rede). Voltar à 07 sorteia de novo: o arranjo não é guardado.
4. **Medidor no TS com o golden do C# (D5).** `drawBalance` e `teamAverageTenths` em `packages/volley-rules/src/draw/`, só com inteiros, leem `golden/draw-balance.json`, o mesmo arquivo do C#. O app recalcula o medidor a partir do arranjo, então um "Trocar" o atualiza sem rede. Rótulo da pergunta 55: até 2 décimos "ótimo", até 5 "bom", acima "desequilibrado". O eixo é um ponto inteiro que contém as médias (ou quantos a diferença pedir); com mais de dois times, só a maior e a menor ganham marcador.
5. **"Sortear de novo" (D5)** manda as travas (`together`) e as reservas atuais (depois das trocas). Se a lista mudou desde o sorteio, as reservas ficam com o servidor (o número de reservas mudou) e as travas de quem saiu são descartadas. Uma trava entre times diferentes pede um sorteio novo na hora; recusada pelo servidor, ela sai.
6. **Decisões pequenas da tela 07:**
   - a troca manual vence a trava: trocar um travado tira a trava dele, com o aviso "A trava de Ana e João saiu.";
   - reserva não trava ("Reserva não trava: troque antes."); no máximo 24 travas, conferido no app antes de pedir;
   - "Travar dupla" vale para um par: depois dele, o modo volta a "Trocar";
   - a dica neutra em gênero "Você selecionou Duda. Toque em outro nome pra trocar." no lugar de "Duda selecionada.";
   - do time 3 em diante, "Time 3" com cartão azul-marinho, sem cor nova (o design não desenhou).
7. **O que sai do canvas (D9):** "A imagem compartilhada mostra só os times." vira "O que você compartilha mostra só os times." até a imagem (pergunta 71); o exemplo "A 3,7 · B 3,6" vem do sorteio. O rodapé fica sobre o fundo da tela (o `Screen` não tem rodapé branco com borda).
8. **"Confirmar e compartilhar" (D11):** na Parte 1, abre a folha de compartilhar do sistema com o texto dos times, só com apelidos (`drawShareText`, golden): nunca nota, posição nem ID.

## Consequências

- A nota de todos os confirmados fica na memória do app enquanto a 07 está aberta, e em nenhum outro lugar: nem no cache do Query (persistido ou não), nem no estado da mutação, nem em log ou rota. Captura de tela pelo admin é aceita (ele já vê as notas na 19a).
- O `display-names.ts` subiu de `features/court/model/` para `src/ui/`, porque a 07 usa o mesmo encurtamento de nomes da quadra.
- `EmptyState` ganhou `body` opcional, para as páginas cujo título já diz tudo.
- Partes seguintes: tela 08 como folha da 07 no mesmo reducer, escalação padrão, `MatchStarted` e origem da quadra no SQLite (Parte 2); imagem e "Montar times" só se o Gabriel pedir (perguntas 71 e 72).
