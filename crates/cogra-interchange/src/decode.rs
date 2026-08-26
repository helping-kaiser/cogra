//! The validating decoder — refuses everything outside the data language.
//!
//! One pass checks everything membership requires: preferred
//! serialization at every head, no indefinite-length item of any major
//! type, map keys sorted bytewise-lexicographically on their encoded forms
//! and pairwise distinct, floating-point values in shortest form, text
//! strings valid UTF-8, and no trailing bytes after the single item.
//!
//! Sortedness and distinctness cost one comparison per entry rather than
//! one encoding: the decoder retains the byte range of each key it decodes
//! and compares adjacent ranges in the input it already holds.
//!
//! Nesting is bounded by the length of the input and by nothing else, so
//! the walk is iterative — an explicit stack of frames, never the call
//! stack.

use std::cmp::Ordering;

use crate::encode::initial_byte;
use crate::error::DecodeError;
use crate::value::{
    Array, Bytes, Float, FloatWidth, Map, Negative, Simple, Tag, Text, Value, bits_to_f64,
};

/// A container whose head has been read and whose items have not.
///
/// `start` is where the container's own head began, which becomes the
/// start of the finished value — the byte range a map needs to compare its
/// keys by.
#[derive(Debug)]
enum Frame {
    Array {
        items: Vec<Value>,
        remaining: usize,
        start: usize,
    },
    Map {
        entries: Vec<(Value, Value)>,
        remaining: usize,
        pending_key: Option<Value>,
        previous_key: Option<(usize, usize)>,
        start: usize,
    },
    Tag {
        number: u64,
        start: usize,
    },
}

/// The declared count of a container is attacker-controlled, so it never
/// sizes an allocation on its own. Growth from a small capacity is
/// amortized constant, where trusting the count is a memory-exhaustion
/// primitive costing the attacker nine bytes.
const CONTAINER_CAPACITY_BOUND: u64 = 4;

impl Value {
    /// Decode one canonical name; trailing bytes are an error.
    ///
    /// ```
    /// use cogra_interchange::{DecodeError, Value};
    ///
    /// assert_eq!(Value::from_canonical_bytes(&[0x01]).expect("canonical"), Value::Unsigned(1));
    ///
    /// let err = Value::from_canonical_bytes(&[0x01, 0x02]).expect_err("a second item");
    /// assert!(matches!(err, DecodeError::TrailingBytes { offset: 1, count: 1 }));
    /// ```
    pub fn from_canonical_bytes(bytes: &[u8]) -> Result<Value, DecodeError> {
        let (value, consumed) = Value::from_canonical_prefix(bytes)?;
        if consumed != bytes.len() {
            return Err(DecodeError::TrailingBytes {
                offset: consumed,
                count: bytes.len() - consumed,
            });
        }
        Ok(value)
    }

    /// Decode one canonical name from the head, returning the bytes
    /// consumed.
    ///
    /// ```
    /// use cogra_interchange::Value;
    ///
    /// let (value, consumed) = Value::from_canonical_prefix(&[0x01, 0x02]).expect("one item");
    /// assert_eq!((value, consumed), (Value::Unsigned(1), 1));
    /// ```
    pub fn from_canonical_prefix(bytes: &[u8]) -> Result<(Value, usize), DecodeError> {
        decode_one(bytes)
    }
}

