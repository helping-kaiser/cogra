package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space

/**
 * The overflow menu on a piece of content
 * (design/components/content/OverflowMenu.jsx).
 *
 * EVERY post and every comment carries one. Genesis content always
 * declares a license (post.md §1), so there is always at least the
 * license entry — and a trigger that comes and goes between cards is
 * worse than one that is always in the same place. It exists because
 * the affordance row has a budget and the things competing for it do
 * not all deserve the same weight: a stance is the gesture the product
 * lives on, while checking a license is something a reader does once in
 * a hundred readings.
 *
 * ITS ROWS ARE `label-large` AT THE 48dp MINIMUM TARGET, left-aligned,
 * one line each, and NO ICONS — a mixed list of iconned and un-iconned
 * rows is the way an icon set starts to look accidental (§5).
 *
 * NOTHING IN HERE TAKES `error` COLOURING. A destructive row is drawn
 * like the rest; the confirmation it opens is where the weight belongs.
 *
 * A menu with no rows draws no trigger: a ⋮ that opens an empty sheet
 * teaches the reader the card lies.
 *
 * [stacked] is true for the one board this ⋮ also draws stacked
 * (`CommentMenu.jsx`, design/readme.md:2364): the comment's menu, over the
 * comments thread's own sheet. The post's menu and a feed card's stay
 * unstacked — both open over the plain page.
 *
 * [sheetNode] is the registered sheet on a registered screen
 * (`feed.menuSheet`, `postDetail.menuSheet`): the sheet then wears it, and
 * its grip the `dragHandle` part, in place of the `_sheet` tag.
 *
 * THE OPEN SHEET COVERS THE SURFACE BENEATH (Feed.md:31-33): it says so to
 * the page's covering layers, and the stage under it stops until it drops.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CograOverflowMenu(
    items: List<MenuRow>,
    contentDescription: String,
    testTag: String,
    modifier: Modifier = Modifier,
    stacked: Boolean = false,
    sheetNode: DataNode? = null,
    /**
     * THE HEADER PLACEMENT (`OverflowMenu.jsx` `placement="header"`): a 48dp
     * box pulled back by 12dp on every side, so it keeps the 24dp line it
     * rides on — a card's header row, a page header's action. False keeps
     * the plain 48dp icon button the rows of controls carry.
     */
    pulled: Boolean = false,
    /**
     * THE ROW PLACEMENT (`OverflowMenu.jsx` `placement="row"`): the dot standing
     * in a ROW OF CONTROLS beside the row's buttons (a profile's actions
     * row) — 40dp of ink, answering at 48 through [hitTarget], so the row's
     * height is its ink's.
     */
    inRow: Boolean = false,
    /**
     * The open sheet's own accessible name where the board gives it one
     * (`BottomSheet` `ariaLabel`: `Profile actions`); null names it by the
     * trigger's [contentDescription], as the master's own sheet does.
     */
    sheetLabel: String? = null,
) {
    if (items.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    CoversSurface(open = open, kind = CoverKind.Suspend)

    val ink = when {
        inRow -> ROW_INK
        pulled -> PULLED_INK
        else -> null
    }
    OverflowTrigger(ink, contentDescription, testTag, modifier) { open = true }

    if (open) {
        val state = rememberModalBottomSheetState()
        val name = sheetLabel ?: contentDescription
        ModalBottomSheet(
            onDismissRequest = { open = false },
            sheetState = state,
            containerColor = sheetContainerColor(
                stacked,
                MaterialTheme.colorScheme,
                MaterialTheme.colorScheme.surfaceContainerHigh,
            ),
            // THE MASTER'S GRIP (`BottomSheet.jsx`) is the sheet's own first
            // child, not Material's handle slot: 8dp over a 32×4 handle and
            // 12dp under it, so the first row starts 24dp down (Material's
            // pads 22dp each side) — and a mark, "not a button", as the
            // master says and `CograSheetSurface` already draws it.
            dragHandle = null,
        ) {
            // NO TITLE. The rows are the sheet, and the name the trigger
            // already carries reaches a screen reader through the sheet's
            // pane title. The sheet's node rides this column, inside the
            // sheet's own offset, so it measures where the sheet stands.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(sheetNode?.tag ?: "${testTag}_sheet")
                    .semantics { paneTitle = name }
                    .padding(bottom = Space.x6),
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                SheetGrip(sheetNode?.div("dragHandle"))
                items.forEach { row ->
                    // `SheetItem`: edge to edge, the 48dp minimum, `0 24`,
                    // its one line centred in the row.
                    Box(
                        contentAlignment = Alignment.CenterStart,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag(row.testTag)
                            .clickable(role = Role.Button) {
                                // The sheet is the door, not the destination:
                                // it drops as the row acts, so a dialog the row
                                // opens is not opening behind a menu the reader
                                // has finished with.
                                open = false
                                row.onSelect()
                            }
                            .heightIn(min = Layout.TouchTargetMin)
                            .padding(horizontal = Space.x6),
                    ) {
                        Text(
                            text = row.label,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        }
    }
}

/** `BottomSheet.jsx`'s handle: `outlineVariant`, 32×4, 8dp above and 12dp below. */
@Composable
private fun SheetGrip(node: DataNode?) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(top = Space.x2, bottom = Space.x3),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .dataNode(node)
                .size(width = GRIP_WIDTH, height = GRIP_HEIGHT)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.outlineVariant),
        )
    }
}

/**
 * The ⋮ itself: a drawn box answering at 48 ([ink] — the header's pulled 24,
 * the row's 40), or the plain icon button.
 */
@Composable
private fun OverflowTrigger(
    ink: Dp?,
    contentDescription: String,
    testTag: String,
    modifier: Modifier,
    onOpen: () -> Unit,
) {
    if (ink != null) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = modifier
                .testTag(testTag)
                .hitTarget(
                    interactive = Modifier
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onOpen)
                        .semantics { this.contentDescription = contentDescription },
                    drawnWidth = ink,
                    drawnHeight = ink,
                )
                .size(ink),
        ) {
            Icon(
                Icons.Filled.MoreVert,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    } else {
        IconButton(
            onClick = onOpen,
            modifier = modifier.testTag(testTag),
        ) {
            Icon(
                Icons.Filled.MoreVert,
                contentDescription = contentDescription,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The header placement's ink: the 24dp line the pulled 48dp box keeps (`OverflowMenu.jsx`). */
private val PULLED_INK: Dp = 24.dp

/** The row placement's ink: 40dp beside the row's buttons (`OverflowMenu.jsx` `placement="row"`). */
private val ROW_INK: Dp = 40.dp

private val GRIP_WIDTH: Dp = 32.dp
private val GRIP_HEIGHT: Dp = 4.dp
