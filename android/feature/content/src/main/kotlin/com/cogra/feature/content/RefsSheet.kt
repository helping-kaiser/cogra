// The tags-and-references sheet (`design/designs/canonical/screens/RefsSheet.jsx`,
// design/readme.md §13): what the card's counts open. Every signed act on the
// node gets a full row — leading mark, name, and the pair the author signed on
// it — one row shape across every node kind.
//
// THIS SHEET IS THE REVEAL, AND THE ONLY ONE (jakob's ruling, the tag round). A
// chip's tap goes to the tag's page on every surface, so there is no expanding
// chip and no second gesture that shows a value: what a node's tags are worth
// is read here, in the list that already exists to hold them.
//
// THE TWO SECTIONS COUNT IN DIFFERENT UNITS, AND THE ROWS SAY SO. A tag's
// confidence is census-bounded to [0, 1] (hashtag.md §4), so it wears no sign —
// `+0.40 / 0.90`. A citation's second axis is support over [-1, +1], so it
// keeps one — `+0.10 / +0.10`. The faces come from two disjoint tables for the
// same reason: the readout must never lie about which family it is reading.
//
// AND THIS SHEET IS WHERE "STILL SETTLING" SHOWS (jakob's ruling, 2026-09-10).
// The chip on the card says nothing about an act still finding its place in the
// order — a tag's word is the tag's word either way — so the honesty lands
// here, on the row that already carries the act's own numbers, and it rides the
// PAIR rather than the name: what has not landed is the ACT, not the node it
// points at.
//
// THE COUNT IS THE LIST'S LENGTH (jakob's ruling, 2026-09-10): a citation whose
// far end this instance cannot type still gets a row, named by its L1
// identifier. A count that quietly dropped a kind would tell a reader the sheet
// holds less than it does, and this sheet is the only place the number can be
// checked.
//
// A CARD CARRIES THE COUNT, AND THE SHEET READS THE ROWS AS IT OPENS
// (api-spec.md "Query budgets"; jakob 2026-11-23). The list is a fold priced at
// fifty rows a card, so a card's read selects `referenceCount` and the rows it
// counts are read by id the moment this sheet rises — afresh on every rise, the
// sheet being composed only while it stands. The detail's own post hands the
// list its read carried, and a count of zero is an empty list already. The
// rows' wait is the house ladder (readme §4, *Loading*; seam 434): nothing
// under 200ms, then `Loading…` where the rows will stand; a read with no answer
// says the house transport line over `Retry` in their place (seam 452). The
// tags are on the card already and never wait. The web's twin is
// `web/src/lib/references/use-references-on-open.ts`.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.MonogramAvatar
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.TagPoint
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.tagReadout
import com.cogra.core.designsystem.twoPlaces
import com.cogra.core.designsystem.twoPlacesUnsigned
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.SectionLabel
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.sheetContainerColor
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.TopicClaimView
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.feature.content.R
import com.cogra.feature.content.edit.rememberSlowAnswer
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** The leading mark's tile, at the small rung (`ReferenceRow.jsx`). */
private val MARK_SIZE = 32.dp

/** The node whose citations a sheet lists: a post or a comment, by its L2 id. */
internal data class CitingNode(val kind: ReferenceContentKind, val id: String)

/** The node a post's sheet lists. */
internal val PostView.citingNode: CitingNode get() = CitingNode(ReferenceContentKind.POST, id)

/** The node a comment's sheet lists. */
internal val CommentView.citingNode: CitingNode get() = CitingNode(ReferenceContentKind.COMMENT, id)

/**
 * The read behind the sheet's rows. Provided by [ReferenceReadsViewModel] in
 * the app; a test provides its own, and a read it does not script fails
 * rather than answering for it.
 */
@Stable
class ReferenceReads(
    val referencesOf: suspend (kind: ReferenceContentKind, id: String) -> Outcome<List<ReferenceClaimView>?> =
        { _, _ -> Outcome.Failed(UnsupportedOperationException("read not provided")) },
)

/** The surface's reads; null falls back to the destination's [ReferenceReadsViewModel]. */
val LocalReferenceReads = compositionLocalOf<ReferenceReads?> { null }

