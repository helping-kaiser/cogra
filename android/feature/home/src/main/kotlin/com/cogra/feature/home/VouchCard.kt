// THE VOUCH CARD (the `VouchBack` board; behavior/VouchBack.md) — the feed's
// first card, above the posts, for a landed member whose pair with the member
// who vouched them in is incomplete. The web's twin is `feed/vouch-card.tsx`.
//
// IT STANDS ON SERVER STATE ALONE (VouchBack.md:3), read by [HomeViewModel]:
// no key term and no device memory — the put-away is account state and holds
// on every device (:45).
//
// IT RIDES THE FEED ONLY: the own profile carries the banner stack but never
// this card, and the voucher's profile keeps the way open from there (:51).
//
// `Got it` IS A READ-SIDE COMFORT, so it answers at once — the card steps
// aside the moment it is pressed, silently (:37) — and a put-away that did not
// go through brings the card back with `That didn't go through.` and `Retry`
// in its row (:39, ruling 44).
//
// THE CARD'S ACT IS THE FACE (seam 157/165, VouchBack.md:11): the stance
// control's own anchor, never a button of its own. The host wears it
// (`stance`), because the stance holder lives in `feature:stance`: a tap
// blooms the vouch-back pad (:39), a hold signs the gentle default (:43), a
// taken signing opens the ceremony (VouchBackPad.md:33), and Cancel closes
// back onto this card with nothing staged (:45). One line beside it,
// `feed.vouchCard.hint`, teaches the tap and claims nothing about first-ness.

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ActorRef

/** The registered card (`feed.vouchCard`, VouchBack / VouchBackPad). */
val VOUCH_CARD: DataNode = DataNode("feed") / "vouchCard"

/**
 * The card as the feed's list wears it, bound to the shell's
 * [HomeViewModel] (the same holder the banner stack reads).
 *
 * [stance] draws the stance control's face toward the voucher, opening the
 * vouch-back pad; it is a slot because the stance holder lives in
 * `feature:stance`. [refreshSignal] is the feed's own pull, counted: each new value re-reads,
 * which is where an expired vouch-back brings the card back (:57).
 */
@Composable
fun VouchCardRoute(
    stance: @Composable (voucher: ActorRef) -> Unit,
    refreshSignal: Int = 0,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(refreshSignal) { if (refreshSignal > 0) viewModel.refresh() }
    val voucher = state.vouchVoucher
    if (state.loading || voucher == null || !state.vouchCardStands) return
    VouchCard(
        voucher = voucher,
        putAwayFailed = state.vouchPutAway == VouchPutAway.FAILED,
        onPutAway = viewModel::onPutAway,
        stance = { stance(voucher) },
    )
}

/**
 * The olive card (`VouchBackCard`): `tertiaryContainer` ground and its own
 * ink, the voucher's 64dp face beside the title, the drawn body, and the
 * row of `Got it` (a text button in the panel's ink), the one line, and the
 * stance face in the trailing seat ([stance]).
 */
@Composable
fun VouchCard(
    voucher: ActorRef,
    putAwayFailed: Boolean,
    onPutAway: () -> Unit,
    stance: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ink = MaterialTheme.colorScheme.onTertiaryContainer
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(Space.x4)
            .dataNode(VOUCH_CARD),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            CograAvatar(
                name = voucher.displayName?.takeIf { it.isNotBlank() } ?: voucher.handle,
                size = 64.dp,
                url = voucher.avatar?.url,
                testTag = (VOUCH_CARD / "avatar").tag,
            )
            Text(
                text = stringResource(R.string.vouch_card_title, voucher.handle),
                style = MaterialTheme.typography.titleMedium,
                color = ink,
                modifier = Modifier.dataNode(VOUCH_CARD / "title"),
            )
        }
        Text(
            text = stringResource(R.string.vouch_card_body, voucher.handle),
            style = MaterialTheme.typography.bodyMedium,
            color = ink,
            modifier = Modifier.dataNode(VOUCH_CARD / "body"),
        )
        VouchCardActions(putAwayFailed, onPutAway, stance)
    }
}

/** The card's row: `Got it` — or, failed, the line and `Retry` — then the hint and the face. */
@Composable
private fun VouchCardActions(putAwayFailed: Boolean, onPutAway: () -> Unit, stance: @Composable () -> Unit) {
    val ink = MaterialTheme.colorScheme.onTertiaryContainer
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (putAwayFailed) {
            // The row's own line, then Retry in Got it's slot.
            Text(
                text = stringResource(R.string.vouch_card_put_away_failed),
                style = MaterialTheme.typography.bodySmall,
                color = ink,
                modifier = Modifier
                    .weight(1f)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .testTag("feed_vouch_card_failed"),
            )
            CograButton(
                text = stringResource(R.string.vouch_card_retry),
                onClick = onPutAway,
                kind = ButtonKind.InverseText,
                testTag = "feed_vouch_card_retry",
            )
        } else {
            CograButton(
                text = stringResource(R.string.vouch_card_got_it),
                onClick = onPutAway,
                kind = ButtonKind.InverseText,
                testTag = (VOUCH_CARD / "dismiss").tag,
            )
        }
        // The line sits right against the face, which keeps the trailing seat
        // (VouchBack.md:11, :13).
        Text(
            text = stringResource(R.string.vouch_card_hint),
            style = MaterialTheme.typography.bodySmall,
            color = ink,
            textAlign = TextAlign.End,
            modifier = Modifier
                .weight(1f)
                .dataNode(VOUCH_CARD / "hint"),
        )
        stance()
    }
}
