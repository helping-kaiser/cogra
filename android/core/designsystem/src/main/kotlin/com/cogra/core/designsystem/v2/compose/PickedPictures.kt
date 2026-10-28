package com.cogra.core.designsystem.v2.compose

import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DragIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens
import kotlin.math.abs

/**
 * One picked picture, as the composer's surfaces see it.
 *
 * @param described whether the author wrote a description — the row shows
 *   the quiet word "Described" rather than the primary "Describe" link.
 * @param uploading an upload in flight, for the thumbnail's ring.
 * @param progress how far it has got, where the transport can say.
 * @param failed the upload did not go through.
 * @param duration a clip's running time, already written the way the
 *   boards write it. Its presence is what turns the tile into the
 *   composer's video anatomy, so a video body never reads as a picture
 *   one; pictures leave it null.
 * @param coverSrc a clip's chosen cover, riding the tile's own inset
 *   corner mark ([MediaThumb]'s `coverSrc`) rather than a second field —
 *   one attachment is one tile
 *   (`design/designs/canonical/screens/ComposeDetailsVideo.jsx:19-21`,
 *   design/readme.md §13 "The cover's tile"). Pictures leave it null.
 */
data class PickedPicture(
    val item: MediaItem,
    val described: Boolean = false,
    val uploading: Boolean = false,
    val progress: Float? = null,
    val failed: Boolean = false,
    val duration: String? = null,
    val coverSrc: Any? = null,
) {
    internal fun badge(cover: Boolean): ThumbBadge? = when {
        failed -> ThumbBadge.Failed
        cover -> ThumbBadge.Cover
        else -> null
    }
}

/**
 * The composer's summary of the body — thumbnails and the count, **one
 * tappable row** (`design/components/compose/PickedRow.prompt.md`) for a
 * gallery.
 *
 * **The row carries no "Crop" or "Edit" links** (jakob 2026-08-31: "none").
 * The whole row is the affordance and it opens the Show all sheet, which is
 * where ordering, the cover, removal and describing all live. The first tile
 * wears `Cover`, the set's rule said where the set is summarised (round 22).
 * The crop step
 * needs no second entrance: the wizard is linear and Back reaches it, and a
 * duplicate entrance to the same step is the two-menus pattern the system
 * refuses elsewhere.
 *
 * **A clip has no manager** ([onManage] `null`; jakob's ruling 2026-09-15,
 * "one clip is not a set" — there is no set for a Show all sheet to open
 * on). The row then draws no tap affordance of its own, and [onRemove]
 * gives the one tile its own [ThumbBadge.Remove] instead — the same ×
 * the pick tray already draws on this same clip
 * (`design/designs/canonical/screens/ComposeDetailsVideo.jsx` lines
 * 23-32).
 */
@Composable
fun PickedRow(
    pictures: List<PickedPicture>,
    caption: String,
    onManage: (() -> Unit)?,
    modifier: Modifier = Modifier,
    manageLabel: String = "Manage the pictures",
    onRemove: ((Int) -> Unit)? = null,
    testTag: String? = null,
    /**
     * The row's data-node on a registered screen (`composeDetails.mediaRow`):
     * the row, each thumbnail (keyed by its position, counted from 1) and the
     * caption then wear the registered paths in place of [testTag]'s.
     */
    node: DataNode? = null,
) {
    val tag = node?.tag ?: testTag
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = Layout.TouchTargetMin)
            .then(
                if (onManage != null) {
                    Modifier.clickable(role = Role.Button, onClickLabel = manageLabel, onClick = onManage)
                } else {
                    Modifier
                },
            )
            .then(if (tag != null) Modifier.testTag(tag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        pictures.forEachIndexed { index, picture ->
            MediaThumb(
                item = picture.item,
                // THE FIRST PICTURE WEARS `Cover` HERE TOO (seam 245, ask 13 F;
                // PickedRow.jsx): the row summarises a set whose first is its
                // cover, as the tray and Show all mark it. A clip is no set —
                // it has no manager — so its one tile wears no cover badge.
                badge = onRemove?.let { remove -> ThumbBadge.Remove { remove(index) } }
                    ?: picture.badge(cover = onManage != null && index == 0),
                uploading = picture.uploading,
                progress = picture.progress,
                duration = picture.duration,
                coverSrc = picture.coverSrc,
                // The row is one control; its thumbnails are not each a
                // separate thing to find — true with a remove badge too:
                // it is the one clip's own ×, not a second target.
                contentDescription = null,
                testTag = node?.div("thumb")?.keyed("${index + 1}")?.tag ?: testTag?.let { "${it}_thumb_$index" },
            )
        }
        Text(
            text = caption,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f).dataNode(node?.div("caption")),
        )
    }
}

