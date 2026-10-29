// THE APPLICANT'S OWN APPLICATION CARD (ApplicantWaiting, ApplicantRejected,
// ProfileApplicant; behavior/<board>.md; copy-voice *The reject extension's
// lines*). Read-only: it says how the application stands and holds the ask
// link — the one thing the applicant can hand out — and acts on nothing else.
// web's twin is `web/src/app/application-card.tsx`.
//
// ONE APPLICATION, BY PRECEDENCE (design digest item 66): `User.application`
// answers the approved-not-landed row, else the newest waiting, else the
// newest closed — and the card names THAT row's approver, never the role
// "inviter" (ApplicantWaiting.md:5, ProfileApplicant.md:7).
//
// - WAITING: the feed's card once every owed step is done — `All set —
//   waiting on @mira` — with the ask link and `Got it`, which puts it away on
//   this device (ApplicantWaiting.md:3, :15). The profile's card — `Waiting
//   on @mira` — is never put away (ProfileApplicant.md:5, :14).
// - CLOSED: the account-notice olive, titled by the member who closed it,
//   with the ask link labelled by what to do with it; never put away
//   (ApplicantRejected.md:3-9, ProfileApplicant.md:11-13).

package com.cogra.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.AddressCard
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograMark
import com.cogra.core.designsystem.v2.atom.taskRing
import com.cogra.core.designsystem.v2.atom.taskRingColors
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.invites.MyApplication

/** Which screen the card rides: the feed, or the reader's own profile. */
enum class ApplicationSurface(val path: String) {
    FEED("feed"),
    PROFILE("profile"),
}

/** Which card stands, from the application the account reads. */
data class ApplicationCardState(
    val closed: Boolean,
    /** The member whose approval is in play, without the @. */
    val approver: String,
    val askLink: String,
)

/** The card the account's application asks for; null where the landing or vouch card stands instead. */
fun cardOf(mine: MyApplication?): ApplicationCardState? {
    val application = mine?.application ?: return null
    val askLink = mine.askLink ?: return null
    val approver = application.approver ?: return null
    // Approved-not-landed is the landing card's, and landed is the vouch card's.
    if (application.approvedAt != null || application.landedAt != null) return null
    return ApplicationCardState(
        closed = application.rejectedAt != null,
        approver = approver.handle,
        askLink = askLink,
    )
}

/** The card's words, per state and surface (copy-voice *The reject extension's lines*). */
private data class CardWords(val title: String, val body: String, val label: String, val caption: String)

@Composable
private fun cardWords(card: ApplicationCardState, surface: ApplicationSurface): CardWords {
    val approver = "@${card.approver}"
    return when {
        card.closed -> CardWords(
            title = stringResource(R.string.application_closed_title, approver),
            body = stringResource(R.string.application_closed_body, approver),
            label = stringResource(R.string.application_ask_someone),
            caption = stringResource(R.string.application_ask_someone_caption),
        )
        surface == ApplicationSurface.FEED -> CardWords(
            title = stringResource(R.string.application_waiting_feed_title, approver),
            body = stringResource(R.string.application_waiting_feed_body),
            label = stringResource(R.string.application_your_ask_link),
            caption = stringResource(R.string.application_waiting_feed_caption),
        )
        else -> CardWords(
            title = stringResource(R.string.application_waiting_profile_title, approver),
            body = stringResource(R.string.application_waiting_profile_body),
            label = stringResource(R.string.application_your_ask_link),
            caption = stringResource(R.string.application_waiting_profile_caption),
        )
    }
}

@Composable
fun ApplicationCard(
    card: ApplicationCardState,
    surface: ApplicationSurface,
    askUrl: String,
    onCopy: () -> Unit,
    onPutAway: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val words = cardWords(card, surface)
    val base = DataNode("${surface.path}.application")
    // The profile's card is a chip-drawn duplicate on its board, keyed by state.
    val node = if (surface == ApplicationSurface.PROFILE) base.keyed(if (card.closed) "closed" else "waiting") else base
    // `TaskCard` (ApplicantWaiting.jsx, ApplicantRejected.jsx): the task ring
    // around the card's ground — the feed card's tone while waiting, the
    // account-notice olive once closed, every ink then the panel's own.
    val colors = MaterialTheme.colorScheme
    val ground = if (card.closed) colors.tertiaryContainer else colors.surfaceContainerHighest
    val ink = if (card.closed) colors.onTertiaryContainer else colors.onSurface
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .clip(MaterialTheme.shapes.medium)
            .background(ground)
            .taskRing(taskRingColors(), MaterialTheme.shapes.medium)
            // The ring's 2dp stands inside the card's own 16 (`--ring-task-width`).
            .padding(Space.x4 + 2.dp),
    ) {
        CardTitle(words.title, ink, mark = if (card.closed) ink else colors.primary, node = base / "title")
        Text(
            text = words.body,
            style = MaterialTheme.typography.bodyMedium,
            color = if (card.closed) ink else colors.onSurfaceVariant,
            modifier = Modifier.dataNode(base / "body"),
        )
        AddressCard(
            address = askUrl,
            label = words.label,
            copyLabel = stringResource(R.string.application_copy_ask_link),
            onCopy = onCopy,
            caption = words.caption,
            bare = true,
            ink = if (card.closed) ink else null,
            node = base / "link",
        )
        // Only the feed's waiting card is put away (ApplicantWaiting.md:15; ProfileApplicant.md:14).
        if (!card.closed && surface == ApplicationSurface.FEED) {
            CograButton(
                text = stringResource(R.string.application_got_it),
                onClick = onPutAway,
                kind = ButtonKind.Outlined,
                testTag = (base / "dismiss").tag,
            )
        }
    }
}

/** The title, and the mark in the trailing seat (`TaskCard`). */
@Composable
private fun CardTitle(title: String, ink: Color, mark: Color, node: DataNode) {
    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Space.x3)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = ink,
            modifier = Modifier
                .weight(1f)
                .dataNode(node),
        )
        CograMark(size = 20.dp, tint = mark)
    }
}

/**
 * Where the card stands in the applicant's stack: the closed card whatever
 * the steps; the waiting card on the feed once every owed step is done and
 * it was not put away here (ApplicantWaiting.md:3), on the profile whenever
 * the application is open (ProfileApplicant.md:5).
 */
@Composable
internal fun ApplicationCardSlot(state: HomeUiState, stepsDone: Boolean, actions: ApplicationCardActions) {
    val card = cardOf(state.application) ?: return
    val feed = actions.surface == ApplicationSurface.FEED
    // The waiting card waits for every owed step, and stays away once put away here.
    val waitingHidden = !stepsDone || state.cardPutAway
    if (!card.closed && feed && waitingHidden) return
    val url = actions.askUrl(card.askLink)
    ApplicationCard(
        card = card,
        surface = actions.surface,
        askUrl = url,
        onCopy = { actions.onCopy(url) },
        onPutAway = actions.onPutAway,
    )
}
