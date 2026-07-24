// The device's two signing steps over wire blobs — the pure core shared
// by the write signer and the registration signer (substrate.md §6
// steps 2 and 4; the crypto itself lives in core:crypto). The device
// recomputes every signing base from the parsed proposal and verifies
// the host's additions before the approval signature — it never signs
// blind bytes (android.md "The actor key").

package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.decodeVerifiedAct
import com.cogra.crypto.encodePreCommitmentOf
import java.util.Base64

/** A pre-signed proposal and its wire-ready signature blob. */
class PreSignedStep(
    val pre: PreSignedProposal,
    /** The pre-commitment blob, base64 — the mutation's `signature` input. */
    val signatureBase64: String,
)

/**
 * Step 2 — pre-sign: parse the canonical proposal and bind it under a
 * fresh private nonce. Throws [com.cogra.crypto.WireException] on a
 * malformed blob.
 */
fun preSignStep(key: ActorKey, canonicalProposal: ByteArray): PreSignedStep {
    val pre = key.preSign(decodeProposal(canonicalProposal))
    return PreSignedStep(pre, Base64.getEncoder().encodeToString(encodePreCommitmentOf(pre)))
}

/**
 * Step 4 — approve: parse the sealed act, verify the host seal, the
 * exact returned body, and both commitment openings against [sent],
 * then sign the approval witness. Returns the witness signature,
 * base64. Throws [com.cogra.crypto.HandshakeException] when any
 * verification fails and [com.cogra.crypto.WireException] on a
 * malformed blob — the device refuses rather than signs.
 */
fun approveStep(
    key: ActorKey,
    sent: PreSignedProposal,
    verifiedAct: ByteArray,
    hostPublicKey: ByteArray,
): String {
    val witness = key.approve(sent, decodeVerifiedAct(verifiedAct), hostPublicKey)
    return Base64.getEncoder().encodeToString(witness.approvalSignature)
}
