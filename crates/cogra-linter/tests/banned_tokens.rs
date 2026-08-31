//! Vector tests for the token bans: `[banned-tokens]` and
//! (´sig:lint:bans-api´).
//!
//! Trace convention: each test names the clause it pins — a row of
//! `[banned-tokens]`, or the sentence of the bans signature that makes a
//! rule name a class the lexer decided rather than a pattern. The shape of
//! the body is the one the design's sizing asks for: each ruled class found
//! where it *is* a comment, and not found where it is not.
//!
//! Every test drives the real adoption data. Which classes are banned,
//! under which identifiers, and at which severity are all
//! `corpus-adoption.toml`'s, never this file's.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use cogra_linter::pretokenize::{CommentForm, LexClass, pretokenize};
use cogra_linter::{Adoption, Enforcement, Language, OwnerId, SourceFile, bans};

/// The corpus's own adoption data, loaded once.
fn adoption() -> &'static Adoption {
    static LOADED: OnceLock<Adoption> = OnceLock::new();
    LOADED.get_or_init(|| {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let at = root.join("corpus-adoption.toml");
        let text = std::fs::read_to_string(&at).expect("the corpus carries its adoption data");
        Adoption::from_str(&text, Path::new("corpus-adoption.toml")).expect("it loads")
    })
}

fn source(language: &str, text: &str) -> SourceFile {
    SourceFile {
        path: PathBuf::from("x.rs"),
        owner: OwnerId::new("linter"),
        language: Some(Language::new(language)),
        generated: false,
        bytes: Vec::from(text),
    }
}

/// The rule identifiers a Rust source's bans fire under.
fn found(text: &str) -> Vec<&'static str> {
    let src = source("rust", text);
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Failing)
        .iter()
        .map(|one| one.rule.as_str())
        .collect()
}

/// The identifier of the row banning a class, read off the adoption data
/// rather than spelled here.
fn ruled(class: CommentForm) -> &'static str {
    bans::rules(&adoption().banned_tokens)
        .into_iter()
        .find(|rule| rule.forbids == LexClass::Comment(class))
        .map(|rule| rule.id.as_str())
        .expect("the corpus bans this class")
}

/// The line-comment row of `[banned-tokens]`: a plain line comment is
/// contraband.
///
/// A plain line comment is contraband in this corpus's Rust sources.
/// ´claim:bans:a-plain-line-comment-is-contraband´
#[test]
fn a_plain_line_comment_is_found() {
    assert_eq!(
        found("let x = 1; // note\n"),
        vec![ruled(CommentForm::LinePlain)]
    );
}

/// The block-comment row: a plain block comment is contraband too, by the
/// same one decision that Rust sources carry documentation comments only.
///
/// A plain block comment is contraband too.
/// ´claim:bans:a-plain-block-comment-is-contraband´
#[test]
fn a_plain_block_comment_is_found() {
    assert_eq!(
        found("let x = /* note */ 1;\n"),
        vec![ruled(CommentForm::BlockPlain)]
    );
}

