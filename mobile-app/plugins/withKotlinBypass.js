const { withProjectBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = (config) => {
  // 1. Force Kotlin Version in build.gradle
  config = withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /kotlinVersion = findProperty\('android\.kotlinVersion'\) \?: '.*'/,
      "kotlinVersion = '1.9.24'"
    );
    return config;
  });

  // 2. Add Bypass Flag in gradle.properties
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'androidx.compose.compiler.plugins.kotlin.suppressKotlinVersionCompatibilityCheck',
      value: 'true',
    });
    return config;
  });

  return config;
};
