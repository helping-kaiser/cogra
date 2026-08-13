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
 * The house inline error line: a string resource in the error color.
 * A polite live region, so its appearance is announced — the Compose
 * twin of the web app's `role="alert"`.
 */
@Composable
fun ErrorLine(
    @StringRes text: Int,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = stringResource(text),
        color = MaterialTheme.colorScheme.error,
        modifier = modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .testTag(testTag),
    )
}
