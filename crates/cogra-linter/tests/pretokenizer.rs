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
#[test]
fn two_slashes_open_a_plain_line_comment() {
    assert_eq!(
        comments("let x = 1; // note\n"),
        vec![(CommentForm::LinePlain, String::from("// note"))]
    );
}

/// `///` opens an outer line doc comment.
#[test]
fn three_slashes_open_an_outer_doc_comment() {
    assert_eq!(
        forms("/// doc\nstruct X;\n"),
        vec![CommentForm::LineOuterDoc]
    );
}

/// `//!` opens an inner line doc comment.
#[test]
fn slash_slash_bang_opens_an_inner_doc_comment() {
    assert_eq!(forms("//! module doc\n"), vec![CommentForm::LineInnerDoc]);
}

/// A fourth slash makes it plain again: the Reference's line-comment
/// production admits `////` and the doc production does not.
#[test]
fn four_slashes_are_plain_again() {
    assert_eq!(forms("//// not doc\n"), vec![CommentForm::LinePlain]);
}

/// And so does a fifth.
#[test]
fn five_slashes_are_plain_too() {
    assert_eq!(forms("///// still not doc\n"), vec![CommentForm::LinePlain]);
}

/// `///` with nothing after it is an empty outer doc comment, not a plain
/// one: the fourth byte is a newline, not a slash.
#[test]
fn an_empty_outer_doc_comment_is_still_a_doc_comment() {
    assert_eq!(
        comments("///\nstruct X;\n"),
        vec![(CommentForm::LineOuterDoc, String::from("///"))]
    );
}

/// The lexeme stops before the newline: the terminator is not part of the
/// token, which is what lets a run of lines be assembled into one region.
#[test]
fn a_line_comment_stops_before_its_newline() {
    let pre = lex("// a\nlet x = 1;\n");
    let (span, _) = pre.comments().next().expect("one comment");
    assert_eq!((span.start, span.end), (0, 4));
}

/// A line comment closed by the end of the file rather than a newline is
/// still a complete comment.
#[test]
fn a_line_comment_may_end_at_the_file() {
    assert_eq!(
        comments("// trailing"),
        vec![(CommentForm::LinePlain, String::from("// trailing"))]
    );
    assert!(failures("// trailing").is_empty());
}

/// A `//` inside a line comment opens nothing: the comment is one lexeme.
#[test]
fn a_line_comment_swallows_further_slashes() {
    assert_eq!(comments("// a // b\n").len(), 1);
}

/// `/* */` is a plain block comment, which `[banned-tokens]` forbids.
#[test]
fn a_block_comment_is_plain() {
    assert_eq!(
        comments("/* note */\n"),
        vec![(CommentForm::BlockPlain, String::from("/* note */"))]
    );
}

/// `/** */` is an outer block doc comment.
#[test]
fn a_double_star_opener_is_an_outer_block_doc() {
    assert_eq!(forms("/** doc */\n"), vec![CommentForm::BlockOuterDoc]);
}

/// `/*! */` is an inner block doc comment.
#[test]
fn a_bang_opener_is_an_inner_block_doc() {
    assert_eq!(forms("/*! doc */\n"), vec![CommentForm::BlockInnerDoc]);
}

/// `/**/` is the empty *plain* block comment, which the Reference spells
/// out as its own alternative — the second star closes it.
#[test]
fn the_empty_block_comment_is_plain() {
    assert_eq!(
        comments("/**/\n"),
        vec![(CommentForm::BlockPlain, String::from("/**/"))]
    );
}

/// `/***/` is likewise plain, and likewise spelled out.
#[test]
fn the_three_star_block_comment_is_plain() {
    assert_eq!(
        comments("/***/\n"),
        vec![(CommentForm::BlockPlain, String::from("/***/"))]
    );
}

/// `/***` is plain too: the `**` alternative of the block-comment
/// production wins over the doc production.
#[test]
fn a_triple_star_opener_is_plain() {
    assert_eq!(forms("/*** text */\n"), vec![CommentForm::BlockPlain]);
}

