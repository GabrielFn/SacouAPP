# Sacou — Revisão do MVP

2026-10-30 · @Gabriel

## Veredito

O MVP é sólido e a arquitetura aguenta, mas há 3 frentes para corrigir antes do primeiro commit: as telas contam histórias diferentes da mesma rodada, o documento ficou atrás das decisões recentes e a arquitetura precisa de 4 ajustes estruturais.

Revisão feita por três especialistas em paralelo (UX/UI, produto e arquitetura) sobre as 16 telas, o documento de produto e as decisões da conversa.

**O que já está bom:** nomes, horários e locais dos grupos; placares entre Início, Quadra e Fim de partida; rotação por time; posições no momento do saque (corretas dos dois lados da rede); herança cinza/laranja; faixas da cartinha; MVP calculado por dados; escolha de stack (monólito modular, Postgres, SignalR, Hangfire, Firebase, offline com log de eventos).

**O que precisa mudar antes de codar:**

1. **Telas:** times com jogadores trocados entre Sorteio, Quadra e Fim de partida; saída parcial aplicada ao vencedor; 4º time inexistente na fila; placar sem side-out coerente.
2. **Telas que faltam:** 7 essenciais, entre elas Ajustes do grupo, Membros, Escalação, Menu da quadra/Corrigir e Paywall.
3. **Documento:** roadmap desatualizado (rotação avançada na Fase 3, "cerca de 10 telas"), falta como o Pro é cobrado, falta a cartinha e o perfil.
4. **Arquitetura:** o stream de eventos tem que ser da quadra da rodada (não da partida), eventos gravam o resultado das regras, placar sem conta precisa de token próprio, faltam armazenamento de arquivos, cobrança pela loja e LGPD.

## Correções nas telas

As prioridades altas são só ajuste de dados nas telas existentes e vão virar casos de teste golden, por isso precisam contar uma história única.

| Prioridade | Tela | Problema | Correção |
|---|---|---|---|
| Alta | 09/10 Quadra x 07 Sorteio | Laranja na quadra tem a Tati (que é do Verde) e a Ana aparece no banco, mas é do Laranja | Usar exatamente o Laranja do sorteio e tirar o banco, ou montar um cenário com 7 no time |
| Alta | 09/10 Quadra | Fila mostra "D Roxo", mas o sorteio tem só 3 times de 6 | Mostrar só "C Verde" |
| Alta | 11 Fim de partida | Saída parcial aplicada ao vencedor; quem "entra" (Pedro, Lia) já é do Laranja; com o Verde completo esperando, a saída deveria ser do time inteiro | Cenário coerente: o perdedor tem 2 substitutos esperando; saem 2 pelo critério ("3 partidas seguidas") e quem entra assume a posição |
| Alta | 10 Quadra Noite | De 18x15 para 24x21 o Azul fez pontos, então houve side-out; o Laranja não poderia estar na mesma rotação com o mesmo sacador | Outra rotação e outro sacador na tela Noite |
| Alta | 07 Sorteio x 14 Perfil | Sorteio mostra o nível inteiro de cada um (João "3"); o perfil diz 3,8 e "só você vê" | Definir se o admin vê os níveis (decisão pendente); escala decimal; nunca na imagem compartilhada |
| Alta | 07 Sorteio | Médias erradas (Azul 3,5 e não 3,6; Verde 3,3 e não 3,4) | Recalcular |
| Alta | 05 Criar grupo | Não pede dia, horário, local, vagas nem chave Pix | Acrescentar "Quando e onde?" e a chave Pix quando cobra |
| Alta | 04, 06, 08, 09 | 5x1 é Pro, mas nada indica que o grupo é Pro e não há paywall; o modelo Treino promete 5x1/4x2 sem selo | Selo Pro no grupo e no card Treino; paywall ao tocar em opção Pro |
| Alta | 11 → 12 | "Confirmar" no fim da partida leva ao resumo da rodada, mas a próxima partida já está definida | Confirmar leva à próxima partida; "Encerrar rodada" no menu leva ao resumo |
| Alta | Aba Grupo | A aba aponta para uma rodada solta | Aba abre a lista de grupos |
| Média | 01 Página da rodada | "Lista fechando" com 3 vagas abertas; sem data nem formato do jogo | Texto de espera só quando lotar; mostrar data e "6x6 · 25 pts · perde sai" |
| Média | 03 Início | "3 rodadas essa semana" não conta a rodada ao vivo; cards abrem a página web | Contar 4; criar o detalhe da rodada no app para o jogador |
| Média | 06 Rodada | "13/18 pagaram" mistura mensalistas e avulsos | Separar avulsos e mensalidade do mês |
| Média | 08 Pré-jogo | "Partida 1" contra "2 seguidas" na quadra; banco aparece com time de 6; sem tie-break | "Partida 3"; banco só com mais de 6; mostrar tie-break |
| Média | 09/10 Quadra | Sem menu (escalação, trocar jogador, entregar placar, encerrar); set point só no tema Noite | Menu atrás do cadeado; set point também no Sol, com contraste |
| Média | 12 Resumo | "Crie seu grupo" para quem já é admin; números não fecham com a fila | CTA só para quem não é admin; "calculado pelo placar"; ajustar números |
| Média | 07 Sorteio | Chips de 36 px usados para tocar e trocar | Mínimo de 44–48 px |
| Baixa | 14/15 | "jogos" x "partidas", "sequência" x "maior sequência"; contas do Perfil não fecham | Padronizar termos e fechar as contas |
| Baixa | 02 Login | Sem link de Termos e Privacidade; botões Google e Apple com alturas diferentes | Acrescentar a linha de termos (LGPD) e igualar as alturas |
| Baixa | Geral | Dois cinzas e dois verdes para o mesmo papel; botões sem destino no protótipo; sem estado "sincronizando" | Unificar em tokens; ligar os botões; desenhar o estado de sincronização |

