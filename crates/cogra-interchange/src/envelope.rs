//! Documents: the envelope at keys 0 and 1, the content above them.
//!
//! A document is a map whose keys are unsigned integers, in which key 0
//! holds a namespace label and key 1 a version; beyond those two it may
//! carry any values, under unsigned-integer keys only. That prose
//! definition is the shape of [`Document`], which is why
//! [`Document::new`] is total and [`Document::try_from_value`] is the only
//! place the definition is checked.

use std::collections::BTreeMap;

use crate::error::EnvelopeError;
use crate::label::NamespaceLabel;
use crate::value::{Map, Text, Value};
use crate::version::Version;

/// A content key: an unsigned integer strictly greater than 1.
///
/// ```
/// use cogra_interchange::{ContentKey, EnvelopeError};
///
/// assert_eq!(ContentKey::new(2).expect("above the envelope").get(), 2);
///
/// let err = ContentKey::new(1).expect_err("key 1 is the version's");
/// assert!(matches!(err, EnvelopeError::ReservedContentKey { key: 1 }));
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ContentKey(u64);

impl ContentKey {
    /// A content key, refusing the two the envelope owns.
    ///
    /// ```
    /// use cogra_interchange::ContentKey;
    ///
    /// assert!(ContentKey::new(0).is_err());
    /// assert!(ContentKey::new(1).is_err());
    /// assert!(ContentKey::new(2).is_ok());
    /// ```
    pub fn new(key: u64) -> Result<ContentKey, EnvelopeError> {
        if key <= 1 {
            return Err(EnvelopeError::ReservedContentKey { key });
        }
        Ok(ContentKey(key))
    }

    /// The key as an integer.
    ///
    /// ```
    /// use cogra_interchange::ContentKey;
    ///
    /// assert_eq!(ContentKey::new(7).expect("a content key").get(), 7);
    /// ```
    pub const fn get(self) -> u64 {
        self.0
    }
}

/// The content of a document: its restriction to the keys above 1.
///
/// Content is keyed by [`ContentKey`] on the way in and by [`u64`] on the
/// way out: the invariant is enforced where values enter, and lookups by a
/// literal are ergonomic.
///
/// ```
/// use cogra_interchange::{Content, ContentKey, Value};
///
/// let mut content = Content::new();
/// content.insert(ContentKey::new(2).expect("a content key"), Value::Unsigned(7));
/// assert_eq!(content.get(2), Some(&Value::Unsigned(7)));
/// assert_eq!(content.get(3), None);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash, Default)]
pub struct Content(BTreeMap<u64, Value>);

impl Content {
    /// Content with no entries.
    ///
    /// ```
    /// use cogra_interchange::Content;
    ///
    /// assert!(Content::new().is_empty());
    /// ```
    pub fn new() -> Content {
        Content(BTreeMap::new())
    }

    /// Place a value at a key, returning what stood there.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let key = ContentKey::new(4).expect("a content key");
    /// let mut content = Content::new();
    /// assert_eq!(content.insert(key, Value::Unsigned(1)), None);
    /// assert_eq!(content.insert(key, Value::Unsigned(2)), Some(Value::Unsigned(1)));
    /// ```
    pub fn insert(&mut self, key: ContentKey, value: Value) -> Option<Value> {
        self.0.insert(key.get(), value)
    }

    /// The value at a key, if any.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Null);
    /// assert_eq!(content.get(2), Some(&Value::Null));
    /// ```
    pub fn get(&self, key: u64) -> Option<&Value> {
        self.0.get(&key)
    }

