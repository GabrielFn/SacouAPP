# ADR 0083 · Termos de uso e política de privacidade publicados pela API

**Status:** aceito (24/11/2026), E6.1. **Decidido por:** desenvolvedor, dentro da arquitetura aprovada, com o plano do analista ([plano](../../estado/tarefas/E6.1.md)) e o padrão adotado nas perguntas 198 a 203. Os textos são **rascunho 0.1 para revisão jurídica**.

## Contexto

A tela 02 diz "Ao entrar você aceita os Termos e a Política de Privacidade" e a folha de login das páginas `/r` e `/c` repete a frase; até aqui, sem documento (pergunta 62). Não há domínio no piloto (resposta 125), e a API já serve páginas anônimas na origem `*.run.app` (ADR 0070). A política precisa dizer o que o código faz de fato (`docs/seguranca/dados-pessoais.md`).

## Decisões

**D1 · Onde.** `GET /termos` e `GET /privacidade`, Razor Pages da própria API, como a `/r` (ADR 0070). Mesma origem que o app já conhece pelo `EXPO_PUBLIC_INVITE_BASE_URL`; sem serviço, conta nem gasto novo. Descartados: GitHub Pages (outra origem e duas fontes da versão), Firebase Hosting e R2 (serviço novo). Quando vier o domínio, as rotas mudam junto com `/r` e `/c`.

**D2 · Fonte única.** `docs/legal/termos-de-uso.md` e `docs/legal/politica-de-privacidade.md`, embutidos no `Sacou.Api` como recurso (`Sacou.Api.Legal.<arquivo>`); o `Dockerfile` copia `docs/legal/` antes do `dotnet publish` e o `.dockerignore` libera só `docs/legal/*.md` (teste de arquitetura). Um teste confere que o recurso embutido é o arquivo do repositório. Mudar o texto é um PR que só troca `docs/legal/` e sobe a versão; o código não muda.

**D3 · Leitor restrito, sem HTML.** `LegalDocumentParser` lê só o trecho entre `<!-- publicar:inicio -->` e `<!-- publicar:fim -->` e **nunca** as linhas que começam com `>` (notas de revisão). Aceita: o título `# ` (uma vez, primeiro), `Versão:` e `Atualizada em: DD/MM/AAAA` logo abaixo, `##` e `###`, parágrafos (linhas unidas com espaço) e itens `- ` de uma linha. Recusa, com `Result` e a linha: HTML (`<`), link e imagem, tabela (`|`), ênfase (`**`, `__`), código (`` ` ``), `####`, outra lista, item que continua na linha seguinte, cabeçalho repetido ou fora do lugar, data inválida, marcadores ausentes, repetidos ou invertidos, trecho vazio. O resultado são blocos de texto puro (`LegalBlock`, fechado); a página os codifica com o Razor, sem `Html.Raw` (teste de arquitetura), e não confia no leitor (teste com texto hostil num `ILegalDocuments` falso).

**D4 · Falha na partida.** `LegalDocuments` (singleton por `ILegalDocuments`) lê os dois textos uma vez; o `Program` o resolve logo depois do `Build` (`ReadSacouLegalDocuments`), sem serviço em segundo plano (ADR 0068, D2). Um texto recusado derruba a partida com o arquivo, a linha e o motivo, nunca o conteúdo da linha: um deploy com documento inválido não responde.

**D5 · Cabeçalhos.** Os mesmos da `/r` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin`, `X-Robots-Tag: noindex, nofollow`, `Permissions-Policy`), com uma CSP própria e mais fechada: `default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'`. A página não tem script. `Cache-Control: no-cache` (texto público que muda a cada deploy; a `/r` segue `no-store`). Anônimas, só GET e HEAD, no limitador `round-page` (60 / 60 s por endereço, ADR 0070, D6) como todas as páginas; a query nunca é refletida; caminhos abaixo delas e os nomes dos arquivos (`/Terms`) não têm endpoint e caem no 401 do padrão seguro.

**D6 · Estilo.** Entrada só de CSS `legal` no Vite de `apps/web` (`src/styles/legal.css`, com hash, lida do manifesto por `IWebAssets.LegalStyle`), fontes próprias, só unidades relativas, links com alvo de 2,75 rem e contraste AA. Sem o build, a página sai sem estilo e legível. Sem tela em `design/mvp/`: segue o visual da `/r`.

**D7 · Links.** A folha de login da `/r` e da `/c` aponta para os caminhos relativos `/termos` e `/privacidade` (mesma origem); `RoundPage:TermsUrl` e `RoundPage:PrivacyUrl` saem da configuração. No app, `resolveLegalLinks` (função pura) usa `EXPO_PUBLIC_TERMS_URL` e `EXPO_PUBLIC_PRIVACY_URL` como sobreposição explícita (`https:` só) e, sem elas, deriva `{origem https de EXPO_PUBLIC_INVITE_BASE_URL}/termos` e `/privacidade`, descartando caminho, query e fragmento. Só `legal-links.ts` lê o `process.env`. Sem endereço válido, a frase fica sem link (ADR 0057). O APK `preview` ganha os links sem variável nova no EAS.

**D8 · Versão, data e aceite.** A versão e a data saem do topo do trecho publicado e aparecem no topo da página ("Versão 0.1 (rascunho) · atualizada em 24/11/2026"). Teste: os textos publicados não têm `LACUNA`, `CONFERIR`, `RASCUNHO PARA REVISÃO`, `NOTA` nem `pergunta 19`; uma versão que não começa com `0.` não pode ter `a definir` nem `rascunho` (trava a 1.0 sem o canal do encarregado). **O aceite não é registrado:** a frase da 02 e da folha web é o aceite, e a política não usa consentimento como base (pergunta 201, padrão). Se o advogado pedir prova, `terms_version` e `accepted_at` em `identity.users` viram tarefa nova.

## Consequências

- Quem muda `docs/seguranca/dados-pessoais.md` confere a política pela tabela de rastreio no fim do arquivo e sobe a versão (regra registrada no topo do inventário).
- O texto 0.1 vai ao ar no ambiente de teste com o deploy; a produção com jogadores de fora do círculo de teste espera a pergunta 203 e a revisão jurídica.
- A promessa "se a mudança for importante, avisaremos no app" ainda não tem código (risco 4 do plano): antes da 1.0, uma tarefa pequena ou a troca da frase pelo advogado.
- Um APK antigo aponta para o ambiente em que foi gerado, como o convite.
