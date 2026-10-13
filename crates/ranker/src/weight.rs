//! ´mod:module:weight´
//!
//! The per-edge primitive: L1's damped edge weight, adopted wholesale as the
//! feed's only per-edge magnitude (feed-ranking.md §3.1, from
//! layer1-interface.md §8.5–§8.7):
//!
//! ```text
//! w̃(e) = |det Ψ_e^[P]|^(1/2) · √(1 + τ_e²) · e^(−β·H_τ(e))
//!          coherence            maturity      boundary
//!
//! Ψ^[P] = [ ã00·ψ±(p_i·p_d)     ã01·ψ±(p_i·|p_d|)   ]
//!         [ ã10·ψ±(|p_i|·p_d)   ã11·ψ+(|p_i|·|p_d|) ]
//!
//! ã_gh  = a_gh + (1 − a_gh)·η          Full and Marginal tiers
//!       = 1 at (1,1), √η elsewhere     Half tier
//! ψ±(x) = σ(β|x|)·tanh(x),  ψ+(x) = σ(βx),  σ(x) = 1/(1 + e^−x)
//! β = 2 ln 2,  η = 0.05
//! H_τ = −τ ln τ − (1 − τ) ln(1 − τ),  H_τ(0) = 0
//! ```
//!
//! The mask and tier are the census row's for the leg — family properties,
//! never per-edge choices (edges.md "Domain, mask, and tier are family
//! properties"), so they are looked up and never read off the wire.
//!
//! Every transcendental is libm's (ranker-core D-a). `sqrt` is IEEE-exact
//! and stays std's. The arithmetic is evaluated in the order written above,
//! left to right, so the bits are a function of the inputs alone; the golden
//! vectors pin them.

use common::l1::census::{LegSpec, Tier};

use crate::census::{Family, LegRole};
use crate::error::RankError;

/// η, the routing-tier softening constant (layer1-interface.md §8.7).
pub const ETA: f64 = 0.05;

/// β = 2 ln 2 (layer1-interface.md §8.5). Doubling is exact in binary, so
/// this is the correctly rounded `ln 4` with no transcendental evaluated.
pub const BETA: f64 = 2.0 * std::f64::consts::LN_2;

/// The 2 × 2 path-view matrix `Ψ_e^[P]` of one leg (layer1-interface.md
/// §8.7), row-major: rows are the intensity mode, columns the directional
/// mode.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PathView {
    pub m00: f64,
    pub m01: f64,
    pub m10: f64,
    pub m11: f64,
}

impl PathView {
    /// `det Ψ^[P] = m00·m11 − m01·m10`.
    pub fn determinant(&self) -> f64 {
        self.m00 * self.m11 - self.m01 * self.m10
    }

    /// `|det Ψ^[P]|^(1/2)` — the coherence factor, the quantity L1's
    /// per-tier calibration bands describe.
    pub fn coherence(&self) -> f64 {
        self.determinant().abs().sqrt()
    }

    /// `ε(e) = sgn(det Ψ^[P])` — L1's coherence bit. Ranking never reads it
    /// (feed-ranking.md §5.2 reads the stance signs instead); it is exposed
    /// because it validates the matrix build against the Quadrant Law.
    /// Zero when the determinant is.
    pub fn parity(&self) -> i32 {
        let det = self.determinant();
        if det > 0.0 {
            1
        } else if det < 0.0 {
            -1
        } else {
            0
        }
    }
}

/// `σ(x) = 1/(1 + e^−x)`.
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + libm::exp(-x))
}

/// `ψ±(x) = σ(β|x|)·tanh(x)` — signed, in `(−1, 1)`, odd.
fn psi_signed(x: f64) -> f64 {
    sigmoid(BETA * x.abs()) * libm::tanh(x)
}

/// `ψ+(x) = σ(βx)` — in `(0.5, 1)` over the non-negative arguments it gets.
fn psi_plus(x: f64) -> f64 {
    sigmoid(BETA * x)
}

