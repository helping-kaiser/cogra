package com.cogra.core.designsystem.v2.media

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.MediaFrame

/**
 * The top of a video post's detail view
 * (`design/components/media/DetailClip.jsx`).
 *
 * **It sits above the card, not inside it**, "which is why the author chip
 * leads the CARD on that surface rather than the screen. On every other
 * surface the chip sits above the content; here the content the reader is
 * already watching sits above everything, and the card beneath it is the post
 * as it always reads" (`:10-13`).
 *
 * **It is content, and scrolls with the page** (jakob's ruling 100,
 * design/readme.md §13, "The clip detail rulings"): "Comments live in their
 * sheet, so nothing stands below the post on its detail but the post itself,
 * and a clip held on screen would take the room the post is read in"
 * (`:15-17`). The caller stands it at the head of the detail's scrolling
 * column, flush on the card — "one block, no gap between them"
 * (`DetailClip.prompt.md:15`).
 *
 * **Opening the detail starts it, and scroll never stops it**: "the open is
 * the deliberate act, so no share of the screen gates it … A clip scrolled out
 * of view plays on — scroll never stops it — and no floating player takes its
 * place" (`:18-21`). Composing the player is what claims [VideoStage]'s one
 * player, and the detail's own stage starts it ([DetailPlayback]: the open,
 * suppression, and the layers raised over the post — [CoveringLayers]); no
 * 70% election stands over it. So the caller must keep it COMPOSED for as
 * long as the detail is up
 * — a lazy list disposes a row scrolled out of view, and a disposed player
 * surrenders the clip — which is why the post detail stands it in the same
 * row as the card it heads.
 *
 * **The ground is black** (`:51`), "so a clip that does not fill the frame's
 * width sits on the same ground the viewer would give it" (`:24-26`).
 *
 * **It carries the full transport** (`controls="transport"`), the ladder's
 * second rung: the reader opened this clip on purpose. Android's chrome stays
 * up (PostDetailVideo.md:31).
 *
 * A [item] with no clip in it draws nothing — a picture post's gallery stays
 * the card's body.
 *
 * **Under a sensitive veil it is the poster alone** (jakob 2026-09-24, the
 * detail-clip veil ruling): the clip wears its veil in place, and a veiled
 * clip is out of the stage ([LocalStageVeil], backlog item 103). No player is
 * composed, so nothing claims [VideoStage], nothing plays behind the blur, and
 * no transport stands under the veil — the face's only affordance is the
 * reveal. The frame keeps its exact size either way, so revealing moves
 * nothing, and the reveal composes the player, which claims the stage
 * (PostDetailVideoSensitive.md:3-15).
 */
@Composable
fun DetailClip(
    item: MediaItem,
    modifier: Modifier = Modifier,
    maxHeight: Dp = mediaMaxHeight(),
    /**
     * Where the clip's own tap goes (`:28-29` — "the tap on it is the surface's
     * to wire: back into the stream where the reader came from it, and into the
     * fullscreen viewer everywhere else").
     *
     * THE STREAM HALF IS THE REEL PACKET'S (feed-card-rework BX-2). `Reel` is
     * not built, so PostDetailVideo.md:33 ("GIVEN the reader came from the
     * stream … the clip expands back into the stream") has no origin to come
     * from yet; every reader comes from "anywhere else" (:35), so the viewer
     * half is the whole of the wiring today.
     */
    onOpenViewer: (() -> Unit)? = null,
    testTag: String = DETAIL_CLIP_TAG,
) {
    val videoUrl = item.videoUrl ?: return
    // The clip's own shape, clamped to tall by the same rule every frame in
    // the product obeys — the media law's true ratio, not a shape this surface
    // invents. One frame for the poster and the player alike.
    val frame = Modifier
        .fillMaxWidth()
        .aspectRatio(item.aspectRatio.cappedToTallestTile())
        .heightIn(min = MediaFrame.MinHeight, max = maxHeight)
    val veiled = LocalStageVeil.current
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.Black)
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        if (veiled) {
            AsyncImage(
                model = item.imageModel(),
                // The veil speaks for what it covers; the frame says nothing.
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = frame.testTag("${testTag}_poster"),
            )
        } else {
            StagedDetailClip(item, videoUrl, frame, onOpenViewer, "${testTag}_video")
        }
    }
}

