package com.cogra.core.designsystem

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.test.junit4.createComposeRule
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The prompt itself needs a device, so what is testable on the JVM is
 * the refusal to guess: with no FragmentActivity to host it, the gate
 * reports Unavailable rather than throwing or silently granting.
 */
@RunWith(RobolectricTestRunner::class)
class KeyGateTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun withoutAHostingFragmentActivityTheGateIsUnavailable() {
        var result: KeyGateResult? = null
        compose.setContent {
            val gate = rememberKeyGate()
            LaunchedEffect(gate) { result = gate.confirm("title", "subtitle") }
        }
        compose.waitForIdle()
        assertThat(result).isEqualTo(KeyGateResult.Unavailable)
    }
}
