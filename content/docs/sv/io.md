---
source: docs/io.md
sourceCommit: 336caea7
sourceSha256: f513079db5cb8e2a7c9e02f15d3c952b9271d64d60cc3c3787cc2eee5efb3a15
translatedAt: 2026-10-18
---
# Konsolutdata (`io`)

`io:format/1,2,3`, `io:fwrite/1,2,3`, `io:put_chars/1,2` och `io:nl/0,1` är
inbyggda funktioner i runtimen för modulen `io` i bryggans katalog
([inbyggda funktioner](builtins.md)); texten är den från `io_lib:format/2`,
byggd av [io_lib:s motor](builtins.md#io_lib) och utplattad, med `~p` utlagd
enligt OTP:s regler för `io_lib_pretty`
([io_lib/pretty.cpp](../runtime/src/builtins/io_lib/pretty.cpp)).
Indatafunktionerna i `io` är skrivna i Erlang i
[biblioteket](library.md#contents).

## Anrop

- `io:format(Format)` är `io:format(Format, [])`. Båda returnerar `ok`.
  `io:fwrite/1,2,3` är desamma som `io:format/1,2,3`; `io:nl/0,1` skriver en
  radbrytning.
- Enheter för `io:format/3`, `io:fwrite/3`, `io:put_chars/2` och `io:nl/1`:
  `standard_io` och `user` är standard-utdata, `standard_error` är
  standard-fel (standard-utdata töms först, så att de två behåller sin
  ordning). En pid, eller en atom registrerad till en, är en I/O-server:
  texten går till den som UTF-8 via `file:write/2` (en öppen fil i Clauses
  modul `file`), och anropet returnerar det som den returnerar. En
  oregistrerad atom ger `badarg`, en död pid `error:terminated`, anroparen
  själv `error:calling_self`, varje annan term `function_clause`, som i OTP.
- `io:put_chars(Chardata)` skriver chardata: Unicode-tecken, UTF-8-binaries
  och nästlade listor som slutar med `[]` eller en binary. Allt annat (en
  atom, ett surrogat, ogiltig UTF-8, en bitstring) kastar `badarg`.
- Texten byggs i sin helhet och skrivs sedan som UTF-8, som OTP:s enhet för
  standard-utdata gör i läget `-noshell` (kodningen `unicode`). Ett fel
  skriver ingenting. En avvisad skrivning är runtime-felet `output_failure`
  (exit 70).
- Kvalificerade anrop, `fun io:format/2`, `apply(io, format, Args)` och
  `M:format(...)` når alla de inbyggda funktionerna. En batchmodul med namnet
  `io` ersätter inte de inbyggda funktionerna (OTP:s `io` är klistrig
  (sticky), [registrering](builtins.md#registration)).

## Format

- `Format` är en atom (dess tecken), en binary (dess byte som
  Latin-1-tecken) eller en lista. Ett listelement som inte är ett tecken är
  chardata som skrivs som det är, utan styrsekvenser, och flyttar kolumnen
  ett steg (OTP:s egenhet).
- Styrsekvenser `~F.P.PadModC`: fältbredd `F` (negativ eller `-`:
  vänsterjusterad), precision `P`, utfyllnadstecken, `*` som tar ett heltal
  (eller utfyllnaden) från argumenten, modifierarna `t` (Unicode), `l` (ingen
  strängdetektering), `k` (ordnade maps) och `K` (ordningen från argumenten:
  `ordered`, `reversed`; jämförelse-funs ger `badarg`). Maps skrivs i
  nyckelordning.
- Alla styrsekvenser i OTP 29 med dess fältregler: `~w ~W ~p ~P ~s ~e ~f ~g ~b
  ~B ~x ~X ~+ ~# ~c ~i ~n ~~`. `~s` kortar av eller fyller ut till `P` inom
  `F`; `~w`, heltal och flyttal skriver `*`-tecken när texten inte ryms i
  `F`; `~c` upprepar tecknet; heltalsbaser tas från `P` (2..36); `~n` med
  `F` skriver `F` radbrytningar; bredder räknas som `io_lib:chars_length/1`.
- Utan `t` tar `~s` endast Latin-1-tecken och `~c` skriver den låga byten av
  sitt heltal; `~w`/`~p` skriver atomtecken utanför Latin-1 som `\x{...}`.
  Med `t` läser `~s` binaries som UTF-8 (med Latin-1 som reserv) och `~p`
  skriver `<<"..."/utf8>>` för utskrivbara UTF-8-binaries.
- `badarg`: allt som får `io_lib:format/2` att misslyckas (ett okänt
  styrtecken, saknade eller extra argument, ett argument av fel typ, `F`
  mindre än `P`, en vänsterjusterad `~p` eller `~n`, en bas utanför 2..36),
  och utdata som inte är Unicode.

## Snygg utskrift (`~p`)

- Radlängden är `F` (standard 80, 0 skriver en rad); den första kolumnen är
  `P`, annars den kolumn som utdata har nått på sin rad (tabbar till
  multiplar av 8).
- `~P` klipper termen vid sitt djupargument och `chars_limit` (alternativ
  till `io:format/3` och `io_lib:format/3`) vid styrsekvensens andel av
  tecknen, och skriver `...` där delar utelämnats, som OTP gör.
- Termen blir OTP:s mellanform: varje värde med sin längd på en rad; strängar
  (platta listor av utskrivbara Latin-1-tecken, standardvärdet för
  `io:printable_range()`), utskrivbara binaries, atomer och tal är text.
- Det som ryms på resten av raden skrivs i sin helhet. Listor och tupler bryts
  mellan element, justerade efter hakparentesen; taggade tupler
  (`{atom, ...}`) justeras efter taggen, eller dras in med 4 (eller 1) när det
  skulle passera halva raden; par i maps och fält i native records som inte
  ryms placerar värdet på nästa rad; långa binaries radbryts mellan byte.
- Behållare som är nästlade djupare än 256 nivåer kastar `system_limit`
  (layouten rekurserar på native-stacken).
- Formateringen körs till slut, hur stor termen än är
  ([portioner](builtins.md#portions)).
