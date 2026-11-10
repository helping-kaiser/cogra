import org.gradle.api.Action
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

/**
 * Makes a Hilt module's main KSP task fail when it reports success with
 * an output Hilt could not have produced: every `class X @Inject
 * constructor` in the module's own sources yields an `X_Factory`, and
 * every `@InstallIn` type yields a `hilt_aggregated_deps` entry. A KSP
 * run that silently drops them otherwise surfaces two tasks later, in
 * the app's Hilt compile, as a `[Dagger/MissingBinding]` for every
 * binding the module declares — which reads like a code defect
 * (google/ksp#3286 is one such cause).
 *
 * The check runs as the KSP task's own last action, so a failure also
 * denies the task a successful execution record: the next build runs
 * it again instead of trusting the short output as up to date.
 */
internal fun Project.guardHiltKspOutput() {
    val sources = fileTree("src/main") { include("**/*.kt") }
    val modulePath = path
    tasks.named { it.isMainKspTask() }.configureEach {
        doLast(HiltKspOutputCheck(sources, "$modulePath:$name"))
    }
}

/** `kspDebugKotlin`, `kspReleaseKotlin` — not the test source sets'. */
private fun String.isMainKspTask() =
    startsWith("ksp") && endsWith("Kotlin") && !endsWith("UnitTestKotlin") && !endsWith("AndroidTestKotlin")

private val INJECT_CONSTRUCTOR = Regex("""\bclass\s+(\w+)(?:<[^>]*>)?\s+@Inject\s+constructor""")
private val INSTALL_IN = Regex("""@InstallIn\([^)]*\)[\s\S]*?\b(?:object|class|interface)\s+(\w+)""")
private const val AGGREGATED_DEPS_PACKAGE = "hilt_aggregated_deps"
private const val SHOWN = 5

private class HiltKspOutputCheck(
    private val sources: FileCollection,
    private val taskPath: String,
) : Action<Task> {
    override fun execute(task: Task) {
        val text = sources.files.joinToString("\n") { it.readText() }
        val factories = INJECT_CONSTRUCTOR.findAll(text).map { "${it.groupValues[1]}_Factory.java" }.toList()
        val aggregated = INSTALL_IN.findAll(text).map { "_${it.groupValues[1]}.java" }.toList()

        val produced = task.outputs.files.asFileTree.files
        val allNames = produced.map { it.name }
        val aggregatedNames = produced.filter { it.parentFile.name == AGGREGATED_DEPS_PACKAGE }.map { it.name }
        val missing = factories.filter { want -> allNames.none { it.endsWith(want) } } +
            aggregated.filter { want -> aggregatedNames.none { it.endsWith(want) } }

        if (missing.isNotEmpty()) {
            throw GradleException(
                """
                |$taskPath reported success, but ${missing.size} of the ${factories.size + aggregated.size}
                |sources Hilt always generates for this module's @Inject constructors and @InstallIn
                |modules are missing (first: ${missing.take(SHOWN).joinToString()}).
                |The app would fail later with [Dagger/MissingBinding] — a short KSP run, not a code
                |defect. Heal:
                |  ./gradlew --no-build-cache $taskPath --rerun
                """.trimMargin(),
            )
        }
    }
}