    /// The keys, ascending — which for unsigned integers is the order of
    /// their canonical names.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(9).expect("a content key"), Value::Null);
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Null);
    /// assert_eq!(content.keys().collect::<Vec<_>>(), [2, 9]);
    /// ```
    pub fn keys(&self) -> impl Iterator<Item = u64> + '_ {
        self.0.keys().copied()
    }

    /// The entries, in ascending key order.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Unsigned(1));
    /// assert_eq!(content.iter().next(), Some((2, &Value::Unsigned(1))));
    /// ```
    pub fn iter(&self) -> impl Iterator<Item = (u64, &Value)> + '_ {
        self.0.iter().map(|(key, value)| (*key, value))
    }

    /// How many entries the content carries.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Null);
    /// assert_eq!(content.len(), 1);
    /// ```
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Whether the content carries no entries at all.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Value};
    ///
    /// let mut content = Content::new();
    /// assert!(content.is_empty());
    /// content.insert(ContentKey::new(2).expect("a content key"), Value::Null);
    /// assert!(!content.is_empty());
    /// ```
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// The envelope: the namespace label at key 0 and the version at key 1.
///
/// ```
/// use cogra_interchange::{Envelope, NamespaceLabel, Version};
///
/// let label = NamespaceLabel::parse("com.example.thing").expect("a label");
/// let envelope = Envelope::new(label, Version::new(1, 0, 0));
/// assert_eq!(envelope.label().as_str(), "com.example.thing");
/// assert_eq!(envelope.version(), Version::new(1, 0, 0));
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Envelope {
    label: NamespaceLabel,
    version: Version,
}

impl Envelope {
    /// The envelope of `label` at `version`.
    ///
    /// ```
    /// use cogra_interchange::{Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let envelope = Envelope::new(label, Version::new(2, 3, 4));
    /// assert_eq!(envelope.version().minor(), 3);
    /// ```
    pub fn new(label: NamespaceLabel, version: Version) -> Envelope {
        Envelope { label, version }
    }

    /// The namespace label at key 0.
    ///
    /// ```
    /// use cogra_interchange::{Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let envelope = Envelope::new(label, Version::new(1, 0, 0));
    /// assert_eq!(envelope.label().as_str(), "com.example");
    /// ```
    pub fn label(&self) -> &NamespaceLabel {
        &self.label
    }

    /// The version at key 1.
    ///
    /// ```
    /// use cogra_interchange::{Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let envelope = Envelope::new(label, Version::new(1, 2, 3));
    /// assert_eq!(envelope.version().patch(), 3);
    /// ```
    pub const fn version(&self) -> Version {
        self.version
    }
}

/// A document of the data language.
///
/// ```
/// use cogra_interchange::{Content, ContentKey, Document, Envelope, NamespaceLabel, Value, Version};
///
/// let label = NamespaceLabel::parse("com.example.thing").expect("a label");
/// let mut content = Content::new();
/// content.insert(ContentKey::new(2).expect("a content key"), Value::Unsigned(42));
///
/// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), content);
/// let bytes = document.to_canonical_bytes();
/// assert_eq!(Document::from_canonical_bytes(&bytes).expect("a document"), document);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Document {
    envelope: Envelope,
    content: Content,
}

impl Document {
    /// The document with this envelope and this content.
    ///
    /// Total: every argument is already validated, so a document assembled
    /// through the API is in the data language by the types of its parts,
    /// with no assembly-time check to forget.
    ///
    /// ```
    /// use cogra_interchange::{Content, Document, Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    /// assert!(document.content().is_empty());
    /// ```
    pub fn new(envelope: Envelope, content: Content) -> Document {
        Document { envelope, content }
    }

    /// Decode a document from its canonical name.
    ///
    /// Two ways to fail, and they are different failures: bytes outside
    /// the data language are [`EnvelopeError::NotCanonical`], carrying the
    /// decoder's own located refusal, while bytes that name a value which
    /// is not a document fail as the corresponding envelope refusal.
    ///
    /// ```
    /// use cogra_interchange::{Document, EnvelopeError};
    ///
    /// // 0x01 names the integer 1: a name of the data language, no document.
    /// let err = Document::from_canonical_bytes(&[0x01]).expect_err("not a map");
    /// assert!(matches!(err, EnvelopeError::NotAMap));
    ///
    /// // 0x18 0x00 is not a name at all: the head is not the shortest form.
    /// let err = Document::from_canonical_bytes(&[0x18, 0x00]).expect_err("not canonical");
    /// assert!(matches!(err, EnvelopeError::NotCanonical(_)));
    /// ```
    pub fn from_canonical_bytes(bytes: &[u8]) -> Result<Document, EnvelopeError> {
        let value = Value::from_canonical_bytes(bytes).map_err(EnvelopeError::NotCanonical)?;
        Document::try_from_value(&value)
    }

