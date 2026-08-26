// External scanner for the first-party Kotlin grammar.
//
// Three jobs, each one something tree-sitter's regex tokens cannot do,
// and each named by ARCH dec:linter:kotlin-tree-sitter as the place the
// grammar's test discipline concentrates:
//
//   1. Comments. KotlinLexer.g4 defines
//        DelimitedComment : '/*' ( DelimitedComment | . )*? '*/'
//      which is recursive — Kotlin block comments nest — and no regular
//      expression can match a nested delimiter. The scanner also
//      separates KDoc from a plain block comment, so the linter's
//      frontend gets the three comment kinds the adoption data names as
//      distinct named nodes.
//
//   2. Raw string bodies. The closing delimiter is
//        TRIPLE_QUOTE_CLOSE : MultiLineStringQuote? '"""'
//      so a run of quotes belongs to the content except for its last
//      three. A longest-match lexer gets this backwards.
//
//   3. Semicolon inference. Kotlin ends a statement at a newline unless
//      the next line continues the expression. The specification says
//      exactly which tokens may follow a newline, by writing `NL*`
//      before them and nowhere else.

#include "tree_sitter/parser.h"

#include <string.h>
#include <wctype.h>

enum TokenType {
  AUTOMATIC_SEMICOLON,
  LINE_COMMENT,
  BLOCK_COMMENT,
  KDOC,
  RAW_STRING_CONTENT,
  RAW_STRING_END,
  ERROR_SENTINEL,
};

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

static inline bool is_ident_start(int32_t c) {
  return c == '_' || iswalpha(c);
}

static inline bool is_horizontal_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\f' || c == 0x0b ||
         c == 0xfeff;
}

// ---------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------

// Consumes the body of a block comment, honouring nesting. Enters with
// the opening "/*" already consumed and `depth` at 1.
static void consume_block_comment_body(TSLexer *lexer, unsigned depth) {
  while (depth > 0 && !lexer->eof(lexer)) {
    if (lexer->lookahead == '/') {
      advance(lexer);
      if (lexer->lookahead == '*') {
        advance(lexer);
        depth++;
      }
    } else if (lexer->lookahead == '*') {
      advance(lexer);
      if (lexer->lookahead == '/') {
        advance(lexer);
        depth--;
      }
    } else {
      advance(lexer);
    }
  }
}

// Scans a comment whose opening `/` has already been consumed. Split
// out because the statement-terminator scan discovers a comment only
// after stepping onto that slash, and within one scan call the lexer
// cannot be wound back.
static bool scan_comment_after_slash(TSLexer *lexer) {
  if (lexer->lookahead == '/') {
    while (!lexer->eof(lexer) && lexer->lookahead != '\n') advance(lexer);
    lexer->result_symbol = LINE_COMMENT;
    lexer->mark_end(lexer);
    return true;
  }

  if (lexer->lookahead == '*') {
    advance(lexer);

    // `/**` opens KDoc — but `/**/` is merely an empty block comment,
    // so the star that closes it does not make it documentation.
    bool is_kdoc = false;
    if (lexer->lookahead == '*') {
      advance(lexer);
      if (lexer->lookahead == '/') {
        advance(lexer);
        lexer->result_symbol = BLOCK_COMMENT;
        lexer->mark_end(lexer);
        return true;
      }
      is_kdoc = true;
    }

    consume_block_comment_body(lexer, 1);
    lexer->result_symbol = is_kdoc ? KDOC : BLOCK_COMMENT;
    lexer->mark_end(lexer);
    return true;
  }

  return false;
}

// Scans a comment at the current position.
static bool scan_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') return false;
  advance(lexer);
  return scan_comment_after_slash(lexer);
}

// ---------------------------------------------------------------------
// Raw strings
// ---------------------------------------------------------------------