/// The slash right after `/*` is content, not half of a closer: the
/// scan starts past the opener so its own star cannot close it.
#[test]
fn a_slash_after_the_opener_is_content() {
    assert_eq!(
        comments("/*/ still open */\n"),
        vec![(CommentForm::BlockPlain, String::from("/*/ still open */"))]
    );
}

/// Block comments nest: the inner `*/` closes the inner one only.
#[test]
fn block_comments_nest() {
    assert_eq!(
        comments("/* a /* b */ c */\n"),
        vec![(CommentForm::BlockPlain, String::from("/* a /* b */ c */"))]
    );
}

/// Three levels deep, and the form is the outermost opener's.
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
#[test]
fn a_block_comment_swallows_line_leaders() {
    assert_eq!(comments("/* // not a second one */\n").len(), 1);
}

/// A quote inside a block comment opens no literal: the block comment is
/// scanned for delimiters alone.
#[test]
fn a_block_comment_swallows_quotes() {
    assert!(literals("/* \"unclosed */\n").is_empty());
    assert_eq!(forms("/* \"unclosed */\n"), vec![CommentForm::BlockPlain]);
}

/// An unterminated block comment is a located diagnostic beside a lexeme
/// that runs to the end of the input — the partition holds in the failure
/// case (´inv:lint:lexeme-partition´).
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
#[test]
fn a_half_closed_nest_is_unterminated() {
    assert_eq!(
        failures("/* a /* b */\n"),
        vec![UNTERMINATED_BLOCK_COMMENT.as_str()]
    );
}

/// `/*/*/` opens twice and closes once, which the Reference makes
/// unterminated: the middle slash is consumed by the second opener.
#[test]
fn the_ambiguous_nest_is_unterminated() {
    assert_eq!(failures("/*/*/"), vec![UNTERMINATED_BLOCK_COMMENT.as_str()]);
}

/// A `//` inside a string is not a comment, which is precisely why the
/// pre-tokenizer exists (`[banned-tokens]`, the line-comment row's note).
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
#[test]
fn a_string_hides_a_block_leader() {
    let source = r#"let s = "/* not a comment";"#;
    assert!(comments(source).is_empty());
    assert!(failures(source).is_empty());
}

/// An escaped quote does not close a string.
#[test]
fn an_escaped_quote_does_not_close_a_string() {
    let source = r#"let s = "a\"b // still inside";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
}

