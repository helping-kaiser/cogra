package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space

/**
 * Preview scaffolding for the media gallery, at the canvas boards' own 390dp
 * width so a preview and its board are the same measurement.
 */
@Composable
internal fun PreviewMediaColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .width(390.dp)
            .background(MaterialTheme.colorScheme.surface)
            .padding(Space.x4),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        content = content,
    )
}
