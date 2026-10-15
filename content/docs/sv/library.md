---
source: docs/library.md
sourceCommit: 6ed3851c
sourceSha256: 827659aa3cf1548562f97b6e8d7a37e0f230599570a6c78628cd7a72896102f9
translatedAt: 2026-10-15
---
# Biblioteksmoduler

En delmängd av OTP:s moduler `lists` och `maps` som ägs av projektet, skriven
i Erlang utifrån OTP:s dokumenterade beteende (inte kopierad från OTP:s
källkod) och kompilerad tillsammans med de program som använder den.

## Innehåll

| Modul | Funktioner |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | `append/1,2`, `filter/2`, `foldl/3`, `foldr/3`, `keyfind/3`, `map/2`, `member/2`, `nth/2`, `reverse/1,2`, `seq/2,3`, `sort/1`, `foreach/2`, `mapfoldl/3`, `mapfoldr/3`, `partition/2`, `splitwith/2`; inbyggda funktioner i runtimen `sublist/2,3`, `droplast/1`, `nthtail/2`, `last/1`, `duplicate/2`, `join/2`, `flatten/1,2`, `max/1`, `min/1`, `usort/1`, `umerge/1,2`, `keymember/3`, `keysearch/3`, `keydelete/3` ([modulen lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | `find/2`, `fold/3`, `from_list/1`, `get/2`, `keys/1`, `put/3`, `to_list/1`, `values/1`, `filter/2`, `map/2`, `foreach/2`, `update_with/3,4`; inbyggda funktioner i runtimen `get/3`, `is_key/2`, `remove/2`, `new/0`, `size/1`, `merge/2`, `take/2`, `update/3`, `with/2`, `without/2`, `from_keys/2` ([modulen maps](builtins.md#maps-module)) |
| [`file`](../library/kernel/file.erl) | `open/2`, `read/2`, `write/2`, `read_line/1`, `position/2`, `close/1`, `read_file/1`, `write_file/2,3`, `read_file_info/1,2`, `delete/1`, `rename/2`, `list_dir/1`, `make_dir/1`, `del_dir/1` ovanpå fildrivrutinen ([filer](ports.md#standard-io-and-files)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (server för standard-indata eller en öppen fil), `request/1,2`, `requests/1,2` (OTP:s I/O-protokoll, [filer](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` och `nl/0,1` är inbyggda funktioner i runtimen ([io](io.md)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl) | `listen/2`, `accept/1,2`, `connect/3,4`, `send/2`, `recv/2,3`, `shutdown/2`, `controlling_process/2`, `close/1` ovanpå socketportar ([socketar](ports.md#sockets-57f)) |
| [`gen_udp`](../library/kernel/gen_udp.erl) | `open/1,2`, `send/4`, `recv/2,3`, `controlling_process/2`, `close/1` |
| [`inet`](../library/kernel/inet.erl) | `port/1`, `sockname/1`, `peername/1`, `setopts/2`, `close/1` |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses egen: protokollet för socketdrivrutinen som de tre modulerna ovan delar |
| [`erlang`](../library/erts/erlang.erl) | Genererade stubbar för varje export i OTP 29:s `erlang`; inbyggda funktioner ersätter sina, `nif_error/1,2` har kroppar, andra kastar `{not_implemented, F, A}` när de anropas ([modulen erlang](builtins.md#erlang-module)) |
| [`binary`](../library/stdlib/binary.erl) | Varje funktion i OTP 29: `replace/3,4` och `list_to_bin/1` i Erlang, de övriga inbyggda funktioner i runtimen ([modulen binary](builtins.md#binary-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Konverteringar, `bin_is_7bit/1` och byteordningsmarkeringar som inbyggda funktioner i runtimen ([modulen unicode](builtins.md#unicode-module)); normalisering och egenskaper är stubbar |
| [`math`](../library/stdlib/math.erl) | Varje funktion i OTP 29 som inbyggd funktion i runtimen ([modulen math](builtins.md#math-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Varje funktion i OTP 29 som inbyggd funktion i runtimen ([persistenta termer](builtins.md#persistent-terms)) |
| [`code`](../library/kernel/code.erl) | Frågor om laddade moduler som inbyggda funktioner i runtimen utan kodserver ([modulen code](builtins.md#code-module)); sökvägar och laddning är stubbar |
| [`os`](../library/kernel/os.erl) | `cmd/1` ovanpå en port ([delprocesser](ports.md#subprocesses)), `timestamp/0`, `system_time/0,1`, `perf_counter/0,1`, `getenv/2`; `type/0`, `getenv/0,1`, `env/0`, `putenv/2`, `unsetenv/1`, `getpid/0` och `version/0` är inbyggda funktioner i runtimen |

Resultat och felorsaker stämmer med OTP 29, inklusive felens form i OTP:s
Erlang-implementationer (`lists:map(F, x)` är `{case_clause, x}`,
`lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)` `badarg`) och i
dess BIF:ar (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`,
`maps`-funktionerna: `badarg`, `{badmap, M}`, `{badkey, K}`).
`lists:member/2` matchar med `=:=`, `lists:keyfind/3` med `==`.
`lists:sort/1` är en stabil merge sort. Stackspårningar anger
biblioteksfunktionerna, inte OTP:s.

## Hur program får dem

- När en batch (positionella indata eller ett projektmål) anger en modul med
  en literal atom — `M:F(...)` med literal `M`, `fun M:F/A`,
  `apply(M, F, Args)` med literal `M`, `-behaviour(M)` eller
  `-import(M, ...)` — som inga indata definierar, letar kompilatorn efter
  `M.erl` i bibliotekets applikationskataloger och sedan i projektets
  `source_search_paths` ([projekt](projects.md#paths-and-discovery)), tolkar
  och kompilerar den första som hittas in i batchen och upprepar sedan för de
  moduler som de tillagda filerna anger
  ([vilken modul ett namn löses till](#which-module-a-name-resolves-to)). Ett
  anrop `M:F(...)` av en inbyggd funktion i katalogen (`io:format/2`,
  `os:type/0`) anger ingen modul.
- Biblioteket är `library/` i byggträdet, som hittas relativt till `clau` på
  samma sätt som runtime-arkivet, med en katalog per OTP-applikation (`erts`,
  `kernel`, `stdlib`).
- En modul i batchen med samma namn ersätter biblioteksmodulen, med en
  varning.
- Biblioteksmoduler är vanliga batchmoduler: de länkas in i körbara filer och
  producerar, för objekt- eller IR-utdata, egna artefakter.
- En modul som endast nås genom namn under körning (`M:F(...)` där `M` är en
  variabel) läggs inte till: ett sådant anrop kastar `undef` om inte något
  annat anger modulen.
- Biblioteksfunktioner är Erlang-kod, så de kommer att lämna ifrån sig
  körningen som annan kod när schemaläggaren finns.

## Ersättningar för runtime-moduler

Plan 11 step 41I (2026-10-12) bestämmer hur Clause ersätter de OTP-moduler som
ERTS implementerar i C (NIF:ar, BIF:ar, portdrivrutiner, de förladdade
modulerna i `erts/preloaded/src`) och moduler som OTP genererar när det byggs
(`unicode_util`). OTP:s `kernel` och `stdlib` är vanlig Erlang men anropar
dessa moduler; steps 41J och framåt implementerar detta kontrakt.

### Tillhandahållen eller saknad

Allt som behöver runtimen och inte kan skrivas i vanlig Erlang avgörs per
modul, och per grupp av funktioner där en modul blandar ansvarsområden:

- **Tillhandahållen:** Clause levererar modulen med OTP 29:s exakta
  exportlista. Varje funktion har en av fyra statusar: `implemented` (en
  inbyggd funktion i runtimen eller en Erlang-kropp ovanpå befintliga
  runtime-tjänster), `refused` (returnerar eller kastar det som OTP:s
  anropare redan hanterar när en funktion saknas, till exempel
  `{error, enotsup}`), `stub` (kastar `error({not_implemented, F, A})` med
  `M:F/A` överst på stacken, som [`erlang`-stubbarna](builtins.md#erlang-module)
  gör; ännu inte klar; användarens anvisning 2026-10-12) eller `declined` (en
  stubbe som blir kvar, med ett skäl som distribution eller kodladdning som
  väntar på plan step 71). En modul börjar med varje funktion som stubbe, så
  att den kan hittas och dess anropare kompileras; grupper flyttas sedan till
  sin beslutade status.
- **Saknad:** Clause levererar ingen modul alls, möjligen för alltid, och
  registrerar varför och vilka Clause-moduler på högre nivå som tar dess
  anropares plats. De lågnivålager för filer och socketar som heter `prim_*`
  är det typiska fallet: program använder i stället Clauses `file`,
  `gen_tcp`, `gen_udp` och `inet`, och eftersom Clause-moduler vinner över
  OTP:s (nedan) kommer OTP:s anropare av en saknad modul aldrig in i en batch.
  En saknad modul får aldrig en stubbe, så en referens till den är ett fel vid
  kompilering, aldrig en överraskning vid körning.

Funktioner som är triviala för runtimen implementeras utan ett separat beslut.

### Vilken modul ett namn löses till

OTP är valfritt på användarens maskin; när det finns får det inte ändra vad
ett bygge kompilerar. Ett modulnamn löses i denna ordning:

1. **Explicita indata:** källfiler som användaren listar (`sources`,
   `source_dirs`, positionella indata). En som har namnet på en
   Clause-modul ersätter den, med en varning som namnger båda filerna.
2. **Clause-moduler:** biblioteksmodulerna, inklusive tillhandahållna
   ersättningar.
3. **`source_search_paths`**, så som beskrivs i
   [projekt](projects.md#paths-and-discovery).

Namnet på en saknad modul är reserverat: en fil med samma namn på en
söksökväg (till exempel OTP:s `erts/preloaded/src/prim_file.erl`) används
inte, och diagnostiken säger att Clause inte tillhandahåller modulen. En
explicit indata kan ändå tillhandahålla den, med ersättningsvarningen.

`ignore_modules` gäller även Clause-moduler: en ignorerad Clause-modul saknas
i batchen, och en explicit indata kan då tillhandahålla den utan varning,
eftersom inget ersätts.

### Filer

- Biblioteksmoduler finns i `library/<application>/`, uppkallade efter den
  OTP-applikation som äger modulen i OTP: `erts` (förladdade motsvarigheter
  och `erlang`), `kernel` (`file`, `gen_tcp`, `gen_udp`, `inet`, `os` och
  Clauses egen `clause_socket`), `stdlib` (`binary`, `lists`, `maps`, `math`,
  `io`, `unicode`, `unicode_util`). Biblioteksuppslagningen söker i varje
  applikationskatalog; ett modulnamn finns i högst en av dem.
- `library/modules.terms` listar varje modul som Clause fattar beslut om:
  `{Module, Application, provided}.` eller
  `{Module, Application, missing, "reason"}.` Kompilatorn läser den för att
  veta vilka namn som är Clause-moduler och vilka som är reserverade.
- Varje tillhandahållen modul har en inventering `<module>.terms` bredvid sig:
  `{Name, Arity, Group, Status}.` per export i OTP 29, sorterad efter namn och
  aritet, där `Group` namnger beslutsgruppen (till exempel `stdlib`,
  `distribution`, `beam`). `erlang.terms` behåller sitt eget format
  (`{Name, Arity, Flags, Status}`, [modulen erlang](builtins.md#erlang-module)).
- Exportlistor observeras från ett OTP 29 på värden
  (`M:module_info(exports)`); ingen OTP-källkod kopieras. Resultat och
  feltermer för implementerade funktioner stämmer med OTP 29; avsiktliga
  skillnader förs till [skillnader](differences.md).
- Varje biblioteksmodul i Clause exporterar OTP 29:s fullständiga lista för
  sitt namn, så att OTP-kod som kompileras mot den hittar varje funktion;
  Clauses egna `lists`, `maps`, `file`, `io`, `os`, `gen_tcp`, `gen_udp` och
  `inet` får också inventeringar och stubbar för det som de ännu inte
  implementerar.

### Typer

Eftersom Clauses moduler vinner över OTP:s måste OTP-kod som anger
`file:filename()` eller `erlang:time_unit()` i sina specs hitta de typerna i
Clauses moduler. Varje tillhandahållen modul vars OTP-motsvarighet exporterar
typer inkluderar `<module>.types.hrl` från sin egen katalog: listan
`-export_type`, sedan de exporterade typerna och de lokala typer och records
som de använder, så som OTP definierar dem (dokumentationen visar samma
definitioner; den installerade dokumentationen innehåller inga
typdefinitioner, så de kommer från implementationen: beam-filens
felsökningsinformation, eller den levererade källkoden för en förladdad modul
som `erlang`). `escript
tests/compiler/library/observe_types.escript LIBRARY APP MODULE` skriver
headern från värdens OTP, och `--check` jämför dess former med en ny
observation (CTest `library_freshness`); `library_modules.py check` kräver att
varje header inkluderas av sin modul. Typer som headrarna anger från moduler
utanför programmet (`unicode:chardata()`, `calendar:datetime()`) och OTP:s
breda unioner (`file:posix()` har fler medlemmar än typgrafen behåller) löses
till `term()` utan varning: diagnostiken hör till Clauses bibliotek, inte till
användarens program.

### Kärntjänster vid uppstart

OTP:s `file`, `io`, `code` och `logger` anropar registrerade servrar
(`file_server_2`, `code_server`, en gruppledares io-server, `logger`) som
applikationen `kernel` startar vid uppstart. En körbar fil från Clause startar
ingen av dem, och enligt beslut 2026-10-12 fortsätter den tills vidare att
inte starta någon: Clauses egna `file` och `io` behöver ingen server, och en
OTP-modul som behöver en misslyckas på samma sätt som den misslyckas i OTP
utan den servern (`noproc`). Kostnad: OTP-kod som loggar genom `logger` eller
anropar `code` under körning fungerar inte förrän en senare post i liggaren
väljer en minimal uppsättning tjänster för startobjektet. Att starta hela
applikationen `kernel` är inte planerat.

### Liggare

Projektet luerl driver detta arbete. Efter varje steg, kör

```text
clau.bat --project test-luerl --entry luerl:init
```

klassificera varje fel (`unknown module`, `undefined function M:F/A`,
syntax eller funktion som inte stöds, annat) och tilldela vart och ett ett
step i plan 11 fas H3, en annan post i eftersläpningen eller ett registrerat
avböjande. Med körningens stderr sparad i en fil skriver
`python tests/compiler/library/library_modules.py report FILE` ut
klassificeringen som tabeller: varje okänd modul med sitt antal fel,
anropande moduler och anropade funktioner med ariteter; odefinierade
funktioner per modul; andra meddelanden med sina antal.

### Verktyg

Alla finns i `tests/compiler/library/`:

- `escript observe_module.escript LIBRARY APP MODULE` skriver
  `LIBRARY/APP/MODULE.terms` från värd-OTP:s `MODULE:module_info(exports)`,
  och behåller grupp och status för varje post som redan finns där; en ny
  export börjar som `{Name, Arity, default, stub}`.
- `python library_modules.py generate LIBRARY APP MODULE` skriver modulfilen
  en gång, med varje export som stubbe; därefter redigeras filen för hand.
- `python library_modules.py check ROOT` (CTest `library_inventory`, inget
  OTP) rapporterar varje oöverensstämmelse: en tillhandahållen modul utan sina
  filer, en saknad modul med en fil, en inventering som inte listas som
  tillhandahållen, en export som inte finns i inventeringen eller omvänt, en
  `stub`/`declined`-post som inte är en stubbe som kastar `undef`, en
  `implemented`/`refused`-post utan kropp eller inbyggd funktion i katalogen.
  `library_rejects` bevisar det på ett avsiktligt inkonsekvent
  fixturbibliotek.
- CTest `library_freshness` (etikett `host_otp`) observerar varje inventering
  på nytt och kräver att den är oförändrad, och observerar, genererar,
  kontrollerar och kompilerar sedan en ny modul från början till slut.
  `library_report` kör `clau` på ett fixturprogram och kontrollerar
  rapportens rader.

| Modul | Beslut (2026-10-12) | Skäl eller plan step |
| --- | --- | --- |
| `init` | tillhandahållen; implementerad utom `boot/1`, `restart/0,1` och `make_permanent/2`, avvisade | svar om argument och status för ett startat system (41L, [modulen init](builtins.md#init-module)) |
| `persistent_term` | tillhandahållen, endast stubbar | termtabell för hela runtimen (41M) |
| `erts_internal` | tillhandahållen; grupperna `stdlib` och `counters` implementerade, `get_creation/0` och `map_hashmap_children/1` avvisade, grupperna `distribution`, `beam` och `emulator` avböjda | 41N ([erts_internal](builtins.md#erts-internal)); ingen distribution, inga `.beam`-filer |
| `atomics`, `counters`, `erts_code_purger` | tillhandahållna; `atomics`, `counters` implementerade; `purge/1`, `soft_purge/1` implementerade, rensningsprocessen avböjd | 41N ([atomics och counters](builtins.md#atomics-and-counters)); kodladdning väntar på step 71 |
| `unicode_util` | tillhandahållen, implementerad (41O1, 41O2) | tabeller genererade från OTP:s svar och Unicode-data ([unicode_util](builtins.md#unicode-util)) |
| `erl_prim_loader` | tillhandahållen; filfrågor implementerade ovanpå `file`, laddning och arkiv avböjda | 41P ([filer](ports.md#standard-io-and-files)); kodladdning väntar på step 71 |
| `zlib` | tillhandahållen, implementerad ovanpå den fastlåsta zlib (41Q) | strömmar är handtagsreferenser ([modulen zlib](builtins.md#zlib-module)) |
| `prim_eval` | tillhandahållen, implementerad (41S) | `'receive'/2` ovanpå stegen i en kompilerad receive ([prim eval](builtins.md#prim-eval)) |
| `application_controller` | tillhandahållen, endast stubbar | skuggar OTP:s, som anropar `prim_file` (luerl namnger den genom OTP:s `application`) |
| `lists`, `maps`, `io`, `file`, `os`, `gen_tcp`, `gen_udp`, `inet` | tillhandahållna, OTP 29:s fullständiga exportlistor; det som Clause hade förblir implementerat, resten stubbar | växer efter liggarens behov |
| `re` | tillhandahållen; implementerad (41ZA, 41ZB) utom `import/1`, avböjd | ovanpå den fastlåsta PCRE2 ([modulen re](builtins.md#re-module)); Clause exporterar inga mönster |
| `prim_file`, `prim_buffer` | saknade, beslutat i 41P | Clauses `file` är fillagret; OTP:s `filelib`/`filename` körs ovanpå det |
| `prim_socket`, `prim_net`, `prim_inet`, `socket_registry`, `socket`, `net` | saknade, beslutat i 41R | Clauses `gen_tcp`, `gen_udp`, `inet` är nätverkslagret; OTP:s `gen_tcp_socket`, `gen_udp_socket`, `inet_tcp`, `inet_udp` nås endast från OTP:s skuggade moduler ([socketar](ports.md#sockets-57f)) |

Senaste luerl-lagret (2026-10-12, efter steps 41K1 och 41K2, med
`NEW_STACKTRACE` definierat som luerls `rebar.config.script` gör på OTP 21 och
senare, och `inet` inte längre i `ignore_modules`): målet kompileras och
länkas utan fel. 83 varningar återstår: 74 typer från de ignorerade
`erl_parse` och `compile`, 8 typer från OTP-moduler utanför programmet som
anges av OTP-kod som målet kompilerar, en breddning av typgrafens budget i den
koden. Den körbara filen startar `luerl:init/0` och avslutas med 0. Nästa lager
är beteendet under körning: vilka stubbar luerl når när den kör Lua-kod.

Körningslagret (2026-10-14, efter faserna H3–H5): en drivrutin som kör 35
Lua-snuttar genom `luerl:do` byggs med 17 varningar och skriver ut OTP 29:s
utdata för 34 av dem, inklusive `os.date`. Den återstående, ett `goto`,
misslyckas med OTP:s `function_clause`; endast dess stackramar skiljer sig,
utan argument eller platser ([skillnader](differences.md)).
