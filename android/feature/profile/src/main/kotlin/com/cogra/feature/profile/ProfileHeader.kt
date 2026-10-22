// THE PROFILE HEADER (`design/components/people/ProfileHeader.jsx`): the
// compact shape — the 80dp avatar left, the name (and, on one's own page, the
// handle) beside it, then the bio, the website and the one actions row. Not a
// card: the top of a screen, on the page ground. web's twin is
// `web/src/lib/ui/profile-header.tsx`.
//
// The figures (Posts · Opinions on · Opinions by) and the own avatar's change
// badge are drawn on every board but not here yet: no figure rides the wire
// (open-questions Q35) and the crop-and-seal lives inside the edit flow only —
// both handed to the impl loop. Without the figures beside the name, the name
// stands at the avatar's top, as the master's own grid lays it with no figures
// cell.

package com.cogra.feature.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ProfileView
import com.cogra.core.designsystem.R as DesignR

private val AVATAR = 80.dp

/**
 * @param showHandle off on a drill-in, whose bar is already titled `@handle`
 *   (the master's `showHandle={false}`); a deleted account has none to show.
 * @param actions the actions row's controls in the page's order — the row is
 *   the master's: one line, 8dp apart, centred on its tallest control.
 * @param under what stands under the actions row (the row line of a save or
 *   hide that did not go through).
 */
@Composable
internal fun ProfileHeader(
    profile: ProfileView,
    showHandle: Boolean,
    node: DataNode,
    actions: @Composable RowScope.() -> Unit,
    under: @Composable () -> Unit = {},
) {
    Column(
        modifier = Modifier
            .padding(horizontal = Space.x4)
            // The node is the header's own box: its 12dp top and 4dp foot
            // are inside it, the page's gutter is not (`ProfileHeader.jsx`).
            .dataNode(node)
            .padding(top = Space.x3, bottom = Space.x1),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Identity(profile, showHandle, node)
        if (profile.deleted) {
            // THE MARK STANDS IN THE BIO'S PLACE — a space kept, not lost
            // (ProfileDeleted.md:11). Its moment is not on the wire yet.
            RemovedPlaceholder(RemovalReason.Account, node = node / "removalMark")
        } else {
            OwnWords(profile, node)
        }
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x2),
                modifier = Modifier.dataNode(node / "actionRow"),
                content = actions,
            )
            under()
        }
    }
}

/** The avatar and, beside it, the name over the handle. */
@Composable
private fun Identity(profile: ProfileView, showHandle: Boolean, node: DataNode) {
    val deleted = profile.deleted
    val name = when {
        deleted -> stringResource(DesignR.string.content_row_deleted_account)
        else -> profile.displayName.value?.takeIf { it.isNotBlank() } ?: profile.handle
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Space.x4)) {
        if (deleted) {
            // THE RESERVED DISC: no monogram (no name to take a letter
            // from) and no glyph (imagery with no source).
            Box(
                Modifier
                    .dataNode(node / "avatar")
                    .size(AVATAR)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            )
        } else {
            // The picture when they have one, the monogram when they do not
            // — and where a load fails, so "none" and "broken" look alike.
            CograAvatar(name = name, size = AVATAR, url = profile.avatar?.url, testTag = (node / "avatar").tag)
        }
        // The name column takes what the avatar leaves (`minmax(0, 1fr)`).
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(NAME_GAP)) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleLarge,
                // `Deleted account` is the system's voice, not a chosen name.
                color = MaterialTheme.colorScheme.let { if (deleted) it.onSurfaceVariant else it.onSurface },
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { heading() }
                    .dataNode(node / "name"),
            )
            if (showHandle && !deleted) {
                Text(
                    text = "@${profile.handle}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().dataNode(node / "handle"),
                )
            }
        }
    }
}

/** Their own words: the bio, unclamped, then the website in `primary`. */
@Composable
private fun OwnWords(profile: ProfileView, node: DataNode) {
    profile.bio.value?.takeIf { it.isNotBlank() }?.let { bio ->
        Text(
            text = bio,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.fillMaxWidth().dataNode(node / "bio"),
        )
    }
    profile.websiteUrl.value?.takeIf { it.isNotBlank() }?.let { url ->
        Text(
            text = url,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.fillMaxWidth().dataNode(node / "website"),
        )
    }
}

/** The name and the handle under it: 2dp (`ProfileHeader.jsx` `gap: 2`). */
private val NAME_GAP = 2.dp
