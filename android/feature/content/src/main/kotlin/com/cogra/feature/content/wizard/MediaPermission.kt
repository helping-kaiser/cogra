package com.cogra.feature.content.wizard

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space

/**
 * What the reader has said about letting `ComposePick`'s grid read their
 * pictures.
 *
 * Three answers rather than a boolean, because Android has three: not
 * asked, granted — whole library or a chosen subset — and refused. The
 * subset is not a degraded grant to nag about; from Android 14 it is a
 * first-class answer, and the app is documented to work with whatever
 * came back
 * (developer.android.com/training/data-storage/shared/media#partial-access).
 */
sealed interface MediaPermission {
    /** Nothing asked yet: the stage shows what the grid is for, then asks. */
    data object Unrequested : MediaPermission

    /** [partial] when only the pictures the reader chose are visible. */
    data class Granted(val partial: Boolean) : MediaPermission

    /** Refused. The system picker tile still works, and says so. */
    data object Refused : MediaPermission
}

/**
 * The permissions this device needs for the in-app grid.
 *
 * Below API 33 there is one storage permission; from 33 there are two
 * media ones, and from 34 the pair is requested *together* so the system
 * offers "select photos" beside "allow all" rather than the older
 * all-or-nothing dialog.
 */
internal fun mediaPermissions(): Array<String> = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
    )
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
        arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
    else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
}

/** Reads the current answer without asking for one. */
internal fun mediaPermissionOf(context: Context): MediaPermission {
    fun held(name: String) =
        ContextCompat.checkSelfPermission(context, name) == PackageManager.PERMISSION_GRANTED

    return when {
        held(mediaPermissions().first()) -> MediaPermission.Granted(partial = false)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            held(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) ->
            MediaPermission.Granted(partial = true)
        else -> MediaPermission.Unrequested
    }
}

/**
 * The permission, and the two things a screen can do about it.
 *
 * The launcher is remembered here rather than in the screen so the
 * screen stays stateless and previewable — the same split the wizard's
 * route already uses for the system photo picker.
 *
 * @param onGranted fired whenever an answer arrives that lets the grid
 *   read something, so the caller can load or reload it. A partial grant
 *   re-fires on every request, because the reader may have added
 *   pictures to the selection.
 */
@Composable
internal fun rememberMediaPermission(onGranted: () -> Unit): MediaPermissionController {
    val context = LocalContext.current
    var permission by remember { mutableStateOf(mediaPermissionOf(context)) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        // The map's keys are what was asked for, but the truth is what is
        // held now — a partial grant answers "denied" for the full one.
        permission = when (val answer = mediaPermissionOf(context)) {
            is MediaPermission.Granted -> answer
            else -> MediaPermission.Refused
        }
        if (permission is MediaPermission.Granted) onGranted()
    }

    // Covers the answer that was already there when the stage opened — a
    // grant made in Settings, or on a previous visit.
    LaunchedEffect(permission) {
        if (permission is MediaPermission.Granted) onGranted()
    }

    return remember(permission) {
        MediaPermissionController(
            permission = permission,
            request = { launcher.launch(mediaPermissions()) },
            openSettings = {
                context.startActivity(
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", context.packageName, null),
                    ),
                )
            },
        )
    }
}

internal class MediaPermissionController(
    val permission: MediaPermission,
    val request: () -> Unit,
    val openSettings: () -> Unit,
)

/**
 * What the stage says about the grid's permission, under the grid.
 *
 * It sits under rather than over: the board's "Your photos app" tile
 * needs no permission at all, so there is always a way forward and the
 * note is never a wall.
 */
@Composable
internal fun ColumnScope.PermissionNote(
    permission: MediaPermission,
    onRequest: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val granted = permission as? MediaPermission.Granted
    if (granted != null && !granted.partial) return

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Layout.ScreenGutter, vertical = Space.x2)
            .testTag("wizard_pick_permission"),
        verticalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        Text(
            text = when {
                granted != null -> "Showing the pictures you chose."
                permission is MediaPermission.Refused ->
                    "CoGra cannot see your pictures. You can still pick them in your photos app."
                else -> "Let CoGra show your newest pictures here."
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        when {
            granted != null -> CograButton(
                text = "Choose more",
                onClick = onRequest,
                kind = ButtonKind.Text,
                testTag = "wizard_pick_permission_more",
            )
            permission is MediaPermission.Refused -> CograButton(
                text = "Open settings",
                onClick = onOpenSettings,
                kind = ButtonKind.Text,
                testTag = "wizard_pick_permission_settings",
            )
            else -> CograButton(
                text = "Show my pictures",
                onClick = onRequest,
                kind = ButtonKind.Text,
                testTag = "wizard_pick_permission_grant",
            )
        }
    }
}
