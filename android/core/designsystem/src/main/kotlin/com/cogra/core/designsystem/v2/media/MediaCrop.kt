package com.cogra.core.designsystem.v2.media

import android.net.Uri
import android.os.Build
import android.util.TypedValue
import android.view.ViewConfiguration
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculateCentroidSize
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Slider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.viewinterop.AndroidView
import com.canhub.cropper.CropImageView
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.QuietNote
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
 * **THE ZOOM IS ON SCREEN, AND THE CUT PANS BY KEY** (the K13 round;
 * `CropViewport.jsx` `CropZoom`, ComposeCrop.md). Under the cut stands the
 * zoom slider on every crop — its thumb at the framing's zoom between the
 * fill (1×) and about 4×, named `Zoom`, 48dp tall — and a pinch moves it with
 * the window (`twoFingerPinch`). The cut takes focus under the name
 * `Move the picture`; its arrow keys move the window 1 % of the picture a
 * press, 10 % with Shift, never past the picture's edge. TalkBack keeps its
 * named custom actions for nudge, zoom and reset, and a state description
 * that reads the framing back. The ceiling holds for every route: the
 * slider, the actions and the library's own handles and pinch
 * (`CropState.holdCeiling`).
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
    /**
     * The crop's data-node on a registered screen (`composeCrop`): its
     * `viewport`, `zoom` (with its `input`) and `howTo` line wear its parts.
     */
    node: DataNode? = null,
    /**
     * The stage the picture is laid out in, width ÷ height. It does NOT
     * follow [shape]: a shape switch changes only the window, never the
     * picture under it (jakob 2026-11-11: "when swapping from tall to
     * square or wide the image shrinks. i would just expect the
     * rectangle/frame to change"). The default is the viewport
     * `ComposeCrop` draws, 390 × 488; the avatar's square stage passes 1.
     */
    stageRatio: Float = COMPOSE_CROP_STAGE_RATIO,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        CropViewport(item, stageRatio, shape.cropAspect, state, mask, bleed, node?.div("viewport")?.tag ?: testTag)

        CropZoom(state = state, testTag = testTag?.let { "${it}_zoom" }, node = node?.div("zoom"))

        // `QuietNote` (ComposeCrop.jsx:63): what the crop decides and how it moves.
        QuietNote(text = caption, modifier = Modifier.fillMaxWidth().dataNode(node?.div("howTo")))
    }
}

/**
 * A crop whose shape is LOCKED to how the result will be seen
 * (`CropViewport.prompt.md`; `CoverCrop`): a clip's cover is cut at the
 * clip's own ratio in a post and at the comment pager's square in a comment,
 * so there are no shape chips — choosing a shape here would let the cover
 * disagree with the thing it is the face of (CoverCrop.md).
 *
 * The frame is the square the board draws (`size` 390, full bleed), the
 * picture fitted whole inside it and the [window] the cut; the zoom slider
 * stands under it and [notes] under that, one `QuietNote` each — `Drag to
 * move, pinch to zoom.` and what the crop is for (CoverCrop.jsx).
 */
@Composable
fun LockedCrop(
    item: MediaItem,
    window: CropAspect,
    state: CropState,
    notes: List<String>,
    modifier: Modifier = Modifier,
    bleed: Dp = Layout.ScreenGutter,
    testTag: String? = null,
    /**
     * The crop's data-node on a registered screen (`coverCrop`): its
     * `viewport` and `zoom` (with its `input`) wear its parts, and each of
     * [notes] the part [noteParts] names in its place.
     */
    node: DataNode? = null,
    noteParts: List<String> = listOf("howTo", "shapeNote"),
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x3),
    ) {
        val viewportTag = node?.div("viewport")?.tag ?: testTag
        CropViewport(item, frameRatio = 1f, window = window, state, CropMask.Thirds, bleed, viewportTag)

        CropZoom(state = state, testTag = testTag?.let { "${it}_zoom" }, node = node?.div("zoom"))

        notes.forEachIndexed { index, note ->
            QuietNote(
                text = note,
                modifier = Modifier.fillMaxWidth().dataNode(noteParts.getOrNull(index)?.let { node?.div(it) }),
            )
        }
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
    /** The frame the picture is laid out in — the post's shape, or a locked crop's square. */
    frameRatio: Float,
    /** The cut's own shape. */
    window: CropAspect,
    state: CropState,
    mask: CropMask,
    bleed: Dp,
    testTag: String?,
) {
    val actions = cropActions(state)

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
            .aspectRatio(frameRatio)
            .twoFingerPinch(state, minimumScalingSpan())
            .onPreviewKeyEvent { event -> panByKey(event, state) }
            .focusable()
            .semantics {
                // `CROP_PAN_NAME` (CropViewport.jsx; blessed 2026-10-05): what
                // the focused cut is for, in the reader's words.
                contentDescription = CROP_PAN_NAME
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
                    // ...and it stays whole. The library's auto-zoom blows the
                    // picture up, animated, whenever a settled window is under
                    // half the stage — the picture jumping under a finger that
                    // has just let go, and under the fingers of a pinch whose
                    // start settles a drag. The window is what moves here.
                    isAutoZoomEnabled = false
                    setFixedAspectRatio(true)
                    // The library's own pinch is OFF: it sizes the window to the
                    // fingers' separate horizontal and vertical spread and never
                    // consults the fixed ratio, while its one-finger drag keeps
                    // running on the same events — jakob's sliver (2026-11-11).
                    // Two fingers belong to [twoFingerPinch] instead.
                    setMultiTouchEnabled(false)
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
                state.frameTo(view, window)
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
        state.onWindowChanged(
            CropWindowMath.framingOf(rect, whole),
            whole.width().toFloat() / whole.height().toFloat(),
        )
    }
}

