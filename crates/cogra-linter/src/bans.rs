//! Banned-token classes as data; findings over pre-tokenizer output.
//!
//! The ban subsystem is generic and its classes are data: a future ban is a
//! new row in `[banned-tokens]`, not new code (´sig:lint:bans-api´).
//!
//! That [`BanRule::forbids`] is a [`LexClass`] and not a string is the whole
//! claim to the architecture's "never by pattern match". The rule names a
//! class the lexer already decided, so a `//` inside a raw string is not a
//! comment and cannot be a finding, and no byte of a source is examined
//! here at all — [`findings`] reads lexemes and never text. The two ruled
//! entries are `LexClass::Comment(CommentForm::LinePlain)` and
//! `CommentForm::BlockPlain`.
//!
//! # Where a rule's class comes from
//!
//! A `[banned-tokens]` row carries `id`, `language`, `token`, and
//! `severity`, and the class is read off `token` by its leading name — the
//! text before the row's parenthetical, matched against the vocabulary the
//! pre-tokenizer actually decides ([`CommentForm::token`],
//! [`LiteralForm::token`]). A row naming a class no lexer decides is
//! readable by nobody and produces no rule; [`unreadable`] lists those rows
//! so the corpus suite can assert there are none, which is where such a
//! defect should surface — in the adoption data, not silently at a source.
//!
//! The reading is a *gap in the adoption data*, named rather than hidden:
//! `[banned-tokens]` has no machine-readable class key, so the class name
//! has to be recovered from prose written for a human. A `class` field
//! beside `token` would remove the recovery entirely.

use crate::adopt::{BannedToken, BannedTokens, Language};
use crate::carrier::SourceFile;
use crate::diag::{Diagnostic, Enforcement, RuleId, Severity};
use crate::pretokenize::{CommentForm, LexClass, LiteralForm, PreTokenized, located};

/// One banned token class, as `[banned-tokens]` states it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BanRule {
    /// The row's own identifier, which is the rule a finding reports under.
    pub id: RuleId,
    /// The language whose sources the rule governs.
    pub language: Language,
    /// The lexeme class this rule forbids. Detection is the lexer's, never
    /// a pattern match (´[ARCH-dec:linter:pretokenizer]´).
    pub forbids: LexClass,
    /// How grave an occurrence is.
    pub severity: Severity,
}

impl BanRule {
    /// Read one `[banned-tokens]` row.
    ///
    /// `None` when the row names a class the pre-tokenizer does not decide,
    /// which is a defect of the adoption data rather than of any source —
    /// see [`unreadable`].
    ///
    /// ```
    /// # fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    /// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
    /// # let adoption = cogra_linter::Adoption::from_str(
    /// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
    /// use cogra_linter::bans::BanRule;
    /// use cogra_linter::pretokenize::{CommentForm, LexClass};
    ///
    /// let row = &adoption.banned_tokens.rules[0];
    /// let rule = BanRule::read(row).ok_or("the first ruled row reads")?;
    /// assert_eq!(rule.forbids, LexClass::Comment(CommentForm::LinePlain));
    /// assert_eq!(rule.id.as_str(), "rust-plain-line-comment");
    /// # Ok(())
    /// # }
    /// ```
    #[must_use]
    pub fn read(row: &BannedToken) -> Option<BanRule> {
        Some(BanRule {
            id: RuleId::interned(&row.id),
            language: row.language.clone(),
            forbids: class_named(class_name(&row.token))?,
            severity: row.severity,
        })
    }
}

/// Every rule of `[banned-tokens]` whose class the pre-tokenizer decides.
#[must_use]
pub fn rules(banned: &BannedTokens) -> Vec<BanRule> {
    banned.rules.iter().filter_map(BanRule::read).collect()
}

/// The identifiers of the rows whose class no lexer decides.
///
/// Empty over this corpus's own adoption data, which the acceptance suite
/// asserts: a row that names nothing bans nothing, and it must not be able
/// to do so quietly.
#[must_use]
pub fn unreadable(banned: &BannedTokens) -> Vec<&str> {
    banned
        .rules
        .iter()
        .filter(|row| BanRule::read(row).is_none())
        .map(|row| &*row.id)
        .collect()
}

