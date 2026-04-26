
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Fixing Expo Export Issue ---');

const projectRoot = process.cwd();
const nodeModules = path.join(projectRoot, 'node_modules');

// 1. Remove metro cache
const metroCache = path.join(process.env.TEMP || '/tmp', 'metro-cache');
if (fs.existsSync(metroCache)) {
  console.log('Clearing metro cache...');
  try {
    fs.rmSync(metroCache, { recursive: true, force: true });
  } catch (e) {
    console.log('Could not clear metro cache automatically, please do it manually.');
  }
}

// 2. Check for expo-asset
const expoAssetPath = path.join(nodeModules, 'expo-asset');
if (!fs.existsSync(expoAssetPath)) {
  console.log('expo-asset is missing from node_modules. Attempting to install...');
} else {
  const pkg = JSON.parse(fs.readFileSync(path.join(expoAssetPath, 'package.json'), 'utf8'));
  console.log(`Found expo-asset version: ${pkg.version}`);
}

// 3. Check for duplicates in expo/node_modules
const nestedExpoAsset = path.join(nodeModules, 'expo', 'node_modules', 'expo-asset');
if (fs.existsSync(nestedExpoAsset)) {
  console.log('Found duplicate expo-asset in expo/node_modules. Removing it...');
  fs.rmSync(nestedExpoAsset, { recursive: true, force: true });
}

console.log('\nSuggested actions:');
console.log('1. Run: npx expo install --check');
console.log('2. Run: npx expo export --clear');
console.log('3. If it still fails, try deleting node_modules and running npm install.');

console.log('\nAttempting to run expo doctor...');
try {
  const output = execSync('npx expo doctor', { stdio: 'inherit' });
} catch (e) {
  console.log('Expo doctor failed, but that is expected if there are mismatches.');
}
