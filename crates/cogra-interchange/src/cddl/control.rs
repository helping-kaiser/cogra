//! Control-operator evaluation: the ten of RFC 8610 §3.8 the version-1
//! evaluator implements (´dec:xchg:evaluable-subset´).
//!
//! A control ties a *target* type to a *controller* type. Every operator
//! here therefore asks two questions and answers yes only to both: does the
//! data item match the target, and does it satisfy the control.
//!
//! The four operators outside the subset — `.cbor`, `.cborseq`, `.within`,
//! and `.and` — never arrive: `Theory::parse` refuses a theory carrying one
//! with `TheoryError::Unevaluable`. The dispatch below asserts that rather
//! than refusing a second time.
//!
//! # Three readings of §3.8, recorded where they are implemented
//!
//! - **`.size` counts bytes**, for text strings as much as for byte
//!   strings: "the size of the target in bytes ... where it directly
//!   controls the number of bytes in the string". A four-character string
//!   of two-byte characters is eight, not four.
//! - **`.size` on an unsigned integer is a range**, not a byte count:
//!   "`uint .size N` is equivalent to `0...BYTES_N`, where
//!   BYTES_N == 256**N". So the control is satisfied where *some* size the
//!   control type admits is wide enough, which is why the implementation
//!   probes upward from the width the value needs.
//! - **`.default` is a `.ne`.** §3.8.6 makes it "a variant of the `.ne`
//!   control", and says of the value it names that "the implied .ne control
//!   is there to prevent this value from being sent over the wire". A
//!   present value equal to the default therefore fails, and an absent
//!   optional member stays absent: nothing here materializes a default into
//!   a document.

use std::cmp::Ordering;

use super::ast::{Name, Operation, Operator, Type2, Type2Kind};
use super::eval::Evaluator;
use super::fragment;
use super::lex::NumberToken;
use crate::error::RegexpError;
use crate::value::Value;

/// The greatest `.size` width that distinguishes one unsigned integer from
/// another.
///
/// Every unsigned integer of the data language fits in eight bytes, so the
/// widths that matter — the ones a value can be too large for — are one
/// through eight. A width of nine or more is wider than any uint can need
/// (`256**9 > 2**64`), so it admits every uint; a control type naming only
/// such widths is satisfied by every uint rather than by none.
const MAX_UINT_SIZE: u64 = 8;

/// A number of the data language or of a CDDL literal, for the comparisons
/// that are defined on numbers.
#[derive(Copy, Clone, Debug)]
pub(crate) enum Num {
    /// An integer, in the range the two integer major types cover.
    Int(i128),
    /// A floating-point value.
    Float(f64),
}

/// Apply one control operator.
///
/// The target must match and the control must be satisfied; neither alone
/// is a match.
///
/// `.default` shares `.ne`'s arm because it *is* `.ne` with an intent the
/// wire cannot carry.
pub(crate) fn apply<'a>(
    evaluator: &mut Evaluator<'a>,
    value: &Value,
    target: &'a Type2,
    name: &Name,
    operation: &'a Operation,
) -> bool {
    if !evaluator.match_type2(value, target) {
        return false;
    }
    let operand = &operation.operand;
    match name.text.as_str() {
        "size" => size(evaluator, value, operand),
        "regexp" => regexp(evaluator, value, operation),
        "bits" => bits(evaluator, value, operand),
        "lt" => ordered(evaluator, value, operand, Ordering::Less, false),
        "le" => ordered(evaluator, value, operand, Ordering::Less, true),
        "gt" => ordered(evaluator, value, operand, Ordering::Greater, false),
        "ge" => ordered(evaluator, value, operand, Ordering::Greater, true),
        "eq" => equals(evaluator, value, operand),
        "ne" | "default" => !equals(evaluator, value, operand),
        other => {
            debug_assert!(
                false,
                "`.{other}` is outside the evaluable subset and refuses at Theory::parse"
            );
            false
        }
    }
}

