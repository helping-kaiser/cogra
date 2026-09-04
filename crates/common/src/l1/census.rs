//! ´mod:module:census´
//!
//! The edge census (layer1-interface.md §9.5–§9.7; bare section references
//! below are that document's). The census is normative: where prose and the
//! tables disagree, the tables govern.
//!
//! Domain, mask, and tier are family-fixed here, never per-edge choices —
//! the uniform two-parameter grammar. Every act carries the same two
//! authored parameters (p_d, p_i) per leg, rendered from the family
//! parameter tuple by the leg role.

use super::identifier::NodeId;

/// An act family, listed binary families (§9.5) first and hyper ones (§9.6)
/// after. `kind` decides which group a family is in; `legs` gives its census
/// rows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Family {
    /// The sole family whose endpoints may be fresh grounded identifiers:
    /// the target is the author's own Profile (§8.1).
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
    /// The uniform movement act — A-leg whence, T-leg whither, the
    /// found/join self-loop legal (A = T). Its T-leg is a weak lineage
    /// marker, census-forced positive by `params_check` so it can never flip
    /// a walk's parity; the member's real stance rides the A-leg.
    Participant,
}

impl Family {
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

    pub fn as_str(self) -> &'static str {
        match self {
            Family::Registration => "registration",
            Family::Publish => "publish",
            Family::Opinion => "opinion",
            Family::Affinity => "affinity",
            Family::Participant => "participant",
            Family::Owner => "owner",
            Family::JoinRequest => "join-request",
            Family::Accept => "accept",
            Family::Ratify => "ratify",
            Family::Withdraw => "withdraw",
            Family::Rescind => "rescind",
            Family::Leave => "leave",
            Family::Tag => "tag",
            Family::Review => "review",
            Family::Bid => "bid",
            Family::Invitation => "invitation",
            Family::DeInvite => "de-invite",
            Family::Send => "send",
            Family::Reference => "reference",
        }
    }

    pub fn parse(s: &str) -> Option<Family> {
        Family::ALL.into_iter().find(|f| f.as_str() == s)
    }

    pub fn kind(self) -> FamilyKind {
        match self {
            Family::Tag
            | Family::Review
            | Family::Bid
            | Family::Invitation
            | Family::DeInvite
            | Family::Send
            | Family::Reference
            | Family::Participant => FamilyKind::Hyper,
            _ => FamilyKind::Binary,
        }
    }

    /// Node type minted by this family as a genesis act, if any
    /// (§8.1): Item — Owner; Offer — Bid/T;
    /// Comment — Review/T; Message — Send/T; Chat — the founding member's
    /// Participant; Content — Publish.
    pub fn minted_node(self) -> Option<MintedNode> {
        match self {
            Family::Publish => Some(MintedNode::Content),
            Family::Owner => Some(MintedNode::Item),
            Family::Participant => Some(MintedNode::Chat),
            Family::Review => Some(MintedNode::Comment),
            Family::Send => Some(MintedNode::Message),
            Family::Bid => Some(MintedNode::Offer),
            _ => None,
        }
    }

    /// Census row per leg. Binary families have exactly one leg
    /// (`LegRole::Binary`); hyper families exactly two (`A`, `T`).
    pub fn legs(self) -> &'static [LegSpec] {
        match self {
            Family::Registration => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Identity,
                mask: [true, false, false, true],
                tier: Tier::Full,
                fixed_params: true,
            }],
            Family::Publish => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Economic,
                mask: [true, true, true, true],
                tier: Tier::Full,
                fixed_params: false,
            }],
            Family::Opinion => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Tribal,
                mask: [true, true, true, true],
                tier: Tier::Full,
                fixed_params: false,
            }],
            Family::Affinity => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Epistemic,
                mask: [false, true, false, true],
                tier: Tier::Marginal,
                fixed_params: false,
            }],
            Family::Owner => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Economic,
                mask: [true, true, true, true],
                tier: Tier::Full,
                fixed_params: false,
            }],
            Family::JoinRequest => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Relational,
                mask: [true, true, true, true],
                tier: Tier::Half,
                fixed_params: false,
            }],
            Family::Accept => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Relational,
                mask: [true, true, true, true],
                tier: Tier::Half,
                fixed_params: false,
            }],
            Family::Ratify => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Relational,
                mask: [true, true, true, true],
                tier: Tier::Half,
                fixed_params: false,
            }],
            Family::Withdraw => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Minimal,
                mask: [false, false, false, true],
                tier: Tier::Marginal,
                fixed_params: true,
            }],
            Family::Rescind => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Minimal,
                mask: [false, false, false, true],
                tier: Tier::Marginal,
                fixed_params: true,
            }],
            Family::Leave => &[LegSpec {
                role: LegRole::Binary,
                domain: Domain::Minimal,
                mask: [false, false, false, true],
                tier: Tier::Marginal,
                fixed_params: true,
            }],
            Family::Tag => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
            ],
            Family::Review => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Tribal,
                    mask: [true, true, true, true],
                    tier: Tier::Full,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
            ],
            Family::Bid => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Economic,
                    mask: [true, true, true, true],
                    tier: Tier::Half,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Economic,
                    mask: [true, true, true, true],
                    tier: Tier::Half,
                    fixed_params: false,
                },
            ],
            Family::Invitation => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Relational,
                    mask: [true, true, true, true],
                    tier: Tier::Half,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
            ],
            Family::DeInvite => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Minimal,
                    mask: [false, false, false, true],
                    tier: Tier::Marginal,
                    fixed_params: true,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Minimal,
                    mask: [false, false, false, true],
                    tier: Tier::Marginal,
                    fixed_params: true,
                },
            ],
            Family::Send => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Relational,
                    mask: [true, true, true, true],
                    tier: Tier::Full,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Minimal,
                    mask: [false, false, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
            ],
            Family::Reference => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Tribal,
                    mask: [true, true, true, true],
                    tier: Tier::Full,
                    fixed_params: false,
                },
            ],
            Family::Participant => &[
                LegSpec {
                    role: LegRole::A,
                    domain: Domain::Relational,
                    mask: [true, true, true, true],
                    tier: Tier::Full,
                    fixed_params: false,
                },
                LegSpec {
                    role: LegRole::T,
                    domain: Domain::Epistemic,
                    mask: [false, true, false, true],
                    tier: Tier::Marginal,
                    fixed_params: false,
                },
            ],
        }
    }

    /// The middle node's own class rule, for the hyper families that fix
    /// one. It takes the middle the kind dispatch already resolved rather
    /// than an `Option`, so no family arm can be reached with the middle
    /// missing — the case is refused once, where the kind is decided.
    fn middle_check(self, middle: &NodeId) -> Result<(), String> {
        match self {
            Family::Participant => match middle {
                NodeId::Mint(_) => Ok(()),
                _ => Err(format!("middle must be a Chat (minted node), got {middle}")),
            },
            _ => Ok(()),
        }
    }

    /// Endpoint-typing check for the act's incidence (§9.5/§9.6 columns;
    /// `author` is the acting actor's address atom). `middle` is `None` for
    /// binary families, and the initiating source is always the author's own
    /// Actor node, whatever the family.
    ///
    /// Minted endpoints whose genesis act is unknown to the checker are
    /// dangling — permitted, fold-neutral (§8.1) — so only identifier
    /// *class* is checked here; genesis-family agreement for anchored minted
    /// nodes is the host's lookup (l1-standin).
    pub fn endpoint_check(
        self,
        author: &str,
        source: &NodeId,
        middle: Option<&NodeId>,
        target: &NodeId,
    ) -> Result<(), String> {
        let author_node = NodeId::Addr(author.to_string());
        if *source != author_node {
            return Err(format!(
                "source must be the author's Actor node {author_node}, got {source}"
            ));
        }
        match self.kind() {
            FamilyKind::Binary => {
                if middle.is_some() {
                    return Err("binary family carries no middle node".into());
                }
            }
            FamilyKind::Hyper => {
                let m = middle.ok_or("hyper family requires a middle node")?;
                if !m.is_passive() {
                    return Err(format!("middle node must be passive, got {m}"));
                }
                self.middle_check(m)?;
            }
        }
        let class_err = |what: &str, want: &str, got: &NodeId| -> Result<(), String> {
            Err(format!("{what} must be {want}, got {got}"))
        };
        match self {
            Family::Registration => match target {
                NodeId::Prof(a) if a == author => Ok(()),
                _ => class_err("target", "the author's own Profile", target),
            },
            Family::Publish => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("target", "a minted Content node", target),
            },
            Family::Opinion => {
                if target.is_passive() {
                    Ok(())
                } else {
                    class_err("target", "a passive node", target)
                }
            }
            Family::Affinity => match target {
                NodeId::Name(_) => Ok(()),
                _ => class_err("target", "a Type", target),
            },
            Family::JoinRequest | Family::Leave => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("target", "a Chat (minted node)", target),
            },
            Family::Participant => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("terminal target", "a Chat (minted node)", target),
            },
            Family::Owner => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("target", "an Item (minted node)", target),
            },
            Family::Accept | Family::Ratify => match target {
                NodeId::Addr(_) => Ok(()),
                _ => class_err("target", "an Actor", target),
            },
            Family::Withdraw | Family::Rescind => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("target", "an Offer (minted node)", target),
            },
            Family::Tag => match target {
                NodeId::Name(_) => Ok(()),
                _ => class_err("terminal target", "a Type", target),
            },
            Family::Review | Family::Send | Family::Bid => match target {
                NodeId::Mint(_) => Ok(()),
                _ => class_err("terminal target", "a minted node", target),
            },
            Family::Invitation | Family::DeInvite => match target {
                NodeId::Prof(_) => Ok(()),
                _ => class_err("terminal target", "a Profile", target),
            },
            Family::Reference => {
                if target.is_passive() {
                    Ok(())
                } else {
                    class_err("terminal target", "a passive node", target)
                }
            }
        }
    }

    /// Family parameter-tuple validity. The tuple belongs to the act (§8.1);
    /// leg renderings are derived. Both components live in [-1, 1];
    /// family-specific constraints narrow that: fixed-parameter control
    /// records force (1, 1); non-negative second components where the census
    /// says so.
    ///
    /// What the tuple means per family: for Publish and Owner it is an
    /// attachment in [-1, 1] with p_i fixed at 1; for Tag, relevance and a
    /// confidence in [0, 1]; for Bid, generosity and an urgency in [0, 1];
    /// for Participant, the second slot is the T-leg's forced-positive
    /// rendering. Invitation needs no arm of its own — its stored tuple is
    /// (u, f), and terminal relevance rides payload renderings only.
    pub fn params_check(self, p_d: f64, p_i: f64) -> Result<(), String> {
        if !(-1.0..=1.0).contains(&p_d) || !(-1.0..=1.0).contains(&p_i) {
            return Err(format!("parameters ({p_d}, {p_i}) outside [-1, 1]"));
        }
        match self {
            Family::Registration
            | Family::Withdraw
            | Family::Rescind
            | Family::Leave
            | Family::DeInvite => {
                if p_d == 1.0 && p_i == 1.0 {
                    Ok(())
                } else {
                    Err(format!(
                        "{} is type-fixed to (1, 1), got ({p_d}, {p_i})",
                        self.as_str()
                    ))
                }
            }
            Family::Publish | Family::Owner => {
                if p_i == 1.0 {
                    Ok(())
                } else {
                    Err(format!("{} fixes p_i = 1, got {p_i}", self.as_str()))
                }
            }
            Family::Tag | Family::Bid | Family::Participant => {
                if (0.0..=1.0).contains(&p_i) {
                    Ok(())
                } else {
                    Err(format!(
                        "{} requires p_i ∈ [0, 1], got {p_i}",
                        self.as_str()
                    ))
                }
            }
            _ => Ok(()),
        }
    }
}

