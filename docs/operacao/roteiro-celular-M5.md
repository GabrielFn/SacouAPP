# Roteiro de testes no celular do M5

Roteiro da rodada de cabo do fim do M5 (pedido do Gabriel: um roteiro detalhado por tarefa, para não esquecer nada). Quem executa é o orquestrador, dirigindo o celular pelo `adb`, junto com o Gabriel. Cada passo tem uma **ação** concreta e um **esperado** que se confere na tela (texto exato, elemento presente ou ausente, número). O que os planos não decidem está marcado **(a confirmar)**: não é defeito se diferir, é só anotar.

Fontes: planos `docs/estado/tarefas/E3.9.md`, `E3.11.md`, `E3.12.md`, `E3.18.md`, `E4.12.md`, `E4.13.md`, `E4.18.md`; ADR 0070; respostas de 19/11/2026 em `docs/estado/perguntas.md` (todas pela recomendação, menos a **125**, piloto inteiro no `run.app`, e a **126**, apelidos na página da rodada para todos, convidado sem conta só pelo primeiro nome). Preparo do cabo em [`teste-no-celular.md`](teste-no-celular.md).

## 1. Preparo comum

### 1.1 Ambiente

```sh
export PATH="/d/tools/dotnet:$PATH" NUGET_PACKAGES=/d/tools/nuget-packages TEMP=/d/tmp TMP=/d/tmp
pnpm --filter @sacou/volley-rules --filter @sacou/match-engine run build   # o app lê o dist/ dos pacotes
CI=1 EXPO_PUBLIC_API_URL=https://sacou-api-test-804880427435.us-east4.run.app \
  EXPO_PUBLIC_INVITE_BASE_URL=https://sacou-api-test-804880427435.us-east4.run.app \
  pnpm --filter @sacou/mobile start
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "sacou://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

- **APK:** build de desenvolvimento com as dependências nativas novas do marco: `react-native-view-shot` e `expo-media-library` (E4.13 Parte 2), `expo-notifications` (E3.11 Parte 3). Sem elas, as seções 4 e 6 não rodam.
- **Celular:** Galaxy de 780 × 360 dp; a quadra (09, 11, 23) fica em paisagem, o resto do app em retrato. Anotar o modelo e a versão do Android.
- **Comandos do `adb` usados nos passos:**
  - tela: `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml` (textos e `content-desc`), `adb exec-out screencap -p > shot.png`;
  - **alvo de toque ≥ 44 dp:** altura e largura do `bounds` em px ≥ 44 × densidade / 160 (`adb shell wm density`; com 480, **132 px**);
  - **fonte no máximo:** `adb shell settings put system font_scale 2.0` (voltar com `1.0`);
  - **sem rede:** `adb shell cmd connectivity airplane-mode enable` (ou `svc wifi disable; svc data disable`); voltar com `disable`;
  - **paisagem/retrato:** `adb shell settings put system accelerometer_rotation 0` e `user_rotation 1` (paisagem) ou `0` (retrato);
  - **abrir link no Chrome:** `adb shell am start -a android.intent.action.VIEW -d "<url>" com.android.chrome`;
  - **notificações:** `adb shell dumpsys notification --noredact` (filtrar pelo pacote do app).
- **Busca de privacidade** (usada em vários passos, "varredura P"): no `ui.xml`, nenhuma ocorrência (sem diferenciar maiúsculas) de `nota`, `nível`, `rating`, `Bronze`, `Prata`, `Ouro`, `Elite`, `votos`, `votaram`, `votantes`, nem de UUID (`[0-9a-f]{8}-[0-9a-f]{4}-`).

### 1.2 Contas

- **Conta 1 (Gabriel, admin):** dona dos grupos; apelido "Gabriel".
- **Conta 2 (segunda conta Google):** começa **fora** de todos os grupos; entra pelo link da rodada (seção 2) com o apelido **"Beto"** e faz o jogador e o eleitor.
- As duas contas adicionadas no Android (Configurações > Contas), para aparecerem no seletor do Google do app e do Chrome.
- PC: um perfil do Chrome logado na página com a conta 1 (é por ele que o Gabriel diz NÃO VOU na seção 6).

### 1.3 Massa de dados

Montada no app com a conta 1 antes da seção 2 (cerca de 45 min, com as partidas). O sobrenome **"Zeta"** é marcador: nunca pode aparecer na página web.

| Item | Como |
|---|---|
| **G1 "Racha Teste"** | quadra 6x6, "quem perde sai", MVP do dia ligado, "Pelos dados do placar" ligado, votação ligada (tela 18). Convidados (21a): Ana Zeta, Bruno Zeta, Caio Zeta, Davi Zeta, Edu Zeta, Fábio Zeta, Gui Zeta, Hugo Zeta, Ivo Zeta, Júlia Zeta, **Maria Eduarda Zeta** (nome longo). Vagas de avulso já abertas (opção da tela 20/18, **(a confirmar o nome)**) |
| **G2 "Areia Teste"** | areia 2x2, mesmas opções de MVP. Convidados: Lia Zeta, Léo Zeta, Nina Zeta, Otto Zeta, Pia Zeta, Rui Zeta |
| **G3 "Descartável"** | quadra; só para o teste de removido (o removido não volta pelo link) |
| **RL** (G1) | começa em ~60 min, 12 vagas, espera ligada; confirmados Gabriel + 11 convidados (12/12, lotada) |
| **RQ** (G1) | começa em ~75 min, 12 vagas; confirmados Gabriel + Ana a Hugo (9/12) |
| **R5** (G1) | começa em ~80 min; Gabriel + 11 convidados (Beto **não**) |
| **RA** (G2) | começa **depois** da RQ (a ordem importa para a sequência entre rodadas); Gabriel, Beto (depois do convite da seção 2) e os 6 convidados |
| **RC** (G1) | criada e cancelada |
| **RX** (G3) | futura, com vagas |
| **RP** (G1) | amanhã, 12 vagas, espera ligada, Gabriel + 11 convidados (12/12); usada na seção 6 |

**Partidas** (jogadas depois do horário de início de cada rodada, com toques em laço pelo `adb`; os times montados à mão na 07, **(a confirmar o fluxo)**):

| Rodada | Times | Partidas (placar final) |
|---|---|---|
| RQ | A: Gabriel, Ana, Bruno, Caio, Davi, Edu · B: Beto, Fábio, Gui, Hugo, Ivo, Maria Eduarda | M1 A 25–20 · M2 A 25–23 · M3 B 25–15 · M4 **aberta** em 3 × 2 (encerrar pelo menu, seção 3) |
| R5 | A: Gabriel, Ana, Bruno, Caio, Davi, Edu · B: Fábio, Gui, Hugo, Ivo, Júlia, Maria Eduarda | M1 A 25–23 (com rede) · M2 B 25–20 (**sem rede**, seção 3) |
| RA | D1 Gabriel e Beto · D2 Lia e Léo · D3 Nina e Otto · D4 Pia e Rui | M1 D1×D2 D1 · M2 D1×D3 D1 · M3 D1×D4 D4 · M4 D4×D2 D4, cada uma vencida por 2 pontos. Se a fila montar outros confrontos, manter o saldo por dupla: D4 2-0, D1 2-1, D3 0-1, D2 0-2 |

**Números esperados** (derivados à mão das partidas acima; regras da E3.9, 3.2 a 3.7):

| Onde | Esperado |
|---|---|
| Resumo da RQ | "· 3 partidas"; MVP pelos dados: um jogador do lado B, "+3 de saldo · 1 vitória em 3" (os 6 do B empatam; o desempate é a primeira aparição, **(a confirmar quem)**); "Time que mais venceu" lado A, 2 vitórias; "Maior sequência" lado A, 2 seguidas |
| Resumo da R5 | "· 2 partidas"; MVP lado B, "+3 de saldo · 1 vitória em 2"; os dois cartões de time **somem** (empate 1 × 1) |
| Resumo da RA (12b) | "· 4 partidas · duplas"; MVP "Pia e Rui · 2 vitórias · ficaram 2 seguidas na quadra"; ranking 1. Pia e Rui 2-0 · 2. Gabriel e Beto 2-1 · 3. Nina e Otto 0-1 · 4. Lia e Léo 0-2 |
| Eu (Gabriel) | 8 partidas · 63% vitórias (5 de 8 = 62,5, meio para cima) · saldo −4 · maior seq. 2 · 0 vezes MVP · 3 rodadas · presença 100% |
| Eu (Beto) | 6 partidas · 50% · saldo +5 · maior seq. **3** (atravessa a RQ e a RA) · rodadas 2 · presença 67% (G1 1 de 2, G2 1 de 1) · vezes MVP 1 depois do fechamento da votação da RQ (antes, 0 ou 1 conforme o desempate da RQ) |

### 1.4 Calendário

- **Dia D:** preparo, seções 2 a 5 (até o voto).
- **D+1** (mais de 24 h depois do "Encerrar rodada" da RQ e antes de 30 h depois do início da R5): resultado da votação (seção 5, bloco D+1) e o "Ver resumo" do Início sumindo.
- **Seção 6 (E3.11)** em qualquer dia depois da Parte 2 e das contas do Gabriel.

## 2. E3.12 · Página da rodada `/r/{code}`, login web, VOU e convite `/c`

**Antes:** E3.12 Partes 1 a 3 na `main` (feitas) e no `sacou-api-test`; app Web registrado no Firebase com o host `run.app` do teste nos domínios autorizados e a chave Web restrita por referenciador (plano, seção 6); `EXPO_PUBLIC_INVITE_BASE_URL` no Metro (1.1). Conta 2 fora de G1, G2 e G3.

| # | Ação | Esperado |
|---|---|---|
| 1 | App (conta 1): tela 20 da RQ → "Publicar e compartilhar no WhatsApp" → WhatsApp → "Você" (conversa consigo) | Texto "Racha Teste · {dia}, {d/m} · {hora} · {local} · 12 vagas. Confirma aqui: https://sacou-api-test-804880427435.us-east4.run.app/r/" + 22 caracteres Base64url |
| 2 | Esperar a prévia na conversa | Título "Racha Teste"; descrição "{Dia}, {d/m} · {hora} · {local} · 9/12 confirmados"; imagem da marca. **Sem** nenhum apelido nem "Zeta" |
| 3 | Copiar o link (dump do texto) e, no PC: `curl -s <link>` e `curl -sI <link>` | HTML sem UUID, sem "Zeta", sem "Eduarda". Cabeçalhos: `Content-Security-Policy` sem `unsafe-inline`; `Referrer-Policy: strict-origin`; `X-Robots-Tag: noindex, nofollow`; `X-Frame-Options: DENY`; `Cache-Control: no-store`; **nenhum** `Set-Cookie` |
| 4 | Abrir o link no Chrome do celular, deslogado | Tela 01: "Racha Teste", data e hora locais, local, "6x6 · 25 pts · quem perde sai", "9/12", grade com 9 vagas cheias e 3 abertas, "Faltam 3. Chama o pessoal!", VOU e NÃO VOU. Lista com "Gabriel" e "Ana", "Bruno" ... "Hugo" (só o primeiro nome dos convidados, resposta 126) |
| 5 | Varredura P no dump do Chrome | Nada. Nenhum "Zeta", nenhuma posição, nenhum valor em reais |
| 6 | Tocar VOU | Folha da tela 02 com Google e e-mail; **sem** "Entrar com Apple" (resposta 128); frase "Seu apelido aparece na lista da rodada para quem tem o link" |
| 7 | Google → conta 2 | Passo do apelido: um campo pré-preenchido com o primeiro nome do Google, editável (resposta 129) |
| 8 | Trocar para "Beto" e confirmar | "Você vai"; contagem 10/12; "Beto" na lista dos avulsos |
| 9 | App (conta 1): tela 06 da RQ | Beto confirmado como avulso; tela 19 de G1 mostra Beto como Jogador avulso |
| 10 | Chrome: recarregar a página | Continua logado (sem folha), cartão "Você vai" e botão "NÃO VOU MAIS" |
| 11 | Abrir o link da RL (lotada) no Chrome, VOU | "Na espera, 1º" (o Beto já é membro de G1) |
| 12 | App: na RL, marcar Júlia como "não vai"; Chrome: recarregar | "Você vai" (a espera andou) |
| 13 | App: adicionar Júlia de novo à RL (vai para a espera, **(a confirmar)**); Chrome: "NÃO VOU MAIS" | Página volta a VOU/NÃO VOU; no app, Júlia passa a "vai" |
| 14 | App: tela 19d de G2 → copiar o convite; abrir no Chrome (conta 2) | Link `https://sacou-api-test-…run.app/c#` + 43 caracteres; depois de abrir, a barra **sem** o `#…`; "Areia Teste · N membros" e "ENTRAR NO GRUPO" |
| 15 | "ENTRAR NO GRUPO" | "Você entrou. Baixe o app para ver as rodadas." Abrir o mesmo link de novo: "Você já está nesse grupo" |
| 16 | Abrir `/c#` com o token trocado em um caractere; depois `/c#abc` | "Link inválido ou desativado." nos dois |
| 17 | Abrir `/r/AAAAAAAAAAAAAAAAAAAAAA` e `/r/abc` | A mesma página de link inválido nos dois, sem repetir o código |
| 18 | Abrir o link da RC (cancelada) | "Rodada cancelada", sem VOU |
| 19 | G3: conta 2 entra pelo link da RX (VOU); conta 1 remove o Beto (19c "Remover"); Chrome recarrega e toca VOU | "Você não pode mais entrar nesse grupo pelo link." |
| 20 | Chrome em modo avião, tocar VOU numa rodada aberta | Mensagem de falha de conexão, sem quebrar a página (texto **(a confirmar)**; o plano cita "Sem conexão com o Sacou agora" para 503) |
| 21 | Abrir o link no navegador embutido do WhatsApp (se o WhatsApp abrir por dentro) | Folha sem Google, com "Abra no navegador" e o e-mail disponível. Se o WhatsApp abrir o Chrome direto, anotar "não se aplica" |
| 22 | Fonte no máximo, Chrome, página da RQ, em retrato e em paisagem | Nada cortado; VOU, NÃO VOU e a folha com alvos ≥ 44 dp |
| 23 | Depois do início da RL: abrir o link dela | "Essa rodada já começou", só leitura, sem VOU |
| 24 | PC: 61 `curl` seguidos à página em menos de 60 s; no mesmo minuto, o celular em dados móveis (Wi-Fi desligado) abre a página | PC recebe 429 com `Retry-After`; o celular abre normal (o último `X-Forwarded-For` é o do cliente: pendência da E5.1/ADR 0070 D6) |