/// `ã_gh` for one cell of the mask.
fn softened(tier: Tier, mask_bit: bool, polarization_corner: bool) -> f64 {
    match tier {
        Tier::Full | Tier::Marginal => {
            if mask_bit {
                1.0
            } else {
                ETA
            }
        }
        Tier::Half => {
            if polarization_corner {
                1.0
            } else {
                ETA.sqrt()
            }
        }
    }
}

fn census_row(family: Family, role: LegRole) -> Result<LegSpec, RankError> {
    family
        .leg(role)
        .ok_or_else(|| RankError::no_such_leg(family, role))
}

fn check_parameter(field: &str, value: f64) -> Result<(), RankError> {
    if (-1.0..=1.0).contains(&value) {
        Ok(())
    } else {
        Err(RankError::malformed(format!(
            "{field} = {value} lies outside [-1, 1]"
        )))
    }
}

/// `Ψ_e^[P]` for a leg of `family` in `role` carrying `(p_d, p_i)`, with the
/// census row's mask and tier.
pub fn path_view(family: Family, role: LegRole, p_d: f64, p_i: f64) -> Result<PathView, RankError> {
    let spec = census_row(family, role)?;
    check_parameter("p_d", p_d)?;
    check_parameter("p_i", p_i)?;
    let [a00, a01, a10, a11] = spec.mask;
    Ok(PathView {
        m00: softened(spec.tier, a00, false) * psi_signed(p_i * p_d),
        m01: softened(spec.tier, a01, false) * psi_signed(p_i * p_d.abs()),
        m10: softened(spec.tier, a10, false) * psi_signed(p_i.abs() * p_d),
        m11: softened(spec.tier, a11, true) * psi_plus(p_i.abs() * p_d.abs()),
    })
}

/// `x·ln x`, continued by its limit `0` at `x = 0`.
fn x_ln_x(x: f64) -> f64 {
    if x == 0.0 { 0.0 } else { x * libm::log(x) }
}

/// The temporal entropy `H_τ = −τ ln τ − (1 − τ) ln(1 − τ)`, `0` at `τ = 0`
/// (layer1-interface.md §8.3). Also `0` at `τ = 1` by the same limit, though
/// no finite graph reaches it.
///
/// Written as a difference from `+0` rather than a negation, so the two
/// limit points answer `+0` and not `−0`; between them the two forms are the
/// same bits, `0 − a` being exactly `−a`.
pub fn temporal_entropy(tau: f64) -> f64 {
    0.0 - x_ln_x(tau) - x_ln_x(1.0 - tau)
}

/// The maturity gain `g(τ) = √(1 + τ²)·e^(−β·H_τ)` — the factor `w̃` carries
/// beyond coherence. It exceeds `1` exactly past the crossover
/// `τ* ≈ 0.94` (layer1-interface.md §8.7).
pub fn maturity_gain(tau: f64) -> f64 {
    (1.0 + tau * tau).sqrt() * libm::exp(-BETA * temporal_entropy(tau))
}

/// The damped edge weight `w̃(e)` of a leg of `family` in `role` carrying the
/// (folded) parameters `(p_d, p_i)` at maturity `tau`.
///
/// Zero is inert: if either parameter is zero the weight is exactly `0` and
/// the leg carries no path (feed-ranking.md §3.1). Floating point adds one
/// boundary the algebra does not have: a pair whose product underflows
/// (`|p_d·p_i|` below about `5e-324`) folds its bilinear block to zero and
/// weighs `0` as well — a regime no authoring surface reaches.
///
/// Refuses a family/role pair the census lacks, a parameter outside
/// `[-1, 1]` (NaN included), and a maturity outside `[0, 1]`.
pub fn damped_weight(
    family: Family,
    role: LegRole,
    p_d: f64,
    p_i: f64,
    tau: f64,
) -> Result<f64, RankError> {
    let view = path_view(family, role, p_d, p_i)?;
    if !(0.0..=1.0).contains(&tau) {
        return Err(RankError::malformed(format!(
            "maturity τ = {tau} lies outside [0, 1]"
        )));
    }
    if p_d == 0.0 || p_i == 0.0 {
        return Ok(0.0);
    }
    Ok(view.coherence() * (1.0 + tau * tau).sqrt() * libm::exp(-BETA * temporal_entropy(tau)))
}
