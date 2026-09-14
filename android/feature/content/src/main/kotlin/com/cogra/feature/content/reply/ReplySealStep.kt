package com.cogra.feature.content.reply

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.feature.content.referenceLabel
import com.cogra.core.designsystem.StanceFieldLabels
import com.cogra.core.designsystem.StancePadField
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.nearestStanceAnchor
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.reading
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.compose.HelpTopic
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
 * The Sensitive row is the board's third term row (`ReplySeal` edge 8),
 * and it opens the one `ComposeSensitive` sheet the post's seal opens —
 * one sheet for every surface that marks, because a second copy is
 * where the two would silently drift apart.
 */
@Composable
internal fun ColumnScope.ReplySealStepBody(
    state: ReplyWizardState,
    onOpenSheet: (ReplySealSheet) -> Unit,
    onAddTopic: () -> Unit,
    onCite: () -> Unit,
    onRemoveReference: (String) -> Unit,
) {
    Text(
        text = "${state.sealSummary}.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("reply_seal_summary"),
    )

    ReplyActBlock(
        state = state,
        onAddTopic = onAddTopic,
        onCite = onCite,
        onOpenCited = { onOpenSheet(ReplySealSheet.Cited) },
        onRemoveReference = onRemoveReference,
    )

    Column(Modifier.fillMaxWidth()) {
        // "Toward what you answer" — a reply's parameters are a stance
        // toward the thing it answers, which is why this row's Adjust
        // opens the two-axis pad rather than the post seal's slider.
        SettingRow(
            label = "Toward what you answer",
            value = stanceRowReading(StancePoint(state.pDirected, state.pInterest)),
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
        SettingRow(
            label = "Sensitive",
            value = if (state.sensitive) "Marked" else "Not marked",
            actionText = if (state.sensitive) "Change" else "Mark",
            onAction = { onOpenSheet(ReplySealSheet.Sensitive) },
            testTag = "reply_seal_sensitive",
        )
        Hairline()
    }
}

/**
 * The seal's committing band, below the body rather than inside it.
 *
 * The reply seal carries two declaring rows the post's does not, so its
 * required controls are exactly the case `WizardBody` warns about: a
 * stage whose controls can fall below the fold scrolls, and the action
 * sits outside the scrolling column — otherwise a short screen hides
 * the only way to sign. Where the stage fits, this is the board.
 */
@Composable
internal fun ColumnScope.ReplySealActions(
    state: ReplyWizardState,
    onSign: () -> Unit,
    onBack: () -> Unit,
    onRestoreKey: () -> Unit,
    onLeave: () -> Unit,
) {
    if (state.keyAbsent) {
        ReplyKeyAbsentCard(onRestoreKey = onRestoreKey, onLeave = onLeave)
    } else {
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

/**
 * The act block: the comment, its topics, its citations, and the total.
 *
 * The board draws the two declaring rows as **offers** while nothing is
 * declared — "+ Add a topic … 1 more" — so the price of the gesture is
 * known before it is made, and as plain rows once something is. A
 * gallery adds no row either way: attaching media mints nothing, which
 * is why the board reads "1 signed action" beside two pictures.
 *
 * EVERY TRAILING COUNT IS A BARE NUMBER, as `ActsCard` draws it. The
 * word form spent the row's width on a noun the kind column already
 * says, and what it spent came out of the value slot — the drawn
 * example name ellipsised on a device.
 */
@Composable
private fun ReplyActBlock(
    state: ReplyWizardState,
    onAddTopic: () -> Unit,
    onCite: () -> Unit,
    onOpenCited: () -> Unit,
    onRemoveReference: (String) -> Unit,
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
            trailing = "1",
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
                trailing = "${tags.size}",
            )
        }
        Hairline()
        // THE SAME THREE READINGS THE POST'S SEAL TAKES (jakob's ruling
        // 2026-09-14, design backlog item 70): the rule is about citations,
        // not about which composer staged them. One reads back as itself, two
        // or more read back as their count behind a door — and the add-row
        // rides along in every state, because a comment's seal IS its details
        // stage and counting the citations takes away no way to add another
        // (`ReplyCitedMany.jsx:12-16`, `_shared.jsx:1076-1099`).
        val references = state.referenceSection.references
        if (references.size == 1) {
            ReplyCitedRow(
                // Singular: the label names the EDGE staged rather than the
                // block it sits in, and one edge is a reference
                // (`_shared.jsx:1046-1052`).
                name = referenceLabel(references.first().target),
                onRepair = onCite,
                onRemove = { onRemoveReference(references.first().targetId) },
            )
            Hairline()
        } else if (references.size > 1) {
            CitedDoorRow(
                count = references.size,
                onOpen = onOpenCited,
                testTag = "reply_seal_cited",
            )
            Hairline()
        }
        // "+ Cite something", the short form: the hand board spelled the kinds
        // out while the staged twin said the short form, so one surface said
        // two things depending on whether a reference had landed. The picker's
        // own screen is where the kinds are enumerated (`ReplySeal.jsx:14-17`).
        OfferRow(
            text = "+ Cite something",
            onClick = onCite,
            testTag = "reply_seal_cite",
        )
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

/**
 * The reply's ONE staged citation, read back as itself: the name that opens
 * the citation's pair, and the × that drops it, each naming the citation it
 * acts on (`StagedReference`'s rule, jakob 2026-09-10).
 */
@Composable
private fun ReplyCitedRow(name: String, onRepair: () -> Unit, onRemove: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x1)
            .testTag("reply_seal_cited_one"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = "Reference",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(ACT_LABEL_WIDTH),
        )
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp)
                .wrapContentHeight()
                .clickable(
                    role = Role.Button,
                    onClickLabel = "$name — set how it relates",
                    onClick = onRepair,
                )
                .testTag("reply_seal_cited_repair"),
        )
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button, onClickLabel = "Remove $name", onClick = onRemove)
                .testTag("reply_seal_cited_remove"),
        )
        Text(
            text = "1",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The References row once it COUNTS: "N cited", the bare count, and the whole
 * row as the control — the post seal's own door, said on this seal, opening
 * the one sheet both seals open (`ReplyCitedMany.jsx:17-20`). No chevron and
 * no trailing word, so the label on the gesture is what tells a listener the
 * line is a door ("Manage the citations", copy-voice).
 */
@Composable
private fun CitedDoorRow(count: Int, onOpen: () -> Unit, testTag: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(
                role = Role.Button,
                onClickLabel = "Manage the citations",
                onClick = onOpen,
            )
            .padding(vertical = Space.x2)
            .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = "References",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(ACT_LABEL_WIDTH),
        )
        Text(
            text = "$count cited",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "$count",
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
            text = "1 more",
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
            text = "Your key isn't in this app",
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
 *
 * **It parks over the page; it is not a drawer.** `ReplyPadBody`
 * (`design/designs/canonical/screens/_shared.jsx`) draws a rounded card
 * inset from both edges and sitting off the bottom, over a wash that
 * covers the seal — and design/readme.md §"Fixed elements" gives the
 * rule the whole product's pads obey: the same place every time,
 * because muscle memory is part of the control. The caller owns the
 * wash and the parking; this draws the card.
 */
@Composable
internal fun ReplyPad(
    target: ReplyTarget?,
    pDirected: Double,
    pInterest: Double,
    onChange: (Double, Double) -> Unit,
    onSet: () -> Unit,
    onCancel: () -> Unit,
    onHelp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(PAD_CORNER))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(Space.x4)
            .testTag("reply_pad"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Box(Modifier.fillMaxWidth()) {
            // The readout clears the corner the `?` sits in, so the two
            // never collide on a long title.
            Column(modifier = Modifier.padding(end = PAD_HELP_GUTTER)) {
                Text(
                    text = "Toward \"${target?.title.orEmpty()}\"",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("reply_pad_target"),
                )
                StanceReading(StancePoint(pDirected, pInterest))
            }
            HelpDot(
                onHelp = onHelp,
                contentDescription = HelpTopic.TowardWhatYouAnswer.title,
                modifier = Modifier.align(Alignment.TopEnd),
                testTag = "reply_pad_help",
            )
        }
        StancePadField(
            pick = StancePoint(pDirected, pInterest),
            onPick = { onChange(it.directed, it.interest) },
            labels = PAD_LABELS,
            testTag = "reply_pad_field",
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .width(PAD_FIELD_SIZE),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton("Cancel", onCancel, kind = ButtonKind.Text, testTag = "reply_pad_cancel")
            CograButton("Set", onSet, testTag = "reply_pad_set")
        }
    }
}

/**
 * The seal row's own reading: the face, then the pair, in the one string
 * a settings row carries (`ReplySeal`, `_shared.jsx:785`). The row's
 * announcement therefore names the emoji rather than the anchor's words
 * — the pad's readout, which is where the pick is actually made, says
 * both.
 */
@Composable
private fun stanceRowReading(pick: StancePoint): String =
    "${nearestStanceAnchor(pick).emoji} ${pick.pair()}"

/**
 * THE PAIR WITH THE FACE IT READS AS — the anchor nearest the pick, one
 * type step up, beside the numbers (`ReplyPad`, `_shared.jsx:738-745`).
 *
 * A stance is always accompanied by words (design.md §10) and the face
 * rides on top of them, so the emoji leaves the semantics tree and the
 * readout announces the anchor's words plus both axes — the same split
 * the bloomed stance control's own readout runs, off the same twenty
 * anchors, so one face means one thing across the app.
 */
@Composable
private fun StanceReading(pick: StancePoint) {
    val anchor = nearestStanceAnchor(pick)
    val words = stringResource(anchor.label)
    val spoken = pick.reading()
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        // One readout, announced once and in words: the face's own name
        // and a bare pair of numbers are both noise read aloud.
        modifier = Modifier
            .semantics(mergeDescendants = true) { contentDescription = "$words, $spoken" }
            .testTag("reply_pad_reading"),
    ) {
        // The face sits one type step above the pair, which is the
        // board's own proportion for this readout.
        Text(
            text = anchor.emoji,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Text(
            text = pick.pair(),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics { },
        )
    }
}

private val PAD_LABELS = StanceFieldLabels(
    start = "Against",
    end = "For",
    top = "More",
    bottom = "Less",
)

/** `--radius-extra-large`, the rung every parked pad and sheet wears. */
private val PAD_CORNER = 28.dp

/**
 * The field keeps the hand board's 240px square, centred, rather than
 * filling the panel: the pad is a thumb-sized instrument and the drawing
 * is the one the round inherited (`ReplyPad.jsx`).
 */
private val PAD_FIELD_SIZE = 240.dp

/** What the readout leaves clear of the `?` in the corner (`_shared.jsx`). */
private val PAD_HELP_GUTTER = 40.dp

/** The act block's label column, read off `ReplySeal`. */
private val ACT_LABEL_WIDTH = 76.dp
