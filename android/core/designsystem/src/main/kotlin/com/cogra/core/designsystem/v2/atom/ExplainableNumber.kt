// THE SHAPE EVERY NUMBER TAKES (`design/components/proposed/ExplainableNumber.jsx`
// + `.prompt.md`): a quiet figure that opens its own explanation, never the
// explanation itself. The product's one figure is the Feed score every ranked
// card wears, and its explanation is four screens deep (`FeedEntry` and
// below). The web's twin is `web/src/lib/ui2/explainable-number.tsx`.
//
// - A GLYPH, NOT A WORD: `graph`, the label living in the accessibility tree,
//   which keeps the affordance row on one line.
// - The figure is drawn in BOTH reading modes (readme §13): geek mode governs
//   the pairs, and a score has no glyph that could carry its magnitude.
// - NEGATIVE IS ORDINARY: a minus, never a colour.
// - NO VALUE, NO FIGURE: a thing still settling stands as the bare glyph and
//   the door still opens (ruling 90); the dash is a value, passed as one.
// - A PENDING MARK'S WORDS UNDER THE BARE GLYPH, INSIDE THE DOOR (round 26,
//   seam 250): the stream's settling face. The glyph row keeps the 48dp it
//   stood in, so the glyph does not move; the words are the node's `settling`.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** The master's glyph, `Icon name={glyph} size={18}`. */
private val GLYPH = 18.dp

/** The 6px seam between the glyph and the figure. */
private val GAP = 6.dp

/** `padding: 0 8px; margin: 0 -8px` — the pill's ink reaches past its layout box. */
private val PAD = 8.dp

/** The pending mark's column (`maxWidth: 56`). */
private val PENDING_WIDTH = 56.dp

/** The media dress: the master's `drop-shadow(0 1px 3px rgba(0,0,0,0.6))`. */
private val MEDIA_SHADOW = Shadow(color = Color.Black.copy(alpha = 0.6f), offset = Offset(0f, 1f), blurRadius = 3f)

/**
 * One explainable figure (`ExplainableNumber`).
 *
 * @param label the spoken name (`Feed score`); with the glyph it lives only in
 *   the accessibility tree, and the door speaks it with what it shows:
 *   `Feed score 15.20`, `Feed score Still settling`, or the bare name.
 * @param value already formatted (`15.20`, `−0.50`, the dash); null draws the
 *   bare glyph — a figure still settling, which has nothing to show.
 * @param pending a pending mark's words under the bare glyph (the stream's
 *   `Still settling`); given, no figure is drawn.
 * @param overMedia the media dress: white glyph and figure under a soft shadow,
 *   because a token colour on photography is not quiet but invisible.
 * @param node the registered slot (`feed.card.actionRow.score`); its figure is
 *   `value`, its pending mark `settling`.
 */
@Composable
fun ExplainableNumber(
    label: String,
    value: String?,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    pending: String? = null,
    overMedia: Boolean = false,
    node: DataNode? = null,
    testTag: String? = null,
) {
    val figure = if (pending == null) value else null
    val spoken = when {
        pending != null -> "$label $pending"
        figure == null -> label
        else -> "$label $figure"
    }
    val quiet = if (overMedia) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
    val door = modifier
        .bleedHorizontally(PAD)
        .then(if (node != null) Modifier.dataNode(node) else Modifier.dataNode(testTag?.let(::DataNode)))
        .clip(CircleShape)
        .clickable(role = Role.Button, onClick = onOpen)
        .semantics(mergeDescendants = true) { contentDescription = spoken }
        .padding(horizontal = PAD)
    if (pending != null) {
        Column(
            modifier = door,
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Box(Modifier.heightIn(min = Layout.TouchTargetMin), contentAlignment = Alignment.Center) {
                GraphGlyph(GLYPH, quiet)
            }
            Text(
                text = pending,
                style = MaterialTheme.typography.labelSmall.dressed(overMedia),
                color = quiet,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .widthIn(max = PENDING_WIDTH)
                    .dataNode(node?.div("settling")),
            )
        }
        return
    }
    Row(
        modifier = door.heightIn(min = Layout.TouchTargetMin),
        horizontalArrangement = Arrangement.spacedBy(GAP),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GraphGlyph(GLYPH, quiet)
        if (figure != null) {
            Text(
                text = figure,
                style = MaterialTheme.typography.bodySmall.dressed(overMedia),
                fontWeight = FontWeight.Medium,
                color = if (overMedia) Color.White else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                // The door's own name speaks the figure with its label (`Feed score 15.20`).
                modifier = Modifier.dataNode(node?.div("value")),
            )
        }
    }
}

/** The media dress's shadow on a type rung; off media the rung as it is. */
private fun TextStyle.dressed(overMedia: Boolean): TextStyle = if (overMedia) copy(shadow = MEDIA_SHADOW) else this

@ThemePreviews
@Composable
private fun ExplainableNumberPreview() {
    Cogra2PreviewTheme {
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
            ExplainableNumber(label = "Feed score", value = "15.20", onOpen = {})
            ExplainableNumber(label = "Feed score", value = "—", onOpen = {})
            ExplainableNumber(label = "Feed score", value = null, onOpen = {})
            ExplainableNumber(label = "Feed score", value = null, pending = "Still settling", onOpen = {})
        }
    }
}
