//! The host's read-back of an act prints the dependency nonce's length,
//! never its bytes.

use common::l1::Family;
use common::l1::handshake::StructuralBody;
use common::l1::identifier::NodeId;
use l1_standin::StoredAct;

/// A stored act's Debug output shows the dependency nonce's length, never its bytes, and still shows the act.
/// ´claim:redaction:a-stored-act-prints-only-the-nonce-length´
#[test]
fn a_stored_act_prints_only_the_nonce_length() {
    let act = StoredAct {
        body: StructuralBody {
            author: "alice".into(),
            seq: 1,
            family: Family::Opinion,
            middle: None,
            target: NodeId::parse("prof:bob").expect("valid node id"),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        deps: vec![],
        dependency_nonce: vec![0x6a; 32],
        pre_commitment: vec![9; 32],
        content_commitment: vec![6; 32],
        sealed: None,
        approved: false,
    };
    let shown = format!("{act:?}");
    assert!(!shown.contains("106, 106"), "{shown}");
    assert!(shown.contains("<32 bytes>"), "{shown}");
    assert!(shown.contains("alice"), "{shown}");
}
