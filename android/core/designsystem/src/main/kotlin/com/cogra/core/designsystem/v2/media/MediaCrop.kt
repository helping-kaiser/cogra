package com.cogra.core.designsystem.v2.media

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.viewinterop.AndroidView
import com.canhub.cropper.CropImageView
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The crop step: one shape for the whole post, framed per picture
 * (design/readme.md §13, D17).
 *
 * **The geometry is the cropper library's, not ours.** The picture is
 * laid out whole — `FIT_CENTER`, so nothing is cut off at rest and every
 * part of it can be reached — and the author moves a window over it. Two
 * bugs died with the hand-rolled version this replaces: a viewport that
 * cropped the picture the moment it opened, so the author never saw what
 * they were choosing from, and a shape switch that carried the previous
 * shape's framing into the new one instead of starting over
 * (jakob 2026-08-31).
 *
 * **The non-gesture route is required, and it is invisible.** D17 makes
 * the requirement explicit — "the crop step must be completable without a
 * gesture" — and design/readme.md §10 requires a non-drag equivalent for
 * every drag. The canonical board draws no controls under the crop, so
 * the equivalent stays entirely in the semantics tree: named custom
 * actions for nudge, zoom and reset, plus a state description that reads
 * the framing back. The library's own view has no notion of any of them,
 * so they drive its window directly.
 */
@Composable
fun MediaCrop(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    modifier: Modifier = Modifier,
    caption: String = "One shape for the whole post. Drag to move, pinch to zoom.",
    mask: CropMask = CropMask.Thirds,
    /**
     * The gutter the viewport escapes. Both crop boards run the picture
     * to the screen's edges — the caption under it stays in the gutter —
     * so the default is the gutter the stage is padded by; a caller with
     * no padding to escape passes `0.dp`.
     */
    bleed: Dp = Layout.ScreenGutter,
    testTag: String? = null,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, shape, state, mask, bleed, testTag)

        Text(
            text = caption,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * What is drawn over the picture being framed.
 *
 * [Thirds] is the post composer's: a rectangular window with the
 * library's rule-of-thirds guides. [Circle] is the profile picture's
 * (`AvatarCrop`): an oval window, because a circle is how the avatar is
 * *seen* everywhere, and framing to a square you cannot see the edges of
 * is guesswork.
 */
enum class CropMask { Thirds, Circle }

@Composable
private fun CropViewport(
    item: MediaItem,
    shape: MediaShape,
    state: CropState,
    mask: CropMask,
    bleed: Dp,
    testTag: String?,
) {
    val actions = listOf(
        CustomAccessibilityAction("Nudge left") { state.nudge(NudgeDirection.Left); true },
        CustomAccessibilityAction("Nudge right") { state.nudge(NudgeDirection.Right); true },
        CustomAccessibilityAction("Nudge up") { state.nudge(NudgeDirection.Up); true },
        CustomAccessibilityAction("Nudge down") { state.nudge(NudgeDirection.Down); true },
        CustomAccessibilityAction("Zoom in") { state.stepZoom(inward = true); true },
        CustomAccessibilityAction("Zoom out") { state.stepZoom(inward = false); true },
        CustomAccessibilityAction("Reset framing") { state.reset(); true },
    )

    // The view outlives individual compositions but not the state it is
    // driving: dropping the reference on dispose is what keeps a stale
    // view from answering an accessibility action after the stage moved.
    DisposableEffect(state) {
        onDispose { state.view = null }
    }

    // One view serves every picture in the post, and the filmstrip swaps
    // the state under it. Everything tying the two together therefore
    // lives here and is rewritten on each switch, never captured when the
    // view was made: a listener still closed over the state it was born
    // with wrote picture two's window into picture one's framing
    // (jakob 2026-09-01).
    val binding = remember { CropBinding() }

    Box(
        modifier = Modifier
            // Full bleed: the crop runs to the screen's edges, which is
            // the whole of the fix for "the area for cropping was to
            // small" (jakob 2026-09-01) — at the 24dp gutter the stage
            // is padded by, that is a third again of crop area.
            .bleedHorizontally(bleed)
            .fillMaxWidth()
            // The frame the picture is *laid out* in stays the post's
            // shape, so the stage looks the way the board draws it; the
            // picture inside it is fitted whole rather than filling it.
            .aspectRatio(shape.ratio)
            .semantics {
                contentDescription = item.altText ?: "The picture being framed"
                // The invisible half of the non-gesture route: what the
                // framing currently is, so the actions are not fired blind.
                stateDescription = state.framingDescription()
                customActions = actions
            }
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                CropImageView(context).apply {
                    // The whole picture, always: this single line is what
                    // makes "nothing is cut off at rest" true.
                    scaleType = CropImageView.ScaleType.FIT_CENTER
                    setFixedAspectRatio(true)
                    // The decode is the only moment a framing can be put
                    // back, so the library's own decode-complete callback
                    // is what places it. Nothing the library reports
                    // afterwards announces the window it settled on.
                    setOnSetImageUriCompleteListener { view, uri, error ->
                        if (error == null) binding.onDecoded(view, uri)
                    }
                    setOnCropWindowChangedListener { binding.report(this) }
                }
            },
            update = { view ->
                binding.bind(state)
                state.view = view
                view.cropShape = when (mask) {
                    CropMask.Thirds -> CropImageView.CropShape.RECTANGLE
                    CropMask.Circle -> CropImageView.CropShape.OVAL
                }
                view.guidelines = when (mask) {
                    // The canvas's hairline thirds, drawn by the library
                    // over the picture rather than by a layer of our own.
                    CropMask.Thirds -> CropImageView.Guidelines.ON
                    CropMask.Circle -> CropImageView.Guidelines.OFF
                }
                binding.show(view, item.url)
                state.frameTo(view, shape)
            },
            onRelease = { view ->
                view.setOnCropWindowChangedListener(null)
                view.setOnSetImageUriCompleteListener(null)
            },
        )
    }
}

