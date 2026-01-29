const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { pathToFileURL } = require("url");
const path = require("path");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
    input: pathToFileURL(path.resolve(__dirname, 'global.css')).href
});
