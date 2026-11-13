use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

use super::*;
use crate::l1::census::Family;
use crate::l1::client::{ActorKey, ClientError};
use crate::l1::encoding::Encoder;
use crate::l1::identifier::NodeId;
use crate::l1::wire::{self as wire_v1, WireError};

const CONTENT_NONCE: [u8; crypto::SALT_LEN] = [0x2a; crypto::SALT_LEN];
const DEPENDENCY_NONCE: [u8; crypto::SALT_LEN] = [0x6a; crypto::SALT_LEN];

fn proposal(author: &str, payload: &[u8]) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: author.into(),
            seq: 1,
            family: Family::Opinion,
            middle: None,
            target: NodeId::parse("prof:bob").expect("ok"),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: payload.to_vec(),
        deps: vec![ActId::parse("act:bob:1:registration").expect("ok")],
    }
}

fn pre_signed(actor: &ActorKey, payload: &[u8]) -> PreSigned {
    PreSigned::sign_with_nonces(
        actor,
        proposal(&actor.address(), payload),
        CONTENT_NONCE.to_vec(),
        DEPENDENCY_NONCE.to_vec(),
    )
}

/// The reference host, handed nothing but the submission: everything it
/// verifies, commits to and seals comes from that one value.
fn host_side(submission: &Submission, host: &SigningKey) -> SealedAct {
    submission
        .seal(
            host,
            vec![1u8; crypto::SALT_LEN],
            vec![2u8; crypto::SALT_LEN],
        )
        .expect("an honest submission seals")
}

/// Reseals a tampered header so only the device's own checks can refuse it.
fn reseal(mut sealed: SealedAct, host: &SigningKey) -> SealedAct {
    sealed.host_seal = crypto::sign(host, crypto::tags::HOST_SEAL, &sealed.act.seal_message());
    sealed
}

/// The verifier of the dependency binding holds the body, the dependency
/// list and its nonce, and P. Under two nonces no candidate payload
/// reproduces P — not under the dependency nonce, not under no nonce —
/// because the content pre-digest needs the content nonce. Under one
/// nonce shared by both projections, the same holder confirms the right
/// candidate out of a short set, which is the disclosure the second nonce
/// closes (§8.2, "Proposal pre-commitment").
///
/// Without the content nonce, a holder of the dependency opening confirms no payload guess; under one shared nonce it would.
/// ´claim:proposal:a-dependency-opening-holder-confirms-no-payload-guess´
#[test]
fn a_dependency_opening_holder_confirms_no_payload_guess() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let candidates: [&[u8]; 4] = [b"yes", b"no", b"maybe", b""];
    let truth: &[u8] = b"no";

    let pre = pre_signed(&actor, truth);
    let submission = pre.submission();
    let (body, deps, dependency_nonce, held) = (
        &submission.body,
        &submission.deps,
        &submission.dependency_nonce,
        submission.pre_commitment,
    );
    let act_id = body.act_id();
    let dependency = dependency_pre_digest(&act_id, dependency_nonce, deps);
    assert_eq!(
        pre_commitment(body, &submission.content_pre_digest, &dependency),
        held,
        "the holder verifies the dependency binding"
    );
    for candidate in candidates {
        for guess in [dependency_nonce.as_slice(), &[][..]] {
            let content = content_pre_digest(&act_id, guess, candidate);
            assert_ne!(pre_commitment(body, &content, &dependency), held);
            assert_ne!(content, submission.content_pre_digest);
        }
    }

    let shared = DEPENDENCY_NONCE.to_vec();
    let old = handshake::pre_commitment(&pre.proposal, &shared);
    let confirmed: Vec<&[u8]> = candidates
        .into_iter()
        .filter(|candidate| {
            let mut guess = pre.proposal.clone();
            guess.payload = candidate.to_vec();
            handshake::pre_commitment(&guess, &shared) == old
        })
        .collect();
    assert_eq!(
        confirmed,
        vec![truth],
        "one shared nonce lets the holder confirm the payload"
    );
}

