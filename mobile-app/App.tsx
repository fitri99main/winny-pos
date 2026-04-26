import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import AppNavigator from './src/navigation/AppNavigator';
import { SessionProvider } from './src/context/SessionContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StatusModal from './src/components/StatusModal';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function App() {
    const [updateVisible, setUpdateVisible] = useState(false);

    useEffect(() => {
        // Handle OTA Updates with listener safely
        let subscription: any = null;
        if (typeof Updates.addListener === 'function') {
            subscription = Updates.addListener((event) => {
                if (event.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
                    setUpdateVisible(true);
                }
            });
        }

        async function onFetchUpdateAsync() {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    await Updates.fetchUpdateAsync();
                    setUpdateVisible(true);
                }
            } catch (error) {
                // Ignore error in development
                if (!__DEV__) {
                    console.log(`Pengecekan update gagal: ${error}`);
                }
            }
        }

        // Hide splash screen after initialization
        const prepare = async () => {
            try {
                // Minimum splash time
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (e) {
                console.warn(e);
            } finally {
                await SplashScreen.hideAsync();
            }
        };

        prepare();

        // Run manual check after 3 seconds
        const timer = setTimeout(() => {
            onFetchUpdateAsync();
        }, 3000);

        return () => {
            if (subscription && typeof subscription.remove === 'function') {
                subscription.remove();
            }
            clearTimeout(timer);
        };
    }, []);

    const handleReload = async () => {
        try {
            setUpdateVisible(false);
            await Updates.reloadAsync();
        } catch (error) {
            console.error("Gagal memuat ulang:", error);
        }
    };

    return (
        <SafeAreaProvider>
            <SessionProvider>
                <AppNavigator />
                <StatusModal 
                    visible={updateVisible}
                    onClose={() => setUpdateVisible(false)}
                    onConfirm={handleReload}
                    title="Update Terbaru"
                    message="Update terbaru tersedia, aplikasi akan dimuat ulang untuk menerapkan perubahan."
                    type="update"
                    confirmText="Muat Ulang Sekarang"
                    showClose={false}
                />
            </SessionProvider>
        </SafeAreaProvider>
    );
}

export default App;
