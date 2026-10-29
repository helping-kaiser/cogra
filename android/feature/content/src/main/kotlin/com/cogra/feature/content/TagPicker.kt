// THE TAG PICKER — what `+ Add a tag` opens (TagPicker, TagPickerTyping,
// TagPickerRefused; behavior/TagPicker*.md; readme §13, the tag round). web's
// twin is `web/src/lib/ui2/compose/tag-picker.tsx`.
//
// THE FIRST ROW IS THE TYPED NAME, ALWAYS (jakob 2026-09-30, K14.1): the
// canonicalized form of what is typed, `Signs as #name` on its second line,
// and the field's action key stages it — the same pick as a tap. It names a
// Type that already exists; there is no "Create" row and never can be
// (hashtag.md §2). The rows under it are the index's: names in use that start
// with what is typed, the typed name never listed twice.
//
// A PICK STAGES AND THE PICKER STAYS OPEN (jakob 2026-10-01): the row moves
// into the staged section above the list with its ×, and the move is spoken.
// A tag the composer already holds stands in the staged section the moment
// the picker opens — the staged section IS the composer's tags.
//
// A NAME OUTSIDE THE ATOM IS REFUSED AT THE FIELD (TagPickerRefused): the
// error ring, the refusal in the rule line's place (announced by its own live
// region, never by the status message), no first row, an empty list.
//
// THE CAP AND THE FAULT (round 24's `state` chip, round 25's rulings): at ten
// tags the cap line stands above the list and every row, the typed name's
// included, is dimmed and takes no tap; a candidates' read with no answer
// leaves the typed name's row standing and puts the noun line over Retry
// where the candidates were.
//
// REGISTERED (nodes.json TagPicker, TagPickerTyping, TagPickerRefused; rounds
// 23–24): a result row is `tagPicker.tag` and a staged one `tagPicker.staged.tag`,
// each keyed by the tag's name without #.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.RowEdge
import com.cogra.core.designsystem.v2.atom.SearchBar
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.topics.MAX_TAG_NAME_BYTES
import com.cogra.domain.topics.TagNameReading
import com.cogra.domain.topics.TagNameRefusal
import com.cogra.core.designsystem.v2.atom.ReferenceRow as ResultRow

/** The picker's registered prefix (nodes.json `TagPicker`). */
internal val TAG_PICKER = DataNode("tagPicker")

/** The naming rule, stated under the field at rest (TagPicker.jsx; TagPickerTyping.md). */
internal const val TAG_NAME_RULE = "Letters, digits, dot, dash and underscore. Capitals become lowercase."

/** The footnote under the list, every state (copy-voice *Tagging*). */
internal const val TAG_PICKER_FOOTNOTE =
    "Any name works, used or not — nobody owns a tag. It is yours the moment you sign."

/** The candidates' fault, the house line's noun form (round 25; TagPicker.md). */
internal const val TAG_PICKER_FAULT = "Can't reach the server — tags can't load right now."

/** The refusal under the field, in the rule line's place (TagPickerRefused.md). */
internal fun TagNameRefusal.words(): String = when (this) {
    TagNameRefusal.CHARSET -> "A tag name is letters, digits, dot, dash and underscore."
    TagNameRefusal.LENGTH -> "A tag name is at most $MAX_TAG_NAME_BYTES characters."
}

/** The first row's second line — the record the tap will sign (TagPickerTyping.md). */
internal fun signsAs(canonical: String): String = "Signs as #$canonical"

/** The cap line, by the composer the picker was opened from (TagPicker.md). */
internal fun tagCapLine(origin: PickerOrigin): String = "Up to $MAX_TAGS tags per ${origin.noun}."

/**
 * The tag picker over [section]'s open [TagSectionState.picker], drawn in the
 * composer's place. Nothing draws while the picker is closed.
 */
