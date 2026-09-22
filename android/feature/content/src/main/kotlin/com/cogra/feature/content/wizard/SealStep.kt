package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.ValenceField
import com.cogra.core.designsystem.nearestStanceAnchor
import com.cogra.core.designsystem.nearestValenceAnchor
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograReadoutChip
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.UploadStatusLine
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.valenceExact
import com.cogra.core.designsystem.valenceReading
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.MAX_SENSITIVE_REASON_CHARS
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.feature.content.R
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.referenceLabel

/**
 * `ComposeSeal` — every act with its cost, before a single signature.
 *
 * The block at the top names what the batch carries, one row per kind,
 * each with its act count; the rows below it are the settings the seal
 * still lets the author change; and the two pills at the bottom are the
 * one committing action and the way back.
 *
 * `ComposeKeyAbsent` is this same screen with the sign pill replaced by
 * the restore card — it is a state of the seal, not a separate stage.
 */
@Composable
internal fun ColumnScope.SealStepBody(
    state: ComposeWizardState,
    onOpenSheet: (SealSheet) -> Unit,
    onSign: () -> Unit,
    onBack: () -> Unit,
    onRestoreKey: () -> Unit,
    onKeepDraft: () -> Unit,
    onKeyHelp: () -> Unit,
) {
    Text(
        text = "${state.sealSummary}.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("wizard_seal_summary"),
    )

    ActBlock(state = state, onOpenSheet = onOpenSheet)

    Column(Modifier.fillMaxWidth()) {
        SettingRow(
            label = "License",
            value = state.license.sealLabel(),
            actionText = "Change",
            onAction = { onOpenSheet(SealSheet.License) },
            testTag = "wizard_seal_license",
        )
        // Key absent: everything the signature would commit is still read
        // back, but the license is the only term left changeable — the
        // board draws one row (ComposeKeyAbsent.jsx:47).
        if (!state.keyAbsent) {
            SettingRow(
                label = "Where you stand on it",
                // ONE NUMBER, not a pair (jakob's ruling, 2026-09-14): the
                // second is census-fixed at 1 rather than picked — "your own
                // post always reaches you in full" — so reading a pair back
                // shows the author a figure nobody chose. The face is the
                // one-axis table's, built for exactly this reading.
                value = ownStanceRowReading(state.pDirected),
                actionText = "Adjust",
                onAction = { onOpenSheet(SealSheet.Stance) },
                testTag = "wizard_seal_stance",
            )
            // The author's own mark. The row says where it stands and the
            // sheet is where it is set — the same shape License and the
            // stance pad take, so the seal reads as one list of choices.
            SettingRow(
                label = "Sensitive",
                value = if (state.sensitive) "Marked" else "Not marked",
                actionText = if (state.sensitive) "Change" else "Mark",
                onAction = { onOpenSheet(SealSheet.Sensitive) },
                testTag = "wizard_seal_sensitive",
            )
        }
        Hairline()
    }

    Spacer(Modifier.weight(1f))

    if (state.keyAbsent) {
        // The keep-draft way out is a SIBLING below the panel, full width —
        // not nested inside it (ComposeKeyAbsent.jsx:62).
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            KeyAbsentPanel(onRestoreKey = onRestoreKey, onKeyHelp = onKeyHelp)
            CograButton(
                text = "Keep the draft, restore later",
                onClick = onKeepDraft,
                kind = ButtonKind.Text,
                modifier = Modifier.fillMaxWidth(),
                testTag = "wizard_keep_draft",
            )
        }
    } else {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            // `ComposeSealUploading`: while this shows, the sign button is
            // disabled — nothing signs until the content it signs exists.
            if (state.mode == BodyMode.Media && !state.uploadsComplete) {
                UploadStatusLine(
                    done = state.uploadsDone,
                    total = state.picked.size,
                    modifier = Modifier.fillMaxWidth(),
                    testTag = "wizard_seal_uploading",
                )
            }
            CograButton(
                text = "Sign and publish",
                onClick = onSign,
                enabled = state.canSign,
                modifier = Modifier.fillMaxWidth(),
                testTag = "wizard_sign",
            )
            CograButton(
                text = "Back",
                onClick = onBack,
                kind = ButtonKind.Text,
                modifier = Modifier.fillMaxWidth(),
                testTag = "wizard_seal_back",
            )
        }
    }
}

