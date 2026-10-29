package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.taskRing
import com.cogra.core.designsystem.v2.atom.taskRingColors
import com.cogra.core.designsystem.v2.compose.UploadErrorLine
import com.cogra.core.designsystem.v2.media.DurationPill
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.REMOVE_VIDEO
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.content.MAX_POST_BODY_CHARS
import com.cogra.feature.content.R

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
        // `WordsBody`: 12 all round inside the 1px field border.
        boxPadding = PaddingValues(13.dp),
        cap = MAX_POST_BODY_CHARS,
        error = if (state.bodyTooLong) {
            stringResource(R.string.content_error_body_too_long)
        } else {
            null
        },
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
    onDismissRefusal: (Int) -> Unit,
) {
    if (state.picked.isNotEmpty()) {
        // The tray's × gives the pick back, the same toggle the grid's tile
        // answers (`ComposePick.md`: "tap a tray thumbnail's remove control").
        PickedTray(state = state, onShowAll = onShowAll, onRemove = onTogglePick)
        Hairline()
    }

    RefusedFiles(refused = state.refused, onDismiss = onDismissRefusal)

    // DEAD, NOT GONE (`ComposePickVideo`'s `DeadGrid`). A post carries
    // pictures OR one video, so once a clip is staged the grid has nothing
    // left to offer: it dims to 45% and stops taking picks rather than
    // disappearing — which would read as the step itself failing rather
    // than as "nothing else can join". The way out to the photos app goes
    // with it (ComposePickVideo.md: "the way out to the photos app is
    // gone"), and so do the selection rings: a tile that takes no pick
    // offers none, and wears the board's hairline instead.
    val gridLive = !state.isVideoPost
    val picks = state.picked.map { it.uri }
    val hairline = MaterialTheme.colorScheme.outlineVariant
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
            .alpha(if (gridLive) 1f else DEAD_GRID_ALPHA)
            .testTag("wizard_pick_grid"),
        contentPadding = PaddingValues(start = GridEdge, end = GridEdge, top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(GridSeam),
        verticalArrangement = Arrangement.spacedBy(GridSeam),
    ) {
        if (gridLive) {
            item(key = "photos_app") {
                PhotosAppTile(onClick = onOpenPicker)
            }
        }

        if (permission is MediaPermission.Granted) {
            items(state.deviceMedia, key = { it.uri }) { item ->
                val order = picks.indexOf(item.uri).takeIf { it >= 0 }
                val noun = if (item.isVideo) "video" else "picture"
                MediaThumb(
                    item = MediaItem(item.uri, item.aspectRatio),
                    modifier = if (gridLive) {
                        Modifier
                    } else {
                        // `DeadGrid`: `outline: 1px solid var(--border-hairline)`, inset.
                        Modifier.border(1.dp, hairline)
                    },
                    size = null,
                    corner = 0.dp,
                    // A filled numbered disc for a pick, an empty ring for
                    // the rest — the board's whole selection language.
                    badge = ThumbBadge.Order(order?.plus(1)).takeIf { gridLive },
                    // A clip says how long it is, behind a play glyph, at
                    // the bottom-left — `ComposePick`'s own video tile; the
                    // ring owns the top-right.
                    duration = item.durationMs?.let { formatDuration(it) },
                    durationPill = DurationPill.Picker,
                    // The grid's tile is a candidate, not the composer's
                    // clip preview: it wears the pill's glyph, never a disc.
                    video = false,
                    // `null` is how `MediaThumb` itself goes inert — it skips
                    // the `clickable` modifier entirely rather than merely
                    // ignoring taps, which is what keeps a dead tile out of
                    // focus order and off a screen reader's action list too.
                    onClick = { onTogglePick(item.uri) }.takeIf { gridLive },
                    contentDescription = if (order == null) {
                        "A $noun. Activate to pick it."
                    } else {
                        "${noun.replaceFirstChar { it.uppercase() }} ${order + 1}, " +
                            "picked. Activate to remove it."
                    },
                    testTag = "wizard_grid_${item.uri}",
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
 * The picked tray (`PickTray.jsx`): the count, `Show all` beside it, and
 * the picks in order below — the band that does not change across the four
 * pick boards.
 *
 * **The tray is the board's, tile for tile** (`ComposePick`): the first
 * picture wears the "Cover" badge — the first one IS the cover, and the
 * badge travels with reorder — and every tile carries its ×, the cover's
 * included (ComposePick.md, round 22): removing the cover makes the next
 * picture the cover. Reorder lives in `PickedSheet` (Show all), never as a
 * drag in the tray — that law is gone (round 22).
 *
 * **"The first one is the cover." rides beside the tiles while they leave it
 * its one line** (`ComposePick` draws it at two; round 22, ask 13 C): past
 * that the tiles stand alone, clipped at the band's edge and never
 * scrolled, and `Show all` is the way to the rest.
 *
 * **A STAGED CLIP** (`ComposePickVideo`). A video takes the body whole, so
 * there is no set left for `Show all` to reorder — the button drops and the
 * count is the only thing on its line. The clip is one 114×64 tile with its
 * play disc and its own × (`Remove this video`), and beside it the line that
 * says why nothing else can join and what comes next.
 *
 * **THE CAPTION IS THE SHAPE'S AND THE STEP'S** (jakob 2026-09-24, backlog
 * item 104; `ComposePickVideoCover`). A vertical clip skips the cover step
 * ([ComposeWizardState.skipsCoverStep]), so it wears the trim
 * `content_video_body_caption_vertical`; a clip whose cover was chosen
 * reads the settled fact, `A video is the whole post. This one has its
 * cover.`, because the promise of a cover step has been kept.
 */
@Composable
private fun PickedTray(
    state: ComposeWizardState,
    onShowAll: () -> Unit,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("wizard_tray")
            .padding(start = Layout.ScreenGutter, end = Layout.ScreenGutter, top = 4.dp, bottom = Space.x3),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PickedTrayHeader(count = state.picked.size, showAll = !state.isVideoPost, onShowAll = onShowAll)
        val clip = state.video
        if (clip != null) {
            ClipTrayRow(state, clip, onRemove)
        } else {
            PictureTrayRow(state, onRemove)
        }
    }
}

/** `ComposePickVideo`: one 114×64 clip tile, its disc and ×, and the line beside it. */
@Composable
private fun ClipTrayRow(state: ComposeWizardState, clip: PickedAsset, onRemove: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MediaThumb(
            item = MediaItem(clip.uri, clip.sourceRatio ?: 1f, clip.altText.ifBlank { null }),
            width = TRAY_CLIP_WIDTH,
            height = TRAY_CLIP_HEIGHT,
            video = true,
            // The clip's own chosen face, once there is one: back from the
            // cover stage the tile says so rather than reading coverless
            // again (`ComposePickVideoCover`, design/backlog.md 2026-09-15).
            coverSrc = state.coverModel(),
            onRemove = { onRemove(clip.uri) },
            removeLabel = REMOVE_VIDEO,
            removeTestTag = "wizard_tray_0_remove",
            contentDescription = stringResource(R.string.content_tray_video),
            testTag = "wizard_tray_0",
        )
        Text(
            text = when {
                state.coverModel() != null -> "A video is the whole post. This one has its cover."
                state.skipsCoverStep -> stringResource(R.string.content_video_body_caption_vertical)
                else -> "A video is the whole post. Its cover comes next."
            },
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .weight(1f)
                .testTag("wizard_video_body_caption"),
        )
    }
}

/**
 * The pictures: the cover badge on the first, a × on each, and the cover
 * rule beside them while the tiles leave it a line of its own.
 */
@Composable
private fun PictureTrayRow(state: ComposeWizardState, onRemove: (String) -> Unit) {
    val caption = "The first one is the cover."
    val style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight)
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val captionWidth = with(density) { measurer.measure(caption, style).size.width.toDp() }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val count = state.picked.size
        val tiles = Layout.ThumbSize * count + Space.x2 * count
        val fits = maxWidth - tiles >= captionWidth
        // PAST THE CAPTION'S ROOM THE TILES STAND ALONE, CLIPPED AT THE BAND'S
        // EDGE AND NEVER SCROLLED (round 22, seam 245 ask 13 C; ComposePick.md):
        // `Show all` is the way to the rest.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (fits) {
                        Modifier
                    } else {
                        Modifier
                            .clipToBounds()
                            .wrapContentWidth(Alignment.Start, unbounded = true)
                    },
                ),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            state.picked.forEachIndexed { index, asset ->
                MediaThumb(
                    item = MediaItem(
                        asset.uri,
                        asset.sourceRatio ?: 1f,
                        asset.altText.ifBlank { null },
                        // An author who cropped, stepped back here, and is on
                        // their way forward again sees the crop they made
                        // rather than the original.
                        state.crops[asset.uri].toFraming(),
                    ),
                    badge = ThumbBadge.Cover.takeIf { index == 0 },
                    onRemove = { onRemove(asset.uri) },
                    removeTestTag = "wizard_tray_${index}_remove",
                    contentDescription = stringResource(R.string.content_picture_at, index + 1),
                    testTag = "wizard_tray_$index",
                )
            }
            if (fits) {
                Text(
                    text = caption,
                    style = style,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("wizard_tray_caption"),
                )
            }
        }
    }
}

