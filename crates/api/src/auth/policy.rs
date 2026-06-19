//! Auth-flow policy values — the tunable knobs that govern registration,
//! sessions, and a new account's first edge into the graph. Gathered here so
//! the policy is visible and changed in one place rather than buried beside
//! the logic that reads it. Each constant cites the doc that fixes its value.

/// auth.md "Password requirements": minimum 12 characters, no maximum, no
/// composition rules. The breach-corpus (HIBP) check specified there is
/// **deferred** to a later auth-hardening pass — slice 0 enforces length only.
pub const MIN_PASSWORD_LEN: usize = 12;

/// auth.md "Handle and email format": a handle is 3–30 characters of
/// `[a-z0-9_]`. The charset excludes `-`, which keeps the `redacted-user-…`
/// redaction sentinel (api-spec.md) structurally unreachable by a real account.
pub const HANDLE_MIN_LEN: usize = 3;
pub const HANDLE_MAX_LEN: usize = 30;

/// auth.md "Handle and email format": the RFC 5321 envelope cap on an email
/// address. The format check is lenient (shape only, not RFC 5322) — the
/// verification email is the authoritative proof the address is real.
pub const EMAIL_MAX_LEN: usize = 254;

/// Profile-field bounds for `editProfile` (api-spec.md "EditProfileInput").
/// The docs leave these open; these are the chosen values, gathered here with
/// the other tunables. `display_name` is required and non-empty once trimmed;
/// `bio` and `website_url` are optional, and an empty value clears them. The
/// `website_url` cap pairs with the http(s)-scheme check in
/// [`validate`](super::validate) — the field is rendered as a link, so a
/// `javascript:` / `data:` value must never reach storage.
pub const DISPLAY_NAME_MAX_LEN: usize = 50;
pub const BIO_MAX_LEN: usize = 300;
pub const WEBSITE_URL_MAX_LEN: usize = 200;

/// Pending-registration lifetime (auth.md): unverified records expire in 24 h.
pub const PENDING_TTL_HOURS: i64 = 24;

/// Refresh-token lifetime (auth.md): 30 days, slid forward on each use.
pub const REFRESH_TTL_DAYS: i64 = 30;

/// The default invitation-edge value when a party skips the choice
/// (invitations.md "Default values"). This is the weight of a new account's
/// first edge into the graph, so it belongs to the auth flow rather than the
/// economics that later reads the edge.
pub const INVITE_EDGE_DEFAULT: f32 = 0.5;
