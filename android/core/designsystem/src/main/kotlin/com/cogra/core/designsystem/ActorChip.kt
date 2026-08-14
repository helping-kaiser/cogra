// The actor chip / row and its monogram avatar (design.md §6):
// the compact person-or-group reference every author attribution
// renders as, opening the actor's profile. Media avatars arrive with
// slice 2.5; until then the monogram is the designed placeholder.

package com.cogra.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The circular letter avatar: the first grapheme of the display name
 * (or handle). Decorative — the adjacent text names the actor, so the
 * avatar carries no content description of its own.
 */
@Composable
fun MonogramAvatar(
    name: String,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Text(
            text = name.firstOrNull()?.uppercase() ?: "?",
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            fontSize = (size.value * 0.45f).sp,
        )
    }
}

/**
 * A compact actor reference — monogram, display name, handle — that
 * opens the actor's profile when [onOpen] is set. The 48dp minimum
 * touch target (design.md §4) rides the tappable variant.
 */
@Composable
fun ActorChip(
    handle: String,
    displayName: String?,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    val name = displayName?.takeIf { it.isNotBlank() } ?: handle
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
            .then(if (onOpen != null) Modifier.heightIn(min = 48.dp).clickable(onClick = onOpen) else Modifier)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        MonogramAvatar(name = name, size = 24.dp)
        Text(
            text = name,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = "@$handle",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
