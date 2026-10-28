// THE ASK LINK'S LANDING, DRAWN (VouchAsk, VouchAskPad, VouchAskInvalid,
// VouchAskUnusable). The ask carries its card and its way back and nothing
// else — no band, no bar, no feed (VouchAsk.md:9); the header's arrow reads a
// plain Back with no origin noun (:39). The two dead ends name nobody but the
// person asking and wear no error colour (VouchAskInvalid.md:5-7,
// VouchAskUnusable.md:11-13).

package com.cogra.feature.invites

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.LocalOnRestoreKey
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space

private val VOUCH_ASK = DataNode("vouchAsk")
private val ASK = VOUCH_ASK / "ask"

@Composable
fun VouchAskRoute(
    askLinkId: String,
    /** The shell's answer; null while it resolves — nothing is read before it. */
    signedIn: Boolean?,
    /** The back arrow and Not now: the state the link opened over, or the feed's root cold (:41-47). */
    onBack: () -> Unit,
    /** The reader's own case: where app-open lands for them, with [line] (:13-15). */
    onAppOpen: (line: String) -> Unit,
    onInvites: (InvitesNotice) -> Unit,
    onOpenProfile: (handle: String) -> Unit,
    /** The guest gate (:21, :37); a sign-in from it brings the ask back (:23). */
    onRequireAccount: () -> Unit,
    onRestoreKey: () -> Unit,
    viewModel: VouchAskViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val padState by viewModel.padState.collectAsStateWithLifecycle()
    LaunchedEffect(askLinkId, signedIn) {
        if (signedIn != null) viewModel.load(askLinkId, signedIn)
    }
    val exit = state.exit
    val ownLine = (exit as? AskExit.AppOpen)?.let { stringResource(it.line) }
    LaunchedEffect(exit) {
        when (exit) {
            null -> Unit
            is AskExit.AppOpen -> onAppOpen(checkNotNull(ownLine))
            is AskExit.Invites -> onInvites(exit.notice)
        }
        if (exit != null) viewModel.onExitTaken()
    }
    CompositionLocalProvider(LocalOnRestoreKey provides onRestoreKey) {
        VouchAskScreen(
            landing = state.landing,
            padState = padState,
            approvalPad = viewModel::approvalPad,
            onBack = onBack,
            onOpenProfile = onOpenProfile,
            onRequireAccount = onRequireAccount.takeIf { signedIn == false },
        )
    }
}

@Composable
fun VouchAskScreen(
    landing: AskLanding,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    padState: ApprovalPadState? = null,
    approvalPad: () -> ApprovalPad? = { null },
    onRequireAccount: (() -> Unit)? = null,
) {
    Scaffold(modifier = Modifier.dataNodeSurface()) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            // The ask itself is titled; the two dead ends' headers carry the arrow alone.
            val titled = landing is AskLanding.Ask || landing == AskLanding.Reading || landing == AskLanding.Fault
            PageHeader(
                title = if (titled) stringResource(R.string.vouch_ask_title) else null,
                onBack = onBack,
                backContentDescription = stringResource(R.string.vouch_ask_back),
                node = VOUCH_ASK / "header",
            )
            when (landing) {
                AskLanding.Reading -> Text(
                    stringResource(R.string.invites_loading),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = Space.x4).testTag("vouch_ask_loading"),
                )
                AskLanding.Fault -> ErrorLine(
                    R.string.invites_transport,
                    testTag = "vouch_ask_error",
                    modifier = Modifier.padding(horizontal = Space.x4),
                )
                // VOUCHASKINVALID: no cause named, no error colour, the back
                // arrow the only way out (VouchAskInvalid.md).
                AskLanding.Invalid -> Statement(
                    title = stringResource(R.string.vouch_ask_invalid_title),
                    body = stringResource(R.string.vouch_ask_invalid_body),
                )
                // VOUCHASKUNUSABLE: the one case the link reaches now — the
                // asker is in — and the door to their profile (:15-17).
                is AskLanding.Landed -> Statement(
                    title = stringResource(R.string.vouch_ask_landed_title, "@${landing.handle}"),
                    body = stringResource(R.string.vouch_ask_landed_body),
                ) {
                    CograButton(
                        text = stringResource(R.string.vouch_ask_profile_door, "@${landing.handle}"),
                        onClick = { onOpenProfile(landing.handle) },
                        kind = ButtonKind.Text,
                        // 24 to the pill's ink: it answers at 48, so 4 already stand inside it.
                        modifier = Modifier.padding(top = Space.x5).fillMaxWidth(),
                        testTag = (VOUCH_ASK / "profileDoor").tag,
                    )
                }
                is AskLanding.Ask -> AskCard(landing.handle, padState, approvalPad, onBack, onRequireAccount)
            }
        }
    }
}

/** The headline and paragraph of the two dead ends, in the error-free voice. */
@Composable
private fun Statement(title: String, body: String, way: (@Composable () -> Unit)? = null) {
    Column(Modifier.padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x8)) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            // The heading is a block at the column's width (an `h1`).
            modifier = Modifier
                .fillMaxWidth()
                .dataNode(VOUCH_ASK / "title"),
        )
        Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = Space.x2).dataNode(VOUCH_ASK / "body"),
        )
        way?.invoke()
    }
}

/**
 * The ask (VouchAsk.md:3-9): the person asking and nobody else, a monogram
 * and never a picture, no reason given; `Not now` and the stance affordance
 * that vouches them in, the pad closed on arrival.
 */
@Composable
private fun AskCard(
    handle: String,
    padState: ApprovalPadState?,
    approvalPad: () -> ApprovalPad?,
    onNotNow: () -> Unit,
    onRequireAccount: (() -> Unit)?,
) {
    val asker = "@$handle"
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x3),
        modifier = Modifier.padding(start = Space.x4, end = Space.x4, top = Space.x2),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x3),
            modifier = Modifier
                .fillMaxWidth()
                .dataNode(ASK)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                .padding(Space.x4),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x3),
            ) {
                CograAvatar(name = handle, size = 64.dp, testTag = (ASK / "avatar").tag)
                Text(
                    text = stringResource(R.string.vouch_ask_asking, asker),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.dataNode(ASK / "title"),
                )
            }
            Text(
                text = stringResource(R.string.vouch_ask_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(ASK / "body"),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
                modifier = Modifier.fillMaxWidth(),
            ) {
                CograButton(
                    text = stringResource(R.string.vouch_ask_not_now),
                    onClick = onNotNow,
                    kind = ButtonKind.Text,
                    testTag = (ASK / "later").tag,
                )
                val pad = approvalPad()
                if (pad != null && padState != null) {
                    ApprovalControl(
                        pad = pad,
                        state = padState,
                        handle = asker,
                        testTagPrefix = "vouch_ask",
                        node = ASK / "stance",
                        onDismiss = pad::dismiss,
                        onRequireAccount = onRequireAccount,
                    )
                }
            }
        }
    }
}
