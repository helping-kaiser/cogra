// CoGra's signature interaction (design/readme.md §8), as pure UI — the
// master is `design/components/stance/StanceControl.jsx`.
//
// AT REST the target shows the current opinion: its face, and the folded
// pair beside it only in geek mode. A viewer with no opinion yet sees a
// muted, translucent 🫥. A TAP blooms the pad at one fixed spot — the lower
// centre of the viewport, 16dp above the bottom bar where the surface has
// one — and stages nothing; a PRESS-AND-HOLD of 500ms signs the modest
// positive (+0.10, +0.10) outright, a ring filling round the face while it
// is held. On the open pad the reader drags the field, a release parks the
// pick, and only an explicit Set signs.
//
// THE OPEN PAD'S ANATOMY (StanceControl.jsx, PadStanding.md): the wash over
// the shell; a 272dp card on `surfaceContainerHigh` at the extra-large
// rung; the circled `?` in its top-right corner; `Current opinion` and
// `Your pick` above the field; the field with its four pole words in the
// gutters around it; the shell's note slot; `Resulting opinion` below; and
// ONE commit row — `Walk it back` on the left, pushed away from `Cancel`
// and `Set` on the right.
//
// The control owns its touches: nothing it is given may also reach the
// surface underneath it.
//
// Everything here takes doubles and lambdas: `core:designsystem` holds no
// domain types, so [StancePoint] is the field's own coordinate and the
// feature module maps it.

package com.cogra.core.designsystem

import android.view.HapticFeedbackConstants
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.input.pointer.PointerEventTimeoutCancellationException
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.media.CoverKind
import com.cogra.core.designsystem.v2.media.CoversSurface
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filterNotNull
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Which surface the control offers for picking (design.md §8.6), as the
 * design system's own vocabulary — `core:designsystem` holds no domain
 * types, so the feature module maps the stored preference onto this.
 */
enum class StanceInputSurface { PAD, SLIDERS, ENTRY }

/** Where the control's considered route is: shut, the parked pad, or the alternates. */
enum class StancePadMode {
    CLOSED,

    /** Parked open by the tap that bloomed it. */
    STICKY,

    /**
     * The alternates (`StanceAlternates`): the non-drag route, opened by
     * `Choose your opinion on …` from any face, and by the tap itself for a
     * reader whose chosen input is sliders or typed values (design.md §8.6).
     */
    ALTERNATES,
}

/**
 * Where a pick leaves the bundle, as the caller was told by the fold
 * (design.md §8.2). Never computed here.
 */
@Immutable
data class StanceLanding(
    val net: StancePoint,
    val inertDirected: Boolean,
    val inertInterest: Boolean,
    val severance: Boolean,
    /**
     * A `(0, 0)` landing over a bundle where nothing stands — no record ever,
     * or already walked back (`localLanding`'s `nothingStands`): the empty
     * sign's, never a walk-back. It reads `Resulting opinion 🤷 Says nothing.`
     */
    val empty: Boolean = false,
)

/**
 * The walk-back's content (`SeveranceConfirm`): what the reader stands at,
 * and what reaching zero takes — one signed act per counter-record.
 */
@Immutable
data class SeverancePrompt(
    /** The fold — what the feed reads of the bundle; the cap aside quotes it. */
    val standing: StancePoint,
    /**
     * The RAW sums the walk-back walks, before the clip. The total LEADS: the
     * count of things signed is sized by the raw history, so quoting the
     * clipped fold first makes the price unexplainable (*Two numbers, never
     * one*).
     */
    val raw: StancePoint,
    val records: Int,
    val alreadySevered: Boolean,
    /** Arrived as the result of an ordinary pick rather than the route; carries the pick line. */
    val fromPick: Boolean,
    val working: Boolean = false,
    val failed: Boolean = false,
    /** The pick that raised it, for the pick line; null on the explicit route. */
    val pick: StancePoint? = null,
    /**
     * How many records the bundle holds (`recordCount`). Zero is the one case
     * with no total to state — `No opinion on … yet.` — and it is decided
     * here, never by the sum: an empty sign's standing sums to (0, 0) and is
     * still something said.
     */
    val bundleRecords: Int,
    /**
     * The write rule refused the walk-back (round 21, ask 15): a notice, not a
     * fault — the quiet line where the fault line would stand, the act dimmed,
     * no Retry; `Keep it` returns to the pick.
     */
    val writeRule: Boolean = false,
)

/**
 * The empty sign's ask (`EmptySignConfirm`): a pick landing exactly `(0, 0)`
 * while nothing stands — no record ever signed, or a bundle already walked
 * back. Only the signing's progress varies; the words are fixed.
 */
@Immutable
data class EmptySignPrompt(
    val working: Boolean = false,
    val failed: Boolean = false,
    /** The write rule refused the empty sign — [SeverancePrompt.writeRule]'s state. */
    val writeRule: Boolean = false,
)

@Immutable
data class StanceControlState(
    val pick: StancePoint = StancePoint.Origin,
    val pad: StancePadMode = StancePadMode.CLOSED,
    /** The viewer's folded standing; null while unknown or unauthored. */
    val standing: StancePoint? = null,
    /**
     * The standing is a bundle WALKED BACK to nothing (`StanceBundle.severed`).
     * A standing at `(0, 0)` that is not severed is an empty sign's: it says
     * nothing, and it is never read as a walk-back.
     */
    val severed: Boolean = false,
    /** Where [pick] leaves the bundle; null while the fold is in flight. */
    val landing: StanceLanding? = null,
    val busy: Boolean = false,
    val failed: Boolean = false,
    /** The failure was a husk device: the key has to come back first. */
    val needsKey: Boolean = false,
    /** The reader's chosen input surface (design.md §8.6). */
    val inputMode: StanceInputSurface = StanceInputSurface.PAD,
    val severance: SeverancePrompt? = null,
    /** The empty sign's ask, open over the parked pad; see [EmptySignPrompt]. */
    val emptySign: EmptySignPrompt? = null,
    /**
     * This open is the account's first-ever pad open, so the pad carries
     * the two coaching lines (stance-control.md "Teaching it").
     */
    val coaching: Boolean = false,
    /**
     * A stance just signed, as the standing it left the reader at — the
     * transient confirmation, always the ordinary `Current opinion` line: a
     * standing at `(0, 0)` here is an empty sign's (jakob 2026-10-21). A
     * one-shot: the control shows it once and reports it back through
     * `onConfirmationShown`.
     */
    val confirmation: StancePoint? = null,
    /**
     * A walk-back just taken, as the number of things it signed — the same
     * one-shot as [confirmation], read as `Signed 3 things, still settling.
     * You've walked … back to nothing.` A pick that walked the bundle back
     * confirms here, with 1.
     */
    val walkedBack: Int? = null,
    /**
     * THE READER STILL BORROWS A VIEW (jakob 2026-10-20; the master's
     * `borrowed`): they hold no outgoing opinion with neither number at
     * zero. An unreachable or severed landing then warns that the pick
     * keeps the borrowed view. Warns, never blocks.
     */
    val borrowed: Boolean = false,
    /**
     * THE WRITE RULE REFUSED THE SIGNING (PadWriteRule.md): a notice, not a
     * fault. The pad keeps the pick and its field, and the notice stands
     * where the landing line and the commit row were, with `Not now`; on the
     * row, a quiet line and no Retry.
     */
    val writeRule: Boolean = false,
    /**
     * THE SIGNING KEY IS NOT IN THIS APP (PadKeyAbsent.md): the pad still
     * opens and the pick is still made, and the key notice stands where the
     * landing line and the actions would — no Set, no Cancel, no Walk it back.
     */
    val keyAbsent: Boolean = false,
)

