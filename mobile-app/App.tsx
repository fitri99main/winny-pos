import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';

// Required for NativeWind
import { withExpoSnack } from 'nativewind';

function App() {
    return <AppNavigator />;
}

export default App; // withExpoSnack(App) might be needed for Expo Snack, but standard export is fine for CLI
