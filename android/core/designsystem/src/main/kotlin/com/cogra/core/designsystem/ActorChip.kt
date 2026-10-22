// The actor chip / row and its monogram avatar (design.md §6):
// the compact person-or-group reference every author attribution
// renders as, opening the actor's profile. The chip draws the actor's
// picture when they have one and the monogram when they do not — the
// monogram is the designed placeholder, not a gap (D13).

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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.TypeTokens

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
            text = name.trim().firstOrNull()?.uppercase() ?: "?",
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            style = monogramStyle(size),
            fontWeight = TypeTokens.MonogramWeight,
        )
    }
}

/**
 * The letter's type role at each rung (`ActorChip.jsx` `MonogramAvatar`): the
 * 24dp `sm` disc reads `label-small`, the 32dp `md` `label-medium`, a disc of
 * 56dp and up (`lg`) `headline-small`, and any other size `label-large`.
 */
@Composable
private fun monogramStyle(size: Dp): TextStyle = when {
    size >= MONOGRAM_HEADLINE_FROM -> MaterialTheme.typography.headlineSmall
    size == MONOGRAM_SM -> MaterialTheme.typography.labelSmall
    size == MONOGRAM_MD -> MaterialTheme.typography.labelMedium
    else -> MaterialTheme.typography.labelLarge
}

private val MONOGRAM_SM = 24.dp
private val MONOGRAM_MD = 32.dp
private val MONOGRAM_HEADLINE_FROM = 56.dp

/**
 * A compact actor reference — monogram, display name, handle — that
 * opens the actor's profile when [onOpen] is set.
 *
 * **It draws 24dp tall and answers at 48** (`ActorChip.jsx` minHeight 24;
 * readme §10, *A card's header answers at 48dp*): the tappable variant's
 * target is an invisible margin centred on the chip ([hitTarget]), so the
 * header row it leads keeps the board's geometry.
 *
 * **The row never wraps and never crowds** (`ActorChip.jsx`, jakob
 * 2026-09-23): a name too long for the room ellipsizes first, and the handle
 * — the identity — gives way only once the name is spent. The handle is
 * measured ahead of the weighted name for exactly that order.
 */
@Composable
fun ActorChip(
    handle: String,
    displayName: String?,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
    /**
     * The actor's picture, when they have one (D13). Null keeps the
     * monogram, which is the designed fallback rather than a gap — an
     * actor with no picture and one whose picture failed to load look
     * alike on purpose.
     */
    avatarUrl: Any? = null,
    testTag: String? = null,
    /**
     * The chip's data-node on a registered screen (`feed.card.authorChip`):
     * it then wears that tag, and its avatar, name and handle wear their
     * parts — in place of [testTag].
     */
    node: DataNode? = null,
) {
    val name = displayName?.takeIf { it.isNotBlank() } ?: handle
    val tag = node?.tag ?: testTag
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
            .then(if (tag != null) Modifier.testTag(tag) else Modifier)
            .then(
                if (onOpen != null) {
                    Modifier.hitTarget(
                        interactive = Modifier.clip(CircleShape).clickable(onClick = onOpen),
                        drawnHeight = CHIP_HEIGHT,
                    )
                } else {
                    Modifier
                },
            )
            .heightIn(min = CHIP_HEIGHT),
    ) {
        CograAvatar(name = name, size = CHIP_HEIGHT, url = avatarUrl, testTag = node?.div("avatar")?.tag)
        Text(
            text = name,
            style = MaterialTheme.typography.labelLarge,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f, fill = false)
                .dataNode(node?.div("name")),
        )
        Text(
            text = "@$handle",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.dataNode(node?.div("handle")),
        )
    }
}

/** The chip's drawn height — the avatar's `sm` rung (`ActorChip.jsx` minHeight 24). */
private val CHIP_HEIGHT = 24.dp
