package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DragIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.media.ThumbBadge
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * One picked picture, as the composer's surfaces see it.
 *
 * @param described whether the author wrote a description — the row shows
 *   the quiet word "Described" rather than the primary "Describe" link.
 * @param uploading an upload in flight, for the thumbnail's ring.
 * @param progress how far it has got, where the transport can say.
 * @param failed the upload did not go through.
 */
data class PickedPicture(
    val item: MediaItem,
    val described: Boolean = false,
    val uploading: Boolean = false,
    val progress: Float? = null,
    val failed: Boolean = false,
) {
    internal fun badge(cover: Boolean): ThumbBadge? = when {
        failed -> ThumbBadge.Failed
        cover -> ThumbBadge.Cover
        else -> null
    }
}

/**
 * The composer's summary of the body — thumbnails and the count, **one
 * tappable row** (`design/components/compose/PickedRow.prompt.md`).
 *
 * **The row carries no "Crop" or "Edit" links** (jakob 2026-08-31: "none").
 * The whole row is the affordance and it opens the Show all sheet, which is
 * where ordering, the cover, removal and describing all live. The crop step
 * needs no second entrance: the wizard is linear and Back reaches it, and a
 * duplicate entrance to the same step is the two-menus pattern the system
 * refuses elsewhere.
 */
@Composable
fun PickedRow(
    pictures: List<PickedPicture>,
    caption: String,
    onManage: () -> Unit,
    modifier: Modifier = Modifier,
    manageLabel: String = "Manage the pictures",
    testTag: String? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = Layout.TouchTargetMin)
            .clickable(role = Role.Button, onClickLabel = manageLabel, onClick = onManage)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        pictures.forEachIndexed { index, picture ->
            MediaThumb(
                item = picture.item,
                badge = picture.badge(cover = false),
                uploading = picture.uploading,
                progress = picture.progress,
                // The row is one control; its thumbnails are not each a
                // separate thing to find.
                contentDescription = null,
                testTag = testTag?.let { "${it}_thumb_$index" },
            )
        }
        Text(
            text = caption,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * "Describe the pictures · 1 of 3 described" — the details step's entry
 * into per-picture descriptions, with the quiet count beside it.
 *
 * Alt text is authored, optional, never invented; a described set is a
 * choice made visible, not a chore bar. It sits **under** the row, not
 * inside it.
 */
@Composable
fun DescribeCounter(
    described: Int,
    total: Int,
    onDescribe: () -> Unit,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = "Describe the pictures",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .minimumInteractiveComponentSize()
                .defaultMinSize(minHeight = 0.dp)
                .clickable(role = Role.Button, onClick = onDescribe)
                .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        )
        Text(
            text = "· $described of $total described",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * **The** per-picture manager (`design/components/compose/PickedSheet.prompt.md`)
 * — opened by the pick step's "Show all" and by [PickedRow] everywhere else.
 * Order, cover, remove and describe live here and nowhere else.
 *
 * **The first one is the cover, and the badge travels with reorder.** There
 * is no separate cover control; the order is the answer.
 *
 * Reordering is a drag on the canvas. Dragging is not an accessible route,
 * so each row also carries move-up / move-down as custom accessibility
 * actions — design/readme.md §10's non-gesture requirement, met invisibly
 * the way the crop step meets it.
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
    CograSheetSurface(modifier = modifier, testTag = testTag) {
        Text(
            text = "Picked · ${pictures.size}",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
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
                    testTag = testTag?.let { "${it}_row_$index" },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
        Text(
            text = "The first one is the cover — drag to reorder.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            CograButton(
                text = "Done",
                onClick = onDone,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_done" },
            )
        }
    }
}

@Composable
private fun PickedSheetRow(
    picture: PickedPicture,
    index: Int,
    total: Int,
    onDescribe: () -> Unit,
    onRemove: () -> Unit,
    onMove: (Int, Int) -> Unit,
    testTag: String?,
) {
    val cover = index == 0
    val name = if (cover) "the cover" else "picture ${index + 1}"
    val moves = buildList {
        if (index > 0) {
            add(CustomAccessibilityAction("Move earlier") { onMove(index, index - 1); true })
        }
        if (index < total - 1) {
            add(CustomAccessibilityAction("Move later") { onMove(index, index + 1); true })
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(Layout.PickedRowHeight)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .semantics { customActions = moves },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        Icon(
            imageVector = Icons.Filled.DragIndicator,
            // The handle is the drag's affordance; the reorder itself is
            // announced through the row's custom actions instead.
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp),
        )
        MediaThumb(
            item = picture.item,
            size = Layout.ThumbSizeSheet,
            badge = picture.badge(cover = cover),
            uploading = picture.uploading,
            progress = picture.progress,
            contentDescription = null,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = if (cover) "Cover — shown first" else "Picture ${index + 1}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (picture.described) {
                Text(
                    text = "Described",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text(
                    text = "Describe",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .defaultMinSize(minHeight = 0.dp)
                        .clickable(
                            role = Role.Button,
                            onClickLabel = "Describe $name",
                            onClick = onDescribe,
                        )
                        .then(
                            if (testTag != null) Modifier.testTag("${testTag}_describe") else Modifier,
                        ),
                )
            }
        }
        Box(
            modifier = Modifier
                .minimumInteractiveComponentSize()
                .clickable(role = Role.Button, onClickLabel = "Remove $name", onClick = onRemove)
                .then(if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

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
