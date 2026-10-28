package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.AttachmentReadout
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograReadoutChip
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.HouseSwitch
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SLOW_SIGNING_MS
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.atom.rememberWaitedPast
import com.cogra.core.designsystem.v2.compose.AttributionTiers
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.LicenseAxis
import com.cogra.core.designsystem.v2.compose.LicenseAxisLabel
import com.cogra.core.designsystem.v2.compose.ProvenanceTiers
import com.cogra.core.designsystem.v2.compose.UploadGateFailedLine
import com.cogra.core.designsystem.v2.compose.UploadMedia
import com.cogra.core.designsystem.v2.compose.UploadStatusLine
import com.cogra.core.designsystem.v2.compose.licenseSummary
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.domain.LicenseChoice
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.content.MAX_SENSITIVE_REASON_CHARS
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.feature.content.BackingPad
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.stagedName

/**
 * `ComposeSeal` — every act with its cost, before a single signature
 * (`_shared.jsx` `ComposeSealBody`): the quiet read-back line, the acts card,
 * the three facts the seal still lets the author change, and the foot.
 *
 * THE FOOT IS WHAT BECAME OF THE COMMIT (the failure pack): at rest the
 * commit and Back (`SealFooter`), with the upload gate over them while the
 * pictures go up; the key's notice where the key is elsewhere
 * (`ComposeKeyAbsent`); and in the commit's place the fault a press came back
 * with ([SealFault]).
 *
 * WHILE IT SIGNS THE SEAL HOLDS THE READER (SealSigning.md): past 200ms the
 * commit reads `Signing and publishing…`, inert and never dimmed; past 5s the
 * acts card's subline says the network is slow. Both clocks count from the
 * press, a wait for uploads included.
 */
@Composable
internal fun ColumnScope.SealStage(state: ComposeWizardState, actions: SealActions) {
    val participle = rememberParticiple(state.pressed)
    val slow = rememberWaitedPast(state.pressed, SLOW_SIGNING_MS)
    // THE READ-BACK SCROLLS, THE FOOT STAYS (the crop stage's arrangement):
    // the board fits its 844 exactly, which is no promise about a short
    // phone, and a commit below the fold is not one. Where the seal fits,
    // this is the board — the foot 16 under the facts, 24 over the edge.
    WizardBody(gap = Space.x4, bottom = 0.dp, scrollable = true) {
        SealReadBack(state = state, slow = slow, actions = actions)
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = Space.x6, end = Space.x6, top = Space.x4, bottom = Space.x6),
        verticalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        SealFoot(state = state, participle = participle, actions = actions)
    }
}

/** What the seal reads back: the quiet line, the acts card and the facts. */
@Composable
private fun ColumnScope.SealReadBack(state: ComposeWizardState, slow: Boolean, actions: SealActions) {
    QuietNote(text = "${state.sealSummary}.", modifier = Modifier.testTag("wizard_seal_summary"))

    ActsCard(state = state, slow = slow, onOpenSheet = actions.onOpenSheet, onRemoveRefused = actions.onRemoveRefused)

    Column(Modifier.fillMaxWidth()) {
        SettingRow(
            label = "License",
            value = state.license.sealLabel(),
            actionText = "Change",
            onAction = { actions.onOpenSheet(SealSheet.License) },
            testTag = "wizard_seal_license",
        )
        // Key absent: everything the signature would commit is still read
        // back, but the license is the only term left changeable — the
        // board draws one row (ComposeKeyAbsent.jsx:47).
        if (!state.keyAbsent) {
            // `Your backing` — ONE NUMBER, never a pair (ComposeSeal.md;
            // jakob 2026-10-16, PR-101): the post's own record is a Publish
            // whose one free parameter is the author's backing. It rides the
            // post's own record and adds nothing to the total.
            SettingRow(
                label = "Your backing",
                actionText = "Adjust",
                onAction = { actions.onOpenSheet(SealSheet.Stance) },
                testTag = "wizard_seal_stance",
            ) {
                AttachmentReadout(pDirected = state.pDirected, testTag = "wizard_seal_stance_value")
            }
            // The author's own mark, with no control that clears it here:
            // `Change` opens the sheet, where the switch is.
            SettingRow(
                label = "Sensitive",
                value = if (state.sensitive) "Marked" else "Not marked",
                actionText = if (state.sensitive) "Change" else "Mark",
                onAction = { actions.onOpenSheet(SealSheet.Sensitive) },
                testTag = "wizard_seal_sensitive",
            )
        }
        Hairline()
    }
}

