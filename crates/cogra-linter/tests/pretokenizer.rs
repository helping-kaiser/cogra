//! Vector tests for the pre-tokenizer (´[ARCH-dec:linter:pretokenizer]´),
//! and the property obligation of (´inv:lint:lexeme-partition´).
//!
//! Trace convention: every test's doc comment names the lexical rule it
//! pins — a production of the Rust Reference, a clause of `[banned-tokens]`
//! about what is *not* a comment, or the totality (´sig:lint:pretokenizer-api´)
//! claims on arbitrary bytes.
//!
//! **Every fixture asserts the partition.** [`lex`] is the only door into
//! the lexer here, and it checks (´inv:lint:lexeme-partition´) before
//! returning, so no vector below can pass while leaving a byte unclassified
//! or double-classified. The property then states the same predicate over
//! inputs nobody chose.
//!
//! The generators are pure combinators over a small alphabet: proptest's
//! string strategies are regular-expression driven, and no regular
//! expression is admissible here (´[ARCH-dec:linter:no-regex]´).

use cogra_linter::Language;
use cogra_linter::pretokenize::{
    CommentForm, LexClass, LiteralForm, PreTokenized, UNTERMINATED_BLOCK_COMMENT,
    UNTERMINATED_CHARACTER, UNTERMINATED_STRING, pretokenize,
};
use proptest::prelude::*;

/// Pre-tokenize as Rust, asserting the partition on the way out.
fn lex(source: &str) -> PreTokenized {
    let language = Language::new("rust");
    let out = pretokenize(Some(&language), source.as_bytes());
    assert!(
        out.partitions(source.len()),
        "the lexemes must partition {source:?}"
    );
    out
}

/// The comments of a source, each with the bytes it covers.
fn comments(source: &str) -> Vec<(CommentForm, String)> {
    lex(source)
        .comments()
        .map(|(span, form)| (form, source[span.start..span.end].to_owned()))
        .collect()
}

/// Just the comment forms.
fn forms(source: &str) -> Vec<CommentForm> {
    comments(source).into_iter().map(|(form, _)| form).collect()
}

/// The literals of a source, each with the bytes it covers.
fn literals(source: &str) -> Vec<(LiteralForm, String)> {
    lex(source)
        .lexemes
        .iter()
        .filter_map(|one| match one.class {
            LexClass::Literal(form) => {
                Some((form, source[one.span.start..one.span.end].to_owned()))
            }
            _ => None,
        })
        .collect()
}

/// The rules the lexer reported on a source.
fn failures(source: &str) -> Vec<&'static str> {
    lex(source)
        .unclassified
        .iter()
        .map(|one| one.rule.as_str())
        .collect()
}

/// `//` opens a plain line comment, which `[banned-tokens]` forbids.
///
/// Two slashes open a plain line comment.
/// ´claim:lexer:two-slashes-open-a-plain-comment´
#[test]
fn two_slashes_open_a_plain_line_comment() {
    assert_eq!(
        comments("let x = 1; // note\n"),
        vec![(CommentForm::LinePlain, String::from("// note"))]
    );
}

/// `///` opens an outer line doc comment.
///
/// Three slashes open an outer line documentation comment.
/// ´claim:lexer:three-slashes-open-an-outer-doc´
#[test]
fn three_slashes_open_an_outer_doc_comment() {
    assert_eq!(
        forms("/// doc\nstruct X;\n"),
        vec![CommentForm::LineOuterDoc]
    );
}

/// `//!` opens an inner line doc comment.
///
/// A slash pair followed by a bang opens an inner line documentation comment.
/// ´claim:lexer:a-bang-opens-an-inner-doc´
#[test]
fn slash_slash_bang_opens_an_inner_doc_comment() {
    assert_eq!(forms("//! module doc\n"), vec![CommentForm::LineInnerDoc]);
}

/// A fourth slash makes it plain again: the Reference's line-comment
/// production admits `////` and the doc production does not.
///
/// A fourth slash makes a line comment plain again, the documentation production admitting only three.
/// ´claim:lexer:a-fourth-slash-is-plain-again´
#[test]
fn four_slashes_are_plain_again() {
    assert_eq!(forms("//// not doc\n"), vec![CommentForm::LinePlain]);
}

/// And so does a fifth.
///
/// (´claim:lexer:a-fourth-slash-is-plain-again´)
#[test]
fn five_slashes_are_plain_too() {
    assert_eq!(forms("///// still not doc\n"), vec![CommentForm::LinePlain]);
}

