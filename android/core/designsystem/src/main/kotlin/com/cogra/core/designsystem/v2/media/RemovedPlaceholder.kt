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
 * The removal mark — `RedactedContent` (design/components/honesty/
 * SensitiveVeil.jsx): a calm statement of fact where a removed body was, never
 * a silent gap (design/readme.md §9, D15).
 *
 * **The two reasons must never read alike.** Collapsing them lets a verdict
 * hide behind an author's decision, so [RemovalReason] is a type and each arm
 * carries its own two lines — the master's `REASONS`, verbatim (copy-voice).
 * An author's own removal and the sweep their account deletion chose are ONE
 * wording, [RemovalReason.Author] (copy-voice, ER-G3: "the author chose the
 * sweep"); the data keeps them apart, the reader does not.
 *
 * EACH LINE SETS ITS WHOLE TYPE ROLE (round 20, seam 245 ask 6): the line in
 * `body-medium`, the detail in `body-small`, the `when` in `label-small` —
 * size, leading, tracking and weight together, none borrowed from the page.
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
     * Replaces the second line where a case needs its own wording — a
     * comment's (`REMOVED_COMMENT_NOTE`: the noun swaps, the mark does not).
     */
    note: String? = null,
    /**
     * The mark's data-node on a registered screen
     * (`profile.identity.removalMark`): it and its `line`, `detail` and
     * `when` then wear the registered paths in place of [testTag].
     */
    node: DataNode? = null,
) {
    val headline = reason.headline()
    // Each reason's own second line (`REASONS`, SensitiveVeil.jsx): the
    // author's says what went and what stays, the verdict's that it was
    // decided in public, the deleted account's what still credits them.
    val detail = note ?: when (reason) {
        RemovalReason.Author ->
            "The words and pictures are gone. The post's place in the thread, and every response, remain."
        RemovalReason.Platform -> "A passed proposal removed it. The decision is public."
        RemovalReason.Account ->
            "Their name and profile are gone. What they signed stays on the graph and still credits them."
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
        // happened. The removal's own moment in the one age ladder
        // (`ageLadder` of `Removal.at`), never the content's age.
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
            RemovedPlaceholder(RemovalReason.Author, timestamp = "2h")
            RemovedPlaceholder(RemovalReason.Platform, timestamp = "20d")
            RemovedPlaceholder(RemovalReason.Account)
        }
    }
}

/**
 * The mark's own words for [this] reason — the placeholder's headline, and
 * what a quoted removed thing reads in its body's place (the score's trace
 * cover): the removed words never reach a quote.
 */
fun RemovalReason.headline(): String = when (this) {
    RemovalReason.Author -> "Removed by its author"
    RemovalReason.Platform -> "Removed under the platform's rules"
    RemovalReason.Account -> "Deleted by the person whose account it was"
}
