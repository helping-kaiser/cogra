package com.cogra.core.designsystem.v2.media

import com.cogra.core.designsystem.v2.media.CropGeometry.MAX_ZOOM
import com.cogra.core.designsystem.v2.media.CropGeometry.boardStage
import com.cogra.core.designsystem.v2.media.CropGeometry.fillOf
import com.cogra.core.designsystem.v2.media.CropGeometry.fittedPicture
import com.cogra.core.designsystem.v2.media.CropGeometry.frameOf
import com.cogra.core.designsystem.v2.media.CropGeometry.holdOffset
import com.cogra.core.designsystem.v2.media.CropGeometry.holdZoom
import com.cogra.core.designsystem.v2.media.CropGeometry.placementOf
import com.cogra.core.designsystem.v2.media.CropGeometry.reshape
import com.cogra.core.designsystem.v2.media.CropGeometry.rest
import com.cogra.core.designsystem.v2.media.CropGeometry.stageOf
import com.cogra.core.designsystem.v2.media.CropGeometry.transformed
import com.cogra.core.designsystem.v2.media.CropGeometry.windowOf
import com.cogra.core.designsystem.v2.media.CropGeometry.zoomBounds
import com.cogra.core.designsystem.v2.media.CropGeometry.zoomedTo
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import kotlin.math.roundToInt

/**
 * The geometry against the web twin's vectors (`web/src/lib/ui2/media/crop.test.ts`
 * and `crop-output.test.ts`, PR #467) and the boards' numbers at their 390
 * artboard (ComposeCrop.md:7-13, CoverCrop.md:11, AvatarCrop.md:7). Each test
 * names the web case it ports; the one place the two differ by construction
 * (a picture smaller than the stage, [CropGeometry]'s note) says so.
 */
class CropGeometryTest {

    private val tall = 4f / 5f
    private val square = 1f
    private val wide = 1.91f
    private val w = 390f

    private fun near(actual: Float, expected: Float, within: Float = 1e-4f) =
        assertThat(actual).isWithin(within).of(expected)

    // ---- every stage and frame at the board's 390

    @Test
    fun `keeps one stage per crop, whatever the shape`() {
        assertThat(boardStage(CropKind.Post)).isEqualTo(CropSize(390f, 488f))
        assertThat(boardStage(CropKind.Cover)).isEqualTo(CropSize(390f, 488f))
        assertThat(boardStage(CropKind.Avatar)).isEqualTo(CropSize(390f, 390f))
        assertThat(stageOf(CropKind.Post, w)).isEqualTo(CropSize(390f, 488f))
    }

    @Test
    fun `stands the post's frames full width and centred - Tall fills, Square at 49, Wide at 142`() {
        // 4:5 at 390 is 487.5: the board rounds to the stage's 488; the cut keeps
        // the exact ratio, a quarter pixel above and below.
        assertThat(frameOf(CropKind.Post, tall, w)).isEqualTo(CropFrame(0f, 0.25f, 390f, 487.5f))
        assertThat(frameOf(CropKind.Post, square, w)).isEqualTo(CropFrame(0f, 49f, 390f, 390f))
        val wideFrame = frameOf(CropKind.Post, wide, w)
        assertThat(wideFrame.width).isEqualTo(390f)
        near(wideFrame.height, 204.18848f)
        assertThat(wideFrame.height.roundToInt()).isEqualTo(204)
        assertThat(wideFrame.top.roundToInt()).isEqualTo(142)
        assertThat(wideFrame.left).isEqualTo(0f)
    }

    @Test
    fun `stands the cover's frame 342 wide between the gutters at the clip's shape`() {
        val sixteenNine = frameOf(CropKind.Cover, 16f / 9f, w)
        assertThat(sixteenNine.width).isEqualTo(342f)
        near(sixteenNine.height, 192.375f)
        assertThat(sixteenNine.top.roundToInt()).isEqualTo(148)
        assertThat(sixteenNine.left).isEqualTo(24f)
        assertThat(frameOf(CropKind.Cover, 4f / 5f, w)).isEqualTo(CropFrame(24f, 30.25f, 342f, 427.5f))
        assertThat(frameOf(CropKind.Cover, 1f, w)).isEqualTo(CropFrame(24f, 73f, 342f, 342f))
    }

    @Test
    fun `stands the circle 342 at 24 in the square stage`() {
        assertThat(stageOf(CropKind.Avatar, w)).isEqualTo(CropSize(390f, 390f))
        assertThat(frameOf(CropKind.Avatar, 1f, w)).isEqualTo(CropFrame(24f, 24f, 342f, 342f))
    }

