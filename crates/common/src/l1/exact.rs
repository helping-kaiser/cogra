//! ´mod:module:exact´
//!
//! Exact decimal netting — "netting is exact decimal arithmetic"
//! (edges.md §1).
//!
//! A parameter travels as an IEEE-754 double, but what a user picks is a
//! decimal on the hundredths grid, and a double holds none of `0.1`, `0.2`
//! or `0.3` exactly. Summed in floating point, a bundle lands *near* the sum
//! its author meant, at a place that depends on the order of the additions:
//! `0.1 + 0.2 − 0.3` is `2⁻⁵⁴` in IEEE arithmetic, and still `2⁻⁵⁵` over the
//! doubles' exact binary values. Severance is the sum at exactly `(0, 0)`
//! (feed-ranking.md §8.1), so neither will do — two surfaces summing the same
//! records in different orders would disagree about whether a bundle is
//! severed.
//!
//! # The decimal a double denotes
//!
//! A stored parameter denotes its **shortest round-trip decimal**: the fewest
//! significant digits that parse back to the same double, the closest such
//! when several qualify. It is the number every surface prints for the
//! value, and it is the picked value itself whenever the pick had at most
//! fifteen significant digits — `f64::DIGITS`, "the maximum x such that any
//! decimal number with x significant digits can be converted to f64 and back
//! without loss" — which covers every grid value. An off-grid value authored
//! before the grid was enforced denotes its own shortest decimal and nets
//! exactly as that.
//!
//! The digits come from `ryu`, the Rust implementation of Ryū (Adams, PLDI
//! 2018). PostgreSQL's float8 output is the same algorithm — "the shortest
//! precise decimal representation" for any `extra_float_digits` above 0
//! (PostgreSQL docs, datatype-numeric; sqlx connects at 3) — so `p_d::text`
//! in SQL and [`Decimal::of_f64`] here name one decimal, and a `numeric` sum
//! over the first is the [`Decimal`] sum over the second.
//!
//! # Exactness
//!
//! Sums are exact, and so independent of order. Units live in an `i128`
//! while they fit and move to a `BigInt` when they do not, so no stored value
//! is refused or rounded on the way in. The one rounding is
//! [`Decimal::to_f64`], where a sum leaves for a consumer that reads doubles:
//! correctly rounded, and never to zero from a sum that is not zero — which
//! is what lets every zero test downstream stay a plain `== 0.0`.

use std::cmp::Ordering;
use std::fmt;
use std::ops::{Add, Neg, Sub};
use std::str::FromStr;

use num_bigint::{BigInt, Sign};

/// An exact decimal: `units × 10^(−scale)`. Equality and order are by
/// value, so `0.30` equals `0.3`.
#[derive(Debug, Clone)]
pub struct Decimal {
    units: Units,
    scale: u32,
}

#[derive(Debug, Clone)]
enum Units {
    Small(i128),
    Big(BigInt),
}

/// Text that is not a decimal number — refused rather than guessed at.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("`{0}` is not a decimal number")]
pub struct DecimalError(String);

/// A parameter with no decimal to sum: `NaN` or an infinity. Census
/// formation keeps these off the graph (`Family::params_check`), so meeting
/// one where sums are assembled means the input is corrupt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("a parameter value is not a finite number")]
pub struct NotFinite;

/// The furthest decimal exponent parsed text may carry. A double's shortest
/// decimal reaches `10^−342` at most; this bounds the power of ten hostile
/// text could otherwise make the parser build.
const MAX_EXPONENT: i64 = 10_000;

fn pow10(k: u32) -> BigInt {
    BigInt::from(10u32).pow(k)
}

impl Units {
    fn big(&self) -> BigInt {
        match self {
            Units::Small(u) => BigInt::from(*u),
            Units::Big(b) => b.clone(),
        }
    }

