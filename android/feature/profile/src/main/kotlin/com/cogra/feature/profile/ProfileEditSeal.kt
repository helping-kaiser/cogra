// `ProfileEditSeal` — the profile change's "What you sign" moment
// (design/designs/canonical/screens/ProfileEditSeal.jsx, behavior/ProfileEditSeal.md).
// Every profile change is a signed act, so Save opens this seal and nothing is
// signed before its own commit. web's twin is `web/src/app/profile/change-seal.tsx`.
//
// WHAT IT READS BACK: the head row (the picture the change leaves, at 64, and
// `Your profile`), one acts-card row `Profile` saying what the change holds,
// counted `1 profile change`, the total `1 thing, signed` with no
// all-or-nothing line, and under the card the public-record line (:3-:19).
//
// THE COMMIT (:33-:57): `Sign the change` refuses a second press until the
// signing answers and never dims; past 200ms it reads `Signing the change…`,
// past 5s the total's subline reads the slow line; no spinner, no progress.
// From the press Back reads `Close` and the X is named `Close`; they and the
// arrow close the seal and the change goes on (`ProfileChanges`). In the
// commit's place: the fault line and Retry where no answer reached the seal;
// the write rule's notice with `Not now`; the bug's with `Try again`,
// `Report a problem` and `Not now`.

package com.cogra.feature.profile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ActsCard
import com.cogra.core.designsystem.v2.atom.ActsCardRow
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SLOW_SIGNING_MS
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.atom.rememberWaitedPast
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space

/** The board's registered prefix (nodes.json `profileEditSeal`). */
internal val EDIT_SEAL = DataNode("profileEditSeal")

internal const val SEAL_TITLE = "What you sign"
internal const val SEAL_LEAVE = "Leave"
internal const val SEAL_CLOSE = "Close"
internal const val SEAL_BACK_A_STEP = "Back a step"
internal const val SEAL_HEAD = "Your profile"
internal const val SEAL_ROW_LABEL = "Profile"
internal const val SEAL_ROW_NOUN = "profile change"
internal const val SIGN_THE_CHANGE = "Sign the change"
internal const val SIGNING_THE_CHANGE = "Signing the change…"
internal const val SEAL_BACK = "Back"
internal const val SEAL_RETRY = "Retry"
internal const val SEAL_NOT_NOW = "Not now"
internal const val SEAL_TRY_AGAIN = "Try again"
internal const val SEAL_REPORT = "Report a problem"
internal const val PUBLIC_RECORD_LINE =
    "Every change to your profile is signed in your name and stays in your public record."

// The failure pack's words (copy-voice, *Faults by code*), the profile seal's
// clause: it keeps no draft (ProfileEditSeal.md:49, :53).
internal const val SEAL_OFFLINE_LINE = "That didn't send. Try again."
internal const val WRITE_RULE_TITLE = "You can't sign right now"
internal const val WRITE_RULE_FACT =
    "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent."
internal const val BUG_TITLE = "This shouldn't have happened"
internal const val BUG_FACT =
    "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it."

/** The header's "?" (copy-voice, *Changing your profile*, blessed jakob 2026-11-17). */
internal const val CHANGING_YOUR_PROFILE = "Changing your profile"
private val CHANGING_YOUR_PROFILE_TEXT = listOf(
    "Your profile is a public record, and changes to it are signed actions in your name.",
    "Everything you change here signs together, as one change, paid for like your posts. " +
        "The record that you changed it stays, like every signed action.",
)

/** The write rule's "?" — its second paragraph the pad's reading for a seal that keeps no draft (:53). */
private val WHY_SIGNING_WAITS_TEXT = listOf(
    HelpTopic.WhySigningWaits.paragraphs.first(),
    "Nothing was signed or spent. Try again in a little while.",
)

/** The seal's own picture, read off `ProfileEditSeal` (`MonogramAvatar size={64}`). */
private val SEAL_PICTURE = 64.dp

private enum class SealHelp { Change, WriteRule }

/** What the seal's controls do; the route wires them to the ViewModel. */
internal class EditSealActions(
    val onSign: () -> Unit,
    /** The arrow, Back, Close and the system gesture. */
    val onBack: () -> Unit,
    /** The header X. */
    val onLeave: () -> Unit,
    /** A notice's `Not now`: back to the seal at rest, or from the bug to the edit. */
    val onNotNow: () -> Unit,
    val onReport: () -> Unit = {},
)

@Composable
internal fun ProfileEditSealStage(state: ProfileEditUiState, actions: EditSealActions) {
    val participle = rememberParticiple(state.signing)
    val slow = rememberWaitedPast(state.signing, SLOW_SIGNING_MS)
    var help by remember { mutableStateOf<SealHelp?>(null) }
    BackHandler(onBack = actions.onBack)
    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .dataNodeSurface(),
    ) {
        WizardHeader(
            title = SEAL_TITLE,
            onBack = actions.onBack,
            backContentDescription = if (state.signing) SEAL_CLOSE else SEAL_BACK_A_STEP,
            onLeave = actions.onLeave,
            leaveContentDescription = if (state.signing) SEAL_CLOSE else SEAL_LEAVE,
            onHelp = { help = SealHelp.Change },
            helpContentDescription = CHANGING_YOUR_PROFILE,
            node = EDIT_SEAL / "header",
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x4),
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6),
        ) {
            SealReadBack(state, slow)
            Spacer(Modifier.weight(1f))
            SealFoot(state, participle, actions, onHelp = { help = SealHelp.WriteRule })
        }
    }
    SealHelpDialog(help, onClose = { help = null })
}

