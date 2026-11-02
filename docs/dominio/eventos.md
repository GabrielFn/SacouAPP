# Eventos da quadra: envelope e função de estado

Contrato do log de eventos de uma `CourtSession` (E2.1, [ADR 0022](../arquitetura/adr/0022-event-envelope-replay.md)). Código em `packages/match-engine/src/event-log/`; casos em `packages/match-engine/golden/event-log.json`.

## Envelope

Esquema fechado: só estes campos, e qualquer outro é erro.

| Campo | Formato |
|---|---|
| `eventId`, `courtSessionId`, `deviceId` | UUID em minúsculas |
| `batch`, `sequence` | Inteiro de 1 a 2^53−1 |
| `schemaVersion` | Inteiro ≥ 1, de 1 a 2^53−1 no parser; só as versões suportadas passam no replay |
| `type` | Texto de 1 a 64 unidades UTF-16 |
| `payload` | Objeto JSON com até 32 níveis e 4096 valores, contando o próprio payload. As chaves ficam ordenadas por unidade UTF-16 na cópia |

Não entram no envelope: `rulesVersion` e a cópia congelada de configurações e formações, que vão no evento de início de partida (E2.2+); relógio; autoria; nome, apelido, e-mail, telefone, Pix, foto ou `userId`.

| Tema | Definição |
|---|---|
| `batch` | Número do lote de escrita no stream: um novo a cada troca ou retomada de quem escreve. Carimbado ao gravar e imutável: reenvio não muda (a E3.7 fixa quem emite). Não é a tentativa de envio |
| `sequence` | Cresce por celular no stream. Lacuna não é erro aqui (a E3.7 detecta o que falta) |
| Ordem canônica | `batch`, `sequence`, `deviceId`, `eventId`: números por valor, textos por unidade UTF-16 (`<` no TS; `string.CompareOrdinal` no C#), nunca `localeCompare` |
| Duplicata | Mesmo `eventId` e conteúdo igual, sem depender da ordem das chaves: ignora. Conteúdo diferente: `event-id-conflict` |
| Falha | Fechada: erro devolve `err`, sem estado parcial. Leva só `code` e `eventId` ou `field`, nunca o valor recebido |

Erro do parser é `invalid-envelope` com `field`: um campo do esquema; `envelope`, quando a entrada não é um objeto; ou `unknown-field`, quando há campo fora do esquema. O nome do campo desconhecido é dado recebido e não volta no erro. O campo desconhecido é conferido primeiro; depois, os campos na ordem da tabela.

## `RevertedTo`

Payload só com `{ targetEventId }`. O estado volta ao que era logo depois do alvo; nada sai do log e os eventos depois do alvo ficam inativos. Sem "refazer": nenhuma tela oferece.

O alvo tem de estar ativo, vir antes na ordem canônica e não ser `RevertedTo`. Sem isso, ou com payload malformado, o erro é `invalid-revert-target`.

- O `RevertedTo` não é listado em `activeEventIds`: a lista traz só os eventos cujo efeito está no estado.
- Não há como voltar ao estado inicial, porque o alvo é sempre um evento. Por isso **todo stream abre com um evento anterior a qualquer ponto**, para o desfazer do primeiro ponto funcionar. A E2.2 deve garantir isso.
- **Dois `RevertedTo` offline** podem deixar o log em `invalid-revert-target`: o que vier depois na ordem canônica pode apontar para um alvo que o outro já deixou inativo. Com falha fechada, isso impede recalcular o stream. O tratamento fica na E3.7 e na E4.9.

## `replayEvents`

Só aceita saída de `parseEventEnvelope`: é contrato, e o tipo sozinho não garante. Evento montado à mão com payload muito profundo pode lançar exceção.

1. Ordena uma cópia na ordem canônica.
2. Confere o log inteiro, inclusive eventos que ficariam inativos, nesta ordem de código e, dentro do código, na ordem canônica:
   1. `stream-mismatch`: outro `courtSessionId`.
   2. `event-id-conflict`: mesmo `eventId` com conteúdo diferente.
   3. `sequence-conflict`: mesmos `batch`, `sequence` e `deviceId` com outro `eventId`. O erro aponta o último dos dois na ordem canônica.
   4. `unsupported-schema-version`.
3. Dobra, na ordem canônica, parando na primeira falha: `unknown-event-type`, `event-rejected`, `invalid-revert-target`.

O resultado, inclusive o erro, não depende da ordem de chegada.

## Contrato para E2.2–E2.10

- Cada tarefa só registra aplicadores no `ReadonlyMap`, sem mexer no núcleo.
- Aplicador é puro, aplica o resultado gravado (sem recalcular regra) e não muta. Exceção dentro dele vira `event-rejected`.
- Estado só com valores JSON (sem `Map`, `Set`, `undefined`), comparável com o C#, e números inteiros.
- Conteúdo do payload: parser estrito por tipo, só IDs (`MemberId`), a cargo de cada tarefa. O esquema fechado desta tarefa cobre só o envelope.

## O que fica para depois

- **E3.7:** simular o replay **antes** de persistir e rejeitar ali, porque com falha fechada um evento inválido gravado impede recalcular o stream (o mesmo vale para o log local na E4.9). `courtSessionId` e permissão vêm do token, não do envelope. Tamanho do payload limitado no servidor. Quem numera o lote e a regra de um celular por vez.
- **E4.9:** gerar o `deviceId` como UUID aleatório por instalação, nunca IMEI, Android ID, `identifierForVendor` ou token de push. Medir o custo do replay em celular real: não há cache.
- **E4.11:** o que mostrar quando um evento atrasado reordena o passado. O estado no celular pode mudar ao sincronizar; é esperado pelo modelo.
- **E2.7:** "3 pontos serão apagados" (`Corrigir`) é texto para o usuário; no log nada se apaga.
- **Dois escritores offline no mesmo lote:** a ordem é determinística, por `deviceId`, mas pode intercalar pontos. Não é erro no motor, para não travar o jogo. Se a retomada do admin offline gerar placar estranho, é pergunta ao Gabriel na E3.7.
