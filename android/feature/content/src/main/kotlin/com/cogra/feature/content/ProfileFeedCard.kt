// THE PROFILE CARD — a person met in a feed (`_shared.jsx` `ProfileFeedCard`;
// FeedProfileShapes.md, FeedKinds.md). web's twin is
// `web/src/lib/ui/profile-feed-card.tsx`.
//
// The top of their profile at card scale: the picture beside the name in a
// title's weight and the handle under it, the bio in the quiet colour below,
// folded at two lines — so a person reads as their page arriving, never as a
// text post with only a body. The card opens the profile.
//
// THE ROW READS OPINION · SCORE · SHARE (FeedKinds.md): the kind's own act is
// the chat glyph, and its slot waits for chats. The score slot waits with the
// post card's: no field carries a card's score until the ranker's figure
// reaches the contract.
//
// ITS ⋮ IS THE PROFILE'S OWN MENU, less the share the row carries: Save ·
// Mention · Hide for a person; Save · Hide · Report for a deleted account.
//
// A DELETED ACCOUNT STILL STANDS: the disc keeps its space and fills with
// nothing, the name's place reads `Deleted account` in the system's voice,
// and no handle and no bio stand under it.

package com.cogra.feature.content

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograOverflowMenu
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.FieldStatus
import com.cogra.domain.ProfileView
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.feature.saved.LocalSavedHost

/** The lead's picture: the profile header's compact shape at card scale. */
private val PROFILE_CARD_AVATAR = 56.dp

/** The bio folds at two lines in the quiet colour (FeedProfileShapes.md). */
private const val BIO_CLAMP_LINES = 2

@Composable
internal fun ProfileFeedCard(
    profile: ProfileView,
    /** The registered card (`saved.profileCard`), keyed by the person's id here. */
    node: DataNode,
    testTagPrefix: String,
    viewerId: String?,
    onOpen: () -> Unit,
    onShare: () -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val card = node.keyed(profile.id)
    val deleted = profile.deleted
    val name = profile.displayName.value?.trim()?.takeIf { it.isNotEmpty() && !deleted } ?: profile.handle
    val bio = profile.bio.takeIf { it.status != FieldStatus.REDACTED && !deleted }?.value?.trim()?.takeIf { it.isNotEmpty() }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(Space.x4),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (deleted) {
                        // The reserved disc: its space kept, filled with nothing.
                        Box(
                            Modifier
                                .size(PROFILE_CARD_AVATAR)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                                .dataNode(card / "avatar"),
                        )
                    } else {
                        CograAvatar(
                            name = name,
                            size = PROFILE_CARD_AVATAR,
                            url = profile.avatar?.url,
                            modifier = Modifier.dataNode(card / "avatar"),
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = if (deleted) stringResource(R.string.content_deleted_account) else name,
                            style = MaterialTheme.typography.titleMedium,
                            color = if (deleted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.dataNode(card / "name"),
                        )
                        if (!deleted) {
                            Text(
                                text = "@${profile.handle}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.dataNode(card / "handle"),
                            )
                        }
                    }
                }
                CograOverflowMenu(
                    items = profileCardMenu(profile, viewerId, testTagPrefix),
                    contentDescription = if (deleted) {
                        stringResource(R.string.content_profile_menu_deleted)
                    } else {
                        stringResource(R.string.content_profile_menu_other, "@${profile.handle}")
                    },
                    testTag = (card / "menu").tag,
                )
            }
            bio?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = BIO_CLAMP_LINES,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.dataNode(card / "bio"),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth().dataNode(card / "actionRow"),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                stanceControl(profile.id, testTagPrefix, card / "actionRow" / "stance")
                GlyphAffordance(
                    icon = Icons.Filled.Share,
                    description = if (deleted) {
                        stringResource(R.string.content_share_account)
                    } else {
                        stringResource(R.string.content_share_person, "@${profile.handle}")
                    },
                    testTag = (card / "actionRow" / "share").tag,
                    onClick = onShare,
                )
            }
            // THE ROW LINE under the face (RowSigning.md): a save or unsave of
            // this person that did not go through.
            LocalSavedHost.current?.comfortLine(profile.id)?.let { RowLine(it, "${testTagPrefix}_row_line") }
        }
    }
}

/**
 * The profile's menu less its share row (`FEED_PROFILE_MENU`,
 * `FEED_DELETED_PROFILE_MENU`). Mention waits on the wizard's profile
 * reference and a deleted account's Report on the profile report, as on the
 * profile's own ⋮ (the introduced-but-inert law).
 */
@Composable
private fun profileCardMenu(profile: ProfileView, viewerId: String?, testTagPrefix: String): List<MenuRow> {
    val host = LocalSavedHost.current
    val inert: () -> Unit = {}
    val save = host?.menuRow(profile.id, profile.viewerBookmarkedAt, "${testTagPrefix}_menu_save")
        ?: MenuRow(stringResource(R.string.content_menu_save), "${testTagPrefix}_menu_save", inert)
    val person = HiddenPerson(
        id = profile.id,
        handle = profile.handle.takeUnless { profile.deleted },
        displayName = profile.displayName.value,
        avatarUrl = profile.avatar?.url,
        redacted = profile.deleted,
    )
    val hide = host?.hideAct(person, profile.id) ?: inert
    return when {
        profile.deleted -> listOf(
            save,
            MenuRow(stringResource(R.string.content_menu_hide_account), "${testTagPrefix}_menu_hide", hide),
            MenuRow(stringResource(R.string.content_menu_report), "${testTagPrefix}_menu_report", inert),
        )
        // THE READER'S OWN CARD (undrawn: a card of oneself is reached only by
        // saving one's own profile) keeps the one act that is theirs to take.
        profile.id == viewerId -> listOf(save)
        else -> listOf(
            save,
            MenuRow(stringResource(R.string.content_menu_mention), "${testTagPrefix}_menu_mention", inert),
            MenuRow(
                stringResource(R.string.content_menu_hide_actor, "@${profile.handle}"),
                "${testTagPrefix}_menu_hide",
                hide,
            ),
        )
    }
}
