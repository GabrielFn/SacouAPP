# E6.6 · Pedido

Linha literal do backlog (`docs/plano-mvp.md`, linha 196):

> | E6.6 | "Denunciar" no app (lacuna G4, pergunta 221). ~400 linhas | Na tela do membro e do grupo, "Denunciar" manda só IDs (grupo, membro, motivo de lista fechada) a uma tabela que o Gabriel lê; "Remover membro" do admin segue como a ação; sem texto livre nem dado pessoal no registro. Bloqueia o teste fechado e a produção da Play | E3.2, E4.5 |

Origem: lacuna G4 de `.specs/features/E6.2/plan.md` ("Denunciar conteúdo no app (pergunta 221) | ~300 a 600 linhas, conforme a opção | teste fechado e produção da Play").

Resposta 221 (`docs/estado/perguntas.md`): "Denúncia de conteúdo (apelido, nome do grupo, local, convidado): **Recomendação:** 'Denunciar' no app antes do teste fechado; no teste interno, só o canal do encarregado."

Brief do orquestrador (25/11/2026): propor o mais simples que cumpre a política de UGC da Google Play para um piloto pequeno; conferir se `design/mvp/` tem a tela e, se não, propor onde fica o botão. Perguntas 232 a 234.

Capturas: nenhuma. `design/mvp/` e `design/telas/` não têm "Denunciar" (grep em 25/11/2026). As telas tocadas são `design/mvp/MembroOpcoes.dc.html` (folha 19c) e `design/mvp/AjustesGrupo.dc.html` (tela 18), que não desenham o botão.
