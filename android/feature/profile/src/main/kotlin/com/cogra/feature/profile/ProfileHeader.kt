// THE PROFILE HEADER (`design/components/people/ProfileHeader.jsx`): the
// compact shape — the 80dp avatar left, the name (and, on one's own page, the
// handle) beside it, then the bio, the website and the one actions row. Not a
// card: the top of a screen, on the page ground. web's twin is
// `web/src/lib/ui/profile-header.tsx`.
//
// THE FIGURES (Posts · Opinions on · Opinions by) count BUNDLES, never records
// — open-questions Q35, ruled by jakob 2026-11-10 — read through
// `ProfileFigures`: the posts published, the people holding an opinion on
// the person, the people they hold one on. They stand beside the avatar
// under the name while they fit
// its column, and move under the avatar-and-name block where they do not
// (the master's two arrangements), and the whole line is one door to the
// opinions page (`onCounts`). The own avatar's change badge is not here yet: the
// crop-and-seal lives inside the edit flow only, handed to the impl loop.

package com.cogra.feature.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ProfileFigures
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
    /** The header's three figures; null until read, and each drawn only when served. */
    figures: ProfileFigures? = null,
    /** One's own profile: the figures read `Opinions on you` · `Opinions by you`. */
    own: Boolean = false,
    /** The figures' one door, the opinions page (`onCounts`); null draws them inert. */
    onFigures: (() -> Unit)? = null,
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
        val door = onFigures?.let { FiguresDoor(figuresPurpose(profile, own), it) }
        Identity(profile, showHandle, node, figures?.let { profileFigures(it, own) }.orEmpty(), door)
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

/** One figure as the header draws it: the number over its label, and the node they wear. */
private class Figure(val value: Int, val label: String, val node: String)

/** The figures as one tap target: what it opens, and the purpose its name ends on. */
private class FiguresDoor(val purpose: String, val onOpen: () -> Unit)

/**
 * The door's purpose, after the figures' own words (copy-voice.md, *The
 * profile's figures, spoken*): one's own, a deleted account's, or anyone's by
 * handle.
 */
@Composable
private fun figuresPurpose(profile: ProfileView, own: Boolean): String = when {
    own -> stringResource(R.string.profile_figures_door_own)
    profile.deleted -> stringResource(R.string.profile_figures_door_deleted)
    else -> stringResource(R.string.profile_figures_door_other, profile.handle)
}

/** The figures the header was served, in the master's order: Posts, on, by. */
@Composable
private fun profileFigures(figures: ProfileFigures, own: Boolean): List<Figure> = listOfNotNull(
    figures.posts?.let { Figure(it, stringResource(R.string.profile_figure_posts), "posts") },
    figures.opinionsOn?.let {
        val label = if (own) R.string.profile_figure_on_you else R.string.profile_figure_on_them
        Figure(it, stringResource(label), "stancesOn")
    },
    figures.opinionsBy?.let {
        val label = if (own) R.string.profile_figure_by_you else R.string.profile_figure_by_them
        Figure(it, stringResource(label), "stancesTaken")
    },
)

/**
 * The avatar and, beside it, the name over the handle and the figures.
 *
 * ONE GRID, TWO ARRANGEMENTS (`ProfileHeader.jsx`, the K13 round): while the
 * figures fit the column beside the avatar they stand under the name, the
 * name-and-figures block centred on the avatar (the name on the avatar's
 * upper half, the figures 6 under it); where they do not, the name centres
 * on the avatar alone and the figures take the header's full width under
 * the block, at the header's own 12 gap. The switch is measured on the
 * labels at their rendered size, so it moves with the reader's text size.
 */
@Composable
private fun Identity(
    profile: ProfileView,
    showHandle: Boolean,
    node: DataNode,
    figures: List<Figure>,
    door: FiguresDoor?,
) {
    if (figures.isEmpty()) {
        AvatarAndName(profile, showHandle, node, figures = null, door = null)
        return
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val fits = figuresWidth(figures) <= maxWidth - AVATAR - Space.x4
        if (fits) {
            AvatarAndName(profile, showHandle, node, figures, door)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
                AvatarAndName(profile, showHandle, node, figures = null, door = null, centred = true)
                FiguresRow(figures, node, door)
            }
        }
    }
}

