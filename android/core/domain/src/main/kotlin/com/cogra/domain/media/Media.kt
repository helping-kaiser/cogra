// The media path's domain seam (roadmap "Slice 2.5.1"): what the device
// does to a picture before it leaves, and the one verb that sends it.
// The Android implementations live in core:media and core:network.

package com.cogra.domain.media

import com.cogra.domain.MediaAssetState
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import kotlinx.coroutines.delay

/**
 * One picture, processed on the device and ready to send.
 *
 * The bytes are already WebP, already downscaled, and already stripped
 * of everything but the pixels (D11) — so [aspectRatio] here describes
 * exactly what the server will measure for itself.
 */
data class ProcessedPicture(
    val bytes: ByteArray,
    val width: Int,
    val height: Int,
) {
    val aspectRatio: Float get() = width.toFloat() / height.toFloat()

    // A ByteArray compares by reference, which would make the generated
    // equals lie about two identical pictures.
    override fun equals(other: Any?): Boolean =
        other is ProcessedPicture &&
            width == other.width &&
            height == other.height &&
            bytes.contentEquals(other.bytes)

    override fun hashCode(): Int = 31 * (31 * bytes.contentHashCode() + width) + height
}

/**
 * One video, transcoded on the device and ready to send.
 *
 * It is a [path] rather than a byte array because a clip is allowed a
 * hundred megabytes (rulings 2026-09-02) and a still is allowed ten: the
 * picture pipeline can hold its result in memory, and the video pipeline
 * would be an out-of-memory kill if it tried. The file is the app's own
 * cache copy, written by the transcoder and deleted once the upload has
 * an id back.
 *
 * The bytes are already MP4 / H.264 + AAC, already at or below the
 * upload resolution, and already stripped of the source container's
 * metadata — so what the server measures is what this describes.
 */
data class ProcessedVideo(
    val path: String,
    val width: Int,
    val height: Int,
    val durationMs: Int,
    val byteCount: Long,
) {
    val aspectRatio: Float get() = width.toFloat() / height.toFloat()
}

/**
 * One frame lifted out of a clip, as the cover step offers it.
 *
 * [atMs] is what the offer is *for*: the step shows a handful of moments
 * and the author picks one, so the frame carries the timestamp it came
 * from rather than being an anonymous bitmap.
 */
data class VideoFrame(
    val atMs: Int,
    val picture: ProcessedPicture,
)

/**
 * The on-device video pipeline: re-encode what the picker handed over
 * into the one accepted stored format, and lift cover frames out of it.
 *
 * Clients compress to industry-standard resolution as the norm (rulings
 * 2026-09-02), which is what keeps a hundred-megabyte upload unlikely
 * rather than routine. Like [MediaProcessor] it is an interface in the
 * domain so the wizard's state machine tests without a codec anywhere
 * near them.
 */
interface VideoProcessor {
    /**
     * Transcodes the clip at [uri] to MP4 / H.264 + AAC, scaled down to
     * the upload resolution and stripped of container metadata.
     *
     * [capBytes] is where it is going — a post's cap or a comment's.
     * The bitrate is chosen against it (see [VideoBitrate]), so a long
     * clip is encoded smaller rather than encoded generously and then
     * refused for being too big.
     *
     * [onProgress] reports 0..100 as the transcode runs — a clip is long
     * enough that a spinner with no number reads as a hang. Null when
     * the bytes are not a video the device can read at all.
     */
    suspend fun transcode(
        uri: String,
        capBytes: Long,
        onProgress: (Int) -> Unit,
    ): ProcessedVideo?

    /**
     * The cover frames offered for [uri], oldest first.
     *
     * Each comes back already shaped like any other still — WebP,
     * downscaled, stripped — because a chosen frame is uploaded as its
     * own asset and has to be exactly what a picture upload is.
     */
    suspend fun coverFrames(uri: String, count: Int): List<VideoFrame>

    /**
     * What the clip's header says, without decoding it.
     *
     * Null for anything that is not a readable video — which is how the
     * pick step tells a clip from a picture when the choice came from
     * the system picker rather than from the grid, where the store
     * already said.
     */
    suspend fun info(uri: String): VideoInfo?
}

/**
 * A clip's header, as the pick and cover steps need it.
 *
 * [aspectRatio] is the *displayed* shape — a quarter-turned recording
 * reports its stored dimensions, and this is after that swap — because
 * everything reading it is deciding what shape to draw.
 */
data class VideoInfo(
    val durationMs: Int,
    val aspectRatio: Float,
)

/**
 * What a crop asks the pipeline for: the shape the whole post takes,
 * and this picture's framing inside it.
 *
 * The client crops before upload and the stored bytes *are* the post's
 * bytes (D17), so the framing has to be baked here rather than carried
 * as parameters the server or a later render would have to honour.
 *
 * [window] is the rectangle the author framed, in fractions of the
 * source picture — the units the crop step's own state holds, which
 * survive the trip without either side learning the other's pixel
 * dimensions. It is null for a picture the author never framed, and the
 * pipeline then centres the largest [targetRatio] window the picture
 * allows.
 */
