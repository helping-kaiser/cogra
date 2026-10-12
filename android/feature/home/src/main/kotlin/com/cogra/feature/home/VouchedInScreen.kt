// THE CEREMONY (`VouchedIn`; behavior/VouchedIn.md) — the vouch-back's own
// ending: the reader's opinion on the member who vouched them in is signed,
// the pair is complete, and the feed they see from here is their own. The
// web's twin is `(app)/vouched-in/vouched-in-view.tsx`.
//
// It opens wherever the vouch-back's signing was taken — the vouch card's pad,
// or the voucher's profile anchor, by Set or by the hold (VouchedIn.md:3) —
// and shows while that opinion is signed and still settling (:5). A
// vouch-back that expires raises only the ordinary did-not-land notice (:37).
//
// NO BACK ARROW AND NO BOTTOM BAR (:7). `Go to your feed` is the one way on
// (:9), and Android's Back does exactly what it does (:35): the member's own
// feed, never the pad or the card behind it — the destination is pushed over
// the feed root alone, so the back stack holds neither.
//
// THE MOTION is the one declared exception to "nothing inside an arriving
// screen animates" (readme §4; `VouchedIn.jsx`) and spends only existing
// tokens: every offset is a sum of the durations the phases run on. The sky
// stands from the first frame; only the reader's point, its halo, its edge and
// the words move (:13, :25). A tap anywhere completes every phase at once
// (:29); a reader who asked for stillness — the animator scale at zero — gets
// the resting state whole (:31), which is what the board draws.

package com.cogra.feature.home

import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Duration
import com.cogra.core.designsystem.v2.token.Ease
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** The ceremony's registered prefix (`VouchedIn`). */
private val VOUCHED_IN = DataNode("vouchedIn")

/**
 * When each phase begins, measured from the screen's arrival — sums of the
 * durations, never a bespoke number (`VouchedIn.jsx` "THE MOTION").
 */
object CeremonyTimeline {
    const val POINT = Duration.NAV_FORWARD
    const val HALO = POINT + Duration.MEDIUM_2
    const val EDGE = HALO + Duration.MEDIUM_2
    const val WORDS = HALO + Duration.LONG_2
    const val LANDED = WORDS + Duration.MEDIUM_4
}

/** Where the ceremony stands; the screen exposes it as its state description. */
enum class CeremonyStage { ARRIVING, POINT, HALO, EDGE, WORDS, LANDED }

private const val SKY_W = 390f
private const val SKY_H = 560f
private const val VOUCHER_X = 240f
private const val VOUCHER_Y = 288f
private const val VOUCHER_R = 16f
private const val READER_X = 195f
private const val READER_Y = 516f
private const val READER_R = 8f
private const val POINT_RISE_DP = 24f
private const val WORDS_RISE_DP = 8f
private const val HALO_ALPHA = 0.4f

/** A hairline between two accounts, in the board's coordinates. */
private class Hairline(val x1: Float, val y1: Float, val x2: Float, val y2: Float)

/** An account's disc: where, how big, and whether it is near (`primaryContainer`). */
private class Disc(val x: Float, val y: Float, val r: Float, val near: Boolean = false)

/** The network that was there before the reader arrived — it never builds. */
private val HAIRLINES = listOf(
    Hairline(52f, 136f, 110f, 78f),
    Hairline(110f, 78f, 206f, 142f),
    Hairline(206f, 142f, 300f, 132f),
    Hairline(300f, 132f, 348f, 222f),
    Hairline(150f, 212f, 206f, 142f),
    Hairline(84f, 286f, 150f, 212f),
    Hairline(330f, 344f, 348f, 222f),
    Hairline(150f, 212f, 176f, 330f),
    Hairline(120f, 378f, 84f, 286f),
    Hairline(206f, 142f, 236.1f, 271.4f),
    Hairline(254.4f, 297.0f, 330f, 344f),
    Hairline(225.8f, 297.3f, 176f, 330f),
)

