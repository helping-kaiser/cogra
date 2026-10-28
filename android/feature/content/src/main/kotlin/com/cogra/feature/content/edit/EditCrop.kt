package com.cogra.feature.content.edit

import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.CropSpec
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.ratio
import kotlin.math.abs
import kotlin.math.ln

/**
 * A crop raised over an edit — the edit's own stage, handing back to it
 * (ComposeCrop.md, CoverCrop.md). Its back arrow returns to the edit with the
 * picture unused; its X is the edit's own X, asking first where the batch
 * holds an act. The framings live in the stage's `CropState`s and are handed
 * up as they move, so Next commits what the author last saw.
 */
sealed interface EditCrop {
    /**
     * Pictures on their way into a post edit, cut to [shape]. [locked] where
     * the post's one shape already stands — the chips are hidden, since the
     * new pictures join a set whose shape was chosen when it was published; a
     * words post has none yet, so its first framing sets it.
     */
    data class Pictures(
        val picked: List<PickedAsset>,
        val shape: DraftShape,
        val locked: Boolean,
        val framingIndex: Int = 0,
        val crops: Map<String, CropSpec> = emptyMap(),
    ) : EditCrop

    /**
     * A face for the clip, cut to [ratio] — the clip's own in a post, the
     * comment pager's square in a comment (CoverCrop.md). No chips: a cover
     * that disagreed with its clip would letterbox the thing it stands for.
     */
    data class Cover(
        val asset: PickedAsset,
        val ratio: Float,
        val crop: CropSpec? = null,
    ) : EditCrop
}

/** The crop's how-to line and what the cover's crop is for (CoverCrop.jsx; copy-voice, *The crops' how-to line*). */
const val CROP_HOW_TO_LINE = "Drag to move, pinch to zoom."
const val COVER_CROP_LINE = "The cover takes the video's shape."

/**
 * THE POST'S ONE SHAPE (D17), read back off a picture it was published with:
 * the pictures' shared ratio is the only record of the shape the author
 * chose, so the nearest of the three is it (web `nearestPostShape`). Null for
 * a ratio nothing measured.
 */
internal fun nearestDraftShape(ratio: Float?): DraftShape? {
    if (ratio == null || !ratio.isFinite() || ratio <= 0f) return null
    return DraftShape.entries.minBy { abs(ln(ratio / it.ratio())) }
}
