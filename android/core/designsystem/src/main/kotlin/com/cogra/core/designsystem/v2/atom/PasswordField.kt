package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Layout

/**
 * The house password field (`design/components/forms/PasswordField.jsx`):
 * [CograTextField]'s anatomy with the `visibility` / `visibility_off` reveal
 * BESIDE the box, a transparent 48dp icon button whose accessible name says
 * what the tap will do.
 *
 * ONE RULE FOR CREDENTIAL FORMS (the K13 round, readme §10): a password is
 * `Password` or `NewPassword` to autofill, never capitalized or corrected,
 * and a form that re-proves one names the account it is for. Where the
 * form draws no email field, [account] carries the address as a hidden
 * username — see [AccountUsernameHint].
 *
 * The return key follows the form: [imeAction] `Next` where a field
 * follows, `Go` on the last one, which [onImeAction] submits.
 */
@Composable
fun CograPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    newPassword: Boolean = false,
    hint: String? = null,
    error: String? = null,
    account: String? = null,
    imeAction: ImeAction = ImeAction.Go,
    onImeAction: () -> Unit = {},
    node: DataNode? = null,
    testTag: String? = null,
) {
    var visible by rememberSaveable { mutableStateOf(false) }
    if (account != null) AccountUsernameHint(account)
    CograTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        error = error,
        hint = hint,
        node = node,
        testTag = testTag,
        keyboardOptions = KeyboardOptions(
            capitalization = KeyboardCapitalization.None,
            autoCorrectEnabled = false,
            keyboardType = KeyboardType.Password,
            imeAction = imeAction,
        ),
        keyboardActions = KeyboardActions(onGo = { onImeAction() }, onNext = null),
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        contentType = if (newPassword) ContentType.NewPassword else ContentType.Password,
        trailing = {
            IconButton(
                onClick = { visible = !visible },
                modifier = Modifier
                    .size(Layout.TouchTargetMin)
                    .dataNode(node?.div("reveal"))
                    .then(if (node == null && testTag != null) Modifier.testTag("${testTag}_toggle") else Modifier),
            ) {
                Icon(
                    imageVector = if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    contentDescription = stringResource(
                        if (visible) R.string.password_hide else R.string.password_show,
                    ),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
    )
}

/**
 * The hidden username a re-proving password form carries
 * (`PasswordField.jsx`'s `account`, Chromium's documented way to tell a
 * password manager whose password is changing). On Android the same job
 * is Compose autofill's: a zero-size, read-only field whose semantics say
 * `ContentType.Username` and hold the address, so the autofill service
 * pairs the password beside it with that account. It is hidden from
 * accessibility — a listener has nothing to do with it.
 */
@Composable
fun AccountUsernameHint(account: String) {
    Box(Modifier.size(0.dp)) {
        BasicTextField(
            value = account,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            modifier = Modifier
                .size(0.dp)
                .semantics {
                    contentType = ContentType.Username
                    hideFromAccessibility()
                },
        )
    }
}
