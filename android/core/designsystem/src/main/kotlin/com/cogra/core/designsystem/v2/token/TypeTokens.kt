package com.cogra.core.designsystem.v2.token

import androidx.compose.ui.text.font.FontWeight

/**
 * The weights the masters draw OFF the type ramp — each one a single drawing's
 * own, named here so no screen spells a weight of its own (the Compose token
 * lint's "no literals off-theme"). The ramp itself is `:app`'s `CograTypography`.
 */
object TypeTokens {
    /** The wordmark's drawing: `title-large` at 600 (`CograBand.jsx`). */
    val WordmarkWeight = FontWeight.SemiBold

    /** The monogram's letter at every rung: 500 (`ActorChip.jsx` `MonogramAvatar`). */
    val MonogramWeight = FontWeight.Medium
}
