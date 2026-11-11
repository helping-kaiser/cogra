//! ´mod:module:wall´
//!
//! The price: the canonical interim wall controller and the deployment
//! declaration it runs under (layer1-interface.md §11.8: "Wall
//! controller", "Canonical interim wall controller", "Structural wall
//! floor").
//!
//! θ is not configured. Every close charges the wall in force — the wall the
//! previous close delivered, or the declared initialization before the
//! first controller step — and runs one controller step, whose delivered
//! wall the next epoch charges (one-boundary lead). The step is a pure
//! function of the wall in force, the completed epoch's width and its
//! accepted rung, so it is tested here without a database.
//!
//! # Exact arithmetic on a declared grid
//!
//! Every reduced-axis value is an exact [`Ratio`]. The charged value lives
//! on a grid the deployment declares (§11.8: "its representation (exact, or
//! on a grid the deployment declares) … are the deployment's"): walls are
//! multiples of 1/[`WALL_GRID`] on the reduced axis, which at ν = 0.10 is
//! the integer micro-unit grid of θ, so every debit is an integer. Two
//! values are not on the grid by nature, and each is placed by the rule
//! that keeps the premises:
//!
//! - **q(1) is irrational.** It is published as the least grid wall at or
//!   above it, [`REFERENCE_WALL`] — rounded up, because q(W) is the least
//!   wall at which the chartered rung's certificate passes and a wall below
//!   it fails that certificate. The derivation is beside the constant.
//! - **The delivered wall** is the controller's exact output rounded onto
//!   the grid toward the wall in force. That only shortens the step, so X3
//!   (the step bound) still holds, and a downward step rounds up, so it
//!   cannot cross the proposal and with it the floor (X8).
//!
//! The floor itself, 3/37, is published exactly and compared exactly: for a
//! grid wall n/100_000, X8 is the integer test 37·n ≥ 3·100_000, which at
//! ν = 0.10 is 37·θ_µ ≥ 3·ν_µ.
//!
//! # The Standing simplification fixes two inputs
//!
//! The stand-in runs no standing solve (crate root), so it has no measured
//! contributing width and no tilt grid to back off on. The width input is
//! the constant 1 and the accepted rung the anchor 0, both declared below.
//! At width 1 the proposal is the reference wall, and a wall initialized
//! there is held by the deadband: θ sits at the reference at every close.
//! q(W) is implemented for W = 1 and for W = 0 (which needs no inverse —
//! it is the floor); any other width is refused with
//! [`WallError::UnsupportedWidth`], so a measured width arriving later
//! cannot silently borrow the W = 1 value.

use common::l1::handshake::{MarkerPolicy, Ratio};

/// Walls are published as multiples of 1/`WALL_GRID` on the reduced axis.
pub const WALL_GRID: i64 = 100_000;

/// A ratio from constant parts. Evaluated at compile time: a zero
/// denominator fails the build, never a run.
const fn ratio(numerator: i64, denominator: i64) -> Ratio {
    match Ratio::new(numerator, denominator) {
        Some(r) => r,
        None => panic!("a declared constant must be a ratio"),
    }
}

/// The reference wall q(1) on the grid: 50_186/100_000.
///
/// Derivation (layer1-interface.md §11.8, and its spec source: the
/// Canonical Interim Wall Controller of the epoch chapter, the Tilt Gain
/// Coordinates of the dynamics appendix):
/// q(1) = G⁻¹(1/(2·m_θ·S_char·1)) = G⁻¹(16/75), with G = λ_vch the deployed
/// reduced-standing gain, λ_vch(x) = d/dx log g_vch(x) = (1 − p)²·γ·K(p),
/// p = x/(1 + x), γ = 1/4, K(p) = d/dp log Q(p),
/// Q(p) = σ(βp)·√(tanh p·(1 − η² tanh p)), β = 2 ln 2, η = 1/20. G is
/// strictly decreasing on [3/37, 5]; its root at 16/75, recomputed by
/// bisection in double precision (2026-11-10), is
/// **q(1) = 0.5018548515** (registry `const.epoch.safefloor.num`
/// 0.501855). So θ = ν·q(1) = 50_185.485 µ, between grid points; the
/// certificate fails at 50_185 (G − 16/75 = +2.6·10⁻⁶) and passes at
/// 50_186 (−2.8·10⁻⁶), the least passing grid wall.
pub const REFERENCE_WALL: Ratio = ratio(50_186, WALL_GRID);