data class CropSpec(
    val targetRatio: Float,
    val window: CropWindow? = null,
)

/**
 * A rectangle inside a picture, as fractions of that picture.
 *
 * Always within the unit square, never inverted — the crop step clamps
 * on the way in, and the pipeline clamps again on the way out, because a
 * rounding difference between a view and a bitmap is exactly how an
 * out-of-bounds rectangle gets made.
 */
data class CropWindow(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top

    /** True for a window that keeps the whole picture. */
    val isWhole: Boolean get() = left <= 0f && top <= 0f && right >= 1f && bottom >= 1f
}

/**
 * The on-device image pipeline (D11, D17): read what the picker handed
 * over, apply the author's crop, downscale, re-encode, strip.
 *
 * It is an interface in the domain because the wizard's state machine is
 * tested on the JVM without a `Bitmap` anywhere near it, and because the
 * only Android-specific part is decoding.
 */
interface MediaProcessor {
    /**
     * Processes the asset at [uri] — a picker content URI — under
     * [crop]. Null when the bytes do not decode as an image at all,
     * which is the client half of the decode gate D11 asks for.
     */
    suspend fun process(uri: String, crop: CropSpec): ProcessedPicture?

    /**
     * The asset's own ratio, read from its header without decoding the
     * whole picture — what the crop step needs to fit a preview before
     * anything is processed. Null when it does not decode.
     */
    suspend fun aspectRatio(uri: String): Float?
}

/**
 * One item already on the device, as the picker grid draws it.
 *
 * [aspectRatio] rides along because the grid reads every tile's shape at
 * once and the store already knows it — asking the decoder per tile is
 * how a scroll drops frames.
 *
 * [durationMs] is what makes a tile a video: the board marks those with
 * a running time and a play glyph, and the pick rule reads the same
 * field to enforce one video *or* up to ten pictures.
 */
data class DeviceMedia(
    val uri: String,
    val aspectRatio: Float,
    val durationMs: Int? = null,
) {
    val isVideo: Boolean get() = durationMs != null
}

/**
 * The newest media on the device, for `ComposePick`'s own grid.
 *
 * The canonical board draws the reader's photos inside the app with
 * selection badges, which is a different affordance from handing the
 * whole choice to the system picker: the board's grid is browsed and
 * toggled in place, beside the tray that says which one is the cover.
 * Reading it needs a media permission, so the grid is always behind one
 * — see the pick step for the request and its partial-access branch.
 */
interface DeviceMediaSource {
    /** The [limit] most recently added items, newest first. */
    suspend fun newestMedia(limit: Int): List<DeviceMedia>
}

/**
 * How far a resumable upload has got.
 *
 * [uploadId] rides along because it is the only way out: a composer
 * that is discarded mid-upload has to name the session to abort it, and
 * the id is the server's to give rather than the client's to invent. It
 * arrives with the first tick, before any part has landed.
 *
 * A single-shot upload reports nothing — there are no parts to count,
 * and it is over before a progress bar would have moved.
 */
data class UploadProgress(
    val uploadId: String,
    val sentParts: Int,
    val partCount: Int,
) {
    /** 0..100, for the ring the composer already draws. */
    val percent: Int
        get() = if (partCount <= 0) 0 else (sentParts * 100) / partCount
}

/**
 * When a file stops going in one request and starts going in parts.
 *
 * One part size, which is the server's default: "below 8 MiB a
 * single-shot `uploadMedia` is one round trip and resumability buys
 * nothing, while every video and any still near its cap belongs on this
 * path" (api-spec.md, "Resuming a large upload").
 */
const val RESUMABLE_THRESHOLD_BYTES = 8L * 1024 * 1024

/**
 * Client mirror of the server's `MAX_ALT_TEXT_CHARS` — the ruled cap on a
 * picture or clip's authored description (design/backlog.md, the caps-2
 * lane's 2026-09-11 ruling). Unicode scalar values, the same unit every
 * other ruled cap counts in.
 */
const val MAX_ALT_TEXT_CHARS = 1000

/** Whether [text] is longer than a description's ruled cap. */
fun isAltTextTooLong(text: String): Boolean =
    com.cogra.domain.content.authoredLength(text) > MAX_ALT_TEXT_CHARS

/**
 * The parent a clip is headed for (api-spec.md `MediaScale`).
 *
 * The server sizes, re-encodes and validates a clip for this parent's
 * cap — a comment's is half a post's — so an upload names it. A
 * picture's cap is the same at either, so a still names none.
 */
