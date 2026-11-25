# Denúncias de conteúdo (E6.6)

Qualquer membro denuncia, dentro do app, o apelido de outro membro (folha 19c, "Denunciar") ou o nome e o local do grupo (fim da tela 18, "Denunciar grupo"), com um de 4 motivos fechados. É o que a política de conteúdo gerado por usuário da Google Play pede ([google-play.md](google-play.md)). A denúncia fica em `groups.content_reports`, **só com IDs**: quem denunciou, quem foi denunciado (nulo para o grupo), o motivo e a data. Ninguém no app lê essa tabela. Regras e dados: [grupos.md](../dominio/grupos.md) (permissão `ReportContent`) e [dados-pessoais.md](../seguranca/dados-pessoais.md) ("Denúncia de conteúdo").

## Prazos (pergunta 234)

- **Responder em até 7 dias** depois da denúncia.
- A linha fica **180 dias** e é apagada pela varredura diária (a rota interna das notificações, ADR 0069, passo `report-cleanup`). A exclusão da conta apaga na hora as denúncias feitas por e sobre a pessoa.

## Aviso por e-mail (passo do Gabriel, uma vez por projeto)

A API escreve a linha de log `Content report received.` (nível Warning, sem nenhum ID) a cada denúncia nova; a repetida não escreve. No console do Google Cloud, projeto `sacou-api`:

1. Logging → Explorador de registros, com a consulta:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="sacou-api"
   textPayload:"Content report received."
   ```
   (se a linha vier em JSON, troque `textPayload` por `jsonPayload.message`).
2. **Ações → Criar alerta de registro**. Nome `sacou-denuncia-recebida`; intervalo mínimo entre avisos de 1 hora; canal de notificação por e-mail (o mesmo do alerta de backup). Salvar.
3. Repita com `sacou-api-test` se quiser o aviso também no ambiente de teste.

Sem custo: o alerta de registro é gratuito nesse volume.

## Ler as denúncias (Neon, SQL Editor, banco `sacou`, projeto `sacou-prod`)

As denúncias dos últimos 7 dias, agrupadas por grupo e alvo. O apelido e o nome do grupo aparecem **só na tela do console**; não copie o resultado para fora (e-mail, chat, issue):

```sql
SELECT r.group_id,
       g.name                 AS grupo,
       r.reported_member_id,
       p.nickname             AS apelido_denunciado,
       r.reason,
       count(*)               AS denuncias,
       count(DISTINCT r.reporter_member_id) AS quem_denunciou,
       max(r.created_at)      AS ultima
FROM groups.content_reports r
JOIN groups.groups g ON g.id = r.group_id
LEFT JOIN groups.members m ON m.id = r.reported_member_id
LEFT JOIN identity.player_profiles p ON p.user_id = m.user_id
WHERE r.created_at > now() - interval '7 days'
GROUP BY r.group_id, g.name, r.reported_member_id, p.nickname, r.reason
ORDER BY ultima DESC;
```

Um convidado sem conta não tem perfil: o nome dele está em `groups.guests` (`LEFT JOIN groups.guests gu ON gu.member_id = r.reported_member_id`, coluna `gu.name`). Uma denúncia do grupo tem `reported_member_id` nulo: o local está na configuração do grupo (`groups.group_settings.settings`).

## Agir

Conforme os Termos de Uso (seção 5, regras de convivência, e seção 9, suspensão e remoção de conteúdo):

1. **Pedir ao Admin do grupo** que remova a pessoa ("Remover do grupo" na folha 19c) ou troque o nome do grupo. É a ação imediata dentro do grupo.
2. **Trocar o texto ofensivo por SQL**, quando o Admin não age ou é o autor: o apelido em `identity.player_profiles.nickname`, o nome do convidado em `groups.guests.name`, o nome do grupo em `groups.groups.name`, sempre por um texto neutro que siga a regra do nome (por exemplo, `Jogador`), numa transação, conferindo antes o `WHERE` pelo ID. Avise a pessoa, se houver como.
3. **Remover a conta** em caso grave ou de reincidência, pelo mesmo caminho da exclusão (ADR 0056).

Não responda a quem denunciou nem diga ao denunciado quem foi: o app não tem esse canal no piloto e a tabela é só para moderação.