/** The process's reference reads, for a sheet a card's counts raise. */
@HiltViewModel
class ReferenceReadsViewModel @Inject constructor(references: ReferenceRepository) : ViewModel() {
    val reads = ReferenceReads(referencesOf = references::referencesOf)
}

@Composable
private fun referenceReads(): ReferenceReads =
    LocalReferenceReads.current ?: hiltViewModel<ReferenceReadsViewModel>().reads

/** What the sheet has of its rows: null while their read is out, [failed] when it got no answer. */
internal data class CitationsOnOpen(
    val references: List<ReferenceClaimView>?,
    val failed: Boolean,
    val retry: () -> Unit,
)

/** One answer of the rows' read: still out, the rows, or no answer. */
private sealed interface RowsRead {
    data object Out : RowsRead

    data class Rows(val rows: List<ReferenceClaimView>) : RowsRead

    data object Failed : RowsRead
}

/**
 * The sheet's rows, read by id as it opens unless [held] carries them. Every
 * composition of the sheet — every rise — reads afresh; a retry reads again.
 */
@Composable
internal fun citationsOnOpen(node: CitingNode, count: Int, held: List<ReferenceClaimView>?): CitationsOnOpen {
    if (held != null) return CitationsOnOpen(held, failed = false, retry = {})
    if (count == 0) return CitationsOnOpen(emptyList(), failed = false, retry = {})
    val reads = referenceReads()
    var attempt by remember { mutableIntStateOf(0) }
    val read by produceState<RowsRead>(RowsRead.Out, node, attempt) {
        value = RowsRead.Out
        // A node gone since the card was drawn has nothing left to list.
        value = when (val outcome = reads.referencesOf(node.kind, node.id)) {
            is Outcome.Success -> RowsRead.Rows(outcome.value.orEmpty())
            is Outcome.Refused, is Outcome.Failed -> RowsRead.Failed
        }
    }
    val retry = { attempt += 1 }
    return when (val answer = read) {
        RowsRead.Out -> CitationsOnOpen(null, failed = false, retry = retry)
        is RowsRead.Rows -> CitationsOnOpen(answer.rows, failed = false, retry = retry)
        RowsRead.Failed -> CitationsOnOpen(null, failed = true, retry = retry)
    }
}

/**
 * The sheet for [node]: its [topics] from the card, its citations [held] where
 * the opener's read carried them, else read by id as it rises ([citationsOnOpen]).
 */
@Composable
internal fun RefsSheet(
    topics: List<TopicClaimView>,
    node: CitingNode,
    referenceCount: Int,
    held: List<ReferenceClaimView>?,
    onDismiss: () -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    testTagPrefix: String,
    /** Over another sheet — a comment's tags and references, raised over the thread. */
    stacked: Boolean = false,
) {
    RefsSheetContent(
        topics = topics,
        cited = citationsOnOpen(node, referenceCount, held),
        onDismiss = onDismiss,
        onOpenTopic = onOpenTopic,
        onOpenActor = onOpenActor,
        onOpenPost = onOpenPost,
        testTagPrefix = testTagPrefix,
        stacked = stacked,
    )
}

