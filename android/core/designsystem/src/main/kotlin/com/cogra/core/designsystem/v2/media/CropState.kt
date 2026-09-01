package com.cogra.core.designsystem.v2.media

import android.graphics.Rect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.canhub.cropper.CropImageView
import com.cogra.core.designsystem.v2.token.MediaShape

/**
 * The window one picture is framed to, as fractions of the picture.
 *
 * Fractions rather than pixels because the view that produced them and
 * the bitmap the crop is finally applied to are different sizes — and
 * because a fraction survives rotation, process death, and the trip out
 * of the design system without either side learning the other's
 * dimensions.
 *
 * The rectangle is always inside the unit square and never inverted.
 */
data class CropFraming(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top

    companion object {
        /** The whole picture — what an untouched framing means. */
        val Whole = CropFraming(0f, 0f, 1f, 1f)

        /** Clamps a candidate into the unit square, keeping it non-empty. */
        fun of(left: Float, top: Float, right: Float, bottom: Float): CropFraming {
            val l = left.coerceIn(0f, 1f)
            val t = top.coerceIn(0f, 1f)
            return CropFraming(
                left = l,
                top = t,
                right = right.coerceIn(l, 1f),
                bottom = bottom.coerceIn(t, 1f),
            )
        }
    }
}

/**
 * The framing of one picture, and the handle the screen drives it by.
 *
 * The geometry itself belongs to the cropper library: [CropImageView]
 * owns the window, the drag, the pinch and the ratio, and this class is
 * the Compose-side mirror of what it currently holds plus the commands
 * the invisible accessibility route needs. Keeping the arithmetic out of
 * here is the point of adopting a cropper at all — the last two rounds of
 * crop bugs were all in geometry we wrote ourselves.
 *
 * [framing] is `rememberSaveable`, so a half-framed crop survives
 * rotation and process death; the view is re-attached to it on the way
 * back.
 */
@Stable
class CropState internal constructor(initial: CropFraming) {

    var framing: CropFraming by mutableStateOf(initial)
        private set

    /**
     * The live view, while one is attached.
     *
     * Held rather than mirrored because the accessibility actions have to
     * move the *real* window synchronously — an action that only updated
     * a copy would announce a change the reader cannot see.
     */
    internal var view: CropImageView? = null

    /** The shape the attached view has already been pointed at. */
    private var framedShape: MediaShape? = null

    /**
     * A framing that outlived its view and is waiting for the picture to
     * come back — a rotation, a process death mid-crop, or a return to
     * the crop stage from further along the wizard.
     *
     * It cannot be applied at attach time: the window is expressed
     * against the picture, and the view knows nothing about the picture
     * until the decode finishes.
     */
    private var pendingRestore: CropFraming? = null

    /**
     * Whether this picture's opening window has been placed yet.
     *
     * The library opens on its own inset default, which leaves the
     * author framing inside a window smaller than the stage they were
     * given ("the area for cropping was to small", jakob 2026-09-01).
     * The opening window is placed explicitly instead — the largest one
     * the shape allows — so the full-bleed viewport is filled.
     */
    private var seeded = false

    /**
     * Reported by the view whenever the reader moves the window.
     *
     * A window is this picture's to record only once this picture's own
     * window has been placed. One view serves the whole filmstrip and
     * goes on showing the previous bitmap until the next decode lands,
     * so a window arriving before then was measured against a picture
     * this state knows nothing about (jakob 2026-09-01: "the preview of
     * image 1 visibly changes every time i move image 2 crop").
     */
    internal fun onWindowChanged(next: CropFraming) {
        if (!seeded) return
        framing = next
    }

    /**
     * Arms this picture's framing for the decode that is about to run.
     *
     * Called when this state becomes the one the view is showing — the
     * stage opening, or the filmstrip moving here. The window cannot be
     * placed now: it is expressed against the picture, and the view
     * knows nothing about the picture's dimensions until the decode
     * finishes.
     */
    internal fun beginAttach() {
        pendingRestore = framing.takeIf { it != CropFraming.Whole }
        seeded = false
    }

