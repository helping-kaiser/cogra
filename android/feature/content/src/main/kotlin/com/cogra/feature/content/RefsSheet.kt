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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.MonogramAvatar
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.TagPoint
import com.cogra.core.designsystem.nearestStanceAnchor
import com.cogra.core.designsystem.nearestTagAnchor
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.twoPlaces
import com.cogra.core.designsystem.twoPlacesUnsigned
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ReferenceClaimView
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.TopicClaimView
import com.cogra.feature.content.R

/** The leading mark's tile, at the small rung (`ReferenceRow.jsx`). */
private val MARK_SIZE = 32.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun RefsSheet(
    topics: List<TopicClaimView>,
    references: List<ReferenceClaimView>,
    onDismiss: () -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    testTagPrefix: String,
) {
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
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
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
                if (references.isNotEmpty()) {
                    item {
                        SectionLabel(stringResource(R.string.content_refs_section_references))
                    }
                }
                items(references, key = { it.targetId }) { claim ->
                    ReferenceRow(claim, openActor, openPost, testTagPrefix)
                }
            }
        }
    }
}

/**
 * A quiet section caption (`SectionLabel.jsx`): the small secondary word that
 * names a group. It is a caption, not a heading — what it names is already
 * visible underneath it — and its padding is asymmetric on purpose, so it sits
 * with the group it opens rather than floating between two of them.
 */
@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = Space.x6, end = Space.x6, top = Space.x3, bottom = Space.x1),
    )
}

@Composable
private fun TagRow(
    claim: TopicClaimView,
    onOpenTopic: (String) -> Unit,
    testTagPrefix: String,
) {
    val name = claim.hashtag.name.value.orEmpty()
    val point = TagPoint(claim.relevance, claim.confidence)
    val anchor = nearestTagAnchor(point)
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
        // a chip's tap already has on every other surface.
        onOpen = { onOpenTopic(name) },
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
        emoji = nearestStanceAnchor(point).emoji,
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