/** The sheet over its rows as read: [CitationsOnOpen.references] null while the read is out. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun RefsSheetContent(
    topics: List<TopicClaimView>,
    cited: CitationsOnOpen,
    onDismiss: () -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    testTagPrefix: String,
    stacked: Boolean = false,
) {
    val late = rememberSlowAnswer(cited.references == null && !cited.failed)
    // THE SHEET IS THE DOOR, NOT THE DESTINATION — `CograOverflowMenu`'s own
    // rule, which this sheet did not keep. Its opener remembers `refsOpen`
    // across the trip (`rememberSaveable`), so a row that navigated while the
    // sheet was still open left it open: Back restored the surface AND raised
    // the sheet over it again, with no way out but a second Back. Dropping
    // the sheet as the row acts is what makes Back land where the reader
    // opened it from.
    val leaving: ((String) -> Unit) -> (String) -> Unit = { go ->
        { id ->
            onDismiss()
            go(id)
        }
    }
    val openTopic = leaving(onOpenTopic)
    val openActor = leaving(onOpenActor)
    val openPost = leaving(onOpenPost)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        // `--surface-dialog` is `surface-container-high` (design/tokens/semantic.css:9-12),
        // which the board draws and Material's own default does not: its
        // `surfaceContainerLow` reads a rung too dark, most of all in the dark theme.
        containerColor = sheetContainerColor(
            stacked,
            MaterialTheme.colorScheme,
            MaterialTheme.colorScheme.surfaceContainerHigh,
        ),
        modifier = Modifier.testTag("${testTagPrefix}_refs_sheet"),
    ) {
        Column(Modifier.fillMaxWidth()) {
            SheetTitle(
                text = stringResource(R.string.content_refs_sheet_title),
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x1),
            )
            LazyColumn(
                // `fill = false`: the sheet is sized by its rows up to the
                // screen's own limit, the way the board draws it (`maxHeight`
                // rather than a pinned height).
                modifier = Modifier.weight(1f, fill = false),
                contentPadding = PaddingValues(bottom = Space.x6),
            ) {
                if (topics.isNotEmpty()) {
                    item { SectionLabel(stringResource(R.string.content_refs_section_tags)) }
                }
                items(topics, key = { it.hashtag.id }) { claim ->
                    TagRow(claim, openTopic, testTagPrefix)
                }
                citationRows(cited, late, openActor, openPost, testTagPrefix)
            }
        }
    }
}

/** The citations' section: the rows once read, else the wait or the fault in their place. */
private fun LazyListScope.citationRows(
    cited: CitationsOnOpen,
    late: Boolean,
    openActor: (String) -> Unit,
    openPost: (String) -> Unit,
    testTagPrefix: String,
) {
    val references = cited.references
    when {
        references != null -> {
            if (references.isNotEmpty()) {
                item { SectionLabel(stringResource(R.string.content_refs_section_references)) }
            }
            items(references, key = { it.targetId }) { claim ->
                ReferenceRow(claim, openActor, openPost, testTagPrefix)
            }
        }
        cited.failed -> item { RowsFault(cited.retry, testTagPrefix) }
        late -> item {
            LoadingState(
                testTag = "${testTagPrefix}_refs_loading",
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x3),
            )
        }
    }
}

/** The rows' read got no answer: the house transport line over `Retry`, in the rows' place. */
@Composable
private fun RowsFault(onRetry: () -> Unit, testTagPrefix: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Space.x6, vertical = Space.x3),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        ErrorLine(R.string.content_error_transport, "${testTagPrefix}_refs_error")
        CograButton(
            text = stringResource(R.string.content_retry),
            onClick = onRetry,
            kind = ButtonKind.Outlined,
            size = ButtonSize.Compact,
            testTag = "${testTagPrefix}_refs_retry",
        )
    }
}

@Composable
private fun TagRow(
    claim: TopicClaimView,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
) {
    val name = claim.hashtag.name.value.orEmpty()
    val point = TagPoint(claim.relevance, claim.confidence)
    val anchor = tagReadout(point)
    val reading = stringResource(
        R.string.content_refs_row_tag,
        name,
        stringResource(anchor.label),
        twoPlaces(claim.relevance),
        twoPlacesUnsigned(claim.confidence),
    )
    NodeRow(
        mark = { Tile { Text("#", style = MaterialTheme.typography.titleMedium) } },
        title = name,
        kind = stringResource(R.string.content_refs_kind_tag),
        emoji = anchor.emoji,
        exact = point.pair(),
        pending = claim.pending,
        reading = reading,
        // `RefsSheet` 1: a tag row goes to the tag's page, the one destination
        // a chip's tap already has on every other surface — a plain row over
        // that tag's own page, which is already open ([LocalTagHere]).
        onOpen = if (name == LocalTagHere.current) null else ({ onOpenTopic(name) }),
        testTag = "${testTagPrefix}_refs_topic_$name",
    )
}

