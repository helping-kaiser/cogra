// THE CITATION PICKER — what `+ Cite something` opens (ReferencePicker;
// behavior/ReferencePicker.md; readme §13). The reference explorer wearing the
// search UI: the same bar, the same worded trigger, the same rows, and the
// rows' edge is the ADD mark, because the whole row's tap picks. web's twin is
// `web/src/lib/ui2/compose/reference-picker.tsx`.
//
// IT RIDES THE ONE SEARCH MATCHER through `referenceCandidates` — the matcher
// narrowed to what `prepareReference` accepts, so the picker never offers a
// target the signing would refuse: a person, a post or a comment (the V1.0
// scope cut), never a topic and never a keyless account.
//
// A PICK STAGES AND THE PICKER STAYS OPEN (jakob 2026-10-01): the row moves
// into the staged section above the results with its ×, and the move is
// spoken. Done AND THE HEADER BACK ARE ONE LEAVE, every staged citation kept.
//
// THE FILTER (the trigger reads `Everything`) is KINDS ONLY (round 24's
// `filter` state): Posts, Comments, Profiles, which combine, staged in its
// sheet and committed by Done — the search filter's law (ExploreFilter.md).
//
// THE CAP AND THE FAULT (round 24's `state` chip, round 25's rulings): at ten
// citations the cap line stands above the results and every result is dimmed
// and takes no tap; a read with no answer and nothing loaded puts the noun
// line over Retry where the results were, the field keeping the query.
//
// REGISTERED (nodes.json ReferencePicker, rounds 23–24): a result is
// `referencePicker.result` and a staged row `referencePicker.staged.stagedReference`,
// each keyed by its place from 1; its sheet is `referencePicker.filterSheet`.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.FilterFoot
import com.cogra.core.designsystem.v2.atom.FilterSection
import com.cogra.core.designsystem.v2.atom.FilterTrigger
import com.cogra.core.designsystem.v2.atom.MarkKind
import com.cogra.core.designsystem.v2.atom.RowEdge
import com.cogra.core.designsystem.v2.atom.SearchBar
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.ageLadder
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.references.CITABLE_KINDS
import com.cogra.domain.references.MAX_REFERENCES
import java.time.Instant
import com.cogra.core.designsystem.v2.atom.ReferenceRow as ResultRow

/** The picker's registered prefix (nodes.json `ReferencePicker`). */
internal val REFERENCE_PICKER = DataNode("referencePicker")

/** The results' fault, the house line's noun form (round 25; ReferencePicker.md). */
internal const val REFERENCE_PICKER_FAULT = "Can't reach the server — results can't load right now."

/** The filter's purpose — its sheet's title and the second half of the trigger's name (ReferencePicker.jsx). */
internal const val PICKER_FILTER_PURPOSE = "What the search shows"

/** The cap line, by the composer the picker was opened from (ReferencePicker.md). */
internal fun referenceCapLine(origin: PickerOrigin): String =
    "Up to $MAX_REFERENCES citations per ${origin.noun}."

/** A citable kind's chip label and its registered chip name (`FEED_KINDS` less Tags). */
private fun FeedKind.citableLabel(): String = when (this) {
    FeedKind.POST -> "Posts"
    FeedKind.COMMENT -> "Comments"
    FeedKind.PROFILE -> "Profiles"
    FeedKind.TAG -> "Tags"
}

private fun FeedKind.chipName(): String = "${citableLabel().lowercase()}Chip"

/**
 * The trigger's reading (copy-voice, *The filter pill's state words*):
 * `Everything` at the default, one kind's name, `All kinds` with every chip
 * on, else `N kinds`.
 */
internal fun citableKindsReading(kinds: Set<FeedKind>): String {
    val on = CITABLE_KINDS.filter { it in kinds }
    return when {
        on.isEmpty() -> "Everything"
        on.size == CITABLE_KINDS.size -> "All kinds"
        on.size == 1 -> on.single().citableLabel()
        else -> "${on.size} kinds"
    }
}