/**
 * The unveiled clip, on the detail's own stage ([DetailPlayback]).
 *
 * **Composed only unveiled, so the unveil is the veiled clip's open**
 * (PostDetailVideoSensitive.md:15/17): the playback is remembered here, under
 * the veil's branch, and is created the moment the veil lifts — the veil
 * decides whether a player exists ([LocalStageVeil]), suppression decides
 * whether the open starts it.
 *
 * **Every decision is the detail's, so the surface asserts nothing**
 * (`autoplay = null`): the open, the cover rising and lifting, and what a
 * re-binding surface asserts are each carried out here, against the one
 * player [VideoStage] holds — read afresh each time, never kept
 * (developer.android.com/develop/ui/compose/side-effects: `snapshotFlow` turns
 * the stage's and the layers' Compose state into the flows the decisions run
 * on).
 */
@OptIn(UnstableApi::class)
@Composable
private fun StagedDetailClip(
    item: MediaItem,
    url: String,
    frame: Modifier,
    onOpenViewer: (() -> Unit)?,
    testTag: String,
) {
    val context = LocalContext.current
    val suppression = LocalAutoplaySuppression.current
    val layers = LocalCoveringLayers.current
    val token = remember(url) { Any() }
    // THE OPEN (PostDetailVideo.md:7/9), decided while composing so the very
    // first bind asserts it: a placeholder answer would start a suppressed
    // clip for a frame, or stop a carried one. Saved, so a return to the
    // detail — from the comment composer, under the thread's sheet — is no
    // second open.
    val playback = rememberSaveable(url, saver = DetailPlayback.Saver) {
        DetailPlayback.open(clipNow(url), suppressed = suppression.suppressed(context))
    }

    // WHAT A BIND ASSERTS: the open's answer, or "still" under a cover — the
    // one assertion `autoplay` used to make, now answered by the stage.
    LaunchedEffect(playback, url, token) {
        snapshotFlow { VideoStage.playerFor(token, url) }.collect { player ->
            if (player != null && !playback.consumeOwnClaim()) player.playWhenReady = playback.bindPlays
        }
    }

    // WHAT STANDS OVER THE POST (PostDetailVideo.md:39-51).
    LaunchedEffect(playback, url, token, layers) {
        snapshotFlow { layers?.cover }.collect { next ->
            val command = playback.coverChanged(next, clipNow(url)) { suppression.suppressed(context) }
            val held = VideoStage.holding?.takeIf { it.url == url }?.player
            when (command) {
                DetailPlayback.Command.None -> Unit
                DetailPlayback.Command.Pause -> held?.pause()
                DetailPlayback.Command.Play -> held?.play()
                is DetailPlayback.Command.Reclaim -> {
                    VideoStage.claim(context, url, token)
                    VideoStage.playerFor(token, url)?.apply {
                        seekTo(command.atMs)
                        playWhenReady = command.play
                    }
                }
            }
        }
    }

    VideoPlayer(
        url = url,
        // The cover is the clip's face until a frame of it exists.
        posterUrl = item.imageModel(),
        // THE STAGE DECIDES, NOT THE SURFACE (see above): arriving here still
        // claims the stage from whatever card was playing the clip — at the
        // frame it reached (:53), since the player is the same one.
        autoplay = null,
        durationMs = item.durationMs,
        controls = VideoControls.Full,
        contentScale = ContentScale.Crop,
        videoAspectRatio = item.aspectRatio.cappedToTallestTile(),
        contentDescription = item.altText,
        onOpenViewer = onOpenViewer,
        stageToken = token,
        modifier = frame,
        testTag = testTag,
    )
}

/**
 * The detail's clip as the one player holds it now — or, when another clip
 * has taken the player, as it stood at that swap ([VideoStage.swappedOut]).
 */
@OptIn(UnstableApi::class)
private fun clipNow(url: String): ClipNow {
    val player = VideoStage.holding?.takeIf { it.url == url }?.player
    if (player == null) {
        val out = VideoStage.swappedOut?.takeIf { it.url == url }
        return ClipNow(onStage = false, playing = out?.playing == true, positionMs = out?.positionMs)
    }
    return ClipNow(
        onStage = true,
        // Told to play and not run out: buffering is still playing, as far as
        // the reader's last word goes; an ended clip is at rest (:19).
        playing = player.playWhenReady && player.playbackState != Player.STATE_ENDED,
        positionMs = player.currentPosition,
    )
}

const val DETAIL_CLIP_TAG = "detail_clip"
