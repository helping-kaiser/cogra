package com.cogra.core.designsystem.v2.atom

import androidx.compose.ui.graphics.vector.ImageVector

/**
 * One cell of a [TabBar]: a glyph cell when it has an [icon] (named by
 * [label] in the accessibility tree, the only name an icon-only control can
 * have), else [label] as its own words.
 */
data class TabBarTab(val id: String, val label: String, val icon: ImageVector? = null)