/// Every occurrence of a banned class in one source, as located diagnostics.
///
/// The `enforcement` argument is the one addition to the ruled signature:
/// [`Diagnostic::enforcement`] is a function of the finding's path against
/// `[enforcement]` (´dec:lint:enforcement-partition´), and the three ruled
/// parameters do not carry the adoption data it is computed from. Passing
/// it beats filling the field with a guess, which is a wrong value in the
/// one field the exit code reads.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// # let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
/// # let toml = std::fs::read_to_string(root.join("corpus-adoption.toml"))?;
/// # let adoption = cogra_linter::Adoption::from_str(
/// #     &toml, std::path::Path::new("corpus-adoption.toml"))?;
/// use cogra_linter::pretokenize::pretokenize;
/// use cogra_linter::{Enforcement, Language, OwnerId, SourceFile, bans};
///
/// let source = SourceFile {
///     path: std::path::PathBuf::from("x.rs"),
///     owner: OwnerId::new("linter"),
///     language: Some(Language::new("rust")),
///     generated: false,
///     bytes: Vec::from("let s = \"// safe\";\n// contraband\n"),
/// };
/// let pre = pretokenize(source.language.as_ref(), &source.bytes);
/// let found = bans::findings(
///     &adoption.banned_tokens, &source, &pre, Enforcement::Failing);
/// assert_eq!(found.len(), 1);
/// assert_eq!(found[0].primary.line, 2);
/// # Ok(())
/// # }
/// ```
#[must_use]
pub fn findings(
    banned: &BannedTokens,
    src: &SourceFile,
    pre: &PreTokenized,
    enforcement: Enforcement,
) -> Vec<Diagnostic> {
    let Some(language) = src.language.as_ref() else {
        return Vec::new();
    };
    let rules: Vec<BanRule> = rules(banned)
        .into_iter()
        .filter(|rule| rule.language == *language)
        .collect();
    let mut found = Vec::new();
    for lexeme in &pre.lexemes {
        for rule in rules.iter().filter(|rule| rule.forbids == lexeme.class) {
            found.push(Diagnostic {
                rule: rule.id,
                severity: rule.severity,
                enforcement,
                primary: located(&src.path, lexeme.span, &src.bytes),
                related: Vec::new(),
                message: message(banned, rule),
            });
        }
    }
    found
}

/// The row's own prose, which says what the class is and why it is named.
fn message(banned: &BannedTokens, rule: &BanRule) -> String {
    let token = banned
        .rules
        .iter()
        .find(|row| &*row.id == rule.id.as_str())
        .map_or_else(
            || String::from("a banned token"),
            |row| row.token.to_string(),
        );
    format!("{token} is banned in {} sources", rule.language.as_str())
}

/// The class name at the head of a `[banned-tokens]` row's `token` value.
///
/// The rows read `plain line comment (// not followed by / or !)`: the name
/// is what precedes the parenthetical that illustrates it.
fn class_name(token: &str) -> &str {
    token.split('(').next().unwrap_or(token).trim()
}

/// The lexeme class one vocabulary name denotes.
fn class_named(name: &str) -> Option<LexClass> {
    if let Some(form) = CommentForm::ALL.iter().find(|form| form.token() == name) {
        return Some(LexClass::Comment(*form));
    }
    LiteralForm::ALL
        .iter()
        .find(|form| form.token() == name)
        .map(|form| LexClass::Literal(*form))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_class_name_is_the_text_before_the_illustration() {
        assert_eq!(
            class_name("plain line comment (// not followed by / or !)"),
            "plain line comment"
        );
        assert_eq!(class_name("plain block comment"), "plain block comment");
    }

    #[test]
    fn the_vocabulary_covers_every_comment_form() {
        for form in CommentForm::ALL {
            assert_eq!(class_named(form.token()), Some(LexClass::Comment(form)));
        }
    }

    #[test]
    fn a_name_no_lexer_decides_denotes_nothing() {
        assert_eq!(class_named("semicolon"), None);
        assert_eq!(class_named(""), None);
    }
}
