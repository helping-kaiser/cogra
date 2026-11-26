// THE PROFILE'S "WHAT YOU SIGN" PAGE — one drawing behind both of the
// profile's seals, `ProfileEditSeal` (the edit's fields) and `AvatarSeal` (the
// picture alone, off the head's change badge). The two boards draw the same
// page and differ only in what they read back: the head row's words, the acts
// card's one row and the header's "?" (ProfileEditSeal.jsx, AvatarSeal.jsx;
// ProfileEditSeal.md, AvatarSeal.md). web's twin is `web/src/app/profile/change-seal.tsx`.
//
// WHAT IT READS BACK: the head row (the picture at 64 and its words), one
// acts-card row counted 1, the total `1 thing, signed` with no all-or-nothing
// line, and under the card the public-record line.
//
// THE COMMIT: `Sign the change` refuses a second press until the signing
// answers and never dims; past 200ms it reads `Signing the change…`, past 5s
// the total's subline reads the slow line; no spinner, no progress. From the
// press Back reads `Close` and the X is named `Close`; they and the arrow close
// the seal and the change goes on (`ProfileChanges`). Over the foot, the upload
// gate while the new picture is on its way: running (the commit enabled, a
// press waits), failed (with Retry, the commit disabled) or refused (the fact
// alone, the commit disabled). In the commit's place: the fault line and Retry
// where no answer reached the seal; the write rule's notice with `Not now`;
// the bug's with `Try again`, `Report a problem` and `Not now`; the key-absent
// notice with `Restore the key` and `Not now`.

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
import com.cogra.core.designsystem.v2.compose.UploadGateFailedLine
import com.cogra.core.designsystem.v2.compose.UploadGateRefusedLine
import com.cogra.core.designsystem.v2.compose.UploadStatusLine
import com.cogra.core.designsystem.v2.token.Space

internal const val SEAL_TITLE = "What you sign"
internal const val SEAL_LEAVE = "Leave"
internal const val SEAL_CLOSE = "Close"
internal const val SEAL_BACK_A_STEP = "Back a step"
internal const val SIGN_THE_CHANGE = "Sign the change"
internal const val SIGNING_THE_CHANGE = "Signing the change…"
internal const val SEAL_BACK = "Back"
internal const val SEAL_RETRY = "Retry"
internal const val SEAL_NOT_NOW = "Not now"
internal const val SEAL_TRY_AGAIN = "Try again"
internal const val SEAL_REPORT = "Report a problem"
internal const val PUBLIC_RECORD_LINE =
    "Every change to your profile is signed in your name and stays in your public record."

// The failure pack's words (copy-voice, *Faults by code*), the profile seals'
// clause: they keep no draft (ProfileEditSeal.md:49, :53; AvatarSeal.md:41, :45).
internal const val SEAL_OFFLINE_LINE = "That didn't send. Try again."
internal const val WRITE_RULE_TITLE = "You can't sign right now"
internal const val WRITE_RULE_FACT =
    "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent."
internal const val KEY_ABSENT_TITLE = "Your key isn't in this app"
internal const val RESTORE_THE_KEY = "Restore the key"
internal const val BUG_TITLE = "This shouldn't have happened"
internal const val BUG_FACT =
    "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it."

/** The write rule's "?" — its second paragraph the pad's reading for a seal that keeps no draft. */
private val WHY_SIGNING_WAITS_TEXT = listOf(
    HelpTopic.WhySigningWaits.paragraphs.first(),
    "Nothing was signed or spent. Try again in a little while.",
)

/** The head row's picture, read off both boards (`MonogramAvatar size={64}`). */
internal val SEAL_PICTURE = 64.dp

/** One of the profile's seals, as its board reads it back. */
internal class ProfileSealReading(
    /** The board's registered prefix (nodes.json `profileEditSeal`, `avatarSeal`). */
    val node: DataNode,
    /** The stem of the parts nodes.json does not name. */
    val tagPrefix: String,
    /** The head row's words beside the picture. */
    val head: String,
    val rowLabel: String,
    val rowValue: String,
    /** The row's count, as an ear hears it: `1 profile change`, `1 picture`. */
    val rowNoun: String,
    /** The header's "?": its name and its dialog's text. */
    val helpTitle: String,
    val helpParagraphs: List<String>,
)

/**
 * The upload gate over the foot (AvatarSeal.md:13-23, ProfileEditSeal.md:23-29),
 * [key] the board's `state` chip value its copies are keyed by.
 */
internal enum class SealGate(val key: String) {
    Uploading("uploading"),
    Failed("upload-failed"),
    Refused("upload-refused"),
}

