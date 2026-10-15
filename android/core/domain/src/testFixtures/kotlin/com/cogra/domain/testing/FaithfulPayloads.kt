// What a faithful prepare stages as a payload: the canonical envelope whose
// fields are exactly the expectation's, encoded with core:crypto's own
// codec in the shapes the reference produces (crates/common/src/envelope).
// A view-model test whose fake prepare stages through here passes the real
// signer's intent check exactly when the view model ordered what the test
// says it did.

package com.cogra.domain.testing

import com.cogra.crypto.COGRA_GUILD_KEY
import com.cogra.crypto.Envelope
import com.cogra.crypto.EnvelopeValue
import com.cogra.crypto.encodeEnvelope
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetState
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.media.MediaReadiness
import com.cogra.domain.signing.AssetExpectation
import com.cogra.domain.signing.AvatarExpectation
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.ExpectedContent
import com.cogra.domain.signing.ExpectedProfile
import com.cogra.domain.signing.PayloadExpectation
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.SentProfile
import com.cogra.domain.signing.contentExpectation
import com.cogra.domain.signing.galleryMediaIds
import com.cogra.domain.signing.known
import com.cogra.domain.signing.profileExpectation
import com.cogra.domain.signing.profileUpdate
import java.security.MessageDigest

/** A digest a fake asset answers with — derived from its id, so a test never transcribes one. */
fun fakeDigest(id: String): String =
    MessageDigest.getInstance("SHA-256").digest(id.toByteArray()).joinToString("") { "%02x".format(it) }

/** The type a fake asset is read as: a `v…` id is a clip, anything else a still. */
fun fakeMime(id: String): String = if (id.startsWith("v")) "video/mp4" else "image/webp"

/** An upload as a faithful fake answers it: both digests derived from the id, a real type. */
fun fakeUpload(
    id: String,
    state: MediaAssetState = MediaAssetState.READY,
    mime: String = fakeMime(id),
): MediaAssetView = MediaAssetView(
    id = id,
    url = "https://media/$id",
    altText = null,
    status = FieldStatus.NORMAL,
    aspectRatio = 1f,
    mimeType = mime,
    state = state,
    digest = fakeDigest(id),
    uploadDigest = fakeDigest(id),
)

/** The same asset read back by id, as `mediaAttachment` answers it. */
fun fakeReadiness(
    id: String,
    state: MediaAssetState = MediaAssetState.READY,
    failureReason: String? = null,
    mime: String = fakeMime(id),
): MediaReadiness = MediaReadiness(id, state, failureReason, fakeDigest(id), fakeDigest(id), mime)

/**
 * A media repository whose read-back answers every id READY with the digests
 * [fakeUpload] hands out — what an edit's kept placements are checked against.
 */
open class FaithfulMediaRepository : ThrowingMediaRepository() {
    override suspend fun mediaAttachment(id: String): Outcome<MediaReadiness?> = Outcome.Success(fakeReadiness(id))
}

/** Content node ids shaped like the server's, so a payload can bind to them. */
const val TEST_NODE_ID = "22222222-2222-4222-8222-222222222222"
const val TEST_POST_ID = "33333333-3333-4333-8333-333333333333"
const val TEST_COMMENT_ID = "44444444-4444-4444-8444-444444444444"

/**
 * What a faithful prepare's content payload decodes to: the request exactly
 * as sent, every asset it names with the digests [fakeUpload] hands out.
 */
fun faithfulContent(
    node: String,
    sent: SentContent,
    shape: ContentShape,
): ExpectedContent =
    contentExpectation(node, sent, shape, galleryMediaIds(sent.attachments).associateWith { fakeUpload(it).known() })

private fun text(s: String?): EnvelopeValue? = s?.let { EnvelopeValue.TextValue(it) }

private fun bytes(hex: String): EnvelopeValue = EnvelopeValue.BytesValue(hex)

private fun map(vararg entries: Pair<Long, EnvelopeValue?>): EnvelopeValue.MapValue =
    EnvelopeValue.MapValue(
        entries.mapNotNull { (k, v) -> v?.let { k.toULong() to it } }.sortedBy { it.first },
    )

private fun asset(e: AssetExpectation): EnvelopeValue = when (e) {
    is AssetExpectation.Asset -> map(
        0L to bytes(e.digest),
        1L to EnvelopeValue.TextValue(e.mime),
        2L to text(e.altText),
        3L to e.cover?.let(::bytes),
        4L to EnvelopeValue.BoolValue(true).takeIf { e.coverTaken },
        5L to bytes(e.uploadDigest),
    )
    // Nothing on the device can state it; a faithful server still names some
    // bytes, which the check then refuses.
    is AssetExpectation.Unknown -> map(
        0L to bytes(fakeDigest(e.mediaId)),
        1L to EnvelopeValue.TextValue("image/webp"),
        5L to bytes(fakeDigest(e.mediaId)),
    )
}

private fun nodeBytes(node: String): EnvelopeValue = bytes(node.replace("-", ""))

private fun content(c: ExpectedContent): EnvelopeValue.MapValue = map(
    0L to EnvelopeValue.UintValue(1u),
    1L to nodeBytes(c.node),
    2L to text(c.title),
    3L to text(c.description),
    4L to text(c.body),
    5L to c.media.takeIf { it.isNotEmpty() }?.let { media -> EnvelopeValue.ArrayValue(media.map(::asset)) },
    13L to c.sensitive?.let { EnvelopeValue.UintValue(1u) },
    14L to text(c.sensitive?.reason),
)

private fun profile(p: ExpectedProfile): EnvelopeValue.MapValue = map(
    0L to EnvelopeValue.UintValue(1u),
    1L to nodeBytes(p.node),
    7L to text(p.displayName),
    8L to text(p.bio),
    9L to text(p.websiteUrl),
    11L to when (val avatar = p.avatar) {
        AvatarExpectation.Untouched -> null
        AvatarExpectation.Cleared -> EnvelopeValue.ArrayValue(emptyList())
        is AvatarExpectation.Replaced -> EnvelopeValue.ArrayValue(listOf(asset(avatar.asset)))
    },
)

private fun guildEnvelope(guild: EnvelopeValue.MapValue): ByteArray =
    encodeEnvelope(Envelope(List(4) { 1uL }, "", listOf(COGRA_GUILD_KEY to guild)))

/** A profile id shaped like the server's, so a payload can bind to it. */
const val TEST_PROFILE_ID = "11111111-1111-4111-8111-111111111111"

/**
 * What a faithful prepare of a profile update stages: the fields exactly as
 * sent, and an avatar whose digests are the ones [fakeUpload] handed out.
 */
fun faithfulProfileUpdate(
    profileId: String,
    sent: SentProfile,
): Expectation {
    val ledger = (sent.avatar as? MediaFieldUpdate.Set)
        ?.let { mapOf(it.mediaId to fakeUpload(it.mediaId).known()) }
        .orEmpty()
    return Expectation(listOf(profileUpdate(profileExpectation(profileId, sent, ledger))))
}

/** The payload a faithful prepare stages for [e]. */
fun faithfulPayload(e: PayloadExpectation): ByteArray = when (e) {
    PayloadExpectation.Empty -> ByteArray(0)
    is PayloadExpectation.Content -> guildEnvelope(content(e.content))
    is PayloadExpectation.Profile -> guildEnvelope(profile(e.profile))
}
