// THE POST'S LICENSE, ASKED FOR
// (design/designs/canonical/screens/PostLicense.jsx; `_shared.jsx` `LicenseSheet`).
//
// What the menu's License terms row opens: the terms in a sheet over the post
// they belong to. The read is still there beneath the wash — a reuser checking
// what they owe has not left the post to do it — and the way back is the way
// out of any sheet. A block unfolded inside a post had no such way back, which
// is the whole reason this is a sheet, and why the terms are never a state of
// the card.
//
// ONE SHEET, TWO MENUS. The reader's ⋮ and the author's own both carry the row,
// and both land here: the terms of a node read the same whichever menu asked.

package com.cogra.feature.content

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.atom.sheetContainerColor
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.LicenseChoice

/**
 * A QUIET INSET, NOT A PARAGRAPH (`LicenseChooser.jsx:110-176`).
 *
 * The terms are the one thing about a post a reader may have to act on — a
 * reuser checking what they owe — so they are drawn as a block read at a glance
 * rather than a sentence to be parsed: the caption names the words the reader
 * tapped, and each axis states its own reading on its own row, the two aligned
 * so the pair reads as a pair.
 *
 * It takes NO fill. The sheet it comes up in is a raised container already, so
 * a filled inset on top of it would either invert between the themes or claim
 * an elevation this owes nothing to; a hairline recesses it in both. Nothing
 * here is coloured — the terms are neither a warning nor a promotion.
 */
@Composable
internal fun LicenseTerms(license: LicenseChoice, testTag: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant,
                RoundedCornerShape(12.dp),
            )
            .padding(Space.x3)
            .testTag(testTag),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                stringResource(R.string.content_license_terms_caption),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            // THE NAME OF THE COMMON PAIR. Both axes at zero is the one reading
            // readers already have a word for, and the word carries further
            // than the two rows that spell it — so it rides the caption line
            // rather than replacing the rows, which stay uniform.
            if (isPublicDomain(license)) {
                Text(
                    stringResource(R.string.content_license_terms_public_domain),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.testTag("${testTag}_public_domain"),
                )
            }
        }
        licenseReadings(license).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
                Text(
                    row.axis,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(116.dp),
                )
                Text(row.reading, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/**
 * IT CARRIES NO `SheetTitle`. The inset heads itself — its caption is the words
 * the reader tapped, and the Public Domain name rides that same line — so a
 * title above it would say `License terms` twice, a few pixels apart, in two
 * sizes. The sheet's name lives on its accessible name instead.
 *
 * [stacked] is true when this comes up over another sheet rather than the
 * plain page — a comment's own terms, raised over the comments thread
 * (`CommentLicense.jsx`, design/readme.md:2364). The post's own terms stay
 * unstacked, over the post page.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LicenseSheet(
    license: LicenseChoice,
    onDismiss: () -> Unit,
    testTag: String = "license_sheet",
    stacked: Boolean = false,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = sheetContainerColor(
            stacked,
            MaterialTheme.colorScheme,
            BottomSheetDefaults.ContainerColor,
        ),
        modifier = Modifier.testTag(testTag),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Space.x6)
                .padding(bottom = Space.x6),
        ) {
            LicenseTerms(license, "${testTag}_terms")
        }
    }
}
