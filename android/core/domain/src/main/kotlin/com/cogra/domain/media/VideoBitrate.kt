package com.cogra.domain.media

import kotlin.math.roundToInt

/**
 * What to encode a clip at, given how long it is and where it is going.
 *
 * **Left unset, the encoder is far too generous.** Media3's
 * `DefaultEncoderFactory` falls back to the Kush Gauge —
 * `width × height × frameRate × 0.07 × motionFactor`, with a medium
 * motion factor of 2 — which at 1080p30 is 1080 × 1920 × 30 × 0.07 × 2 ≈
 * **8.7 Mbps**, about twice what the services the ruling names publish
 * at, and roughly 65 MB of video per minute. A six-and-a-half minute
 * clip lands near 430 MB, which is not "compressed to industry standard"
 * by any reading; it is over the post cap by four times and gets refused
 * after the author has waited for the whole transcode.
 *
 * So the rate is stated rather than inherited, and it answers two
 * questions at once:
 *
 * 1. **What does this normally look like?** [STANDARD_VIDEO_BPS] —
 *    Instagram/TikTok-class 1080p.
 * 2. **Will it fit where it is going?** A long clip is scaled down to
 *    the destination's own cap instead of being refused, which is what
 *    the ruling asks for: "frontends should always compress… so the
 *    likelihood for a 100MiB vid is quite low".
 *
 * Below [FLOOR_VIDEO_BPS] it stops scaling. A clip long enough to need
 * less than that would arrive as mush, and shipping mush is a worse
 * answer than saying it does not fit — so the floor is encoded at and
 * the cap refusal is allowed to stand.
 */
object VideoBitrate {

    /**
     * The everyday rate: 1080p at about four megabits.
     *
     * This is the "industry standard (instagram/tiktok)" the ruling
     * names, stated as a number so it can be checked.
     */
    const val STANDARD_VIDEO_BPS = 4_000_000

    /** AAC at 128 kbps — transparent enough for speech and music alike. */
    const val AUDIO_BPS = 128_000

    /**
     * The lowest 1080p rate worth shipping.
     *
     * Under roughly a megabit, H.264 at this size stops resolving detail
     * and starts resolving blocks: the clip would arrive watchable only
     * in the sense that it plays. At that point the honest answer is
     * that the clip is too long for the cap, so the encode holds here
     * and the cap does the refusing.
     */
    const val FLOOR_VIDEO_BPS = 1_000_000

    /**
     * How much of the cap the video and its audio may plan to fill.
     *
     * The remainder absorbs what a bitrate cannot predict: the
     * container's own overhead, and a VBR encoder overshooting its
     * target on a busy passage. Planning for the whole cap would land
     * just over it exactly when the clip is most worth keeping.
     */
    const val CAP_HEADROOM = 0.92

    /**
     * The video rate for a clip of [durationMs] going somewhere that
     * holds at most [capBytes].
     *
     * A clip of unknown length gets the standard rate: the cap check
     * after the transcode is what catches it, and guessing a lower rate
     * for something that may be five seconds long would degrade it for
     * nothing.
     */
    fun forClip(durationMs: Int, capBytes: Long): Int {
        if (durationMs <= 0) return STANDARD_VIDEO_BPS
        val seconds = durationMs / 1000.0
        val budgetBits = CAP_HEADROOM * capBytes * BITS_PER_BYTE
        val forVideo = budgetBits / seconds - AUDIO_BPS
        return when {
            forVideo >= STANDARD_VIDEO_BPS -> STANDARD_VIDEO_BPS
            forVideo <= FLOOR_VIDEO_BPS -> FLOOR_VIDEO_BPS
            else -> forVideo.roundToInt()
        }
    }

    private const val BITS_PER_BYTE = 8
}
