---
source: docs/io.md
sourceCommit: a8c3f8f6
sourceSha256: 1a1dffbcffc7158bbd4b175979fb33aef895af149c1a3d78b4f773598432536a
translatedAt: 2026-10-17
---
# Sortie console (`io`)

`io:format/1,2,3`, `io:fwrite/1,2,3`, `io:put_chars/1,2` et `io:nl/0,1` sont
des builtins du runtime du module `io` dans le catalogue du pont
([builtins](builtins.md)) ; le runtime implémente en C++ les règles
`io_lib_format` et `io_lib_pretty` d'OTP
([io_format.cpp](../runtime/src/builtins/io_format.cpp),
[io_pretty.cpp](../runtime/src/builtins/io_pretty.cpp)). Les fonctions d'entrée
de `io` sont écrites en Erlang dans la [bibliothèque](library.md#contents).

## Appels

- `io:format(Format)` équivaut à `io:format(Format, [])`. Les deux renvoient
  `ok`. `io:fwrite/1,2,3` sont identiques à `io:format/1,2,3` ; `io:nl/0,1`
  écrivent un saut de ligne.
- Périphériques de `io:format/3`, `io:fwrite/3`, `io:put_chars/2` et
  `io:nl/1` : `standard_io` et `user` désignent la sortie standard,
  `standard_error` la sortie d'erreur standard (la sortie standard est vidée
  d'abord, de sorte que les deux gardent leur ordre). Un pid, ou un atome
  enregistré pour l'un d'eux, est un serveur d'E/S : le texte lui est envoyé en
  UTF-8 via `file:write/2` (un fichier ouvert du module `file` de Clause), et
  l'appel renvoie ce que celui-ci renvoie. Un atome non enregistré donne
  `badarg`, un pid mort `error:terminated`, l'appelant lui-même
  `error:calling_self`, tout autre terme `function_clause`, comme OTP.
- `io:put_chars(Chardata)` écrit des chardata : caractères Unicode, binaries
  UTF-8 et listes imbriquées se terminant par `[]` ou un binary. Toute autre
  chose (un atome, un surrogate, de l'UTF-8 invalide, un bitstring) lève
  `badarg`.
- Le texte est construit en entier, puis écrit en UTF-8, comme le fait le
  périphérique de sortie standard d'OTP en mode `-noshell` (encodage
  `unicode`). Une erreur n'écrit rien. Une écriture refusée est l'échec du
  runtime `output_failure` (code de sortie 70).
- Les appels qualifiés, `fun io:format/2`, `apply(io, format, Args)` et
  `M:format(...)` atteignent tous les builtins. Un module du lot nommé `io` ne
  remplace pas les builtins (le module `io` d'OTP est sticky,
  [enregistrement](builtins.md#registration)).

## Formats

- `Format` est un atome (ses caractères), un binary (ses octets comme
  caractères Latin-1) ou une liste. Un élément de liste qui n'est pas un
  caractère est un chardata écrit tel quel, sans séquences de contrôle, et
  avance la colonne d'une unité (une bizarrerie d'OTP).
- Séquences de contrôle `~F.P.PadModC` : largeur de champ `F` (négative ou
  `-` : alignée à gauche), précision `P`, caractère de remplissage, `*` prenant
  un entier (ou le remplissage) dans les arguments, modificateurs `t`
  (Unicode), `l` (pas de détection de chaînes) et `k` (maps ordonnées ; Clause
  affiche toujours les maps dans l'ordre des clés).
- `C` pris en charge : `~w`, `~p`, `~s`, `~c`, `~b`, `~B`, `~i`, `~n`, `~~`,
  avec les règles de champ d'OTP : `~s` tronque ou complète jusqu'à `P` dans
  `F` ; `~w` et `~b` affichent des caractères `*` lorsque le texte ne tient pas
  dans `F` ; `~c` répète le caractère ; `~b`/`~B` prennent la base dans `P`
  (2..36) ; `~n` avec `F` écrit `F` sauts de ligne.
- Sans `t`, `~s` n'accepte que des caractères Latin-1 et `~c` écrit l'octet de
  poids faible de son entier ; `~w`/`~p` échappent les caractères d'atome
  au-delà de Latin-1 sous la forme `\x{...}`. Avec `t`, `~s` lit les binaries
  en UTF-8 (avec repli sur Latin-1) et `~p` écrit `<<"..."/utf8>>` pour les
  binaries UTF-8 imprimables.
- `badarg` : un caractère de contrôle inconnu, des arguments manquants ou en
  trop, un argument du mauvais type, `F` inférieur à `P` pour `~s`/`~c`, un
  `~p` ou `~n` aligné à gauche, une base hors de 2..36, une sortie qui n'est
  pas de l'Unicode.
- Non implémentés (`badarg`, voir [différences](differences.md#io)) : `~e`,
  `~f`, `~g`, `~x`, `~X`, `~+`, `~#`, `~W`, `~P` et le modificateur `K`.

## Affichage formaté (`~p`)

- La longueur de ligne est `F` (80 par défaut, 0 écrit une seule ligne) ; la
  première colonne est `P`, sinon la colonne que la sortie a atteinte sur sa
  ligne (tabulations aux multiples de 8).
- Le terme devient la forme intermédiaire d'OTP : chaque valeur avec sa
  longueur sur une ligne ; les chaînes (listes plates de caractères Latin-1
  imprimables, l'`io:printable_range()` par défaut), les binaries
  imprimables, les atomes et les nombres sont du texte.
- Ce qui tient sur le reste de la ligne est écrit en entier. Les listes et les
  tuples sont coupés entre les éléments, alignés après le crochet ou
  l'accolade ; les tuples étiquetés (`{atom, ...}`) s'alignent après
  l'étiquette, ou sont indentés de 4 (ou 1) lorsque cela dépasserait la moitié
  de la ligne ; les paires de map et les champs de native record qui ne tiennent
  pas placent la valeur sur la ligne suivante ; les binaries longs sont coupés
  entre les octets.
- Les conteneurs imbriqués sur plus de 256 niveaux lèvent `system_limit` (la
  mise en page est récursive sur la pile native).
- Le formatage s'exécute jusqu'au bout, quelle que soit la taille du terme
  ([portions](builtins.md#portions)).