impl std::fmt::Display for Family {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FamilyKind {
    Binary,
    Hyper,
}

/// Leg role within an act's graph projection: one binary edge, or the
/// A-leg (Actor → passive) and T-leg (passive → terminal target) of a
/// hyper-edge act (§9.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LegRole {
    Binary,
    A,
    T,
}

impl LegRole {
    pub fn as_str(self) -> &'static str {
        match self {
            LegRole::Binary => "binary",
            LegRole::A => "a",
            LegRole::T => "t",
        }
    }

    pub fn parse(s: &str) -> Option<LegRole> {
        match s {
            "binary" => Some(LegRole::Binary),
            "a" => Some(LegRole::A),
            "t" => Some(LegRole::T),
            _ => None,
        }
    }
}

/// Interaction domain (§8.8).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Domain {
    Tribal,
    Epistemic,
    Economic,
    Relational,
    Identity,
    Minimal,
}

impl Domain {
    pub fn as_str(self) -> &'static str {
        match self {
            Domain::Tribal => "tribal",
            Domain::Epistemic => "epistemic",
            Domain::Economic => "economic",
            Domain::Relational => "relational",
            Domain::Identity => "identity",
            Domain::Minimal => "minimal",
        }
    }

    pub fn parse(s: &str) -> Option<Domain> {
        [
            Domain::Tribal,
            Domain::Epistemic,
            Domain::Economic,
            Domain::Relational,
            Domain::Identity,
            Domain::Minimal,
        ]
        .into_iter()
        .find(|d| d.as_str() == s)
    }
}

