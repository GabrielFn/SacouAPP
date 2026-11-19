# ADR 0070 · Página web da rodada: código do link, entrada como avulso e canal

**Status:** aceito (19/11/2026), E3.12 Parte 1 (API). **Decidido por:** desenvolvedor, dentro da arquitetura aprovada, com os padrões das perguntas 126, 127 e 130 adotados pelo analista ([plano](../../estado/tarefas/E3.12.md)) enquanto o Gabriel não responde. As Partes 2 (página `/r/{code}`, login web, cabeçalhos, limite por IP) e 3 (texto do compartilhar no app, `/c`) completam este ADR.

## Contexto

O admin publica a rodada no app e o texto do WhatsApp leva um link; quem toca vê a prévia, abre a página e confirma sem instalar o app (`produto.md:115`, `decisoes.md:7`). O robô do WhatsApp não executa JS nem envia o fragmento (`#`), então a página precisa saber pelo **caminho** qual é a rodada. O convite (ADR 0040, D10) leva o token no fragmento e guarda só o hash; o link da rodada não pode fazer o mesmo.

## Decisões

**D1 · Código do link.** `{RoundPage:PublicBaseUrl}/r/{code}`. O código tem 16 bytes de `RandomNumberGenerator` (128 bits) em Base64url sem preenchimento (22 caracteres), gerado fora do domínio (`IRoundLinkCodeGenerator`, injetado) e sem relação com o `RoundId` (UUID v7 revela o instante). Value object `RoundLinkCode` (`TryParse` puro; `ToString` não mostra o valor). Guardado **em claro** em `sessions.rounds.link_code` (`character(22)`, anulável, índice único parcial `ux_rounds_link_code`, `CHECK` do formato).

- **Por que em claro, e não o hash do convite:** o admin precisa compartilhar de novo a qualquer momento, e o código já vai para o log de requisição do Cloud Run pelo caminho; o hash não protegeria nada que o log não exponha. O código é **capacidade de leitura do resumo público e de entrada como avulso antes do início**, não um segredo de longa vida: morre com a rodada (responder e entrar só até `StartsAt`).
- **Quando nasce:** na criação da rodada e na materialização da série, pelo `RoundLinkCodes`. Colisão no índice único: um novo sorteio; duas seguidas são um gerador quebrado (500). A migração `AddRoundLinkAndChannel` é de expansão (ADR 0068, D7): rodadas antigas ficam sem código até a **primeira leitura de detalhe por quem tem `ManageRounds`**, que grava um com `UPDATE ... WHERE link_code IS NULL` (dois primeiros acessos juntos ficam com o código do primeiro). Sem `pgcrypto`. O `NOT NULL` fica para uma migração de contração depois que todas as rodadas futuras tiverem código.
- **Sem enumeração:** código fora do formato dá `sessions.round-link-invalid` (404) **sem consulta**; código bem formado que não acha rodada dá o mesmo corpo. A busca é pelo índice único.
- **Quem recebe o link:** `RoundResponse.shareUrl`, URL absoluta montada pela API, **só para quem tem `ManageRounds`** (Admin e Co-admin), porque o link põe gente no grupo e convidar é deles (pergunta 130); `null` para os demais. Criar, ler, editar e cancelar devolvem o campo. A API monta a URL, e não o app: trocar o `run.app` pelo domínio é mudar a configuração da API.
- **`RoundPage:PublicBaseUrl`:** obrigatório fora de `Development`; só origem `https` (sem caminho, query, fragmento nem usuário), conferido na partida (`ValidateOnStart`), mensagem com a chave e nunca o valor. Vazio em `Development` esconde o `shareUrl`. No deploy, a ação `deploy-cloud-run` lê a URL `*.run.app` do próprio serviço (`gcloud run services describe`) e a põe em `RoundPage__PublicBaseUrl`; a entrada opcional `public-base-url` troca pelo domínio quando ele existir (pergunta 125).

**D2 · Entrada como avulso (pergunta 127, padrão adotado).** O link também põe no grupo quem ainda não é membro, como `Player` e `DropIn`, com as regras do aceite do convite: removido recebe 403 `groups.member-removed`; quem saiu volta com o mesmo `MemberId`, como `Player` e `DropIn`; tetos de 300 membros e 100 grupos por pessoa (409); membro ativo fica como está (mensalista continua mensalista). Só com a rodada não cancelada e **antes de `StartsAt`** (no instante do início já fechou): senão `sessions.round-closed` e ninguém entra.

