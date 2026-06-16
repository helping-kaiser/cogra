//! Auth-flow policy values — the tunable knobs that govern registration,
//! sessions, and a new account's first edge into the graph. Gathered here so
//! the policy is visible and changed in one place rather than buried beside
//! the logic that reads it. Each constant cites the doc that fixes its value.

/// auth.md "Password requirements": minimum 12 characters, no maximum, no
/// composition rules. The breach-corpus (HIBP) check specified there is
/// **deferred** to a later auth-hardening pass — slice 0 enforces length only.
pub const MIN_PASSWORD_LEN: usize = 12;

/// Pending-registration lifetime (auth.md): unverified records expire in 24 h.
pub const PENDING_TTL_HOURS: i64 = 24;

/// Refresh-token lifetime (auth.md): 30 days, slid forward on each use.
pub const REFRESH_TTL_DAYS: i64 = 30;

/// The default invitation-edge value when a party skips the choice
/// (invitations.md "Default values"). This is the weight of a new account's
/// first edge into the graph, so it belongs to the auth flow rather than the
/// economics that later reads the edge.
pub const INVITE_EDGE_DEFAULT: f32 = 0.5;
