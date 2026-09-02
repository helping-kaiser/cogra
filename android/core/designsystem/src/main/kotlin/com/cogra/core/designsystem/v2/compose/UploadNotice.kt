package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The two upload notices (`design/components/compose/UploadNotice.jsx`).
 *
 * Upload runs in the background from the moment a picture has its crop —
 * the crop happens on the device and only the cropped export is ever
 * uploaded — so **most posts never show either**. These appear only when
 * the author outruns the network.
 */

/**
 * The seal's gate: while this shows, the sign button is disabled, because
 * nothing signs until the content it signs exists.
 *
 * The words are fixed by the component prompt and carry the count, so the
 * ring beside them is decoration rather than the message — which is why it
 * is not separately described to a screen reader.
 */
@Composable
fun UploadStatusLine(
    done: Int,
    total: Int,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    Row(
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            // The count changes while the author reads the seal; a polite
            // region announces it without interrupting them.
            .semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(
            progress = { if (total == 0) 0f else done.toFloat() / total },
            modifier = Modifier.size(RingSize),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.outlineVariant,
            strokeWidth = RingStroke,
            strokeCap = StrokeCap.Round,
            gapSize = 0.dp,
        )
        Text(
            text = "Uploading $done of $total — signing waits for the pictures.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The failure's words and its ways out.
 *
 * **Direction by words, never by colour alone**: the `error` tint marks the
 * fact, and Retry / Remove it are ordinary primary actions. The failed tile
 * itself wears [com.cogra.core.designsystem.v2.media.ThumbBadge.Failed];
 * tile and line always appear together, because retry does not fit in 48dp.
 *
 * [onRetry] is null where retrying is not a way out. A file the step
 * refused when it was offered — too big, or a format nothing here reads
 * — cannot be made smaller or readable by asking again, so
 * `ComposePickedErrors` draws only Remove it.
 */
@Composable
fun UploadErrorLine(
    onRemove: () -> Unit,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
    message: String = "One picture didn't upload.",
    testTag: String? = null,
) {
    val linkStyles = TextLinkStyles(
        style = SpanStyle(color = MaterialTheme.colorScheme.primary),
    )
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = MaterialTheme.colorScheme.error)) { append(message) }
        append(" ")
        if (onRetry != null) {
            withLink(LinkAnnotation.Clickable("retry", linkStyles) { onRetry() }) { append("Retry") }
            withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurfaceVariant)) { append(" · ") }
        }
        withLink(LinkAnnotation.Clickable("remove", linkStyles) { onRemove() }) { append("Remove it") }
    }
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            // A refusal has to reach a reader who is not looking at it.
            .semantics { liveRegion = LiveRegionMode.Assertive },
    )
}

private val RingSize = 18.dp
private val RingStroke = 3.dp

@ThemePreviews
@Composable
private fun UploadNoticePreview() {
    Cogra2PreviewTheme {
        Column(
            modifier = Modifier.padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x4),
        ) {
            UploadStatusLine(done = 2, total = 4)
            UploadErrorLine(onRetry = {}, onRemove = {})
        }
    }
}