    @Test
    fun `keeps the proportions on a wider screen (the harness's 411 and 412)`() {
        near(stageOf(CropKind.Post, 412f).height, 515.528f, 1e-3f)
        assertThat(frameOf(CropKind.Post, square, 412f).size).isEqualTo(CropSize(412f, 412f))
        val cover = frameOf(CropKind.Cover, 1f, 412f)
        assertThat(cover.size).isEqualTo(CropSize(364f, 364f))
        assertThat(cover.left).isEqualTo(24f)
    }

    @Test
    fun `never lets a frame stand taller than its stage`() {
        val frame = frameOf(CropKind.Cover, 9f / 16f, w)
        near(frame.height, 488f)
        near(frame.width / frame.height, 9f / 16f, 1e-6f)
        near(frame.top, 0f)
    }

    // ---- the zoom's floor and ceiling

    private val stage = stageOf(CropKind.Post, w)
    private val landscape = fittedPicture(4000f / 3000f, stage)
    private val portrait = fittedPicture(3000f / 4000f, stage)

    @Test
    fun `lays the picture fitted whole into the stage`() {
        assertThat(landscape).isEqualTo(CropSize(390f, 292.5f))
        assertThat(portrait).isEqualTo(CropSize(366f, 488f))
        // The web library stands a 200 × 100 picture at its own 200 × 100 CSS
        // pixels; here every picture fits the stage (CropGeometry's note).
        assertThat(fittedPicture(2f, stage)).isEqualTo(CropSize(390f, 195f))
    }

    @Test
    fun `floors the zoom at the frame's fill - the picture just covers the frame`() {
        near(fillOf(landscape, frameOf(CropKind.Post, tall, w).size), 487.5f / 292.5f)
        assertThat(zoomBounds(CropKind.Post, landscape, wide, w).floor).isEqualTo(1f)
        near(zoomBounds(CropKind.Post, portrait, square, w).floor, 390f / 366f)
    }

    @Test
    fun `puts a post's ceiling at 4x of its tallest frame, under every shape`() {
        val tallBounds = zoomBounds(CropKind.Post, landscape, tall, w)
        near(tallBounds.ceiling, 4f * tallBounds.floor)
        for (shape in listOf(square, wide)) {
            near(zoomBounds(CropKind.Post, landscape, shape, w).ceiling, tallBounds.ceiling)
        }
    }

    @Test
    fun `puts a cover's and the circle's ceiling at 4x their own fill`() {
        val cover = zoomBounds(CropKind.Cover, landscape, 16f / 9f, w)
        near(cover.ceiling, MAX_ZOOM * cover.floor)
        val avatar = zoomBounds(CropKind.Avatar, fittedPicture(4f / 3f, stageOf(CropKind.Avatar, w)), 1f, w)
        near(avatar.floor, 342f / 292.5f)
        near(avatar.ceiling, 4f * avatar.floor)
    }

    @Test
    fun `holds a zoom inside the bounds, and a non-number at the floor`() {
        val bounds = ZoomBounds(1.5f, 6f)
        assertThat(holdZoom(1f, bounds)).isEqualTo(1.5f)
        assertThat(holdZoom(9f, bounds)).isEqualTo(6f)
        assertThat(holdZoom(2f, bounds)).isEqualTo(2f)
        assertThat(holdZoom(Float.NaN, bounds)).isEqualTo(1.5f)
    }

    @Test
    fun `covers a tiny picture and a huge one alike`() {
        // A 40 × 30 picture fits the stage like any 4:3 one (the web library's
        // floor of 487.5 / 30 is in its own-pixel units; the share is the same).
        val tiny = fittedPicture(40f / 30f, stage)
        near(zoomBounds(CropKind.Post, tiny, tall, w).floor, 487.5f / 292.5f)
        val huge = fittedPicture(30000f / 2000f, stage)
        assertThat(huge.width).isEqualTo(390f)
        near(zoomBounds(CropKind.Post, huge, wide, w).floor, 204.18848f / 26f, 1e-3f)
    }

    @Test
    fun `stops the picture where its edge meets the frame's`() {
        val frame = frameOf(CropKind.Post, wide, w).size
        // At 2× the landscape lays 780 × 585: x may reach 195, y (585 − 204.19) / 2.
        val held = holdOffset(CropPlacement(2f, 400f, -400f), landscape, frame)
        assertThat(held.x).isEqualTo(195f)
        near(held.y, -(585f - frame.height) / 2f)
        assertThat(holdOffset(CropPlacement(2f, 10f, 5f), landscape, frame)).isEqualTo(CropPlacement(2f, 10f, 5f))
    }

