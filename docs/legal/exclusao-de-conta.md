RASCUNHO PARA REVISÃO JURÍDICA. Não é a versão final. Escrito pelo desenvolvedor na E6.4 (26/11/2026), plano `.specs/features/E6.4/plan.md`.

Como este arquivo é publicado (ADR 0083): só o trecho entre os marcadores `publicar:inicio` e `publicar:fim` vai para `/excluir-conta`. Dentro dele, as linhas que começam com `>` são notas de revisão e **nunca** são publicadas. No trecho publicado valem só títulos (`#`, `##`, `###`), parágrafos e itens `- `, sem negrito, links, tabelas nem HTML.

O e-mail do encarregado **não** está neste texto: ele vem da configuração `DataProtection__ContactEmail` e aparece no bloco "Pedir sem o app", no alto da página (pergunta 250). Os rótulos do passo a passo são copiados de `apps/mobile/src/strings/` (`groups.pt-BR.ts`, `profile.pt-BR.ts`, `account.pt-BR.ts`); os prazos, de `docs/seguranca/dados-pessoais.md`. Mudou um deles, muda aqui também. Os passos em ordem viram itens `- ` porque o leitor recusa listas numeradas.

<!-- publicar:inicio -->

# Excluir sua conta do Sacou

Versão: 0.1 (rascunho)

Atualizada em: 26/11/2026

Esta página explica como excluir sua conta do Sacou, o app de vôlei, pelo próprio app ou sem ele, o que é apagado e o que fica guardado depois, e por quanto tempo.

## Pelo app

- Abra o Sacou e toque na aba "Eu".
- Toque em "Configurações".
- Em "Excluir conta", toque em "Excluir".
- Em "Para confirmar, digite EXCLUIR", escreva EXCLUIR.
- Se você entra com Google, toque em "Excluir minha conta".
- Se você entra com e-mail e senha, escreva a senha em "Sua senha" e toque em "Confirmar e excluir".

A exclusão acontece na hora. Depois dela, o app volta para a tela de entrada.

> Conferir no emulador a cada mudança das telas 14, 30 e 30b (critério 4 do plano).

## Sem o app

Se você desinstalou o app, perdeu o celular ou não consegue entrar, peça a exclusão por e-mail ao encarregado de dados do Sacou, no endereço indicado no alto desta página. Não é preciso instalar o app de novo.

- Envie o pedido do mesmo e-mail que você usa para entrar no Sacou e diga o seu apelido.
- Um pedido enviado de outro endereço recebe uma resposta pedindo que você escreva do e-mail da conta. Assim ninguém consegue excluir a conta de outra pessoa.
- A exclusão é feita em até 15 dias, e você recebe a confirmação por e-mail.

## O que é apagado

Na exclusão, estes dados são apagados na hora:

- O login e o e-mail guardados no Firebase, o serviço de login do Google.
- A sua conta na API do Sacou.
- O seu perfil: apelido, posições e o nível que você escolheu.
- As notas que admins deram sobre você.
- Os aparelhos cadastrados para as notificações e as notificações mandadas a você.
- As denúncias feitas por você ou sobre você.
- Os convites criados por você, que deixam de funcionar.

## O que fica e por quanto tempo

- O histórico das partidas, das presenças, dos votos do MVP e das estatísticas fica com o grupo, com o seu nome trocado por "Ex-jogador", sem nada que leve a você, enquanto o grupo existir. Assim o placar e as estatísticas dos outros jogadores não mudam.
- A cópia de segurança do banco de dados guarda os dados de antes da exclusão por até 30 dias, e depois é apagada.
- O histórico de restauração do banco de dados guarda os dados de antes da exclusão por 6 horas.
- Uma marca de exclusão, só com um identificador e sem nenhum dado seu, fica por 60 dias. Ela serve para refazer a exclusão se uma cópia de segurança antiga precisar ser restaurada.
- Os registros de acesso do servidor no Google Cloud, com endereço IP e navegador, ficam por 30 dias.
- Os registros de falhas do app e do servidor ficam por 90 dias, sem nada que identifique você.

## Antes de excluir

- Se você é o único admin de um grupo, passe o papel para outra pessoa antes. O app mostra o botão "Escolher outro admin" e só deixa excluir depois disso.
- A exclusão não dá para desfazer. Se quiser uma cópia dos seus dados, use antes "Exportar meus dados", nas configurações do app.

<!-- publicar:fim -->