/** The seal's foot, by what became of the commit (`ComposeSealBody`'s `state`). */
@Composable
private fun SealFoot(state: ComposeWizardState, participle: Boolean, actions: SealActions) {
    val fault = state.fault
    when {
        state.keyAbsent -> KeyAbsentFoot(actions)
        fault == SealFault.WriteRule -> WriteRuleFoot(actions)
        fault == SealFault.Bug -> BugFoot(actions)
        fault == SealFault.Offline -> OfflineFoot(actions)
        else -> RestingFoot(state, participle, actions)
    }
}

/**
 * `ComposeKeyAbsent`'s foot: `NoticePanel` with its own "?" by the stopper
 * exception and the restore in the panel's `inverse`, then the way out that
 * keeps the draft.
 */
@Composable
private fun KeyAbsentFoot(actions: SealActions) {
    NoticePanel(
        title = "Your key isn't in this app",
        helpLabel = HelpTopic.Key.title,
        onHelp = { actions.onHelp(HelpTopic.Key) },
        helpTestTag = "wizard_key_help",
        testTag = "wizard_key_absent",
    ) {
        CograButton(
            text = "Restore the key",
            onClick = actions.onRestoreKey,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_restore_key",
        )
    }
    WideText("Keep the draft, restore later", actions.onKeepDraft, "wizard_keep_draft")
}

/** The write rule's notice: a rule working as meant, never the error colour and never Retry. */
@Composable
private fun WriteRuleFoot(actions: SealActions) {
    NoticePanel(
        title = WRITE_RULE_TITLE,
        helpLabel = HelpTopic.WhySigningWaits.title,
        onHelp = { actions.onHelp(HelpTopic.WhySigningWaits) },
        helpTestTag = "wizard_write_rule_help",
        testTag = "wizard_write_rule",
    ) { NoticeLine(WRITE_RULE_FACT) }
    WideText("Keep the draft, sign later", actions.onKeepDraft, "wizard_sign_later")
}

/** `SealFaultBug`: the system telling on itself — the tertiary panel, no row marked. */
@Composable
private fun BugFoot(actions: SealActions) {
    NoticePanel(title = SEAL_BUG_TITLE, testTag = "wizard_seal_bug") {
        NoticeLine(SEAL_BUG_FACT)
        CograButton(
            text = "Try again",
            onClick = actions.onSign,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_try_again",
        )
    }
    Column(Modifier.fillMaxWidth()) {
        // The report page Settings opens is not built on android (HAND TO
        // FABLE): the word stands where the board draws it.
        WideText("Report a problem", actions.onReport, "wizard_report")
        WideText("Discard the post", actions.onDiscardPost, "wizard_discard_post")
    }
}

/** No answer reached the seal: `TransportError`'s line over an outlined Retry and the same way back. */
@Composable
private fun OfflineFoot(actions: SealActions) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        Text(
            text = SEAL_OFFLINE_LINE,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier
                .testTag("wizard_seal_offline")
                .semantics { liveRegion = LiveRegionMode.Assertive },
        )
        CograButton(
            text = "Retry",
            onClick = actions.onSign,
            kind = ButtonKind.Outlined,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_retry",
        )
        WideText("Back", actions.onBack, "wizard_seal_back")
    }
}

/** The seal at rest or signing: the upload gate over `SealFooter` — the commit, filled and first, and Back. */
@Composable
private fun RestingFoot(state: ComposeWizardState, participle: Boolean, actions: SealActions) {
    UploadGate(state, actions.onRetryUploads)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        CograButton(
            text = if (participle) "Signing and publishing…" else "Sign and publish",
            // Inert from the press and never dimmed: it refuses a second
            // press until the signing answers.
            onClick = { if (!state.pressed) actions.onSign() },
            enabled = state.signEnabled,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_sign",
        )
        WideText("Back", actions.onBack, "wizard_seal_back")
    }
}

