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

Authoring toolchain: tree-sitter CLI **0.26.13** (a development
dependency only — `src/parser.c` is committed, so building the linter
needs no grammar toolchain). Installing it needs `clang-devel` in the
distro: the CLI vendors QuickJS and its build script uses bindgen,
which fails with `Unable to find libclang` on a bare toolbox.

## The precondition

ARCH `dec:linter:kotlin-tree-sitter` gates the Kotlin frontend on this
grammar parsing the whole Android corpus to **zero error nodes**.
`scripts/measure.sh` is the measurement, shaped after the one in ARCH
`rep:linter:kotlin-parser-study`.

The corpus has **grown since the study**: the study measured 138 `.kt`
files, the tree now holds **170** (plus 18 `.kts`, which are a separate
and undecided question). The precondition is measured against what is
there, never against the study's number.

### Met

```
--- ARCH dec:linter:kotlin-tree-sitter precondition (.kt) ---
files parsed:        170
files with errors:   0
total ERROR/MISSING: 0
```

Parsing all 170 files (1.27 MB) takes **0.07 s** in one batch. The
parser is 2,905 states and a 5.4 MB `src/parser.c`.

### The comment census, as a cross-check

The frontend's whole interest is that comments arrive as named nodes, so
the grammar's own count is worth comparing with the study's:

| | this grammar, 170 files | study, 138 files |
|---|---:|---:|
| `line_comment` | 1,708 | 964 |
| `block_comment` (not KDoc) | **0** | 0 |
| `kdoc` | 681 | 441 |

The qualitative finding is reproduced exactly and independently: **every
block comment in this corpus is KDoc**. The line-comment count matches a
raw count of lines beginning with `//` exactly (1,708), and the corpus
contains no trailing comments at all, so the two should agree — and do.

### `.kts`, measured but not ruled on

```
--- ARCH dec:linter:kotlin-tree-sitter precondition (.kts) ---
files parsed:        18
files with errors:   18
total ERROR/MISSING: 43
```

Expected, and not a defect: the specification parses scripts with its
`script` production, which admits statements at the top level, while
this grammar implements `kotlinFile`, which admits only declarations.
Supporting `.kts` means adding that production, not fixing a bug. The
adoption data is deliberately untouched — that ruling is jakob's, and
this measurement is only its input.

## The lesson that shaped this grammar

The first draft was a faithful, complete translation of the ANTLR
grammar, with each conflict tree-sitter reported added to the
`conflicts` list until it generated. It generated — into **25,684 parse
states and an 85 MB `parser.c`**, about ten times the size of a healthy
grammar of this kind, and needing more than 16 GB to generate.

Adding a conflict does not resolve an ambiguity; it tells tree-sitter to
*split the parse and carry both readings*. Collecting them
mechanically therefore manufactures the explosion it appears to fix.
Removing individual features from that grammar changed nothing, because
the conflict set simply re-formed around whatever was left.

The grammar was rebuilt bottom-up with **no declared conflicts**, adding
one construct group at a time and measuring after each. Every ambiguity
tree-sitter reported was then read and fixed *structurally* — the
declared conflicts that remain are the few that are genuinely
undecidable, each one argued in a comment where it is declared.

| Stage | States | `parser.c` |
|---|---:|---:|
| translation with collected conflicts | 25,684 | 85 MB |
| core: declarations, cascade, types, strings | 395 | 0.9 MB |
| \+ modifiers and annotations | 439 | 1.0 MB |
| \+ classes, objects, enums, members | 733 | 1.1 MB |
| \+ control flow, jumps, labels, assignment | 1,890 | 3.7 MB |
| \+ lambdas, object literals, anonymous functions | 1,805 | 3.3 MB |
| \+ receivers, accessors, richer types | 4,702 | 8.8 MB |
| final, after the `if` and accessor rework | 2,905 | 5.4 MB |

### The statement separator, which caused most of both problems

`optional($._semi)`. Kotlin always has a statement separator — the
scanner infers one from the newline — so an optional one lets a
declaration abut the expression before it. That is what makes `val x = a`
followed by `enum class F` ambiguous with an infix call named `enum`.
**Where a separator belongs, it is required, never optional.**