/// `///` with nothing after it is an empty outer doc comment, not a plain
/// one: the fourth byte is a newline, not a slash.
///
/// An empty outer documentation comment is documentation, its fourth byte being a newline.
/// ´claim:lexer:an-empty-doc-comment-is-documentation´
#[test]
fn an_empty_outer_doc_comment_is_still_a_doc_comment() {
    assert_eq!(
        comments("///\nstruct X;\n"),
        vec![(CommentForm::LineOuterDoc, String::from("///"))]
    );
}

/// The lexeme stops before the newline: the terminator is not part of the
/// token, which is what lets a run of lines be assembled into one region.
///
/// A line comment's lexeme stops before its newline, the terminator being no part of the token.
/// ´claim:lexer:a-line-comment-stops-before-its-newline´
#[test]
fn a_line_comment_stops_before_its_newline() {
    let pre = lex("// a\nlet x = 1;\n");
    let (span, _) = pre.comments().next().expect("one comment");
    assert_eq!((span.start, span.end), (0, 4));
}

/// A line comment closed by the end of the file rather than a newline is
/// still a complete comment.
///
/// A line comment closed by the end of the file is still a complete comment.
/// ´claim:lexer:a-comment-may-end-at-the-file´
#[test]
fn a_line_comment_may_end_at_the_file() {
    assert_eq!(
        comments("// trailing"),
        vec![(CommentForm::LinePlain, String::from("// trailing"))]
    );
    assert!(failures("// trailing").is_empty());
}

/// A `//` inside a line comment opens nothing: the comment is one lexeme.
///
/// A comment leader inside a line comment opens nothing, the comment being one lexeme.
/// ´claim:lexer:a-line-comment-is-one-lexeme´
#[test]
fn a_line_comment_swallows_further_slashes() {
    assert_eq!(comments("// a // b\n").len(), 1);
}

/// `/* */` is a plain block comment, which `[banned-tokens]` forbids.
///
/// A bare block comment is plain.
/// ´claim:lexer:a-bare-block-comment-is-plain´
#[test]
fn a_block_comment_is_plain() {
    assert_eq!(
        comments("/* note */\n"),
        vec![(CommentForm::BlockPlain, String::from("/* note */"))]
    );
}

/// `/** */` is an outer block doc comment.
///
/// A double-star opener is an outer block documentation comment.
/// ´claim:lexer:a-double-star-opener-is-outer-doc´
#[test]
fn a_double_star_opener_is_an_outer_block_doc() {
    assert_eq!(forms("/** doc */\n"), vec![CommentForm::BlockOuterDoc]);
}

/// `/*! */` is an inner block doc comment.
///
/// A bang opener is an inner block documentation comment.
/// ´claim:lexer:a-bang-opener-is-inner-doc´
#[test]
fn a_bang_opener_is_an_inner_block_doc() {
    assert_eq!(forms("/*! doc */\n"), vec![CommentForm::BlockInnerDoc]);
}

/// `/**/` is the empty *plain* block comment, which the Reference spells
/// out as its own alternative — the second star closes it.
///
/// The empty block comment is plain, its second star closing it.
/// ´claim:lexer:the-empty-block-comment-is-plain´
#[test]
fn the_empty_block_comment_is_plain() {
    assert_eq!(
        comments("/**/\n"),
        vec![(CommentForm::BlockPlain, String::from("/**/"))]
    );
}

/// `/***/` is likewise plain, and likewise spelled out.
///
/// (´claim:lexer:the-empty-block-comment-is-plain´)
#[test]
fn the_three_star_block_comment_is_plain() {
    assert_eq!(
        comments("/***/\n"),
        vec![(CommentForm::BlockPlain, String::from("/***/"))]
    );
}

/// `/***` is plain too: the `**` alternative of the block-comment
/// production wins over the doc production.
///
/// A triple-star opener is plain, the block-comment alternative winning over the documentation one.
/// ´claim:lexer:a-triple-star-opener-is-plain´
#[test]
fn a_triple_star_opener_is_plain() {
    assert_eq!(forms("/*** text */\n"), vec![CommentForm::BlockPlain]);
}

/// The slash right after `/*` is content, not half of a closer: the
/// scan starts past the opener so its own star cannot close it.
///
/// The byte right after a block opener is content, the scan starting past the opener.
/// ´claim:lexer:the-byte-after-an-opener-is-content´
#[test]
fn a_slash_after_the_opener_is_content() {
    assert_eq!(
        comments("/*/ still open */\n"),
        vec![(CommentForm::BlockPlain, String::from("/*/ still open */"))]
    );
}

