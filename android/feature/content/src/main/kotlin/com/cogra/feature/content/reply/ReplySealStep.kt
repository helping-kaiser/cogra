package com.cogra.feature.content.reply

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.StanceFieldLabels
import com.cogra.core.designsystem.StancePadField
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.compose.UploadStatusLine
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.wizard.sealLabel

/**
 * `ReplySeal` — every act the reply signs, with its cost, before a
 * single signature.
 *
 * The same shape the post's seal takes, at comment scale: the act block
 * names what the batch carries, the rows under it are what the seal
 * still lets the author change, and the two pills commit or step back.
 *
 * **The "Sensitive · Mark" row is deliberately absent** (jakob
 * 2026-09-01). `graph.json` carries it as `ReplySeal` edge 8, and it is
 * the one thing on this board that does not ship: no board draws a
 * veiled *comment*, so the row would be a switch whose result nothing
 * renders. `design/backlog.md` item 25 part 4 names this lane as the one
 * it blocks. `PrepareCommentInput.sensitive` keeps its default and this
 * screen never sets it, so nothing about the contract changes when the
 * veiled comment is drawn and the row arrives.
 */
@Composable
internal fun ColumnScope.ReplySealStepBody(
    state: ReplyWizardState,
    onOpenSheet: (ReplySealSheet) -> Unit,
    onAddTopic: () -> Unit,
    onCite: () -> Unit,
    onSign: () -> Unit,
    onBack: () -> Unit,
    onRestoreKey: () -> Unit,
    onLeave: () -> Unit,
) {
    Text(
        text = "${state.sealSummary}.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("reply_seal_summary"),
    )

    ReplyActBlock(state = state, onAddTopic = onAddTopic, onCite = onCite)

    Column(Modifier.fillMaxWidth()) {
        // "Toward what you answer" — a reply's parameters are a stance
        // toward the thing it answers, which is why this row's Adjust
        // opens the two-axis pad rather than the post seal's slider.
        SettingRow(
            label = "Toward what you answer",
            value = stancePair(state.pDirected, state.pInterest),
            actionText = "Adjust",
            onAction = { onOpenSheet(ReplySealSheet.Stance) },
            testTag = "reply_seal_stance",
        )
        SettingRow(
            label = "License",
            value = state.license.sealLabel(),
            actionText = "Change",
            onAction = { onOpenSheet(ReplySealSheet.License) },
            testTag = "reply_seal_license",
        )
        Hairline()
    }

    Spacer(Modifier.weight(1f))

    if (state.keyAbsent) {
        ReplyKeyAbsentCard(onRestoreKey = onRestoreKey, onLeave = onLeave)
    } else {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            // `ComposeSealUploading`: while this shows, the sign button is
            // held — nothing signs until the pictures it signs exist.
            if (state.hasPictures && !state.uploadsComplete) {
                UploadStatusLine(
                    done = state.uploadsDone,
                    total = state.picked.size,
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "reply_seal_uploading",
                )
            }
            CograButton(
                text = "Sign comment",
                onClick = onSign,
                enabled = state.canSign,
                modifier = Modifier.fillMaxWidth(),
                testTag = "reply_sign",
            )
            CograButton(
                text = "Back",
                onClick = onBack,
                kind = ButtonKind.Text,
                modifier = Modifier.fillMaxWidth(),
                testTag = "reply_seal_back",
            )
        }
    }
}

/**
 * The act block: the comment, its topics, its citations, and the total.
 *
 * The board draws the two declaring rows as **offers** while nothing is
 * declared — "+ Add a topic … 1 more action" — so the price of the
 * gesture is known before it is made, and as plain rows once something
 * is. A gallery adds no row either way: attaching media mints nothing,
 * which is why the board reads "1 signed action" beside two pictures.
 */
