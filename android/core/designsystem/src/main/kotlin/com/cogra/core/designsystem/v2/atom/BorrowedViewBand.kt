package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The borrowed-view band (`design/readme.md` §13, 2026-08-27). A guest or
 * applicant feed is ranked from a borrowed vantage point — the inviter's for
 * an invite-link arrival, the genesis moderator's for a bare one, and still
 * the inviter's through the applicant days — because a viewer with no
 * outgoing stances has no view of their own.
 *
 * **The borrowed view is always named, and this band is the naming.** It
 * rides the collapsing top *in place of* the guest notice, which it subsumes:
 * it says whose view this is and carries the one sign-in-or-join entry. The
 * label is what makes borrowed ranking honest (§9), and it exposes nothing
 * the public record does not already carry.
 *
 * [actionLabel] drops away for the signed-in applicant, where the line
 * changes but the vantage point does not. The band disappears altogether the
 * moment the reader's own view exists — their first stance, the vouch-back.
 *
 * The line is a parameter rather than a switch inside the band: the three
 * ruled readings live in `strings.xml` beside each other
 * ([R.string.borrowed_view_join], [R.string.borrowed_view_applicant],
 * [R.string.borrowed_view_vouch_back]), so the copy is read where copy is
 * read and the component stays one drawing.
 */
@Composable
fun BorrowedViewBand(
    handle: String,
    line: String,
    modifier: Modifier = Modifier,
    displayName: String? = null,
    avatarUrl: Any? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    testTag: String? = null,
) {
    Row(
        modifier = modifier
            .padding(horizontal = Layout.ScreenGutter)
            .padding(bottom = Space.x3)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograAvatar(
            name = displayName?.takeIf { it.isNotBlank() } ?: handle,
            size = 24.dp,
            url = avatarUrl,
        )
        Text(
            text = line,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .weight(1f)
                .testTag(testTag?.let { "${it}_line" } ?: "borrowed_view_line"),
        )
        // A text button, not a filled one: the band names a fact and offers a
        // way on, and the loud surface on a read screen belongs to the
        // compose action (§2.4).
        if (actionLabel != null && onAction != null) {
            InlineAction(
                text = actionLabel,
                onClick = onAction,
                testTag = testTag?.let { "${it}_action" } ?: "borrowed_view_action",
            )
        }
    }
}

@ThemePreviews
@Composable
private fun BorrowedViewBandVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            BorrowedViewBand(
                handle = "noa",
                displayName = "Noa Lindgren",
                line = stringResource(R.string.borrowed_view_join, "noa"),
                actionLabel = stringResource(R.string.borrowed_view_sign_in_or_join),
                onAction = {},
            )
            BorrowedViewBand(
                handle = "mira",
                displayName = "Mira Voss",
                line = stringResource(R.string.borrowed_view_applicant, "mira"),
            )
        }
    }
}
