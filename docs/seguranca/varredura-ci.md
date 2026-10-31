# Varredura de segurança na CI

Decisões e alternativas: ADR 0007. Aqui ficam as ferramentas, as exceções vigentes e a resposta a vazamento.

## Ferramentas

| O que | Onde | Reprova quando |
|---|---|---|
| Segredos: gitleaks, binário com SHA-256 fixado no `ci.yml` | Job `secrets`, em todo PR e em todo push na `main`, inclusive só de docs | Qualquer achado em todo o histórico do `HEAD` |
| Dependências npm: `pnpm audit --audit-level high` | Fim do `verify` | High ou Critical não excetuado, ou falha do registro |
| Dependências NuGet: `pnpm audit:api` (`dotnet list ... --vulnerable` lido por `scripts/check-dotnet-audit.mjs`) | Fim do `verify` | High ou Critical não excetuado, severidade desconhecida, JSON inválido, sem `projects` ou com `problems` |
| NuGet na restauração: `NU1903` e `NU1904` viram erro (`NuGetAuditLevel=high`, avisos como erro) | Todo `dotnet restore` ou `build` | High ou Critical não suprimido |
| Análise estática C#: `AnalysisModeSecurity=All` | `lint:api` | Regra de segurança violada, como `CA5351` (MD5) |
| Análise estática TS/JS: `no-eval`, `no-new-func`, `@typescript-eslint/no-implied-eval` | `lint`, provado em `lint:regression` | Código montado a partir de texto |

**Sem execução agendada:** um CVE novo só aparece no próximo run com código, e pode reprovar um PR sem relação com ele.

## Rodar localmente

Baixe o binário do gitleaks do release, confira o SHA-256 com `gitleaks_<versão>_checksums.txt` e use o mesmo comando do `ci.yml`. Depois: `pnpm audit --audit-level high`, `pnpm audit:api` e `pnpm test:tooling`.

## Regras para exceções

Nenhuma existe por padrão. Toda exceção exige inspeção, motivo e revisor; as de CVE exigem também validade. O diff que tocar `.gitleaks.toml`, `.gitleaksignore`, as listas de exceção ou o `ci.yml` exige leitura explícita do revisor (`docs/padroes/commits-e-prs.md`).

| Caso | Mecanismo |
|---|---|
| Falso positivo do gitleaks | Fingerprint em `.gitleaksignore`; `paths` em `.gitleaks.toml` só para arquivo específico, nunca pasta inteira |
| `gitleaks:allow` na linha | Proibido: `--ignore-gitleaks-allow` faz a linha reprovar mesmo assim |
| Advisory npm sem correção | `audit.ignore` com o GHSA em `pnpm-workspace.yaml` e entrada na tabela abaixo. O pnpm não controla a validade: quem chega à data revê a entrada |
| Advisory NuGet sem correção | `<NuGetAuditSuppress>` com a URL e entrada igual em `scripts/nuget-audit-exceptions.json` (`advisory`, `reason`, `expires`). O script controla a validade |
| Sonda da CI | Nenhuma exceção: a regra `sacou-ci-probe` existe só para reprovar, e o valor nunca chega à `main` |

## Exceções e correções vigentes

| Advisory | Pacote e caminho | Tratamento | Motivo | Validade |
|---|---|---|---|---|
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (High) | `zod` 3.25.76, por `@expo/cli` (exige `^3.25.76`) e `eslint-plugin-react-hooks` | Exceção em `audit.ignore`, **pendente de decisão do Gabriel** | A árvore não permite correção: não há 3.x corrigido, e `@expo/cli` (última e canary) exige `^3.25.76`. Forçar a 4.x troca a major de uma ferramenta de build fora da faixa declarada. Não é alcançável pelo app nem pelos pacotes: análise no ADR 0007 | 31/01/2027, ou antes: **a tarefa que trouxer Zod para o app** (`docs/decisoes.md`) instala versão ≥ 4.6.6 e revê esta linha, porque a exceção vale por GHSA e esconderia um uso direto vulnerável |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) (High) | `deepmerge-ts` 7.1.6, por `eslint-plugin-functional` 10.0.1 (última, pede `^7.1.5`) | Correção: `overrides` para 8.0.2 em `pnpm-workspace.yaml`, sem exceção | Só o lint usa o pacote, e `lint` e `lint:regression` passam com a 8.x | Retirar o override quando o plugin aceitar a 8.x |

Abaixo de High, ficam só no relatório do `pnpm audit`, sem reprovar: `deepmerge` (Low), `minimatch` e `glob` (Moderate), todos em ferramentas de desenvolvimento.

## Resposta a vazamento

1. **Parar e avisar o Gabriel, sem citar o valor** em chat, PR, issue ou log. Só o arquivo, o commit e a regra.
2. **Considerar o segredo vazado e revogá-lo no provedor.** Apagar a branch não basta: `refs/pull/<n>/head` segue no GitHub, e o histórico já pode ter sido clonado. O Gabriel faz a revogação e o novo cadastro (`docs/seguranca/segredos.md`, quando existir, lista só os nomes).
3. Rever os logs do provedor no período exposto.
4. Reescrever o histórico só com autorização do Gabriel, depois da revogação.
5. Registrar o caso no diário da sessão, sem o valor.

## Limites conhecidos

- O gitleaks não vê título nem descrição de PR, nem conteúdo binário.
- Sem proteção de branch, um PR pode editar o próprio workflow ou o `.gitleaks.toml`, pois o `pull_request` usa a versão do PR. A barreira é a leitura do revisor.
- `refs/pull/<n>/head` das sondas continua no GitHub: por isso o valor delas é fictício, gerado na hora e descartado.
