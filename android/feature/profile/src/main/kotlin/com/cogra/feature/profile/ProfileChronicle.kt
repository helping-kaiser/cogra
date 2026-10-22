// THE CHRONICLE (Profile.md:23-35; `_shared.jsx` `ChronicleList`,
// `ContentRow variant="chronicle"`): one act to a card, newest first, each
// card leading with its act's disc, then its verb and snippet, its age on the
// trailing edge. No Show more, no page numbers, no count of what is left —
// the next page arrives as the reader keeps going.

package com.cogra.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.SEVERED_LABEL
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowSecond
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.crypto.Family
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.ageLadder
import kotlinx.coroutines.delay
import java.time.Instant

/**
 * One act (`ContentRow` chronicle), keyed by its place newest first (the
 * board's key rule: two acts can read alike). A card with somewhere to go
 * opens its post; one with nowhere to go is the same card, inert.
 */
@Composable
internal fun ChronicleAct(
    row: RecordRow,
    position: Int,
    own: Boolean,
    now: Instant,
    node: DataNode,
    onOpenPost: (String) -> Unit,
) {
    val post = (row.link as? RecordLink.ToPost)?.postId
    ContentRow(
        title = stringResource(verbOf(row, own)),
        titleAside = row.targetHandle?.takeIf { row.opinion != null }
            ?.let { stringResource(R.string.chronicle_opinion_on, it) },
        disc = discOf(row),
        second = row.snippet?.takeIf { it.isNotBlank() }?.let { words -> { ContentRowSecond(words) } },
        trailing = row.landedAt?.let { ageLadder(it, now) },
        onOpen = post?.let { { onOpenPost(it) } },
        node = node.keyed(position.toString()),
        testTag = "chronicle_row",
        modifier = Modifier.padding(horizontal = Space.x4),
    )
}

/**
 * The act's verb in the profile's blessed words (copy-voice.md, "Carried
 * over": `Published a post`, `Commented`, `Gave an opinion`, `Updated your
 * profile` · `Updated their profile`). An opinion is the reader's word for
 * both stance families — "stance" never reaches a screen.
 */
internal fun verbOf(row: RecordRow, own: Boolean): Int = when (row.family) {
    Family.PUBLISH -> if (row.genesis) R.string.chronicle_published else R.string.chronicle_edited_post
    Family.REVIEW -> if (row.genesis) R.string.chronicle_commented else R.string.chronicle_edited_comment
    // The anchoring record and its updates share one label — the chain
    // shape is not visible per-row.
    Family.REGISTRATION -> if (own) R.string.chronicle_profile_yours else R.string.chronicle_profile_theirs
    Family.OPINION, Family.AFFINITY -> R.string.chronicle_opinion
    else -> R.string.chronicle_acted
}

/** Each act's disc, by kind (`_shared.jsx` `ProfileOwnBody`'s chronicle). */
internal fun discOf(row: RecordRow): ContentRowDisc {
    val opinion = row.opinion
    return when {
        row.family == Family.PUBLISH -> ContentRowDisc.Glyph(Icons.Filled.DynamicFeed)
        row.family == Family.REVIEW -> ContentRowDisc.Glyph(Icons.Filled.ChatBubble)
        row.family == Family.REGISTRATION -> ContentRowDisc.Glyph(Icons.Filled.Person)
        // The stance record's own face — which (0, 0) it reads, from the
        // record's own `severed`.
        opinion != null -> ContentRowDisc.Face(
            opinion.directed,
            opinion.interest,
            zeroLabel = if (opinion.severed) SEVERED_LABEL else EMPTY_PICK_LABEL,
        )
        else -> ContentRowDisc.Glyph(Icons.Filled.History)
    }
}

/**
 * THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (Profile.md:31): asked
 * a few rows short of the end, never by a button.
 */
@Composable
internal fun LoadNextAtTheTail(list: LazyListState, rows: Int, ready: Boolean, onLoadMore: () -> Unit) {
    LaunchedEffect(list, ready, rows) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }
            .collect { last ->
                // The list's last items are the header's; the acts follow.
                val nearEnd = last >= list.layoutInfo.totalItemsCount - TAIL_DISTANCE
                if (ready && nearEnd) onLoadMore()
            }
    }
}

/**
 * What stands where the next page will: `Loading…` once it is 200ms late
 * (Profile.md:33 — never a spinner), or the quiet failure line with Retry
 * (Profile.md:35 — never the error colour; copy-voice.md `Couldn't load
 * more` · `Retry`).
 */
@Composable
internal fun ChronicleTail(paging: Boolean, failed: Boolean, onRetry: () -> Unit) {
    var late by remember { mutableStateOf(false) }
    LaunchedEffect(paging) {
        late = false
        if (paging) {
            delay(LOADING_AFTER_MS)
            late = true
        }
    }
    when {
        failed -> Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
            modifier = Modifier.padding(horizontal = Space.x4, vertical = Space.x2),
        ) {
            Text(
                text = stringResource(R.string.profile_more_failed),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("profile_rows_failed"),
            )
            InlineAction(stringResource(R.string.profile_more_retry), onRetry, testTag = "profile_rows_retry")
        }
        paging && late -> LoadingState(
            testTag = "profile_rows_loading",
            modifier = Modifier.padding(horizontal = Space.x4, vertical = Space.x2),
        )
    }
}

/** How close to the end of the list the next page is asked for. */
private const val TAIL_DISTANCE = 5

/** How long a next page may take before `Loading…` stands for it (Profile.md:33). */
internal const val LOADING_AFTER_MS = 200L