**Fora do celular:** concorrência de 16 pessoas na última vaga, tetos de 300 e 100, corpo com campo a mais, 415, CSP exata e XSS (testes de integração e Vitest da E3.12, casos 16 a 31); iPhone (Safari) só se houver um à mão.

**Tempo:** 35 min.

## 3. E3.9 + E4.12 · Estatísticas no servidor e tela 12 (resumo), "Encerrar rodada", "Mandar pro grupo"

**Antes:** E3.9 Partes 1 a 4b (feitas), E3.18 Parte 1 (rota `close`), E4.12 Partes 1 e 2 na `main`; massa 1.3 com a RQ jogada até a M4 aberta (3 × 2) e a R5 só com a M1.

| # | Ação | Esperado |
|---|---|---|
| 1 | Tela 06 da RL (começou, sem partida) → linha "Resumo da rodada" | Tela 12 "Nenhuma partida terminou nesta rodada."; sem cartões e sem "Mandar pro grupo" |
| 2 | Tela 06 da RC (cancelada) | Sem a linha "Resumo da rodada" |
| 3 | Quadra da RQ em paisagem, M4 em 3 × 2 → Menu (23) | Item "Encerrar rodada · fecha a noite toda" em vermelho, alvo ≥ 44 dp, fora da barra de navegação |
| 4 | Tocar o item | Diálogo "A partida em andamento (3 × 2) não entra no resumo. Encerrar a rodada?" |
| 5 | Cancelar; depois repetir e confirmar | Cancelar volta à quadra com o placar intacto; confirmar abre a tela 12 (retrato) |
| 6 | Conferir a 12 da RQ | "Voltar" + "Racha Teste · 3 partidas"; "Resumo da rodada"; cartão escuro "MVP do dia" com um nome do lado B, "{cor do lado B} · +3 de saldo · 1 vitória em 3" e "Calculado pelo placar"; "Time que mais venceu · {cor A} · 2 vitórias"; "Maior sequência · {cor A} · 2 seguidas"; "Mandar pro grupo" |
| 7 | "Voltar" | Cai na tela 06 da RQ, **não** na quadra |
| 8 | Início | Card da RQ com "Ver resumo"; tocar abre a 12 |
| 9 | Fechar o app (`am force-stop`) e abrir | O Início **não** retoma a quadra da RQ |
| 10 | 12 da RQ → "Mandar pro grupo" → WhatsApp → "Você" | "Resumo do Racha Teste · 3 partidas. MVP do dia: {nome} (+3 de saldo, 1 vitória em 3). Time que mais venceu: {cor A}, 2 vitórias. Maior sequência: {cor A}, 2 seguidas." Sem link, sem nota, sem votação |
| 11 | Varredura P na 12 | Nada (sem rating, sem nota, sem nível) |
| 12 | R5: jogar a M2 em modo avião até o fim → tela 11 (paisagem) → link "Encerrar rodada" abaixo de "Confirmar" | Link sublinhado, alvo ≥ 44 dp; o toque abre a 12 mesmo sem rede |
| 13 | Ainda sem rede | "Sem internet. O resumo aparece quando o celular voltar a se conectar." + "Tentar de novo" |
| 14 | Ligar a rede, esperar o envio da quadra, "Tentar de novo" | "Racha Teste · 2 partidas"; MVP lado B, "+3 de saldo · 1 vitória em 2"; **sem** os dois cartões de time (empate). Se a 12 abrir antes do envio: "Ainda faltam N pontos para enviar. O resumo pode mudar." |
| 15 | Mandar pro grupo da R5 | Texto sem "Time que mais venceu" nem "Maior sequência" |
| 16 | Abrir a 12 da RQ, pôr em modo avião, fechar e abrir o app, voltar à 12 | Abre do cache com o aviso de dado antigo (faixa discreta) |
| 17 | Tela 18 de G1: desligar "MVP do dia"; abrir a 12 da RQ | Sem o cartão escuro; os cartões de time continuam (troca de opção recalcula). Religar depois |
| 18 | Fonte no máximo, 12 da RQ | Nome longo (se o MVP for "Maria Eduarda Zeta") quebra sem estourar o cartão; "Voltar", "Tentar de novo" e "Mandar pro grupo" ≥ 44 dp |
| 19 | Tela 30a (exportar meus dados) da conta 1 → salvar o arquivo → `adb pull` | Há seção `stats`; **nenhuma** chave `rating`, `mu`, `sigma`, `ordinal`, `level` (busca por chave inteira) |

