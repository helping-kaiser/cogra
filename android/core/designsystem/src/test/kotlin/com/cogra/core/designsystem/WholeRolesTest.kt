package com.cogra.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.cogra.core.designsystem.v2.atom.AddressCard
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.CograPasswordField
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.FilterSection
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Round 28's whole roles on android (design/readme.md §13, *the masters take
 * their whole roles*): each master's line is laid out with every part of the
 * role it names — never a size over an inherited leading or tracking, never
 * a role at a weight the master no longer sets.
 */
@RunWith(RobolectricTestRunner::class)
class WholeRolesTest {

    @get:Rule
    val compose = createComposeRule()

    private lateinit var type: Typography

    private fun render(content: @Composable () -> Unit) {
        compose.setContent {
            Cogra2PreviewTheme {
                type = MaterialTheme.typography
                content()
            }
        }
    }

    /** `TransportError.jsx`: the fault line is body-medium whole (seam 254 item 5). */
    @Test
    fun theFaultLineIsBodyMediumWhole() {
        render { ErrorLine(text = "Can't reach the server.", testTag = "fault") }
        compose.onNodeWithTag("fault").assertWholeRole(type.bodyMedium, "fault line")
    }

    /** `_shared.jsx` `WaitingCommit`: the reason is label-small at the role's 500 (item 6). */
    @Test
    fun theWaitingReasonIsLabelSmallWhole() {
        render {
            WaitingCommit(
                label = "Sign in",
                reason = "Waiting for your email and password",
                waiting = true,
                onCommit = {},
                fault = "That didn't send. Try again.",
                faultTestTag = "fault",
                node = DataNode("signIn.commit"),
            )
        }
        compose.onNodeWithTag("signIn.commit.reason").assertWholeRole(type.labelSmall, "waiting reason")
        compose.onNodeWithTag("fault").assertWholeRole(type.bodyMedium, "commit fault")
    }

    /** `PasswordField.jsx`: the input is body-large whole, the text field's height (item 7). */
    @Test
    fun thePasswordInputIsBodyLargeWhole() {
        render {
            CograPasswordField(value = "hunter22", onValueChange = {}, label = "Password", node = DataNode("pw"))
        }
        compose.onNodeWithTag("pw.input").assertWholeRole(type.bodyLarge, "password input")
    }

    /** `PendingMarker.jsx`: the pending line is label-small whole, 16sp leading (item 8). */
    @Test
    fun thePendingLineIsLabelSmallWhole() {
        render { PendingMarker(text = "Still settling", testTag = "pending") }
        compose.onNodeWithTag("pending").assertWholeRole(type.labelSmall, "pending line")
    }

    /** `TextField.jsx` `FieldLabel`'s corner takes label-small's weight 500 (round 28). */
    @Test
    fun theFieldCornerIsLabelSmallWhole() {
        render { CograTextField(value = "", onValueChange = {}, label = "Title", optional = true) }
        compose.onNodeWithText("Optional").assertWholeRole(type.labelSmall, "field corner")
    }

    /** `WizardHeader.jsx`'s stage takes label-small whole (round 28). */
    @Test
    fun theWizardStageIsLabelSmallWhole() {
        render { WizardHeader(title = "Seal", trailingNote = "Last step") }
        compose.onNodeWithText("Last step").assertWholeRole(type.labelSmall, "wizard stage")
    }

    /** `ContentRow.jsx` TYPE: the trailing time is label-small with its weight (round 28). */
    @Test
    fun theRowTimeIsLabelSmallWhole() {
        render { ContentRow(title = "A post", disc = ContentRowDisc.Redacted, testTag = "row", trailing = "2h") }
        compose.onNodeWithText("2h").assertWholeRole(type.labelSmall, "row time")
    }

    /** `PayoutAddress.jsx`'s caption is label-small with its weight (round 28). */
    @Test
    fun thePayoutCaptionIsLabelSmallWhole() {
        render {
            AddressCard(address = "lq1qexample", label = "Payouts land at", copyLabel = "Copy", caption = "Checked")
        }
        compose.onNodeWithText("Checked").assertWholeRole(type.labelSmall, "payout caption")
    }

    /** `OrderSection.jsx` `FilterSection`: the label is label-large with its own leading (round 28). */
    @Test
    fun theFilterSectionLabelIsLabelLargeWhole() {
        render { FilterSection(label = "Order") {} }
        compose.onNodeWithText("Order").assertWholeRole(type.labelLarge, "filter label")
    }

    /** `RecoveryCode.jsx`: the explainer is body-medium whole; the code body-large at its wider tracking. */
    @Test
    fun theRecoveryCodeTakesItsRoles() {
        render {
            RecoveryCodeConfirm(
                code = "ABCD-EFGH",
                explainer = "Write this down.",
                matches = { false },
                diverged = { false },
                onConfirmed = {},
            )
        }
        compose.onNodeWithText("Write this down.").assertWholeRole(type.bodyMedium, "explainer")
        val code = compose.onNodeWithTag("recovery_code").laidOutStyle()
        assertThat(code.fontSize).isEqualTo(type.bodyLarge.fontSize)
        assertThat(code.lineHeight).isEqualTo(type.bodyLarge.lineHeight)
        assertThat(code.fontWeight).isEqualTo(type.bodyLarge.fontWeight)
        assertThat(code.letterSpacing.value).isWithin(1e-4f).of(0.05f)
    }
}
