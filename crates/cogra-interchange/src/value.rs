//! The value model of the data language, canonical by construction.
//!
//! [`Value`] denotes every structure the data language admits and nothing
//! else. The invariant is carried by three validating constructors —
//! [`Map::new`] sorts and refuses duplicates, [`Text`] refuses invalid
//! UTF-8, and [`Float::from_f64`] reduces to the shortest form — and every
//! other variant is canonical for every inhabitant of its payload type.
//! Non-canonicity is therefore unrepresentable rather than checked for,
//! which is why encoding has no failure mode.

use std::cmp::Ordering;
use std::hash::{Hash, Hasher};
use std::mem;

use crate::encode::initial_byte;
use crate::error::ValueError;

/// A structure of the data language.
///
/// Every inhabitant has exactly one name ([`Value::to_canonical_bytes`]),
/// and byte equality of names decides equality of structures.
///
/// The enum is exhaustive: its eleven variants are the closed set CBOR's
/// major types define, and a `match` over the value model is meant to
/// handle them completely.
///
/// ```
/// use cogra_interchange::Value;
///
/// let v = Value::integer(-500).expect("in range");
/// assert_eq!(v.to_canonical_bytes(), [0x39, 0x01, 0xf3]);
/// assert_eq!(Value::from_canonical_bytes(&[0x39, 0x01, 0xf3]).expect("canonical"), v);
/// ```
#[derive(Debug, Eq)]
pub enum Value {
    /// Major type 0: an integer in `[0, 2^64)`.
    Unsigned(u64),
    /// Major type 1: an integer in `[-2^64, -1]`.
    Negative(Negative),
    /// Major type 2.
    Bytes(Bytes),
    /// Major type 3, valid UTF-8 by construction.
    Text(Text),
    /// Major type 4.
    Array(Array),
    /// Major type 5, canonically ordered and duplicate-free by construction.
    Map(Map),
    /// Major type 6.
    Tag(Tag),
    /// Major type 7, simple values `false` and `true`.
    Bool(bool),
    /// Major type 7, simple value `null`.
    Null,
    /// Major type 7, every other simple value — restrained.
    Simple(Simple),
    /// Major type 7, floating point — restrained.
    Float(Float),
}

impl Value {
    /// Build an integer, choosing major type 0 or 1 by sign.
    ///
    /// ```
    /// use cogra_interchange::{Value, ValueError};
    ///
    /// assert_eq!(Value::integer(1).expect("in range"), Value::Unsigned(1));
    /// let err = Value::integer(-(1i128 << 64) - 1).expect_err("below the range");
    /// assert!(matches!(err, ValueError::IntegerOutOfRange { .. }));
    /// ```
    pub fn integer(v: i128) -> Result<Value, ValueError> {
        if v >= 0 {
            u64::try_from(v)
                .map(Value::Unsigned)
                .map_err(|_| ValueError::IntegerOutOfRange { value: v })
        } else {
            Negative::from_i128(v).map(Value::Negative)
        }
    }

    /// The initial byte of this value's name, and the argument that byte's
    /// additional information introduces.
    ///
    /// The pair is the whole of the value's head as far as ordering is
    /// concerned: equal initial bytes mean equal argument widths, and an
    /// argument of fixed width compares big-endian exactly as the integer
    /// does.
    pub(crate) fn canonical_head(&self) -> (u8, u64) {
        match self {
            Value::Unsigned(n) => (initial_byte(0, *n), *n),
            Value::Negative(n) => (initial_byte(1, n.argument()), n.argument()),
            Value::Bytes(b) => {
                let len = b.as_slice().len() as u64;
                (initial_byte(2, len), len)
            }
            Value::Text(t) => {
                let len = t.as_str().len() as u64;
                (initial_byte(3, len), len)
            }
            Value::Array(a) => {
                let len = a.len() as u64;
                (initial_byte(4, len), len)
            }
            Value::Map(m) => {
                let len = m.len() as u64;
                (initial_byte(5, len), len)
            }
            Value::Tag(t) => (initial_byte(6, t.number()), t.number()),
            Value::Bool(false) => (0xf4, 20),
            Value::Bool(true) => (0xf5, 21),
            Value::Null => (0xf6, 22),
            Value::Simple(s) => {
                if s.get() < 24 {
                    (0xe0 | s.get(), u64::from(s.get()))
                } else {
                    (0xf8, u64::from(s.get()))
                }
            }
            Value::Float(f) => (f.width().initial_byte(), f.bits()),
        }
    }
}

