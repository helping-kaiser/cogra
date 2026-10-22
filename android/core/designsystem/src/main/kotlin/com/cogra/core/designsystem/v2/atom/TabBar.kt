package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * One cell of a [TabBar]: a glyph cell when it has an [icon] (named by
 * [label] in the accessibility tree, the only name an icon-only control can
 * have), else [label] as its own words.
 */
data class TabBarTab(val id: String, val label: String, val icon: ImageVector? = null)

/**
 * THE FULL-WIDTH TAB ROW (`design/components/navigation/TabBar.jsx`): equal
 * cells across the surface with a hairline under them, the chosen one in
 * `primary` with a 2dp underline. The profile's chronicle draws it with
 * glyphs, the opinions page with words — one row, two kinds of cell.
 *
 * THE UNDERLINE IS THE MASTER'S DELIBERATE DEVIATION from "selection is colour
 * only": an icon's colour alone is too quiet to say which of three same-weight
 * glyphs is on. It is drawn inside the cell's own 48dp, so the cell's height
 * does not move when the selection does.
 *
 * IT IS A GROUP OF TOGGLES, NOT A TAB LIST — nothing here controls a panel, the
 * row filters the list beneath it — so each cell is a selectable button and the
 * row a traversal group named by [label] (`What the chronicle shows`).
 *
 * @param node the row's data-node on a registered screen (`profile.tabRow`);
 *   each cell then wears `<id>Tab` (`profile.tabRow.postsTab`).
 */
@Composable
fun TabBar(
    tabs: List<TabBarTab>,
    value: String,
    onSelect: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    iconSize: Dp = 22.dp,
    node: DataNode? = null,
) {
    val hairline = MaterialTheme.colorScheme.outlineVariant
    Column(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .semantics {
                isTraversalGroup = true
                contentDescription = label
            },
    ) {
        Row(Modifier.fillMaxWidth()) {
            tabs.forEach { tab ->
                TabCell(
                    tab = tab,
                    selected = tab.id == value,
                    onSelect = { onSelect(tab.id) },
                    iconSize = iconSize,
                    modifier = Modifier
                        .weight(1f)
                        .dataNode(node?.div("${tab.id}Tab")),
                )
            }
        }
        // The row's own 1dp hairline under the cells (`borderBottom`).
        Box(
            Modifier
                .fillMaxWidth()
                .height(HAIRLINE)
                .background(hairline),
        )
    }
}

@Composable
private fun TabCell(tab: TabBarTab, selected: Boolean, onSelect: () -> Unit, iconSize: Dp, modifier: Modifier) {
    val ink = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .heightIn(min = Layout.TouchTargetMin)
            // The chosen cell's 2dp underline, inside the cell (`inset 0 -2px 0`).
            .drawBehind {
                if (selected) {
                    val stroke = UNDERLINE.toPx()
                    drawLine(
                        color = ink,
                        start = Offset(0f, size.height - stroke / 2),
                        end = Offset(size.width, size.height - stroke / 2),
                        strokeWidth = stroke,
                    )
                }
            }
            .selectable(selected = selected, role = Role.Button, onClick = onSelect)
            .then(if (tab.icon != null) Modifier.semantics { contentDescription = tab.label } else Modifier),
    ) {
        if (tab.icon != null) {
            Icon(tab.icon, contentDescription = null, tint = ink, modifier = Modifier.size(iconSize))
        } else {
            Text(tab.label, style = MaterialTheme.typography.labelLarge, color = ink)
        }
    }
}

private val HAIRLINE = 1.dp
private val UNDERLINE = 2.dp

/** The chronicle's three glyph cells (`_shared.jsx` `CHRONICLE_TABS`). */
fun chronicleTabs(posts: String, comments: String, everything: String): List<TabBarTab> = listOf(
    TabBarTab("posts", posts, Icons.Filled.DynamicFeed),
    TabBarTab("comments", comments, Icons.Filled.ChatBubble),
    TabBarTab("everything", everything, Icons.Filled.History),
)

@ThemePreviews
@Composable
private fun TabBarVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            TabBar(chronicleTabs("Posts", "Comments", "Everything"), "everything", {}, "What the chronicle shows")
            TabBar(listOf(TabBarTab("on", "On them"), TabBarTab("by", "By them")), "on", {}, "Opinions")
        }
    }
}
