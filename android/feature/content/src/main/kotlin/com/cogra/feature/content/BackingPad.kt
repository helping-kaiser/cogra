package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.AttachmentLandingLine
import com.cogra.core.designsystem.AttachmentPad
import com.cogra.core.designsystem.AttachmentStanding
import com.cogra.core.designsystem.BackingValue
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** The pad's name, spoken over its strip (copy-voice "The pad's name": the one-axis pads). */
const val BACKING_PAD_NAME = "Backing pad for your own post"

/**
 * What an edit's pad knows beyond the pick: the backing as it stands and
 * the walk-back. Absent on a new post's pad, where nothing stands yet and
 * the pick is the result.
 */
data class BackingEdit(
    /** The Publish bundle's net now — `Current backing`. */
    val current: BackingValue,
    /** The bundle's raw sum, unclipped — what `Backing after` folds from. */
    val rawSum: BackingValue,
    /** `Walk it all back` answers; greyed while the backing already nets 0.00. */
    val canWalkBack: Boolean,
    val onWalkBack: () -> Unit,
)

/**
 * `ComposePad` / `EditPad` — the backing pad on one's own post (round 15,
 * jakob 2026-10-16, PR-101).
 *
 * THE FIELD IS ONE AXIS, the master `AttachmentPad`. Publishing signs one
 * record toward the post, a Publish, and the census gives it one free
 * parameter: the author's attachment — their BACKING — For or Against,
 * the second pinned at 1, never a choice, so never drawn as one. What the
 * author thinks of the post is another record, the ordinary opinion its
 * face takes (`PadStanding`).
 *
 * THE PICK IS THE EDGE. The strip collects the record's own value; nothing
 * computes a delta. A new post's pad reads `Your pick` alone; an edit's
 * ([edit]) reads `Current backing` over it and `Backing after` beneath the
 * strip, and carries `Walk it all back` on the left of the commit row — the
 * one control that aims at a result.
 *
 * Everything around the strip is the seal-scale pads' grammar: the `?` in
 * the top-right corner, the readout above the strip where a thumb cannot
 * cover it, Cancel · Set — release never commits. It parks over the page;
 * the caller owns the wash and the parking.
 */
@Composable
fun BackingPad(
    pick: Double,
    onPickChange: (Double) -> Unit,
    onSet: () -> Unit,
    onCancel: () -> Unit,
    onHelp: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    edit: BackingEdit? = null,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(PAD_CORNER))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(Space.x4)
            .semantics { paneTitle = BACKING_PAD_NAME }
            .testTag("${testTagPrefix}_pad"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Box(Modifier.fillMaxWidth()) {
            // The readouts clear the corner the `?` sits in, so the two
            // never collide.
            AttachmentStanding(
                pick = pick,
                current = edit?.current,
                testTagPrefix = testTagPrefix,
                modifier = Modifier.padding(end = PAD_HELP_GUTTER),
            )
            HelpDot(
                onHelp = onHelp,
                contentDescription = HelpTopic.YourBackingOnYourPost.title,
                modifier = Modifier.align(Alignment.TopEnd),
                testTag = "${testTagPrefix}_help",
            )
        }
        AttachmentPad(
            value = pick,
            onValueChange = onPickChange,
            testTag = "${testTagPrefix}_field",
        )
        if (edit != null) {
            AttachmentLandingLine(rawSum = edit.rawSum, pick = pick, testTagPrefix = testTagPrefix)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            if (edit != null) {
                CograButton(
                    text = "Walk it all back",
                    onClick = edit.onWalkBack,
                    kind = ButtonKind.Text,
                    enabled = edit.canWalkBack,
                    testTag = "${testTagPrefix}_walk_back",
                )
            }
            Spacer(Modifier.weight(1f))
            CograButton("Cancel", onCancel, kind = ButtonKind.Text, testTag = "${testTagPrefix}_cancel")
            CograButton("Set", onSet, testTag = "${testTagPrefix}_set")
        }
    }
}

