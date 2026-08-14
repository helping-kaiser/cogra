package com.cogra.feature.settings

import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.KeyGateResult

/**
 * The device's answer, scripted. The real gate is BiometricPrompt,
 * which needs a device — the screens are tested against the three
 * answers it can give.
 */
internal class FakeKeyGate(private val result: KeyGateResult) : KeyGate {
    var asked = 0
        private set

    override suspend fun confirm(title: String, subtitle: String): KeyGateResult {
        asked++
        return result
    }
}
