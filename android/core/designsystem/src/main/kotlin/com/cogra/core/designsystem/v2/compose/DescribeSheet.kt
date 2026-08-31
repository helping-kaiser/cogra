package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * Writing one picture's description — its alt text
 * (`design/components/compose/DescribeSheet.prompt.md`, drawn on
 * `ComposeDescribe`).
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
 * The caption says what alt text is in one line; the `?` carries the rest.
 */
@Composable
fun DescribeSheet(
    item: MediaItem,
    value: String,
    onValueChange: (String) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    onHelp: (() -> Unit)? = null,
    testTag: String? = null,
) {
    CograSheetSurface(modifier = modifier, testTag = testTag) {
        SheetTitle(
            text = "Describe this picture",
            onHelp = onHelp,
            helpContentDescription = "Describing pictures",
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
        }

        CograTextField(
            value = value,
            onValueChange = onValueChange,
            label = "What's in the picture",
            optional = true,
            singleLine = false,
            minLines = 2,
            testTag = testTag?.let { "${it}_field" },
        )
        Text(
            text = "Read aloud to people who can't see it, and shown if the picture can't load.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
