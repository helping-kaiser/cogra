package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens

/**
 * What a thumbnail says about itself, over the picture.
 *
 * The order counter and the failed dot read theme roles (`primary`,
 * `error`); [ThumbBadge.Cover], [ThumbBadge.Remove], and [ThumbBadge.Duration]
 * read `inverseSurface`/`inverseOnSurface` — the master's
 * `--surface-snackbar` pair (`design/tokens/semantic.css`: `var(--inverse-surface)`),
 * the one role designed to stay legible over arbitrary pixels in both themes.
 */
sealed interface ThumbBadge {
    /** The picker's selection order: a filled counter, or an empty ring. */
    data class Order(val position: Int?) : ThumbBadge

    /** The first pick leads the post (design/readme.md §13). */
    data object Cover : ThumbBadge

    /** Removes this pick — the same × as [MediaThumb]'s `onRemove`, named "Remove this picture". */
    data class Remove(val onRemove: () -> Unit) : ThumbBadge

    /** A video's running time — the master's corner pill. */
    data class Duration(val label: String) : ThumbBadge

    /**
     * The upload did not go through
     * (design/components/compose/MediaThumb.prompt.md).
     *
     * The tile dims and wears this badge; its *words* live beside the row
     * in [com.cogra.core.designsystem.v2.compose.UploadErrorLine], which
     * owns Retry and Remove — "never cram retry into 48px". The two
     * always appear together, so a badge with no line is a bug.
     */
    data object Failed : ThumbBadge
}

/**
 * Where a clip's running time rides.
 *
 * [Corner] is the master's own pill (`MediaThumb.jsx:174-188`): bottom-right
 * at 6, `0 6`, the small (8dp) radius, the time alone — the composer's clip
 * tiles. [Picker] is `ComposePick`'s device-grid tile, a screen-local drawing
 * (`ComposePick.jsx:117-139`): bottom-LEFT at 6, `1px 6px`, the extra-small
 * (4dp) radius, a 10dp play glyph 3dp before the time — the top-right corner
 * belongs to the selection ring there.
 */
enum class DurationPill { Corner, Picker }

/**
 * A thumbnail — the picked tray's 48dp chip, the crop filmstrip's frame,
 * the picker grid's tile, and the composer's clip previews are all this
 * component at different sizes (`design/components/compose/MediaThumb.jsx`).
 *
 * A thumbnail is an *index* into the set rather than the media itself, so it
 * crops. That is the same exception the gallery's secondary squares take.
 *
 * **The × is its own control** (`MediaThumb.jsx:271-287`, `cg-hit`): a
 * 16dp ink in the top-right corner, answering at 48dp around it, named by
 * [removeLabel] — never folded into the tile's own semantics, where a
 * screen reader could not reach it. It hides on a failed tile, whose ways
 * out are the error line's. The cover badge and the × ride different
 * corners, so a tray's first tile wears both.
 *
 * @param selected draws the selection ring — the master's `outline: 2px
 *   solid var(--primary)` at `outlineOffset: 1`, OUTSIDE the tile, so the
 *   framed picture keeps its whole drawn box (`CoverRow.jsx:84-86`,
 *   `ComposeCrop.jsx:58`).
 * @param dimmed the other half of how a strip separates its frames: the
 *   selected one wears the ring, the rest fade to 65%.
 * @param size a fixed edge, or null to fill the width as a square — the
 *   picker grid sizes its tiles by its own columns.
 * @param corner the tray's thumbnails are rounded; the picker grid's tiles
 *   are not, so the seam between them reads as one sheet of pictures.
 * @param width overrides [size] on one axis — the tray's 114×64 clip, the
 *   details stage's 54×96 one, the comment composer's uncropped 70×88.
 * @param height the other half of [width].
 * @param fit `Crop` for an index into the set, `Fit` where the whole frame
 *   must show — the uncropped comment thumbnail's case.
 * @param uploading an upload in flight: the ring rides a scrim over the
 *   tile. Upload starts *after* the crop (only the cropped export is ever
 *   uploaded), so this is the picture's own story on its own tile.
 * @param progress how far that upload has got, where the transport can say.
 *   Null with [uploading] set draws the indeterminate ring.
 * @param duration a clip's running time, at [durationPill]'s corner — drawn
 *   only where the tile reads at least [DurationBadgeMinTile] (jakob's
 *   ruling, 2026-09-22): below that floor the pill would outweigh the picture
 *   it sits on.
 * @param video the composer's video state: the centred play disc
 *   (`MediaThumb.jsx:86,135-153`), drawn whenever a frame is playable — a
 *   frame to show it over, not failed, not uploading — on every measured
 *   tile, sized 26% of the short edge in [20dp, 56dp]. Defaults to [item]'s
 *   own `isVideo`; the composer's picked clips say so here, because their
 *   item carries the picked file rather than a published stream.
 * @param label the neutral tile's word (`MediaThumb.jsx:107-121`): where a
 *   clip yields no still, the tile reserves its space and says what belongs
 *   there — `No frame` — rather than inventing imagery.
 * @param coverSrc a clip's chosen cover, drawn as the frame itself rather
 *   than a word: an inset in the same bottom-left corner [ThumbBadge.Cover]
 *   owns, a third of the tile's short side with a 28dp floor, behind a
 *   hairline ring (`MediaThumb.jsx:93,192-217`). Needs a resolved
 *   [width]/[height] or [size] to size itself.
 * @param onRemove the ×, named [removeLabel] (`Remove this picture`,
 *   `Remove this video`).
 */