enum class MediaDestination { POST, COMMENT }

/**
 * The upload verb (api-spec.md `uploadMedia`; D5).
 *
 * One asset per call, by design: a ten-picture post is ten calls the
 * client may run concurrently, and each retries on its own without
 * disturbing the nine that succeeded.
 */
interface MediaRepository {
    /**
     * Uploads one processed picture: bytes and nothing authored.
     *
     * A description is a fact about a placement, not about the asset, so
     * it rides `AttachmentClaim` at prepare instead — which is what lets
     * a picture upload the moment it is picked, with nothing gating on
     * whether it has been described yet.
     */
    suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView>

    /**
     * Uploads one transcoded clip: bytes and nothing authored, exactly as
     * [uploadMedia] sends a picture.
     *
     * The poster is not named here. A cover is a fact about where the clip
     * sits rather than about its bytes, so it is an ordinary upload of its
     * own and the id it returns rides `AttachmentClaim` at prepare — which
     * is what lets a clip go up with no cover at all, and what lets an
     * edit name a different one without the clip moving.
     *
     * [destination] is the parent the clip is headed for, whose cap the
     * server holds it to.
     */
    suspend fun uploadVideo(
        video: ProcessedVideo,
        destination: MediaDestination,
        onProgress: (UploadProgress) -> Unit = {},
    ): Outcome<MediaAssetView>

    /**
     * Gives up a resumable upload's parts now rather than at expiry.
     *
     * Fire-and-forget by design: a composer being discarded is not
     * waiting to hear whether the store let go, and a failure here
     * costs a day of held parts rather than anything the author sees.
     */
    suspend fun abortUpload(uploadId: String)

    /**
     * One of the viewer's own uploads, as the server currently sees it —
     * how a client learns that an asset it uploaded as PROCESSING has
     * become READY or FAILED (api-spec.md "Media"). Polled the way
     * `stagedWrite` is polled. Null for an unknown id, exactly as the
     * server documents.
     */
    suspend fun mediaAttachment(id: String): Outcome<MediaReadiness?>
}

/**
 * Where one uploaded asset stands, as `mediaAttachment` answers it — just
 * the gate's own question and nothing more: the wizard never shows the
 * server's rendition before the seal, so the full gallery shape
 * ([MediaAssetView]'s `url`/`options`/…) would only spend budget nothing
 * here reads.
 */
data class MediaReadiness(
    val id: String,
    val state: MediaAssetState,
    val failureReason: String?,
)

/**
 * Waits out a PROCESSING asset the way `WriteSigner.approveFrom` waits
 * out a sealing write: a fixed delay before each read of
 * `mediaAttachment`, at the same 1-second spacing — but UNBOUNDED where
 * the seal poll caps its attempts (web's `uploads.ts`'s own
 * `awaitReady` reasons through the identical asymmetry).
 *
 * A staged write that outruns its poll budget falls back to `resume()`,
 * replayed from handshake material the app persists — a PROCESSING
 * asset has no such fallback, and nowhere to resume a still-processing
 * leg from. What makes sleeping forever safe rather than a way to hang
 * the gate shut is that the SERVER bounds it, not the client: the
 * ingest worker gives a re-encode job at most three lease-reclaimed
 * attempts before marking the row FAILED, so this loop always ends —
 * on READY, on FAILED, or on a transport fault reading `mediaAttachment`
 * itself (treated exactly like any other failed read: a retryable
 * [Outcome.Failed]). A real transcode legitimately takes minutes; an
 * attempt cap here would only dump a genuinely-processing asset into a
 * failure the server was always going to resolve on its own.
 *
 * READY (or a business refusal, or a transport fault on the upload
 * itself) answers at once — no poll, no extra request. Android's own
 * uploads are always within target — the on-device pipeline re-encodes
 * before send — so PROCESSING is a backstop for a future server-side
 * rule change, not the shipped path.
 */
suspend fun MediaRepository.awaitReady(uploaded: Outcome<MediaAssetView>): Outcome<MediaAssetView> {
    if (uploaded !is Outcome.Success) return uploaded
    var current = uploaded.value
    while (current.state == MediaAssetState.PROCESSING) {
        delay(MEDIA_READY_POLL_DELAY_MS)
        when (val read = mediaAttachment(current.id)) {
            is Outcome.Success -> {
                val readiness = read.value ?: return Outcome.Failed(
                    IllegalStateException("media ${current.id} vanished while processing"),
                )
                current = current.copy(state = readiness.state, failureReason = readiness.failureReason)
            }
            is Outcome.Refused -> return read
            is Outcome.Failed -> return read
        }
    }
    return Outcome.Success(current)
}

/** The poll idiom's own interval (`WriteSigner.sealPollDelayMs`) — shared rather than earning its own number. */
internal const val MEDIA_READY_POLL_DELAY_MS = 1_000L
