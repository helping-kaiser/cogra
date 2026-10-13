package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * A forward-ladder count in words — `6 days`, `1 day`, `5 hours` — for the
 * sentences that carry it (`in %1$s`). [count] and [inHours] are the
 * ladder's own answer; the rounding is the domain's, never redone here.
 */
@Composable
fun forwardCount(count: Int, inHours: Boolean): String =
    pluralStringResource(if (inHours) R.plurals.forward_hours else R.plurals.forward_days, count, count)

/**
 * The deletion band (`design/components/navigation/DeletionBand.jsx`, readme
 * §13; jakob 2026-09-11). A confirmed account deletion waits out seven days
 * and can be called off until then; the band says when, and carries the way
 * back, on every logged-in surface for the whole window — a state only a
 * settings page confessed is one most readers would meet at the deadline.
 *
 * **A sibling of [BorrowedViewBand], not the same band.** They share the
 * slot under the header and nothing else: this one is a countdown on the
 * reader's own account with an act at its end, so it is FILLED — the
 * shell's own `surface-bar` (`surfaceContainer`) — and its line is
 * `onSurface`, where the borrowed band is transparent and secondary.
 *
 * **Never `error`.** The reader asked for this and it is proceeding as asked;
 * colouring a chosen act like a fault would be the surface arguing with the
 * decision (`DeletionBand.prompt.md`).
 *
 * [count] is the line's forward-ladder count in words ([forwardCount]);
 * [content] switches the sentence to name the content sweep the request
 * opted into, and nothing else about the band changes. Given a [node] it
 * wears the registered paths (`feed.deletionBand`, `.line`, `.cancel`).
 */
@Composable
fun DeletionBand(
    count: String,
    content: Boolean,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    cancelLabel: String = stringResource(R.string.deletion_band_cancel),
    node: DataNode? = null,
    testTag: String = "deletion_band",
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .then(if (node != null) Modifier.dataNode(node) else Modifier.testTag(testTag)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = stringResource(
                    if (content) R.string.deletion_band_content else R.string.deletion_band_account,
                    count,
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .weight(1f)
                    .testTag(node?.div("line")?.tag ?: "${testTag}_line"),
            )
            InlineAction(
                text = cancelLabel,
                onClick = onCancel,
                testTag = node?.div("cancel")?.tag ?: "${testTag}_cancel",
            )
        }
        Hairline()
    }
}

@ThemePreviews
@Composable
private fun DeletionBandVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            DeletionBand(count = forwardCount(6, inHours = false), content = false, onCancel = {})
            DeletionBand(count = forwardCount(6, inHours = false), content = true, onCancel = {})
            DeletionBand(count = forwardCount(5, inHours = true), content = false, onCancel = {})
        }
    }
}
