package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ChoiceDot

/** One published reading of a license axis (`LicenseChooser.jsx`'s tiers). */
data class LicenseTier(val value: Double, val label: String, val hint: String)

/** `ATTRIBUTION_TIERS`, verbatim (`design/components/forms/LicenseChooser.jsx`). */
val AttributionTiers = listOf(
    LicenseTier(0.0, "No credit", "Nobody owes you a name."),
    LicenseTier(0.5, "Credit commercially", "Commercial uses credit you; everything else is free."),
    LicenseTier(1.0, "Credit always", "Every use credits you."),
)

/** `PROVENANCE_TIERS`, verbatim (`design/components/forms/LicenseChooser.jsx`). */
val ProvenanceTiers = listOf(
    LicenseTier(0.0, "Not logged", "Uses go unlogged."),
    LicenseTier(0.5, "Log commercial use", "Commercial uses are logged publicly and stay open to audit."),
    LicenseTier(1.0, "Log every use", "Every use is logged publicly and stays open to audit."),
)

/**
 * The pair's NAME — `Public domain` for the zero pair, otherwise the two
 * tier names joined by ` · ` (copy-voice *licenseSummary*). Empty for a
 * degree with no published reading.
 */
fun licenseName(attribution: Double, provenance: Double): String {
    val credit = AttributionTiers.firstOrNull { it.value == attribution } ?: return ""
    val record = ProvenanceTiers.firstOrNull { it.value == provenance } ?: return ""
    return if (attribution == 0.0 && provenance == 0.0) "Public domain" else "${credit.label} · ${record.label}"
}

/**
 * The author's reading of a pair, ONE joining rule (copy-voice
 * `licenseSummary`, blessed 2026-10-02): the name, ` — `, the credit hint
 * and the record hint joined by `, and`, each lowercased at its head with
 * its full stop dropped, closed by one full stop —
 * `Public domain — nobody owes you a name, and uses go unlogged.`
 */
fun licenseSummary(attribution: Double, provenance: Double): String {
    val credit = AttributionTiers.firstOrNull { it.value == attribution } ?: return ""
    val record = ProvenanceTiers.firstOrNull { it.value == provenance } ?: return ""
    fun clause(hint: String) = hint.replaceFirstChar { it.lowercaseChar() }.removeSuffix(".")
    return "${licenseName(attribution, provenance)} — ${clause(credit.hint)}, and ${clause(record.hint)}."
}

/** An axis's caption (`LicenseAxisLabel`): `labelSmall` on `onSurfaceVariant`. */
@Composable
fun LicenseAxisLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

/**
 * One license axis as `_shared.jsx`'s `LicenseAxis` draws it: a radio
 * group of readings 6dp apart, each row the choice dot beside the
 * reading's label over the consequence it obliges — the same pixels on
 * every sheet that asks the question. The ROW is the target.
 *
 * Under [node], a reading's row is `tier` keyed by its position from 1,
 * with its `dot`, `label` and `hint`.
 */
@Composable
fun LicenseAxis(
    tiers: List<LicenseTier>,
    chosen: Double,
    onChoose: (Double) -> Unit,
    modifier: Modifier = Modifier,
    node: DataNode? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .dataNode(node)
            .selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tiers.forEachIndexed { index, tier ->
            val tierNode = node?.div("tier")
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 24.dp)
                    .dataNode(tierNode?.keyed((index + 1).toString()))
                    .selectable(
                        selected = tier.value == chosen,
                        role = Role.RadioButton,
                        onClick = { onChoose(tier.value) },
                    ),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // 1dp keeps the dot on the reading's first line, not the row's centre.
                ChoiceDot(
                    selected = tier.value == chosen,
                    modifier = Modifier
                        .padding(top = 1.dp)
                        .dataNode(tierNode?.div("dot")),
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = tier.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.dataNode(tierNode?.div("label")),
                    )
                    Text(
                        text = tier.hint,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.dataNode(tierNode?.div("hint")),
                    )
                }
            }
        }
    }
}
