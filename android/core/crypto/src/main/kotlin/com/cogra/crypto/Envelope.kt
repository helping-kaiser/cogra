// The payload envelope, read on the device (reference:
// crates/common/src/envelope/{pce,cogra,media}.rs; web mirror:
// web/src/lib/crypto/envelope.ts). The server builds every envelope and the
// device signs it; reading it here is what lets the intent check compare a
// payload's FIELDS against the form, rather than trusting the server's
// rendering of what it put inside.
//
// TWO LAYERS, TWO OWNERS. `decodeEnvelope` is the L1 team's Peer Content
// Envelope (PCE v0.1.0): the magic tag 55799, a deterministic CBOR map with a
// four-axis version vector at key 0, a text body at key 1, and an extension
// map at key 2 whose keys from 100 up belong to guilds. Its gates run in the
// reference's order — magic, shape, package version, top-level key set, the
// §4.2 reserved range, the §4.4 empty-by-omission rule — and canonicality is
// checked the way the reference checks it: what was read is re-serialized,
// and anything that does not reproduce its own bytes is refused.
// `decodeContent` and `decodeProfile` are CoGra's guild schema under key
// 49258, the manifest's per-asset map included.
//
// DECODE ONLY, BY DESIGN. Nothing on the device produces an envelope; the
// encoder half below exists for the canonicality check alone.
//
// REFUSALS SPEAK THE REFERENCE'S WORDS. Every refusal carries the sentence
// the Rust decoder's error displays, so `envelope-vectors.json` pins the two
// readers to the same verdict AND the same reason. A refusal from the CBOR
// layer itself reads `decode`: the codec's wording is not contract.
//
// Digests are carried as lowercase hex, the form every other digest on the
// device takes, so two assets compare by value.
//
// The upload digest (manifest key 5) is read as optional: payloads landed
// before it existed carry none, and the refusal of an entry without it is the
// prepare's, not the reader's. The intent check, which knows what the device
// uploaded, refuses its absence in a payload being signed now.

package com.cogra.crypto

/** The self-describe tag every envelope is wrapped in (PCE §1.1). */
const val MAGIC_TAG: ULong = 55799uL

/** CoGra's guild key: 0xC06A. */
const val COGRA_GUILD_KEY: ULong = 49258uL

const val MEDIA_DIGEST_LEN: Int = 32

/** One decoded extension value, tagged by its CBOR type. */
sealed interface EnvelopeValue {
    data class UintValue(val value: ULong) : EnvelopeValue

    data class TextValue(val value: String) : EnvelopeValue

    /** Lowercase hex of the byte string. */
    data class BytesValue(val hex: String) : EnvelopeValue

    data class BoolValue(val value: Boolean) : EnvelopeValue

    data class ArrayValue(val items: List<EnvelopeValue>) : EnvelopeValue

    /** Ascending by key. */
    data class MapValue(val entries: List<Pair<ULong, EnvelopeValue>>) : EnvelopeValue
}

data class Envelope(
    val version: List<ULong>,
    val body: String,
    /** Ascending by key; empty when key 2 is absent. */
    val extensions: List<Pair<ULong, EnvelopeValue>>,
)

/** One manifest entry (guild key 5's array, or the avatar slot's one). */
data class EnvelopeAsset(
    /** The rendition digest — the bytes the asset serves (key 0), hex. */
    val digest: String,
    val mime: String,
    val altText: String?,
    val cover: String?,
    val coverTaken: Boolean,
    /** The upload digest — the bytes the device sent (key 5), hex; null in landed history. */
    val uploadDigest: String?,
)

data class SensitiveMark(val reason: String?)

/** A Publish or Review payload's guild fields. */
data class CograContent(
    /** The L2 node id, lowercase hyphenated. */
    val node: String,
    val title: String?,
    val description: String?,
    val body: String?,
    val media: List<EnvelopeAsset>,
    val sensitive: SensitiveMark?,
)

/** The avatar slot: three-valued, each value one encoding. */
sealed interface AvatarSlot {
    data object Untouched : AvatarSlot

    data object Cleared : AvatarSlot

    data class Replaced(val asset: EnvelopeAsset) : AvatarSlot
}

/** A profile update's guild fields. */
data class CograProfile(
    val node: String,
    val displayName: String?,
    val bio: String?,
    val websiteUrl: String?,
    val avatar: AvatarSlot,
)

/** The device refused a payload; [refusal] is the reference's own sentence. */
class EnvelopeException(
    val refusal: String,
    cause: Throwable? = null,
) : Exception(refusal, cause)

internal const val NON_CANONICAL = "non-canonical envelope encoding"

/** The guild map, or any map's entries: ascending integer keys. */
internal typealias GuildMap = List<Pair<ULong, EnvelopeValue>>

internal fun GuildMap.at(key: ULong): EnvelopeValue? = firstOrNull { it.first == key }?.second

internal fun guild(message: String) = EnvelopeException("cogra guild schema: $message")

internal fun shape(message: String) = EnvelopeException("malformed envelope: $message")

/** A refusal unless [ok]: the one place a check throws, so each gate reads as one line. */
internal fun ensure(
    ok: Boolean,
    refusal: () -> EnvelopeException,
) {
    if (!ok) throw refusal()
}