    fn signum(&self) -> Ordering {
        match self {
            Units::Small(u) => u.cmp(&0),
            Units::Big(b) => match b.sign() {
                Sign::Minus => Ordering::Less,
                Sign::NoSign => Ordering::Equal,
                Sign::Plus => Ordering::Greater,
            },
        }
    }

    /// Back to the small form whenever the value fits it.
    fn from_big(b: BigInt) -> Units {
        match i128::try_from(&b) {
            Ok(small) => Units::Small(small),
            Err(_) => Units::Big(b),
        }
    }

    /// `self × 10^k`.
    fn scaled_up(&self, k: u32) -> Units {
        if let Units::Small(u) = self
            && let Some(v) = 10i128.checked_pow(k).and_then(|p| u.checked_mul(p))
        {
            return Units::Small(v);
        }
        Units::Big(self.big() * pow10(k))
    }
}

impl Decimal {
    pub fn zero() -> Self {
        Decimal {
            units: Units::Small(0),
            scale: 0,
        }
    }

    pub fn one() -> Self {
        Decimal {
            units: Units::Small(1),
            scale: 0,
        }
    }

    /// The decimal a double denotes — its shortest round-trip rendering;
    /// `None` for a value with no decimal (`NaN`, an infinity). Both zeros
    /// denote zero.
    pub fn of_f64(x: f64) -> Option<Decimal> {
        if !x.is_finite() {
            return None;
        }
        let mut buffer = ryu::Buffer::new();
        let decimal: Decimal = buffer
            .format_finite(x)
            .parse()
            .expect("ryu renders a finite double as a decimal");
        Some(decimal.normalized())
    }

    pub fn is_zero(&self) -> bool {
        self.units.signum() == Ordering::Equal
    }

    pub fn is_negative(&self) -> bool {
        self.units.signum() == Ordering::Less
    }

    pub fn abs(&self) -> Decimal {
        if self.is_negative() {
            -self
        } else {
            self.clone()
        }
    }

    /// The same value at the smallest scale that holds it: trailing zeros
    /// after the point carry nothing.
    pub fn normalized(&self) -> Decimal {
        let mut scale = self.scale;
        let units = match &self.units {
            Units::Small(u) => {
                let mut u = *u;
                while scale > 0 && u % 10 == 0 {
                    u /= 10;
                    scale -= 1;
                }
                Units::Small(u)
            }
            Units::Big(b) => {
                let ten = BigInt::from(10u32);
                let zero = BigInt::from(0u32);
                let mut b = b.clone();
                while scale > 0 && &b % &ten == zero {
                    b /= &ten;
                    scale -= 1;
                }
                Units::from_big(b)
            }
        };
        Decimal { units, scale }
    }

    /// How many digits after the point the value needs — `0.30` needs two,
    /// `1.0` none.
    pub fn fractional_digits(&self) -> u32 {
        self.normalized().scale
    }

    /// The double nearest this decimal — `str::parse::<f64>` returns "the
    /// closest representable floating-point number" — with one exception:
    /// a non-zero value below the smallest subnormal is carried as that
    /// subnormal, signed, rather than flushed to zero. Severance is the
    /// exact zero, so a sum that is not zero must never read as one.
    pub fn to_f64(&self) -> f64 {
        if self.is_zero() {
            return 0.0;
        }
        let units = match &self.units {
            Units::Small(u) => u.to_string(),
            Units::Big(b) => b.to_string(),
        };
        let x: f64 = format!("{units}e-{}", self.scale)
            .parse()
            .expect("an exact decimal renders as a float literal");
        if x == 0.0 {
            let tiny = f64::from_bits(1);
            return if self.is_negative() { -tiny } else { tiny };
        }
        x
    }

    /// Both values at one scale, as units.
    fn aligned(&self, other: &Decimal) -> (Units, Units, u32) {
        let scale = self.scale.max(other.scale);
        (
            self.units.scaled_up(scale - self.scale),
            other.units.scaled_up(scale - other.scale),
            scale,
        )
    }
}

