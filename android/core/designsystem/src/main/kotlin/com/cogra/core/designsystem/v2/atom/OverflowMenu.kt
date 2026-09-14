package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Space

/** One row of an overflow menu: the words, and what selecting them does. */
data class MenuRow(
    val label: String,
    val testTag: String,
    val onSelect: () -> Unit,
)

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
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CograOverflowMenu(
    items: List<MenuRow>,
    contentDescription: String,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return
    var open by remember { mutableStateOf(false) }

    IconButton(
        onClick = { open = true },
        modifier = modifier.testTag(testTag),
    ) {
        Icon(
            Icons.Filled.MoreVert,
            contentDescription = contentDescription,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    if (open) {
        val state = rememberModalBottomSheetState()
        ModalBottomSheet(
            onDismissRequest = { open = false },
            sheetState = state,
            modifier = Modifier.testTag("${testTag}_sheet"),
        ) {
            // NO TITLE. The rows are the sheet, and the name the trigger
            // already carries reaches a screen reader through the trigger's
            // own content description.
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = Space.x6),
                verticalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                items.forEach { row ->
                    Text(
                        text = row.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(role = Role.Button) {
                                // The sheet is the door, not the destination:
                                // it drops as the row acts, so a dialog the row
                                // opens is not opening behind a menu the reader
                                // has finished with.
                                open = false
                                row.onSelect()
                            }
                            .heightIn(min = 48.dp)
                            .padding(horizontal = Space.x6, vertical = Space.x3)
                            .testTag(row.testTag),
                    )
                }
            }
        }
    }
}
