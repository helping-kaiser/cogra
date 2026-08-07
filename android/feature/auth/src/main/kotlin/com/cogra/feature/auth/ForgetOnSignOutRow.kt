// The "don't remember me" opt-in row (auth.md "Sign-out"), shared by
// the login and restore forms. The documented checkbox-with-label
// pattern (developer.android.com/develop/ui/compose/components/checkbox):
// the ROW is the toggleable, announced with the Checkbox role, and the
// checkbox itself gets onCheckedChange = null — one merged semantics
// node, one at-least-48dp touch target.

package com.cogra.feature.auth

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

@Composable
internal fun ForgetOnSignOutRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    testTag: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(
                value = checked,
                onValueChange = onCheckedChange,
                role = Role.Checkbox,
            )
            .testTag(testTag),
    ) {
        Checkbox(checked = checked, onCheckedChange = null)
        Text(
            text = stringResource(R.string.auth_dont_remember),
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}