**Fora do celular:** "correção recalcula tudo" com reconstrução do zero, rating OpenSkill, golden TS × C# do resumo e do rating, IDOR entre grupos e o `court-sync` (testes da E3.9, seções 5.1 a 5.4); ponto individual ignorado com a opção desligada. A rodada simulada da E2.9 (aceite da E4.12) está no golden; no celular vale a conta à mão da tabela 1.3.

**Tempo:** 30 min (mais as partidas da massa).

## 4. E4.13 · Tela 14 (Eu, cartinha e estatísticas) e tela 15 (compartilhar)

**Antes:** E4.13 Partes 1 e 2 na `main`; APK com `react-native-view-shot` e `expo-media-library`; RQ, R5 e RA jogadas e encerradas.

| # | Ação | Esperado |
|---|---|---|
| 1 | Conta 1, aba "Eu" | Título "Eu", engrenagem (≥ 44 dp) que abre a tela 30; cartinha compacta com as iniciais "GA" em círculo de cor fixa; "Os números vêm do placar."; "Compartilhar"; "Editar perfil"; "Todos os grupos · 2026" |
| 2 | Grade de 6 números | 8 partidas · 63% vitórias · −4 saldo · 2 maior seq. · 0 vezes MVP · 3 rodadas (rótulos como no desenho) |
| 3 | "Por grupo" | "Racha Teste" "5 partidas · 60% (3 vitórias)" com o chip da quadra; "Areia Teste" "3 partidas · 67% (2 vitórias)" com o chip da areia; nessa ordem |
| 4 | Varredura P na 14 | Nada; também sem "Bronze/Prata/Ouro/Elite" e sem número grande de nível na cartinha |
| 5 | "Compartilhar" | Tela 15: "Sua cartinha", cartinha inteira com "Temporada 2026", interruptor "Mostrar estatísticas" ligado, "WhatsApp", "Salvar", nota "A cartinha atualiza a cada rodada. Os números vêm do placar, não de notas dos amigos." Presença 100% |
| 6 | "WhatsApp" → folha do sistema → WhatsApp → "Você" | Imagem nítida, sem corte, sem nota, sem nome completo da conta Google |
| 7 | Desligar "Mostrar estatísticas" e compartilhar de novo | Imagem com avatar, apelido, posição, marca e "Temporada", **sem** os números; o `content-desc` da cartinha não cita números |
| 8 | Tocar "WhatsApp" duas vezes seguidas (dois `input tap`) | Uma folha só |
| 9 | "Salvar" pela primeira vez → recusar a permissão | Mensagem de permissão negada com atalho para os ajustes |
| 10 | "Salvar" de novo → permitir | Imagem na galeria (`adb shell ls /sdcard/Pictures` ou `DCIM`, **(a confirmar a pasta)**) |
| 11 | Abrir a folha de compartilhar e apertar o voltar do Android | Volta à 15 sem erro, botões ativos |
| 12 | Sair e voltar à 15: interruptor | Ligado de novo (não é guardado) |
| 13 | Fonte no máximo e retrato: 14 e 15 | Apelido e números cabem nas células, sem cortar dígito; alvos ≥ 44 dp; nada sob a barra de status |
| 14 | Modo avião, fechar e abrir o app, aba "Eu" | Números do cache com a faixa "Sem conexão"; "Compartilhar" funciona (imagem local) |
| 15 | Sair; entrar com a conta 2; aba "Eu" | **Nenhum** número da conta 1 em nenhum momento. Beto: 6 partidas · 50% · +5 · 3 maior seq. · 2 rodadas; cartinha com presença 67% |
| 16 | Conta nova sem partidas (se houver) ou conta 2 antes da RQ | "Seus números aparecem depois da primeira partida." com zeros e "—" (nunca "NaN%") |