impl Ord for Value {
    /// The bytewise-lexicographic order of canonical names, computed
    /// without producing them.
    ///
    /// The comparison walks an explicit worklist rather than the call
    /// stack: a value deep enough to overflow a recursive comparator is
    /// exactly the value a hostile input produces.
    fn cmp(&self, other: &Value) -> Ordering {
        let mut work: Vec<(&Value, &Value)> = vec![(self, other)];
        while let Some((a, b)) = work.pop() {
            match a.canonical_head().cmp(&b.canonical_head()) {
                Ordering::Equal => {}
                unequal => return unequal,
            }
            match (a, b) {
                (Value::Bytes(x), Value::Bytes(y)) => match x.as_slice().cmp(y.as_slice()) {
                    Ordering::Equal => {}
                    unequal => return unequal,
                },
                (Value::Text(x), Value::Text(y)) => match x.as_str().cmp(y.as_str()) {
                    Ordering::Equal => {}
                    unequal => return unequal,
                },
                (Value::Array(x), Value::Array(y)) => {
                    work.extend(x.as_slice().iter().zip(y.as_slice()).rev());
                }
                (Value::Map(x), Value::Map(y)) => {
                    for ((xk, xv), (yk, yv)) in x.0.iter().zip(y.0.iter()).rev() {
                        work.push((xv, yv));
                        work.push((xk, yk));
                    }
                }
                (Value::Tag(x), Value::Tag(y)) => work.push((x.item(), y.item())),
                _ => {}
            }
        }
        Ordering::Equal
    }
}

impl PartialOrd for Value {
    fn partial_cmp(&self, other: &Value) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

// The derived `Clone`, `PartialEq`, and `Hash` recurse to the nesting depth,
// so a value a hostile input nests deeply enough overflows the stack on the
// walk the compiler generates — the same hazard `Drop` and `Ord` already
// answer with an explicit worklist (`impl:xchg:iterative-teardown`). These
// three are hand-written to the same discipline: the walk is a worklist, and
// the call depth stays constant however deep the value nested.

impl Clone for Value {
    fn clone(&self) -> Value {
        clone_iter(self)
    }
}

impl PartialEq for Value {
    fn eq(&self, other: &Value) -> bool {
        eq_iter(vec![(self, other)])
    }
}

impl Hash for Value {
    fn hash<H: Hasher>(&self, state: &mut H) {
        hash_iter(vec![self], state);
    }
}

/// A deep clone that never recurses to the nesting depth.
///
/// The rebuild is post-order over an explicit instruction stack: a `Clone`
/// step for a container pushes a matching build step and then its children,
/// so every child is fully rebuilt into `results` before the build step that
/// consumes it runs. `results` therefore holds exactly the finished clone
/// when the stack empties, and the call depth stays constant.
fn clone_iter(root: &Value) -> Value {
    enum Step<'a> {
        Clone(&'a Value),
        BuildArray(usize),
        BuildMap(usize),
        BuildTag(u64),
    }

    let mut work = vec![Step::Clone(root)];
    let mut results: Vec<Value> = Vec::new();
    while let Some(step) = work.pop() {
        match step {
            Step::Clone(value) => match value {
                Value::Array(array) => {
                    work.push(Step::BuildArray(array.0.len()));
                    for child in array.0.iter().rev() {
                        work.push(Step::Clone(child));
                    }
                }
                Value::Map(map) => {
                    work.push(Step::BuildMap(map.0.len()));
                    for (key, value) in map.0.iter().rev() {
                        work.push(Step::Clone(value));
                        work.push(Step::Clone(key));
                    }
                }
                Value::Tag(tag) => {
                    work.push(Step::BuildTag(tag.number));
                    work.push(Step::Clone(&tag.item));
                }
                leaf => results.push(clone_leaf(leaf)),
            },
            Step::BuildArray(len) => {
                let start = results.len() - len;
                let items = results.split_off(start);
                results.push(Value::Array(Array(items)));
            }
            Step::BuildMap(len) => {
                let start = results.len() - len * 2;
                let mut flat = results.split_off(start).into_iter();
                let mut entries = Vec::with_capacity(len);
                while let (Some(key), Some(value)) = (flat.next(), flat.next()) {
                    entries.push((key, value));
                }
                results.push(Value::Map(Map::from_sorted(entries)));
            }
            Step::BuildTag(number) => {
                let item = results.pop().expect("the tag's item was rebuilt");
                results.push(Value::Tag(Tag {
                    number,
                    item: Box::new(item),
                }));
            }
        }
    }
    results.pop().expect("the root was rebuilt")
}

/// Clone a value known to hold no nested value. The containers are handled
/// by the worklist in [`clone_iter`], so this never recurses.
fn clone_leaf(value: &Value) -> Value {
    match value {
        Value::Unsigned(n) => Value::Unsigned(*n),
        Value::Negative(n) => Value::Negative(*n),
        Value::Bytes(b) => Value::Bytes(b.clone()),
        Value::Text(t) => Value::Text(t.clone()),
        Value::Bool(b) => Value::Bool(*b),
        Value::Null => Value::Null,
        Value::Simple(s) => Value::Simple(*s),
        Value::Float(f) => Value::Float(*f),
        Value::Array(_) | Value::Map(_) | Value::Tag(_) => {
            unreachable!("containers are rebuilt by the worklist")
        }
    }
}

/// Structural equality over an explicit worklist of pairs, in the shape of
/// [`Value`]'s `Ord`. The first inequality met settles the answer.
fn eq_iter(mut work: Vec<(&Value, &Value)>) -> bool {
    while let Some((a, b)) = work.pop() {
        match (a, b) {
            (Value::Unsigned(x), Value::Unsigned(y)) if x == y => {}
            (Value::Negative(x), Value::Negative(y)) if x == y => {}
            (Value::Bytes(x), Value::Bytes(y)) if x == y => {}
            (Value::Text(x), Value::Text(y)) if x == y => {}
            (Value::Bool(x), Value::Bool(y)) if x == y => {}
            (Value::Null, Value::Null) => {}
            (Value::Simple(x), Value::Simple(y)) if x == y => {}
            (Value::Float(x), Value::Float(y)) if x == y => {}
            (Value::Array(x), Value::Array(y)) if x.0.len() == y.0.len() => {
                work.extend(x.0.iter().zip(y.0.iter()));
            }
            (Value::Map(x), Value::Map(y)) if x.0.len() == y.0.len() => {
                for ((xk, xv), (yk, yv)) in x.0.iter().zip(y.0.iter()) {
                    work.push((xk, yk));
                    work.push((xv, yv));
                }
            }
            (Value::Tag(x), Value::Tag(y)) if x.number == y.number => {
                work.push((&x.item, &y.item));
            }
            _ => return false,
        }
    }
    true
}

/// Hash the forest in `work` in a fixed pre-order, feeding the hasher a
/// discriminant and the scalar payload of every node.
///
/// Equal values feed the hasher identical sequences — the discriminant and
/// the length prefix of every container make the traversal a faithful
/// serialization of the tree — so the `Hash`/`PartialEq` contract holds.
fn hash_iter<H: Hasher>(mut work: Vec<&Value>, state: &mut H) {
    while let Some(value) = work.pop() {
        match value {
            Value::Unsigned(n) => {
                state.write_u8(0);
                n.hash(state);
            }
            Value::Negative(n) => {
                state.write_u8(1);
                n.argument().hash(state);
            }
            Value::Bytes(b) => {
                state.write_u8(2);
                b.as_slice().hash(state);
            }
            Value::Text(t) => {
                state.write_u8(3);
                t.as_str().hash(state);
            }
            Value::Array(a) => {
                state.write_u8(4);
                a.0.len().hash(state);
                work.extend(a.0.iter().rev());
            }
            Value::Map(m) => {
                state.write_u8(5);
                m.0.len().hash(state);
                for (key, value) in m.0.iter().rev() {
                    work.push(value);
                    work.push(key);
                }
            }
            Value::Tag(t) => {
                state.write_u8(6);
                t.number.hash(state);
                work.push(&t.item);
            }
            Value::Bool(b) => {
                state.write_u8(7);
                b.hash(state);
            }
            Value::Null => state.write_u8(8),
            Value::Simple(s) => {
                state.write_u8(9);
                s.get().hash(state);
            }
            Value::Float(f) => {
                state.write_u8(10);
                f.hash(state);
            }
        }
    }
}

/// A major-type-1 integer, held as its encoded argument `n`, denoting
/// `-1 - n`.
///
/// The argument is what is stored because the argument is what the
/// canonical order compares: major type 1's names ascend as `n` ascends,
/// which is the reverse of the order of the integers they denote.
///
/// ```
/// use cogra_interchange::Negative;
///
/// assert_eq!(Negative::from_argument(0).get(), -1);
/// assert_eq!(Negative::from_i128(-500).expect("in range").argument(), 499);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub struct Negative(u64);

impl Negative {
    /// Build from the encoded argument `n`, denoting `-1 - n`.
    ///
    /// ```
    /// use cogra_interchange::Negative;
    ///
    /// assert_eq!(Negative::from_argument(23).get(), -24);
    /// ```
    pub const fn from_argument(n: u64) -> Negative {
        Negative(n)
    }