// The closing delimiter. A run of three or more quotes ends the string.
//
// Where the run is longer than three, the specification assigns the
// leading extras to the content and only the last three to the
// delimiter. The scanner cannot know the run's length until it has
// consumed it, and a token boundary can only be marked at a position
// the lexer currently occupies, so the whole run is taken as the
// delimiter instead. The parse is identical in shape and carries no
// error node; only the split between the last content character and the
// delimiter differs, in a string ending in a literal quote. See
// PROGRESS.md.
static bool scan_raw_string_end(TSLexer *lexer) {
  if (lexer->lookahead != '"') return false;

  unsigned quotes = 0;
  while (lexer->lookahead == '"') {
    advance(lexer);
    quotes++;
  }
  if (quotes < 3) return false;

  lexer->mark_end(lexer);
  lexer->result_symbol = RAW_STRING_END;
  return true;
}

// A run of raw-string content, stopping before an interpolation or
// before the closing delimiter.
static bool scan_raw_string_content(TSLexer *lexer) {
  bool consumed_any = false;

  for (;;) {
    if (lexer->eof(lexer)) break;

    if (lexer->lookahead == '"') {
      // Freeze the token before the run, then measure it.
      lexer->mark_end(lexer);
      unsigned quotes = 0;
      while (lexer->lookahead == '"') {
        advance(lexer);
        quotes++;
      }
      if (quotes >= 3) {
        // The string ends here; the content stops before the run.
        if (!consumed_any) return false;
        lexer->result_symbol = RAW_STRING_CONTENT;
        return true;
      }
      // One or two quotes are ordinary content.
      lexer->mark_end(lexer);
      consumed_any = true;
      continue;
    }

    if (lexer->lookahead == '$') {
      lexer->mark_end(lexer);
      advance(lexer);
      if (lexer->lookahead == '{' || is_ident_start(lexer->lookahead)) {
        if (!consumed_any) return false;
        lexer->result_symbol = RAW_STRING_CONTENT;
        return true;
      }
      // A lone `$` is content (KotlinLexer.g4 MultiLineStrText).
      lexer->mark_end(lexer);
      consumed_any = true;
      continue;
    }

    advance(lexer);
    consumed_any = true;
    lexer->mark_end(lexer);
  }

  if (!consumed_any) return false;
  lexer->mark_end(lexer);
  lexer->result_symbol = RAW_STRING_CONTENT;
  return true;
}

// ---------------------------------------------------------------------
// Semicolon inference
// ---------------------------------------------------------------------

// Skips whitespace and whole comments while looking ahead. Only ever
// called after the statement terminator's own end has been marked, so
// nothing it consumes lands in a token: comments it steps over are left
// for the next lex, which is what keeps them in the tree as nodes.
static void peek_past_trivia(TSLexer *lexer) {
  for (;;) {
    while (is_horizontal_space(lexer->lookahead) || lexer->lookahead == '\n') {
      advance(lexer);
    }
    if (lexer->lookahead != '/') return;

    advance(lexer);
    if (lexer->lookahead == '/') {
      while (!lexer->eof(lexer) && lexer->lookahead != '\n') advance(lexer);
    } else if (lexer->lookahead == '*') {
      advance(lexer);
      consume_block_comment_body(lexer, 1);
    } else {
      // A division operator, not a comment. The specification writes no
      // `NL*` before it, so it does not continue the statement.
      return;
    }
  }
}

// Matches the rest of a keyword and checks that it ends there rather
// than running on into a longer identifier: `get` continues a property,
// `getScreenName` does not. Enters with the first letter unconsumed.
static bool scan_word_tail(TSLexer *lexer, const char *tail) {
  advance(lexer);
  for (const char *c = tail; *c; c++) {
    if (lexer->lookahead != (int32_t)*c) return false;
    advance(lexer);
  }
  return !is_ident_start(lexer->lookahead) && !iswdigit(lexer->lookahead);
}

// Reads an identifier into `out`, which is left empty if there is none.
static void scan_word(TSLexer *lexer, char *out, size_t cap) {
  size_t n = 0;
  while (n < cap - 1 &&
         (is_ident_start(lexer->lookahead) || iswdigit(lexer->lookahead))) {
    out[n++] = (char)lexer->lookahead;
    advance(lexer);
  }
  out[n] = '\0';
}

