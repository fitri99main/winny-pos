
try {
  console.log('expo-asset:', require.resolve('expo-asset'));
} catch (e) {
  console.log('expo-asset not found');
}
try {
  console.log('expo-asset/package.json:', require('expo-asset/package.json').version);
} catch (e) {
  console.log('expo-asset package.json not found');
}