## Telas que faltam

São 12 telas essenciais para o MVP; quase todas as decisões de configuração vivem em Ajustes do grupo, que ainda não existe.

| Tela | MVP? | Por quê |
|---|---|---|
| Lista de grupos | Essencial | Destino da aba Grupo |
| Ajustes do grupo "Como jogamos" | Essencial | Fila e saída parcial (critério e modo), sets, tie-break, rotação, banco, MVP, cobrança, recorrência, com herança e selos Pro |
| Membros e papéis | Essencial | Admin, Co-admin, Placar; mensalista ou avulso; convite por link e QR |
| Escalação em tela cheia, por time | Essencial | O botão "Escalação" do pré-jogo não leva a nada; ordem 1–6, levantador, formação e avisos de sobreposição |
| Menu da quadra + Corrigir (linha do tempo) + Trocar jogador | Essencial | "Corrigir" existe sem destino; inclui confirmação de fim de set |
| Detalhe da rodada para o jogador (no app) | Essencial | VOU / NÃO VOU, "Já paguei", espera, desistência com aviso de quem entra |
| Paywall Sacou Pro | Essencial | 5x1 já é usado nas telas sem paywall |
| Criar/editar rodada + Personalizar esta rodada | Essencial | Legenda do ponto laranja pressupõe essa tela; recorrência |
| Onboarding do jogador | Essencial | Apelido, foto, posições e nível inicial: o sorteio por nível depende disso |
| Adicionar quem confirmou no WhatsApp / convidado sem conta | Essencial | O botão existe na tela 06 sem destino |
| Notificações (permissão e central) | Essencial mínima | Recorrência e lista de espera dependem de push |
| Entregar placar por QR | Recomendada | Pode entrar logo depois se o admin marcar sozinho no piloto |
| Pagamentos completos e resumo financeiro | Recomendada | "Ver os 18" sem destino |
| Estados de vazio, erro, offline e sincronização | Recomendada | Inclui "removendo fundo…" da foto |
| Editar perfil, excluir conta, termos e privacidade | Essencial | Exigência das lojas e da LGPD |
| Votação de MVP e "De quem?" | Depois do MVP | São opções do grupo, não o padrão |

## Documento de produto

