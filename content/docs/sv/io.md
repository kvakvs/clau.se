---
source: docs/io.md
sourceCommit: 06042fa
sourceSha256: d2fab91a793f6b40763a4bd16c2c85b45ce198ce2d3b6110aa9cfe117278f20d
translatedAt: 2026-10-09
---
# Konsolutdata (`io`)

Plan 11 step 40 (2026-10-07): `io:format/1,2` och `io:put_chars/1` skriver
till standard-utdata. De är inbyggda funktioner i runtimen för modulen `io` i
bryggans katalog ([inbyggda funktioner](builtins.md)); runtimen implementerar
OTP:s regler för `io_lib_format` och `io_lib_pretty` i C++
([io_format.cpp](../runtime/src/builtins/io_format.cpp),
[io_pretty.cpp](../runtime/src/builtins/io_pretty.cpp)).

## Anrop

- `io:format(Format)` är `io:format(Format, [])`. Båda returnerar `ok`.
- `io:put_chars(Chardata)` skriver chardata: Unicode-tecken, UTF-8-binaries
  och nästlade listor som slutar med `[]` eller en binary. Allt annat (en
  atom, ett surrogat, ogiltig UTF-8, en bitstring) kastar `badarg`.
- Texten byggs i sin helhet och skrivs sedan som UTF-8, som OTP:s enhet för
  standard-utdata gör i läget `-noshell` (kodningen `unicode`). Ett fel
  skriver ingenting. En avvisad skrivning är runtime-felet `output_failure`
  (exit 70).
- Kvalificerade anrop, `fun io:format/2`, `apply(io, format, Args)` och
  `M:format(...)` når alla de inbyggda funktionerna. Andra `io`-funktioner
  behåller diagnostiken `unknown module io`. En batchmodul med namnet `io`
  ersätter inte de inbyggda funktionerna (OTP:s `io` är klistrig (sticky)).

## Format

- `Format` är en atom (dess tecken), en binary (dess bytes som
  Latin-1-tecken) eller en lista. Ett listelement som inte är ett tecken är
  chardata som skrivs som det är, utan styrsekvenser, och flyttar kolumnen
  ett steg (OTP:s egenhet).
- Styrsekvenser `~F.P.PadModC`: fältbredd `F` (negativ eller `-`:
  vänsterjusterad), precision `P`, utfyllnadstecken, `*` som tar ett heltal
  (eller utfyllnaden) från argumenten, modifierarna `t` (Unicode), `l` (ingen
  strängdetektering) och `k` (ordnade maps; Clause skriver alltid ut maps i
  nyckelordning).
- `C` som stöds: `~w`, `~p`, `~s`, `~c`, `~b`, `~B`, `~i`, `~n`, `~~`, med
  OTP:s fältregler: `~s` kortar av eller fyller ut till `P` inom `F`; `~w` och
  `~b` skriver `*`-tecken när texten inte ryms i `F`; `~c` upprepar tecknet;
  `~b`/`~B` tar basen från `P` (2..36); `~n` med `F` skriver `F`
  radbrytningar.
- Utan `t` tar `~s` endast Latin-1-tecken och `~c` skriver den låga byten av
  sitt heltal; `~w`/`~p` skriver atomtecken utanför Latin-1 som
  `\x{...}`. Med `t` läser `~s` binaries som UTF-8 (med Latin-1 som reserv)
  och `~p` skriver `<<"..."/utf8>>` för utskrivbara UTF-8-binaries.
- `badarg`: ett okänt styrtecken, saknade eller extra argument, ett argument
  av fel typ, `F` mindre än `P` för `~s`/`~c`, en vänsterjusterad `~p` eller
  `~n`, en bas utanför 2..36, utdata som inte är Unicode.
- Inte implementerat (`badarg`, se [skillnader](differences.md#io)): `~e`,
  `~f`, `~g`, `~x`, `~X`, `~+`, `~#`, `~W`, `~P` och modifieraren `K`.

## Snygg utskrift (`~p`)

- Radlängden är `F` (standard 80, 0 skriver en rad); den första kolumnen är
  `P`, annars den kolumn som utdata har nått på sin rad (tabbar till
  multiplar av 8).
- Termen blir OTP:s mellanform: varje värde med sin längd på en rad; strängar
  (platta listor av utskrivbara Latin-1-tecken, standardvärdet för
  `io:printable_range()`), utskrivbara binaries, atomer och tal är text.
- Det som ryms på resten av raden skrivs i sin helhet. Listor och tupler bryts
  mellan element, justerade efter hakparentesen; taggade tupler
  (`{atom, ...}`) justeras efter taggen, eller dras in med 4 (eller 1) när det
  skulle passera halva raden; par i maps och fält i native records som inte
  ryms placerar värdet på nästa rad; långa binaries radbryts mellan bytes.
- Behållare som är nästlade djupare än 256 nivåer kastar `system_limit`
  (layouten rekurserar på native-stacken).
- Formateringen körs till slut, hur stor termen än är
  ([portioner](builtins.md#portions)).