/**
 * What the shared crop view is showing, and whose framing is listening.
 *
 * The view is made once and reused for every picture in the post, so
 * *which picture is loaded* and *whose framing a moved window belongs to*
 * are properties of the view rather than of any one [CropState]. Holding
 * them here — rewritten on every switch instead of captured when the view
 * was made — is what stops a callback reaching the picture that was on
 * screen before it.
 */
private class CropBinding {

    private var state: CropState? = null

    /** The picture this view was last asked to load. */
    private var requestedUrl: String? = null

    /** Points the callbacks at the framing now being edited. */
    fun bind(next: CropState) {
        if (state === next) return
        state = next
        next.beginAttach()
    }

    /**
     * Points the view at a picture, and only when it is not already
     * pointed there. `setImageUriAsync` restarts the decode and throws
     * the window away, so re-issuing it on every recomposition would drop
     * the author's framing every time anything else on the stage moved.
     */
    fun show(view: CropImageView, url: Any?) {
        val next = url?.toString()
        if (next == requestedUrl) return
        requestedUrl = next
        view.setImageUriAsync(next?.let(Uri::parse))
    }

    /**
     * Places the waiting window, once the picture it describes is the one
     * that actually landed. A decode for a picture the filmstrip has
     * already moved off is not this framing's to answer.
     */
    fun onDecoded(view: CropImageView, uri: Uri?) {
        if (uri?.toString() != requestedUrl) return
        state?.applyPendingWindow(view)
    }

    /** Reports a moved window to the framing currently being edited. */
    fun report(view: CropImageView) {
        val state = state ?: return
        val whole = view.wholeImageRect ?: return
        val rect = view.cropRect ?: return
        state.onWindowChanged(CropWindowMath.framingOf(rect, whole))
    }
}

/** The three shapes, as the canonical board draws them. */
@Composable
fun CropShapeChips(
    selected: MediaShape,
    onSelect: (MediaShape) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        MediaShape.entries.forEach { shape ->
            CograChip(
                label = shape.label,
                selected = shape == selected,
                onClick = { onSelect(shape) },
                testTag = "crop_shape_${shape.name.lowercase()}",
            )
        }
    }
}

@ThemePreviews
@Composable
private fun MediaCropShapes() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            CropShapeChips(selected = MediaShape.Tall, onSelect = {})
            MediaCrop(
                item = MediaItem(null, 1.5f, "A picture being framed"),
                shape = MediaShape.Tall,
                state = rememberCropState(),
            )
        }
    }
}

@ThemePreviews
@Composable
private fun MediaCropWide() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            CropShapeChips(selected = MediaShape.Wide, onSelect = {})
            MediaCrop(
                item = MediaItem(null, 1.5f, "A picture being framed"),
                shape = MediaShape.Wide,
                state = rememberCropState(),
            )
        }
    }
}