O documento cobre bem o núcleo, mas ficou atrás das decisões das últimas horas: o roadmap contradiz as telas e falta dizer como o Pro é cobrado.

**Contradições a corrigir:**

1. **Roadmap:** diz que os sistemas avançados de rotação ficam na Fase 3 e que a Fase 1 tem cerca de 10 telas. As telas já usam 5x1 por time e posições no saque, e são 16 desenhadas mais 12 faltando. Substituir pelo roadmap revisado abaixo.
2. **Sistema padrão:** "Livre (padrão)" vira "o padrão vem do modelo": Livre na Pelada e na Areia, 6x0 no Racha organizado, 5x1 no Treino (Pro).
3. **Pix:** o documento fala em QR; a decisão é copia e cola no MVP, QR opcional.
4. **Pro com "rating completo":** conflita com a cartinha grátis mostrando o nível. Trocar por "histórico completo além da temporada atual".
5. **Ranking do grupo:** sem critério, vazaria o nível privado. Definir: por vitórias, saldo e MVPs, nunca por nível.
6. **"Rating com IA":** o Glicko-2 é cálculo, não IA. Corrigir o nome.
7. **"Sem instalar nada":** a confirmação exige login. Trocar por "sem instalar o app; login uma vez na própria página".
8. **Tempos de criação de grupo:** 60 s num lugar e 90 s em outro. Unificar: 60 s até o grupo criado, 90 s até o 1º convite.
9. **Risco "limites do PWA":** já resolvido com o app nativo; tirar da tabela.
10. **Placar sem conta:** deixar explícito que o QR dá uma sessão temporária de Placar, só daquela partida.

**O que falta incluir:**

1. Como o Pro é cobrado: assinatura pelas lojas (App Store e Google Play); o Pix é só para a mensalidade e a diária do racha, nunca para o Pro.
2. Cartinha e perfil: estatísticas só do placar, opção de esconder nível e estatísticas, fluxo de foto (recorte, pincel, enquadramento).
3. Fila: "ninguém esperando, ninguém sai" e o que acontece quando os avulsos que saíram somam um time completo.
4. Rotação: o time que entra pela fila herda as posições de quem saiu; ajuste de formações no Pro.
5. Modelo "Do zero" na lista de modelos.
6. Limites do plano grátis: 1 modelo salvo e 2 resumos de IA por mês.
7. Glossário: Cartinha → PlayerCard, Formação → Formation, Saída parcial → PartialExit, Posição no saque → ServeAlignment, Rotação atual → RotationIndex, Quadra da rodada → CourtSession.
8. Seção "Arquitetura do app" (Expo e bibliotecas).
9. Métricas do produto: ativação (1ª rodada em até 7 dias), grupos ativos na semana 4, confirmações pelo link, partidas com placar no app, cartinhas e stories compartilhados, grupos criados por "Crie seu grupo", conversão para o Pro.
10. Privacidade e LGPD: exclusão de conta, exportar dados, consentimento da foto, termos.

## Arquitetura

A base aguenta o MVP; todas as funcionalidades novas cabem nela, mas 4 ajustes estruturais precisam ser feitos antes de codar porque mudam o modelo de dados.

