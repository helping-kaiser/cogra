//! ´mod:module:version´
//!
//! Versions and coordinates.
//!
//! A version is the triple (major, minor, patch), carried in a document as
//! the three-element array `[M, m, p]`. A coordinate is what the registry
//! assigns against: a label, a major, a minor — and no patch, because
//! patch is not part of any coordinate.

use crate::error::EnvelopeError;
use crate::label::NamespaceLabel;
use crate::value::{Array, Value};

/// A version triple, ordered lexicographically by major, then minor, then
/// patch.
///
/// The field declaration order is load-bearing: Rust's derived [`Ord`]
/// compares struct fields in declaration order, so major-then-minor-then-
/// patch *is* the lexicographic order the conventions fix, and no
/// hand-written comparator stands between the two. Reordering the fields
/// would silently reorder versions.
///
/// ```
/// use cogra_interchange::Version;
///
/// assert!(Version::new(1, 0, 0) < Version::new(1, 0, 1));
/// assert!(Version::new(1, 2, 9) < Version::new(1, 3, 0));
/// assert!(Version::new(1, 9, 9) < Version::new(2, 0, 0));
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Version {
    major: u64,
    minor: u64,
    patch: u64,
}

impl Version {
    /// The version (`major`, `minor`, `patch`).
    ///
    /// ```
    /// use cogra_interchange::Version;
    ///
    /// let version = Version::new(2, 1, 0);
    /// assert_eq!((version.major(), version.minor(), version.patch()), (2, 1, 0));
    /// ```
    pub const fn new(major: u64, minor: u64, patch: u64) -> Version {
        Version {
            major,
            minor,
            patch,
        }
    }

    /// The major: the vocabulary, compared by equality at acceptance.
    ///
    /// ```
    /// use cogra_interchange::Version;
    ///
    /// assert_eq!(Version::new(2, 1, 0).major(), 2);
    /// ```
    pub const fn major(self) -> u64 {
        self.major
    }

    /// The minor: the coordinate's second component, consulted against a
    /// reader's held minors and its ceiling.
    ///
    /// ```
    /// use cogra_interchange::Version;
    ///
    /// assert_eq!(Version::new(2, 1, 0).minor(), 1);
    /// ```
    pub const fn minor(self) -> u64 {
        self.minor
    }

    /// The patch: free of every coordinate, and of acceptance with it.
    ///
    /// ```
    /// use cogra_interchange::Version;
    ///
    /// assert_eq!(Version::new(2, 1, 7).patch(), 7);
    /// ```
    pub const fn patch(self) -> u64 {
        self.patch
    }

    /// The three-element array a document carries at key 1.
    ///
    /// ```
    /// use cogra_interchange::{Value, Version};
    ///
    /// let value = Version::new(1, 2, 3).to_value();
    /// assert_eq!(value.to_canonical_bytes(), [0x83, 0x01, 0x02, 0x03]);
    /// ```
    pub fn to_value(self) -> Value {
        Value::Array(Array::new([
            Value::Unsigned(self.major),
            Value::Unsigned(self.minor),
            Value::Unsigned(self.patch),
        ]))
    }

    /// Read a version from a value, refusing anything but three unsigned
    /// integers in an array.
    ///
    /// ```
    /// use cogra_interchange::{EnvelopeError, Value, Version};
    ///
    /// let value = Version::new(1, 2, 3).to_value();
    /// assert_eq!(Version::from_value(&value).expect("a triple"), Version::new(1, 2, 3));
    ///
    /// let err = Version::from_value(&Value::Unsigned(1)).expect_err("not an array");
    /// assert!(matches!(err, EnvelopeError::BadVersion));
    /// ```
    pub fn from_value(v: &Value) -> Result<Version, EnvelopeError> {
        let Value::Array(array) = v else {
            return Err(EnvelopeError::BadVersion);
        };
        match array.as_slice() {
            [
                Value::Unsigned(major),
                Value::Unsigned(minor),
                Value::Unsigned(patch),
            ] => Ok(Version::new(*major, *minor, *patch)),
            _ => Err(EnvelopeError::BadVersion),
        }
    }
}

/// An assignable coordinate: a label, a major, a minor. Patch does not
/// occur.
///
/// The absent field is the point: patch is not part of any coordinate, so
/// there is no place in the registry's key for it to be mistakenly
/// consulted.
///
/// ```
/// use cogra_interchange::{Coordinate, NamespaceLabel};
///
/// let label = NamespaceLabel::parse("com.example.thing").expect("a label");
/// let at = Coordinate::new(label, 1, 4);
/// assert_eq!((at.major(), at.minor()), (1, 4));
/// ```
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Coordinate {
    label: NamespaceLabel,
    major: u64,
    minor: u64,
}

impl Coordinate {
    /// The coordinate (`label`, `major`, `minor`).
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let at = Coordinate::new(label.clone(), 2, 0);
    /// assert_eq!(at.label(), &label);
    /// ```
    pub fn new(label: NamespaceLabel, major: u64, minor: u64) -> Coordinate {
        Coordinate {
            label,
            major,
            minor,
        }
    }

    /// The namespace label the coordinate stands under.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let at = Coordinate::new(label, 2, 0);
    /// assert_eq!(at.label().as_str(), "com.example");
    /// ```
    pub fn label(&self) -> &NamespaceLabel {
        &self.label
    }

    /// The major.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// assert_eq!(Coordinate::new(label, 2, 0).major(), 2);
    /// ```
    pub const fn major(&self) -> u64 {
        self.major
    }

    /// The minor.
    ///
    /// ```
    /// use cogra_interchange::{Coordinate, NamespaceLabel};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// assert_eq!(Coordinate::new(label, 2, 5).minor(), 5);
    /// ```
    pub const fn minor(&self) -> u64 {
        self.minor
    }
}
