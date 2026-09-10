package com.cogra.core.designsystem.v2.atom

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.R

/**
 * A surface that has nothing to show yet.
 *
 * **A line of text, not a spinner and not a shimmering skeleton**
 * (`design/components/states/EmptyState.prompt.md`): motion clarifies
 * where something came from and never performs, and a skeleton that
 * pretends to be content is the opposite of the honesty surfaces. The
 * board draws `body-medium` on `onSurfaceVariant`, and names the role
 * itself.
 *
 * A polite live region, the Compose twin of the board's
 * `role="status" aria-live="polite"` — the line is announced when it
 * arrives rather than passed over.
 *
 * This says what the surface is doing and nothing else. It is not the
 * pull-to-refresh indicator, which belongs to a gesture the reader made
 * and reports that gesture rather than the surface's state.
 */
@Composable
fun LoadingState(
    testTag: String,
    modifier: Modifier = Modifier,
    label: String = stringResource(R.string.loading_state),
) {
    Text(
        text = label,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .testTag(testTag),
    )
}