/**
 * Where `Restore the key` goes — the app's own restore route, provided by
 * the shell the way the snackbar host is: the control is a leaf inside a
 * card inside a feed, and the route is the navigation graph's. Null where
 * no shell provides one (a preview, a test).
 */
val LocalOnRestoreKey = compositionLocalOf<(() -> Unit)?> { null }

/**
 * A PAD OPENED AS SOMETHING IN PARTICULAR — the vouch-back
 * (`VouchBackPad.md`; the master's own additive props in
 * `StanceControl.jsx`: `helpLabel`, `help`, `padNote`, `padInset`). Off by
 * default, so every other host draws exactly the master it always did.
 *
 * The variant changes what the pad SAYS and where it parks; the gesture law
 * is the master's and is not touched — a tap opens the pad, a hold signs
 * the default, Set signs the pick. Where a taken signing goes is the
 * host's (the route's `onTaken`).
 */
@Immutable
data class StancePadVariant(
    /** The pad's title and its `?`'s name (VouchBackPad.md:9). */
    val title: String,
    /** The help that replaces the pad's body in place (:21). */
    val help: List<String>,
    /** The line the variant carries on every open, above the coaching (:13). */
    val note: String,
    /** The registered pad (`<host>.stance.pad`, ruling 40); its parts wear its paths. */
    val padNode: DataNode? = null,
    /** 16dp above the bar (`--bottom-bar-height` 64 + 16, :3). */
    val padInset: Dp = 80.dp,
)

/**
 * How long a signed act may stay unanswered before it says it is still
 * working — Set's `Setting…`, the row's `Signing…` (the failure pack).
 */
const val SETTING_AFTER_MS = 200L

/**
 * THE PAD PARKS 16dp ABOVE THE BOTTOM BAR where the surface has one, and
 * 16dp off the bottom edge where it does not (PadStanding.md:15; the
 * master's `padInset`). The shell provides the bar's standoff — `--bottom-
 * bar-height` 64 + 16 — while it draws the bar; a surface without one
 * reads the default.
 */
val LocalPadBottomInset = compositionLocalOf { 16.dp }

/** The resting target keeps the platform's minimum (design.md §4, §10). */
private val TARGET_MIN = 48.dp

/** The wide anchor's height (`wide` — the outline button's clothes, 40px). */
private val WIDE_TARGET_MIN = 40.dp

/**
 * The face an unauthored target wears (design.md §8.3). Deliberately a
 * face the readout table never produces, so an empty control can never
 * be misread as a standing the reader already holds.
 */
private const val RESTING_FACE = "🫥"

/**
 * Muted and translucent (`--opacity-resting-face`, design/readme.md §4 —
 * "the resting stance face at 40% opacity"). Deliberately NOT the 0.38
 * disabled opacity it looks like: the resting face is not a disabled
 * control.
 */
internal const val RESTING_FACE_ALPHA = 0.4f

/**
 * What the empty resting face is drawn as: the muted 🫥 everywhere
 * ([RESTING_FACE_ALPHA]), or — where the host hands an ink (the vouch card) —
 * the line face in that ink at full opacity (stance-control.md, jakob
 * 2026-10-14).
 */
internal sealed interface EmptyFace {
    data object MutedEmoji : EmptyFace

    data class Line(val ink: Color) : EmptyFace
}

internal fun emptyFaceFor(lineFaceInk: Color?): EmptyFace =
    if (lineFaceInk == null) EmptyFace.MutedEmoji else EmptyFace.Line(lineFaceInk)

/**
 * The muted face's `filter: grayscale(1)` (StanceControl.jsx:587): drawn
 * through a layer whose colour matrix has zero saturation — the platform's
 * own grayscale, the same luminance weights the CSS filter uses — so the
 * waiting control never carries the emoji's colour as if it were a value.
 */
internal fun Modifier.desaturated(): Modifier = drawWithCache {
    val paint = Paint().apply {
        colorFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })
    }
    onDrawWithContent {
        drawIntoCanvas { canvas ->
            canvas.saveLayer(Rect(Offset.Zero, size), paint)
            drawContent()
            canvas.restore()
        }
    }
}

/** The open pad's width — the master's `17rem` (StanceControl.jsx:661). */
internal val PAD_WIDTH = 272.dp

/** `--radius-extra-large`, the rung every parked pad and sheet wears. */
private val PAD_CORNER = 28.dp

/** The hold's ring: M3's determinate circular indicator, 40dp with a 4dp stroke (`HoldRing`). */
private val HOLD_RING = 40.dp
private val HOLD_RING_STROKE = 4.dp

/** `--scrim-dialog`: the scrim at 50% (design/tokens/semantic.css). */
private const val SCRIM_DIALOG_ALPHA = 0.5f

/** The bloom: the dialog's entrance — a 200ms fade and an 8dp rise (readme §4 *Motion*). */
private const val BLOOM_MS = 200
private val BLOOM_RISE = 8.dp

/**
 * The face's accessible name, in the order the reader needs it (copy-voice
 * *The face's names*): `Give your opinion on this post` with nothing given,
 * and once given `Your opinion on this post: Like this, +0.55 / +0.20.
 * Press and hold to add a positive one.`
 */
@Composable
private fun targetDescription(
    standing: StancePoint?,
    severed: Boolean,
    zeroWords: StanceZeroWords,
    target: String,
): String =
    if (standing == null) {
        stringResource(R.string.stance_target_give, target)
    } else {
        stringResource(
            R.string.stance_target_given,
            target,
            stringResource(restingReadout(standing, severed, zeroWords).label),
            standing.pair(),
        )
    }

