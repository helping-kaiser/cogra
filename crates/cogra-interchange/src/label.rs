//! ´mod:module:label´
//!
//! Namespace labels: the ABNF scanner and the tree relation it enables.
//!
//! The grammar is a hand-written character scanner, and deliberately so:
//! the signed exception for a regular-expression engine is scoped to the
//! `.regexp` operator, not to this crate, so the tokenizing rule stands
//! unamended everywhere else in it.
//!
//! ```abnf
//! namespace-label = atom 1*( "." atom )
//! atom            = alnum [ *( alnum / "-" ) alnum ]
//! alnum           = %x30-39 / %x61-7A        ; 0-9 / a-z
//! ```
//!
//! The ABNF is normative for shape; the length bound of 255 bytes comes
//! from the Grammar's own sentence rather than from the ABNF, which says
//! nothing about it. Every admitted character is printable ASCII, so a
//! label's byte length and character length are the same number.

use std::fmt;
use std::str::FromStr;

use crate::error::LabelError;

/// The greatest number of bytes a namespace label occupies. Because the
/// alphabet is ASCII, this is equally its greatest character count.
pub(crate) const MAX_LABEL_BYTES: usize = 255;

/// A namespace label: two or more dot-separated atoms over `a`–`z` and
/// `0`–`9`, hyphens interior only, at most 255 bytes.
///
/// Reading atoms left to right descends a rooted tree, and authority over
/// a prefix confers authority over its subtree — which is why
/// [`is_prefix_of`](NamespaceLabel::is_prefix_of) compares atoms rather
/// than bytes.
///
/// ```
/// use cogra_interchange::NamespaceLabel;
///
/// let label = NamespaceLabel::parse("com.example.thing").expect("a label");
/// assert_eq!(label.as_str(), "com.example.thing");
/// assert_eq!(label.atoms().collect::<Vec<_>>(), ["com", "example", "thing"]);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct NamespaceLabel(Box<str>);

impl NamespaceLabel {
    /// Scan a string against the ABNF, refusing anything outside it.
    ///
    /// The length bound is checked before the characters are, so an
    /// over-long string is [`LabelError::TooLong`] whatever else is wrong
    /// with it; the character scan then runs left to right and reports the
    /// first fault it meets, with the atom count checked last.
    ///
    /// ```
    /// use cogra_interchange::{LabelError, NamespaceLabel};
    ///
    /// assert!(NamespaceLabel::parse("a.b").is_ok());
    ///
    /// let err = NamespaceLabel::parse("solo").expect_err("one atom is not a label");
    /// assert!(matches!(err, LabelError::TooFewAtoms));
    /// ```
    pub fn parse(s: &str) -> Result<NamespaceLabel, LabelError> {
        scan(s)?;
        Ok(NamespaceLabel(Box::from(s)))
    }

    /// The label as a string slice.
    ///
    /// ```
    /// use cogra_interchange::NamespaceLabel;
    ///
    /// let label = NamespaceLabel::parse("org.cogra").expect("a label");
    /// assert_eq!(label.as_str(), "org.cogra");
    /// ```
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The atoms, left to right: the descent of the rooted tree.
    ///
    /// ```
    /// use cogra_interchange::NamespaceLabel;
    ///
    /// let label = NamespaceLabel::parse("org.cogra.feed").expect("a label");
    /// assert_eq!(label.atoms().count(), 3);
    /// assert_eq!(label.atoms().next(), Some("org"));
    /// ```
    pub fn atoms(&self) -> impl Iterator<Item = &str> + '_ {
        self.0.split('.')
    }

    /// The label with its last atom removed, when two or more remain.
    ///
    /// A two-atom label has no parent that is itself a label: the root is
    /// not one, since every label stands strictly below it.
    ///
    /// ```
    /// use cogra_interchange::NamespaceLabel;
    ///
    /// let label = NamespaceLabel::parse("org.cogra.feed").expect("a label");
    /// assert_eq!(label.parent().as_ref().map(NamespaceLabel::as_str), Some("org.cogra"));
    ///
    /// let two = NamespaceLabel::parse("org.cogra").expect("a label");
    /// assert_eq!(two.parent(), None);
    /// ```
    pub fn parent(&self) -> Option<NamespaceLabel> {
        let (head, _) = self.0.rsplit_once('.')?;
        head.contains('.').then(|| NamespaceLabel(Box::from(head)))
    }

    /// Whether authority over `self` confers authority over `other`.
    ///
    /// The relation is atom-wise and reflexive: `com.exa` is not a prefix
    /// of `com.example`, and every label is a prefix of itself.
    ///
    /// ```
    /// use cogra_interchange::NamespaceLabel;
    ///
    /// let parent = NamespaceLabel::parse("com.example").expect("a label");
    /// let child = NamespaceLabel::parse("com.example.thing").expect("a label");
    /// let neighbour = NamespaceLabel::parse("com.exa").expect("a label");
    ///
    /// assert!(parent.is_prefix_of(&child));
    /// assert!(parent.is_prefix_of(&parent));
    /// assert!(!neighbour.is_prefix_of(&child));
    /// ```
    pub fn is_prefix_of(&self, other: &NamespaceLabel) -> bool {
        let mut theirs = other.atoms();
        self.atoms().all(|atom| theirs.next() == Some(atom))
    }
}

