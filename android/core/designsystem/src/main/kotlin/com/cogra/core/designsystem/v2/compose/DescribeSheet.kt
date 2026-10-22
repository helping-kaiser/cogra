package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.imageModel
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens

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
 * not open. The title is the sheet's `h2` at `title-large`, the reason 4dp
 * under it, and the `?` stands beside the PAIR (`DescribeSheet.jsx:45-71`).
 *
 * **TYPING STAGES; DONE COMMITS** (`ComposeDescribe.md`,
 * `ComposeDescribeVideo.md`). What is typed lives in the sheet until Done
 * hands it out through [onValueChange]; the scrim, a swipe down, system Back
 * and Escape drop it, and the description is what it was before the sheet
 * opened. The over-cap line is the sheet's own reading of what it holds, so
 * the caller hands the words ([tooLongMessage]) rather than a verdict.
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
    /**
     * The refusal past [cap] (copy-voice: `A picture's description is at most
     * 1,000 characters.` / `A video's description…`), shown — and Done made
     * inert — while the staged words run over.
     */
    tooLongMessage: String? = null,
    testTag: String? = null,
) {
    val subject = if (video) "video" else "picture"
    // The staged words, kept across a rotation; a reopened sheet starts from
    // the description as it stands.
    var staged by rememberSaveable { mutableStateOf(value) }
    val over = cap != null && staged.trim().let { it.codePointCount(0, it.length) } > cap
    val error = tooLongMessage.takeIf { over }
    CograSheetSurface(modifier = modifier, testTag = testTag) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Space.x1)) {
                Text(
                    text = if (video) "Describe the video" else "Describe this picture",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = "Read aloud to people who can't see it.",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (onHelp != null) HelpDot(onHelp = onHelp, contentDescription = "Describing pictures")
        }

        // The whole frame on the reserved surface: the author is checking
        // what they are describing, so it fits rather than crops.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(PreviewHeight)
                .clip(MaterialTheme.shapes.medium)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .then(testTag?.let { Modifier.testTag("${it}_strip") } ?: Modifier),
        ) {
            AsyncImage(
                // THE PICTURE THE POST WILL CARRY, not the one it came from.
                // The caller hands the author's own framing down for exactly
                // this ([MediaItem.framing] — "a preview drawn before the
                // cropped bytes exist"); drawing the plain `url` showed the
                // whole original instead, so an author checking their
                // description was checking it against a frame they had
                // already cropped away. `imageModel` is what the rest of the
                // media layer draws a framed item through.
                model = item.imageModel(),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
            // The cover is never offered a field of its own — the disc says
            // "this is the clip", not "play it here".
            if (video) PlayDisc(testTag?.let { "${it}_play_disc" })
        }

        // TWO LINES TO START, AND IT GROWS FROM THERE (jakob 2026-09-22): the
        // box takes a line per line written and stops at the room the sheet's
        // own chrome left — the title, the reason, the 180dp strip, the
        // supporting row and Done — from where the words scroll inside it.
        // The weight is what makes that room a measurement rather than a
        // pixel sum: everything else in this column is unweighted, so the
        // leftover IS the maximum.
        CograTextField(
            value = staged,
            onValueChange = { staged = it },
            label = "What's in the $subject",
            optional = true,
            singleLine = false,
            minLines = 2,
            growToFit = true,
            modifier = Modifier.weight(1f, fill = false),
            cap = cap,
            error = error,
            testTag = testTag?.let { "${it}_field" },
        )
        // `padding: 0 0 var(--space-2)`: Done's row ends 8 above the sheet's foot.
        Row(Modifier.fillMaxWidth().padding(bottom = Space.x2), horizontalArrangement = Arrangement.End) {
            // Visible but disabled over the cap, never hidden (the
            // caps-affordance round's ruling, PR #755's pattern).
            CograButton(
                text = "Done",
                onClick = {
                    // Done is the one way the staged words become the picture's.
                    onValueChange(staged)
                    onDone()
                },
                enabled = !over,
                kind = ButtonKind.Text,
                testTag = testTag?.let { "${it}_done" },
            )
        }
    }
}

/**
 * The board's 48dp `MediaDisc`, `play_arrow` at 28dp
 * (`DescribeSheet.jsx:71-89`). The plate reads `inverseSurface`/
 * `inverseOnSurface` — jakob's F8 ruling (2026-09-17) — never a literal
 * scrim, so it stays the same disc in both themes on both platforms.
 */
@Composable
private fun BoxScope.PlayDisc(testTag: String?) {
    Box(
        modifier = Modifier
            .align(Alignment.Center)
            .size(48.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.inverseOnSurface,
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
