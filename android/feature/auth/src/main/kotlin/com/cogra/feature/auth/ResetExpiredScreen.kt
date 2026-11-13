// ResetExpired (design/designs/canonical/ResetExpired.dc.html,
// behavior/ResetExpired.md; copy-voice "A spent or expired reset link"):
// what a used or timed-out reset link opens, `VerifyExpired`'s construction.

package com.cogra.feature.auth

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Space

/** ResetExpired's registered prefix (`nodes.json` `ResetExpired` → `reset`). */
private val RESET = DataNode("reset")

@Composable
fun ResetExpiredRoute(
    /** Reset your password: Reset opens with its field empty (ResetExpired.md:15). */
    onReset: () -> Unit,
    /** Sign in: SignIn opens (:17). */
    onSignIn: () -> Unit,
    /** System Back: the platform leaves to wherever the mail link was opened from (:21). */
    onLeave: () -> Unit,
) {
    BackHandler(onBack = onLeave)
    ResetExpiredScreen(onReset = onReset, onSignIn = onSignIn)
}

/**
 * ONE SCREEN FOR A USED AND AN EXPIRED LINK, never saying which and never
 * whose (ResetExpired.md:3-9): no header, no back arrow, no mark — a mail
 * link has no previous screen of ours — the blessed heading and paragraph,
 * and the pair following the words, `Reset your password` outlined over a
 * plain `Sign in`.
 */
@Composable
fun ResetExpiredScreen(onReset: () -> Unit, onSignIn: () -> Unit) {
    Scaffold(modifier = Modifier.dataNodeSurface()) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
        ) {
            Text(
                text = stringResource(R.string.reset_expired_title),
                style = MaterialTheme.typography.headlineSmall,
                // The board's `<h1>` is a block: its node spans the column.
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { heading() }
                    .dataNode(RESET / "title"),
            )
            Text(
                text = stringResource(R.string.reset_expired_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .dataNode(RESET / "body"),
            )
            Spacer(Modifier.height(24.dp))
            // THE DRAWN 40dp PAIR STAYS THE LAYOUT'S (`cg-hit`, readme §10), as
            // `WaitingCommit` keeps it: Material would reserve 48dp per button in
            // layout and stand the pair 16dp taller than its board; the 48dp
            // target stays Compose's pointer input's.
            CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides Dp.Unspecified) {
                Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
                    CograButton(
                        text = stringResource(R.string.reset_expired_again),
                        onClick = onReset,
                        kind = ButtonKind.Outlined,
                        modifier = Modifier
                            .fillMaxWidth()
                            .dataNode(RESET / "again"),
                    )
                    CograButton(
                        text = stringResource(R.string.reset_expired_sign_in),
                        onClick = onSignIn,
                        kind = ButtonKind.Text,
                        modifier = Modifier
                            .fillMaxWidth()
                            .dataNode(RESET / "onward"),
                    )
                }
            }
        }
    }
}