    /// Build from the integer denoted, which must lie in `[-2^64, -1]`.
    ///
    /// ```
    /// use cogra_interchange::{Negative, ValueError};
    ///
    /// let err = Negative::from_i128(0).expect_err("0 is not negative");
    /// assert!(matches!(err, ValueError::IntegerOutOfRange { value: 0 }));
    /// ```
    pub fn from_i128(v: i128) -> Result<Negative, ValueError> {
        if v >= 0 {
            return Err(ValueError::IntegerOutOfRange { value: v });
        }
        u64::try_from(-1 - v)
            .map(Negative)
            .map_err(|_| ValueError::IntegerOutOfRange { value: v })
    }

    /// The encoded argument `n`.
    ///
    /// ```
    /// use cogra_interchange::Negative;
    ///
    /// assert_eq!(Negative::from_argument(7).argument(), 7);
    /// ```
    pub const fn argument(self) -> u64 {
        self.0
    }

    /// The integer denoted, `-1 - n`.
    ///
    /// ```
    /// use cogra_interchange::Negative;
    ///
    /// assert_eq!(Negative::from_argument(u64::MAX).get(), -(1i128 << 64));
    /// ```
    pub const fn get(self) -> i128 {
        -1 - (self.0 as i128)
    }
}

/// A byte string.
///
/// Its `Ord` is the ordinary bytewise order of the payload, which is *not*
/// the canonical order of the corresponding [`Value`]: canonical order
/// compares the head first, so a shorter byte string always sorts before a
/// longer one. Sort `Value`s when canonical order is what is wanted.
///
/// ```
/// use cogra_interchange::Bytes;
///
/// let b = Bytes::from(vec![1, 2, 3]);
/// assert_eq!(b.as_slice(), [1, 2, 3]);
/// assert_eq!(b.into_vec(), vec![1, 2, 3]);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub struct Bytes(Box<[u8]>);

impl Bytes {
    /// The payload.
    ///
    /// ```
    /// use cogra_interchange::Bytes;
    ///
    /// assert_eq!(Bytes::default().as_slice(), &[] as &[u8]);
    /// ```
    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }

