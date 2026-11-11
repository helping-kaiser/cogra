package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics

/**
 * The house inline error line (`TransportError.jsx`): a string resource in
 * the error color, set in `body-medium` whole — size, 20sp leading, 0.25sp
 * tracking, weight — never the inherited `body-large` (round 28, seam 254
 * item 5).
 * A polite live region, so its appearance is announced — the Compose
 * twin of the web app's `role="alert"`.
 */
@Composable
fun ErrorLine(
    @StringRes text: Int,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    ErrorLine(stringResource(text), testTag, modifier)
}

/**
 * The same line carrying words this client did not write — a
 * field-level refusal, verbatim, so the reader sees what the server
 * actually objected to rather than a house paraphrase of it.
 */
@Composable
fun ErrorLine(
    text: String,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
        modifier = modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .testTag(testTag),
    )
}