/** Where the seal's commit stands. */
internal class ProfileSealStatus(
    /** `Sign the change` was pressed and has not answered — a press waiting on the upload included. */
    val signing: Boolean,
    val fault: ProfileSealFault?,
    val gate: SealGate? = null,
)

/** What the seal's controls do; the route wires them to the ViewModel. */
internal class ProfileSealActions(
    val onSign: () -> Unit,
    /** The arrow, Back, Close and the system gesture. */
    val onBack: () -> Unit,
    /** The header X. */
    val onLeave: () -> Unit,
    /** A notice's `Not now`. */
    val onNotNow: () -> Unit,
    val onReport: () -> Unit = {},
    /** The key-absent notice's `Restore the key`: the app's own restore route. */
    val onRestoreKey: () -> Unit = {},
    /** The upload gate's `Retry`. */
    val onRetryUpload: () -> Unit = {},
)

private enum class SealHelp { Seal, WriteRule, Key }

@Composable
internal fun ProfileSealPage(
    reading: ProfileSealReading,
    status: ProfileSealStatus,
    actions: ProfileSealActions,
    picture: @Composable () -> Unit,
) {
    val participle = rememberParticiple(status.signing)
    val slow = rememberWaitedPast(status.signing, SLOW_SIGNING_MS)
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
            backContentDescription = if (status.signing) SEAL_CLOSE else SEAL_BACK_A_STEP,
            onLeave = actions.onLeave,
            leaveContentDescription = if (status.signing) SEAL_CLOSE else SEAL_LEAVE,
            onHelp = { help = SealHelp.Seal },
            helpContentDescription = reading.helpTitle,
            node = reading.node / "header",
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x4),
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6),
        ) {
            SealReadBack(reading, slow, picture)
            Spacer(Modifier.weight(1f))
            SealFoot(reading, status, participle, actions, onHelp = { help = it })
        }
    }
    SealHelpDialog(reading, help, onClose = { help = null })
}

/** What the seal reads back: the head row, the acts card and the public-record line. */
@Composable
private fun SealReadBack(reading: ProfileSealReading, slow: Boolean, picture: @Composable () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        picture()
        Text(
            text = reading.head,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
    }
    ActsCard(
        rows = listOf(
            ActsCardRow(label = reading.rowLabel, count = 1, noun = reading.rowNoun) {
                // Runs on to a second line, never cut off (ProfileEditSeal.md:13).
                Text(
                    text = reading.rowValue,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(vertical = Space.x2),
                )
            },
        ),
        slow = slow,
        node = reading.node / "acts",
    )
    QuietNote(text = PUBLIC_RECORD_LINE, modifier = Modifier.dataNode(reading.node / "note"))
}

/** The header's "?", the write rule's own "?" and the key's. */
@Composable
private fun SealHelpDialog(reading: ProfileSealReading, help: SealHelp?, onClose: () -> Unit) {
    when (help) {
        SealHelp.Seal -> HelpDialog(
            title = reading.helpTitle,
            paragraphs = reading.helpParagraphs,
            onClose = onClose,
            testTag = "${reading.tagPrefix}_help_dialog",
        )
        SealHelp.Key -> HelpDialog(
            title = HelpTopic.Key.title,
            paragraphs = HelpTopic.Key.paragraphs,
            onClose = onClose,
            testTag = "${reading.tagPrefix}_key_dialog",
        )
        SealHelp.WriteRule -> HelpDialog(
            title = HelpTopic.WhySigningWaits.title,
            paragraphs = WHY_SIGNING_WAITS_TEXT,
            onClose = onClose,
            testTag = "${reading.tagPrefix}_write_rule_dialog",
        )
        null -> Unit
    }
}

/** The foot by what became of the commit (the boards' `state` chip, the failure pack). */
@Composable
private fun SealFoot(
    reading: ProfileSealReading,
    status: ProfileSealStatus,
    participle: Boolean,
    actions: ProfileSealActions,
    onHelp: (SealHelp) -> Unit,
) {
    val tag = reading.tagPrefix
    when (status.fault) {
        ProfileSealFault.WriteRule -> {
            // A rule working as meant: the tertiary panel, never the error colour, never Retry.
            NoticePanel(
                title = WRITE_RULE_TITLE,
                helpLabel = HelpTopic.WhySigningWaits.title,
                onHelp = { onHelp(SealHelp.WriteRule) },
                helpTestTag = "${tag}_write_rule_help",
                testTag = "${tag}_write_rule",
            ) { NoticeLine(WRITE_RULE_FACT) }
            FootText(SEAL_NOT_NOW, actions.onNotNow, "${tag}_not_now")
        }
        ProfileSealFault.Bug -> BugFoot(tag, actions)
        ProfileSealFault.Offline -> OfflineFoot(tag, actions)
        ProfileSealFault.KeyAbsent -> KeyAbsentFoot(tag, actions, onHelp = { onHelp(SealHelp.Key) })
        null -> RestingFoot(reading, status, participle, actions)
    }
}