**Fora do celular:** arredondamentos de borda (1 de 8, 0 partidas), virada do ano no fuso de São Paulo, unificação das iniciais e o PNG temporário apagado (testes da E4.13, seção 3).

**Tempo:** 20 min.

## 5. E3.18 + E4.18 · Votação do MVP (tela 12a) e resumo da areia (tela 12b)

**Antes:** E3.18 Partes 1 e 2, E4.18 Partes 1 e 2 na `main`; RQ encerrada pelo menu (seção 3, passo 5) **há menos de 23 h**; RA encerrada pela tela 11; votação ligada em G1 e G2.

**Dia D**

| # | Ação | Esperado |
|---|---|---|
| 1 | Conta 1, 12 da RQ | Cartão do MVP pelos dados com "Votação da galera aberta"; botão "Votar no MVP · fecha em 23 h" |
| 2 | Tocar o botão | 12a: "Voltar" + "Racha Teste · 3 partidas"; "Quem foi o MVP?"; cadeado + "Voto secreto · fecha em 23 h"; 11 candidatos, **sem** o Gabriel; os 6 do lado B ("{cor B} · 3 partidas · +3") antes dos 5 do A ("{cor A} · 3 partidas · −3") |
| 3 | Conferir o rodapé e a nota | Nada selecionado; botão "Escolha quem foi o MVP" desabilitado; nota "Só vota quem jogou, e ninguém vota em si mesmo. Empate: vence quem teve mais saldo no placar." |
| 4 | Tocar "Beto"; depois "Fábio"; depois "Beto" | Botão vira "Votar no Beto" / "Votar no Fábio" / "Votar no Beto"; o `content-desc` marca só a linha escolhida como selecionada |
| 5 | Modo avião (tela aberta) | Faixa "Sem conexão"; botão desabilitado "Conecte-se para votar" |
| 6 | Rede de volta; dois toques seguidos no botão | Um voto só: "Você votou em Beto. Seu voto é secreto." + "O resultado sai quando a votação fechar, em 23 h." + "Ver resumo"; a lista some |
| 7 | "Voltar" para a 12 | "Você já votou · resultado em 23 h", **sem** o nome |
| 8 | Varredura P na 12 e na 12a | Nenhuma contagem ("N votos", "N votaram") |
| 9 | Modo avião, fechar o app, abrir a 12a pela 12 | "Sem internet. A votação aparece quando o celular voltar a se conectar." (o voto não fica gravado no celular) |
| 10 | Sair; entrar com a conta 2; 12 da RQ → 12a | Lista para votar (não mostra o voto da conta 1); Gabriel aparece como "{cor A} · 3 partidas · −3"; Beto não aparece |
| 11 | Votar no Gabriel | "Você votou em Gabriel. Seu voto é secreto." |
| 12 | Conta 2: 12 da R5 (não jogou; a votação da R5 abre só 6 h depois do início, porque o encerramento foi offline) | Antes das 6 h: "A votação do MVP abre quando a rodada terminar", sem botão. Depois: 12a com "Só vota quem jogou nesta rodada." e o prazo, sem lista |
| 13 | Fonte no máximo, conta 1, 12a de uma rodada aberta (ou a cédula da RA) | Lista rola; o botão fixo não cobre o último candidato; linhas ≥ 44 dp; nome longo com reticências |
| 14 | 12 da RA (12b) | "Areia Teste · 4 partidas · duplas"; MVP "Pia e Rui", "2 vitórias · ficaram 2 seguidas na quadra", "Calculado pelo placar"; "Ranking do dia": 1 Pia e Rui "2 vitórias · 0 derrotas", 2 Gabriel e Beto "2 vitórias · 1 derrota", 3 Nina e Otto "0 vitórias · 1 derrota", 4 Lia e Léo "0 vitórias · 2 derrotas"; **sem** "Time que mais venceu" e "Maior sequência" |
| 15 | Cédula da RA (conta 1) | Pessoas, não duplas; linha sem cor: Beto "3 partidas · +2" primeiro; Nina e Otto com "1 partida · −2" no fim |
| 16 | "Mandar pro grupo" da RA | "Resumo da Areia Teste · 4 partidas · duplas. MVP do dia: Pia e Rui (2 vitórias). Ranking do dia: 1. Pia e Rui, 2-0; 2. Gabriel e Beto, 2-1; 3. Nina e Otto, 0-1; 4. Lia e Léo, 0-2." Sem voto, contagem ou prazo |