/**
 * `Start it unreachable?` — the compose pad's Set at exactly 0.00
 * (ComposePad.md). It warns, never stops: a Publish at zero carries
 * nothing on the post's own path. `Keep adjusting` is filled and `Set it
 * anyway` quiet; the pad stays parked beneath. Words: copy-voice *The
 * unreachable start* (title and buttons round 13's, the body round 15's
 * draft, its wording jakob's at review).
 */
@Composable
fun UnreachableStartConfirm(
    onKeepAdjusting: () -> Unit,
    onSetAnyway: () -> Unit,
    testTag: String,
) {
    AlertDialog(
        // The scrim is the way back, the same answer as Keep adjusting.
        onDismissRequest = onKeepAdjusting,
        modifier = Modifier.testTag(testTag),
        title = { Text(text = UNREACHABLE_TITLE, style = MaterialTheme.typography.headlineSmall) },
        text = { Text(text = UNREACHABLE_BODY, style = MaterialTheme.typography.bodyMedium) },
        confirmButton = {
            CograButton(text = "Keep adjusting", onClick = onKeepAdjusting, testTag = "${testTag}_keep")
        },
        dismissButton = {
            CograButton(
                text = "Set it anyway",
                onClick = onSetAnyway,
                kind = ButtonKind.Text,
                testTag = "${testTag}_set",
            )
        },
    )
}

const val UNREACHABLE_TITLE = "Start it unreachable?"

const val UNREACHABLE_BODY =
    "Your backing is your post's own path into anyone's feed. At 0.00 the post starts " +
        "unreachable on its own — only the tags and citations you sign with it lead to it, " +
        "until someone gives it an opinion."

/**
 * The wash a parked pad stands over: the surface beneath goes inert, and a
 * press on it is the outside press — it stages nothing ([onDismiss]).
 */
@Composable
fun BoxScope.ParkedPadWash(onDismiss: () -> Unit, testTag: String) {
    Box(
        modifier = Modifier
            .matchParentSize()
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = PARKED_PAD_WASH_ALPHA))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onDismiss,
            )
            .testTag(testTag),
    )
}

/** Where every pad parks: the lower centre of the viewport, at the board's insets. */
fun BoxScope.parkedPadPlacement(): Modifier = Modifier
    .align(Alignment.BottomCenter)
    .padding(horizontal = PARKED_PAD_SIDE_INSET)
    .padding(bottom = PARKED_PAD_BOTTOM_INSET)

/**
 * How far the wash dims the surface under a parked pad — the same 50%
 * `--scrim-dialog` the boards wash with, and the value the seals' pads
 * already park over.
 */
private const val PARKED_PAD_WASH_ALPHA = 0.5f

/** The board's inset from each edge (`ComposePad.jsx`, `EditPad.jsx`: left and right 30). */
private val PARKED_PAD_SIDE_INSET = 30.dp

/** And its standoff from the bottom — the compose seal's, so both pads park alike. */
private val PARKED_PAD_BOTTOM_INSET = 24.dp

/** `--radius-extra-large`, the rung every parked pad and sheet wears. */
private val PAD_CORNER = 28.dp

/** What the readout leaves clear of the `?` in the corner. */
private val PAD_HELP_GUTTER = 40.dp

@ThemePreviews
@Composable
private fun ComposeBackingPadPreview() {
    Cogra2PreviewTheme {
        BackingPad(pick = 0.1, onPickChange = {}, onSet = {}, onCancel = {}, onHelp = {}, testTagPrefix = "preview")
    }
}

@ThemePreviews
@Composable
private fun EditBackingPadPreview() {
    Cogra2PreviewTheme {
        BackingPad(
            pick = 0.3,
            onPickChange = {},
            onSet = {},
            onCancel = {},
            onHelp = {},
            testTagPrefix = "preview",
            edit = BackingEdit(
                current = BackingValue.Read(PREVIEW_BACKING),
                rawSum = BackingValue.Read(PREVIEW_BACKING),
                canWalkBack = true,
                onWalkBack = {},
            ),
        )
    }
}

/** The preview's backing: the compose default the post was published with. */
private const val PREVIEW_BACKING = 0.1
