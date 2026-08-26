# tree-sitter-kotlin — build log

First-party Kotlin grammar for the corpus linter
(ARCH `dec:linter:kotlin-tree-sitter`). Written from scratch against
the official Kotlin grammar; no community grammar was consulted for
structure.

## Build sources

The grammar is a translation of the Kotlin specification's own ANTLR
grammar, taken verbatim from the specification repository:

- `grammar/src/main/antlr/KotlinParser.g4` — syntactic grammar
- `grammar/src/main/antlr/KotlinLexer.g4` — lexical grammar
- `grammar/src/main/antlr/UnicodeClasses.g4` — identifier character classes

Authoring toolchain: tree-sitter CLI **0.26.13** (a development
dependency only — `src/parser.c` is committed, so building the linter
needs no grammar toolchain).

## The precondition

ARCH `dec:linter:kotlin-tree-sitter` gates the Kotlin frontend on this
grammar parsing the whole Android corpus to **zero error nodes**.
`scripts/measure.sh` is the measurement, shaped after the one in ARCH
`rep:linter:kotlin-parser-study`.

### Trajectory

| Date | Files | Files with errors | Total ERROR/MISSING nodes | Note |
|---|---:|---:|---:|---|
| 2026-08-26 | 170 | — | — | tree established; grammar not yet written |

The corpus has **grown since the study**: the study measured 138 `.kt`
files, the tree now holds 170 (topics-android merged in between). The
precondition is measured against what is there, never against the
study's number.

## Design decisions

Recorded here when the specification is silent and the choice is mine,
per the lane's rule. Decisions taken from the specification's own text
are not repeated here — they are simply the translation.

### Newlines are extras; statement ends come from the scanner

The ANTLR grammar threads `NL*` through nearly every production and
hides newlines inside `(...)` / `[...]` via its `Inside` lexer mode.
tree-sitter has no lexer modes, and the documented idiom for a
newline-sensitive language is the inverse: put newlines in `extras` so
they are ignored everywhere, and have the external scanner emit an
`_automatic_semicolon` token where a statement may end.

This yields the same language. tree-sitter only asks the scanner for a
token that is *valid in the current parse state*, and a statement
terminator is never valid inside an argument list — which reproduces
the `Inside` mode's newline-hiding exactly, without modes.

### Nesting block comments live in the scanner

`DelimitedComment : '/*' ( DelimitedComment | . )*? '*/'` is recursive
in the specification's lexical grammar: Kotlin block comments nest.
A tree-sitter regex token cannot express recursion, so comments are
scanner tokens. This is also what the frontend wants — comments arrive
as named nodes.

Three named comment nodes rather than one, matching the three scanned
region kinds the adoption data names: `line_comment`, `block_comment`,
`kdoc`. KDoc is a block comment whose opener is `/**` and which is not
the empty `/**/`.

## Status

Grammar coverage, scanner state, and corpus test counts are recorded
here as they land. See `test/corpus/` for what is pinned by test.
