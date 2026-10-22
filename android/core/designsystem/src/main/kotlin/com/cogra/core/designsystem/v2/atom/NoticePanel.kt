package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space

/**
 * THE NOTICE PANEL (`design/components/honesty/NoticePanel.jsx`, the failure
 * pack): the `tertiaryContainer` block a surface wears when the one act it
 * exists for cannot happen right now and nothing failed — nothing staged,
 * signed or spent. A notice, not a fault, so it never takes `error`.
 *
 * Its anatomy is the master's: the title in `title-medium`, the panel's one
 * "?" in the panel's own ink beside it ([HelpDot]'s `inverse`), then the
 * lines in `body-medium` ([NoticeLine]). `medium` corner rung by default —
 * the rung the panel takes beside other content.
 */
@Composable
fun NoticePanel(
    title: String,
    modifier: Modifier = Modifier,
    helpLabel: String? = null,
    onHelp: () -> Unit = {},
    helpTestTag: String? = null,
    testTag: String? = null,
    content: @Composable () -> Unit,
) {
    val ink = MaterialTheme.colorScheme.onTertiaryContainer
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        // The tag names the panel, its ground included.
        modifier = modifier
            .fillMaxWidth()
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(Space.x4),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = ink,
                modifier = Modifier
                    .weight(1f)
                    .semantics { heading() },
            )
            if (helpLabel != null) HelpDot(onHelp, helpLabel, testTag = helpTestTag, tint = ink)
        }
        content()
    }
}

/** The panel's sentence — `body-medium` in the panel's own ink (`NoticeLine`). */
@Composable
fun NoticeLine(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onTertiaryContainer,
        modifier = modifier,
    )
}
