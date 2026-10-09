---
source: docs/specialization.md
sourceCommit: 06042fa
sourceSha256: 2c39d48470df1d080597dde6ad170daf6c6a24e35d3a42c166a0c9dcf90dee23
translatedAt: 2026-10-09
---
# Spécialisation par type

Le mode vitesse (`-O2`) peut cloner une fonction en variantes de représentation
protégées par des vérifications d'étiquette (tag) au runtime. `-O0` et
`--no-type-specialization` ne produisent que du code générique.

## Politique

- Les profils proviennent des faits inférés aux sites d'appel. Aujourd'hui, seuls
  des singletons entiers exacts et représentables sur la cible prouvent qu'un
  argument est un petit entier. Les specs, `integer()` au sens large, les unions
  et les inconnues restent génériques.
- Une variante n'est justifiée que si elle supprime une vérification
  implémentée : une comparaison exacte d'étiquette basse sur un chargement
  d'argument dans le bloc d'entrée, avant tout effet de bord.
- Limites : 3 variantes par fonction, 32 par module, 128 par cible. La
  croissance estimée puis réelle (clone + gardes + aiguillage + repli) doit
  rester inférieure à 2x le nombre d'instructions génériques par fonction et par
  module.
- Les corps génériques sont toujours conservés. Les ébauches qui dépassent le
  budget sont abandonnées silencieusement ; le programme n'échoue jamais à cause
  de la spécialisation.
- La sélection est déterministe (ordre module, symbole, profil).

## Abaissement

Le clonage et la simplification LLVM remplacent les vérifications prouvées à
l'intérieur du clone. Un aiguilleur borné teste chaque étiquette contrainte et
transmet le contexte et les arguments à une variante ou au corps générique ; le
symbole public et l'ABI ne changent pas. Aucun déballage non vérifié, aucune
hypothèse tirée des specs ni aucun drapeau fast-math n'est introduit.

## Effet actuel

Le sous-ensemble de source actuel ne contient aucune vérification de
représentation supprimable, si bien que le vrai code source Erlang ne reçoit
aucune variante, même en O2 ; spécialiser une identité ne ferait que grossir le
code. Des fixtures LLVM ciblées injectent des vérifications d'étiquette répétées
pour exercer les réussites, les replis et l'annulation en cas de croissance avec
une exécution native.

`codegen_measurements` écrit `measurements/<config>/measurements.json` dans le
répertoire de build des tests de codegen (temps de compilation, octets d'IR et
d'objet, variantes, temps natif). Les temps sont descriptifs, jamais des seuils.
Échantillon Windows x64 / LLVM 23.1.2 (2026-09-29) : charge de travail source de
232 876 octets d'IR / 40 498 octets d'objet en O0 et 204 408 / 35 886 avec les
deux politiques O2, aucune variante ; la fixture synthétique a ajouté
30 instructions à une fonction de 55 instructions pour une variante acceptée.