/**
 * The tray's own first line: the count, and `Show all` beside it where
 * there is a set for the sheet to manage. A staged clip drops the button —
 * one clip is not a set to reorder — and the count becomes the only thing
 * on its line rather than a flex row with nothing left to push to the end.
 */
@Composable
private fun PickedTrayHeader(count: Int, showAll: Boolean, onShowAll: () -> Unit) {
    if (showAll) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "Picked · $count",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .weight(1f)
                    .testTag("wizard_picked_count"),
            )
            // `InlineAction size="sm"` is its resting look, value for value
            // (PickTray.jsx; jakob's ruling D): a real button with a 48dp
            // target that leaves the band's line alone.
            InlineAction(text = "Show all", onClick = onShowAll, size = InlineSize.Small, testTag = "wizard_show_all")
        }
    } else {
        Text(
            text = "Picked · $count",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("wizard_picked_count"),
        )
    }
}

/**
 * The files the step would not take (`ComposePickedErrors`).
 *
 * Each is a failed tile beside its own words, drawn where the file was
 * offered — never in a dialog and never in a snackbar. There is no
 * Retry: asking again cannot make a file smaller or a format readable,
 * so removing the notice is the only way out. A file nothing can read
 * has no preview, so its tile is empty on purpose.
 */
@Composable
private fun RefusedFiles(refused: List<RefusedPick>, onDismiss: (Int) -> Unit) {
    if (refused.isEmpty()) return
    // `ComposePickedErrors`: the list stands `14px 24px 0` under the tray, a
    // refusal every 10 — the board's own rhythm, off the 4dp grid.
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = Space.x6, end = Space.x6, top = REFUSALS_TOP),
        verticalArrangement = Arrangement.spacedBy(REFUSALS_GAP),
    ) {
        refused.forEachIndexed { index, file ->
            Row(
                modifier = Modifier.testTag("wizard_refused_row_$index"),
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MediaThumb(
                    item = MediaItem(file.uri, 1f),
                    badge = ThumbBadge.Failed,
                    video = file.isVideo,
                    contentDescription = stringResource(R.string.content_refused_file),
                    testTag = "wizard_refused_thumb_$index",
                )
                UploadErrorLine(
                    message = file.reason.text(),
                    onRemove = { onDismiss(index) },
                    modifier = Modifier.weight(1f),
                    testTag = "wizard_refused_$index",
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
            imageVector = Icons.Filled.Image,
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

/** `ComposePickedErrors.jsx`: the refusals' `14px` lead and `gap: 10`. */
private val REFUSALS_TOP = 14.dp
private val REFUSALS_GAP = 10.dp

/** `ComposePickVideo.jsx`: the staged clip's tray tile, `width={114} height={64}`. */
private val TRAY_CLIP_WIDTH = 114.dp
private val TRAY_CLIP_HEIGHT = 64.dp

private const val GRID_COLUMNS = 3

/** `ComposePickVideo`'s `DeadGrid` opacity for the inert grid under a staged clip. */
private const val DEAD_GRID_ALPHA = 0.45f

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
    // `ComposeDraftBody`: a `Card` (surface-card, the medium rung, padding
    // 16, gap 12) wearing the task ring OUTSIDE its padding — a 2dp edge in
    // a border-box — at the `8 24` margin.
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2)
            .testTag("wizard_draft_offer")
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .taskRing(taskRingColors(), MaterialTheme.shapes.medium)
            .padding(Space.x4 + 2.dp),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
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
                    contentDescription = stringResource(R.string.content_draft_first_picture),
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
