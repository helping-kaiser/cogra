//! User domain types shared across the graph and Postgres stores.

use std::fmt;
use std::str::FromStr;

/// A User's Network-scope role
/// ([network.md §8](../primitive/network.md)). Layered on the `:User`
/// node; read at the action site, never carried in an access token
/// ([auth.md](../implementation/auth.md)).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkRole {
    /// Every registered user, automatically. The default.
    Member,
    /// A platform-wide governance gate-keeper (see network.md §9).
    Moderator,
}

impl NetworkRole {
    /// The graph-property spelling — the exact string stored on the node.
    pub fn as_str(self) -> &'static str {
        match self {
            NetworkRole::Member => "member",
            NetworkRole::Moderator => "moderator",
        }
    }
}

impl fmt::Display for NetworkRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Error returned when a graph property carries an unknown role string.
#[derive(Debug, thiserror::Error)]
#[error("unknown network_role: {0:?}")]
pub struct UnknownNetworkRole(pub String);

impl FromStr for NetworkRole {
    type Err = UnknownNetworkRole;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "member" => Ok(NetworkRole::Member),
            "moderator" => Ok(NetworkRole::Moderator),
            other => Err(UnknownNetworkRole(other.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrips_through_str() {
        for role in [NetworkRole::Member, NetworkRole::Moderator] {
            assert_eq!(
                role.as_str().parse::<NetworkRole>().expect("known role"),
                role
            );
        }
    }

    #[test]
    fn rejects_unknown() {
        assert!("admin".parse::<NetworkRole>().is_err());
    }
}
