# Notificações

Regras do módulo `Notifications` ([ADR 0069](../arquitetura/adr/0069-outbox-e-notificacoes.md); tarefa E3.11). Telas: 28 (`design/mvp/Notificacoes.dc.html`) e o sino do Início.

## Tipos

| Tipo | Quando nasce | Para quem |
|---|---|---|
| `waitlistPromoted` | A pessoa sai da espera e ganha a vaga, por qualquer escrita da rodada (resposta própria, do admin, pelo link, aumento de vagas, reparo da leitura, saída de alguém do grupo) | O membro promovido, se for membro ativo com conta |

Só esse tipo no piloto (pergunta 113). "Lista abriu", "times sorteados", "votação do MVP" e "MVP do dia" entram com as tarefas que os criam.

## Chega uma vez

- Cada promoção tem a chave `sessions.waitlist-promoted:{roundId}:{memberId}:{sequence}`. Repetir a mesma requisição não cria nada; sair da espera, dizer "não vou", voltar e sair da espera de novo é outra sequência, então outra notificação.
- Uma notificação por chave e uma entrega por aparelho ativo da conta, criadas juntas só na primeira vez.
- Convidado sem conta, ex-membro e conta excluída não recebem nada. Conta sem aparelho recebe a notificação na lista, sem push.
- Resposta ambígua do serviço de push (tempo esgotado depois de enviar) nunca repete: a notificação continua na lista.
- O push expira no início da rodada: depois disso não vai.

## Estados de uma entrega

`pending` → `sending` → `sent` → `delivered`; `sending` volta a `pending` só com resposta que diz com certeza que não foi aceito (até 5 tentativas, com espera de 30 s, 2 min, 10 min e 30 min). Finais: `delivered`, `failed`, `unknown`, `expired`. `sent` nunca volta à fila.

## Textos (pt-BR, `NotificationTexts.cs`)

- **Push (tela de bloqueio):** título "Você saiu da espera"; corpo "Entrou no {grupo} · {dia} {hora}", por exemplo "Entrou no Areia · sáb 8h" e "Entrou no Vôlei de quinta · qui 19h30". **Sem o local** e sem nome de ninguém (pergunta 112).
- **Lista (tela 28):** título "Você saiu da espera: entrou no {grupo} de {dia por extenso}"; subtítulo "{Dia} {hora} · {local}" ("Sáb 8h · Posto 6"; sem local, só "Sáb 8h").
- Dia e hora são os **locais** gravados na rodada, sem conversão. Hora: "8h", "19h30", "0h". Os textos são montados na hora (envio ou leitura), a partir dos ids: grupo renomeado aparece com o nome novo. Grupo que não existe mais aparece como "seu grupo".

## Aparelhos

- Um aparelho é uma instalação do app numa conta, com um `installationId` próprio do push (nunca o `deviceId` da quadra).
- No máximo 5 aparelhos ativos por conta; o sexto desliga o visto há mais tempo.
- O mesmo token só fica numa conta: registrar em outra conta (celular emprestado, outro login) tira da anterior, com as entregas pendentes dela.
- Aparelho que o serviço de push diz não conhecer mais é desligado.

## Lista

- 20 por página, da mais nova para a mais antiga, com o total de não lidas para o ponto do sino.
- "Marcar como lidas" marca todas; tocar uma marca só ela. Notificação de outra pessoa responde igual à inexistente.

## Códigos de erro

| Código | Quando |
|---|---|
| `notifications.token-invalid` | Token ausente ou fora do formato, ou plataforma ausente |
| `notifications.installation-invalid` | `installationId` vazio |
| `notifications.cursor-invalid` | Cursor que a lista não deu |
| `notifications.notification-not-found` | Notificação inexistente ou de outra pessoa |

## Retenção

Na exclusão da conta, os aparelhos e as notificações da pessoa são apagados. A limpeza periódica (entregas encerradas com mais de 7 dias, notificações com mais de 30 dias, outbox processado com mais de 7 dias) entra na Parte 2 da E3.11.
