// The app's one log. Plain Kotlin, in the module every other module
// already depends on, so the transport tier and the media pipeline can
// both reach it; the sink that turns a line into logcat is installed by
// :app, which is where build-specific bindings live (android/CLAUDE.md).

package com.cogra.domain

/**
 * Where a fault gets written down.
 *
 * The whole point is the [Throwable]. A transport fault arrives
 * carrying its cause — an `SSLHandshakeException` under an Apollo
 * wrapper says "this device does not trust that certificate", which is
 * a different repair from an unreachable host — and collapsing it to a
 * boolean is what made a trust failure and a dead network look the same
 * in `adb logcat`.
 *
 * **Nothing is written until a sink is installed**, and only the debug
 * app installs one. That is the gate, and it is a real one: it does not
 * depend on a library module's own `BuildConfig.DEBUG`, which describes
 * how that library variant was built rather than how the app was. The
 * message is a lambda for the same reason — with no sink, the string is
 * never built.
 */
object CograLog {

    /** One line, as the platform writes it. */
    fun interface Sink {
        fun write(tag: String, message: String, cause: Throwable?)
    }

    @Volatile
    private var sink: Sink? = null

    /** Starts writing. Called once, by the debug app. */
    fun install(sink: Sink) {
        this.sink = sink
    }

    /** Stops writing — how a test puts the log back as it found it. */
    fun uninstall() {
        sink = null
    }

    /** Whether anything is listening. */
    val enabled: Boolean get() = sink != null

    /** Records a fault under [tag], with the cause that explains it. */
    fun w(tag: String, cause: Throwable? = null, message: () -> String) {
        sink?.write(tag, message(), cause)
    }
}