**D+1** (mais de 24 h depois do encerramento da RQ)

| # | Ação | Esperado |
|---|---|---|
| 17 | Conta 1, 12 da RQ | Cartão do MVP "Beto" com "Escolhido pela galera" (1 × 1, desempate pelo saldo: +3 contra −3), linha "{cor B} · +3 de saldo · 1 vitória em 3"; **sem** número de votos; sem entrada de votação |
| 18 | Início | O card da RQ já não mostra "Ver resumo" (janela `endsAt + 24 h`) |
| 19 | Conta 2, aba "Eu" | Vezes MVP = 1 (texto do singular **(a confirmar)**); conta 1 segue com 0 |
| 20 | 12 da RA depois do fechamento sem votos | Continua "Pia e Rui" com "Calculado pelo placar" (pergunta 142) |

**Fora do celular:** corrida de 20 votos (I2), bordas da janela (J1 a J6), apuração G1 a G8, sigilo S1 a S6 nas rotas, exportação `mvpVotes` (testes da E3.18); tela 12a com votação desligada e "ainda não abriu": a 12a só é alcançável pela 12 e, depois da E3.11, pela notificação; um link direto pede os IDs, que o app não mostra **(a confirmar se vale abrir pelo `adb` com IDs do log de desenvolvimento)**. Partida sem vencedor na areia ("· 1 sem vencedor") só se a quadra permitir encerrar sem vencedor **(a confirmar)**.

