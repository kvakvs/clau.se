---
source: docs/asn1.md
sourceCommit: 1e3a39c8-dirty
sourceSha256: fc528bb80707fa028fab896cf045bdf94eebb64ce17aa24704db249ed19cbe6b
translatedAt: 2026-10-26
---
# Especificações ASN.1

O Clau compila especificações ASN.1 (`.asn`, `.asn1` e listas de módulos
`.set.asn`) em módulos Erlang como o `asn1ct` do OTP: `Module.erl` com
`encode/2`, `decode/2` e os valores do módulo, e `Module.hrl` com os seus
records e macros. O módulo gerado junta-se ao lote como qualquer outro ficheiro
de código-fonte; a sua codificação e descodificação executam no motor C++ de
BER, DER e PER de `clause_runtime` (sem necessidade de OpenSSL). As
especificações de `public_key` do OTP serão compiladas da mesma forma.

## Entradas

As entradas posicionais terminadas em `.asn` ou `.asn1` são especificações:

```sh
clau --asn1-option der --asn1-outdir gen Kitchen.asn main.erl -o app
clau --generate-asn1 --asn1-outdir gen Kitchen.asn   # only write gen/Kitchen.erl and gen/Kitchen.hrl
```

| Opção | Significado |
| --- | --- |
| `--asn1-option <option>` | Uma opção de `asn1ct` para todas as especificações da invocação; pode ser repetida. Predefinição: `ber`. |
| `--asn1-outdir <dir>` | Onde são escritos `Module.erl` e `Module.hrl` (`outdir` de asn1ct); por predefinição, o diretório atual. O diretório junta-se ao caminho de inclusão, pelo que `-include("Module.hrl").` funciona. |
| `--generate-asn1` | Escrever apenas os módulos e cabeçalhos gerados; não compilar nada. |
| `-I <dir>` | Também é pesquisado para módulos ASN.1 importados (`i` de asn1ct), depois do diretório da própria especificação. |

Um alvo de projeto lista as especificações em grupos `[[targets.asn1]]`, cada
um compilado com as suas próprias opções:

```toml
[[targets]]
name = "app"
sources = ["src/*.erl"]

[[targets.asn1]]
sources = ["asn1/*.asn"]
options = ["per", "noobj"]
outdir = "build/gen"   # default: asn1/ in the target's build directory
```

`sources` (obrigatório) aceita ficheiros e padrões com carateres universais,
como os ficheiros de código-fonte do alvo, correspondendo a `.asn` e `.asn1`;
um padrão sem correspondências é um erro. As importações são procuradas nos
diretórios das especificações do grupo. Um módulo gerado já listado entre os
ficheiros de código-fonte do alvo não é adicionado duas vezes. `outdir` junta-se
ao caminho de inclusão do alvo.

Um ficheiro `.set.asn` lista um ficheiro de módulo por linha (compilação
combinada de asn1ct); cada nome é tentado tal como está, depois com `.asn1`,
`.asn` e `.py` acrescentados. O módulo combinado recebe o nome do ficheiro do
conjunto.

## Opções

