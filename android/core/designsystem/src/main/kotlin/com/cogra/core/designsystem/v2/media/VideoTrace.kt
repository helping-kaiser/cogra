package com.cogra.core.designsystem.v2.media

import android.util.Log
import com.cogra.core.designsystem.BuildConfig

/**
 * What the video surface did, in the order it did it.
 *
 * **Why this exists.** Two fixes for the feed↔detail transition were
 * reasoned from source and both failed on the device — the second one
 * made it worse. The chain has four moving parts that only interact at
 * runtime: which surface owns the player, when the surface is measured,
 * when the video's own size arrives, and when a frame is actually
 * rendered. Reading the code cannot order those, and the difference
 * between "the cover flashed" and "the surface went black" is invisible
 * in a screen recording. So the app says what it is doing.
 *
 * One tag, one line per event, in a fixed shape:
 *
 * ```
 * adb logcat -s CograVideo
 * ```
 *
 * **Debug only, at runtime.** `BuildConfig.DEBUG` is a real branch, not
 * a folded constant — AGP emits `Boolean.parseBoolean("true")` precisely
 * so the compiler cannot inline it — and release builds run no shrinker
 * today. So the gate is what it looks like: a test taken on every call.
 * What it must not also cost is the line it would have logged, which is
 * why every message is a lambda inlined into [log] and built only on the
 * debug side of the test.
 *
 * The vocabulary is deliberately small and every line carries the clip
 * it is about, because two clips on screen at once is one of the cases
 * being investigated.
 */
internal object VideoTrace {

    const val TAG = "CograVideo"

    /** A short, stable name for a clip — a URL is unreadable at speed. */
    fun clip(url: String): String = url.takeLast(CLIP_NAME_CHARS)

    /**
     * A surface entered or left the composition, with the box it was
     * given.
     *
     * The box is what the *frame* measured, which is the number
     * jakob's "the container pre-loads for the cover's size then
     * resizes for the video" would show changing.
     */
    fun surface(clip: String, event: String, widthPx: Int, heightPx: Int) =
        log { "surface  $clip  $event  box=${widthPx}x$heightPx" }

    /**
     * The player was bound to, or unbound from, a surface — and where
     * it had got to.
     *
     * Position is the whole point of the shared instance: if the detail
     * binds at 0 the hand-over is not carrying anything, whatever the
     * code intends.
     */
    fun handover(clip: String, event: String, positionMs: Long, playing: Boolean) =
        log { "handover $clip  $event  pos=${positionMs}ms playing=$playing" }

    /**
     * `PresentationState.videoSizeDp` arrived — or was still null when
     * the surface was measured.
     *
     * This is the async value that androidx/media#3238 is about, and
     * the one the previous fix made the geometry depend on.
     */
    fun videoSize(clip: String, width: Float?, height: Float?) =
        log { "videosize $clip  ${width?.toInt() ?: "null"}x${height?.toInt() ?: "null"}" }

    /**
     * The poster went in front of the surface, or came away, and why.
     *
     * The reason is the load-bearing part: "the cover flashed" has at
     * least three candidate causes and they need different fixes.
     */
    fun poster(clip: String, shown: Boolean, reason: String) =
        log { "poster   $clip  ${if (shown) "SHOWN" else "hidden"}  $reason" }

    /** Autoplay's own decision, with the number it decided on. */
    fun autoplay(clip: String, visibleFraction: Float, playing: Boolean) =
        log { "autoplay $clip  visible=${"%.2f".format(visibleFraction)} play=$playing" }

    /** A frame actually reached the surface — the end of every flash. */
    fun firstFrame(clip: String) = log { "frame    $clip  FIRST" }

    private inline fun log(message: () -> String) {
        if (BuildConfig.DEBUG) Log.d(TAG, message())
    }

    private const val CLIP_NAME_CHARS = 12
}