/// Routing tier (§8.7): floor ladder {1, √η, η}.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    Full,
    Half,
    Marginal,
}

impl Tier {
    pub fn as_str(self) -> &'static str {
        match self {
            Tier::Full => "full",
            Tier::Half => "half",
            Tier::Marginal => "marginal",
        }
    }

    pub fn parse(s: &str) -> Option<Tier> {
        match s {
            "full" => Some(Tier::Full),
            "half" => Some(Tier::Half),
            "marginal" => Some(Tier::Marginal),
            _ => None,
        }
    }
}

/// One census row: the family-fixed rendering of a leg.
#[derive(Debug, Clone, Copy)]
pub struct LegSpec {
    pub role: LegRole,
    pub domain: Domain,
    /// Stored mask (a00, a01, a10, a11) over the bilinear block.
    pub mask: [bool; 4],
    pub tier: Tier,
    /// Type-fixed (1, 1) parameters, ε = +1 forced.
    pub fixed_params: bool,
}

/// The leg's rendering of the act parameter tuple (x, y) → (p_d, p_i).
/// Per §9.6 the T-leg renders the tuple with its components transposed
/// relative to the A-leg; binary legs render it directly.
pub fn leg_params(role: LegRole, p_d: f64, p_i: f64) -> (f64, f64) {
    match role {
        LegRole::Binary | LegRole::A => (p_d, p_i),
        LegRole::T => (p_i, p_d),
    }
}

