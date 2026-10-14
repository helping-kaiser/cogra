package com.cogra.core.designsystem.v2.atom

import androidx.compose.ui.graphics.vector.ImageVector

/** What fills a [ContentRow]'s disc, by the master's precedence. */
sealed interface ContentRowDisc {
    data class Glyph(val icon: ImageVector) : ContentRowDisc

    data class Picture(val url: Any, val name: String) : ContentRowDisc

    data class Monogram(val name: String) : ContentRowDisc

    /** A stance's face where a picture would go, no digits (the chronicle's opinion row). */
    data class Face(val directed: Double, val interest: Double) : ContentRowDisc

    /** A deleted account: the disc keeps its space and fills with nothing. */
    data object Redacted : ContentRowDisc
}
