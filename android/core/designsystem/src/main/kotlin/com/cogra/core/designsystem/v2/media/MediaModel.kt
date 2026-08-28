package com.cogra.core.designsystem.v2.media

import androidx.compose.runtime.Immutable
import com.cogra.core.designsystem.v2.token.MediaShape

/**
 * What a 2.0 media component needs in order to draw one attachment.
 *
 * This is deliberately **not** the GraphQL type. `core:designsystem` carries
 * no domain, network or DI dependency (android/CLAUDE.md), and the media
 * contract is being built in a parallel lane — so the component layer states
 * the little it needs and a screen maps the generated type onto it. That
 * mapping is the seam stage 2 has to write; keeping it explicit is what stops
 * the design system from acquiring a schema dependency.
 *
 * @param url what `MediaAttachment.url` resolves to. Any Coil model works —
 *   a URL string, a `Uri`, a `File` — because the picker deals in local
 *   content URIs and the feed in remote ones.
 * @param aspectRatio width ÷ height, derived server-side from the stored
 *   bytes rather than supplied by the client (D11). It is what reserves the
 *   tile's space before a single byte has loaded.
 * @param altText authored, never generated. A null value is a *decorative*
 *   asset and becomes a null content description — never a fabricated one
 *   (D20).
 */
@Immutable
data class MediaItem(
    val url: Any?,
    val aspectRatio: Float,
    val altText: String? = null,
)

/**
 * Whether a body was removed by its author or under the platform's rules.
 *
 * design/readme.md §9 requires the two to be distinguishable — collapsing
 * them lets a verdict hide behind an author's decision — so the reason is a
 * type rather than a boolean, and each arm carries its own wording.
 */
enum class RemovalReason { Author, Platform }

/**
 * The 4:5 cap of design/readme.md §12, applied to a tile.
 *
 * A frame taller than 4:5 is **fitted whole** inside a 4:5 tile with the
 * reserved surface showing at the sides — the layout never decides the
 * author's crop, and the bars stay a plain surface rather than a blurred
 * enlargement of the picture, which would invent image where there is none.
 *
 * Anything 4:5 or wider keeps its own ratio.
 */
fun Float.cappedToTallestTile(): Float = maxOf(this, MediaShape.Tall.ratio)

/** True when [aspectRatio] is taller than the 4:5 cap and must be letterboxed. */
fun MediaItem.isFittedWhole(): Boolean = aspectRatio < MediaShape.Tall.ratio
