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

    /**
     * A removal's line in a title's place, in the system's voice: `label-large`
     * dropped to 400 (`CommentCard.jsx` head row, `targetDetail.removed`).
     */
    val SystemVoiceWeight = FontWeight.Normal

    /**
     * A row's trailing time at the ground's weight: `ContentRow.jsx`'s
     * `label-small` carries its size and leading only, never the rung's 500.
     */
    val RowTrailingWeight = FontWeight.Normal

    /**
     * A quiet `label-small` line set by its size and leading only, at the
     * ground's weight: the wizard header's stage (`WizardHeader.jsx`'s
     * `Last step`) and a text field's corner word (`FieldLabel`'s `corner`).
     */
    val QuietLabelWeight = FontWeight.Normal
}
