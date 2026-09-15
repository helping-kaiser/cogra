package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.token.Space

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

/**
 * A list surface with nothing in it yet — the master this carries over
 * (`design/components/states/EmptyState.jsx`), whose own header calls it
 * "the stated requirement, built": design.md §6 names DESIGNED, NOT BLANK
 * as the rule and the master exists because the product had shipped bare
 * text against it with no shared shape.
 *
 * **A calm statement plus, where there is one, the single action that
 * fills it** (the master's register rules, §7 and §9): never a scold,
 * never a sell, never `error` colouring — an empty list is not a fault.
 * [title] is the fact; [action] rides below it when the surface has one,
 * built from [actionLabel] and [onAction] the way the master's own
 * `actionLabel && onAction` fallback does, or passed whole for a case the
 * two strings can't express.
 *
 * No live region: unlike [LoadingState], the master draws this with no
 * `aria-live`, and a list that has always been empty has nothing to
 * announce arriving.
 */
@Composable
fun EmptyState(
    testTag: String,
    modifier: Modifier = Modifier,
    title: String,
    action: (@Composable () -> Unit)? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        // Merged, so the tag names one unit for a test to assert on — the
        // title's own text and, once there is one, the action's — rather
        // than a bare container a text assertion can't see into.
        modifier = modifier
            .testTag(testTag)
            .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        when {
            action != null -> action()
            actionLabel != null && onAction != null -> OutlinedButton(
                onClick = onAction,
                modifier = Modifier.testTag("${testTag}_action"),
            ) {
                Text(actionLabel)
            }
        }
    }
}
