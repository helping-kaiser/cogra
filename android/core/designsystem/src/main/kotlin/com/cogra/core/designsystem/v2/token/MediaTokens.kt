package com.cogra.core.designsystem.v2.token

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * The three shapes a post's body may take (design/readme.md §13). One shape
 * governs the whole post; the framing inside it is per picture.
 *
 * [Tall] is also the cap design/readme.md §12 puts on any media that did not
 * come through this composer: a taller frame is fitted whole inside a 4:5
 * tile rather than cropped by the layout, because "the layout never decides
 * the author's crop".
 */
enum class MediaShape(val ratio: Float, val label: String) {
    Tall(4f / 5f, "Tall 4:5"),
    Square(1f, "Square 1:1"),
    Wide(1.91f, "Wide 1.91:1"),
}

/**
 * The fixed crop the avatar path takes (D13) — the profile's one image. It
 * reuses the post picker; only the shape and the mask differ.
 */
enum class AvatarShape(val ratio: Float) {
    /** Circle-masked on render; the stored bytes are the square. */
    Avatar(1f),
}

/**
 * The height cap a post's media obeys, and the pager that shows it
 * (`--media-max-height`, `--post-chrome-height` on the canonical boards).
 *
 * **A post fits the screen.** The cap is the viewport less the top safe
 * area, the bottom bar, and the *worst-case* non-media chrome — measured on
 * the heaviest post the system can produce (title, two-line caption,
 * opener, honesty marker, affordance row, padding). Budgeting for the
 * average ships a layout that fits four posts in five, and the fifth is the
 * one with something to say. A short post never reaches the cap; it is a
 * maximum, not a target, and a capped tile *fits* its frame rather than
 * cropping further to obey it.
 */
object MediaFrame {
    /** `--post-chrome-height`: the worst-case non-media chrome. */
    val PostChrome = 360.dp

    /** The floor of `max(180px, …)` — a cap can never squeeze past this. */
    val MinHeight = 180.dp

    /** A comment's pictures are an attachment, not a body: a tighter cap. */
    val CommentMaxHeight = 220.dp

    /** The pager's dot: `width:6px; height:6px`. */
    val Dot = 6.dp

    /** `gap:6px` between dots, `padding:8px 0 0` above the row. */
    val DotGap = 6.dp
    val DotRowTopPadding = 8.dp
}

/**
 * Colours that sit *on media* rather than on a theme surface.
 *
 * These are the one place a 2.0 component names a literal instead of reading
 * a role, and the reason is that they are not theme colours: a badge over a
 * photograph has to stay legible against arbitrary pixels, in both themes, so
 * it cannot follow the surface. The values are read off the canvas boards
 * (`rgba(0,0,0,0.55)` badges, `rgba(255,255,255,0.55)` crop rules).
 */
object MediaOverlay {
    /** The scrim behind a duration, a `Cover` mark, or a remove affordance. */
    val Badge = Color(0x8C000000)

    /** The lighter scrim an upload ring rides — `rgba(0,0,0,0.35)`. */
    val UploadScrim = Color(0x59000000)

    /** Ink on [Badge]; white rather than `onSurface` for the same reason. */
    val BadgeInk = Color(0xFFFFFFFF)

    /** The crop viewport's rule-of-thirds lines, and the avatar circle's rim. */
    val CropRule = Color(0x8CFFFFFF)

    /** What the avatar crop dims outside its circle — `rgba(0,0,0,0.45)`. */
    val CropScrim = Color(0x73000000)

    /** The unselected picker tile's ring. */
    val PickerRing = Color(0xFFFFFFFF)
}

/**
 * The sensitive veil (design/readme.md §9, D12).
 *
 * D12 rules the veil covers the post's whole body — media, text and
 * description together, as ONE state, with the title outside it. The blur
 * *treatment* is the part design/readme.md §12 still lists as open, so the
 * radius here is a deliberately gentle starting value rather than a settled
 * one.
 */
object Veil {
    /** Gentle enough to read as a veil, strong enough to defeat recognition. */
    val BlurRadius = 24.dp

    /**
     * The wash over the blur. design/readme.md §9 asks for "a neutral wash of
     * the standard scrim" and forbids `error` colouring, so this is an alpha
     * applied to the theme's own `scrim` role rather than a new colour.
     */
    const val ScrimAlpha = 0.32f

    /**
     * What covers the body where [androidx.compose.ui.draw.blur] cannot run.
     *
     * `Modifier.blur` is a no-op below API 31, and a veil that silently fails
     * to blur would publish exactly the content the reader asked not to see.
     * Below 31 the body is covered opaquely instead — less pretty, never
     * leaky. See [com.cogra.core.designsystem.v2.media.SensitiveVeil].
     */
    const val OpaqueFallbackAlpha = 0.97f
}