/// `.size`: the number of bytes of a string, or the range an unsigned
/// integer's width fixes.
///
/// `uint .size N` ≡ `0…256**N` (RFC 8610 §3.8.1), so an unsigned integer
/// conforms at every width at or above the one it needs, and the control type
/// is satisfied where it admits any such width. Widths one through eight are
/// the ones a uint can be too large for, so those are probed; a width of nine
/// or more admits every uint, so a type naming one is satisfied outright.
fn size<'a>(evaluator: &mut Evaluator<'a>, value: &Value, operand: &'a Type2) -> bool {
    match value {
        Value::Text(text) => {
            let bytes = text.as_str().len() as u64;
            evaluator.match_type2(&Value::Unsigned(bytes), operand)
        }
        Value::Bytes(bytes) => {
            let length = bytes.as_slice().len() as u64;
            evaluator.match_type2(&Value::Unsigned(length), operand)
        }
        Value::Unsigned(number) => {
            for probe in needed_bytes(*number)..=MAX_UINT_SIZE {
                if evaluator.match_type2(&Value::Unsigned(probe), operand) {
                    return true;
                }
            }
            admits_oversized_width(evaluator, operand)
        }
        _ => false,
    }
}

/// Whether a `.size` control type admits a width of nine bytes or more,
/// each of which admits every unsigned integer.
///
/// Reached only after the widths one through eight are ruled out, so the
/// type admits no width a uint can fit in exactly; the question left is
/// whether it names a vacuously wide one. A literal width says so directly,
/// and a parenthesized range through its upper bound, an exclusive one not
/// admitting the bound itself. `uint` and the other unbounded width types
/// never arrive here — they admit width eight, which the probe already found.
fn admits_oversized_width<'a>(evaluator: &Evaluator<'a>, operand: &'a Type2) -> bool {
    if let Some(Num::Int(width)) = evaluator.bound(operand) {
        return width > i128::from(MAX_UINT_SIZE);
    }
    let Type2Kind::Parenthesized(inner) = &operand.kind else {
        return false;
    };
    let [choice] = inner.choices.as_slice() else {
        return false;
    };
    let Some(operation) = &choice.operation else {
        return false;
    };
    let inclusive = match operation.operator {
        Operator::RangeInclusive => true,
        Operator::RangeExclusive => false,
        Operator::Control(_) => return false,
    };
    match evaluator.bound(&operation.operand) {
        Some(Num::Int(high)) => high - i128::from(!inclusive as u8) > i128::from(MAX_UINT_SIZE),
        _ => false,
    }
}

/// How many bytes an unsigned integer needs: the least `n` with
/// `value < 256**n`.
fn needed_bytes(value: u64) -> u64 {
    if value == 0 {
        return 0;
    }
    u64::from(64 - value.leading_zeros()).div_ceil(8)
}

/// `.regexp`: the compiled pattern, matched against the whole of a text
/// string.
///
/// The pattern was compiled at `Theory::parse` and is looked up by where
/// its operand stands; nothing here compiles one. A match that exhausts the
/// seam's operation budget is recorded rather than answered, and the
/// evaluator renders it as a mismatch of its own kind.
///
/// An operand that is no text literal compiled to nothing, and no match
/// follows: RFC 8610 §3.8.3 gives `.regexp` a text-string control value, and
/// a theory offering something else has a type error at that position.
fn regexp<'a>(evaluator: &mut Evaluator<'a>, value: &Value, operation: &'a Operation) -> bool {
    let Value::Text(text) = value else {
        return false;
    };
    let Some(pattern) = evaluator.pattern(operation.operand.span.start) else {
        return false;
    };
    match pattern.is_match(text.as_str()) {
        Ok(matched) => matched,
        Err(RegexpError::BudgetExhausted { budget }) => {
            evaluator.exhaust(pattern.source(), budget);
            false
        }
        Err(_) => false,
    }
}