/**
 * `ComposeSealUploading`: while the uploads run, `Uploading N of M — signing
 * waits for the pictures.` (`the video` for a clip); once one has failed, the
 * gate's fault reading with Retry. `picked.isNotEmpty()` keeps it from ever
 * drawing "Uploading 0 of 0" for an emptied media-mode batch.
 */
@Composable
private fun UploadGate(state: ComposeWizardState, onRetryUploads: () -> Unit) {
    if (state.mode != BodyMode.Media || state.picked.isEmpty()) return
    val media = if (state.isVideoPost) UploadMedia.Video else UploadMedia.Pictures
    when {
        state.uploadsFailed -> UploadGateFailedLine(
            onRetry = onRetryUploads,
            media = media,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_seal_upload_failed",
        )
        !state.uploadsComplete -> UploadStatusLine(
            done = state.uploadsDone,
            total = state.picked.size,
            media = media,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_seal_uploading",
        )
        else -> Unit
    }
}

/** A full-width text button — a seal's way back or way out. */
@Composable
private fun WideText(text: String, onClick: () -> Unit, testTag: String) {
    CograButton(
        text = text,
        onClick = onClick,
        kind = ButtonKind.Text,
        modifier = Modifier.fillMaxWidth(),
        testTag = testTag,
    )
}

/** How many tag chips the seal's Tags row holds before it counts (`_shared.jsx` `TAGS_ROW_HOLDS`). */
private const val TAGS_ROW_HOLDS = 2

/**
 * `ActsCard` — the container-highest card listing what one signature commits:
 * one row per act kind (quiet label · value · count, a hairline under each,
 * at least 44 tall), the total as its footer, and under the total the
 * all-or-nothing line on a seal that signs more than one act — or, past 5s
 * of signing, the slow line in the olive ink, announced once as a status.
 *
 * A gallery adds no row: attaching media mints nothing, so a ten-picture
 * post is still one Publish.
 */
@Composable
private fun ActsCard(
    state: ComposeWizardState,
    slow: Boolean,
    onOpenSheet: (SealSheet) -> Unit,
    onRemoveRefused: (String) -> Unit,
) {
    val references = state.referenceSection.references
    val refused = (state.fault as? SealFault.Row)?.targetId?.let { id -> references.firstOrNull { it.targetId == id } }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("wizard_seal_acts")
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x4, vertical = Space.x1),
    ) {
        ActRow(label = "Post", count = 1, noun = "post") { ActValue(state.title.ifBlank { state.sealSummary }) }
        TagsActRow(state.tagSection.tags.map { it.name }, onOpenSheet)
        // THE REFERENCES ROW IN ITS READINGS (jakob 2026-09-14): one citation
        // reads back as itself, name over its pair; two or more as `N cited`
        // with the row a door to the citations sheet. A refused citation is
        // said under the row in the failure voice with `Remove it`
        // (SealFaultRow.md).
        val fault = refused?.let { RowFault(unlandedLine(it), it) }
        if (references.size == 1) {
            val one = references.first()
            ActRow(
                label = "References",
                count = 1,
                noun = "citation",
                fault = fault,
                onRemoveRefused = onRemoveRefused,
            ) {
                Column(Modifier.padding(vertical = 6.dp)) {
                    ActValue(stagedName(one.target))
                    CitedReadout(StancePoint(one.relevance, one.support))
                }
            }
        } else if (references.size > 1) {
            val n = references.size
            ActRow(
                label = "References",
                count = n,
                noun = "citation",
                door = Door("Manage the $n citations", "wizard_seal_cited") { onOpenSheet(SealSheet.Cited) },
                fault = fault,
                onRemoveRefused = onRemoveRefused,
            ) { ActValue("$n cited") }
        }
        ActsTotal(acts = state.signedActionCount, slow = slow)
    }
}

/**
 * THE TAGS ROW IN ITS TWO READINGS (jakob 2026-09-15): the chips while they
 * fit, past that `N tags` and the row a door to the tags sheet.
 */