/** What the seal reads back: the head row, the acts card and the public-record line (:3-:19). */
@Composable
private fun SealReadBack(state: ProfileEditUiState, slow: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        // The picture the change leaves; the monogram where it removes it (:11).
        CograAvatar(
            name = state.displayName,
            size = SEAL_PICTURE,
            url = state.avatar.previewUrl,
            testTag = "profile_edit_seal_picture",
        )
        Text(
            text = SEAL_HEAD,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
    }
    ActsCard(
        rows = listOf(
            ActsCardRow(label = SEAL_ROW_LABEL, count = 1, noun = SEAL_ROW_NOUN) {
                // Runs on to a second line, never cut off (:13).
                Text(
                    text = state.changeSummary,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(vertical = Space.x2),
                )
            },
        ),
        slow = slow,
        node = EDIT_SEAL / "acts",
    )
    QuietNote(text = PUBLIC_RECORD_LINE, modifier = Modifier.dataNode(EDIT_SEAL / "note"))
}

/** The header's "?" and the write rule's own "?" (:31, :53). */
@Composable
private fun SealHelpDialog(help: SealHelp?, onClose: () -> Unit) {
    when (help) {
        SealHelp.Change -> HelpDialog(
            title = CHANGING_YOUR_PROFILE,
            paragraphs = CHANGING_YOUR_PROFILE_TEXT,
            onClose = onClose,
            testTag = "profile_edit_seal_help_dialog",
        )
        SealHelp.WriteRule -> HelpDialog(
            title = HelpTopic.WhySigningWaits.title,
            paragraphs = WHY_SIGNING_WAITS_TEXT,
            onClose = onClose,
            testTag = "profile_edit_seal_write_rule_dialog",
        )
        null -> Unit
    }
}

/** The foot by what became of the commit (`ProfileEditSeal.jsx`'s `state` chip, the failure pack). */
@Composable
private fun SealFoot(state: ProfileEditUiState, participle: Boolean, actions: EditSealActions, onHelp: () -> Unit) {
    when (state.fault) {
        ProfileSealFault.WriteRule -> {
            // A rule working as meant: the tertiary panel, never the error colour, never Retry (:49).
            NoticePanel(
                title = WRITE_RULE_TITLE,
                helpLabel = HelpTopic.WhySigningWaits.title,
                onHelp = onHelp,
                helpTestTag = "profile_edit_seal_write_rule_help",
                testTag = "profile_edit_seal_write_rule",
            ) { NoticeLine(WRITE_RULE_FACT) }
            FootText(SEAL_NOT_NOW, actions.onNotNow, "profile_edit_seal_not_now")
        }
        ProfileSealFault.Bug -> BugFoot(actions)
        ProfileSealFault.Offline -> OfflineFoot(actions)
        null -> RestingFoot(state, participle, actions)
    }
}

/** `SealFaultBug`: `This shouldn't have happened` with `Try again`, `Report a problem` and `Not now` (:57). */
@Composable
private fun BugFoot(actions: EditSealActions) {
    NoticePanel(title = BUG_TITLE, testTag = "profile_edit_seal_bug") {
        NoticeLine(BUG_FACT)
        CograButton(
            text = SEAL_TRY_AGAIN,
            onClick = actions.onSign,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "profile_edit_seal_try_again",
        )
    }
    Column(Modifier.fillMaxWidth()) {
        // No report surface exists on the app yet; the word stands as drawn.
        FootText(SEAL_REPORT, actions.onReport, "profile_edit_seal_report")
        FootText(SEAL_NOT_NOW, actions.onNotNow, "profile_edit_seal_not_now")
    }
}

/** No answer reached the seal: the fault line and Retry in the commit's place, and Back (:47). */
@Composable
private fun OfflineFoot(actions: EditSealActions) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        ErrorLine(SEAL_OFFLINE_LINE, testTag = "profile_edit_seal_offline")
        CograButton(
            text = SEAL_RETRY,
            onClick = actions.onSign,
            kind = ButtonKind.Outlined,
            modifier = Modifier.fillMaxWidth(),
            testTag = "profile_edit_seal_retry",
        )
        FootText(SEAL_BACK, actions.onBack, "profile_edit_seal_back")
    }
}

/** At rest or signing: `Sign the change` over Back, `Close` from the press (:33-:41, :71). */
@Composable
private fun RestingFoot(state: ProfileEditUiState, participle: Boolean, actions: EditSealActions) {
    val foot = (EDIT_SEAL / "foot").keyed(if (state.signing) "signing" else "rest")
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.fillMaxWidth().dataNode(foot),
    ) {
        CograButton(
            text = if (participle) SIGNING_THE_CHANGE else SIGN_THE_CHANGE,
            // Inert from the press, never dimmed (:33).
            onClick = { if (!state.signing) actions.onSign() },
            modifier = Modifier.fillMaxWidth(),
            testTag = (EDIT_SEAL / "foot" / "sign").tag,
        )
        // `Close` from the press itself, never dimmed (:71).
        FootText(
            if (state.signing) SEAL_CLOSE else SEAL_BACK,
            actions.onBack,
            (EDIT_SEAL / "foot" / "back").tag,
        )
    }
}

@Composable
private fun FootText(text: String, onClick: () -> Unit, testTag: String) {
    CograButton(
        text = text,
        onClick = onClick,
        kind = ButtonKind.Text,
        modifier = Modifier.fillMaxWidth(),
        testTag = testTag,
    )
}
