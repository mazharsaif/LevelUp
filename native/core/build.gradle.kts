// Pure Kotlin (JVM) port of app/js/store.js + the logic parts of lesson.js / lang.js / hero.js.
// No Android dependencies, so it runs in plain JVM unit tests (golden tests against the real JS).
plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.kotlin.plugin.serialization")
}

java { toolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }
kotlin { jvmToolchain(17) }

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
    api("org.jsoup:jsoup:1.18.3")                      // grammar chapters are HTML (splitGrammar)
    api("com.squareup.okhttp3:okhttp:4.12.0")          // API client (shared by app + JVM integration tests)
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    // integration tests talk to the local test server only when LU_TEST_SERVER is set
    environment("LU_TEST_SERVER", System.getenv("LU_TEST_SERVER") ?: "")
    inputs.property("luTestServer", System.getenv("LU_TEST_SERVER") ?: "")   // rerun when it changes
    testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}

tasks.withType<Test>().configureEach {
    // golden tests read the real course files from the web app (read only)
    systemProperty("levelup.app", rootProject.projectDir.parentFile.resolve("app").absolutePath)
    maxHeapSize = "2g"
}