@Composable
private fun ReferenceRow(
    claim: ReferenceClaimView,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    testTagPrefix: String,
) {
    val target = claim.target
    val label = referenceLabel(target)
    val point = StancePoint(claim.relevance, claim.support)
    val reading = stringResource(
        R.string.content_refs_row_reference,
        label,
        stringResource(referenceKind(target)),
        twoPlaces(claim.relevance),
        twoPlaces(claim.support),
    )
    // `RefsSheet` 2: the referenced node's own surface. A comment has no
    // permalink, so it lands on the post carrying it; a claim this instance
    // cannot type has no destination and stays a plain row.
    val open: (() -> Unit)? = when (val route = referenceRoute(target)) {
        is ReferenceDestination.Profile -> ({ onOpenActor(route.handle) })
        is ReferenceDestination.Post -> ({ onOpenPost(route.id) })
        null -> null
    }
    NodeRow(
        mark = { ReferenceMark(target, label) },
        title = label,
        kind = stringResource(referenceKind(target)),
        emoji = bundleReadout(point).emoji,
        exact = point.pair(),
        pending = claim.pending,
        reading = reading,
        onOpen = open,
        testTag = "${testTagPrefix}_refs_reference_${claim.targetId}",
    )
}

/**
 * The leading mark says the kind, without a word beside it. A person keeps
 * their avatar — people are circles everywhere in this system — and every
 * other kind is a tile: a post the letter T, a comment its node glyph.
 *
 * A MEDIA POST WEARS ITS COVER IN THE MASTER AND ITS TILE HERE. The cover is
 * not on the wire — the reference target's selection carries the title, the
 * body and the author — so a cited post takes the master's own no-cover path,
 * which is the letter tile.
 */
@Composable
private fun ReferenceMark(target: ReferenceTargetView?, label: String) {
    when (target) {
        is ReferenceTargetView.Profile ->
            MonogramAvatar(name = target.displayName?.takeIf { it.isNotBlank() } ?: label, size = MARK_SIZE)
        is ReferenceTargetView.Content -> when (target.kind) {
            ReferenceContentKind.POST -> Tile { Text("T", style = MaterialTheme.typography.titleMedium) }
            ReferenceContentKind.COMMENT -> Tile {
                Icon(Icons.Filled.ChatBubble, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
        // The board draws no mark for a kind it does not know, so the tile
        // carries none rather than claiming a class the client cannot read.
        null -> Tile {}
    }
}

@Composable
private fun Tile(content: @Composable () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(MARK_SIZE)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest),
    ) {
        content()
    }
}

/**
 * One row: the mark, the name over the kind, and the pair at the right edge
 * with the settling mark stacked under it.
 *
 * The row speaks as ONE thing. A face's own accessible name is "slightly
 * smiling face" and an object's is "magnifying glass" — neither says anything
 * about a claim — so the glyph is cleared and [reading] carries the whole row,
 * anchor's word and exact pair included.
 */
@Composable
private fun NodeRow(
    mark: @Composable () -> Unit,
    title: String,
    kind: String,
    emoji: String,
    exact: String,
    pending: Boolean,
    reading: String,
    onOpen: (() -> Unit)?,
    testTag: String,
) {
    val settling = stringResource(com.cogra.core.designsystem.R.string.pending_settling)
    val spoken = if (pending) "$reading, $settling" else reading
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onOpen != null) Modifier.clickable(onClick = onOpen) else Modifier)
            .defaultMinSize(minHeight = 48.dp)
            .padding(horizontal = Space.x6, vertical = Space.x1)
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .testTag(testTag),
    ) {
        mark()
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = kind,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x1),
            ) {
                Text(
                    text = emoji,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.testTag("${testTag}_face"),
                )
                Text(
                    text = exact,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    modifier = Modifier.testTag("${testTag}_pair"),
                )
            }
            if (pending) PendingMarker(testTag = "${testTag}_pending")
        }
    }
}

/** The kind in words, which is what makes the leading mark decorative. */
private fun referenceKind(target: ReferenceTargetView?): Int = when (target) {
    is ReferenceTargetView.Profile -> R.string.content_refs_kind_mention
    is ReferenceTargetView.Content -> when (target.kind) {
        ReferenceContentKind.POST -> R.string.content_refs_kind_post
        ReferenceContentKind.COMMENT -> R.string.content_refs_kind_comment
    }
    null -> R.string.content_refs_kind_reference
}