    // ---- reshape: the frame changes around the picture (ComposeCrop.md:19-23)

    @Test
    fun `keeps the scale and the position, tall to square to wide`() {
        val start = CropPlacement(1.5f, 20f, -30f)
        val squared = reshape(start, 3f / 4f, square)
        assertThat(squared).isEqualTo(start)
        assertThat(reshape(squared, 3f / 4f, wide)).isEqualTo(start)
    }

    @Test
    fun `raises the scale to the new frame's fill, and no further`() {
        near(reshape(CropPlacement(1f, 0f, 0f), 4f / 3f, tall).zoom, 487.5f / 292.5f)
    }

    @Test
    fun `never shrinks the picture to fit the new frame`() {
        assertThat(reshape(CropPlacement(6f, 0f, 0f), 4f / 3f, wide).zoom).isEqualTo(6f)
        assertThat(reshape(CropPlacement(6f, 0f, 0f), 4f / 3f, tall).zoom).isEqualTo(6f)
    }

    @Test
    fun `shifts the picture just enough that its edge meets the new frame's`() {
        // Wide, 1×: the landscape lays 390 × 292.5 and the frame is 390 × 204.19,
        // so y may reach 44.15. Square at the same scale: the fill rises to
        // 390 / 292.5 and y comes to (390 − 390) / 2 = 0.
        val start = CropPlacement(1f, 0f, 44f)
        assertThat(reshape(start, 4f / 3f, wide).y).isEqualTo(44f)
        val squared = reshape(start, 4f / 3f, square)
        near(squared.zoom, 390f / 292.5f)
        near(squared.y, 0f)
    }

    @Test
    fun `reshapes the same at any stage width - the post's geometry is proportional`() {
        val at390 = CropPlacement(2f, 30f, -12f)
        val at411 = CropPlacement(2f, 30f * 411f / 390f, -12f * 411f / 390f)
        val a = windowOf(reshape(at390, 4f / 3f, wide, 390f), landscape, frameOf(CropKind.Post, wide, 390f).size)
        val stage411 = stageOf(CropKind.Post, 411f)
        val b = windowOf(
            reshape(at411, 4f / 3f, wide, 411f),
            fittedPicture(4f / 3f, stage411),
            frameOf(CropKind.Post, wide, 411f).size,
        )
        near(a.left, b.left)
        near(a.top, b.top)
        near(a.width, b.width)
        near(a.height, b.height)
    }

    // ---- the output: what the frame shows, as fractions of the source

    /** The largest [ratio] rectangle of a [sourceRatio] picture, centred — `sourceRect`, the encoder's fallback. */
    private fun centred(sourceRatio: Float, ratio: Float): CropFraming = if (sourceRatio > ratio) {
        val width = ratio / sourceRatio
        CropFraming((1f - width) / 2f, 0f, (1f + width) / 2f, 1f)
    } else {
        val height = sourceRatio / ratio
        CropFraming(0f, (1f - height) / 2f, 1f, (1f + height) / 2f)
    }

    private val sources = listOf(
        "a camera landscape" to 4000f / 3000f,
        "a camera portrait" to 3000f / 4000f,
        "a square" to 1f,
        "a panorama" to 12000f / 2000f,
        "a phone screenshot" to 1170f / 2532f,
        "a tiny picture" to 40f / 30f,
    )

    private val frames = listOf(
        Triple("Tall", CropKind.Post, tall),
        Triple("Square", CropKind.Post, square),
        Triple("Wide", CropKind.Post, wide),
        Triple("a 16:9 cover", CropKind.Cover, 16f / 9f),
        Triple("a tall cover", CropKind.Cover, 4f / 5f),
        Triple("a comment's square cover", CropKind.Cover, 1f),
        Triple("the circle", CropKind.Avatar, 1f),
    )

    @Test
    fun `cuts every picture at rest as the largest rectangle of the shape, centred`() {
        for ((what, sourceRatio) in sources) {
            for ((frameName, kind, ratio) in frames) {
                for (width in listOf(390f, 411f, 412f)) {
                    val picture = fittedPicture(sourceRatio, stageOf(kind, width))
                    val frame = frameOf(kind, ratio, width).size
                    val window = windowOf(rest(zoomBounds(kind, picture, ratio, width)), picture, frame)
                    val expected = centred(sourceRatio, ratio)
                    val label = "$what under $frameName at $width"
                    assertThat(window.left).named(label).isWithin(1e-5f).of(expected.left)
                    assertThat(window.top).named(label).isWithin(1e-5f).of(expected.top)
                    assertThat(window.right).named(label).isWithin(1e-5f).of(expected.right)
                    assertThat(window.bottom).named(label).isWithin(1e-5f).of(expected.bottom)
                }
            }
        }
    }

