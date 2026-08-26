# tree-sitter-kotlin

A first-party Kotlin grammar for the CoGra corpus linter, written from
scratch against the Kotlin specification's own ANTLR grammar and
building on no community grammar (ARCH `dec:linter:kotlin-tree-sitter`).

- `grammar.js` — the grammar
- `src/scanner.c` — the external scanner: nesting comments, raw string
  bodies, and semicolon inference
- `src/parser.c` — **generated, and committed**. Building the linter
  needs no grammar toolchain; the tree-sitter CLI is a development
  dependency only, for regenerating after a change to `grammar.js`
- `test/corpus/` — the grammar's own tests
- `scripts/measure.sh` — the zero-error precondition, measured over the
  Android corpus
- `PROGRESS.md` — build log, design decisions, and the deliberate
  departures from the specification

Regenerate after editing `grammar.js` or `src/scanner.c`:

```bash
tree-sitter generate && tree-sitter test && scripts/measure.sh
```

This tree is outside the linter's carrier (`corpus-adoption.toml`
`[carrier] vendored_trees`): its comments answer to the Kotlin
specification and to tree-sitter's conventions, not to this corpus's
label discipline.