/// Each pre-digest depends on its own projection's nonce alone.
/// ´claim:proposal:each-pre-digest-depends-on-its-own-nonce-alone´
#[test]
fn each_pre_digest_depends_on_its_own_nonce_alone() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let pre = pre_signed(&actor, b"hello");
    let mut other_dependency = pre.clone();
    other_dependency.dependency_nonce = vec![0x6b; crypto::SALT_LEN];
    assert_ne!(
        other_dependency.dependency_pre_digest(),
        pre.dependency_pre_digest()
    );
    assert_eq!(
        other_dependency.content_pre_digest(),
        pre.content_pre_digest()
    );
    let mut other_content = pre.clone();
    other_content.content_nonce = vec![0x2b; crypto::SALT_LEN];
    assert_ne!(other_content.content_pre_digest(), pre.content_pre_digest());
    assert_eq!(
        other_content.dependency_pre_digest(),
        pre.dependency_pre_digest()
    );
    assert_ne!(other_content.pre_commitment(), pre.pre_commitment());
    assert_ne!(other_dependency.pre_commitment(), pre.pre_commitment());
}

/// A pre-commitment formed the earlier way — one nonce under both
/// pre-digests, the earlier tags — never recomputes here, even with that
/// same nonce in both places, so a submission carrying it and a valid
/// signature over it is refused.
///
/// A pre-commitment formed under one shared nonce and the earlier tags never verifies under the two-nonce recompute.
/// ´claim:proposal:a-one-nonce-pre-commitment-never-verifies´
#[test]
fn a_one_nonce_pre_commitment_never_verifies() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let nonce = vec![0x5a; crypto::SALT_LEN];
    let draft = proposal(&actor.address(), b"hello");
    let old = handshake::pre_commitment(&draft, &nonce);
    let both = PreSigned::sign_with_nonces(&actor, draft, nonce.clone(), nonce);
    assert_ne!(both.pre_commitment(), old);

    let mut submission = both.submission();
    submission.pre_commitment = old;
    submission.pre_signature = actor.sign_digest(&old);
    assert_eq!(
        submission.verify_pre_commitment(),
        Err(SubmissionError::PreCommitment)
    );
}

/// Approval refuses a content commitment formed over the payload bytes, and accepts the one formed over the content pre-digest.
/// ´claim:proposal:approval-refuses-a-content-commitment-over-the-payload´
#[test]
fn approval_refuses_a_content_commitment_over_the_payload() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let pre = pre_signed(&actor, b"hello");
    let sealed = host_side(&pre.submission(), &host);
    let host_key = host.verifying_key().to_bytes();

    let mut over_payload = sealed.clone();
    over_payload.act.content_commitment = crypto::commitment(
        domain_tags::COMMIT_CONTENT,
        pre.act_id().to_string().as_bytes(),
        &sealed.act.pre_commitment,
        &sealed.content_salt,
        &pre.proposal.payload,
    )
    .to_vec();
    let over_payload = reseal(over_payload, &host);
    assert!(over_payload.verify_seal(&host_key));
    assert!(pre.approve(&actor, &over_payload, &host_key).is_err());

    let witness = pre
        .approve(&actor, &sealed, &host_key)
        .expect("a commitment over the content pre-digest approves");
    assert!(sealed.verify_approval(&pre.author_pubkey, &witness));
}

/// Two pre-signs of one proposal share no nonce, and within one the content and dependency nonces differ.
/// ´claim:proposal:pre-signing-draws-two-fresh-independent-nonces´
#[test]
fn pre_signing_draws_two_fresh_independent_nonces() {
    let actor = ActorKey::generate();
    let draft = proposal(&actor.address(), b"hello");
    let a = PreSigned::sign(&actor, draft.clone());
    let b = PreSigned::sign(&actor, draft);
    let nonces = [
        &a.content_nonce,
        &a.dependency_nonce,
        &b.content_nonce,
        &b.dependency_nonce,
    ];
    for (i, x) in nonces.iter().enumerate() {
        assert_eq!(x.len(), crypto::SALT_LEN);
        for y in &nonces[i + 1..] {
            assert_ne!(x, y);
        }
    }
    assert_ne!(a.pre_commitment(), b.pre_commitment());
}

