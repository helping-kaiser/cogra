package com.cogra.feature.settings

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.KeyGate
import com.cogra.core.designsystem.KeyGateResult
import com.cogra.domain.identity.ExportedSecret
import com.cogra.domain.identity.SecretKind
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class KeyExportScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val actorKey = ExportedSecret(
        kind = SecretKind.ACTOR_KEY,
        pem = "-----BEGIN PRIVATE KEY-----\nMC4=\n-----END PRIVATE KEY-----",
        hex = "d4ee72db",
    )

    private fun render(
        state: KeyExportUiState = KeyExportUiState(),
        onReveal: () -> Unit = {},
        onBack: () -> Unit = {},
        keyGate: KeyGate = FakeKeyGate(KeyGateResult.Granted),
    ) {
        compose.setContent {
            KeyExportScreen(state = state, onReveal = onReveal, onBack = onBack, keyGate = keyGate)
        }
    }

    @Test
    fun nothingIsShownBeforeTheDeviceConfirms() {
        render()
        compose.onNodeWithTag("key_export_reveal").assertExists()
        compose.onNodeWithTag("key_export_pem").assertDoesNotExist()
        compose.onNodeWithTag("key_export_hex").assertDoesNotExist()
    }

    @Test
    fun aConfirmedRevealAsksForTheSecrets() {
        var revealed = false
        render(onReveal = { revealed = true })
        compose.onNodeWithTag("key_export_reveal").performClick()
        compose.waitForIdle()
        assertThat(revealed).isTrue()
    }

    @Test
    fun aRefusedConfirmationRevealsNothing() {
        var revealed = false
        render(onReveal = { revealed = true }, keyGate = FakeKeyGate(KeyGateResult.Denied))
        compose.onNodeWithTag("key_export_reveal").performClick()
        compose.waitForIdle()
        assertThat(revealed).isFalse()
    }

    @Test
    fun aPhoneThatCannotAskWarnsAndThenReveals() {
        var revealed = false
        render(onReveal = { revealed = true }, keyGate = FakeKeyGate(KeyGateResult.Unavailable))
        compose.onNodeWithTag("key_export_reveal").performClick()
        compose.waitForIdle()
        assertThat(revealed).isFalse()

        compose.onNodeWithTag("key_gate_continue").performClick()
        compose.waitForIdle()
        assertThat(revealed).isTrue()
    }

    @Test
    fun eachSecretShowsBothPortableForms() {
        render(KeyExportUiState(secrets = listOf(actorKey), revealed = true))
        compose.onNodeWithTag("key_export_pem").assertExists()
        compose.onNodeWithTag("key_export_hex").assertExists()
        compose.onNodeWithTag("key_export_reveal").assertDoesNotExist()
    }

    @Test
    fun aPhoneWithoutTheKeySaysSo() {
        render(KeyExportUiState(secrets = emptyList(), revealed = true))
        compose.onNodeWithTag("key_export_no_actor").assertExists()
        compose.onNodeWithTag("key_export_pem").assertDoesNotExist()
    }

    @Test
    fun theTopBarBackArrowReportsUp() {
        var back = false
        render(onBack = { back = true })
        compose.onNodeWithTag("key_export_back").performClick()
        assertThat(back).isTrue()
    }
}