@Composable
private fun ReplyActBlock(
    state: ReplyWizardState,
    onAddTopic: () -> Unit,
    onCite: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x4, vertical = Space.x1)
            .testTag("reply_seal_acts"),
    ) {
        ActRow(
            kind = "Comment",
            detail = state.target?.actLabel.orEmpty(),
            trailing = "1 action",
        )
        Hairline()
        val tags = state.tagSection.tags
        if (tags.isEmpty()) {
            OfferRow(
                text = "+ Add a topic",
                onClick = onAddTopic,
                testTag = "reply_seal_add_topic",
            )
        } else {
            ActRow(
                kind = "Topics",
                detail = tags.joinToString(" ") { "#${it.name}" },
                trailing = if (tags.size == 1) "1 action" else "${tags.size} actions",
            )
        }
        Hairline()
        val references = state.referenceSection.references
        if (references.isEmpty()) {
            OfferRow(
                text = "+ Cite something — a post, a person, a comment, an item",
                onClick = onCite,
                testTag = "reply_seal_cite",
            )
        } else {
            ActRow(
                kind = "References",
                detail = "${references.size} cited",
                trailing = if (references.size == 1) "1 action" else "${references.size} actions",
            )
        }
        Hairline()
        val acts = state.signedActionCount
        SummaryRow(
            headline = if (acts == 1) "1 signed action" else "$acts signed actions",
            // The all-or-nothing subline rides the total only where more
            // than one act is committed — on a single-act seal there is
            // nothing for it to be true of (design/readme.md §13).
            detail = "they land together, or none does".takeIf { acts > 1 },
            testTag = "reply_seal_total",
        )
    }
}

@Composable
private fun ActRow(kind: String, detail: String, trailing: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = kind,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(ACT_LABEL_WIDTH),
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = trailing,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** A row that is still an offer: the gesture, and what it would cost. */
@Composable
private fun OfferRow(text: String, onClick: () -> Unit, testTag: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        InlineAction(
            text = text,
            onClick = onClick,
            modifier = Modifier.weight(1f),
            testTag = testTag,
        )
        Text(
            text = "1 more action",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * `ComposeKeyAbsent` at comment scale.
 *
 * The post's card offers "Keep the draft, restore later"; a comment has
 * no draft to keep (jakob 2026-09-01), so the second pill says only what
 * it does. Promising a draft that is not written would be worse than the
 * plainer word.
 */
@Composable
private fun ReplyKeyAbsentCard(onRestoreKey: () -> Unit, onLeave: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(Space.x4)
            .testTag("reply_key_absent"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Text(
            text = "Your key isn't on this device",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onTertiaryContainer,
        )
        CograButton(
            text = "Restore the key",
            onClick = onRestoreKey,
            modifier = Modifier.fillMaxWidth(),
            testTag = "reply_restore_key",
        )
        CograButton(
            text = "Leave",
            onClick = onLeave,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = "reply_key_absent_leave",
        )
    }
}

/**
 * `ReplyPad` — where the author stands on what they are answering.
 *
 * **This is the pad, not the post seal's slider.** `ComposePad` is a
 * documented divergence because a post's `pDirected` is a field of the
 * record being authored rather than a stance toward anything. A reply's
 * two parameters are exactly a stance toward the thing it answers, so
 * the board draws the real two-axis field and this draws the same one
 * the stance control does — the edges carrying the board's own words,
 * because the seal has no anchors row to learn the axes from.
 */
@Composable
internal fun ReplyPadSheet(
    target: ReplyTarget?,
    pDirected: Double,
    pInterest: Double,
    onChange: (Double, Double) -> Unit,
    onSet: () -> Unit,
    onCancel: () -> Unit,
    onHelp: () -> Unit,
) {
    CograSheetSurface(testTag = "reply_pad_sheet") {
        SheetTitle(
            text = "Toward \"${target?.title.orEmpty()}\"",
            onHelp = onHelp,
            helpContentDescription = "How stances work",
        )
        Text(
            text = stancePair(pDirected, pInterest),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.testTag("reply_pad_reading"),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            StancePadField(
                pick = StancePoint(pDirected, pInterest),
                onPick = { onChange(it.directed, it.interest) },
                labels = PAD_LABELS,
                testTag = "reply_pad_field",
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton("Cancel", onCancel, kind = ButtonKind.Text, testTag = "reply_pad_cancel")
            CograButton("Set", onSet, testTag = "reply_pad_set")
        }
    }
}

/** The pair the seal and the pad both read, as the boards write it. */
private fun stancePair(directed: Double, interest: Double): String =
    "%+.2f / %+.2f".format(directed, interest)

private val PAD_LABELS = StanceFieldLabels(
    start = "Against",
    end = "For",
    top = "More",
    bottom = "Less",
)

/** The act block's label column, read off `ReplySeal`. */
private val ACT_LABEL_WIDTH = 76.dp