/**
 * The face the target rests in (`restingFace`): a `(0, 0)` is walked back
 * only when the bundle says so — the family's own word — and otherwise an
 * empty sign's, which says nothing.
 */
private fun restingReadout(standing: StancePoint, severed: Boolean, zeroWords: StanceZeroWords): StanceAnchor =
    bundleReadout(standing, if (severed) zeroWords.zeroLabel else EMPTY_PICK_LABEL)

/**
 * The stance control: the resting target, the pad it blooms, the
 * alternates, and the walk-back confirmation either can reach.
 *
 * [onOpenPad] is the tap: it parks the pad open (or the alternates, for a
 * reader who chose them) and stages nothing. [onHoldDefault] is the
 * press-and-hold: it commits the low default without opening anything.
 * [onOpenAlternates] is the non-drag door, `Choose your opinion on …`.
 * [onCommit] is Set (or the alternates' `Sign it`) and reaches this file
 * from nowhere else — a release never signs.
 */
@Composable
fun StanceControl(
    state: StanceControlState,
    onHoldDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onDismissPad: () -> Unit,
    onOpenAlternates: () -> Unit,
    onOpenSeverance: () -> Unit,
    onConfirmSeverance: () -> Unit,
    onDismissSeverance: () -> Unit,
    onConfirmationShown: () -> Unit,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    /**
     * The record family's own words for the two slots it fills — its two
     * questions and its four poles. The control owns the geometry; the
     * family owns the words, passed unchanged to the field, every readout
     * and the alternates alike.
     */
    axes: StanceAxes = StanceAxes.Opinion,
    /** The family's words for reaching zero — a topic disconnects (jakob's I2 ruling). */
    zeroWords: StanceZeroWords = StanceZeroWords.Severed,
    /**
     * What this control stances toward, in the reader's own words —
     * `@ada`, `#saltmaps`. Null reads as the master's default, `this post`.
     */
    targetLabel: String? = null,
    /**
     * Stretched to the column in the outline button's clothes, as a page's
     * one primary action rather than an anchor inside a card (`wide`). Only
     * the resting target changes — the pad is the same surface wherever it
     * was opened from.
     */
    wide: Boolean = false,
    /**
     * The control's data-node on a registered screen
     * (`feed.card.actionRow.stance`): the control, its resting target and
     * the target's face and pair then wear the registered paths.
     */
    node: DataNode? = null,
    /** The pad opened as something in particular; see [StancePadVariant]. */
    variant: StancePadVariant? = null,
    /**
     * A host that IS the opening gesture — the vouch card's `Vouch back`
     * (VouchBack.md:31) — draws no resting target of its own: only the pad,
     * whose open state the holder already carries.
     */
    padOnly: Boolean = false,
    /**
     * THE VOUCH CARD'S EMPTY FACE IS A LINE FACE IN THE CARD'S INK (the
     * master's `lineFaceInk`). Only the empty resting face is affected; null
     * by default, so every other host keeps the muted face.
     */
    lineFaceInk: Color? = null,
    /** `Set it anyway` on the empty sign's ask: signs the one empty record. */
    onConfirmEmptySign: () -> Unit = {},
    /** `Keep it`, the scrim or Back on the empty sign's ask: the pad keeps its pick. */
    onDismissEmptySign: () -> Unit = {},
    /**
     * THE OPINION VOUCHES ITS TARGET IN (the master's `vouchesIn`, jakob
     * 2026-10-21): approving an applicant, or answering a vouch asked for. An
     * empty sign there still vouches them in, so its ask warns that they start
     * out cut off. Off by default; every other host asks the ordinary way.
     */
    vouchesIn: Boolean = false,
) {
    val target = targetWords(targetLabel)
    val chooseLabel = stringResource(R.string.stance_target_choose, target)
    val description = targetDescription(state.standing, state.severed, zeroWords, target)
    // THE WALK-AWAY NEEDS SOMETHING TO WALK BACK (PadStanding.md:23-25): a
    // pad over nothing signed carries three controls, over a standing four.
    // A VARIANT PAD CARRIES NO WALK IT BACK (VouchBackPad.md:11).
    val severable = rememberSeverableAtRest(state.standing != null && variant == null, state.busy)
    val view = LocalView.current
    val hold = rememberUpdatedState(onHoldDefault)
    // THE HOLD COMMITS WITH THE PLATFORM'S ONE PULSE (readme §4, *Haptics*).
    val holdWithPulse = remember(view) {
        {
            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            hold.value()
        }
    }

    StanceConfirmation(state.confirmation, state.walkedBack, target, axes, zeroWords, onConfirmationShown)
    // THE PAD AND THE WALK-BACK DIALOG SAY THEY ARE UP, wherever the control
    // stands: over a post's detail the pad PAUSES its clip and its closing
    // resumes it (PostDetailVideo.md:49/51).
    CoversSurface(open = state.pad != StancePadMode.CLOSED, kind = CoverKind.Pause)
    CoversSurface(open = state.severance != null || state.emptySign != null, kind = CoverKind.Suspend)
    val anchor = node?.div("anchor")

    // The pad is a child of the TARGET: that ties its lifetime to the
    // control's, so it cannot outlive the surface that owns it. It takes only
    // its lifetime from the target, never its position.
    val considered: @Composable () -> Unit = {
        StancePadWindow(
            state = state,
            onPick = onPick,
            onCommit = onCommit,
            onCancel = onDismissPad,
            onOpenAlternates = onOpenAlternates,
            onOpenSeverance = onOpenSeverance,
            testTagPrefix = testTagPrefix,
            axes = axes,
            zeroWords = zeroWords,
            targetLabel = targetLabel,
            severable = severable,
            variant = variant,
        )
        if (state.pad == StancePadMode.ALTERNATES) {
            StanceAlternates(
                state = state,
                onPick = onPick,
                onCommit = onCommit,
                onCancel = onDismissPad,
                onOpenSeverance = onOpenSeverance.takeIf { severable },
                testTagPrefix = testTagPrefix,
                axes = axes,
                zeroWords = zeroWords,
                targetLabel = targetLabel,
                helpLabel = variant?.title ?: stringResource(R.string.stance_explain),
            )
        }
    }

    Column(modifier.dataNode(node)) {
        if (padOnly) {
            Box { considered() }
        } else {
            var holding by remember { mutableStateOf(false) }
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .sizeIn(minWidth = TARGET_MIN, minHeight = if (wide) WIDE_TARGET_MIN else TARGET_MIN)
                    .then(
                        if (wide) {
                            Modifier
                                .fillMaxWidth()
                                .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                        } else {
                            Modifier
                        },
                    )
                    .clip(CircleShape)
                    .stanceGesture(
                        enabled = !state.busy,
                        onHoldDefault = holdWithPulse,
                        onOpenPad = onOpenPad,
                        onHolding = { holding = it },
                    )
                    // Colour never carries meaning alone, and a drag gesture
                    // always has a non-drag equivalent (design.md §10): the
                    // node reads as a button whose name says the opinion,
                    // double-tap opens the pad as a tap does, double-tap-and-
                    // hold signs the default as a hold does, and the
                    // alternates ride the custom action — the master's
                    // visually-hidden `Choose your opinion on …`.
                    .semantics(mergeDescendants = true) {
                        role = Role.Button
                        contentDescription = description
                        onClick {
                            onOpenPad()
                            true
                        }
                        onLongClick {
                            onHoldDefault()
                            true
                        }
                        customActions = listOf(
                            CustomAccessibilityAction(chooseLabel) {
                                onOpenAlternates()
                                true
                            },
                        )
                    }
                    .testTag(anchor?.tag ?: "${testTagPrefix}_stance"),
            ) {
                StanceRestingFace(
                    standing = state.standing,
                    face = state.standing?.let { restingReadout(it, state.severed, zeroWords) },
                    testTagPrefix = testTagPrefix,
                    anchor = anchor,
                    emptyFace = emptyFaceFor(lineFaceInk),
                    holding = holding,
                    wide = wide,
                )
                considered()
            }
        }

        // THE ROW LINE (vehicle (b), the failure pack): the hold's wait,
        // quiet, and its failure, in the failure voice with the way to ask
        // again. With the pad open, the pad's own commit row carries both.
        if (state.pad == StancePadMode.CLOSED && !padOnly) {
            HoldRowLine(state, onRetry = onHoldDefault, testTagPrefix = testTagPrefix)
        }

        state.severance?.let { prompt ->
            SeveranceConfirm(
                prompt = prompt,
                onConfirm = onConfirmSeverance,
                onDismiss = onDismissSeverance,
                testTagPrefix = testTagPrefix,
                axes = axes,
                zeroWords = zeroWords,
                targetLabel = targetLabel,
            )
        }
        // A (0, 0) WITH NOTHING STANDING IS NOT A WALK-BACK (seam 242): its
        // own ask, over the parked pad, never the walk-back's dialog.
        state.emptySign?.let { prompt ->
            EmptySignConfirm(
                prompt = prompt,
                onConfirm = onConfirmEmptySign,
                onDismiss = onDismissEmptySign,
                testTagPrefix = testTagPrefix,
                targetLabel = targetLabel,
                vouchIn = vouchesIn,
            )
        }
    }
}

