// The body a post or a comment renders — words, or a gallery — with
// the two states that replace it: the sensitive veil and the removal
// placeholder (D12, D15).

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.media.MediaGallery
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.media.SensitiveVeil
import com.cogra.core.designsystem.v2.media.cappedToTallestTile
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark

/**
 * Which surface the body is drawn on, and therefore how its pictures sit.
 *
 * A post's body **is** its pictures, so they run full-bleed to the card's
 * edges, square-cornered, at the author's own crop, and they lead the body
 * — the boards draw them between the title and the words.
 *
 * **A comment is words first and its pictures join them**
 * (`design/components/content/CommentCard.prompt.md`): they follow the
 * words, stay inset at the card's medium rung, round their corners, and cap
 * far lower. They are an attachment, not the body, so no full-bleed — and
 * they are never cropped (2026-08-31), which is why each whole frame is
 * fitted inside the frame rather than filling it.
 */
internal enum class BodySurface { Post, Comment }

/**
 * The body region of a card or a detail: the gallery, the words, and
 * the description — **as one state**.
 *
 * D12 (jakob, 2026-08-28) rules the granularity: a sensitive post blurs
 * media, text and description together and the title stays outside, so
 * this composable is exactly the region the veil covers and callers
 * draw the title above it.
 *
 * Redaction is record-granular: every authored field goes at once, so a
 * removed body is the placeholder rather than a gallery with holes in
 * it.
 *
 * **The reveal is not this composable's to remember.** It is per node
 * and per session, shared across every surface the node appears on, and
 * dropped when the node's own sensitive state changes (jakob
 * 2026-08-31) — none of which a `remember` keyed to one card can do. It
 * is hoisted to `SensitiveReveals`, and arrives here already decided.
 *
 * @param maxBodyLines the feed card's clamp; null in the detail, where
 *   the whole body is shown.
 * @param revealed whether this reader has already chosen to look.
 * @param onReveal fired when they choose to; null where the surface
 *   holds no reveal state, which leaves the veil closed.
 */
@Composable
internal fun PostBody(
    content: ModeratedField,
    description: ModeratedField?,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    maxBodyLines: Int? = null,
    onOpenMedia: (() -> Unit)? = null,
    surface: BodySurface = BodySurface.Post,
    revealed: Boolean = false,
    onReveal: () -> Unit = {},
) {
    if (isRemoved(content, attachments, attachmentsStatus)) {
        RemovedPlaceholder(
            // Which of the two reasons applies is a moderation fact the
            // contract does not carry yet: `FieldModerationStatus` says
            // REDACTED and nothing more. The author's own removal is
            // the honest default until the verdict field exists —
            // attributing a removal to the platform on no evidence
            // would be the worse error of the two.
            reason = RemovalReason.Author,
            modifier = modifier,
            testTag = "${testTagPrefix}_removed",
        )
        return
    }

    val veiled = !revealed && isSensitive(content, description, attachmentsStatus)

    SensitiveVeil(
        veiled = veiled,
        onReveal = onReveal,
        modifier = modifier.fillMaxWidth(),
        testTag = "${testTagPrefix}_veil",
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val gallery: @Composable () -> Unit = {
                if (attachments.isNotEmpty()) {
                    Gallery(attachments, surface, onOpenMedia, "${testTagPrefix}_gallery")
                }
            }

            // A post leads with its pictures; a comment leads with its
            // words and its pictures join them.
            if (surface == BodySurface.Post) gallery()

            content.value?.takeIf { it.isNotEmpty() }?.let { words ->
                Text(
                    text = words,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = maxBodyLines ?: Int.MAX_VALUE,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (surface == BodySurface.Comment) gallery()

            description?.value?.takeIf { it.isNotEmpty() }?.let { note ->
                Text(
                    text = note,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = maxBodyLines ?: Int.MAX_VALUE,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * The gallery at the rung its surface gives it.
 *
 * A comment's set rides the same pager, in a fixed square frame each whole
 * frame fits inside — but a lone picture keeps its own shape, which is what
 * the board draws (a single 4:5 comment picture, fitted).
 */
@Composable
private fun Gallery(
    attachments: List<MediaAssetView>,
    surface: BodySurface,
    onOpenMedia: (() -> Unit)?,
    testTag: String,
) {
    val items = attachments.map { it.toItem() }
    when (surface) {
        BodySurface.Post -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            testTag = testTag,
        )

        BodySurface.Comment -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            frameRatio = if (items.size == 1) {
                items[0].aspectRatio.cappedToTallestTile()
            } else {
                MediaShape.Square.ratio
            },
            fit = ContentScale.Fit,
            maxHeight = MediaFrame.CommentMaxHeight,
            shape = MaterialTheme.shapes.medium,
            testTag = testTag,
        )
    }
}

/** The design-system view of one attachment. */
internal fun MediaAssetView.toItem(): MediaItem =
    MediaItem(url = url, aspectRatio = aspectRatio, altText = altText)

/**
 * Whether the whole body is gone.
 *
 * A words post is removed when its `content` is REDACTED; a media post
 * when its gallery is. UNKNOWN counts as removed on both: a state this
 * build cannot name is never rendered as if it were fine.
 */
internal fun isRemoved(
    content: ModeratedField,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
): Boolean {
    val galleryGone = attachments.isNotEmpty() &&
        (attachmentsStatus.hidden() || attachments.all { it.status.hidden() })
    val wordsGone = attachments.isEmpty() && content.status.hidden()
    return galleryGone || wordsGone
}

/**
 * The node's sensitive state, as a reveal is remembered against.
 *
 * The same three statuses [isSensitive] reads, kept together so a reveal
 * can be compared to the state it was made under rather than merely to
 * a node id.
 */
internal fun sensitiveMark(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): SensitiveMark = SensitiveMark(
    content = content.status,
    description = description?.status,
    attachments = attachmentsStatus,
)

internal fun PostView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description, attachmentsStatus)

internal fun CommentView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description = null, attachmentsStatus = attachmentsStatus)

/** Whether the body is marked sensitive — one state for the whole of it. */
internal fun isSensitive(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): Boolean = attachmentsStatus == FieldStatus.SENSITIVE ||
    content.status == FieldStatus.SENSITIVE ||
    description?.status == FieldStatus.SENSITIVE

private fun FieldStatus.hidden(): Boolean =
    this == FieldStatus.REDACTED || this == FieldStatus.UNKNOWN