/// A minted node's type, fixed by its genesis act's family.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MintedNode {
    Content,
    Item,
    Chat,
    Comment,
    Message,
    Offer,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::l1::identifier::ActId;

    /// Every family parses back from its own token and carries the leg roles its kind fixes.
    /// ´claim:census:every-family-round-trips-and-carries-its-legs´
    #[test]
    fn every_family_round_trips_and_has_census_rows() {
        for family in Family::ALL {
            assert_eq!(Family::parse(family.as_str()), Some(family));
            let legs = family.legs();
            match family.kind() {
                FamilyKind::Binary => {
                    assert_eq!(legs.len(), 1);
                    assert_eq!(legs[0].role, LegRole::Binary);
                }
                FamilyKind::Hyper => {
                    assert_eq!(legs.len(), 2);
                    assert_eq!(legs[0].role, LegRole::A);
                    assert_eq!(legs[1].role, LegRole::T);
                }
            }
        }
    }

    /// A Registration may target its own author's Profile and no other.
    /// ´claim:census:a-registration-targets-its-authors-own-profile´
    #[test]
    fn registration_targets_own_profile_only() {
        let src = NodeId::parse("addr:alice").expect("ok");
        let own = NodeId::parse("prof:alice").expect("ok");
        let other = NodeId::parse("prof:bob").expect("ok");
        assert!(
            Family::Registration
                .endpoint_check("alice", &src, None, &own)
                .is_ok()
        );
        assert!(
            Family::Registration
                .endpoint_check("alice", &src, None, &other)
                .is_err()
        );
    }

    /// An act's source endpoint is its author, and an act claiming another is refused.
    /// ´claim:census:the-source-endpoint-is-the-author´
    #[test]
    fn source_must_be_author() {
        let wrong = NodeId::parse("addr:mallory").expect("ok");
        let target = NodeId::parse("prof:alice").expect("ok");
        assert!(
            Family::Opinion
                .endpoint_check("alice", &wrong, None, &target)
                .is_err()
        );
    }

    /// A hyper act needs a middle, and that middle must be passive.
    /// ´claim:census:a-hyper-act-needs-a-passive-middle´
    #[test]
    fn hyper_needs_passive_middle() {
        let src = NodeId::parse("addr:pub").expect("ok");
        let profile = NodeId::parse("prof:alice").expect("ok");
        let ty = NodeId::parse("name:moderator").expect("ok");
        let actor_middle = NodeId::parse("addr:alice").expect("ok");
        assert!(
            Family::Tag
                .endpoint_check("pub", &src, Some(&profile), &ty)
                .is_ok()
        );
        assert!(
            Family::Tag
                .endpoint_check("pub", &src, Some(&actor_middle), &ty)
                .is_err()
        );
        assert!(Family::Tag.endpoint_check("pub", &src, None, &ty).is_err());
    }

    /// The movement act runs between Chats and may self-loop; a Profile at
    /// either endpoint, or no middle at all, is refused. Its parameter arm
    /// admits the system actor's inert (0, 0) while still forcing the second
    /// component non-negative.
    ///
    /// The movement act runs between Chats and may self-loop, its parameter arm admitting an inert pair while still forcing the second component non-negative.
    /// ´claim:census:the-movement-act-runs-between-chats-and-may-self-loop´
    #[test]
    fn participant_moves_between_chats_and_self_loops() {
        let src = NodeId::parse("addr:alice").expect("ok");
        let c0 = NodeId::Mint(ActId::new("founder", 0, Family::Participant).expect("ok"));
        let c1 = NodeId::Mint(ActId::new("other", 3, Family::Participant).expect("ok"));
        let profile = NodeId::parse("prof:alice").expect("ok");

        assert!(
            Family::Participant
                .endpoint_check("alice", &src, Some(&c0), &c0)
                .is_ok()
        );
        assert!(
            Family::Participant
                .endpoint_check("alice", &src, Some(&c0), &c1)
                .is_ok()
        );
        assert!(
            Family::Participant
                .endpoint_check("alice", &src, Some(&profile), &c1)
                .is_err()
        );
        assert!(
            Family::Participant
                .endpoint_check("alice", &src, Some(&c0), &profile)
                .is_err()
        );
        assert!(
            Family::Participant
                .endpoint_check("alice", &src, None, &c1)
                .is_err()
        );

        assert!(Family::Participant.params_check(-0.5, 0.5).is_ok());
        assert!(Family::Participant.params_check(0.0, 0.0).is_ok());
        assert!(Family::Participant.params_check(0.5, -0.1).is_err());
    }

    /// A family whose parameters the census fixes admits that pair and no other.
    /// ´claim:census:fixed-parameters-admit-one-pair-only´
    #[test]
    fn fixed_params_enforced() {
        assert!(Family::Registration.params_check(1.0, 1.0).is_ok());
        assert!(Family::Registration.params_check(0.5, 1.0).is_err());
        assert!(Family::Leave.params_check(1.0, 0.0).is_err());
    }

    /// Parameter ranges are enforced per axis, and a family's two axes need not share one.
    /// ´claim:census:parameter-ranges-are-enforced-per-axis´
    #[test]
    fn ranges_enforced() {
        assert!(Family::Opinion.params_check(-1.0, 1.0).is_ok());
        assert!(Family::Opinion.params_check(-1.1, 0.0).is_err());
        assert!(Family::Tag.params_check(0.0, 0.0).is_ok());
        assert!(Family::Tag.params_check(0.5, -0.1).is_err());
        assert!(Family::Publish.params_check(0.3, 0.9).is_err());
        assert!(Family::Publish.params_check(0.3, 1.0).is_ok());
    }

    /// The T-leg carries the act's pair transposed, where the A-leg and a binary leg carry it as written.
    /// ´claim:census:the-t-leg-carries-the-pair-transposed´
    #[test]
    fn t_leg_transposes_params() {
        assert_eq!(leg_params(LegRole::A, 0.25, 0.75), (0.25, 0.75));
        assert_eq!(leg_params(LegRole::T, 0.25, 0.75), (0.75, 0.25));
        assert_eq!(leg_params(LegRole::Binary, -0.5, 1.0), (-0.5, 1.0));
    }
}