    /// The payload, owned.
    ///
    /// ```
    /// use cogra_interchange::Bytes;
    ///
    /// assert_eq!(Bytes::from(vec![0xff]).into_vec(), vec![0xff]);
    /// ```
    pub fn into_vec(self) -> Vec<u8> {
        self.0.into_vec()
    }
}

impl From<Vec<u8>> for Bytes {
    fn from(v: Vec<u8>) -> Bytes {
        Bytes(v.into_boxed_slice())
    }
}

impl AsRef<[u8]> for Bytes {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// A text string, valid UTF-8 by construction.
///
/// Its `Ord` is the ordinary bytewise order of the payload, which is *not*
/// the canonical order of the corresponding [`Value`]: canonical order
/// compares the head first, so a shorter text string always sorts before a
/// longer one.
///
/// ```
/// use cogra_interchange::{Text, ValueError};
///
/// assert_eq!(Text::from("IETF".to_owned()).as_str(), "IETF");
///
/// let err = Text::try_from(vec![0x61, 0xff]).expect_err("0xff starts no sequence");
/// assert!(matches!(err, ValueError::InvalidUtf8 { offset: 1 }));
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub struct Text(Box<str>);

impl Text {
    /// The payload.
    ///
    /// ```
    /// use cogra_interchange::Text;
    ///
    /// assert_eq!(Text::from("a".to_owned()).as_str(), "a");
    /// ```
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The payload, owned.
    ///
    /// ```
    /// use cogra_interchange::Text;
    ///
    /// assert_eq!(Text::from("a".to_owned()).into_string(), "a".to_owned());
    /// ```
    pub fn into_string(self) -> String {
        self.0.into_string()
    }
}

impl From<String> for Text {
    fn from(s: String) -> Text {
        Text(s.into_boxed_str())
    }
}

impl TryFrom<Vec<u8>> for Text {
    type Error = ValueError;

    fn try_from(bytes: Vec<u8>) -> Result<Text, ValueError> {
        match String::from_utf8(bytes) {
            Ok(s) => Ok(Text::from(s)),
            Err(e) => Err(ValueError::InvalidUtf8 {
                offset: e.utf8_error().valid_up_to(),
            }),
        }
    }
}

/// A sequence.
///
/// The newtype exists for the teardown duty rather than for an invariant
/// of its own: dropping a deeply nested sequence dismantles it with an
/// explicit worklist, where the compiler's derived drop glue would recurse
/// to the nesting depth and overflow the stack.
///
/// ```
/// use cogra_interchange::{Array, Value};
///
/// let a = Array::new([Value::Unsigned(1), Value::Unsigned(2)]);
/// assert_eq!(a.len(), 2);
/// assert_eq!(a.as_slice()[0], Value::Unsigned(1));
/// ```
#[derive(Debug, Eq, Default)]
pub struct Array(Vec<Value>);

// Hand-written for the same reason as [`Value`]'s: the derived walks recurse
// to the nesting depth. Each delegates to the shared worklist helpers.
impl Clone for Array {
    fn clone(&self) -> Array {
        Array(self.0.iter().map(clone_iter).collect())
    }
}

impl PartialEq for Array {
    fn eq(&self, other: &Array) -> bool {
        self.0.len() == other.0.len() && eq_iter(self.0.iter().zip(other.0.iter()).collect())
    }
}

impl Hash for Array {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.len().hash(state);
        hash_iter(self.0.iter().collect(), state);
    }
}

impl Array {
    /// Collect a sequence. Total: a sequence carries no invariant beyond
    /// those its elements already carry.
    ///
    /// ```
    /// use cogra_interchange::{Array, Value};
    ///
    /// assert!(Array::new([]).is_empty());
    /// ```
    pub fn new(items: impl IntoIterator<Item = Value>) -> Array {
        Array(items.into_iter().collect())
    }

    /// The elements.
    ///
    /// ```
    /// use cogra_interchange::{Array, Value};
    ///
    /// assert_eq!(Array::new([Value::Null]).as_slice(), [Value::Null]);
    /// ```
    pub fn as_slice(&self) -> &[Value] {
        &self.0
    }