    /**
     * Places the window this picture wants, now that it is decoded —
     * either a framing carried in from a previous life, or this
     * picture's opening window. Returns true when it placed one.
     *
     * This runs from the library's **decode-complete** callback, because
     * that is the only moment it can. `setImageUriAsync` clears any
     * window seeded before it, the picture's dimensions are unknown
     * until the bitmap lands ([CropImageView.wholeImageRect] is null
     * until then), and the library reports no window of its own once the
     * decode finishes: its `handleCropWindowChanged` reaches an
     * `OnSetCropWindowChangeListener` only for a settled *change*, and
     * nothing on the decode path makes one.
     *
     * `cropRect`'s setter is the documented way to place a window
     * against the source bitmap: it seeds the overlay's initial rect,
     * which the overlay applies as soon as it knows its own bounds.
     */
    internal fun applyPendingWindow(view: CropImageView): Boolean {
        val whole = view.wholeImageRect ?: return false
        if (whole.width() <= 0 || whole.height() <= 0) return false

        val restore = pendingRestore
        if (restore != null) {
            pendingRestore = null
            seeded = true
            view.cropRect = CropWindowMath.rectOf(restore, whole)
            return true
        }
        return openWindow(view, whole)
    }

    /**
     * The largest window the shape allows — what a picture with no
     * framing of its own opens on.
     *
     * The library's own default opens inset inside the stage, which
     * leaves the author framing inside a window smaller than the one
     * they were given ("the area for cropping was to small", jakob
     * 2026-09-01).
     */
    private fun openWindow(view: CropImageView, whole: Rect): Boolean {
        if (seeded) return false
        val shape = framedShape ?: return false
        seeded = true
        val opening = CropWindowMath.largestWindow(
            targetRatio = shape.ratio,
            pictureRatio = whole.width().toFloat() / whole.height().toFloat(),
        )
        framing = opening
        view.cropRect = CropWindowMath.rectOf(opening, whole)
        return true
    }

    /**
     * Drops whatever window the view holds and opens the picture again
     * at the current shape.
     *
     * The seed is cleared first: `resetCropRect` re-initialises the
     * overlay *from the window last seeded into it*, so resetting
     * without clearing lands straight back on the framing being dropped.
     */
    private fun reopen(view: CropImageView) {
        view.cropRect = null
        view.resetCropRect()
        val whole = view.wholeImageRect ?: return
        openWindow(view, whole)
    }

    /**
     * Points the window at a shape, re-framing against the **original**
     * whenever the shape actually changed.
     *
     * The reset is the whole fix: switching Tall to Square used to carry
     * the tall window's position into the square one, which left the
     * author somewhere they never chose and no way back to the rest of
     * the picture (jakob 2026-08-31).
     */
    internal fun frameTo(view: CropImageView, shape: MediaShape) {
        val previous = framedShape
        if (previous == shape) return
        framedShape = shape
        val (x, y) = shape.ratioParts()
        view.setAspectRatio(x, y)
        // Only a real switch re-frames. The first application is just
        // this view learning the shape it was always going to have, and
        // resetting there would throw away a framing that survived a
        // rotation — the one thing the saveable state exists to keep.
        if (previous == null) return
        framing = CropFraming.Whole
        pendingRestore = null
        // The new shape opens on its own largest window, never on the
        // previous shape's. The picture this framing describes is on
        // screen only once its own window has been placed against it;
        // before that the view still holds the picture the filmstrip
        // came from, and the re-frame is the decode's to do against the
        // right bitmap.
        val present = seeded
        seeded = false
        if (present) reopen(view)
    }

    /**
     * Puts the window back to the whole picture at the current ratio.
     *
     * This is what a shape switch runs: the new shape re-frames against
     * the **original**, never against whatever the previous shape's
     * window happened to be (jakob 2026-08-31).
     */
    fun reset() {
        framing = CropFraming.Whole
        pendingRestore = null
        seeded = false
        view?.let { reopen(it) }
    }

    /** The non-gesture equivalent design/readme.md §10 requires of a drag. */
    fun nudge(direction: NudgeDirection) = moveTo(CropWindowMath.nudged(framing, direction))

    /** The non-gesture equivalent of a pinch. */
    fun stepZoom(inward: Boolean) = moveTo(CropWindowMath.zoomed(framing, inward))

    /** True when zooming further in that direction would change anything. */
    fun canZoom(inward: Boolean): Boolean = CropWindowMath.zoomed(framing, inward) != framing

