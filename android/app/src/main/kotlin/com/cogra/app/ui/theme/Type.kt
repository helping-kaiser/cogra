package com.cogra.app.ui.theme

import androidx.compose.material3.Typography

/**
 * Typography token. Material 3 defaults for now — but centralizing the
 * [Typography] here means a font or scale change is one edit, not a screen
 * sweep, since screens read styles via
 * [androidx.compose.material3.MaterialTheme.typography]. The real type scale
 * lands with design.
 */
internal val CograTypography = Typography()