    /// The elements, owned.
    ///
    /// ```
    /// use cogra_interchange::{Array, Value};
    ///
    /// assert_eq!(Array::new([Value::Null]).into_vec(), vec![Value::Null]);
    /// ```
    pub fn into_vec(mut self) -> Vec<Value> {
        mem::take(&mut self.0)
    }

    /// How many elements.
    ///
    /// ```
    /// use cogra_interchange::{Array, Value};
    ///
    /// assert_eq!(Array::new([Value::Null]).len(), 1);
    /// ```
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Whether there are no elements.
    ///
    /// ```
    /// use cogra_interchange::Array;
    ///
    /// assert!(Array::default().is_empty());
    /// ```
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl FromIterator<Value> for Array {
    fn from_iter<I: IntoIterator<Item = Value>>(iter: I) -> Array {
        Array::new(iter)
    }
}

impl Drop for Array {
    fn drop(&mut self) {
        tear_down(mem::take(&mut self.0));
    }
}

/// A map whose entries stand in the bytewise-lexicographic order of their
/// encoded keys, keys pairwise distinct.
///
/// ```
/// use cogra_interchange::{Map, Value, ValueError};
///
/// let m = Map::new([
///     (Value::Unsigned(3), Value::Unsigned(4)),
///     (Value::Unsigned(1), Value::Unsigned(2)),
/// ])
/// .expect("distinct keys");
/// assert_eq!(m.get(&Value::Unsigned(1)), Some(&Value::Unsigned(2)));
///
/// let err = Map::new([
///     (Value::Null, Value::Unsigned(1)),
///     (Value::Null, Value::Unsigned(2)),
/// ])
/// .expect_err("the key repeats");
/// assert!(matches!(err, ValueError::DuplicateMapKey { index: 1 }));
/// ```
#[derive(Debug, Eq, Default)]
pub struct Map(Vec<(Value, Value)>);

// Hand-written for the same reason as [`Value`]'s: the derived walks recurse
// to the nesting depth. Each delegates to the shared worklist helpers.
impl Clone for Map {
    fn clone(&self) -> Map {
        Map(self
            .0
            .iter()
            .map(|(key, value)| (clone_iter(key), clone_iter(value)))
            .collect())
    }
}

impl PartialEq for Map {
    fn eq(&self, other: &Map) -> bool {
        if self.0.len() != other.0.len() {
            return false;
        }
        let mut work = Vec::with_capacity(self.0.len() * 2);
        for ((xk, xv), (yk, yv)) in self.0.iter().zip(other.0.iter()) {
            work.push((xk, yk));
            work.push((xv, yv));
        }
        eq_iter(work)
    }
}

impl Hash for Map {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.len().hash(state);
        let mut work = Vec::with_capacity(self.0.len() * 2);
        for (key, value) in &self.0 {
            work.push(key);
            work.push(value);
        }
        hash_iter(work, state);
    }
}

impl Map {
    /// Sort into canonical order and refuse duplicate keys.
    ///
    /// ```
    /// use cogra_interchange::{Map, Value};
    ///
    /// let m = Map::new([(Value::Unsigned(1), Value::Null)]).expect("one key");
    /// assert_eq!(m.len(), 1);
    /// ```
    pub fn new(entries: impl IntoIterator<Item = (Value, Value)>) -> Result<Map, ValueError> {
        let mut entries: Vec<(Value, Value)> = entries.into_iter().collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        for index in 1..entries.len() {
            if entries[index - 1].0.cmp(&entries[index].0).is_eq() {
                return Err(ValueError::DuplicateMapKey { index });
            }
        }
        Ok(Map(entries))
    }

    /// The entries as a slice, for the walks that need to run backwards.
    pub(crate) fn entries(&self) -> &[(Value, Value)] {
        &self.0
    }

    /// Entries already in canonical order and known pairwise distinct.
    ///
    /// The decoder is the only caller: it establishes both properties from
    /// the byte ranges it retains as it goes, and sorting again would
    /// repeat a comparison already made.
    pub(crate) fn from_sorted(entries: Vec<(Value, Value)>) -> Map {
        debug_assert!(
            entries.windows(2).all(|w| w[0].0.cmp(&w[1].0).is_lt()),
            "the decoder validates order and distinctness before building the map"
        );
        Map(entries)
    }

    /// The value under `key`, found by binary search over canonical order.
    ///
    /// ```
    /// use cogra_interchange::{Map, Value};
    ///
    /// let m = Map::new([(Value::Unsigned(1), Value::Null)]).expect("one key");
    /// assert_eq!(m.get(&Value::Unsigned(2)), None);
    /// ```
    pub fn get(&self, key: &Value) -> Option<&Value> {
        self.0
            .binary_search_by(|(k, _)| k.cmp(key))
            .ok()
            .map(|index| &self.0[index].1)
    }