/// θ at the reference, in micro-units: the burn image ν·[`REFERENCE_WALL`].
pub const REFERENCE_THETA_MICRO: i64 = 50_186;

/// The constant and formula edition Γ of the controller, with its reduced
/// constants (layer1-interface.md §6, §11.8).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Controller {
    pub edition: &'static str,
    /// a — absolute reduced step (registry `const.epoch.step_abs`, 0.10).
    pub step_abs: Ratio,
    /// r — relative step, a fraction of the wall in force
    /// (`const.epoch.step_rel`, 1/4).
    pub step_rel: Ratio,
    /// d — relative deadband, applied to the floored proposal before the
    /// step cap (`const.epoch.deadband`, 1/20).
    pub deadband: Ratio,
    /// m_θ — the chartered margin factor (`const.epoch.margin`, 5/4).
    pub margin: Ratio,
    /// S_char — the chartered rung's cumulative tilt at the deepest
    /// supported depth (15/8, layer1-interface.md §6 ρ_θ row).
    pub cumulative_tilt: Ratio,
}

/// The deployment's fixed public declaration: what layer1-interface.md
/// §11.8 and §13.1 (the wall-calibration condition) have the deployment
/// publish once, beside ν and before its first epoch, rather than per
/// package — and the constants the stand-in's two simplifications fix.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Declaration {
    /// ν = 0.10 burn units per action-credit, in micro-units
    /// (`const.comparator.numeraire`).
    pub numeraire_micro: i64,
    /// ρ_θ,min — the structural floor, the rational 3/37
    /// (`const.epoch.wall_floor_rational`): the representation is exact
    /// rational, which is the selection criterion's case for 3/37
    /// (§11.8, "The selection criterion").
    pub floor: Ratio,
    /// The grid walls are published on (1/`wall_grid` of the reduced axis).
    pub wall_grid: i64,
    pub controller: Controller,
    /// The wall this controller edition starts from: in force at the
    /// deployment's first close, and at the first close after a database
    /// whose earlier epochs ran no controller is migrated — those epochs
    /// keep the debit vintage they were charged.
    pub initialization: Ratio,
    /// The Standing simplification's width input W_loc (constant 1).
    pub width: Ratio,
    /// The Standing simplification's accepted rung t_k (the anchor 0).
    pub accepted_rung: Ratio,
    /// The marker policy: the epoch close itself, edition 1.
    pub marker_identity: &'static str,
    pub marker_edition: i32,
    /// The declared payload encoding M_payload is stated in
    /// (layer1-interface.md §8.4): the identity over the
    /// proposal's payload bytes, which already are the encoded envelope, so
    /// the bound counts those bytes as they arrive.
    pub payload_encoding: &'static str,
    /// The boundary triple's minimum duration, in seconds (§5 host contract
    /// (vi)): 0, because the stand-in closes only on its clock and never
    /// early on a filled target. The triple's other two members, the
    /// target and the clock, are operating values of the stand-in's
    /// config (`StandInConfig::boundary`), published with every package.
    pub min_epoch_duration_secs: i64,
}

impl Declaration {
    pub fn marker(&self) -> MarkerPolicy {
        MarkerPolicy {
            identity: self.marker_identity.to_string(),
            edition: self.marker_edition,
        }
    }

    /// θ = ν·ρ, the burn image of a wall, in micro-units. A wall whose
    /// image is not an integer is off the declared grid — a host fault.
    pub fn burn_image(&self, wall: Ratio) -> Result<i64, WallError> {
        let image = wall
            .checked_mul(Ratio::integer(self.numeraire_micro))
            .ok_or(WallError::Overflow)?;
        if image.denominator() != 1 {
            return Err(WallError::OffGrid(wall));
        }
        Ok(image.numerator())
    }

    /// X8: the wall is at or above the declared floor, compared against
    /// its exact defining object.
    pub fn clears_floor(&self, wall: Ratio) -> bool {
        wall >= self.floor
    }

    /// q(W): the floor at zero width, the reference wall at width 1, and a
    /// refusal for any width the Standing simplification never produces.
    pub fn proposal(&self, width: Ratio) -> Result<Ratio, WallError> {
        if width == Ratio::ZERO {
            Ok(self.floor)
        } else if width == Ratio::ONE {
            Ok(self.floor.max(REFERENCE_WALL))
        } else {
            Err(WallError::UnsupportedWidth(width))
        }
    }