// Steps over a balanced `( ... )`, so an annotation's arguments do not
// stop the look-ahead. Enters on the opening paren.
static void skip_balanced_parens(TSLexer *lexer) {
  unsigned depth = 0;
  do {
    if (lexer->eof(lexer)) return;
    if (lexer->lookahead == '(') depth++;
    else if (lexer->lookahead == ')') depth--;
    advance(lexer);
  } while (depth > 0);
}

// Whether an accessor begins here, possibly behind the annotations and
// visibility modifiers Kotlin lets it carry: `private set`,
// `@Composable get() = ...`.
static bool scan_accessor_ahead(TSLexer *lexer) {
  char word[32];

  for (;;) {
    while (is_horizontal_space(lexer->lookahead)) advance(lexer);

    if (lexer->lookahead == '@') {
      advance(lexer);
      scan_word(lexer, word, sizeof(word));
      if (word[0] == '\0') return false;
      // A use-site target, or a dotted annotation name.
      while (lexer->lookahead == ':' || lexer->lookahead == '.') {
        advance(lexer);
        scan_word(lexer, word, sizeof(word));
      }
      if (lexer->lookahead == '(') skip_balanced_parens(lexer);
      continue;
    }

    if (!is_ident_start(lexer->lookahead)) return false;

    scan_word(lexer, word, sizeof(word));
    if (strcmp(word, "get") == 0 || strcmp(word, "set") == 0) {
      return !is_ident_start(lexer->lookahead) && !iswdigit(lexer->lookahead);
    }
    if (strcmp(word, "private") == 0 || strcmp(word, "protected") == 0 ||
        strcmp(word, "public") == 0 || strcmp(word, "internal") == 0) {
      continue;
    }
    return false;
  }
}

// Whether the token beginning at the current position may continue the
// previous line's expression.
//
// The set is read straight off KotlinParser.g4: a token continues a
// statement exactly when the grammar writes `NL*` before it.
//
//   memberAccessOperator : NL* DOT | NL* safeNav | COLONCOLON
//   disjunction          : conjunction (NL* DISJ ...)*
//   conjunction          : equality (NL* CONJ ...)*
//   elvisExpression      : infixFunctionCall (NL* elvis ...)*
//   asExpression         : prefixUnaryExpression (NL* asOperator ...)*
//
// `::` is deliberately absent: it is the one member-access operator the
// grammar does not permit a newline before. So are `+`, `*`, `in`, `is`
// and the infix function form, all of which the grammar writes without a
// leading `NL*` — a newline before them ends the statement.
//
// `get` and `set` are here for a different reason. A property's
// accessors sit on the following line, so the terminator inferred after
// the property would cut them off; and the grammar cannot absorb it
// instead, because an accessor separator — optional or required —
// competes with the terminator itself for the same token. Only
// look-ahead settles it, which is the scanner's job. The cost is that a
// statement beginning with a bare `get(` or `set(` call does not get a
// terminator inferred before it; `getFoo()` is unaffected, since the
// word must end there.
static bool at_statement_continuation(TSLexer *lexer) {
  switch (lexer->lookahead) {
    case '.':
      return true;
    case '?':
      advance(lexer);
      return lexer->lookahead == '.' || lexer->lookahead == ':';
    case '&':
      advance(lexer);
      return lexer->lookahead == '&';
    case '|':
      advance(lexer);
      return lexer->lookahead == '|';
    case 'a':
      // `as` and `as?`, but not an identifier that merely starts with them.
      advance(lexer);
      if (lexer->lookahead != 's') return false;
      advance(lexer);
      if (lexer->lookahead == '?') return true;
      return !is_ident_start(lexer->lookahead) && !iswdigit(lexer->lookahead);
    case 'g':
    case 's':
    case 'p':
    case 'i':
    case '@':
      // An accessor continues the property on the line before it, behind
      // any annotations and visibility modifiers it carries.
      return scan_accessor_ahead(lexer);
    case 'e':
      // `else` continues the `if` on the line before it. A `when` entry's
      // `else ->` does not — there the terminator separates it from the
      // entry before, so only the arrow tells the two apart.
      if (!scan_word_tail(lexer, "lse")) return false;
      while (is_horizontal_space(lexer->lookahead) || lexer->lookahead == '\n') {
        advance(lexer);
      }
      if (lexer->lookahead != '-') return true;
      advance(lexer);
      return lexer->lookahead != '>';
    default:
      return false;
  }
}

