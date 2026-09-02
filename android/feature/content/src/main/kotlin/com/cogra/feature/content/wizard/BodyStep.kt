package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PermMedia
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.InlineAction
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
        // Both halves are needed: the weight gives the field's own
        // column the rest of the stage, and `fillHeight` passes that
        // height down to the box inside it. Either one alone leaves the
        // box at its 44dp minimum with empty screen under it.
        modifier = Modifier.weight(1f),
        fillHeight = true,
        testTag = "wizard_body",
    )
}

/**
 * `ComposePick` — the media half, as the board draws it.
 *
 * The grid is the reader's **own newest pictures, in the app**, each
 * tile toggling its pick in place: the board's affordance is a set you
 * browse and badge, not a handover to another app. That needs a media
 * permission, so [PickStage] draws the permission's own three answers —
 * not asked, granted (fully or partially), refused — around the same
 * grid.
 *
 * The board's first tile is kept exactly as drawn: a dashed "Your photos
 * app" tile that opens the system picker, for the reader who would
 * rather choose there, or whose picture is not among the newest.
 *
 * Note the geometry: the tray sits in the 24dp screen gutter above a
 * hairline, and the grid below runs to a 4dp margin with a 3dp seam.
 * The two are deliberately different — the grid is a sheet of pictures,
 * not a form field.
 */
@Composable
internal fun ColumnScope.PickStage(
    state: ComposeWizardState,
    permission: MediaPermission,
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenPicker: () -> Unit,
    onTogglePick: (String) -> Unit,
    onShowAll: () -> Unit,
) {
    if (state.picked.isNotEmpty()) {
        PickedTray(state = state, onShowAll = onShowAll)
        Hairline()
    }

    val picks = state.picked.map { it.uri }
    LazyVerticalGrid(
        // Three columns is the board's own grid: at its 390dp width a
        // third of the row inside a 4dp margin and 3dp seams is 125dp,
        // the tile the board draws. Fixed rather than adaptive so a
        // narrower phone keeps the composition instead of dropping to two
        // wide tiles.
        columns = GridCells.Fixed(GRID_COLUMNS),
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f)
            .testTag("wizard_pick_grid"),
        contentPadding = PaddingValues(start = GridEdge, end = GridEdge, top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(GridSeam),
        verticalArrangement = Arrangement.spacedBy(GridSeam),
    ) {
        item(key = "photos_app") { PhotosAppTile(onClick = onOpenPicker) }

        if (permission is MediaPermission.Granted) {
            items(state.deviceMedia, key = { it.uri }) { image ->
                val order = picks.indexOf(image.uri).takeIf { it >= 0 }
                MediaThumb(
                    item = MediaItem(image.uri, image.aspectRatio),
                    size = null,
                    corner = 0.dp,
                    // A filled numbered disc for a pick, an empty ring for
                    // the rest — the board's whole selection language.
                    badge = ThumbBadge.Order(order?.plus(1)),
                    onClick = { onTogglePick(image.uri) },
                    contentDescription = if (order == null) {
                        "A picture. Activate to pick it."
                    } else {
                        "Picture ${order + 1}, picked. Activate to remove it."
                    },
                    testTag = "wizard_grid_${image.uri}",
                )
            }
        }
    }

    // The permission's answer sits under the grid rather than replacing
    // it: the "Your photos app" tile works whatever was granted, so the
    // stage is never a dead end.
    PermissionNote(permission, onRequestPermission, onOpenSettings)
}

/**
 * The picked tray (`ComposePicked`): the count, `Show all` beside it, and
 * the picks in order below.
 *
 * **The tray shows; the sheet manages.** Order, cover, remove and describe
 * all live in `PickedSheet`, which `Show all` opens — so the tray carries
 * no badges and no per-thumbnail controls, and the cover rule is stated
 * where it can be acted on rather than here.
 */
@Composable
private fun PickedTray(
    state: ComposeWizardState,
    onShowAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = Layout.ScreenGutter, end = Layout.ScreenGutter, top = 4.dp, bottom = Space.x3),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "Picked · ${state.picked.size}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .weight(1f)
                    .testTag("wizard_picked_count"),
            )
            InlineAction(
                text = "Show all",
                onClick = onShowAll,
                testTag = "wizard_show_all",
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            state.picked.forEachIndexed { index, asset ->
                MediaThumb(
                    item = MediaItem(
                        asset.uri,
                        asset.sourceRatio ?: 1f,
                        asset.altText.ifBlank { null },
                        // An author who cropped, stepped back here, and
                        // is on their way forward again sees the crop
                        // they made rather than the original.
                        state.crops[asset.uri].toFraming(),
                    ),
                    contentDescription = "Picture ${index + 1}",
                    testTag = "wizard_tray_$index",
                )
            }
        }
    }
}

/**
 * The board's first tile: a dashed outline, the folder glyph, and the
 * label under it — a tile in the grid rather than a button dropped into
 * one. It opens the system photo picker, which needs no permission at
 * all, so it is also the way through when the grid's own is refused.
 */
@Composable
private fun PhotosAppTile(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val outline = MaterialTheme.colorScheme.outline
    val dash = with(LocalDensity.current) {
        Stroke(
            width = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())),
        )
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .drawBehind { drawRect(color = outline, style = dash) }
            .clickable(role = Role.Button, onClick = onClick)
            .testTag("wizard_open_picker"),
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = Icons.Filled.PermMedia,
            // The label below carries the meaning; the glyph repeats it.
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp),
        )
        Text(
            text = "Your photos app",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center,
        )
    }
}

/** The grid's own margin and seam, read off `ComposePick`. */
private val GridEdge = 4.dp

private const val GRID_COLUMNS = 3

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