    /// C_Γ(ρ, W, t): one controller step from the wall in force, returning
    /// the proposal and the delivered wall. The rung is published but
    /// unused by this interim map.
    pub fn step(&self, wall: Ratio, width: Ratio, _rung: Ratio) -> Result<Step, WallError> {
        let proposal = self.proposal(width)?;
        let delivered = self.step_toward(wall, proposal)?;
        Ok(Step {
            proposal,
            delivered,
        })
    }

    /// The floor, the deadband and the step cap toward a proposal, in that
    /// order, then the grid rounding toward the wall in force. The wall in
    /// force must be a grid wall at or above the floor — the controller's
    /// domain.
    pub fn step_toward(&self, wall: Ratio, proposal: Ratio) -> Result<Ratio, WallError> {
        if !self.clears_floor(wall) {
            return Err(WallError::BelowFloor(wall));
        }
        if !self.on_grid(wall) {
            return Err(WallError::OffGrid(wall));
        }
        let proposal = proposal.max(self.floor);
        let c = &self.controller;
        let e = proposal.checked_sub(wall).ok_or(WallError::Overflow)?;
        let magnitude = e.checked_abs().ok_or(WallError::Overflow)?;
        let band = c.deadband.checked_mul(wall).ok_or(WallError::Overflow)?;
        if magnitude <= band {
            return Ok(wall);
        }
        let cap = c.step_rel.checked_mul(wall).ok_or(WallError::Overflow)?;
        let step = magnitude.min(c.step_abs).min(cap);
        let exact = if e.signum() > 0 {
            wall.checked_add(step)
        } else {
            wall.checked_sub(step)
        }
        .ok_or(WallError::Overflow)?;
        self.toward(exact, wall)
    }

    fn on_grid(&self, wall: Ratio) -> bool {
        self.wall_grid % wall.denominator() == 0
    }

    /// The grid wall nearest `value` on the side of `wall`.
    fn toward(&self, value: Ratio, wall: Ratio) -> Result<Ratio, WallError> {
        let scaled = value
            .checked_mul(Ratio::integer(self.wall_grid))
            .ok_or(WallError::Overflow)?;
        let (n, d) = (scaled.numerator(), scaled.denominator());
        let units = if value < wall {
            n.div_euclid(d) + i64::from(n.rem_euclid(d) != 0)
        } else {
            n.div_euclid(d)
        };
        Ratio::new(units, self.wall_grid).ok_or(WallError::Overflow)
    }
}

/// The two published outputs of one controller step.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Step {
    pub proposal: Ratio,
    pub delivered: Ratio,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum WallError {
    #[error(
        "width {0} is not one the stand-in can propose for: q(W) is implemented at W = 0 and W = 1"
    )]
    UnsupportedWidth(Ratio),
    #[error("wall {0} is below the declared floor")]
    BelowFloor(Ratio),
    #[error("wall {0} is off the declared grid")]
    OffGrid(Ratio),
    #[error("wall arithmetic left the representable range")]
    Overflow,
}