    /// The entries, in canonical key order.
    ///
    /// ```
    /// use cogra_interchange::{Map, Value};
    ///
    /// let m = Map::new([
    ///     (Value::Unsigned(2), Value::Null),
    ///     (Value::Unsigned(1), Value::Null),
    /// ])
    /// .expect("distinct keys");
    /// let keys: Vec<&Value> = m.iter().map(|(k, _)| k).collect();
    /// assert_eq!(keys, [&Value::Unsigned(1), &Value::Unsigned(2)]);
    /// ```
    pub fn iter(&self) -> impl Iterator<Item = (&Value, &Value)> + '_ {
        self.0.iter().map(|(k, v)| (k, v))
    }

    /// The entries, owned, in canonical key order.
    ///
    /// ```
    /// use cogra_interchange::{Map, Value};
    ///
    /// let m = Map::new([(Value::Unsigned(1), Value::Null)]).expect("one key");
    /// assert_eq!(m.into_entries(), vec![(Value::Unsigned(1), Value::Null)]);
    /// ```
    pub fn into_entries(mut self) -> Vec<(Value, Value)> {
        mem::take(&mut self.0)
    }

    /// How many entries.
    ///
    /// ```
    /// use cogra_interchange::Map;
    ///
    /// assert_eq!(Map::default().len(), 0);
    /// ```
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Whether there are no entries.
    ///
    /// ```
    /// use cogra_interchange::Map;
    ///
    /// assert!(Map::default().is_empty());
    /// ```
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl Drop for Map {
    fn drop(&mut self) {
        let entries = mem::take(&mut self.0);
        let mut work = Vec::with_capacity(entries.len() * 2);
        for (key, value) in entries {
            work.push(key);
            work.push(value);
        }
        tear_down(work);
    }
}

/// Dismantle a forest of values with an explicit worklist.
///
/// Every container met is emptied into the worklist before it is dropped,
/// so the drop that follows finds nothing left to recurse into and the
/// call depth stays constant however deep the input nested.
fn tear_down(mut work: Vec<Value>) {
    while let Some(value) = work.pop() {
        match value {
            Value::Array(mut a) => work.append(&mut a.0),
            Value::Map(mut m) => {
                for (key, value) in mem::take(&mut m.0) {
                    work.push(key);
                    work.push(value);
                }
            }
            Value::Tag(mut t) => work.push(t.take_item()),
            _ => {}
        }
    }
}

/// A tagged item — restrained.
///
/// ```
/// use cogra_interchange::{Tag, Value};
///
/// let t = Tag::new(1, Value::Unsigned(1_363_896_240));
/// assert_eq!(t.number(), 1);
/// assert_eq!(t.item(), &Value::Unsigned(1_363_896_240));
/// ```
#[derive(Debug, Eq)]
pub struct Tag {
    number: u64,
    item: Box<Value>,
}

// Hand-written for the same reason as [`Value`]'s: the derived walks recurse
// down a chain of tags. Each delegates to the shared worklist helpers.
impl Clone for Tag {
    fn clone(&self) -> Tag {
        Tag {
            number: self.number,
            item: Box::new(clone_iter(&self.item)),
        }
    }
}

impl PartialEq for Tag {
    fn eq(&self, other: &Tag) -> bool {
        self.number == other.number && eq_iter(vec![(&self.item, &other.item)])
    }
}

impl Hash for Tag {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.number.hash(state);
        hash_iter(vec![&self.item], state);
    }
}

impl Tag {
    /// Tag `item` with `number`. Total: every tag number is admitted, and
    /// what a tag number means is a theory's business, not the data
    /// language's.
    ///
    /// ```
    /// use cogra_interchange::{Tag, Value};
    ///
    /// assert_eq!(Tag::new(0, Value::Null).number(), 0);
    /// ```
    pub fn new(number: u64, item: Value) -> Tag {
        Tag {
            number,
            item: Box::new(item),
        }
    }

    /// The tag number.
    ///
    /// ```
    /// use cogra_interchange::{Tag, Value};
    ///
    /// assert_eq!(Tag::new(42, Value::Null).number(), 42);
    /// ```
    pub const fn number(&self) -> u64 {
        self.number
    }

    /// The tagged item.
    ///
    /// ```
    /// use cogra_interchange::{Tag, Value};
    ///
    /// assert_eq!(Tag::new(42, Value::Null).item(), &Value::Null);
    /// ```
    pub fn item(&self) -> &Value {
        &self.item
    }

    /// The tagged item, owned.
    ///
    /// ```
    /// use cogra_interchange::{Tag, Value};
    ///
    /// assert_eq!(Tag::new(42, Value::Null).into_item(), Value::Null);
    /// ```
    pub fn into_item(mut self) -> Value {
        self.take_item()
    }

    /// Empty the tag, leaving a leaf behind.
    ///
    /// The box is reused rather than replaced: the point is to leave the
    /// tag holding something whose drop recurses nowhere.
    fn take_item(&mut self) -> Value {
        mem::replace(&mut *self.item, Value::Null)
    }
}

