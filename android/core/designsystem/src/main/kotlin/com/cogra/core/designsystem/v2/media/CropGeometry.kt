package com.cogra.core.designsystem.v2.media

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Which crop a stage belongs to: the post's (three shapes, chosen), a video's
 * cover (the clip's shape, locked) or the profile picture (the circle).
 */
enum class CropKind { Post, Cover, Avatar }

/** A width and a height, in the stage's own units (pixels on screen, the board's 390 in tests). */
data class CropSize(val width: Float, val height: Float)

/** A frame inside its stage: where it stands and how large it is. */
data class CropFrame(val left: Float, val top: Float, val width: Float, val height: Float) {
    val size: CropSize get() = CropSize(width, height)
}

/** Where a crop's zoom may stand. */
data class ZoomBounds(val floor: Float, val ceiling: Float)

/**
 * Where the picture stands under the frame.
 *
 * [zoom] is the picture's scale over its whole-picture fit in the stage
 * ([CropGeometry.fittedPicture]); [x] and [y] are the picture's centre from
 * the stage's centre, in the stage's units. These are the same three numbers
 * the web twin carries (`web/src/lib/ui2/media/crop.ts` `Crop`), so the same
 * inputs give the same rectangle on both clients.
 */
data class CropPlacement(val zoom: Float, val x: Float, val y: Float)

/**
 * THE ONE CROP MODEL (jakob 2026-11-11, seam 301; ComposeCrop.md, CoverCrop.md,
 * AvatarCrop.md): one stage per crop that never changes size with the shape,
 * a FIXED frame of the shape centred in it, and the picture moved and zoomed
 * under the frame.
 *
 * A one-to-one port of the web twin's geometry (`crop.ts`, PR #467) — which
 * is react-easy-crop 6.2.4's own arithmetic — so a rectangle framed on either
 * client is the same rectangle. One difference, by construction: the web
 * library never lays a picture past its own CSS pixels (`computeSizes`), a
 * picture smaller than the stage standing at its own size; here the fit is
 * always the whole stage. That moves only the zoom's units for such a
 * picture, never a rectangle: the floor, the ceiling and the slider are
 * shares of the fill on both, and the framed region is the same region.
 *
 * Pure functions over floats, so every branch is a JVM test.
 */
object CropGeometry {

    /**
     * The zoom's ceiling, as a share of the fill: "about 4×" (each crop's
     * sidecar; `CROP_ZOOM_MAX`, CropViewport.jsx). ONE constant, and nothing
     * else depends on its value — the ruled 10× (boards in #477) is a
     * one-line flip.
     */
    const val MAX_ZOOM = 4f

    /** The zoom's floor, as a share of the fill: the picture just covers the frame. */
    const val MIN_ZOOM = 1f

    /** The boards' artboard width. */
    const val BOARD_WIDTH = 390f

    /** The column's gutter at the artboard: the cover's frame and the circle stand between the gutters. */
    const val BOARD_GUTTER = 24f

    /** The post's tallest shape, Tall 4:5: the ceiling is measured against its fill. */
    const val TALL_RATIO = 4f / 5f

    /**
     * The boards' stages at their 390 artboard — one per crop, the same under
     * every shape (ComposeCrop.md:7, CoverCrop.md:11, AvatarCrop.md:7).
     */
    fun boardStage(kind: CropKind): CropSize = when (kind) {
        CropKind.Post, CropKind.Cover -> CropSize(BOARD_WIDTH, 488f)
        CropKind.Avatar -> CropSize(BOARD_WIDTH, BOARD_WIDTH)
    }

    /** The stage's width over its height. */
    fun stageRatio(kind: CropKind): Float = boardStage(kind).let { it.width / it.height }

    /** The stage at [width], in the board's proportion: the stage scales with the screen. */
    fun stageOf(kind: CropKind, width: Float): CropSize {
        val board = boardStage(kind)
        return CropSize(width, width * board.height / board.width)
    }

    /**
     * The fixed frame of [ratio] (width ÷ height) in a stage [stageWidth] wide:
     * the stage's full width for a post, the width between the gutters for a
     * cover or the circle, at the ratio EXACTLY — what is cut is what is
     * uploaded — and centred. A ratio too tall for the stage stands at the
     * stage's height instead.
     */
    fun frameOf(kind: CropKind, ratio: Float, stageWidth: Float, gutter: Float = BOARD_GUTTER): CropFrame {
        val stage = stageOf(kind, stageWidth)
        val across = if (kind == CropKind.Post) stageWidth else stageWidth - 2f * gutter
        val width = min(across, stage.height * ratio)
        val height = width / ratio
        return CropFrame((stageWidth - width) / 2f, (stage.height - height) / 2f, width, height)
    }

    /** A picture of [sourceRatio] laid whole into [stage] ("contain"), the zoom's 1×. */
    fun fittedPicture(sourceRatio: Float, stage: CropSize): CropSize =
        if (stage.width / stage.height > sourceRatio) {
            CropSize(stage.height * sourceRatio, stage.height)
        } else {
            CropSize(stage.width, stage.width / sourceRatio)
        }

    /** The zoom at which the laid picture just covers the frame. */
    fun fillOf(picture: CropSize, frame: CropSize): Float =
        max(frame.width / picture.width, frame.height / picture.height)

    /**
     * The zoom's floor and ceiling under the frame of [ratio].
     *
     * The floor is the frame's fill: nothing outside the picture can show
     * inside the frame. The ceiling is [MAX_ZOOM] of the TALLEST frame the
     * stage holds on a post, so that a shape switch — which may only ever
     * raise the zoom (ComposeCrop.md:19-21) — never meets a ceiling below
     * where the picture stands. A cover and the circle have one frame, so
     * theirs is [MAX_ZOOM] of their own fill.
     */
    fun zoomBounds(
        kind: CropKind,
        picture: CropSize,
        ratio: Float,
        stageWidth: Float,
        gutter: Float = BOARD_GUTTER,
    ): ZoomBounds {
        val floor = fillOf(picture, frameOf(kind, ratio, stageWidth, gutter).size)
        val tallest = if (kind == CropKind.Post) {
            fillOf(picture, frameOf(kind, TALL_RATIO, stageWidth, gutter).size)
        } else {
            floor
        }
        return ZoomBounds(floor, MAX_ZOOM * max(floor, tallest))
    }

    /** A zoom held between the bounds; a value that is not a number stands at the floor. */
    fun holdZoom(zoom: Float, bounds: ZoomBounds): Float =
        if (!zoom.isFinite()) bounds.floor else zoom.coerceIn(bounds.floor, bounds.ceiling)

    /**
     * The offset held where an edge of the picture meets the frame's —
     * |offset| ≤ |picture · zoom − frame| / 2 on each axis (react-easy-crop's
     * `restrictPosition`).
     */
    fun holdOffset(placement: CropPlacement, picture: CropSize, frame: CropSize): CropPlacement {
        fun hold(value: Float, laid: Float, window: Float): Float {
            val limit = abs(laid * placement.zoom / 2f - window / 2f)
            return if (!value.isFinite()) 0f else value.coerceIn(-limit, limit)
        }
        return placement.copy(
            x = hold(placement.x, picture.width, frame.width),
            y = hold(placement.y, picture.height, frame.height),
        )
    }

    /** The zoom held to [bounds], then the offset held to the frame at that zoom. */
    fun hold(placement: CropPlacement, picture: CropSize, frame: CropSize, bounds: ZoomBounds): CropPlacement =
        holdOffset(placement.copy(zoom = holdZoom(placement.zoom, bounds)), picture, frame)

    /** The picture untouched: centred, at the frame's fill. */
    fun rest(bounds: ZoomBounds): CropPlacement = CropPlacement(bounds.floor, 0f, 0f)

    /**
     * What the frame shows, as fractions of the source picture — the crop's
     * output (`CropSpec.window`) and the rectangle every later preview draws.
     *
     * The frame is centred in the stage ([frameOf]), so with the picture's
     * centre [CropPlacement.x]/[CropPlacement.y] off the stage's, the frame's
     * left edge stands `laid/2 − x − frame/2` into the laid picture —
     * react-easy-crop's `computeCroppedArea` at rotation 0, as a fraction.
     */
    fun windowOf(placement: CropPlacement, picture: CropSize, frame: CropSize): CropFraming {
        val laidWidth = picture.width * placement.zoom
        val laidHeight = picture.height * placement.zoom
        val left = (laidWidth / 2f - placement.x - frame.width / 2f) / laidWidth
        val top = (laidHeight / 2f - placement.y - frame.height / 2f) / laidHeight
        return CropFraming.of(left, top, left + frame.width / laidWidth, top + frame.height / laidHeight)
    }

    /**
     * The placement that shows [window] under the frame — [windowOf]'s
     * inverse, which is what puts a crop back exactly as it was left when the
     * author returns to it. The zoom is the one that makes the window cover
     * the frame on both axes.
     */
    fun placementOf(window: CropFraming, picture: CropSize, frame: CropSize): CropPlacement {
        val zoom = max(frame.width / (window.width * picture.width), frame.height / (window.height * picture.height))
        val centreX = (window.left + window.right) / 2f
        val centreY = (window.top + window.bottom) / 2f
        return CropPlacement(
            zoom = zoom,
            x = picture.width * zoom * (0.5f - centreX),
            y = picture.height * zoom * (0.5f - centreY),
        )
    }

    /**
     * The placement a picture keeps when the post's shape changes to ratio
     * [to]: the frame changes around the picture, never the picture
     * (ComposeCrop.md:19-23). The stage does not change, so the zoom and the
     * offset simply stay; only the new frame's bounds move them, each by the
     * least it asks — the zoom rises to the new fill where it stood below it
     * (never further, never down), and the offset shifts just enough that no
     * edge of the picture comes inside the frame. The web twin's `reshape`.
     */
    fun reshape(placement: CropPlacement, sourceRatio: Float, to: Float, stageWidth: Float = BOARD_WIDTH): CropPlacement {
        val picture = fittedPicture(sourceRatio, stageOf(CropKind.Post, stageWidth))
        val bounds = zoomBounds(CropKind.Post, picture, to, stageWidth)
        return hold(placement, picture, frameOf(CropKind.Post, to, stageWidth).size, bounds)
    }

    /**
     * One step of a gesture: the fingers' centroid stands at [centroid] (stage
     * coordinates from its top-left corner) after travelling [pan] since the
     * last step, and their spread changed by [zoomBy].
     *
     * The point of the picture under the fingers stays under the fingers: the
     * point that stood under the previous centroid (`centroid − pan`) is
     * scaled about by the zoom ACTUALLY taken — the requested one held to the
     * bounds — and carried to the current centroid. Holding the zoom before
     * the anchor is computed is what keeps a pinch at the ceiling or the floor
     * from sliding the picture: at a bound the step is a pure pan.
     */
    @Suppress("LongParameterList")
    fun transformed(
        placement: CropPlacement,
        centroidX: Float,
        centroidY: Float,
        panX: Float,
        panY: Float,
        zoomBy: Float,
        stage: CropSize,
        picture: CropSize,
        frame: CropSize,
        bounds: ZoomBounds,
    ): CropPlacement {
        val step = if (zoomBy.isFinite() && zoomBy > 0f) zoomBy else 1f
        val zoom = holdZoom(placement.zoom * step, bounds)
        val k = zoom / placement.zoom
        val centreX = stage.width / 2f + placement.x
        val centreY = stage.height / 2f + placement.y
        val anchorX = centroidX - panX
        val anchorY = centroidY - panY
        val nextCentreX = centroidX - (anchorX - centreX) * k
        val nextCentreY = centroidY - (anchorY - centreY) * k
        return holdOffset(
            CropPlacement(zoom, nextCentreX - stage.width / 2f, nextCentreY - stage.height / 2f),
            picture,
            frame,
        )
    }

    /**
     * The placement at [zoom], scaled about the frame's centre — the slider's
     * and the zoom actions' move: what stands in the middle of the frame stays
     * there — held to the bounds.
     */
    fun zoomedTo(zoom: Float, placement: CropPlacement, picture: CropSize, frame: CropSize, bounds: ZoomBounds): CropPlacement {
        val held = holdZoom(zoom, bounds)
        val k = held / placement.zoom
        return holdOffset(CropPlacement(held, placement.x * k, placement.y * k), picture, frame)
    }

    /**
     * The picture moved [dx]/[dy] shares of its own laid size (the arrow
     * keys: 1 % a press, 10 % with Shift; ComposeCrop.md), held where its
     * edge meets the frame's. The web twin's `panBy`.
     */
    fun pannedBy(dx: Float, dy: Float, placement: CropPlacement, picture: CropSize, frame: CropSize): CropPlacement =
        holdOffset(
            placement.copy(
                x = placement.x + dx * picture.width * placement.zoom,
                y = placement.y + dy * picture.height * placement.zoom,
            ),
            picture,
            frame,
        )
}