/// Block comments nest: the inner `*/` closes the inner one only.
///
/// Block comments nest, and an inner closer closes the inner one only.
/// ´claim:lexer:block-comments-nest´
#[test]
fn block_comments_nest() {
    assert_eq!(
        comments("/* a /* b */ c */\n"),
        vec![(CommentForm::BlockPlain, String::from("/* a /* b */ c */"))]
    );
}

/// Three levels deep, and the form is the outermost opener's.
///
/// A nested block comment takes the outermost opener's form.
/// ´claim:lexer:nesting-keeps-the-outermost-form´
#[test]
fn nesting_keeps_the_outermost_form() {
    assert_eq!(
        comments("/** a /* b /* c */ d */ e */\n"),
        vec![(
            CommentForm::BlockOuterDoc,
            String::from("/** a /* b /* c */ d */ e */")
        )]
    );
}

/// A `//` inside a block comment opens nothing.
///
/// A comment leader inside a block comment opens nothing.
/// ´claim:lexer:a-block-comment-swallows-leaders´
#[test]
fn a_block_comment_swallows_line_leaders() {
    assert_eq!(comments("/* // not a second one */\n").len(), 1);
}

/// A quote inside a block comment opens no literal: the block comment is
/// scanned for delimiters alone.
///
/// A quote inside a block comment opens no literal.
/// ´claim:lexer:a-block-comment-swallows-quotes´
#[test]
fn a_block_comment_swallows_quotes() {
    assert!(literals("/* \"unclosed */\n").is_empty());
    assert_eq!(forms("/* \"unclosed */\n"), vec![CommentForm::BlockPlain]);
}

/// An unterminated block comment is a located diagnostic beside a lexeme
/// that runs to the end of the input — the partition holds in the failure
/// case (´inv:lint:lexeme-partition´).
///
/// An unterminated block comment is a located diagnostic beside a lexeme running to the end.
/// ´claim:lexer:an-unterminated-block-comment-is-located´
#[test]
fn an_unterminated_block_comment_fails_located() {
    let source = "/* never closed\nlet x = 1;\n";
    assert_eq!(failures(source), vec![UNTERMINATED_BLOCK_COMMENT.as_str()]);
    let pre = lex(source);
    assert_eq!(pre.lexemes.len(), 1);
    assert_eq!(pre.lexemes[0].span.end, source.len());
    assert_eq!(pre.unclassified[0].primary.span.start, 0);
}

/// A nested block comment that closes once but not twice is unterminated.
///
/// A nested block comment that closes once but not twice is unterminated.
/// ´claim:lexer:a-half-closed-nest-is-unterminated´
#[test]
fn a_half_closed_nest_is_unterminated() {
    assert_eq!(
        failures("/* a /* b */\n"),
        vec![UNTERMINATED_BLOCK_COMMENT.as_str()]
    );
}

/// `/*/*/` opens twice and closes once, which the Reference makes
/// unterminated: the middle slash is consumed by the second opener.
///
/// An opener whose middle byte is consumed by a second opener leaves the comment unterminated.
/// ´claim:lexer:the-ambiguous-nest-is-unterminated´
#[test]
fn the_ambiguous_nest_is_unterminated() {
    assert_eq!(failures("/*/*/"), vec![UNTERMINATED_BLOCK_COMMENT.as_str()]);
}