    @Test
    fun `uploads the region the reader framed - the web twin's moved vector`() {
        // A 4000 × 3000 landscape framed Square: its right part, 1500 × 1500
        // from (2500, 750), on the 390 stage under the 390 square frame.
        val frame = frameOf(CropKind.Post, square, w).size
        val zoom = frame.width * 4000f / (1500f * landscape.width)
        val perPixel = landscape.width * zoom / 4000f
        val placement = CropPlacement(zoom, -(2500f + 750f - 2000f) * perPixel, -(750f + 750f - 1500f) * perPixel)
        val window = windowOf(placement, landscape, frame)
        near(window.left * 4000f, 2500f, 1e-2f)
        near(window.top * 3000f, 750f, 1e-2f)
        near(window.width * 4000f, 1500f, 1e-2f)
        near(window.height * 3000f, 1500f, 1e-2f)
    }

    @Test
    fun `puts a window back exactly where it was framed`() {
        for ((_, sourceRatio) in sources) {
            for ((_, kind, ratio) in frames) {
                val picture = fittedPicture(sourceRatio, stageOf(kind, w))
                val frame = frameOf(kind, ratio, w).size
                val bounds = zoomBounds(kind, picture, ratio, w)
                val moved = CropGeometry.hold(CropPlacement(bounds.floor * 2.3f, 17f, -23f), picture, frame, bounds)
                val window = windowOf(moved, picture, frame)
                val back = placementOf(window, picture, frame)
                near(back.zoom, moved.zoom, 1e-3f)
                near(back.x, moved.x, 1e-2f)
                near(back.y, moved.y, 1e-2f)
            }
        }
    }

    // ---- the gesture step

    private val tallFrame = frameOf(CropKind.Post, tall, w).size
    private val tallBounds = zoomBounds(CropKind.Post, landscape, tall, w)

    /** Where a stage point stands on the laid picture, as a fraction of it. */
    private fun pictureFraction(placement: CropPlacement, stageX: Float, stageY: Float): Pair<Float, Float> {
        val left = stage.width / 2f + placement.x - landscape.width * placement.zoom / 2f
        val top = stage.height / 2f + placement.y - landscape.height * placement.zoom / 2f
        return (stageX - left) / (landscape.width * placement.zoom) to (stageY - top) / (landscape.height * placement.zoom)
    }

    @Test
    fun `keeps the point under the fingers under the fingers while they pinch and move`() {
        val start = CropPlacement(2.2f, 0f, 0f)
        val before = pictureFraction(start, 180f, 260f)
        // The fingers' centroid travels 6 right and 4 down while they spread 10 %.
        val next = transformed(start, 186f, 264f, 6f, 4f, 1.1f, stage, landscape, tallFrame, tallBounds)
        assertThat(next.zoom).isWithin(1e-4f).of(2.42f)
        val after = pictureFraction(next, 186f, 264f)
        near(after.first, before.first)
        near(after.second, before.second)
    }

    @Test
    fun `holds a pinch at the ceiling to a pure pan, never a slide`() {
        val atCeiling = CropPlacement(tallBounds.ceiling, 0f, 0f)
        val next = transformed(atCeiling, 100f, 100f, 3f, -2f, 1.5f, stage, landscape, tallFrame, tallBounds)
        assertThat(next).isEqualTo(CropPlacement(tallBounds.ceiling, 3f, -2f))
    }

    @Test
    fun `holds a pinch at the floor, and the picture never leaves the frame`() {
        val atFloor = rest(tallBounds)
        val next = transformed(atFloor, 50f, 400f, 0f, 0f, 0.5f, stage, landscape, tallFrame, tallBounds)
        assertThat(next.zoom).isEqualTo(tallBounds.floor)
        assertThat(windowOf(next, landscape, tallFrame).left).isAtLeast(0f)
    }

    @Test
    fun `zooms the slider about the frame's centre`() {
        val start = CropPlacement(2f, 40f, -10f)
        val before = pictureFraction(start, stage.width / 2f, stage.height / 2f)
        val next = zoomedTo(3f, start, landscape, tallFrame, tallBounds)
        val after = pictureFraction(next, stage.width / 2f, stage.height / 2f)
        near(after.first, before.first)
        near(after.second, before.second)
    }
}
