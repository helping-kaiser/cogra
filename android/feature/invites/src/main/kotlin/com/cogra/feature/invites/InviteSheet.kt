// THE CREATE SHEET, IN ITS TWO STAGES, AND THE EXPIRY CHOOSER OVER IT
// (InviteNew, InviteCreated, InviteExpiry; behavior InviteNew.md,
// InviteCreated.md, InviteExpiry.md). web's twin is
// `web/src/app/(app)/invites/invite-sheet.tsx`.
//
// TWO DECISIONS AND NO MORE (InviteNew.md:3-5): who may use the link — the
// switch worded as the restriction, on when the sheet opens — and how long it
// lives, `7 days` when it opens. No opinion control: a link carries no stance.
// `Create invite` makes the link with the staged choices and the sheet turns
// to its second stage, the fresh link; past 200ms it reads `Creating invite…`,
// and a create that did not go through answers in the network fault's grammar
// with the choices kept (:19-23).
//
// THE FRESH LINK'S STAGE SERVES THE LINK AND NOTHING ELSE (InviteCreated.md):
// `Your invite link`, the link whole in mono with its label and caption, its
// copy control, and `Share link` — the platform's own share sheet. Closed,
// the sheet lands on Invites with the new link under Live links.
//
// THE CHOOSER STACKS OVER THE SHEET (InviteExpiry.md): three lengths, exactly
// one selected, a tap picks and closes with no Done; the scrim, a swipe or
// Back close it with the length it had.
//
// UNREGISTERED BOARDS: InviteNew, InviteCreated and InviteExpiry are not in
// nodes.json; the sheet wears the evident paths under `invites.sheet` /
// `invites.expiry` until design registers them.

package com.cogra.feature.invites

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.v2.atom.AddressCard
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.SettingsGroup
import com.cogra.core.designsystem.v2.atom.SettingsRow
import com.cogra.core.designsystem.v2.atom.SettingsRowKind
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.invites.InviteLinkInfo
import java.time.Instant

internal val SHEET = DataNode("invites.sheet")
internal val EXPIRY = DataNode("invites.expiry")

@Composable
internal fun ExpiryChoice.words(): String = stringResource(
    when (this) {
        ExpiryChoice.HOURS_24 -> R.string.invites_expiry_24_hours
        ExpiryChoice.DAYS_7 -> R.string.invites_expiry_7_days
        ExpiryChoice.DAYS_30 -> R.string.invites_expiry_30_days
    },
)

/** Callbacks the sheet raises. */
data class SheetActions(
    val onClose: () -> Unit,
    val onSingleUseChange: (Boolean) -> Unit,
    val onOpenExpiry: () -> Unit,
    val onCloseExpiry: () -> Unit,
    val onPickExpiry: (ExpiryChoice) -> Unit,
    val onCreate: () -> Unit,
    val onCopy: (String) -> Unit,
    val onShare: (String) -> Unit,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun InviteSheet(
    sheet: InviteSheetState,
    joinUrl: (InviteLinkInfo) -> String,
    now: Instant,
    actions: SheetActions,
) {
    CograSheetHost(onDismissRequest = actions.onClose) {
        CograSheetSurface(testTag = SHEET.tag, gap = Space.x4) {
            val created = sheet.created
            if (created == null) {
                CreateStage(sheet, actions)
            } else {
                CreatedStage(created, joinUrl(created), now, actions)
            }
        }
    }
    if (sheet.choosing) {
        CograSheetHost(onDismissRequest = actions.onCloseExpiry) {
            CograSheetSurface(testTag = EXPIRY.tag, stacked = true) {
                SheetTitle(text = stringResource(R.string.invites_expires_after))
                Column {
                    ExpiryChoice.entries.forEach { choice ->
                        SettingsRow(
                            label = choice.words(),
                            kind = SettingsRowKind.Choice(selected = choice == sheet.expiry),
                            onClick = { actions.onPickExpiry(choice) },
                            node = (EXPIRY / "choice").keyed(choice.name),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CreateStage(sheet: InviteSheetState, actions: SheetActions) {
    SheetTitle(text = stringResource(R.string.invites_new), modifier = Modifier.fillMaxWidth())
    SettingsGroup(
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.invites_only_one),
                    kind = SettingsRowKind.Switch(sheet.singleUse),
                    onClick = { actions.onSingleUseChange(!sheet.singleUse) },
                    node = SHEET / "singleUse",
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.invites_expires_after),
                    kind = SettingsRowKind.Opens,
                    value = sheet.expiry.words(),
                    onClick = actions.onOpenExpiry,
                    node = SHEET / "expiry",
                )
            },
        ),
        footnote = stringResource(R.string.invites_footnote),
        bare = false,
    )
    if (sheet.failed) {
        ErrorLine(R.string.invites_transport, testTag = "invites_sheet_failed")
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        val slow = rememberParticiple(sheet.creating)
        CograButton(
            text = stringResource(if (slow) R.string.invites_creating else R.string.invites_create),
            // Inert from the press, never dimmed (InviteNew.md:21).
            onClick = { if (!sheet.creating) actions.onCreate() },
            testTag = (SHEET / "create").tag,
        )
    }
}

@Composable
private fun CreatedStage(created: InviteLinkInfo, url: String, now: Instant, actions: SheetActions) {
    SheetTitle(text = stringResource(R.string.invites_your_link), modifier = Modifier.fillMaxWidth())
    Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
        AddressCard(
            address = url,
            label = linkLabel(created),
            copyLabel = stringResource(R.string.invites_copy_link),
            onCopy = { actions.onCopy(url) },
            caption = linkCaption(created, now),
            node = SHEET / "link",
        )
        CograButton(
            text = stringResource(R.string.invites_share_link),
            onClick = { actions.onShare(url) },
            modifier = Modifier.fillMaxWidth(),
            testTag = (SHEET / "share").tag,
        )
    }
}
