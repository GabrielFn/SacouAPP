# 02 · Ficha da Play Store (pronta para colar)

Limites conferidos na ajuda do Google Play em 19/11/2026: **nome 30**, **descrição curta 80**, **descrição completa 4.000** caracteres ([fonte](https://support.google.com/googleplay/android-developer/answer/9859152)). Reconferir no dia de publicar. Idioma da ficha: **Português (Brasil), pt-BR**, como padrão.

Regras que valem para todos os textos: sem "melhor", "nº 1", "grátis" ou preço no nome; sem repetir palavra-chave à toa; sem depoimento; sem chamada do tipo "baixe agora" nas imagens ([fonte](https://support.google.com/googleplay/android-developer/answer/9866151)).

## Nome do app

| # | Texto | Caracteres |
|---|---|---|
| 1 | `Sacou: Racha de Vôlei e Placar` | 30. **Recomendado**: marca + as duas buscas mais fortes |
| 2 | `Sacou: racha de vôlei` | 21 |
| 3 | `Sacou: Vôlei, Sorteio e Placar` | 30 |

## Descrição curta

| # | Texto | Caracteres |
|---|---|---|
| 1 | `Lista de presença, sorteio de times, placar e fila de quem perde sai no vôlei.` | 78. **Recomendada** |
| 2 | `Organize o racha de vôlei: lista, espera, sorteio, placar e quem perde sai.` | 75 |
| 3 | `Racha de vôlei sem bagunça: presença pelo link, sorteio, placar e rotação.` | 74 |

## Descrição completa

```text
O Sacou é o app do racha de vôlei. Ele cuida da lista, da espera, do sorteio dos times, do placar e da fila de quem perde sai, para você chegar na quadra e só jogar.

Feito para vôlei de quadra e de areia, para quem organiza e para quem joga.

LISTA DE PRESENÇA SEM BAGUNÇA
• Crie o grupo em 1 minuto e mande o link de convite.
• Cada jogador responde VOU ou NÃO VOU. Dá para confirmar pelo link, no navegador, sem instalar o app.
• Lotou? Quem chega depois entra na lista de espera e sobe sozinho quando alguém desiste.
• Mensalistas e avulsos, com vagas separadas.
• Alguém confirmou só no grupo de mensagens? O organizador adiciona em dois toques.
• A lista sai em texto, pronta para colar no grupo.

SORTEIO DE TIMES EQUILIBRADO
• O app monta os times pela nota que só o organizador vê.
• Não gostou? Troque dois nomes, trave uma dupla ou sorteie de novo.
• Compartilhe os times com o grupo. A nota de ninguém aparece.

PLACAR, ROTAÇÃO E FILA NA MESMA TELA
• Toque no lado do time para marcar o ponto. Números grandes, para ver de longe.
• O app mostra quem saca e gira o time na hora certa.
• Rotação livre ou com sistema 5x1, 4x2 e 6x2, com as posições no momento do saque.
• Errou? Desfaça ou corrija qualquer ponto pela linha do tempo.
• Funciona sem internet na quadra e sincroniza depois.
• Você também joga? Outro celular do grupo pode assumir o placar a qualquer momento.

QUEM PERDE SAI, SEM DISCUSSÃO
• No fim da partida o app mostra quem sai e quem entra.
• Tem só 2 ou 3 de fora? Sai do time que perdeu só esse número de jogadores, e o app diz quem.
• Você escolhe a regra: mais partidas seguidas, ordem de chegada, sorteio ou escolha manual.
• Quer que o vencedor também saia depois de algumas vitórias seguidas? É só ligar.

AREIA REI DA QUADRA
• Duplas ou quartetos, vencedor fica e ranking do dia.

DEPOIS DO JOGO
• Resumo da rodada com o MVP do dia, o time que mais venceu e a maior sequência.
• MVP calculado pelo placar ou por votação secreta do grupo.
• Sua cartinha de jogador com partidas, vitórias, saldo e vezes MVP, para compartilhar.

DO JEITO DO SEU RACHA
• Modelos prontos: Pelada descontraída, Racha organizado, Treino e Areia rei da quadra.
• Tudo liga e desliga: limite de vagas, sets, pontos, tie-break, fila, rotação e sorteio.
• Vários administradores por grupo e o papel Placar, para quem só marca os pontos.

SEUS DADOS
• Entre com Google ou e-mail.
• O app guarda só o necessário: apelido, posição e sua participação nos rachas.
• Você pode exportar seus dados e excluir sua conta pelo próprio app.

O Sacou é um projeto independente e não tem ligação com federações, confederações ou clubes de vôlei.

Dúvidas e sugestões: [E-MAIL DE SUPORTE]
```

Cerca de 2.650 caracteres, dentro do limite de 4.000. `[E-MAIL DE SUPORTE]` é o único campo a preencher (ver decisão 3 no `README.md`).

### Conferir antes de colar (verdade sobre o produto)

A ficha só sobe depois do piloto. Cada bloco depende de tarefas que precisam estar entregues; se alguma não estiver, **apague a linha correspondente**.

| Trecho | Tarefas | Observação |
|---|---|---|
| Lista, espera, mensalista e avulso, convidado | E3.4, E3.5, E4.6 | |
| "Confirmar pelo link, sem instalar" | E3.12 | Página web da rodada (M5) |
| Sorteio, trocar, travar dupla | E3.6, E4.7 | O sorteio pede internet |
| Placar, rotação, corrigir, offline | E2.x, E4.8 a E4.11 | 5x1, 4x2 e 6x2 são do Pro: ver nota abaixo |
| Outro celular assume o placar | E3.8, E4.11 | |
| Fila, saída parcial, vencedor também sai | E2.6, E2.12 | |
| Areia rei da quadra | ADR 0048 | |
| Resumo, MVP, votação | E3.9, E3.18, E4.12 | Sem texto de IA |
| Cartinha | E4.13 | Com avatar, sem foto |
| Exportar e excluir conta | E3.16, E4.3 | |

**Nota sobre o Pro:** enquanto o Pro estiver liberado para todos, a linha da rotação fica como está. Quando o paywall entrar, trocar por "Rotação livre para todos; sistemas 5x1, 4x2 e 6x2 no plano Pro" e marcar "Compras no app" no Console.

## Palavras-chave (busca em português do Brasil)

O Google Play não tem campo de palavras-chave: ele lê o **nome**, a **descrição curta** e a **descrição completa**. A estratégia é pôr cada termo uma vez, em frase natural.

| Prioridade | Termos | Onde já estão |
|---|---|---|
| 1 · Principais | racha de vôlei, placar de vôlei, sorteio de times | Nome e descrição curta |
| 2 · Recursos | lista de presença, lista de espera, quem perde sai, rotação 5x1, 4x2, 6x2, rei da quadra, vôlei de areia | Descrição curta e títulos dos blocos |
| 3 · Sinônimos | pelada, mensalista, avulso, times equilibrados, marcador de pontos, MVP | Corpo da descrição |
| 4 · Marca | Sacou | Nome |

- Variações que as pessoas digitam sem acento ("volei", "rotacao") o Google normalmente resolve sozinho; não escrever errado de propósito.
- **Não usar:** nomes de outros apps (Chega+, Pelada+), "futebol", "futevôlei", "beach tennis" (o app não atende), "oficial", "CBV", "FIVB", "grátis".
- Depois de 30 dias no ar, olhar no Play Console (Aquisição → termos de busca) o que de fato traz gente e ajustar a descrição curta.

## Categoria, contato e detalhes

| Campo | Resposta |
|---|---|
| Tipo | App |
| Categoria | **Esportes** |
| Tags | Esportes; se houver, as tags de organização de times e placar (escolher no Console, no máximo 5) |
| Gratuito ou pago | Gratuito |
| Contém anúncios | Não |
| Compras no app | Não no lançamento. Passa a "Sim" quando o paywall entrar |
| Países | Só Brasil |
| E-mail de contato | `[E-MAIL DE SUPORTE]` (obrigatório e público) |
| Site | Domínio do Sacou, quando registrado (`plano-mvp.md`) |
| Política de privacidade | URL pública da E6.1 (obrigatória) |
| Exclusão de conta | URL pública com o passo a passo e um canal de pedido (obrigatória, ver `03-seguranca-de-dados.md`) |
| Acesso ao app para a revisão | **Informar uma conta de teste** (e-mail e senha) com um grupo, uma rodada e uma partida já criados, porque o app exige login. A senha vai só no campo do Console, nunca no repositório |

## Classificação etária (questionário IARC)

Respostas previstas, a conferir no questionário real:

| Pergunta | Resposta |
|---|---|
| Categoria do app | Utilitário, produtividade, comunicação ou outro (não é jogo) |
| Violência, sexo, linguagem imprópria, drogas, jogos de azar | Não |
| Usuários interagem ou trocam conteúdo? | **Sim**: apelidos, nomes de grupo e local da rodada aparecem para os membros do grupo |
| Compartilha a localização do usuário? | Não (o local é texto digitado, não GPS) |
| Compras digitais | Não no lançamento |

Resultado esperado: **Livre**, com o aviso "Usuários interagem".

**Público-alvo e conteúdo** (formulário separado): marcar **18 anos ou mais** no lançamento. Motivo: marcar faixas abaixo de 18 traz as regras de apps para famílias e o tratamento de dados de menores da LGPD (art. 14), que os Termos da E6.1 precisam cobrir antes. É decisão do Gabriel (decisão 4 no `README.md`).

**Conteúdo gerado por usuários:** o que existe é apelido, nome de grupo e local, vistos só dentro de grupos fechados por convite. A política do Google pede, para apps com esse tipo de conteúdo, regras de conduta nos Termos e um jeito de denunciar. Para o lançamento: regra de conduta nos Termos (E6.1), o admin já remove membros, e o e-mail de suporte serve de canal de denúncia. Conferir na E6.2 se basta.
