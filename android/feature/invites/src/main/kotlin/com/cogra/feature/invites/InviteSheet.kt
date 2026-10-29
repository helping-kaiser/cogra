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
// THE REGISTERED SHEETS (design round 23): the create stage wears
// `invites.createSheet`, the fresh link `invites.linkSheet`, the chooser
// `invites.expirySheet`, its rows keyed by the length as printed, lowercased.

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
import com.cogra.core.designsystem.dataNode
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

internal val CREATE_SHEET = DataNode("invites.createSheet")
internal val LINK_SHEET = DataNode("invites.linkSheet")
internal val EXPIRY_SHEET = DataNode("invites.expirySheet")

/** The chooser row's registered key: the length as its row prints it, lowercased, runs of other characters one `-`. */
internal val ExpiryChoice.key: String
    get() = when (this) {
        ExpiryChoice.HOURS_24 -> "24-hours"
        ExpiryChoice.DAYS_7 -> "7-days"
        ExpiryChoice.DAYS_30 -> "30-days"
    }

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
        val created = sheet.created
        val surface = if (created == null) CREATE_SHEET else LINK_SHEET
        CograSheetSurface(testTag = surface.tag, handleTestTag = (surface / "dragHandle").tag, gap = Space.x4) {
            if (created == null) {
                CreateStage(sheet, actions)
            } else {
                CreatedStage(created, joinUrl(created), now, actions)
            }
        }
    }
    if (sheet.choosing) {
        CograSheetHost(onDismissRequest = actions.onCloseExpiry) {
            CograSheetSurface(
                testTag = EXPIRY_SHEET.tag,
                handleTestTag = (EXPIRY_SHEET / "dragHandle").tag,
                stacked = true,
            ) {
                SheetTitle(
                    text = stringResource(R.string.invites_expires_after),
                    modifier = Modifier.dataNode(EXPIRY_SHEET / "title"),
                )
                Column {
                    ExpiryChoice.entries.forEach { choice ->
                        SettingsRow(
                            label = choice.words(),
                            kind = SettingsRowKind.Choice(selected = choice == sheet.expiry),
                            onClick = { actions.onPickExpiry(choice) },
                            node = (EXPIRY_SHEET / "expiryOption").keyed(choice.key),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CreateStage(sheet: InviteSheetState, actions: SheetActions) {
    SheetTitle(
        text = stringResource(R.string.invites_new),
        modifier = Modifier.fillMaxWidth().dataNode(CREATE_SHEET / "title"),
    )
    SettingsGroup(
        rows = listOf(
            {
                SettingsRow(
                    label = stringResource(R.string.invites_only_one),
                    kind = SettingsRowKind.Switch(sheet.singleUse),
                    onClick = { actions.onSingleUseChange(!sheet.singleUse) },
                    node = CREATE_SHEET / "options" / "singleUse",
                )
            },
            {
                SettingsRow(
                    label = stringResource(R.string.invites_expires_after),
                    kind = SettingsRowKind.Opens,
                    value = sheet.expiry.words(),
                    onClick = actions.onOpenExpiry,
                    node = CREATE_SHEET / "options" / "expiry",
                )
            },
        ),
        footnote = stringResource(R.string.invites_footnote),
        node = CREATE_SHEET / "options",
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
            testTag = (CREATE_SHEET / "create").tag,
        )
    }
}

@Composable
private fun CreatedStage(created: InviteLinkInfo, url: String, now: Instant, actions: SheetActions) {
    SheetTitle(
        text = stringResource(R.string.invites_your_link),
        modifier = Modifier.fillMaxWidth().dataNode(LINK_SHEET / "title"),
    )
    Column(verticalArrangement = Arrangement.spacedBy(Space.x3)) {
        AddressCard(
            address = url,
            label = linkLabel(created),
            copyLabel = stringResource(R.string.invites_copy_link),
            onCopy = { actions.onCopy(url) },
            caption = linkCaption(created, now),
            node = LINK_SHEET / "link",
        )
        CograButton(
            text = stringResource(R.string.invites_share_link),
            onClick = { actions.onShare(url) },
            modifier = Modifier.fillMaxWidth(),
            testTag = (LINK_SHEET / "share").tag,
        )
    }
}
