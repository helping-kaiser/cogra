package com.cogra.feature.profile.avatar

import com.cogra.domain.media.CropSpec

/**
 * The profile-picture flow's two stages (`AvatarCrop`, `AvatarSeal`).
 *
 * design/readme.md §13: "pick → circular 1:1 crop → **its own seal**,
 * because every profile change is a signed act". The pick itself is the
 * system photo picker rather than a stage, so the flow's own screens are
 * these two.
 */
enum class AvatarStep { Crop, Seal }

/** Where the new picture stands on its way to the server. */
sealed interface AvatarUpload {
    data object Idle : AvatarUpload

    data object Running : AvatarUpload

    data class Done(val mediaId: String) : AvatarUpload

    data class Failed(val message: String) : AvatarUpload
}

/**
 * Everything the profile-picture flow's screens read.
 *
 * **The profile has ONE image — the avatar** (design/readme.md §13), so
 * there is no second picture in this state and no shape to choose: the
 * crop is a fixed circular 1:1.
 */
data class AvatarFlowState(
    val step: AvatarStep = AvatarStep.Crop,
    /** The picked picture's content URI; null until one is picked. */
    val uri: String? = null,
    /** The picture's own ratio, for the crop preview. Null until read. */
    val sourceRatio: Float? = null,
    /**
     * The framing the crop stage was left at.
     *
     * Held here rather than only in the stage's own saveable holder
     * because the stage is left for the seal and stepped back into: the
     * holder dies with that composition, and the author must find the
     * crop they made rather than a reset one (jakob 2026-09-01). The
     * seal's preview draws this same framing.
     */
    val crop: CropSpec? = null,
    val upload: AvatarUpload = AvatarUpload.Idle,
    val submitting: Boolean = false,
    /** The device holds no actor key, so nothing can be signed. */
    val keyAbsent: Boolean = false,
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    val saved: Boolean = false,
) {
    val mediaId: String? get() = (upload as? AvatarUpload.Done)?.mediaId

    /**
     * A profile update is **one** signed act, so the seal's total is
     * singular and carries no all-or-nothing subline — there is nothing
     * for it to be true of (design/readme.md §13, `AvatarSeal` omits
     * `ActsCard`'s `note`).
     */
    val signedActionCount: Int get() = 1

    /**
     * Whether the change may be signed. The picture must have landed an
     * id first: signing a profile update that names an asset still
     * uploading would point the profile at nothing.
     */
    val canSign: Boolean
        get() = !submitting && !keyAbsent && mediaId != null

    val problem: String?
        get() = when {
            refusal != null -> refusal
            (upload as? AvatarUpload.Failed) != null -> (upload as AvatarUpload.Failed).message
            transportFailed -> "That could not reach the server. Try again."
            signingFailed -> "The signature did not go through. Nothing was changed."
            else -> null
        }
}

/**
 * One stage back. Null from the first stage, where there is no earlier
 * stage and back therefore leaves — the same rule the post wizard's arrow
 * follows (`WizardHeader`: the arrow steps, the X leaves).
 */
fun AvatarFlowState.retreated(): AvatarFlowState? = when (step) {
    AvatarStep.Crop -> null
    AvatarStep.Seal -> copy(step = AvatarStep.Crop)
}

/** `Next` on the crop stage; null while there is nothing to frame. */
fun AvatarFlowState.advanced(): AvatarFlowState? = when {
    step != AvatarStep.Crop -> null
    uri == null -> null
    else -> copy(step = AvatarStep.Seal)
}
