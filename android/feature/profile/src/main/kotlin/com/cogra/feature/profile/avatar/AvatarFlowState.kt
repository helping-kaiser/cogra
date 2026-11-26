package com.cogra.feature.profile.avatar

import com.cogra.domain.media.CropSpec
import com.cogra.domain.signing.KnownMedia
import com.cogra.feature.profile.ProfileSealFault
import com.cogra.feature.profile.SealGate

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

    /**
     * On the server. [known] is what the intent check holds the avatar
     * entry to: the upload digest this device computed and the server
     * echoed, and the rendition digest. [url] is where its bytes are: what
     * the profile's head draws once the change is taken.
     */
    data class Done(val mediaId: String, val known: KnownMedia? = null, val url: String? = null) : AvatarUpload

    /** The upload did not reach CoGra: asking again may (AvatarSeal.md:15, `upload-failed`). */
    data class Failed(val message: String) : AvatarUpload

    /**
     * The picture was refused — by the server, or before it left (too big, not
     * a picture): asking again cannot change the answer (AvatarSeal.md:17,
     * `upload-refused`).
     */
    data class Refused(val message: String) : AvatarUpload
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
    /** `Sign the change` was pressed and has not answered — a press waiting on the upload included. */
    val signing: Boolean = false,
    /** What took the commit's place when a press did not land (AvatarSeal.md:39-55). */
    val fault: ProfileSealFault? = null,
    /** One-shot: the change was taken while the seal stood; the route leaves and confirms. */
    val saved: Boolean = false,
) {
    val mediaId: String? get() = (upload as? AvatarUpload.Done)?.mediaId

    /**
     * The upload gate over the seal's foot (AvatarSeal.md:13-23): running while
     * the bytes are on their way, its fault reading once they did not arrive,
     * its refused reading once the picture was refused; nothing once landed.
     */
    val gate: SealGate?
        get() = when (upload) {
            AvatarUpload.Idle, AvatarUpload.Running -> SealGate.Uploading
            is AvatarUpload.Failed -> SealGate.Failed
            is AvatarUpload.Refused -> SealGate.Refused
            is AvatarUpload.Done -> null
        }

    /**
     * Whether `Sign the change` takes a press: on the seal, not already
     * signing, and not over a failed or refused upload. A press while the
     * upload runs is taken and waits for it (AvatarSeal.md:13).
     */
    val canSign: Boolean
        get() = step == AvatarStep.Seal && !signing && gate != SealGate.Failed && gate != SealGate.Refused
}

/**
 * One stage back. Null from the first stage, where there is no earlier
 * stage and back therefore leaves — the same rule the post wizard's arrow
 * follows (`WizardHeader`: the arrow steps, the X leaves).
 */
fun AvatarFlowState.retreated(): AvatarFlowState? = when (step) {
    AvatarStep.Crop -> null
    AvatarStep.Seal -> copy(step = AvatarStep.Crop, fault = null)
}

/** `Next` on the crop stage; null while there is nothing to frame. */
fun AvatarFlowState.advanced(): AvatarFlowState? = when {
    step != AvatarStep.Crop -> null
    uri == null -> null
    else -> copy(step = AvatarStep.Seal)
}