/// A `//` inside a string is not a comment, which is precisely why the
/// pre-tokenizer exists (`[banned-tokens]`, the line-comment row's note).
///
/// A comment leader inside a string literal is not a comment, which is why the pre-tokenizer exists.
/// ´claim:lexer:a-literal-hides-a-leader´
#[test]
fn a_string_hides_a_line_leader() {
    let source = r#"let s = "// not a comment";"#;
    assert!(comments(source).is_empty());
    assert_eq!(
        literals(source),
        vec![(LiteralForm::Str, String::from(r#""// not a comment""#))]
    );
}

/// A `/*` inside a string opens nothing either.
///
/// (´claim:lexer:a-literal-hides-a-leader´)
#[test]
fn a_string_hides_a_block_leader() {
    let source = r#"let s = "/* not a comment";"#;
    assert!(comments(source).is_empty());
    assert!(failures(source).is_empty());
}

/// An escaped quote does not close a string.
///
/// An escaped quote does not close a string.
/// ´claim:lexer:an-escaped-quote-does-not-close´
#[test]
fn an_escaped_quote_does_not_close_a_string() {
    let source = r#"let s = "a\"b // still inside";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
}

/// A backslash at the very end of a string's content escapes the byte
/// after it and not the closing quote.
///
/// A trailing backslash escapes the byte after it and not the closing quote.
/// ´claim:lexer:a-trailing-escape-consumes-one-byte´
#[test]
fn a_trailing_escape_consumes_one_byte() {
    let source = r#""a\\" // after"#;
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// A raw string honours no escape, and hides a `//` all the same.
///
/// (´claim:lexer:a-literal-hides-a-leader´)
#[test]
fn a_raw_string_hides_a_line_leader() {
    let source = r##"let s = r"// not a comment";"##;
    assert!(comments(source).is_empty());
    assert_eq!(
        literals(source),
        vec![(
            LiteralForm::RawStr,
            String::from(r##"r"// not a comment""##)
        )]
    );
}

/// A raw string with one hash closes on `"#` and not on a bare quote.
///
/// A raw string's hashes raise its closing bar, so a bare quote does not close it.
/// ´claim:lexer:hashes-raise-the-closing-bar´
#[test]
fn one_hash_raises_the_closing_bar() {
    let source = r###"let s = r#"a "quoted" b // inside"#;"###;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
}

/// Three hashes, likewise, and a `"##` inside is content.
///
/// (´claim:lexer:hashes-raise-the-closing-bar´)
#[test]
fn three_hashes_raise_it_further() {
    let source = r####"r###"a "## b // inside"###"####;
    assert!(comments(source).is_empty());
    assert_eq!(
        literals(source),
        vec![(LiteralForm::RawStr, String::from(source))]
    );
}

/// A raw string does not honour a backslash: `r"a\"` closes at its own
/// quote, and what follows is code again.
///
/// A raw string honours no backslash and closes at its own quote.
/// ´claim:lexer:a-raw-string-honours-no-escape´
#[test]
fn a_raw_string_ignores_backslashes() {
    let source = r####"r"a\" // a comment"####;
    assert_eq!(
        literals(source),
        vec![(LiteralForm::RawStr, String::from(r#"r"a\""#))]
    );
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// `b"…"` is a byte string and hides a leader like any other literal.
///
/// (´claim:lexer:a-literal-hides-a-leader´)
#[test]
fn a_byte_string_hides_a_line_leader() {
    let source = r#"let s = b"// not a comment";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
    assert_eq!(literals(source)[0].0, LiteralForm::ByteStr);
}

/// `br#"…"#` is a raw byte string.
///
/// A raw byte string is its own literal form.
/// ´claim:lexer:a-raw-byte-string-is-its-own-form´
#[test]
fn a_raw_byte_string_is_its_own_form() {
    let source = r##"br#"// inside"#"##;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::RawByteStr);
}

/// `c"…"` is a C string, a form the design's gloss does not spell out and
/// which hides a leader all the same.
///
/// A C string is its own literal form and hides a leader like any other.
/// ´claim:lexer:a-c-string-is-its-own-form´
#[test]
fn a_c_string_is_its_own_form() {
    let source = r#"let s = c"// not a comment";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::CStr);
}

/// `cr#"…"#` is a raw C string.
///
/// A raw C string is its own literal form.
/// ´claim:lexer:a-raw-c-string-is-its-own-form´
#[test]
fn a_raw_c_string_is_its_own_form() {
    let source = r##"cr#"// inside"#"##;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::RawCStr);
}

/// `r#type` is a raw *identifier* and opens no string: a prefix counts only
/// when a quote follows the hashes.
///
/// A raw identifier opens no string: a prefix counts only when a quote follows the hashes.
/// ´claim:lexer:a-raw-identifier-opens-no-string´
#[test]
fn a_raw_identifier_is_not_a_raw_string() {
    let source = "let r#type = 1; // a comment\n";
    assert!(literals(source).is_empty());
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// A prefix counts only at an identifier boundary: `abr"x"` is the
/// identifier `abr` beside an ordinary string.
///
/// A literal prefix counts only at an identifier boundary.
/// ´claim:lexer:a-prefix-counts-at-a-boundary-only´
#[test]
fn a_prefix_inside_an_identifier_is_not_a_prefix() {
    let source = r#"abr"x""#;
    assert_eq!(
        literals(source),
        vec![(LiteralForm::Str, String::from(r#""x""#))]
    );
}

/// The same for a byte-string prefix inside a longer identifier.
///
/// (´claim:lexer:a-prefix-counts-at-a-boundary-only´)
#[test]
fn a_byte_prefix_inside_an_identifier_is_not_a_prefix() {
    let source = r#"tab"x""#;
    assert_eq!(literals(source)[0].0, LiteralForm::Str);
}

/// A number ending in a prefix letter is not a prefix either: `0b1010` is
/// a binary literal and opens nothing.
///
/// A number ending in a prefix letter opens no literal.
/// ´claim:lexer:a-number-opens-no-literal´
#[test]
fn a_binary_number_opens_no_literal() {
    let source = "let x = 0b1010; // a comment\n";
    assert!(literals(source).is_empty());
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// An unterminated string is a located diagnostic beside a lexeme running
/// to the end of the input.
///
/// An unterminated string is a located diagnostic beside a lexeme running to the end.
/// ´claim:lexer:an-unterminated-string-is-located´
#[test]
fn an_unterminated_string_fails_located() {
    let source = "let s = \"never closed\n";
    assert_eq!(failures(source), vec![UNTERMINATED_STRING.as_str()]);
    let pre = lex(source);
    assert_eq!(
        pre.lexemes.last().expect("a tail lexeme").span.end,
        source.len()
    );
}

/// An unterminated raw string, likewise.
///
/// (´claim:lexer:an-unterminated-string-is-located´)
#[test]
fn an_unterminated_raw_string_fails_located() {
    let source = r##"let s = r#"never closed"##;
    assert_eq!(failures(source), vec![UNTERMINATED_STRING.as_str()]);
}

/// A raw string whose closing quote carries too few hashes does not close.
///
/// A closing quote carrying too few hashes does not close its raw string.
/// ´claim:lexer:too-few-hashes-do-not-close´
#[test]
fn too_few_closing_hashes_do_not_close() {
    let source = r###"r##"a"# b"###;
    assert_eq!(failures(source), vec![UNTERMINATED_STRING.as_str()]);
}

/// `'a'` is a character literal.
///
/// An apostrophe pair is a character literal.
/// ´claim:lexer:an-apostrophe-pair-is-a-character´
#[test]
fn an_apostrophe_pair_is_a_character() {
    assert_eq!(
        literals("let c = 'a';"),
        vec![(LiteralForm::Char, String::from("'a'"))]
    );
}

/// `'a` is a lifetime, and lifetimes are code.
///
/// A lone apostrophe opens a lifetime, and lifetimes are code.
/// ´claim:lexer:a-lone-apostrophe-is-a-lifetime´
#[test]
fn a_lone_apostrophe_is_a_lifetime() {
    assert!(literals("fn f<'a>(x: &'a str) {}").is_empty());
}

/// `'static` is a lifetime however long its name.
///
/// (´claim:lexer:a-lone-apostrophe-is-a-lifetime´)
#[test]
fn a_long_lifetime_is_still_a_lifetime() {
    assert!(literals("let s: &'static str = \"x\";").len() == 1);
    assert_eq!(
        literals("let s: &'static str = \"x\";")[0].0,
        LiteralForm::Str
    );
}

/// Two lifetimes in a row are not joined into one literal: the
/// discrimination happens before any scanning.
///
/// Two lifetimes in a row are not joined into one literal.
/// ´claim:lexer:two-lifetimes-do-not-pair´
#[test]
fn two_lifetimes_do_not_pair_up() {
    assert!(literals("struct S<'a, 'b>(&'a u8, &'b u8);").is_empty());
}

/// A loop label is a lifetime by the lexer's lights.
///
/// (´claim:lexer:a-lone-apostrophe-is-a-lifetime´)
#[test]
fn a_loop_label_is_not_a_character() {
    assert!(literals("'outer: loop { break 'outer; }").is_empty());
}

/// A `//` after a lifetime is still a comment: the lifetime consumed only
/// itself.
///
/// A comment after a lifetime is a comment, the lifetime having consumed only itself.
/// ´claim:lexer:a-lifetime-consumes-only-itself´
#[test]
fn a_comment_after_a_lifetime_is_a_comment() {
    assert_eq!(
        forms("fn f<'a>() {} // a comment\n"),
        vec![CommentForm::LinePlain]
    );
}

/// An escaped character literal: `'\n'`.
///
/// An escape inside an apostrophe pair opens a character literal.
/// ´claim:lexer:an-escape-opens-a-character´
#[test]
fn an_escape_opens_a_character_literal() {
    assert_eq!(
        literals(r"let c = '\n';"),
        vec![(LiteralForm::Char, String::from(r"'\n'"))]
    );
}

/// An escaped apostrophe does not close its own literal.
///
/// An escaped apostrophe does not close its own literal.
/// ´claim:lexer:an-escaped-apostrophe-is-content´
#[test]
fn an_escaped_apostrophe_is_content() {
    assert_eq!(
        literals(r"let c = '\'';"),
        vec![(LiteralForm::Char, String::from(r"'\''"))]
    );
}

/// An escaped backslash closes normally.
///
/// An escaped backslash closes its literal normally.
/// ´claim:lexer:an-escaped-backslash-closes-normally´
#[test]
fn an_escaped_backslash_closes_normally() {
    assert_eq!(
        literals(r"let c = '\\';"),
        vec![(LiteralForm::Char, String::from(r"'\\'"))]
    );
}

/// A unicode escape runs past its braces to the closing apostrophe.
///
/// A unicode escape runs past its braces to the closing apostrophe.
/// ´claim:lexer:a-unicode-escape-runs-to-the-closer´
#[test]
fn a_unicode_escape_runs_to_the_apostrophe() {
    assert_eq!(
        literals(r"let c = '\u{2F}';"),
        vec![(LiteralForm::Char, String::from(r"'\u{2F}'"))]
    );
}

/// A multi-byte character is one character: the width comes from the UTF-8
/// leading byte, not from a byte count.
///
/// A multi-byte character is one character, its width coming from the leading byte.
/// ´claim:lexer:a-multibyte-character-is-one-character´
#[test]
fn a_multibyte_character_is_one_character() {
    assert_eq!(
        literals("let c = 'é';"),
        vec![(LiteralForm::Char, String::from("'é'"))]
    );
}

/// A four-byte character, likewise.
///
/// (´claim:lexer:a-multibyte-character-is-one-character´)
#[test]
fn a_four_byte_character_is_one_character() {
    assert_eq!(
        literals("let c = '🦀';"),
        vec![(LiteralForm::Char, String::from("'🦀'"))]
    );
}

/// `b'x'` is a byte literal.
///
/// A byte literal is its own literal form.
/// ´claim:lexer:a-byte-literal-is-its-own-form´
#[test]
fn a_byte_literal_is_its_own_form() {
    assert_eq!(
        literals("let b = b'/';"),
        vec![(LiteralForm::Byte, String::from("b'/'"))]
    );
}

/// `'_'` is a character and `'_` is the anonymous lifetime.
///
/// An underscore splits into a character and a lifetime the way any name does.
/// ´claim:lexer:an-underscore-splits-like-any-name´
#[test]
fn underscore_splits_the_same_way() {
    assert_eq!(literals("let c = '_';")[0].0, LiteralForm::Char);
    assert!(literals("fn f(x: &'_ str) {}").is_empty());
}

/// A `//` inside a character literal is not a comment — there is no room
/// for one, but the pair `'/'` must not be mistaken for the start of one.
///
/// A slash in a character literal opens no comment.
/// ´claim:lexer:a-slash-character-opens-no-comment´
#[test]
fn a_slash_character_opens_no_comment() {
    assert!(comments("let c = '/';").is_empty());
}

/// An unterminated escaped character is a located diagnostic, bounded by
/// its own line so it cannot swallow the file.
///
/// An unterminated character literal is located and bounded by its own line.
/// ´claim:lexer:an-unterminated-character-is-bounded´
#[test]
fn an_unterminated_character_fails_located_on_its_line() {
    let source = "let c = '\\n;\nlet y = 1;\n";
    assert_eq!(failures(source), vec![UNTERMINATED_CHARACTER.as_str()]);
    let pre = lex(source);
    let literal = pre
        .lexemes
        .iter()
        .find(|one| matches!(one.class, LexClass::Literal(_)))
        .expect("a literal lexeme");
    assert!(literal.span.end <= source.find('\n').expect("a newline") + 1);
}

/// A bare apostrophe at the end of the file classifies as code and reports
/// nothing: it is a lifetime with an empty name, not a broken literal.
///
/// A bare apostrophe at the end of a file is a lifetime with an empty name and reports nothing.
/// ´claim:lexer:a-trailing-apostrophe-is-code´
#[test]
fn a_trailing_apostrophe_is_code() {
    assert!(literals("let x = 1; '").is_empty());
    assert!(failures("let x = 1; '").is_empty());
}

/// The empty input partitions vacuously: no lexemes, no bytes.
///
/// The empty input partitions vacuously.
/// ´claim:lexer:the-empty-input-partitions-vacuously´
#[test]
fn the_empty_input_has_no_lexemes() {
    let pre = lex("");
    assert!(pre.lexemes.is_empty());
    assert!(pre.partitions(0));
}

/// A source with no comment or literal is one `Code` lexeme.
///
/// A source with no comment or literal is one code lexeme.
/// ´claim:lexer:plain-code-is-one-lexeme´
#[test]
fn plain_code_is_one_lexeme() {
    let pre = lex("fn main() {}\n");
    assert_eq!(pre.lexemes.len(), 1);
    assert_eq!(pre.lexemes[0].class, LexClass::Code);
}

/// Bytes that are not UTF-8 still partition, and a comment among them is
/// still found: the ban is a lexical fact and does not wait on an AST.
///
/// Bytes that are not UTF-8 still partition, and a comment among them is still found.
/// ´claim:lexer:invalid-bytes-still-partition´
#[test]
fn invalid_utf8_still_partitions() {
    let language = Language::new("rust");
    let bytes = [0xffu8, 0xfe, b'/', b'/', b' ', b'x', b'\n', 0x80, 0xc3];
    let pre = pretokenize(Some(&language), &bytes);
    assert!(pre.partitions(bytes.len()));
    assert_eq!(
        pre.comments().map(|(_, form)| form).collect::<Vec<_>>(),
        vec![CommentForm::LinePlain]
    );
}

/// A lone continuation byte inside a character literal's position does not
/// walk off the end.
///
/// A lone continuation byte does not walk off the end of the input.
/// ´claim:lexer:a-continuation-byte-does-not-overrun´
#[test]
fn a_continuation_byte_does_not_overrun() {
    let language = Language::new("rust");
    let bytes = [b'\'', 0x80, b'\''];
    let pre = pretokenize(Some(&language), &bytes);
    assert!(pre.partitions(bytes.len()));
}

/// A truncated multi-byte sequence at the very end does not overrun.
///
/// A truncated multi-byte sequence at the end does not overrun.
/// ´claim:lexer:a-truncated-sequence-does-not-overrun´
#[test]
fn a_truncated_sequence_does_not_overrun() {
    let language = Language::new("rust");
    let bytes = [b'\'', 0xf0, 0x9f];
    let pre = pretokenize(Some(&language), &bytes);
    assert!(pre.partitions(bytes.len()));
}

/// CRLF line endings close a line comment at the newline; the carriage
/// return is inside the comment, where the byte actually sits.
///
/// A carriage-return line ending closes a line comment at the newline.
/// ´claim:lexer:crlf-closes-a-line-comment´
#[test]
fn crlf_closes_a_line_comment() {
    let source = "// note\r\nlet x = 1;\r\n";
    assert_eq!(
        comments(source),
        vec![(CommentForm::LinePlain, String::from("// note\r"))]
    );
}

/// A shebang line opens no comment: `#!` is not `//`.
///
/// A shebang line opens no comment.
/// ´claim:lexer:a-shebang-is-no-comment´
#[test]
fn a_shebang_is_not_a_comment() {
    assert!(comments("#!/usr/bin/env run\nfn main() {}\n").is_empty());
}

/// A doc comment carrying a fenced example with a `//` in it holds one
/// comment: the fence is inside the comment's own bytes.
///
/// A documentation comment carrying a fenced example holds one comment.
/// ´claim:lexer:a-fenced-example-is-not-a-second-comment´
#[test]
fn a_fenced_example_inside_a_doc_comment_is_not_a_second_comment() {
    let source = "/// ```\n/// let x = 1; // inside\n/// ```\n";
    assert_eq!(forms(source).len(), 3);
    assert!(
        forms(source)
            .iter()
            .all(|f| *f == CommentForm::LineOuterDoc)
    );
}

/// A language with no pre-tokenizer yields one `Code` lexeme over the whole
/// input, which is the partition's answer for "nothing is known here".
///
/// A language with no pre-tokenizer yields one code lexeme over the whole input.
/// ´claim:lexer:no-pretokenizer-is-all-code´
#[test]
fn a_language_with_no_pretokenizer_is_all_code() {
    let language = Language::new("markdown");
    let source = "// this is prose, not a comment\n";
    let pre = pretokenize(Some(&language), source.as_bytes());
    assert!(pre.partitions(source.len()));
    assert_eq!(pre.lexemes.len(), 1);
    assert_eq!(pre.lexemes[0].class, LexClass::Code);
}

/// A source with no language at all is the same.
///
/// (´claim:lexer:no-pretokenizer-is-all-code´)
#[test]
fn no_language_is_all_code() {
    let source = "/* anything */";
    let pre = pretokenize(None, source.as_bytes());
    assert!(pre.partitions(source.len()));
    assert_eq!(pre.lexemes.len(), 1);
}

/// The comment forms answer the two questions the frontends ask of them.
///
/// The comment forms answer the two questions the frontends ask of them.
/// ´claim:lexer:the-forms-classify-themselves´
#[test]
fn the_forms_classify_themselves() {
    assert!(CommentForm::LineOuterDoc.is_doc() && CommentForm::LineOuterDoc.is_line());
    assert!(CommentForm::BlockInnerDoc.is_doc() && !CommentForm::BlockInnerDoc.is_line());
    assert!(!CommentForm::LinePlain.is_doc() && CommentForm::LinePlain.is_line());
    assert!(!CommentForm::BlockPlain.is_doc() && !CommentForm::BlockPlain.is_line());
}

/// `class_at` answers for a lexeme's own start and for nothing else: a
/// span starting mid-lexeme is not that lexeme.
///
/// A lexeme's class is answered for its own start and for nothing else.
/// ´claim:lexer:a-class-answers-at-a-start-only´
#[test]
fn class_at_answers_at_a_lexeme_start_only() {
    let pre = lex("/// doc\nfn f() {}\n");
    assert_eq!(
        pre.class_at(0),
        Some(LexClass::Comment(CommentForm::LineOuterDoc))
    );
    assert_eq!(pre.class_at(1), None);
}

/// No rule identifier of this module is label-shaped: `lint` is a reserved
/// kind no profile governs (´sig:lint:diagnostic-api´).
///
/// (´claim:diagnostics:no-rule-identifier-is-label-shaped´)
#[test]
fn no_pretokenizer_rule_identifier_is_label_shaped() {
    for rule in cogra_linter::pretokenize::RULES {
        assert!(!rule.as_str().contains(':'), "{rule} is label-shaped");
    }
}

/// Bytes drawn from an alphabet dense in Rust's lexical delimiters, so a
/// generated input actually exercises the branches rather than mostly
/// landing in code.
const DELIMITERS: [u8; 12] = [
    b'/', b'*', b'"', b'\'', b'\\', b'#', b'r', b'b', b'c', b'\n', b'a', 0xff,
];

fn delimiter_bytes() -> impl Strategy<Value = Vec<u8>> {
    proptest::collection::vec(proptest::sample::select(DELIMITERS.to_vec()), 0..40)
}

proptest! {
    /// (´inv:lint:lexeme-partition´) over arbitrary byte strings: the
    /// lexeme spans are ascending, non-overlapping, and cover the input
    /// exactly once. The strongest single assertion the crate has, because
    /// it is total on every input.
    #[test]
    fn the_lexemes_partition_arbitrary_bytes(bytes in proptest::collection::vec(any::<u8>(), 0..64)) {
        let language = Language::new("rust");
        let pre = pretokenize(Some(&language), &bytes);
        prop_assert!(pre.partitions(bytes.len()));
    }

    /// The same over the delimiter-dense alphabet, where the lexer's
    /// branches are actually reached.
    #[test]
    fn the_lexemes_partition_delimiter_soup(bytes in delimiter_bytes()) {
        let language = Language::new("rust");
        let pre = pretokenize(Some(&language), &bytes);
        prop_assert!(pre.partitions(bytes.len()));
    }

    /// Every reported span lies inside the input, so a diagnostic can
    /// always be located (´[ARCH-req:linter:diagnostics-not-panics]´).
    #[test]
    fn every_reported_span_lies_inside_the_input(bytes in delimiter_bytes()) {
        let language = Language::new("rust");
        let pre = pretokenize(Some(&language), &bytes);
        for one in &pre.unclassified {
            prop_assert!(one.primary.span.end <= bytes.len());
            prop_assert!(one.primary.span.start <= one.primary.span.end);
        }
    }

    /// A language with no pre-tokenizer is all code, whatever the bytes.
    #[test]
    fn an_unknown_language_is_all_code(bytes in delimiter_bytes()) {
        let pre = pretokenize(None, &bytes);
        prop_assert!(pre.partitions(bytes.len()));
        prop_assert!(pre.lexemes.iter().all(|one| one.class == LexClass::Code));
    }
}
