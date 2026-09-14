package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import com.cogra.core.designsystem.v2.token.MediaFrame

/**
 * The top of a video post's detail view
 * (`design/components/media/PinnedClip.jsx`).
 *
 * **It sits above the card, not inside it**, "which is why the author chip
 * leads the CARD on that surface rather than the screen. On every other
 * surface the chip sits above the content; here the content the reader is
 * already watching sits above everything, and the card beneath it is the post
 * as it always reads" (`:9-12`).
 *
 * **It is pinned, not merely first.** The board stands it outside the
 * scrolling column entirely (`screens/_shared.jsx:666-672`), so the body rises
 * beneath a clip that stays put and stays playing — which is why a caller puts
 * this above its list rather than in the list's first item.
 *
 * **The ground is black** (`:24`), "so a clip that does not fill the frame's
 * width sits on the same ground the viewer would give it".
 *
 * **It carries the full transport** (`controls="transport"`), the ladder's
 * second rung: the reader opened this clip on purpose.
 *
 * A [item] with no clip in it draws nothing — there is no such thing as a
 * pinned picture.
 */
@Composable
fun PinnedClip(
    item: MediaItem,
    modifier: Modifier = Modifier,
    maxHeight: Dp = mediaMaxHeight(),
    testTag: String = PINNED_CLIP_TAG,
) {
    val videoUrl = item.videoUrl ?: return
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.Black)
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        VideoPlayer(
            url = videoUrl,
            // The cover is the clip's face until a frame of it exists.
            posterUrl = item.imageModel(),
            // Pinned still playing: the clip is the thing the reader came
            // for, and arriving here claims the stage from whatever card
            // was playing it.
            autoplay = true,
            durationMs = item.durationMs,
            controls = VideoControls.Full,
            contentScale = ContentScale.Crop,
            // The clip's own shape, clamped to tall by the same rule every
            // frame in the product obeys — the media law's true ratio, not a
            // shape this surface invents.
            videoAspectRatio = item.aspectRatio?.cappedToTallestTile(),
            contentDescription = item.altText,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(item.aspectRatio?.cappedToTallestTile() ?: 1f)
                .heightIn(min = MediaFrame.MinHeight, max = maxHeight),
            testTag = "${testTag}_video",
        )
    }
}

const val PINNED_CLIP_TAG = "pinned_clip"
