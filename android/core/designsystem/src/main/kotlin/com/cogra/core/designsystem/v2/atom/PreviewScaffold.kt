package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space

/**
 * Preview scaffolding shared by the 2.0 gallery: a variant strip on the page
 * ground, so a component is read against `surface` rather than against the
 * tooling's white.
 *
 * The width matches the canvas boards (390dp) wherever a component's layout
 * depends on it, so a preview and its board are the same measurement.
 */
internal const val CANVAS_WIDTH_DP = 390

@Composable
internal fun PreviewRow(content: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier
            .background(MaterialTheme.colorScheme.surface)
            .padding(Space.x4),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
internal fun PreviewColumn(
    canvasWidth: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier
            .then(if (canvasWidth) Modifier.width(CANVAS_WIDTH_DP.dp) else Modifier)
            .background(MaterialTheme.colorScheme.surface)
            .padding(Space.x4),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        content = content,
    )
}