@Composable
private fun TagsActRow(tags: List<String>, onOpenSheet: (SealSheet) -> Unit) {
    if (tags.size in 1..TAGS_ROW_HOLDS) {
        ActRow(label = "Tags", count = tags.size, noun = "tag") {
            Row(
                modifier = Modifier.clipToBounds(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                tags.forEach { CograReadoutChip(label = "#$it") }
            }
        }
    } else if (tags.size > TAGS_ROW_HOLDS) {
        ActRow(
            label = "Tags",
            count = tags.size,
            noun = "tag",
            door = Door("Manage the ${tags.size} tags", "wizard_seal_tags") { onOpenSheet(SealSheet.Tags) },
        ) { ActValue("${tags.size} tags") }
    }
}

/** A counting row's door: the whole row is the control, named with its count. */
private class Door(val name: String, val testTag: String, val onOpen: () -> Unit)

/** A refused citation's line under its row: the failure voice, and `Remove it` naming it. */
private class RowFault(val message: String, val row: ReferenceRow)

/** The refused-file line's sentence, by what the citation points at (copy-voice, *Faults by code*). */
internal fun unlandedLine(row: ReferenceRow): String {
    val target = row.target
    return if (target is ReferenceTargetView.Content && target.kind == ReferenceContentKind.COMMENT) {
        SEAL_UNLANDED_COMMENT
    } else {
        SEAL_UNLANDED_POST
    }
}

@Composable
private fun ActRow(
    label: String,
    count: Int,
    noun: String,
    door: Door? = null,
    fault: RowFault? = null,
    onRemoveRefused: (String) -> Unit = {},
    value: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (door == null) {
                        Modifier
                    } else {
                        // The door's name REPLACES what it names (`ActsCard.jsx`
                        // `aria-label`): the count rides inside it.
                        Modifier
                            .testTag(door.testTag)
                            .clickable(role = Role.Button, onClick = door.onOpen)
                            .clearAndSetSemantics {
                                contentDescription = door.name
                                role = Role.Button
                                onClick {
                                    door.onOpen()
                                    true
                                }
                            }
                    },
                )
                .defaultMinSize(minHeight = ACT_ROW_MIN),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(ACT_LABEL),
            )
            Column(Modifier.weight(1f)) { value() }
            ActsCount(count = count, noun = noun)
        }
        if (fault != null) RefusedLine(fault, onRemoveRefused)
        Hairline()
    }
}

/**
 * A refused citation's line under its row (`ActsCard`'s `fault`, the
 * refused-file line): the fact in the failure voice, then `Remove it` — named
 * for the citation it removes, the only place a counted row names it.
 */
@Composable
private fun RefusedLine(fault: RowFault, onRemoveRefused: (String) -> Unit) {
    Row(
        modifier = Modifier
            .padding(start = ACT_LABEL + Space.x2, bottom = Space.x2)
            .testTag("wizard_seal_refused")
            .semantics { liveRegion = LiveRegionMode.Assertive },
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = fault.message,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f, fill = false),
        )
        InlineAction(
            text = "Remove it",
            onClick = { onRemoveRefused(fault.row.targetId) },
            size = InlineSize.Small,
            contentDescription = "Remove ${stagedName(fault.row.target)}",
            testTag = "wizard_seal_refused_remove",
        )
    }
}

/** A fact's value: `body-medium`, one line, an ellipsis where it runs past the card. */
@Composable
private fun ActValue(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

/**
 * The total and its subline (`ActsCard.jsx`'s footer row): `N things, signed
 * together` (`1 thing, signed` at one) in body-medium at label-large's weight,
 * then `They land together, or none does.` on a multi-act seal — the slow
 * line in its place past 5s, olive, a polite status.
 */
@Composable
private fun ActsTotal(acts: Int, slow: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 48.dp)
            .padding(vertical = 6.dp)
            .testTag("wizard_seal_total"),
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        Text(
            text = if (acts == 1) "1 thing, signed" else "$acts things, signed together",
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = MaterialTheme.typography.labelLarge.fontWeight,
            ),
            color = MaterialTheme.colorScheme.onSurface,
        )
        val note = when {
            slow -> SEAL_SLOW_LINE
            acts > 1 -> "They land together, or none does."
            else -> null
        }
        if (note != null) {
            Text(
                text = note,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = if (slow) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .testTag(if (slow) "wizard_seal_slow" else "wizard_seal_note")
                    .then(if (slow) Modifier.semantics { liveRegion = LiveRegionMode.Polite } else Modifier),
            )
        }
    }
}