/// A backslash at the very end of a string's content escapes the byte
/// after it and not the closing quote.
#[test]
fn a_trailing_escape_consumes_one_byte() {
    let source = r#""a\\" // after"#;
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// A raw string honours no escape, and hides a `//` all the same.
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
#[test]
fn one_hash_raises_the_closing_bar() {
    let source = r###"let s = r#"a "quoted" b // inside"#;"###;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
}

/// Three hashes, likewise, and a `"##` inside is content.
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
#[test]
fn a_byte_string_hides_a_line_leader() {
    let source = r#"let s = b"// not a comment";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source).len(), 1);
    assert_eq!(literals(source)[0].0, LiteralForm::ByteStr);
}

/// `br#"…"#` is a raw byte string.
#[test]
fn a_raw_byte_string_is_its_own_form() {
    let source = r##"br#"// inside"#"##;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::RawByteStr);
}

/// `c"…"` is a C string, a form the design's gloss does not spell out and
/// which hides a leader all the same.
#[test]
fn a_c_string_is_its_own_form() {
    let source = r#"let s = c"// not a comment";"#;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::CStr);
}

/// `cr#"…"#` is a raw C string.
#[test]
fn a_raw_c_string_is_its_own_form() {
    let source = r##"cr#"// inside"#"##;
    assert!(comments(source).is_empty());
    assert_eq!(literals(source)[0].0, LiteralForm::RawCStr);
}

/// `r#type` is a raw *identifier* and opens no string: a prefix counts only
/// when a quote follows the hashes.
#[test]
fn a_raw_identifier_is_not_a_raw_string() {
    let source = "let r#type = 1; // a comment\n";
    assert!(literals(source).is_empty());
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// A prefix counts only at an identifier boundary: `abr"x"` is the
/// identifier `abr` beside an ordinary string.
#[test]
fn a_prefix_inside_an_identifier_is_not_a_prefix() {
    let source = r#"abr"x""#;
    assert_eq!(
        literals(source),
        vec![(LiteralForm::Str, String::from(r#""x""#))]
    );
}

/// The same for a byte-string prefix inside a longer identifier.
#[test]
fn a_byte_prefix_inside_an_identifier_is_not_a_prefix() {
    let source = r#"tab"x""#;
    assert_eq!(literals(source)[0].0, LiteralForm::Str);
}

/// A number ending in a prefix letter is not a prefix either: `0b1010` is
/// a binary literal and opens nothing.
#[test]
fn a_binary_number_opens_no_literal() {
    let source = "let x = 0b1010; // a comment\n";
    assert!(literals(source).is_empty());
    assert_eq!(forms(source), vec![CommentForm::LinePlain]);
}

/// An unterminated string is a located diagnostic beside a lexeme running
/// to the end of the input.
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
#[test]
fn an_unterminated_raw_string_fails_located() {
    let source = r##"let s = r#"never closed"##;
    assert_eq!(failures(source), vec![UNTERMINATED_STRING.as_str()]);
}

/// A raw string whose closing quote carries too few hashes does not close.
#[test]
fn too_few_closing_hashes_do_not_close() {
    let source = r###"r##"a"# b"###;
    assert_eq!(failures(source), vec![UNTERMINATED_STRING.as_str()]);
}

/// `'a'` is a character literal.
#[test]
fn an_apostrophe_pair_is_a_character() {
    assert_eq!(
        literals("let c = 'a';"),
        vec![(LiteralForm::Char, String::from("'a'"))]
    );
}

/// `'a` is a lifetime, and lifetimes are code.
#[test]
fn a_lone_apostrophe_is_a_lifetime() {
    assert!(literals("fn f<'a>(x: &'a str) {}").is_empty());
}

/// `'static` is a lifetime however long its name.
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
#[test]
fn two_lifetimes_do_not_pair_up() {
    assert!(literals("struct S<'a, 'b>(&'a u8, &'b u8);").is_empty());
}

/// A loop label is a lifetime by the lexer's lights.
#[test]
fn a_loop_label_is_not_a_character() {
    assert!(literals("'outer: loop { break 'outer; }").is_empty());
}

/// A `//` after a lifetime is still a comment: the lifetime consumed only
/// itself.
#[test]
fn a_comment_after_a_lifetime_is_a_comment() {
    assert_eq!(
        forms("fn f<'a>() {} // a comment\n"),
        vec![CommentForm::LinePlain]
    );
}

/// An escaped character literal: `'\n'`.
#[test]
fn an_escape_opens_a_character_literal() {
    assert_eq!(
        literals(r"let c = '\n';"),
        vec![(LiteralForm::Char, String::from(r"'\n'"))]
    );
}

/// An escaped apostrophe does not close its own literal.
#[test]
fn an_escaped_apostrophe_is_content() {
    assert_eq!(
        literals(r"let c = '\'';"),
        vec![(LiteralForm::Char, String::from(r"'\''"))]
    );
}

/// An escaped backslash closes normally.
#[test]
fn an_escaped_backslash_closes_normally() {
    assert_eq!(
        literals(r"let c = '\\';"),
        vec![(LiteralForm::Char, String::from(r"'\\'"))]
    );
}

/// A unicode escape runs past its braces to the closing apostrophe.
#[test]
fn a_unicode_escape_runs_to_the_apostrophe() {
    assert_eq!(
        literals(r"let c = '\u{2F}';"),
        vec![(LiteralForm::Char, String::from(r"'\u{2F}'"))]
    );
}

/// A multi-byte character is one character: the width comes from the UTF-8
/// leading byte, not from a byte count.
#[test]
fn a_multibyte_character_is_one_character() {
    assert_eq!(
        literals("let c = 'é';"),
        vec![(LiteralForm::Char, String::from("'é'"))]
    );
}

/// A four-byte character, likewise.
#[test]
fn a_four_byte_character_is_one_character() {
    assert_eq!(
        literals("let c = '🦀';"),
        vec![(LiteralForm::Char, String::from("'🦀'"))]
    );
}

/// `b'x'` is a byte literal.
#[test]
fn a_byte_literal_is_its_own_form() {
    assert_eq!(
        literals("let b = b'/';"),
        vec![(LiteralForm::Byte, String::from("b'/'"))]
    );
}

/// `'_'` is a character and `'_` is the anonymous lifetime.
#[test]
fn underscore_splits_the_same_way() {
    assert_eq!(literals("let c = '_';")[0].0, LiteralForm::Char);
    assert!(literals("fn f(x: &'_ str) {}").is_empty());
}

/// A `//` inside a character literal is not a comment — there is no room
/// for one, but the pair `'/'` must not be mistaken for the start of one.
#[test]
fn a_slash_character_opens_no_comment() {
    assert!(comments("let c = '/';").is_empty());
}

/// An unterminated escaped character is a located diagnostic, bounded by
/// its own line so it cannot swallow the file.
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
#[test]
fn a_trailing_apostrophe_is_code() {
    assert!(literals("let x = 1; '").is_empty());
    assert!(failures("let x = 1; '").is_empty());
}

/// The empty input partitions vacuously: no lexemes, no bytes.
#[test]
fn the_empty_input_has_no_lexemes() {
    let pre = lex("");
    assert!(pre.lexemes.is_empty());
    assert!(pre.partitions(0));
}

/// A source with no comment or literal is one `Code` lexeme.
#[test]
fn plain_code_is_one_lexeme() {
    let pre = lex("fn main() {}\n");
    assert_eq!(pre.lexemes.len(), 1);
    assert_eq!(pre.lexemes[0].class, LexClass::Code);
}

/// Bytes that are not UTF-8 still partition, and a comment among them is
/// still found: the ban is a lexical fact and does not wait on an AST.
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
#[test]
fn a_continuation_byte_does_not_overrun() {
    let language = Language::new("rust");
    let bytes = [b'\'', 0x80, b'\''];
    let pre = pretokenize(Some(&language), &bytes);
    assert!(pre.partitions(bytes.len()));
}

/// A truncated multi-byte sequence at the very end does not overrun.
#[test]
fn a_truncated_sequence_does_not_overrun() {
    let language = Language::new("rust");
    let bytes = [b'\'', 0xf0, 0x9f];
    let pre = pretokenize(Some(&language), &bytes);
    assert!(pre.partitions(bytes.len()));
}

/// CRLF line endings close a line comment at the newline; the carriage
/// return is inside the comment, where the byte actually sits.
#[test]
fn crlf_closes_a_line_comment() {
    let source = "// note\r\nlet x = 1;\r\n";
    assert_eq!(
        comments(source),
        vec![(CommentForm::LinePlain, String::from("// note\r"))]
    );
}

/// A shebang line opens no comment: `#!` is not `//`.
#[test]
fn a_shebang_is_not_a_comment() {
    assert!(comments("#!/usr/bin/env run\nfn main() {}\n").is_empty());
}

/// A doc comment carrying a fenced example with a `//` in it holds one
/// comment: the fence is inside the comment's own bytes.
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
#[test]
fn no_language_is_all_code() {
    let source = "/* anything */";
    let pre = pretokenize(None, source.as_bytes());
    assert!(pre.partitions(source.len()));
    assert_eq!(pre.lexemes.len(), 1);
}

/// The comment forms answer the two questions the frontends ask of them.
#[test]
fn the_forms_classify_themselves() {
    assert!(CommentForm::LineOuterDoc.is_doc() && CommentForm::LineOuterDoc.is_line());
    assert!(CommentForm::BlockInnerDoc.is_doc() && !CommentForm::BlockInnerDoc.is_line());
    assert!(!CommentForm::LinePlain.is_doc() && CommentForm::LinePlain.is_line());
    assert!(!CommentForm::BlockPlain.is_doc() && !CommentForm::BlockPlain.is_line());
}

/// `class_at` answers for a lexeme's own start and for nothing else: a
/// span starting mid-lexeme is not that lexeme.
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
