// One edit, one batch — the EditCompose family's shared law
// (design/designs/canonical/behavior/EditComposeUnchanged.md;
// design/readme.md:5564-5578).
//
// THE GUARD IS THE ACTS BATCH, NEVER A BYTE COMPARISON. An edit signs when
// its batch holds an act, and the edit record is one of those acts the moment
// the author first changes a field the record carries. It STAYS staged after
// that, even when the field is typed back to what it was: comparing bytes
// would refuse the author who typed a word and took it back, and accept one
// whose only change is whitespace no record carries. The protocol accepts a
// priced no-op edit (crates/api/tests/content_path.rs
// `an_unchanged_post_edit_is_accepted_and_priced`).
//
// Tags and citations are their OWN acts beside the record (post.md §3), read
// off what the content arrived with against what the edit now holds, so a
// pick taken back off unstages itself; a citation's withdrawal counts its
// real counter-records (`ReferenceClaim.withdrawalCost`).

package com.cogra.feature.content.edit

import com.cogra.domain.ReferenceTargetView
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState

/** The kinds an edit stages, in the order the acts card lists them (copy-voice "The edit's acts"). */
enum class EditActKind(val label: String) {
    Edit("Edit"),
    TagsAdded("Tags added"),
    TagsWithdrawn("Tags withdrawn"),
    TagsRevised("Tags revised"),
    CitationsAdded("Citations added"),
    CitationsRevised("Citations revised"),
    CitationsWithdrawn("Citations withdrawn"),
    CoverChanged("Cover changed"),
}

/** One row of the acts card: a kind, what it names, and the records it signs. */
data class EditActRow(
    val kind: EditActKind,
    val value: String,
    val count: Int,
    /** The singular noun the count is heard as — the row's, never its label's. */
    val noun: String,
)

/** The acts the batch holds, one row per kind present, in the card's order. */
fun editActRows(
    recordStaged: Boolean,
    recordName: String,
    tags: TagSectionState,
    references: ReferenceSectionState,
    coverChanged: Boolean = false,
): List<EditActRow> {
    val rows = mutableMapOf<EditActKind, Gathered>()
    fun add(kind: EditActKind, name: String, count: Int, noun: String) {
        val row = rows.getOrPut(kind) { Gathered(noun) }
        row.names += name
        row.count += count
    }

    if (recordStaged) add(EditActKind.Edit, recordName, 1, "edit")
    val loadedTags = tags.loaded.map(TagRow::name).toSet()
    tags.adds.forEach { row ->
        val kind = if (row.name in loadedTags) EditActKind.TagsRevised else EditActKind.TagsAdded
        add(kind, "#${row.name}", 1, "tag")
    }
    tags.removes.forEach { name -> add(EditActKind.TagsWithdrawn, "#$name", 1, "tag") }
    val loadedRefs = references.loaded.map(ReferenceRow::targetId).toSet()
    references.adds.forEach { row ->
        val kind = if (row.targetId in loadedRefs) EditActKind.CitationsRevised else EditActKind.CitationsAdded
        add(kind, row.label(), 1, "citation")
    }
    references.removes.forEach { row ->
        add(EditActKind.CitationsWithdrawn, row.label(), row.withdrawalCost, "thing")
    }
    if (coverChanged) add(EditActKind.CoverChanged, "The clip's cover", 1, "cover")

    return EditActKind.entries.mapNotNull { kind ->
        rows[kind]?.let { row -> EditActRow(kind, row.names.joinToString(", "), row.count, row.noun) }
    }
}

/** One kind's names and records, gathered while the batch is read. */
private class Gathered(val noun: String) {
    val names = mutableListOf<String>()
    var count = 0
}

/** What one signature commits, in records — the footer's and the sheet's one number. */
fun List<EditActRow>.actCount(): Int = sumOf { it.count }

/**
 * The foot's sentence (`ActsFooter.jsx`): `Nothing to sign yet` at zero — and
 * then the line is no control — `You're signing 1 thing`, `You're signing N
 * things`.
 */
fun actsFooterLine(count: Int): String = when (count) {
    0 -> "Nothing to sign yet"
    1 -> "You're signing 1 thing"
    else -> "You're signing $count things"
}

/** The acts sheet's title (copy-voice "What one signature commits"). */
fun actsSheetTitle(count: Int): String = if (count == 1) "1 thing, signed" else "$count things, signed together"

/** The tags the edit withdrew — each a `Withdrawn:` line with its `Undo`. */
fun TagSectionState.withdrawn(): List<String> = removes

/** The citations the edit withdrew — each a `Withdrawn:` line with its `Undo`. */
fun ReferenceSectionState.withdrawn(): List<ReferenceRow> = removes

/**
 * Undo on a `Withdrawn:` line: the tag returns AS IT STOOD — the loaded claim,
 * its own parameters — so the withdrawal unstages and nothing new is staged in
 * its place.
 */
fun TagSectionState.undoWithdrawal(name: String): TagSectionState {
    val original = loaded.firstOrNull { it.name == name } ?: return this
    if (tags.any { it.name == name }) return this
    return copy(tags = tags + original)
}

/** Undo on a citation's `Withdrawn:` line, the same way. */
fun ReferenceSectionState.undoWithdrawal(targetId: String): ReferenceSectionState {
    val original = loaded.firstOrNull { it.targetId == targetId } ?: return this
    if (references.any { it.targetId == targetId }) return this
    return copy(references = references + original)
}

/**
 * A citation's name as the acts card and its `Withdrawn:` line read it: a
 * person by handle, a post or comment by its title (or words) and its author —
 * `Tide tables and the third headland — @juno` — and the id where nothing
 * resolved.
 */
fun ReferenceRow.label(): String = when (val target = target) {
    is ReferenceTargetView.Profile -> "@${target.handle}"
    is ReferenceTargetView.Content -> listOfNotNull(
        target.title?.takeIf { it.isNotBlank() } ?: target.snippet?.takeIf { it.isNotBlank() },
        target.authorHandle?.let { "@$it" },
    ).joinToString(" — ").ifEmpty { targetId }
    null -> targetId
}