| Funcionalidade | Situação | Ajuste |
|---|---|---|
| Rotação por time | Com ajuste | `TeamState` por time (sistema, escalação, levantador, rotação atual, banco); `MatchStarted` recebe um setup por time |
| Posições no saque | Com ajuste | Separar `RotationSlot` (1–6) de `CourtPoint` (x, y); `FormationTemplate` por sistema × rotação × sacando/recebendo, guardado como dado (JSON) compartilhado entre app e servidor; `OverlapValidator` com a regra oficial |
| Saída parcial da fila | Mudança estrutural | A fila atravessa partidas: o stream de eventos passa a ser da quadra da rodada (`CourtSession`), com as partidas dentro; fila mistura times e jogadores avulsos |
| Offline, desfazer e corrigir | Com ajuste | Envelope de evento com ID do celular, sequência e lote; desfazer é um evento (`RevertedTo`), nunca apaga |
| Placar sem conta (QR) | Falta desenho | Código de uso único → token próprio da API só para aquele stream; um celular escreve por vez; admin pode retomar |
| Estatísticas, MVP e rating | Com ajuste | Novo módulo Stats com projeções recalculáveis quando há correção; fórmula do MVP versionada |
| Cartinha com foto | Com ajuste | Faltava armazenamento: Cloudflare R2; recorte só no celular no MVP (servidor depois, fora do processo da API por custo) |
| Pro | Lacuna grave | Assinatura pelas lojas (RevenueCat) ligada ao grupo; Pix não serve para o Pro dentro do app |
| Convidado vira conta | Com ajuste | Tudo aponta para `MemberId`, nunca `UserId`; reivindicação por link e merge de membros |
| LGPD | Não suportado | Nenhum dado pessoal nos eventos (só IDs); exclusão e exportação de conta; denúncia de foto (exigência da Apple) |
| Pix, recorrência, push, IA | Suportado | Pequenos detalhes: chave Pix criptografada, job de recorrência idempotente, cota de IA por grupo |

**Os 4 ajustes antes do primeiro commit:**

1. **Stream por quadra da rodada (****`CourtSession`****)** em vez de por partida.
2. **Eventos gravam o resultado das regras** (quem saiu, quem entrou, nova posição). O servidor só aplica eventos, sem reimplementar toda a lógica em C#; isso corta pela metade o custo de manter dois motores.
3. **Versão em tudo:** `SchemaVersion` nos eventos, `rulesVersion` na partida e cópia congelada das configurações e formações no início da partida.
4. **Token de placar por stream** e regra de um celular escrevendo por vez.

**O que falta na stack:**

1. Cloudflare R2 para fotos e backups.
2. RevenueCat para a assinatura do Pro.
3. Observabilidade: Sentry no app e na API, logs estruturados.
4. Limite de requisições (já vem no ASP.NET Core).
5. Feature flags e versão mínima do app.
6. PostHog para medir o portão da Fase 2.
7. E-mail transacional (ex.: Resend).
8. Backup diário do banco.
9. Monorepo com `packages/match-engine` e `packages/volley-rules` (formações, faixas, testes golden).

**Atenção ao custo:** o Hangfire consulta o banco a cada poucos segundos e pode impedir o Neon grátis de dormir, consumindo a cota. Aumentar o intervalo de consulta ou mover o banco para o Railway.

## Roadmap revisado

O diferencial (quadra com fila, saída parcial e rotação por time) vai para a Fase 1; a cartinha com foto recortada também entra na Fase 1, por decisão do Gabriel; o que exige loja ou densidade de usuários fica para depois.

*[Diagrama: roadmap revisado · 3 fases, 1 portão — ver no doc original]*

No piloto o Pro fica liberado de graça para os grupos testarem o 5x1. Este roadmap substitui o do documento de produto.

## Decisões da revisão

Decididas em 30/10/2026: valem todas as recomendações, exceto a foto recortada, que entra na Fase 1.

| Decisão | Opções | Recomendação |
|---|---|---|
| Cobrança do Pro | Assinatura pelas lojas (Apple/Google ficam com 15–30%) ou venda só pela web | Lojas via RevenueCat; revisar se R$ 9,90 ainda fecha a conta depois da taxa |
| Admin vê o nível dos jogadores no sorteio? | Sim, privado ao admin, ou só a média do time | Admin vê (precisa ajustar o sorteio), nunca na imagem compartilhada |
| Avulsos que saíram somam um time | Forma time por ordem de chegada ou por equilíbrio de nível | Ordem de chegada no MVP |
| Placar por QR para quem não tem o app | Pedir instalação ou placar web simplificado | Pedir instalação no MVP |
| Rating por modalidade | Um nível só ou separado quadra x areia | Separado |
| 5x1 no piloto | Liberar o Pro grátis para os grupos do piloto ou deixar só Livre/6x0 | Pro grátis no piloto |
| Foto recortada | Fase 1 (aumenta o escopo) ou Fase 2 com foto simples enquadrada no piloto | Fase 1 (decidido) |
