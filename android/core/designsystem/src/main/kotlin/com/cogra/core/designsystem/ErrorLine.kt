package com.cogra.core.designsystem

import androidx.annotation.StringRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource

/** The house inline error line: a string resource in the error color. */
@Composable
fun ErrorLine(
    @StringRes text: Int,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = stringResource(text),
        color = MaterialTheme.colorScheme.error,
        modifier = modifier.testTag(testTag),
    )
}
