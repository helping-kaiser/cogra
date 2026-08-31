// A test-only shim for the three EGL types the cropper's decoder reaches
// for, and for no other purpose.
//
// `CropImageView` sizes its decode against the GL maximum texture size,
// which it reads through `javax.microedition.khronos.egl.EGLContext`.
// Robolectric's sandbox classloader deliberately does not acquire
// `javax.*` — it delegates those to the application classloader, which
// carries no Android framework — so on the JVM that read fails with a
// `NoClassDefFoundError`. An *Error* is not an *Exception*, so it escapes
// the library's own `catch (e: Exception)` and takes the whole test with
// it, before a single assertion runs. `@Config(instrumentedPackages)`
// does not help: it adds instrumentation, it does not lift the
// do-not-acquire rule.
//
// Supplying the types on the application classloader is what lets that
// existing fallback do its job: `getEGL()` answers null, the library's
// `as EGL10` throws a plain `NullPointerException`, its catch takes over,
// and the decode proceeds at the safe default dimension it already ships.
// The signature is matched exactly — the call site is compiled against
// the real `()Ljavax/microedition/khronos/egl/EGL;`, and a mismatch would
// be a `NoSuchMethodError`, i.e. the same Error problem again.
//
// Nothing in `src/main` sees these; on a device the real framework
// classes are used and this file does not ship.

package javax.microedition.khronos.egl

interface EGL

interface EGL10 : EGL

interface EGLConfig

abstract class EGLContext {
    companion object {
        @JvmStatic
        fun getEGL(): EGL? = null
    }
}
