var configPlugins = require('@expo/config-plugins');
var withProjectBuildGradle = configPlugins.withProjectBuildGradle;

module.exports = function(config) {
  return withProjectBuildGradle(config, function(config) {
    if (config.modResults.language === 'groovy') {
      var contents = config.modResults.contents;

      // 1. Inject into buildscript (for internal plugins like expo-updates)
      var bypassSnippet = "\n    ext.kotlinVersion = \"1.9.24\"\n    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {\n        kotlinOptions {\n            freeCompilerArgs += [\"-Xskip-metadata-version-check\"]\n        }\n    }\n";

      if (contents.indexOf('-Xskip-metadata-version-check') === -1) {
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
