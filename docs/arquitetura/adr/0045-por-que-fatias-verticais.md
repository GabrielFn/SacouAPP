# ADR 0045 · Por que fatias verticais no back-end

**Status:** aceito (11/11/2026). **Tarefa:** nenhuma; pedido do Gabriel para registrar o motivo de uma decisão já tomada.

**Fontes:** `decisoes.md:25`; `produto.md:240, 305`. Estrutura no [ADR 0005](0005-estrutura-modular-api.md); padrões no [ADR 0011](0011-backend-patterns.md).

## Contexto

A organização em fatias verticais foi decidida em 30/10/2026 (`decisoes.md:25`), mas os documentos só dizem **o que** ela é, não **por que** foi escolhida. Este ADR registra o motivo. Ele não muda nada da estrutura.

## Decisão

Cada funcionalidade de um módulo é uma pasta `internal` com endpoint, request, handler e validação (ex.: `Groups/CreateGroup/`). As fatias de um módulo compartilham o `Domain/` dele, onde ficam os agregados e as regras. A fatia orquestra e o domínio decide. A alternativa seria separar o código por camadas técnicas (controllers, services, repositórios).

## Motivos

1. **Mudança num lugar só.** Uma funcionalidade muda numa pasta, sem espalhar a alteração por várias camadas.
2. **Encaixa no ciclo de agentes ([ADR 0019](0019-agent-process.md)).** Uma tarefa do backlog vira uma ou poucas fatias: o brief cobre poucos arquivos (leitura dirigida), as branches em paralelo quase não se cruzam e o PR é fácil de revisar.
3. **Cada fatia só tem o que precisa.** A leitura vai direto à projeção com `AsNoTracking`; o comando com regra passa pelo domínio (CQRS leve, ADR 0011). Não existem service e repositório genéricos por endpoint.
4. **Sem MediatR.** O handler é injetado direto no endpoint, que era o principal papel do MediatR, recusado por causa da licença (ADR 0011).
5. **Fácil de apagar.** Uma funcionalidade que não der certo no piloto sai inteira com a remoção da pasta.

**DDD enxuto junto das fatias.** Agregados só onde há regra de verdade (Group, Round, CourtSession). Módulos de CRUD, como Identity e Payments, podem ter fatias sem agregado.

## Alternativas descartadas

**Camadas técnicas (Clean Architecture ou N camadas):** uma funcionalidade se espalha por vários projetos e pastas, cria abstrações sem uso e deixa as tarefas dos agentes maiores e mais sujeitas a conflito.

## Consequências

- **Código parecido entre fatias é aceito.** Só se extrai o que se repete de verdade. O portão de duplicação da CI (`jscpd`, [ADR 0035](0035-portoes-de-qualidade.md)) avisa quando a repetição passa do limite.
- As fatias são `internal`: outro módulo só enxerga o `Contracts` (ADR 0005).
- Os testes da fatia ficam em `tests/Sacou.Modules.<Module>.Tests/<Slice>/`, fora da pasta da fatia, para o xUnit não ir para produção (ADR 0005).