@Composable
internal fun TagPicker(section: TagSectionState, origin: PickerOrigin, handlers: TagPickerHandlers) {
    val picker = section.picker ?: return
    var said by remember { mutableStateOf("") }
    var help by rememberSaveable { mutableStateOf(false) }
    val staged = section.tags.map { it.name }
    val atCap = section.capReached
    val first = picker.firstRow(staged)
    val stage: (String) -> Unit = { name ->
        // At the cap the action key and every row stage nothing (TagPicker.md).
        if (!atCap && name !in staged) {
            handlers.onStageTag(name)
            said = PICK_ADDED
        }
    }

    PickerFrame(
        title = "Add a tag",
        origin = origin,
        helpLabel = HelpTopic.Tagging.title,
        onHelp = { help = true },
        onLeave = handlers::onCloseTagPicker,
        said = said,
        node = TAG_PICKER,
        head = {
            NameField(
                picker = picker,
                onQueryChange = {
                    // The status message speaks a move, never the typing.
                    said = ""
                    handlers.onTagPickerQueryChange(it)
                },
                // The action key stages the first row — and nothing while the
                // name is refused or empty.
                onAction = { first?.let(stage) },
            )
        },
        staged = {
            StagedTags(section.tags) { name ->
                handlers.onUnstageTag(name)
                said = PICK_REMOVED
            }
        },
        list = {
            if (atCap) PickerCapLine(tagCapLine(origin), TAG_PICKER / "cap")
            first?.let { name ->
                TagResultRow(name, sub = signsAs(name), enabled = !atCap, onPick = { stage(name) })
            }
            if (picker.faulted) {
                PickerFault(TAG_PICKER_FAULT, handlers::onRetryTagIndex, TAG_PICKER / "fault")
            } else {
                picker.indexed(staged).forEach { name ->
                    TagResultRow(name, sub = null, enabled = !atCap, onPick = { stage(name) })
                }
            }
        },
        foot = { Footnote() },
    )

    if (help) PickerHelp(HelpTopic.Tagging, onClose = { help = false })
}

/**
 * The name field and the line under it. TagPicker.md: WHEN the picker opens
 * -> the name field takes focus AND the keyboard rises.
 */
@Composable
private fun NameField(picker: TagPickerState, onQueryChange: (String) -> Unit, onAction: () -> Unit) {
    val field = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) {
        field.requestFocus()
        keyboard?.show()
    }
    val refusal = (picker.reading as? TagNameReading.Refused)?.reason?.words()
    SearchBar(
        query = picker.query,
        onQueryChange = onQueryChange,
        placeholder = "Name a tag",
        label = "Name a tag",
        node = TAG_PICKER / "nameField",
        onAction = onAction,
        errorText = refusal,
        focusRequester = field,
    )
    NameLine(refusal)
}

/** The staged section: the composer's own tags, each with its ×. */
@Composable
private fun StagedTags(tags: List<TagRow>, onUnstage: (String) -> Unit) {
    if (tags.isEmpty()) return
    StagedSection(TAG_PICKER / "staged") {
        tags.forEach { row ->
            PickerStagedRow(
                kind = MarkKind.TOPIC,
                name = row.name,
                onRemove = { onUnstage(row.name) },
                node = (TAG_PICKER / "staged" / "tag").keyed(row.name),
            )
        }
    }
}

/** The footnote at the list's foot (`8px 24px 16px`), every state. */
@Composable
private fun Footnote() {
    Text(
        text = TAG_PICKER_FOOTNOTE,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(TAG_PICKER / "footnote")
            .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x4),
    )
}

/**
 * The line under the field (`0 24px 8px`): the naming rule at rest, the
 * refusal in its place while the name is refused — announced by its own live
 * region the moment it appears (TagPickerRefused.md).
 */
@Composable
private fun NameLine(refusal: String?) {
    Column(
        verticalArrangement = Arrangement.spacedBy(2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
    ) {
        if (refusal != null) {
            Text(
                text = refusal,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .dataNode(TAG_PICKER / "refusal")
                    .semantics { liveRegion = LiveRegionMode.Assertive },
            )
        } else {
            Text(
                text = TAG_NAME_RULE,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth().dataNode(TAG_PICKER / "rule"),
            )
        }
    }
}

/** One result row: the topic's mark, the name over its [sub], the add mark; dimmed at the cap. */
@Composable
private fun TagResultRow(name: String, sub: String?, enabled: Boolean, onPick: () -> Unit) {
    ResultRow(
        kind = MarkKind.TOPIC,
        name = name,
        sub = sub,
        edge = RowEdge.Add,
        onOpen = onPick,
        enabled = enabled,
        node = (TAG_PICKER / "tag").keyed(name),
    )
}
