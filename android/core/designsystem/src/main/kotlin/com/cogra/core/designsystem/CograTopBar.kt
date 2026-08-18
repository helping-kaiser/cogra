package com.cogra.core.designsystem

import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * The house top app bar: M3's small [TopAppBar] pinned to a 48dp row —
 * the compact height popular apps sit at (design.md §6) — in place of
 * the 64dp default. One wrapper so every screen carries the same bar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CograTopBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
) {
    TopAppBar(
        title = title,
        modifier = modifier,
        navigationIcon = navigationIcon,
        actions = actions,
        expandedHeight = 48.dp,
    )
}