/**
 * What the counter is counting.
 *
 * A clip takes **one** description for the whole thing (jakob
 * 2026-09-02), so the row reads "Describe the video · 0 of 1 described"
 * — the same counter, reading the video instead. Its cover takes none of
 * its own: the cover is the video's face, not a second picture.
 */
enum class DescribeSubject(val label: String) {
    Pictures("Describe the pictures"),
    Video("Describe the video"),
}

/**
 * "Describe the pictures · 1 of 3 described" — the details step's entry
 * into per-picture descriptions, with the quiet count beside it.
 *
 * Alt text is authored, optional, never invented; a described set is a
 * choice made visible, not a chore bar. It sits **under** the row, not
 * inside it.
 *
 * **THE REASON RIDES UNDER THE ROW** (jakob 2026-09-03), permanently: an
 * optional field with no stated purpose reads as a chore, and the one thing
 * that makes it worth writing — someone is listening to it — was behind a
 * `?` nobody opens. Same words as the sheet's own sub-line, so the row and
 * the sheet it opens say one thing.
 */
@Composable
fun DescribeCounter(
    described: Int,
    total: Int,
    onDescribe: () -> Unit,
    modifier: Modifier = Modifier,
    subject: DescribeSubject = DescribeSubject.Pictures,
    testTag: String? = null,
    /**
     * The counter's data-node on a registered screen
     * (`composeDetails.describeRow`): the block, its describe action, count
     * and reason then wear the registered paths; the action's tag replaces
     * [testTag].
     */
    node: DataNode? = null,
) {
    val describeTag = node?.div("describe")?.tag ?: testTag
    Column(
        modifier = modifier.dataNode(node),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x1),
        ) {
            Text(
                text = subject.label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                // `InlineAction` `sm` inside the label-small line: its 48dp
                // target never grows the line (`cg-hit`).
                modifier = Modifier
                    .then(if (describeTag != null) Modifier.testTag(describeTag) else Modifier)
                    .hitTarget(
                        interactive = Modifier.clickable(role = Role.Button, onClick = onDescribe),
                        drawnHeight = DESCRIBE_LINE,
                    ),
            )
            Text(
                text = "· $described of $total described",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(node?.div("count")),
            )
        }
        Text(
            text = "Read aloud to people who can't see it.",
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.dataNode(node?.div("reason")),
        )
    }
}

/**
 * **The** per-picture manager (`design/components/compose/PickedSheet.jsx`)
 * — opened by the pick step's "Show all" and by [PickedRow] everywhere else.
 * Order, cover, remove and describe live here and nowhere else. It is an
 * EDITING SHEET: every change applies the moment it is made, so Done, the
 * scrim, a swipe and Back all just close it.
 *
 * **The first one is the cover, and the badge travels with reorder.** There
 * is no separate cover control; the order is the answer.
 *
 * **The drag rides the handle, and it has non-drag twins** (the K13 round,
 * PickedSheet.jsx). The handle is focusable and named for its picture
 * (`Reorder the cover`, `Reorder picture 2`); dragging it lifts the row —
 * with the platform's one lift pulse, `DRAG_START` (`LONG_PRESS` below API
 * 34) — and drops it at the nearest place; ↑ / ↓ on a focused handle move it
 * one place, focus riding along; and the row's second line carries `Make it
 * the cover` · `Move up` · `Move down`, also offered as TalkBack custom
 * actions.
 *
 * Geometry is the master's, child by child, because the sheet's surface
 * carries no gap of its own there: `SheetTitle` (`0 24 8`), the list with a
 * hairline above and under every row, the footnote `12 24 0`, and Done's row
 * `8 16 8` — Done held 16 off the edge rather than the body's 24.
 */
