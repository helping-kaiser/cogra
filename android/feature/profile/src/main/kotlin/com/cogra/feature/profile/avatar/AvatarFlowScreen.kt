package com.cogra.feature.profile.avatar

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.core.designsystem.v2.media.CropKind
import com.cogra.core.designsystem.v2.media.CropState
import com.cogra.core.designsystem.v2.media.MediaCrop
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.rememberCropState
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.CropWindow
import com.cogra.feature.profile.ProfileSealActions
import com.cogra.feature.profile.ProfileSealPage
import com.cogra.feature.profile.ProfileSealReading
import com.cogra.feature.profile.ProfileSealStatus
import com.cogra.feature.profile.SEAL_PICTURE

/** The seal's registered prefix (nodes.json `avatarSeal`). */
internal val AVATAR_SEAL = DataNode("avatarSeal")

internal const val AVATAR_SEAL_HEAD = "Your profile picture"
internal const val AVATAR_ROW_LABEL = "Picture"
internal const val AVATAR_ROW_VALUE = "A new profile picture"
internal const val AVATAR_ROW_NOUN = "picture"

/** The header's "?" (copy-voice, *Changing your picture*, blessed jakob 2026-10-20). */
internal const val CHANGING_YOUR_PICTURE = "Changing your picture"
private val CHANGING_YOUR_PICTURE_TEXT = listOf(
    "Your profile is a public record, and changes to it are signed actions in your name.",
    "The signing is paid for, like your posts. The record that you changed it stays, like every signed action.",
)

/**
 * The profile-picture flow's screens: `AvatarCrop` and `AvatarSeal`.
 *
 * **Every profile change is a signed act**, so the flow ends at a seal
 * rather than a Save button — the profile seals' one page
 * ([ProfileSealPage]), read back for the picture: `Your profile picture`
 * beside the framed picture, one acts-card row `Picture · A new profile
 * picture`, counted `1 picture`, and the header's "?" `Changing your picture`
 * (AvatarSeal.jsx, AvatarSeal.md:3-:11).
 */
@Composable
fun AvatarFlowScreen(
    state: AvatarFlowState,
    onNext: () -> Unit,
    onBack: () -> Unit,
    onLeave: () -> Unit,
    onCropCommitted: (CropSpec) -> Unit,
    onSign: () -> Unit,
    onRetryUpload: () -> Unit,
    modifier: Modifier = Modifier,
    onNotNow: () -> Unit = {},
    onRestoreKey: () -> Unit = {},
) {
    if (state.step == AvatarStep.Seal) {
        ProfileSealPage(
            reading = ProfileSealReading(
                node = AVATAR_SEAL,
                tagPrefix = "avatar_seal",
                head = AVATAR_SEAL_HEAD,
                rowLabel = AVATAR_ROW_LABEL,
                rowValue = AVATAR_ROW_VALUE,
                rowNoun = AVATAR_ROW_NOUN,
                helpTitle = CHANGING_YOUR_PICTURE,
                helpParagraphs = CHANGING_YOUR_PICTURE_TEXT,
            ),
            status = ProfileSealStatus(signing = state.signing, fault = state.fault, gate = state.gate),
            actions = ProfileSealActions(
                onSign = onSign,
                onBack = onBack,
                onLeave = onLeave,
                onNotNow = onNotNow,
                onRestoreKey = onRestoreKey,
                onRetryUpload = onRetryUpload,
            ),
        ) { SealPicture(state) }
        return
    }

    // The arrow steps; only the first stage has nowhere to step to, and
    // there the gesture leaves.
    BackHandler(onBack = onBack)
    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("avatar_flow"),
    ) {
        WizardHeader(
            title = "Your picture",
            onBack = onBack,
            // Shortened on this flow: there is no post draft to promise
            // back, so the label says only what the control does.
            onLeave = onLeave,
            leaveContentDescription = "Leave",
            testTag = "avatar_header",
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                // The body takes the rest of the screen so the stage can push
                // its committing action to the bottom, where the board puts it.
                .weight(1f)
                .padding(horizontal = Layout.ScreenGutter),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            CropStage(state, onCropCommitted, onNext)
        }
    }
}

/**
 * `AvatarCrop`: a circular aperture over a square stage, drag and pinch,
 * and the two captions under it.
 *
 * There is no shape chooser — the avatar is 1:1 everywhere it appears, so
 * the only choice left is the framing.
 */
@Composable
private fun ColumnScope.CropStage(
    state: AvatarFlowState,
    onCropCommitted: (CropSpec) -> Unit,
    onNext: () -> Unit,
) {
    val uri = state.uri ?: return
    // Seeded from what the flow remembers: the stage is stepped out of
    // and back into, and its own saveable holder does not survive that
    // (jakob 2026-09-01).
    val crop: CropState = rememberCropState(
        initial = state.crop?.window
            ?.let { CropFraming.of(it.left, it.top, it.right, it.bottom) }
            ?: CropFraming.Whole,
        sourceRatio = state.sourceRatio,
        kind = CropKind.Avatar,
        frameRatio = 1f,
    )

    // Reported after every composition, not only on Next: a process death
    // between the last nudge and the next tap would otherwise upload a
    // framing the author never saw.
    val spec = CropSpec(
        targetRatio = 1f,
        window = crop.framing.let {
            CropWindow(it.left, it.top, it.right, it.bottom)
        },
    )
    SideEffect { onCropCommitted(spec) }

    MediaCrop(
        item = MediaItem(uri, state.sourceRatio ?: 0f, null),
        shape = MediaShape.Square,
        state = crop,
        caption = "Drag to move, pinch to zoom.",
        testTag = "avatar_crop",
        // `AvatarCrop`: the 342 circle at 24 in the square 390 stage (AvatarCrop.md:7).
        kind = CropKind.Avatar,
    )
    Text(
        text = "One picture, shown everywhere you appear.",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    // `AvatarCrop` closes on the spacer and the pill: the forward action
    // is at the bottom here too, so the X keeps the corner it had on the
    // stage before (jakob 2026-09-01).
    Spacer(Modifier.weight(1f))
    CograButton(
        text = "Next",
        onClick = onNext,
        enabled = state.uri != null,
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Space.x4),
        testTag = "avatar_crop_next",
    )
}

/**
 * The seal's own picture: the framing the author left the crop stage at, so
 * the seal shows the picture they chose rather than the original they cropped
 * it out of (jakob 2026-09-01). A circle, because that is how the avatar is
 * seen everywhere.
 */
@Composable
private fun SealPicture(state: AvatarFlowState) {
    MediaThumb(
        item = MediaItem(
            url = state.uri,
            aspectRatio = 1f,
            framing = state.crop?.window
                ?.let { CropFraming.of(it.left, it.top, it.right, it.bottom) }
                ?: CropFraming.Whole,
        ),
        size = null,
        width = SEAL_PICTURE,
        height = SEAL_PICTURE,
        corner = SEAL_PICTURE / 2,
        testTag = "avatar_seal_preview",
    )
}
