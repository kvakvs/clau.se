---
source: docs/library.md
sourceCommit: a8c3f8f6
sourceSha256: f657ad1632b57e9c9b11ad04f870350112a7cac942b10e5483e1aa26d1c79fc7
translatedAt: 2026-10-17
---
# Biblioteksmoduler

Clause levererar egna versioner av de OTP-moduler som program anropar,
skrivna i Erlang utifrån OTP:s dokumenterade beteende (inte kopierade från
OTP:s källkod) ovanpå runtimens [inbyggda funktioner](builtins.md), och
kompilerar dem tillsammans med de program som använder dem.

## Innehåll

Varje tillhandahållen modul exporterar OTP 29:s fullständiga lista för sitt
namn; dess inventering `<module>.terms` ([filer](#files)) registrerar vilka
funktioner som är implementerade och vilka som är stubbar.

| Modul | Innehåll |
| --- | --- |
| [`lists`](../library/stdlib/lists.erl) | De vanliga funktionerna; datafunktioner som `sublist/2,3`, `flatten/1,2`, `usort/1`, `keymember/3` är inbyggda funktioner i runtimen ([modulen lists](builtins.md#lists-module)) |
| [`maps`](../library/stdlib/maps.erl) | De vanliga funktionerna och iteratorer; `get/3`, `merge/2`, `update/3`, `with/2`, ... är inbyggda funktioner i runtimen ([modulen maps](builtins.md#maps-module)) |
| [`io`](../library/stdlib/io.erl) | `get_line/1,2`, `get_chars/2,3` (server för standard-indata eller en öppen fil), `request/1,2`, `requests/1,2` (OTP:s I/O-protokoll, [filer](ports.md#standard-io-and-files)); `format/1,2,3`, `fwrite/1,2,3`, `put_chars/1,2` och `nl/0,1` är inbyggda funktioner i runtimen ([io](io.md)) |
| [`binary`](../library/stdlib/binary.erl) | Varje funktion; `replace/3,4` och `list_to_bin/1` i Erlang, de övriga inbyggda funktioner i runtimen ([modulen binary](builtins.md#binary-module)) |
| [`math`](../library/stdlib/math.erl) | Varje funktion som inbyggd funktion i runtimen ([modulen math](builtins.md#math-module)) |
| [`unicode`](../library/stdlib/unicode.erl) | Konverteringar, `bin_is_7bit/1` och byteordningsmarkeringar som inbyggda funktioner i runtimen ([modulen unicode](builtins.md#unicode-module)); normalisering och egenskaper är stubbar |
| [`unicode_util`](../library/stdlib/unicode_util.erl) | Varje funktion ovanpå genererade tabeller ([unicode_util](builtins.md#unicode-util)) |
| [`re`](../library/stdlib/re.erl) | Varje funktion utom `import/1`, ovanpå PCRE2 ([modulen re](builtins.md#re-module)) |
| [`file`](../library/kernel/file.erl) | Öppna, läsa, skriva, positionera och stänga filer, läsning och skrivning av hela filer, filinformation och katalogoperationer ovanpå fildrivrutinen ([filer](ports.md#standard-io-and-files)) |
| [`gen_tcp`](../library/kernel/gen_tcp.erl), [`gen_udp`](../library/kernel/gen_udp.erl), [`inet`](../library/kernel/inet.erl) | Socketar ovanpå socketportar ([socketar](ports.md#sockets)) |
| [`clause_socket`](../library/kernel/clause_socket.erl) | Clauses egen: protokollet för socketdrivrutinen som de tre modulerna ovan delar |
| [`os`](../library/kernel/os.erl) | `cmd/1` ovanpå en port, frågor om miljö, tid och version ([modulen maps](builtins.md#maps-module)) |
| [`code`](../library/kernel/code.erl) | Frågor om laddade moduler utan kodserver ([modulen code](builtins.md#code-module)); sökvägar och laddning är stubbar |
| [`application_controller`](../library/kernel/application_controller.erl) | Endast stubbar; skuggar OTP:s, som anropar `prim_file` (luerl når den genom OTP:s `application`) |
| [`erlang`](../library/erts/erlang.erl) | Genererade stubbar för varje export i OTP 29:s `erlang`; inbyggda funktioner ersätter sina, `nif_error/1,2` har kroppar, andra kastar `{not_implemented, F, A}` när de anropas ([modulen erlang](builtins.md#erlang-module)) |
| [`init`](../library/erts/init.erl) | Ett startat systems svar; `boot/1`, `restart/0,1` och `make_permanent/2` avvisas ([modulen init](builtins.md#init-module)) |
| [`persistent_term`](../library/erts/persistent_term.erl) | Varje funktion som inbyggd funktion i runtimen ([persistenta termer](builtins.md#persistent-terms)) |
| [`atomics`](../library/erts/atomics.erl), [`counters`](../library/erts/counters.erl) | Varje funktion ([atomics och counters](builtins.md#atomics-and-counters)) |
| [`erts_internal`](../library/erts/erts_internal.erl), [`erts_code_purger`](../library/erts/erts_code_purger.erl) | Det som `stdlib` och `kernel` anropar; grupperna för distribution, `.beam`, emulator och rensningsprocess avböjda ([erts_internal](builtins.md#erts-internal)) |
| [`erl_prim_loader`](../library/erts/erl_prim_loader.erl) | Filfrågor ovanpå `file`; laddning och arkiv avböjda ([filer](ports.md#standard-io-and-files)) |
| [`zlib`](../library/erts/zlib.erl) | Varje funktion ovanpå den fastlåsta zlib ([modulen zlib](builtins.md#zlib-module)) |
| [`prim_eval`](../library/erts/prim_eval.erl) | `'receive'/2` ovanpå stegen i en kompilerad receive ([prim eval](builtins.md#prim-eval)) |

Resultat och felorsaker stämmer med OTP 29, inklusive felens form i OTP:s
Erlang-implementationer (`lists:map(F, x)` är `{case_clause, x}`,
`lists:nth(0, L)` `function_clause`, `lists:seq(1, 10, 0)` `badarg`) och i
dess BIF:ar (`lists:member/2`, `lists:keyfind/3`, `lists:reverse/2`,
`maps`-funktionerna: `badarg`, `{badmap, M}`, `{badkey, K}`).
`lists:member/2` matchar med `=:=`, `lists:keyfind/3` med `==`.
`lists:sort/1` är en stabil merge sort vars pass växlar mellan stigande och
fallande delsekvenser, så att ingen sammanslagning vänder en delsekvens.
Stackspårningar anger biblioteksfunktionerna, inte OTP:s.

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
  `os:type/0`) anger ingen modul. `--print-inputs` listar de indata som detta
  lägger till.
- Biblioteket är `library/` i byggträdet, som hittas relativt till `clau` på
  samma sätt som runtime-arkivet, med en katalog per OTP-applikation (`erts`,
  `kernel`, `stdlib`).
- En modul i batchen med samma namn ersätter biblioteksmodulen, med en
  varning; inbyggda funktioner i katalogen med det namnet vinner ändå
  ([registrering](builtins.md#registration)).
- Biblioteksmoduler är vanliga batchmoduler: de länkas in i körbara filer och
  producerar, för objekt- eller IR-utdata, egna artefakter. De är Erlang-kod,
  så de lämnar ifrån sig körningen som annan kod.
- En modul som endast nås genom namn under körning (`M:F(...)` där `M` är en
  variabel) läggs inte till: ett sådant anrop kastar `undef` om inte något
  annat anger modulen.

## Ersättningar för runtime-moduler

Clause ersätter de OTP-moduler som ERTS implementerar i C (NIF:ar, BIF:ar,
portdrivrutiner, de förladdade modulerna i `erts/preloaded/src`) och moduler
som OTP genererar när det byggs (`unicode_util`). OTP:s `kernel` och `stdlib`
är vanlig Erlang men anropar dessa moduler.

### Tillhandahållen eller saknad

Allt som behöver runtimen och inte kan skrivas i vanlig Erlang avgörs per
modul, och per grupp av funktioner där en modul blandar ansvarsområden:

- **Tillhandahållen:** Clause levererar modulen med OTP 29:s exakta
  exportlista. Varje funktion har en av fyra statusar: `implemented` (en
  inbyggd funktion i runtimen eller en Erlang-kropp ovanpå befintliga
  runtime-tjänster), `refused` (returnerar eller kastar det som OTP:s
  anropare redan hanterar när en funktion saknas, till exempel
  `{error, enotsup}`), `stub` (kastar `error({not_implemented, F, A})` med
  `M:F/A` överst på stacken, som
  [`erlang`-stubbarna](builtins.md#erlang-module) gör; ännu inte klar) eller
  `declined` (en stubbe som blir kvar, med ett skäl som distribution eller
  kodladdning). En ny modul börjar med varje funktion som stubbe, så att den
  kan hittas och dess anropare kompileras; grupper flyttas sedan till sin
  beslutade status.
- **Saknad:** Clause levererar ingen modul alls, möjligen för alltid, och
  registrerar varför och vilka Clause-moduler på högre nivå som tar dess
  anropares plats (`library/modules.terms`). Lågnivålagren för filer och
  socketar som heter `prim_*` (`prim_file`, `prim_buffer`, `prim_socket`,
  `prim_net`, `prim_inet`, `socket_registry`) samt `socket` och `net` är de
  saknade modulerna: program använder i stället Clauses `file`, `gen_tcp`,
  `gen_udp` och `inet`, och eftersom Clause-moduler vinner över OTP:s (nedan)
  kommer OTP:s anropare av en saknad modul (OTP:s `gen_tcp_socket`,
  `inet_tcp`, ...) aldrig in i en batch. En saknad modul får aldrig en stubbe,
  så en referens till den är ett fel vid kompilering, aldrig en överraskning
  vid körning.

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
  och `erlang`), `kernel`, `stdlib`. Clauses privata hjälpmoduler
  (`clause_socket`, `clause_re`, `clause_unicode`, `clause_zlib`,
  `clause_receive`, `clause_maps`) ligger bredvid de moduler de betjänar.
  Biblioteksuppslagningen söker i varje applikationskatalog; ett modulnamn
  finns i högst en av dem.
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
som `erlang`). `escript tests/compiler/library/observe_types.escript LIBRARY APP
MODULE` skriver headern från värdens OTP, och `--check` jämför dess former med
en ny observation (CTest `library_freshness`); `library_modules.py check`
kräver att varje header inkluderas av sin modul. Typer som headrarna anger från
moduler utanför programmet (`unicode:chardata()`, `calendar:datetime()`) och
OTP:s breda unioner (`file:posix()` har fler medlemmar än typgrafen behåller)
löses till `term()` utan varning: diagnostiken hör till Clauses bibliotek,
inte till användarens program.

### Kärntjänster vid uppstart

OTP:s `file`, `io`, `code` och `logger` anropar registrerade servrar
(`file_server_2`, `code_server`, en gruppledares io-server, `logger`) som
applikationen `kernel` startar vid uppstart. En körbar fil från Clause startar
ingen av dem: Clauses egna `file` och `io` behöver ingen server, och en
OTP-modul som behöver en misslyckas på samma sätt som den misslyckas i OTP
utan den servern (`noproc`). OTP-kod som loggar genom `logger` eller anropar
`code` under körning fungerar därför inte. Att starta hela applikationen
`kernel` är inte planerat.

### Liggare

Verkliga program driver detta arbete; projektet luerl är den nuvarande
drivkraften ([21-lib](../.agents/21-lib.md)). Kompilera och kör det,
klassificera varje fel (`unknown module`, `undefined function M:F/A`, syntax
eller funktion som inte stöds, annat) och tilldela vart och ett ett plan step,
en annan post i eftersläpningen eller ett registrerat avböjande. Med
körningens stderr sparad i en fil skriver
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
  `stub`/`declined`-post som inte är en `not_implemented`-stubbe, en
  `implemented`/`refused`-post utan kropp eller inbyggd funktion i katalogen.
  `library_rejects` bevisar det på ett avsiktligt inkonsekvent
  fixturbibliotek.
- CTest `library_freshness` (etiketterna `host_otp`, `full_only`) observerar
  varje inventering på nytt och kräver att den är oförändrad, och observerar,
  genererar, kontrollerar och kompilerar sedan en ny modul från början till
  slut. `library_report` kör `clau` på ett fixturprogram och kontrollerar
  rapportens rader.
