//! ´mod:module:timing´
//!
//! Per-phase wall clock: what every run reports beside its findings.
//!
//! Every run reports wall time per phase — pre-tokenize, harvest, resolve,
//! judge, render — and the first measured full-corpus run sets the budget
//! recorded beside the CI lane that invokes the linter (´req:lint:timing´),
//! (´[ARCH-req:linter:timing]´). The five phases are fixed there, so
//! [`Phase`] enumerates exactly those five and no run invents a sixth.
//!
//! A phase with no measurement is not a phase that took no time: it is a
//! phase this run did not perform, and [`Timing`] keeps the two apart so a
//! report cannot read as `0` where it means "not run". The check has no
//! render phase until the renderer lands, and its report says so.

use std::fmt;
use std::time::{Duration, Instant};

/// One phase of a run.
///
/// The five are the requirement's own and are not this module's to extend:
/// a measurement outside them is a phase the architecture did not name.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Phase {
    /// The lexical pre-pass, per source.
    Pretokenize,
    /// Pass 1: the walk, the frontends, the scan, and the registries.
    Harvest,
    /// Pass 2: resolution against the completed registries.
    Resolve,
    /// The judgments over the finished graph.
    Judge,
    /// Rendering the findings. Absent from a run that only collects them.
    Render,
}

impl Phase {
    /// The five phases, in the order a run performs them.
    pub const ALL: [Phase; 5] = [
        Phase::Pretokenize,
        Phase::Harvest,
        Phase::Resolve,
        Phase::Judge,
        Phase::Render,
    ];

    /// The phase's name, as a report spells it.
    #[must_use]
    pub const fn token(self) -> &'static str {
        match self {
            Phase::Pretokenize => "pre-tokenize",
            Phase::Harvest => "harvest",
            Phase::Resolve => "resolve",
            Phase::Judge => "judge",
            Phase::Render => "render",
        }
    }

    /// Its position in [`Phase::ALL`].
    const fn slot(self) -> usize {
        match self {
            Phase::Pretokenize => 0,
            Phase::Harvest => 1,
            Phase::Resolve => 2,
            Phase::Judge => 3,
            Phase::Render => 4,
        }
    }
}

/// What one run spent, per phase.
///
/// ```
/// use cogra_linter::timing::{Phase, Timing};
/// use std::time::Duration;
///
/// let mut timing = Timing::new();
/// timing.record(Phase::Harvest, Duration::from_millis(20));
/// timing.record(Phase::Harvest, Duration::from_millis(5));
///
/// assert_eq!(timing.of(Phase::Harvest), Some(Duration::from_millis(25)));
/// assert_eq!(timing.of(Phase::Render), None, "no render phase ran");
/// assert_eq!(timing.total(), Duration::from_millis(25));
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Timing {
    spent: [Option<Duration>; 5],
}

impl Timing {
    /// A report with nothing measured yet.
    #[must_use]
    pub fn new() -> Timing {
        Timing::default()
    }

    /// Add `took` to a phase's total.
    ///
    /// Additive rather than assigning, because a phase need not be one
    /// contiguous stretch: pre-tokenizing happens once per source, inside
    /// the harvest loop, and its total is the sum of those stretches.
    pub fn record(&mut self, phase: Phase, took: Duration) {
        let slot = &mut self.spent[phase.slot()];
        *slot = Some(slot.unwrap_or_default().saturating_add(took));
    }

    /// Run `work`, recording what it took under `phase`.
    ///
    /// ```
    /// use cogra_linter::timing::{Phase, Timing};
    ///
    /// let mut timing = Timing::new();
    /// let answer = timing.time(Phase::Judge, || 6 * 7);
    ///
    /// assert_eq!(answer, 42);
    /// assert!(timing.of(Phase::Judge).is_some());
    /// ```
    pub fn time<T>(&mut self, phase: Phase, work: impl FnOnce() -> T) -> T {
        let started = Instant::now();
        let out = work();
        self.record(phase, started.elapsed());
        out
    }

    /// What a phase took, or `None` where the run did not perform it.
    #[must_use]
    pub fn of(&self, phase: Phase) -> Option<Duration> {
        self.spent[phase.slot()]
    }

    /// The measured phases together.
    #[must_use]
    pub fn total(&self) -> Duration {
        self.spent
            .iter()
            .flatten()
            .fold(Duration::ZERO, |sum, one| sum.saturating_add(*one))
    }

    /// Every phase and what it took, in run order, unmeasured ones included.
    pub fn phases(&self) -> impl Iterator<Item = (Phase, Option<Duration>)> + '_ {
        Phase::ALL.into_iter().map(|phase| (phase, self.of(phase)))
    }
}

/// The report a run prints: every phase named, in order, and the total.
///
/// ```
/// use cogra_linter::timing::{Phase, Timing};
/// use std::time::Duration;
///
/// let mut timing = Timing::new();
/// timing.record(Phase::Resolve, Duration::from_millis(1500));
///
/// assert!(timing.to_string().contains("resolve 1500.0 ms"));
/// assert!(timing.to_string().contains("render —"), "an unrun phase is not zero");
/// ```
impl fmt::Display for Timing {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for (phase, took) in self.phases() {
            write!(f, "{} ", phase.token())?;
            match took {
                Some(took) => write!(f, "{}", milliseconds(took))?,
                None => f.write_str("—")?,
            }
            f.write_str(" · ")?;
        }
        write!(f, "total {}", milliseconds(self.total()))
    }
}

/// One duration, in milliseconds to one decimal.
fn milliseconds(took: Duration) -> String {
    format!("{:.1} ms", took.as_secs_f64() * 1000.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_five_phases_are_the_architectures_own() {
        let named: Vec<&str> = Phase::ALL.iter().map(|one| one.token()).collect();
        assert_eq!(
            named,
            vec!["pre-tokenize", "harvest", "resolve", "judge", "render"]
        );
    }

    #[test]
    fn every_phase_has_its_own_slot() {
        let mut slots: Vec<usize> = Phase::ALL.iter().map(|one| one.slot()).collect();
        slots.sort_unstable();
        slots.dedup();
        assert_eq!(slots.len(), Phase::ALL.len());
    }

    #[test]
    fn a_phase_measured_twice_sums() {
        let mut timing = Timing::new();
        timing.record(Phase::Pretokenize, Duration::from_micros(300));
        timing.record(Phase::Pretokenize, Duration::from_micros(700));
        assert_eq!(
            timing.of(Phase::Pretokenize),
            Some(Duration::from_millis(1))
        );
    }

    #[test]
    fn an_unmeasured_phase_is_absent_and_never_zero() {
        let timing = Timing::new();
        assert_eq!(timing.of(Phase::Judge), None);
        assert_eq!(timing.total(), Duration::ZERO);
        assert!(timing.to_string().contains("judge —"));
    }

    #[test]
    fn the_total_is_the_measured_phases_together() {
        let mut timing = Timing::new();
        timing.record(Phase::Harvest, Duration::from_millis(10));
        timing.record(Phase::Judge, Duration::from_millis(5));
        assert_eq!(timing.total(), Duration::from_millis(15));
    }

    #[test]
    fn the_report_names_every_phase_in_run_order() {
        let mut timing = Timing::new();
        timing.record(Phase::Harvest, Duration::from_millis(2));
        let report = timing.to_string();
        let mut at = 0;
        for phase in Phase::ALL {
            let found = report[at..]
                .find(phase.token())
                .unwrap_or_else(|| panic!("{} is missing from {report}", phase.token()));
            at += found;
        }
        assert!(report.contains("total"));
    }
}