/** What a citation's row draws: its mark, its name, its second line and its cover. */
internal data class PickerRowView(val kind: MarkKind, val name: String, val sub: String?, val src: String?)

/**
 * A person is their name over their handle (`ExplorePerson`'s row); a post
 * or a comment is its words over `@author · age` — the age where the lookup
 * read it — and a post wears its cover.
 */
@Composable
internal fun pickerRowOf(target: ReferenceTargetView?, now: Instant): PickerRowView = when (target) {
    is ReferenceTargetView.Profile -> {
        val named = target.displayName?.takeIf { it.isNotBlank() }
        PickerRowView(MarkKind.PERSON, named ?: "@${target.handle}", named?.let { "@${target.handle}" }, null)
    }
    is ReferenceTargetView.Content -> {
        val byline = listOfNotNull(target.authorHandle?.let { "@$it" }, target.createdAt?.let { ageLadder(it, now) })
            .joinToString(" · ")
            .ifEmpty { null }
        val post = target.kind == ReferenceContentKind.POST
        PickerRowView(
            kind = if (post) MarkKind.POST else MarkKind.COMMENT,
            name = referenceLabel(target),
            sub = byline,
            src = target.coverUrl.takeIf { post },
        )
    }
    null -> PickerRowView(MarkKind.POST, referenceLabel(null), null, null)
}

/**
 * The citation picker over [section]'s open [ReferenceSectionState.picker],
 * drawn in the composer's place. Nothing draws while the picker is closed.
 */
@Composable
internal fun ReferencePicker(
    section: ReferenceSectionState,
    origin: PickerOrigin,
    handlers: ReferencePickerHandlers,
    now: Instant = Instant.now(),
) {
    val picker = section.picker ?: return
    var said by remember { mutableStateOf("") }
    var help by rememberSaveable { mutableStateOf(false) }
    var sheetOpen by rememberSaveable { mutableStateOf(false) }
    val staged = section.references.map { it.targetId }
    val atCap = section.capReached

    val stage: (ReferenceCandidateRow) -> Unit = { candidate ->
        // At the cap no result stages (ReferencePicker.md).
        if (!atCap) {
            handlers.onStageReference(candidate)
            said = PICK_ADDED
        }
    }

    PickerFrame(
        title = "Cite something",
        origin = origin,
        helpLabel = HelpTopic.Citing.title,
        onHelp = { help = true },
        onLeave = handlers::onCloseReferencePicker,
        said = said,
        node = REFERENCE_PICKER,
        footSpaced = true,
        head = {
            SearchField(picker.query) {
                said = ""
                handlers.onReferencePickerQueryChange(it)
            }
            KindsTrigger(picker.kinds, expanded = sheetOpen, onOpen = { sheetOpen = true })
        },
        staged = {
            StagedCitations(section.references, now) { targetId ->
                handlers.onUnstageReference(targetId)
                said = PICK_REMOVED
            }
        },
        list = {
            if (atCap) PickerCapLine(referenceCapLine(origin), REFERENCE_PICKER / "cap")
            if (picker.faulted) {
                PickerFault(REFERENCE_PICKER_FAULT, handlers::onRetryCandidates, REFERENCE_PICKER / "fault")
            }
            Results(picker.results(staged), enabled = !atCap, now = now, onPick = stage)
        },
    )

    KindsSheet(sheetOpen, picker.kinds, onClose = { sheetOpen = false }, onCommit = handlers::onReferenceKindsChange)
    if (help) PickerHelp(HelpTopic.Citing, onClose = { help = false })
}

/** The worded trigger under the field (`0 16px 8px`), reading the committed kinds. */
@Composable
private fun KindsTrigger(kinds: Set<FeedKind>, expanded: Boolean, onOpen: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(start = Space.x4, end = Space.x4, bottom = Space.x2),
    ) {
        FilterTrigger(
            reading = citableKindsReading(kinds),
            purpose = PICKER_FILTER_PURPOSE,
            onOpen = onOpen,
            expanded = expanded,
            node = REFERENCE_PICKER / "filterTrigger",
        )
    }
}