impl Default for Decimal {
    fn default() -> Self {
        Decimal::zero()
    }
}

/// The exact sum: no step rounds, so any order of additions reaches the
/// same value.
impl Add for &Decimal {
    type Output = Decimal;

    fn add(self, other: Self) -> Decimal {
        let (a, b, scale) = self.aligned(other);
        let units = match (&a, &b) {
            (Units::Small(a), Units::Small(b)) => match a.checked_add(*b) {
                Some(sum) => Units::Small(sum),
                None => Units::from_big(BigInt::from(*a) + BigInt::from(*b)),
            },
            _ => Units::from_big(a.big() + b.big()),
        };
        Decimal { units, scale }
    }
}

impl Neg for &Decimal {
    type Output = Decimal;

    fn neg(self) -> Decimal {
        let units = match &self.units {
            Units::Small(u) => match u.checked_neg() {
                Some(n) => Units::Small(n),
                None => Units::Big(-BigInt::from(*u)),
            },
            Units::Big(b) => Units::from_big(-b.clone()),
        };
        Decimal {
            units,
            scale: self.scale,
        }
    }
}

impl Sub for &Decimal {
    type Output = Decimal;

    fn sub(self, other: Self) -> Decimal {
        self + &-other
    }
}

impl PartialEq for Decimal {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl Eq for Decimal {}

impl PartialOrd for Decimal {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Decimal {
    fn cmp(&self, other: &Self) -> Ordering {
        (self - other).units.signum()
    }
}

impl FromStr for Decimal {
    type Err = DecimalError;

