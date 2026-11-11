package com.cogra.core.designsystem.v2.token

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em

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

    /**
     * A removal's line in a title's place, in the system's voice: `label-large`
     * dropped to 400 (`CommentCard.jsx` head row, `targetDetail.removed`).
     */
    val SystemVoiceWeight = FontWeight.Normal

    /** The failed tile's `!`: `label-medium` at 700 (`MediaThumb.jsx:266-268`). */
    val FailedMarkWeight = FontWeight.Bold

    /**
     * A readout's face line: its role's size at line-height 1.2, not the
     * role's own leading (`StanceReadout.jsx` `ReadoutBlock` and the landing's
     * face: `lineHeight: 1.2`).
     */
    val FaceLineHeight = 1.2.em
}