    /**
     * Puts a computed window on the screen.
     *
     * The state is updated whether or not a view is attached, so the
     * arithmetic is testable on its own and a detached action is still
     * recorded rather than silently lost.
     */
    private fun moveTo(next: CropFraming) {
        framing = next
        val view = view ?: return
        val whole = view.wholeImageRect ?: return
        view.cropRect = CropWindowMath.rectOf(next, whole)
    }

    /**
     * What the framing currently is, in words.
     *
     * With no visible controls this is the only way a screen-reader user
     * learns whether a nudge did anything, so it names how much of the
     * picture is kept and where the window sits rather than only
     * announcing that a crop exists.
     */
    fun framingDescription(): String {
        val kept = (framing.width * framing.height * PERCENT).toInt().coerceIn(0, PERCENT.toInt())
        val across = edgeWord(framing.left, framing.right, "left", "right")
        val down = edgeWord(framing.top, framing.bottom, "top", "bottom")
        val where = listOfNotNull(across, down).ifEmpty { listOf("centred") }
        return "Keeping $kept% of the picture, ${where.joinToString(" and ")}"
    }

    /**
     * Which edge the window is against, or null when it is centred on
     * that axis. A percentage of a picture nobody can see is not
     * information; "at the left" is.
     */
    private fun edgeWord(low: Float, high: Float, lowWord: String, highWord: String): String? {
        val slack = 1f - (high - low)
        if (slack <= EDGE_SLACK) return null
        return when {
            low <= slack * (1f - EDGE_FRACTION) -> "at the $lowWord"
            high >= 1f - slack * (1f - EDGE_FRACTION) -> "at the $highWord"
            else -> null
        }
    }

    internal companion object {
        private const val PERCENT = 100f

        /** Below this there is nothing to be at an edge of. */
        private const val EDGE_SLACK = 0.01f

        /** How near an edge counts as being at it, as a share of the slack. */
        private const val EDGE_FRACTION = 0.9f
    }
}

/**
 * The shape as the pair of whole numbers the library takes.
 *
 * Written out rather than derived from the float ratio because 1.91:1
 * has no small integer pair, and rounding a float would silently frame
 * the wide shape at something that is not the wide shape.
 */
internal fun MediaShape.ratioParts(): Pair<Int, Int> = when (this) {
    MediaShape.Tall -> 4 to 5
    MediaShape.Square -> 1 to 1
    MediaShape.Wide -> 191 to 100
}

/** The four discrete directions the non-drag route offers. */
enum class NudgeDirection(val x: Int, val y: Int) {
    Left(-1, 0),
    Right(1, 0),
    Up(0, -1),
    Down(0, 1),
}

/**
 * The window arithmetic the invisible route needs, as pure functions on
 * rectangles.
 *
 * Split out of [CropState] so every branch is a JVM test with no view
 * anywhere near it — the same split the stance pad's geometry already
 * uses. The cropper owns dragging and pinching; this owns only the
 * discrete equivalents, which the library has no notion of.
 */
internal object CropWindowMath {

    /** One discrete step, as a share of the window's own size. */
    const val NUDGE_FRACTION = 0.08f

    /** One discrete zoom step, as a share of the window's own size. */
    const val ZOOM_FRACTION = 0.1f

    /** A window may never shrink below this share of the picture's edge. */
    const val MIN_WINDOW = 0.1f

    /**
     * Slides the window without changing its size, stopping at the
     * picture's edge — the window is never let off the picture.
     */
    fun nudged(window: CropFraming, direction: NudgeDirection): CropFraming = slidInside(
        window.offsetBy(
            window.width * NUDGE_FRACTION * direction.x,
            window.height * NUDGE_FRACTION * direction.y,
        ),
    )

    /**
     * Slides a window back inside the picture without resizing it.
     *
     * Sliding rather than clipping is what keeps the discrete route from
     * quietly changing the shape the whole post was set to — a clipped
     * window would come back a different ratio.
     */
    fun slidInside(window: CropFraming): CropFraming {
        val dx = when {
            window.left < 0f -> -window.left
            window.right > 1f -> 1f - window.right
            else -> 0f
        }
        val dy = when {
            window.top < 0f -> -window.top
            window.bottom > 1f -> 1f - window.bottom
            else -> 0f
        }
        return window.offsetBy(dx, dy)
    }

