import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import { SessionProvider } from './src/context/SessionContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function App() {
    useEffect(() => {
        // Hide splash screen after a short delay to ensure everything is initialized
        const prepare = async () => {
            try {
                // Pre-load fonts, make any API calls you need to do here
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.warn(e);
            } finally {
                await SplashScreen.hideAsync();
            }
        };

        prepare();
    }, []);

    return (
        <SessionProvider>
            <AppNavigator />
        </SessionProvider>
    );
}

export default App;
