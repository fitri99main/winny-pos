import React from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import AppNavigator from './src/navigation/AppNavigator';
import * as SessionLib from './src/context/SessionContext';
var SessionProvider = SessionLib.SessionProvider;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaProvider = RNSAC.SafeAreaProvider;
import StatusModal from './src/components/StatusModal';

SplashScreen.preventAutoHideAsync();

var otaUpdatesEnabledByEnv = process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES;
var shouldUseOtaUpdates = !__DEV__ && otaUpdatesEnabledByEnv !== 'false' && !!Updates.isEnabled;

function App() {
    var state = React.useState(false);
    var updateVisible = state[0];
    var setUpdateVisible = state[1];

    React.useEffect(function() {
        var prepare = function() {
            return new Promise(function(resolve) { 
                setTimeout(resolve, 1500); 
            }).then(function() {
                return SplashScreen.hideAsync();
            })['catch'](function(e) {
                console.warn(e);
                return SplashScreen.hideAsync();
            });
        };

        prepare();

        if (!shouldUseOtaUpdates) {
            return;
        }

        var subscription = null;
        if (typeof Updates.addListener === 'function') {
            subscription = Updates.addListener(function(event) {
                if (event.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
                    setUpdateVisible(true);
                }
            });
        }

        function onFetchUpdateAsync() {
            return Updates.checkForUpdateAsync()
                .then(function(update) {
                    if (update.isAvailable) {
                        return Updates.fetchUpdateAsync().then(function() {
                            setUpdateVisible(true);
                        });
                    }
                })['catch'](function(error) {
                    if (!__DEV__) {
                        console.log("Pengecekan update gagal: " + error);
                    }
                });
        }

        var timer = setTimeout(function() {
            onFetchUpdateAsync();
        }, 3000);

        return function() {
            if (subscription && typeof subscription.remove === 'function') {
                subscription.remove();
            }
            clearTimeout(timer);
        };
    }, []);

    var handleReload = function() {
        if (!shouldUseOtaUpdates) {
            return Promise.resolve();
        }
        setUpdateVisible(false);
        return Updates.reloadAsync()['catch'](function(error) {
            console.error("Gagal memuat ulang:", error);
        });
    };

    return React.createElement(SafeAreaProvider, null,
        React.createElement(SessionProvider, null,
            React.createElement(AppNavigator, null),
            React.createElement(StatusModal, {
                visible: updateVisible,
                onClose: function() { setUpdateVisible(false); },
                onConfirm: handleReload,
                title: "Update Terbaru",
                message: "Update terbaru tersedia, aplikasi akan dimuat ulang untuk menerapkan perubahan.",
                type: "update",
                confirmText: "Muat Ulang Sekarang",
                showClose: false
            })
        )
    );
}

export default App;
