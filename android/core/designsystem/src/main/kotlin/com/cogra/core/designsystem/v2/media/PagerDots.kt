package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.cogra.core.designsystem.v2.token.MediaOverlay

/**
 * Which slots a windowed row shows, and which of its edges are running past
 * more of the set.
 *
 * Split out from the drawing because it is the whole of item 67's ruling that
 * can be asserted without a renderer — above all the clamp, which is what keeps
 * the active dot off a shrunk edge.
 *
 * @param start the first index the row draws.
 * @param window how many slots it draws — the set, capped at
 *   [MediaFrame.DOT_WINDOW].
 */
data class DotWindow(val start: Int, val window: Int, val moreBefore: Boolean, val moreAfter: Boolean) {
    /** The indices this row draws, in order. */
    val slots: IntRange get() = start until (start + window)
}

/**
 * **The window slides, centred on where the reader is**
 * (`design/components/media/MediaAttachment.jsx:313-316`): its start is the
 * current index less half the window, clamped to the set's two ends — so the
 * active dot travels to the middle and stays there while the row moves under
 * it, and at either end the window parks so the last dot of the set can be
 * reached.
 */
fun dotWindow(count: Int, current: Int): DotWindow {
    val window = minOf(count, MediaFrame.DOT_WINDOW)
    // `window shr 1` is the master's own half (`:351`): three for a seven-slot
    // row, which puts the active dot in the middle slot.
    val start = (current - (window shr 1)).coerceIn(0, maxOf(0, count - window))
    return DotWindow(
        start = start,
        window = window,
        moreBefore = start > 0,
        moreAfter = start + window < count,
    )
}

/**
 * What ink a row is drawn in — **two tones, one row**
 * (`MediaAttachment.jsx:334-337`).
 *
 * [Card] is the page's own ink: `primary` for here, the outline for the rest.
 * [Viewer] has no surface to borrow from — the viewer's ground is black and an
 * unknown photograph is behind every dot — so it is white, dimmed for the rest,
 * and the row carries a drop shadow in the drawing.
 */
enum class DotTone { Card, Viewer }

/**
 * The pager's position marker, windowed (design/backlog.md item 67, ruled
 * 2026-09-14; drawn as `PagerDots` in `MediaAttachment.jsx:296-394`).
 *
 * **One row serves both pagers.** The card and the viewer page the same set
 * with the same gesture, "so a marker that windowed in one and ran long in the
 * other would be two vocabularies for one position" (`:300-302`).
 *
 * **A row that grows with the set stops being a position marker** (`:307-311`):
 * ten dots at 12dp of pitch is a ruler, and a reader counting rungs is doing
 * the work the marker exists to save. So the row has a ceiling of
 * [MediaFrame.DOT_WINDOW] slots and past it is a window onto the set.
 *
 * **An edge dot with more beyond it is smaller** (`:318-324`) — one smaller
 * size and not a ladder of them, and the active dot is never the shrunk one.
 *
 * **Every slot keeps its pitch** (`:326-328`): the dot is centred in a slot the
 * size of a full dot, so shrinking one moves nothing beside it.
 *
 * **The count is not drawn** (`:330-332`). The row carries "Picture n of m" as
 * its description and the dots themselves are cleared from the tree — they are
 * decoration for a position already stated in words.
 */
@Composable
fun PagerDots(
    count: Int,
    current: Int,
    modifier: Modifier = Modifier,
    tone: DotTone = DotTone.Card,
    testTag: String? = null,
) {
    // One picture has no position to mark (`MediaAttachment.jsx:348`).
    if (count < 2) return

    val position = stringResource(R.string.designsystem_gallery_position, current + 1, count)
    val window = dotWindow(count, current)
    val on = when (tone) {
        DotTone.Card -> MaterialTheme.colorScheme.primary
        DotTone.Viewer -> MediaOverlay.BadgeInk
    }
    val off = when (tone) {
        DotTone.Card -> MaterialTheme.colorScheme.outlineVariant
        DotTone.Viewer -> MediaOverlay.BadgeInk.copy(alpha = VIEWER_OFF_ALPHA)
    }

    Row(
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .clearAndSetSemantics { contentDescription = position },
        horizontalArrangement = Arrangement.spacedBy(MediaFrame.DotGap, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        window.slots.forEachIndexed { offset, index ->
            val edge = (offset == 0 && window.moreBefore) ||
                (offset == window.window - 1 && window.moreAfter)
            Slot(
                size = if (edge) MediaFrame.DotEdge else MediaFrame.Dot,
                colour = if (index == current) on else off,
            )
        }
    }
}

/**
 * One slot — always a full dot wide, whatever the dot inside it does.
 *
 * The slots carry no tags of their own because the row clears its descendants
 * from the semantics tree: the position is stated once, in words, and a row of
 * seven individually announced circles is the noise that ruling avoids.
 */
@Composable
private fun Slot(size: Dp, colour: Color) {
    Box(
        modifier = Modifier.size(MediaFrame.Dot),
        contentAlignment = Alignment.Center,
    ) {
        Box(modifier = Modifier.size(size).clip(CircleShape).background(colour))
    }
}

/** `rgba(255,255,255,0.42)` — the viewer row's inactive dot (`:344`). */
private const val VIEWER_OFF_ALPHA = 0.42f
