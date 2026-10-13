//! ´mod:module:recency´
//!
//! The recency factor on a path's terminal stance record (feed-ranking.md
//! §5.3):
//!
//! ```text
//! f(Δt) = 0.5^(Δt / half-life)        (the genesis shape)
//! ```
//!
//! `Δt` is epoch age — the count of epoch certificates issued since the
//! record's first inclusion, `0` for a record newer than the newest
//! certificate — and the half-life is counted in epochs. A half-life of `0`
//! disables recency, `f ≡ 1` (miner-api.md "Inputs").
//!
//! One closed form, pinned by the golden vectors: `0.5^x` is evaluated as
//! `2^−x` through libm's `exp2` (ranker-core D-a), never as a `powf`.

/// The governed functional form of `f(Δt)` (feed-ranking.md §12). The
/// exponential is the genesis default and the only shape defined.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecencyShape {
    Exponential,
}

impl RecencyShape {
    /// The shape a governed parameter value names (`recency_shape`,
    /// network.md "Feed-ranking calibration"), if any.
    pub fn from_parameter(value: &str) -> Option<RecencyShape> {
        match value {
            "exponential" => Some(RecencyShape::Exponential),
            _ => None,
        }
    }
}

/// A record's epoch age at the slice's epoch: the certificates issued since
/// it landed, floored at `0`.
pub fn epoch_age(as_of_epoch: i64, landing_epoch: i64) -> i64 {
    as_of_epoch.saturating_sub(landing_epoch).max(0)
}

/// `f(Δt)` for an epoch age and a half-life in epochs, under the
/// exponential shape. A negative age reads as `0`; a half-life of `0` gives
/// exactly `1`.
pub fn recency_factor(age_epochs: i64, half_life_epochs: u32) -> f64 {
    if half_life_epochs == 0 {
        return 1.0;
    }
    let age = age_epochs.max(0) as f64;
    libm::exp2(-age / f64::from(half_life_epochs))
}