/**
 * The act block: the post, its topics, its citations, and the total —
 * "they land together, or none does".
 *
 * A gallery adds no row: attaching media mints nothing, so a
 * ten-picture post is still one Publish (api-spec.md
 * `PrepareContentPayload`). Saying otherwise here would price a
 * gesture that costs nothing.
 */
@Composable
private fun ActBlock(state: ComposeWizardState, onOpenSheet: (SealSheet) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x4, vertical = Space.x1)
            .testTag("wizard_seal_acts"),
    ) {
        ActRow(kind = "Post", detail = state.sealSummary, acts = 1, countNoun = "post")
        if (state.tagSection.tags.isNotEmpty()) {
            Hairline()
            TagsActRow(tags = state.tagSection.tags.map { it.name })
        }
        // THE REFERENCES ROW IN ITS THREE READINGS (jakob's rulings
        // 2026-09-14, design backlog item 70): nothing staged draws no row,
        // ONE reads back as itself, TWO OR MORE read back as their count with
        // the whole row a door to the sheet that lists them
        // (`_shared.jsx:864-889`).
        val references = state.referenceSection.references
        if (references.size == 1) {
            Hairline()
            ReferenceActRow(reference = references.first())
        } else if (references.size > 1) {
            Hairline()
            CitedDoorRow(
                count = references.size,
                onOpen = { onOpenSheet(SealSheet.Cited) },
                testTag = "wizard_seal_cited",
            )
        }
        Hairline()
        val acts = state.signedActionCount
        SummaryRow(
            headline = if (acts == 1) "1 signed action" else "$acts signed actions",
            // The all-or-nothing subline rides the total **whenever the
            // seal commits more than one act**, and is omitted on a
            // single-act seal, where there is nothing for it to be true of
            // (design/readme.md §13, the healed seal drift).
            detail = "they land together, or none does".takeIf { acts > 1 },
            testTag = "wizard_seal_total",
        )
    }
}

/**
 * THE COUNT IS SEEN BARE AND HEARD WHOLE (jakob's ruling 2026-09-14, design
 * backlog item 73; `ActsCard.jsx:27-39`).
 *
 * The digit is what the board draws: the word form spent the row's width on a
 * noun the label column already says, and what it spent came out of the value
 * slot. But a trailing "3" is unambiguous only to an eye that has the label on
 * the same line, and nothing at all to an ear that gets the number alone — so
 * the digit's node answers with the whole reading instead, which is this
 * platform's `SR_ONLY`.
 *
 * THE NOUN COMES FROM THE ROW, never from its label: the References row counts
 * CITATIONS, and no rule derives that word from "References". A count already
 * made of words ("1 more") keeps them and says itself.
 */
internal fun actsCountReading(count: Int, noun: String): String =
    if (count == 1) "$count $noun" else "$count ${noun}s"

@Composable
private fun ActRow(kind: String, detail: String, acts: Int, countNoun: String) {
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
            modifier = Modifier.width(76.dp),
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        ActsCount(count = acts, noun = countNoun)
    }
}

/** The bare digit, spoken whole — see [actsCountReading]. */
@Composable
private fun ActsCount(count: Int, noun: String) {
    val spoken = actsCountReading(count, noun)
    Text(
        text = "$count",
        // CW-25: both text tokens in the acts row are label-small
        // (ActsCard.jsx:27-43, LABEL and COUNT share --text-label-small);
        // the kind label above already reads it correctly.
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.semantics { contentDescription = spoken },
    )
}

/**
 * The Tags act row: unlike [ActRow]'s plain-text value, the board
 * (`_shared.jsx:839-846`) draws each tag as a readout-tone chip — a
 * borderless `secondaryContainer` pill, not a filter — so the value slot is
 * a row of [CograReadoutChip]s rather than a joined string (CW-22).
 *
 * The board's own value wrapper is `overflow: hidden` with no `flexWrap`: a
 * single non-wrapping row that hard-clips whatever doesn't fit at the
 * container edge, not an ellipsis. [Modifier.clipToBounds] on the weighted
 * row matches that measured behaviour rather than inventing a truncation
 * rule the board doesn't draw.
 */
