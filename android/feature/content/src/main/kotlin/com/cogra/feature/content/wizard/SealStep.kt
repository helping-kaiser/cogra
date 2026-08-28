package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.SettingRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.SummaryRow
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.domain.LicenseChoice

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
) {
    Text(
        text = "${state.sealSummary}.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("wizard_seal_summary"),
    )

    ActBlock(state)

    Column(Modifier.fillMaxWidth()) {
        SettingRow(
            label = "License",
            value = state.license.sealLabel(),
            actionText = "Change",
            onAction = { onOpenSheet(SealSheet.License) },
            testTag = "wizard_seal_license",
        )
        SettingRow(
            label = "Where you stand on it",
            value = "+%.2f".format(state.pDirected),
            actionText = "Adjust",
            onAction = { onOpenSheet(SealSheet.Stance) },
            testTag = "wizard_seal_stance",
        )
        // No `Sensitive` row: see [SealSheet]. The contract carries no
        // author self-mark, and a row reading "Not marked" would
        // promise a control that does not exist.
        Hairline()
    }

    Spacer(Modifier.weight(1f))

    if (state.keyAbsent) {
        KeyAbsentCard(onRestoreKey = onRestoreKey, onKeepDraft = onKeepDraft)
    } else {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
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
private fun ActBlock(state: ComposeWizardState) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x4, vertical = Space.x1)
            .testTag("wizard_seal_acts"),
    ) {
        ActRow(kind = "Post", detail = state.sealSummary, acts = 1)
        if (state.tagSection.tags.isNotEmpty()) {
            Hairline()
            ActRow(
                kind = "Topics",
                detail = state.tagSection.tags.joinToString(" ") { "#${it.name}" },
                acts = state.tagSection.tags.size,
            )
        }
        if (state.referenceSection.references.isNotEmpty()) {
            Hairline()
            ActRow(
                kind = "References",
                detail = "${state.referenceSection.references.size} cited",
                acts = state.referenceSection.references.size,
            )
        }
        Hairline()
        SummaryRow(
            headline = "${state.signedActionCount} signed actions",
            detail = "they land together, or none does",
            testTag = "wizard_seal_total",
        )
    }
}

@Composable
private fun ActRow(kind: String, detail: String, acts: Int) {
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
        Text(
            text = if (acts == 1) "1 action" else "$acts actions",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * `ComposeKeyAbsent` — this device holds no actor key, so nothing can
 * be signed here.
 *
 * The wording follows the board with one honest change: the board says
 * "browser", and this is the app. The draft is already kept by the time
 * this shows, so "keep the draft, restore later" is a statement of what
 * happened rather than a promise.
 */
@Composable
private fun KeyAbsentCard(onRestoreKey: () -> Unit, onKeepDraft: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(Space.x4)
            .testTag("wizard_key_absent"),
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
            testTag = "wizard_restore_key",
        )
        CograButton(
            text = "Keep the draft, restore later",
            onClick = onKeepDraft,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = "wizard_keep_draft",
        )
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
) {
    CograSheetSurface(testTag = "wizard_license_sheet") {
        SheetTitle("License")
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
    Degree(0.5, "Credit commercially", "Commercial uses credit you."),
    Degree(1.0, "Credit always", "Every use credits you."),
)

private val RECORD = listOf(
    Degree(0.0, "No record", "Uses go unlogged."),
    Degree(0.5, "Record commercially", "Commercial uses are logged."),
    Degree(1.0, "Record always", "Every use is logged publicly."),
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
 * **A named divergence.** The board draws the full stance pad, the
 * bloomed two-axis control `feature:stance` owns. That component reads
 * a *stance toward a target* — a record with its own standing, its own
 * severance quote, its own repository — and this value is none of
 * those: it is `pDirected` on the Publish input, a field of the record
 * being authored, with `pInterest` census-fixed at 1 for a Publish. So
 * this is one labelled slider, the same shape `TagParameterSliders`
 * already uses for a record's own parameters, and the pad is left to
 * the surface it belongs to.
 */
@Composable
internal fun StanceSheet(
    pDirected: Double,
    onChange: (Double) -> Unit,
    onDone: () -> Unit,
    onCancel: () -> Unit,
) {
    CograSheetSurface(testTag = "wizard_stance_sheet") {
        SheetTitle("Where you stand on it")
        Text(
            text = "Your own post always reaches you in full.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        val reading = "+%.2f".format(pDirected)
        Text(
            text = "Your pick: $reading",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Slider(
            value = pDirected.toFloat(),
            onValueChange = { onChange(it.toDouble()) },
            valueRange = -1f..1f,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("wizard_stance_slider")
                .semantics {
                    contentDescription = "Where you stand on this post"
                    stateDescription = reading
                },
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Space.x2, Alignment.End),
        ) {
            CograButton("Cancel", onCancel, kind = ButtonKind.Text, testTag = "wizard_stance_cancel")
            CograButton("Set", onDone, testTag = "wizard_stance_set")
        }
    }
}

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
        LicenseSheet(LicenseChoice.PublicDomain, {}, {})
    }
}

@ThemePreviews
@Composable
private fun StanceSheetPreview() {
    Cogra2PreviewTheme {
        StanceSheet(pDirected = 0.1, onChange = {}, onDone = {}, onCancel = {})
    }
}
