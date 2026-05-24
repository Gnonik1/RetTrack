import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBottomNav,
  type AppBottomNavTab,
} from '../../src/components/AppBottomNav';
import { theme } from '../../src/constants/theme';
import { usePurchases } from '../../src/features/purchases/state/PurchasesState';
import { useAppSettings } from '../../src/features/settings/state/AppSettingsState';
import { useAuth } from '../../src/state/AuthState';

const tabToRouteName: Record<AppBottomNavTab, string> = {
  history: 'history',
  home: 'purchases',
  profile: 'profile',
  settings: 'settings',
};

function getActiveTab(routeName?: string): AppBottomNavTab {
  if (routeName === 'history') {
    return 'history';
  }

  if (routeName === 'profile') {
    return 'profile';
  }

  if (routeName === 'settings') {
    return 'settings';
  }

  return 'home';
}

function RetTrackTabBar({ navigation, state }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];

  const handleTabPress = (tab: AppBottomNavTab) => {
    const routeName = tabToRouteName[tab];
    const route = state.routes.find((item) => item.name === routeName);

    if (!route) {
      return;
    }

    const event = navigation.emit({
      canPreventDefault: true,
      target: route.key,
      type: 'tabPress',
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.tabBarHost, { height: insets.bottom }]}
    >
      <AppBottomNav
        activeTab={getActiveTab(activeRoute?.name)}
        onAddPress={() => router.push('/add-purchase')}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

export default function MainTabsLayout() {
  const { isAuthLoading } = useAuth();
  const { hasHydratedSettings } = useAppSettings();
  const { hasHydratedPurchases } = usePurchases();
  const mainTabsReady =
    !isAuthLoading && hasHydratedSettings && hasHydratedPurchases;

  if (!mainTabsReady) {
    return <View style={styles.readyPlaceholder} />;
  }

  return (
    <Tabs
      detachInactiveScreens={false}
      initialRouteName="purchases"
      screenOptions={{ headerShown: false, lazy: false }}
      tabBar={(props) => <RetTrackTabBar {...props} />}
    >
      <Tabs.Screen name="purchases" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  readyPlaceholder: {
    backgroundColor: theme.colors.bg,
    flex: 1,
  },
  tabBarHost: {
    overflow: 'visible',
  },
});