@Composable
private fun TagsActRow(tags: List<String>) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = "Tags",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(76.dp),
        )
        Row(
            modifier = Modifier
                .weight(1f)
                .clipToBounds(),
            // `_shared.jsx:841`'s wrapper: `gap: 6`.
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tags.forEach { name -> CograReadoutChip(label = "#$name") }
        }
        ActsCount(count = tags.size, noun = "tag")
    }
}

/**
 * The References act row at ONE staged citation: unlike [ActRow]'s
 * single-line value, the board (`_shared.jsx:943-955`) draws the citation's
 * name over its own stance readout — the staged citation carries the stance
 * that rides with it, so the row is two lines: what is cited, and what signing
 * it says about the citer.
 *
 * A seal is a read-back, and one thing read back is the thing. The threshold
 * is two, because two is where a name stops being the shortest true answer —
 * past it the row counts instead, and [CitedDoorRow] takes over.
 */
@Composable
private fun ReferenceActRow(reference: ReferenceRow) {
    val primary = reference
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = "References",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(76.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = referenceLabel(primary.target),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = stanceRowReading(StancePoint(primary.relevance, primary.support)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        ActsCount(count = 1, noun = "citation")
    }
}

/**
 * The References row once it COUNTS: "N cited", the bare count, and the whole
 * row as the control (`ActsCard.jsx:99-104`, `_shared.jsx:883-889`).
 *
 * It keeps the fact row's three slots and stays a fact row rather than
 * becoming an action row, because what it opens is what it already says. No
 * chevron and no trailing word — `PickedRow`'s rule for the picked pictures,
 * said here — so the label on the gesture is what tells a listener the line is
 * a door at all, count folded in ("Manage the N citations", and at one
 * "Manage the 1 citation" — copy-voice.md:409-419).
 *
 * THE TRAILING COUNT IS THE CITATIONS, BARE: the list's length and nothing
 * else. The signature's own total is the block's footer and already says in
 * words what it counts.
 */
@Composable
private fun CitedDoorRow(count: Int, onOpen: () -> Unit, testTag: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(
                role = Role.Button,
                onClickLabel = "Manage the $count ${if (count == 1) "citation" else "citations"}",
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
            modifier = Modifier.width(76.dp),
        )
        Text(
            text = "$count cited",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        ActsCount(count = count, noun = "citation")
    }
}

/**
 * The seal row's own reading: the face, then the pair, in the one string a
 * settings row carries — the same shape `ReplySealStep.kt`'s
 * `stanceRowReading` already reads the reply seal's own pick through.
 */
@Composable
private fun stanceRowReading(pick: StancePoint): String =
    "${nearestStanceAnchor(pick).emoji} ${pick.pair()}"

/**
 * The same row reading for a pick that names NO PAIR: the face from the
 * one-axis table and the one number the author actually set. A citation's
 * row keeps [stanceRowReading] — a stance toward somebody else's thing is
 * two choices, and both of them are drawn.
 */
private fun ownStanceRowReading(pDirected: Double): String =
    "${nearestValenceAnchor(pDirected).emoji} ${valenceExact(pDirected)}"

/**
 * `ComposeKeyAbsent` — this app holds no actor key, so nothing can be
 * signed here. The panel itself; the keep-draft way out is a sibling
 * below it ([SealStepBody]), not drawn inside — the board's own layout
 * (ComposeKeyAbsent.jsx:46-62).
 *
 * The heading carries copy-voice's platform noun ("this app", not a bare
 * "device" — copy-voice.md §Platform nouns) and its own inverse `?`,
 * opening [HelpTopic.Key]; the restore action is `Inverse`, the filled
 * button turned over on the panel's own pair rather than `primary`
 * arguing with it.
 */
@Composable
private fun KeyAbsentPanel(onRestoreKey: () -> Unit, onKeyHelp: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(Space.x4)
            .testTag("wizard_key_absent"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = "Your key isn't in this app",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                modifier = Modifier.weight(1f),
            )
            HelpDot(
                onHelp = onKeyHelp,
                contentDescription = HelpTopic.Key.title,
                tint = MaterialTheme.colorScheme.onTertiaryContainer,
                testTag = "wizard_key_help",
            )
        }
        CograButton(
            text = "Restore the key",
            onClick = onRestoreKey,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_restore_key",
        )
    }
}