/// The blob round-trips with both nonces and the signature in their
/// places; the blob of one shared nonce is refused as its version.
///
/// The pre-commitment blob round-trips, and a version-1 blob is refused as version 1.
/// ´claim:proposal:the-blob-round-trips-and-refuses-version-one´
#[test]
fn the_blob_round_trips_and_refuses_version_one() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let pre = pre_signed(&actor, b"hello");
    let blob = pre.pre_commitment_blob();
    assert_eq!(
        PreCommitmentBlob::decode(&blob.encode()).expect("decodes"),
        blob
    );
    assert_eq!(blob.content_nonce, CONTENT_NONCE);
    assert_eq!(blob.dependency_nonce, DEPENDENCY_NONCE);
    let v1 = wire_v1::encode_pre_commitment(&CONTENT_NONCE, &pre.pre_signature);
    assert!(matches!(
        PreCommitmentBlob::decode(&v1),
        Err(WireError::Version(1))
    ));
    let mut e = Encoder::new();
    e.array(3).uint(2).bytes(b"n").bytes(b"s");
    assert!(matches!(
        PreCommitmentBlob::decode(&e.finish()),
        Err(WireError::Shape(_))
    ));
}

/// The sealed act round-trips; a version-1 verified act is refused as version 1.
/// ´claim:proposal:the-sealed-act-round-trips-and-refuses-version-one´
#[test]
fn the_sealed_act_round_trips_and_refuses_version_one() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let sealed = host_side(&pre_signed(&actor, b"hello").submission(), &host);
    assert_eq!(
        SealedAct::decode(&sealed.encode()).expect("decodes"),
        sealed
    );
    let mut padded = sealed.encode();
    padded.push(0);
    assert!(SealedAct::decode(&padded).is_err());

    let v1 = crate::l1::handshake::VerifiedAct {
        proposal: proposal("a", b"x"),
        author_pubkey: vec![1; 32],
        nonce: vec![2; 32],
        pre_signature: vec![3; 64],
        pre_commitment: vec![9; 32],
        content_salt: vec![4; 32],
        deps_salt: vec![5; 32],
        content_commitment: vec![6; 32],
        deps_commitment: vec![7; 32],
        content_edition: 1,
        deps_edition: 1,
        host_seal: vec![8; 64],
    };
    assert!(matches!(
        SealedAct::decode(&wire_v1::encode_verified_act(&v1)),
        Err(WireError::Version(1))
    ));
}

/// The encoded sealed act is searched for the payload and both nonces,
/// byte for byte: a payload long enough not to occur by chance, and
/// nonces of distinct fixed runs.
///
/// The sealed act on the wire carries neither the payload nor either nonce.
/// ´claim:proposal:the-sealed-act-carries-no-payload-and-no-nonce´
#[test]
fn the_sealed_act_carries_no_payload_and_no_nonce() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let payload = b"a payload long enough that no hash or key repeats it";
    let pre = pre_signed(&actor, payload);
    let wire = host_side(&pre.submission(), &host).encode();
    let contains = |needle: &[u8]| wire.windows(needle.len()).any(|w| w == needle);
    assert!(!contains(payload));
    assert!(!contains(&CONTENT_NONCE));
    assert!(!contains(&DEPENDENCY_NONCE));
    assert!(
        contains(&pre.pre_signature),
        "the search finds what is there"
    );
}

