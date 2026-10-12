package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space

/**
 * THE EDITED-WHILE-YOU-READ LINE (`postDetail.newerVersion`; drawn
 * 2026-10-12, `_shared.jsx` `EditedSinceLine`, PostDetail.md:7-13). One line
 * between the detail's header and its post, standing while a fresh read has
 * found another version of the post, its tags or its citations than the one
 * the reader opened; its tap swaps that version in place and the line goes.
 *
 * IN THE PAGE'S FLOW, NEVER PINNED (PostDetail.md:11): the caller stands it
 * in the list row the post's card heads, so it scrolls away with the post.
 * Full width, its words inset 16dp like the card's own content, the row
 * itself the 48dp target, 12dp above the post (`DetailColumn`'s gap).
 * `labelMedium` in `primary`, "because it is an offer and a fact at once"
 * (`_shared.jsx`).
 *
 * ANNOUNCED POLITELY: "it is news, not a fault". The live region stands in
 * the tree whether or not the line does, so its arrival is a change to a
 * region accessibility services already watch; empty, it takes no room.
 */
@Composable
internal fun NewerVersionLine(shown: Boolean, onSwap: () -> Unit, node: DataNode) {
    Column(Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        if (shown) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = Layout.TouchTargetMin)
                    .clickable(role = Role.Button, onClick = onSwap)
                    .dataNode(node)
                    .padding(horizontal = Space.x4),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(
                    text = stringResource(R.string.content_detail_newer_version),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(Space.x3))
        }
    }
}