/** The accounts, drawn as the board draws them (`VouchedIn.jsx`). */
private val DISCS = listOf(
    Disc(110f, 78f, 3f), Disc(262f, 64f, 3f), Disc(52f, 136f, 4f),
    Disc(300f, 132f, 7f, near = true), Disc(206f, 142f, 5f), Disc(150f, 212f, 6f, near = true),
    Disc(62f, 216f, 3f), Disc(348f, 222f, 4f), Disc(84f, 286f, 5f), Disc(176f, 330f, 3f),
    Disc(330f, 344f, 5f), Disc(120f, 378f, 4f), Disc(38f, 392f, 3f), Disc(286f, 430f, 3f),
)

/** The reader's edge, from their point's rim out to the voucher's. */
private val EDGE_FROM = Offset(196.9f, 506.2f)
private val EDGE_TO = Offset(236.5f, 305.7f)

/** Whether the reader asked for stillness: the animator scale at zero. */
@Composable
private fun reducedMotion(): Boolean {
    val context = LocalContext.current
    return remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

/**
 * The ceremony's motion: four values that run 0 → 1 on their own tokens, and
 * the stage they have reached. [completeAtOnce] snaps every one to rest.
 */
@Stable
private class Ceremony(still: Boolean) {
    val point = Animatable(if (still) 1f else 0f)
    val halo = Animatable(if (still) 1f else 0f)
    val edge = Animatable(if (still) 1f else 0f)
    val words = Animatable(if (still) 1f else 0f)
    var stage by mutableStateOf(if (still) CeremonyStage.LANDED else CeremonyStage.ARRIVING)

    /** Each phase from its own offset, on its own duration and easing. */
    suspend fun run() = coroutineScope {
        phase(CeremonyTimeline.POINT, CeremonyStage.POINT, point, Duration.LONG_2, Ease.EmphasizedDecelerate)
        phase(CeremonyTimeline.HALO, CeremonyStage.HALO, halo, Duration.MEDIUM_2, Ease.StandardDecelerate)
        phase(CeremonyTimeline.EDGE, CeremonyStage.EDGE, edge, Duration.LONG_2, Ease.Standard)
        phase(CeremonyTimeline.WORDS, CeremonyStage.WORDS, words, Duration.MEDIUM_4, Ease.StandardDecelerate)
        launch {
            delay(CeremonyTimeline.LANDED.toLong())
            stage = CeremonyStage.LANDED
        }
    }

    private fun CoroutineScope.phase(
        at: Int,
        reached: CeremonyStage,
        value: Animatable<Float, AnimationVector1D>,
        duration: Int,
        easing: Easing,
    ) = launch {
        delay(at.toLong())
        stage = reached
        value.animateTo(1f, tween(duration, easing = easing))
    }

    suspend fun completeAtOnce() {
        point.snapTo(1f)
        halo.snapTo(1f)
        edge.snapTo(1f)
        words.snapTo(1f)
    }
}

@Composable
fun VouchedInScreen(
    handle: String,
    name: String,
    avatarUrl: String?,
    onGoToFeed: () -> Unit,
    still: Boolean = reducedMotion(),
) {
    // Android's Back is Go to your feed (VouchedIn.md:35).
    BackHandler(onBack = onGoToFeed)
    val ceremony = remember { Ceremony(still) }
    val scope = rememberCoroutineScope()
    var timeline by remember { mutableStateOf<Job?>(null) }
    LaunchedEffect(Unit) {
        if (!still) timeline = scope.launch { ceremony.run() }
    }
    // A tap while the motion runs completes it (:29), and is not also a
    // press on the button: the press that lands the words is spent.
    var swallowNextPress by remember { mutableStateOf(false) }
    val completeAtOnce: () -> Unit = {
        swallowNextPress = ceremony.stage != CeremonyStage.LANDED
        if (swallowNextPress) {
            timeline?.cancel()
            scope.launch { ceremony.completeAtOnce() }
            ceremony.stage = CeremonyStage.LANDED
        }
    }
    Surface(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(pass = PointerEventPass.Initial)
                    completeAtOnce()
                }
            }
            .semantics { stateDescription = ceremony.stage.name }
            .testTag("vouchedIn"),
    ) {
        // The words take what the sky leaves, as drawn; a window too short
        // for both scrolls rather than cutting the one way on off.
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wordsMin = (maxHeight - SKY_H.dp).coerceAtLeast(0.dp)
            Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                CeremonySky(ceremony, name, avatarUrl, Modifier.align(Alignment.CenterHorizontally))
                CeremonyWords(
                    handle = handle,
                    words = ceremony.words.value,
                    // No press until the words have landed (:27).
                    onGoToFeed = {
                        if (swallowNextPress) {
                            swallowNextPress = false
                        } else if (ceremony.stage == CeremonyStage.LANDED) {
                            onGoToFeed()
                        }
                    },
                    modifier = Modifier.heightIn(min = wordsMin),
                )
            }
        }
    }
}