/** The results: each a row with the add mark, keyed by its place from 1; dimmed at the cap. */
@Composable
private fun Results(
    results: List<ReferenceCandidateRow>,
    enabled: Boolean,
    now: Instant,
    onPick: (ReferenceCandidateRow) -> Unit,
) {
    results.forEachIndexed { index, candidate ->
        val row = pickerRowOf(candidate.target, now)
        ResultRow(
            kind = row.kind,
            name = row.name,
            sub = row.sub,
            src = row.src,
            edge = RowEdge.Add,
            enabled = enabled,
            onOpen = { onPick(candidate) },
            node = (REFERENCE_PICKER / "result").keyed("${index + 1}"),
        )
    }
}

/** The search field. ReferencePicker.md: WHEN the picker opens -> it takes focus AND the keyboard rises. */
@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    val field = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) {
        field.requestFocus()
        keyboard?.show()
    }
    SearchBar(
        query = query,
        onQueryChange = onQueryChange,
        placeholder = "Search",
        label = "Cite something",
        node = REFERENCE_PICKER / "searchField",
        focusRequester = field,
    )
}

/** The staged section: the composer's own citations, each with its ×, keyed by its place from 1. */
@Composable
private fun StagedCitations(references: List<ReferenceRow>, now: Instant, onUnstage: (String) -> Unit) {
    if (references.isEmpty()) return
    StagedSection(REFERENCE_PICKER / "staged") {
        references.forEachIndexed { index, reference ->
            val row = pickerRowOf(reference.target, now)
            PickerStagedRow(
                kind = row.kind,
                name = row.name,
                sub = row.sub,
                src = row.src,
                onRemove = { onUnstage(reference.targetId) },
                node = (REFERENCE_PICKER / "staged" / "stagedReference").keyed("${index + 1}"),
            )
        }
    }
}

/**
 * THE KINDS SHEET (ReferencePicker.md; round 24's `filter` state): the three
 * kinds a citation can point at and the foot alone — no order, no seen. It
 * STAGES on a copy taken as it opens: a chip changes only the copy and the
 * results behind do not move; Reset stages the default and asks nothing; Done
 * commits, and the results re-query once; the scrim, a swipe down and Back
 * drop what is staged.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun KindsSheet(
    open: Boolean,
    committed: Set<FeedKind>,
    onClose: () -> Unit,
    onCommit: (Set<FeedKind>) -> Unit,
) {
    if (!open) return
    var staging by remember { mutableStateOf(committed) }
    val sheet = REFERENCE_PICKER / "filterSheet"
    CograSheetHost(onDismissRequest = onClose) {
        Box(Modifier.dataNode(sheet)) {
            CograSheetSurface(handleTestTag = (sheet / "dragHandle").tag, edgeToEdge = true, gap = 0.dp) {
                SheetTitle(
                    text = PICKER_FILTER_PURPOSE,
                    modifier = Modifier
                        .dataNode(sheet / "title")
                        .padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
                )
                FilterSection(
                    label = "Kinds",
                    hint = "Combine as many as you like. All, until you narrow it.",
                    node = sheet / "kinds",
                ) {
                    CITABLE_KINDS.forEach { kind ->
                        CograChip(
                            label = kind.citableLabel(),
                            selected = kind in staging,
                            onClick = { staging = if (kind in staging) staging - kind else staging + kind },
                            testTag = (sheet / "kinds" / kind.chipName()).tag,
                        )
                    }
                }
                FilterFoot(
                    resetLabel = "Reset",
                    doneLabel = "Done",
                    onReset = { staging = emptySet() },
                    onDone = {
                        onClose()
                        onCommit(staging)
                    },
                    node = sheet / "foot",
                )
            }
        }
    }
}
