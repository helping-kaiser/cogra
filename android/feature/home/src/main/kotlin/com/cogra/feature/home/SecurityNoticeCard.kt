// THE SECURITY NOTICE (FeedSecurityNotice.jsx:35-44, FeedSecurityNotice.md):
// the olive task card at the top of the shell's column the sign-in lands on —
// the feed list's first row, above the applicant's cards and the vouch card —
// in words that never name the token beneath a sign-in. `Change password`
// (filled, the register's inverse) opens the credential screen and leaves the
// notice standing; `Got it` (outlined) puts it away for good. It stands until
// then, across leaving the feed and an app restart: the notice is kept in the
// account's own slot of the identity store (SecurityNotices.kt).
//
// The board is not registered in nodes.json yet: the card and its controls
// keep the test tags the shell's tests already drive.

package com.cogra.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space

@Composable
fun SecurityNoticeCardRoute(
    onChangePassword: () -> Unit,
    viewModel: SecurityNoticeCardViewModel = hiltViewModel(),
) {
    val pending by viewModel.pending.collectAsStateWithLifecycle()
    if (pending) SecurityNoticeCard(onChangePassword = onChangePassword, onGotIt = viewModel::onGotIt)
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
fun SecurityNoticeCard(onChangePassword: () -> Unit, onGotIt: () -> Unit) {
    TaskCard(
        title = stringResource(R.string.feed_security_notice_title),
        body = stringResource(R.string.feed_security_notice_body),
        // Unregistered: the web's test id, and `.title` / `.body` under it.
        node = DataNode(SECURITY_NOTICE_TAG),
    ) {
        // `display: flex; flex-wrap: wrap; gap: 8` (FeedSecurityNotice.jsx:40).
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            CograButton(
                text = stringResource(R.string.feed_security_notice_change_password),
                onClick = onChangePassword,
                kind = ButtonKind.Inverse,
                testTag = "${SECURITY_NOTICE_TAG}_change_password",
            )
            CograButton(
                text = stringResource(R.string.feed_security_notice_got_it),
                onClick = onGotIt,
                kind = ButtonKind.Outlined,
                testTag = "${SECURITY_NOTICE_TAG}_dismiss",
            )
        }
    }
}

/** The card's tag where no registered node names it (web: `security_notice`). */
const val SECURITY_NOTICE_TAG = "security_notice"