/** How wide the figures stand: each the wider of its number and label, 20 apart (`--space-5`). */
@Composable
private fun figuresWidth(figures: List<Figure>): Dp {
    val measurer = rememberTextMeasurer()
    val value = MaterialTheme.typography.titleMedium
    val label = figureLabelStyle()
    val px = figures.sumOf { figure ->
        maxOf(
            measurer.measure(figure.value.toString(), value).size.width,
            measurer.measure(figure.label, label).size.width,
        )
    }
    return with(LocalDensity.current) { px.toDp() } + FIGURES_GAP * (figures.size - 1)
}

/** `label-small` whole, its weight the role's 500 (`ProfileHeader.jsx` `Figure`). */
@Composable
private fun figureLabelStyle() = MaterialTheme.typography.labelSmall

/**
 * The figures' one line: each a number over its label, 20 apart, never
 * wrapping. Given a [door] the whole line is ONE tap target toward the
 * opinions page (`onCounts`), named by what the eye reads and then its purpose
 * — `5 Posts, 9 Opinions on you, 4 Opinions by you, your opinions, both
 * directions` (ProfileHeader.jsx `figuresReading`); its target answers at
 * 48dp over the line's drawn height (`cg-hit`).
 */
@Composable
private fun FiguresRow(figures: List<Figure>, node: DataNode, door: FiguresDoor?, modifier: Modifier = Modifier) {
    val cell = node / "figures"
    val opened = door?.let {
        val reading = figures.joinToString(", ") { figure -> "${figure.value} ${figure.label}" }
        val name = "$reading, ${it.purpose}"
        Modifier.hitTarget(
            interactive = Modifier
                .clickable(role = Role.Button, onClick = it.onOpen)
                .semantics { contentDescription = name },
            drawnHeight = FIGURES_INK,
        )
    } ?: Modifier
    // The node names the drawn line, outside the grown target (AffordanceRow's order).
    Row(horizontalArrangement = Arrangement.spacedBy(FIGURES_GAP), modifier = modifier.dataNode(cell).then(opened)) {
        figures.forEach { figure ->
            val own = cell / figure.node
            // The number and the label share the figure's width (`display: flex;
            // flex-direction: column` stretches both to the wider one).
            Column(Modifier.width(IntrinsicSize.Max).dataNode(own)) {
                Text(
                    text = figure.value.toString(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.fillMaxWidth().dataNode(own / "value"),
                )
                Text(
                    text = figure.label,
                    style = figureLabelStyle(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.fillMaxWidth().dataNode(own / "label"),
                )
            }
        }
    }
}

/**
 * The avatar and the name column beside it; [figures] under the name when
 * they stand there. [centred] centres the name on the avatar — the
 * arrangement where the figures moved under the block.
 */
@Composable
private fun AvatarAndName(
    profile: ProfileView,
    showHandle: Boolean,
    node: DataNode,
    figures: List<Figure>?,
    door: FiguresDoor?,
    centred: Boolean = false,
) {
    val deleted = profile.deleted
    val name = when {
        deleted -> stringResource(DesignR.string.content_row_deleted_account)
        else -> profile.displayName.value?.takeIf { it.isNotBlank() } ?: profile.handle
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(Space.x4),
        verticalAlignment = if (centred || figures != null) Alignment.CenterVertically else Alignment.Top,
    ) {
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
        Column(Modifier.weight(1f)) {
            Column(verticalArrangement = Arrangement.spacedBy(NAME_GAP)) {
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
            // The figures 6 under the name (`marginTop: 6`).
            if (figures != null) FiguresRow(figures, node, door, Modifier.padding(top = FIGURES_TOP))
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

/** The figures under the name: `marginTop: 6`. */
private val FIGURES_TOP = 6.dp

/** Between two figures: `--space-5`. */
private val FIGURES_GAP = 20.dp

/** The line's drawn height: a `title-medium` number (24) over a `label-small` label (16). */
private val FIGURES_INK = 40.dp