@Composable
fun MediaThumb(
    item: MediaItem,
    modifier: Modifier = Modifier,
    size: Dp? = Layout.ThumbSize,
    corner: Dp = Space.x2,
    badge: ThumbBadge? = null,
    selected: Boolean = false,
    dimmed: Boolean = false,
    onClick: (() -> Unit)? = null,
    contentDescription: String? = null,
    width: Dp? = null,
    height: Dp? = null,
    fit: ContentScale = ContentScale.Crop,
    uploading: Boolean = false,
    progress: Float? = null,
    duration: String? = null,
    durationPill: DurationPill = DurationPill.Corner,
    video: Boolean = item.isVideo,
    label: String? = null,
    coverSrc: Any? = null,
    onRemove: (() -> Unit)? = null,
    removeLabel: String = REMOVE_PICTURE,
    removeTestTag: String? = null,
    testTag: String? = null,
) {
    val shape = RoundedCornerShape(corner)
    // A failed tile dims and its remove X gives way to the badge: the
    // error line beside the row owns that tile's ways out.
    val failed = badge == ThumbBadge.Failed
    val sizing = when {
        width != null && height != null -> Modifier.size(width, height)
        size != null -> Modifier.size(size)
        else -> Modifier.fillMaxWidth().aspectRatio(1f)
    }
    val geometry = thumbGeometry(width, height, size)
    // The disc draws only where a frame is playable: a clip, a frame to
    // show it over (the sourceless neutral tile draws nothing,
    // MediaThumb.jsx:87-90), not failed, and not mid-upload.
    val playable = video && item.url != null && !failed && !uploading
    val remove = onRemove ?: (badge as? ThumbBadge.Remove)?.onRemove
    val ring = MaterialTheme.colorScheme.primary
    Box(
        modifier = modifier
            .then(sizing)
            .then(if (selected) Modifier.outsideRing(ring, corner) else Modifier),
    ) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
                .clearAndSetSemantics {
                    // One node for the picture: the badge is a property of
                    // the pick, not a second control to hunt for. An upload
                    // state outranks the picture's own name, because it is
                    // the thing that changed and the thing that needs acting
                    // on. The × is a sibling, outside this node.
                    this.contentDescription = when {
                        failed -> "Didn't upload"
                        uploading && progress != null ->
                            "Uploading, ${(progress.coerceIn(0f, 1f) * PERCENT).toInt()}%"
                        uploading -> "Uploading"
                        else -> contentDescription ?: item.altText ?: label ?: "Picture"
                    }
                },
        ) {
            AsyncImage(
                model = item.imageModel(),
                contentDescription = null,
                contentScale = fit,
                modifier = Modifier
                    .fillMaxSize()
                    .alpha(
                        when {
                            failed -> FAILED_ALPHA
                            dimmed -> DIMMED_ALPHA
                            else -> 1f
                        },
                    ),
            )
            if (item.url == null && label != null) NeutralLabel(label)
            if (playable && geometry.discSize != null) MediaDisc(geometry.discSize)
            if (uploading) UploadRing(progress)
            CornerMarks(badge, geometry, duration, durationPill, coverSrc)
        }
        if (remove != null && !failed) RemoveButton(remove, removeLabel, removeTestTag)
    }
}

