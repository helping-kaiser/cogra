// The body a post or a comment renders — words, or a gallery — with
// the two states that replace it: the sensitive veil and the removal
// placeholder (D12, D15).

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
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
import com.cogra.domain.ModerationState
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.feature.content.R

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
 * @param collapsed the summary card's reading: the body clamps to
 *   [TEXT_BODY_CLAMP_LINES], the description to
 *   [DESCRIPTION_CLAMP_LINES], and an opener unfolds whatever that hid.
 *   False on the detail, which is the read surface and clamps nothing.
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
    moderation: ModerationState,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    collapsed: Boolean = false,
    onOpenMedia: (() -> Unit)? = null,
    surface: BodySurface = BodySurface.Post,
    revealed: Boolean = false,
    onReveal: () -> Unit = {},
) {
    if (isRemoved(content, attachments, attachmentsStatus)) {
        RemovedPlaceholder(
            reason = removalReason(moderation),
            modifier = modifier,
            testTag = "${testTagPrefix}_removed",
        )
        return
    }

    val veiled = !revealed && isSensitive(content, description, attachmentsStatus)
    // What the clamp hid, remembered from the reading that hid it: once
    // the opener has unfolded the text nothing overflows any more, so a
    // live measurement would take the opener away with the fold.
    var folded by remember(testTagPrefix) { mutableStateOf(false) }
    var open by remember(testTagPrefix) { mutableStateOf(false) }
    val clamping = collapsed && !open

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

            // WORDS XOR MEDIA (D16): the picture IS the body, so a media
            // post draws no `content` even when the record carries one.
            // The words beside a picture are the description, and the
            // card draws them under it. Handed both — an impossible post
            // — the documented media reading wins: the manifest is the
            // body, and half a card is better than an invented one.
            val words = content.value
                ?.takeIf { it.isNotEmpty() && !(surface == BodySurface.Post && attachments.isNotEmpty()) }
            words?.let {
                ClampedText(
                    text = it,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = if (clamping) TEXT_BODY_CLAMP_LINES else Int.MAX_VALUE,
                    onOverflow = { folded = true },
                    testTag = "${testTagPrefix}_words",
                )
            }

            if (surface == BodySurface.Comment) gallery()

            description?.value?.takeIf { it.isNotEmpty() }?.let { note ->
                ClampedText(
                    text = note,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (clamping) DESCRIPTION_CLAMP_LINES else Int.MAX_VALUE,
                    onOverflow = { folded = true },
                    testTag = "${testTagPrefix}_description",
                )
            }

            // Only where there is something folded away. A text control,
            // not a link: it opens the text in place and never
            // navigates.
            if (collapsed && folded) {
                Text(
                    text = stringResource(if (open) R.string.content_less else R.string.content_more),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .clickable { open = !open }
                        .testTag("${testTagPrefix}_opener"),
                )
            }
        }
    }
}

/**
 * THE DESCRIPTION IS TWO LINES in the feed, on both kinds of post. It is
 * the caption, not the body: enough to say what the thing is, never
 * enough to become the reading.
 */
internal const val DESCRIPTION_CLAMP_LINES = 2

/**
 * THE TEXT BODY'S CEILING — a text post stands about as tall as a media
 * post, never taller, so a feed of both keeps one rhythm. Derived from
 * the tokens rather than chosen: on the 390×844 board, 844 less the 44px
 * safe area, the 64px bottom bar and the 360px worst-case chrome leaves
 * 376px, and `body-medium`'s line height is 20px — floor(376 / 20) = 18.
 */
internal const val TEXT_BODY_CLAMP_LINES = 18

/**
 * A paragraph that reports whether the clamp hid anything.
 *
 * Measured rather than estimated from a character count: the board's
 * estimate exists because a static render cannot measure a paragraph,
 * and the rule it serves is "only where there is something folded away".
 */
@Composable
private fun ClampedText(
    text: String,
    color: Color,
    maxLines: Int,
    onOverflow: () -> Unit,
    testTag: String,
) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = color,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (it.hasVisualOverflow) onOverflow() },
        modifier = Modifier.testTag(testTag),
    )
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

/**
 * The design-system view of one attachment.
 *
 * A clip hands over two URLs: the component draws the poster and plays
 * the video, and it is the *cover's* URL that becomes `url` because
 * that is the still the frame shows before a first frame exists.
 *
 * **A cover redacted on its own leaves the video playing.** The cover
 * answers with its own status, so a removed poster means the frame
 * reserves its space and waits for the first frame rather than drawing
 * bytes that are gone — the video itself was not removed, and pretending
 * otherwise would erase something nobody erased.
 */
internal fun MediaAssetView.toItem(): MediaItem {
    if (!isVideo) {
        return MediaItem(url = url, aspectRatio = aspectRatio, altText = altText)
    }
    val poster = cover?.takeIf { !it.status.hidden() }
    return MediaItem(
        url = poster?.url,
        aspectRatio = aspectRatio,
        altText = altText,
        videoUrl = url,
        durationMs = durationMs,
    )
}

/**
 * Which of the two removals a reader is looking at.
 *
 * The docs require the two to stay distinguishable, since collapsing
 * them lets a verdict hide behind an author's decision. `ILLEGAL` is the
 * passed proposal; every other state — an unnamed one included — leaves
 * the author's own removal as the only reading the evidence supports.
 */
internal fun removalReason(moderation: ModerationState): RemovalReason =
    if (moderation == ModerationState.ILLEGAL) RemovalReason.Platform else RemovalReason.Author

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
