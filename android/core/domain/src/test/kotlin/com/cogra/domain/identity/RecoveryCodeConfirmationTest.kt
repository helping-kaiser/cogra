package com.cogra.domain.identity

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class RecoveryCodeConfirmationTest {

    private val shown = "ABCDE-FGHJK-MNPQR-STVWX-YZ0123"

    @Test
    fun theCodeTypedBackAsShownMatches() {
        assertThat(recoveryCodeTypedBack(shown, shown)).isTrue()
    }

    @Test
    fun theSeparatorsAndTheCaseAreTheReadersChoice() {
        assertThat(recoveryCodeTypedBack(shown, "abcdefghjkmnpqrstvwxyz0123")).isTrue()
        assertThat(recoveryCodeTypedBack(shown, " ABCDE FGHJK MNPQR STVWX YZ0123 ")).isTrue()
    }

    @Test
    fun theConfusableLettersAreReadAsTheirDigits() {
        // Someone transcribing by hand writes what they see; `1` reads
        // back as `I` or `l`, `0` as `O`.
        assertThat(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZOI23")).isTrue()
    }

    @Test
    fun aWrongCharacterDoesNotMatch() {
        assertThat(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZ0124")).isFalse()
    }

    @Test
    fun aTruncatedCodeDoesNotMatch() {
        assertThat(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX")).isFalse()
    }

    @Test
    fun anEmptyAnswerNeverMatches() {
        assertThat(recoveryCodeTypedBack(shown, "")).isFalse()
        assertThat(recoveryCodeTypedBack(shown, "  --  ")).isFalse()
    }
}