fn decode_one(input: &[u8]) -> Result<(Value, usize), DecodeError> {
    let mut position = 0usize;
    let mut stack: Vec<Frame> = Vec::new();

    'item: loop {
        let start = position;
        let mut value = match read_item(input, &mut position)? {
            Item::Complete(value) => value,
            Item::Container(frame) => {
                stack.push(frame);
                continue 'item;
            }
        };
        let mut value_start = start;

        loop {
            let Some(frame) = stack.pop() else {
                return Ok((value, position));
            };
            match frame {
                Frame::Tag { number, start } => {
                    value = Value::Tag(Tag::new(number, value));
                    value_start = start;
                }
                Frame::Array {
                    mut items,
                    remaining,
                    start,
                } => {
                    items.push(value);
                    let remaining = remaining - 1;
                    if remaining == 0 {
                        value = Value::Array(Array::new(items));
                        value_start = start;
                    } else {
                        stack.push(Frame::Array {
                            items,
                            remaining,
                            start,
                        });
                        continue 'item;
                    }
                }
                Frame::Map {
                    mut entries,
                    remaining,
                    pending_key,
                    previous_key,
                    start,
                } => match pending_key {
                    None => {
                        if let Some((from, to)) = previous_key {
                            match input[from..to].cmp(&input[value_start..position]) {
                                Ordering::Less => {}
                                Ordering::Equal => {
                                    return Err(DecodeError::DuplicateMapKey {
                                        offset: value_start,
                                    });
                                }
                                Ordering::Greater => {
                                    return Err(DecodeError::UnsortedMapKeys {
                                        offset: value_start,
                                    });
                                }
                            }
                        }
                        stack.push(Frame::Map {
                            entries,
                            remaining,
                            pending_key: Some(value),
                            previous_key: Some((value_start, position)),
                            start,
                        });
                        continue 'item;
                    }
                    Some(key) => {
                        entries.push((key, value));
                        let remaining = remaining - 1;
                        if remaining == 0 {
                            value = Value::Map(Map::from_sorted(entries));
                            value_start = start;
                        } else {
                            stack.push(Frame::Map {
                                entries,
                                remaining,
                                pending_key: None,
                                previous_key,
                                start,
                            });
                            continue 'item;
                        }
                    }
                },
            }
        }
    }
}

enum Item {
    Complete(Value),
    Container(Frame),
}

/// One item, complete or the head of a container.
///
/// A container's declared count is checked against the bytes that remain
/// before any capacity is reserved for it: an array item is at least one byte
/// and a map entry at least two, one for each half, so a count exceeding that
/// bound cannot be met however the rest is spelled.
fn read_item(input: &[u8], position: &mut usize) -> Result<Item, DecodeError> {
    let start = *position;
    let head = read_head(input, position)?;
    let Head {
        major,
        additional,
        argument,
    } = head;

    let item = match major {
        0 => Item::Complete(Value::Unsigned(argument)),
        1 => Item::Complete(Value::Negative(Negative::from_argument(argument))),
        2 => {
            let payload = read_payload(input, position, argument)?;
            Item::Complete(Value::Bytes(Bytes::from(payload.to_vec())))
        }
        3 => {
            let payload_start = *position;
            let payload = read_payload(input, position, argument)?;
            match std::str::from_utf8(payload) {
                Ok(text) => Item::Complete(Value::Text(Text::from(text.to_owned()))),
                Err(e) => {
                    return Err(DecodeError::InvalidUtf8 {
                        offset: payload_start + e.valid_up_to(),
                    });
                }
            }
        }
        4 => {
            if argument > remaining_bytes(input, *position) {
                return Err(DecodeError::Truncated {
                    offset: input.len(),
                });
            }
            match usize::try_from(argument) {
                Ok(0) => Item::Complete(Value::Array(Array::new([]))),
                Ok(count) => Item::Container(Frame::Array {
                    items: Vec::with_capacity(count.min(CONTAINER_CAPACITY_BOUND as usize)),
                    remaining: count,
                    start,
                }),
                Err(_) => {
                    return Err(DecodeError::Truncated {
                        offset: input.len(),
                    });
                }
            }
        }
        5 => {
            if argument > remaining_bytes(input, *position) / 2 {
                return Err(DecodeError::Truncated {
                    offset: input.len(),
                });
            }
            match usize::try_from(argument) {
                Ok(0) => Item::Complete(Value::Map(Map::from_sorted(Vec::new()))),
                Ok(count) => Item::Container(Frame::Map {
                    entries: Vec::with_capacity(count.min(CONTAINER_CAPACITY_BOUND as usize)),
                    remaining: count,
                    pending_key: None,
                    previous_key: None,
                    start,
                }),
                Err(_) => {
                    return Err(DecodeError::Truncated {
                        offset: input.len(),
                    });
                }
            }
        }
        6 => Item::Container(Frame::Tag {
            number: argument,
            start,
        }),
        _ => Item::Complete(read_major_seven(additional, argument, start)?),
    };
    Ok(item)
}

