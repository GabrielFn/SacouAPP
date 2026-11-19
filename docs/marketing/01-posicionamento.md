# 01 · Posicionamento e mensagens

Base: `docs/produto.md` (posicionamento e princípios), `docs/decisoes.md` e ADR 0046 (o que o piloto entrega).

## Para quem é

| Público | Quem é | O que quer | Como entra |
|---|---|---|---|
| **Organizador** (alvo nº 1) | Quem cria a lista no WhatsApp, cobra presença, sorteia os times e ainda joga | Parar de administrar lista e discussão; chegar na quadra e só jogar | Instala o app, cria o grupo em 1 minuto e manda o link |
| **Jogador** | Quem responde "eu" no grupo e aparece na quadra | Saber se tem vaga, em que time caiu e quando entra | Confirma pelo link, numa página web, **sem instalar**. O app vem depois (cartinha e estatísticas) |
| **Quem marca o placar** | Reserva, quem está de fora ou o celular apoiado na quadra | Marcar ponto sem errar e sem discussão | Papel "Placar" no grupo |

Quem decide adotar é o organizador. Toda a divulgação fala primeiro com ele. O jogador é conquistado dentro do racha, pelo link e pela cartinha.

## A dor (racha combinado no WhatsApp)

1. **Lista:** copia e cola, alguém apaga um nome, ninguém sabe quem confirmou por último.
2. **Espera:** quem desiste em cima da hora não avisa; quem está na espera não sabe que entrou.
3. **Sorteio:** times desequilibrados, "panelinha", sorteio refeito três vezes.
4. **Quem perde sai:** com gente de fora que não fecha um time, vira discussão sobre quem sai e quem entra.
5. **Placar:** "tá quanto?", "de quem é o saque?", "quem roda?".

## Proposta de valor

> **O Sacou organiza o racha de vôlei do convite ao último ponto: lista com espera, sorteio equilibrado, placar com rotação e a fila de quem perde sai, tudo no mesmo lugar.**

Três provas, todas do piloto:

1. **Feito para vôlei.** Rotação por time, saque, fila de times e areia "rei da quadra". Os apps de racha que existem são de futebol.
2. **A quadra em uma tela.** Placar, rotação e fila juntos. Ao fim da partida o app mostra quem sai e quem entra, inclusive quando só tem 2 ou 3 de fora (saída parcial).
3. **Funciona junto com o WhatsApp.** O jogador confirma pelo link sem instalar nada, e a lista, os times e o resumo saem prontos para mandar no grupo.

## Nome e tagline

O nome **Sacou** está decidido (`decisoes.md`). Duplo sentido que vale explorar: sacar (o saque) e "sacou?" (entendeu?).

| # | Tagline | Onde usar |
|---|---|---|
| 1 | **O app do racha de vôlei.** | Padrão: loja, bio, imagem de destaque. **Recomendada** |
| 2 | Lista, sorteio e quem perde sai. Sem bagunça no grupo. | Posts e mensagem para organizador |
| 3 | Chegou, sorteou, jogou. Sacou? | Vídeos curtos |
| 4 | Seu racha organizado do convite ao último ponto. | Texto longo, arenas |
| 5 | Menos discussão, mais vôlei. | Peças com a fila e o placar |

## Tom de voz

- **De quadra:** leve, direto, de quem joga. "Racha", "de fora", "quem perde sai", "bora".
- **Frases curtas.** Um benefício por frase. Verbo no começo.
- **Sem jargão corporativo** ("solução", "plataforma", "gestão esportiva") e sem jargão técnico ("event sourcing", "offline-first").
- **Sem zoar ninguém.** Nada de lista de devedor, de "fominha" ou de nível de jogador exposto.
- **Sem exagero:** nada de "o melhor", "nº 1", "oficial", números de usuários ou depoimento antes de existir.
- "Você" para o organizador; "a galera", "o pessoal" para o grupo.

| Em vez de | Escreva |
|---|---|
| Plataforma de gestão de partidas | O app do seu racha |
| Algoritmo de balanceamento | Sorteio equilibrado |
| Controle de fila inteligente | O app diz quem sai e quem entra |
| Experiência offline | Funciona sem sinal na quadra |

## Mensagens por público

**Organizador**

1. Crie o grupo em 1 minuto e mande o link. A lista se organiza sozinha.
2. Lotou? Quem chegar depois entra na espera e sobe sozinho quando alguém desiste.
3. Sorteio equilibrado pela nota que **só você** vê. Deu ruim? Troca dois nomes ou sorteia de novo.
4. Na quadra, o app marca o placar, gira o time e resolve o "quem perde sai".
5. Você também joga: outro celular pode assumir o placar a qualquer momento.

**Jogador**

1. Confirma pelo link, sem instalar nada.
2. Sabe na hora se está dentro ou na espera, e é avisado quando sobe.
3. Sua cartinha com os números do placar: partidas, vitórias, saldo, vezes MVP.
4. Ninguém vê nota de ninguém. Os números vêm do jogo.

**Arena e quadra**

1. Racha organizado enche horário e não atrasa a próxima locação.
2. Não muda nada na operação da arena. É o organizador que usa.

## Objeções e respostas

| Objeção | Resposta |
|---|---|
| "O pessoal não vai baixar mais um app." | Não precisa. Jogador confirma pelo link, numa página. Só quem organiza e quem marca o placar instala. |
| "A gente já se resolve no WhatsApp." | O grupo continua. O Sacou só tira de lá a lista, o sorteio e o placar. A lista sai pronta para colar no grupo. |
| "E quem confirmou só no WhatsApp?" | O organizador adiciona a pessoa em dois toques ("Adicionar quem confirmou no WhatsApp"). |
| "Na quadra não pega sinal." | Placar, rotação e fila funcionam sem internet e sincronizam depois. (O sorteio pede internet.) |
| "Quem marca o placar se eu estou jogando?" | Deixe o celular apoiado ou dê o papel Placar a quem está de fora. Outro celular assume a qualquer momento. |
| "Vão ver minha nota?" | Não. Só admin e co-admin veem, e só para sortear. A imagem dos times e a cartinha não mostram nota. |
| "Nosso racha é diferente." | Tudo liga e desliga: vagas, sets, pontos, fila, rotação, sorteio. Tem modelo pronto de pelada, racha organizado, treino e areia. |
| "É pago?" | No piloto, tudo liberado, sem cobrança. Depois vai existir um plano pago com recursos avançados; o jogador continua confirmando e jogando de graça. Preço ainda não definido (ver `08-venda-e-parcerias.md`). |
| "Tem para iPhone?" | No piloto, o app é só Android. Quem tem iPhone confirma presença pelo link, no navegador. |
| "E os meus dados?" | Login por Google ou e-mail. O app guarda apelido, posição e presença. Dá para exportar e excluir a conta pelo próprio app. |

## O que **não** dizer (ainda não existe no piloto)

Pix e cobrança, foto na cartinha, resumo escrito por IA, story, placar ao vivo para quem está de fora, versão para iPhone, preços e planos. Se alguém perguntar: "está no plano, sem data".
