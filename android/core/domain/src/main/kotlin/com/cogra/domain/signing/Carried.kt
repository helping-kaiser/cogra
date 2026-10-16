// THE CARRIED BRANCH OF THE INTENT CHECK (PR-88, CI-G5 ruled (a)+(a1); web
// mirror: carried.ts).
//
// An applicant's once-each post, Opinion and Affinity are CARRIED: the
// prepare stages them, and the device signs them only at the landing, days or
// weeks later, without a prompt (auth.md "Application"). The landing holds no
// form. So the check runs where the form exists — at the prepare, on the
// preparing device, through the ordinary batch check (WriteSigner.sign) — and
// what it verified is kept in device custody, keyed by the staged write's id:
// a DIGEST of the verified proposal EXCLUDING its dependencies. The landing
// appends the ruled dependency completion (`[admission Registration, winning
// vouch]`), so a digest over the body and the payload alone is what stays
// equal; the device signs the released write only when the served proposal
// still digests to it.
//
// A landing seen on a device that holds no expectation for an Opinion — the
// write was prepared on another device — signs it under the second named
// exemption, [CarriedAtLandingExemption]: the act WAS checked once, where it
// was ordered. A device that held the expectation and lost it with its
// custody set does the same: custody absent is custody absent. The exemption
// holds for an Opinion alone (PR-105); any other family without an
// expectation refuses the whole released batch.
//
// The expectation lives in the account's identity slot (IdentityStore), so it
// follows the draft's fate there: locked with it (it is no key material, so a
// backed key's purge never takes it), purged with the whole set.

package com.cogra.domain.signing

import com.cogra.crypto.Proposal
import com.cogra.crypto.sha256Tagged
import com.cogra.domain.StagedWriteView

/**
 * The digest's domain tag. Device-local — the digest never leaves the device
 * and nothing else verifies it — but tagged like every other hash, so it can
 * never stand in for one of them.
 */
const val CARRIED_EXPECTATION_TAG = "cogra-client:carried-expectation:v1"

/**
 * The verified proposal's digest, its dependencies excluded: the canonical
 * structural body (identity, endpoints, both parameters, license, asserted
 * parents) and the payload bytes, each length-framed.
 */
fun carriedDigest(proposal: Proposal): ByteArray =
    sha256Tagged(CARRIED_EXPECTATION_TAG, listOf(proposal.body.canonicalBytes(), proposal.payload))

/** Whether the released batch may sign now. */
sealed interface CarriedLandingReadiness {
    data object Ready : CarriedLandingReadiness

    /** Not yet: nothing is signed and nothing is spent; the next poll asks again. */
    data class NotReady(val reason: String) : CarriedLandingReadiness
}

/**
 * THE CARRIED LANDING GATE — the one precondition the landing consults after
 * the batch passed its intent check and BEFORE its first pre-signature
 * (WriteSigner.signCarriedAtLanding).
 *
 * PR-89(iii): a carried act's media waits in an author-only area until the
 * landing moves it to the public store, and the move is CONFIRMED GOOD before
 * the carried act signs ("so we dont run the risk of a broken post"); a failed
 * or unverified move refuses the sign, retryable. That verification is wired
 * in HERE, by the media-areas build — the binding is core:network's
 * `NetworkProvidesModule.carriedLandingGate`. Until it is, the gate answers
 * [CarriedLandingReadiness.Ready] ([AlwaysReady]): the move does not exist
 * yet, so there is nothing to wait for.
 */
fun interface CarriedLandingGate {
    suspend fun readiness(batch: List<StagedWriteView>): CarriedLandingReadiness

    companion object {
        /** The gate before any precondition is wired: nothing to wait for. */
        val AlwaysReady = CarriedLandingGate { CarriedLandingReadiness.Ready }
    }
}

/** Why a released batch was held back: the gate's reason, as a retryable failure. */
class CarriedLandingNotReadyException(reason: String) : Exception(reason)