/// The host side is handed a submission destructured field by field —
/// the exhaustive pattern is the proof that no payload and no content
/// nonce exist anywhere in its scope — and it verifies, seals, and
/// produces an act the device approves.
///
/// Host verification and sealing need neither the payload nor the content nonce.
/// ´claim:proposal:the-host-needs-neither-payload-nor-content-nonce´
#[test]
fn the_host_needs_neither_payload_nor_content_nonce() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let pre = pre_signed(&actor, b"hello");

    fn host_scope(submission: Submission, host: &SigningKey) -> SealedAct {
        let Submission {
            body,
            deps,
            dependency_nonce,
            content_pre_digest,
            pre_commitment,
            pre_signature,
            author_pubkey,
        } = submission;
        let rebuilt = Submission::new(
            body,
            deps,
            dependency_nonce,
            content_pre_digest,
            pre_commitment,
            pre_signature,
            author_pubkey,
        );
        assert_eq!(rebuilt.verify_pre_commitment(), Ok(()));
        host_side(&rebuilt, host)
    }

    let sealed = host_scope(pre.submission(), &host);
    assert!(
        pre.approve(&actor, &sealed, &host.verifying_key().to_bytes())
            .is_ok()
    );
}

/// Derived float equality calls 0.0 and -0.0 the same, so the body is compared by the bytes it signs, not by `==`.
///
/// Approval refuses a returned body whose canonical bytes differ from the pre-signed body's, though it compares equal.
/// ´claim:proposal:approval-compares-the-body-by-its-canonical-bytes´
#[test]
fn approval_compares_the_body_by_its_canonical_bytes() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let host_key = host.verifying_key().to_bytes();
    let mut proposal = proposal(&actor.address(), b"hello");
    proposal.body.p_d = 0.0;
    let pre = PreSigned::sign_with_nonces(
        &actor,
        proposal,
        CONTENT_NONCE.to_vec(),
        DEPENDENCY_NONCE.to_vec(),
    );
    let mut sealed = host_side(&pre.submission(), &host);
    sealed.act.body.p_d = -0.0;
    assert_eq!(
        sealed.act.body, pre.proposal.body,
        "derived equality agrees"
    );
    assert_ne!(
        sealed.act.body.canonical_bytes(),
        pre.proposal.body.canonical_bytes()
    );
    let sealed = reseal(sealed, &host);
    match pre.approve(&actor, &sealed, &host_key) {
        Err(ClientError::Authentication(why)) => {
            assert_eq!(why, "host returned a different act than was pre-signed");
        }
        other => panic!("expected the different-act refusal, got {other:?}"),
    }
}

/// The content nonce conceals the payload, so a log line of the pre-signed proposal must not carry its bytes.
///
/// The pre-signed proposal's Debug output omits the content nonce's bytes and still shows the act.
/// ´claim:proposal:the-pre-signed-debug-output-omits-the-content-nonce´
#[test]
fn the_pre_signed_debug_output_omits_the_content_nonce() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let pre = PreSigned::sign_with_nonces(
        &actor,
        proposal(&actor.address(), b"hello"),
        vec![0xc7; crypto::SALT_LEN],
        DEPENDENCY_NONCE.to_vec(),
    );
    let shown = format!("{pre:?}");
    assert!(!shown.contains(&"c7".repeat(crypto::SALT_LEN)));
    let decimal = format!("{:?}", pre.content_nonce);
    assert!(!shown.contains(&decimal));
    assert!(!shown.contains("199, 199"));
    assert!(shown.contains(&actor.address()));
    assert!(shown.contains("<32 bytes>"));
}

/// The host refuses a key that parses but is not the body author's, even when the signature verifies under it.
///
/// A submission pre-signed correctly by another actor's key for a body whose author is someone else is refused.
/// ´claim:proposal:a-submission-under-another-actors-key-is-refused´
#[test]
fn a_submission_under_another_actors_key_is_refused() {
    let author = ActorKey::from_seed([7u8; 32]);
    let other = ActorKey::from_seed([8u8; 32]);
    let pre = PreSigned::sign_with_nonces(
        &other,
        proposal(&author.address(), b"hello"),
        CONTENT_NONCE.to_vec(),
        DEPENDENCY_NONCE.to_vec(),
    );
    let submission = pre.submission();
    assert_eq!(
        submission.verify_pre_commitment(),
        Err(SubmissionError::AuthorKey)
    );
}