/** The non-gesture route as TalkBack custom actions: nudge, zoom, reset. */
private fun cropActions(state: CropState): List<CustomAccessibilityAction> {
    fun action(label: String, run: () -> Unit) = CustomAccessibilityAction(label) {
        run()
        true
    }
    return listOf(
        action("Nudge left") { state.nudge(NudgeDirection.Left) },
        action("Nudge right") { state.nudge(NudgeDirection.Right) },
        action("Nudge up") { state.nudge(NudgeDirection.Up) },
        action("Nudge down") { state.nudge(NudgeDirection.Down) },
        action("Zoom in") { state.stepZoom(inward = true) },
        action("Zoom out") { state.stepZoom(inward = false) },
        action("Reset framing") { state.reset() },
    )
}

/** The cut's spoken name (`CROP_PAN_NAME`, CropViewport.jsx). */
const val CROP_PAN_NAME = "Move the picture"

/** The slider's spoken name (`CROP_ZOOM_NAME`). */
const val CROP_ZOOM_NAME = "Zoom"

/** ComposeCrop.md: an arrow moves the picture 1 % a press, 10 % with Shift. */
private const val KEY_STEP = 0.01f
private const val KEY_STEP_SHIFTED = 0.1f

/** The arrow keys on the focused cut; anything else falls through. */
private fun panByKey(event: KeyEvent, state: CropState): Boolean {
    if (event.type != KeyEventType.KeyDown) return false
    val step = if (event.isShiftPressed) KEY_STEP_SHIFTED else KEY_STEP
    when (event.key) {
        Key.DirectionLeft -> state.panBy(-step, 0f)
        Key.DirectionRight -> state.panBy(step, 0f)
        Key.DirectionUp -> state.panBy(0f, -step)
        Key.DirectionDown -> state.panBy(0f, step)
        else -> return false
    }
    return true
}

/**
 * Two fingers on the cut: the window scales about the fingers' centroid and
 * travels with it ([CropState.pinchBy]), its shape held exactly; one finger
 * stays the cropper's own drag and corner handles.
 *
 * **Why the Initial pass.** Compose delivers each pointer event three times —
 * Initial (parent to child), Main (child to parent), Final — and a parent may
 * act on and consume an event in the Initial pass before its children see it
 * (developer.android.com/develop/ui/compose/touch-input/pointer-input/understand-gestures,
 * "Event passes" / "Event consumption"). The cropper is an `AndroidView`
 * child, so `detectTransformGestures`, which listens in the Main pass, would
 * only hear the fingers after the view had acted on them. Instead the loop
 * below is that detector's own recipe
 * (developer.android.com/develop/ui/compose/touch-input/pointer-input/multi-touch):
 * `awaitEachGesture`, then per event `calculateZoom`, `calculatePan` and
 * `calculateCentroid`, read in the Initial pass.
 *
 * From the moment a second finger is down until every finger is up, each
 * event is consumed; Compose's view interop answers a consumed event by
 * sending the view `ACTION_CANCEL`, so a corner drag that was running ends
 * where it stands and the library's one-finger path cannot run beside the
 * pinch. A finger lifting mid-pinch does not hand the gesture back: the one
 * left keeps moving the window, and `calculatePan` / `calculateCentroid` count
 * only pointers down both before and after an event, so neither a landing
 * nor a lifting finger makes the window jump.
 */