/** The sky: `SkyField`'s vocabulary, the reader's point, halo and edge on it. */
@Composable
private fun CeremonySky(ceremony: Ceremony, name: String, avatarUrl: String?, modifier: Modifier) {
    val primary = MaterialTheme.colorScheme.primary
    val near = MaterialTheme.colorScheme.primaryContainer
    val far = MaterialTheme.colorScheme.outline
    val hairline = MaterialTheme.colorScheme.outlineVariant
    // The drawn 390 × 560 frame, scaled down whole on a narrower phone.
    BoxWithConstraints(
        modifier = modifier
            .widthIn(max = SKY_W.dp)
            .fillMaxWidth()
            .aspectRatio(SKY_W / SKY_H)
            .dataNode(VOUCHED_IN / "sky"),
    ) {
        val scale = maxWidth.value / SKY_W
        Canvas(Modifier.fillMaxSize()) {
            val u = size.width / SKY_W
            HAIRLINES.forEach {
                drawLine(hairline, Offset(it.x1 * u, it.y1 * u), Offset(it.x2 * u, it.y2 * u), 1.dp.toPx())
            }
            DISCS.forEach { drawCircle(if (it.near) near else far, it.r * u, Offset(it.x * u, it.y * u)) }
            // The reader's edge draws outward to the voucher's rim.
            val from = EDGE_FROM * u
            val to = EDGE_TO * u
            val drawn = ceremony.edge.value
            if (drawn > 0f) {
                drawLine(primary, from, from + (to - from) * drawn, 1.5.dp.toPx(), cap = StrokeCap.Round)
            }
            val shown = ceremony.point.value
            val at = Offset(READER_X * u, READER_Y * u + (1f - shown) * POINT_RISE_DP.dp.toPx())
            // The halo opens from the point's radius to twice it, and stays.
            drawCircle(
                primary.copy(alpha = HALO_ALPHA * shown),
                READER_R * u * (1f + ceremony.halo.value),
                at,
                style = Stroke(width = 1.dp.toPx()),
            )
            drawCircle(primary.copy(alpha = shown), READER_R * u, at)
        }
        // The voucher carries their actual face — the only identified point.
        CograAvatar(
            name = name,
            size = (VOUCHER_R * 2).dp,
            url = avatarUrl,
            testTag = "vouchedIn_voucher",
            modifier = Modifier.offset(((VOUCHER_X - VOUCHER_R) * scale).dp, ((VOUCHER_Y - VOUCHER_R) * scale).dp),
        )
    }
}

/** The words: headline, subline and the one way on, arriving together. */
@Composable
private fun CeremonyWords(handle: String, words: Float, onGoToFeed: () -> Unit, modifier: Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 24.dp, end = 24.dp, bottom = 32.dp)
            .graphicsLayer {
                alpha = words
                translationY = (1f - words) * WORDS_RISE_DP.dp.toPx()
            }
            .testTag("vouchedIn_words"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = stringResource(R.string.vouched_in_title),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
            modifier = Modifier.dataNode(VOUCHED_IN / "title"),
        )
        Text(
            text = stringResource(R.string.vouched_in_body, handle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(top = 8.dp)
                .widthIn(max = 300.dp)
                .dataNode(VOUCHED_IN / "body"),
        )
        CograButton(
            text = stringResource(R.string.vouched_in_go_to_feed),
            onClick = onGoToFeed,
            modifier = Modifier.padding(top = 32.dp),
            testTag = (VOUCHED_IN / "onward").tag,
        )
    }
}
