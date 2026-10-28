// THE FILTER'S SHARED PARTS (`design/components/navigation/FeedFilter.jsx`
// `FilterTrigger`, `FilterFoot`; `OrderSection.jsx` `FilterSection`;
// `core/SectionLabel.jsx`): the worded trigger a surface wears over its list,
// a sheet's titled section of chips, the Reset/Done foot every filter sheet
// ends on, and the quiet caption a sectioned list stands its groups under.
// First built for History's sheet (HistoryFilter.md); every filter sheet and
// sectioned list reads the same parts.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/** The trigger's widest ink (`FilterTrigger`'s `maxWidth: 14rem`); a longer reading ellipsizes. */
private val TRIGGER_MAX_WIDTH = 224.dp

/** The foot's hairline stands 10 over its buttons (`FilterFoot`'s `paddingTop: 10`). */
private val FOOT_TOP = 10.dp

/**
 * THE TRIGGER'S NAME IS THE READING, THEN THE PURPOSE (`FeedFilter.jsx`
 * `triggerName`; the K13 round, WCAG 2.5.3): `Posts, what your feed shows`.
 * A name that replaced the reading would hide the filter's state from exactly
 * the reader who cannot see the pill.
 */
fun filterTriggerName(reading: String, purpose: String?): String {
    if (purpose.isNullOrEmpty()) return reading
    return "$reading, ${purpose.first().lowercaseChar()}${purpose.drop(1)}"
}

/**
 * The worded trigger (`FilterTrigger`): a 32dp outlined pill reading what the
 * list shows, answering at 48dp; its tap opens the surface's filter sheet.
 * [expanded] says whether that sheet is open.
 */
@Composable
fun FilterTrigger(
    reading: String,
    purpose: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    expanded: Boolean = false,
    node: DataNode? = null,
) {
    val name = filterTriggerName(reading, purpose)
    Box(
        modifier = modifier
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(onClick = onOpen)
                    // One control, heard by its reading and purpose; while its
                    // sheet is shut it offers the sheet as an expand action.
                    .semantics {
                        contentDescription = name
                        role = Role.Button
                        if (!expanded) {
                            expand {
                                onOpen()
                                true
                            }
                        }
                    },
                drawnHeight = Layout.ChipHeight,
            )
            .dataNode(node)
            .height(Layout.ChipHeight)
            .widthIn(max = TRIGGER_MAX_WIDTH)
            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outline), CircleShape)
            .padding(horizontal = Space.x3),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = reading,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * A filter sheet's section (`FilterSection`): its label, the hint under it in
 * the quiet colour, and its chips wrapping 8dp apart; 16dp under the last.
 * The sheet's gutter is the surface's own ([CograSheetSurface]).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterSection(
    label: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    node: DataNode? = null,
    chips: @Composable () -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(bottom = Space.x4).dataNode(node),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.dataNode(node?.let { it / "label" }),
        )
        if (hint != null) {
            Text(
                text = hint,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(node?.let { it / "hint" }),
            )
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) { chips() }
    }
}

/**
 * The foot every filter sheet ends on (`FilterFoot`): a hairline, `Reset` in
 * the corner and `Done` at the end. `Reset` STAGES, `Done` COMMITS; the foot
 * carries no reading of the staged filter — the sections above are it.
 */
@Composable
fun FilterFoot(
    resetLabel: String,
    doneLabel: String,
    onReset: () -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    node: DataNode? = null,
) {
    Column(modifier.fillMaxWidth().dataNode(node)) {
        Hairline()
        Spacer(Modifier.height(FOOT_TOP))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            CograButton(
                text = resetLabel,
                onClick = onReset,
                kind = ButtonKind.Text,
                testTag = node?.let { (it / "reset").tag },
            )
            Spacer(Modifier.weight(1f))
            CograButton(text = doneLabel, onClick = onDone, testTag = node?.let { (it / "done").tag })
        }
    }
}

/**
 * A quiet section caption (`SectionLabel.jsx`): the small secondary word that
 * names a group on a sectioned surface. A caption, not a heading — what it
 * names is visible under it — set 12 above and 4 below so it sits with the
 * group it opens, carrying the screen's 24dp gutter itself.
 */
@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier, node: DataNode? = null) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier
            .fillMaxWidth()
            .padding(start = Space.x6, end = Space.x6, top = Space.x3, bottom = Space.x1)
            .dataNode(node),
    )
}

@ThemePreviews
@Composable
private fun FilterPartsPreview() {
    Cogra2PreviewTheme {
        Column(Modifier.padding(Space.x6), verticalArrangement = Arrangement.spacedBy(Space.x4)) {
            FilterTrigger(reading = "Everything", purpose = "What your history shows", onOpen = {})
            FilterSection(label = "Kinds", hint = "Combine as many as you like. All, until you narrow it.") {
                CograChip("Posts", onClick = {})
                CograChip("Comments", selected = true, onClick = {})
            }
            FilterFoot(resetLabel = "Reset", doneLabel = "Done", onReset = {}, onDone = {})
            SectionLabel("Profiles", Modifier.testTag("preview_label"))
        }
    }
}
