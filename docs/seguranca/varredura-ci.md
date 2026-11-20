# Varredura de segurança na CI

Decisões e alternativas: ADR 0007. Aqui ficam as ferramentas, as exceções vigentes e a resposta a vazamento.

## Ferramentas

| O que | Onde | Reprova quando |
|---|---|---|
| Segredos: gitleaks, binário com SHA-256 fixado no `ci.yml` | Job `secrets`, em todo PR e em todo push na `main`, inclusive só de docs | Qualquer achado em todo o histórico do `HEAD`, inclusive no diff de commit de merge (`-m`) |
| Dependências npm: `pnpm audit --audit-level high` | Fim do `verify` | High ou Critical não excetuado, ou falha do registro |
| Dependências NuGet: `pnpm audit:api` (`dotnet list ... --vulnerable` lido por `scripts/check-dotnet-audit.mjs`), sobre `Sacou.slnx` e, em segundo relatório, sobre `Sacou.Integration.Tests`, que fica fora da solução e traz `Npgsql` e o Testcontainers (ADR 0020). `--vulnerable` lista só o que é vulnerável: relatório sem pacotes não é falta de cobertura, e o caminho do projeto no relatório prova que foi lido | Fim do `verify` | High ou Critical não excetuado, severidade desconhecida, JSON inválido, sem `projects` ou com `problems` |
| NuGet na restauração: `NU1903` e `NU1904` viram erro (`NuGetAuditLevel=high`, avisos como erro) | Todo `dotnet restore` ou `build` | High ou Critical não suprimido |
| Política npm: `pnpm test:tooling` (`scripts/lib/npm-audit-policy.mjs`) | `verify` | O YAML é lido com parser (`js-yaml`, versão exata). Entrada de `audit.ignore` vencida, com validade acima de 180 dias contados da execução, sem par em `scripts/npm-audit-exceptions.json` ou par sem entrada; GHSA em outro ponto de `pnpm-workspace.yaml`; catálogo nomeado em qualquer dependência; `zod` abaixo de 4.6.6 declarado na raiz, em `apps/` ou `packages/`, inclusive por alias, catálogo, URL ou `github:`, ou travado nos `importers` do lockfile sob qualquer nome |
| Origem dos pacotes npm: `pnpm test:tooling` (`scripts/lib/pnpm-lockfile.mjs`) | `verify` | `resolution` com `tarball:` fora de `https://registry.npmjs.org` em `pnpm-lock.yaml` |
| Origem e travamento NuGet: `nuget.config` com `<clear/>` e `packageSourceMapping`, `packages.lock.json` por projeto, `RestoreLockedMode` com `CI=true` | Todo `dotnet restore`, `build` ou `test` na CI | `NU1004`: lockfile diferente do que os projetos pedem. Mudou pacote: rodar `dotnet restore` e fazer commit dos `packages.lock.json` |
| Análise estática C#: `AnalysisModeSecurity=All` | `lint:api` | Regra de segurança violada, como `CA5351` (MD5) |
| Análise estática TS/JS: `no-eval`, `no-new-func`, `@typescript-eslint/no-implied-eval` | `lint`, provado em `lint:regression` | Código montado a partir de texto |

**Sem execução agendada, por decisão do Gabriel:** os alertas do Dependabot avisam de CVE novo, mas a CI só reprova no próximo run com código, e pode reprovar um PR sem relação com ele.

## Rodar localmente

Baixe o binário do gitleaks do release, confira o SHA-256 com `gitleaks_<versão>_checksums.txt` e use o mesmo comando do `ci.yml`. Depois: `pnpm audit --audit-level high`, `pnpm audit:api` e `pnpm test:tooling`.

## Regras para exceções

Nenhuma existe por padrão. Toda exceção exige inspeção, motivo e revisor; as de CVE exigem também validade. Aprovar exceção de CVE cabe ao Gabriel. O diff que tocar a barreira exige leitura explícita do revisor; a lista completa está em `docs/padroes/commits-e-prs.md`.

| Caso | Mecanismo |
|---|---|
| Falso positivo do gitleaks | Fingerprint global, `arquivo:regra:linha`, em `.gitleaksignore`: com `-m`, o mesmo achado volta no commit de merge, cujo SHA muda a cada execução de PR. `paths` em `.gitleaks.toml` só para arquivo específico, nunca pasta inteira |
| `gitleaks:allow` na linha | Proibido: `--ignore-gitleaks-allow` faz a linha reprovar mesmo assim |
| Advisory npm sem correção | `audit.ignore` com o GHSA em `pnpm-workspace.yaml`, par em `scripts/npm-audit-exceptions.json` (`advisory`, `reason`, `expires`) e entrada na tabela abaixo. O pnpm não controla a validade: `pnpm test:tooling` reprova a partir do dia seguinte a `expires` e quando `expires` passa de 180 dias contados da execução, em execução com código |
| Advisory NuGet sem correção | `<NuGetAuditSuppress>` com a URL e entrada igual em `scripts/nuget-audit-exceptions.json` (`advisory`, `reason`, `expires`). O script controla a validade |
| Sonda da CI | Nenhuma exceção: a regra `sacou-ci-probe` existe só para reprovar, e o valor nunca chega à `main` |

## Exceções e correções vigentes

