const { withGradleProperties } = require('@expo/config-plugins');

module.exports = (config) => {
  // Suppress any leftover Kotlin/Compose version compatibility warnings
  config = withGradleProperties(config, (config) => {
    const alreadySet = config.modResults.some(
      (item) => item.key === 'androidx.compose.compiler.plugins.kotlin.suppressKotlinVersionCompatibilityCheck'
    );
    if (!alreadySet) {
      config.modResults.push({
        type: 'property',
        key: 'androidx.compose.compiler.plugins.kotlin.suppressKotlinVersionCompatibilityCheck',
        value: 'true',
      });
    }
    return config;
  });

  return config;
};
