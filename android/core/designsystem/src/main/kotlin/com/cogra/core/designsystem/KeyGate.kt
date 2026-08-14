// The device gate in front of anything that reveals or replaces key
// material (auth.md "Re-authentication before key material"). The
// account password gates nothing here — it authenticates the account,
// never the actor, and it is the factor that leaks. The device
// credential is what the platform documents for revealing a stored
// secret, and it does not lock out the person who lost their recovery
// code, who is exactly who export exists for.

package com.cogra.core.designsystem

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.LocalActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** How a gated confirmation ended. */
sealed interface KeyGateResult {
    data object Granted : KeyGateResult

    /** Cancelled, or too many failed attempts — the action does not run. */
    data object Denied : KeyGateResult

    /**
     * The phone cannot ask: no biometric enrolled and no screen lock.
     * The caller warns rather than blocks — a device with no lock is
     * still the holder's device, and locking them out of their own key
     * would be the worse failure.
     */
    data object Unavailable : KeyGateResult
}

/**
 * A confirmation the device performs, not the server. Call it from a
 * composition coroutine scope: the prompt is a UI object and
 * [BiometricPrompt.authenticate] runs on the main thread.
 */
interface KeyGate {
    suspend fun confirm(title: String, subtitle: String): KeyGateResult
}

/**
 * `BIOMETRIC_STRONG or DEVICE_CREDENTIAL` is unsupported at API 29 and
 * below, where the documented pairing is the weak class with the same
 * fallback ("Show a biometric authentication dialog").
 */
private val AUTHENTICATORS: Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) BIOMETRIC_STRONG or DEVICE_CREDENTIAL
    else BIOMETRIC_WEAK or DEVICE_CREDENTIAL

/**
 * Sends the user where a lock is set up — the documented enrolment
 * intent from API 30, the security settings below it. Best effort: a
 * device that cannot show either simply stays as it is, since the gate
 * warns rather than blocks.
 */
fun openScreenLockSettings(context: Context) {
    val enroll = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_BIOMETRIC_ENROLL)
            .putExtra(Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED, AUTHENTICATORS)
    } else {
        Intent(Settings.ACTION_SECURITY_SETTINGS)
    }
    try {
        context.startActivity(enroll)
    } catch (e: ActivityNotFoundException) {
        try {
            context.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
        } catch (e: ActivityNotFoundException) {
            // Nothing to open; the warning already said what to do.
        }
    }
}

/** The real gate, bound to the hosting activity. */
@Composable
fun rememberKeyGate(): KeyGate {
    val activity = LocalActivity.current as? FragmentActivity
    return remember(activity) { BiometricKeyGate(activity) }
}

private class BiometricKeyGate(private val activity: FragmentActivity?) : KeyGate {

    override suspend fun confirm(title: String, subtitle: String): KeyGateResult {
        val host = activity ?: return KeyGateResult.Unavailable
        if (BiometricManager.from(host).canAuthenticate(AUTHENTICATORS) !=
            BiometricManager.BIOMETRIC_SUCCESS
        ) {
            return KeyGateResult.Unavailable
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            // A negative button cannot ride along with DEVICE_CREDENTIAL;
            // the system supplies the fallback entry itself.
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build()
        return suspendCancellableCoroutine { continuation ->
            val prompt = BiometricPrompt(
                host,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(
                        result: BiometricPrompt.AuthenticationResult,
                    ) {
                        if (continuation.isActive) continuation.resume(KeyGateResult.Granted)
                    }

                    // A single failed attempt leaves the prompt standing;
                    // only an error ends it, so only an error resumes.
                    override fun onAuthenticationError(code: Int, message: CharSequence) {
                        if (!continuation.isActive) return
                        val result = when (code) {
                            BiometricPrompt.ERROR_NO_BIOMETRICS,
                            BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL,
                            BiometricPrompt.ERROR_HW_NOT_PRESENT,
                            -> KeyGateResult.Unavailable
                            else -> KeyGateResult.Denied
                        }
                        continuation.resume(result)
                    }
                },
            )
            // Cancellation can arrive on any thread; cancelAuthentication
            // is a UI call.
            continuation.invokeOnCancellation {
                host.runOnUiThread { prompt.cancelAuthentication() }
            }
            prompt.authenticate(info)
        }
    }
}
