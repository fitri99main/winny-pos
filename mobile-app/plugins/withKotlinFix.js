const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;

      // 1. Inject into buildscript (for internal plugins like expo-updates)
      const bypassSnippet = `
    ext.kotlinVersion = "1.9.24"
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            freeCompilerArgs += ["-Xskip-metadata-version-check"]
        }
    }
`;

      if (!contents.includes('-Xskip-metadata-version-check')) {
        // Inject into allprojects block (for app and subprojects)
        contents = contents.replace(
          /allprojects\s*{/,
          `allprojects {${bypassSnippet}`
        );
      }

      config.modResults.contents = contents;
    }
    return config;
  });
};
