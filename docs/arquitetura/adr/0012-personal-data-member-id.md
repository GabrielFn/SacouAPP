# ADR 0012 · Dados pessoais: `MemberId` e LGPD

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:28`; `revisao-mvp.md:114-115`; `produto.md:360, 369-375`.

## Contexto

Os eventos nunca são apagados ([ADR 0009](0009-court-session-event-sourcing.md)), e o convidado sem conta também joga e acumula histórico (`revisao-mvp.md:114`).

## Decisão

- **Nada pessoal nos eventos,** só IDs. Tudo aponta para `MemberId`, nunca `UserId`.
- **Convidado vira conta** por reivindicação por link e merge de membros.
- **Exclusão de conta dentro do app:** apaga perfil, foto e usuário no Firebase; o histórico fica como "Ex-jogador".
- **Exportação** dos dados da pessoa, termos e política de privacidade, canal do encarregado de dados.
- **Consentimento** para mostrar foto e nível na cartinha; nível privado garantido na API, não só na tela.
- **Denúncia, bloqueio e remoção de foto.**
- **Chave Pix criptografada no banco; logs sem e-mails nem tokens.**

## Alternativas

Sem alternativa documentada.

## Consequências

O inventário está em [`dados-pessoais.md`](../../seguranca/dados-pessoais.md).

**A definir:**

- Retenção e base legal de cada dado, inclusive em backups: [`perguntas.md`](../../estado/perguntas.md), item 2.
- Encarregado de dados e contato: `perguntas.md`, item 3.
- Provedor de IA, que pode receber dados: `perguntas.md`, item 4.
- ~~Local do tipo `MemberId`~~: **resolvido** no [ADR 0040](0040-grupos-membros-papeis-e-autorizacao.md) (D2), tipo do domínio do Groups, `Guid` entre módulos.
- Formato da exportação (E3.16) e efeito da exclusão em backups e serviços de terceiros (E6.2).
