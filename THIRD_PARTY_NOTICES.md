# Third-party notices

`cite-for-all` is distributed under the MIT License. The citation engine also
uses the following third-party works under their own licenses.

## Citation.js

- Packages: `@citation-js/core`, `@citation-js/plugin-csl`,
  `@citation-js/plugin-bibtex`
- Version: 0.8.2
- Copyright: Lars Willighagen and Citation.js contributors
- License: MIT
- Source: <https://github.com/citation-js/citation-js>
- License copy: [`LICENSES/citation-js-MIT.md`](LICENSES/citation-js-MIT.md)

## citeproc-js

- Package: `citeproc` 2.4.63, included by `@citation-js/plugin-csl`
- Copyright: © 2009–2019 Frank Bennett
- License selected by this project: Common Public Attribution License 1.0
- Attribution copyright notice: (c) Frank Bennett
- Attribution phrase: citeproc-js implements the Citation Style Language
- Attribution URL: <https://citationstyles.org/>
- Source: <https://github.com/Juris-M/citeproc-js>
- License copy:
  [`LICENSES/citeproc-js-CPAL-1.0.txt`](LICENSES/citeproc-js-CPAL-1.0.txt)

The required attribution is displayed in the application's user interface.

## Citation Style Language styles and locale

The six vendored CSL styles and the `en-US` locale retain their original
metadata and are licensed under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/):

- APA Style 7th edition
- Modern Language Association 9th edition
- Chicago Manual of Style 18th edition (author-date)
- Cite Them Right 12th edition — Harvard
- IEEE
- NLM citation sequence (used for Vancouver output)
- CSL locale `en-US`

Sources:

- <https://github.com/citation-style-language/styles>
- <https://github.com/citation-style-language/locales>

The pinned source revisions and reproducible download list are recorded in
[`scripts/sync-csl-assets.mjs`](scripts/sync-csl-assets.mjs).
