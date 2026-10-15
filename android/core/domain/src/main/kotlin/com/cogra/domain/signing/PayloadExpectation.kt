// What a payload must decode to, rebuilt from the request the form sent
// (Intent.kt; web twin: src/lib/compose/payload-expectation.ts).
//
// THE EXPECTATION FOLLOWS THE WIRE, THEN THE SERVER. It is built from the
// same values the prepare call is handed, with the transport's own shaping
// ([wireReason]) and then the server's normalization (ServerText.kt): the
// title, description and alt text trimmed with Rust's `str::trim` and folded
// to absent when blank, a post's words and a self-mark's reason only
// blank-folded, a comment's words and a profile's fields carried untouched.
//
// EVERY ASSET IS ONE THIS DEVICE CAN STATE. A gallery entry's digests come
// from the device's own ledger: the uploads it made (each with the upload
// digest it computed and the rendition digest it read at READY), and, on an
// edit, the assets the edited version carries, read back by id. An entry the
// ledger cannot name becomes [AssetExpectation.Unknown], which no manifest
// entry matches — the gesture is refused rather than signed over it.

package com.cogra.domain.signing

import com.cogra.domain.AttachmentClaim
import com.cogra.domain.MediaAssetState
import com.cogra.domain.MediaAssetView
import com.cogra.domain.MediaFieldUpdate
import com.cogra.domain.Outcome
import com.cogra.domain.media.MediaReadiness
import com.cogra.domain.media.MediaRepository

/**
 * What the device knows about an asset it may attach: the rendition digest
 * it read at READY, the upload digest it computed over the bytes it sent,
 * and the type the server read them as. Digests are lowercase hex.
 */
data class KnownMedia(
    val digest: String,
    val uploadDigest: String,
    val mime: String,
)

/** An upload this device made, once READY: its own echo-checked digests. */
fun MediaAssetView.known(): KnownMedia = KnownMedia(digest, uploadDigest, mimeType)

/** An asset read back by id — how an edit learns what it carries over. */
fun MediaReadiness.known(): KnownMedia = KnownMedia(digest, uploadDigest, mimeType)

/** Whether a payload is a post's — words or media — or a comment's words-plus-media. */
enum class ContentShape { POST, COMMENT }

/**
 * The reason as the transport sends it beside a mark: only under the mark,
 * and a blank one not at all (RepositoryImpls `preparePost`). Shared so the
 * request and its expectation cannot read it two ways.
 */
fun wireReason(
    sensitive: Boolean,
    reason: String?,
): String? = reason?.takeIf { sensitive && it.isNotBlank() }

/** The fields a content prepare is sent, exactly as its caller hands them over. */
data class SentContent(
    val title: String? = null,
    val description: String? = null,
    val content: String?,
    val attachments: List<AttachmentClaim> = emptyList(),
    val sensitive: Boolean = false,
    /** The reason as it reaches the wire — see [wireReason]. */
    val sensitiveReason: String? = null,
)

private fun assetExpectation(
    claim: AttachmentClaim,
    ledger: Map<String, KnownMedia>,
): AssetExpectation {
    val known = ledger[claim.mediaId] ?: return AssetExpectation.Unknown(claim.mediaId)
    val coverId = claim.coverMediaId
    val cover = coverId?.let { ledger[it] ?: return AssetExpectation.Unknown(it) }
    return AssetExpectation.Asset(
        digest = known.digest,
        mime = known.mime,
        altText = serverChecked(claim.altText),
        cover = cover?.digest,
        coverTaken = claim.coverTaken && cover != null,
        uploadDigest = known.uploadDigest,
    )
}

/**
 * What a Publish or Review payload must decode to. [node] is the id the
 * prepare named for the content — the minted node on a create, the edited
 * one on an edit.
 */
fun contentExpectation(
    node: String,
    sent: SentContent,
    shape: ContentShape,
    ledger: Map<String, KnownMedia>,
): ExpectedContent {
    val post = shape == ContentShape.POST
    return ExpectedContent(
        node = node,
        title = if (post) serverChecked(sent.title) else null,
        description = if (post) serverChecked(sent.description) else null,
        // A post's words are words or nothing beside media, which the
        // envelope carries as the empty body; a comment's ride as typed.
        body = if (post) serverBlankFolded(sent.content) ?: "" else sent.content,
        media = sent.attachments.map { assetExpectation(it, ledger) },
        sensitive = if (sent.sensitive) ExpectedMark(serverBlankFolded(sent.sensitiveReason)) else null,
    )
}

/** The fields a profile update is sent, exactly as its caller hands them over. */
data class SentProfile(
    val displayName: String,
    val bio: String?,
    val websiteUrl: String?,
    val avatar: MediaFieldUpdate = MediaFieldUpdate.Untouched,
)

/** What a profile update's payload must decode to: the fields untouched, the avatar three-valued. */
fun profileExpectation(
    node: String,
    sent: SentProfile,
    ledger: Map<String, KnownMedia>,
): ExpectedProfile = ExpectedProfile(
    node = node,
    displayName = sent.displayName,
    bio = sent.bio,
    websiteUrl = sent.websiteUrl,
    avatar = when (val avatar = sent.avatar) {
        MediaFieldUpdate.Untouched -> AvatarExpectation.Untouched
        MediaFieldUpdate.Clear -> AvatarExpectation.Cleared
        is MediaFieldUpdate.Set ->
            AvatarExpectation.Replaced(assetExpectation(AttachmentClaim(avatar.mediaId), ledger))
    },
)

/** Every asset a gallery names — each placement's asset and its poster. */
fun galleryMediaIds(claims: List<AttachmentClaim>): List<String> =
    claims.flatMap { listOfNotNull(it.mediaId, it.coverMediaId) }

/**
 * The ledger a gallery's expectation is built against: [own] — the uploads
 * this device made, with the upload digests it computed — and every other
 * asset the gallery names read back by id. That is how an edit learns the
 * assets it carries over and how a poster's rendition digest is read, since
 * no gallery read selects either. Only a READY asset is known; anything else
 * stays out, and its placement is refused.
 */
suspend fun MediaRepository.ledgerFor(
    claims: List<AttachmentClaim>,
    own: Map<String, KnownMedia>,
): Outcome<Map<String, KnownMedia>> {
    val ledger = own.toMutableMap()
    for (id in galleryMediaIds(claims).distinct().filterNot { it in own }) {
        when (val read = mediaAttachment(id)) {
            is Outcome.Success ->
                read.value?.takeIf { it.state == MediaAssetState.READY }?.let { ledger[id] = it.known() }
            is Outcome.Refused -> return Outcome.Refused(read.errors)
            is Outcome.Failed -> return Outcome.Failed(read.cause)
        }
    }
    return Outcome.Success(ledger)
}