/** The tile's corner marks: its badge, a clip's running time, a clip's chosen face. */
@Composable
private fun BoxScope.CornerMarks(
    badge: ThumbBadge?,
    geometry: ThumbGeometry,
    duration: String?,
    durationPill: DurationPill,
    coverSrc: Any?,
) {
    when (badge) {
        is ThumbBadge.Order -> OrderBadge(badge.position)
        ThumbBadge.Cover -> CoverBadge()
        is ThumbBadge.Duration -> if (geometry.durationFits) DurationBadge(badge.label, DurationPill.Corner)
        ThumbBadge.Failed -> FailedBadge()
        is ThumbBadge.Remove, null -> Unit
    }
    // A clip's running time rides *beside* whatever the tile already says
    // about itself: `ComposePick` draws a video tile with the selection ring
    // at one corner and the time at another, so the two are not alternatives.
    if (geometry.durationFits) duration?.let { DurationBadge(it, durationPill) }
    if (coverSrc != null && geometry.coverMarkSize != null) CoverMark(coverSrc, geometry.coverMarkSize)
}

/**
 * The selection ring OUTSIDE the tile: a 2dp primary stroke standing 1dp
 * off its edge (`outline: 2px solid var(--primary); outlineOffset: 1`), so
 * the stroke's centre line runs 2dp out. Drawn behind the tile rather than
 * as a border, which would eat into the picture it marks.
 */
private fun Modifier.outsideRing(color: Color, corner: Dp): Modifier = drawBehind {
    val out = RING_OFFSET.toPx() + RING_WIDTH.toPx() / 2f
    drawRoundRect(
        color = color,
        topLeft = Offset(-out, -out),
        size = Size(size.width + 2 * out, size.height + 2 * out),
        cornerRadius = CornerRadius(corner.toPx() + out),
        style = Stroke(width = RING_WIDTH.toPx()),
    )
}

/**
 * Every size-derived mark on the tile — the cover mark, the duration pill's
 * floor, and the play disc — shares this one edge computation: null on the
 * unmeasured fill-width tile, where no edge is known at composition time.
 */
private data class ThumbGeometry(val coverMarkSize: Dp?, val durationFits: Boolean, val discSize: Dp?)

/** MediaThumb.jsx:93 — the cover mark's diameter as a fraction of the tile's short edge. */
private const val COVER_MARK_EDGE_DIVISOR = 3
private val COVER_MARK_FLOOR = 28.dp

private fun thumbGeometry(width: Dp?, height: Dp?, size: Dp?): ThumbGeometry {
    val explicitW = width ?: size
    val explicitH = height ?: size
    val edge = explicitW?.let { w -> explicitH?.let { h -> minOf(w, h) } }
    return ThumbGeometry(
        coverMarkSize = edge?.let { maxOf(COVER_MARK_FLOOR, it / COVER_MARK_EDGE_DIVISOR) },
        // The duration pill's own floor: an unmeasured (`size = null`)
        // tile is always the pick grid's fill-width column, drawn well
        // over the floor, so only an EXPLICIT small edge hides it.
        durationFits = edge == null || edge >= DurationBadgeMinTile,
        // The play disc's own math (MediaThumb.jsx:86): 26% of the short
        // edge, clamped to [20dp, 56dp]. Null on the unmeasured tile — the
        // pick grid's candidate tiles keep their own pill's glyph.
        discSize = edge?.let { playDiscSize(it) },
    )
}

/**
 * The clip's chosen face, inset bottom-left — a frame rather than a word,
 * because a cover is the clip's own property and never a second attachment
 * (`design/components/compose/MediaThumb.jsx:192-217`): `--radius-small`
 * behind an `outline-variant` hairline.
 */
@Composable
private fun BoxScope.CoverMark(coverSrc: Any?, size: Dp) {
    val shape = MaterialTheme.shapes.small
    AsyncImage(
        model = coverSrc,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(MARK_INSET)
            .size(size)
            .clip(shape)
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shape)
            .testTag("media_thumb_cover_mark"),
    )
}

/**
 * The neutral tile's word (`MediaThumb.jsx:107-121`): `label-small` at the
 * ground's weight, in the secondary ink, `0 var(--space-2)` in from the
 * sides.
 */
@Composable
private fun BoxScope.NeutralLabel(label: String) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .align(Alignment.Center)
            .padding(horizontal = Space.x2)
            .testTag("media_thumb_label"),
    )
}

