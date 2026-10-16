// The intent check (architecture.md "The write path", step 2; web mirror:
// src/lib/signing/intent.ts). The transport check proves the device signs
// exactly the bytes it pre-signed; this proves those bytes are the gesture
// its user ordered. Before the first pre-signature of a batch, the device
// rebuilds what every act's structural body must be from the form state the
// gesture was made with — the EXPECTATION — and refuses the whole batch on
// any write that is extra, missing, or different.
//
// WHAT IS COMPARED, AND WHAT IS NOT. Every author-meaning field of the
// structural body: family, author, middle, target, both parameters, the
// settlement reference, the license, the asserted parents — and the
// payload's FIELDS, read by the device's own envelope decoder
// (core:crypto Envelope.kt): the node the payload binds to, the title,
// description and words, the gallery in order with each picture's
// description, poster and both digests, the self-mark, and a profile's
// name, bio, website and avatar. The sequence value and the dependency
// list are not: the seq is allocated by the backend, and dependencies are
// server-completed ordering facts the author never chose — L1 refuses an
// unsatisfiable one.
//
// THE SERVER'S NORMALIZATION IS PART OF THE EXPECTATION (ServerText.kt):
// Rust's `str::trim`, whose whitespace set Kotlin's `trim` does not share.
//
// BOTH DIGESTS, ALWAYS. Every manifest entry carries the rendition digest
// the device read for the asset at READY and the upload digest the device
// computed over the bytes it sent. A placement the device can state
// neither of is refused: there is nothing to check it against.
//
// EXACT, NEVER APPROXIMATE. Parameters compare as numbers with no
// tolerance: no server default stands in for a value the form did not
// hold, so a server that rounds has changed the order. The two zeros are
// one value, as on web, whose JSON cannot carry the sign of zero.
//
// A NETTING BATCH IS CHECKED AS A PROPERTY. Severance and citation
// withdrawal stage counter-records the server computes from the bundle, so
// the device cannot know each write in advance. It checks instead that
// every counter-record points where the shown bundle points, stays in
// range, that there are exactly as many as the cost shown, and that the
// shown raw sums plus the batch net to exactly (0, 0) — the records carry
// picked values, never deltas (design.md §8.1).
//
// The check itself is IntentCheck.kt, the per-gesture builders IntentBuilders.kt;
// the shared `intent-vectors.json` pins them and intent.ts to the same verdicts
// over the same canonical bytes.

package com.cogra.domain.signing

import com.cogra.crypto.Family
import java.util.Locale

/** Where an expected write's middle or target must point. */
sealed interface NodeExpectation {
    /** Exactly this node — a raw L1 identifier read off the screen. */
    data class Node(val id: String) : NodeExpectation

    /** The node this write mints: `mint:<its own act id>`. */
    data object OwnMint : NodeExpectation

    /** The node another write of the same batch mints, by its index in `writes`. */
    data class MintedBy(val write: Int) : NodeExpectation

    /** The author's own profile, `prof:<author>`. */
    data object OwnProfile : NodeExpectation
}

/** None, or exactly one parent: the head of the author's own chain on this node. */
enum class Parents { NONE, OWN_CHAIN_HEAD }

/** One manifest entry the gesture ordered — or one it cannot state. */
sealed interface AssetExpectation {
    /** Every key the envelope carries; digests in lowercase hex. */
    data class Asset(
        /** The rendition digest the device read for the asset at READY. */
        val digest: String,
        val mime: String,
        val altText: String?,
        /** The poster's rendition digest. */
        val cover: String?,
        val coverTaken: Boolean,
        /** The upload digest the device computed over the bytes it sent. */
        val uploadDigest: String,
    ) : AssetExpectation

    /** A placement the device can state nothing about: it never matches. */
    data class Unknown(val mediaId: String) : AssetExpectation
}

/** What a content payload must decode to. */
data class ExpectedContent(
    /** The L2 node id the prepare named for this content. */
    val node: String,
    val title: String?,
    val description: String?,
    val body: String?,
    val media: List<AssetExpectation>,
    /** Null when unmarked; otherwise the mark, its reason possibly absent. */
    val sensitive: ExpectedMark?,
)

/** The author's own self-mark, as the payload must carry it. */
data class ExpectedMark(val reason: String?)

/** The avatar slot: three-valued, each value one encoding. */
sealed interface AvatarExpectation {
    data object Untouched : AvatarExpectation