**Tempo:** 25 min no dia D, 10 min em D+1.

## 6. E3.11 · Notificações (push, tela 28, sino, toque, permissão)

**Antes:** E3.11 Partes 1, 2 e 3 na `main` e no `sacou-api-test`; contas do Gabriel da resposta 111 feitas (token de acesso do Expo no Secret Manager, chave FCM V1 no EAS, `setup-notifications.sh` no Cloud Shell); APK novo com `expo-notifications`. RP com 12/12 e espera ligada. Pacote do APK de desenvolvimento para os comandos de permissão **(a confirmar: `com.sacou.app` ou com sufixo)**.

| # | Ação | Esperado |
|---|---|---|
| 1 | `adb shell pm revoke <pacote> android.permission.POST_NOTIFICATIONS`; app com a conta 2 → sino do Início → tela 28 | Card "Ative as notificações pra não perder a lista" com "Ativar" (≥ 44 dp); "Marcar como lidas" no cabeçalho |
| 2 | "Ativar" → "Não permitir" | Card continua |
| 3 | "Ativar" de novo (bloqueio permanente) | Abre os ajustes de notificação do app (`dumpsys activity activities` mostra o app de Configurações em cima) |
| 4 | Permitir nos ajustes e voltar | Card some |
| 5 | Chrome da conta 2: link da RP → VOU | "Na espera, 1º" |
| 6 | `am force-stop` no app; PC (conta 1): link da RP → "NÃO VOU MAIS" | Em segundos, **uma** notificação: título "Você saiu da espera", corpo "Entrou no Racha Teste · {dia abreviado} {hora}" (ex.: "sex 20h") |
| 7 | `dumpsys notification --noredact` e tela bloqueada (`input keyevent 26`, depois `screencap`) | Exatamente uma do app; **sem** o local, sem nome de ninguém, sem UUID |
| 8 | Tocar a notificação (app fechado) | Abre a rodada RP do G1 (tela 26 do jogador) com "Você vai" |
| 9 | Tela 28 | Grupo "Hoje"; linha "Você saiu da espera: entrou no Racha Teste de {dia por extenso}", subtítulo "{Dia} {hora} · {local}"; ponto "Não lida" no `content-desc` até tocar |
| 10 | Repetir com o app em segundo plano: conta 2 diz NÃO VOU e VOU de novo pelo app (vai para o fim da espera); PC: conta 1 VOU e NÃO VOU para liberar a vaga | Uma notificação nova (sequência nova), tocar abre a RP |
| 11 | Repetir com o app aberto no Início | Banner em primeiro plano; o sino ganha o ponto de não lida sem recarregar |
| 12 | Tela 28 → "Marcar como lidas" | Pontos somem; o ponto do sino some |
| 13 | Modo avião, fechar e abrir o app, tela 28 | Aviso de falha offline padrão; **nenhuma** notificação do cache (a lista não é gravada no aparelho) |
| 14 | Conta 2 → "Sair"; entrar com a conta 1 no app; conta 1 diz "Não vou" na RP pelo app (o Beto, se estiver na espera, é promovido) | O celular **não** mostra "Você saiu da espera" do Beto |
| 15 | Fonte no máximo, tela 28 em retrato | Títulos quebram sem cortar; "Ativar", "Marcar como lidas" e cada linha ≥ 44 dp |
| 16 | Conta 2: tela 30a (exportar) → `adb pull` | Seção `notifications` com aparelhos e notificações, **sem** token de push nem `installation_id` |