    /**
     * Grows or shrinks the window about its own centre, keeping its
     * aspect ratio — so a discrete zoom cannot silently change the shape
     * the whole post was set to.
     */
    fun zoomed(window: CropFraming, inward: Boolean): CropFraming {
        if (window.width <= 0f || window.height <= 0f) return window
        val wanted = if (inward) 1f - ZOOM_FRACTION else 1f + ZOOM_FRACTION

        // **One factor for both axes** — that is what keeps the ratio the
        // whole post was set to. Growing stops where the window would
        // outgrow the picture on either axis; shrinking stops at the
        // smallest window still worth framing.
        val biggest = minOf(1f / window.width, 1f / window.height)
        val smallest = maxOf(MIN_WINDOW / window.width, MIN_WINDOW / window.height)
        val factor = wanted.coerceAtMost(biggest).coerceAtLeast(minOf(smallest, biggest))

        val width = window.width * factor
        val height = window.height * factor
        val centreX = (window.left + window.right) / 2f
        val centreY = (window.top + window.bottom) / 2f
        return slidInside(
            CropFraming(
                left = centreX - width / 2f,
                top = centreY - height / 2f,
                right = centreX + width / 2f,
                bottom = centreY + height / 2f,
            ),
        )
    }

    /**
     * The largest window of [targetRatio] that fits a picture of
     * [pictureRatio], centred — the window a picture opens on.
     *
     * Both ratios are width ÷ height. One axis always ends up whole:
     * a window wider than the picture is as wide as the picture and
     * short of its height, and the other way round. That is what makes
     * this the largest window rather than merely a valid one — and
     * placing it explicitly is what keeps the author's stage full,
     * where the library's own default opens inset inside it.
     */
    fun largestWindow(targetRatio: Float, pictureRatio: Float): CropFraming {
        if (targetRatio <= 0f || pictureRatio <= 0f) return CropFraming.Whole
        return if (targetRatio >= pictureRatio) {
            // As wide as the picture; the height is what gives.
            val height = (pictureRatio / targetRatio).coerceIn(0f, 1f)
            val top = (1f - height) / 2f
            CropFraming(0f, top, 1f, top + height)
        } else {
            val width = (targetRatio / pictureRatio).coerceIn(0f, 1f)
            val left = (1f - width) / 2f
            CropFraming(left, 0f, left + width, 1f)
        }
    }

    /** The window as fractions of the picture it was cut from. */
    fun framingOf(rect: Rect, whole: Rect): CropFraming {
        if (whole.width() <= 0 || whole.height() <= 0) return CropFraming.Whole
        return CropFraming.of(
            left = (rect.left - whole.left).toFloat() / whole.width(),
            top = (rect.top - whole.top).toFloat() / whole.height(),
            right = (rect.right - whole.left).toFloat() / whole.width(),
            bottom = (rect.bottom - whole.top).toFloat() / whole.height(),
        )
    }

    /** The window back in the picture's own pixels, for the view. */
    fun rectOf(window: CropFraming, whole: Rect): Rect = Rect(
        whole.left + (window.left * whole.width()).toInt(),
        whole.top + (window.top * whole.height()).toInt(),
        whole.left + (window.right * whole.width()).toInt(),
        whole.top + (window.bottom * whole.height()).toInt(),
    )
}

private fun CropFraming.offsetBy(dx: Float, dy: Float): CropFraming =
    CropFraming(left + dx, top + dy, right + dx, bottom + dy)

private val CropStateSaver: Saver<CropState, List<Float>> = Saver(
    save = { listOf(it.framing.left, it.framing.top, it.framing.right, it.framing.bottom) },
    restore = { CropState(CropFraming(it[0], it[1], it[2], it[3])) },
)

/**
 * Survives rotation and process death, so a half-framed crop is not lost.
 *
 * [initial] is the framing this picture was last left at, where the
 * screen kept one. A stage the author walks back into — from further
 * along the wizard, or forwards into again from an earlier stage — is
 * re-entered on a *new* composition, so the saveable state alone cannot
 * carry the framing across it; the screen hands the remembered framing
 * back in here and the author sees the crop they made rather than a
 * reset one (jakob 2026-09-01).
 */
@Composable
fun rememberCropState(initial: CropFraming = CropFraming.Whole): CropState =
    rememberSaveable(saver = CropStateSaver) { CropState(initial) }
