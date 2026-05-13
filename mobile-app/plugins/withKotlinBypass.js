var configPlugins = require('@expo/config-plugins');
var withGradleProperties = configPlugins.withGradleProperties;

module.exports = function(config) {
  // Suppress any leftover Kotlin/Compose version compatibility warnings
  config = withGradleProperties(config, function(config) {
    var alreadySet = config.modResults.some(function(item) {
      return item.key === 'androidx.compose.compiler.plugins.kotlin.suppressKotlinVersionCompatibilityCheck';
    });
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