@Composable
fun PickedSheet(
    pictures: List<PickedPicture>,
    onDescribe: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    // Each handle's focus, so a keyboard move can hand focus to the row the
    // picture moved to ("focus rides along").
    val handles = remember(pictures.size) { List(pictures.size) { FocusRequester() } }
    var focusAfterMove by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(pictures) {
        focusAfterMove?.let { handles.getOrNull(it)?.requestFocus() }
        focusAfterMove = null
    }
    val drag = remember { RowDrag() }
    val view = LocalView.current
    CograSheetSurface(modifier = modifier, testTag = testTag, gap = 0.dp) {
        SheetTitle(text = "Picked · ${pictures.size}", modifier = Modifier.padding(bottom = Space.x2))
        Column(Modifier.fillMaxWidth()) {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            pictures.forEachIndexed { index, picture ->
                PickedSheetRow(
                    picture = picture,
                    index = index,
                    total = pictures.size,
                    onDescribe = { onDescribe(index) },
                    onRemove = { onRemove(index) },
                    onMove = onMove,
                    handle = HandleWiring(
                        focus = handles[index],
                        onKeyMove = { to ->
                            focusAfterMove = to
                            onMove(index, to)
                        },
                        onDragStart = {
                            drag.start(index)
                            view.performHapticFeedback(liftPulse())
                        },
                        onDrag = drag::by,
                        onDragEnd = { drag.end()?.let { (from, to) -> if (from != to) onMove(from, to) } },
                    ),
                    lift = drag.offsetFor(index),
                    onPlaced = { height -> drag.measure(index, height) },
                    testTag = testTag?.let { "${it}_row_$index" },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
        PickedSheetFoot(onDone = onDone, testTag = testTag)
    }
}

/** The footnote `12 24 0` and Done's row `8 16 8` (`PickedSheet.jsx:134-150`). */
@Composable
private fun PickedSheetFoot(onDone: () -> Unit, testTag: String?) {
    Text(
        text = "The first one is the cover.",
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = Space.x3),
    )
    Row(
        Modifier
            .fillMaxWidth()
            // Done stands 16 off the sheet's edge, inside the body's own 24 —
            // so its row reaches 8 past it.
            .padding(top = Space.x2, bottom = Space.x2)
            .bleedHorizontally(Space.x6 - Space.x4),
        horizontalArrangement = Arrangement.End,
    ) {
        CograButton(
            text = "Done",
            onClick = onDone,
            kind = ButtonKind.Text,
            testTag = testTag?.let { "${it}_done" },
        )
    }
}

/** The handle's three routes, as one row receives them. */
private class HandleWiring(
    val focus: FocusRequester,
    val onKeyMove: (to: Int) -> Unit,
    val onDragStart: () -> Unit,
    val onDrag: (Float) -> Unit,
    val onDragEnd: () -> Unit,
)

/**
 * One drag in flight: which row was lifted, how far it has travelled, and
 * where it lands — the nearest place by the rows' own measured heights.
 */
@Stable
private class RowDrag {
    private val heights = mutableMapOf<Int, Int>()
    var from by mutableStateOf<Int?>(null)
        private set
    var travelled by mutableFloatStateOf(0f)
        private set

    fun measure(index: Int, height: Int) {
        heights[index] = height
    }

    fun start(index: Int) {
        from = index
        travelled = 0f
    }

    fun by(dy: Float) {
        travelled += dy
    }

    fun offsetFor(index: Int): Float = if (index == from) travelled else 0f

    /** The move the drop makes, or null when nothing was lifted. */
    fun end(): Pair<Int, Int>? {
        val lifted = from ?: return null
        from = null
        val to = dropIndex(lifted, travelled, heights)
        travelled = 0f
        return lifted to to
    }
}

/**
 * Where a row lifted from [from] and moved [dy] pixels lands: the place
 * whose centre the row's own centre passed, counting each row by its
 * measured height (a wrapped row is taller).
 */
internal fun dropIndex(from: Int, dy: Float, heights: Map<Int, Int>): Int {
    val step = if (dy >= 0f) 1 else -1
    var to = from
    var rest = abs(dy)
    var neighbour = heights[to + step]
    while (neighbour != null && rest >= neighbour / 2f) {
        rest -= neighbour
        to += step
        neighbour = heights[to + step]
    }
    return to
}

/** The platform's one lift pulse (readme §4, *Haptics*): `DRAG_START`, `LONG_PRESS` below API 34. */
private fun liftPulse(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        HapticFeedbackConstants.DRAG_START
    } else {
        HapticFeedbackConstants.LONG_PRESS
    }

@Composable
private fun PickedSheetRow(
    picture: PickedPicture,
    index: Int,
    total: Int,
    onDescribe: () -> Unit,
    onRemove: () -> Unit,
    onMove: (Int, Int) -> Unit,
    handle: HandleWiring,
    lift: Float,
    onPlaced: (Int) -> Unit,
    testTag: String?,
) {
    val cover = index == 0
    val name = if (cover) "the cover" else "picture ${index + 1}"
    val moves = moveActions(index, total, onMove)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .onSizeChanged { onPlaced(it.height) }
            .zIndex(if (lift != 0f) 1f else 0f)
            .graphicsLayer { translationY = lift }
            // A minimum, as the master draws it (`minHeight: 68px`): a row whose
            // move twins wrap grows rather than clipping them.
            .heightIn(min = Layout.PickedRowHeight)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .semantics { customActions = moves },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        ReorderHandle(name = name, index = index, total = total, wiring = handle, testTag = testTag)
        MediaThumb(
            item = picture.item,
            size = Layout.ThumbSizeSheet,
            badge = picture.badge(cover = cover),
            uploading = picture.uploading,
            progress = picture.progress,
            contentDescription = null,
            testTag = testTag?.let { "${it}_thumb" },
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = if (cover) "Cover — shown first" else "Picture ${index + 1}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            RowActions(picture, index, total, name, onDescribe, onMove, testTag)
        }
        // The ×: an 18dp glyph answering at 48 (`cg-hit`), named for its
        // picture (`Remove the cover`, `Remove picture 2`).
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .hitTarget(
                    interactive = Modifier
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onRemove)
                        .semantics { contentDescription = "Remove $name" }
                        .then(if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier),
                    drawnWidth = REMOVE_GLYPH,
                    drawnHeight = REMOVE_GLYPH,
                )
                .size(REMOVE_GLYPH),
        )
    }
}

