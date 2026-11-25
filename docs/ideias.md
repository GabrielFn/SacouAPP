# Ideias fora do escopo do MVP

- Votação de MVP e "De quem?" completos como fluxo próprio (hoje são opções do grupo).
- Recorte de foto no servidor (ONNX Runtime) como alternativa ao celular.
- Placar web simplificado para quem não tem o app.
- Internacionalização (pedido do Gabriel em 30/10/2026): outros idiomas além do pt-BR. Os textos já ficam centralizados em arquivos, o que facilita. **Lembrar o Gabriel no relatório de cada marco**, até ele decidir quando entra.
  - **Análise de 24/11/2026 (orquestrador), para quando entrar.** Dá para fazer sem refatoração grande; o trabalho maior é tradução e gramática.
    - **Já ajuda:** textos do app em `apps/mobile/src/strings/*.pt-BR.ts` (24 arquivos) com o teste `no-hardcoded-text.test.ts` contra texto solto; web em `apps/web/src/strings.pt-BR.ts`; erros da API chegam como código e o app traduz; eventos, banco e contrato só com IDs e valores; datas em UTC com o fuso de cada rodada.
    - **1. Idioma em tempo de execução:** as telas importam o `.pt-BR` direto (87 importações). Criar uma camada que escolhe o dicionário pelo idioma do aparelho, com o mesmo formato de hoje, e trocar as importações (mecânico).
    - **2. Gramática no texto:** funções com regras do português ("na terça", "no sábado", plurais, "1º da fila", `rounds-when.pt-BR.ts`) viram funções por idioma, não só tradução.
    - **3. Datas e números:** formatação presa ao pt-BR e, em alguns pontos, ao fuso de São Paulo (28 ocorrências) passa a vir do idioma.
    - **4. Textos do servidor:** push, páginas `/r`, `/c`, `/painel`, `/termos` e `/privacidade` (`WebTexts.cs`) precisam do idioma da pessoa: guardar a preferência (dado novo, entra em `dados-pessoais.md`).
    - **5. Fora do código:** termos e política por idioma (com revisão jurídica), loja e telas do `design/`.
    - **Tamanho:** a estrutura (itens 1, 3 e 4) é uma tarefa de duas partes, do porte da R101; cada idioma novo soma tradução e os itens 2 e 5. Candidatos: inglês e espanhol.
    - **Recomendação:** depois do piloto (só no Brasil). Até lá, manter o padrão atual, que deixa o caminho aberto sem custo.
- Rodízio automático do banco: "sai quem saca", por pontos, por set e por tempo. Fora do MVP por decisão do Gabriel em 02/11/2026: nenhum documento dizia como "sai quem saca" funciona, e a busca não achou padrão (a liga da Michigan State põe o reserva direto no saque). Decidir com o que os grupos do piloto fizerem à mão.
- Rei da quadra tradicional na areia: partidas curtas e coroas acumuladas pelo "rei" (o MVP tem o rei da quadra simples, ADR 0048). Os modos de fila "sempre time inteiro", "número fixo" e "vencedor sai após X vitórias" entraram no MVP (ADR 0048).
- Critério "nível" para escolher quem sai na saída parcial (equilíbrio de nível). Fora do MVP por decisão do Gabriel em 03/11/2026 (E2.6, ADR 0029): o nível é privado e nunca entra no evento nem na decisão da fila; o chip saiu da tela de ajustes do grupo.
- Grupos, fora da E3.2 (ADR 0040): apagar grupo, transferir a propriedade e banir. Readmitir quem foi removido pelo menu "⋯" da tela 19 (decisão do Gabriel na pergunta 19) entra numa tarefa futura. Teto de usos por link de convite (hoje o teto é o de membros do grupo). Nota para a E3.16: o último admin que apaga a conta deixa o grupo sem admin, e a E3.16 decide entre promover alguém ou deixá-lo assim.

- **Pontos recusados ao assumir a quadra** (ADR 0046): guardar os eventos do celular antigo que chegaram depois da troca para o admin revisar e aplicar, em vez de só avisar.

- **Trocar os lados a cada set** ("Inverter lados" automático, como a troca de quadra do vôlei): decidido em 13/11/2026 que o "Inverter lados" vale só enquanto a quadra está aberta e é manual (E4.17); a troca sozinha a cada set fica aqui.

- **Bloqueio do app por biometria ou PIN** (E4.3, ADR 0057, D5): o piloto confia no bloqueio do próprio celular; pedir a digital antes de abrir o app ou de ações sensíveis fica para depois.

- **Imagem dos times no "Confirmar e compartilhar"** (E4.7, pergunta 71): uma imagem com os times e as cores, gerada por `react-native-view-shot` (biblioteca nativa nova e APK novo). O piloto compartilha texto ("Laranja: Ana, João…").

- **Trocar jogador com quem está na fila** (E4.10, pergunta 79): no piloto a tela 23a troca só com o banco, como o motor (`substitutePlayer`; os times ficam congelados no `MatchStarted`, ADR 0029). "Entrar da fila" pede um evento novo que tire o jogador da fila e o ponha no time no meio da partida.