/**
 * An upload in flight: the ring on its own scrim, centred
 * (`MediaThumb.jsx:219-232`'s `Ring`, on the tile).
 *
 * The scrim is a literal [MediaOverlay] colour rather than a theme role: it
 * dims the whole tile evenly, so it is not the plate register the cover,
 * remove, and duration badges read.
 */
@Composable
private fun BoxScope.UploadRing(progress: Float?) {
    Box(
        modifier = Modifier
            .matchParentSize()
            .background(MediaOverlay.UploadScrim),
        contentAlignment = Alignment.Center,
    ) {
        val ring = Modifier.size(RingSize)
        // White on its own scrim rather than `primary`: the ring sits on
        // arbitrary pixels, so it cannot follow the surface.
        val ink = MediaOverlay.BadgeInk
        val track = MediaOverlay.BadgeInk.copy(alpha = RING_TRACK_ALPHA)
        if (progress == null) {
            // No fraction is known, so the honest ring is the indeterminate
            // one: a made-up percentage would be a number the author could
            // not trust.
            CircularProgressIndicator(
                modifier = ring,
                color = ink,
                trackColor = track,
                strokeWidth = RingStroke,
                strokeCap = StrokeCap.Round,
            )
        } else {
            CircularProgressIndicator(
                progress = { progress.coerceIn(0f, 1f) },
                modifier = ring,
                color = ink,
                trackColor = track,
                strokeWidth = RingStroke,
                strokeCap = StrokeCap.Round,
                gapSize = 0.dp,
            )
        }
    }
}

/**
 * The play disc (`MediaThumb.jsx:135-153`): the centred disc on the
 * snackbar pair (`inverseSurface`/`inverseOnSurface`), over the poster
 * frame. AUTHORING-SIDE ONLY: a reading surface never draws play/pause
 * chrome (MediaThumb.jsx:31-32).
 */
@Composable
private fun BoxScope.MediaDisc(size: Dp) {
    Box(
        modifier = Modifier
            .align(Alignment.Center)
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .testTag("media_thumb_play_disc"),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.inverseOnSurface,
            modifier = Modifier.size(playGlyphSize(size)).testTag("media_thumb_play_glyph"),
        )
    }
}

/**
 * The failed tile's mark: an 18dp `error` dot carrying a bare `!` at
 * `label-medium`, 700 (`MediaThumb.jsx:256-270`).
 *
 * The words are the error line's — this only says *which* tile, which is
 * the one thing 48dp can carry.
 */
@Composable
private fun BoxScope.FailedBadge() {
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(MARK_INSET)
            .size(18.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.error)
            .testTag("media_thumb_failed_badge"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "!",
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = TypeTokens.FailedMarkWeight),
            color = MaterialTheme.colorScheme.onError,
        )
    }
}

private val RingSize = 26.dp
private val RingStroke = 3.dp
private const val RING_TRACK_ALPHA = 0.35f
private const val PERCENT = 100

/** `MediaThumb.jsx`: a failed picture dims to half; an unchosen strip frame to 65%. */
private const val FAILED_ALPHA = 0.5f
private const val DIMMED_ALPHA = 0.65f

/** `outline: 2px solid var(--primary)`, `outlineOffset: 1`. */
private val RING_WIDTH = 2.dp
private val RING_OFFSET = 1.dp

/** Every corner mark stands 3px in (`MediaThumb.jsx`: `left/right/top/bottom: 3px`). */
private val MARK_INSET = 3.dp

/** The pills stand 6px in (`MediaThumb.jsx:174-176`, `ComposePick.jsx:120-121`). */
private val PILL_INSET = 6.dp

/** The × ink (`MediaThumb.jsx:281-282`: 16px) and its glyph (10px). */
private val REMOVE_INK = 16.dp
private val REMOVE_GLYPH = 10.dp

/** The × name a picture's tile carries unless the caller names a clip's. */
const val REMOVE_PICTURE = "Remove this picture"

/** The clip's × name (`ComposePickVideo.jsx`, `ComposeDetailsVideo.jsx`: `removeLabel`). */
const val REMOVE_VIDEO = "Remove this video"

/**
 * The duration pill's own floor (jakob's ruling, 2026-09-22:
 * design/readme.md §13 — "`MediaThumb` draws the pill on an authoring
 * tile of 80px or more, where an author is identifying a file among
 * files").
 */
private val DurationBadgeMinTile = 80.dp

/** MediaThumb.jsx:86 — the disc's diameter as a fraction of the tile's short edge. */
private const val PLAY_DISC_EDGE_FRACTION = 0.26f

