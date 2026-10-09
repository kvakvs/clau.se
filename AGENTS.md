# Description

This is front facing presentation website for the project located one level
above, in `../clau` Refer to its `README.md` and its `../clau/docs/` directory
for more details.

## Website Implementation

Follow coding rules in `.agents/rules-web.md`.

* Use next.js/typescript/react/tailwind css to create minimal website
* Have light and dark color theme, with a toggle Light - Auto - Dark, where Auto
  will detect device current theme and follow it. Display theme selector in top
  right.
* Have language translations: English, Swedish, French, German, Portuguese,
  Spanish, Ukrainian. Detect language from top preferred browser language, but
  otherwise default to English. Language dropdown in the top right next to the
  theme selector.
  - Language 2-letter code is the first component of the path:
    https://clau.se/<language>/document/path

### Main Page

Introduces the project with features shown as cards with prominent properties of
each feature. Followed by detailed features list.

### Documentation Page

Inform the visitor that the documentation is not ready, but in the meanwhile
they're welcome to read files from the `../clau/docs`. Present those files as a
table of contents with clickable pages.

- Getting started (prerequisites)
- Building the compiler
- Using the compiler
- How to interpret the results? (how to try on existing Erlang code corpus and
  what can be done and what can be tried)
- Known differences from Erlang/OTP in `../clau/docs/differences.md`
- ... other pages from `../clau/docs` can follow from here

### Resources Page

Show link to Github https://github.com/kvakvs/clause
