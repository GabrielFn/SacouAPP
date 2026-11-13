# ADR 0046 · Escopo do piloto, papel Placar e sincronização a cada ponto

**Status:** aceito (11/11/2026). **Tarefa:** nenhuma; decisões do Gabriel em conversa de 11/11/2026. Atualiza `decisoes.md` (linhas de Placar, Foto, Serviços e o novo item "Escopo do piloto"), `plano-mvp.md` e `backlog.md`.

## Contexto

O motor da partida está pronto (M2), mas o restante do MVP ainda tem muitas tarefas caras e sensíveis antes do primeiro jogador real. O maior risco do projeto passou a ser demorar para chegar ao piloto, e não a parte técnica. Além disso, no racha típico o admin também joga e o celular fica apoiado na quadra. Por isso "o admin marca o placar" não funciona, e a entrega por QR resolve um problema que o celular apoiado já resolve.

## Decisões

### 1. Fora do piloto (pós-piloto)

Voltam depois do piloto, com dados reais de uso:

| O que sai | Tarefas |
|---|---|
| Texto do resumo com IA e story | E3.13 e parte da E4.12. O Resumo da rodada sem IA (tela 12) fica no piloto |
| Foto da cartinha: upload, denúncia e recorte nativo | E3.14, E4.14. A cartinha do piloto usa avatar |
| ~~Rating Glicko-2~~ | Trocado pelo OpenSkill, calculado e escondido no piloto ([ADR 0047](0047-nota-do-admin-e-rating-openskill.md)) |
| Placar ao vivo com SignalR | Parte da E3.7 e da E4.11. Fica a sincronização |
| Planos e paywall | E3.15, E4.15. O Pro já é liberado no piloto |
| Pix com "já paguei" e confirmação | E3.10 |
| Reivindicação da conta do convidado | Parte da E3.5. O convidado entra como avulso |
| Links que abrem o app | E4.16. O link da rodada abre a página web, que já resolve o VOU |
| Entrega do placar por QR, código de uso único e token sem conta | Parte da E3.8, trocada pela decisão 2 |

Serviços adiados junto: RevenueCat e PostHog. O R2 fica só para os backups (E5.3). A métrica do portão do piloto (E7.2) é contada direto no banco.

### 2. Papel Placar: assumir a quadra

Substitui "Placar por QR" em `decisoes.md:21`.

- Quem tem o papel Placar (ou Admin, ou Co-admin) pode abrir a quadra e marcar a qualquer momento, sem pedir a ninguém.
- Se outro celular estiver marcando, o app pede confirmação: *"Outro celular está marcando esta quadra. Último ponto recebido há 4 min: 12 × 10. Se você assumir, ele para de marcar. Continuar?"* O texto mostra o tempo e o placar do último evento que o servidor recebeu, para quem assume saber se precisa conferir o placar.
- Ao confirmar, o servidor passa a escrita do stream `CourtSession` para esse celular. O anterior recebe *"Fulano assumiu o placar"* e fica só olhando.
- **Continua valendo "um celular escreve por vez".** Dois celulares escrevendo juntos duplicariam pontos (IDs gerados em cada aparelho) e desmontariam rotação e fila. Juntar dois logs da mesma partida automaticamente fica fora do MVP.
- **Celular antigo que estava sem internet:** quando ele sincroniza, o servidor recusa todos os eventos ainda não enviados a partir da troca, e o app mostra *"X pontos não entraram, porque Fulano assumiu"*. Guardar esses pontos para o admin revisar fica em `docs/ideias.md`.
- Assumir exige internet no celular que assume. Sem sinal, a quadra continua no celular apoiado.

### 3. Sincronização a cada ponto

Com sinal, o app envia cada evento logo depois de gravá-lo no SQLite (E4.11), em vez de juntar em lotes por tempo. Isso limita a perda na decisão 2 a zero ou um ponto. Sem sinal, os eventos ficam no log local e vão no próximo envio, com o reenvio idempotente que já existe ([ADR 0009](0009-court-session-event-sourcing.md)).

### 4. Modo quadra: paisagem e aviso de bateria

A paisagem continua (E4.17), porque o celular fica apoiado. O aviso de bateria abaixo de 20% continua, mas sugere ligar no carregador ou na power bank em vez de entregar o placar (muda `produto.md:139`).

> **Ajuste (11/11/2026, Gabriel):** o Resumo da rodada sem IA voltou para o piloto. Sem ele, o jogador só via os números depois do jogo na tela de fim de partida e no perfil. A E4.12 mostra saldo, vitórias, sequência e MVP do dia, a partir da E3.9. Ficam fora só o texto da IA e o story.

> **Telas do piloto (12/11/2026):** `design/mvp/` e o canvas "Sacou — Telas do MVP (piloto)" têm só o que entra no piloto: sem story, texto da IA, foto da cartinha, Pix, paywall, placar ao vivo, entrega por QR e nota ou faixa na cartinha. A confirmação de assumir a quadra (09a), o celular que perdeu o placar (09b) e os pontos recusados (09c) foram aprovados em 12/11/2026. Ainda faltam desenhar o aviso de bateria e a paisagem.

## Alternativas descartadas

- **Manter a E3.8 inteira (QR com token sem conta):** a tarefa sensível mais cara, para um caso que o celular apoiado e o papel Placar já resolvem.
- **Vários celulares escrevendo ao mesmo tempo:** exigiria fundir logs de uma mesma partida, com pontos duplicados e fila divergente.
- **Só o admin pode retomar:** trava a quadra quando o admin está jogando.

## Consequências

- A E3.8 vira "Placar assume a quadra". Continua sensível (autorização e escrita no stream), com revisor de segurança, e depende da E3.7.
- O modelo de ameaças ganha a superfície "assumir a quadra" (quem pode e com que frequência), a definir na E3.8.
- As tarefas pós-piloto ficam no backlog, fora dos marcos, e voltam com decisão do Gabriel depois do M7.
