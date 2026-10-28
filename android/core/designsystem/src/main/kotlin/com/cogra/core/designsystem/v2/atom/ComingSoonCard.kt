// THE COMING-SOON DOOR (`design/components/states/ComingSoonCard.jsx`): what
// a slot opens while the surface behind it is drawn after V1.0 — the wallet's
// today. A DRAWN ANATOMY, NOT BARE WORDS: a card on the brand wash (`WashCard`
// with no coin) with a headline — the thing, an em dash, `coming soon` — and
// one line of what will be there. No action, no date: the shell around it is
// the way on. One face for every reader state.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space

/** `--radius-large`. */
private val WASH_RADIUS = 16.dp

/**
 * `WashCard ghost={false}`: `0 16` margin, the large radius, `--surface-hero`
 * at 140°, `20` padding, `8` between the headline and the line.
 *
 * THE WASH IS DRAWN FROM ROLES: `--surface-hero` runs `secondaryContainer` →
 * a middle stop no role carries → `surface`; Android has no token for that
 * middle stop yet, so the wash runs the two roles end to end.
 */
@Composable
fun ComingSoonCard(headline: String, line: String, modifier: Modifier = Modifier, node: DataNode? = null) {
    val wash = listOf(MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.surface)
    Column(
        modifier = modifier
            .padding(horizontal = Space.x4)
            .fillMaxWidth()
            .clip(RoundedCornerShape(WASH_RADIUS))
            .background(AngledGradientBrush(wash, WASH_STOPS))
            .dataNode(node)
            .padding(Space.x5),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = headline,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.semantics { heading() }.dataNode(node?.div("title")),
        )
        Text(
            text = line,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(node?.div("line")),
        )
    }
}

private val WASH_STOPS = listOf(0f, 1f)