/**
 * THE COUNT IS SEEN BARE AND HEARD WHOLE (jakob's ruling 2026-09-14, design
 * backlog item 73; `ActsCard.jsx`): the digit is what the board draws, and its
 * node answers with the whole reading — this platform's `SR_ONLY`. The noun
 * comes from the row, never from its label.
 */
internal fun actsCountReading(count: Int, noun: String): String =
    if (count == 1) "$count $noun" else "$count ${noun}s"

@Composable
private fun ActsCount(count: Int, noun: String) {
    val spoken = actsCountReading(count, noun)
    Text(
        text = "$count",
        // `ActsCard.jsx` COUNT: label-small's size, leading and tracking, at
        // the ground's weight.
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.semantics { contentDescription = spoken },
    )
}

/**
 * A staged citation's reading on the seal (`StanceReadout`'s `ReadoutLine`):
 * the face at body-medium, then the pair, spoken whole — the line the
 * backing row's readout draws, with both numbers.
 */
@Composable
private fun CitedReadout(pick: StancePoint) {
    val face = bundleReadout(pick, EMPTY_PICK_LABEL).emoji
    val pair = pick.pair()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "$face $pair" },
    ) {
        Text(text = face, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.clearAndSetSemantics { })
        Text(
            text = pair,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            modifier = Modifier.clearAndSetSemantics { },
        )
    }
}

/** `ActsCard.jsx` ROW's 44px floor. */
private val ACT_ROW_MIN = 44.dp

/** `ActsCard.jsx` LABEL's 76px column. */
private val ACT_LABEL = 76.dp

/**
 * `ComposeSensitive` — the author's own mark, and the reason that rides the
 * veil with it. **One sheet for every surface that marks** (the post seal,
 * the reply seal, both edits; ruling 42); only [testTagPrefix] varies.
 *
 * IT STAGES, AND `Done` COMMITS (the sheet law; ComposeSensitive.md): the
 * switch and the reason are this sheet's own until Done hands both to the
 * host; the scrim, a swipe down and system Back close it with nothing
 * applied. It opens ON (jakob 2026-10-01): the `Mark` that opened it was the
 * intent. Switched off, the reason keeps its words but disables — the
 * contract refuses a reason without the mark.
 *
 * Over the cap, `Done` stays visible and goes inert, never hidden.
 */
