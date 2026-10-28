// The search field — `design/components/forms/SearchBar.jsx`: M3's search-bar
// idiom rather than a text field, a full 48dp pill on the container surface, a
// leading search glyph, the placeholder's register until a query exists.
// web's twin is `web/src/lib/ui2/search-bar.tsx`.
//
// ITS NAME IS THE USE'S, NOT THE PLACEHOLDER (the K13 round): a placeholder
// leaves when the reader types, so [label] names the field per use.
//
// ITS KEYBOARD IS THE SEARCH KEYBOARD: the search action key, no capitals
// guessed and nothing corrected — a query carries handles and tag names, which
// correction would break. What the action key does is each surface's own
// ([onAction]).
//
// A TRAILING × WHILE TEXT IS PRESENT, where a surface's sidecar asks for one
// ([onClear]; Explore.md:11-13): it empties the field. The master draws no ×
// yet, so its node is the field's evident part, `clear` (web's twin's).

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Space

/** The pill's drawn height (`SearchBar.jsx`: `height: 48px`). */
private val SEARCH_BAR_HEIGHT = 48.dp

/** The leading glyph (`SearchBar.jsx`: `Icon name="search" size={20}`). */
private val SEARCH_GLYPH = 20.dp

/** The ×'s target: 40dp of box inside the pill, as web's twin (`size-10`), pulled 8 into the pill's end padding. */
private val CLEAR_TARGET = 40.dp

@Composable
fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String,
    /** The field's accessible name — the use's, never the placeholder. */
    label: String,
    modifier: Modifier = Modifier,
    /** The registered field; its `glyph` and `input` are its parts. */
    node: DataNode? = null,
    /** The trailing ×, shown while [query] holds text; null draws none. */
    onClear: (() -> Unit)? = null,
    /** The keyboard's action key; null leaves the platform's default. */
    onAction: (() -> Unit)? = null,
) {
    Box(modifier.fillMaxWidth().padding(start = Space.x4, end = Space.x4, top = Space.x1, bottom = Space.x3)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(SEARCH_BAR_HEIGHT)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                // The registered field is the drawn pill (`SearchBar.jsx` `data-node`
                // on the pill), so its tag rides outside the pill's own inset.
                .dataNode(node)
                .padding(horizontal = Space.x4),
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(SEARCH_GLYPH).dataNode(node?.div("glyph")),
            )
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                if (query.isEmpty()) {
                    Text(
                        text = placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrectEnabled = false,
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Search,
                    ),
                    keyboardActions = onAction?.let { act -> KeyboardActions(onSearch = { act() }) }
                        ?: KeyboardActions.Default,
                    modifier = Modifier
                        .fillMaxWidth()
                        .semantics { contentDescription = label }
                        .dataNode(node?.div("input")),
                )
            }
            if (onClear != null && query.isNotEmpty()) ClearControl(onClear, node)
        }
    }
}

/**
 * The trailing ×: 40dp of target pulled 8 into the pill's end padding, the
 * 20dp close glyph, named for what it does.
 */
@Composable
private fun ClearControl(onClear: () -> Unit, node: DataNode?) {
    val clear = stringResource(R.string.search_bar_clear)
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .offset(x = Space.x2)
            .size(CLEAR_TARGET)
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onClear)
            .semantics { contentDescription = clear }
            .testTag(node?.div("clear")?.tag ?: "search_bar_clear"),
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(SEARCH_GLYPH),
        )
    }
}
