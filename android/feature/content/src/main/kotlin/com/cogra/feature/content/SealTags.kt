// THE SEAL'S TAGS ROW, MEASURED (design/designs/canonical/screens/_shared.jsx
// `sealTagsRow`, round 62; ComposeSeal.md:45-49, ComposeSealTagged.md): at
// most two readout chips, and only while they fit the value slot WHOLE. A
// readout chip is never cut — what a signature will carry is being read back —
// so a tag too long for the slot (a name up to 128 characters) folds the row
// to its count, `1 tag`, and the row becomes the door to the sheet that lists
// the tags, as it does past two. The board judges fit on the strings; "the
// clients run the same fold measured". One fold for both seals (`sealTagsRow`
// is one factory: "the reply seal mirrors the post seal exactly", seam 254
// item 10). web's twin is `web/src/lib/ui2/compose/seal-tags.tsx`.
//
// HOW IT MEASURES: the row's width is the acts card's, which never depends on
// what the row holds, so the fold is decided in composition from it
// (`BoxWithConstraints`) — no second frame, no state written back from layout.
// The value slot is what the row leaves between its fixed label column and its
// count, each 8 apart (`ActsCard.jsx`); each chip is its label's measured
// width (`TextMeasurer`, the chip's own style) and the pill's padding, 6 apart.

package com.cogra.feature.content

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.ReadoutChipHorizontalPadding
import com.cogra.core.designsystem.v2.token.Space

/** How many chips the Tags row holds before it counts (`_shared.jsx` `TAGS_ROW_HOLDS`). */
internal const val TAGS_ROW_HOLDS = 2

/** Between two readout chips on the row (`sealTagsRow`'s `gap: 6`). */
internal val SEAL_TAG_GAP = 6.dp

/** The folded row's words: `1 tag`, `3 tags` (`tagsRow`'s `value`). */
internal fun tagsCountWords(count: Int): String = if (count == 1) "1 tag" else "$count tags"

/** The folded row's spoken name: `Manage the 1 tag` (`tagsRow`'s `openLabel`). */
internal fun manageTagsLabel(count: Int): String = "Manage the ${tagsCountWords(count)}"

/**
 * Whether [names] stand on the row as whole chips: at most [TAGS_ROW_HOLDS],
 * and together, [gap] apart, no wider than [slot]. [chipWidth] is one chip's
 * width for its label (`#name`).
 */
internal fun sealTagsFit(names: List<String>, slot: Int, gap: Int, chipWidth: (String) -> Int): Boolean =
    names.size in 1..TAGS_ROW_HOLDS &&
        names.sumOf { chipWidth("#$it") } + gap * (names.size - 1) <= slot

/**
 * The Tags row in its reading for [names], decided from the row's own width:
 * [row] is drawn with `folded` true past [TAGS_ROW_HOLDS] or when the chips
 * would not fit the slot whole. [labelWidth] is the row's label column and
 * [countStyle] its trailing count's type.
 */
@Composable
internal fun SealTagsFold(
    names: List<String>,
    labelWidth: Dp,
    countStyle: TextStyle,
    row: @Composable (folded: Boolean) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val measurer = rememberTextMeasurer()
        val chipStyle = MaterialTheme.typography.labelSmall
        val density = LocalDensity.current
        val width = constraints.maxWidth.takeIf { constraints.hasBoundedWidth }
        val folded = remember(names, width, labelWidth, countStyle, chipStyle, density, measurer) {
            if (width == null) {
                names.size > TAGS_ROW_HOLDS
            } else {
                with(density) {
                    val count = measurer.measure("${names.size}", countStyle, softWrap = false, maxLines = 1).size.width
                    val slot = width - labelWidth.roundToPx() - 2 * Space.x2.roundToPx() - count
                    val pill = 2 * ReadoutChipHorizontalPadding.roundToPx()
                    !sealTagsFit(names, slot, SEAL_TAG_GAP.roundToPx()) { label ->
                        measurer.measure(label, chipStyle, softWrap = false, maxLines = 1).size.width + pill
                    }
                }
            }
        }
        row(folded)
    }
}
