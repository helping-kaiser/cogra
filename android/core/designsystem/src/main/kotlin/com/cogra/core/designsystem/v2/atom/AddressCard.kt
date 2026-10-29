// THE LONG-OPAQUE-STRING CARD (design/components/wallet/PayoutAddress.jsx,
// `PayoutAddress`): a string no reader can check by eye, held whole — mono,
// wrapped, never truncated — with its label, a copy control and at most one
// inline word beside the label, and a quiet caption under it. The invite
// link (`Invites`, `InviteCreated`) and the applicant's ask link
// (`ApplicantWaiting`, `ApplicantRejected`, `ProfileApplicant`) wear the same
// card, each passing its own words. web's twin is
// `web/src/lib/ui2/address-card.tsx`.
//
// `bare` DROPS THE CONTAINER AND KEEPS THE ANATOMY: for the string held
// inside something that already frames it (the applicant's ask link inside
// its task card) — the fill and the inset go; the label, the copy control,
// the mono block and the caption are unchanged.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space

@Composable
fun AddressCard(
    address: String,
    label: String,
    /** The copy control's only name — it carries no word on screen. */
    copyLabel: String,
    modifier: Modifier = Modifier,
    onCopy: (() -> Unit)? = null,
    action: AddressAction? = null,
    caption: String? = null,
    bare: Boolean = false,
    /** The card's ink where it stands on a tonal panel; null reads the page's roles. */
    ink: Color? = null,
    /** The registered card: its label, copy, action, address and caption are parts. */
    node: DataNode? = null,
    testTag: String? = null,
) {
    val quiet = ink ?: MaterialTheme.colorScheme.onSurfaceVariant
    val strong = ink ?: MaterialTheme.colorScheme.onSurface
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = modifier
            .fillMaxWidth()
            .then(if (node != null) Modifier.dataNode(node) else Modifier.optionalTag(testTag))
            .then(if (bare) Modifier else Modifier.addressGround()),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = quiet,
                modifier = Modifier
                    .weight(1f)
                    .dataNode(node?.div("label")),
            )
            if (onCopy != null) {
                val tag = node?.let { Modifier.dataNode(it / "copy") }
                    ?: Modifier.optionalTag(testTag?.let { "${it}_copy" })
                CopyControl(onCopy, copyLabel, quiet, tag)
            }
            if (action != null) ActionWord(action, node?.div("action"), testTag?.let { "${it}_action" })
        }
        Text(
            text = address,
            style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
            color = strong,
            modifier = Modifier.dataNode(node?.div("address")),
        )
        if (caption != null) {
            // The master sets label-small's size, leading and tracking only —
            // the weight is the ground's (PayoutAddress.jsx), never the role's 500.
            Text(
                text = caption,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Normal),
                color = quiet,
                // A block at the card's width, as the master's span stands in its column.
                modifier = Modifier
                    .fillMaxWidth()
                    .dataNode(node?.div("caption")),
            )
        }
    }
}

/** The card's own ground: the card fill at the medium rung, `12 16` inside. */
@Composable
private fun Modifier.addressGround(): Modifier = this
    .clip(RoundedCornerShape(12.dp))
    .background(MaterialTheme.colorScheme.surfaceContainerHighest)
    .padding(horizontal = Space.x4, vertical = Space.x3)

/** 32dp of ink answering at 48 (`cg-hit`), without growing the row. */
@Composable
private fun CopyControl(onCopy: () -> Unit, copyLabel: String, tint: Color, tag: Modifier) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onCopy)
                    .semantics { contentDescription = copyLabel },
                drawnWidth = COPY_SIZE,
                drawnHeight = COPY_SIZE,
            )
            .size(COPY_SIZE),
    ) {
        // The tag names the drawn 32 — its own layout node — not the 48 it answers at.
        Box(contentAlignment = Alignment.Center, modifier = Modifier.matchParentSize().then(tag)) {
            Icon(
                imageVector = Icons.Outlined.ContentCopy,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

/** The one inline word: inert from the press, its participle past 200ms, never dimmed. */
@Composable
private fun ActionWord(action: AddressAction, node: DataNode?, testTag: String?) {
    val slow = rememberParticiple(action.inFlight)
    InlineAction(
        text = if (slow && action.busyLabel != null) action.busyLabel else action.label,
        onClick = { if (!action.inFlight) action.onClick() },
        size = InlineSize.Large,
        node = node,
        testTag = testTag,
    )
}

private val COPY_SIZE = 32.dp

private fun Modifier.optionalTag(tag: String?): Modifier = if (tag != null) testTag(tag) else this