/** The hold's row line: `Signing…` past 200ms, `That didn't sign.` with Retry once it fails. */
@Composable
private fun HoldRowLine(state: StanceControlState, onRetry: () -> Unit, testTagPrefix: String) {
    val slow = rememberSlow(state.busy)
    when {
        state.busy && slow -> RowLine(RowLineState.Signing, "${testTagPrefix}_stance_row")
        // The write rule refused the hold: a notice, so the quiet register
        // and no Retry — asking again at once meets the same answer.
        state.writeRule -> Text(
            text = stringResource(R.string.stance_write_rule_row),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            modifier = Modifier
                .semantics { liveRegion = LiveRegionMode.Polite }
                .testTag("${testTagPrefix}_stance_row"),
        )
        // The key notice is the restore flow's (PadKeyAbsent), not this lane's.
        state.failed && state.needsKey -> StanceFailure(testTagPrefix)
        state.failed -> RowLine(RowLineState.DidntSign(onRetry), "${testTagPrefix}_stance_row")
    }
}

/** Whether [busy] has stayed true past [SETTING_AFTER_MS] — the wait that earns words. */
@Composable
private fun rememberSlow(busy: Boolean): Boolean {
    var slow by remember { mutableStateOf(false) }
    LaunchedEffect(busy) {
        slow = false
        if (busy) {
            delay(SETTING_AFTER_MS)
            slow = true
        }
    }
    return busy && slow
}

/**
 * THE PAD HOLDS ITS SHAPE WHILE SET IS ANSWERING (PR-57's reflow law,
 * `StancePadReflowTest`). A FIRST stance taken while the pad is still up
 * would grow the walk-away into a bottom-anchored card and lift the whole
 * pad; while [busy], the answer stays the one the control had at rest.
 */
@Composable
private fun rememberSeverableAtRest(severable: Boolean, busy: Boolean): Boolean {
    val atRest = remember { mutableStateOf(severable) }
    SideEffect { atRest.value = if (busy) atRest.value else severable }
    return if (busy) atRest.value else severable
}

/**
 * Tap versus hold, on one pointer stream (stance-control.md "The gesture").
 * A tap that lifts before the platform's long-press timeout — 500ms, the
 * number the table names — opens the pad and stages nothing; a press held
 * past it commits the low default without opening anything. [onHolding]
 * reports the press while it is still a hold in the making, for the ring.
 *
 * **The control owns its touches.** The down is consumed the moment it
 * arrives, which is what stops the surface underneath — a post card whose
 * whole body opens the post — from reading the same gesture. Movement
 * inside the long-press window is left unconsumed, so a finger that starts
 * here and travels still scrolls the feed — and this gesture then reads the
 * cancellation and stages nothing.
 *
 * **The hold signs once and owns the rest of its touch**: its own release
 * must never also reach the card, and never read as a tap that opens the
 * pad on top of the signature.
 */
private fun Modifier.stanceGesture(
    enabled: Boolean,
    onHoldDefault: () -> Unit,
    onOpenPad: () -> Unit,
    onHolding: (Boolean) -> Unit,
): Modifier = if (!enabled) {
    this
} else {
    pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false).consume()
            onHolding(true)
            var held = false
            val up = try {
                withTimeout(viewConfiguration.longPressTimeoutMillis) {
                    waitForUpOrCancellation()
                }
            } catch (_: PointerEventTimeoutCancellationException) {
                held = true
                null
            } finally {
                onHolding(false)
            }
            up?.consume()
            when {
                held -> {
                    onHoldDefault()
                    waitForUpOrCancellation()?.consume()
                }
                up != null -> onOpenPad()
                else -> Unit
            }
        }
    }
}

/** The wash: a popup that is the whole window. */
private object WholeWindow : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset = IntOffset.Zero
}

/**
 * The open pad and its wash, at the one fixed spot (StanceControl.jsx
 * `parkedPadStyle`; PadStanding.md:15-19): the lower centre of the window,
 * [LocalPadBottomInset] above its lower edge, the shell beneath inert under
 * the 50% scrim. A press on the wash, the system's Back, and Cancel all close
 * it with nothing staged.
 *
 * THE BLOOM is the dialog's entrance at the parked spot — a 200ms fade and an
 * 8dp rise — with the wash fading in over the scrim's 200ms; closing is the
 * reverse (readme §4 *Motion*). Nothing scales. The last open state is kept
 * for the exit, so the pad leaves showing the pick it had rather than the
 * reset one.
 */
