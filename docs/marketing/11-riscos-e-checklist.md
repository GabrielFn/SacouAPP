# 11 · Riscos e checklist antes de publicar

## Riscos

| # | Risco | O que pode acontecer | Como evitar |
|---|---|---|---|
| 1 | **Acesso à produção negado ou atrasado** (conta pessoal nova) | Loja não abre depois do piloto | Piloto na faixa de **teste fechado**, 12 ou mais testadores por 14 dias seguidos, pedido na 3ª semana (`06`) |
| 2 | **Reprovação por login** | A revisão não consegue entrar no app | Conta de teste com grupo, rodada e partida prontos, informada em "Acesso ao app" |
| 3 | **Segurança dos dados diferente do app** | Reprovação ou remoção | Formulário igual a `03-seguranca-de-dados.md`; conferir o relatório de SDKs; reabrir a cada recurso novo |
| 4 | **Sem página de exclusão de conta ou sem política de privacidade** | Reprovação | E6.1 publicada, com a seção "Como excluir sua conta" e canal de pedido |
| 5 | **Texto ou imagem fora das regras da ficha** | Reprovação ou perda de destaque | Sem "melhor", "nº 1", "grátis", preço, depoimento ou "baixe agora"; legenda até 20% da imagem; capturas do app real |
| 6 | **Marca de terceiros** | Reprovação ou notificação | Sem logo ou nome de federação, clube, atleta, outros apps e do aplicativo de mensagens nas imagens. Na descrição, a frase "projeto independente" já está |
| 7 | **Nome "Sacou" sem registro** | Outro registrar antes; pedido de troca de nome | Busca e pedido no INPI (classes 9 e 41) antes do lançamento público. Na busca de 19/11/2026 não apareceu app com esse nome exato na Play Store; isso não substitui a busca no INPI |
| 8 | **Ícone gerado por IA** | Dúvida sobre uso comercial | Gabriel confere os termos da ferramenta (pendência do ADR 0059) |
| 9 | **Prometer demais** | Avaliação ruim e desconfiança | Só o que o piloto entrega (lista em `01`, "O que não dizer"). Tabela "Conferir antes de colar" em `02` |
| 10 | **Dado pessoal em peça** | Problema de LGPD e de confiança | Grupo fictício em todas as capturas e vídeos; autorização por escrito de quem aparece; nada de menor de idade; contatos do piloto fora do repositório público |
| 11 | **Conteúdo gerado por usuário sem denúncia** | Pergunta da revisão do Google | Regra de conduta nos Termos, e-mail de suporte como canal, admin remove membro. Conferir na E6.2 |
| 12 | **Menores de idade** | Regras de famílias e LGPD art. 14 | Público-alvo 18+ no lançamento; Termos dizendo o mesmo |
| 13 | **Avaliações** | Punição da loja | Nunca oferecer nada em troca de avaliação; não pedir "5 estrelas"; não avaliar o próprio app com contas de amigos que não usam |
| 14 | **Spam em grupos** | Queimar o nome na comunidade | Sempre pedir ao admin; uma mensagem por grupo; nunca adicionar gente em grupo |
| 15 | **Música e imagem em vídeo** | Vídeo derrubado | Só áudio da biblioteca da rede; na loja, Biblioteca de Áudio do YouTube ou som ambiente |
| 16 | **Bug na quadra durante o lançamento** | Grupo abandona e conta para os outros | Lançamento suave de 2 a 3 semanas antes de divulgar; responder em até 1 dia |
| 17 | **Publicidade sem aviso** | Problema com as regras de publicidade | Se embaixador ou criador receber algo, o post diz que é parceria |
| 18 | **Promessa sobre preço** | Cobrança de promessa feita em conversa | Frase padrão de `08`; nada de preço ou "grátis para sempre" |

## Checklist antes de publicar em produção

**Conta e acesso**

- [ ] Teste fechado com 12 ou mais testadores por 14 dias seguidos, e acesso à produção aprovado.
- [ ] Verificação de identidade da conta do Play Console concluída.
- [ ] Conta de teste para a revisão criada e informada em "Acesso ao app".

**Ficha**

- [ ] Nome (até 30), descrição curta (até 80) e completa (até 4.000) colados de `02`, com os limites reconferidos.
- [ ] Tabela "Conferir antes de colar" de `02` revisada: toda linha da descrição corresponde a recurso entregue.
- [ ] `[E-MAIL DE SUPORTE]` preenchido na descrição e no contato.
- [ ] Categoria Esportes; sem anúncios; sem compras no app; só Brasil.
- [ ] Ícone 512 × 512 enviado; termos da ferramenta do ícone conferidos.
- [ ] Imagem de destaque 1.024 × 500, sem transparência.
- [ ] 8 capturas 1.080 × 1.920, com dados fictícios, barra de status limpa, sem selo "Pro", sem valor em reais.
- [ ] Texto alternativo em cada imagem.
- [ ] Vídeo (opcional): não listado, sem anúncios, incorporável, sem restrição de idade.

**Conteúdo do app (Play Console)**

- [ ] Política de privacidade: URL pública funcionando (E6.1).
- [ ] Exclusão de conta: URL pública funcionando, citando o Sacou.
- [ ] Segurança dos dados preenchida conforme `03`, e relatório de SDKs conferido.
- [ ] Classificação etária (IARC) respondida; "usuários interagem" marcado.
- [ ] Público-alvo conforme a decisão do Gabriel.
- [ ] Declarações: sem anúncios; não usa ID de publicidade; não é app de notícias, saúde ou finanças.

**Marca e direito**

- [ ] Busca no INPI feita e pedido protocolado (ou decisão consciente de adiar).
- [ ] Perfis das redes reservados com o mesmo nome.
- [ ] Autorizações de imagem guardadas (fora do repositório).
- [ ] Depoimentos só com autorização por escrito.

**Produto**

- [ ] Portão do piloto batido (60% das confirmações pelo link) e nenhum bug grave aberto.
- [ ] Sentry recebendo erros da versão de produção.
- [ ] Aprovação do Gabriel para publicar (ação irreversível, `CLAUDE.md`).

## Depois de publicar

- [ ] Abrir a ficha num celular deslogado e conferir textos, imagens e links.
- [ ] Instalar pela loja e criar um grupo do zero.
- [ ] Testar um link com origem marcada e ver se aparece no Console.
- [ ] Marcar na agenda: rever ficha, capturas e segurança dos dados quando o Pro, a foto ou o Pix entrarem.
