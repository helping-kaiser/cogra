// The severance confirmation (design.md §8.5).
//
// Severance is a bundle netted to (0, 0): deliberate, burn-priced, and
// carrying consequences ordinary stances do not. One confirmation serves
// both ways in — the reader who came here to sever, and the reader whose
// ordinary pick happens to land on zero. The control never refuses the
// pick; it tells them what the choice nets to, what it costs, and asks
// whether that was the intent (design.md §8.2).
//
// What it costs is the number of signed acts: severance stages a batch
// of counter-records and each record in a batch is its own priced act
// (api-spec.md "The write flow"), so the count is the thing a reader has
// to be able to read BEFORE signing.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

@Composable
fun SeveranceConfirm(
    prompt: SeverancePrompt,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    testTagPrefix: String,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("${testTagPrefix}_severance"),
        title = { Text(stringResource(R.string.stance_severance_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (prompt.fromPick) {
                    Text(
                        text = stringResource(R.string.stance_severance_reached),
                        modifier = Modifier.testTag("${testTagPrefix}_severance_from_pick"),
                    )
                }
                Text(stringResource(R.string.stance_severance_body))
                // This is where the read-side guidance belongs: what the
                // reader stands at, and what reaching zero takes.
                Text(
                    text = "${stringResource(R.string.stance_standing)}: ${prompt.standing.reading()}",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.testTag("${testTagPrefix}_severance_standing"),
                )
                if (prompt.alreadySevered) {
                    Text(
                        text = stringResource(R.string.stance_severance_already),
                        modifier = Modifier.testTag("${testTagPrefix}_severance_already"),
                    )
                } else {
                    // The cost, legible before signing.
                    Text(
                        text = pluralStringResource(
                            R.plurals.stance_severance_cost,
                            prompt.records,
                            prompt.records,
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.testTag("${testTagPrefix}_severance_cost"),
                    )
                }
                if (prompt.failed) {
                    ErrorLine(
                        R.string.stance_severance_failed,
                        "${testTagPrefix}_severance_failed",
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = !prompt.working && !prompt.alreadySevered,
                modifier = Modifier.testTag("${testTagPrefix}_severance_confirm"),
            ) {
                Text(stringResource(R.string.stance_severance_confirm))
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("${testTagPrefix}_severance_keep"),
            ) {
                Text(stringResource(R.string.stance_severance_keep))
            }
        },
    )
}
