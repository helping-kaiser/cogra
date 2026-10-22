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
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
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
    timestamp: String? = null,
    shape: Shape = MaterialTheme.shapes.medium,
    testTag: String? = null,
    /**
     * The mark's data-node on a registered screen
     * (`profile.identity.removalMark`): it and its `line`, `detail` and
     * `when` then wear the registered paths in place of [testTag].
     */
    node: DataNode? = null,
) {
    val headline = when (reason) {
        RemovalReason.Author -> "Removed by its author"
        RemovalReason.Platform -> "Removed under the platform's rules"
        RemovalReason.Account -> "Deleted by the person whose account it was"
    }
    // The second line is the same fact for a post's two reasons — what
    // survives is the skeleton either way — so those two are told apart by
    // the headline, which is the distinction design/readme.md §9 actually
    // requires. The wording is the canonical `Removed` board's, verbatim. A
    // deleted account's is its own (`REASONS.account`, SensitiveVeil.jsx).
    val detail = when (reason) {
        RemovalReason.Account ->
            "Their name and profile are gone. What they signed stays on the graph and still credits them."
        else -> "The post's place in the thread, and every response, remain."
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            // The registered node is the mark's whole box (`RedactedContent`).
            .dataNode(node)
            .padding(Space.x4)
            .then(if (node == null && testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = headline,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.fillMaxWidth().dataNode(node?.div("line")),
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().dataNode(node?.div("detail")),
        )
        // Part of the surviving skeleton: a removal never hides when it
        // happened.
        if (timestamp != null) {
            Text(
                text = timestamp,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(node?.div("when")),
            )
        }
    }
}

@ThemePreviews
@Composable
private fun RemovedPlaceholderReasons() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            RemovedPlaceholder(RemovalReason.Author, timestamp = "today")
            RemovedPlaceholder(RemovalReason.Platform, timestamp = "today")
            RemovedPlaceholder(RemovalReason.Account)
        }
    }
}