The mirror image caused most of the remaining *parse failures*, long
after the state explosion was solved. Where a construct may follow a
statement on the next line — `else`, and a property's accessors — a
separator in the grammar competes with the statement's own terminator
for the same inferred token, and whichever consumes it strands the
other. No arrangement in the grammar settles it: optional, and an
accessor may begin with no separator at all; required, and the
terminator ending the whole declaration is eaten and an accessor
demanded in its place. Only look-ahead decides, so **the scanner
declines to infer a terminator before `else` and before an accessor**,
and the grammar has no separator there at all. A single missing case —
`else` — accounted for 58 of the 60 remaining failing files.

## Design decisions

Recorded where the specification is silent, or where this grammar
deliberately departs from it. Decisions taken straight from the
specification's text are not repeated here — they are simply the
translation.

### Newlines are extras; statement ends come from the scanner

The ANTLR grammar threads `NL*` through nearly every production and
hides newlines inside `(...)` / `[...]` via its `Inside` lexer mode.
tree-sitter has no lexer modes, and the documented idiom for a
newline-sensitive language is the inverse: put newlines in `extras` so
they are ignored everywhere, and have the external scanner emit an
`_automatic_semicolon` where a statement may end.

This yields the same language. tree-sitter only asks the scanner for a
token that is *valid in the current parse state*, and a statement
terminator is never valid inside an argument list — which reproduces
the `Inside` mode's newline-hiding exactly, without modes.

Which tokens may follow a newline is read straight off the ANTLR
grammar: a token continues a statement exactly where the grammar writes
`NL*` before it. That is `.`, `?.`, `||`, `&&`, `?:` and `as`/`as?` —
and, deliberately, **not** `::`, `+`, `*`, `in`, `is`, or an infix
function name, none of which the grammar admits a newline before.

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

### String bodies are the scanner's, so a comment inside one is impossible

Found by the frontend lane, which is the only place it could be found:
the grammar alone looked right.

`extras` are global in tree-sitter. A comment is a candidate wherever
the lexer may begin a token, and `token.immediate` does not prevent it —
immediacy stops the *internal* lexer from skipping trivia, while the
external scanner is consulted regardless, and comments must be external
because Kotlin's nest. So inside `"..."`, at any position where a
content token began, a `//` was lexed as a comment:

- `val x = "// not a comment"` — the comment swallowed the closing
  quote, and the declaration became an `ERROR`.
- `val x = "/* not a comment */"` — the comment closed, the string
  parsed, and the tree carried `(line_string_literal (block_comment))`
  with **no error at all**. A label written there would have become a
  real occurrence, which is precisely what `[scanned-regions]` promises
  cannot happen. The silent half, and the graver one.

Only two positions bit: just inside the opening quote, and just after an
interpolation's `}`. Mid-content a single greedy token spanned the
leader and the lexer never stopped there — which is why every URL in the
corpus stayed clean and the defect stayed hidden.

The fix is the arrangement the raw string already had: the content is an
external token, so the scanner knows it is inside a string and refuses
to produce anything else while `_line_string_content` is valid. It is
the refusal, not the content token, that does the work — it covers the
empty runs at exactly the two positions that used to bite, and what
follows them is an escape, an interpolation or the closing quote, none
of which can introduce trivia. A comment node inside a string is
therefore unreachable rather than merely unlikely, which is what the
ratified contract asks for: string literals are never scanned.

Pinned by four corpus tests and, corpus-wide, by the frontend suite's
guard over every `.kt` source.

### The expression cascade is literal

KotlinParser.g4 states precedence as a cascade of rules. The usual
tree-sitter shorthand collapses such a cascade into one rule carrying
`prec.left` levels; that accepts the same language through an
*ambiguous* grammar. The cascade is reproduced literally instead,
because it is unambiguous by construction.

A construct whose body runs to the end of an expression cannot be an
atom in that cascade — as a `_primary_expression` it would be ambiguous
with every operator above it. `throw`, `return`, `if` and anonymous
functions therefore sit at the top of the cascade, where nothing can
extend them. `when` and `try` need no such treatment: they close with
`}`, so they remain ordinary operands, which is what keeps
`when (x) { ... }.also { }` working.

### Deliberate departures from the specification

