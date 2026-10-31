# ADR 0016 · Foto da cartinha: recorte no celular e R2

**Status:** aceito (decidido em 30/10/2026, registrado em 31/10/2026). **Tarefa:** E0.8.

**Fontes:** `decisoes.md:18`; `produto.md:67, 361, 373-374`; `revisao-mvp.md:112, 159`.

## Decisão

- **Fase 1,** por decisão do Gabriel (`revisao-mvp.md:159`).
- **Recorte da silhueta no celular:** Vision no iOS, ML Kit no Android, com módulo nativo Expo; pincel apagar/restaurar e enquadramento.
- **Armazenamento:** Cloudflare R2, só o recorte, em WebP sem EXIF.
- **Denúncia de foto;** bloqueio e remoção conforme `produto.md:374`.

## Conflitos entre as fontes

- **Recorte no servidor com ONNX como reserva** (`produto.md:67`): vale `decisoes.md:18`, "fica para depois"; está em [`ideias.md`](../../ideias.md).
- **"PNG ou WebP"** (`produto.md:67`): vale `decisoes.md:18`, WebP.

## Alternativas

Foto simples enquadrada no piloto, com recorte na Fase 2: não adotada (`revisao-mvp.md:159`).

## Consequências

- O recurso só se valida no aparelho: teste do Gabriel na E4.14.
- **A definir:** o que acontece em aparelho sem suporte ao recorte, já que a reserva no servidor ficou para depois (E4.14); como a API recebe o arquivo, valida o formato e confere a ausência de EXIF, limite de tamanho e acesso aos arquivos no R2 (E3.14); fluxo de moderação da denúncia (E3.14).
