// THE ROW LINE (design/components/honesty/TransportError.jsx, `SigningPending`'s
// `row` form; RowSigning.md; the failure pack, jakob 2026-09-30 and
// 2026-10-01): the one line a target's own row carries for what happened to a
// gesture made on it — under the face, in the slot the pending marker uses, on
// one line, because the row is one line of controls by rule. web's twin is
// `web/src/lib/ui/row-line.tsx`.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * The line in one of its [RowLineState]s. A failure is announced as an alert (an assertive live region), NEVER a
 * snackbar — the Snackbar charter keeps that for confirmations — and it
 * stands until Retry, another act on the same anchor, or the surface's next
 * fresh load, never on a timer.
 */
@Composable
fun RowLine(
    state: RowLineState,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    when (state) {
        RowLineState.Signing -> Text(
            text = stringResource(R.string.row_line_signing),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            modifier = modifier
                .testTag(testTag)
                .semantics { liveRegion = LiveRegionMode.Polite },
        )

        is RowLineState.DidntSign ->
            FailureLine(stringResource(R.string.row_line_didnt_sign), state.onRetry, testTag, modifier)

        is RowLineState.DidntGoThrough ->
            FailureLine(stringResource(R.string.row_line_didnt_go_through), state.onRetry, testTag, modifier)
    }
}

@Composable
private fun FailureLine(words: String, onRetry: () -> Unit, testTag: String, modifier: Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier
            .testTag(testTag)
            .semantics(mergeDescendants = false) { liveRegion = LiveRegionMode.Assertive },
    ) {
        Text(
            text = words,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        TextButton(onClick = onRetry, modifier = Modifier.testTag("${testTag}_retry")) {
            Text(stringResource(R.string.row_line_retry), style = MaterialTheme.typography.labelSmall)
        }
    }
}