@Composable
private fun StancePadWindow(
    state: StanceControlState,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenAlternates: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    severable: Boolean,
    variant: StancePadVariant?,
) {
    val open = state.pad == StancePadMode.STICKY
    val visible = remember { MutableTransitionState(false) }
    visible.targetState = open
    val shown = remember { mutableStateOf(state) }
    if (open) shown.value = state
    if (!visible.currentState && !visible.targetState) return
    val inset = variant?.padInset ?: LocalPadBottomInset.current
    val rise = with(LocalDensity.current) { BLOOM_RISE.roundToPx() }
    Popup(
        popupPositionProvider = WholeWindow,
        onDismissRequest = onCancel,
        properties = PopupProperties(focusable = true),
    ) {
        // The wash and the pad are SIBLINGS, never parent and child: a
        // clickable merges its descendants, and the pad must stay its own
        // node for the reader.
        Box(contentAlignment = Alignment.BottomCenter, modifier = Modifier.fillMaxSize()) {
            AnimatedVisibility(
                visibleState = visible,
                enter = fadeIn(tween(BLOOM_MS, easing = LinearEasing)),
                exit = fadeOut(tween(BLOOM_MS, easing = LinearEasing)),
                modifier = Modifier.matchParentSize(),
            ) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.scrim.copy(alpha = SCRIM_DIALOG_ALPHA))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onCancel,
                        )
                        // The wash is `aria-hidden`: a press on it is Cancel, never a control.
                        .semantics { hideFromAccessibility() }
                        .testTag("${testTagPrefix}_stance_scrim"),
                )
            }
            AnimatedVisibility(
                visibleState = visible,
                enter = fadeIn(tween(BLOOM_MS)) + slideInVertically(tween(BLOOM_MS)) { rise },
                exit = fadeOut(tween(BLOOM_MS)) + slideOutVertically(tween(BLOOM_MS)) { rise },
                // The master's `maxHeight: calc(100dvh - 2 × inset)`.
                modifier = Modifier.padding(top = inset, bottom = inset),
            ) {
                StancePadCard(
                    state = shown.value,
                    onPick = onPick,
                    onCommit = onCommit,
                    onCancel = onCancel,
                    onOpenAlternates = onOpenAlternates,
                    onOpenSeverance = onOpenSeverance,
                    testTagPrefix = testTagPrefix,
                    axes = axes,
                    zeroWords = zeroWords,
                    targetLabel = targetLabel,
                    severable = severable,
                    variant = variant,
                )
            }
        }
    }
}

/** Which body explains in place of the field: the `?`'s help, or the 🤔's. */
private enum class Explaining { HELP, ZERO }

@Composable
private fun StancePadCard(
    state: StanceControlState,
    onPick: (StancePoint) -> Unit,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenAlternates: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    severable: Boolean,
    variant: StancePadVariant?,
) {
    val padNode = variant?.padNode
    val helpLabel = variant?.title ?: stringResource(R.string.stance_explain)
    val padName = variant?.title ?: stringResource(R.string.stance_pad_name, targetWords(targetLabel))
    var explaining by rememberSaveable { mutableStateOf<Explaining?>(null) }
    Surface(
        shape = RoundedCornerShape(PAD_CORNER),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        modifier = Modifier
            .width(PAD_WIDTH)
            // THE PAD IS MODAL FOR ASSISTIVE TECH, like every sheet (readme
            // §4, *Sheets*; §10): a pane with its own name.
            .semantics { paneTitle = padName }
            .testTag(padNode?.tag ?: "${testTagPrefix}_stance_pad"),
    ) {
        Box {
            Column(
                verticalArrangement = Arrangement.spacedBy(Space.x3),
                modifier = Modifier
                    // A parked pad over a short window scrolls rather than
                    // snapping away from its spot (`overflowY: auto`).
                    .verticalScroll(rememberScrollState())
                    .padding(Space.x4),
            ) {
                // The help REPLACES the field, the note and the landing rather
                // than growing below them: the pad is parked, and a panel
                // that pushed Set and Cancel away from the thumb would defeat
                // the parking.
                PadBody(
                    state = state,
                    explaining = explaining,
                    onExplain = { explaining = it },
                    onPick = onPick,
                    onOpenAlternates = onOpenAlternates,
                    testTagPrefix = testTagPrefix,
                    axes = axes,
                    zeroWords = zeroWords,
                    targetLabel = targetLabel,
                    variant = variant,
                )
                PadFoot(
                    state = state,
                    explaining = explaining != null,
                    severable = severable,
                    onCommit = onCommit,
                    onCancel = onCancel,
                    onOpenSeverance = onOpenSeverance,
                    testTagPrefix = testTagPrefix,
                    zeroWords = zeroWords,
                    padNode = padNode,
                )
            }
            PadHelpButton(
                label = helpLabel,
                onClick = { explaining = if (explaining == Explaining.HELP) null else Explaining.HELP },
                testTag = padNode?.div("help")?.tag ?: "${testTagPrefix}_stance_explain",
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp),
            )
        }
    }
}

/**
 * The pad's readouts, then its body: the field, the shell's note and the
 * landing — or, in their place, what the `?` or the landing's 🤔 explains.
 */