impl Drop for Tag {
    fn drop(&mut self) {
        // A tag is recursive, so a chain of them is a chain the compiler's
        // drop glue would descend. Arrays and maps dismantle themselves
        // iteratively already, and the worklist reaches a tag inside one
        // of them without recursing; tag directly inside tag is the one
        // chain left, and this is where it is broken.
        if matches!(*self.item, Value::Tag(_)) {
            tear_down(vec![self.take_item()]);
        }
    }
}

/// A simple value other than `false`, `true`, and `null` — restrained.
///
/// ```
/// use cogra_interchange::Simple;
///
/// assert_eq!(Simple::UNDEFINED.get(), 23);
/// assert_eq!(Simple::new(255).expect("in range").get(), 255);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Simple(u8);

impl Simple {
    /// The simple value `undefined`.
    pub const UNDEFINED: Simple = Simple(23);

    /// Refuses 20, 21, and 22, which have their own variants, and refuses
    /// 24 through 31, which no well-formed encoding produces.
    ///
    /// ```
    /// use cogra_interchange::{Simple, ValueError};
    ///
    /// let err = Simple::new(24).expect_err("24 through 31 are unencodable");
    /// assert!(matches!(err, ValueError::ReservedSimpleValue { value: 24 }));
    /// ```
    pub fn new(value: u8) -> Result<Simple, ValueError> {
        match value {
            20..=22 | 24..=31 => Err(ValueError::ReservedSimpleValue { value }),
            _ => Ok(Simple(value)),
        }
    }

    /// The simple value.
    ///
    /// ```
    /// use cogra_interchange::Simple;
    ///
    /// assert_eq!(Simple::new(16).expect("in range").get(), 16);
    /// ```
    pub const fn get(self) -> u8 {
        self.0
    }
}

/// A floating-point value in the canonical form §4.2 fixes for it —
/// restrained.
///
/// The width and bit pattern of the shortest form are what is stored, so
/// two floats are equal exactly when their names are equal, the canonical
/// reduction happens once at construction, and the derived order is
/// already the bytewise order of names.
///
/// ```
/// use cogra_interchange::{Float, FloatWidth};
///
/// let f = Float::from_f64(1.5).expect("canonical");
/// assert_eq!(f.width(), FloatWidth::Half);
/// assert_eq!(f.to_f64(), 1.5);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Float {
    width: FloatWidth,
    bits: u64,
}

/// The width of a floating-point name.
///
/// The declaration order is the order of the heads `0xf9`, `0xfa`, `0xfb`,
/// which is what makes the derived order on [`Float`] the canonical one.
///
/// ```
/// use cogra_interchange::FloatWidth;
///
/// assert!(FloatWidth::Half < FloatWidth::Single);
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum FloatWidth {
    /// binary16, head `0xf9`.
    Half,
    /// binary32, head `0xfa`.
    Single,
    /// binary64, head `0xfb`.
    Double,
}

impl FloatWidth {
    pub(crate) const fn initial_byte(self) -> u8 {
        match self {
            FloatWidth::Half => 0xf9,
            FloatWidth::Single => 0xfa,
            FloatWidth::Double => 0xfb,
        }
    }

    pub(crate) const fn argument_len(self) -> usize {
        match self {
            FloatWidth::Half => 2,
            FloatWidth::Single => 4,
            FloatWidth::Double => 8,
        }
    }
}

/// The bit pattern of the one NaN the data language names, widened to
/// binary64.
const CANONICAL_NAN_F64: u64 = 0x7ff8_0000_0000_0000;

impl Float {
    /// The single NaN of the data language, `0xf97e00`.
    pub const CANONICAL_NAN: Float = Float {
        width: FloatWidth::Half,
        bits: 0x7e00,
    };

    /// Reduces to the shortest form preserving the value.
    ///
    /// Every NaN but [`Float::CANONICAL_NAN`] is refused rather than
    /// normalized: normalizing would mean `from_f64(x).to_f64() != x`,
    /// which is the determinism trap this crate exists to close, and it
    /// would hide from the caller that the value it handed over is not the
    /// value the crate holds. Note that on some targets the NaN an invalid
    /// operation produces carries a sign bit and so is refused here.
    ///
    /// ```
    /// use cogra_interchange::{Float, FloatWidth, ValueError};
    ///
    /// assert_eq!(Float::from_f64(f64::NAN).expect("canonical"), Float::CANONICAL_NAN);
    /// assert_eq!(
    ///     Float::from_f64(1.1).expect("canonical").width(),
    ///     FloatWidth::Double,
    /// );
    ///
    /// let payload = f64::from_bits(0x7ff8_0000_0000_0001);
    /// let err = Float::from_f64(payload).expect_err("a NaN with a payload");
    /// assert!(matches!(err, ValueError::NonCanonicalFloat));
    /// ```
    pub fn from_f64(v: f64) -> Result<Float, ValueError> {
        let bits = v.to_bits();
        if v.is_nan() {
            return if bits == CANONICAL_NAN_F64 {
                Ok(Float::CANONICAL_NAN)
            } else {
                Err(ValueError::NonCanonicalFloat)
            };
        }
        let single = v as f32;
        // Bit equality, not `==`: negative zero must not be mistaken for
        // zero, and the two are the same number under `==`.
        if f64::from(single).to_bits() != bits {
            return Ok(Float {
                width: FloatWidth::Double,
                bits,
            });
        }
        match half_from_single(single.to_bits()) {
            Some(half) => Ok(Float {
                width: FloatWidth::Half,
                bits: u64::from(half),
            }),
            None => Ok(Float {
                width: FloatWidth::Single,
                bits: u64::from(single.to_bits()),
            }),
        }
    }

