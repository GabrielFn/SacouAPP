# ADR 0001 · Monorepo com pnpm e Turborepo

**Status:** aceito (30/10/2026). **Tarefa:** E0.1.

## Contexto

`docs/decisoes.md` define o monorepo pnpm + Turborepo com `apps/mobile`, `apps/api`, `packages/match-engine` e `packages/volley-rules`. O build precisa passar de um clone limpo, em Windows e no Ubuntu da CI (E0.4), sem depender de nada da máquina.

## Decisões

**Versões.** Node `>=22.13.0 <23` (`.nvmrc` 22.20.0), pnpm 12.16.1, Turborepo 2.11.10, Vitest 5.0.5 + Vite 8.3.5, Expo SDK 58 (`expo ~58.0.21`, React 19.3.0, React Native 0.88.1), .NET SDK 10.0.403 (`global.json`, só patches mais novos), xUnit v3 (`xunit.v3.mtp-v2` 4.0.2) sobre Microsoft Testing Platform. Versões JS compartilhadas ficam em `catalog:`; as NuGet, em `Directory.Packages.props`.

**TypeScript 6.0.3, não 7.** O template do SDK 58 fixa `~6.0.3`, e ferramentas que usam a API do compilador (typescript-eslint, na E0.3) ainda dependem da 6.

**`nodeLinker` padrão (`isolated`).** O Expo suporta instalação isolada e configura o Metro sozinho, então não há `metro.config.js` nem hoisting. O `isolated` também barra dependência não declarada. **Plano B:** se um build nativo (M3) falhar por resolução de módulo mesmo após investigar a causa, trocar para `nodeLinker: hoisted`, reinstalar e registrar aqui.

**`pnpm build` = `turbo run build`.** Pacotes: `tsc` gera `dist/` (ESM + `.d.ts`), consumido via `exports`. App: `tsc --noEmit && expo export --platform android --output-dir dist`, que não exige conta Expo e prova que o Metro resolve os pacotes do workspace. Android basta aqui; `expo export` não substitui o build nativo.

**Tsconfigs da raiz em `globalDependencies`.** O Turborepo só considera os arquivos da pasta de cada pacote, então `tsconfig.base.json` e `tsconfig.lib.json` precisam ser declarados no `turbo.json`; sem isso, mudar o rigor do TypeScript reaproveitaria o cache. Outra configuração compartilhada que afete build ou teste deve entrar na mesma lista.

**API fora do Turborepo.** `apps/api` não tem `package.json` e não entra no workspace do pnpm, então `pnpm build` não exige .NET, o MSBuild usa seu próprio cache incremental e a CI pode separar os jobs. `Sacou.slnx` na raiz faz `dotnet build` e `dotnet test` funcionarem ali; `pnpm build:api` e `pnpm test:api` são atalhos.

**Fim de linha LF em todo o repositório** (`.gitattributes`), para o clone se comportar igual em Windows e Ubuntu.

**`allowBuilds`: nenhum pacote aprovado.** O pnpm 11+ falha a instalação diante de script não revisado (`strictDepBuilds`), mas nenhuma dependência atual tem script de instalação, então a chave não foi declarada. Dependência nova com script deve entrar em `allowBuilds` com `false`; `true` só se o build ou teste quebrar sem ele, com o motivo registrado aqui. Não desligar `strictDepBuilds` nem reduzir `minimumReleaseAge`.

**Atualização (E0.3).** Os scripts novos de instalação trazidos pelo lint ficaram em `allowBuilds` com `false`; a lista e o motivo estão no [ADR 0002](0002-padroes-e-lint.md).

## Consequências

- O app declara `@sacou/*` como `workspace:*`; os pacotes precisam ser compilados antes (`^build` no Turborepo).
- `PACKAGE_NAME` nos pacotes é provisório. O app depende dele até E1.1 e E2.1 o substituírem por uso real: o `testID` em `apps/mobile/App.tsx` existe só para manter os imports no bundle. **Resolvido:** a E1.1 o removeu de `volley-rules` e a E2.1, de `match-engine`; o `testID` usa `FORMATION_SYSTEMS` e `CURRENT_EVENT_SCHEMA_VERSION`.
- O `CLAUDE.md` traz o `export` completo do ambiente local (PATH do .NET, `NUGET_PACKAGES`, `TEMP`, `TMP`), mais do que a nota do PATH prevista no plano, porque cada sessão começa do zero e o C: tem pouco espaço.
- O build com Hermes só foi validado em Windows; a E0.4 confirma no Ubuntu e deve ler as versões de `packageManager`, `.nvmrc` e `global.json`, sem repetir.
- Compatibilidade do Unistyles com o RN 0.88: resolvida na E4.1 com o plano B, ver [ADR 0034](0034-estilos-e-temas-no-app.md).