@Composable
private fun PadBody(
    state: StanceControlState,
    explaining: Explaining?,
    onExplain: (Explaining?) -> Unit,
    onPick: (StancePoint) -> Unit,
    onOpenAlternates: () -> Unit,
    testTagPrefix: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    targetLabel: String?,
    variant: StancePadVariant?,
) {
    val padNode = variant?.padNode
    val back = stringResource(R.string.stance_explain_back)
    val backTag = padNode?.div("back")?.tag ?: "${testTagPrefix}_stance_explain_back"
    StanceStanding(
        pick = state.pick,
        standing = state.standing,
        severed = state.severed,
        testTagPrefix = testTagPrefix,
        axes = axes,
        zeroWords = zeroWords,
        targetLabel = targetLabel,
        // Clear of the `?` in the corner.
        modifier = Modifier.padding(end = 40.dp),
        node = padNode?.div("standing"),
    )
    when (explaining) {
        Explaining.HELP -> HelpInPlace(
            lines = variant?.help ?: padHelp(zeroWords),
            back = back,
            onBack = { onExplain(null) },
            testTag = padNode?.div("helpPanel")?.tag ?: "${testTagPrefix}_stance_explanation",
            backTag = backTag,
        )
        Explaining.ZERO -> HelpInPlace(
            lines = unreachableHelp(zeroWords, targetLabel),
            back = back,
            onBack = { onExplain(null) },
            testTag = padNode?.div("zeroPanel")?.tag ?: "${testTagPrefix}_stance_zero_explanation",
            backTag = backTag,
        )
        null -> {
            PairField(
                value = PairPoint(state.pick.directed, state.pick.interest),
                onValueChange = { onPick(StancePoint(it.directed, it.interest)) },
                ranges = PairRanges.Signed,
                axes = axes.words(),
                exactValuesLabel = stringResource(R.string.stance_target_choose, targetWords(targetLabel)),
                onExactValues = onOpenAlternates,
                enabled = !state.busy,
                testTag = "${testTagPrefix}_stance_field",
                node = padNode?.div("field"),
            )
            PadNote(variant, state.coaching, testTagPrefix)
            if (!state.writeRule && !state.keyAbsent) {
                StanceLandingLine(
                    landing = state.landing,
                    testTagPrefix = testTagPrefix,
                    axes = axes,
                    zeroWords = zeroWords,
                    borrowed = state.borrowed,
                    onExplainZero = { onExplain(Explaining.ZERO) },
                    node = padNode?.div("landing"),
                )
            }
        }
    }
}

/**
 * The pad's foot: the commit row with any fault above it — or the key and
 * write-rule notices standing where the landing and the actions would
 * (PadKeyAbsent, PadWriteRule).
 */
@Composable
private fun PadFoot(
    state: StanceControlState,
    explaining: Boolean,
    severable: Boolean,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
    zeroWords: StanceZeroWords,
    padNode: DataNode?,
) {
    when {
        state.keyAbsent -> KeyAbsentNotice(testTagPrefix)
        state.writeRule -> WriteRuleNotice(onCancel, testTagPrefix, padNode)
        else -> {
            if (state.failed) PadFault(state.needsKey, testTagPrefix)
            PadCommitRow(
                state = state,
                explaining = explaining,
                severable = severable,
                onCommit = onCommit,
                onCancel = onCancel,
                onOpenSeverance = onOpenSeverance,
                testTagPrefix = testTagPrefix,
                zeroWords = zeroWords,
                padNode = padNode,
            )
        }
    }
}

/**
 * The help affordance: a circled `?` in the pad's top-right corner, out of
 * the reading order of the readouts — a 48dp target around a 32dp ring in
 * the hairline, the glyph in `primary` at `label-large` (StanceControl.jsx
 * :682-727). Its name is the pad's own (`helpLabel`, ruling A7).
 */
@Composable
private fun PadHelpButton(
    label: String,
    onClick: () -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(TARGET_MIN)
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics {
                contentDescription = label
            }
            .testTag(testTag),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(32.dp)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape),
        ) {
            Text(
                text = "?",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
    }
}

/**
 * The master's `padNote` slot, between the field and the landing line. A
 * variant's own line stands there on every open, the first-ever open's
 * coaching under it (VouchBackPad.md:13-15).
 */
@Composable
private fun PadNote(variant: StancePadVariant?, coaching: Boolean, testTagPrefix: String) {
    if (variant == null) {
        if (coaching) StanceCoaching(testTagPrefix)
        return
    }
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        modifier = Modifier
            .fillMaxWidth()
            .testTag(variant.padNode?.div("note")?.tag ?: "${testTagPrefix}_stance_note"),
    ) {
        Text(
            text = variant.note,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (coaching) StanceCoaching(testTagPrefix)
    }
}

/**
 * ONE ROW (StanceControl.jsx:784-828; PadStanding.md:23): `Walk it back` on
 * the left, pushed away from `Cancel` and `Set` on the right — a walk-away
 * beside a commit is a misfire waiting to happen. With nothing signed
 * toward the target there is no walk-away and the row carries two.
 */
@Composable
private fun PadCommitRow(
    state: StanceControlState,
    explaining: Boolean,
    severable: Boolean,
    onCommit: () -> Unit,
    onCancel: () -> Unit,
    onOpenSeverance: () -> Unit,
    testTagPrefix: String,
    zeroWords: StanceZeroWords,
    padNode: DataNode?,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (severable) {
            Box(Modifier.weight(1f)) {
                CograButton(
                    text = stringResource(zeroWords.open),
                    onClick = onOpenSeverance,
                    kind = ButtonKind.Text,
                    size = ButtonSize.Compact,
                    testTag = padNode?.div("sever")?.tag ?: "${testTagPrefix}_stance_sever",
                )
            }
        } else {
            Spacer(Modifier.weight(1f))
        }
        CograButton(
            text = stringResource(R.string.stance_cancel),
            onClick = onCancel,
            kind = ButtonKind.Text,
            size = ButtonSize.Compact,
            testTag = padNode?.div("cancel")?.tag ?: "${testTagPrefix}_stance_cancel",
        )
        SetButton(state, explaining, onCommit, padNode?.div("set")?.tag ?: "${testTagPrefix}_stance_set")
    }
}

/**
 * SET WAITS FOR ITS SIGNATURE (the failure pack; PadStanding.md:45-49).
 * While the signing is in flight Set refuses a second press without
 * dimming, and past 200ms it reads `Setting…` — never a spinner. A signing
 * that did not go through puts an outlined `Retry` in Set's slot: the same
 * commitment, asked again. Disabled — dimmed — only while help shows, since
 * the field it would sign is not on screen to check against.
 */
@Composable
private fun SetButton(state: StanceControlState, explaining: Boolean, onCommit: () -> Unit, tag: String) {
    val slow = rememberSlow(state.busy)
    val label = when {
        slow -> stringResource(R.string.stance_setting)
        state.failed && !state.busy -> stringResource(R.string.stance_retry)
        else -> stringResource(R.string.stance_set)
    }
    CograButton(
        text = label,
        onClick = { if (!state.busy) onCommit() },
        kind = if (state.failed && !state.busy) ButtonKind.Outlined else ButtonKind.Filled,
        size = ButtonSize.Compact,
        enabled = !explaining,
        testTag = tag,
    )
}

/**
 * THE WRITE RULE'S NOTICE (StanceControl.jsx:766-783; PadWriteRule.md):
 * `NoticePanel` with its own "?" — the stopper exception — and `Not now`
 * under it, which closes the pad keeping nothing. No Retry: asking again at
 * once meets the same answer.
 */