**Fora do celular:** classificação das respostas do Expo, novas tentativas, recibos, Cloud Tasks, rota interna com OIDC, `SKIP LOCKED` com dois pumps e exclusão da conta (testes da E3.11, Partes 1 e 2). Outros tipos de aviso ("lista abriu", "times sorteados", "votação aberta", "MVP do dia") ficam para as tarefas deles (resposta 113): o card da 28 cita "quando a lista abre" e "quando os times saem", mas no piloto só chega a promoção da espera. `data` forjado no push (abre o Início) não dá para gerar pelo celular.

**Tempo:** 25 min.

## 7. Resumo

| Tarefa | Passos | Tempo | Depende do Gabriel |
|---|---|---|---|
| Preparo comum (1) | massa da 1.3 | 45 min | segunda conta Google no Android; APK novo de desenvolvimento |
| E3.12 (2) | 24 | 35 min | app Web no Firebase com o host `run.app` autorizado; chave Web restrita; WhatsApp no celular |
| E3.9 + E4.12 (3) | 19 | 30 min | nenhuma |
| E4.13 (4) | 16 | 20 min | aceitar a permissão de galeria no celular |
| E3.18 + E4.18 (5) | 20 | 25 min + 10 min em D+1 | voltar no D+1 |
| E3.11 (6) | 16 | 25 min | resposta 111: token do Expo, chave FCM V1 no EAS, `setup-notifications.sh` |
| **Total** | **95** | **~3 h 10 min** | |