    /// `[+-]digits[.digits][(e|E)[+-]digits]` — what both `ryu` and
    /// PostgreSQL's `numeric` output render.
    fn from_str(text: &str) -> Result<Self, Self::Err> {
        let refuse = || DecimalError(text.to_string());
        let (negative, rest) = match text.as_bytes().first() {
            Some(b'-') => (true, &text[1..]),
            Some(b'+') => (false, &text[1..]),
            _ => (false, text),
        };
        let (mantissa, exponent) = match rest.find(['e', 'E']) {
            Some(at) => (
                &rest[..at],
                rest[at + 1..].parse::<i64>().map_err(|_| refuse())?,
            ),
            None => (rest, 0),
        };
        let (whole, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
        let all_digits = whole
            .bytes()
            .chain(fraction.bytes())
            .all(|c| c.is_ascii_digit());
        if (whole.is_empty() && fraction.is_empty()) || !all_digits || exponent.abs() > MAX_EXPONENT
        {
            return Err(refuse());
        }
        let digits = format!("{whole}{fraction}");
        let digits = match digits.trim_start_matches('0') {
            "" => "0",
            significant => significant,
        };
        let magnitude = match digits.parse::<i128>() {
            Ok(u) => Units::Small(u),
            Err(_) => Units::Big(digits.parse::<BigInt>().map_err(|_| refuse())?),
        };
        // value = digits × 10^(exponent − |fraction|)
        let shift = exponent - fraction.len() as i64;
        let decimal = if shift <= 0 {
            Decimal {
                units: magnitude,
                scale: u32::try_from(-shift).map_err(|_| refuse())?,
            }
        } else {
            Decimal {
                units: magnitude.scaled_up(u32::try_from(shift).map_err(|_| refuse())?),
                scale: 0,
            }
        };
        Ok(if negative { -&decimal } else { decimal })
    }
}

impl fmt::Display for Decimal {
    /// Plain notation, every digit the scale carries.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let magnitude = match &self.units {
            Units::Small(u) => u.unsigned_abs().to_string(),
            Units::Big(b) => b.magnitude().to_string(),
        };
        let scale = self.scale as usize;
        let padded = format!("{magnitude:0>width$}", width = scale + 1);
        let (whole, fraction) = padded.split_at(padded.len() - scale);
        let sign = if self.is_negative() { "-" } else { "" };
        if fraction.is_empty() {
            write!(f, "{sign}{whole}")
        } else {
            write!(f, "{sign}{whole}.{fraction}")
        }
    }
}

/// The exact sum of a set of parameter values — the same number in any
/// order.
pub fn exact_sum<I: IntoIterator<Item = f64>>(values: I) -> Result<Decimal, NotFinite> {
    values.into_iter().try_fold(Decimal::zero(), |sum, x| {
        Decimal::of_f64(x).map(|d| &sum + &d).ok_or(NotFinite)
    })
}

/// `a + b` over the decimals the two doubles denote, rounded once at the
/// end. A non-finite operand has no decimal, so IEEE carries it instead and
/// the clip downstream answers for it, as it always has.
pub fn exact_add(a: f64, b: f64) -> f64 {
    match (Decimal::of_f64(a), Decimal::of_f64(b)) {
        (Some(a), Some(b)) => (&a + &b).to_f64(),
        _ => a + b,
    }
}

/// The hundredths grid user-authored values lie on (edges.md §1): a
/// multiple of `0.01` in `[−1.00, +1.00]`.
///
/// Decided on the decimal the double denotes, never by float comparison: a
/// value is on the grid when its shortest decimal needs at most two digits
/// after the point. That is also the test that the double is the grid
/// point's own — the double nearest `k/100` renders as `k/100`, while
/// `0.30000000000000004`, the double one step above `0.3`, renders as
/// itself and is refused.
pub fn on_hundredths_grid(x: f64) -> bool {
    Decimal::of_f64(x).is_some_and(|d| d.fractional_digits() <= 2 && d.abs() <= Decimal::one())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dec(text: &str) -> Decimal {
        text.parse().expect("a decimal")
    }

    fn of(x: f64) -> Decimal {
        Decimal::of_f64(x).expect("finite")
    }

    /// The known-dirty pattern: IEEE addition leaves `0.1 + 0.2 − 0.3` at
    /// `2⁻⁵⁴`; the decimals the three doubles denote net to zero, in every
    /// order they can be added.
    ///
    /// An exact sum is the same number in every order, and the dirty float pattern nets to zero.
    /// ´claim:exact:an-exact-sum-is-the-same-in-every-order´
    #[test]
    fn the_dirty_float_pattern_nets_to_zero_in_every_order() {
        assert_eq!(0.1 + 0.2 - 0.3, 2f64.powi(-54), "the float sum misses zero");
        for order in [
            [0.1, 0.2, -0.3],
            [0.1, -0.3, 0.2],
            [0.2, 0.1, -0.3],
            [0.2, -0.3, 0.1],
            [-0.3, 0.1, 0.2],
            [-0.3, 0.2, 0.1],
        ] {
            let sum = exact_sum(order).expect("finite");
            assert!(sum.is_zero(), "{order:?} summed to {sum}");
            assert_eq!(sum.to_f64().to_bits(), 0.0f64.to_bits());
        }
        assert!(
            exact_sum([0.1, 0.2, 0.3, -0.6]).expect("finite").is_zero(),
            "a 0.1 + 0.2 + 0.3 bundle walks back by −0.6"
        );
        assert_eq!(exact_add(0.1, 0.2), 0.3, "one rounding, at the end");
    }

    /// A double denotes its shortest round-trip decimal, which for a pick
    /// of at most fifteen significant digits is the pick itself — and an
    /// off-grid value is held to its last digit, never rounded onto a grid.
    ///
    /// A double denotes its shortest decimal, off-grid values held to the last digit.
    /// ´claim:exact:a-double-denotes-its-shortest-decimal´
    #[test]
    fn a_double_denotes_its_shortest_decimal() {
        for (x, text) in [
            (0.1, "0.1"),
            (-0.37, "-0.37"),
            (1.0, "1"),
            (0.0, "0"),
            (-0.0, "0"),
            (0.30000000000000004, "0.30000000000000004"),
            (0.00047147125005719825, "0.00047147125005719825"),
            (1e-7, "0.0000001"),
        ] {
            assert_eq!(of(x).to_string(), text, "{x:?}");
        }
        assert!(Decimal::of_f64(f64::NAN).is_none());
        assert!(Decimal::of_f64(f64::INFINITY).is_none());
        assert_eq!(dec("0.30"), dec("0.3"), "equality is by value");
    }

    /// An off-grid value nets against its own negation exactly, and against
    /// nothing else: one ulp away is still apart.
    ///
    /// An off-grid value nets exactly against its own negation and against nothing else.
    /// ´claim:exact:an-off-grid-value-nets-exactly´
    #[test]
    fn an_off_grid_value_nets_exactly() {
        let x = 0.00047147125005719825;
        assert!(exact_sum([x, 0.1, -x, -0.1]).expect("finite").is_zero());
        let next = f64::from_bits(x.to_bits() + 1);
        let apart = exact_sum([x, -next]).expect("finite");
        assert!(!apart.is_zero());
        assert_ne!(apart.to_f64(), 0.0);
    }

    /// The small form and the wide form are one arithmetic: a sum whose
    /// units outgrow an i128 still nets exactly, and a value below the
    /// smallest subnormal never reads as zero.
    ///
    /// A sum too long for an i128 still nets exactly, and never reads as zero unless it is.
    /// ´claim:exact:a-wide-sum-nets-exactly-and-never-reads-as-zero´
    #[test]
    fn a_wide_sum_nets_exactly_and_never_reads_as_zero() {
        let tiny = f64::from_bits(1); // 5e-324: 324 digits after the point
        let sum = exact_sum([0.3, tiny, 0.7]).expect("finite");
        assert_eq!(sum.to_f64(), 1.0);
        let back = &sum - &of(1.0);
        assert!(!back.is_zero());
        assert_eq!(back.to_f64(), tiny);
        assert!((&back - &of(tiny)).is_zero());

        let below = dec("1e-400");
        assert_eq!(below.to_f64(), tiny, "never flushed to zero");
        assert_eq!((-&below).to_f64(), -tiny);
    }

    /// Text in either renderer's notation parses to the value it names, and
    /// anything else refuses.
    ///
    /// Decimal text in either renderer's notation parses to the value it names, and anything else refuses.
    /// ´claim:exact:decimal-text-parses-to-its-value´
    #[test]
    fn decimal_text_parses_to_its_value() {
        assert_eq!(dec("0.30").to_string(), "0.30");
        assert_eq!(dec("-1.2").to_f64(), -1.2);
        assert_eq!(dec("1e-05").to_string(), "0.00001");
        assert_eq!(dec("2.5E2").to_string(), "250");
        assert!(dec("-0.000").is_zero());
        let long = "123456789012345678901234567890123456789012.5";
        assert_eq!(dec(long).to_string(), long);
        for bad in [
            "", "-", ".", "1.2.3", "abc", "1e", "NaN", "Infinity", "1e99999",
        ] {
            assert!(bad.parse::<Decimal>().is_err(), "`{bad}` must refuse");
        }
    }

    /// Exactly the multiples of 0.01 in [-1, 1] lie on the grid, decided by
    /// decimal rather than by float comparison.
    ///
    /// Exactly the multiples of 0.01 in [-1, 1] lie on the hundredths grid.
    /// ´claim:exact:the-grid-is-the-hundredths-in-the-unit-range´
    #[test]
    fn the_grid_is_the_hundredths_in_the_unit_range() {
        for k in -100..=100 {
            assert!(on_hundredths_grid(f64::from(k) / 100.0), "{k}/100");
        }
        assert!(on_hundredths_grid(-0.0));
        for x in [
            0.30000000000000004,
            0.005,
            0.00047147125005719825,
            0.4372918374625184,
            1.01,
            -1.01,
            f64::NAN,
            f64::INFINITY,
        ] {
            assert!(!on_hundredths_grid(x), "{x:?} is off the grid");
        }
    }
}
