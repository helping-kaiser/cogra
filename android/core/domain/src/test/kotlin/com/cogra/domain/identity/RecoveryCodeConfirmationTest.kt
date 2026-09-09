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

    @Test
    fun aConfusableCharacterIsNotADivergedPrefix() {
        // `O` reads back as `0` under the same folding the button uses,
        // so this is the exact code, not a prefix that went wrong.
        assertThat(recoveryCodePrefixDiverged(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZO123")).isFalse()
    }

    @Test
    fun aGenuinelyWrongCharacterDiverges() {
        assertThat(recoveryCodePrefixDiverged(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZ0124")).isTrue()
    }

    @Test
    fun anEmptyAnswerHasNotYetDiverged() {
        assertThat(recoveryCodePrefixDiverged(shown, "")).isFalse()
        assertThat(recoveryCodePrefixDiverged(shown, "  --  ")).isFalse()
    }

    @Test
    fun aCorrectPartialHasNotYetDiverged() {
        assertThat(recoveryCodePrefixDiverged(shown, "ABCDE-FGHJK")).isFalse()
    }
}
