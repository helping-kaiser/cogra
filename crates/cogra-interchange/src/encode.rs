//! ´mod:module:encode´
//!
//! The canonical encoder — total, with no failure mode.
//!
//! Every `Value` is already a member of the data language, so the encoder
//! has no canonicity decision left to make: it writes heads in preferred
//! serialization, definite lengths throughout, map entries in the order
//! the map already stands in, and floats in the width their construction
//! fixed.
//!
//! The walk is iterative. A value nested deeply enough to overflow a
//! recursive encoder is a value the decoder will accept, since the data
//! language bounds nesting nowhere.

use crate::value::{Bytes, Float, Simple, Text, Value};

/// The initial byte of a head: the major type, and the additional
/// information the argument's magnitude selects.
pub(crate) const fn initial_byte(major: u8, argument: u64) -> u8 {
    let additional = if argument < 24 {
        argument as u8
    } else if argument <= u8::MAX as u64 {
        24
    } else if argument <= u16::MAX as u64 {
        25
    } else if argument <= u32::MAX as u64 {
        26
    } else {
        27
    };
    (major << 5) | additional
}

/// How many bytes a head of this argument occupies, initial byte included.
pub(crate) const fn head_len(argument: u64) -> usize {
    match initial_byte(0, argument) {
        24 => 2,
        25 => 3,
        26 => 5,
        27 => 9,
        _ => 1,
    }
}

fn write_head(out: &mut Vec<u8>, major: u8, argument: u64) {
    let initial = initial_byte(major, argument);
    out.push(initial);
    match initial & 0x1f {
        24 => out.push(argument as u8),
        25 => out.extend_from_slice(&(argument as u16).to_be_bytes()),
        26 => out.extend_from_slice(&(argument as u32).to_be_bytes()),
        27 => out.extend_from_slice(&argument.to_be_bytes()),
        _ => {}
    }
}

fn write_simple(out: &mut Vec<u8>, simple: Simple) {
    if simple.get() < 24 {
        out.push(0xe0 | simple.get());
    } else {
        out.push(0xf8);
        out.push(simple.get());
    }
}

fn write_float(out: &mut Vec<u8>, float: Float) {
    out.push(float.width().initial_byte());
    let argument_len = float.width().argument_len();
    out.extend_from_slice(&float.bits().to_be_bytes()[8 - argument_len..]);
}

impl Value {
    /// The value's canonical name. Total.
    ///
    /// ```
    /// use cogra_interchange::{Text, Value};
    ///
    /// let v = Value::Text(Text::from("IETF".to_owned()));
    /// assert_eq!(v.to_canonical_bytes(), [0x64, 0x49, 0x45, 0x54, 0x46]);
    /// ```
    pub fn to_canonical_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.canonical_len());
        self.write_canonical(&mut out);
        out
    }

    /// Append the canonical name to `out`. Total.
    ///
    /// ```
    /// use cogra_interchange::Value;
    ///
    /// let mut out = vec![0xff];
    /// Value::Unsigned(1).write_canonical(&mut out);
    /// assert_eq!(out, [0xff, 0x01]);
    /// ```
    pub fn write_canonical(&self, out: &mut Vec<u8>) {
        let mut work: Vec<&Value> = vec![self];
        while let Some(value) = work.pop() {
            match value {
                Value::Unsigned(n) => write_head(out, 0, *n),
                Value::Negative(n) => write_head(out, 1, n.argument()),
                Value::Bytes(b) => write_bytes(out, b),
                Value::Text(t) => write_text(out, t),
                Value::Array(a) => {
                    write_head(out, 4, a.len() as u64);
                    work.extend(a.as_slice().iter().rev());
                }
                Value::Map(m) => {
                    write_head(out, 5, m.len() as u64);
                    for (key, item) in m.entries().iter().rev() {
                        work.push(item);
                        work.push(key);
                    }
                }
                Value::Tag(t) => {
                    write_head(out, 6, t.number());
                    work.push(t.item());
                }
                Value::Bool(false) => out.push(0xf4),
                Value::Bool(true) => out.push(0xf5),
                Value::Null => out.push(0xf6),
                Value::Simple(s) => write_simple(out, *s),
                Value::Float(f) => write_float(out, *f),
            }
        }
    }

    /// The length of the canonical name, without producing it.
    ///
    /// ```
    /// use cogra_interchange::{Array, Value};
    ///
    /// let v = Value::Array(Array::new([Value::Unsigned(1), Value::Unsigned(1000)]));
    /// assert_eq!(v.canonical_len(), v.to_canonical_bytes().len());
    /// ```
    pub fn canonical_len(&self) -> usize {
        let mut total = 0usize;
        let mut work: Vec<&Value> = vec![self];
        while let Some(value) = work.pop() {
            total += match value {
                Value::Unsigned(n) => head_len(*n),
                Value::Negative(n) => head_len(n.argument()),
                Value::Bytes(b) => {
                    let len = b.as_slice().len();
                    head_len(len as u64) + len
                }
                Value::Text(t) => {
                    let len = t.as_str().len();
                    head_len(len as u64) + len
                }
                Value::Array(a) => {
                    work.extend(a.as_slice());
                    head_len(a.len() as u64)
                }
                Value::Map(m) => {
                    for (key, item) in m.iter() {
                        work.push(key);
                        work.push(item);
                    }
                    head_len(m.len() as u64)
                }
                Value::Tag(t) => {
                    work.push(t.item());
                    head_len(t.number())
                }
                Value::Bool(_) | Value::Null => 1,
                Value::Simple(s) => {
                    if s.get() < 24 {
                        1
                    } else {
                        2
                    }
                }
                Value::Float(f) => 1 + f.width().argument_len(),
            };
        }
        total
    }
}

fn write_bytes(out: &mut Vec<u8>, bytes: &Bytes) {
    write_head(out, 2, bytes.as_slice().len() as u64);
    out.extend_from_slice(bytes.as_slice());
}

fn write_text(out: &mut Vec<u8>, text: &Text) {
    write_head(out, 3, text.as_str().len() as u64);
    out.extend_from_slice(text.as_str().as_bytes());
}
