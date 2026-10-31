# ADR 0003 · Validação local em clone limpo até a CI existir

**Status:** aceito (30/10/2026), temporário: vale até a E0.4 existir. **Tarefa:** E0.5. **Decidido por:** orquestrador, sem consulta ao Gabriel.

## Contexto

O item 3 da definição de pronto exige CI verde, mas a CI só nasce na E0.4. As tarefas anteriores a ela não teriam como cumprir o item, e a E0.4 depende de tarefas que precisam entrar antes.

## Decisão

Até a E0.4 existir, a CI verde é substituída por validação local em clone limpo: os comandos de instalação, build, lint e testes da seção "Comandos" do `CLAUDE.md` rodam num clone novo da branch e todos saem com 0. A execução do testador é a que conta para o merge.

Quando a E0.4 entrar, a CI volta a ser a exigência, sem mudar o texto da definição de pronto.

## Alternativas

- **Antecipar a E0.4:** não resolve, porque ela depende da E0.3, que também precisa entrar antes de haver CI.
- **Rodar na working copy, sem clone limpo:** arquivos ignorados e caches locais podem esconder falhas que um clone novo mostraria.

## Consequências

- Tarefas entram na `main` sem prova em Linux: a validação local só cobre o sistema da máquina. A pendência da E0.4 em `docs/estado/progresso.md` cobre essa diferença.
- A prova depende do relato do testador, não de um registro público da CI.