/// The host refuses a content pre-digest the author did not sign, a
/// signature that is not the author's, and a key that does not parse.
///
/// A submission whose pre-digest, signature or key is not the author's is refused.
/// ´claim:proposal:a-submission-not-the-authors-is-refused´
#[test]
fn a_submission_not_the_authors_is_refused() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let submission = pre_signed(&actor, b"hello").submission();

    let mut digest = submission.clone();
    digest.content_pre_digest[0] ^= 1;
    assert_eq!(
        digest.verify_pre_commitment(),
        Err(SubmissionError::PreCommitment)
    );
    let mut dependency = submission.clone();
    dependency.dependency_nonce[0] ^= 1;
    assert_eq!(
        dependency.verify_pre_commitment(),
        Err(SubmissionError::PreCommitment)
    );
    let mut signature = submission.clone();
    signature.pre_signature =
        ActorKey::from_seed([8u8; 32]).sign_digest(&submission.pre_commitment);
    assert_eq!(
        signature.verify_pre_commitment(),
        Err(SubmissionError::PreSignature)
    );
    let mut key = submission.clone();
    key.author_pubkey = vec![0; 31];
    assert_eq!(key.verify_pre_commitment(), Err(SubmissionError::AuthorKey));
    assert!(
        digest
            .seal(&host, vec![1; crypto::SALT_LEN], vec![2; crypto::SALT_LEN])
            .is_err()
    );
}

/// The same salt and pre-commitment commit differently over the content pre-digest and over the payload it digests.
/// ´claim:proposal:the-content-commitment-is-formed-over-the-pre-digest´
#[test]
fn the_content_commitment_is_formed_over_the_pre_digest() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let pre = pre_signed(&actor, b"hello");
    let salt = [1u8; crypto::SALT_LEN];
    let p = pre.pre_commitment();
    let over_digest = content_commitment(&pre.act_id(), &p, &salt, &pre.content_pre_digest());
    assert_eq!(
        over_digest,
        crypto::sha256_tagged(
            domain_tags::COMMIT_CONTENT,
            &[
                pre.act_id().to_string().as_bytes(),
                &p,
                &salt,
                &pre.content_pre_digest()
            ]
        )
    );
    assert_ne!(
        over_digest,
        crypto::commitment(
            domain_tags::COMMIT_CONTENT,
            pre.act_id().to_string().as_bytes(),
            &p,
            &salt,
            &pre.proposal.payload
        )
    );
    assert_eq!(
        pre.content_pair().pre_digest(&pre.act_id()),
        pre.content_pre_digest()
    );
}

/// Approval refuses a returned body, pre-commitment or pre-signature
/// that differs from the pre-signed one, either edition off its
/// constant, a seal by another key, and a salt swapped after sealing —
/// each resealed validly where a seal is involved, so only the device's
/// own check can catch it.
///
/// Approval refuses anything it cannot recompute from what it pre-signed and holds.
/// ´claim:proposal:approval-refuses-what-the-device-cannot-recompute´
#[test]
fn approval_refuses_what_the_device_cannot_recompute() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let host_key = host.verifying_key().to_bytes();
    let pre = pre_signed(&actor, b"hello");
    let sealed = host_side(&pre.submission(), &host);

    let mut body = sealed.clone();
    body.act.body.p_d = -1.0;
    let mut foreign = sealed.clone();
    foreign.act.pre_commitment = vec![0x55; 32];
    foreign.act.content_commitment = content_commitment(
        &pre.act_id(),
        &foreign.act.pre_commitment,
        &foreign.content_salt,
        &pre.content_pre_digest(),
    )
    .to_vec();
    foreign.act.dependency_commitment = dependency_commitment(
        &pre.act_id(),
        &foreign.act.pre_commitment,
        &foreign.dependency_salt,
        &pre.proposal.deps,
    )
    .to_vec();
    let mut signature = sealed.clone();
    signature.act.pre_signature = vec![0; 64];
    let mut content_edition = sealed.clone();
    content_edition.act.content_edition = 1;
    let mut dependency_edition = sealed.clone();
    dependency_edition.act.dependency_edition = 2;
    let mut salt = sealed.clone();
    salt.content_salt = vec![9; crypto::SALT_LEN];
    let mut dependency_salt = sealed.clone();
    dependency_salt.dependency_salt = vec![9; crypto::SALT_LEN];

    for tampered in [
        body,
        foreign,
        signature,
        content_edition,
        dependency_edition,
    ] {
        let tampered = reseal(tampered, &host);
        assert!(pre.approve(&actor, &tampered, &host_key).is_err());
    }
    for unsealed in [salt, dependency_salt] {
        assert!(pre.approve(&actor, &unsealed, &host_key).is_err());
    }
    let impostor = SigningKey::generate(&mut OsRng);
    assert!(
        pre.approve(&actor, &reseal(sealed, &impostor), &host_key)
            .is_err()
    );
}