## 8. Pendências do celular herdadas

De `docs/estado/pendencias.md` (linha entre parênteses), ainda valem até prova em contrário; aproveitar a mesma rodada de cabo.

1. **Quadra mais alta** (87, item 5, decisão do Gabriel de 17/11): nomes da última linha e linha de fundo visíveis acima da fila.
2. **Correções do PR `fix/phone-test-17-11`** (87; 85 c; 86 b): "Notificações" da Conta sem quebra no meio da palavra e cartões de nível da 27 empilhados, com fonte 2.0; saudação offline com o apelido e faixa só "Sem conexão" (101: também editar o apelido logo depois de reabrir).
3. **Aviso "multiple navigation containers"** ao trocar a fonte (87, item 3): reconferir num APK `preview`.
4. **"Entendi" do aviso de bateria** encostado na borda de baixo (65): conferir se a área segura foi corrigida.
5. **Áreas seguras em paisagem** (107, item 2): folhas de encerrar partida e de autor do ponto sob a barra de navegação; "Começar partida" do pré-jogo sob a barra de baixo. Também a tela 31 embaixo com a parte de cima da quadra tocável (104).
6. **Nomes divergentes** entre sorteio/quadra e tela 31 depois de editar o apelido (107, item 1); a 07 sem os nomes das reservas (107, item 3); perfil sem rede carregando para sempre (107, item 4).
7. **Folha 08** com a fonte no máximo e "Abrir quadra" depois de fechar o app (89).
8. **Tela 24** em paisagem com o texto "Desfeito: ..." e o cenário do Hermes "abrir a 24 e selecionar" (91; Hermes só no APK `preview`).
9. **Fechar o app na tela 11** e ver que o Início não retoma a quadra (92; coberto também no passo 9 da seção 3).
10. **Tela 22 (Escalação):** roteiro do plano da E4.8, passos 1 a 10; `LiberoPicker` com 4 ou mais reservas; nomes longos nos chips; a 22 em paisagem com a fonte no máximo (98, 99).
11. **Troca da quadra com dois celulares** (seção 5 de `docs/estado/tarefas/E4.11.md`) e o `router.dismissTo` quando a quadra não está na pilha (103, 105). Pede um segundo aparelho.
12. **Tela 23a** depois da Escalação com reservas no banco (109), quando essa tarefa existir.
13. **`X-Forwarded-For` no Cloud Run** (106): coberto pelo passo 24 da seção 2.