/**
 * `ComposeSensitive` — the author's own mark, and the reason that rides
 * the veil with it.
 *
 * The switch sits in the title row and the heading is its label, so the
 * sheet says what it does in one line. The reason is optional and
 * public: it is shown *on* the veil, which is the only place a reader
 * meets it, so the corner says so rather than a paragraph explaining it.
 *
 * **One sheet for every surface that marks** — the post seal, the reply
 * seal, and both edit surfaces. Its line reads for both scales (ruling
 * 42: "a comment has no description to name, and a post's description
 * is words"), so a second copy would only be the place the two drift
 * apart. Only [testTagPrefix] varies, so a test can still say which
 * surface opened it.
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
) {
    CograSheetSurface(testTag = "${testTagPrefix}_sensitive_sheet") {
        SheetTitle(
            text = "Mark as sensitive",
            onHelp = onHelp,
            helpContentDescription = "Marking as sensitive",
            trailing = {
                Switch(
                    checked = marked,
                    onCheckedChange = onMarkedChange,
                    modifier = Modifier.testTag("${testTagPrefix}_sensitive_switch"),
                )
            },
        )
        Text(
            text = "Veils the pictures and the words until a reader chooses to look.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        CograTextField(
            value = reason,
            onValueChange = onReasonChange,
            label = "Why?",
            optional = true,
            optionalLabel = "Optional — shown on the veil",
            // The contract refuses a reason without the mark, so the
            // field is only live once the switch is on: offering a box
            // that would be refused is worse than not offering it.
            enabled = marked,
            cap = MAX_SENSITIVE_REASON_CHARS,
            error = if (marked && isSensitiveReasonTooLong(reason)) {
                stringResource(R.string.content_error_sensitive_reason_too_long, MAX_SENSITIVE_REASON_CHARS)
            } else {
                null
            },
            testTag = "${testTagPrefix}_sensitive_reason",
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            // Visible but disabled over the cap, never hidden — the reason
            // only counts against the cap while the mark is on, the same
            // gate its own error line above uses.
            CograButton(
                "Done",
                onDone,
                enabled = !(marked && isSensitiveReasonTooLong(reason)),
                testTag = "${testTagPrefix}_sensitive_done",
            )
        }
    }
}

/**
 * `ComposeLicense` — the terms anyone reusing this is bound by, as two
 * groups of three degrees.
 *
 * The degrees are the three CoGra publishes a reading for, and nothing
 * between them: a degree with no published reading is a term no reader
 * could check.
 */
