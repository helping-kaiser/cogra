// THE THING BEING ANSWERED, HELD ABOVE THE ANSWER (`design/components/core/
// QuotedRow.jsx`): what a surface is about — whose it is and how it starts —
// on a tone of its own, CONTAINED and INERT. The web's twin is
// `web/src/lib/ui2/quoted-row.tsx`.
//
// The snippet ellipsizes and the title does not: the title is a name and a
// handle — losing its end loses who — while the snippet is only a taste. The
// column carries no gap: title and snippet are one two-line address.
//
// `mark` STANDS WHERE THE PICTURE STANDS, for a quoted thing whose face is not
// a person's (a tag held above the score's trace wears its `#` tile).
// `attach` SQUARES THE TOP-LEFT CORNER under a flag, so flag and row read as
// one folder-tab silhouette — the score's trace hangs its figure that way.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** The row's own minimum (`minHeight: 56px`). */
private val MIN_HEIGHT = 56.dp

/** The quoted person's disc (`MonogramAvatar size={32}`). */
private val DISC = 32.dp

/**
 * One quoted thing: [title] over its one-line [snippet], led by the person's
 * disc ([name], [src]) or by [mark] where the thing's face is not a person's.
 * [node] names its `title`, `snippet` and the disc it draws as `disc`; a
 * [mark] is named by whoever placed it.
 */
@Composable
fun QuotedRow(
    title: String,
    modifier: Modifier = Modifier,
    snippet: String? = null,
    name: String = "",
    src: String? = null,
    mark: (@Composable () -> Unit)? = null,
    attach: Boolean = false,
    node: DataNode? = null,
) {
    val small = MaterialTheme.shapes.small
    val shape = if (attach) small.copy(topStart = CornerSize(0.dp)) else small
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = MIN_HEIGHT)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .dataNode(node)
            .padding(horizontal = Space.x3, vertical = Space.x2),
    ) {
        if (mark != null) {
            mark()
        } else {
            Box(Modifier.dataNode(node?.div("disc"))) { CograAvatar(name = name, size = DISC, url = src) }
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.fillMaxWidth().dataNode(node?.div("title")),
            )
            if (snippet != null) {
                Text(
                    text = snippet,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().dataNode(node?.div("snippet")),
                )
            }
        }
    }
}

@ThemePreviews
@Composable
private fun QuotedRowPreview() {
    Cogra2PreviewTheme {
        Column(Modifier.padding(Space.x4), verticalArrangement = Arrangement.spacedBy(Space.x3)) {
            QuotedRow(
                title = "The long way home — @ada",
                snippet = "Took the coast road instead of the tunnel. Four hours longer, worth every minute.",
                name = "Ada Lindqvist",
            )
            QuotedRow(title = "#saltmaps", mark = { NodeMark(MarkKind.TOPIC, "saltmaps", null) }, attach = true)
        }
    }
}