/** `SealFaultBug`: `This shouldn't have happened` with `Try again`, `Report a problem` and `Not now`. */
@Composable
private fun BugFoot(tag: String, actions: ProfileSealActions) {
    NoticePanel(title = BUG_TITLE, testTag = "${tag}_bug") {
        NoticeLine(BUG_FACT)
        CograButton(
            text = SEAL_TRY_AGAIN,
            onClick = actions.onSign,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "${tag}_try_again",
        )
    }
    Column(Modifier.fillMaxWidth()) {
        // No report surface exists on the app yet; the word stands as drawn.
        FootText(SEAL_REPORT, actions.onReport, "${tag}_report")
        FootText(SEAL_NOT_NOW, actions.onNotNow, "${tag}_not_now")
    }
}

/**
 * The key is not on this device (the post seal's `ComposeKeyAbsent` foot): the
 * notice with its own "?" and `Restore the key` in the panel's inverse, then
 * `Not now` back to the seal at rest. Never the error colour, and never `Keep
 * the draft, restore later` — these seals keep no draft.
 */
@Composable
private fun KeyAbsentFoot(tag: String, actions: ProfileSealActions, onHelp: () -> Unit) {
    NoticePanel(
        title = KEY_ABSENT_TITLE,
        helpLabel = HelpTopic.Key.title,
        onHelp = onHelp,
        helpTestTag = "${tag}_key_help",
        testTag = "${tag}_key_absent",
    ) {
        CograButton(
            text = RESTORE_THE_KEY,
            onClick = actions.onRestoreKey,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "${tag}_restore",
        )
    }
    FootText(SEAL_NOT_NOW, actions.onNotNow, "${tag}_not_now")
}

/** No answer reached the seal: the fault line and Retry in the commit's place, and Back. */
@Composable
private fun OfflineFoot(tag: String, actions: ProfileSealActions) {
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        ErrorLine(SEAL_OFFLINE_LINE, testTag = "${tag}_offline")
        CograButton(
            text = SEAL_RETRY,
            onClick = actions.onSign,
            kind = ButtonKind.Outlined,
            modifier = Modifier.fillMaxWidth(),
            testTag = "${tag}_retry",
        )
        FootText(SEAL_BACK, actions.onBack, "${tag}_back")
    }
}

/**
 * At rest or signing: the upload gate over `Sign the change` and Back, `Close`
 * from the press. A failed or refused upload disables the commit — never
 * hidden, never a press that waits for ever.
 */
@Composable
private fun RestingFoot(
    reading: ProfileSealReading,
    status: ProfileSealStatus,
    participle: Boolean,
    actions: ProfileSealActions,
) {
    val key = if (status.signing) "signing" else status.gate?.key ?: "rest"
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x4),
        modifier = Modifier.fillMaxWidth(),
    ) {
        UploadGate(reading.node, status.gate, actions.onRetryUpload)
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x2),
            modifier = Modifier.fillMaxWidth().dataNode((reading.node / "foot").keyed(key)),
        ) {
            CograButton(
                text = if (participle) SIGNING_THE_CHANGE else SIGN_THE_CHANGE,
                // Inert from the press, never dimmed; a press during the upload waits.
                onClick = { if (!status.signing) actions.onSign() },
                enabled = status.gate != SealGate.Failed && status.gate != SealGate.Refused,
                modifier = Modifier.fillMaxWidth(),
                testTag = (reading.node / "foot" / "sign").tag,
            )
            FootText(
                if (status.signing) SEAL_CLOSE else SEAL_BACK,
                actions.onBack,
                (reading.node / "foot" / "back").tag,
            )
        }
    }
}

/** The gate's three readings (`UploadStatusLine`), each keyed by the board's chip value. */
@Composable
private fun UploadGate(node: DataNode, gate: SealGate?, onRetry: () -> Unit) {
    val gateNode = gate?.let { (node / "gate").keyed(it.key) }
    when (gate) {
        SealGate.Uploading -> UploadStatusLine(done = 0, total = 1, modifier = Modifier.fillMaxWidth(), node = gateNode)
        SealGate.Failed -> UploadGateFailedLine(onRetry = onRetry, modifier = Modifier.fillMaxWidth(), node = gateNode)
        SealGate.Refused -> UploadGateRefusedLine(modifier = Modifier.fillMaxWidth(), node = gateNode)
        null -> Unit
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
