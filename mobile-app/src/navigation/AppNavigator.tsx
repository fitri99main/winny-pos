import React from 'react';
import * as NativeNav from '@react-navigation/native';
var NavigationContainer = NativeNav.NavigationContainer;
import * as NativeStack from '@react-navigation/native-stack';
var createNativeStackNavigator = NativeStack.createNativeStackNavigator;
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import POSScreen from '../screens/POSScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProductScreen from '../screens/ProductScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AccountingScreen from '../screens/AccountingScreen';
import StoreSettingsScreen from '../screens/StoreSettingsScreen';
import EmployeeSettingsScreen from '../screens/EmployeeSettingsScreen';

import CashierSessionHistoryScreen from '../screens/CashierSessionHistoryScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import PettyCashScreen from '../screens/PettyCashScreen';
import KDSScreen from '../screens/KDSScreen';
import * as SessionLib from '../context/SessionContext';
var useSession = SessionLib.useSession;
import * as RN from 'react-native';
var View = RN.View;
var ActivityIndicator = RN.ActivityIndicator;

var Stack = createNativeStackNavigator();

export default function AppNavigator() {
    var session = useSession();
    var authSession = session.authSession;
    var loading = session.loading;
    var isAdmin = session.isAdmin;

    if (loading) {
        return React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' } },
            React.createElement(ActivityIndicator, { size: "large", color: "#ea580c" })
        );
    }

    var screens = [];
    if (!authSession) {
        screens.push(React.createElement(Stack.Screen, { key: "Login", name: "Login", component: LoginScreen }));
    } else {
        screens.push(React.createElement(Stack.Screen, { key: "Main", name: "Main", component: HomeScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "POS", name: "POS", component: POSScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "History", name: "History", component: HistoryScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "CashierSessionHistory", name: "CashierSessionHistory", component: CashierSessionHistoryScreen }));
        if (isAdmin) {
            screens.push(React.createElement(Stack.Screen, { key: "Products", name: "Products", component: ProductScreen }));
        }
        screens.push(React.createElement(Stack.Screen, { key: "Settings", name: "Settings", component: SettingsScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "Accounting", name: "Accounting", component: AccountingScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "StoreSettings", name: "StoreSettings", component: StoreSettingsScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "EmployeeSettings", name: "EmployeeSettings", component: EmployeeSettingsScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "Purchases", name: "Purchases", component: PurchasesScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "PettyCash", name: "PettyCash", component: PettyCashScreen }));
        screens.push(React.createElement(Stack.Screen, { key: "KDS", name: "KDS", component: KDSScreen }));
    }

    return React.createElement(NavigationContainer, null,
        React.createElement(Stack.Navigator, { screenOptions: { headerShown: false } },
            screens
        )
    );
}