/// `.bits`: every bit set in the target is numbered by the control type.
fn bits<'a>(evaluator: &mut Evaluator<'a>, value: &Value, operand: &'a Type2) -> bool {
    match value {
        Value::Bytes(bytes) => {
            for (index, byte) in bytes.as_slice().iter().enumerate() {
                for bit in 0..8u64 {
                    if byte & (1 << bit) == 0 {
                        continue;
                    }
                    let number = index as u64 * 8 + bit;
                    if !evaluator.match_type2(&Value::Unsigned(number), operand) {
                        return false;
                    }
                }
            }
            true
        }
        Value::Unsigned(number) => {
            for bit in 0..64u64 {
                if number & (1 << bit) == 0 {
                    continue;
                }
                if !evaluator.match_type2(&Value::Unsigned(bit), operand) {
                    return false;
                }
            }
            true
        }
        _ => false,
    }
}

/// `.lt`, `.le`, `.gt`, and `.ge`, "defined only for numeric types, as
/// these have a natural ordering relationship".
fn ordered<'a>(
    evaluator: &mut Evaluator<'a>,
    value: &Value,
    operand: &'a Type2,
    wanted: Ordering,
    or_equal: bool,
) -> bool {
    let (Some(left), Some(right)) = (numeric(value), evaluator.bound(operand)) else {
        return false;
    };
    match compare(left, right) {
        Some(ordering) if ordering == wanted => true,
        Some(Ordering::Equal) => or_equal,
        _ => false,
    }
}

/// `.eq`, and by negation `.ne` and `.default`.
///
/// §3.8.6 fixes equality across the value model: numbers compare
/// numerically, and everything else compares as the structure it is. The
/// second half needs no code of its own — the control type "contains just
/// that single value", so matching it *is* equality to it.
fn equals<'a>(evaluator: &mut Evaluator<'a>, value: &Value, operand: &'a Type2) -> bool {
    if let (Some(left), Some(right)) = (numeric(value), evaluator.bound(operand)) {
        return compare(left, right) == Some(Ordering::Equal);
    }
    evaluator.match_type2(value, operand)
}

/// The number a value carries, where it carries one.
fn numeric(value: &Value) -> Option<Num> {
    match value {
        Value::Unsigned(number) => Some(Num::Int(i128::from(*number))),
        Value::Negative(number) => Some(Num::Int(number.get())),
        Value::Float(float) => Some(Num::Float(float.to_f64())),
        _ => None,
    }
}

/// The integer a value carries, for the integer ranges.
pub(crate) fn integer_of(value: &Value) -> Option<i128> {
    match value {
        Value::Unsigned(number) => Some(i128::from(*number)),
        Value::Negative(number) => Some(number.get()),
        _ => None,
    }
}

/// The number a CDDL literal denotes.
///
/// A hexadecimal floating-point literal — `0x1.8p3`, which the grammar
/// admits — denotes nothing here, and a position typed by one matches no
/// value. It is the one numeric spelling this reader does not read.
pub(crate) fn number_literal(number: &NumberToken) -> Option<Num> {
    if number.is_float {
        return number.text.parse::<f64>().ok().map(Num::Float);
    }
    match number.text.strip_prefix('-') {
        Some(magnitude) => fragment::uint_text(magnitude).map(|n| Num::Int(-i128::from(n))),
        None => fragment::uint_text(&number.text).map(|n| Num::Int(i128::from(n))),
    }
}

/// Compare two numbers, across the integer/floating-point line.
///
/// The one place the crate rounds: an integer beyond 2^53 compared against
/// a float is compared through `f64`, where it may not be exact. Every
/// other comparison is exact, and no comparison of a NaN has an order.
fn compare(left: Num, right: Num) -> Option<Ordering> {
    match (left, right) {
        (Num::Int(left), Num::Int(right)) => Some(left.cmp(&right)),
        (Num::Float(left), Num::Float(right)) => left.partial_cmp(&right),
        (Num::Int(left), Num::Float(right)) => (left as f64).partial_cmp(&right),
        (Num::Float(left), Num::Int(right)) => left.partial_cmp(&(right as f64)),
    }
}
