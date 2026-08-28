package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * A calm placeholder where a removed body was — never a silent gap
 * (design/readme.md §9, D15).
 *
 * **The two reasons must never read alike.** Collapsing them lets a verdict
 * hide behind an author's decision, so [RemovalReason] is a type and each arm
 * carries its own sentence. The wording is design/readme.md §13's, verbatim.
 *
 * **No `error` colouring.** A removal is a statement of fact, not a failure,
 * so this sits on `surfaceContainerHigh` in `onSurfaceVariant` — the same
 * quiet register as the other honesty surfaces.
 *
 * Redaction is record-granular: every authored field goes at once, so this
 * replaces the whole body rather than one attachment. What survives is the
 * skeleton — author, timestamp, thread position, standing — and the card
 * around this component keeps drawing it.
 */
@Composable
fun RemovedPlaceholder(
    reason: RemovalReason,
    modifier: Modifier = Modifier,
    shape: Shape = MaterialTheme.shapes.medium,
    testTag: String? = null,
) {
    val headline = when (reason) {
        RemovalReason.Author -> "Removed by its author"
        RemovalReason.Platform -> "Removed under the platform's rules"
    }
    val detail = when (reason) {
        RemovalReason.Author -> "The author took this down. Everything around it stays."
        RemovalReason.Platform -> "A proposal carried against this content. Everything around it stays."
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(Space.x4)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = headline,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@ThemePreviews
@Composable
private fun RemovedPlaceholderReasons() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            RemovedPlaceholder(RemovalReason.Author)
            RemovedPlaceholder(RemovalReason.Platform)
        }
    }
}