    /// The document's canonical name.
    ///
    /// ```
    /// use cogra_interchange::{Content, Document, Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("a.b").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    /// assert_eq!(
    ///     document.to_canonical_bytes(),
    ///     [0xa2, 0x00, 0x63, 0x61, 0x2e, 0x62, 0x01, 0x83, 0x01, 0x00, 0x00],
    /// );
    /// ```
    pub fn to_canonical_bytes(&self) -> Vec<u8> {
        self.to_value().to_canonical_bytes()
    }

    /// The envelope at keys 0 and 1.
    ///
    /// ```
    /// use cogra_interchange::{Content, Document, Envelope, NamespaceLabel, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    /// assert_eq!(document.envelope().label().as_str(), "com.example");
    /// ```
    pub fn envelope(&self) -> &Envelope {
        &self.envelope
    }

    /// Everything above key 1.
    ///
    /// ```
    /// use cogra_interchange::{Content, ContentKey, Document, Envelope, NamespaceLabel, Value, Version};
    ///
    /// let label = NamespaceLabel::parse("com.example").expect("a label");
    /// let mut content = Content::new();
    /// content.insert(ContentKey::new(3).expect("a content key"), Value::Bool(true));
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), content);
    /// assert_eq!(document.content().get(3), Some(&Value::Bool(true)));
    /// ```
    pub fn content(&self) -> &Content {
        &self.content
    }

    /// The map view of the document, which satisfaction consumes.
    ///
    /// ```
    /// use cogra_interchange::{Content, Document, Envelope, NamespaceLabel, Value, Version};
    ///
    /// let label = NamespaceLabel::parse("a.b").expect("a label");
    /// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
    /// let Value::Map(map) = document.to_value() else { panic!("a document is a map") };
    /// assert_eq!(map.len(), 2);
    /// ```
    pub fn to_value(&self) -> Value {
        let mut entries = Vec::with_capacity(2 + self.content.len());
        entries.push((
            Value::Unsigned(0),
            Value::Text(Text::from(self.envelope.label.as_str().to_owned())),
        ));
        entries.push((Value::Unsigned(1), self.envelope.version.to_value()));
        for (key, value) in self.content.iter() {
            entries.push((Value::Unsigned(key), value.clone()));
        }
        // Bytewise-lexicographic order on the canonical names of unsigned
        // integers coincides with numeric order, so the ascending keys the
        // BTreeMap yields — below them 0 and 1, in that order — are already
        // in canonical map order.
        Value::Map(Map::from_sorted(entries))
    }

    /// Read a document out of a value, checking the definition.
    ///
    /// ```
    /// use cogra_interchange::{Document, EnvelopeError, Map, Value};
    ///
    /// let value = Value::Map(Map::new([(Value::Unsigned(0), Value::Null)]).expect("one key"));
    /// let err = Document::try_from_value(&value).expect_err("key 0 is no label");
    /// assert!(matches!(err, EnvelopeError::BadLabelType));
    /// ```
    pub fn try_from_value(v: &Value) -> Result<Document, EnvelopeError> {
        let Value::Map(map) = v else {
            return Err(EnvelopeError::NotAMap);
        };

        let mut label = None;
        let mut version = None;
        let mut content = Content::new();

        for (key, value) in map.iter() {
            let Value::Unsigned(key) = key else {
                return Err(EnvelopeError::NonIntegerKey {
                    key: format!("{key:?}"),
                });
            };
            match *key {
                0 => {
                    let Value::Text(text) = value else {
                        return Err(EnvelopeError::BadLabelType);
                    };
                    label = Some(
                        NamespaceLabel::parse(text.as_str()).map_err(EnvelopeError::BadLabel)?,
                    );
                }
                1 => version = Some(Version::from_value(value)?),
                key => {
                    content.insert(ContentKey::new(key)?, value.clone());
                }
            }
        }

        let label = label.ok_or(EnvelopeError::MissingKey { key: 0 })?;
        let version = version.ok_or(EnvelopeError::MissingKey { key: 1 })?;
        Ok(Document::new(Envelope::new(label, version), content))
    }
}