/** MediaThumb.jsx:151 — the play glyph's diameter as a fraction of the disc's. */
private const val PLAY_GLYPH_FRACTION = 0.57f

private val PLAY_DISC_FLOOR = 20.dp
private val PLAY_DISC_CEILING = 56.dp

/** The play disc's own math (`MediaThumb.jsx:86`): 26% of the short edge in [20dp, 56dp]. */
private fun playDiscSize(edge: Dp): Dp =
    maxOf(PLAY_DISC_FLOOR, minOf(PLAY_DISC_CEILING, edge * PLAY_DISC_EDGE_FRACTION))

/** The play glyph inside the disc: 57% of its diameter (MediaThumb.jsx:151). */
private fun playGlyphSize(disc: Dp): Dp = disc * PLAY_GLYPH_FRACTION

@Composable
private fun BoxScope.OrderBadge(position: Int?) {
    val filled = position != null
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(PILL_INSET)
            .size(20.dp)
            .clip(CircleShape)
            .then(
                if (filled) {
                    Modifier.background(MaterialTheme.colorScheme.primary)
                } else {
                    Modifier.border(BorderStroke(1.dp, MediaOverlay.PickerRing), CircleShape)
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (position != null) {
            Text(
                text = position.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}

/** The "Cover" badge: `0 5px`, the full radius, 3px in, on the snackbar pair (`MediaThumb.jsx:189-206`). */
@Composable
private fun BoxScope.CoverBadge() {
    Text(
        text = "Cover",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.inverseOnSurface,
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(MARK_INSET)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .testTag("media_thumb_cover_badge")
            .padding(horizontal = 5.dp),
    )
}

/**
 * The ×: a 16dp ink on the snackbar pair, top-right at 3, answering at 48dp
 * around it (`cg-hit`) without growing the tile, and named by [label] — its
 * own node, outside the picture's.
 */
@Composable
private fun BoxScope.RemoveButton(onRemove: () -> Unit, label: String, testTag: String?) {
    Box(
        modifier = Modifier
            .align(Alignment.TopEnd)
            .padding(MARK_INSET)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onRemove)
                    .semantics { contentDescription = label }
                    .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
                drawnWidth = REMOVE_INK,
                drawnHeight = REMOVE_INK,
            ),
    ) {
        // The ink is its own node so its drawn 16dp reads apart from the
        // 48dp target that answers for it.
        Box(
            modifier = Modifier
                .size(REMOVE_INK)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.inverseSurface)
                .testTag("media_thumb_remove_badge"),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.inverseOnSurface,
                modifier = Modifier.size(REMOVE_GLYPH),
            )
        }
    }
}

/** A clip's running time, at [pill]'s corner — see [DurationPill]. */
@Composable
private fun BoxScope.DurationBadge(label: String, pill: DurationPill) {
    when (pill) {
        DurationPill.Corner -> Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.inverseOnSurface,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(PILL_INSET)
                .clip(MaterialTheme.shapes.small)
                .background(MaterialTheme.colorScheme.inverseSurface)
                .testTag("media_thumb_duration_badge")
                .padding(horizontal = PILL_INSET),
        )
        DurationPill.Picker -> Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(PILL_INSET)
                .clip(MaterialTheme.shapes.extraSmall)
                .background(MaterialTheme.colorScheme.inverseSurface)
                .testTag("media_thumb_duration_badge")
                .padding(horizontal = PILL_INSET, vertical = 1.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.PlayArrow,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.inverseOnSurface,
                modifier = Modifier.size(REMOVE_GLYPH),
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.inverseOnSurface,
            )
        }
    }
}

@ThemePreviews
@Composable
private fun MediaThumbBadges() {
    val item = MediaItem(null, 1f, "A picture")
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
                MediaThumb(item, badge = ThumbBadge.Cover, onRemove = {})
                MediaThumb(item, onRemove = {})
                // The crop filmstrip: the framed one wears the ring, the
                // rest fade.
                MediaThumb(item, selected = true)
                MediaThumb(item, dimmed = true)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
                MediaThumb(item, size = 125.dp, badge = ThumbBadge.Order(1))
                MediaThumb(
                    item,
                    size = 125.dp,
                    badge = ThumbBadge.Order(null),
                    duration = "0:42",
                    durationPill = DurationPill.Picker,
                )
                MediaThumb(item, size = 125.dp, badge = ThumbBadge.Duration("0:42"))
            }
        }
    }
}