    data object Cleared : AvatarExpectation

    data class Replaced(val asset: AssetExpectation) : AvatarExpectation
}

/** What a profile payload must decode to. */
data class ExpectedProfile(
    val node: String,
    val displayName: String?,
    val bio: String?,
    val websiteUrl: String?,
    val avatar: AvatarExpectation,
)

/** A write's payload: none at all, or an envelope whose fields are stated. */
sealed interface PayloadExpectation {
    data object Empty : PayloadExpectation

    data class Content(val content: ExpectedContent) : PayloadExpectation

    data class Profile(val profile: ExpectedProfile) : PayloadExpectation
}

/** One write the gesture ordered, field by field. */
data class ExpectedWrite(
    val family: Family,
    val middle: NodeExpectation?,
    val target: NodeExpectation,
    val pDirected: Double,
    val pInterest: Double,
    val license: String?,
    val parents: Parents,
    val payload: PayloadExpectation,
)

/** A walk-back the server computes: checked as a net-to-zero property. */
data class ExpectedNetting(
    val family: Family,
    val middle: String?,
    val target: String,
    /** The raw sums the read surface served, before the clip. */
    val rawPDirected: Double,
    val rawPInterest: Double,
    /** The record count the user was shown as the gesture's cost. */
    val cost: Int,
)

/** What the device checks a staged write against before it signs. */
sealed interface Intent

/** What a gesture's batch must be, rebuilt from its form state. */
data class Expectation(
    val writes: List<ExpectedWrite>,
    val netting: List<ExpectedNetting> = emptyList(),
) : Intent

/**
 * The first named exemption: the admission Registration, which the backend
 * stages at approval and the device discovers on its status poll with no
 * form behind it. It still runs every transport check, and it holds only
 * for a Registration.
 */
data object RegistrationExemption : Intent

/**
 * The second named exemption (PR-88): a carried write released by the landing
 * on a device that holds no prepare-time expectation for it — the write was
 * prepared, and intent-checked, on another device (Carried.kt). It still runs
 * every transport check. Internal: chosen only by the signer's landing path
 * (WriteSigner.signCarriedAtLanding), never by a surface.
 */
internal data object CarriedAtLandingExemption : Intent

/**
 * A released carried write as this device verified it at its prepare: the
 * proposal's digest, dependencies excluded (Carried.kt). Internal, like the
 * exemption: only the landing path holds one.
 */
internal class CarriedExpectation(val digest: ByteArray) : Intent

/** The device found the batch is not what its user ordered. */
class IntentMismatchException(message: String) : Exception(message)

/** Joins the expectations of several prepares a single gesture signs as one batch. */
fun joinExpectations(parts: List<Expectation>): Expectation {
    val writes = mutableListOf<ExpectedWrite>()
    val netting = mutableListOf<ExpectedNetting>()
    for (part in parts) {
        val offset = writes.size
        for (write in part.writes) {
            writes += write.copy(middle = write.middle?.shifted(offset), target = write.target.shifted(offset))
        }
        netting += part.netting
    }
    return Expectation(writes, netting)
}

private fun NodeExpectation.shifted(offset: Int): NodeExpectation =
    if (this is NodeExpectation.MintedBy) NodeExpectation.MintedBy(write + offset) else this

// ---- the names an expectation is built from --------------------------------

/** A node read off the screen, by its raw L1 identifier. */
fun node(id: String): NodeExpectation = NodeExpectation.Node(id)

/** The Type a topic name canonicalizes to (hashtag.md §1): one leading `#` off, ASCII lowercase. */
fun topicNode(name: String): String = "name:${name.removePrefix("#").lowercase(Locale.ROOT)}"

/** Affinity toward a Type, Opinion toward everything else (edges.md §2). */
fun stanceFamilyOf(targetGraphId: String): Family =
    if (targetGraphId.startsWith("name:")) Family.AFFINITY else Family.OPINION

/**
 * The license string a record carries (data-model.md "License
 * qualifiers"): `a=<degree>;o=<degree>`, each rendered to three decimals
 * with trailing zeros trimmed — the server's `License::canonical`.
 */
fun canonicalLicense(attribution: Double, provenance: Double): String {
    fun axis(x: Double): String = String.format(Locale.ROOT, "%.3f", x).trimEnd('0').trimEnd('.')
    return "a=${axis(attribution)};o=${axis(provenance)}"
}
