// THE TAG THE PAGE IS (jakob 2026-11-23): on a tag's own page a chip or a
// row naming that tag opens nothing — it is already open — as a person's own
// name opens nothing on their profile (ProfilePosts.md:25, `authorHere`).
// Every other tag opens as everywhere. The page's cards and every sheet they
// raise over it (the thread, the tags-and-references sheet) read it here, so
// no second page of the same tag stacks under the reader's Back.

package com.cogra.feature.content

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput

/**
 * The tag whose own page the content stands on, by the name the page was
 * opened with (`Topic.name`, the canonical name a chip carries); null off a
 * tag page.
 */
internal val LocalTagHere = staticCompositionLocalOf<String?> { null }

/**
 * An inert door still takes its tap, so the press never falls through to the
 * card's own door beneath — the author chip's rule (`CardHeader`).
 */
internal fun Modifier.swallowTaps(): Modifier = pointerInput(Unit) { detectTapGestures { } }