| Advisory | Pacote e caminho | Tratamento | Motivo | Validade |
|---|---|---|---|---|
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (High) | `zod` 3.25.76, por `@expo/cli` (exige `^3.25.76`) e `eslint-plugin-react-hooks` | Exceção em `audit.ignore`, aprovada pelo Gabriel em 01/11/2026 | A árvore não permite correção: não há 3.x corrigido, e `@expo/cli` (última e canary) exige `^3.25.76`. Forçar a 4.x troca a major de uma ferramenta de build fora da faixa declarada. Não é alcançável pelo app nem pelos pacotes: análise no ADR 0007 | 31/01/2027, ou antes: **a tarefa que trouxer Zod para o app** (`docs/decisoes.md`) instala versão ≥ 4.6.6 e revê esta linha, porque a exceção vale por GHSA e esconderia um uso direto vulnerável; `test:tooling` reprova declaração abaixo disso e também a data vencida |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) (High) | `deepmerge-ts` 7.1.6, por `eslint-plugin-functional` 10.0.1 (última, pede `^7.1.5`) | Correção: `overrides` de `eslint-plugin-functional>deepmerge-ts` para 8.0.2 em `pnpm-workspace.yaml`, sem exceção | Só o lint usa o pacote, e `lint` e `lint:regression` passam com a 8.x | Retirar o override quando o plugin aceitar a 8.x |

**Falso positivo do gitleaks:** `apps/mobile/src/api/generated/contract-hash.ts:generic-api-key:5` em `.gitleaksignore` (E4.2). O valor é o hash público do `v1.json`, gravado pelo gerador para o `buster` do cache, e muda a cada contrato; não é chave nem segredo. `apps/api/tests/Sacou.Integration.Tests/Matches/CourtStreamTests.cs:generic-api-key:248` (E3.7): `unknownKeyMarker42` é o nome de uma propriedade desconhecida que o teste L1 manda e confere que nunca chega a um log; não é chave nem segredo. `apps/api/src/Sacou.Api/appsettings.json:gcp-api-key:12` (E3.12 Parte 3): a chave da configuração Web pública do Firebase (ADR 0070, D4), que vai ao navegador em todo caso e é restrita por referenciador HTTP; não é segredo.

Abaixo de High, ficam só no relatório do `pnpm audit`, sem reprovar: `deepmerge` (Low), `minimatch` e `glob` (Moderate), todos em ferramentas de desenvolvimento.

## Resposta a vazamento

1. **Parar e avisar o Gabriel, sem citar o valor** em chat, PR, issue ou log. Só o arquivo, o commit e a regra.
2. **Considerar o segredo vazado e revogá-lo no provedor.** Apagar a branch não basta: `refs/pull/<n>/head` segue no GitHub, e o histórico já pode ter sido clonado. O Gabriel faz a revogação e o novo cadastro (`docs/seguranca/segredos.md` lista só os nomes).
3. Rever os logs do provedor no período exposto.
4. Reescrever o histórico só com autorização do Gabriel, depois da revogação.
5. Registrar o caso no diário da sessão, sem o valor.

## Limites conhecidos

- **Guardas da E0.6:** casam texto (`ci.yml`, compose, código do teste), sem parser YAML. Detectam remoção acidental; não impedem um PR adversário, cuja barreira é a leitura obrigatória do `ci.yml`.
- O gitleaks não vê título nem descrição de PR, nem conteúdo binário.
- **Merge:** o `-m` cobre o valor colocado só na resolução, e cada achado de merge aparece uma vez por pai. `leaks found` conta achados, não valores.
- **CI por área no push da `main`:** a CI por área também vale no push da `main`: um merge só de `apps/mobile/` não roda `audit:api`. É seguro, porque arquivo desconhecido e `.github/` rodam tudo. Soma ao "sem execução agendada": CVE novo do NuGet só reprova no próximo PR da API (revisão do M3, M3-I1).
- **Validade:** só é cobrada em execução com código. Sem execução agendada, uma exceção vencida não reprova nada até o próximo PR com código.
- Sem proteção de branch, um PR pode editar o próprio workflow ou o `.gitleaks.toml`, pois o `pull_request` usa a versão do PR. A barreira é a leitura do revisor.
- `refs/pull/<n>/head` das sondas continua no GitHub: por isso o valor delas é fictício, gerado na hora e descartado.
- **Teto de validade:** conta da data de execução, então uma exceção pode ser renovada a cada 180 dias, sempre com nova decisão do Gabriel. Vale só para o npm: `scripts/nuget-audit-exceptions.json` segue sem teto.
- **Checagem do `zod`:** não cobre versão transitiva, nem `overrides` que forcem uma versão. Uma URL opaca, sem `zod` no texto, só é pega no lockfile. O formato de dependência git no lockfile segue o documentado para a versão 9.0: o pnpm 12.16.1 não conseguiu gravar esse lockfile (01/11/2026).
- **Origem npm:** a checagem lê só `tarball:`. `resolution` do tipo `git` não é reprovada, e uma entrada só com `integrity` depende do registro configurado.
- **Actions:** a configuração do repositório exige SHA e só aceita `actions/cache`, `actions/checkout`, `actions/setup-dotnet`, `actions/setup-node` e `pnpm/action-setup`. Action nova exige incluí-la na lista, fora do PR.
