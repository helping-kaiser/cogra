package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.delay

/**
 * How long a commit may go unanswered before its label swaps to the
 * present participle (copy-voice *Commits that wait*; seam 044 K4.3):
 * never within it, so a fast answer never flickers.
 */
const val PARTICIPLE_DELAY_MS = 200L

/**
 * True once [inFlight] has stood for [PARTICIPLE_DELAY_MS] — the one
 * clock every "…ing" swap on these surfaces reads, so none of them shows
 * a spinner and none swaps early.
 */
@Composable
fun rememberParticiple(inFlight: Boolean): Boolean {
    var past by remember { mutableStateOf(false) }
    LaunchedEffect(inFlight) {
        past = false
        if (inFlight) {
            delay(PARTICIPLE_DELAY_MS)
            past = true
        }
    }
    return inFlight && past
}

/**
 * A COMMIT WAITING ON ITS FIELDS (`_shared.jsx` `WaitingCommit`, readme §4
 * *Interaction states*): while [waiting], the commit stands where it always
 * stands, disabled at the 38%, with one quiet line right above it saying
 * what it waits for. The first character in the last empty field wakes it
 * and the line goes.
 *
 * A form's own fault — no answer, a spent budget, a change that ran out —
 * stands in the same column above the commit ([fault], `SignInError`'s
 * slot: `bodyMedium` in the failure voice, announced), the fields keeping
 * what was typed and the commit being the retry.
 *
 * While [inFlight] the commit refuses a second press and never dims; past
 * [PARTICIPLE_DELAY_MS] its label reads [inFlightLabel].
 */
@Composable
fun WaitingCommit(
    label: String,
    reason: String,
    waiting: Boolean,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
    inFlight: Boolean = false,
    inFlightLabel: String = label,
    fault: String? = null,
    faultTestTag: String? = null,
    node: DataNode? = null,
) {
    val participle = rememberParticiple(inFlight)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (waiting) {
            Text(
                text = reason,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .dataNode(node?.div("reason")),
            )
        }
        if (fault != null) {
            Text(
                text = fault,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .then(if (faultTestTag != null) Modifier.testTag(faultTestTag) else Modifier),
            )
        }
        CograButton(
            text = if (participle) inFlightLabel else label,
            onClick = { if (!inFlight) onCommit() },
            enabled = !waiting,
            modifier = Modifier
                .fillMaxWidth()
                .dataNode(node?.div("action")),
        )
    }
}
