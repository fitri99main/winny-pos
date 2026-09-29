import React from 'react';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import * as SessionLib from './src/context/SessionContext';
var SessionProvider = SessionLib.SessionProvider;
import * as RNSAC from 'react-native-safe-area-context';
var SafeAreaProvider = RNSAC.SafeAreaProvider;

SplashScreen.preventAutoHideAsync();

function App() {

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
    }, []);

    return React.createElement(SafeAreaProvider, null,
        React.createElement(SessionProvider, null,
            React.createElement(AppNavigator, null)
        )
    );
}

export default App;