@Composable
internal fun LicenseSheet(
    license: LicenseChoice,
    onChange: (LicenseChoice) -> Unit,
    onDone: () -> Unit,
    onHelp: () -> Unit,
) {
    CograSheetSurface(testTag = "wizard_license_sheet") {
        SheetTitle(
            text = "License",
            onHelp = onHelp,
            helpContentDescription = HelpTopic.License.title,
        )
        Text(
            text = "Terms for anyone who reuses this.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        DegreeGroup(
            heading = "Credit",
            options = CREDIT,
            selected = license.attribution,
            onSelect = { onChange(license.copy(attribution = it)) },
            tagPrefix = "wizard_license_credit",
        )
        DegreeGroup(
            heading = "Public record of use",
            options = RECORD,
            selected = license.provenance,
            onSelect = { onChange(license.copy(provenance = it)) },
            tagPrefix = "wizard_license_record",
        )
        Hairline()
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Text(
                text = license.sealLabel(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            CograButton("Done", onDone, testTag = "wizard_license_done")
        }
    }
}

private data class Degree(val value: Double, val label: String, val reading: String)

private val CREDIT = listOf(
    Degree(0.0, "No credit", "Nobody owes you a name."),
    Degree(0.5, "Credit commercially", "Commercial uses credit you; everything else is free."),
    Degree(1.0, "Credit always", "Every use credits you."),
)

private val RECORD = listOf(
    Degree(0.0, "No record", "Uses go unlogged."),
    Degree(0.5, "Record commercially", "Commercial uses are logged publicly and stay open to audit."),
    Degree(1.0, "Record always", "Every use is logged publicly and stays open to audit."),
)

@Composable
private fun DegreeGroup(
    heading: String,
    options: List<Degree>,
    selected: Double,
    onSelect: (Double) -> Unit,
    tagPrefix: String,
) {
    Text(
        text = heading,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Column(
        // A radio group is one control to assistive technology, not
        // three unrelated ones — `selectableGroup` is what says so.
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        options.forEach { degree ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = selected == degree.value,
                        role = Role.RadioButton,
                        onClick = { onSelect(degree.value) },
                    )
                    .testTag("${tagPrefix}_${(degree.value * 10).toInt()}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // The row carries the selection semantics, so the button
                // itself is decorative — otherwise a reader hears the
                // same control twice.
                RadioButton(selected = selected == degree.value, onClick = null)
                Text(
                    text = degree.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = degree.reading,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * `ComposePad` — where the author stands on their own post.
 *
 * **THE FIELD IS ONE AXIS, and that is why `StancePad` is not here.**
 * The two-axis field is the square because the square IS the value
 * space, both parameters the author's to choose. On one's own post the
 * second is not: a post always reaches its author in full, so
 * `pInterest` is census-fixed at 1 on the Publish input and a square
 * would offer a choice that is not one. What is left is a line, and
 * [ValenceField] draws it.
 *
 * **It parks over the page; it is not a drawer.** The caller owns the
 * wash and the parking (`ComposeWizardScreen`), the way the reply seal's
 * pad already works; this draws the card.
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
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(PAD_CORNER))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(Space.x4)
            .testTag("wizard_stance_pad"),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        Box(Modifier.fillMaxWidth()) {
            // The readout clears the corner the `?` sits in, so the two
            // never collide.
            Column(modifier = Modifier.padding(end = PAD_HELP_GUTTER)) {
                Text(
                    // Drawn, not spoken: the reading below says the value,
                    // and a screen reader hearing "Your pick" before every
                    // drag would hear the label more often than the number
                    // (`ComposePad.jsx:58-73`, design/backlog.md item 30).
                    text = "Your pick",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OwnStanceReading(pDirected)
            }
            HelpDot(
                onHelp = onHelp,
                contentDescription = HelpTopic.YourOpinionOnYourPost.title,
                modifier = Modifier.align(Alignment.TopEnd),
                testTag = "wizard_stance_help",
            )
        }
        ValenceField(
            value = pDirected,
            onValueChange = onChange,
            modifier = Modifier.align(Alignment.CenterHorizontally),
            testTag = "wizard_stance_field",
        )
        Text(
            text = "Your own post always reaches you in full.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton("Cancel", onCancel, kind = ButtonKind.Text, testTag = "wizard_stance_cancel")
            CograButton("Set", onSet, testTag = "wizard_stance_set")
        }
    }
}

/**
 * THE FACE AND THE ONE NUMBER, one type step apart — the board's own
 * proportion for this readout, and the same one the reply pad draws its
 * pair at.
 *
 * The face leaves the semantics tree and the readout announces the
 * band's words plus the one axis instead: an emoji's own accessible name
 * is "slightly smiling face", never "Nice" (design.md §10).
 */
@Composable
private fun OwnStanceReading(pDirected: Double) {
    val band = nearestValenceAnchor(pDirected)
    val spoken = valenceReading(pDirected)
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .testTag("wizard_stance_reading"),
    ) {
        Text(
            text = band.emoji,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Text(
            text = valenceExact(pDirected),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics { },
        )
    }
}

/** `--radius-extra-large`, the rung every parked pad and sheet wears. */
private val PAD_CORNER = 28.dp

/** What the readout leaves clear of the `?` in the corner. */
private val PAD_HELP_GUTTER = 40.dp

/**
 * The seal's reading of a license, the way the board words it — the
 * default says it is the default, so an author who never opened the
 * sheet knows where the terms came from.
 */
internal fun LicenseChoice.sealLabel(): String = when {
    this == LicenseChoice.PublicDomain -> "Public domain — your default"
    attribution >= 1.0 -> "Credit always"
    attribution > 0.0 -> "Credit commercially"
    provenance >= 1.0 -> "Record always"
    provenance > 0.0 -> "Record commercially"
    else -> "Public domain"
}

@ThemePreviews
@Composable
private fun LicenseSheetPreview() {
    Cogra2PreviewTheme {
        LicenseSheet(LicenseChoice.PublicDomain, {}, {}, {})
    }
}

@ThemePreviews
@Composable
private fun ComposePadPreview() {
    Cogra2PreviewTheme {
        ComposePad(pDirected = 0.1, onChange = {}, onSet = {}, onCancel = {}, onHelp = {})
    }
}