@Composable
internal fun WriteRuleNotice(onNotNow: () -> Unit, testTagPrefix: String, padNode: DataNode?) {
    var explaining by remember { mutableStateOf(false) }
    NoticePanel(
        title = stringResource(R.string.stance_write_rule_title),
        helpLabel = stringResource(R.string.stance_write_rule_help),
        onHelp = { explaining = true },
        helpTestTag = "${testTagPrefix}_stance_write_rule_help",
        testTag = "${testTagPrefix}_stance_write_rule",
    ) {
        NoticeLine(stringResource(R.string.stance_write_rule_fact))
    }
    CograButton(
        text = stringResource(R.string.stance_write_rule_not_now),
        onClick = onNotNow,
        kind = ButtonKind.Text,
        modifier = Modifier.fillMaxWidth(),
        testTag = padNode?.div("notNow")?.tag ?: "${testTagPrefix}_stance_not_now",
    )
    if (explaining) {
        HelpDialog(
            title = stringResource(R.string.stance_write_rule_help),
            paragraphs = listOf(
                stringResource(R.string.stance_write_rule_help_limit),
                stringResource(R.string.stance_write_rule_help_later),
            ),
            onClose = { explaining = false },
            testTag = "${testTagPrefix}_stance_write_rule_dialog",
        )
    }
}

/**
 * THE KEY ISN'T IN THIS APP (PadKeyAbsent.md; `ComposeKeyAbsent`'s panel):
 * the notice where the landing line and the actions would stand, its "?"
 * opening the key's own text, and `Restore the key` in the panel's inverse
 * fill — navigation to the app's restore route ([LocalOnRestoreKey]).
 */
@Composable
private fun KeyAbsentNotice(testTagPrefix: String) {
    var explaining by remember { mutableStateOf(false) }
    val restore = LocalOnRestoreKey.current
    NoticePanel(
        title = stringResource(R.string.stance_key_absent_title),
        helpLabel = stringResource(R.string.stance_key_absent_help),
        onHelp = { explaining = true },
        helpTestTag = "${testTagPrefix}_stance_key_help",
        testTag = "${testTagPrefix}_stance_key_absent",
    ) {
        NoticeLine(stringResource(R.string.stance_key_absent_waits))
        NoticeLine(stringResource(R.string.stance_key_absent_restore_line))
        CograButton(
            text = stringResource(R.string.stance_key_absent_restore),
            onClick = { restore?.invoke() },
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "${testTagPrefix}_stance_restore_key",
        )
    }
    if (explaining) {
        HelpDialog(
            title = stringResource(R.string.stance_key_absent_help),
            paragraphs = listOf(
                stringResource(R.string.stance_key_absent_help_where),
                stringResource(R.string.stance_key_absent_help_waits),
            ),
            onClose = { explaining = false },
            testTag = "${testTagPrefix}_stance_key_dialog",
        )
    }
}

/** The fault above the commit row (PadFailed.md): `That didn't send. Try again.`, announced as an alert. */
@Composable
private fun PadFault(needsKey: Boolean, testTagPrefix: String) {
    if (needsKey) {
        StanceFailure(testTagPrefix)
        return
    }
    Text(
        text = stringResource(R.string.stance_pad_failed),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier
            .semantics { liveRegion = LiveRegionMode.Assertive }
            .testTag("${testTagPrefix}_stance_failed"),
    )
}

/**
 * A husk device: the key is not here. The master's notice (`PadKeyAbsent`)
 * belongs to the restore flow; until that lands this says what is true.
 */
@Composable
private fun StanceFailure(testTagPrefix: String) {
    ErrorLine(R.string.stance_failed_no_key, "${testTagPrefix}_stance_failed")
}

/**
 * What the resting target reads as (design.md §8.3): the face at
 * `title-large`, and the folded pair beside it in `body-small` on
 * `onSurfaceVariant` only in geek mode (`cg-exact`). A viewer without a
 * bundle sees a **muted, translucent face** — the same control at rest,
 * visibly waiting to be given a value — and the wide anchor adds its
 * words, `Your opinion`, only where there is no pair to show.
 *
 * While a hold is under way the HOLD'S RING fills round the face over the
 * long-press timeout (the K13 round): `primary`, clockwise from twelve
 * o'clock, a reading of the time left — so it fills under reduced motion
 * too, read from the frame clock rather than an animation.
 */
@Composable
private fun StanceRestingFace(
    standing: StancePoint?,
    face: StanceAnchor?,
    testTagPrefix: String,
    anchor: DataNode?,
    emptyFace: EmptyFace,
    holding: Boolean,
    wide: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier
            .padding(horizontal = Space.x3)
            .then(
                if (anchor == null && standing != null) {
                    Modifier.testTag("${testTagPrefix}_stance_standing_face")
                } else {
                    Modifier
                },
            ),
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (standing == null || face == null) {
                val faceTag = anchor?.div("face")?.tag ?: "${testTagPrefix}_stance_empty_face"
                when (emptyFace) {
                    is EmptyFace.Line -> LineFace(ink = emptyFace.ink, modifier = Modifier.testTag(faceTag))
                    EmptyFace.MutedEmoji -> Text(
                        text = RESTING_FACE,
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier
                            .alpha(RESTING_FACE_ALPHA)
                            .desaturated()
                            .testTag(faceTag),
                    )
                }
            } else {
                Text(
                    text = face.emoji,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.dataNode(anchor?.div("face")),
                )
            }
            if (holding) HoldRing()
        }
        if (standing == null) {
            if (wide) {
                Text(
                    text = stringResource(R.string.stance_wide_words),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                )
            }
        } else if (LocalShowExactValues.current) {
            Text(
                text = standing.pair(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                softWrap = false,
                modifier = Modifier.dataNode(anchor?.div("exact")),
            )
        }
    }
}

