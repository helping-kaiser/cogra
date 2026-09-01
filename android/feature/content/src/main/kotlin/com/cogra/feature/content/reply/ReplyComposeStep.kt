package com.cogra.feature.content.reply

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.compose.CommentPictureTray
import com.cogra.core.designsystem.v2.compose.DescribeCounter
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space

/**
 * `ReplyCompose` and `ReplyPictures` — the reply's words, and the
 * pictures once any have joined them.
 *
 * **One stage, two boards.** The second board is the first with a full
 * tray: the target card, the words, the add affordance and the closing
 * hint are the same elements in both, and the tray plus its describe
 * counter appear between them once there is anything to show. Every edge
 * out of the two boards is the same edge in `graph.json`.
 *
 * **Comments have no pick stage** (jakob 2026-08-31): "+ Add pictures"
 * opens the platform's own picker, never the post wizard's grid, because
 * reusing that stage would drag cover, crop and video machinery into a
 * flow that has none of it.
 */
@Composable
internal fun ColumnScope.ReplyComposeStepBody(
    state: ReplyWizardState,
    onBodyChange: (String) -> Unit,
    onOpenPicker: () -> Unit,
    onRemovePickAt: (Int) -> Unit,
    onDescribePictures: () -> Unit,
) {
    state.target?.let { TargetCard(it) }

    CograTextField(
        value = state.body,
        onValueChange = onBodyChange,
        label = "Your reply",
        singleLine = false,
        fillHeight = true,
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f),
        testTag = "reply_body",
    )

    if (state.hasPictures) {
        CommentPictureTray(
            pictures = state.pickedPictures(),
            onRemove = onRemovePickAt,
            testTag = "reply_tray",
        )
        DescribeCounter(
            described = state.describedCount,
            total = state.picked.size,
            onDescribe = onDescribePictures,
            testTag = "reply_describe_counter",
        )
    }

    // The board writes the cap into the label the moment there is
    // anything to count — "+ Add pictures · 2 of 4" — so an author meets
    // the limit before they hit it rather than after.
    InlineAction(
        text = if (state.hasPictures) {
            "+ Add pictures · ${state.picked.size} of ${ReplyWizardState.MAX_PICTURES}"
        } else {
            "+ Add pictures"
        },
        onClick = onOpenPicker,
        enabled = state.canAddPicture,
        testTag = "reply_add_pictures",
    )

    Text(
        // The pictures half of the sentence only becomes true once
        // pictures are uploading, which is exactly when the second board
        // says it.
        text = if (state.hasPictures) {
            "Words first — pictures can join them, and they upload while you write."
        } else {
            "Words first — pictures can join them."
        },
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("reply_hint"),
    )
}

/**
 * What the reply answers, pinned above the words.
 *
 * The same card on both entries: "Add a comment" pins the post, "Reply"
 * pins the comment (graph.json `ReplyEntry` 5 and 7). It is not a
 * control — nothing on the composer navigates away from what is being
 * answered — so it carries no click target.
 */
@Composable
private fun TargetCard(target: ReplyTarget) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2)
            .testTag("reply_target"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograAvatar(
            name = target.authorHandle,
            size = Space.x8,
            url = target.avatarUrl,
            contentDescription = null,
        )
        Column(Modifier.weight(1f)) {
            Text(
                text = "${target.title} — @${target.authorHandle}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = target.snippet,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
