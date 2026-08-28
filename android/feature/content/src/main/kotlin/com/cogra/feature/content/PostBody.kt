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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.media.MediaGallery
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.media.SensitiveVeil
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField

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
 * @param maxBodyLines the feed card's clamp; null in the detail, where
 *   the whole body is shown.
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

    var revealed by rememberSaveable(testTagPrefix) { mutableStateOf(false) }
    val veiled = !revealed && isSensitive(content, description, attachmentsStatus)

    SensitiveVeil(
        veiled = veiled,
        onReveal = { revealed = true },
        modifier = modifier.fillMaxWidth(),
        testTag = "${testTagPrefix}_veil",
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (attachments.isNotEmpty()) {
                MediaGallery(
                    items = attachments.map { it.toItem() },
                    onOpen = onOpenMedia,
                    testTag = "${testTagPrefix}_gallery",
                )
            }
            content.value?.takeIf { it.isNotEmpty() }?.let { words ->
                Text(
                    text = words,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = maxBodyLines ?: Int.MAX_VALUE,
                    overflow = TextOverflow.Ellipsis,
                )
            }
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