/** The hold's ring (`HoldRing`): 40dp, a 4dp `primary` stroke, no track, filling from twelve o'clock. */
@Composable
private fun HoldRing() {
    val timeout = LocalViewConfiguration.current.longPressTimeoutMillis.toFloat()
    var progress by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        val start = withFrameMillis { it }
        while (progress < 1f) {
            withFrameMillis { now -> progress = ((now - start) / timeout).coerceIn(0f, 1f) }
        }
    }
    val ink = MaterialTheme.colorScheme.primary
    Canvas(Modifier.size(HOLD_RING).clearAndSetSemantics { }) {
        val stroke = HOLD_RING_STROKE.toPx()
        drawArc(
            color = ink,
            startAngle = -90f,
            sweepAngle = 360f * progress,
            useCenter = false,
            topLeft = Offset(stroke / 2f, stroke / 2f),
            size = Size(size.width - stroke, size.height - stroke),
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

/**
 * The transient signed-confirmation on the platform's standard surface
 * (`signedLine`; copy-voice *The signed-opinion snackbar*): `Signed, still
 * settling. Current opinion 🙂`, the pair behind the face only in geek
 * mode, and the spoken twin naming the word and both axes in both modes. A
 * walk-back keeps its sentence: `Signed 3 things, still settling. You've
 * walked @ada back to nothing.`
 *
 * The one-shot has to be CONSUMED so a recomposition cannot repeat it, and
 * consuming it clears the very state that describes it — so the effect is
 * keyed on the HOST, which outlives any one confirmation, and the
 * confirmations arrive through a snapshot flow.
 */
@Composable
private fun StanceConfirmation(
    confirmation: StancePoint?,
    walkedBack: Int?,
    target: String,
    axes: StanceAxes,
    zeroWords: StanceZeroWords,
    onShown: () -> Unit,
) {
    val host = LocalSnackbarHostState.current
    val exact = LocalShowExactValues.current
    val gone = stringResource(zeroWords.standingZero, target)
    val visuals = when {
        walkedBack != null -> pluralStringResource(R.plurals.stance_signed_gone, walkedBack, walkedBack, gone)
            .let { SpokenSnackbarVisuals(it, it) }
        confirmation == null -> null
        else -> {
            // Not walked back — that one confirms through [walkedBack] — so
            // a standing at exactly (0, 0) is an empty sign's: the ordinary
            // line, its 🤷 saying nothing (jakob 2026-10-21).
            val anchor = bundleReadout(confirmation, EMPTY_PICK_LABEL)
            val face = if (exact) "${anchor.emoji} (${confirmation.pair()})" else anchor.emoji
            SpokenSnackbarVisuals(
                message = stringResource(R.string.stance_signed, face),
                spoken = stringResource(
                    R.string.stance_signed_spoken,
                    "${stringResource(anchor.label)}, ${confirmation.reading(axes)}",
                ),
            )
        }
    }
    val message = rememberUpdatedState(visuals)
    val consume = rememberUpdatedState(onShown)
    LaunchedEffect(host) {
        snapshotFlow { message.value }
            .filterNotNull()
            .collect { shown ->
                // Spent before the wait: a surface with no host still
                // consumes it, and a snackbar that lingers never fires the
                // same confirmation twice.
                consume.value()
                host?.showSnackbar(shown)
            }
    }
}

/**
 * The pad's field, as a surface outside the control draws it (the reply
 * seal's `ReplyPad`): the master `StancePad` — the field with its four pole
 * words in the gutters around it, the knob at the pick. One field, every
 * caller; a second field drawn to a second knob would be exactly the drift
 * a design system exists to prevent.
 */
@Composable
fun StancePadField(
    pick: StancePoint,
    onPick: (StancePoint) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    axes: StanceAxes = StanceAxes.Opinion,
    exactValuesLabel: String? = null,
    onExactValues: () -> Unit = {},
    testTag: String = "stance_field",
) {
    PairField(
        value = PairPoint(pick.directed, pick.interest),
        onValueChange = { onPick(StancePoint(it.directed, it.interest)) },
        ranges = PairRanges.Signed,
        axes = axes.words(),
        exactValuesLabel = exactValuesLabel ?: stringResource(R.string.stance_target_choose, targetWords(null)),
        onExactValues = onExactValues,
        modifier = modifier,
        enabled = enabled,
        testTag = testTag,
    )
}

/**
 * A pair in the reader's own words plus its values — `For or against
 * +0.40, How much reaches you +0.20`. Public because every surface that
 * shows a pair owes the reader this announcement.
 */
@Composable
fun StancePoint.reading(axes: StanceAxes = StanceAxes.Opinion): String = stringResource(
    R.string.stance_reading,
    stringResource(axes.directed),
    twoPlaces(directed),
    stringResource(axes.interest),
    twoPlaces(interest),
)

/**
 * The bare pair, `+0.40 / +0.20`-style (design.md §8.3) — the `cg-exact`
 * figure. Public for the same reason [reading] is.
 */
@Composable
fun StancePoint.pair(): String =
    stringResource(R.string.stance_pair, twoPlaces(directed), twoPlaces(interest))

/**
 * A dimension as the reader reads numbers: always signed, two decimals.
 * The sign carries the direction, so it is shown even at zero — but a
 * value that ROUNDS to zero has no direction to report, and `-0.00`
 * reads as a broken control rather than as a precise one.
 */
fun twoPlaces(value: Double): String {
    val rounded = (value * 100).roundToInt() / 100.0
    return withMinusSign(String.format(NUMBER_LOCALE, "%+.2f", if (rounded == 0.0) 0.0 else rounded))
}

/**
 * THE SYSTEM'S ONE NUMBER FORMAT (`StanceReadout.jsx`'s `en-US`
 * `Intl.NumberFormat`): a point for the decimals on every device, whatever
 * its locale — a pair read `+0,40` on one phone and `+0.40` on another is
 * two products.
 */
val NUMBER_LOCALE: Locale = Locale.US

/**
 * THE MINUS IS U+2212, NOT A HYPHEN (design/readme.md §3 *Numbers*; item 59):
 * MINUS SIGN carries the plus's width and sits on its optical axis, where
 * U+002D is a narrow word-joining dash and a pair written `x / y` cannot
 * afford one arm shorter than the other. [NUMBER_LOCALE]'s formats write the
 * sign as the only hyphen in a number, so the swap never reaches a digit.
 */
fun withMinusSign(formatted: String): String = formatted.replace('-', MINUS_SIGN)

/** U+2212 MINUS SIGN. */
const val MINUS_SIGN = '−'

/**
 * THE PAD IS THE TEACHER (stance-control.md "Teaching it"; copy-voice "The
 * first-ever pad teaches in two coaching lines"). The account's first-ever
 * pad open carries these two lines in the `padNote` slot, between the field
 * and the landing line; they close with the pad and never show again.
 *
 * The face is drawn and the digits ride behind it only in geek mode — ` (+0.10
 * / +0.10)`; the spoken twin says the face and the pair either way
 * (VouchBackPad.md "the coaching's exact pair shows only when the reader has
 * asked for exact values").
 */
@Composable
private fun StanceCoaching(testTagPrefix: String) {
    val default = StancePoint(0.1, 0.1)
    val face = bundleReadout(default, EMPTY_PICK_LABEL).emoji
    val drawnFace = if (LocalShowExactValues.current) "$face (${default.pair()})" else face
    val shortcut = stringResource(R.string.stance_coaching_shortcut, drawnFace)
    val shortcutSpoken = stringResource(R.string.stance_coaching_shortcut_spoken)
    Column(
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("${testTagPrefix}_stance_coaching"),
    ) {
        Text(
            text = shortcut,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.semantics { contentDescription = shortcutSpoken },
        )
        Text(
            text = stringResource(R.string.stance_coaching_set),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