/// The approval witness signs the encoded verified act and its seal together, and the reference host seal covers the same encoding the earlier handshake's seal covered.
/// ´claim:proposal:the-approval-signs-the-verified-act-and-its-seal´
#[test]
fn the_approval_signs_the_verified_act_and_its_seal() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let pre = pre_signed(&actor, b"hello");
    let sealed = host_side(&pre.submission(), &host);
    let witness = pre
        .approve(&actor, &sealed, &host.verifying_key().to_bytes())
        .expect("approves");
    assert_eq!(witness.act_id, pre.act_id());
    assert!(sealed.verify_approval(&pre.author_pubkey, &witness));
    let mut reseal = sealed.clone();
    reseal.host_seal = crypto::sign(&host, b"another seal", &sealed.act.seal_message());
    assert!(!reseal.verify_approval(&pre.author_pubkey, &witness));
    assert_eq!(
        sealed.approval_digest(),
        crypto::sha256_tagged(
            crypto::tags::APPROVAL,
            &[&sealed.act.seal_message(), &sealed.host_seal]
        )
    );
}

/// Recovery rebuilds the pre-signed proposal from the held proposal and
/// nonces and the act's pre-signature, and the witness it then signs is
/// the ordinary one.
///
/// Recovery proves authorship from held material and signs the very approval the ordinary step signs.
/// ´claim:proposal:recovery-proves-authorship-and-signs-the-same-approval´
#[test]
fn recovery_proves_authorship_and_signs_the_same_approval() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let host_key = host.verifying_key().to_bytes();
    let pre = pre_signed(&actor, b"hello");
    let sealed = host_side(&pre.submission(), &host);
    let recovered = PreSigned::recover(
        &actor,
        pre.proposal.clone(),
        CONTENT_NONCE.to_vec(),
        DEPENDENCY_NONCE.to_vec(),
        &sealed.act,
    )
    .expect("recovers");
    assert_eq!(recovered, pre);
    assert_eq!(
        recovered
            .approve(&actor, &sealed, &host_key)
            .expect("approves")
            .approval_signature,
        pre.approve(&actor, &sealed, &host_key)
            .expect("approves")
            .approval_signature
    );
}

/// Recovery refuses an act of another author, a payload the key never
/// pre-signed, and a content nonce other than the one held.
///
/// (´claim:proposal:recovery-proves-authorship-and-signs-the-same-approval´)
#[test]
fn recovery_refuses_what_this_key_did_not_pre_sign() {
    let actor = ActorKey::from_seed([7u8; 32]);
    let other = ActorKey::from_seed([8u8; 32]);
    let host = SigningKey::generate(&mut OsRng);
    let pre = pre_signed(&actor, b"hello");
    let sealed = host_side(&pre.submission(), &host);
    let recover = |key: &ActorKey, proposal: Proposal, content_nonce: &[u8]| {
        PreSigned::recover(
            key,
            proposal,
            content_nonce.to_vec(),
            DEPENDENCY_NONCE.to_vec(),
            &sealed.act,
        )
    };
    assert!(recover(&other, pre.proposal.clone(), &CONTENT_NONCE).is_err());
    let mut tampered = pre.proposal.clone();
    tampered.payload = b"tampered".to_vec();
    assert!(recover(&actor, tampered, &CONTENT_NONCE).is_err());
    assert!(recover(&actor, pre.proposal.clone(), &DEPENDENCY_NONCE).is_err());
}