/// Detection is the lexer's, never a pattern match: a `//` inside a string
/// is not a comment and cannot be a finding.
///
/// A comment leader inside a literal is not a comment and cannot be a finding.
/// ´claim:bans:a-leader-in-a-literal-is-not-a-comment´
#[test]
fn a_line_leader_in_a_string_is_not_found() {
    assert!(found(r#"let s = "// not a comment";"#).is_empty());
}

/// The same inside a raw string.
///
/// (´claim:bans:a-leader-in-a-literal-is-not-a-comment´)
#[test]
fn a_line_leader_in_a_raw_string_is_not_found() {
    assert!(found(r##"let s = r"// not a comment";"##).is_empty());
}

/// And inside a raw string with hashes, where the closing bar is raised.
///
/// (´claim:bans:a-leader-in-a-literal-is-not-a-comment´)
#[test]
fn a_line_leader_in_a_hashed_raw_string_is_not_found() {
    assert!(found(r###"let s = r#"a "b" // not a comment"#;"###).is_empty());
}

/// And inside a byte string.
///
/// (´claim:bans:a-leader-in-a-literal-is-not-a-comment´)
#[test]
fn a_line_leader_in_a_byte_string_is_not_found() {
    assert!(found(r#"let s = b"// not a comment";"#).is_empty());
}

/// A block leader inside a string is likewise not a comment.
///
/// (´claim:bans:a-leader-in-a-literal-is-not-a-comment´)
#[test]
fn a_block_leader_in_a_string_is_not_found() {
    assert!(found(r#"let s = "/* not a comment */";"#).is_empty());
}

/// A slash in a character literal opens nothing.
///
/// (´claim:bans:a-leader-in-a-literal-is-not-a-comment´)
#[test]
fn a_slash_character_is_not_found() {
    assert!(found("let c = '/';").is_empty());
}

/// The four documentation forms are `[scanned-regions]`' scanned regions,
/// not contraband: no ban names them.
///
/// No documentation form is contraband: what is scanned is not what is banned.
/// ´claim:bans:no-documentation-form-is-banned´
#[test]
fn no_documentation_form_is_banned() {
    assert!(found("/// outer\nstruct X;\n").is_empty());
    assert!(found("//! inner\n").is_empty());
    assert!(found("/** outer */\nstruct X;\n").is_empty());
    assert!(found("/*! inner */\n").is_empty());
}

/// `////` is plain again, so it *is* contraband — the ban follows the
/// lexer's classification and not the count of slashes.
///
/// The ban follows the lexer's classification and not the count of slashes.
/// ´claim:bans:the-ban-follows-the-lexer´
#[test]
fn four_slashes_are_contraband() {
    assert_eq!(found("//// not doc\n"), vec![ruled(CommentForm::LinePlain)]);
}

/// `/**/` is the empty plain block comment, and contraband for the same
/// reason.
///
/// (´claim:bans:the-ban-follows-the-lexer´)
#[test]
fn the_empty_block_comment_is_contraband() {
    assert_eq!(found("/**/\n"), vec![ruled(CommentForm::BlockPlain)]);
}

/// Several comments give several findings, in the order they occur.
///
/// Every banned occurrence is its own finding, in the order they occur.
/// ´claim:bans:each-occurrence-is-its-own-finding´
#[test]
fn every_occurrence_is_its_own_finding() {
    assert_eq!(
        found("// a\nlet x = 1;\n// b\n"),
        vec![ruled(CommentForm::LinePlain), ruled(CommentForm::LinePlain)]
    );
}

/// A finding is located at the comment's own line and column.
///
/// A ban finding is located at its comment's own line and column.
/// ´claim:bans:a-finding-is-located-at-its-comment´
#[test]
fn a_finding_is_located_at_its_comment() {
    let src = source("rust", "let x = 1;\nlet y = 2; // note\n");
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let findings = bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Failing);
    assert_eq!(findings.len(), 1);
    assert_eq!(
        (findings[0].primary.line, findings[0].primary.column),
        (2, 12)
    );
    assert_eq!(findings[0].primary.path, src.path);
}

/// The severity is the row's own, and the enforcement is the caller's.
///
/// A finding's severity is the row's own and its enforcement is the caller's.
/// ´claim:bans:severity-is-the-rows-enforcement-the-callers´
#[test]
fn severity_comes_from_the_row_and_enforcement_from_the_caller() {
    let src = source("rust", "// note\n");
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    let row = adoption()
        .banned_tokens
        .rules
        .iter()
        .find(|row| &*row.id == ruled(CommentForm::LinePlain))
        .expect("the row exists");
    let findings = bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Advisory);
    assert_eq!(findings[0].severity, row.severity);
    assert_eq!(findings[0].enforcement, Enforcement::Advisory);
}

/// The rule identifier is the row's own token, interned rather than
/// compiled in: `[banned-tokens]` supplies identifiers as data.
///
/// A rule identifier is the row's own token, supplied as data rather than compiled in.
/// ´claim:bans:the-rule-identifier-is-data´
#[test]
fn the_rule_identifier_is_the_row_s_own() {
    let ids: Vec<&str> = adoption()
        .banned_tokens
        .rules
        .iter()
        .map(|row| &*row.id)
        .collect();
    for rule in bans::rules(&adoption().banned_tokens) {
        assert!(ids.contains(&rule.id.as_str()), "{} is not a row", rule.id);
    }
}

/// No ban applies to Markdown: `[banned-tokens]` rules Rust alone in v1.
///
/// Markdown carries no ban, the adoption data ruling Rust alone.
/// ´claim:bans:markdown-carries-no-ban´
#[test]
fn a_markdown_source_carries_no_ban() {
    let src = source("markdown", "// this is prose\n");
    let pre = pretokenize(src.language.as_ref(), &src.bytes);
    assert!(bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Failing).is_empty());
}

/// A source with no language at all carries no ban either.
///
/// A source with no language carries no ban.
/// ´claim:bans:no-language-means-no-ban´
#[test]
fn a_source_with_no_language_carries_no_ban() {
    let mut src = source("rust", "// note\n");
    src.language = None;
    let pre = pretokenize(None, &src.bytes);
    assert!(bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Failing).is_empty());
}

/// A file `syn` cannot parse is still banned over: the ban is a lexical
/// fact and does not wait on an AST.
///
/// A file the parser rejects is still banned over: the ban is lexical and waits on no tree.
/// ´claim:bans:the-ban-waits-on-no-tree´
#[test]
fn an_unparsable_source_is_still_banned_over() {
    assert_eq!(
        found("fn ( { ] // note\n"),
        vec![ruled(CommentForm::LinePlain)]
    );
}

/// Every row of `[banned-tokens]` names a class the pre-tokenizer decides.
/// A row that names nothing bans nothing, and it must not be able to do so
/// quietly (´sig:lint:bans-api´).
///
/// Every ruled row names a class the pre-tokenizer decides.
/// ´claim:bans:every-row-names-a-decided-class´
#[test]
fn every_ruled_row_names_a_class_the_lexer_decides() {
    assert_eq!(
        bans::unreadable(&adoption().banned_tokens),
        Vec::<&str>::new()
    );
    assert_eq!(
        bans::rules(&adoption().banned_tokens).len(),
        adoption().banned_tokens.rules.len()
    );
}

/// A rule is read from the row's `class` key, which carries the lexer's own
/// vocabulary token — not from the `token` prose beside it, which is
/// written for a reader and read by no code (´sig:lint:bans-api´).
///
/// A rule is read from the row's class key and never from the prose beside it.
/// ´claim:bans:a-rule-is-read-from-its-class-key´
#[test]
fn a_rule_is_read_from_the_class_key() {
    for row in &adoption().banned_tokens.rules {
        let rule = bans::BanRule::read(row).expect("a ruled row reads");
        let form = CommentForm::ALL
            .into_iter()
            .find(|one| one.token() == &*row.class)
            .expect("the class names a comment form of the lexer's vocabulary");
        assert_eq!(rule.forbids, LexClass::Comment(form));
    }
}

/// A class no lexer decides leaves the row unreadable: it bans nothing, and
/// it is listed rather than passing as harmless.
///
/// A class no lexer decides leaves its row unreadable, listed rather than harmless.
/// ´claim:bans:an-undecidable-class-is-listed´
#[test]
fn a_class_no_lexer_decides_leaves_the_row_unreadable() {
    let at = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../corpus-adoption.toml");
    let text = std::fs::read_to_string(&at).expect("the corpus carries its adoption data");
    let broken = text.replacen(
        "class    = \"plain line comment\"",
        "class    = \"semicolon\"",
        1,
    );
    assert_ne!(broken, text, "the class key is still spelled this way");
    let adoption =
        Adoption::from_str(&broken, Path::new("corpus-adoption.toml")).expect("it still loads");
    assert_eq!(
        bans::unreadable(&adoption.banned_tokens),
        vec!["rust-plain-line-comment"]
    );
    assert_eq!(bans::rules(&adoption.banned_tokens).len(), 1);
}

/// The two ruled entries are the two plain comment classes, which is the
/// design's own statement of what `[banned-tokens]` says today.
///
/// The two ruled entries are the two plain comment classes.
/// ´claim:bans:the-ruled-rows-are-the-plain-comments´
#[test]
fn the_two_ruled_entries_are_the_plain_comment_classes() {
    let mut classes: Vec<LexClass> = bans::rules(&adoption().banned_tokens)
        .into_iter()
        .map(|rule| rule.forbids)
        .collect();
    classes.sort_by_key(|class| format!("{class:?}"));
    assert_eq!(
        classes,
        vec![
            LexClass::Comment(CommentForm::BlockPlain),
            LexClass::Comment(CommentForm::LinePlain),
        ]
    );
}

/// The corpus acceptance clause: the linter's own Rust sources carry no
/// banned token. The ban is adopted here first, and this is what says so.
///
/// The linter's own Rust sources carry no banned token.
/// ´claim:bans:the-linters-sources-are-clean´
#[test]
fn the_linter_s_own_sources_carry_no_banned_token() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let mut checked = 0;
    let mut offences = Vec::new();
    for tree in ["src", "tests"] {
        for path in rust_files(&root.join(tree)) {
            let bytes = std::fs::read(&path).expect("a source of this crate");
            let src = SourceFile {
                path: path.clone(),
                owner: OwnerId::new("linter"),
                language: Some(Language::new("rust")),
                generated: false,
                bytes,
            };
            let pre = pretokenize(src.language.as_ref(), &src.bytes);
            assert!(
                pre.partitions(src.bytes.len()),
                "{} does not partition",
                path.display()
            );
            for one in bans::findings(&adoption().banned_tokens, &src, &pre, Enforcement::Failing) {
                offences.push(format!(
                    "{}:{}:{}: {}",
                    path.display(),
                    one.primary.line,
                    one.primary.column,
                    one.message
                ));
            }
            checked += 1;
        }
    }
    assert!(checked > 10, "the walk found only {checked} sources");
    assert!(
        offences.is_empty(),
        "banned tokens found:\n{}",
        offences.join("\n")
    );
}

/// Every `.rs` file under a tree, recursively.
fn rust_files(tree: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(tree) else {
        return out;
    };
    let mut entries: Vec<PathBuf> = entries
        .filter_map(|one| one.ok().map(|e| e.path()))
        .collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            out.extend(rust_files(&path));
        } else if path.extension().is_some_and(|one| one == "rs") {
            out.push(path);
        }
    }
    out
}
