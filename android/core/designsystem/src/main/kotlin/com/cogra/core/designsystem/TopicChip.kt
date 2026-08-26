// The topic chip (design.md §6 "Topic chip — a tappable tag"): the
// compact reference a hashtag renders as everywhere it appears — a
// post/comment's chip row, the composer's staged tags, the topic
// screen's own header. Plain Material 3; the slice ships deliberately
// unstyled ahead of the pending visual redesign pass over slice 2.

package com.cogra.core.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role

/**
 * One topic reference — the canonical name, already normalized
 * (lowercase, no `#`; hashtag.md §1). [onRemove] turns on the chip's
 * own remove affordance (the composer's staged tags, the chip row's
 * remove gesture on owned content) as a separate tap target from
 * [onClick]; its absence renders a plain tappable chip that opens the
 * topic (hashtag.md §5).
 */
@Composable
fun TopicChip(
    name: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onRemove: (() -> Unit)? = null,
    testTag: String? = null,
) {
    val label = "#$name"
    val chipModifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
    if (onRemove != null) {
        InputChip(
            selected = false,
            onClick = onClick,
            label = { Text(label) },
            trailingIcon = {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = stringResource(R.string.topic_chip_remove, label),
                    modifier = Modifier
                        .size(InputChipDefaults.IconSize)
                        .clickable(onClick = onRemove, role = Role.Button)
                        .then(if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier),
                )
            },
            modifier = chipModifier,
        )
    } else {
        AssistChip(
            onClick = onClick,
            label = { Text(label) },
            modifier = chipModifier,
        )
    }
}
