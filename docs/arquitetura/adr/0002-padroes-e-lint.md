# ADR 0002 · Padrões de código e lint

**Status:** aceito (30/10/2026). **Tarefa:** E0.3. As regras em uso estão em [`docs/padroes/codigo.md`](../../padroes/codigo.md).

## Contexto

O `CLAUDE.md` pede TS strict sem `any`, C# com nullable e avisos como erro, sem números mágicos, imutabilidade, sem MediatR e AutoMapper, e `match-engine` e `volley-rules` puros. O que puder ser conferido por ferramenta não deve depender da atenção do revisor. O repositório roda em Windows e no Ubuntu da CI, com o mesmo resultado nos dois.

## Decisões

**ESLint 9.39.5, não 10.** O `eslint-config-expo` 58.0.4 traz `eslint-plugin-react` e `eslint-plugin-import`, que não suportam a 10 (ela removeu `context.getFilename()`). **Condição de saída:** subir para a 10 quando o `eslint-config-expo` deixar de depender de plugins sem suporte. Não forçar com `overrides`.

**Versões travadas em conjunto.** `typescript-eslint` 8.72.1 aceita TS `>=4.8.4 <6.1.0`: subir o TypeScript exige olhar as duas versões. `@eslint/js` acompanha a versão do `eslint`; precisa ser declarado na raiz, porque o `isolated` não expõe dependência transitiva.

**Um único `eslint.config.mjs` na raiz.** O ESLint 9 sobe a partir do diretório atual até achar a configuração, então `eslint .` funciona em cada pacote. Pacotes declaram só `eslint`; plugins ficam na raiz. O preset do Expo entra com `extends` limitado a `apps/mobile/**`, para regras de React não valerem nos pacotes puros. `eslint.config.mjs` está em `globalDependencies` do Turborepo, e a tarefa `lint` tem `dependsOn: ["^build"]`, porque o lint com tipos lê o `dist/*.d.ts` do workspace.

**Prettier separado, sem `eslint-plugin-prettier`.** `printWidth` 100, porque o código do repositório já passa de 80 colunas. `eslint-config-prettier` fica por último no ESLint.

**Fim de linha, em três camadas.**

1. **Índice:** o `.gitattributes` é a autoridade. `pnpm check:eol` lê `git ls-files --eol` e falha com `i/crlf` ou `i/mixed`. Ignora o estado do disco (`w/`), para CRLF só local não gerar falso erro, e ignora `i/-text` (arquivos binários).
2. **Formatadores:** `end_of_line = lf` no `.editorconfig` e `endOfLine: "lf"` no Prettier. Sem a chave, o `dotnet format` usa o padrão do sistema e divergiria entre Windows e Ubuntu.
3. **Escopo:** `.prettierignore` deixa fora `design/`, `docs/`, `.claude/`, Markdown, `pnpm-lock.yaml` e `apps/api/`. Assim o CRLF antigo de arquivos locais não reprova o `format:check`.

**Banimento de MediatR e AutoMapper por MSBuild.** Em `Directory.Build.targets`, um alvo depois de `ResolveAssemblyReferences` dá erro se alguma referência resolvida tiver nome que case com `(?i)^(MediatR|AutoMapper)(\.|$)`. Pega referência direta e transitiva sem pacote novo, e não dispara para nomes parecidos, como `Slapper.AutoMapper`.

**Analisadores .NET com `AnalysisLevel=10.0-recommended`.** O nível fixo impede que um patch do SDK crie aviso novo e quebre o build. `GenerateDocumentationFile` é exigido pelo IDE0005 no build, com `CS1591` desligado para não obrigar XML doc em tudo.

**Sem regra de número mágico em C#.** Não há regra nativa; o S109 exigiria o SonarAnalyzer, com muito ruído para o tamanho atual. Fica como item do revisor.

**`dotnet format Sacou.slnx`, com a solução explícita.** A documentação do `dotnet format` só cita busca por `*proj` e `*sln`. Testado com o SDK 10.0.403: funciona e reprova indentação errada.

**`allowBuilds`.** O `unrs-resolver`, via `eslint-import-resolver-typescript` do preset do Expo, tem `postinstall`. Fica com `false`, conforme o ADR 0001. O pacote traz o binário nativo pré-compilado e o lint do app passa sem o script.

**`@types/node` fora dos pacotes puros, por enquanto.** O lint permite `node:*` em testes, mas sem esses tipos o `tsc` e as regras `no-unsafe-*` reprovam o uso. Quem escrever o primeiro golden que lê arquivo soma `@types/node` ao pacote; `no-restricted-imports` e `no-restricted-globals` seguem barrando Node e `process` no código de produção.

## Ajustes de regra

Nenhum além do previsto: `functional/*` e `no-magic-numbers` não geraram ruído no código atual. Regra que passar a gerar ruído em código legítimo se ajusta na configuração e se registra aqui, com o motivo, em vez de `eslint-disable` espalhado.

## Consequências

- `pnpm lint` compila os pacotes antes e levou de 27 s a 1min20s sem cache nesta máquina; com cache, menos de 1 s. Se pesar na CI, reavaliar na E0.4.
- `react-hooks/refs` (do preset do Expo) reprova `ref.current =` durante o render, mesmo com a exceção do `functional/immutable-data`. Em efeito ou evento, passa.
- A E0.2 precisa conferir o `lint:api` quando os módulos entrarem. Se `10.0-recommended` ficar barulhento, ajustar por regra no `.editorconfig`, com motivo; nunca desligar a categoria inteira.
- Aviso `NU190x` de vulnerabilidade também quebra o build com avisos como erro: a E0.9 decide o tratamento.
- A E0.4 deve rodar `check:eol`, `format:check`, `lint` e `lint:api`, e confirmar o resultado no Ubuntu.
