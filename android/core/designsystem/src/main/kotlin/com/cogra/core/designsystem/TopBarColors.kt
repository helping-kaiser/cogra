package com.cogra.core.designsystem

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBarColors
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable

/**
 * The app's top bar colors: no on-scroll tint. M3's default swaps to
 * `scrolledContainerColor` once content runs under the bar, but here
 * the bar shares the screen's collapsing top with the key banner, and
 * the region reads as one `surface` plane — matching the web's sticky
 * header (design.md §6).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun surfaceTopAppBarColors(): TopAppBarColors =
    TopAppBarDefaults.topAppBarColors(
        scrolledContainerColor = MaterialTheme.colorScheme.surface,
    )
