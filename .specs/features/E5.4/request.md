# E5.4 · Builds EAS e envio para o teste interno da Play

## Pedido literal

Gabriel (26/11/2026):

> o que falta para enviarmos para a play store?

> eu ja tenho a conta da play store

Respostas do Gabriel às perguntas do orquestrador (`docs/estado/perguntas.md`, 242 a 244):

- 242. Tipo da conta da Play Console: **pessoal**. Vale o teste fechado com 12 testadores por 14 dias seguidos antes de pedir a produção.
- 243. Situação da conta: **verificada, app `com.sacou.app` ainda não criado no Console**.
- 244. Envio dos builds: **sempre à mão pelo Console**. O EAS gera o AAB; sem EAS Submit e sem conta de serviço do Google.

Resposta anterior que entra nesta tarefa (pergunta 89, 18/11/2026, linha 234 de `perguntas.md`): "sem domínio agora, EAS Update na E5.4 para poder trocar o endereço da API pelo ar e domínio próprio quando a E3.12 for aos jogadores".

## Critério do backlog

`docs/plano-mvp.md`, E5.4: "Instalável por convite. O AAB tem `targetSdkVersion` 36 ou mais (lacuna G8 da E6.2; como conferir em `docs/operacao/google-play.md`)". Dependência: acessos das lojas (a conta da Play existe, 243). TestFlight e iOS ficam fora: App Store só depois do piloto (resposta 58).

## Capturas

Nenhuma. A tarefa não tem tela.

Plano: [plan.md](plan.md).