private fun Modifier.twoFingerPinch(state: CropState, minimumSpan: Float): Modifier = pointerInput(state, minimumSpan) {
    awaitEachGesture {
        awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
        var pinching = false
        try {
            do {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                if (!pinching && event.changes.count { it.pressed } >= 2) {
                    pinching = true
                    state.pinchStart()
                }
                if (pinching) {
                    val centroid = event.calculateCentroid(useCurrent = false)
                    if (centroid.isSpecified) {
                        val pan = event.calculatePan()
                        state.pinchBy(centroid.x, centroid.y, pan.x, pan.y, event.pinchZoom(minimumSpan))
                    }
                    event.changes.forEach { it.consume() }
                }
            } while (event.changes.any { it.pressed })
        } finally {
            // Also on a cancelled gesture (the stage leaving mid-pinch), or the
            // view's reports would stay ignored.
            if (pinching) state.pinchEnd()
        }
    }
}

/**
 * `calculateZoom`'s own ratio — the fingers' spread now over their spread
 * before (`calculateCentroidSize`) — taken only while the fingers stand at
 * least [minimumSpan] apart on both sides of the event, and 1 otherwise.
 *
 * That floor is the platform's: `ScaleGestureDetector` reads no scale
 * below `ViewConfiguration.getScaledMinimumScalingSpan` (27 mm), because
 * as two fingers close on each other the ratio of two small spans swings
 * wildly — fingers crossing would otherwise flick the window from the
 * fill to the ceiling in one event. Below it the fingers still carry the
 * window; they just stop resizing it.
 */
private fun PointerEvent.pinchZoom(minimumSpan: Float): Float {
    // A centroid size is the mean distance to the centroid: half a two-finger span.
    val now = calculateCentroidSize(useCurrent = true) * 2f
    val before = calculateCentroidSize(useCurrent = false) * 2f
    return if (now >= minimumSpan && before >= minimumSpan) now / before else 1f
}

/** The platform's minimum pinch span in pixels (`ScaleGestureDetector`'s). */
@Composable
private fun minimumScalingSpan(): Float {
    val context = LocalContext.current
    return remember(context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ViewConfiguration.get(context).scaledMinimumScalingSpan.toFloat()
        } else {
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_MM, MIN_SCALING_SPAN_MM, context.resources.displayMetrics)
        }
    }
}

/** `config_minScalingSpan`, the framework's value before the API 29 accessor. */
private const val MIN_SCALING_SPAN_MM = 27f

/**
 * The stage `ComposeCrop` draws its viewport at: 390 × 488. Fixed for every
 * shape, so a shape switch changes only the window over the picture.
 */
const val COMPOSE_CROP_STAGE_RATIO = 390f / 488f

/**
 * THE ZOOM, ON SCREEN (`CropViewport.jsx` `CropZoom`): Material's slider in
 * `primary` at the column's full width, 48dp tall so its thumb answers at
 * the system minimum, its value the framing's zoom between the fill and
 * about 4×. No words beside it — the cut above is what it acts on, and its
 * name carries what it does. One value, two ways to set it: the pinch moves
 * the slider, the slider moves the window.
 */
@Composable
private fun CropZoom(state: CropState, testTag: String?, node: DataNode? = null) {
    // The board's zoom is a box around its range input; the slider is both,
    // so the box wears the node and the slider its `input`.
    Box(Modifier.dataNode(node)) { ZoomSlider(state, node?.div("input")?.tag ?: testTag) }
}

@Composable
private fun ZoomSlider(state: CropState, testTag: String?) {
    Slider(
        value = state.zoom,
        onValueChange = state::zoomTo,
        valueRange = CROP_ZOOM_MIN..CROP_ZOOM_MAX,
        modifier = Modifier
            .fillMaxWidth()
            .height(Layout.TouchTargetMin)
            .semantics { contentDescription = CROP_ZOOM_NAME }
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    )
}

/** The three shapes, as the canonical board draws them. */
@Composable
fun CropShapeChips(
    selected: MediaShape,
    onSelect: (MediaShape) -> Unit,
    modifier: Modifier = Modifier,
    /** The chips' data-node on a registered screen (`composeCrop.shapes`): each chip its `<shape>Chip`. */
    node: DataNode? = null,
) {
    Row(
        // The chips' row is the column's full width, the chips at its start (ComposeCrop.jsx).
        modifier = modifier.fillMaxWidth().dataNode(node),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        MediaShape.entries.forEach { shape ->
            CograChip(
                label = shape.label,
                selected = shape == selected,
                onClick = { onSelect(shape) },
                testTag = node?.div("${shape.name.lowercase()}Chip")?.tag ?: "crop_shape_${shape.name.lowercase()}",
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
