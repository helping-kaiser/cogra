package com.cogra.core.designsystem.v2.token

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import kotlin.math.roundToInt

/**
 * The screen-transition layer (`design/tokens/transitions.css`), which the
 * design defines and the app had none of — Navigation Compose's stock
 * cross-fade said nothing about where a screen came from, so back and forward
 * were indistinguishable.
 *
 * **The rule: a transition says where a screen came from, and nothing else.**
 * So the travel is a hint ([NAV_TRAVEL] of the screen's width, not a full
 * slide), the fade carries most of the change, and back is the forward motion
 * run in reverse at the shorter duration.
 *
 * Never animated: the content inside an arriving screen. No list entrance, no
 * staggered cards — the screen arrives whole, which is also why exactly one
 * transition is on screen at a time.
 *
 * A reader who has asked for stillness gets the swap without the explanation:
 * Compose scales every animation here by the platform's animator duration
 * scale, so "Remove animations" collapses these to an instant cut without a
 * second mechanism of ours (`design/tokens/transitions.css`, the
 * reduced-motion block).
 */
object NavTransitions {

    /** The arriving screen: in from the trailing edge, fading up. */
    val forwardEnter: EnterTransition =
        slideInHorizontally(
            animationSpec = tween(Duration.NAV_FORWARD, easing = Ease.EmphasizedDecelerate),
            initialOffsetX = { width -> (width * NAV_TRAVEL).roundToInt() },
        ) + fadeIn(tween(Duration.NAV_FORWARD, easing = Ease.EmphasizedDecelerate))

    /** The screen being covered: half the travel, the other way, fading out. */
    val forwardExit: ExitTransition =
        slideOutHorizontally(
            animationSpec = tween(Duration.NAV_BACK, easing = Ease.EmphasizedAccelerate),
            targetOffsetX = { width -> (width * NAV_TRAVEL_TRAILING).roundToInt() },
        ) + fadeOut(tween(Duration.NAV_BACK, easing = Ease.EmphasizedAccelerate))

    /** Coming back: the covered screen returns from where it went. */
    val backEnter: EnterTransition =
        slideInHorizontally(
            animationSpec = tween(Duration.NAV_BACK, easing = Ease.EmphasizedDecelerate),
            initialOffsetX = { width -> (width * NAV_TRAVEL_TRAILING).roundToInt() },
        ) + fadeIn(tween(Duration.NAV_BACK, easing = Ease.EmphasizedDecelerate))

    /** Coming back: the leaving screen retraces the way it arrived. */
    val backExit: ExitTransition =
        slideOutHorizontally(
            animationSpec = tween(Duration.NAV_BACK, easing = Ease.EmphasizedAccelerate),
            targetOffsetX = { width -> (width * NAV_TRAVEL).roundToInt() },
        ) + fadeOut(tween(Duration.NAV_BACK, easing = Ease.EmphasizedAccelerate))
}
