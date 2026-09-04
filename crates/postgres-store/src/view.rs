//! ´mod:module:view´
//!
//! Which view of the graph a fold read takes — the one type every fold
//! that has a pending half shares.
//!
//! # The pending half is one predicate, written five times
//!
//! A staged write counts toward a fold from the pre-commitment onward,
//! and the test for "in flight" is the same everywhere it is asked:
//!
//! ```sql
//! octet_length(payload) = 0 AND pre_signed_at IS NOT NULL
//!   AND state NOT IN ('landed', 'expired')
//! ```
//!
//! It appears in `topics::topics_of`, `topics::tagged_with`,
//! `references::references_of`, `references::bundle` and
//! `stance::bundle`. sqlx's macros take a string literal and nothing that
//! expands to one, so the fragment cannot be shared; what can be shared
//! is the reason. Two of its three conjuncts are also the partial-index
//! condition of `staged_writes_bundle_idx`; the third is narrower than
//! the index, so the index still covers every one of these reads, and a
//! site that drifts on either of the first two loses that coverage
//! silently.

/// Which view of the graph a fold read takes: L1's — only what has
/// landed — or L2's, which also counts one actor's acts still in flight
/// (api-spec.md "Conventions", the `includePending` split).
///
/// The pending half names *whose* acts it counts, because a staged write
/// is not on the graph: only its own author may see it. Passing an actor
/// other than the requesting viewer would leak an unlanded act.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PendingView<'a> {
    Landed,
    IncludingPending { actor: &'a str },
}

impl<'a> PendingView<'a> {
    /// The `includePending` argument as the API takes it: pending rows
    /// count only in the L2 view, and only when there is a viewer whose
    /// own in-flight acts they can be.
    pub fn from_include_pending(include_pending: bool, viewer: Option<&'a str>) -> Self {
        match (include_pending, viewer) {
            (true, Some(actor)) => PendingView::IncludingPending { actor },
            _ => PendingView::Landed,
        }
    }

    /// `(pending counted, whose)` — the shape the queries bind. The
    /// empty string is the unused half of the pair, never an actor: it
    /// is only ever read when the boolean beside it is false.
    pub(crate) fn params(self) -> (bool, &'a str) {
        match self {
            PendingView::Landed => (false, ""),
            PendingView::IncludingPending { actor } => (true, actor),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PendingView;

    /// Asking for pending without a viewer is the case that must not
    /// become "pending for everyone": a staged write is visible only to
    /// its own author, so the absence of a viewer is what turns the
    /// request back into the landed view.
    #[test]
    fn pending_needs_a_viewer_to_be_anyones() {
        assert_eq!(
            PendingView::from_include_pending(true, Some("alice")),
            PendingView::IncludingPending { actor: "alice" }
        );
        assert_eq!(
            PendingView::from_include_pending(true, None),
            PendingView::Landed
        );
        assert_eq!(
            PendingView::from_include_pending(false, Some("alice")),
            PendingView::Landed
        );
    }

    /// The empty string the landed view binds is only ever read when the
    /// boolean beside it is false — the queries gate on that boolean, so
    /// it can never be compared against an author.
    #[test]
    fn the_landed_view_binds_no_actor() {
        assert_eq!(PendingView::Landed.params(), (false, ""));
        assert_eq!(
            PendingView::IncludingPending { actor: "alice" }.params(),
            (true, "alice")
        );
    }
}
