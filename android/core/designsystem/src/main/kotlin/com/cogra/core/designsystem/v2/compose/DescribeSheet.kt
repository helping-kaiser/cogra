package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * Writing a description — a picture's alt text, or a clip's one description
 * (`design/components/compose/DescribeSheet.prompt.md`, drawn on
 * `ComposeDescribe` / `ComposeDescribeVideo`).
 *
 * Reached per picture from [DescribeCounter] and from [PickedSheet]'s
 * Describe links. **Never from the crop step**: a geometry step is no place
 * for a keyboard, and the interim field that lived there is what this
 * replaces.
 *
 * **Authored, optional, never invented.** A picture without a description
 * is skipped by screen readers, not guessed at — so the field carries the
 * "Optional" corner and nothing fills it in.
 *
 * **TWO SHAPES, ONE SHEET** (jakob 2026-09-03). [video] swaps the subject:
 * the title reads "Describe the video", the field asks what's in the video,
 * and the preview wears the play disc. A clip is ONE thing to describe —
 * there is no per-picture walk and the cover is never offered, because the
 * cover is the video's face, not a second picture.
 *
 * **THE REASON IS PERMANENT, NOT BEHIND THE `?`** — it rides directly under
 * the title on both shapes: someone deciding whether to write a description
 * needs the reason at the moment of deciding, not behind a `?` they will
 * not open.
 */
@Composable
fun DescribeSheet(
    item: MediaItem,
    value: String,
    onValueChange: (String) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    onHelp: (() -> Unit)? = null,
    video: Boolean = false,
    /** The field's ruled length cap, in Unicode scalar values — drives the late counter. */
    cap: Int? = null,
    /** The field's one refusal, worded by the caller — replaces the hint were there one. */
    error: String? = null,
    testTag: String? = null,
) {
    val subject = if (video) "video" else "picture"
    CograSheetSurface(modifier = modifier, testTag = testTag) {
        SheetTitle(
            text = if (video) "Describe the video" else "Describe this picture",
            onHelp = onHelp,
            helpContentDescription = "Describing pictures",
        )
        Text(
            text = "Read aloud to people who can't see it.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // The whole frame on the reserved surface: the author is checking
        // what they are describing, so it fits rather than crops.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(PreviewHeight)
                .clip(MaterialTheme.shapes.medium)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            AsyncImage(
                model = item.url,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
            // The cover is never offered a field of its own — the disc says
            // "this is the clip", not "play it here".
            if (video) PlayDisc(testTag?.let { "${it}_play_disc" })
        }

        CograTextField(
            value = value,
            onValueChange = onValueChange,
            label = "What's in the $subject",
            optional = true,
            singleLine = false,
            minLines = 2,
            cap = cap,
            error = error,
            testTag = testTag?.let { "${it}_field" },
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            CograButton(
                text = "Done",
                onClick = onDone,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_done" },
            )
        }
    }
}

/** The board's 48dp disc, `play_arrow` at 28dp (`DescribeSheet.jsx:71-89`). */
@Composable
private fun BoxScope.PlayDisc(testTag: String?) {
    Box(
        modifier = Modifier
            .align(Alignment.Center)
            .size(48.dp)
            .clip(CircleShape)
            .background(MediaOverlay.Badge)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(28.dp),
        )
    }
}

/** `height:180px` on `ComposeDescribe`. */
private val PreviewHeight = 180.dp

@ThemePreviews
@Composable
private fun DescribeSheetPreview() {
    Cogra2PreviewTheme {
        DescribeSheet(
            item = MediaItem(null, 1f),
            value = "Crates of strawberries on the stand by the sea wall.",
            onValueChange = {},
            onDone = {},
            onHelp = {},
        )
    }
}

@ThemePreviews
@Composable
private fun DescribeSheetVideoPreview() {
    Cogra2PreviewTheme {
        DescribeSheet(
            item = MediaItem(null, 1f),
            value = "A camera held up against the light on a headland.",
            onValueChange = {},
            onDone = {},
            onHelp = {},
            video = true,
        )
    }
}
