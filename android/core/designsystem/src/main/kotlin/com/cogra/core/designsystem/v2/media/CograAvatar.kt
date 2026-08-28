package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.MonogramAvatar
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * An actor's avatar: their picture when they have one, the monogram when they
 * do not (D13).
 *
 * **The monogram is the designed fallback, not a gap waiting for a picture**
 * (design/readme.md §4), so it is not a grey circle — it is
 * [MonogramAvatar], the shipped component, reused rather than reproduced. A
 * broken image falls back to it silently: a reader learns nothing useful from
 * a load failure, and an actor with no picture and an actor whose picture
 * failed should look the same rather than one of them looking broken.
 *
 * Decorative by default, because the adjacent text names the actor. Pass
 * [contentDescription] only where the avatar stands alone.
 */
@Composable
fun CograAvatar(
    name: String,
    size: Dp,
    modifier: Modifier = Modifier,
    url: Any? = null,
    contentDescription: String? = null,
    testTag: String? = null,
) {
    var failed by remember(url) { mutableStateOf(false) }
    val tagged = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)

    if (url == null || failed) {
        MonogramAvatar(name = name, size = size, modifier = tagged)
        return
    }

    Box(tagged) {
        AsyncImage(
            model = url,
            contentDescription = contentDescription,
            contentScale = ContentScale.Crop,
            onError = { failed = true },
            modifier = Modifier
                .size(size)
                .clip(CircleShape),
        )
    }
}

/**
 * A profile cover: the wide crop of D13, at the medium rung like any other
 * inline block. There is no cover on the profile header by design
 * (design/readme.md §7) — this exists for the crop step and for surfaces
 * that do carry one.
 */
@Composable
fun CograCover(
    modifier: Modifier = Modifier,
    url: Any? = null,
    contentDescription: String? = null,
    testTag: String? = null,
) {
    MediaTile(
        item = MediaItem(url = url, aspectRatio = 1.91f, altText = contentDescription),
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        capToTallest = false,
        testTag = testTag,
    )
}

@ThemePreviews
@Composable
private fun CograAvatarFallbacks() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            // No picture, and a picture that cannot load, look alike.
            CograAvatar(name = "Mira", size = 48.dp)
            CograAvatar(name = "Ada", size = 24.dp)
            CograCover()
        }
    }
}
