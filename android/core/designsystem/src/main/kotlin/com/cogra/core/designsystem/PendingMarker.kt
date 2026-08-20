package com.cogra.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource

/**
 * The honesty surface for content that has been authored and signed but
 * is not yet L1-final (design.md §9). Content shows in full to every
 * reader — nothing is greyed out or held back, only its place in the
 * order is not yet fixed — so this is a quiet line beside it and never
 * `error` colouring. It is words, not a colour: the meaning survives a
 * reader who sees no colour at all (design.md §10).
 */
@Composable
fun PendingMarker(
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = stringResource(R.string.pending_settling),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.testTag(testTag),
    )
}