Each of these narrows the language slightly, in a place where the
specification admits a form that does not occur, and each removes a
whole family of ambiguities.

- **Infix function names are plain identifiers**, not `simpleIdentifier`.
  The specification admits every soft keyword, which makes `expr where`,
  `expr enum` and `expr by` ambiguous between an infix call and whatever
  the keyword actually opens. Kotlin's infix functions are named `to`,
  `until`, `shl`, `downTo`.
- **Delegation (`by`) is only in declarations**, not in object
  literals. An object literal is an expression, so a delegate reaching
  into the expression cascade competes with every operator that could
  follow the literal, at every level. `class A : B by b` keeps it.
- **`callable_reference` has no receiver.** `String::class` and
  `foo::bar` arrive as a navigation suffix on the expression; admitting
  a type here too would make every leading identifier ambiguous between
  a type and an expression.
- **Annotation arguments must be immediate** — no space between the name
  and `(`. Nothing else distinguishes `@Preview(showBackground = true)`,
  where the arguments attach, from `@Composable () -> Unit`, where the
  `()` opens the annotated function type. This one is load-bearing for
  this corpus.
- **Receivers are a named type with an optional `?`**, never
  parenthesised; a parenthesised receiver makes `val (a, b) = ...`
  ambiguous with a destructuring declaration from the opening paren on.
- **No `data object` literal and no `suspend fun` expression.** Both
  forms exist only as declarations in practice, and admitting them makes
  the leading `data`/`suspend` ambiguous with the modifier.
- **`if` drops the specification's bare `SEMICOLON` branches** for an
  empty body; an omitted body plus the enclosing statement's own
  separator covers them, and keeping them collides with that separator.
- **Assignment takes an expression on the left.** The specification
  restricts it to assignable shapes, which re-derives most of the
  expression grammar for a distinction this linter never uses — an
  unassignable target is a type error, not a parse error.

### A raw string ending in a quote

The closing delimiter is `MultiLineStringQuote? '"""'`, so in a run of
more than three quotes the leading extras belong to the content. The
scanner cannot know a run's length until it has consumed it, and a token
boundary can only be marked at a position the lexer currently occupies,
so the whole run is taken as the delimiter. The parse is identical in
shape and carries no error node; only the split between the last content
character and the delimiter differs, and only in a raw string whose
content ends in a literal quote.

### Not yet covered

- **Multi-dollar string interpolation** (`$$"""..."""`, Kotlin 2.2+).
  Worth flagging: the specification's own ANTLR grammar on the release
  branch does **not** describe it, so the ratified build source and the
  named scanner scope disagree. The corpus contains no instance —
  measured, not assumed — so it is deferred rather than guessed at.
- **Definitely-non-nullable types** (`T & Any`).
- **`.kts`**, which the adoption data defers to this slice and which is
  jakob's ruling to make; this lane only measures.

### A comment found while deciding a statement end

The scanner must emit it rather than decline. Deciding whether a newline
ends a statement means looking at what follows, and what follows may be
a comment — `foo()` then a comment line then `.bar()`. Looking past it
means advancing over it, and within one scan call the lexer cannot be
wound back; declining then loses the comment entirely, because the
internal lexer has no comment token to fall back on. So on finding a
comment the scanner returns *the comment*, and the terminator question
is put again at the position after it, where the newline that follows a
comment supplies one if it is still wanted.

## Status

**The precondition is met.** The grammar parses the whole Android corpus
to zero error nodes, comments and KDoc arrive as named nodes, and the
corpus tests pin the behaviour that got it there.

Coverage: packages, imports, file annotations, classes, interfaces,
objects, companions, enums, type aliases, primary and secondary
constructors, initialisers, properties with accessors and delegates,
functions, extension receivers, type parameters and constraints,
delegation, annotations with use-site targets, modifiers, the full
expression cascade, lambdas and trailing lambdas, anonymous functions,
object literals, control flow, jumps, labels, string templates, raw
strings, and every numeric literal form.

Not covered, and deliberate: multi-dollar interpolation, definitely
non-nullable types (`T & Any`), and the `script` production `.kts`
needs. See "Not yet covered" above.

`test/corpus/` holds 30 tests. They are what a future change should be
measured against, together with `scripts/measure.sh`.