/// ```
/// use cogra_interchange::NamespaceLabel;
///
/// let label: NamespaceLabel = "com.example".parse().expect("a label");
/// assert_eq!(label.as_str(), "com.example");
/// ```
impl FromStr for NamespaceLabel {
    type Err = LabelError;

    fn from_str(s: &str) -> Result<NamespaceLabel, LabelError> {
        NamespaceLabel::parse(s)
    }
}

/// ```
/// use cogra_interchange::NamespaceLabel;
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// assert_eq!(label.to_string(), "com.example");
/// ```
impl fmt::Display for NamespaceLabel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// ```
/// use cogra_interchange::NamespaceLabel;
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let borrowed: &str = label.as_ref();
/// assert_eq!(borrowed, "com.example");
/// ```
impl AsRef<str> for NamespaceLabel {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// ```
/// use cogra_interchange::NamespaceLabel;
///
/// let label = NamespaceLabel::try_from("com.example").expect("a label");
/// assert_eq!(label.as_str(), "com.example");
/// ```
impl TryFrom<&str> for NamespaceLabel {
    type Error = LabelError;

    fn try_from(s: &str) -> Result<NamespaceLabel, LabelError> {
        NamespaceLabel::parse(s)
    }
}

/// The scanner proper: one pass over the characters, carrying only what
/// the ABNF needs — where the current atom began, how long it is, and
/// whether its last character was a hyphen.
fn scan(s: &str) -> Result<(), LabelError> {
    if s.len() > MAX_LABEL_BYTES {
        return Err(LabelError::TooLong { length: s.len() });
    }

    let mut atoms = 1usize;
    let mut atom_start = 0usize;
    let mut atom_len = 0usize;
    let mut last_is_hyphen = false;

    for (position, ch) in s.chars().enumerate() {
        match ch {
            '.' => {
                close_atom(atom_start, atom_len, last_is_hyphen)?;
                atoms += 1;
                atom_start = position + 1;
                atom_len = 0;
                last_is_hyphen = false;
            }
            'a'..='z' | '0'..='9' => {
                atom_len += 1;
                last_is_hyphen = false;
            }
            '-' => {
                if atom_len == 0 {
                    return Err(LabelError::HyphenAtEdge {
                        position: atom_start,
                    });
                }
                atom_len += 1;
                last_is_hyphen = true;
            }
            found => return Err(LabelError::BadCharacter { position, found }),
        }
    }
    close_atom(atom_start, atom_len, last_is_hyphen)?;

    if atoms < 2 {
        return Err(LabelError::TooFewAtoms);
    }
    Ok(())
}

fn close_atom(start: usize, len: usize, last_is_hyphen: bool) -> Result<(), LabelError> {
    if len == 0 {
        return Err(LabelError::EmptyAtom { position: start });
    }
    if last_is_hyphen {
        return Err(LabelError::HyphenAtEdge { position: start });
    }
    Ok(())
}
