package com.cogra.core.designsystem.v2.token

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing

/**
 * M3's standard easings, transcribed from `design/tokens/motion.css` — the
 * Android side had no counterpart to that file before the 2.0 layer.
 *
 * Motion clarifies where something came from; it never performs
 * (design/readme.md §4). There is no bounce, no spring, and no entrance
 * animation on a list.
 */
object Ease {
    val Standard: Easing = CubicBezierEasing(0.2f, 0f, 0f, 1f)
    val StandardDecelerate: Easing = CubicBezierEasing(0f, 0f, 0f, 1f)
    val StandardAccelerate: Easing = CubicBezierEasing(0.3f, 0f, 1f, 1f)
    val EmphasizedDecelerate: Easing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
    val EmphasizedAccelerate: Easing = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)
}

/** Durations in milliseconds, from `design/tokens/motion.css`. */
object Duration {
    const val SHORT_2 = 100
    const val SHORT_4 = 200
    const val MEDIUM_2 = 300
    const val MEDIUM_4 = 400
    const val LONG_2 = 500

    /** Android's platform long-press timeout — what the pad's bloom waits for. */
    const val LONG_PRESS = 500

    /** A veil's reveal: one short, calm cross-fade, never a flourish. */
    const val VEIL_REVEAL = SHORT_4
}
