// FC-8b (copy-voice "The license block"; seam 106.5): the seal's License row
// reads the author's reading of the pair through the one shared helper pair
// (`licenseName` / `licenseSummary`, core:designsystem `LicenseTier.kt`) —
// the post seal and the reply seal alike.

package com.cogra.feature.content.wizard

import com.cogra.domain.LicenseChoice
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SealLicenseReadingTest {

    @Test
    fun theSealLicenseSummaryReadsLicenseNameAndReading() {
        assertThat(LicenseChoice.PublicDomain.sealLabel())
            .isEqualTo("Public domain — nobody owes you a name, and uses go unlogged.")
        assertThat(LicenseChoice(attribution = 1.0, provenance = 0.0).sealLabel())
            .isEqualTo("Credit always · Not logged — every use credits you, and uses go unlogged.")
        assertThat(LicenseChoice(attribution = 0.0, provenance = 0.5).sealLabel())
            .isEqualTo(
                "No credit · Log commercial use — nobody owes you a name, and commercial uses are " +
                    "logged publicly and stay open to audit.",
            )
    }

    @Test
    fun theSealNeverSaysYourDefault() {
        assertThat(LicenseChoice.PublicDomain.sealLabel()).doesNotContain("your default")
    }
}