static bool scan_automatic_semicolon(TSLexer *lexer) {
  bool saw_newline = false;

  while (is_horizontal_space(lexer->lookahead) || lexer->lookahead == '\n') {
    if (lexer->lookahead == '\n') saw_newline = true;
    skip(lexer);
  }

  if (lexer->eof(lexer)) {
    lexer->mark_end(lexer);
    lexer->result_symbol = AUTOMATIC_SEMICOLON;
    return true;
  }

  if (!saw_newline) {
    // A closing brace ends the statement it follows without a newline.
    if (lexer->lookahead == '}') {
      lexer->mark_end(lexer);
      lexer->result_symbol = AUTOMATIC_SEMICOLON;
      return true;
    }
    return false;
  }

  // The terminator ends here, after the newline; everything the
  // look-ahead below consumes is only inspected, never taken.
  lexer->mark_end(lexer);

  // A comment next: emit it instead of deciding. The decision needs to
  // see what follows the comment, but looking there means advancing past
  // it, and the internal lexer has no comment token to fall back on —
  // the comment would simply be dropped and the parse would fail on it.
  // Emitting it here costs nothing: the question is put again at the
  // position after it, where the newline that follows a comment supplies
  // the terminator if one is still wanted.
  if (lexer->lookahead == '/') {
    advance(lexer);
    if (lexer->lookahead == '/' || lexer->lookahead == '*') {
      return scan_comment_after_slash(lexer);
    }
    // Division, which the grammar never lets continue a statement.
    lexer->result_symbol = AUTOMATIC_SEMICOLON;
    return true;
  }

  peek_past_trivia(lexer);
  if (at_statement_continuation(lexer)) return false;

  lexer->result_symbol = AUTOMATIC_SEMICOLON;
  return true;
}

// ---------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------

void *tree_sitter_kotlin_external_scanner_create(void) { return NULL; }

void tree_sitter_kotlin_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_kotlin_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_kotlin_external_scanner_deserialize(void *payload, const char *buffer,
                                                     unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_kotlin_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  (void)payload;

  // In error recovery tree-sitter marks every external token valid at
  // once. Honouring that would let the raw-string body swallow the rest
  // of the file, so only comments — which are unambiguous from their
  // first two characters — are scanned then.
  if (valid_symbols[ERROR_SENTINEL]) {
    while (is_horizontal_space(lexer->lookahead)) skip(lexer);
    return scan_comment(lexer);
  }

  if (valid_symbols[RAW_STRING_END] && scan_raw_string_end(lexer)) return true;
  if (valid_symbols[RAW_STRING_CONTENT] && scan_raw_string_content(lexer)) return true;
  // Inside a raw string nothing else may be scanned: whitespace there is
  // content, not trivia.
  if (valid_symbols[RAW_STRING_CONTENT] || valid_symbols[RAW_STRING_END]) return false;

  if (valid_symbols[AUTOMATIC_SEMICOLON] && scan_automatic_semicolon(lexer)) return true;

  if (valid_symbols[LINE_COMMENT] || valid_symbols[BLOCK_COMMENT] || valid_symbols[KDOC]) {
    while (is_horizontal_space(lexer->lookahead) || lexer->lookahead == '\n') skip(lexer);
    return scan_comment(lexer);
  }

  return false;
}
