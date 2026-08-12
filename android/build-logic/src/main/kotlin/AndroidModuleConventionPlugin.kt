import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.dsl.CommonExtension
import com.android.build.api.dsl.LibraryExtension
import com.android.build.api.variant.ApplicationAndroidComponentsExtension
import com.android.build.api.variant.LibraryAndroidComponentsExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension

/**
 * The configuration every android-variant module shares: SDK levels
 * from the catalog, Java 17, the release-variant unit-test skip, and
 * parallel test forks. Applied after the module's own
 * android.application/android.library plugin.
 */
class AndroidModuleConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")

        pluginManager.withPlugin("com.android.application") {
            extensions.configure<ApplicationExtension> { configureAndroid(libs) }
            // Unit tests run once, on the debug variant: the release
            // variant would re-compile and re-run every suite for no
            // extra signal.
            extensions.configure<ApplicationAndroidComponentsExtension> {
                beforeVariants(selector().withBuildType("release")) {
                    it.enableUnitTest = false
                }
            }
        }
        pluginManager.withPlugin("com.android.library") {
            extensions.configure<LibraryExtension> { configureAndroid(libs) }
            extensions.configure<LibraryAndroidComponentsExtension> {
                beforeVariants(selector().withBuildType("release")) {
                    it.enableUnitTest = false
                }
            }
        }

        // Robolectric suites pay a per-class sandbox warmup; run test
        // classes in parallel forks instead of one core at a time.
        tasks.withType<Test>().configureEach {
            maxParallelForks = maxOf(1, Runtime.getRuntime().availableProcessors() / 2)
        }

        extensions.configure<KotlinAndroidProjectExtension> {
            jvmToolchain(17)
        }
    }
}

private fun CommonExtension<*, *, *, *, *, *>.configureAndroid(libs: VersionCatalog) {
    compileSdk = libs.findVersion("compileSdk").get().requiredVersion.toInt()
    defaultConfig.minSdk = libs.findVersion("minSdk").get().requiredVersion.toInt()
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