- **Domínio:** `Group.JoinAsDropIn(person, personActiveGroups, now)` e `Group.Accept` usam o mesmo método privado `Join`; o aceite só acrescenta a conferência do convite e o `use_count`.
- **Contrato:** `Groups.Contracts.IGroupJoining.JoinAsDropInAsync(groupId, userId)` → `JoinedMember(MemberId, Joined)`, numa transação própria e comitada com as travas do aceite (`FOR UPDATE` no grupo, trava da pessoa da família 3202, conferência da conta no Identity em outra conexão, ADR 0056 D7a). Log só com o resultado (`joined`, `already-member` ou o código do erro).
- **Ordem, sem duas travas juntas** (tabela de ordem do ADR 0040): (1) o código e a rodada aberta, sem trava; (2) o grupo, na transação do Groups; (3) a resposta sob a trava da rodada, pelo mesmo `RoundWriter` do VOU do app, que pergunta de novo ao Groups e confere de novo que a rodada está aberta pelo relógio lido sob a trava. Se o passo 3 recusar (janela dos avulsos, cheia sem espera, começou no meio), a pessoa **fica no grupo**, e o `ProblemDetails` traz a extensão `joined` (`true` se entrou agora, `false` se já era membro). Recusas antes do passo 2 não trazem `joined`.
- **Resumo público para a Parte 2:** `Sessions.Contracts.IPublicRoundSummary.FindByCodeAsync(code)` → `PublicRoundSummary` com nome do grupo (novo contrato só de leitura `Groups.Contracts.IGroupDirectory.FindNameAsync`), data e hora locais, fuso, início, local, estado (`Open`, `Full`, `Started`, `Canceled`), vagas, confirmados, espera, se há espera e jogadores por time. O tipo não tem nenhum campo de membro. Sem trava e sem reparo; as contagens são as das listas gravadas.

**D3 · Rotas e canal.**

| Rota | Quem | Faz | Limite |
|---|---|---|---|
| `POST /v1/round-links/resolve` `{ code }` | logado e registrado | 200 `{ groupId, roundId, isMember }`; nada de nomes nem contagens | `round-link` |
| `POST /v1/round-links/attendance` `{ code, response }` | logado e registrado | entra como avulso se preciso e responde; 200 `{ groupId, roundId, memberId, joined, status, position }` | `round-link` e as vagas de duas conexões |

- O código vai **no corpo**, nunca na rota da API. Corpos fechados (campo a mais, como `memberId` ou `groupId`, é 400; ADR 0039), até 1 KB, `application/json` (outro tipo é 415), `Cache-Control: no-store`. Sem `POST /v1/me` antes: 403 `identity.user-not-registered`.
- Sempre 200 no sucesso (também para quem entrou agora; `joined` diz): a página da Parte 2 trata um formato só.
- As duas rotas entram na lista fechada do teste de guarda (rotas sem `{groupId}`, ADR 0040 D4) e na tabela método + rota → política (ADR 0062, item 4). A política `round-link` (30 / 60 s por usuário, `RateLimiting:RoundLink`) entra em `DualConnection`: o mesmo portão de concorrência do aceite e da criação de grupo, porque a entrada no grupo segura duas conexões (ADR 0062, item 5). As duas rotas dividem o balde.
- **Canal (para a E7.2):** `sessions.attendances.channel`, texto com `CHECK` (`app`, `web`), padrão `app` para as linhas antigas. Muda só numa resposta que muda a linha, a mesma regra da `Sequence`: VOU repetido não muda nada; promoção da espera e limpeza do reconcile mantêm o canal; a pré-confirmação dos mensalistas é `app`. Não é dado pessoal e não entra em evento (`AttendanceChanged` segue só com IDs).
- **Logs:** a resposta pelo link registra só o resultado e o `roundId`; nunca código, pessoa, nome do grupo ou IP.

## Alternativas descartadas

- **Código no fragmento, como o convite:** o robô do WhatsApp não vê o fragmento, e a prévia (critério de aceite) some.
- **Guardar só o hash:** o admin não conseguiria compartilhar de novo, e o caminho já está no log.
- **Gerar o código das rodadas antigas na migração com `gen_random_bytes`:** dependeria do `pgcrypto` no Neon; a leitura que repara resolve sem extensão.
- **201 quando entra no grupo, como o aceite:** dois formatos de sucesso para a página tratar, sem ganho.
- **Recusar a resposta e desfazer a entrada no grupo:** pediria as duas travas juntas ou uma compensação; a pessoa ficar no grupo é o que o produto quer (pergunta 127).

## Consequências e riscos

- **Código no log do Cloud Run** (caminho, 30 dias, só a conta do Gabriel lê): quem vê o log entra como avulso até o início da rodada. Mesmo alcance de quem está no grupo do WhatsApp; o admin remove, e o removido não volta.
- **Link encaminhado para fora do racha** põe gente no grupo como avulso: a mesma exposição do convite sem expiração, mais curta (morre no início). O admin vê quem entrou e remove (tela 19).
- **Rodada antiga sem código:** até um admin abrir o detalhe, o link dela não existe. Rodadas futuras do piloto nascem com código.
- **Deploy:** a ação lê a URL do serviço antes de aplicar o YAML; um serviço novo (que ainda não existe) precisaria da entrada `public-base-url` no primeiro deploy.