@Composable
internal fun SensitiveSheet(
    marked: Boolean,
    reason: String,
    onMarkedChange: (Boolean) -> Unit,
    onReasonChange: (String) -> Unit,
    onDone: () -> Unit,
    onHelp: () -> Unit,
    testTagPrefix: String = "wizard",
    /** Whether the sheet opens with the switch on — the `Mark` that opened it was the intent. */
    opensOn: Boolean = true,
) {
    var staged by remember { mutableStateOf(marked || opensOn) }
    var stagedReason by remember { mutableStateOf(reason) }
    val tooLong = staged && isSensitiveReasonTooLong(stagedReason)
    CograSheetSurface(testTag = "${testTagPrefix}_sensitive_sheet", gap = 0.dp) {
        SheetTitle(
            text = "Mark as sensitive",
            trailing = {
                HelpDot(onHelp = onHelp, contentDescription = "Sensitive", testTag = "${testTagPrefix}_sensitive_help")
                // `Switch` from `SettingsRow.jsx` (`HouseSwitch`), the box around it the control.
                Box(
                    modifier = Modifier
                        .toggleable(value = staged, role = Role.Switch, onValueChange = { staged = it })
                        .semantics { contentDescription = "Mark as sensitive" }
                        .testTag("${testTagPrefix}_sensitive_switch"),
                ) { HouseSwitch(checked = staged) }
            },
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f, fill = false)
                .padding(top = Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            Text(
                text = "Veils the pictures and the words until a reader chooses to look.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            // ONE LINE TO START, AND IT GROWS (jakob 2026-09-22), up to the
            // room the sheet's own chrome leaves, then it scrolls inside itself.
            CograTextField(
                value = stagedReason,
                onValueChange = { stagedReason = it },
                label = "Why?",
                optional = true,
                optionalLabel = "Optional — shown on the veil",
                singleLine = false,
                minLines = 1,
                growToFit = true,
                modifier = Modifier.weight(1f, fill = false),
                enabled = staged,
                cap = MAX_SENSITIVE_REASON_CHARS,
                error = if (tooLong) stringResource(R.string.content_error_sensitive_reason_too_long) else null,
                testTag = "${testTagPrefix}_sensitive_reason",
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                CograButton(
                    "Done",
                    {
                        onMarkedChange(staged)
                        if (staged) onReasonChange(stagedReason)
                        onDone()
                    },
                    enabled = !tooLong,
                    testTag = "${testTagPrefix}_sensitive_done",
                )
            }
        }
    }
}

/**
 * `ComposeLicense` — the terms anyone reusing this is bound by, as two axes of
 * three readings (`LicenseAxis`, the same rows the account default's sheet
 * draws). THE RADIOS STAGE, AND `Done` COMMITS (the sheet law;
 * ComposeLicense.md): a tap changes the sheet and nothing else; the scrim, a
 * swipe down and system Back discard, and the post's terms are what they
 * were. The foot reads the staged pair in the sentence the seal's row reads.
 */
@Composable
internal fun LicenseSheet(
    license: LicenseChoice,
    onDone: (LicenseChoice) -> Unit,
    onHelp: () -> Unit,
) {
    var staged by remember { mutableStateOf(license) }
    CograSheetSurface(testTag = "wizard_license_sheet", gap = 0.dp) {
        SheetTitle(
            text = "License",
            trailing = { HelpDot(onHelp = onHelp, contentDescription = "License", testTag = "wizard_license_help") },
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            QuietNote(text = "Terms for anyone who reuses this.")
            LicenseAxisLabel(text = "Credit")
            LicenseAxis(
                tiers = AttributionTiers,
                chosen = staged.attribution,
                onChoose = { staged = staged.copy(attribution = it) },
                modifier = Modifier.testTag("wizard_license_credit"),
            )
            LicenseAxisLabel(text = "Public record of use")
            LicenseAxis(
                tiers = ProvenanceTiers,
                chosen = staged.provenance,
                onChoose = { staged = staged.copy(provenance = it) },
                modifier = Modifier.testTag("wizard_license_record"),
            )
            Column {
                Hairline()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Space.x2),
                ) {
                    Text(
                        text = staged.sealLabel(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    CograButton("Done", { onDone(staged) }, testTag = "wizard_license_done")
                }
            }
        }
    }
}

/**
 * `ComposePad` — the backing pad over the seal ([BackingPad], round 15). A new
 * post has nothing standing yet, so the pick is the result and `Your pick`
 * reads alone. It parks over the page; the caller owns the wash and the
 * parking.
 */
@Composable
internal fun ComposePad(
    pDirected: Double,
    onChange: (Double) -> Unit,
    onSet: () -> Unit,
    onCancel: () -> Unit,
    onHelp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackingPad(
        pick = pDirected,
        onPickChange = onChange,
        onSet = onSet,
        onCancel = onCancel,
        onHelp = onHelp,
        testTagPrefix = "wizard_stance",
        modifier = modifier,
    )
}

/**
 * The seal's reading of a license: the author's reading of the pair by
 * copy-voice's one joining rule (`licenseSummary`, the license block) — the
 * same sentence the license sheets' foot and the settings default read.
 */
internal fun LicenseChoice.sealLabel(): String = licenseSummary(attribution, provenance)

@ThemePreviews
@Composable
private fun LicenseSheetPreview() {
    Cogra2PreviewTheme {
        LicenseSheet(LicenseChoice.PublicDomain, {}, {})
    }
}

@ThemePreviews
@Composable
private fun ComposePadPreview() {
    Cogra2PreviewTheme {
        ComposePad(pDirected = 0.1, onChange = {}, onSet = {}, onCancel = {}, onHelp = {})
    }
}
