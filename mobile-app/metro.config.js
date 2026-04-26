const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Help Metro find packages in the local node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Force resolve expo-asset to avoid bundling failures
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-asset': path.resolve(__dirname, 'node_modules/expo-asset'),
};

// Limit worker concurrency to prevent SIGTERM on memory-constrained systems (like Windows)
// Metro defaults to the number of CPU cores, which can overwhelm RAM.
config.maxWorkers = 2; 

module.exports = config;