| Opção | Efeito |
| --- | --- |
| `ber` | Basic Encoding Rules (a predefinição). |
| `der` | Distinguished Encoding Rules: `ber` com `SET`/`SET OF` ordenados, valores `DEFAULT` omitidos e verificações DER. |
| `maps` | Os valores `SEQUENCE`/`SET` são maps; os componentes ausentes são omitidos. |
| `undec_rest` | `decode/2` devolve `{ok, Value, Rest}` com os bytes após o valor. |
| `no_ok_wrapper` | `encode/2` e `decode/2` devolvem o próprio valor e geram exceções em caso de erro. |
| `legacy_erlang_types` | Valores `BIT STRING` e `OCTET STRING` como listas; são aceites `{Unused, Binary}` e inteiros. |
| `legacy_bit_string`, `compact_bit_string` | Formas antigas de `BIT STRING` (listas de 0 e 1, `{Unused, Binary}`); implicam `legacy_erlang_types`. |
| `noobj`, `asn1config`, `verbose`, `warnings`, `errors`, `deterministic` | Aceites, não alteram nada. |
| `per`, `uper` | Packed Encoding Rules, alinhadas e não alinhadas ([PER](#per)). |
| `no_final_padding` | Com `uper`: `encode/2` devolve os bits sem preenchimento até um octeto (uma bitstring). |
| `jer` | Rejeitada: `jer (JSON encoding rules) is not supported`. |

Qualquer outra opção resulta em `unknown ASN.1 option 'Name'` (saída 2).

## Cobertura

As construções de X.680/X.681/X.682/X.683 usadas pelos módulos PKIX e PKCS do
OTP e pelas especificações do emqx:

- Tipos: `BOOLEAN`, `INTEGER` com números nomeados, `ENUMERATED` com extensões,
  `NULL`, `BIT STRING` com bits nomeados, `OCTET STRING`, `OBJECT IDENTIFIER`,
  `RELATIVE-OID`, `REAL`, as cadeias de carateres restritas, `UTCTime`,
  `GeneralizedTime`, `ObjectDescriptor`, `SEQUENCE`, `SET`, `SEQUENCE OF`,
  `SET OF`, `CHOICE`, `ANY`, `ANY DEFINED BY`, `INSTANCE OF`, tipos abertos,
  tipos de seleção (`name < Type`).
- Etiquetagem: etiquetas explícitas, implícitas e automáticas, predefinições
  dos módulos, `COMPONENTS OF`, marcadores de extensão, grupos de adições de
  extensão e os componentes após as extensões.
- Restrições: valores únicos, intervalos, `SIZE`, `FROM`, uniões e interseções
  (avaliadas para os limites que BER verifica e PER codifica);
  `WITH COMPONENT(S)`, `CONTAINING`, `PATTERN`, `CONSTRAINED BY` e `INCLUDES`
  são analisadas e não verificadas, como no asn1ct.
- Objetos de informação: classes com `WITH SYNTAX`, `TYPE-IDENTIFIER`,
  `ABSTRACT-SYNTAX`, objetos, conjuntos de objetos (uniões, conjuntos
  extensíveis, conjuntos a partir de outros conjuntos e de campos de objetos),
  restrições de tabela simples e de relação entre componentes (`{Set}{@a.b}`,
  descodificadas e codificadas através do tipo do objeto).
- Tipos, objetos e conjuntos de objetos parametrizados; importações entre
  módulos; valores `DEFAULT` de todos os tipos.

Não suportados, cada um com um erro na sua posição: `EXTERNAL`, `EMBEDDED PDV`
e `CHARACTER STRING` (`unsupported ASN.1
type`), valores parametrizados, objetos extraídos de conjuntos de objetos,
definições `MACRO` e notações de valores que as especificações do OTP não usam
(`unsupported value notation`).

## Módulos gerados

`Module.erl` exporta o mesmo que o de asn1ct: `encoding_rule/0`, `maps/0`,
`bit_string_format/0`, `legacy_erlang_types/0`, `encode/2`, `decode/2`, `info/0`
e uma função por atribuição de valor. Os records e os seus nomes seguem asn1ct
(tipos internos nomeados pelo seu caminho, `SEQOF`/`SETOF` para elementos de
coleções, instâncias parametrizadas), pelo que `Module.hrl` é idêntico ao de
asn1ct, exceto na primeira linha de comentário; os valores são impressos como
asn1ct os imprime.

`encode/2` e `decode/2` devolvem `{ok, Value}` ou `{error, {asn1, Reason}}`
com os motivos de asn1ct (`{bad_range, ...}`, `{unexpected, ...}`,
`{invalid_choice_type, ...}`, `{'Type not compatible with table constraint', ...}`,
os erros TLV de `asn1rt_nif`); a descodificação mantém a tolerância e as
particularidades de asn1ct (componentes de extensão desconhecidos ignorados,
`{asn1_OPENTYPE, Bytes}` e `{asn1_ExtAlt, Bytes}` para valores desconhecidos
de tipos abertos e de `CHOICE`, `{asn1_enum, N}`).

As funções geradas chamam `clause_asn1:encode/3` e `clause_asn1:decode/3` com
um termo de esquema: `{asn1_schema, 1,
Rule, Flags, #{Type => Node}, Nodes}`. Cada nó é `{Kind, Tags, Fields...}`
(tipos pela ordem de `NodeKind` do compilador, etiquetas como
`Number bsl 2 bor Class`; limites `{Lower, Upper, Extensible}` com os valores
raiz de uma lista extensível de valores únicos como quarto elemento, cadeias
restritas com o seu alfabeto PER, componentes com o seu indicador de grupo de
adições); o formato é interno ao Clause e pode mudar.

## PER

`per` (alinhado) e `uper` (não alinhado) seguem o código que asn1ct gera e
`asn1rtt_per`/`asn1rtt_uper`/`asn1rtt_per_common`, byte a byte (X.691 tal como
o OTP o implementa):

- Restrições visíveis para PER tal como `effective_constraint/2` de asn1ct as
  calcula: intervalos de valores (números inteiros restritos, parcialmente
  restritos e sem restrições), limites `SIZE` abaixo de 64K (os maiores são
  codificados como comprimentos sem restrições), raízes extensíveis (uma lista
  extensível de valores únicos codifica apenas esses valores como valores
  raiz) e alfabetos `FROM` das cadeias com multiplicador conhecido
  (`NumericString`, `PrintableString`, `VisibleString`, `IA5String`,
  `BMPString`, `UniversalString`, `UTCTime`, `GeneralizedTime`), cujos
  carateres são índices quando os seus códigos não cabem na largura do caráter.
- Os componentes raiz de `SET` são codificados por ordem de etiqueta, as
  alternativas de `CHOICE` por ordem textual (como asn1ct, e não pela ordem
  canónica de X.691), os itens de `ENUMERATED` por valor; as adições de
  extensão são tipos abertos, um grupo de adições é uma `SEQUENCE` dos seus
  componentes; fragmentos acima de 16K unidades (octetos, bits, carateres,
  elementos).
- As particularidades de asn1ct são mantidas: num record, as adições de extensão
  após um grupo de vários componentes são lidas das posições erradas
  (deslocadas pelo comprimento do grupo menos um); os elementos de tipo aberto
  de uma `SEQUENCE OF` ignoram a sua restrição de tabela; eliminar os bits zero
  finais de uma cauda de `BIT STRING` nomeada composta só por zeros falha com
  `badmatch`; uma entrada malformada falha com `badmatch`, `case_clause` ou
  `function_clause` do código gerado sobre os bits restantes.

## Diagnósticos

Os erros incluem o caminho, a linha e a coluna da especificação e interrompem a
invocação (saída 1) antes da compilação de Erlang:

```text
syntax.asn:4:1: error: expected '::=' near 'END'
undefined.asn:3:22: error: undefined reference Missing
import.asn:4:9: error: cannot find ASN.1 module Absent
empty.asn:1:1: error: no ASN.1 module found
```

As diferenças face a asn1ct estão listadas em
[differences.md](differences.md#asn1).
