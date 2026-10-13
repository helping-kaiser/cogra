//! ´mod:module:census´
//!
//! The ranker's own names for record families and leg roles.
//!
//! The ranker's public surface defines its own records and enums rather than
//! re-exporting common's (ranker-core §6): common's types carry no UniFFI
//! derive, and the on-device binding needs every public type to be one it can
//! declare. Each enum here maps one-to-one onto common's, and the census rows
//! — domain, mask, tier — are read from common through that map, so there is
//! one census and the ranker never holds a second copy of it.

use std::fmt;

use common::l1::census as seam;

/// A record family, as the census names it (layer1-interface.md §9.5–§9.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Family {
    Registration,
    Publish,
    Opinion,
    Affinity,
    Owner,
    JoinRequest,
    Accept,
    Ratify,
    Withdraw,
    Rescind,
    Leave,
    Tag,
    Review,
    Bid,
    Invitation,
    DeInvite,
    Send,
    Reference,
    Participant,
}

/// A leg's role in its record's graph projection: the one edge of a binary
/// family, or the A-leg (author → middle) and T-leg (middle → terminal) of a
/// hyper-edge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum LegRole {
    Binary,
    A,
    T,
}

impl Family {
    /// Every family, in census order.
    pub const ALL: [Family; 19] = [
        Family::Registration,
        Family::Publish,
        Family::Opinion,
        Family::Affinity,
        Family::Owner,
        Family::JoinRequest,
        Family::Accept,
        Family::Ratify,
        Family::Withdraw,
        Family::Rescind,
        Family::Leave,
        Family::Tag,
        Family::Review,
        Family::Bid,
        Family::Invitation,
        Family::DeInvite,
        Family::Send,
        Family::Reference,
        Family::Participant,
    ];

    /// The family's token on the api's wire (`RecordFamily`, schema.graphql).
    pub fn wire_name(self) -> &'static str {
        match self {
            Family::Registration => "REGISTRATION",
            Family::Publish => "PUBLISH",
            Family::Opinion => "OPINION",
            Family::Affinity => "AFFINITY",
            Family::Owner => "OWNER",
            Family::JoinRequest => "JOIN_REQUEST",
            Family::Accept => "ACCEPT",
            Family::Ratify => "RATIFY",
            Family::Withdraw => "WITHDRAW",
            Family::Rescind => "RESCIND",
            Family::Leave => "LEAVE",
            Family::Tag => "TAG",
            Family::Review => "REVIEW",
            Family::Bid => "BID",
            Family::Invitation => "INVITATION",
            Family::DeInvite => "DE_INVITE",
            Family::Send => "SEND",
            Family::Reference => "REFERENCE",
            Family::Participant => "PARTICIPANT",
        }
    }

    /// The family a wire token names, if any.
    pub fn from_wire(token: &str) -> Option<Family> {
        Family::ALL.into_iter().find(|f| f.wire_name() == token)
    }

    /// The leg roles the census gives this family: one `Binary` leg, or an
    /// `A` and a `T` leg.
    pub fn roles(self) -> Vec<LegRole> {
        self.seam()
            .legs()
            .iter()
            .map(|l| LegRole::from_seam(l.role))
            .collect()
    }

    pub(crate) fn seam(self) -> seam::Family {
        match self {
            Family::Registration => seam::Family::Registration,
            Family::Publish => seam::Family::Publish,
            Family::Opinion => seam::Family::Opinion,
            Family::Affinity => seam::Family::Affinity,
            Family::Owner => seam::Family::Owner,
            Family::JoinRequest => seam::Family::JoinRequest,
            Family::Accept => seam::Family::Accept,
            Family::Ratify => seam::Family::Ratify,
            Family::Withdraw => seam::Family::Withdraw,
            Family::Rescind => seam::Family::Rescind,
            Family::Leave => seam::Family::Leave,
            Family::Tag => seam::Family::Tag,
            Family::Review => seam::Family::Review,
            Family::Bid => seam::Family::Bid,
            Family::Invitation => seam::Family::Invitation,
            Family::DeInvite => seam::Family::DeInvite,
            Family::Send => seam::Family::Send,
            Family::Reference => seam::Family::Reference,
            Family::Participant => seam::Family::Participant,
        }
    }

    /// The census row for one of this family's legs, or `None` when the
    /// family has no leg of that role.
    pub(crate) fn leg(self, role: LegRole) -> Option<seam::LegSpec> {
        let want = role.seam();
        self.seam().legs().iter().copied().find(|l| l.role == want)
    }
}

impl LegRole {
    /// The role's token on the api's wire (`RecordLegRole`, schema.graphql).
    pub fn wire_name(self) -> &'static str {
        match self {
            LegRole::Binary => "BINARY",
            LegRole::A => "A",
            LegRole::T => "T",
        }
    }

    /// The role a wire token names, if any.
    pub fn from_wire(token: &str) -> Option<LegRole> {
        [LegRole::Binary, LegRole::A, LegRole::T]
            .into_iter()
            .find(|r| r.wire_name() == token)
    }

    fn seam(self) -> seam::LegRole {
        match self {
            LegRole::Binary => seam::LegRole::Binary,
            LegRole::A => seam::LegRole::A,
            LegRole::T => seam::LegRole::T,
        }
    }

    fn from_seam(role: seam::LegRole) -> LegRole {
        match role {
            seam::LegRole::Binary => LegRole::Binary,
            seam::LegRole::A => LegRole::A,
            seam::LegRole::T => LegRole::T,
        }
    }
}

impl fmt::Display for Family {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.wire_name())
    }
}

impl fmt::Display for LegRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.wire_name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every family maps onto the seam's family of the same name, so the
    /// census rows the ranker reads are the ones the seam publishes.
    ///
    /// Every family maps onto the seam's own family and carries exactly the leg roles the census gives it.
    /// ´claim:census:every-family-maps-onto-the-seams-census´
    #[test]
    fn every_family_maps_onto_the_seam_census() {
        for family in Family::ALL {
            assert_eq!(
                seam::Family::parse(family.seam().as_str()),
                Some(family.seam())
            );
            let roles = family.roles();
            for role in &roles {
                assert!(family.leg(*role).is_some(), "{family} {role}");
            }
            assert_eq!(roles.len(), family.seam().legs().len());
        }
        assert_eq!(seam::Family::ALL.len(), Family::ALL.len());
    }

    /// The wire tokens are the api's `RecordFamily` and `RecordLegRole`
    /// spellings, and parse back.
    ///
    /// Every family and leg role parses back from its own wire token.
    /// ´claim:census:wire-tokens-round-trip´
    #[test]
    fn wire_tokens_round_trip() {
        for family in Family::ALL {
            assert_eq!(Family::from_wire(family.wire_name()), Some(family));
        }
        for role in [LegRole::Binary, LegRole::A, LegRole::T] {
            assert_eq!(LegRole::from_wire(role.wire_name()), Some(role));
        }
        assert_eq!(Family::from_wire("opinion"), None);
    }
}
