package com.cogra.feature.content.wizard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space

/**
 * The caption band every body board draws under its header: one
 * sentence saying what this stage is for, and the quiet `primary` word
 * that switches to the other half of the body.
 *
 * Geometry is the canonical boards': `padding: 8px 24px`, the sentence
 * in `bodyMedium` on `onSurfaceVariant`, the switch as an
 * [InlineAction].
 */
@Composable
internal fun WizardCaption(
    text: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
    actionTestTag: String? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        if (actionText != null && onAction != null) {
            InlineAction(text = actionText, onClick = onAction, testTag = actionTestTag)
        }
    }
}

/**
 * The body column every wizard stage sits in: the 24dp screen gutter,
 * an 8dp lead under the caption, and the stage's own vertical rhythm.
 *
 * It takes the rest of the screen so a stage can push its committing
 * action to the bottom with a `Spacer(Modifier.weight(1f))`, which is
 * how every canonical board ends.
 */
@Composable
internal fun ColumnScope.WizardBody(
    modifier: Modifier = Modifier,
    gap: androidx.compose.ui.unit.Dp = Space.x3,
    /**
     * The stage's own lead and tail. The boards do not share one: the
     * words half and the seal breathe 8 above and 24 below, the crop
     * closes at 16, and the details board leads at 12. Defaulting to the
     * common pair and naming the exceptions is what keeps each stage on
     * its own board rather than on an average of them.
     */
    top: androidx.compose.ui.unit.Dp = Space.x2,
    bottom: androidx.compose.ui.unit.Dp = Layout.ScreenGutter,
    /**
     * Whether the stage scrolls when it does not fit.
     *
     * The canonical boards are drawn at 390×844 and fit exactly there,
     * which is not a promise about any real device. A stage whose
     * controls can fall below the fold scrolls — the crop's non-drag
     * route in particular is required to be reachable (D17), and a
     * required control that a short screen hides is not reachable.
     *
     * The crop viewport keeps its pan gesture: it consumes the drag
     * before the scrolling parent sees it, so the picture moves inside
     * the frame and the page moves everywhere else.
     */
    scrollable: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .weight(1f)
            .then(if (scrollable) Modifier.verticalScroll(rememberScrollState()) else Modifier)
            .padding(
                start = Layout.ScreenGutter,
                end = Layout.ScreenGutter,
                top = top,
                bottom = bottom,
            ),
        verticalArrangement = Arrangement.spacedBy(gap),
        content = content,
    )
}

/** The 4dp seam the picker grid and the gallery share. */
internal val GridSeam = 3.dp

/** The picker grid's tile, read off `ComposePick`. */
internal val PickerTile = 125.dp
