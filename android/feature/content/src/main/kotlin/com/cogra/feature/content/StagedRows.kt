// The composer's own staged rows: a staged citation (`StagedReference.jsx`)
// and a staged tag (`TopicRemovable.jsx`). The details stage, the seal's
// Cited sheet and its Tags sheet draw these, because a citation or a tag
// staged anywhere is the same one, and a second drawing of one fact drifts
// from the first.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView

/**
 * A staged citation's name as the composer writes it (`StagedReference`'s
 * `name`): a post or comment by its title and its author's handle —
 * `The long way home — @ada` — a person by their name.
 */
@Composable
internal fun stagedName(target: ReferenceTargetView?): String = when (target) {
    is ReferenceTargetView.Profile -> target.displayName?.takeIf { it.isNotBlank() } ?: "@${target.handle}"
    is ReferenceTargetView.Content -> {
        val label = referenceLabel(target)
        target.authorHandle?.let { "$label — @$it" } ?: label
    }
    null -> referenceLabel(null)
}

/** What class of thing is cited, as the master writes it (`Post`, `Comment`, `Person`). */
internal fun stagedKind(target: ReferenceTargetView?): String? = when (target) {
    is ReferenceTargetView.Profile -> "Person"
    is ReferenceTargetView.Content -> when (target.kind) {
        ReferenceContentKind.POST -> "Post"
        ReferenceContentKind.COMMENT -> "Comment"
    }
    null -> null
}

/**
 * ONE STAGED CITATION (`StagedReference.jsx`): the kind's mark, the name over
 * its kind, the pair the citation signs, and the remove ×. The row stands on
 * `surfaceContainerHighest` at the small rung, `8 12`, at least 48 tall.
 *
 * THE ROW OPENS THE PAIR (jakob 2026-09-10): everything but the × is one
 * control named `<name> — set how it relates`, and the × is named for what it
 * removes, so a block of three is never three identically-named buttons.
 *
 * THE PAIR READS FACE AND DIGITS: the face always, the digits as a `cg-exact`
 * tail in geek mode only, and a screen-reader twin says the exact pair either
 * way. A citation is not a stance, so the anchor's word is withheld.
 */
@Composable
internal fun StagedReferenceRow(
    row: ReferenceRow,
    onEdit: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
    node: DataNode? = null,
    testTag: String? = null,
) {
    val name = stagedName(row.target)
    val kind = stagedKind(row.target)
    val point = StancePoint(row.relevance, row.support)
    val exact = point.pair()
    val showExact = LocalShowExactValues.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .then(if (node == null && testTag != null) Modifier.testTag(testTag) else Modifier)
            .defaultMinSize(minHeight = 48.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clip(MaterialTheme.shapes.small)
                .clickable(role = Role.Button, onClick = onEdit)
                .semantics { contentDescription = "$name — set how it relates" }
                .then(if (testTag != null) Modifier.testTag("${testTag}_repair") else Modifier),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            StagedMark(row.target, node?.div("mark"))
            Column(Modifier.weight(1f)) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.dataNode(node?.div("name")),
                )
                kind?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.dataNode(node?.div("kind")),
                    )
                }
            }
            Row(
                modifier = Modifier
                    .dataNode(node?.div("pair"))
                    .semantics { contentDescription = exact },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x1),
            ) {
                Text(
                    text = bundleReadout(point, EMPTY_PICK_LABEL).emoji,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier
                        .dataNode(node?.div("pair")?.div("face"))
                        .clearAndSetSemantics { },
                )
                if (showExact) {
                    Text(
                        text = exact,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        modifier = Modifier
                            .dataNode(node?.div("pair")?.div("exact"))
                            .clearAndSetSemantics { },
                    )
                }
            }
        }
        RemoveCross(
            name = "Remove $name",
            drawn = REMOVE_BOX,
            glyph = 18.dp,
            onRemove = onRemove,
            tag = node?.div("remove")?.tag ?: testTag?.let { "${it}_remove" },
        )
    }
}

/** The kind's mark: a person's face, a post's or a comment's 32dp tile (`NodeMark` `onCard`). */
@Composable
private fun StagedMark(target: ReferenceTargetView?, node: DataNode?) {
    when (target) {
        is ReferenceTargetView.Profile -> Box(Modifier.dataNode(node)) {
            CograAvatar(name = target.displayName ?: target.handle, size = MARK_SIZE)
        }
        else -> NodeMark(
            comment = (target as? ReferenceTargetView.Content)?.kind == ReferenceContentKind.COMMENT,
            coverUrl = null,
            removed = false,
            testTag = node?.tag ?: "staged_mark",
        )
    }
}

/**
 * ONE STAGED TAG (`TopicRemovable.jsx`): a `secondaryContainer` pill, at least
 * 32 tall, `4 12`, `label-large` — the name that opens the tag's pair, and its
 * own × at 16, each answering at 48 without growing the pill.
 */
@Composable
internal fun TopicRemovable(
    name: String,
    onEdit: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
    node: DataNode? = null,
    testTag: String? = null,
) {
    val ink = MaterialTheme.colorScheme.onSecondaryContainer
    Row(
        modifier = modifier
            .dataNode(node)
            .then(if (node == null && testTag != null) Modifier.testTag(testTag) else Modifier)
            .defaultMinSize(minHeight = TOPIC_MIN_HEIGHT)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .padding(horizontal = Space.x3, vertical = Space.x1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = "#$name",
            style = MaterialTheme.typography.labelLarge,
            color = ink,
            maxLines = 1,
            modifier = Modifier
                .then(if (testTag != null) Modifier.testTag("${testTag}_open") else Modifier)
                .hitTarget(
                    interactive = Modifier
                        .clickable(role = Role.Button, onClick = onEdit)
                        .semantics { contentDescription = "#$name — set how it relates" },
                    drawnHeight = TOPIC_LINE,
                ),
        )
        RemoveCross(
            name = "Remove #$name",
            drawn = 16.dp,
            glyph = 16.dp,
            onRemove = onRemove,
            tag = node?.div("remove")?.tag ?: testTag?.let { "${it}_remove" },
            tint = ink,
        )
    }
}

/** The × that takes a staged thing back out, named for what it removes; it answers at 48. */
@Composable
private fun RemoveCross(
    name: String,
    drawn: Dp,
    glyph: Dp,
    onRemove: () -> Unit,
    tag: String?,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Box(
        modifier = Modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onRemove)
                    .semantics { contentDescription = name },
                drawnWidth = drawn,
                drawnHeight = drawn,
            )
            .size(drawn),
        contentAlignment = Alignment.Center,
    ) {
        Icon(imageVector = Icons.Filled.Close, contentDescription = null, tint = tint, modifier = Modifier.size(glyph))
    }
}

/** `StagedReference`'s × box: 32 drawn, 18 glyph. */
private val REMOVE_BOX = 32.dp

/** `NodeMark` at the composer's size. */
private val MARK_SIZE = 32.dp

/** The name's `label-large` line. */
private val TOPIC_LINE = 20.dp

/** `TopicRemovable`'s `minHeight: 32` (GAP: the master's content-box renders 40 on the board). */
private val TOPIC_MIN_HEIGHT = 32.dp