/// The values of major type 7: the booleans, null, the simple values, and the
/// floats.
///
/// A two-byte simple value whose second byte is below 0x20 is not well-formed
/// (RFC 8949 §3.3), the one-byte form being the only spelling of those values.
fn read_major_seven(additional: u8, argument: u64, start: usize) -> Result<Value, DecodeError> {
    match additional {
        20 => Ok(Value::Bool(false)),
        21 => Ok(Value::Bool(true)),
        22 => Ok(Value::Null),
        0..=19 | 23 => Simple::new(additional)
            .map(Value::Simple)
            .map_err(|_| DecodeError::IllFormed { offset: start }),
        24 => {
            if argument < 32 {
                return Err(DecodeError::IllFormed { offset: start });
            }
            Simple::new(argument as u8)
                .map(Value::Simple)
                .map_err(|_| DecodeError::IllFormed { offset: start })
        }
        _ => {
            let width = match additional {
                25 => FloatWidth::Half,
                26 => FloatWidth::Single,
                _ => FloatWidth::Double,
            };
            let canonical = Float::from_f64(bits_to_f64(width, argument))
                .map_err(|_| DecodeError::NonShortestFloat { offset: start })?;
            if canonical.width() != width || canonical.bits() != argument {
                return Err(DecodeError::NonShortestFloat { offset: start });
            }
            Ok(Value::Float(canonical))
        }
    }
}

/// A head, read and checked. The envelope's prefix path reads heads
/// without decoding the items under them, which is what keeps it inside
/// its bound over a map of any size.
pub(crate) struct Head {
    pub(crate) major: u8,
    pub(crate) additional: u8,
    pub(crate) argument: u64,
}

/// How many bytes the head beginning with this initial byte occupies. The
/// forms no well-formed encoding produces are one byte, since reading that
/// byte is what refuses them.
pub(crate) const fn head_span(initial: u8) -> usize {
    match initial & 0x1f {
        24 => 2,
        25 => 3,
        26 => 5,
        27 => 9,
        _ => 1,
    }
}

/// One head, read and checked against preferred serialization.
///
/// Additional information 31 is the indefinite-length marker for major types
/// 2 through 5 and the break stop code under major type 7; major types 0, 1,
/// and 6 have no indefinite form, and no definite-length item admits the
/// break, so both of those are ill-formed rather than indefinite.
///
/// Preferred serialization governs the arguments of major types 0 through 6
/// only: major type 7's additional information is not an argument magnitude,
/// and §3.3 rules it instead.
pub(crate) fn read_head(input: &[u8], position: &mut usize) -> Result<Head, DecodeError> {
    let start = *position;
    let &initial = input.get(start).ok_or(DecodeError::Truncated {
        offset: input.len(),
    })?;
    let major = initial >> 5;
    let additional = initial & 0x1f;
    *position = start + 1;

    let argument = match additional {
        0..=23 => u64::from(additional),
        24 => u64::from(read_payload(input, position, 1)?[0]),
        25 => read_argument::<2>(input, position)?,
        26 => read_argument::<4>(input, position)?,
        27 => read_argument::<8>(input, position)?,
        28..=30 => return Err(DecodeError::IllFormed { offset: start }),
        _ => {
            return Err(if (2..=5).contains(&major) {
                DecodeError::IndefiniteLength { offset: start }
            } else {
                DecodeError::IllFormed { offset: start }
            });
        }
    };

    if major != 7 && additional >= 24 && initial_byte(0, argument) & 0x1f != additional {
        return Err(DecodeError::NonPreferredHead { offset: start });
    }

    Ok(Head {
        major,
        additional,
        argument,
    })
}

fn read_argument<const N: usize>(input: &[u8], position: &mut usize) -> Result<u64, DecodeError> {
    let bytes = read_payload(input, position, N as u64)?;
    let mut buffer = [0u8; 8];
    buffer[8 - N..].copy_from_slice(bytes);
    Ok(u64::from_be_bytes(buffer))
}

fn read_payload<'a>(
    input: &'a [u8],
    position: &mut usize,
    len: u64,
) -> Result<&'a [u8], DecodeError> {
    if len > remaining_bytes(input, *position) {
        return Err(DecodeError::Truncated {
            offset: input.len(),
        });
    }
    let start = *position;
    let end = start + len as usize;
    *position = end;
    Ok(&input[start..end])
}

fn remaining_bytes(input: &[u8], position: usize) -> u64 {
    (input.len() - position) as u64
}
