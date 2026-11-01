# Pix copia e cola (BR Code estático)

Implementação: `packages/volley-rules/src/pix/`. Casos compartilhados: `packages/volley-rules/golden/pix.json` e `packages/volley-rules/golden/pix-crc.json`.

`buildPixPayload(input)` é puro, sem I/O nem log, e devolve `Result<string, PixPayloadError>`. O resultado contém a chave Pix: nunca vai para log, evento, telemetria ou URL.

## Fontes e versões

| Fonte | Versão | Uso |
|---|---|---|
| [Manual de Padrões para Iniciação do Pix](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf) | 2.10.0 | Campos do Pix (2.5, 2.6.1), formato das chaves (2.5.1), exemplo estático com CRC `1D3D` (2.6.3) |
| [Manual do BR Code](https://www.bcb.gov.br/content/estabilidadefinanceira/spb_docs/ManualBRCode.pdf) | 2.0.1 | Campos raiz, limites de `54`, `59` e `60`, CRC, exemplo de 270 caracteres com CRC `AD38` |
| Catálogo de CRC do projeto reveng, `CRC-16/IBM-3740` (o nome antigo é CCITT-FALSE) | sem versão | Valor de conferência `123456789` → `29B1` |

O Manual do Pix anuncia a versão 2.11.0-rc1: rever antes da E3.10.

## Campos

Ordem fixa, em TLV: `ID + tamanho em 2 dígitos + valor`. `01` e `61` ficam de fora.

| ID | Conteúdo | Tamanho |
|---|---|---|
| `00` | `01` | 2 |
| `26` | `00`=`br.gov.bcb.pix`, `01`=chave | chave até 77 |
| `52` | `0000` | 4 |
| `53` | `986` | 3 |
| `54` | Valor, como `100.50`. Sem valor, o campo não existe e o pagador digita | até 13 |
| `58` | `BR` | 2 |
| `59` | Nome, normalizado | até 25 |
| `60` | Cidade, normalizada | até 15 |
| `62` | `05`=`***` | 7 |
| `63` | CRC | 4 |

**CRC:** polinômio `0x1021`, inicial `0xFFFF`, sobre todo o payload, incluindo `6304`; 4 hexadecimais maiúsculos, com zeros à esquerda.

**Valor:** centavos inteiros, de 1 a 999999999999. Fora disso, ou não inteiro: `invalid-amount`.

## Chave

Tipo explícito, só validação de formato, sem transformar. Quem normaliza a digitação é a E3.10.

| Tipo | Formato |
|---|---|
| `cpf` | 11 dígitos, sem conferir dígito verificador: o exemplo do manual não tem um válido |
| `cnpj` | 14 caracteres de `0-9` e `A-Z` |
| `phone` | `+55` e 11 dígitos |
| `email` | ASCII visível, `local@dominio.tld`, até 77. Maiúsculas passam: o formato definitivo fica para a E3.10, que normaliza a digitação |
| `random` | UUID em hexadecimal minúsculo, sem conferir a versão do UUID |

## Decisão: normalização de nome e cidade

O manual não normaliza, e o BR Code 2.0.0 tirou a restrição a alfanuméricos. Para o tamanho ser igual em bytes e caracteres e leitores antigos não divergirem, aplicamos, nesta ordem:

1. NFD.
2. Remover tudo fora de ASCII 0x20–0x7E. Saem diacríticos, emoji, tabulação, espaço não separável e letras sem decomposição (`ø`).
3. Colapsar espaços e aparar.
4. Cortar em 25 (nome) ou 15 (cidade) e aparar de novo, porque o corte pode terminar em espaço.

A caixa é preservada. Resultado vazio é erro. Risco baixo: o pagador vê o nome do DICT (nota 26 do Manual do Pix). Decisão pequena e reversível, a citar no relatório do marco.

Consequência aceita: tabulação e espaço não separável são removidos, e não trocados por espaço, então `Fulano<TAB>de` vira `Fulanode`. Trocar exigiria definir "o que é espaço" igual em JS e .NET.

## Erros

Só `code`, sem `cause` nem valor: `invalid-key`, `invalid-merchant-name`, `invalid-merchant-city`, `invalid-amount`. Com mais de um problema, vale essa ordem; o golden fixa isso.

## Golden

Os dois arquivos foram escritos **sem usar o gerador**: os campos TLV foram digitados à mão, um script Python só conferiu os tamanhos e calculou o CRC. Em `source`, `official:` é copiado do manual, `crc-catalogue:` vem do catálogo, e `derived` foi calculado à parte. As chaves são as fictícias dos manuais, em domínio reservado (`example.com`) ou preenchimento; nenhuma é de pessoa real.

Para conferir o CRC de um caso `derived`, passe o payload até `6304`, inclusive:

```sh
python -c "import binascii,sys; print('%04X' % binascii.crc_hqx(sys.argv[1].encode(), 0xFFFF))" '<payload até 6304>'
```

Conferência feita no PDF: esse comando reproduz `1D3D` e `AD38` sobre os textos dos manuais, e `29B1` sobre `123456789`. Se um desses deixar de bater, investigar o código, nunca ajustar o golden.

## Contrato para a E1.5 (C#)

- `golden/pix.json`: lista de `{ id, source, input: { key: { type, value }, merchantName, merchantCity, amountCents? }, expectedPayload | expectedError }`. Se a geração ficar na API (a E3.10 decide), a E1.5 porta o gerador; se não, basta ler o JSON.
- `golden/pix-crc.json`: lista de `{ id, source, ascii, expectedCrc }`.
- `amountCents` pode ser fracionário no golden (`10.5`, deve dar erro). Leia como número decimal antes de validar. `NaN` e `Infinity` só têm teste em TS, porque JSON não os representa.
- Atenção no porte: `\d` do .NET aceita dígitos não ASCII, e `$` aceita `\n` no fim. Use `[0-9]` e `\z`; há casos no golden para os dois. `String.Normalize` em modo de globalização invariante precisa dar o mesmo resultado.

## Fora do escopo

Criptografia e guarda da chave, "já paguei" (E3.10), imagem de QR, QR dinâmico, `infoAdicional`, `fss`, txid próprio, porte C# (E1.5). Antes do piloto, testar em apps de banco reais com chave de teste do Gabriel, fora do repositório (E3.10).