    /// The value denoted.
    ///
    /// ```
    /// use cogra_interchange::Float;
    ///
    /// assert!(Float::CANONICAL_NAN.to_f64().is_nan());
    /// assert_eq!(Float::from_f64(-0.0).expect("canonical").to_f64(), -0.0);
    /// ```
    pub fn to_f64(self) -> f64 {
        bits_to_f64(self.width, self.bits)
    }

    /// The width of the shortest form.
    ///
    /// ```
    /// use cogra_interchange::{Float, FloatWidth};
    ///
    /// assert_eq!(Float::CANONICAL_NAN.width(), FloatWidth::Half);
    /// ```
    pub const fn width(self) -> FloatWidth {
        self.width
    }

    pub(crate) const fn bits(self) -> u64 {
        self.bits
    }
}

/// The binary16 pattern of a binary32 value, when the narrowing is exact.
///
/// NaNs never reach here: [`Float::from_f64`] settles them first, so the
/// all-ones exponent means an infinity and nothing else.
fn half_from_single(bits: u32) -> Option<u16> {
    let sign = ((bits >> 16) & 0x8000) as u16;
    let exponent = ((bits >> 23) & 0xff) as i32;
    let mantissa = bits & 0x007f_ffff;

    if exponent == 0xff {
        return Some(sign | 0x7c00);
    }
    if exponent == 0 {
        // A binary32 subnormal is smaller than 2^-126, far below the least
        // binary16 subnormal 2^-24; only zero narrows exactly.
        return (mantissa == 0).then_some(sign);
    }

    let unbiased = exponent - 127;
    if unbiased > 15 {
        return None;
    }
    if unbiased >= -14 {
        if mantissa & 0x1fff != 0 {
            return None;
        }
        let biased = (unbiased + 15) as u16;
        return Some(sign | (biased << 10) | (mantissa >> 13) as u16);
    }

    // Subnormal binary16: the value is `m * 2^-24` for an integer
    // `1 <= m <= 1023`, so the significand must shift down exactly.
    let shift = (-unbiased - 1) as u32;
    if shift >= 24 {
        return None;
    }
    let significand = mantissa | 0x0080_0000;
    if significand & ((1 << shift) - 1) != 0 {
        return None;
    }
    Some(sign | (significand >> shift) as u16)
}

/// The value a width and bit pattern denote, NaN payloads preserved.
///
/// Payload preservation is what lets the decoder tell the canonical NaN
/// from every other one by round-tripping through [`Float::from_f64`].
pub(crate) fn bits_to_f64(width: FloatWidth, bits: u64) -> f64 {
    match width {
        FloatWidth::Half => half_to_f64(bits as u16),
        FloatWidth::Single => single_to_f64(bits as u32),
        FloatWidth::Double => f64::from_bits(bits),
    }
}

fn half_to_f64(bits: u16) -> f64 {
    let sign = (u64::from(bits) & 0x8000) << 48;
    let exponent = u64::from((bits >> 10) & 0x1f);
    let mantissa = u64::from(bits & 0x03ff);

    let widened = if exponent == 0x1f {
        sign | 0x7ff0_0000_0000_0000 | (mantissa << 42)
    } else if exponent == 0 {
        if mantissa == 0 {
            sign
        } else {
            let mut unbiased: i64 = -14;
            let mut significand = mantissa;
            while significand & 0x0400 == 0 {
                significand <<= 1;
                unbiased -= 1;
            }
            sign | (((unbiased + 1023) as u64) << 52) | ((significand & 0x03ff) << 42)
        }
    } else {
        sign | ((exponent + 1023 - 15) << 52) | (mantissa << 42)
    };
    f64::from_bits(widened)
}

fn single_to_f64(bits: u32) -> f64 {
    if bits & 0x7f80_0000 == 0x7f80_0000 && bits & 0x007f_ffff != 0 {
        // A NaN: widen by hand, since a cast is not required to carry the
        // payload across.
        let sign = (u64::from(bits) & 0x8000_0000) << 32;
        let mantissa = u64::from(bits & 0x007f_ffff) << 29;
        return f64::from_bits(sign | 0x7ff0_0000_0000_0000 | mantissa);
    }
    f64::from(f32::from_bits(bits))
}