/// The stand-in's deployment declaration.
pub const DECLARATION: Declaration = Declaration {
    numeraire_micro: 100_000,
    floor: ratio(3, 37),
    wall_grid: WALL_GRID,
    controller: Controller {
        edition: "canonical interim wall controller, edition 1",
        step_abs: ratio(1, 10),
        step_rel: ratio(1, 4),
        deadband: ratio(1, 20),
        margin: ratio(5, 4),
        cumulative_tilt: ratio(15, 8),
    },
    initialization: REFERENCE_WALL,
    width: Ratio::ONE,
    accepted_rung: Ratio::ZERO,
    marker_identity: "stand-in: the epoch close",
    marker_edition: 1,
    payload_encoding: "identity over the proposal's payload bytes",
    min_epoch_duration_secs: 0,
};

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const D: Declaration = DECLARATION;

    fn grid(units: i64) -> Ratio {
        ratio_of(units, WALL_GRID)
    }

    fn ratio_of(n: i64, d: i64) -> Ratio {
        Ratio::new(n, d).expect("ratio")
    }

    /// The declared constants are the registry's: ν = 0.10, the floor 3/37,
    /// a = 0.10, r = 1/4, d = 1/20, m_θ = 5/4, S_char = 15/8; the reference
    /// wall's burn image is the reference θ; and q(1)'s defining target
    /// 1/(2·m_θ·S_char) is 16/75.
    ///
    /// The deployment declares the registry's controller constants and the floor 3/37.
    /// ´claim:wall:the-declaration-carries-the-registry-constants´
    #[test]
    fn the_declaration_carries_the_registry_constants() {
        assert_eq!(D.numeraire_micro, 100_000);
        assert_eq!(D.floor, ratio_of(3, 37));
        assert_eq!(D.controller.step_abs, ratio_of(1, 10));
        assert_eq!(D.controller.step_rel, ratio_of(1, 4));
        assert_eq!(D.controller.deadband, ratio_of(1, 20));
        assert_eq!(D.controller.margin, ratio_of(5, 4));
        assert_eq!(D.controller.cumulative_tilt, ratio_of(15, 8));
        let fence = Ratio::integer(2)
            .checked_mul(D.controller.margin)
            .and_then(|m| m.checked_mul(D.controller.cumulative_tilt))
            .expect("exact");
        assert_eq!(
            ratio_of(fence.denominator(), fence.numerator()),
            ratio_of(16, 75)
        );
        assert_eq!(D.burn_image(REFERENCE_WALL), Ok(REFERENCE_THETA_MICRO));
        assert_eq!(D.initialization, REFERENCE_WALL);
        assert_eq!((D.width, D.accepted_rung), (Ratio::ONE, Ratio::ZERO));
    }

    /// X8 against 3/37 is the integer test 37·θ_µ ≥ 3·ν_µ: the grid wall
    /// 8_109 µ clears the floor and 8_108 µ does not, and a burn image off
    /// the micro-unit grid is refused rather than rounded.
    ///
    /// The floor is compared exactly: 37·θ_µ ≥ 3·ν_µ.
    /// ´claim:wall:the-floor-is-compared-exactly´
    #[test]
    fn the_floor_is_compared_exactly() {
        for units in [8_100, 8_108, 8_109, 8_120, 50_186] {
            assert_eq!(
                D.clears_floor(grid(units)),
                37 * units >= 3 * D.numeraire_micro,
                "{units} µ"
            );
        }
        assert!(!D.clears_floor(grid(8_108)));
        assert!(D.clears_floor(grid(8_109)));
        assert_eq!(
            D.burn_image(D.floor),
            Err(WallError::OffGrid(D.floor)),
            "3/37 has no integer burn image at ν = 0.10"
        );
    }

    /// q(W) is the floor at zero width and the reference at width 1; any
    /// other width is refused, never answered with the W = 1 value.
    ///
    /// The proposal is the floor at zero width, the reference at width 1, and refused otherwise.
    /// ´claim:wall:the-proposal-is-defined-at-zero-and-unit-width-only´
    #[test]
    fn the_proposal_is_defined_at_zero_and_unit_width_only() {
        assert_eq!(D.proposal(Ratio::ZERO), Ok(D.floor));
        assert_eq!(D.proposal(Ratio::ONE), Ok(REFERENCE_WALL));
        for width in [ratio_of(1, 2), Ratio::integer(2), ratio_of(99_999, 100_000)] {
            assert_eq!(D.proposal(width), Err(WallError::UnsupportedWidth(width)));
            assert!(D.step(REFERENCE_WALL, width, Ratio::ZERO).is_err());
        }
    }

    /// The dev deployment's historical wall 0.5281 is within the deadband
    /// of the reference (|0.50186 − 0.5281| = 0.02624 ≤ 0.05·0.5281), so
    /// the controller run from it would hold the old price forever — the
    /// reason the deployment is re-initialized at the reference instead.
    /// From the reference at zero width the wall steps down by a = 0.10,
    /// the binding cap (r·ρ = 0.125), to 0.40186.
    ///
    /// The deadband holds a wall within d·ρ of its proposal, and a wider gap moves it by the step cap.
    /// ´claim:wall:the-deadband-holds-and-the-cap-bounds-the-step´
    #[test]
    fn the_deadband_holds_and_the_cap_bounds_the_step() {
        let historical = grid(52_810);
        assert_eq!(
            D.step(historical, Ratio::ONE, Ratio::ZERO),
            Ok(Step {
                proposal: REFERENCE_WALL,
                delivered: historical
            })
        );
        assert_eq!(
            D.step(REFERENCE_WALL, Ratio::ZERO, Ratio::ZERO),
            Ok(Step {
                proposal: D.floor,
                delivered: grid(40_186)
            })
        );
        assert_eq!(
            D.step_toward(grid(20_000), D.floor),
            Ok(grid(15_000)),
            "r·ρ = 0.05 binds below a = 0.10"
        );
        assert_eq!(
            D.step_toward(grid(9_000), D.floor),
            Ok(grid(8_109)),
            "the floor is reached, rounded up onto the grid"
        );
        assert_eq!(
            D.step_toward(grid(8_109), D.floor),
            Ok(grid(8_109)),
            "within the deadband of the floor"
        );
        assert_eq!(
            D.step_toward(grid(8_108), D.floor),
            Err(WallError::BelowFloor(grid(8_108)))
        );
        assert_eq!(
            D.step_toward(ratio_of(1, 3), D.floor),
            Err(WallError::OffGrid(ratio_of(1, 3)))
        );
    }

    /// A wall initialized at q(1) stays put at width 1, close after close:
    /// θ sits at the reference.
    ///
    /// At width 1 a wall initialized at the reference never moves.
    /// ´claim:wall:the-reference-wall-is-a-fixed-point-at-unit-width´
    #[test]
    fn the_reference_wall_is_a_fixed_point_at_unit_width() {
        let mut wall = D.initialization;
        for _ in 0..1_000 {
            let step = D
                .step(wall, D.width, D.accepted_rung)
                .expect("a controller step");
            assert_eq!(step.proposal, wall);
            wall = step.delivered;
        }
        assert_eq!(wall, REFERENCE_WALL);
        assert_eq!(D.burn_image(wall), Ok(REFERENCE_THETA_MICRO));
    }

    fn floored_proposal() -> impl Strategy<Value = Ratio> {
        (1i64..=2_000_000, 1i64..=1_000)
            .prop_map(|(n, d)| ratio_of(n, d * 1_000).max(DECLARATION.floor))
    }

    fn grid_wall() -> impl Strategy<Value = Ratio> {
        (8_109i64..=2_000_000).prop_map(grid)
    }

    proptest! {
        /// Over arbitrary grid walls and floored proposals, the delivered
        /// wall is on the grid, never below the floor (X8), never moves by
        /// more than min(a, r·ρ) (X3), holds inside the deadband (X4),
        /// moves toward the proposal without passing it outside it, and
        /// holds where the proposal is the wall (sgn(0) = 0).
        #[test]
        fn the_step_keeps_its_premises(wall in grid_wall(), proposal in floored_proposal()) {
            let c = &DECLARATION.controller;
            let delivered = DECLARATION.step_toward(wall, proposal).expect("a step");
            prop_assert!(DECLARATION.burn_image(delivered).is_ok(), "on the grid");
            prop_assert!(DECLARATION.clears_floor(delivered));
            let moved = delivered.checked_sub(wall).expect("exact");
            let cap = c.step_abs.min(c.step_rel.checked_mul(wall).expect("exact"));
            prop_assert!(moved.checked_abs().expect("exact") <= cap);
            let gap = proposal.checked_sub(wall).expect("exact");
            let band = c.deadband.checked_mul(wall).expect("exact");
            if gap.checked_abs().expect("exact") <= band {
                prop_assert_eq!(delivered, wall);
            } else {
                prop_assert!(moved.signum() * gap.signum() >= 0, "toward the proposal");
                prop_assert!(moved.checked_abs() <= gap.checked_abs(), "never past it");
            }
            prop_assert_eq!(DECLARATION.step_toward(wall, wall), Ok(wall));
        }

        /// At zero width the proposal is the floor whatever the wall, and
        /// the delivered wall still obeys the step cap and the floor.
        #[test]
        fn zero_width_proposes_the_floor(wall in grid_wall()) {
            let step = DECLARATION.step(wall, Ratio::ZERO, Ratio::ZERO).expect("a step");
            prop_assert_eq!(step.proposal, DECLARATION.floor);
            prop_assert!(step.delivered <= wall);
            prop_assert!(DECLARATION.clears_floor(step.delivered));
        }
    }
}
