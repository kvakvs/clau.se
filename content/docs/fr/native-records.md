---
source: docs/native-records.md
sourceCommit: a8c3f8f6
sourceSha256: b3cd9f802ea845b9145cd2ca30525129bb74dce96fc0d1da55c515a295eabf0e
translatedAt: 2026-10-17
---
# Native records

Les formes de record d'OTP 29 au-delà des records ordinaires sous forme de
tuples : leur représentation, leurs opérations et leurs erreurs. Les records
tuples sont décrits dans [termes](terms.md#records).

OTP 29 classe les native records comme expérimentaux. Les faits ci-dessous
proviennent des sources épinglées de `maint-29` (`erl_lint`,
`erl_expand_records`, `v3_core`, `beam_core_to_ssa`,
`erts/emulator/beam/erl_record.c`, `utils.c`, `erl_printf_term.c`) et de
sondages en direct sur OTP 29.1.1.

## Périmètre

Les trois formes au-delà des records tuples sont implémentées et partagent une
même représentation :

| Forme | Syntaxe |
| --- | --- |
| Native record, local | `-record #r{...}.`, `#r{...}`, `X#r.f`, `X#r{...}`, motifs, `is_record/1,2,3` |
| Qualifié et importé | `#m:r{...}`, `X#m:r.f`, `X#m:r{...}`, motifs ; `-export_record`, `-import_record` |
| Inféré (anonyme) | `X#_.f`, `X#_{...}`, motif `#_{...}` |

Non fournis : le module de réflexion `records` (les appels à `records:*` sont
des diagnostics `unknown module`), `term_to_binary` des native records
(`error:notsup`, [format externe des termes](builtins.md#external-term-format))
et la mise à jour de code à chaud.

## Représentation

- **Descripteur.** Chaque définition de native record se compile en un
  `abi::v1::RecordDescriptor` immuable à côté du descripteur de son module : le
  `ModuleDescriptor` qui le définit, des emplacements d'atomes pour les noms du
  module et du record, l'indicateur d'export (`-export_record` à la compilation)
  et les emplacements d'atomes des noms de champs dans l'ordre de définition.
  Les emplacements d'atomes sont résolus via les atomes enregistrés du module,
  comme les noms de `FrameDescriptor`. Les programmes sont statiques (pas de
  déchargement), donc un descripteur vit aussi longtemps que le programme ; un
  autre module du lot y fait référence par symbole. Les valeurs par défaut sont
  compilées dans chaque site de construction, jamais stockées.
- **Instance.** Cellule du tas de type `native_record` : en-tête (nombre
  `1 + n`), un mot de descripteur non tracé, puis `n` valeurs tracées dans
  l'ordre de définition. Un record sans champ est une cellule de deux mots.
- Le descripteur capture le module, le nom, l'indicateur d'export et la liste
  des champs à la construction, comme la définition capturée d'OTP. Toute
  opération après la construction lit le descripteur de l'instance, jamais le
  code qui l'exécute.
- La copie, le ramassage, le parcours et la vérification traitent la cellule
  comme un tuple dont le premier mot de charge utile n'est pas tracé.
  L'admission exige un descripteur enregistré par un module du même runtime.

## Opérations

`M` est le module courant. Toutes les erreurs ont la classe `error` ; le
contenu de badrecord est la valeur fautive, sauf pour une construction externe
ratée.

| Opération | Accepte | Échec |
| --- | --- | --- |
| Construction locale `#r{...}` | Toujours (la définition est locale) | Champ inconnu ou valeur manquante sont des erreurs de compilation |
| Construction externe `#m:r{...}` (aussi `#r{...}` importé, aussi `#M:r`) | `m:r` défini dans le lot et exporté | `{badrecord, {m, r}}` ; puis `{badfield, {{m, r}, F}}`, `{novalue, {{m, r}, F}}` (badfield l'emporte) |
| Accès local `X#r.f` | Native record nommé `r` (module et indicateur d'export **non** vérifiés, comme le runtime d'OTP) | `{badrecord, X}` ; champ absent `{badfield, {{Mod, r}, f}}` |
| Accès externe `X#m:r.f` | Module `m`, nom `r`, exporté | `{badrecord, X}` ; `{badfield, ...}` |
| Accès anonyme `X#_.f` | Tout native record (export **non** vérifié, comme le runtime d'OTP) | `{badrecord, X}` ; `{badfield, ...}` |
| Mise à jour locale `X#r{...}` | Module `M`, nom `r` | `{badrecord, X}` ; champ inconnu `{badfield, ...}` |
| Mise à jour externe `X#m:r{...}` | Exporté, module `m`, nom `r` | idem |
| Mise à jour anonyme `X#_{...}` | Exporté ou module `M` | idem |
| Motif local `#r{...}` | Module `M`, nom `r`, chaque champ listé présent | pas de correspondance |
| Motif externe `#m:r{...}` | Module `m`, nom `r` ; exporté quand un champ est listé | pas de correspondance |
| Motif anonyme `#_{...}` | Tout native record ; exporté ou module `M` quand un champ est listé | pas de correspondance |

- La construction évalue les champs donnés dans l'ordre du source (les valeurs
  par défaut sont des littéraux) ; une mise à jour évalue d'abord le record,
  puis les nouvelles valeurs dans l'ordre du source, contrairement à une mise à
  jour de record tuple. Les mises à jour vides vérifient tout de même.
- Guards : seulement l'accès aux champs (un échec fait échouer la guard) et
  `is_record`. Une construction dans une guard donne
  `creating a record in a guard is only supported for tuple records` ; une
  mise à jour donne `illegal guard expression`.
- `is_record(X)` n'est vrai que pour les native records. `is_record(X, r)` avec
  un `r` natif local teste le module `M` et le nom `r` ; avec `r` importé de
  `m`, il teste le module `m`. `is_record(X, m, r)` avec des atomes teste le
  module et le nom ; avec un entier, c'est le test de tuple.
- Les native records ne sont pas des tuples : `is_tuple` est faux ; les
  services d'élément et de taille les rejettent.

## Règles à la compilation

Les messages suivent `erl_lint` :

- Les valeurs par défaut doivent être littérales après réduction des constantes
  (nombres, atomes, chaînes, `[]`, cons/tuples/maps de ceux-ci, binaries
  composés uniquement de chaînes) :
  `illegal default value for field a in native record r`.
- Construction locale sans valeur pour un champ sans valeur par défaut :
  `field a is not initialized in native record r` ; champ inconnu :
  `field zz undefined in record r`. Les champs inconnus dans les accès, mises à
  jour et motifs sont acceptés (OTP se contente d'avertir) ; ils échouent à
  l'exécution.
- L'index `#r.a`, `record_info/2`, les initialiseurs `_ = V` et les
  raffinements de type de champ sont réservés aux records tuples, avec les
  messages d'OTP.
- Un nom est soit un record tuple, soit un native record, soit un record
  importé ; les conflits et les formes `-export_record`/`-import_record`
  incorrectes sont des erreurs. `-export_record` doit précéder les définitions
  de fonctions.
- Les formes externes désignant un module hors du lot, un record non défini ou
  non exporté se compilent et échouent à l'exécution comme dans OTP. La
  construction externe est résolue par rapport au lot à la compilation : le
  module importateur abaisse lui-même les valeurs par défaut littérales du
  module qui le définit et référence son descripteur exporté ; les champs
  inconnus lèvent `badfield` avant qu'une valeur manquante ne lève `novalue`
  (`ErrorReason` 21).

## Affichage et ordre

- `erlang:display/1` affiche `#m:r{a=1,b=2}` : sans espaces, champs dans
  l'ordre de définition (OTP : ordre d'index de la table des atomes,
  [différences](differences.md#maps)).
- Ordre des termes : tuple < native record < map. Les records se comparent par
  module, nom, indicateur d'export (false d'abord), nombre de champs, noms des
  champs dans l'ordre de définition, puis valeurs dans l'ordre de définition.
  `=:=` exige en plus le même ordre des champs ; `==` compare les valeurs
  numériquement (le compilateur d'OTP réduit certains `==` sur des records à
  `=:=`, [différences](differences.md#maps) ; c'est la règle du runtime qui est
  suivie).

## Différences conservées

L'ordre des champs à l'affichage, la réduction de `==`, la construction
externe de modules non chargés et l'absence d'avertissements sur les records
sont consignés dans [différences](differences.md#maps).
