package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind

/**
 * `ComposeWords` — the words half of the body.
 *
 * The box takes the rest of the screen because the board draws it that
 * way: a post's words are the point of the stage, not one field among
 * several.
 */
@Composable
internal fun ColumnScope.WordsStepBody(
    state: ComposeWizardState,
    onBodyChange: (String) -> Unit,
) {
    CograTextField(
        value = state.body,
        onValueChange = onBodyChange,
        label = "What do you want to publish?",
        singleLine = false,
        fillHeight = true,
        testTag = "wizard_body",
    )
}

/**
 * `ComposePick` — the media half.
 *
 * **The device grid is the system photo picker, not an in-app one.**
 * The canonical board draws a grid of the reader's own photos with
 * selection badges, which on Android means holding `READ_MEDIA_IMAGES`
 * and querying `MediaStore`. Android's own guidance is the opposite:
 * the photo picker
 * (developer.android.com/training/data-storage/shared/photopicker) is
 * the documented way to let someone hand over specific pictures, needs
 * no permission at all, and is what a privacy-by-construction app
 * should be asking for. So the board's dashed "Your photos app" tile
 * opens it and the grid below shows what came back — the picks, in
 * their order, each tappable to drop. Named as a deviation rather than
 * quietly matched.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ColumnScope.PickStepBody(
    state: ComposeWizardState,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
) {
    if (state.picked.isNotEmpty()) {
        PickedTray(state = state, onRemove = onTogglePick)
    }
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f)
            .verticalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(GridSeam),
        verticalArrangement = Arrangement.spacedBy(GridSeam),
    ) {
        PhotosAppTile(onClick = onOpenPicker)
        state.picked.forEachIndexed { index, asset ->
            MediaThumb(
                item = MediaItem(asset.uri, asset.sourceRatio ?: 1f, asset.altText.ifBlank { null }),
                size = PickerTile,
                badge = ThumbBadge.Order(index + 1),
                onClick = { onTogglePick(asset.uri) },
                contentDescription = "Picture ${index + 1}, picked. Activate to remove it.",
                testTag = "wizard_pick_$index",
            )
        }
    }
}

/**
 * The picked tray: the count, then every pick in order — the first
 * wearing `Cover`, the rest a remove badge — and the line that says why
 * the first one is different.
 *
 * The whole row scrolls rather than truncating behind a `Show all`. The
 * board draws that affordance beside two picks and defines nothing for
 * it to open, so a scrollable tray is the conservative reading:
 * everything picked stays reachable, and nothing hides behind a control
 * whose destination is undesigned.
 */
@Composable
private fun PickedTray(
    state: ComposeWizardState,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "Picked · ${state.picked.size}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("wizard_picked_count"),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            state.picked.forEachIndexed { index, asset ->
                MediaThumb(
                    item = MediaItem(asset.uri, asset.sourceRatio ?: 1f, asset.altText.ifBlank { null }),
                    badge = if (index == 0) ThumbBadge.Cover else ThumbBadge.Remove { onRemove(asset.uri) },
                    contentDescription = if (index == 0) {
                        "Picture 1, the cover"
                    } else {
                        "Picture ${index + 1}"
                    },
                    testTag = "wizard_tray_$index",
                )
            }
        }
        Text(
            text = "The first one is the cover.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The tile that opens the system photo picker, drawn at the grid's own
 * tile size so it sits in the grid rather than beside it.
 */
@Composable
private fun PhotosAppTile(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(PickerTile),
        contentAlignment = Alignment.Center,
    ) {
        CograButton(
            text = "Your photos app",
            onClick = onClick,
            kind = ButtonKind.Outlined,
            testTag = "wizard_open_picker",
        )
    }
}

/**
 * `ComposeDraft` — the held draft, offered back before the picker takes
 * over the screen.
 *
 * The board puts the card above the caption and dims what is behind it,
 * so the offer reads as the thing to answer first.
 */
@Composable
internal fun DraftOffer(
    draft: ComposeDraft,
    onContinue: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2)
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(Space.x4)
            .testTag("wizard_draft_offer"),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = "Your draft is here",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            draft.assets.firstOrNull()?.let { asset ->
                MediaThumb(
                    item = MediaItem(asset.uri, 1f, asset.altText.ifBlank { null }),
                    size = 40.dp,
                    contentDescription = "The draft's first picture",
                )
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = draft.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = if (draft.assets.isEmpty()) {
                        "Kept on this device"
                    } else {
                        "${draft.pictureCount} — kept on this device"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton(
                text = "Discard",
                onClick = onDiscard,
                kind = ButtonKind.Text,
                testTag = "wizard_draft_discard",
            )
            CograButton(
                text = "Continue",
                onClick = onContinue,
                testTag = "wizard_draft_continue",
            )
        }
    }
}

@ThemePreviews
@Composable
private fun DraftOfferPreview() {
    Cogra2PreviewTheme {
        DraftOffer(
            draft = ComposeDraft(
                bodyKind = DraftBodyKind.Media,
                title = "Salt maps of the coast road",
                assets = listOf(DraftAsset("a"), DraftAsset("b")),
            ),
            onContinue = {},
            onDiscard = {},
        )
    }
}