/**
 * The drag handle (`PickedSheet.jsx:62-80`): a 20dp glyph answering at 48,
 * focusable and named `Reorder the cover` / `Reorder picture N`, moved by
 * its drag or by ↑ / ↓.
 */
@Composable
private fun ReorderHandle(name: String, index: Int, total: Int, wiring: HandleWiring, testTag: String?) {
    Icon(
        imageVector = Icons.Filled.DragIndicator,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .hitTarget(
                interactive = Modifier
                    .focusRequester(wiring.focus)
                    .onPreviewKeyEvent { event ->
                        if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                        val to = when (event.key) {
                            Key.DirectionUp -> index - 1
                            Key.DirectionDown -> index + 1
                            else -> return@onPreviewKeyEvent false
                        }
                        if (to in 0 until total) wiring.onKeyMove(to)
                        true
                    }
                    .focusable()
                    .pointerInput(index) {
                        detectDragGestures(
                            onDragStart = { wiring.onDragStart() },
                            onDragEnd = wiring.onDragEnd,
                            onDragCancel = wiring.onDragEnd,
                        ) { change, amount ->
                            change.consume()
                            wiring.onDrag(amount.y)
                        }
                    }
                    .semantics { contentDescription = "Reorder $name" }
                    .then(if (testTag != null) Modifier.testTag("${testTag}_handle") else Modifier),
                drawnWidth = HANDLE_GLYPH,
                drawnHeight = HANDLE_GLYPH,
            )
            .size(HANDLE_GLYPH),
    )
}

