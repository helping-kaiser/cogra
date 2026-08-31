// The media path's domain seam (roadmap "Slice 2.5.1"): what the device
// does to a picture before it leaves, and the one verb that sends it.
// The Android implementations live in core:media and core:network.

package com.cogra.domain.media

import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome

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
 * One picture already on the device, as the picker grid draws it.
 *
 * [aspectRatio] rides along because the grid reads every tile's shape at
 * once and the store already knows it — asking the decoder per tile is
 * how a scroll drops frames.
 */
data class DeviceImage(
    val uri: String,
    val aspectRatio: Float,
)

/**
 * The newest pictures on the device, for `ComposePick`'s own grid.
 *
 * The canonical board draws the reader's photos inside the app with
 * selection badges, which is a different affordance from handing the
 * whole choice to the system picker: the board's grid is browsed and
 * toggled in place, beside the tray that says which one is the cover.
 * Reading it needs a media permission, so the grid is always behind one
 * — see the pick step for the request and its partial-access branch.
 */
interface DeviceImageSource {
    /** The [limit] most recently added pictures, newest first. */
    suspend fun newestImages(limit: Int): List<DeviceImage>
}

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
}
