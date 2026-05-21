var configPlugins = require('@expo/config-plugins');
var withProjectBuildGradle = configPlugins.withProjectBuildGradle;

module.exports = function(config) {
  return withProjectBuildGradle(config, function(config) {
    if (config.modResults.language === 'groovy') {
      var contents = config.modResults.contents;

      // Force a stable Kotlin version and suppress the Compose compatibility check
      // for Expo modules in development builds.
      var bypassSnippet = "\n    ext.kotlinVersion = \"1.9.24\"\n    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n        kotlinOptions {\n            freeCompilerArgs += [\"-Xskip-metadata-version-check\"]\n            freeCompilerArgs += [\"-P\", \"plugin:androidx.compose.compiler.plugins.kotlin:suppressKotlinVersionCompatibilityCheck=true\"]\n        }\n    }\n";

      if (contents.indexOf('suppressKotlinVersionCompatibilityCheck=true') === -1) {
        // Inject into allprojects block (for app and subprojects)
        contents = contents.replace(
          /allprojects\s*{/,
          "allprojects {" + bypassSnippet
        );
      }

      config.modResults.contents = contents;
    }
    return config;
  });
};