/** The same moves as TalkBack custom actions (PickedSheet.jsx), each only where it is possible. */
private fun moveActions(index: Int, total: Int, onMove: (Int, Int) -> Unit): List<CustomAccessibilityAction> =
    buildList {
        if (index > 0) {
            add(
                CustomAccessibilityAction("Make it the cover") {
                    onMove(index, 0)
                    true
                },
            )
            add(
                CustomAccessibilityAction("Move up") {
                    onMove(index, index - 1)
                    true
                },
            )
        }
        if (index < total - 1) {
            add(
                CustomAccessibilityAction("Move down") {
                    onMove(index, index + 1)
                    true
                },
            )
        }
    }

/**
 * A row's second line. THE DRAG HAS NON-DRAG TWINS (the K13 round;
 * PickedSheet.jsx): after Describe, `Make it the cover` · `Move up` · `Move
 * down`, each only where the move is possible — the cover neither becomes
 * the cover nor moves up, the last row does not move down.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RowActions(
    picture: PickedPicture,
    index: Int,
    total: Int,
    name: String,
    onDescribe: () -> Unit,
    onMove: (Int, Int) -> Unit,
    testTag: String?,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (picture.described) {
            Text(
                text = "Described",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            RowAction("Describe", "Describe $name", onDescribe, testTag?.let { "${it}_describe" })
        }
        if (index > 0) {
            RowAction("Make it the cover", null, { onMove(index, 0) }, testTag?.let { "${it}_make_cover" })
            RowAction("Move up", null, { onMove(index, index - 1) }, testTag?.let { "${it}_up" })
        }
        if (index < total - 1) {
            RowAction("Move down", null, { onMove(index, index + 1) }, testTag?.let { "${it}_down" })
        }
    }
}

/**
 * A small inline action on a row's second line — the board's `InlineAction
 * size="sm"`: the word's own label-small line in the layout, its 48dp target
 * around it (`cg-hit`), so a wrapped line keeps the master's 24dp pitch.
 */
@Composable
private fun RowAction(text: String, clickLabel: String?, onClick: () -> Unit, testTag: String?) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .hitTarget(
                interactive = Modifier.clickable(role = Role.Button, onClickLabel = clickLabel, onClick = onClick),
                drawnHeight = DESCRIBE_LINE,
            ),
    )
}

/** The sheet's × glyph (`PickedSheet.jsx`: `close` at 18) and handle (`drag_indicator` at 20). */
private val REMOVE_GLYPH = 18.dp
private val HANDLE_GLYPH = 20.dp

@ThemePreviews
@Composable
private fun PickedSheetPreview() {
    val pictures = listOf(
        PickedPicture(MediaItem(null, 1f, "The coast road"), described = true),
        PickedPicture(MediaItem(null, 1f)),
        PickedPicture(MediaItem(null, 1f)),
    )
    Cogra2PreviewTheme {
        Column(
            modifier = Modifier
                .background(MaterialTheme.colorScheme.surface)
                .padding(vertical = Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x4),
        ) {
            Column(Modifier.padding(horizontal = Space.x6)) {
                PickedRow(pictures, "3 pictures — the body", {})
                DescribeCounter(described = 1, total = 3, onDescribe = {})
            }
            PickedSheet(pictures, {}, {}, { _, _ -> }, {})
        }
    }
}

/** `DescribeCounter`'s label-small line. */
private val DESCRIBE_LINE = 16.dp
