package com.cogra.feature.profile.avatar

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.core.designsystem.v2.media.CropMask
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

/**
 * The profile-picture flow's screens: `AvatarCrop` and `AvatarSeal`.
 *
 * **Every profile change is a signed act**, so the flow ends at a seal
 * rather than a Save button — the same "What you sign" moment the post
 * composer has, with the same `WizardHeader` above it and the same acts
 * card in it (design/readme.md §13).
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
    onOpenHelp: (() -> Unit)? = null,
    helpOpen: Boolean = false,
    onCloseHelp: () -> Unit = {},
) {
    // The arrow steps; only the first stage has nowhere to step to, and
    // there the gesture leaves.
    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .testTag("avatar_flow"),
    ) {
        WizardHeader(
            title = if (state.step == AvatarStep.Crop) "Your picture" else "What you sign",
            onBack = onBack,
            // Shortened on this flow: there is no post draft to promise
            // back, so the label says only what the control does.
            onLeave = onLeave,
            leaveContentDescription = "Leave",
            trailingNote = "Last step".takeIf { state.step == AvatarStep.Seal },
            onHelp = onOpenHelp.takeIf { state.step == AvatarStep.Seal },
            helpContentDescription = "Changing your picture",
            testTag = "avatar_header",
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                // The body takes the rest of the screen so both stages can
                // push their committing action to the bottom, which is
                // where every board puts it.
                .weight(1f)
                .padding(horizontal = Layout.ScreenGutter),
            verticalArrangement = Arrangement.spacedBy(
                if (state.step == AvatarStep.Crop) Space.x3 else Space.x4,
            ),
        ) {
            when (state.step) {
                AvatarStep.Crop -> CropStage(state, onCropCommitted, onNext)
                AvatarStep.Seal -> SealStage(state, onSign, onBack, onRetryUpload)
            }

            state.problem?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = Space.x2)
                        .testTag("avatar_problem")
                        .semantics { liveRegion = LiveRegionMode.Assertive },
                )
            }
        }
    }

    if (helpOpen) {
        HelpDialog(
            title = "Changing your picture",
            paragraphs = listOf(
                "Your profile is a public record, and changes to it are signed " +
                    "actions in your name — the picture changes the moment yours lands.",
                "The community pool covers the signing, like your posts. The record " +
                    "that you changed it stays, like every signed action.",
            ),
            onClose = onCloseHelp,
            testTag = "avatar_help_dialog",
        )
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
        mask = CropMask.Circle,
        testTag = "avatar_crop",
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

/** The seal's own picture, read off `AvatarSeal`. */
private val AvatarSealPreview = 64.dp

/**
 * `AvatarSeal`: the picture, what signing it commits, and the two buttons.
 *
 * The acts card carries **no all-or-nothing subline** — a profile update
 * is one act, and there is nothing for "they land together" to be true of.
 */
@Composable
private fun ColumnScope.SealStage(
    state: AvatarFlowState,
    onSign: () -> Unit,
    onBack: () -> Unit,
    onRetryUpload: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        // The framing the author left the crop stage at, so the seal
        // shows the picture they chose rather than the original they
        // cropped it out of (jakob 2026-09-01). A circle, because that
        // is how the avatar is seen everywhere.
        MediaThumb(
            item = MediaItem(
                url = state.uri,
                aspectRatio = 1f,
                framing = state.crop?.window
                    ?.let { CropFraming.of(it.left, it.top, it.right, it.bottom) }
                    ?: CropFraming.Whole,
            ),
            size = null,
            width = AvatarSealPreview,
            height = AvatarSealPreview,
            corner = AvatarSealPreview / 2,
            testTag = "avatar_seal_preview",
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = "Your profile picture",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = "Shown everywhere you appear.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .padding(horizontal = Space.x4)
            .testTag("avatar_seal_acts"),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Space.x2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "Picture",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(width = 76.dp, height = 20.dp),
            )
            Text(
                text = "A new profile picture",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "1 action",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Hairline()
        SummaryRow(headline = "1 signed action", testTag = "avatar_seal_total")
    }

    Text(
        text = "Every change to your profile is signed in your name and stays in " +
            "your public record.",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    Spacer(Modifier.weight(1f))

    if (state.upload is AvatarUpload.Failed) {
        CograButton(
            text = "Try the upload again",
            onClick = onRetryUpload,
            kind = ButtonKind.Outlined,
            modifier = Modifier.fillMaxWidth(),
            testTag = "avatar_retry_upload",
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = Space.x6),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograButton(
            text = "Sign the change",
            onClick = onSign,
            enabled = state.canSign,
            modifier = Modifier.fillMaxWidth(),
            testTag = "avatar_sign",
        )
        CograButton(
            text = "Back",
            onClick = onBack,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = "avatar_seal_back",
        )
    }
}
