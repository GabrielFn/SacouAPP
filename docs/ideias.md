# Ideias fora do escopo do MVP

- Votação de MVP e "De quem?" completos como fluxo próprio (hoje são opções do grupo).
- Recorte de foto no servidor (ONNX Runtime) como alternativa ao celular.
- Placar web simplificado para quem não tem o app.
- Internacionalização (pedido do Gabriel em 30/10/2026): outros idiomas além do pt-BR. Os textos já ficam centralizados em arquivos, o que facilita. **Lembrar o Gabriel no relatório de cada marco**, até ele decidir quando entra.
- Rodízio automático do banco: "sai quem saca", por pontos, por set e por tempo. Fora do MVP por decisão do Gabriel em 02/11/2026: nenhum documento dizia como "sai quem saca" funciona, e a busca não achou padrão (a liga da Michigan State põe o reserva direto no saque). Decidir com o que os grupos do piloto fizerem à mão.
- Rei da quadra tradicional na areia: partidas curtas e coroas acumuladas pelo "rei" (o MVP tem o rei da quadra simples, ADR 0048). Os modos de fila "sempre time inteiro", "número fixo" e "vencedor sai após X vitórias" entraram no MVP (ADR 0048).
- Critério "nível" para escolher quem sai na saída parcial (equilíbrio de nível). Fora do MVP por decisão do Gabriel em 03/11/2026 (E2.6, ADR 0029): o nível é privado e nunca entra no evento nem na decisão da fila; o chip saiu da tela de ajustes do grupo.
- Grupos, fora da E3.2 (ADR 0040): apagar grupo, transferir a propriedade e banir. Readmitir quem foi removido pelo menu "⋯" da tela 19 (decisão do Gabriel na pergunta 19) entra numa tarefa futura. Teto de usos por link de convite (hoje o teto é o de membros do grupo). Nota para a E3.16: o último admin que apaga a conta deixa o grupo sem admin, e a E3.16 decide entre promover alguém ou deixá-lo assim.

- **Pontos recusados ao assumir a quadra** (ADR 0046): guardar os eventos do celular antigo que chegaram depois da troca para o admin revisar e aplicar, em vez de só avisar.

- **Trocar os lados a cada set** ("Inverter lados" automático, como a troca de quadra do vôlei): decidido em 13/11/2026 que o "Inverter lados" vale só enquanto a quadra está aberta e é manual (E4.17); a troca sozinha a cada set fica aqui.

- **Bloqueio do app por biometria ou PIN** (E4.3, ADR 0057, D5): o piloto confia no bloqueio do próprio celular; pedir a digital antes de abrir o app ou de ações sensíveis fica para depois.

- **Imagem dos times no "Confirmar e compartilhar"** (E4.7, pergunta 71): uma imagem com os times e as cores, gerada por `react-native-view-shot` (biblioteca nativa nova e APK novo). O piloto compartilha texto ("Laranja: Ana, João…").

- **Trocar jogador com quem está na fila** (E4.10, pergunta 79): no piloto a tela 23a troca só com o banco, como o motor (`substitutePlayer`; os times ficam congelados no `MatchStarted`, ADR 0029). "Entrar da fila" pede um evento novo que tire o jogador da fila e o ponha no time no meio da partida.
