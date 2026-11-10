// A PERSON ON AN OPINIONS LIST (`design/components/people/StanceRow.jsx`):
// their face, their name over their handle, and THE STANCE THE ROW IS ABOUT,
// read-only. The value is the row's information — a stance has a sign and a
// magnitude, so a list showing only who would hide the part that says
// something. The whole row opens the person: acting on an opinion happens on
// their profile, never while scrolling past it. The web's twin is
// `web/src/lib/ui2/stance-row.tsx`.
//
// V1.0 PASSES NO HISTORY DOOR (readme §13, the scope cut's F-1), so the row is
// always the single element; the split-row variant waits for the
// change-histories round.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.SEVERED_LABEL
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CograAvatar

/**
 * One person and the opinion the row is about.
 *
 * @param handle the handle line, without @; none on a [redacted] row, whose
 *   handle line is gone (`ActorChip`'s law — printing one would invent a
 *   handle the reader could try to reach).
 * @param redacted a deleted account's row: the reserved disc and `Deleted
 *   account` in the system's voice. Its placer names it `redactedRow`, keyed
 *   by the actor's id.
 * @param severed WHICH (0, 0) THE ROW DRAWS, the bundle's own data: walked
 *   back speaks `Walked back`; otherwise a (0, 0) `Says nothing`. Both wear 🤷.
 * @param node the row's registered node, keyed by its placer; its parts wear
 *   `avatar`, `name`, `handle` and `value` (with the readout's `face` and
 *   `exact`), taking the key from the row.
 */
@Composable
fun StanceRow(
    name: String,
    handle: String?,
    point: StancePoint,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
    avatarUrl: String? = null,
    redacted: Boolean = false,
    severed: Boolean = false,
    node: DataNode? = null,
) {
    val shown = if (redacted) stringResource(R.string.content_row_deleted_account) else name
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ROW_GAP),
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .then(if (onOpen != null) Modifier.clickable(role = Role.Button, onClick = onOpen) else Modifier)
            .heightIn(min = ROW_MIN_HEIGHT)
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        val avatar = node?.div("avatar")?.tag
        if (redacted) {
            // THE RESERVED DISC: no monogram (no name to take a letter from)
            // and no glyph (imagery with no source).
            Box(
                Modifier
                    .size(AVATAR)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                    .dataNode(node?.div("avatar")),
            )
        } else {
            CograAvatar(name = shown, size = AVATAR, url = avatarUrl, testTag = avatar)
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = shown,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.let { if (redacted) it.onSurfaceVariant else it.onSurface },
                modifier = Modifier.dataNode(node?.div("name")),
            )
            if (!redacted && handle != null) {
                Text(
                    text = "@$handle",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.dataNode(node?.div("handle")),
                )
            }
        }
        StanceValue(
            point = point,
            zeroLabel = if (severed) SEVERED_LABEL else EMPTY_PICK_LABEL,
            node = node?.div("value"),
        )
    }
}

/** `height: 40px; width: 40px` (`MonogramAvatar size={40}`). */
private val AVATAR = 40.dp

/** `gap: 12`. */
private val ROW_GAP = 12.dp

/** `minHeight: 56`. */
private val ROW_MIN_HEIGHT = 56.dp
